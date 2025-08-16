/**
 * SimpleButton - Minimalistické interaktivní tlačítko pro LiteUI
 * Žádné závislosti na RexUI, jen čistý Phaser
 * UITheme integrace pro konzistentní styling
 */
import { UI_THEME } from '../UITheme.js';

export class SimpleButton extends Phaser.GameObjects.Container {
  constructor(scene, x, y, text, onClick, width = 220, height = 48, style = {}) {
    super(scene, x, y);
    
    // Merge default style s custom - use UI_THEME values
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
    
    // Background rectangle
    this.bg = scene.add.rectangle(0, 0, width, height, config.bgColor, config.bgAlpha)
      .setStrokeStyle(config.strokeWidth, config.strokeColor, config.strokeAlpha);
    
    // Label text
    this.label = scene.add.text(0, 0, text, { 
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
    
    // Interaktivita - make sure it's always responsive
    this.setInteractive(
      new Phaser.Geom.Rectangle(-width/2, -height/2, width, height),
      Phaser.Geom.Rectangle.Contains
    );
    
    // Ensure button is always active and responsive
    this.setActive(true);
    this.setVisible(true);
    
    // Hover efekty
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
    
    // Moved pointerdown handler above
    
    this.on('pointerup', () => {
      this.bg.setFillStyle(config.hoverColor, 1);
      this.bg.setScale(1);
      if (this.onClick) {
        // Add small delay to ensure visual feedback is seen
        this.scene.time.delayedCall(50, () => {
          this.onClick();
        });
      }
    });
    
    // Also handle click event as backup
    this.on('pointerdown', () => {
      // Visual feedback on click
      this.bg.setFillStyle(config.activeColor, 1);
      this.bg.setScale(0.98);
    });
    
    // Přidat do scény
    scene.add.existing(this);
  }
  
  setText(text) {
    this.label.setText(text);
  }
  
  setEnabled(enabled) {
    this.setInteractive(enabled);
    this.setAlpha(enabled ? 1 : 0.5);
    if (!enabled) {
      this.bg.setFillStyle(this.config.bgColor, this.config.bgAlpha);
    }
  }
  
  destroy() {
    // Cleanup hover cursor
    if (this.scene?.input?.setDefaultCursor) {
      this.scene.input.setDefaultCursor('default');
    }
    super.destroy();
  }
}