import { Player } from '../entities/Player.js';
import { startSession, getSession } from '../core/debug/SessionLog.js';
import { Boss } from '../entities/Boss.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
import { UnifiedHUD } from '../ui/UnifiedHUD.js';
import { MobileControlsSystem } from '../core/systems/MobileControlsSystem.js';
import { SimpleLootSystem } from '../core/systems/SimpleLootSystem.js';
import { EventBus } from '../core/events/EventBus.js';
import { TelemetryLogger } from '../core/TelemetryLogger.js';
import { DebugOverlay } from '../utils/DebugOverlay.js';
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
        this.unifiedHUD = null;
        this.mobileControls = null;

        // Systems (assigned in create/bootstrap)
        this.analyticsManager = null;
        this.musicManager = null;
        this.blueprintLoader = null;
        this.spawnDirector = null;
        this.frameworkDebug = null;
        this.projectileSystem = null;
        this.lootSystem = null;
        this.powerUpSystem = null;
        this.vfxSystem = null;
        this.audioSystem = null;

        // Game stats (XP base from ConfigResolver)
        const CR = window.ConfigResolver;
        const xpBase = CR ? CR.get('progression.xp.baseRequirement', { defaultValue: 8 }) : 8;
        this.gameStats = {
            level: 1, xp: 0, xpToNext: xpBase, score: 0,
            enemiesKilled: 0, kills: 0, time: 0,
            bossesDefeated: 0, powerUpsCollected: 0
        };

        // Timing & state
        this.sceneTimeSec = 0;
        this._lastTimeUi = 0;
        this.isPaused = false;
        this.isGameOver = false;
        this.powerUps = [];
        this.levelStartTime = 0;
        this.highScoreModal = null;

        this.configResolver = window.ConfigResolver;
        this.eventBus = new EventBus();
        this.keyboardManager = null;
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

    _preloadAllAudio() {
        this.load.json('audio_manifest', '/data/generated/audio_manifest.json');
        this.load.on('filecomplete-json-audio_manifest', (key, type, data) => {
            if (!data?.audio) {
                DebugLogger.error('bootstrap', '[AudioPreload] Invalid or missing audio manifest!');
                return;
            }
            let loadedCount = 0;
            DebugLogger.info('bootstrap', `[AudioPreload] Loading ${data.audio.length} files from manifest v${data.version}`);
            data.audio.forEach(path => {
                const k = path.replace(/[^a-zA-Z0-9]/g, '_');
                if (!this.cache.audio.has(k)) { this.load.audio(k, path); loadedCount++; }
            });
            DebugLogger.info('bootstrap', `[AudioPreload] Prepared ${loadedCount} audio files`);
        });
    }

    async create() {
        // Initialize DisposableRegistry for cleanup
        this.disposables = new DisposableRegistry();
        
        // Complete BlueprintLoader initialization (async)
        await this._initializeBlueprintLoader();
        
        // Reset shutdown guard for potential scene restart
        this._shutdownDone = false;

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
    
    initializeDebugSystems() {
        try {
            // Telemetry logger
            this.telemetryLogger = new TelemetryLogger(this);
            
            // Debug overlay (F3 to toggle via KeyboardManager)
            if (!this.debugOverlay) {
                this.debugOverlay = new DebugOverlay(this);
            }
            
        } catch (error) {
            DebugLogger.warn('game', 'Debug systems init failed:', error);
        }
    }

    showCriticalError(title, message) {
        // Delegate to UI scene
        const uiScene = this.scene.get('GameUIScene');
        if (uiScene?.events) {
            uiScene.events.emit('show-error', { title, message });
        } else {
            DebugLogger.error('game', '[GameScene] Critical error:', title, message);
        }
    }
    
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
    
    setupCollisions() { return setupCollisions(this); }

    initializeUpdateManager() {
        this.updateManager = new UpdateManager(this);
        this.updateManager.registerGameSceneTasks(this);
    }

    initializeTransitionManager() {
        this.transitionManager = new TransitionManager(this);
    }

    spawnDrop(itemId, x, y) {
        if (!this.lootSystem || !itemId) return;
        
        // Get item blueprint
        const itemBlueprint = this.blueprintLoader?.get(itemId);
        if (!itemBlueprint) {
            DebugLogger.warn('game', `[GameScene] Item blueprint not found: ${itemId}`);
            return;
        }
        
        // PR7: Use LootSystem to create the drop (single source of truth)
        this.lootSystem.createItemDrop(x, y, itemBlueprint);
    }
    
    /** Create XP orbs based on XP amount (tiered: small=1, medium=5, large=10) */
    createXPOrbs(x, y, totalXP) {
        if (!totalXP || totalXP <= 0 || !this.lootSystem) return;

        const largeOrbs = Math.floor(totalXP / 10);
        const remaining = totalXP % 10;
        const mediumOrbs = Math.floor(remaining / 5);
        const smallOrbs = remaining % 5;

        const spawn = (count, itemId) => {
            for (let i = 0; i < count; i++) {
                const ox = (Math.random() - 0.5) * 30;
                const oy = (Math.random() - 0.5) * 30;
                this.lootSystem.createDrop(x + ox, y + oy, itemId);
            }
        };

        spawn(largeOrbs, 'item.xp_large');
        spawn(mediumOrbs, 'item.xp_medium');
        spawn(smallOrbs, 'item.xp_small');
    }
    
    /**
     * Kill all enemies (for special items)
     */
    killAllEnemies() {
        // Delegate to EnemyManager (single source of truth for enemy operations)
        if (this.enemyManager) {
            this.enemyManager.killAll();
        }
        this.flashCamera();
    }
    
    async startGame() {
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
    
    handleMetotrexatPickup() {
        DebugLogger.info('general', '[GameScene] METOTREXAT! Eliminating all enemies!');

        // Flash effect
        this.flashCamera();

        // Delegate to EnemyManager (single source of truth for enemy operations)
        if (this.enemyManager) this.enemyManager.killAll();

        // Play metotrexat SFX
        if (this.audioSystem) {
            const blueprint = this.blueprintLoader?.getBlueprint('powerup.metotrexat');
            const pickupSFX = blueprint?.sfx?.pickup;
            if (pickupSFX) {
                this.audioSystem.play(pickupSFX);
            }
        }
    }
    
    spawnLootDrop(drop, x, y) {
        const dropId = drop?.itemId || drop?.ref;
        if (!dropId) return;
        if (this.lootSystem) {
            this.lootSystem.createDrop(x, y, dropId, { amount: drop.quantity || drop.qty || 1 });
        }
    }

    attractXPOrb(orb) {
        if (!orb?.active || !this.player?.active) return;
        if (this.lootSystem) {
            this.lootSystem.animateAttraction(orb, this.player, () => {
                if (orb?.active) { this.addXP(orb.xpAmount); orb.destroy(); }
            });
        }
    }

    addXP(amount) { this.progressionSystem?.addXP(amount); }

    setPaused(paused) {
        this.isPaused = paused;
        if (paused) {
            this.projectileSystem?.pauseAll();
            DebugLogger.info('game', 'Game paused');
        } else {
            this.projectileSystem?.resumeAll();
            DebugLogger.info('game', 'Game resumed');
        }
    }


    /** Get power-up options for level-up selection */
    getPowerUpOptions() {
        if (this.powerUpSystem && typeof this.powerUpSystem.generatePowerUpOptions === 'function') {
            const options = this.powerUpSystem.generatePowerUpOptions();
            if (options && options.length > 0) return options;
        }
        // Fallback when PowerUpSystem is unavailable
        return GameScene.FALLBACK_POWERUPS;
    }


    levelUp() {
        this._session?.log('game', 'level_up', { level: this.gameStats.level, time: Math.floor(this.sceneTimeSec) });
        // Heal from config (default 20) — no hardcoded magic number
        const healAmount = window.ConfigResolver?.get('progression.levelUpHeal', { defaultValue: 20 }) ?? 20;
        this.player.heal(healAmount);
        const options = this.getPowerUpOptions();
        DebugLogger.info('game', '[GameScene] Emitting game-levelup event');
        this.game.events.emit('game-levelup', options);
        this.flashCamera();
        if (this.analyticsManager?.trackEvent) {
            const elapsed = this.time?.now ? Math.floor((this.time.now - this.levelStartTime) / 1000) : 0;
            this.analyticsManager.trackEvent('level_up', { level: this.gameStats.level, time: elapsed });
        }
    }

    async gameOver() {
        try { getSession()?.end?.('death'); } catch (_) {}
        if (this.transitionManager) await this.transitionManager.gameOver();
    }

    async transitionToNextLevel() {
        if (this.currentLevel >= this.maxLevel) {
            DebugLogger.info('game', 'All levels completed - victory!');
            this.showVictory();
            return;
        }
        if (this.transitionManager) {
            await this.transitionManager.transitionToNextLevel(this.currentLevel + 1);
        }
    }

    async showVictory() {
        if (this.transitionManager) await this.transitionManager.showVictory();
    }

    updateTime() {
        if (!this.isPaused && !this.isGameOver) {
            this.gameStats.time++;
        }
    }
    
    handleResize(gameSize) {
        const { width, height } = gameSize;
        this.mainCam?.setSize(width, height);
        this.uiCam?.setSize(width, height);
        this.unifiedHUD?.onResize?.(width, height);
        this.pauseMenu?.onResize?.(width, height);
        if (this.mobileControls?.enabled) this.mobileControls.handleResize(width, height);
    }
    
    // ========== PR7 Phaser API Interface Methods ==========
    // Controlled access to Phaser API for managers

    pausePhysics() { this.physics?.world?.pause(); }
    resumePhysics() { this.physics?.world?.resume(); }
    pauseTime() { if (this.time) this.time.paused = true; }
    resumeTime() { if (this.time) this.time.paused = false; }
    setWorldBounds(x, y, w, h) { this.physics?.world?.setBounds(x, y, w, h); }
    createUILayer(depth) { const a = this['add']; const l = a.layer(); l.setDepth(depth); this.uiLayer = l; return l; } // PR7 interface method
    launchUIScene(key) { this.scene.launch(key); }
    addTimeEvent(config) { return this.time.addEvent(config); }
    addDelayedCall(delay, cb, args, scope) { return this.time.delayedCall(delay, cb, args, scope); }
    getMainCamera() { return this.cameras.main; }
    flashCamera(duration = 500, r = 255, g = 255, b = 0) { this.cameras.main.flash(duration, r, g, b); }
    shakeCamera(duration = 300, intensity = 0.02) { this.cameras.main.shake(duration, intensity); }
    getScaleManager() { return this.scale; }
    restartScene() { this.scene.restart(); }
    
    findNearestEnemy() {
        if (!this.player || !this.enemiesGroup) return null;
        const { x: px, y: py } = this.player;
        let closest = null, bestDist = Infinity;
        for (const enemy of this.enemiesGroup.getChildren()) {
            if (!enemy.active) continue;
            const d = (px - enemy.x) ** 2 + (py - enemy.y) ** 2;
            if (d < bestDist) { bestDist = d; closest = enemy; }
        }
        return closest;
    }

    _cleanupForTransition() {
        if (this.player && !this.player.active) this.player = null;
        if (this.enemiesGroup) this.enemiesGroup.clear(true, true);
        if (this.bossGroup) this.bossGroup.clear(true, true);
        if (this.audioSystem) this.audioSystem.stopAll();
    }

    restartGame() {
        this._cleanupForTransition();
        // Reset analytics for fresh session on restart
        if (this.analyticsManager) {
            try { this.analyticsManager.shutdown(); } catch (_) {}
        }
        this.scene.stop('GameUIScene');
        this.scene.restart();
    }

    returnToMenu() {
        this._cleanupForTransition();
        this.scene.stop('GameUIScene');
        this.scene.start('MainMenu');
    }

    shutdown() {
        if (this._shutdownDone) return;
        this._shutdownDone = true;
        DebugLogger.info('game', '[GameScene] Starting shutdown sequence...');

        try {
            this.spawnDirector?.stop?.();
            this.projectileSystem?.clearAllProjectiles?.();
            try { this.enemiesGroup?.clear(true, true); } catch (_) {}
            try { this.bossGroup?.clear(true, true); } catch (_) {}
            try { this.physics?.pause(); } catch (_) {}
            try { this.tweens?.killAll(); } catch (_) {}
            try { this.time?.removeAllEvents(); } catch (_) {}

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
                { name: 'analyticsManager', ref: this.analyticsManager },
                { name: 'armorShieldEffect', ref: this.armorShieldEffect },
                { name: 'playerShieldEffect', ref: this.playerShieldEffect },
                { name: 'debugOverlay', ref: this.debugOverlay },
                { name: 'telemetryLogger', ref: this.telemetryLogger, method: 'destroy' },
                { name: 'unifiedHUD', ref: this.unifiedHUD },
                { name: 'graphicsFactory', ref: this.graphicsFactory },
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

            // Clean up game-level event listeners
            this._bootstrapGameListeners?.forEach(({ event, fn }) => this.game.events.off(event, fn));
            this._bootstrapGameListeners = null;
            try { this.scale.off('resize', this.handleResize, this); } catch (_) {}
            if (this.mobileControls?.enabled) try { this.mobileControls.disable(); } catch (_) {}

            // Nullify references
            const refs = ['player','spawnDirector','projectileSystem','lootSystem','powerUpSystem',
                'vfxSystem','audioSystem','keyboardManager','analyticsManager','updateManager',
                'transitionManager','enemiesGroup','bossGroup','debugOverlay','telemetryLogger',
                'unifiedHUD','graphicsFactory','targetingSystem','mobileControls','frameworkDebug',
                'blueprintLoader','uiLayer','enemies'];
            for (const k of refs) this[k] = null;

            DebugLogger.info('game', '[GameScene] Shutdown sequence completed successfully');
            
        } catch (e) {
            console.error('[GameScene] Critical error during shutdown:', e);
        }
    }
}

/** Fallback power-up options when PowerUpSystem is unavailable */
GameScene.FALLBACK_POWERUPS = [
    { id: 'powerup.damage_boost', name: 'Cytotoxická terapie', description: 'Zvyšuje účinnost léčby proti rakovinným buňkám.', stats: '+5 DMG', rarity: 'common', icon: 'damage', level: 0 },
    { id: 'powerup.metabolic_haste', name: 'Metabolický boost', description: 'Urychluje metabolismus pro rychlejší pohyb a reakce.', stats: '+8% SPD', rarity: 'common', icon: 'speed', level: 0 },
    { id: 'powerup.shield', name: 'Ochranný štít', description: 'Vytváří ochranný štít, který blokuje poškození.', stats: '3 hity', rarity: 'uncommon', icon: 'shield', level: 0 }
];