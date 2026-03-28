/**
 * MainMenuUI - Main menu screen
 * Simple, clean, no dependencies
 */
import { SimpleButton } from './SimpleButton.js';
import { DebugLogger } from '../../core/debug/DebugLogger.js';

export class MainMenuUI {
  constructor(scene, gameVersion = 'unknown') {
    this.scene = scene;
    this.gameVersion = gameVersion;

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
    this.subtitle = scene.add.text(cx, cy - 90, 'Poraz všechny škodlivé buňky!', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // Play button
    this.playBtn = new SimpleButton(
      scene, cx, cy - 20,
      '🎮 Nová hra',
      () => {
        DebugLogger.info('ui', '[MainMenuUI] Play button clicked - starting game');
        // Use the scene's startGame method which handles cleanup properly
        scene.startGame();
      },
      240, 56,
      {
        bgColor: 0x2a4a2a,
        fontSize: '22px'
      }
    );

    // Settings button — not yet implemented
    this.settingsBtn = new SimpleButton(
      scene, cx, cy + 50,
      '⚙️ Nastavení (brzy)',
      () => {},
      240, 56
    );
    this.settingsBtn.setEnabled(false);

    // Credits button — not yet implemented
    this.creditsBtn = new SimpleButton(
      scene, cx, cy + 120,
      '📜 Credits (brzy)',
      () => {},
      240, 56
    );
    this.creditsBtn.setEnabled(false);

    // Quit button (only works in desktop app)
    this.quitBtn = new SimpleButton(
      scene, cx, cy + 190,
      '❌ Konec',
      () => {
        DebugLogger.info('ui', '[MainMenuUI] Quit button clicked');
        // Try to close window (works only in Electron/desktop)
        if (window.close) {
          window.close();
        }
        // Show in-game toast instead of alert() (prohibited by project guidelines)
        const toast = scene.add.text(scene.cameras.main.width / 2, scene.cameras.main.height - 60,
          'Pro ukončení hry zavřete okno prohlížeče.', {
            fontFamily: 'Arial', fontSize: '14px', color: '#aaaaaa'
          }).setOrigin(0.5).setDepth(999999);
        scene.tweens.add({ targets: toast, alpha: 0, delay: 3000, duration: 1000, onComplete: () => toast.destroy() });
      },
      240, 56,
      { bgColor: 0x4a2a2a }
    );

    // Version info
    this.version = scene.add.text(10, scene.cameras.main.height - 20,
      `v${this.gameVersion} | (c) PlayD4d 2025 | playd4d.me@gmail.com`, {
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