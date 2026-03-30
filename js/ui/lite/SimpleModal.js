/**
 * SimpleModal - Minimalist modal container for LiteUI
 * Supports pause-safe animations (detects time.paused)
 * UITheme integration for consistent styling
 */
import { UI_THEME } from '../UITheme.js';

export class SimpleModal extends Phaser.GameObjects.Container {
  constructor(scene, config = {}) {
    super(scene, 0, 0);
    scene.add.existing(this);
    
    // Get camera dimensions
    const cam = scene.cameras.main;
    const w = cam.width;
    const h = cam.height;
    
    // Config with defaults - use UI_THEME values
    this.config = {
      width: 900,
      height: 600,
      depth: UI_THEME.depth.modal,
      overlayColor: UI_THEME.colors.background.overlay,
      overlayAlpha: 0.6,
      panelColor: UI_THEME.colors.background.modal,
      panelAlpha: 0.98,
      strokeColor: UI_THEME.colors.borders.default,
      strokeAlpha: 0.15,
      ...config
    };
    
    // Overlay — blocks clicks. Created without scene.add to avoid double display-list entry.
    this.overlay = new Phaser.GameObjects.Rectangle(
      scene, w/2, h/2, w, h, this.config.overlayColor, this.config.overlayAlpha
    ).setInteractive().on('pointerdown', () => {});

    // Panel background
    const panelW = this.config.width;
    const panelH = this.config.height;
    this.panel = new Phaser.GameObjects.Rectangle(
      scene, w/2, h/2, panelW, panelH, this.config.panelColor, this.config.panelAlpha
    ).setStrokeStyle(2, this.config.strokeColor, this.config.strokeAlpha);

    // Add to container only (not to scene display list — Container owns rendering)
    this.add([this.overlay, this.panel]);

    // List of added children for cleanup
    this._childObjects = [];

    // Set depth and scroll factor on container
    this.setDepth(this.config.depth);
    this.setScrollFactor(0);
    
    // Initially hidden — use setVisible for proper Phaser visibility
    this.setVisible(false);
  }
  
  /**
   * Add a child game object to the modal
   */
  addChild(gameObject) {
    this.add(gameObject);
    if (gameObject.setScrollFactor) gameObject.setScrollFactor(0);
    this._childObjects.push(gameObject);
    return gameObject;
  }
  
  /**
   * Show modal with optional animation
   * Pause-safe: skips animation if time.paused
   */
  show(animated = true, duration = 250) {
    const paused = this.scene?.time?.paused === true;

    this._hiding = false;
    this.setVisible(true);

    if (paused || !animated || !this.scene?.tweens) {
      this.alpha = 1;
      return Promise.resolve();
    }

    this.alpha = 0;
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        alpha: 1,
        duration: duration,
        ease: 'Power2',
        onComplete: () => resolve()
      });
    });
  }
  
  /**
   * Hide modal with optional animation
   * Pause-safe: skips animation if time.paused
   */
  hide(animated = true, duration = 200, onComplete) {
    // Guard against double-hide and concurrent hide animations
    if (this._hiding) return Promise.resolve();
    if (!this.visible) {
      if (onComplete) onComplete();
      return Promise.resolve();
    }
    this._hiding = true;

    const paused = this.scene?.time?.paused === true;

    if (paused || !animated || !this.scene?.tweens) {
      this.setVisible(false);
      this.alpha = 0;
      this._hiding = false;
      if (onComplete) onComplete();
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: duration,
        ease: 'Power2',
        onComplete: () => {
          this.setVisible(false);
          this._hiding = false;
          if (onComplete) onComplete();
          resolve();
        }
      });
    });
  }
  
  /**
   * Clean destroy
   */
  destroy(fromScene) {
    // Destroy tracked child objects
    try {
      this._childObjects.forEach(child => {
        if (child && typeof child.destroy === 'function') {
          child.destroy();
        }
      });
      this._childObjects = [];
    } catch (e) {
      // Silently continue cleanup
    }
    
    // Destroy overlay and panel
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
    
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
    }
    
    // Call parent destroy
    super.destroy(fromScene);
  }
}