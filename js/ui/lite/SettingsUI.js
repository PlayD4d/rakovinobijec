/**
 * SettingsUI - Volume and controls settings modal
 * Opens from PauseUI. Uses SimpleModal + SimpleButton.
 */
import { SimpleModal } from './SimpleModal.js';
import { SimpleButton } from './SimpleButton.js';
import { UI_THEME } from '../UITheme.js';

export class SettingsUI {
  constructor(scene, onBack) {
    this.scene = scene;
    this.onBack = onBack;

    this.modal = new SimpleModal(scene, {
      width: 440,
      height: 480,
      depth: UI_THEME.depth.modal
    });

    const cx = scene.cameras.main.width / 2;
    const cy = scene.cameras.main.height / 2;

    // Title
    const title = new Phaser.GameObjects.Text(scene, cx, cy - 140, 'SETTINGS', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    this.modal.addChild(title);

    // --- Master Volume ---
    this._masterVol = 1.0;
    const volLabel = new Phaser.GameObjects.Text(scene, cx - 160, cy - 70, 'Volume', {
      fontFamily: UI_THEME.fonts.primary, fontSize: '16px', color: '#cccccc'
    }).setOrigin(0, 0.5);
    this.modal.addChild(volLabel);

    // Volume bar background
    this._volBarBg = new Phaser.GameObjects.Rectangle(scene, cx - 20, cy - 70, 200, 20, 0x333333);
    this._volBarBg.setOrigin(0, 0.5).setStrokeStyle(1, 0x666666);
    this.modal.addChild(this._volBarBg);

    // Volume bar fill
    this._volBarFill = new Phaser.GameObjects.Rectangle(scene, cx - 18, cy - 70, 196, 16, UI_THEME.colors.info);
    this._volBarFill.setOrigin(0, 0.5);
    this.modal.addChild(this._volBarFill);

    // Volume percentage text
    this._volText = new Phaser.GameObjects.Text(scene, cx + 190, cy - 70, '100%', {
      fontFamily: UI_THEME.fonts.primary, fontSize: '14px', color: '#ffffff'
    }).setOrigin(0, 0.5);
    this.modal.addChild(this._volText);

    // Volume buttons (- / +)
    this._volDown = new SimpleButton(scene, cx - 60, cy - 25, '-', () => this._adjustVolume(-0.1), 50, 36, { fontSize: '18px' });
    this._volUp = new SimpleButton(scene, cx + 60, cy - 25, '+', () => this._adjustVolume(0.1), 50, 36, { fontSize: '18px' });
    this.modal.addChild(this._volDown);
    this.modal.addChild(this._volUp);

    // --- Joystick Toggle (mobile only) ---
    this._joystickEnabled = false;
    const joyLabel = new Phaser.GameObjects.Text(scene, cx - 160, cy + 40, 'Joystick', {
      fontFamily: UI_THEME.fonts.primary, fontSize: '16px', color: '#cccccc'
    }).setOrigin(0, 0.5);
    this.modal.addChild(joyLabel);

    this._joyStatus = new Phaser.GameObjects.Text(scene, cx + 60, cy + 40, 'OFF', {
      fontFamily: UI_THEME.fonts.primary, fontSize: '16px', color: '#ff4444'
    }).setOrigin(0.5);
    this.modal.addChild(this._joyStatus);

    this._joyToggle = new SimpleButton(scene, cx + 60, cy + 80, 'Toggle', () => this._toggleJoystick(), 120, 36, { fontSize: '14px' });
    this.modal.addChild(this._joyToggle);

    // --- Damage Numbers Toggle ---
    this._dmgNumEnabled = true;
    const dmgLabel = new Phaser.GameObjects.Text(scene, cx - 160, cy + 120, 'Dmg Numbers', {
      fontFamily: UI_THEME.fonts.primary, fontSize: '16px', color: '#cccccc'
    }).setOrigin(0, 0.5);
    this.modal.addChild(dmgLabel);

    this._dmgStatus = new Phaser.GameObjects.Text(scene, cx + 60, cy + 120, 'ON', {
      fontFamily: UI_THEME.fonts.primary, fontSize: '16px', color: '#44ff44'
    }).setOrigin(0.5);
    this.modal.addChild(this._dmgStatus);

    this._dmgToggle = new SimpleButton(scene, cx + 60, cy + 155, 'Toggle', () => this._toggleDamageNumbers(), 120, 36, { fontSize: '14px' });
    this.modal.addChild(this._dmgToggle);

    // --- Back button ---
    this._backBtn = new SimpleButton(scene, cx, cy + 210, 'Back', () => {
      this.hide();
      if (this.onBack) this.onBack();
    }, 160, 44);
    this.modal.addChild(this._backBtn);

    // Load current settings
    this._loadSettings();
  }

  _loadSettings() {
    // Read audio volume from game scene's audio system
    const gameScene = this.scene.scene.get('GameScene');
    if (gameScene?.audioSystem) {
      this._masterVol = gameScene.audioSystem.masterVolume ?? 1.0;
    }
    // Read joystick setting
    const sm = window.settingsManager;
    if (sm?.get) {
      this._joystickEnabled = sm.get('controls.joystickEnabled') || false;
      this._dmgNumEnabled = sm.get('ui.damageNumbers') !== false; // default ON
    }
    this._updateVolumeDisplay();
    this._updateJoystickDisplay();
    this._updateDamageNumbersDisplay();
  }

  _adjustVolume(delta) {
    this._masterVol = Math.max(0, Math.min(1, this._masterVol + delta));
    this._updateVolumeDisplay();

    // Apply to audio system
    const gameScene = this.scene.scene.get('GameScene');
    if (gameScene?.audioSystem?.setVolume) {
      gameScene.audioSystem.setVolume('master', this._masterVol);
    }
    // Also apply to scene sound manager directly
    if (this.scene.sound) {
      this.scene.sound.volume = this._masterVol;
    }

    // Click feedback
    try { this.scene.sound?.play('sound/bleep.mp3', { volume: 0.3 * this._masterVol }); } catch (_) {}
  }

  _updateVolumeDisplay() {
    const pct = Math.round(this._masterVol * 100);
    this._volText.setText(`${pct}%`);
    this._volBarFill.width = 196 * this._masterVol;
  }

  _toggleJoystick() {
    this._joystickEnabled = !this._joystickEnabled;
    this._updateJoystickDisplay();

    // Persist setting
    const sm = window.settingsManager;
    if (sm?.set) {
      sm.set('controls.joystickEnabled', this._joystickEnabled);
    }

    try { this.scene.sound?.play('sound/bleep.mp3', { volume: 0.3 }); } catch (_) {}
  }

  _updateJoystickDisplay() {
    if (this._joystickEnabled) {
      this._joyStatus.setText('ON').setColor('#44ff44');
    } else {
      this._joyStatus.setText('OFF').setColor('#ff4444');
    }
  }

  _toggleDamageNumbers() {
    this._dmgNumEnabled = !this._dmgNumEnabled;
    this._updateDamageNumbersDisplay();

    const sm = window.settingsManager;
    if (sm?.set) {
      sm.set('ui.damageNumbers', this._dmgNumEnabled);
    }

    try { this.scene.sound?.play('sound/bleep.mp3', { volume: 0.3 }); } catch (_) {}
  }

  _updateDamageNumbersDisplay() {
    if (this._dmgNumEnabled) {
      this._dmgStatus?.setText('ON').setColor('#44ff44');
    } else {
      this._dmgStatus?.setText('OFF').setColor('#ff4444');
    }
  }

  show() {
    this._loadSettings();
    this.modal.show(true, 200);
  }

  hide() {
    this.modal.hide(true, 180);
  }

  isVisible() {
    return this.modal?.visible ?? false;
  }

  destroy() {
    this.modal?.destroy();
    this.modal = null;
    this.onBack = null;
  }
}
