import { Player } from '../entities/Player.js';
import { startSession, getSession, endSession } from '../core/debug/SessionLog.js';
import { Boss } from '../entities/Boss.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
import { MobileControlsSystem} from '../core/systems/MobileControlsSystem.js';
import { SimpleLootSystem } from '../core/systems/SimpleLootSystem.js';
import { centralEventBus } from '../core/events/CentralEventBus.js';
// TelemetryLogger and DebugOverlay imported via GameSceneFlow
import { BlueprintLoader } from '../core/data/BlueprintLoader.js';
import { SpawnDirector } from '../core/spawn/SpawnDirector.js';
import { FrameworkDebugAPI } from '../core/FrameworkDebugAPI.js';
import { ProjectileSystem } from '../core/systems/ProjectileSystem.js';
import { GraphicsFactory } from '../core/graphics/GraphicsFactory.js';
import { setupCollisions } from '../handlers/setupCollisions.js';
import { UpdateManager } from '../managers/UpdateManager.js';
import { TransitionManager } from '../managers/TransitionManager.js';
import { BootstrapManager } from '../managers/BootstrapManager.js';
import { DisposableRegistry } from '../utils/DisposableRegistry.js';
import { EnemyManager } from '../managers/EnemyManager.js';
import { ProgressionSystem } from '../core/systems/ProgressionSystem.js';
import * as SceneAPI from './GameSceneAPI.js';
import * as SceneFlow from './GameSceneFlow.js';

