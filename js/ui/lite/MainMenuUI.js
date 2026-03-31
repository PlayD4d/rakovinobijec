/**
 * MainMenuUI - Main menu screen with thematic visuals
 * Cancer-fighting theme: ambient cell particles, clean layout
 */
import { SimpleButton } from './SimpleButton.js';
import { DebugLogger } from '../../core/debug/DebugLogger.js';
import { UI_THEME } from '../UITheme.js';

export class MainMenuUI {
  constructor(scene, gameVersion = 'unknown') {
    this.scene = scene;
    this.gameVersion = gameVersion;
    this.elements = [];

    const w = scene.cameras.main.width;
    const h = scene.cameras.main.height;
    const cx = w / 2;
    const cy = h / 2;

    // Ambient floating cells (background particle effect)
    this._createAmbientCells(scene, w, h);

    // Title
    this.title = scene.add.text(cx, cy - 140, 'RAKOVINOBIJEC', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '44px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(1);
    this.elements.push(this.title);

    // Title glow pulse
    scene.tweens.add({
      targets: this.title, alpha: { from: 0.85, to: 1 },
      duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // Subtitle — thematic
    this.subtitle = scene.add.text(cx, cy - 85, 'Fight cancer. Save lives.', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '14px',
      color: '#66aacc'
    }).setOrigin(0.5).setDepth(1);
    this.elements.push(this.subtitle);

    // Dedication
    this.dedication = scene.add.text(cx, cy - 60, 'Pro Mardu — bojovnika proti rakovine', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '11px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(1);
    this.elements.push(this.dedication);

    // Play button
    this.playBtn = new SimpleButton(
      scene, cx, cy + 10,
      'New Game',
      () => {
        DebugLogger.info('ui', '[MainMenuUI] Play button clicked');
        scene.startGame();
      },
      240, 56,
      { bgColor: 0x2a4a2a, fontSize: '22px' }
    );
    scene.add.existing(this.playBtn);
    this.playBtn.setDepth(1);
    this.elements.push(this.playBtn);

    // How to Play button
    this.tutorialBtn = new SimpleButton(
      scene, cx, cy + 80,
      'How to Play',
      () => this._showTutorial(),
      240, 50
    );
    scene.add.existing(this.tutorialBtn);
    this.tutorialBtn.setDepth(1);
    this.elements.push(this.tutorialBtn);

    // Version info
    this.version = scene.add.text(10, h - 20,
      `v${this.gameVersion} | PlayD4d 2025`, {
      fontFamily: UI_THEME.fonts.primary, fontSize: '11px', color: '#555555'
    }).setDepth(1);
    this.elements.push(this.version);

    // Controls hint
    this.controls = scene.add.text(w - 10, h - 20,
      'WASD = move | ESC = pause', {
      fontFamily: UI_THEME.fonts.primary, fontSize: '11px', color: '#555555'
    }).setOrigin(1, 0).setDepth(1);
    this.elements.push(this.controls);

    // Tutorial overlay (hidden by default)
    this._tutorialOverlay = null;
  }

  /**
   * Create ambient floating cells as background decoration
   */
  _createAmbientCells(scene, w, h) {
    this._cells = [];
    const cellCount = 15;
    const colors = [0xCC3366, 0x336644, 0x2244AA, 0x9966CC, 0x881122, 0xDD7700];

    for (let i = 0; i < cellCount; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = 4 + Math.random() * 8;
      const color = colors[Math.floor(Math.random() * colors.length)];

      const cell = scene.add.circle(x, y, size, color, 0.15);
      cell.setDepth(0);

      // Slow drift
      scene.tweens.add({
        targets: cell,
        x: x + (Math.random() - 0.5) * 200,
        y: y + (Math.random() - 0.5) * 150,
        alpha: { from: 0.08, to: 0.2 },
        duration: 4000 + Math.random() * 4000,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        delay: Math.random() * 2000
      });

      this._cells.push(cell);
      this.elements.push(cell);
    }
  }

  /**
   * Show tutorial overlay
   */
  _showTutorial() {
    if (this._tutorialOverlay) return;

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const cx = w / 2;
    const cy = h / 2;

    // Overlay background
    const bg = this.scene.add.rectangle(cx, cy, w, h, 0x000000, 0.85)
      .setDepth(10).setInteractive()
      .on('pointerdown', (p, lx, ly, e) => e.stopPropagation());

    // Tutorial content
    const lines = [
      'HOW TO PLAY',
      '',
      'WASD — Move your cell',
      'Auto-attack — Shoots nearest enemy',
      '',
      'Collect XP orbs from defeated enemies',
      'Level up to choose power-ups',
      'Defeat the boss to advance',
      '',
      '7 levels, each a stage of cancer',
      'Your goal: destroy the Tumor Core',
      '',
      'Click anywhere to close'
    ];

    const text = this.scene.add.text(cx, cy, lines.join('\n'), {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '14px',
      color: '#cccccc',
      align: 'center',
      lineSpacing: 6
    }).setOrigin(0.5).setDepth(11);

    // Title highlight
    const titleLine = this.scene.add.text(cx, cy - 120, 'HOW TO PLAY', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(11);

    this._tutorialOverlay = [bg, text, titleLine];
    this.elements.push(bg, text, titleLine);

    // Fade in
    [bg, text, titleLine].forEach(o => {
      o.setAlpha(0);
      this.scene.tweens.add({ targets: o, alpha: o === bg ? 0.85 : 1, duration: 200 });
    });

    // Close on click
    bg.once('pointerdown', () => this._closeTutorial());
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
    this.elements.forEach(el => {
      if (el && typeof el.destroy === 'function') el.destroy();
    });
    this.elements = [];
    this._cells = [];
  }
}
