// Jednoduchý debug overlay: FPS, počty entit, aktivní systémy

import { PerformanceProfiler } from './PerformanceProfiler.js';

export class DebugOverlay {
  constructor(scene) {
    this.scene = scene;
    // HOTFIX V4: Default OFF, but respect localStorage setting
    let defaultVisible = false;
    try {
      const stored = localStorage.getItem('debugOverlay');
      if (stored === 'true') defaultVisible = true;
    } catch (e) {}
    this.visible = defaultVisible;
    
    // Umístění: vlevo dole nad počítadlo zničených buněk a mimo HP/XP bary
    const cam = scene.cameras?.main;
    const margin = 8;
    const x = margin;
    const y = (cam ? cam.height : 0) - 140; // posun výše, aby nekolidovalo s počítadlem buněk
    this.text = scene.add.text(x, y, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#00ff88'
    }).setScrollFactor(0);
    this.text.setDepth(10000);
    this.text.setVisible(this.visible); // Respect initial visibility
    this._margin = margin;
    this._acc = 0;
    
    // Flash message support pro hot reload notifikace
    this._flashMessages = [];
    this._flashText = scene.add.text(x, y - 30, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffaa00'
    }).setScrollFactor(0);
    this._flashText.setDepth(10001);
    this._flashText.setVisible(this.visible); // Respect initial visibility

    // Reakce na resize – držet overlay doleva dolů
    try {
      scene.scale.on('resize', (gameSize) => {
        const h = gameSize?.height || scene.cameras.main.height;
        this.text.setPosition(this._margin, h - 140);
        this._flashText.setPosition(this._margin, h - 170);
      });
    } catch (_) {}
  }

  destroy() {
    if (this.text) this.text.destroy();
    if (this._flashText) this._flashText.destroy();
  }

  update(time, delta) {
    // Skip update if not visible
    if (!this.visible) return;
    
    this._acc += delta;
    if (this._acc < 500) return; // aktualizace 2× za sekundu
    this._acc = 0;
    const s = this.scene;
    const fps = Math.round(s.game.loop.actualFps || (1000 / (delta || 16.7)));
    
    // HOTFIX V3: Use correct system references
    const enemies = s.enemies?.children?.entries?.length ?? 
                   s.enemiesGroup?.children?.entries?.length ?? 0;
    const projP = s.projectileSystem?.playerBullets?.children?.entries?.length ?? 0;
    const projE = s.projectileSystem?.enemyBullets?.children?.entries?.length ?? 0;
    const kills = s.gameStats?.enemiesKilled ?? 0;
    
    // Performance profiling - system execution times
    const perfData = this._getSystemPerformance();
    
    const core = [];
    if (s.coreProjectileSystem) core.push('Proj');
    if (s.coreLootSystem) core.push('Loot');
    if (s.coreAISystem) core.push('AI');
    if (s.coreBossSystem) core.push('Boss');
    
    const flags = [];
    try { if (window.localStorage.getItem('coreECS') === 'true') flags.push('coreECS'); } catch (_) {}
    try { if (window.localStorage.getItem('debugOverlay') === 'true') flags.push('debug'); } catch (_) {}
    try { if (window.localStorage.getItem('perfProfiler') === 'true') flags.push('perf'); } catch (_) {}

    const lines = [
      `FPS: ${fps}`,
      `Enemies alive: ${enemies} | Kills: ${kills}`,
      `Projectiles P/E: ${projP}/${projE}`,
      `Core systems: ${core.join(', ') || '-'}`
    ];
    
    // Přidat performance data pokud je enabled
    if (flags.includes('perf') && perfData.enabled) {
      lines.push(`--- Performance (ms/frame) ---`);
      Object.entries(perfData.times).forEach(([system, time]) => {
        lines.push(`${system}: ${time}ms`);
      });
      lines.push(`Total: ${perfData.total}ms`);
    }
    
    lines.push(`Flags: ${flags.join(', ') || '-'}`);
    this.text.setText(lines.join('\n'));
    
    // Aktualizovat flash messages
    this._updateFlashMessages(time);
  }
  
  _getSystemPerformance() {
    const s = this.scene;
    if (!s._perfProfiler) {
      s._perfProfiler = new PerformanceProfiler();
    }
    return s._perfProfiler.getStats();
  }
  
  /**
   * Zobrazit flash message (pro hot reload notifikace)
   * @param {string} message - text zprávy
   * @param {number} duration - doba zobrazení v ms
   */
  flashMessage(message, duration = 3000) {
    const flashMsg = {
      text: message,
      endTime: Date.now() + duration,
      alpha: 1
    };
    
    this._flashMessages.push(flashMsg);
    
    // Udržet max 3 flash messages
    if (this._flashMessages.length > 3) {
      this._flashMessages.shift();
    }
  }
  
  /**
   * Aktualizovat flash messages
   * @param {number} time - game time
   */
  _updateFlashMessages(time) {
    const now = Date.now();
    
    // Odstranit expired messages
    this._flashMessages = this._flashMessages.filter(msg => now < msg.endTime);
    
    // Aktualizovat alpha pro fade out effect
    this._flashMessages.forEach(msg => {
      const remaining = msg.endTime - now;
      const fadeTime = 1000; // posledních 1000ms fade out
      if (remaining < fadeTime) {
        msg.alpha = remaining / fadeTime;
      } else {
        msg.alpha = 1;
      }
    });
    
    // Zobrazit aktivní flash messages
    if (this._flashMessages.length > 0) {
      const displayMessages = this._flashMessages.map(msg => msg.text);
      this._flashText.setText(displayMessages.join('\n'));
      
      // Nastavit alpha nejslabší zprávy
      const minAlpha = Math.min(...this._flashMessages.map(msg => msg.alpha));
      this._flashText.setAlpha(minAlpha);
    } else {
      this._flashText.setText('');
    }
  }
  
  /**
   * Toggle visibility (F3 key handler)
   */
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  /**
   * Show the debug overlay
   */
  show() {
    this.visible = true;
    this.text.setVisible(true);
    this._flashText.setVisible(true);
    
    // Save state to localStorage
    try {
      localStorage.setItem('debugOverlay', 'true');
    } catch (e) {}
    
    console.log('[DebugOverlay] Shown (F3 to toggle)');
  }
  
  /**
   * Hide the debug overlay
   */
  hide() {
    this.visible = false;
    this.text.setVisible(false);
    this._flashText.setVisible(false);
    
    // Save state to localStorage
    try {
      localStorage.setItem('debugOverlay', 'false');
    } catch (e) {}
    
    console.log('[DebugOverlay] Hidden (F3 to toggle)');
  }
}


