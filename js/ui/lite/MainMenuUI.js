/**
 * MainMenuUI - Main menu with ambient cell particles
 * Clean layout, thematic visuals, no emoji
 */
import { SimpleButton } from './SimpleButton.js';
import { DebugLogger } from '../../core/debug/DebugLogger.js';
import { UI_THEME } from '../UITheme.js';

export class MainMenuUI {
  constructor(scene, gameVersion = 'unknown') {
    this.scene = scene;
    this.elements = [];

    const w = scene.cameras.main.width;
    const h = scene.cameras.main.height;
    const cx = w / 2;
    const cy = h / 2;

    // Title
    this.title = scene.add.text(cx, cy - 140, 'RAKOVINOBIJEC', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '44px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(1);
    this.elements.push(this.title);

    // Title pulse
    scene.tweens.add({
      targets: this.title, alpha: { from: 0.85, to: 1 },
      duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // Subtitle
    this.elements.push(scene.add.text(cx, cy - 85, 'Fight cancer. Save lives.', {
      fontFamily: UI_THEME.fonts.primary, fontSize: '14px', color: '#66aacc'
    }).setOrigin(0.5).setDepth(1));

    // Dedication
    this.elements.push(scene.add.text(cx, cy - 60, 'Pro Mardu — bojovnika proti rakovine', {
      fontFamily: UI_THEME.fonts.primary, fontSize: '11px', color: '#888888'
    }).setOrigin(0.5).setDepth(1));

    // Buttons
    this.playBtn = new SimpleButton(scene, cx, cy + 10, 'New Game', () => {
      DebugLogger.info('ui', '[MainMenuUI] Play clicked');
      scene.startGame();
    }, 240, 56, { bgColor: 0x2a4a2a, fontSize: '22px' });
    scene.add.existing(this.playBtn);
    this.playBtn.setDepth(1);
    this.elements.push(this.playBtn);

    this.tutorialBtn = new SimpleButton(scene, cx, cy + 80, 'How to Play', () => this._showTutorial(), 240, 50);
    scene.add.existing(this.tutorialBtn);
    this.tutorialBtn.setDepth(1);
    this.elements.push(this.tutorialBtn);

    // Footer
    this.elements.push(scene.add.text(10, h - 20,
      `v${gameVersion} | PlayD4d 2025`, {
      fontFamily: UI_THEME.fonts.primary, fontSize: '11px', color: '#555555'
    }).setDepth(1));

    this.elements.push(scene.add.text(w - 10, h - 20,
      'WASD = move | ESC = pause', {
      fontFamily: UI_THEME.fonts.primary, fontSize: '11px', color: '#555555'
    }).setOrigin(1, 0).setDepth(1));

    // Ambient cells — spawn continuously via timer
    this._cellColors = [0xCC3366, 0x336644, 0x2244AA, 0x9966CC, 0x881122, 0xDD7700];
    this._cellTimer = scene.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => this._spawnCell(scene, w, h)
    });
    // Spawn a few immediately
    for (let i = 0; i < 8; i++) this._spawnCell(scene, w, h);

    this._tutorialOverlay = null;
  }

  _spawnCell(scene, w, h) {
    if (!scene?.add) return;
    const x = Math.random() * w;
    const y = Math.random() * h;
    const size = 3 + Math.random() * 6;
    const color = this._cellColors[Math.floor(Math.random() * this._cellColors.length)];

    const cell = scene.add.circle(x, y, size, color, 0).setDepth(0);

    // Fade in, pulse, drift, fade out, destroy
    scene.tweens.add({
      targets: cell,
      alpha: { from: 0, to: 0.12 + Math.random() * 0.08 },
      x: x + (Math.random() - 0.5) * 80,
      y: y + (Math.random() - 0.5) * 60,
      scale: { from: 0.8, to: 1.2 },
      duration: 3000 + Math.random() * 3000,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => cell.destroy()
    });
  }

  _showTutorial() {
    if (this._tutorialOverlay) return;
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const cx = w / 2;
    const cy = h / 2;

    const overlay = this.scene.add.rectangle(cx, cy, w, h, 0x000000, 0.7)
      .setDepth(10).setInteractive()
      .on('pointerdown', (p, lx, ly, e) => e.stopPropagation());

    const panel = this.scene.add.rectangle(cx, cy, 420, 340, 0x0a0a1e, 0.95)
      .setStrokeStyle(2, 0x334466, 0.8).setDepth(11);

    const title = this.scene.add.text(cx, cy - 140, 'HOW TO PLAY', {
      fontFamily: UI_THEME.fonts.primary, fontSize: '22px',
      color: '#ffffff', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(12);

    const lines = [
      'WASD — Move your cell',
      'Auto-attack — Shoots nearest enemy',
      '',
      'Collect XP orbs from defeated enemies',
      'Level up to choose power-ups',
      'Defeat the boss to advance',
      '',
      '7 levels, each a stage of cancer',
      'Your goal: destroy the Tumor Core',
    ];
    const text = this.scene.add.text(cx, cy + 10, lines.join('\n'), {
      fontFamily: UI_THEME.fonts.primary, fontSize: '13px',
      color: '#cccccc', align: 'center', lineSpacing: 8
    }).setOrigin(0.5).setDepth(12);

    const hint = this.scene.add.text(cx, cy + 150, 'Click anywhere to close', {
      fontFamily: UI_THEME.fonts.primary, fontSize: '11px', color: '#666666'
    }).setOrigin(0.5).setDepth(12);

    this._tutorialOverlay = [overlay, panel, title, text, hint];

    [overlay, panel, title, text, hint].forEach(o => {
      const a = o === overlay ? 0.7 : (o === panel ? 0.95 : 1);
      o.setAlpha(0);
      this.scene.tweens.add({ targets: o, alpha: a, duration: 200 });
    });

    overlay.once('pointerdown', () => this._closeTutorial());
  }

  _closeTutorial() {
    if (!this._tutorialOverlay) return;
    this._tutorialOverlay.forEach(o => {
      this.scene.tweens.add({
        targets: o, alpha: 0, duration: 150,
        onComplete: () => o.destroy()
      });
    });
    this._tutorialOverlay = null;
  }

  destroy() {
    if (this._tutorialOverlay) {
      this._tutorialOverlay.forEach(o => o?.destroy());
      this._tutorialOverlay = null;
    }
    if (this._cellTimer) {
      this._cellTimer.remove();
      this._cellTimer = null;
    }
    this.elements.forEach(el => el?.destroy?.());
    this.elements = [];
  }
}
