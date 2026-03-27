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
    }

    setupEventListeners() {
        // Store handler references for proper cleanup
        this._onPauseRequest = () => this.showPause();
        this._onLevelUp = (options) => this.showPowerUpSelection(options);
        this._onGameOver = (stats) => this.showGameOver(stats);

        this.game.events.on('game-pause-request', this._onPauseRequest);
        this.game.events.on('game-levelup', this._onLevelUp);
        this.game.events.on('game-over', this._onGameOver);
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

        this.scene.bringToTop();
        this.input.setTopOnly(true);

        if (gameScene.scene.isActive()) {
            gameScene.scene.pause();
            this.pauseUI.show();
        }
    }

    handleResume() {
        const gameScene = this.scene.get('GameScene');
        if (!gameScene) return;

        this.pauseUI.hide();
        this.input.setTopOnly(false);
        gameScene.scene.resume();
    }

    handleQuit() {
        this.pauseUI.hide();
        this.scene.stop('GameScene');
        this.scene.stop('GameUIScene');
        this.scene.start('MainMenu');
    }

    showPowerUpSelection(options) {
        const gameScene = this.scene.get('GameScene');
        if (!gameScene) return;

        this.scene.bringToTop();
        this.input.setTopOnly(true);

        if (gameScene.scene.isActive()) {
            gameScene.scene.pause();
        }

        this.powerUpUI.show(options);
    }

    handlePowerUpSelection(selection) {
        const gameScene = this.scene.get('GameScene');
        if (!gameScene) return;

        // PowerUpUI already hides itself on card click — no need to call hide() again
        this.input.setTopOnly(false);
        this.game.events.emit('powerup-selected', selection);
        gameScene.scene.resume();
    }

    showGameOver(stats) {
        this.gameOverUI.show(stats);
    }

    /**
     * Update HUD even when GameScene is paused
     * (paused scenes still render but don't get update calls)
     */
    update() {
        const gameScene = this.scene.get('GameScene');
        if (gameScene?.unifiedHUD && gameScene.scene.isPaused()) {
            gameScene.unifiedHUD.update();
        }
    }

    shutdown() {
        this.pauseUI?.destroy();
        this.powerUpUI?.destroy();
        this.gameOverUI?.destroy();

        // Remove only OUR event listeners (not all listeners on these events)
        if (this._onPauseRequest) this.game.events.off('game-pause-request', this._onPauseRequest);
        if (this._onLevelUp) this.game.events.off('game-levelup', this._onLevelUp);
        if (this._onGameOver) this.game.events.off('game-over', this._onGameOver);
    }
}
