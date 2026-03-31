import { GameScene } from './scenes/GameScene.js';
import { GameUIScene } from './scenes/GameUIScene.js';
import { MainMenu } from './scenes/MainMenu.js';
import { GameConfig, calculateGameSize } from './config.js';
import { ConfigResolver } from './core/utils/ConfigResolver.js';

// ConfigResolver is a static class - PR7 principle
// Set it as global for access from all scenes
window.ConfigResolver = ConfigResolver;

// Function for game initialization
async function initializeGame() {
    // First initialize ConfigResolver with external configurations
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
    fps: {
        target: 60,
        forceSetTimeOut: false  // Use rAF but cap at 60fps (prevents 120/144Hz overhead)
    },
    scale: {
        mode: Phaser.Scale.NONE,
        fullscreenTarget: 'game-container',
        snap: { width: 1, height: 1 }  // Phaser 3.80: pixel-perfect integer scaling
    },
    render: {
        pixelArt: true,      // Enable for pixel font
        antialias: false,    // Disable for sharp pixel text
        roundPixels: true    // Round pixels for pixel perfect rendering
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

// Start game initialization
initializeGame();
