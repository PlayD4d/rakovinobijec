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
        console.log('[Main] ConfigResolver inicializován s externími konfiguracemi');
    } catch (err) {
        console.warn('[Main] ConfigResolver inicializace selhala:', err);
    }
    
    const config = {
    type: Phaser.AUTO,
    width: GameConfig.width,
    height: GameConfig.height,
    backgroundColor: GameConfig.backgroundColor,
    parent: 'game',
    scale: {
        mode: Phaser.Scale.NONE,
        fullscreenTarget: 'game-container'
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
    plugins: {
        scene: [
            {
                key: 'rexUI',
                plugin: rexuiplugin,
                mapping: 'rexUI'
            }
        ]
    },
    scene: [MainMenu, GameScene, GameUIScene]
    };

    // Debug: Check container before game creation
    console.log('=== PRE-GAME DEBUG ===');
    const gameContainer = document.getElementById('game');
    console.log('Game container element:', gameContainer);
    console.log('Game container computed style:', getComputedStyle(gameContainer));
    console.log('Game container offset dimensions:', gameContainer.offsetWidth, 'x', gameContainer.offsetHeight);
    console.log('Game container client dimensions:', gameContainer.clientWidth, 'x', gameContainer.clientHeight);

    const game = new Phaser.Game(config);

    // Debug: Check after game creation
    console.log('=== POST-GAME DEBUG ===');
    console.log('Phaser game canvas:', game.canvas);
    console.log('Canvas parent:', game.canvas.parentElement);

    // Phaser scale events
    game.scale.on('orientationchange', () => {
        console.log('Orientation changed');
    });

    game.scale.on('resize', (gameSize) => {
        console.log('Game resized to:', gameSize.width, 'x', gameSize.height);
        console.log('Canvas actual size:', game.canvas.width, 'x', game.canvas.height);
        console.log('Canvas display size:', game.canvas.style.width, 'x', game.canvas.style.height);
        console.log('Parent container size:', document.getElementById('game').offsetWidth, 'x', document.getElementById('game').offsetHeight);
    });

    game.scale.on('enterfullscreen', () => {
        console.log('Entered fullscreen');
    });

    game.scale.on('leavefullscreen', () => {
        console.log('Left fullscreen - let it work naturally');
        // Nechat menu tam, kde je - možná je to vlastně v pořádku
    });
}

// Spustit inicializaci hry
initializeGame();