/**
 * MainMenuUI - Main menu screen
 * Simple, clean, no dependencies
 */
import { SimpleButton } from './SimpleButton.js';

export class MainMenuUI {
  constructor(scene) {
    this.scene = scene;
    
    const cx = scene.cameras.main.width / 2;
    const cy = scene.cameras.main.height / 2;
    
    // Title
    this.title = scene.add.text(cx, cy - 150, 'RAKOVINOBIJEC', {
      fontFamily: 'Arial Black',
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    
    // Subtitle
    this.subtitle = scene.add.text(cx, cy - 90, 'Zachraň Marda před rakovinou!', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    
    // Play button
    this.playBtn = new SimpleButton(
      scene, cx, cy - 20, 
      '🎮 Nová hra', 
      () => {
        console.log('[MainMenuUI] Play button clicked - starting game');
        // Use the scene's startGame method which handles cleanup properly
        scene.startGame();
      },
      240, 56,
      { 
        bgColor: 0x2a4a2a,
        fontSize: '22px'
      }
    );
    
    // Settings button
    this.settingsBtn = new SimpleButton(
      scene, cx, cy + 50, 
      '⚙️ Nastavení', 
      () => {
        console.log('[MainMenuUI] Settings button clicked');
        // TODO: Implement settings modal
      },
      240, 56
    );
    
    // Credits button
    this.creditsBtn = new SimpleButton(
      scene, cx, cy + 120, 
      '📜 Credits', 
      () => {
        console.log('[MainMenuUI] Credits button clicked');
        // TODO: Show credits
      },
      240, 56
    );
    
    // Quit button (only works in desktop app)
    this.quitBtn = new SimpleButton(
      scene, cx, cy + 190, 
      '❌ Konec', 
      () => {
        console.log('[MainMenuUI] Quit button clicked');
        // Try to close window (works only in Electron/desktop)
        if (window.close) {
          window.close();
        } else {
          console.log('Cannot close browser window - showing alert');
          alert('Pro ukončení hry zavřete okno prohlížeče.');
        }
      },
      240, 56,
      { bgColor: 0x4a2a2a }
    );
    
    // Version info
    this.version = scene.add.text(10, scene.cameras.main.height - 20, 
      'v0.1.5 | LiteUI Edition', {
      fontSize: '12px',
      color: '#666666'
    });
    
    // Controls hint
    this.controls = scene.add.text(scene.cameras.main.width - 10, scene.cameras.main.height - 20,
      'WASD = pohyb | ESC = pauza', {
      fontSize: '12px',
      color: '#666666'
    }).setOrigin(1, 0);
    
    // All elements for cleanup
    this.elements = [
      this.title,
      this.subtitle,
      this.playBtn,
      this.settingsBtn,
      this.creditsBtn,
      this.quitBtn,
      this.version,
      this.controls
    ];
  }
  
  /**
   * Clean destroy
   */
  destroy() {
    this.elements.forEach(element => {
      if (element && typeof element.destroy === 'function') {
        element.destroy();
      }
    });
    this.elements = [];
  }
}