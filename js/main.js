import { GameScene } from './scenes/GameScene.js';
import { MainMenu } from './scenes/MainMenu.js';
import { GameConfig } from './config.js';

const config = {
    type: Phaser.AUTO,
    width: GameConfig.width,
    height: GameConfig.height,
    backgroundColor: GameConfig.backgroundColor,
    parent: 'game',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
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
            debug: false
        }
    },
    scene: [MainMenu, GameScene]
};

const game = new Phaser.Game(config);

// Resize handling
window.addEventListener('resize', () => {
    // Přepočítat velikost se stejnou logikou jako v config
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Rezerva pro padding, rámečky a texty
    const availableWidth = Math.floor(screenWidth - 60);
    const availableHeight = Math.floor(screenHeight - 200);
    
    // Použít MENŠÍ z dostupné nebo minimální velikosti
    const newWidth = Math.min(Math.max(800, availableWidth), availableWidth);
    const newHeight = Math.min(Math.max(600, availableHeight), availableHeight);
    
    // Změnit velikost hry
    game.scale.resize(newWidth, newHeight);
    
    console.log(`Game resized to: ${newWidth}x${newHeight}`);
});