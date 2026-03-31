/**
 * DebugOverlay — FPS, entity counts, system status, missing assets
 * Toggled via F3 (overlay) and F6 (missing assets panel)
 */

export class DebugOverlay {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.showMissingAssets = false;
    this._acc = 0;
    this._missingAssetsAcc = 0;

    // Restore saved visibility state
    try {
      if (localStorage.getItem('debugOverlay') === 'true') this.visible = true;
    } catch (_) {}

    const cam = scene.cameras?.main;
    const w = cam?.width || 800;
    const h = cam?.height || 600;
    const margin = 8;

    // Main overlay — bottom-left
    this.text = scene.add.text(margin, h - 140, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#00ff88',
      backgroundColor: 'rgba(0,0,0,0.8)', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(scene.DEPTH_LAYERS?.UI_MODAL ? scene.DEPTH_LAYERS.UI_MODAL + 1000 : 99999).setVisible(this.visible);

    // Flash messages — above main overlay
    this._flashMessages = [];
    this._flashText = scene.add.text(margin, h - 170, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffaa00'
    }).setScrollFactor(0).setDepth(scene.DEPTH_LAYERS?.UI_MODAL ? scene.DEPTH_LAYERS.UI_MODAL + 1000 : 99999).setVisible(this.visible);

    // Missing assets panel — top-right
    this.missingAssetsText = scene.add.text(w - margin, margin, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ff6666',
      backgroundColor: 'rgba(0,0,0,0.8)', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setOrigin(1, 0).setDepth(scene.DEPTH_LAYERS?.UI_MODAL ? scene.DEPTH_LAYERS.UI_MODAL + 1000 : 99999).setVisible(false);

    // Add to UI layer if available
    if (scene.uiLayer) {
      scene.uiLayer.add([this.text, this._flashText, this.missingAssetsText]);
    }

    // Resize handler — store reference for proper cleanup
    this._onResize = (gameSize) => {
      const rh = gameSize?.height || h;
      const rw = gameSize?.width || w;
      this.text.setPosition(margin, rh - 140);
      this._flashText.setPosition(margin, rh - 170);
      this.missingAssetsText.setPosition(rw - margin, margin);
    };
    scene.scale.on('resize', this._onResize);
  }

  destroy() {
    this.text?.destroy();
    this._flashText?.destroy();
    this.missingAssetsText?.destroy();
    this.text = null;
    this._flashText = null;
    this.missingAssetsText = null;

    // Remove only OUR resize listener
    if (this._onResize && this.scene?.scale) {
      this.scene.scale.off('resize', this._onResize);
    }
    this.scene = null;
  }

  // ==================== Update ====================

  update(time, delta) {
    if (this.visible) {
      this._acc += delta;
      if (this._acc >= 500) {
        this._acc = 0;
        this._updateMainOverlay(time, delta);
      }
      this._updateFlashMessages();
    }

    // Missing assets: throttle to 1 update/sec (static data)
    if (this.showMissingAssets) {
      this._missingAssetsAcc += delta;
      if (this._missingAssetsAcc >= 1000) {
        this._missingAssetsAcc = 0;
        this._updateMissingAssetsPanel();
      }
    }
  }

