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
    
    // Missing assets panel visibility (F6 toggle)
    this.showMissingAssets = false;
    
    // Umístění: vlevo dole nad počítadlo zničených buněk a mimo HP/XP bary
    const cam = scene.cameras?.main;
    const margin = 8;
    const x = margin;
    const y = (cam ? cam.height : 0) - 140; // posun výše, aby nekolidovalo s počítadlem buněk
    this.text = scene.add.text(x, y, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#00ff88',
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: { x: 6, y: 4 }
    }).setScrollFactor(0);
    // Add to UI layer if it exists
    if (scene.uiLayer) {
      scene.uiLayer.add(this.text);
    }
    this.text.setVisible(this.visible); // Respect initial visibility
    this._margin = margin;
    this._acc = 0;
    
    // Missing assets panel (top-right corner)
    this.missingAssetsText = scene.add.text(cam.width - margin, margin, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ff6666',
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setOrigin(1, 0);
    // Add to UI layer if it exists
    if (scene.uiLayer) {
      scene.uiLayer.add(this.missingAssetsText);
    }
    this.missingAssetsText.setVisible(false);
    
    // Setup F6 key for missing assets toggle
    this._setupKeyBindings();
    
    // Flash message support pro hot reload notifikace
    this._flashMessages = [];
    this._flashText = scene.add.text(x, y - 30, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffaa00'
    }).setScrollFactor(0);
    // Add to UI layer if it exists
    if (scene.uiLayer) {
      scene.uiLayer.add(this._flashText);
    }
    this._flashText.setVisible(this.visible); // Respect initial visibility

    // Reakce na resize – držet overlay doleva dolů a missing assets vpravo nahoře
    try {
      scene.scale.on('resize', (gameSize) => {
        const h = gameSize?.height || scene.cameras.main.height;
        const w = gameSize?.width || scene.cameras.main.width;
        this.text.setPosition(this._margin, h - 140);
        this._flashText.setPosition(this._margin, h - 170);
        this.missingAssetsText.setPosition(w - this._margin, this._margin);
      });
    } catch (_) {}
  }

  destroy() {
    // Clean up text objects
    if (this.text) {
      this.text.destroy();
      this.text = null;
    }
    if (this._flashText) {
      this._flashText.destroy();
      this._flashText = null;
    }
    if (this.missingAssetsText) {
      this.missingAssetsText.destroy();
      this.missingAssetsText = null;
    }
    
    // No keyboard listeners to clean up - KeyboardManager handles everything
    
    // Clean up resize listener if exists
    if (this.scene?.scale) {
      this.scene.scale.off('resize');
    }
  }
  
  _setupKeyBindings() {
    // Keyboard shortcuts are now handled centrally by KeyboardManager
    // F3 - debug overlay toggle via 'debug.overlay.toggle' event
    // F6 - missing assets toggle via 'debug.missing-assets.toggle' event
    // No direct keyboard handlers needed here
  }
  
  _updateMissingAssetsPanel() {
    if (!window.__missingAssets) {
      this.missingAssetsText.setText('No missing assets tracked');
      return;
    }
    
    const sfxMissing = Array.from(window.__missingAssets.sfx || []);
    const vfxMissing = Array.from(window.__missingAssets.vfx || []);
    
    const lines = ['🔍 MISSING ASSETS (F6 to toggle)'];
    lines.push('─────────────────────────');
    
    if (sfxMissing.length > 0) {
      lines.push(`🔊 SFX (${sfxMissing.length}):`);
      sfxMissing.slice(0, 10).forEach(id => {
        lines.push(`  ${id}`);
      });
      if (sfxMissing.length > 10) {
        lines.push(`  ... +${sfxMissing.length - 10} more`);
      }
    }
    
    if (vfxMissing.length > 0) {
      if (sfxMissing.length > 0) lines.push('');
      lines.push(`✨ VFX (${vfxMissing.length}):`);
      vfxMissing.slice(0, 10).forEach(id => {
        lines.push(`  ${id}`);
      });
      if (vfxMissing.length > 10) {
        lines.push(`  ... +${vfxMissing.length - 10} more`);
      }
    }
    
    if (sfxMissing.length === 0 && vfxMissing.length === 0) {
      lines.push('✅ All assets found!');
    } else {
      lines.push('─────────────────────────');
      lines.push('Console: DEV.dumpMissing()');
      lines.push('Copy: DEV.copyMissing("all")');
    }
    
    this.missingAssetsText.setText(lines.join('\n'));
  }

  update(time, delta) {
    // Skip main overlay update if not visible
    if (this.visible) {
      this._acc += delta;
      if (this._acc >= 500) { // aktualizace 2× za sekundu
        this._acc = 0;
        this._updateMainOverlay(time, delta);
      }
    }
    
    // Update missing assets panel if visible
    if (this.showMissingAssets) {
      this._updateMissingAssetsPanel();
    }
    
    // Always update flash messages if visible
    if (this.visible) {
      this._updateFlashMessages(time);
    }
  }
  
  _updateMainOverlay(time, delta) {
    const s = this.scene;
    const fps = Math.round(s.game.loop.actualFps || (1000 / (delta || 16.7)));
    
    // HOTFIX V3: Use correct system references
    const enemies = s.enemies?.children?.entries?.length ?? 
                   s.enemiesGroup?.children?.entries?.length ?? 0;
    const projP = s.projectileSystem?.playerBullets?.children?.entries?.length ?? 0;
    const projE = s.projectileSystem?.enemyBullets?.children?.entries?.length ?? 0;
    const kills = s.gameStats?.enemiesKilled ?? 0;
    const stage = s.stage || 1;
    const wave = s.spawnDirector?.currentWave || 0;
    
    // Performance profiling - system execution times
    const perfData = this._getSystemPerformance();
    
    // System status
    const systems = {
      VFX: s.vfxSystem ? '✅' : '❌',
      SFX: s.sfxSystem ? '✅' : '❌',
      Spawn: s.spawnDirector ? '✅' : '❌',
      Loot: s.lootManager ? '✅' : '❌'
    };
    
    // Get memory usage if available
    let memoryInfo = '';
    if (window.performance && window.performance.memory) {
      const used = Math.round(window.performance.memory.usedJSHeapSize / 1048576);
      const limit = Math.round(window.performance.memory.jsHeapSizeLimit / 1048576);
      memoryInfo = `Memory: ${used}MB / ${limit}MB`;
    }
    
    const lines = [
      `🎮 DEBUG OVERLAY (F3 to toggle)`,
      `─────────────────────────`,
      `FPS: ${fps} | Stage: ${stage} | Wave: ${wave}`,
      `Enemies: ${enemies} | Kills: ${kills}`,
      `Projectiles: P${projP}/E${projE}`,
      `Systems: ${Object.entries(systems).map(([k,v]) => `${k}${v}`).join(' ')}`,
    ];
    
    if (memoryInfo) {
      lines.push(memoryInfo);
    }
    
    // Add missing assets summary if any
    if (window.__missingAssets) {
      const sfxCount = window.__missingAssets.sfx?.size || 0;
      const vfxCount = window.__missingAssets.vfx?.size || 0;
      if (sfxCount > 0 || vfxCount > 0) {
        lines.push(`─────────────────────────`);
        lines.push(`⚠️ Missing: SFX(${sfxCount}) VFX(${vfxCount})`);
        lines.push(`Press F6 for details`);
      }
    }
    
    // Add performance data if profiler is enabled
    if (perfData.enabled && perfData.total > 0) {
      lines.push(`─────────────────────────`);
      lines.push(`⏱️ Performance (ms):`);
      Object.entries(perfData.times).forEach(([system, time]) => {
        if (time > 0) {
          lines.push(`  ${system}: ${time}`);
        }
      });
      lines.push(`  Total: ${perfData.total}`);
    }
    
    this.text.setText(lines.join('\n'));
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


