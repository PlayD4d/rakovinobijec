/**
 * PauseUI - Pause menu with Resume/Settings/Quit options
 * Simple and reliable, pure Phaser implementation
 */
import { SimpleModal } from './SimpleModal.js';
import { SimpleButton } from './SimpleButton.js';
import { SettingsUI } from './SettingsUI.js';
import { UI_THEME } from '../UITheme.js';

export class PauseUI {
  constructor(scene, onResume, onQuit) {
    this.scene = scene;
    this.onResume = onResume;
    this.onQuit = onQuit;

    this.modal = new SimpleModal(scene, {
      width: 400,
      height: 340,
      depth: UI_THEME.depth.modal
    });

    const cx = scene.cameras.main.width / 2;
    const cy = scene.cameras.main.height / 2;

    // Title
    this.title = new Phaser.GameObjects.Text(scene, cx, cy - 120, 'PAUSED', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    this.modal.addChild(this.title);

    // Resume button
    this.resumeBtn = new SimpleButton(
      scene, cx, cy - 30,
      'Resume',
      () => {
        this.hide();
        if (this.onResume) this.onResume();
      },
      220, 50
    );
    this.modal.addChild(this.resumeBtn);

    // Settings button
    this.settingsBtn = new SimpleButton(
      scene, cx, cy + 30,
      'Settings',
      () => this._openSettings(),
      220, 50
    );
    this.modal.addChild(this.settingsBtn);

    // Quit button — red tint for destructive action
    this.quitBtn = new SimpleButton(
      scene, cx, cy + 90,
      'Main Menu',
      () => {
        this.hide();
        if (this.onQuit) this.onQuit();
      },
      220, 50,
      { bgColor: 0x662222 }
    );
    this.modal.addChild(this.quitBtn);

    // Hint
    this.instructions = new Phaser.GameObjects.Text(scene, cx, cy + 145, 'ESC', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '12px',
      color: '#666666'
    }).setOrigin(0.5);
    this.modal.addChild(this.instructions);

    // Settings sub-modal (created lazily)
    this.settingsUI = null;
  }

  _openSettings() {
    this.modal.hide(true, 150);
    if (!this.settingsUI) {
      this.settingsUI = new SettingsUI(this.scene, () => {
        // On back — show pause menu again
        this.modal.show(true, 150);
      });
    }
    this.settingsUI.show();
  }

  show() {
    // If settings is open, close it first
    if (this.settingsUI?.isVisible()) {
      this.settingsUI.hide();
    }
    this.modal.show(true, 200);
  }

  hide() {
    if (this._hiding) return;
    this._hiding = true;
    if (this.settingsUI?.isVisible()) {
      this.settingsUI.hide();
    }
    this.modal.hide(true, 180, () => { this._hiding = false; });
  }

  isVisible() {
    return (this.modal?.visible ?? false) || (this.settingsUI?.isVisible() ?? false);
  }

  destroy() {
    this._hiding = false;
    this.settingsUI?.destroy();
    this.settingsUI = null;
    this.modal?.destroy();
    this.modal = null;
    this.title = null;
    this.instructions = null;
    this.resumeBtn = null;
    this.settingsBtn = null;
    this.quitBtn = null;
    this.onResume = null;
    this.onQuit = null;
  }
}
