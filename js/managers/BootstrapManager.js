/**
 * BootstrapManager - Orchestrates GameScene.create() initialization
 * PR7 compliant - systematic initialization in clear phases
 * Delegates system creation to SystemsInitializer
 */

import { Player } from '../entities/Player.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
import { SystemsInitializer } from './SystemsInitializer.js';
import { centralEventBus } from '../core/events/CentralEventBus.js';
import { getSession } from '../core/debug/SessionLog.js';
import { DisplayResolver } from '../core/utils/DisplayResolver.js';

export class BootstrapManager {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Setup world physics and depth layers
     */
    setupWorldAndDepth() {
        // Setup world bounds using interface method
        const scale = this.scene.getScaleManager();
        this.scene.setWorldBounds(0, 0, scale.width, scale.height);
        
        // Define depth layers
        this.scene.DEPTH_LAYERS = {
            BACKGROUND: 0,
            LOOT: 500,
            ENEMIES: 1000,
            BOSSES: 1100,
            PLAYER: 2000,
            PROJECTILES: 3000,
            VFX: 4000,
            UI_BASE: 10000,
            UI_MODAL: 20000
        };
        
        // Store main camera reference
        this.scene.mainCam = this.scene.getMainCamera();
        this.scene.mainCam.setName('MainCamera');
        
        // Create UI layer (BootstrapManager is allowed Phaser API for setup)
        const uiLayer = this.scene.add.layer();
        uiLayer.setDepth(this.scene.DEPTH_LAYERS?.UI_BASE || 10000);
        this.scene.uiLayer = uiLayer;
        
        DebugLogger.info('bootstrap', '✅ Depth-based rendering system initialized');
    }

    /**
     * Setup UI components
     */
    initializeUI() {
        // Launch UI overlay scene using interface method
        this.scene.launchUIScene('GameUIScene');

        // Connect HUD after GameUIScene.create() runs (scene.launch is async)
        const uiScene = this.scene.scene.get('GameUIScene');
        if (uiScene) {
            // If HUD already created (scene was already running), connect immediately
            if (uiScene.hud) {
                uiScene.connectToGameScene(this.scene);
            } else {
                // Wait for create() to finish, then connect
                uiScene.events.once('create', () => {
                    uiScene.connectToGameScene(this.scene);
                });
            }
        }
    }

    /**
     * Register all event listeners
     */
    registerEventListeners() {
        // Store bound handlers so we can remove them in shutdown
        this._onPlayerDie = (data) => {
            DebugLogger.info('bootstrap', '[GameScene] Player died, triggering game over');
            this.scene.gameOver();
        };
        this._onBossDie = (data) => {
            // Skip if game is paused (e.g. powerup selection) or already transitioning
            if (this.scene.isPaused || this.scene.transitionManager?.isTransitioning) {
                DebugLogger.info('bootstrap', '[GameScene] Boss died during pause — deferring transition');
                // Defer until next resume
                this._pendingBossTransition = true;
                return;
            }
            DebugLogger.info('bootstrap', '[GameScene] Boss defeated! Transition to next level...');
            this.scene.transitionToNextLevel().catch(err => {
                DebugLogger.error('bootstrap', '[GameScene] Level transition failed:', err);
            });
        };
        this._onResume = () => {
            // Do nothing after game over — prevents resume from re-triggering levelup/XP loops
            if (this.scene.isGameOver) return;
            DebugLogger.info('bootstrap', '[GameScene] Scene resumed');
            this.ensurePlayerActive();
            this.scene.isPaused = false;

            // Reset timers for all systems after pause (consolidated — no separate listener needed)
            if (this.scene.player?.resetTimersAfterPause) {
                this.scene.player.resetTimersAfterPause();
            }
            const enemies = this.scene.enemiesGroup?.getChildren();
            if (enemies) {
                for (let i = enemies.length - 1; i >= 0; i--) {
                    enemies[i]?.behaviors?.resetTimersAfterPause?.();
                }
            }
            const bosses = this.scene.bossGroup?.getChildren();
            if (bosses) {
                for (let i = bosses.length - 1; i >= 0; i--) {
                    bosses[i]?.behaviors?.resetTimersAfterPause?.();
                }
            }
            this.scene.spawnDirector?.resetTimersAfterPause?.();
            this.scene.powerUpSystem?.resetTimersAfterPause?.();

            // Handle deferred boss transition (boss died during pause)
            if (this._pendingBossTransition) {
                this._pendingBossTransition = false;
                setTimeout(() => {
                    this.scene.transitionToNextLevel?.().catch(() => {});
                }, 100);
                return; // Don't flush XP — transition will handle everything
            }

            // Flush excess XP on next frame — setTimeout (immune to scene timer state)
            if (this.scene.progressionSystem?._pendingXP > 0) {
                setTimeout(() => {
                    this.scene.progressionSystem?.flushPendingXP?.();
                }, 1);
            }
        };
        this._onPowerUpSelected = (selection) => {
            this.handlePowerUpSelection(selection);
        };

        // Scene-level events (auto-cleaned by Phaser on scene shutdown)
        this.scene.events.on('player:die', this._onPlayerDie, this.scene);
        this.scene.events.on('boss:die', this._onBossDie, this.scene);
        this.scene.events.on('resume', this._onResume, this.scene);

        // Cross-scene events via CentralEventBus (auto-cleanup via context)
        this._onRetry = () => { if (!this.scene._shutdownDone) this.scene.restartGame(); };
        this._onMainMenu = () => { if (!this.scene._shutdownDone) this.scene.returnToMenu(); };
        centralEventBus.on('game:powerup-selected', this._onPowerUpSelected, this.scene);
        centralEventBus.on('game:retry', this._onRetry, this.scene);
        centralEventBus.on('game:main-menu', this._onMainMenu, this.scene);

        // Resize event (game-level — tracked for cleanup in GameScene.shutdown)
        const scale = this.scene.getScaleManager();
        // Remove old handler first to prevent leak on scene restart (bind creates new fn each time)
        if (this.scene._resizeHandler) {
            scale.off('resize', this.scene._resizeHandler);
        }
        this.scene._resizeHandler = this.scene.handleResize.bind(this.scene);
        scale.on('resize', this.scene._resizeHandler);
    }

