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
import { getSession } from '../core/debug/SessionLog.js';

export class GameUIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameUIScene' });

        this.pauseUI = null;
        this.powerUpUI = null;
        this.gameOverUI = null;
        this.hud = null;
    }

    init() {
        // Reset instance state on restart — variables outside init() persist across restarts
        this._onBossHpUpdate = null;
        this._onBossHideHp = null;
        this._onBossShowHp = null;
        this._onPauseRequest = null;
        this._onLevelUp = null;
        this._onGameOver = null;
        this._onVictoryShow = null;
        this._onLevelTransitionShow = null;
    }

    create() {
        // Register shutdown handler — Phaser emits 'shutdown' event, does NOT call shutdown() automatically
        this.events.once('shutdown', this.shutdown, this);

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

        // Boss HP events from GameScene (scene.events, not CentralEventBus)
        this._onBossHpUpdate = ({ hp, maxHp }) => this.hud?.setBossHealth(hp, maxHp);
        this._onBossHideHp = () => this.hud?.hideBoss();
        this._onBossShowHp = ({ name, hp, maxHp }) => this.hud?.showBoss(name, hp, maxHp);

        const gameScene = this.scene.get('GameScene');
        if (gameScene) {
            gameScene.events.on('boss:hp-update', this._onBossHpUpdate, this);
            gameScene.events.on('boss:hide-hp', this._onBossHideHp, this);
            gameScene.events.on('boss:show-hp', this._onBossShowHp, this);
        }
    }

    _removeEventListeners() {
        centralEventBus.removeAllListeners(this);

        const gameScene = this.scene.get('GameScene');
        if (gameScene) {
            if (this._onBossHpUpdate) gameScene.events.off('boss:hp-update', this._onBossHpUpdate, this);
            if (this._onBossHideHp) gameScene.events.off('boss:hide-hp', this._onBossHideHp, this);
            if (this._onBossShowHp) gameScene.events.off('boss:show-hp', this._onBossShowHp, this);
        }
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
        if (this.pauseUI?.isVisible()) return;
        const gameScene = this.scene.get('GameScene');
        if (!gameScene) return;

        getSession()?.log('ui', 'pause_show');
        this.scene.bringToTop();
        this.input.setTopOnly(true);

        if (gameScene.scene.isActive()) {
            gameScene.isPaused = true;
            gameScene.scene.pause();
            this.pauseUI.show();
        }
    }

    handleResume() {
        const gameScene = this.scene.get('GameScene');
        if (!gameScene) return;

        getSession()?.log('ui', 'pause_resume');
        this.pauseUI.hide();
        this.input.setTopOnly(false);
        gameScene.isPaused = false;
        gameScene.scene.resume();
    }

    handleQuit() {
        getSession()?.log('ui', 'quit_to_menu');
        this.pauseUI.hide();
        this.scene.get('GameScene')?.returnToMenu();
    }

    showPowerUpSelection(options) {
        const gameScene = this.scene.get('GameScene');
        if (!gameScene) return;

        // Set isPaused BEFORE Phaser pause — prevents addXP from firing another levelUp
        // in the same frame (Phaser scene.pause() is deferred to next update)
        gameScene.isPaused = true;

        this.scene.bringToTop();
        this.input.setTopOnly(true);

        if (gameScene.scene.isActive()) {
            gameScene.scene.pause();
        }

        getSession()?.log('ui', 'powerup_show', { count: options?.length });
        this.powerUpUI.show(options);
    }

    handlePowerUpSelection(selection) {
        const gameScene = this.scene.get('GameScene');
        if (!gameScene) return;

        getSession()?.log('ui', 'powerup_card_clicked', { id: selection?.id, level: selection?.level });

        // PowerUpUI.hide already ran (called by pointerup → onSelection callback).
        // Just reset input isolation, apply powerup, and resume — no double-hide.
        this.input.setTopOnly(false);
        try {
            centralEventBus.emit('game:powerup-selected', selection);
        } catch (err) {
            console.error('[GameUIScene] powerup-selected handler threw:', err);
            getSession()?.log('ui', 'powerup_apply_error', { id: selection?.id, error: err.message });
        }
        // Always resume even if powerup application failed — prevents stuck pause
        getSession()?.log('ui', 'powerup_resume');
        gameScene.scene.resume();
        gameScene.flashCamera?.();
    }


    showGameOver(stats) {
        getSession()?.log('ui', 'gameover_show');
        const gameScene = this.scene.get('GameScene');
        this.scene.bringToTop();
        this.input.setTopOnly(true);
        // Pause GameScene so restart works cleanly (resume before restart in restartGame)
        if (gameScene?.scene?.isActive()) {
            gameScene.scene.pause();
        }
        this.gameOverUI.show(stats);
        centralEventBus.emit('ui:modal-ready');
    }

    showVictory(data) {
        getSession()?.log('ui', 'victory_show');
        const gameScene = this.scene.get('GameScene');
        this.scene.bringToTop();
        this.input.setTopOnly(true);
        // TransitionManager.pauseGameSystems() already stopped everything
        if (gameScene?.scene?.isActive() && !gameScene.isGameOver) {
            gameScene.isPaused = true;
            gameScene.scene.pause();
        }
        // Reuse game over UI for victory — flatten nested stats to top level
        this.gameOverUI.show({ ...data, ...(data.stats || {}), isVictory: true });
        // Signal TransitionManager that modal is visible
        centralEventBus.emit('ui:modal-ready');
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
        this.hud = null;
        this.pauseUI?.destroy();
        this.pauseUI = null;
        this.powerUpUI?.destroy();
        this.powerUpUI = null;
        this.gameOverUI?.destroy();
        this.gameOverUI = null;

        this._removeEventListeners();

        // NOTE: Do NOT call super.shutdown() — same as GameScene, calling it from
        // within the SHUTDOWN event handler corrupts Phaser's listener dispatch.
    }
}
