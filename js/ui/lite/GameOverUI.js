/**
 * GameOverUI - Game over screen with stats
 * Shows survival stats and retry/menu options
 */
import { SimpleModal } from './SimpleModal.js';
import { SimpleButton } from './SimpleButton.js';
import { UI_THEME } from '../UITheme.js';
import { centralEventBus } from '../../core/events/CentralEventBus.js';

export class GameOverUI {
  constructor(scene) {
    this.scene = scene;
    this.modal = new SimpleModal(scene, {
      width: 600,
      height: 500,
      depth: UI_THEME.depth.modal
    });

    const cx = scene.cameras.main.width / 2;
    const cy = scene.cameras.main.height / 2;

    // Title (constructor — Container owns rendering, no scene.add)
    this.title = new Phaser.GameObjects.Text(scene, cx, cy - 180, '💀 GAME OVER', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '36px',
      color: `#${UI_THEME.colors.text.danger.toString(16).padStart(6, '0')}`,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    this.modal.addChild(this.title);

    // Subtitle (constructor — no scene.add)
    this.subtitle = new Phaser.GameObjects.Text(scene, cx, cy - 130, 'Nevzdavej to, zkus to znovu!', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '16px',
      color: `#${UI_THEME.colors.text.secondary.toString(16).padStart(6, '0')}`
    }).setOrigin(0.5);
    this.modal.addChild(this.subtitle);

    // Stats container (constructor — no scene.add)
    this.statsContainer = new Phaser.GameObjects.Container(scene, cx, cy - 40);

    // Stats background (constructor — no scene.add)
    this.statsBg = new Phaser.GameObjects.Rectangle(scene, 0, 0, 400, 120,
      UI_THEME.colors.background.modal, 0.8)
      .setStrokeStyle(1, UI_THEME.colors.borders.disabled, 0.5);
    this.statsContainer.add(this.statsBg);

    // Stats text (constructor — no scene.add)
    this.statsText = new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '16px',
      color: `#${UI_THEME.colors.text.primary.toString(16).padStart(6, '0')}`,
      align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5);
    this.statsContainer.add(this.statsText);

    this.modal.addChild(this.statsContainer);

    // Retry button (modal.addChild handles display-list — no scene.add needed)
    this.retryBtn = new SimpleButton(
      scene, cx, cy + 80,
      '🔄 Zkusit znovu',
      () => {
        if (this._actionTaken) return;
        this._actionTaken = true;
        this.hide(() => {
          centralEventBus.emit('game:retry');
        });
      },
      220, 56,
      {
        bgColor: 0x2a4a2a,
        fontSize: '20px'
      }
    );
    this.modal.addChild(this.retryBtn);

    // Menu button
    this.menuBtn = new SimpleButton(
      scene, cx, cy + 150,
      '🏠 Hlavní menu',
      () => {
        if (this._actionTaken) return;
        this._actionTaken = true;
        this.hide(() => {
          centralEventBus.emit('game:main-menu');
        });
      },
      220, 56,
      { fontSize: '20px' }
    );
    this.modal.addChild(this.menuBtn);
  }

  /**
   * Show game over screen with stats
   */
  show(stats = {}) {
    this._actionTaken = false;
    const isVictory = stats.isVictory;

    // Victory vs defeat — different title, color, subtitle, and modal border
    if (isVictory) {
      this.title.setText('VICTORY!');
      this.title.setColor('#00ff88');
      this.subtitle.setText('Rakovina byla porazena!');
      this.modal.panel?.setStrokeStyle(3, 0x00ff88, 0.8);
      this.retryBtn.setText('Pokracovat');
    } else {
      this.title.setText('GAME OVER');
      this.title.setColor(`#${UI_THEME.colors.text.danger.toString(16).padStart(6, '0')}`);
      this.subtitle.setText('Nevzdavej to, zkus to znovu!');
      this.modal.panel?.setStrokeStyle(2, UI_THEME.colors.borders.default, 0.5);
      this.retryBtn.setText('Zkusit znovu');
    }

    // Format stats
    const survivalTime = stats.survivalTime || stats.time || 0;
    const minutes = Math.floor(survivalTime / 60);
    const seconds = survivalTime % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const playerLevel = stats.playerLevel || stats.level || 1;
    const stage = stats.level || 1;
    const text = [
      `Čas přežití: ${timeStr}`,
      `Level: ${playerLevel} | Stage: ${stage}`,
      `Zabito nepřátel: ${stats.kills ?? stats.enemiesKilled ?? 0}`,
      `Skóre: ${stats.score || 0}`
    ].join('\n');

    this.statsText.setText(text);

    // Camera effect for emotional impact
    const cam = this.scene.scene.get('GameScene')?.cameras?.main;
    if (cam) {
      if (isVictory) {
        cam.flash(600, 255, 255, 255);
      } else {
        cam.shake(300, 0.015);
        cam.flash(200, 80, 0, 0);
      }
    }

    // Show modal with fade-in animation
    this.modal.show(true, 400);
  }

  /**
   * Hide modal
   */
  hide(onComplete) {
    this.modal.hide(true, 200, onComplete);
  }

  /**
   * Clean destroy
   */
  destroy() {
    this.modal?.destroy();
    this.modal = null; // Prevent double-destroy
    this.title = null;
    this.subtitle = null;
    this.statsContainer = null;
    this.statsBg = null;
    this.statsText = null;
    this.retryBtn = null;
    this.menuBtn = null;
  }
}