    /**
     * Handle power-up selection
     */
    /**
     * Handle power-up selection from UI.
     * Delegates powerup application to PowerUpSystem, handles resume logic here.
     */
    handlePowerUpSelection(selection) {
        // Delegate powerup application + HUD notification to PowerUpSystem
        if (this.scene.powerUpSystem) {
            this.scene.powerUpSystem.handleSelection(selection);
        }

        // Resume game state (orchestration — belongs in BootstrapManager)
        this.ensurePlayerActive();
        this.scene.isPaused = false;
        this.scene.projectileSystem?.resumeAll();

        // Flush pending XP accumulated during pause
        const ps = this.scene.progressionSystem;
        if (ps && ps.getPendingXP() > 0) {
            const xpToAdd = ps.clearPendingXP();
            this.scene.addDelayedCall(100, () => this.scene.addXP(xpToAdd));
        }
    }

    /**
     * Ensure player is active and visible
     */
    ensurePlayerActive() {
        if (this.scene.player && this.scene.player.hp > 0) {
            if (!this.scene.player.active || !this.scene.player.visible) {
                DebugLogger.warn('bootstrap', '[GameScene] Player was inactive - reactivating!');
                this.scene.player.active = true;
                this.scene.player.visible = true;
                if (this.scene.player.body) {
                    this.scene.player.body.enable = true;
                }
            }
        }
    }

    /**
     * Setup development tools
     */
    async setupDevTools() {
        const isDev = window.DEV_MODE === true ||
                      window.location.search.includes('debug=true');

        if (isDev) {
            try {
                const { DevConsole } = await import('../core/dev/DevConsole.js');
                const devConsole = DevConsole.getInstance();
                devConsole.attachScene(this.scene);
                // Auto-cleanup on scene shutdown
                this.scene.events.once('shutdown', () => devConsole.detachScene());
            } catch (e) {
                DebugLogger.warn('dev', '[DevConsole] Failed to load:', e);
            }
        }
    }

    /**
     * Start game timer
     */
    startGameTimer() {
        // Store reference for resilient cleanup (not just removeAllEvents)
        this.scene._gameTimerEvent = this.scene.addTimeEvent({
            delay: 1000,
            callback: this.scene.updateTime,
            callbackScope: this.scene,
            loop: true
        });
    }

    /**
     * Get player blueprint from loader or use fallback
     */
    getPlayerBlueprint() {
        // PR7: Load player blueprint from BlueprintLoader
        if (this.scene.blueprintLoader) {
            const playerBlueprint = this.scene.blueprintLoader.get('player');
            if (playerBlueprint) {
                DebugLogger.info('general', '[BootstrapManager] Loaded player blueprint');
                
                // Ensure display section exists
                const textureKey = playerBlueprint.visuals?.textureKey || 'player';
                if (!playerBlueprint.display) {
                    playerBlueprint.display = {
                        texture: textureKey,
                        frame: 0,
                        tint: playerBlueprint.visuals?.tint || 0x4169E1
                    };
                }
                
                return playerBlueprint;
            }
        }
        
        // Emergency fallback - should not happen in production
        DebugLogger.error('general', '[BootstrapManager] CRITICAL: Player blueprint not found!');
        return this.createFallbackBlueprint();
    }

