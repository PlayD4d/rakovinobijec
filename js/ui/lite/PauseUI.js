/**
 * PauseUI - Pause menu with Resume/Quit options
 * Simple and reliable, pure Phaser implementation
 */
import { SimpleModal } from './SimpleModal.js';
import { SimpleButton } from './SimpleButton.js';
import { UI_THEME } from '../UITheme.js';

export class PauseUI {
  constructor(scene, onResume, onQuit) {
    this.scene = scene;
    this.onResume = onResume;
    this.onQuit = onQuit;

    this.modal = new SimpleModal(scene, {
      width: 400,
      height: 300,
      depth: UI_THEME.depth.modal
    });

    const cx = scene.cameras.main.width / 2;
    const cy = scene.cameras.main.height / 2;

    // Title
    this.title = new Phaser.GameObjects.Text(scene, cx, cy - 100, 'PAUSED', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    this.modal.addChild(this.title);

    // Resume button
    this.resumeBtn = new SimpleButton(
      scene, cx, cy - 10,
      'Pokracovat',
      () => {
        this.hide();
        if (this.onResume) this.onResume();
      },
      220, 50
    );
    this.modal.addChild(this.resumeBtn);

    // Quit button — red tint for destructive action
    this.quitBtn = new SimpleButton(
      scene, cx, cy + 55,
      'Hlavni menu',
      () => {
        this.hide();
        if (this.onQuit) this.onQuit();
      },
      220, 50,
      { bgColor: 0x662222 }
    );
    this.modal.addChild(this.quitBtn);

    // Hint
    this.instructions = new Phaser.GameObjects.Text(scene, cx, cy + 120, 'ESC', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '12px',
      color: '#666666'
    }).setOrigin(0.5);
    this.modal.addChild(this.instructions);

    // modal starts hidden (SimpleModal constructor sets visible=false)
  }

  /**
   * Show pause menu
   */
  show() {
    this.modal.show(true, 200);
  }

  /**
   * Hide pause menu
   */
  hide() {
    if (this._hiding) return; // Prevent double-hide during fade animation
    this._hiding = true;
    this.modal.hide(true, 180, () => { this._hiding = false; });
  }

  /**
   * Check if pause menu is visible
   */
  isVisible() {
    // Delegate to modal's Phaser visible state — single source of truth
    return this.modal?.visible ?? false;
  }

  /**
   * Clean destroy
   */
  destroy() {
    this._hiding = false;
    this.modal?.destroy();
    this.modal = null;
    this.title = null;
    this.instructions = null;
    this.resumeBtn = null;
    this.quitBtn = null;
    this.onResume = null;
    this.onQuit = null;
  }
}