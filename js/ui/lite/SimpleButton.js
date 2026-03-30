/**
 * SimpleButton - Minimalist interactive button for LiteUI
 * Pure Phaser, no external dependencies
 * UITheme integration for consistent styling
 *
 * NOTE: This constructor does NOT call scene.add.existing(this).
 * When used standalone (e.g. MainMenuUI), the caller must call
 * scene.add.existing(btn). When used inside a modal via
 * modal.addChild(btn), the Container owns rendering — no scene.add needed.
 */
import { UI_THEME } from '../UITheme.js';

export class SimpleButton extends Phaser.GameObjects.Container {
  constructor(scene, x, y, text, onClick, width = 220, height = 48, style = {}) {
    super(scene, x, y);

    // Merge default style with custom - use UI_THEME values
    const config = {
      bgColor: UI_THEME.colors.background.panel,
      bgAlpha: 0.95,
      hoverColor: UI_THEME.colors.borders.active,
      activeColor: UI_THEME.colors.primary,
      strokeColor: UI_THEME.colors.borders.default,
      strokeAlpha: 0.2,
      strokeWidth: UI_THEME.borderWidth.normal,
      fontSize: `${UI_THEME.fontSizes.normal.desktop}px`,
      fontColor: `#${UI_THEME.colors.text.primary.toString(16).padStart(6, '0')}`,
      fontFamily: UI_THEME.fonts.primary,
      ...style
    };

    // Background rectangle (constructor — no scene.add to avoid double display-list)
    this.bg = new Phaser.GameObjects.Rectangle(scene, 0, 0, width, height, config.bgColor, config.bgAlpha)
      .setStrokeStyle(config.strokeWidth, config.strokeColor, config.strokeAlpha);

    // Label text (constructor — Container owns rendering)
    this.label = new Phaser.GameObjects.Text(scene, 0, 0, text, {
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      color: config.fontColor,
      align: 'center',
      wordWrap: { width: width - 20 }
    }).setOrigin(0.5);

    // Add to container
    this.add([this.bg, this.label]);
    this.setSize(width, height);

    // Store config for later use
    this.config = config;
    this.onClick = onClick;

    // Interactivity - make sure it's always responsive
    // Use the default hit area which matches the container size
    this.setInteractive();

    // Ensure button is always active and responsive
    this.setActive(true);
    this.setVisible(true);

    // Hover effects
    this.on('pointerover', () => {
      this.bg.setFillStyle(config.hoverColor, 1);
      if (scene.input?.setDefaultCursor) {
        scene.input.setDefaultCursor('pointer');
      }
    });

    this.on('pointerout', () => {
      this.bg.setFillStyle(config.bgColor, config.bgAlpha);
      if (scene.input?.setDefaultCursor) {
        scene.input.setDefaultCursor('default');
      }
    });

    // Pointerdown handler - must be before pointerup
    this.on('pointerdown', () => {
      // Visual feedback on click
      this.bg.setFillStyle(config.activeColor, 1);
      this.bg.setScale(0.98);
    });

    // Pointerup handler - trigger onClick
    this.on('pointerup', () => {
      this.bg.setFillStyle(config.hoverColor, 1);
      this.bg.setScale(1);
      if (this.onClick) {
        // Add small delay to ensure visual feedback is seen — tracked for cleanup
        if (this._pendingClick) this._pendingClick.destroy();
        this._pendingClick = this.scene.time.delayedCall(50, () => {
          this._pendingClick = null;
          if (this.onClick) this.onClick();
        });
      }
    });

    // NOTE: scene.add.existing(this) removed — callers must add explicitly
    // when using standalone (not inside a modal).
  }

  setText(text) {
    this.label.setText(text);
  }

  setEnabled(enabled) {
    if (enabled) {
      this.setInteractive();
    } else {
      this.disableInteractive();
      this.bg.setFillStyle(this.config.bgColor, this.config.bgAlpha);
    }
    this.setAlpha(enabled ? 1 : 0.5);
  }

  destroy() {
    // Cancel pending click timer
    if (this._pendingClick) {
      this._pendingClick.destroy();
      this._pendingClick = null;
    }
    // Cleanup hover cursor
    if (this.scene?.input?.setDefaultCursor) {
      this.scene.input.setDefaultCursor('default');
    }
    super.destroy();
  }
}