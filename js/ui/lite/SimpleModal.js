/**
 * SimpleModal - Minimalistický modal container pro LiteUI
 * Podporuje pause-safe animace (detekuje time.paused)
 * UITheme integrace pro konzistentní styling
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
    
    // Overlay - blocks clicks
    this.overlay = scene.add.rectangle(w/2, h/2, w, h, 
      this.config.overlayColor, this.config.overlayAlpha)
      .setInteractive() // Block clicks
      .on('pointerdown', () => {}); // Consume click events
    
    // Panel background
    const panelW = this.config.width;
    const panelH = this.config.height;
    this.panel = scene.add.rectangle(w/2, h/2, panelW, panelH, 
      this.config.panelColor, this.config.panelAlpha)
      .setStrokeStyle(2, this.config.strokeColor, this.config.strokeAlpha);
    
    // Add to container
    this.add([this.overlay, this.panel]);
    
    // List of added children for cleanup
    this.children = [];
    
    // Set depth and scroll factor
    this.setDepth(this.config.depth);
    this.setScrollFactor(0); // Pin to camera
    
    // Initially hidden
    this.visible = false;
  }
  
  /**
   * Add a child game object to the modal
   */
  addChild(gameObject) {
    this.add(gameObject);
    this.children.push(gameObject);
    return gameObject;
  }
  
  /**
   * Show modal with optional animation
   * Pause-safe: skips animation if time.paused
   */
  show(animated = true, duration = 250) {
    // Check if time is paused
    const paused = this.scene?.time?.paused === true;
    
    this.visible = true;
    
    // If paused or no animation requested, show immediately
    if (paused || !animated || !this.scene?.tweens) {
      this.alpha = 1;
      return Promise.resolve();
    }
    
    // Animate in
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
    // Check if time is paused
    const paused = this.scene?.time?.paused === true;
    
    // If paused or no animation requested, hide immediately
    if (paused || !animated || !this.scene?.tweens) {
      this.visible = false;
      this.alpha = 0;
      if (onComplete) onComplete();
      return Promise.resolve();
    }
    
    // Animate out
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: duration,
        ease: 'Power2',
        onComplete: () => {
          this.visible = false;
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
    // Destroy all children
    try {
      this.children.forEach(child => {
        if (child && typeof child.destroy === 'function') {
          child.destroy();
        }
      });
    } catch (e) {
      console.warn('[SimpleModal] Error destroying children:', e);
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