import { Player } from '../entities/Player.js';
import { startSession, getSession, endSession } from '../core/debug/SessionLog.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
import { MobileControlsSystem } from '../core/systems/MobileControlsSystem.js';
import { centralEventBus } from '../core/events/CentralEventBus.js';
import { BlueprintLoader } from '../core/data/BlueprintLoader.js';
import { setupCollisions } from '../handlers/setupCollisions.js';
import { UpdateManager } from '../managers/UpdateManager.js';
import { TransitionManager } from '../managers/TransitionManager.js';
import { BootstrapManager } from '../managers/BootstrapManager.js';
import { DisposableRegistry } from '../utils/DisposableRegistry.js';
import { ProgressionSystem } from '../core/systems/ProgressionSystem.js';
import { TelemetryLogger } from '../core/TelemetryLogger.js';
import { DebugOverlay } from '../utils/DebugOverlay.js';

// Store BlueprintLoader for synchronous access in preload (used by devConsole)
window.BlueprintLoaderModule = { BlueprintLoader };

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        // Entities
        this.player = null;
        this.enemiesGroup = null;
        this.currentBoss = null;

        // Systems (assigned in create/bootstrap)
        this.mobileControls = null;
        this.blueprintLoader = null;
        this.spawnDirector = null;
        this.frameworkDebug = null;
        this.projectileSystem = null;
        this.lootSystem = null;
        this.powerUpSystem = null;
        this.vfxSystem = null;
        this.audioSystem = null;
        this.keyboardManager = null;

        this.configResolver = window.ConfigResolver;
        this.eventBus = centralEventBus;
    }

    init() {
        const CR = window.ConfigResolver;
        const xpBase = CR ? CR.get('progression.xp.baseRequirement', { defaultValue: 8 }) : 8;
        this.gameStats = {
            level: 1, xp: 0, xpToNext: xpBase, score: 0,
            enemiesKilled: 0, kills: 0, time: 0,
            bossesDefeated: 0, powerUpsCollected: 0
        };
        this.sceneTimeSec = 0;
        this.isPaused = false;
        this.isGameOver = false;
        this.powerUps = [];
        this.currentLevel = 1;
        this.maxLevel = 7;
        this.bossActive = false;
        this._shutdownDone = false;
    }

    preload() {
        DebugLogger.info('bootstrap', '[GameScene] Preload phase starting...');
        this._initializeBlueprintLoaderSync();
        this._preloadAllAudio();
        DebugLogger.info('bootstrap', '[GameScene] Preload phase completed');
    }

    _initializeBlueprintLoaderSync() {
        try {
            this.blueprints = new BlueprintLoader(this.game);
            this.blueprintLoader = this.blueprints;
        } catch (error) {
            DebugLogger.warn('bootstrap', 'BlueprintLoader creation failed:', error);
            this.blueprintLoader = null;
            this.blueprints = null;
        }
    }

    async _initializeBlueprintLoader() {
        if (this.blueprintLoader?.loaded) return;
        try {
            if (!this.blueprintLoader) {
                this.blueprints = new BlueprintLoader(this.game);
                this.blueprintLoader = this.blueprints;
            }
            await this.blueprintLoader.init();
            DebugLogger.info('bootstrap', `BlueprintLoader initialized: ${this.blueprintLoader.blueprints.size} blueprints`);
        } catch (error) {
            DebugLogger.error('bootstrap', 'BlueprintLoader init failed:', error);
        }
    }

    _preloadAllAudio() {
        this.load.json('audio_manifest', '/data/generated/audio_manifest.json');
        this.load.on('filecomplete-json-audio_manifest', (key, type, data) => {
            if (!data?.audio) {
                DebugLogger.error('bootstrap', '[AudioPreload] Invalid or missing audio manifest!');
                return;
            }
            let loadedCount = 0;
            data.audio.forEach(path => {
                const k = path.replace(/[^a-zA-Z0-9]/g, '_');
                if (!this.cache.audio.has(k)) { this.load.audio(k, path); loadedCount++; }
            });
            DebugLogger.info('bootstrap', `[AudioPreload] Prepared ${loadedCount} audio files`);
        });
    }

    async create() {
        this.disposables = new DisposableRegistry();
        await this._initializeBlueprintLoader();
        this.startTime = this.time.now;
        this.progressionSystem = new ProgressionSystem(this);

        const bootstrapper = new BootstrapManager(this);
        try {
            await bootstrapper.bootstrap();
        } catch (error) {
            DebugLogger.error('bootstrap', 'Bootstrap failed:', error);
            return;
        }
    }

    setupInput() {
        this.inputKeys = this.input.keyboard.addKeys({
            up: 'W', down: 'S', left: 'A', right: 'D',
            up2: 'UP', down2: 'DOWN', left2: 'LEFT', right2: 'RIGHT'
        });

        try {
            const settingsManager = window.settingsManager || this.settingsManager;
            const mobileEnabled = settingsManager?.get('controls.joystickEnabled');
            const side = settingsManager?.get('controls.joystickPosition') || 'left';
            if (mobileEnabled) {
                this.mobileControls = new MobileControlsSystem(this, { side });
                this.mobileControls.enable();
            }
        } catch (_) {}

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (!this._shutdownDone) {
                this._shutdownDone = true;
                this.shutdown();
            }
        });
    }

    setupCollisions() {
        this._colliders = setupCollisions(this);
        return this._colliders;
    }

    initializeUpdateManager() {
        this.updateManager = new UpdateManager(this);
        this.updateManager.registerGameSceneTasks(this);
    }

    initializeTransitionManager() {
        this.transitionManager = new TransitionManager(this);
    }

    initializeDebugSystems() {
        try {
            this.telemetryLogger = new TelemetryLogger(this);
            if (!this.debugOverlay) {
                this.debugOverlay = new DebugOverlay(this);
            }
        } catch (error) {
            DebugLogger.warn('game', 'Debug systems init failed:', error);
        }
    }

    update(time, delta) {
        if (this.isGameOver) return;
        if (this.updateManager) this.updateManager.update(time, delta);
    }

    // ========== Game Flow ==========

    async startGame() {
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.levelStartTime = this.time?.now || 0;

        if (this.spawnDirector) {
            this._session = startSession(this.game.config?.gameVersion || 'dev');
            const loaded = await this.spawnDirector.loadSpawnTable('spawnTable.level1');
            if (loaded) {
                this.spawnDirector.start();
                const table = this.spawnDirector.currentTable;
                if (table?.music?.ambient && this.audioSystem) {
                    this.audioSystem.playMusic(table.music.ambient);
                }
            } else {
                DebugLogger.error('game', 'Failed to load spawn table');
            }
        }
    }

    levelUp() {
        this._session?.log('game', 'level_up', { level: this.gameStats.level, time: Math.floor(this.sceneTimeSec) });
        const healAmount = window.ConfigResolver?.get('progression.levelUpHeal', { defaultValue: 20 }) ?? 20;
        this.player.heal(healAmount);
        const options = this.getPowerUpOptions();
        centralEventBus.emit('game:levelup', options);
    }

    getPowerUpOptions() {
        if (this.powerUpSystem && typeof this.powerUpSystem.generatePowerUpOptions === 'function') {
            const options = this.powerUpSystem.generatePowerUpOptions();
            if (options && options.length > 0) return options;
        }
        return GameScene.OVERFLOW_BOOSTS;
    }

    addXP(amount) { this.progressionSystem?.addXP(amount); }

    updateTime() {
        if (!this.isPaused && !this.isGameOver) this.gameStats.time++;
    }

    // ========== Entity Operations ==========

    createEnemyFromBlueprint(blueprintId, options = {}) {
        if (this.enemyManager) return this.enemyManager.spawnEnemy(blueprintId, options);
        DebugLogger.error('game', '[GameScene] EnemyManager not initialized');
        return null;
    }

    handleEnemyDeath(enemy) {
        if (this.enemyManager) this.enemyManager.onEnemyDeath(enemy);
    }

    killAllEnemies() {
        if (this.enemyManager) this.enemyManager.killAll();
        this.flashCamera();
    }

    /** Drop exactly 1 XP gem per kill — tier based on total XP value.
     *  When field is full, XP accumulates in a red superorb (VS-style). */
    createXPOrbs(x, y, totalXP) {
        if (!totalXP || totalXP <= 0 || !this.lootSystem) return;

        // Field full → route XP into superorb (no XP lost, VS red gem mechanic)
        if (this.lootSystem.isFieldFull()) {
            this.lootSystem.addToSuperorb(x, y, totalXP);
            return;
        }

        let itemId;
        if (totalXP >= 50)      itemId = 'item.xp_diamond';
        else if (totalXP >= 25) itemId = 'item.xp_big';
        else if (totalXP >= 10) itemId = 'item.xp_large';
        else if (totalXP >= 5)  itemId = 'item.xp_medium';
        else if (totalXP >= 2)  itemId = 'item.xp_tiny';
        else                    itemId = 'item.xp_small';
        const drop = this.lootSystem.createDrop(x, y, itemId);
        if (drop) drop.value = totalXP;
    }

    spawnDrop(itemId, x, y) {
        if (this.lootSystem && itemId) this.lootSystem.createDrop(x, y, itemId);
    }

    spawnLootDrop(drop, x, y) {
        const dropId = drop?.itemId || drop?.ref;
        if (dropId && this.lootSystem) this.lootSystem.createDrop(x, y, dropId);
    }

    findNearestEnemy() {
        return this.targetingSystem ? this.targetingSystem.findNearestEnemy(this.player) : null;
    }

    // ========== Transitions ==========

    async gameOver() {
        try { endSession('death'); } catch (_) {}
        if (this.transitionManager) await this.transitionManager.gameOver();
    }

    async transitionToNextLevel() {
        if (this.isGameOver || this.transitionManager?.isTransitioning) return;
        const nextLevel = (this.currentLevel || 1) + 1;
        if (nextLevel > (this.maxLevel || 99)) {
            this.showVictory();
            return;
        }
        if (this.transitionManager) await this.transitionManager.transitionToNextLevel(nextLevel);
    }

    async showVictory() {
        try { endSession('victory'); } catch (_) {}
        try {
            if (this.transitionManager) await this.transitionManager.showVictory();
        } catch (err) {
            DebugLogger.error('game', '[GameScene] Victory sequence failed:', err);
            this.returnToMenu();
        }
    }

    restartGame() {
        this._shutdownDone = false;
        this.scene.stop('GameUIScene');
        this.scene.restart();
    }

    returnToMenu() {
        try { endSession('quit'); } catch (_) {}
        this._shutdownDone = false;
        try { this.scene.stop('GameUIScene'); } catch (_) {}
        this.scene.start('MainMenu');
    }

    // ========== Phaser API (thin wrappers for managers) ==========

    pausePhysics() { this.physics?.world?.pause(); }
    resumePhysics() { this.physics?.world?.resume(); }
    setWorldBounds(x, y, w, h) { this.physics?.world?.setBounds(x, y, w, h); }
    getMainCamera() { return this.cameras.main; }
    getScaleManager() { return this.scale; }
    flashCamera(duration = 500, r = 255, g = 255, b = 0) { this.cameras.main.flash(duration, r, g, b); }
    shakeCamera(duration = 300, intensity = 0.02) { this.cameras.main.shake(duration, intensity); }
    launchUIScene(key) { this.scene.launch(key); }
    addTimeEvent(config) { return this.time.addEvent(config); }
    addDelayedCall(delay, cb, args, scope) { return this.time.delayedCall(delay, cb, args, scope); }

    showCriticalError(title, message) {
        const uiScene = this.scene.get('GameUIScene');
        if (uiScene?.events) {
            uiScene.events.emit('show-error', { title, message });
        } else {
            DebugLogger.error('game', '[GameScene] Critical error:', title, message);
        }
    }

    handleResize(gameSize) {
        const { width, height } = gameSize;
        this.mainCam?.setSize(width, height);
        if (this.mobileControls?.enabled) this.mobileControls.handleResize(width, height);
    }

    // ========== Shutdown ==========

    shutdown() {
        if (this._shutdownDone) return;
        this._shutdownDone = true;
        DebugLogger.info('game', '[GameScene] Starting shutdown sequence...');

        try {
            this.spawnDirector?.stop?.();
            this.projectileSystem?.clearAll?.();
            try { this.enemiesGroup?.clear(true, true); } catch (_) {}
            try { this.bossGroup?.clear(true, true); } catch (_) {}
            try { this.physics?.pause(); } catch (_) {}

            if (this._colliders && this.physics?.world) {
                for (const c of this._colliders) {
                    try { this.physics.world.removeCollider(c); } catch (_) {}
                }
                this._colliders = null;
            }

            try { this.disposables?.disposeAll(); } catch (e) {
                DebugLogger.warn('game', '[GameScene] Error disposing resources:', e);
            }

            const systems = [
                this.updateManager, this.transitionManager, this.powerUpSystem,
                this.lootSystem, this.projectileSystem, this.vfxSystem,
                this.audioSystem, this.keyboardManager, this.armorShieldEffect,
                this.playerShieldEffect, this.debugOverlay, this.graphicsFactory,
                this.enemyManager
            ];
            for (const sys of systems) {
                if (!sys) continue;
                try {
                    if (typeof sys.shutdown === 'function') sys.shutdown();
                    else if (typeof sys.destroy === 'function') sys.destroy();
                } catch (_) {}
            }
            try { this.telemetryLogger?.destroy(); } catch (_) {}

            centralEventBus.removeAllListeners(this);
            try { if (this._resizeHandler) this.scale.off('resize', this._resizeHandler); } catch (_) {}
            if (this.mobileControls?.enabled) try { this.mobileControls.disable(); } catch (_) {}

            try { this.tweens?.killAll(); } catch (_) {}
            try { this.time?.removeAllEvents(); } catch (_) {}

            // Nullify references
            const refs = ['player','spawnDirector','projectileSystem','lootSystem','powerUpSystem',
                'vfxSystem','audioSystem','keyboardManager','updateManager',
                'transitionManager','enemiesGroup','bossGroup','debugOverlay','telemetryLogger',
                'graphicsFactory','targetingSystem','mobileControls','frameworkDebug',
                'blueprintLoader','uiLayer','enemyManager'];
            for (const k of refs) this[k] = null;

        } catch (e) {
            console.error('[GameScene] Critical error during shutdown:', e);
        }
    }
}

GameScene.OVERFLOW_BOOSTS = [
    { id: 'overflow.damage', name: 'Posílená cytotoxicita', description: 'Permanentně zvyšuje poškození všech útoků.', stats: '+5 DMG', rarity: 'common', icon: 'damage', level: 0, maxLevel: 0, _overflow: { stat: 'projectileDamage', type: 'add', value: 5 } },
    { id: 'overflow.hp', name: 'Buněčná regenerace', description: 'Permanentně zvyšuje maximální zdraví.', stats: '+15 HP', rarity: 'common', icon: 'health', level: 0, maxLevel: 0, _overflow: { stat: 'maxHp', type: 'add', value: 15 } },
    { id: 'overflow.speed', name: 'Metabolický impuls', description: 'Permanentně zrychluje pohyb a útok.', stats: '+5% rychlost', rarity: 'common', icon: 'speed', level: 0, maxLevel: 0, _overflow: { stat: 'moveSpeed', type: 'mul', value: 0.05 } },
];
