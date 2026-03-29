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
            EFFECTS: 4000,
            UI_BASE: 10000,
            UI_MODAL: 20000
        };
        
        // Store main camera reference
        this.scene.mainCam = this.scene.getMainCamera();
        this.scene.mainCam.setName('MainCamera');
        
        // Create UI layer via GameScene interface (no direct Phaser API in managers)
        this.scene.createUILayer(this.scene.DEPTH_LAYERS?.UI_BASE || 10000);
        
        DebugLogger.info('bootstrap', '✅ Depth-based rendering system initialized');
    }

    /**
     * Initialize analytics and score managers
     */
    initializeManagers() {
        // High score managers
        const { HighScoreManager } = window;
        const { GlobalHighScoreManager } = window;
        
        if (HighScoreManager) {
            this.scene.highScoreManager = new HighScoreManager();
        }
        
        if (GlobalHighScoreManager) {
            this.scene.globalHighScoreManager = new GlobalHighScoreManager();
        }
        
        // Analytics manager
        try {
            const { AnalyticsManager } = window;
            if (AnalyticsManager) {
                const supabaseClient = this.scene.globalHighScoreManager?.supabase || null;
                this.scene.analyticsManager = new AnalyticsManager(supabaseClient);
            }
        } catch (error) {
            DebugLogger.warn('bootstrap', '⚠️ Analytics manager init failed (silenced):', error.message);
            this.scene.analyticsManager = null;
        }
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
            DebugLogger.info('bootstrap', '[GameScene] Boss defeated! Seamless transition to next level...');
            this.scene.transitionToNextLevel().catch(err => {
                DebugLogger.error('bootstrap', '[GameScene] Level transition failed:', err);
            });
        };
        this._onResume = () => {
            DebugLogger.info('bootstrap', '[GameScene] Scene resumed');
            this.ensurePlayerActive();
            this.scene.isPaused = false;

            // Reset timers for all systems after pause (consolidated — no separate listener needed)
            if (this.scene.player?.resetTimersAfterPause) {
                this.scene.player.resetTimersAfterPause();
            }
            this.scene.enemiesGroup?.getChildren().forEach(e => {
                e.behaviors?.resetTimersAfterPause?.();
            });
            this.scene.bossGroup?.getChildren().forEach(b => {
                b.behaviors?.resetTimersAfterPause?.();
            });
            this.scene.spawnDirector?.resetTimersAfterPause?.();
            this.scene.powerUpSystem?.resetTimersAfterPause?.();
        };
        this._onPowerUpSelected = (selection) => {
            this.handlePowerUpSelection(selection);
        };

        // Scene-level events (auto-cleaned by Phaser on scene shutdown)
        this.scene.events.on('player:die', this._onPlayerDie);
        this.scene.events.on('boss:die', this._onBossDie);
        this.scene.events.on('resume', this._onResume);

        // Cross-scene event via CentralEventBus (auto-cleanup via context)
        centralEventBus.on('game:powerup-selected', this._onPowerUpSelected, this.scene);

        // Resize event (game-level — tracked for cleanup in GameScene.shutdown)
        const scale = this.scene.getScaleManager();
        this.scene._resizeHandler = this.scene.handleResize.bind(this.scene);
        scale.on('resize', this.scene._resizeHandler);
    }

    /**
     * Handle power-up selection
     */
    handlePowerUpSelection(selection) {
        DebugLogger.info('bootstrap', '[GameScene] Received powerup-selected event:', selection);
        
        // Apply the selected power-up (or overflow boost if all maxed)
        if (selection?._overflow && this.scene.player) {
            // Overflow boost — direct stat modification (no powerup system involved)
            const ov = selection._overflow;
            const player = this.scene.player;
            if (ov.type === 'add') {
                if (ov.stat === 'maxHp') {
                    player.maxHp = (player.maxHp || 100) + ov.value;
                    player.hp = Math.min(player.hp + ov.value, player.maxHp);
                } else {
                    player.addModifier({ id: `overflow_${Date.now()}`, stat: ov.stat, type: 'add', value: ov.value });
                }
            } else if (ov.type === 'mul') {
                player.addModifier({ id: `overflow_${Date.now()}`, stat: ov.stat, type: 'mul', value: ov.value });
            }
            getSession()?.log('powerup', 'overflow_boost', { stat: ov.stat, value: ov.value });
        } else if (selection && this.scene.powerUpSystem) {
            this.scene.powerUpSystem.applyPowerUp(selection.id, (selection.level || 0) + 1);
        }
        
        // Ensure player is still active
        this.ensurePlayerActive();
        
        // Mark game as resumed
        this.scene.isPaused = false;
        
        // Resume projectiles
        if (this.scene.projectileSystem) {
            this.scene.projectileSystem.resumeAll();
        }
        
        // Process pending XP via ProgressionSystem
        const ps = this.scene.progressionSystem;
        if (ps && ps.getPendingXP() > 0) {
            const xpToAdd = ps.clearPendingXP();
            this.scene.addDelayedCall(100, () => {
                this.scene.addXP(xpToAdd);
            });
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
        return {
            id: 'player_emergency', type: 'player',
            display: { texture: 'player', frame: 0, tint: 0x4169E1 },
            stats: { hp, speed, size: 24 },
            mechanics: {
                attack: { intervalMs: 1000 },
                projectile: { ref: 'projectile.player_basic', count: 1, spreadDeg: 15,
                    stats: { damage, speed: 300, range: 600 } },
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
        this.scene.player.setDepth(this.scene.DEPTH_LAYERS?.PLAYER ?? 1500);

        // Wire input
        this.scene.player.setInputKeys(this.scene.inputKeys);

        // Track in DisposableRegistry for proper cleanup
        if (this.scene.disposables) {
            this.scene.disposables.add(this.scene.player);
        }

        // Phase 5: Managers
        this.initializeManagers();
        
        // Phase 6: UI
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

