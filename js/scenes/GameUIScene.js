/**
 * GameUIScene - Overlay scene for game UI elements
 * Runs parallel with GameScene to handle UI that needs to work when game is paused
 */
import { PauseUI } from '../ui/lite/PauseUI.js';
import { PowerUpUI } from '../ui/lite/PowerUpUI.js';
import { GameOverUI } from '../ui/lite/GameOverUI.js';
import { UnifiedHUD } from '../ui/UnifiedHUD.js';
import { UI_THEME } from '../ui/UITheme.js';
import { centralEventBus } from '../core/events/CentralEventBus.js';

export class GameUIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameUIScene' });

        this.pauseUI = null;
        this.powerUpUI = null;
        this.gameOverUI = null;
        this.hud = null;
    }

    create() {
        // Initialize HUD (lives in UI scene, reads from GameScene via connect)
        this.hud = new UnifiedHUD(this);

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

    /**
     * Called by BootstrapManager after GameScene is ready.
     * Wires the HUD to the game scene so it can read player/stats.
     */
    connectToGameScene(gameScene) {
        if (this.hud) {
            this.hud.connect(gameScene);
        }
    }

    setupEventListeners() {
        // Remove stale handlers first (prevents accumulation on scene restart)
        this._removeEventListeners();

        this._onPauseRequest = () => this.showPause();
        this._onLevelUp = (options) => this.showPowerUpSelection(options);
        this._onGameOver = (stats) => this.showGameOver(stats);
        this._onVictoryShow = (data) => this.showVictory(data);
        this._onLevelTransitionShow = (data) => this.showLevelTransition(data);

        // Cross-scene events via CentralEventBus (Phaser best practice: standalone EventEmitter)
        centralEventBus.on('ui:pause-request', this._onPauseRequest, this);
        centralEventBus.on('game:levelup', this._onLevelUp, this);
        centralEventBus.on('game:over', this._onGameOver, this);
        centralEventBus.on('ui:victory-show', this._onVictoryShow, this);
        centralEventBus.on('ui:level-transition-show', this._onLevelTransitionShow, this);
    }

    _removeEventListeners() {
        centralEventBus.removeAllListeners(this);
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

        // Emit selection and resume immediately for responsiveness
        centralEventBus.emit('game:powerup-selected', selection);
        gameScene.scene.resume();

        // Defer input restoration until hide animation completes
        // to prevent click-through during the 200ms fade
        this.powerUpUI.hide(() => {
            this.input.setTopOnly(false);
        });
    }

    showGameOver(stats) {
        this.scene.bringToTop();
        this.input.setTopOnly(true);
        this.gameOverUI.show(stats);
    }

    showVictory(data) {
        this.scene.bringToTop();
        this.input.setTopOnly(true);
        // Reuse game over UI for victory with victory flag
        this.gameOverUI.show({ ...data, isVictory: true });
    }

    showLevelTransition(data) {
        this.scene.bringToTop();

        // Show brief level transition text
        const cx = this.cameras.main.width / 2;
        const cy = this.cameras.main.height / 2;
        const msg = data?.message || `Level ${data?.toLevel || '?'}`;
        const text = this.add.text(cx, cy, msg, {
            fontFamily: UI_THEME.fonts.primary,
            fontSize: '48px',
            color: '#00ffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(UI_THEME.depth.modal).setScrollFactor(0);

        // Auto-fade and destroy
        this.tweens.add({
            targets: text,
            alpha: 0,
            duration: 1200,
            delay: 300,
            onComplete: () => text.destroy()
        });
    }

    /**
     * Update HUD every frame (time display) — works even when GameScene is paused
     */
    update() {
        this.hud?.update();
    }

    shutdown() {
        // Restore input state before destroying UI
        this.input.setTopOnly(false);

        this.hud?.destroy();
        this.pauseUI?.destroy();
        this.powerUpUI?.destroy();
        this.gameOverUI?.destroy();

        this._removeEventListeners();
    }
}
