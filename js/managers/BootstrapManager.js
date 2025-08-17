/**
 * BootstrapManager - Simplifies GameScene.create() initialization
 * PR7 compliant - systematic initialization in clear phases
 * 
 * Extracts initialization logic from GameScene to reduce LOC
 * and improve maintainability
 */

export class BootstrapManager {
    constructor(scene) {
        this.scene = scene;
    }
    
    /**
     * Initialize session logging
     */
    initializeSessionLogging() {
        try {
            const { initSessionLogger } = window;
            if (initSessionLogger) {
                this.scene.sessionLogger = initSessionLogger();
                this.scene.sessionLogger.logSystemEvent('GameScene', 'create_start', { 
                    timestamp: Date.now(),
                    screenSize: { width: this.scene.scale.width, height: this.scene.scale.height }
                });
                console.log('[SessionLogger] Initialized - use __downloadLog() in console to download session.log');
            }
        } catch (error) {
            console.error('[SessionLogger] Failed to initialize:', error);
        }
    }
    
    /**
     * Setup world physics and depth layers
     */
    setupWorldAndDepth() {
        // Setup world bounds
        this.scene.physics.world.setBounds(0, 0, this.scene.scale.width, this.scene.scale.height);
        
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
        this.scene.mainCam = this.scene.cameras.main;
        this.scene.mainCam.setName('MainCamera');
        
        // Create UI layer
        this.scene.uiLayer = this.scene.add.layer();
        this.scene.uiLayer.setDepth(this.scene.DEPTH_LAYERS.UI_BASE);
        
        console.log('✅ Depth-based rendering system initialized');
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
            console.warn('⚠️ Analytics manager init failed (silenced):', error.message);
            this.scene.analyticsManager = null;
        }
    }
    
    /**
     * Setup UI components
     */
    initializeUI() {
        // Create HUD
        const { UnifiedHUD } = window;
        if (UnifiedHUD) {
            this.scene.unifiedHUD = new UnifiedHUD(this.scene);
        }
        
        // Launch UI overlay scene
        this.scene.scene.launch('GameUIScene');
    }
    
    /**
     * Register all event listeners
     */
    registerEventListeners() {
        // Player death event
        this.scene.events.on('player:die', (data) => {
            console.log('[GameScene] Player died, triggering game over');
            this.scene.gameOver();
        });
        
        // Boss death event
        this.scene.events.on('boss:die', async (data) => {
            console.log('[GameScene] Boss defeated! Transitioning to next level...');
            await this.scene.transitionToNextLevel();
        });
        
        // Scene resume event
        this.scene.events.on(Phaser.Scenes.Events.RESUME, () => {
            console.log('[GameScene] Scene resumed');
            this.ensurePlayerActive();
            this.scene.isPaused = false;
        });
        
        // Power-up selection event
        this.scene.game.events.on('powerup-selected', (selection) => {
            this.handlePowerUpSelection(selection);
        });
        
        // Resize event
        this.scene.scale.on('resize', this.scene.handleResize, this.scene);
    }
    
    /**
     * Handle power-up selection
     */
    handlePowerUpSelection(selection) {
        console.log('[GameScene] Received powerup-selected event:', selection);
        
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
            this.scene.time.delayedCall(100, () => {
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
                console.warn('[GameScene] Player was inactive - reactivating!');
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
        this.scene.time.addEvent({
            delay: 1000,
            callback: this.scene.updateTime,
            callbackScope: this.scene,
            loop: true
        });
    }
    
    /**
     * Main bootstrap method - orchestrates all initialization
     */
    async bootstrap() {
        console.log('🎮 GameScene starting - DATA-DRIVEN MODE ONLY');
        
        // Phase 1: Core setup
        this.initializeSessionLogging();
        this.setupWorldAndDepth();
        
        // Phase 2: Input (must be before player)
        this.scene.setupInput();
        
        // Phase 3: Data systems (must be before player)
        try {
            await this.scene.initializeDataDrivenSystems();
        } catch (error) {
            console.error('❌ CRITICAL: Data-driven systems failed:', error);
            this.scene.showCriticalError('Blueprint Systems Failed', error.message);
            throw error; // Propagate to stop initialization
        }
        
        // Phase 4: Player creation
        const playerBlueprint = this.scene.createPlayerBlueprint();
        this.scene.player = new (window.Player)(
            this.scene, 
            this.scene.scale.width / 2, 
            this.scene.scale.height / 2, 
            playerBlueprint
        );
        this.scene.player.setDepth(this.scene.DEPTH_LAYERS.PLAYER);
        this.scene.player.setInputKeys(this.scene.inputKeys);
        
        // Phase 5: Managers
        this.initializeManagers();
        
        // Phase 6: UI
        this.initializeUI();
        
        // Phase 7: Events
        this.registerEventListeners();
        
        // Phase 8: Collisions
        this.scene.setupCollisions();
        
        // Phase 9: Update systems
        this.scene.initializeUpdateManager();
        this.scene.initializeTransitionManager();
        
        // Phase 10: Start game
        await this.scene.startGame();
        
        // Phase 11: Dev tools
        this.setupDevTools();
        
        // Phase 12: Timer
        this.startGameTimer();
        
        console.log('✅ Bootstrap complete');
    }
}

export default BootstrapManager;