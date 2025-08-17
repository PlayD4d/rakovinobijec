/**
 * GameUIScene - Overlay scene for game UI elements
 * Runs parallel with GameScene to handle UI that needs to work when game is paused
 */
import { PauseUI } from '../ui/lite/PauseUI.js';
import { PowerUpUI } from '../ui/lite/PowerUpUI.js';
import { GameOverUI } from '../ui/lite/GameOverUI.js';

export class GameUIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameUIScene' });
        
        this.pauseUI = null;
        this.powerUpUI = null;
        this.gameOverUI = null;
    }
    
    create() {
        console.log('[GameUIScene] Creating UI overlay scene');
        
        // Initialize UI components
        this.pauseUI = new PauseUI(this,
            () => this.handleResume(),
            () => this.handleQuit()
        );
        
        this.powerUpUI = new PowerUpUI(this, (selection) => {
            this.handlePowerUpSelection(selection);
        });
        
        this.gameOverUI = new GameOverUI(this);
        
        // Listen for events from GameScene
        this.setupEventListeners();
        
        // ESC is handled by GameScene KeyboardManager via 'ui.escape' event
        // which forwards to 'game-pause-request' event that we listen for below
    }
    
    setupEventListeners() {
        // Listen for pause request from GameScene
        this.game.events.on('game-pause-request', () => {
            console.log('[GameUIScene] Received game-pause-request event');
            this.showPause();
        });
        
        // Listen for level up
        this.game.events.on('game-levelup', (options) => {
            console.log('[GameUIScene] Received game-levelup event with options:', options);
            this.showPowerUpSelection(options);
        });
        
        // Listen for game over
        this.game.events.on('game-over', (stats) => {
            console.log('[GameUIScene] Received game-over event with stats:', stats);
            this.showGameOver(stats);
        });
    }
    
    togglePause() {
        const gameScene = this.scene.get('GameScene');
        if (!gameScene || gameScene.isGameOver) return;
        
        if (this.pauseUI.isVisible()) {
            this.handleResume();
        } else {
            this.showPause();
        }
    }
    
    showPause() {
        const gameScene = this.scene.get('GameScene');
        if (!gameScene) return;
        
        // Pause the game scene (only if it's running)
        if (gameScene.scene.isActive()) {
            gameScene.scene.pause();
            this.pauseUI.show();
            console.log('[GameUIScene] Game paused');
        } else {
            console.warn('[GameUIScene] Cannot pause - GameScene not active');
        }
    }
    
    handleResume() {
        const gameScene = this.scene.get('GameScene');
        if (!gameScene) return;
        
        // Resume the game scene
        this.pauseUI.hide();
        gameScene.scene.resume();
        console.log('[GameUIScene] Game resumed');
    }
    
    handleQuit() {
        // Clean up and return to menu
        this.pauseUI.hide();
        
        // Stop both scenes - this will trigger shutdown on GameScene
        // The shutdown method will handle all cleanup
        this.scene.stop('GameScene');
        this.scene.stop('GameUIScene');
        
        // Start main menu
        this.scene.start('MainMenu');
    }
    
    showPowerUpSelection(options) {
        console.log('[GameUIScene] showPowerUpSelection called with options:', options);
        const gameScene = this.scene.get('GameScene');
        if (!gameScene) {
            console.error('[GameUIScene] GameScene not found!');
            return;
        }
        
        // Pause game while selecting (only if it's running)
        console.log('[GameUIScene] Pausing GameScene for power-up selection');
        if (gameScene.scene.isActive()) {
            gameScene.scene.pause();
        } else {
            console.warn('[GameUIScene] Cannot pause for power-up - GameScene not active');
        }
        
        console.log('[GameUIScene] Showing PowerUpUI modal');
        this.powerUpUI.show(options);
    }
    
    handlePowerUpSelection(selection) {
        console.log('[GameUIScene] handlePowerUpSelection called with:', selection);
        const gameScene = this.scene.get('GameScene');
        if (!gameScene) {
            console.error('[GameUIScene] GameScene not found during power-up selection!');
            return;
        }
        
        // Hide UI and resume game
        console.log('[GameUIScene] Hiding PowerUpUI modal');
        this.powerUpUI.hide();
        
        // Apply power-up in game scene
        console.log('[GameUIScene] Emitting powerup-selected event');
        this.game.events.emit('powerup-selected', selection);
        
        // Resume game
        console.log('[GameUIScene] Resuming GameScene');
        gameScene.scene.resume();
    }
    
    showGameOver(stats) {
        this.gameOverUI.show(stats);
    }
    
    shutdown() {
        // No direct keyboard handlers to clean up - KeyboardManager handles everything
        
        // Clean up UI components
        this.pauseUI?.destroy();
        this.powerUpUI?.destroy();
        this.gameOverUI?.destroy();
        
        // Remove event listeners
        this.game.events.off('game-pause-request');
        this.game.events.off('game-levelup');
        this.game.events.off('game-over');
        this.game.events.off('powerup-selected');
    }
}