// Store BlueprintLoader for synchronous access in preload (used by devConsole)
window.BlueprintLoaderModule = { BlueprintLoader };

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        // Entities
        this.player = null;
        this.enemiesGroup = null;
        this.currentBoss = null;

        // UI & controls
        this.mobileControls = null;

        // Systems (assigned in create/bootstrap)
        this.musicManager = null;
        this.blueprintLoader = null;
        this.spawnDirector = null;
        this.frameworkDebug = null;
        this.projectileSystem = null;
        this.lootSystem = null;
        this.powerUpSystem = null;
        this.vfxSystem = null;
        this.audioSystem = null;

        // Mutable game state is reset in init() (runs on every start/restart)
        this._lastTimeUi = 0;
        this.levelStartTime = 0;

        this.configResolver = window.ConfigResolver;
        this.eventBus = centralEventBus;
        this.keyboardManager = null;
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
        this.maxLevel = 7; // 7 levels with bosses
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
            DebugLogger.info('bootstrap', 'BlueprintLoader instance created (full init deferred to create)');
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

    _preloadAllAudio() { SceneFlow.preloadAllAudio(this); }

    async create() {
        // Initialize DisposableRegistry for cleanup
        this.disposables = new DisposableRegistry();
        
        // Complete BlueprintLoader initialization (async)
        await this._initializeBlueprintLoader();

        // Store start time for XP scaling
        this.startTime = this.time.now;

        // XP / level-up logic extracted into ProgressionSystem
        this.progressionSystem = new ProgressionSystem(this);

        // Use BootstrapManager to handle all initialization
        const bootstrapper = new BootstrapManager(this);
        try {
            await bootstrapper.bootstrap();
        } catch (error) {
            DebugLogger.error('bootstrap', 'Bootstrap failed:', error);
            return; // Stop if bootstrap fails
        }
        
        // PowerUp selection is handled by BootstrapManager.registerEventListeners()
        // Do NOT register a second listener here — it causes double application
    }
    
    initializeDebugSystems() { SceneFlow.initializeDebugSystems(this); }

    showCriticalError(title, message) { SceneFlow.showCriticalError(this, title, message); }
    
    setupInput() {
        // Create unified input system
        this.inputKeys = this.input.keyboard.addKeys({
            up: 'W', down: 'S', left: 'A', right: 'D',
            up2: 'UP', down2: 'DOWN', left2: 'LEFT', right2: 'RIGHT'
        });
        
        DebugLogger.info('bootstrap', 'Input keys configured');
        // Keyboard shortcuts handled by KeyboardManager + EventBus; only WASD/Arrows remain direct

        // Mobile controls
        try {
            // Use SettingsManager if available, fallback to direct check
            const settingsManager = window.settingsManager || this.settingsManager;
            const mobileEnabled = settingsManager ? 
                settingsManager.get('controls.joystickEnabled') : false;
            const side = settingsManager ? 
                settingsManager.get('controls.joystickPosition') : 'left';
            
            if (mobileEnabled) {
                this.mobileControls = new MobileControlsSystem(this, { side });
                this.mobileControls.enable();
            }
        } catch (_) {}
        
        // Listen for scene stop to trigger cleanup (using once to prevent double-call)
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (!this._shutdownDone) {
                this._shutdownDone = true;
                this.shutdown();
            }
        });
    }
    
    setupCollisions() {
        // Track colliders for proper cleanup on level transition/restart
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

    spawnDrop(itemId, x, y) { SceneFlow.spawnDrop(this, itemId, x, y); }

    /** Create XP orbs based on XP amount (tiered: small=1, medium=5, large=10) */
    createXPOrbs(x, y, totalXP) { SceneFlow.createXPOrbs(this, x, y, totalXP); }

    /**
     * Kill all enemies (for special items)
     */
    killAllEnemies() { SceneFlow.killAllEnemies(this); }
    
    async startGame() {
        // Fade in from black (menu faded out)
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.levelStartTime = this.time?.now || 0;
        
        // Start spawn director with first level spawn table
        if (this.spawnDirector) {
            // Load spawn table first
            // Start session logging
            this._session = startSession(this.game.config?.gameVersion || 'dev');

            const loaded = await this.spawnDirector.loadSpawnTable('spawnTable.level1');
            
            if (loaded) {
                this.spawnDirector.start();

                // Start level music from spawn table
                const table = this.spawnDirector.currentTable;
                if (table?.music?.ambient && this.audioSystem) {
                    this.audioSystem.playMusic(table.music.ambient);
                }

                DebugLogger.info('game', 'Game started! SpawnDirector activated with level1 spawn table');
            } else {
                DebugLogger.error('game', 'Failed to load spawn table - no enemies will spawn');
            }
        } else {
            DebugLogger.warn('game', 'SpawnDirector not initialized - no enemies will spawn');
        }
    }
    
    update(time, delta) {
        if (this.isGameOver) return;
        
        // Delegate all update logic to UpdateManager
        if (this.updateManager) {
            this.updateManager.update(time, delta);
        }
    }
    
    createEnemyFromBlueprint(blueprintId, options = {}) {
        if (this.enemyManager) {
            return this.enemyManager.spawnEnemy(blueprintId, options);
        }
        DebugLogger.error('game', '[GameScene] EnemyManager not initialized');
        return null;
    }
    
    handleEnemyDeath(enemy) {
        // Delegate to EnemyManager (full logic extracted for thin-scene compliance)
        if (this.enemyManager) {
            this.enemyManager.onEnemyDeath(enemy);
        }
    }
    
    handleMetotrexatPickup() { SceneFlow.handleMetotrexatPickup(this); }

    spawnLootDrop(drop, x, y) { SceneFlow.spawnLootDrop(this, drop, x, y); }

    attractXPOrb(orb) { SceneFlow.attractXPOrb(this, orb); }

    addXP(amount) { this.progressionSystem?.addXP(amount); }

    setPaused(paused) {
        this.isPaused = paused;
        if (paused) {
            this.projectileSystem?.pauseAll();
            // Store pause timestamp for timer-aware resume
            if (this.player) this.player._lastPauseTime = this.time?.now || 0;
            getSession()?.log('game', 'paused', { time: Math.floor(this.sceneTimeSec) });
            DebugLogger.info('game', 'Game paused');
        } else {
            this.projectileSystem?.resumeAll();
            getSession()?.log('game', 'resumed', { time: Math.floor(this.sceneTimeSec) });
            DebugLogger.info('game', 'Game resumed');
        }
    }


    /** Get power-up options for level-up selection */
    getPowerUpOptions() {
        if (this.powerUpSystem && typeof this.powerUpSystem.generatePowerUpOptions === 'function') {
            const options = this.powerUpSystem.generatePowerUpOptions();
            if (options && options.length > 0) return options;
        }
        // All powerups maxed — offer generic stat boosts instead of broken duplicates
        return GameScene.OVERFLOW_BOOSTS;
    }


    levelUp() {
        this._session?.log('game', 'level_up', { level: this.gameStats.level, time: Math.floor(this.sceneTimeSec) });
        // Heal from config (default 20) — no hardcoded magic number
        const healAmount = window.ConfigResolver?.get('progression.levelUpHeal', { defaultValue: 20 }) ?? 20;
        this.player.heal(healAmount);
        const options = this.getPowerUpOptions();
        DebugLogger.info('game', '[GameScene] Emitting game:levelup event');
        centralEventBus.emit('game:levelup', options);
        this.flashCamera();
    }

    async gameOver() {
        try { endSession('death'); } catch (_) {}
        if (this.transitionManager) await this.transitionManager.gameOver();
    }

    async transitionToNextLevel() {
        if (this.isGameOver || this.transitionManager?.isTransitioning) return;

        const nextLevel = (this.currentLevel || 1) + 1;

        if (nextLevel > (this.maxLevel || 99)) {
            DebugLogger.info('game', 'All levels completed - victory!');
            this.showVictory();
            return;
        }

        // Delegate to TransitionManager for proper cleanup, UI, and reset
        if (this.transitionManager) {
            await this.transitionManager.transitionToNextLevel(nextLevel);
        }
    }

    async showVictory() {
        try { endSession('victory'); } catch (_) {}
        try {
            if (this.transitionManager) await this.transitionManager.showVictory();
        } catch (err) {
            DebugLogger.error('game', '[GameScene] Victory sequence failed:', err);
            // Fallback: go directly to main menu if victory UI fails
            this.returnToMenu();
        }
    }

    updateTime() { SceneFlow.updateTime(this); }

    handleResize(gameSize) { SceneFlow.handleResize(this, gameSize); }
    
    // ========== PR7 Phaser API Interface Methods ==========
    // Controlled access to Phaser API for managers

    pausePhysics() { SceneAPI.pausePhysics(this); }
    resumePhysics() { SceneAPI.resumePhysics(this); }
    pauseTime() { SceneAPI.pauseTime(this); }
    resumeTime() { SceneAPI.resumeTime(this); }
    setWorldBounds(x, y, w, h) { SceneAPI.setWorldBounds(this, x, y, w, h); }
    createUILayer(depth) { return SceneAPI.createUILayer(this, depth); }
    launchUIScene(key) { SceneAPI.launchUIScene(this, key); }
    addTimeEvent(config) { return SceneAPI.addTimeEvent(this, config); }
    addDelayedCall(delay, cb, args, scope) { return SceneAPI.addDelayedCall(this, delay, cb, args, scope); }
    getMainCamera() { return SceneAPI.getMainCamera(this); }
    flashCamera(duration = 500, r = 255, g = 255, b = 0) { SceneAPI.flashCamera(this, duration, r, g, b); }
    shakeCamera(duration = 300, intensity = 0.02) { SceneAPI.shakeCamera(this, duration, intensity); }
    getScaleManager() { return SceneAPI.getScaleManager(this); }
    restartScene() { SceneAPI.restartScene(this); }
    
    findNearestEnemy() {
        // Delegate to TargetingSystem (with range filter + HP check + boss priority)
        if (this.targetingSystem) return this.targetingSystem.findNearestEnemy(this.player);
        return null;
    }

    _cleanupForTransition() {
        if (this.player && !this.player.active) this.player = null;
        if (this.enemiesGroup) this.enemiesGroup.clear(true, true);
        if (this.bossGroup) this.bossGroup.clear(true, true);
        if (this.audioSystem) this.audioSystem.stopAll();
    }

    restartGame() {
        // Clean up CentralEventBus BEFORE marking shutdown done — otherwise
        // shutdown() skips removeAllListeners and listeners accumulate across restarts
        centralEventBus.removeAllListeners(this);
        // Mark shutdown done to prevent double cleanup (shutdown() will also fire via SHUTDOWN event)
        this._shutdownDone = true;
        this._cleanupForTransition();
        this.scene.stop('GameUIScene');
        this.scene.restart();
    }

    returnToMenu() {
        try { endSession('quit'); } catch (_) {}
        // Clean up CentralEventBus BEFORE marking shutdown done
        centralEventBus.removeAllListeners(this);
        // Mark shutdown done to prevent double cleanup
        this._shutdownDone = true;
        try { this._cleanupForTransition(); } catch (_) {}
        try { this.scene.stop('GameUIScene'); } catch (_) {}
        this.scene.start('MainMenu');
    }

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
            // Remove tracked colliders before killing physics
            if (this._colliders && this.physics?.world) {
                for (const c of this._colliders) {
                    try { this.physics.world.removeCollider(c); } catch (_) {}
                }
                this._colliders = null;
            }
            // Shutdown systems FIRST — they may need tweens/timers for clean teardown
            try { this.disposables?.disposeAll(); } catch (e) {
                DebugLogger.warn('game', '[GameScene] Error disposing resources:', e);
            }

            const systemsToShutdown = [
                { name: 'updateManager', ref: this.updateManager },
                { name: 'transitionManager', ref: this.transitionManager },
                { name: 'powerUpSystem', ref: this.powerUpSystem },
                { name: 'lootSystem', ref: this.lootSystem },
                { name: 'projectileSystem', ref: this.projectileSystem },
                { name: 'vfxSystem', ref: this.vfxSystem },
                { name: 'audioSystem', ref: this.audioSystem },
                { name: 'keyboardManager', ref: this.keyboardManager },
                { name: 'armorShieldEffect', ref: this.armorShieldEffect },
                { name: 'playerShieldEffect', ref: this.playerShieldEffect },
                { name: 'debugOverlay', ref: this.debugOverlay },
                { name: 'telemetryLogger', ref: this.telemetryLogger, method: 'destroy' },
                { name: 'graphicsFactory', ref: this.graphicsFactory },
                { name: 'enemyManager', ref: this.enemyManager },
            ];
            
            for (const { name, ref, method } of systemsToShutdown) {
                if (!ref) continue;
                try {
                    const fn = method || (typeof ref.shutdown === 'function' ? 'shutdown' : 'destroy');
                    if (typeof ref[fn] === 'function') ref[fn]();
                } catch (e) {
                    DebugLogger.warn('game', `[GameScene] Error shutting down ${name}:`, e);
                }
            }

            // Clean up CentralEventBus listeners (cross-scene events)
            centralEventBus.removeAllListeners(this);
            try {
                if (this._resizeHandler) this.scale.off('resize', this._resizeHandler);
            } catch (_) {}
            if (this.mobileControls?.enabled) try { this.mobileControls.disable(); } catch (_) {}

            // Kill remaining tweens/timers AFTER systems had chance to clean up
            try { this.tweens?.killAll(); } catch (_) {}
            try { this.time?.removeAllEvents(); } catch (_) {}

            // Nullify references
            const refs = ['player','spawnDirector','projectileSystem','lootSystem','powerUpSystem',
                'vfxSystem','audioSystem','keyboardManager','updateManager',
                'transitionManager','enemiesGroup','bossGroup','debugOverlay','telemetryLogger',
                'graphicsFactory','targetingSystem','mobileControls','frameworkDebug',
                'blueprintLoader','uiLayer','enemyManager'];
            for (const k of refs) this[k] = null;

            DebugLogger.info('game', '[GameScene] Shutdown sequence completed successfully');

        } catch (e) {
            console.error('[GameScene] Critical error during shutdown:', e);
        }
        // NOTE: Do NOT call super.shutdown() here — Phaser calls it automatically
        // via the SHUTDOWN lifecycle event. Calling it from within that event
        // corrupts the listener dispatch mid-iteration.
    }
}

/**
 * Overflow boosts — shown when ALL powerups are at max level.
 * These are stackable infinite stat bonuses that keep progression meaningful.
 * Applied as direct stat modifiers (no max level cap).
 */
GameScene.OVERFLOW_BOOSTS = [
    { id: 'overflow.damage', name: 'Posílená cytotoxicita', description: 'Permanentně zvyšuje poškození všech útoků.', stats: '+5 DMG', rarity: 'common', icon: 'damage', level: 0, maxLevel: 0, _overflow: { stat: 'projectileDamage', type: 'add', value: 5 } },
    { id: 'overflow.hp', name: 'Buněčná regenerace', description: 'Permanentně zvyšuje maximální zdraví.', stats: '+15 HP', rarity: 'common', icon: 'health', level: 0, maxLevel: 0, _overflow: { stat: 'maxHp', type: 'add', value: 15 } },
    { id: 'overflow.speed', name: 'Metabolický impuls', description: 'Permanentně zrychluje pohyb a útok.', stats: '+5% rychlost', rarity: 'common', icon: 'speed', level: 0, maxLevel: 0, _overflow: { stat: 'moveSpeed', type: 'mul', value: 0.05 } },
];