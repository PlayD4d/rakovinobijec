/**
 * BootstrapManager - Simplifies GameScene.create() initialization
 * PR7 compliant - systematic initialization in clear phases
 * 
 * Extracts initialization logic from GameScene to reduce LOC
 * and improve maintainability
 */

import { Player } from '../entities/Player.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
import { UnifiedHUD } from '../ui/UnifiedHUD.js';
import { EnemyManager } from './EnemyManager.js';
import { ProjectileSystem } from '../core/systems/ProjectileSystem.js';
import { TargetingSystem } from '../core/systems/TargetingSystem.js';
import { PowerUpSystem } from '../core/systems/powerup/PowerUpSystem.js';
import { GraphicsFactory } from '../core/graphics/GraphicsFactory.js';
import { SpawnDirector } from '../core/spawn/SpawnDirector.js';

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
        
        // Create UI layer (Phaser API call lives in BootstrapManager, not GameScene)
        const uiLayer = this.scene.add.layer();
        uiLayer.setDepth(this.scene.DEPTH_LAYERS?.UI_BASE || 10000);
        this.scene.setUILayer(uiLayer);
        
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
        // Create HUD using imported class (ES6 module)
        this.scene.unifiedHUD = new UnifiedHUD(this.scene);
        
        // Launch UI overlay scene using interface method
        this.scene.launchUIScene('GameUIScene');
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
        this._onBossDie = async (data) => {
            DebugLogger.info('bootstrap', '[GameScene] Boss defeated! Transitioning to next level...');
            await this.scene.transitionToNextLevel();
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

        // Game-level event — must be manually cleaned up!
        this.scene.game.events.on('powerup-selected', this._onPowerUpSelected);
        // Store reference on scene so shutdown() can clean it up
        this.scene._bootstrapGameListeners = [
            { event: 'powerup-selected', fn: this._onPowerUpSelected }
        ];

        // Resize event
        const scale = this.scene.getScaleManager();
        scale.on('resize', this.scene.handleResize, this.scene);
    }
    
    /**
     * Handle power-up selection
     */
    handlePowerUpSelection(selection) {
        DebugLogger.info('bootstrap', '[GameScene] Received powerup-selected event:', selection);
        
        // Apply the selected power-up
        if (selection && this.scene.powerUpSystem) {
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
        
        // Process pending XP
        if (this.scene.pendingXP > 0) {
            const xpToAdd = this.scene.pendingXP;
            this.scene.pendingXP = 0;
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
    setupDevTools() {
        const isDev = window.DEV_MODE === true || 
                      window.location.search.includes('debug=true');
        
        if (isDev) {
            const { installDevConsole } = window;
            if (installDevConsole) {
                installDevConsole(this.scene);
            }
        }
    }
    
    /**
     * Start game timer
     */
    startGameTimer() {
        this.scene.addTimeEvent({
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
    
    /**
     * Create emergency fallback blueprint
     */
    createFallbackBlueprint() {
        const CR = window.ConfigResolver;
        return {
            id: 'player_emergency',
            type: 'player',
            display: {
                texture: 'player',
                frame: 0,
                tint: 0x4169E1
            },
            stats: {
                hp: CR?.get('player.stats.hp', { defaultValue: 100 }) || 100,
                speed: CR?.get('player.stats.speed', { defaultValue: 135 }) || 135,
                size: 24
            },
            mechanics: {
                attack: { intervalMs: 1000 },
                projectile: {
                    ref: 'projectile.player_basic',
                    count: 1,
                    spreadDeg: 15,
                    stats: {
                        damage: CR?.get('player.attack.damage', { defaultValue: 10 }) || 10,
                        speed: 300,
                        range: 600
                    }
                },
                crit: { chance: 0.05, multiplier: 2 },
                iFrames: { ms: 1000 }
            },
            vfx: {
                spawn: 'vfx.player.spawn',
                hit: 'vfx.player.hit',
                death: 'vfx.player.death',
                shoot: 'vfx.weapon.muzzle',
                heal: 'vfx.player.heal'
            },
            sfx: {
                spawn: 'sfx.player.spawn',
                hit: 'sfx.player.hit',
                death: 'sfx.player.death',
                shoot: 'sfx.player.shoot',
                heal: 'sfx.player.heal'
            }
        };
    }
    
    /**
     * Initialize all data-driven systems
     */
    async initializeDataDrivenSystems() {
        DebugLogger.info('bootstrap', '[BootstrapManager] Initializing data-driven systems...');
        
        // Graphics Factory - must be first
        this.initializeGraphicsFactory();
        
        // Core systems
        await this.initializeAudioSystem();
        await this.initializeVFXSystem();
        this.initializeProjectileSystem();
        this.initializeTargetingSystem();
        await this.initializeLootSystem();
        this.initializePowerUpSystem();
        
        // Enemy management
        this.initializeEnemyManager();
        
        // Spawn and enemy management
        this.initializeSpawnSystem();
        
        // Input management
        await this.initializeKeyboardManager();
        
        // Framework debug API
        this.initializeDebugAPI();
        
        DebugLogger.info('bootstrap', '✅ All data-driven systems initialized');
        
        // Verify all critical systems
        this.verifySystemsInitialization();
        
        // Additional scene-specific setup
        this.scene.currentLevel = 1;
        this.scene.maxLevel = 3;
        
        // Setup resume handlers
        if (this.scene.setupResumeHandlers) {
            this.scene.setupResumeHandlers();
        }
        
        // Initialize debug and telemetry if in dev mode
        if (window.DEV_MODE || window.location.search.includes('debug=true')) {
            if (this.scene.initializeDebugSystems) {
                this.scene.initializeDebugSystems();
            }
        }
    }
    
    /**
     * Verify all systems were initialized correctly
     */
    verifySystemsInitialization() {
        DebugLogger.info('bootstrap', '[BootstrapManager] ===== SYSTEM VERIFICATION =====');
        DebugLogger.debug('bootstrap', '  - GraphicsFactory:', !!this.scene.graphicsFactory);
        DebugLogger.debug('bootstrap', '  - AudioSystem:', !!this.scene.audioSystem);
        DebugLogger.debug('bootstrap', '  - VFXSystem:', !!this.scene.vfxSystem);
        DebugLogger.debug('bootstrap', '  - ProjectileSystem:', !!this.scene.projectileSystem);
        DebugLogger.debug('bootstrap', '  - TargetingSystem:', !!this.scene.targetingSystem);
        DebugLogger.debug('bootstrap', '  - SimpleLootSystem:', !!this.scene.lootSystem);
        DebugLogger.debug('bootstrap', '  - PowerUpSystem:', !!this.scene.powerUpSystem);
        DebugLogger.debug('bootstrap', '  - EnemyManager:', !!this.scene.enemyManager);
        DebugLogger.debug('bootstrap', '  - SpawnDirector:', !!this.scene.spawnDirector);
        DebugLogger.info('bootstrap', '[BootstrapManager] ===== END VERIFICATION =====');
    }
    
    /**
     * Initialize GraphicsFactory for texture generation
     */
    initializeGraphicsFactory() {
        this.scene.graphicsFactory = new GraphicsFactory(this.scene);
        this.scene.graphicsFactory.generatePlaceholderTextures();
        DebugLogger.info('bootstrap', '[GraphicsFactory] Initialized with pooling support');
    }
    
    /**
     * Initialize simplified audio system
     */
    async initializeAudioSystem() {
        try {
            const { SimplifiedAudioSystem } = await import('../core/audio/SimplifiedAudioSystem.js');
            this.scene.audioSystem = new SimplifiedAudioSystem(this.scene);
            
            if (this.scene.audioSystem.initialize) {
                this.scene.audioSystem.initialize();
            }
        } catch (error) {
            DebugLogger.error('sfx', '[AudioSystem] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize VFX system
     */
    async initializeVFXSystem() {
        try {
            const { SimplifiedVFXSystem } = await import('../core/vfx/SimplifiedVFXSystem.js');
            this.scene.vfxSystem = new SimplifiedVFXSystem(this.scene);
            this.scene.newVFXSystem = this.scene.vfxSystem; // Compatibility alias
            
            this.scene.vfxSystem.initialize();
            DebugLogger.info('vfx', '[SimplifiedVFXSystem] Initialized and ready');
        } catch (error) {
            DebugLogger.error('vfx', '[SimplifiedVFXSystem] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize projectile system
     */
    initializeProjectileSystem() {
        try {
            this.scene.projectileSystem = new ProjectileSystem(this.scene);
            DebugLogger.info('projectile', '[ProjectileSystem] Initialized with pooling');
        } catch (error) {
            DebugLogger.error('projectile', '[ProjectileSystem] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize targeting system
     */
    initializeTargetingSystem() {
        try {
            this.scene.targetingSystem = new TargetingSystem(this.scene);
            DebugLogger.info('targeting', '[TargetingSystem] Initialized');
        } catch (error) {
            DebugLogger.error('targeting', '[TargetingSystem] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize loot system
     */
    async initializeLootSystem() {
        try {
            const { SimpleLootSystem } = await import('../core/systems/SimpleLootSystem.js');
            this.scene.lootSystem = new SimpleLootSystem(this.scene);
            this.scene.simpleLootSystem = this.scene.lootSystem; // Alias
            DebugLogger.info('loot', '[SimpleLootSystem] Initialized');
        } catch (error) {
            DebugLogger.error('loot', '[SimpleLootSystem] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize power-up system
     * PR7: Direct instantiation using imported class, no window pollution
     */
    initializePowerUpSystem() {
        try {
            // PR7: Direct instantiation, consistent with ProjectileSystem pattern
            this.scene.powerUpSystem = new PowerUpSystem(this.scene);
            
            if (this.scene.vfxSystem) {
                this.scene.powerUpSystem.setVFXManager(this.scene.vfxSystem);
                DebugLogger.info('powerup', '[PowerUpSystem] Initialized with VFX support');
                console.log('[BootstrapManager] ✅ PowerUpSystem initialized successfully');
            } else {
                DebugLogger.info('powerup', '[PowerUpSystem] Initialized without VFX');
                console.log('[BootstrapManager] ✅ PowerUpSystem initialized (no VFX)');
            }
        } catch (error) {
            console.error('[BootstrapManager] ❌ Failed to initialize PowerUpSystem:', error);
            DebugLogger.error('powerup', '[PowerUpSystem] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize enemy manager
     */
    initializeEnemyManager() {
        try {
            this.scene.enemyManager = new EnemyManager(this.scene);
            DebugLogger.info('enemy', '[EnemyManager] Initialized');
        } catch (error) {
            DebugLogger.error('enemy', '[EnemyManager] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize spawn system
     */
    initializeSpawnSystem() {
        try {
            this.scene.spawnDirector = new SpawnDirector(this.scene, {
                blueprints: this.scene.blueprintLoader,
                config: this.scene.configResolver
            });
            DebugLogger.info('spawn', '[SpawnDirector] Initialized with blueprint loader');
        } catch (error) {
            DebugLogger.error('spawn', '[SpawnSystem] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize keyboard input manager
     */
    async initializeKeyboardManager() {
        console.log('[BootstrapManager] Starting KeyboardManager initialization...');
        
        // Import modules separately to isolate failures
        let KeyboardManager, centralEventBus;
        
        // Try to import KeyboardManager
        try {
            const km = await import('../core/input/KeyboardManager.js');
            KeyboardManager = km.KeyboardManager;
            console.log('[BootstrapManager] KeyboardManager module imported successfully');
        } catch (e) {
            console.error('[BootstrapManager] ❌ Failed to import KeyboardManager:', e);
            console.warn('[BootstrapManager] Continuing without keyboard support');
            return;
        }
        
        // Try to import CentralEventBus
        try {
            const ceb = await import('../core/events/CentralEventBus.js');
            centralEventBus = ceb.centralEventBus;
            console.log('[BootstrapManager] CentralEventBus module imported successfully');
        } catch (e) {
            console.error('[BootstrapManager] ❌ Failed to import CentralEventBus:', e);
            console.warn('[BootstrapManager] Continuing without event bus support');
            return;
        }
        
        // Now try to initialize with imported modules
        try {
            // Create new KeyboardManager instance for GameScene
            this.scene.keyboardManager = new KeyboardManager(this.scene, centralEventBus);
            this.scene.keyboardManager.setupUIKeys();
            
            console.log('[BootstrapManager] KeyboardManager created and UI keys setup');
            
            // Register ESC key handler for pause menu
            const escHandler = () => {
                console.log('[BootstrapManager] ESC pressed! Emitting game-pause-request');
                DebugLogger.info('bootstrap', '[KeyboardManager] ESC pressed, emitting game-pause-request');
                this.scene.game.events.emit('game-pause-request');
            };
            
            centralEventBus.on('ui:escape', escHandler);
            console.log('[BootstrapManager] ESC handler registered on centralEventBus');
            
            // Register for cleanup
            if (this.scene.disposableRegistry) {
                this.scene.disposableRegistry.add({
                    destroy: () => {
                        console.log('[BootstrapManager] Cleaning up KeyboardManager...');
                        centralEventBus.off('ui:escape', escHandler);
                        this.scene.keyboardManager?.destroy();
                    }
                });
            }
            
            // Register debug keys (DEV mode only)
            if (window.DEV_MODE || window.location.search.includes('debug=true')) {
                this.scene.keyboardManager.setupDebugKeys({
                    F3: () => {
                        if (this.scene.debugOverlay) {
                            this.scene.debugOverlay.toggle();
                        }
                    },
                    F6: () => {
                        if (this.scene.debugOverlay) {
                            this.scene.debugOverlay.toggleMissingAssets();
                        }
                    },
                    F9: () => {
                        // Hot-reload blueprints from server
                        if (this.scene.blueprintLoader?.reload) {
                            this.scene.blueprintLoader.reload().then(() => {
                                DebugLogger.info('dev', '[F9] Blueprints hot-reloaded');
                            });
                        } else {
                            DebugLogger.info('dev', '[F9] Hot-reload not available');
                        }
                    }
                });
            }

            console.log('[BootstrapManager] ✅ KeyboardManager fully initialized!');
            DebugLogger.info('bootstrap', '[KeyboardManager] Initialized with centralEventBus');
        } catch (error) {
            console.error('[BootstrapManager] ❌ Failed to initialize KeyboardManager:', error);
            DebugLogger.error('bootstrap', '[KeyboardManager] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize framework debug API
     */
    initializeDebugAPI() {
        try {
            const { FrameworkDebugAPI } = window;
            if (FrameworkDebugAPI) {
                this.scene.frameworkDebug = new FrameworkDebugAPI(this.scene);
                window.__framework = this.scene.frameworkDebug;
                DebugLogger.info('dev', '[DebugAPI] Initialized - use __framework in console');
            }
        } catch (error) {
            DebugLogger.error('dev', '[DebugAPI] Failed to initialize:', error);
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

        // Emit player spawned event
        if (this.scene.eventBus) {
            this.scene.eventBus.emit('player:spawned', { 
                id: playerBlueprint.id,
                position: { 
                    x: scale.width / 2, 
                    y: scale.height / 2 
                }
            });
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
        // Register colliders for cleanup
        if (colliders && colliders.length > 0 && this.scene.disposableRegistry) {
            colliders.forEach(collider => this.scene.disposableRegistry.add(collider));
            DebugLogger.info('bootstrap', `[BootstrapManager] Registered ${colliders.length} colliders for cleanup`);
        }
        
        // Phase 9: Update systems
        this.scene.initializeUpdateManager();
        this.scene.initializeTransitionManager();
        
        // Phase 10: Start game
        await this.scene.startGame();
        
        // Phase 11: Dev tools
        this.setupDevTools();
        
        // Phase 12: Timer
        this.startGameTimer();
        
        DebugLogger.info('bootstrap', '✅ Bootstrap complete');
    }
}

export default BootstrapManager;