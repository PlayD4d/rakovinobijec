import { GameScene } from './scenes/GameScene.js';
import { GameUIScene } from './scenes/GameUIScene.js';
import { MainMenu } from './scenes/MainMenu.js';
import { GameConfig, calculateGameSize } from './config.js';
import { ConfigResolver } from './core/utils/ConfigResolver.js';

// ConfigResolver je statická třída - PR7 princip
// Nastavíme ji jako globální pro přístup ze všech scén
window.ConfigResolver = ConfigResolver;

// Funkce pro inicializaci hry
async function initializeGame() {
    // Nejprve inicializovat ConfigResolver s externími konfiguracemi
    try {
        await ConfigResolver.initialize();
    } catch (err) {
        console.warn('[Main] ConfigResolver init failed:', err);
    }

    const config = {
    type: Phaser.AUTO,
    width: GameConfig.width,
    height: GameConfig.height,
    backgroundColor: GameConfig.backgroundColor,
    parent: 'game',
    scale: {
        mode: Phaser.Scale.NONE,
        fullscreenTarget: 'game-container',
        snap: { width: 1, height: 1 }  // Phaser 3.80: pixel-perfect integer scaling
    },
    render: {
        pixelArt: true,      // Zapnout pro pixel font
        antialias: false,    // Vypnout pro sharp pixel text
        roundPixels: true    // Round pixels pro pixel perfect rendering
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false,
            fps: 60,              // Target physics FPS
            timeScale: 1,         // Physics time scaling
            useTree: true,        // Spatial partitioning for performance
            overlapBias: 8        // Anti-tunneling for fast bullets
        }
    },
    scene: [MainMenu, GameScene, GameUIScene]
    };

    const game = new Phaser.Game(config);
    window.game = game;
}

// Spustit inicializaci hry
initializeGame();
