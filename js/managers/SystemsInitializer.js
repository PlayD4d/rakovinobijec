/**
 * SystemsInitializer - Data-driven system initialization
 * Extracted from BootstrapManager to follow Thin Composer pattern
 *
 * Responsible for creating and configuring all game systems:
 * GraphicsFactory, AudioSystem, VFXSystem, ProjectileSystem,
 * TargetingSystem, LootSystem, PowerUpSystem, EnemyManager, SpawnDirector
 */

import { DebugLogger } from '../core/debug/DebugLogger.js';
import { EnemyManager } from './EnemyManager.js';
import { ProjectileSystem } from '../core/systems/ProjectileSystem.js';
import { TargetingSystem } from '../core/systems/TargetingSystem.js';
import { PowerUpSystem } from '../core/systems/powerup/PowerUpSystem.js';
import { GraphicsFactory } from '../core/graphics/GraphicsFactory.js';
import { SpawnDirector } from '../core/spawn/SpawnDirector.js';

export class SystemsInitializer {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Initialize all data-driven systems in correct order
     */
    async initializeAll() {
        DebugLogger.info('bootstrap', '[SystemsInitializer] Initializing data-driven systems...');

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

        // Spawn system
        this.initializeSpawnSystem();

        // Input management
        await this.initializeKeyboardManager();

        // Framework debug API
        this.initializeDebugAPI();

        DebugLogger.info('bootstrap', '[SystemsInitializer] All systems initialized');

        // Verify all critical systems
        this.verifySystems();
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
            this.scene.powerUpSystem = new PowerUpSystem(this.scene);

            if (this.scene.vfxSystem) {
                this.scene.powerUpSystem.setVFXManager(this.scene.vfxSystem);
                DebugLogger.info('powerup', '[PowerUpSystem] Initialized with VFX support');
            } else {
                DebugLogger.info('powerup', '[PowerUpSystem] Initialized without VFX');
            }
        } catch (error) {
            DebugLogger.error('powerup', '[PowerUpSystem] Failed to initialize:', error);
        }
    }

    /**
     * Initialize enemy manager
     */
    initializeEnemyManager() {
        try {
            // Create physics groups here (PR7: SystemsInitializer owns Phaser API setup)
            if (!this.scene.enemiesGroup) {
                this.scene.enemiesGroup = this.scene.physics.add.group({ runChildUpdate: false });
            }
            if (!this.scene.bossGroup) {
                this.scene.bossGroup = this.scene.physics.add.group();
            }
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
        DebugLogger.info('bootstrap', '[SystemsInitializer] Starting KeyboardManager initialization...');

        // Import modules separately to isolate failures
        let KeyboardManager, centralEventBus;

        try {
            const km = await import('../core/input/KeyboardManager.js');
            KeyboardManager = km.KeyboardManager;
            DebugLogger.debug('bootstrap', '[SystemsInitializer] KeyboardManager module imported');
        } catch (e) {
            DebugLogger.error('bootstrap', '[SystemsInitializer] Failed to import KeyboardManager:', e);
            DebugLogger.warn('bootstrap', '[SystemsInitializer] Continuing without keyboard support');
            return;
        }

        try {
            const ceb = await import('../core/events/CentralEventBus.js');
            centralEventBus = ceb.centralEventBus;
            DebugLogger.debug('bootstrap', '[SystemsInitializer] CentralEventBus module imported');
        } catch (e) {
            DebugLogger.error('bootstrap', '[SystemsInitializer] Failed to import CentralEventBus:', e);
            DebugLogger.warn('bootstrap', '[SystemsInitializer] Continuing without event bus support');
            return;
        }

        try {
            this.scene.keyboardManager = new KeyboardManager(this.scene, centralEventBus);
            this.scene.keyboardManager.setupUIKeys();

            DebugLogger.debug('bootstrap', '[SystemsInitializer] KeyboardManager created and UI keys setup');

            // Register ESC key handler for pause menu
            const escHandler = () => {
                DebugLogger.info('bootstrap', '[KeyboardManager] ESC pressed, emitting game-pause-request');
                this.scene.game.events.emit('game-pause-request');
            };

            centralEventBus.on('ui:escape', escHandler);

            // Register for cleanup
            if (this.scene.disposableRegistry) {
                this.scene.disposableRegistry.add({
                    destroy: () => {
                        DebugLogger.debug('bootstrap', '[SystemsInitializer] Cleaning up KeyboardManager...');
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

            DebugLogger.info('bootstrap', '[KeyboardManager] Initialized with centralEventBus');
        } catch (error) {
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
     * Verify all systems were initialized correctly
     */
    verifySystems() {
        DebugLogger.info('bootstrap', '[SystemsInitializer] ===== SYSTEM VERIFICATION =====');
        DebugLogger.debug('bootstrap', '  - GraphicsFactory:', !!this.scene.graphicsFactory);
        DebugLogger.debug('bootstrap', '  - AudioSystem:', !!this.scene.audioSystem);
        DebugLogger.debug('bootstrap', '  - VFXSystem:', !!this.scene.vfxSystem);
        DebugLogger.debug('bootstrap', '  - ProjectileSystem:', !!this.scene.projectileSystem);
        DebugLogger.debug('bootstrap', '  - TargetingSystem:', !!this.scene.targetingSystem);
        DebugLogger.debug('bootstrap', '  - SimpleLootSystem:', !!this.scene.lootSystem);
        DebugLogger.debug('bootstrap', '  - PowerUpSystem:', !!this.scene.powerUpSystem);
        DebugLogger.debug('bootstrap', '  - EnemyManager:', !!this.scene.enemyManager);
        DebugLogger.debug('bootstrap', '  - SpawnDirector:', !!this.scene.spawnDirector);
        DebugLogger.info('bootstrap', '[SystemsInitializer] ===== END VERIFICATION =====');
    }
}

export default SystemsInitializer;
