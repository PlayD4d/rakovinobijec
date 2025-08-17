/**
 * SystemsInitializer - Handles data-driven systems initialization
 * PR7 compliant - centralized system setup
 * 
 * Extracts system initialization from GameScene to reduce LOC
 */

import { EnemyManager } from './EnemyManager.js';
import { PlayerFactory } from './PlayerFactory.js';

export class SystemsInitializer {
    constructor(scene) {
        this.scene = scene;
    }
    
    /**
     * Initialize all data-driven systems
     */
    async initializeSystems() {
        console.log('[SystemsInitializer] Initializing data-driven systems...');
        
        // Graphics Factory - must be first
        this.initializeGraphicsFactory();
        
        // Core systems
        await this.initializeAudioSystem();
        this.initializeVFXSystem();
        this.initializeProjectileSystem();
        this.initializeLootSystem();
        this.initializePowerUpSystem();
        
        // Player and enemy management
        this.initializePlayerFactory();
        this.initializeEnemyManager();
        
        // Spawn and enemy management
        this.initializeSpawnSystem();
        
        // Framework debug API
        this.initializeDebugAPI();
        
        console.log('✅ All data-driven systems initialized');
    }
    
    /**
     * Initialize GraphicsFactory for texture generation
     */
    initializeGraphicsFactory() {
        const { GraphicsFactory } = window;
        if (GraphicsFactory) {
            this.scene.graphicsFactory = new GraphicsFactory(this.scene);
            console.log('[GraphicsFactory] Initialized with pooling support');
        }
    }
    
    /**
     * Initialize simplified audio system
     */
    async initializeAudioSystem() {
        try {
            const { SimplifiedAudioSystem } = await import('../core/audio/SimplifiedAudioSystem.js');
            this.scene.audioSystem = new SimplifiedAudioSystem(this.scene);
            
            // Initialize with config
            const audioConfig = {
                sfx: { enabled: true, volume: 0.3 },
                music: { enabled: true, volume: 0.5 }
            };
            
            // Get music manager from audio system
            this.scene.musicManager = this.scene.audioSystem.getMusicManager();
            
            // Register fallback SFX
            this.registerFallbackSFX();
            
            // Start background music for current scene
            const currentScene = this.scene.sys.settings.key;
            const sceneMusic = this.scene.audioSystem.getSceneMusic(currentScene);
            if (sceneMusic && this.scene.musicManager) {
                await this.scene.musicManager.playMusic(sceneMusic);
                console.log(`[Music] Started scene music: ${sceneMusic}`);
            }
        } catch (error) {
            console.error('[AudioSystem] Failed to initialize:', error);
        }
    }
    
    /**
     * Register fallback SFX paths
     */
    registerFallbackSFX() {
        const fallbackSFX = {
            'player_hit': 'sound/player_hit.mp3',
            'player_death': 'sound/player_death.mp3',
            'enemy_hit': 'sound/npc_hit.mp3',
            'enemy_death': 'sound/npc_death.mp3',
            'boss_spawn': 'sound/boss_spawn.mp3',
            'boss_death': 'sound/boss_death.mp3',
            'pickup': 'sound/pickup.mp3',
            'powerup': 'sound/powerup.mp3',
            'level_up': 'sound/level_up.mp3',
            'shoot': 'sound/player_shoot.mp3'
        };
        
        if (this.scene.audioSystem) {
            Object.entries(fallbackSFX).forEach(([key, path]) => {
                this.scene.audioSystem.registerFallback(key, path);
            });
        }
    }
    
    /**
     * Initialize VFX system
     */
    initializeVFXSystem() {
        try {
            const { SimplifiedVFXSystem } = window;
            if (SimplifiedVFXSystem) {
                this.scene.vfxSystem = new SimplifiedVFXSystem(this.scene);
                this.scene.newVFXSystem = this.scene.vfxSystem; // Compatibility alias
                
                // Initialize shield effects
                const { ShieldEffect } = window;
                const { ArmorShieldEffect } = window;
                
                if (ShieldEffect) {
                    this.scene.playerShieldEffect = new ShieldEffect(this.scene);
                }
                if (ArmorShieldEffect) {
                    this.scene.armorShieldEffect = new ArmorShieldEffect(this.scene);
                }
                
                console.log('[VFXSystem] Initialized with shield effects');
            }
        } catch (error) {
            console.error('[VFXSystem] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize projectile system
     */
    initializeProjectileSystem() {
        try {
            const { ProjectileSystem } = window;
            if (ProjectileSystem) {
                this.scene.projectileSystem = new ProjectileSystem(this.scene);
                console.log('[ProjectileSystem] Initialized with pooling');
            }
        } catch (error) {
            console.error('[ProjectileSystem] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize loot system
     */
    initializeLootSystem() {
        try {
            const { SimpleLootSystem } = window;
            if (SimpleLootSystem) {
                this.scene.lootSystem = new SimpleLootSystem(this.scene);
                this.scene.simpleLootSystem = this.scene.lootSystem; // Alias
                console.log('[LootSystem] Initialized');
            }
        } catch (error) {
            console.error('[LootSystem] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize power-up system
     */
    initializePowerUpSystem() {
        try {
            const { PowerUpSystem } = window;
            if (PowerUpSystem) {
                this.scene.powerUpSystem = new PowerUpSystem(this.scene);
                console.log('[PowerUpSystem] Initialized');
            }
        } catch (error) {
            console.error('[PowerUpSystem] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize player factory
     */
    initializePlayerFactory() {
        try {
            this.scene.playerFactory = new PlayerFactory(this.scene);
            console.log('[PlayerFactory] Initialized');
        } catch (error) {
            console.error('[PlayerFactory] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize enemy manager
     */
    initializeEnemyManager() {
        try {
            this.scene.enemyManager = new EnemyManager(this.scene);
            console.log('[EnemyManager] Initialized');
        } catch (error) {
            console.error('[EnemyManager] Failed to initialize:', error);
        }
    }
    
    /**
     * Initialize spawn system
     */
    initializeSpawnSystem() {
        try {
            const { SpawnDirector } = window;
            const { SpawnDirectorIntegration } = window;
            
            if (SpawnDirector) {
                this.scene.spawnDirector = new SpawnDirector(this.scene);
                
                // Create enemy groups
                this.scene.enemies = this.scene.physics.add.group();
                this.scene.enemiesGroup = this.scene.enemies; // Alias
                this.scene.bossGroup = this.scene.physics.add.group();
                
                // Setup integration if available
                if (SpawnDirectorIntegration) {
                    const integration = new SpawnDirectorIntegration(
                        this.scene,
                        this.scene.spawnDirector
                    );
                    
                    // Set factory callbacks
                    this.scene.spawnDirector.setFactoryCallbacks(
                        integration.enemyFactory.bind(integration),
                        integration.bossFactory.bind(integration)
                    );
                    
                    console.log('[SpawnDirector] Initialized with factory integration');
                } else if (this.scene.enemyManager) {
                    // Use EnemyManager factory
                    this.scene.spawnDirector.setFactoryCallbacks(
                        (id, opts) => this.scene.enemyManager.spawnEnemy(id, opts),
                        (id, opts) => this.scene.enemyManager.spawnBoss(id, opts)
                    );
                } else {
                    // Final fallback (should not happen)
                    console.warn('[SpawnDirector] No factory available');
                }
            }
        } catch (error) {
            console.error('[SpawnSystem] Failed to initialize:', error);
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
                console.log('[DebugAPI] Initialized - use __framework in console');
            }
        } catch (error) {
            console.error('[DebugAPI] Failed to initialize:', error);
        }
    }
}

export default SystemsInitializer;