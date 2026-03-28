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
      height: 380,
      depth: UI_THEME.depth.modal
    });
    
    const cx = scene.cameras.main.width / 2;
    const cy = scene.cameras.main.height / 2;
    
    // Title
    this.title = scene.add.text(cx, cy - 120, '⏸️ PAUSED', {
      fontFamily: 'Arial Black',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    this.modal.addChild(this.title);
    
    // Resume button
    this.resumeBtn = new SimpleButton(
      scene, cx, cy - 20, 
      '▶️ Pokračovat', 
      () => {
        this.hide();
        if (this.onResume) this.onResume();
      },
      200, 50
    );
    this.modal.addChild(this.resumeBtn);
    
    // Settings button (placeholder for now)
    this.settingsBtn = new SimpleButton(
      scene, cx, cy + 40, 
      '⚙️ Nastavení', 
      () => {
        // Settings not yet implemented
      },
      200, 50
    );
    this.modal.addChild(this.settingsBtn);
    
    // Quit button
    this.quitBtn = new SimpleButton(
      scene, cx, cy + 100, 
      '🏠 Hlavní menu', 
      () => {
        this.hide();
        if (this.onQuit) this.onQuit();
      },
      200, 50,
      { bgColor: 0x662222 } // Red tint for destructive action
    );
    this.modal.addChild(this.quitBtn);
    
    // Instructions
    this.instructions = scene.add.text(cx, cy + 160, 'ESC pro pokračování', {
      fontSize: '12px',
      color: '#666666'
    }).setOrigin(0.5);
    this.modal.addChild(this.instructions);
    
    this.visible = false;
  }
  
  /**
   * Show pause menu
   */
  show() {
    this.modal.show(true, 200);
    this.visible = true;
  }
  
  /**
   * Hide pause menu
   */
  hide() {
    this.visible = false; // Set immediately to prevent double-toggle during fade
    this.modal.hide(true, 180);
  }
  
  /**
   * Check if pause menu is visible
   */
  isVisible() {
    return this.visible;
  }
  
  /**
   * Clean destroy
   */
  destroy() {
    this.modal?.destroy();
    this.resumeBtn = null;
    this.settingsBtn = null;
    this.quitBtn = null;
    this.onResume = null;
    this.onQuit = null;
  }
}