    /** Create emergency fallback blueprint */
    createFallbackBlueprint() {
        const CR = window.ConfigResolver;
        const hp = CR?.get('player.stats.hp', { defaultValue: 100 }) || 100;
        const speed = CR?.get('player.stats.speed', { defaultValue: 135 }) || 135;
        const damage = CR?.get('player.attack.damage', { defaultValue: 10 }) || 10;
        const projSpeed = CR?.get('mechanics.projectile.stats.speed', { defaultValue: 300 }) || 300;
        const projRange = CR?.get('mechanics.projectile.stats.range', { defaultValue: 600 }) || 600;
        const intervalMs = CR?.get('mechanics.attack.intervalMs', { defaultValue: 1000 }) || 1000;
        return {
            id: 'player_emergency', type: 'player',
            display: { texture: 'player', frame: 0, tint: 0x4169E1 },
            stats: { hp, speed, size: 24 },
            mechanics: {
                attack: { intervalMs },
                projectile: { ref: 'projectile.player_basic', count: 1, spreadDeg: 15,
                    stats: { damage, speed: projSpeed, range: projRange } },
                crit: { chance: 0.05, multiplier: 2 },
                iFrames: { ms: 1000 }
            },
            vfx: { spawn: 'vfx.player.spawn', hit: 'vfx.player.hit', death: 'vfx.player.death',
                shoot: 'vfx.weapon.muzzle', heal: 'vfx.player.heal' },
            sfx: { spawn: 'sfx.player.spawn', hit: 'sfx.player.hit', death: 'sfx.player.death',
                shoot: 'sfx.player.shoot', heal: 'sfx.player.heal' }
        };
    }

    /**
     * Initialize all data-driven systems via SystemsInitializer
     */
    async initializeDataDrivenSystems() {
        this.systemsInitializer = new SystemsInitializer(this.scene);
        await this.systemsInitializer.initializeAll();

        // Additional scene-specific setup
        this.scene.currentLevel = 1;
        this.scene.maxLevel = 7;

        // Initialize debug and telemetry if in dev mode
        if (window.DEV_MODE || window.location.search.includes('debug=true')) {
            if (this.scene.initializeDebugSystems) {
                this.scene.initializeDebugSystems();
            }
        }
    }

    /**
     * Main bootstrap method - orchestrates all initialization
     */
    async bootstrap() {
        DebugLogger.info('bootstrap', '🎮 GameScene starting - DATA-DRIVEN MODE ONLY');
        
        // Phase 1: Core setup
        this.setupWorldAndDepth();
        
        // Phase 2: Input (must be before player)
        this.scene.setupInput();
        
        // Phase 2.5: Load i18n display resolver
        try {
            this.scene.displayResolver = new DisplayResolver();
            await this.scene.displayResolver.load('cs');
        } catch (_) {
            DebugLogger.warn('bootstrap', 'DisplayResolver load failed — using fallback names');
        }

        // Phase 3: Data systems (must be before player)
        try {
            await this.initializeDataDrivenSystems();
        } catch (error) {
            DebugLogger.error('bootstrap', '❌ CRITICAL: Data-driven systems failed:', error);
            this.scene.showCriticalError('Blueprint Systems Failed', error.message);
            throw error; // Propagate to stop initialization
        }
        
        // Phase 4: Player creation - now using internal method
        const playerBlueprint = this.getPlayerBlueprint();
        if (!playerBlueprint) {
            throw new Error('[BootstrapManager] Failed to get player blueprint');
        }

        // Create player instance using ES6 module import
        const scale = this.scene.getScaleManager();
        this.scene.player = new Player(
            this.scene, 
            scale.width / 2, 
            scale.height / 2, 
            playerBlueprint
        );

        // Set proper depth layer
        this.scene.player.setDepth(this.scene.DEPTH_LAYERS?.PLAYER ?? 2000);

        // Wire input
        this.scene.player.setInputKeys(this.scene.inputKeys);

        // Track in DisposableRegistry for proper cleanup
        if (this.scene.disposables) {
            this.scene.disposables.add(this.scene.player);
        }

        // Phase 5: UI
        this.initializeUI();
        
        // Phase 7: Events
        this.registerEventListeners();
        
        // Phase 8: Physics World activation + Collisions
        // CRITICAL FIX: Activate physics world before setting up collisions
        if (this.scene.physics) {
            // Use interface method for physics activation
            this.scene.resumePhysics();
            DebugLogger.info('bootstrap', '✅ Physics world activated');
        }
        
        const colliders = this.scene.setupCollisions();
        // Register colliders for cleanup via scene._colliders (used by GameScene.shutdown)
        if (colliders && colliders.length > 0 && this.scene.disposables) {
            colliders.forEach(collider => this.scene.disposables.add(collider));
            DebugLogger.info('bootstrap', `[BootstrapManager] Registered ${colliders.length} colliders for cleanup`);
        }
        
        // Phase 9: Update systems
        this.scene.initializeUpdateManager();
        this.scene.initializeTransitionManager();
        
        // Phase 10: Start game
        await this.scene.startGame();
        
        // Phase 11: Dev tools
        await this.setupDevTools();
        
        // Phase 12: Timer
        this.startGameTimer();
        
        DebugLogger.info('bootstrap', '✅ Bootstrap complete');
    }
}

