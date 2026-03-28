/**
 * GameOverUI - Game over screen with stats
 * Shows survival stats and retry/menu options
 */
import { SimpleModal } from './SimpleModal.js';
import { SimpleButton } from './SimpleButton.js';
import { UI_THEME } from '../UITheme.js';

export class GameOverUI {
  constructor(scene) {
    this.scene = scene;
    this.modal = new SimpleModal(scene, {
      width: 600,
      height: 500,
      depth: UI_THEME.depth.modal
    });
    
    const cx = scene.cameras.main.width / 2;
    const cy = scene.cameras.main.height / 2;
    
    // Title
    this.title = scene.add.text(cx, cy - 180, '💀 GAME OVER', {
      fontFamily: 'Arial Black',
      fontSize: '36px',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    this.modal.addChild(this.title);
    
    // Subtitle
    this.subtitle = scene.add.text(cx, cy - 130, 'Mard podlehl rakovině...', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    this.modal.addChild(this.subtitle);
    
    // Stats container
    this.statsContainer = scene.add.container(cx, cy - 40);
    
    // Stats background
    this.statsBg = scene.add.rectangle(0, 0, 400, 120, 0x1a1a1a, 0.8)
      .setStrokeStyle(1, 0x666666, 0.5);
    this.statsContainer.add(this.statsBg);
    
    // Stats text
    this.statsText = scene.add.text(0, 0, '', {
      fontFamily: 'Courier',
      fontSize: '16px',
      color: '#ffffff',
      align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5);
    this.statsContainer.add(this.statsText);
    
    this.modal.addChild(this.statsContainer);
    
    // Retry button
    this.retryBtn = new SimpleButton(
      scene, cx, cy + 80, 
      '🔄 Zkusit znovu', 
      () => {
        this.hide(() => {
          // Clean up GameScene before restarting
          const gameScene = scene.scene.get('GameScene');
          if (gameScene && gameScene.shutdown) {
            gameScene.shutdown();
          }
          
          scene.scene.stop('GameUIScene');
          scene.scene.stop('GameScene');
          scene.scene.start('GameScene');
        });
      },
      220, 56,
      { 
        bgColor: 0x2a4a2a,
        fontSize: '20px'
      }
    );
    this.modal.addChild(this.retryBtn);
    
    // Menu button
    this.menuBtn = new SimpleButton(
      scene, cx, cy + 150, 
      '🏠 Hlavní menu', 
      () => {
        this.hide(() => {
          // Clean up GameScene before stopping
          const gameScene = scene.scene.get('GameScene');
          if (gameScene && gameScene.shutdown) {
            gameScene.shutdown();
          }
          
          // Stop both scenes and return to menu
          scene.scene.stop('GameUIScene');
          scene.scene.stop('GameScene');
          scene.scene.start('MainMenu');
        });
      },
      220, 56,
      { fontSize: '20px' }
    );
    this.modal.addChild(this.menuBtn);
  }
  
  /**
   * Show game over screen with stats
   */
  show(stats = {}) {
    // Victory vs defeat — update title and subtitle accordingly
    if (stats.isVictory) {
      this.title.setText('🎉 VICTORY!');
      this.title.setColor('#00ff00');
      this.subtitle.setText('Rakovina byla poražena!');
    } else {
      this.title.setText('💀 GAME OVER');
      this.title.setColor('#ff0000');
      this.subtitle.setText('Mard podlehl rakovině...');
    }

    // Format stats
    const survivalTime = stats.survivalTime || stats.time || 0;
    const minutes = Math.floor(survivalTime / 60);
    const seconds = survivalTime % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const text = [
      `⏱️ Čas přežití: ${timeStr}`,
      `📊 Level: ${stats.level || 1}`,
      `💀 Zabito nepřátel: ${stats.kills || 0}`,
      `⭐ Skóre: ${stats.score || 0}`
    ].join('\n');

    this.statsText.setText(text);

    // Show modal
    this.modal.show(false);
  }
  
  /**
   * Hide modal
   */
  hide(onComplete) {
    this.modal.hide(true, 200, onComplete);
  }
  
  /**
   * Clean destroy
   */
  destroy() {
    this.modal?.destroy();
  }
}