  _updateMainOverlay(time, delta) {
    const s = this.scene;
    if (!s) return;

    const fps = Math.round(s.game.loop.actualFps || 60);
    const enemies = s.enemiesGroup?.children?.entries?.length ?? 0;
    const projP = s.projectileSystem?.playerBullets?.children?.entries?.length ?? 0;
    const projE = s.projectileSystem?.enemyBullets?.children?.entries?.length ?? 0;
    const kills = s.gameStats?.enemiesKilled ?? 0;
    const stage = s.currentLevel || 1;
    const wave = s.spawnDirector?.currentWaveIndex ?? 0;

    const systems = {
      VFX: s.vfxSystem ? '✅' : '❌',
      SFX: s.audioSystem ? '✅' : '❌',
      Spawn: s.spawnDirector ? '✅' : '❌',
      Loot: s.lootSystem ? '✅' : '❌'
    };

    const lines = [
      '🎮 DEBUG OVERLAY (F3)',
      '─────────────────────────',
      `FPS: ${fps} | Stage: ${stage} | Wave: ${wave}`,
      `Enemies: ${enemies} | Kills: ${kills}`,
      `Projectiles: P${projP}/E${projE}`,
      `Systems: ${Object.entries(systems).map(([k, v]) => `${k}${v}`).join(' ')}`,
    ];

    // Memory (Chrome only)
    if (window.performance?.memory) {
      const used = Math.round(window.performance.memory.usedJSHeapSize / 1048576);
      lines.push(`Memory: ${used}MB`);
    }

    // Missing assets summary
    if (window.__missingAssets) {
      const sfxCount = window.__missingAssets.sfx?.size || 0;
      const vfxCount = window.__missingAssets.vfx?.size || 0;
      if (sfxCount > 0 || vfxCount > 0) {
        lines.push('─────────────────────────');
        lines.push(`⚠️ Missing: SFX(${sfxCount}) VFX(${vfxCount}) [F6]`);
      }
    }

    this.text.setText(lines.join('\n'));
  }

  _updateMissingAssetsPanel() {
    if (!window.__missingAssets) {
      this.missingAssetsText.setText('No missing assets tracked');
      return;
    }

    const sfxMissing = Array.from(window.__missingAssets.sfx || []);
    const vfxMissing = Array.from(window.__missingAssets.vfx || []);

    const lines = ['🔍 MISSING ASSETS (F6)'];
    lines.push('─────────────────────────');

    if (sfxMissing.length > 0) {
      lines.push(`🔊 SFX (${sfxMissing.length}):`);
      sfxMissing.slice(0, 10).forEach(id => lines.push(`  ${id}`));
      if (sfxMissing.length > 10) lines.push(`  ... +${sfxMissing.length - 10} more`);
    }

    if (vfxMissing.length > 0) {
      if (sfxMissing.length > 0) lines.push('');
      lines.push(`✨ VFX (${vfxMissing.length}):`);
      vfxMissing.slice(0, 10).forEach(id => lines.push(`  ${id}`));
      if (vfxMissing.length > 10) lines.push(`  ... +${vfxMissing.length - 10} more`);
    }

    if (sfxMissing.length === 0 && vfxMissing.length === 0) {
      lines.push('✅ All assets found!');
    }

    this.missingAssetsText.setText(lines.join('\n'));
  }

  _updateFlashMessages() {
    const now = Date.now();
    this._flashMessages = this._flashMessages.filter(msg => now < msg.endTime);

    if (this._flashMessages.length > 0) {
      this._flashMessages.forEach(msg => {
        const remaining = msg.endTime - now;
        msg.alpha = remaining < 1000 ? remaining / 1000 : 1;
      });
      this._flashText.setText(this._flashMessages.map(m => m.text).join('\n'));
      this._flashText.setAlpha(Math.min(...this._flashMessages.map(m => m.alpha)));
    } else {
      this._flashText.setText('');
    }
  }

  // ==================== Toggle ====================

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  show() {
    this.visible = true;
    this.text?.setVisible(true);
    this._flashText?.setVisible(true);
    try { localStorage.setItem('debugOverlay', 'true'); } catch (_) {}
  }

  hide() {
    this.visible = false;
    this.text?.setVisible(false);
    this._flashText?.setVisible(false);
    // Also hide missing assets panel when overlay is hidden
    this.showMissingAssets = false;
    this.missingAssetsText?.setVisible(false);
    try { localStorage.setItem('debugOverlay', 'false'); } catch (_) {}
  }

  toggleMissingAssets() {
    this.showMissingAssets = !this.showMissingAssets;
    this.missingAssetsText?.setVisible(this.showMissingAssets);
    if (this.showMissingAssets && !this.visible) this.show();
    if (this.showMissingAssets) {
      this._missingAssetsAcc = 1000; // Force immediate update
    }
  }

  flashMessage(message, duration = 3000) {
    this._flashMessages.push({ text: message, endTime: Date.now() + duration, alpha: 1 });
    if (this._flashMessages.length > 3) this._flashMessages.shift();
  }
}
