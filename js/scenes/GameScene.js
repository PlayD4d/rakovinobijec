// GameConfig removed - PR7 compliance requires ConfigResolver only
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { UnifiedHUD } from '../ui/UnifiedHUD.js';
// import { PauseMenuModal } from '../ui/PauseMenuModal.js'; // Replaced with LiteUI
import { MobileControlsManager } from '../managers/MobileControlsManager.js';

// LiteUI components
// GameUIScene will handle all UI overlays
// Legacy AudioManager removed - using modern SFXSystem
import { HighScoreManager } from '../managers/HighScoreManager.js';
// AudioLoader removed - using direct blueprint loading
import { GlobalHighScoreManager } from '../managers/GlobalHighScoreManager.js';
import { AnalyticsManager } from '../managers/AnalyticsManager.js';
import { SupabaseClient } from '../utils/supabaseClient.js';
import { UIThemeUtils } from '../ui/UITheme.js';
import { HighScoreModal } from '../ui/HighScoreModal.js';

// Základní systémy - pouze moderní PR7 implementace
import { LootSystem } from '../core/systems/LootSystem.js';
import { PowerUpSystemV2 } from '../core/systems/PowerUpSystemV2.js';
import { InputSystem } from '../core/systems/InputSystem.js';
import { ShapeRenderer } from '../core/utils/ShapeRenderer.js';
import { MovementSystem } from '../core/systems/MovementSystem.js';
import { ShieldSystem } from '../core/systems/ShieldSystem.js';
import { CollisionSystem } from '../core/systems/CollisionSystem.js';
import { SpawnSystem } from '../core/systems/SpawnSystem.js';
import { installDevConsole } from '../core/utils/devConsole.js';
// buildSfxManifest removed - using direct blueprint loading
import { EventBus } from '../core/events/EventBus.js';
import { VfxRouter } from '../core/vfx/VfxRouter.js';
import { VfxSystem } from '../core/vfx/VFXSystem.js';
import { SFXSystem } from '../core/sfx/SFXSystem.js';
import { initSessionLogger, getSessionLogger } from '../core/logging/SessionLogger.js';
import { vfxRegistry } from '../core/vfx/VFXRegistry.js';
import { sfxRegistry } from '../core/sfx/SFXRegistry.js';
import { AnalyticsSystem } from '../core/systems/AnalyticsSystem.js';
import { displayResolver } from '../core/blueprints/DisplayResolver.js';
// ConfigResolver je nyní inicializován globálně v main.js
import { TelemetryLogger } from '../core/TelemetryLogger.js';
import { DebugOverlay } from '../utils/DebugOverlay.js';
import { Phase5Debug } from '../core/debug/Phase5Debug.js';
import { SmokeTest } from '../utils/SmokeTest.js';
import { getMusicManager } from '../core/audio/MusicManager.js';

// Data-driven systémy - vše řízeno blueprinty
import { BlueprintLoader } from '../core/data/BlueprintLoader.js';
import { SpawnDirector } from '../core/spawn/SpawnDirector.js';
import { FrameworkDebugAPI } from '../core/FrameworkDebugAPI.js';
import { ProjectileSystem } from '../core/systems/ProjectileSystem.js';
import LootSystemBootstrap from '../core/loot/LootSystemBootstrap.js';
import { ModifierEngine } from '../core/utils/ModifierEngine.js';
import { PowerUpVFXManager } from '../core/vfx/PowerUpVFXManager.js';
import { GraphicsFactory } from '../core/graphics/GraphicsFactory.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        
        // Core entities
        this.player = null;
        this.enemies = null; // Phaser physics group for all enemies
        this.currentBoss = null;
        
        // UI - LiteUI components
        this.unifiedHUD = null;
        this.pauseMenu = null; // Will be replaced with PauseUI
        this.powerUpUI = null; // LiteUI PowerUpUI (handled by GameUIScene)
        this.pauseUI = null; // LiteUI PauseUI (handled by GameUIScene)
        this.mobileControls = null;
        
        // Core systems
        // audioManager removed - using SFXSystem
        this.analyticsManager = null;
        this.musicManager = null;
        
        // Data-driven systémy (PR7 kompatibilní)
        this.blueprints = null; // Zkratka pro blueprintLoader
        this.blueprintLoader = null; // Načítá všechna data z /data/blueprints/
        this.spawnDirector = null; // Řídí spawning nepřátel podle tabulek
        this.frameworkDebug = null; // Debug API pro vývoj
        this.projectileSystem = null; // Správa projektilů s zero-GC poolingem
        this.coreLootSystem = null; // Systém dropů a odměn
        this.corePowerUpSystem = null; // Systém vylepšení hráče
        this.newVFXSystem = null; // Vizuální efekty (exploze, částice)
        this.newSFXSystem = null; // Zvukové efekty
        this.modifierEngine = ModifierEngine; // Engine pro modifikace stats
        
        // Herní statistiky
        // PR7: Get XP requirements from ConfigResolver
        const CR = window.ConfigResolver;
        const xpBase = CR ? CR.get('progression.xp.baseRequirement', { defaultValue: 8 }) : 8;
        
        this.gameStats = {
            level: 1, // Aktuální úroveň hráče
            xp: 0, // Aktuální XP
            xpToNext: xpBase, // XP potřebné na další level - from ConfigResolver
            score: 0, // Celkové skóre
            enemiesKilled: 0, // Počet zabitých nepřátel
            kills: 0, // Alias pro kompatibilitu s HUD
            time: 0, // Čas hraní v sekundách
            bossesDefeated: 0, // Počet poražených bossů
            powerUpsCollected: 0 // Počet sebraných vylepšení
        };
        
        // Initialize pending XP (for level-up overflow)
        this.pendingXP = 0;
        
        // Časovače a stav hry
        this.sceneTimeSec = 0; // Čas od začátku scény
        this._lastTimeUi = 0; // Pomocná proměnná pro UI update
        
        this.isPaused = false; // Je hra pozastavena?
        this.isGameOver = false; // Skončila hra?
        this.powerUps = []; // Seznam aktivních power-upů
        this.levelStartTime = 0; // Čas začátku levelu
        this.highScoreModal = null; // Modal pro high score
        
        // Konfigurace (PR7)
        this.configResolver = window.ConfigResolver; // Jednotný přístup ke konfiguraci - již inicializováno v main.js
        this.eventBus = new EventBus(); // Systém událostí
    }
    
    /**
     * Preload metoda - načte všechny zvukové soubory z blueprintů
     * PR7 kompatibilní - 100% data-driven z blueprintů
     */
    preload() {
        console.log('[GameScene] Preload - načítání audio souborů z blueprintů...');
        
        // Načíst všechny zvuky přímo ze složek
        // PR7: Jednoduchý přístup - načteme všechny mp3 soubory
        this.loadAudioFromDirectory();
    }
    
    /**
     * Načte všechny audio soubory ze složek sound/ a music/
     * PR7: Přímé načítání bez složitých manifestů
     */
    loadAudioFromDirectory() {
        // Seznam všech zvukových souborů které potřebujeme
        // PR7: V budoucnu můžeme toto extrahovat z blueprintů
        const audioFiles = [
            // Hudba
            'music/level_1.mp3',
            'music/level_2.mp3',
            'music/level_3.mp3',
            'music/boss.mp3',
            
            // Základní zvuky hráče
            'sound/player_hit.mp3',
            'sound/player_death.mp3',
            'sound/player_spawn.mp3',
            'sound/player_shoot.mp3',
            'sound/levelup.mp3',
            'sound/heal.mp3',
            'sound/shoot.mp3',
            'sound/laser.mp3',
            
            // Zvuky nepřátel
            'sound/npc_spawn.mp3',
            'sound/npc_hit.mp3',
            'sound/npc_death.mp3',
            'sound/npc_death_1.mp3',
            'sound/npc_death_2.mp3',
            'sound/elite_death.mp3',
            
            // Boss zvuky
            'sound/boss_enter.mp3',
            'sound/boss_hit.mp3',
            'sound/boss_death.mp3',
            'sound/boss_phase.mp3',
            
            // Efekty
            'sound/explosion_small.mp3',
            'sound/explosion_large.mp3',
            'sound/decay.mp3',
            'sound/hit_soft.mp3',
            'sound/hit_hard.mp3',
            'sound/hit_critical.mp3',
            
            // Speciální efekty
            'sound/flamethrower.mp3',
            'sound/radiotherapy.mp3',
            'sound/machinegun.mp3',
            'sound/laser1.mp3',
            'sound/laser2.mp3',
            
            // UI zvuky
            'sound/pickup.mp3',
            'sound/powerup.mp3',
            'sound/metotrexat.mp3',
            'sound/intro.mp3',
            'sound/ready_fight.mp3',
            'sound/game_over.mp3'
        ];
        
        // Load music tracks from config
        const CR = window.ConfigResolver;
        if (CR) {
            // Load game music tracks
            const gameTracks = CR.get('audio.scenes.game.tracks', { defaultValue: [] });
            gameTracks.forEach(track => {
                const key = track.split('/').pop().split('.')[0];
                if (!this.cache.audio.has(key)) {
                    this.load.audio(key, track);
                    console.log(`[GameScene] Loading game music: ${key} from ${track}`);
                }
            });
            
            // Load boss music tracks
            const bossTracks = CR.get('audio.scenes.boss.tracks', { defaultValue: [] });
            bossTracks.forEach(track => {
                const key = track.split('/').pop().split('.')[0];
                if (!this.cache.audio.has(key)) {
                    this.load.audio(key, track);
                    console.log(`[GameScene] Loading boss music: ${key} from ${track}`);
                }
            });
        }
        
        // Načíst každý soubor
        audioFiles.forEach(path => {
            // Extrahovat klíč z cesty (např. 'sound/laser.mp3' -> 'laser')
            const key = path.split('/').pop().replace('.mp3', '');
            
            // Načíst audio soubor
            if (!this.cache.audio.has(key)) {
                this.load.audio(key, path);
                console.log(`[GameScene] Načítám zvuk: ${key} z ${path}`);
            }
        });
        
        console.log(`[GameScene] Připraveno ${audioFiles.length} zvukových souborů k načtení`);
    }
    
    async create() {
        console.log('🎮 GameScene starting - DATA-DRIVEN MODE ONLY');
        
        // Store start time for XP scaling
        this.startTime = this.time.now;
        
        // Initialize session logger FIRST for debugging
        try {
            this.sessionLogger = initSessionLogger();
            this.sessionLogger.logSystemEvent('GameScene', 'create_start', { 
                timestamp: Date.now(),
                screenSize: { width: this.scale.width, height: this.scale.height }
            });
            console.log('[SessionLogger] Initialized - use __downloadLog() in console to download session.log');
        } catch (error) {
            console.error('[SessionLogger] Failed to initialize:', error);
        }
        
        // Setup world bounds
        this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
        
        // ==========================================
        // DEPTH-BASED RENDERING SYSTEM (PR7 COMPLIANT)
        // ==========================================
        // Using depth values instead of containers for physics compatibility
        // Depth ranges:
        // 0-999: Background and world objects
        // 1000-1999: Enemies and NPCs
        // 2000-2999: Player and player projectiles
        // 3000-3999: Enemy projectiles and effects
        // 10000-19999: UI elements (HUD, menus)
        // 20000+: Modal overlays
        
        this.DEPTH_LAYERS = {
            BACKGROUND: 0,
            ENEMIES: 1000,
            PLAYER: 2000,
            PROJECTILES: 3000,
            UI_BASE: 10000,
            UI_MODAL: 20000
        };
        
        // Store main camera reference
        this.mainCam = this.cameras.main;
        this.mainCam.setName('MainCamera');
        
        // Create UI layer using Phaser Layer (not Container)
        // Layer je kompatibilní s physics a automaticky renderuje nad vším ostatním
        this.uiLayer = this.add.layer();
        this.uiLayer.setDepth(this.DEPTH_LAYERS.UI_BASE);
        
        console.log('✅ Depth-based rendering system initialized:');
        console.log('   - Using depth values for layering');
        console.log('   - UI Layer at depth', this.DEPTH_LAYERS.UI_BASE);
        console.log('   - Physics compatibility maintained')
        
        // Setup input FIRST - before player creation
        this.setupInput();
        
        // Generate placeholder enemy textures BEFORE spawning
        this.generateEnemyPlaceholderTextures();
        
        // Initialize data-driven systems first (before player creation)
        // PR7: Fail fast - if critical systems fail, stop game initialization
        try {
            await this.initializeDataDrivenSystems();
        } catch (error) {
            console.error('❌ CRITICAL: Data-driven systems failed to initialize:', error);
            this.showCriticalError('Blueprint Systems Failed', error.message);
            return; // Stop game initialization
        }
        
        // Create player with blueprint
        const playerBlueprint = this.createPlayerBlueprint();
        this.player = new Player(this, this.scale.width / 2, this.scale.height / 2, playerBlueprint);
        
        // Set player depth
        this.player.setDepth(this.DEPTH_LAYERS.PLAYER);
        
        // Set input keys explicitly
        this.player.setInputKeys(this.inputKeys);
        
        // Listen for player death event
        this.events.on('player:die', (data) => {
            console.log('[GameScene] Player died, triggering game over');
            this.gameOver();
        });
        
        // Listen for boss death event - transition to next level
        this.events.on('boss:die', async (data) => {
            console.log('[GameScene] Boss defeated! Transitioning to next level...');
            await this.transitionToNextLevel();
        });
        
        // Debug: Check input system
        console.log('[GameScene] inputKeys ready?', !!this.inputKeys);
        console.log('[Player] keys attached:', !!this.player.keys);
        
        // Enemy group will be created by SpawnDirectorIntegration
        // this.enemies = this.physics.add.group(); // REMOVED - created by integration
        
        // Initialize music manager and start game music
        try {
            this.musicManager = getMusicManager(this);
            this.musicManager.playCategory('game');
            console.log('[GameScene] Music manager initialized');
        } catch (error) {
            console.warn('[GameScene] Failed to initialize music:', error);
        }
        
        // Initialize high score managers first (for supabase client)
        this.highScoreManager = new HighScoreManager();
        this.globalHighScoreManager = new GlobalHighScoreManager();
        
        // Initialize analytics - pass supabase client if available
        try {
            const supabaseClient = this.globalHighScoreManager?.supabase || null;
            this.analyticsManager = new AnalyticsManager(supabaseClient);
        } catch (error) {
            console.warn('⚠️ Analytics manager init failed (silenced):', error.message);
            this.analyticsManager = null;
        }
        
        // Initialize UI - add to UI layer
        this.unifiedHUD = new UnifiedHUD(this);
        // UI layer already manages depth properly, no need for setDepth
        
        // Start UI overlay scene
        this.scene.launch('GameUIScene');
        
        // Listen for scene resume event to ensure player stays active
        this.events.on(Phaser.Scenes.Events.RESUME, () => {
            console.log('[GameScene] Scene resumed');
            
            // Ensure player is still active after resume
            if (this.player && this.player.hp > 0) {
                if (!this.player.active || !this.player.visible) {
                    console.warn('[GameScene] Player was inactive after resume - reactivating!');
                    this.player.active = true;
                    this.player.visible = true;
                    if (this.player.body) {
                        this.player.body.enable = true;
                    }
                }
            }
            
            // Clear pause flag
            this.isPaused = false;
        });
        
        // Listen for power-up selection from UI scene
        this.game.events.on('powerup-selected', (selection) => {
            console.log('[GameScene] Received powerup-selected event:', selection);
            
            // Apply the selected power-up if we have the system
            if (selection && this.corePowerUpSystem) {
                this.corePowerUpSystem.applyPowerUp(selection.id, (selection.level || 0) + 1);
            }
            
            // IMPORTANT: Ensure player is still active after power-up selection
            // This prevents the player from disappearing after level-up
            if (this.player && this.player.hp > 0) {
                if (!this.player.active || !this.player.visible) {
                    console.warn('[GameScene] Player was inactive after power-up selection - reactivating!');
                    this.player.active = true;
                    this.player.visible = true;
                    if (this.player.body) {
                        this.player.body.enable = true;
                    }
                }
            }
            
            // Mark game as resumed
            this.isPaused = false;
            
            // PR7: Resume projectiles
            if (this.projectileSystem) {
                this.projectileSystem.resumeAll();
            }
            
            // Process any pending XP from the level up
            if (this.pendingXP > 0) {
                const xpToAdd = this.pendingXP;
                this.pendingXP = 0;
                // Delay slightly to prevent immediate re-trigger
                this.time.delayedCall(100, () => {
                    this.addXP(xpToAdd);
                });
            }
        });
        
        // Setup collisions
        this.setupCollisions();
        
        // Start game
        await this.startGame();
        
        // Install dev console and debug overlay only in DEV mode
        const isDev = window.DEV_MODE === true || 
                      window.location.search.includes('debug=true');
        
        if (isDev) {
            installDevConsole(this);
            // F3 handler will be set up when DebugOverlay is created
        }
        
        // Setup resize handling
        this.scale.on('resize', this.handleResize, this);
        
        // Start game timer
        this.time.addEvent({
            delay: 1000,
            callback: this.updateTime,
            callbackScope: this,
            loop: true
        });
    }
    
    async initializeDataDrivenSystems() {
        // Initialize GameLogger first (to capture all logs)
        try {
            const { GameLogger } = await import('../core/logging/GameLogger.js');
            this.gameLogger = new GameLogger(this);
            console.log('✅ GameLogger initialized - use downloadGameLog() to save logs');
        } catch (error) {
            console.warn('GameLogger init failed:', error);
        }
        
        // PR7: Graphics Factory (initialize very early)
        try {
            this.graphicsFactory = new GraphicsFactory(this);
            console.log('✅ Graphics Factory initialized');
        } catch (error) {
            console.warn('Graphics Factory init failed:', error);
        }
        
        // VFX System (initialize early)
        try {
            this.newVFXSystem = new VfxSystem(this);
            this.newVFXSystem.initialize();
            console.log('✅ VFX System initialized');
            
            // Initialize ArmorShieldEffect for enemy armor visuals
            const { ArmorShieldEffect } = await import('../core/vfx/effects/ArmorShieldEffect.js');
            this.armorShieldEffect = new ArmorShieldEffect(this);
            console.log('✅ ArmorShieldEffect initialized');
        } catch (error) {
            console.warn('VFX System init failed:', error);
        }
        
        // SFX System (initialize early)
        try {
            this.newSFXSystem = new SFXSystem(this);
            this.newSFXSystem.initialize();
            console.log('✅ SFX System initialized');
        } catch (error) {
            console.warn('SFX System init failed:', error);
        }
        
        // Blueprint Loader (REQUIRED)
        try {
            this.blueprints = new BlueprintLoader(this.game);
            this.blueprintLoader = this.blueprints; // Alias for compatibility
            await this.blueprints.init();
            console.log('✅ BlueprintLoader initialized');
        } catch (error) {
            console.error('❌ Failed to load blueprints:', error);
            throw new Error('Cannot start game without blueprints');
        }
        
        // Loot System - fail-safe mode
        try {
            this.lootBootstrap = new LootSystemBootstrap(this);
            await this.lootBootstrap.initialize();
            this.lootDropManager = this.lootBootstrap.lootDropManager;
            this.coreLootSystem = this.lootBootstrap.lootSystem;
            console.log('✅ LootSystemBootstrap initialized');
        } catch (error) {
            console.warn('⚠️ LootSystemBootstrap failed, disabling loot system:', error.message);
            this.lootEnabled = false;
            this.lootDropManager = null;
            this.coreLootSystem = null;
        }
        
        // SpawnDirector (REQUIRED)
        try {
            // Create enemy groups first
            this.enemiesGroup = this.physics.add.group();
            this.bossGroup = this.physics.add.group();
            this.enemies = this.enemiesGroup; // Alias for compatibility
            
            // Create SpawnDirector
            this.spawnDirector = new SpawnDirector(this, {
                blueprints: this.blueprints,
                config: ConfigResolver,
                vfx: this.newVFXSystem,
                sfx: this.newSFXSystem
            });
            
            // Level progression tracking
            this.currentLevel = 1;
            this.maxLevel = 3; // We have level1, level2, level3
            
            // Load initial spawn table
            const spawnTable = `level${this.currentLevel}`;
            await this.spawnDirector.loadSpawnTable(spawnTable);
            this.spawnDirector.start({ scenarioId: spawnTable, ngPlusLevel: 0 });
            
            console.log(`✅ SpawnDirector started with table: ${spawnTable}`);
        } catch (error) {
            console.error('❌ Failed to initialize SpawnDirector:', error);
            // Don't throw - allow game to continue without spawns for testing
            console.warn('⚠️ Game will continue without enemy spawns');
        }
        
        // Framework Debug API
        try {
            this.frameworkDebug = new FrameworkDebugAPI(this);
            this.frameworkDebug.exposeGlobalAPI();
            console.log('✅ FrameworkDebugAPI initialized');
        } catch (error) {
            console.warn('Framework Debug API init failed:', error);
        }
        
        // Projectile System
        try {
            this.projectileSystem = new ProjectileSystem(this);
            console.log('✅ ProjectileSystem initialized');
        } catch (error) {
            console.error('❌ Failed to initialize ProjectileSystem:', error);
        }
        
        // Power-up VFX Manager (before PowerUpSystem)
        try {
            this.powerUpVFXManager = new PowerUpVFXManager(this);
            await this.powerUpVFXManager.initialize();
            console.log('✅ PowerUpVFXManager initialized');
        } catch (error) {
            console.error('❌ Failed to initialize PowerUpVFXManager:', error);
        }
        
        // Power-up System V2 - PR7 compliant
        try {
            this.powerUpSystem = new PowerUpSystemV2(this);
            this.powerUpSystem.setVFXManager(this.powerUpVFXManager);
            // Keep compatibility reference
            this.corePowerUpSystem = this.powerUpSystem;
            console.log('✅ PowerUpSystemV2 initialized (PR7 compliant)');
        } catch (error) {
            console.error('❌ Failed to initialize PowerUpSystemV2:', error);
        }
        
        // VFX and SFX already initialized at the beginning
        
        // Analytics System - silent mode
        try {
            this.coreAnalyticsSystem = new AnalyticsSystem(this, this.analyticsManager);
            console.log('✅ AnalyticsSystem initialized');
        } catch (error) {
            console.warn('⚠️ AnalyticsSystem init failed (silenced):', error.message);
            this.coreAnalyticsSystem = null;
        }
        
        // Telemetry and Debug
        try {
            this.telemetryLogger = new TelemetryLogger(this);
            console.log('📊 TelemetryLogger initialized');
            
            // Always create DebugOverlay (it starts hidden by default)
            if (!this.debugOverlay) {
                this.debugOverlay = new DebugOverlay(this);
                console.log('🐛 DebugOverlay initialized (F3 to toggle)');
            }
            
            this.phase5Debug = new Phase5Debug(this);
            console.log('🔧 Phase5Debug API initialized');
        } catch (error) {
            console.warn('Telemetry/Debug systems init failed:', error);
        }
    }
    
    createPlayerBlueprint() {
        // PR7: Load player blueprint from BlueprintLoader
        // No hardcoded values, everything from data
        
        if (this.blueprintLoader) {
            // Try to load actual player blueprint
            const playerBlueprint = this.blueprintLoader.get('player');
            if (playerBlueprint) {
                console.log('[GameScene] Loaded player blueprint from BlueprintLoader');
                
                // Generate texture if needed
                const textureKey = playerBlueprint.visuals?.textureKey || 'player';
                if (!this.textures.exists(textureKey)) {
                    this.generatePlayerTexture();
                }
                
                // Ensure display section exists for compatibility
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
        
        // PR7 VIOLATION: This fallback should not exist in production
        // Only here for emergency compatibility
        console.error('[GameScene] CRITICAL: Player blueprint not found! Using emergency fallback');
        
        // Generate player texture if it doesn't exist
        if (!this.textures.exists('player')) {
            this.generatePlayerTexture();
        }
        
        // Emergency fallback - uses ConfigResolver instead of GameConfig
        const CR = window.ConfigResolver;
        const fallbackHP = CR ? CR.get('player.stats.hp', { defaultValue: 100 }) : 100;
        const fallbackSpeed = CR ? CR.get('player.stats.speed', { defaultValue: 135 }) : 135;
        const fallbackDamage = CR ? CR.get('player.attack.damage', { defaultValue: 10 }) : 10;
        
        return {
            id: 'player_emergency',
            type: 'player',
            display: {
                texture: 'player',
                frame: 0,
                tint: 0x4169E1
            },
            stats: {
                hp: fallbackHP,
                speed: fallbackSpeed,
                size: 24
            },
            mechanics: {
                attack: {
                    intervalMs: 1000
                },
                projectile: {
                    ref: 'projectile.player_basic',
                    count: 1,
                    spreadDeg: 15,
                    stats: {
                        damage: fallbackDamage,
                        speed: 300,
                        range: 600
                    }
                },
                crit: {
                    chance: 0.05,
                    multiplier: 2
                },
                iFrames: {
                    ms: 1000
                }
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
                shoot: 'sfx.player.shoot',  // Use correct player shoot sound
                heal: 'sfx.player.heal'
            }
        };
    }
    
    /**
     * Generate player texture programmatically
     */
    generatePlayerTexture() {
        // PR7: Use values from player blueprint - správná metoda je .get(), ne .getBlueprint()
        const playerBlueprint = this.blueprintLoader?.get('player');
        const size = playerBlueprint?.visuals?.size?.w || 24;
        const color = playerBlueprint?.visuals?.tint || 0x4169E1;
        const graphics = this.add.graphics();
        
        // Draw player as a blue square with white cross
        graphics.fillStyle(color, 1);
        graphics.fillRect(2, 2, size - 4, size - 4);
        
        // Draw white cross
        graphics.fillStyle(0xffffff, 1);
        const crossThickness = 3;
        const crossLength = size - 8;
        
        // Horizontal bar of cross
        graphics.fillRect((size - crossLength) / 2, (size - crossThickness) / 2, crossLength, crossThickness);
        
        // Vertical bar of cross
        graphics.fillRect((size - crossThickness) / 2, (size - crossLength) / 2, crossThickness, crossLength);
        
        // Generate texture
        graphics.generateTexture('player', size, size);
        graphics.destroy();
        
        console.log('✅ Generated player texture (blue square with white cross)');
    }
    
    /**
     * Generate enemy texture programmatically
     */
    generateEnemyTexture(textureKey, color, size = 20, blueprint = null) {
        if (this.textures.exists(textureKey)) return;
        
        const graphics = this.add.graphics();
        
        // Check entity type from textureKey
        const isUnique = textureKey.includes('unique');
        const isBoss = textureKey.includes('boss');
        const isMiniboss = textureKey.includes('miniboss');
        
        // Get shape from blueprint or determine default
        let shape = 'circle';
        if (blueprint) {
            shape = ShapeRenderer.getShapeFromBlueprint(blueprint, 'circle');
        } else if (isBoss) {
            shape = 'star';
        } else if (isUnique || isMiniboss) {
            shape = 'diamond';
        }
        
        // Determine border color and width based on type
        let strokeColor = 0x000000;
        let strokeWidth = 2;
        if (isBoss) {
            strokeColor = 0xFFD700; // Gold border for bosses
            strokeWidth = 3;
        } else if (isUnique) {
            strokeColor = 0xFF00FF; // Purple border for unique
            strokeWidth = 3;
        } else if (isMiniboss) {
            strokeColor = 0xFF8800; // Orange border for miniboss
            strokeWidth = 3;
        }
        
        // Draw the shape using ShapeRenderer
        ShapeRenderer.drawShape(graphics, shape, size/2, size/2, size/2 - 2, {
            fillColor: color,
            fillAlpha: 1.0,
            strokeColor: strokeColor,
            strokeWidth: strokeWidth,
            strokeAlpha: 1.0
        });
        
        // Add visual indicator based on type
        if (isBoss) {
            // Boss: Star pattern - use circle for now (PR7: no hardcoded graphics)
            graphics.fillStyle(0xFFFFFF, 1.0);
            graphics.fillCircle(size/2, size/2, size/4);
        } else if (isUnique) {
            // Unique: Diamond pattern
            graphics.fillStyle(0xFFFFFF, 1.0);
            graphics.fillTriangle(size/2, size/2 - 4, size/2 - 4, size/2 + 4, size/2 + 4, size/2 + 4);
        } else if (isMiniboss) {
            // Miniboss: Cross pattern
            graphics.fillStyle(0xFFFFFF, 1.0);
            graphics.fillRect(size/2 - 1, size/2 - 6, 2, 12);
            graphics.fillRect(size/2 - 6, size/2 - 1, 12, 2);
        } else {
            // Regular: Simple dot
            graphics.fillStyle(0xFFFFFF, 1.0);
            graphics.fillCircle(size/2, size/2, 2);
        }
        
        // Generate texture
        graphics.generateTexture(textureKey, size, size);
        graphics.destroy();
        
        console.log(`✅ Generated enemy texture: ${textureKey} (${size}px, color: 0x${color.toString(16)}, shape: ${shape}, type: ${isBoss ? 'boss' : isUnique ? 'unique' : isMiniboss ? 'miniboss' : 'regular'})`);
    }
    
    /**
     * Generate placeholder enemy textures for HOTFIX V3
     */
    generateEnemyPlaceholderTextures() {
        console.log('[GameScene] Generating enemy placeholder textures...');
        
        // Create 'enemy.necrotic' texture (green square with white center, 16×16)
        if (!this.textures.exists('enemy.necrotic')) {
            const graphics = this.add.graphics();
            const size = 16;
            
            // Green square
            graphics.fillStyle(0x00AA00, 1);
            graphics.fillRect(0, 0, size, size);
            
            // White center
            graphics.fillStyle(0xffffff, 1);
            graphics.fillRect(size/4, size/4, size/2, size/2);
            
            graphics.generateTexture('enemy.necrotic', size, size);
            graphics.destroy();
            
            console.log('✅ Generated enemy.necrotic texture (16×16, green with white center)');
        }
        
        // Create 'enemy.swarm' texture (dark green square with white dot, 12×12)
        if (!this.textures.exists('enemy.swarm')) {
            const graphics = this.add.graphics();
            const size = 12;
            
            // Dark green square
            graphics.fillStyle(0x006600, 1);
            graphics.fillRect(0, 0, size, size);
            
            // White dot in center
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(size/2, size/2, 2);
            
            graphics.generateTexture('enemy.swarm', size, size);
            graphics.destroy();
            
            console.log('✅ Generated enemy.swarm texture (12×12, dark green with white dot)');
        }
        
        console.log('[GameScene] ✅ Enemy placeholder textures generated');
    }
    
    /**
     * Show critical error overlay - PR7 fail fast
     */
    showCriticalError(title, message) {
        // Create simple error overlay without rexUI
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;
        
        // Background
        const bg = this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.8);
        
        // Title
        const titleText = this.add.text(centerX, centerY - 50, title, {
            fontSize: '32px',
            fill: '#ff4444',
            fontFamily: 'Arial',
            align: 'center'
        }).setOrigin(0.5);
        
        // Message
        const messageText = this.add.text(centerX, centerY + 20, message, {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            align: 'center',
            wordWrap: { width: this.scale.width - 100 }
        }).setOrigin(0.5);
        
        // Instruction
        const instrText = this.add.text(centerX, centerY + 100, 'Refresh page to retry', {
            fontSize: '14px',
            fill: '#888888',
            fontFamily: 'Arial',
            align: 'center'
        }).setOrigin(0.5);
    }
    
    setupInput() {
        // Create unified input system
        this.inputKeys = this.input.keyboard.addKeys({
            up: 'W', down: 'S', left: 'A', right: 'D',
            up2: 'UP', down2: 'DOWN', left2: 'LEFT', right2: 'RIGHT'
        });
        
        console.log('✅ Input keys configured:', this.inputKeys);
        
        // ESC key for pause menu - using LiteUI
        this.escKey = this.input.keyboard.addKey('ESC');
        this.escKey.on('down', () => {
            console.log('[GameScene] ESC key DOWN event, pauseUI exists:', !!this.pauseUI, 'isGameOver:', this.isGameOver);
            
            // Pokud je otevřené highScoreModal, ignorovat
            if (this.highScoreModal) return;
            
            // Pokud je game over, vrátit se do menu
            if (this.isGameOver) {
                this.scene.start('MainMenu');
            }
            // ESC is now handled by GameUIScene for pause menu
        });
        
        // F3 handler already set up in isDev section above
        
        // F4: Run smoke test
        this.f4Key = this.input.keyboard.addKey('F4');
        this.f4Key.on('down', async () => {
            try {
                console.log('[SmokeTest] Running smoke test...');
                const smokeTest = new SmokeTest(this);
                const report = await smokeTest.run();
                
                if (report.summary.success) {
                    this.cameras.main.flash(500, 0, 255, 0, true);
                } else {
                    this.cameras.main.flash(500, 255, 0, 0, true);
                }
            } catch (error) {
                console.error('[SmokeTest] Failed to run:', error);
            }
        });
        
        // F7: Boss Playground (DEV mode only)
        if (window.DEV_MODE === true || window.location.search.includes('debug=true')) {
            this.f7Key = this.input.keyboard.addKey('F7');
            this.f7Key.on('down', () => {
                if (!this.devPlaygroundUI) {
                    // Lazy load Dev Playground UI
                    import('../ui/DevPlaygroundUI.js').then(module => {
                        this.devPlaygroundUI = new module.DevPlaygroundUI(this);
                        this.devPlaygroundUI.toggle();
                        console.log('🎯 Dev Playground UI initialized');
                    }).catch(err => {
                        console.error('Failed to load Boss Playground UI:', err);
                    });
                } else {
                    this.devPlaygroundUI.toggle();
                }
            });
            
            // F8: SFX Soundboard (DEV mode only)
            this.f8Key = this.input.keyboard.addKey('F8');
            this.f8Key.on('down', () => {
                if (!this.sfxSoundboard) {
                    // Lazy load SFX Soundboard
                    import('../ui/SFXSoundboard.js').then(module => {
                        this.sfxSoundboard = new module.SFXSoundboard(this);
                        this.sfxSoundboard.toggle();
                        console.log('🔊 SFX Soundboard initialized');
                    }).catch(err => {
                        console.error('Failed to load SFX Soundboard:', err);
                    });
                } else {
                    this.sfxSoundboard.toggle();
                }
            });
            
            // F9: Soft Refresh - Hot reload data (DEV mode only)
            this.f9Key = this.input.keyboard.addKey('F9');
            this.f9Key.on('down', async () => {
                if (!this.softRefresh) {
                    // Lazy load Soft Refresh system
                    try {
                        const module = await import('../core/utils/SoftRefresh.js');
                        this.softRefresh = new module.SoftRefresh(this);
                        
                        // Extend systems with update methods
                        if (this.blueprintLoader) {
                            module.extendBlueprintLoader(this.blueprintLoader);
                        }
                        if (this.spawnDirector) {
                            module.extendSpawnDirector(this.spawnDirector);
                        }
                        
                        console.log('🔄 Soft Refresh system initialized');
                    } catch (err) {
                        console.error('Failed to load Soft Refresh:', err);
                        return;
                    }
                }
                
                // Perform refresh
                console.log('🔄 [F9] Refreshing game data...');
                const changes = await this.softRefresh.refresh();
                
                // Update debug overlay if visible
                if (this.debugOverlay && this.debugOverlay.visible) {
                    const message = `Data refreshed: ${changes.added.length} added, ${changes.modified.length} modified`;
                    this.debugOverlay.flashMessage(message, 3000);
                }
            });
        }
        
        // ESC handler je už nastavený výše (řádek 632) - odstraňujeme duplicitu
        // Původní handler zde volal toggle() místo handleEscKey(), což způsobovalo problémy
        
        // R: Restart after game over
        this.rKey = this.input.keyboard.addKey('R');
        this.rKey.on('down', () => {
            if (this.highScoreModal) return;
            
            if (this.isGameOver) {
                this.scene.restart();
            }
        });
        
        // Mobile controls (načíst z SettingsManager)
        try {
            // Use SettingsManager if available, fallback to direct check
            const settingsManager = window.settingsManager || this.settingsManager;
            const mobileEnabled = settingsManager ? 
                settingsManager.get('controls.joystickEnabled') : false;
            const side = settingsManager ? 
                settingsManager.get('controls.joystickPosition') : 'left';
            
            if (mobileEnabled) {
                this.mobileControls = new MobileControlsManager(this, { side });
                this.mobileControls.enable();
            }
        } catch (_) {}
        
        // Set up scene shutdown listener for proper cleanup
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupSystems, this);
        this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupSystems, this);
    }
    
    setupCollisions() {
        // Player bullets vs enemies
        if (this.projectileSystem?.playerBullets) {
            this.physics.add.overlap(
                this.projectileSystem.playerBullets,
                this.enemies,
                (bullet, enemy) => this.handlePlayerBulletEnemyHit(bullet, enemy)
            );
        }
        
        // Enemy bullets vs player - PR7: Player is Sprite directly
        if (this.projectileSystem?.enemyBullets) {
            this.physics.add.overlap(
                this.projectileSystem.enemyBullets,
                this.player,
                (bullet, player) => this.handleEnemyBulletPlayerHit(bullet, player)
            );
        }
        
        // Player vs loot - PR7: Player is Sprite directly
        if (this.coreLootSystem) {
            this.physics.add.overlap(
                this.player,
                this.coreLootSystem.loot,
                (player, loot) => this.handlePlayerLootCollision(player, loot)
            );
        }
        
        // Player vs enemies - PR7: Player is Sprite directly
        this.physics.add.overlap(
            this.player,
            this.enemies,
            (player, enemy) => this.handlePlayerEnemyCollision(player, enemy)
        );
        
        console.log('✅ All collision detection setup complete');
    }
    
    /**
     * Handle player bullet hitting enemy
     */
    handlePlayerBulletEnemyHit(bullet, enemy) {
        if (!bullet.active || !enemy.active) return;
        
        // Get damage from bullet
        const damage = bullet.damage || 10;
        
        // Apply damage to enemy
        enemy.hp -= damage;
        
        // Play hit VFX
        if (this.newVFXSystem && enemy._vfx?.hit) {
            this.newVFXSystem.play(enemy._vfx.hit, enemy.x, enemy.y);
        }
        
        // Play hit SFX
        if (this.newSFXSystem && enemy._sfx?.hit) {
            this.newSFXSystem.play(enemy._sfx.hit);
        }
        
        // Check if enemy died
        if (enemy.hp <= 0) {
            this.handleEnemyDeath(enemy);
        }
        
        // Destroy bullet
        bullet.kill();
    }
    
    /**
     * Handle enemy bullet hitting player
     */
    handleEnemyBulletPlayerHit(bullet, player) {
        if (!bullet.active || !player.active) return;
        
        // Check if player can take damage
        if (player.canTakeDamage && !player.canTakeDamage()) return;
        
        // Get damage from bullet
        const damage = bullet.damage || 5;
        
        // Apply damage to player
        if (player.takeDamage) {
            player.takeDamage(damage);
        }
        
        // Destroy bullet
        bullet.kill();
    }
    
    /**
     * Handle player collecting loot
     */
    handlePlayerLootCollision(player, loot) {
        if (!loot.active || !player.active) return;
        
        // Process based on loot type (supports both new and legacy format)
        const lootType = loot.type || loot.data?.values?.type || loot.data?.list?.type;
        const amount = loot.value || loot.xpAmount || loot.healAmount || 
                      loot.data?.values?.amount || loot.data?.list?.amount || 1;
        
        switch (lootType) {
            case 'xp':
                // Add XP
                this.addXP(amount);
                
                // Play pickup SFX (from blueprint if available)
                if (loot._dropBlueprint?.sfx?.pickup) {
                    this.newSFXSystem?.play(loot._dropBlueprint.sfx.pickup);
                } else {
                    this.newSFXSystem?.play('sound/pickup.mp3');
                }
                break;
                
            case 'health':
                // Heal player
                if (this.player.heal) {
                    this.player.heal(amount);
                }
                
                // Play heal SFX
                if (loot._dropBlueprint?.sfx?.pickup) {
                    this.newSFXSystem?.play(loot._dropBlueprint.sfx.pickup);
                } else {
                    this.newSFXSystem?.play('sound/heal.mp3');
                }
                break;
                
            case 'metotrexat':
                // Special item - kill all enemies
                this.killAllEnemies();
                
                // Screen flash effect
                if (loot._dropBlueprint?.effect?.screenFlash) {
                    this.cameras.main.flash(200, 255, 255, 255);
                }
                
                // Play special SFX
                if (loot._dropBlueprint?.sfx?.pickup) {
                    this.newSFXSystem?.play(loot._dropBlueprint.sfx.pickup);
                } else {
                    this.newSFXSystem?.play('sound/metotrexat.mp3');
                }
                break;
                
            case 'energy':
            case 'research':
                // Special orbs - for now just add XP
                this.addXP(5);
                this.newSFXSystem?.play('sound/pickup.mp3');
                break;
                
            default:
                // Unknown type - try legacy compatibility
                if (loot.isXPOrb) {
                    this.addXP(loot.xpAmount || 1);
                    this.newSFXSystem?.play('sound/pickup.mp3');
                } else if (loot.isHealthOrb) {
                    if (this.player.heal) {
                        this.player.heal(loot.healAmount || 10);
                    }
                    this.newSFXSystem?.play('sound/heal.mp3');
                } else if (loot.isMetotrexat) {
                    this.killAllEnemies();
                    this.newSFXSystem?.play('sound/metotrexat.mp3');
                }
        }
        
        // Play pickup VFX if defined in blueprint
        if (loot._dropBlueprint?.vfx?.pickup && this.newVFXSystem) {
            this.newVFXSystem.play(loot._dropBlueprint.vfx.pickup, loot.x, loot.y);
        }
        
        // Destroy loot
        loot.destroy();
    }
    
    /**
     * Handle player touching enemy (contact damage)
     */
    handlePlayerEnemyCollision(player, enemy) {
        if (!enemy.active || !player.active) return;
        
        // Check if player can take damage
        if (player.canTakeDamage && !player.canTakeDamage()) return;
        
        // Get contact damage from enemy
        const damage = enemy.contactDamage || enemy.damage || 5;
        
        // Apply damage to player
        if (player.takeDamage) {
            player.takeDamage(damage);
        }
    }
    
    /**
     * Handle enemy death - process drops and cleanup
     */
    handleEnemyDeath(enemy) {
        if (!enemy || !enemy.active) return;
        
        // Mark as inactive first
        enemy.active = false;
        
        // Play death VFX
        if (this.newVFXSystem && enemy._vfx?.death) {
            this.newVFXSystem.play(enemy._vfx.death, enemy.x, enemy.y);
        }
        
        // Play death SFX
        if (this.newSFXSystem && enemy._sfx?.death) {
            this.newSFXSystem.play(enemy._sfx.death);
        }
        
        // Add XP from enemy stats
        if (enemy.xp) {
            this.addXP(enemy.xp);
        }
        
        // Process drops from blueprint
        if (enemy._blueprint?.drops && this.lootBootstrap?.lootSystemIntegration) {
            // Use LootSystemIntegration to handle drops
            this.lootBootstrap.lootSystemIntegration.handleEnemyDeath(enemy);
        } else if (enemy._blueprint?.drops && this.coreLootSystem) {
            // Fallback: Process drops directly
            const drops = enemy._blueprint.drops;
            drops.forEach(drop => {
                if (Math.random() < drop.chance) {
                    this.spawnDrop(drop.itemId, enemy.x, enemy.y);
                }
            });
        }
        
        // Update statistics
        this.gameStats.enemiesKilled++;
        this.gameStats.kills++;
        
        // Analytics
        if (this.analyticsManager) {
            this.analyticsManager.trackEnemyKill(enemy.blueprintId || 'unknown');
        }
        
        // Destroy enemy
        enemy.destroy();
    }
    
    /**
     * Add XP to player
     */
    addXP(amount) {
        if (!amount || amount <= 0) return;
        
        this.gameStats.xp += amount;
        
        // Check for level up
        while (this.gameStats.xp >= this.gameStats.xpToNext) {
            this.gameStats.xp -= this.gameStats.xpToNext;
            this.gameStats.level++;
            
            // Calculate next level requirement
            const CR = window.ConfigResolver;
            const xpBase = CR ? CR.get('progression.xp.baseRequirement', { defaultValue: 8 }) : 8;
            const xpGrowth = CR ? CR.get('progression.xp.growthFactor', { defaultValue: 1.5 }) : 1.5;
            this.gameStats.xpToNext = Math.floor(xpBase * Math.pow(xpGrowth, this.gameStats.level - 1));
            
            // Trigger level up
            this.levelUp();
        }
        
        // Update HUD
        if (this.unifiedHUD) {
            this.unifiedHUD.updateXP(this.gameStats.xp, this.gameStats.xpToNext);
            this.unifiedHUD.updateLevel(this.gameStats.level);
        }
    }
    
    /**
     * Spawn a drop item
     */
    spawnDrop(itemId, x, y) {
        if (!this.coreLootSystem || !itemId) return;
        
        // Get item blueprint
        const itemBlueprint = this.blueprintLoader?.get(itemId);
        if (!itemBlueprint) {
            console.warn(`[GameScene] Item blueprint not found: ${itemId}`);
            return;
        }
        
        // PR7: Use LootSystem to create the drop (single source of truth)
        this.coreLootSystem.createItemDrop(x, y, itemBlueprint);
    }
    
    /**
     * Kill all enemies (for special items)
     */
    killAllEnemies() {
        if (!this.enemies) return;
        
        this.enemies.getChildren().forEach(enemy => {
            if (enemy && enemy.active) {
                this.handleEnemyDeath(enemy);
            }
        });
        
        // Flash effect
        this.cameras.main.flash(500, 255, 255, 0);
    }
    
    async startGame() {
        this.levelStartTime = Date.now();
        console.log('🎮 Game started!');
    }
    
    update(time, delta) {
        if (this.isGameOver) return;
        
        // PR7: Only update game timer when not paused
        if (!this.isPaused) {
            // Update scene timer for UI
            this.sceneTimeSec += delta / 1000;
            this.gameStats.time = Math.floor(this.sceneTimeSec);
            
            // Update UI timer text (only when second changes)
            const currentSec = Math.floor(this.sceneTimeSec);
            if (this._lastTimeUi !== currentSec) {
                this._lastTimeUi = currentSec;
                const minutes = Math.floor(currentSec / 60);
                const seconds = currentSec % 60;
                const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                if (this.unifiedHUD && this.unifiedHUD.timeText) {
                    this.unifiedHUD.timeText.setText(timeStr);
                }
            }
            
            // Debug: Time tracking (less frequent) - commented out to reduce console spam
            // if (currentSec % 5 === 0 && this.sceneTimeSec % 5 < 0.1) {
            //     console.log('[Tick]', currentSec, 'scene running');
            // }
        }
        
        // Update player - PR7: Player uses preUpdate() internally
        // Player's preUpdate checks isPaused flag internally
        
        // Update ArmorShieldEffect for all armored enemies
        if (this.armorShieldEffect && !this.isPaused) {
            this.armorShieldEffect.update(time, delta);
        }
        
        // Update enemies
        if (!this.isPaused && this.enemiesGroup) {
            this.enemiesGroup.getChildren().forEach(enemy => {
                if (enemy.active && enemy.update) {
                    enemy.update(time, delta);
                }
            });
        }
        
        // Update bosses
        if (!this.isPaused && this.bossGroup) {
            this.bossGroup.getChildren().forEach(boss => {
                if (boss.active && boss.update) {
                    boss.update(time, delta);
                }
            });
        }
        
        // Update spawn director
        if (this.spawnDirector && !this.isPaused) {
            this.spawnDirector.update(delta);
        }
        
        // Update core systems
        if (this.projectileSystem && !this.isPaused) {
            this.projectileSystem.update(time, delta);
        }
        
        // Update PowerUp VFX Manager
        if (this.powerUpVFXManager && !this.isPaused) {
            this.powerUpVFXManager.update(time, delta);
        }
        
        // Update PowerUp System (for radiotherapy and other per-frame effects)
        if (this.corePowerUpSystem && !this.isPaused) {
            this.corePowerUpSystem.update(time, delta);
        }
        
        // Update debug overlay (visibility is checked inside update method)
        if (this.debugOverlay) {
            this.debugOverlay.update(time, delta);
        }
        
        // Update HUD
        if (this.unifiedHUD) {
            this.unifiedHUD.update();
            
            // Update game level display (stage/mission level, not XP level)
            if (this.unifiedHUD.levelText) {
                this.unifiedHUD.levelText.setText(`Level: ${this.gameStats.level} | Stage: ${this.currentLevel}`);
            }
        }
    }
    
    // Collision handlers
    handlePlayerBulletEnemyHit(bullet, enemy) {
        if (enemy.type === 'xp' || enemy.type === 'health' || enemy.type === 'metotrexat') {
            return;
        }
        
        if (!enemy.takeDamage || typeof enemy.takeDamage !== 'function') {
            return;
        }
        
        // Apply damage
        // Get damage from bullet first, then from player's projectile damage
        const damage = bullet.damage || this.player?.baseStats?.projectileDamage || 10;
        enemy.takeDamage(damage);
        
        // Check if enemy died
        if (enemy.hp <= 0 && enemy.active) {
            this.handleEnemyDeath(enemy);
        }
        
        // Handle explosive bullets from chemo_reservoir or explosive power-up
        if (this.player.getExplosionRadius && this.player.getExplosionRadius() > 0) {
            console.log('[DEBUG] Explosive bullet impact!');
            const explosionRadius = 50 + (this.player.getExplosionRadius ? this.player.getExplosionRadius() : 0);
            const explosionDamage = damage * 0.5 + (this.player.getExplosionDamage ? this.player.getExplosionDamage() : 0);
            
            // Create explosion effect
            if (this.projectileSystem && this.projectileSystem.createExplosion) {
                this.projectileSystem.createExplosion(
                    bullet.x, bullet.y, 
                    explosionDamage, 
                    explosionRadius, 
                    1  // Default level
                );
            }
        }
        
        // Handle piercing
        if (!bullet.piercing || bullet.hitCount >= bullet.maxPiercing) {
            bullet.destroy();
        } else {
            bullet.hitCount = (bullet.hitCount || 0) + 1;
        }
        
        // VFX/SFX - HOTFIX V3: Silent fail mode
        try {
            if (enemy._vfx?.hit && this.newVFXSystem) {
                this.newVFXSystem.play(enemy._vfx.hit, enemy.x, enemy.y);
            }
        } catch (error) {
            console.debug('[VFX] Failed to play hit effect, continuing:', error.message);
        }
        
        try {
            if (enemy._sfx?.hit && this.newSFXSystem) {
                this.newSFXSystem.play(enemy._sfx.hit);
            }
        } catch (error) {
            console.debug('[SFX] Failed to play hit sound, continuing:', error.message);
        }
    }
    
    handleEnemyBulletPlayerHit(bullet, player) {
        const damage = bullet.damage || 10;
        this.player.takeDamage(damage);
        
        if (this.player.hp <= 0 && !this.isGameOver) {
            this.gameOver();
        }
        
        bullet.destroy();
    }
    
    // Removed duplicate handlePlayerLootCollision - using the one at line 1004
    
    handlePlayerEnemyCollision(player, enemy) {
        if (enemy.type === 'xp' || enemy.type === 'health' || enemy.type === 'metotrexat') {
            return;
        }
        
        const damage = enemy.damage || 10;
        this.player.takeDamage(damage);
        
        if (this.player.hp <= 0 && !this.isGameOver) {
            this.gameOver();
        }
    }
    
    /**
     * Create enemy from blueprint - called by SpawnDirector
     * @param {string} blueprintId - Enemy blueprint ID
     * @param {Object} options - Spawn options
     */
    createEnemyFromBlueprint(blueprintId, options = {}) {
        const blueprint = this.blueprints.get(blueprintId);
        
        if (!blueprint) {
            console.error(`[GameScene] Blueprint not found: ${blueprintId}`);
            return null;
        }
        
        // Determine spawn position
        const x = options.x || Phaser.Math.Between(50, this.scale.width - 50);
        const y = options.y || Phaser.Math.Between(50, this.scale.height - 50);
        
        let entity;
        
        // Get visual properties from blueprint (PR7 compliant)
        // First check visuals section, then fallback to other sources
        const visuals = blueprint.visuals || {};
        const color = visuals.tint || this.getColorFromBlueprint(blueprint);
        // PR7: Size should come from stats.size (the single source of truth)
        const size = blueprint.stats?.size || visuals.size?.w || (blueprint.type === 'boss' ? 60 : 20);
        const textureKey = visuals.textureKey || blueprintId; // Use visuals.textureKey if available
        
        // Generate texture for ALL entity types (boss, unique, miniboss, enemy)
        console.log(`[createEnemyFromBlueprint] Creating ${blueprintId} (${blueprint.type}):`, {
            textureKey, color: '0x' + color.toString(16), size
        });
        
        this.generateEnemyTexture(textureKey, color, size, blueprint);
        
        if (blueprint.type === 'boss') {
            // Create boss with properly generated texture
            // PR7: Don't override stats values - they should come directly from blueprint
            const bossConfig = {
                ...blueprint.stats,  // This includes hp, damage, speed, size, armor, xp
                ...blueprint.mechanics,  // Additional mechanics
                texture: textureKey,
                color: color,
                // Don't override size - it's already in stats
                sfx: blueprint.sfx,
                vfx: blueprint.vfx
            };
            
            entity = new Boss(this, x, y, blueprint, options);
            this.bossGroup.add(entity);
            this.enemies.add(entity);  // IMPORTANT: Add boss to enemies group for collision detection
            this.currentBoss = entity;
            
            // Set boss depth
            entity.setDepth(this.DEPTH_LAYERS.ENEMIES + 100);
            
            // Ensure boss uses the generated texture
            entity.setTexture(textureKey);
            entity.setDisplaySize(size, size);
            
            // Show boss health bar
            if (this.unifiedHUD?.showBoss) {
                const bossDisplayName = blueprint.display?.devNameFallback || entity.bossName || blueprintId;
                this.unifiedHUD.showBoss(bossDisplayName, entity.hp, entity.maxHp);
            }
        } else {
            // Create regular enemy (includes unique, miniboss, elite)
            // PR7: Don't override stats values - they should come directly from blueprint
            const enemyConfig = {
                ...blueprint.stats,  // This includes hp, damage, speed, size, armor, xp
                ...blueprint.mechanics,  // Additional mechanics
                texture: textureKey,
                color: color,
                // Don't override size - it's already in stats
                sfx: blueprint.sfx,
                vfx: blueprint.vfx,
                ai: blueprint.ai, // PR7 Compliant: Pass AI configuration from blueprint
                // Special flags based on type
                isElite: options.elite || blueprint.type === 'elite',
                isUnique: blueprint.type === 'unique',
                isMiniboss: blueprint.type === 'miniboss'
            };
            
            entity = new Enemy(this, x, y, blueprintId, enemyConfig);
            
            // PR7: Don't override size - Enemy constructor already sets it correctly
            // Only ensure texture is set if Enemy constructor didn't set it
            if (!entity.texture || entity.texture.key !== textureKey) {
                entity.setTexture(textureKey);
            }
            
            // Add special visual indicators for unique/miniboss
            if (blueprint.type === 'unique') {
                // Add purple glow for unique enemies
                entity.setTint(0xFF00FF);
            } else if (blueprint.type === 'miniboss') {
                // Add orange glow for minibosses
                entity.setTint(0xFF8800);
            }
            
            this.enemiesGroup.add(entity);
            
            // Set enemy depth
            entity.setDepth(this.DEPTH_LAYERS.ENEMIES);
            
            // Debug: Check enemy texture
            console.log('[Factory] enemy sprite key:', entity.texture?.key || 'NO_TEXTURE', 'size:', size, 'type:', blueprint.type);
        }
        
        // Setup collision with player - handled globally in setupCollisions()
        // Individual collisions not needed as all enemies use same group
        
        // Analytics
        if (this.analyticsManager) {
            this.analyticsManager.trackEnemySpawn(blueprintId);
        }
        
        return entity;
    }
    
    handleEnemyDeath(enemy) {
        try {
            // a) Kill count and score update
            this.gameStats.kills = (this.gameStats.kills || 0) + 1;
            this.gameStats.enemiesKilled++;
            this.gameStats.score += enemy.xp * 10;
            
            // b) Safe analytics with proper checks
            const enemy_type = enemy.blueprintId || enemy.type || 'unknown';
            if (this.analyticsManager && typeof this.analyticsManager.trackEvent === 'function') {
                this.analyticsManager.trackEvent('enemy_killed', {
                    enemy_type,
                    level: this.gameStats?.level ?? 1
                });
            }
            
            // c) Handle boss death
            if (enemy instanceof Boss) {
                this.gameStats.bossesDefeated++;
                this.currentBoss = null;
                
                // Don't auto level up after boss - that's handled by boss:die event
                // which transitions to next stage
            }
            
            // d) Loot system - use LootDropManager to get drops
            let lootDropped = false;
            
            if (this.lootDropManager && typeof this.lootDropManager.getDropsForEnemy === 'function') {
                try {
                    const drops = this.lootDropManager.getDropsForEnemy(enemy, {
                        level: this.gameStats?.level ?? 1,
                        position: { x: enemy.x, y: enemy.y }
                    });
                    
                    // Process each drop
                    if (drops && drops.length > 0) {
                        drops.forEach(drop => {
                            this.spawnLootDrop(drop, enemy.x, enemy.y);
                        });
                        lootDropped = true;
                    }
                } catch (error) {
                    console.debug('[Loot] Failed to get drops:', error.message);
                }
            }
            
            // HOTFIX: Always drop XP regardless of loot system status
            // This ensures players can level up even if loot system fails
            const xpAmount = enemy.xp || enemy.data?.xp || enemy.stats?.xp || 3; // Default to 3 XP
            this.dropSimpleXP(enemy.x, enemy.y, xpAmount);
            
        } catch (error) {
            console.warn('[GameScene] enemy death handling failed:', error);
            // Fallback: ensure at least XP drops
            this.dropSimpleXP(enemy.x, enemy.y, 1);
        } finally {
            // Always destroy the enemy sprite
            if (enemy && enemy.destroy) {
                enemy.destroy(true);
            }
        }
    }
    
    handleMetotrexatPickup() {
        console.log('🧪 METOTREXAT! Eliminating all enemies!');
        
        // Flash effect
        this.cameras.main.flash(500, 255, 255, 0);
        
        // Destroy all enemies
        const enemies = this.enemies.getChildren();
        enemies.forEach(enemy => {
            if (enemy.active && !(enemy instanceof Boss)) {
                this.handleEnemyDeath(enemy);
            }
        });
        
        // Play sound from powerup blueprint
        const powerupBlueprint = this.blueprintLoader?.getBlueprint(powerUp?.id);
        const pickupSFX = powerupBlueprint?.sfx?.pickup;
        if (pickupSFX && this.sfxSystem) {
            this.sfxSystem.play(pickupSFX);
        } else if (this.sfxSystem) {
            console.warn('[GameScene] Missing pickup sound in powerup blueprint:', powerUp?.id);
        }
    }
    
    /**
     * Spawn loot drop from LootDropManager
     */
    spawnLootDrop(drop, x, y) {
        // Support both old format (ref) and new format (itemId)
        const dropId = drop.itemId || drop.ref;
        if (!drop || !dropId) return;
        
        // Parse drop reference (e.g., "item.xp_small")
        const dropType = dropId.replace('item.', '').replace('drop.', '');
        const qty = drop.quantity || drop.qty || 1;
        
        // Get blueprint for this drop
        const dropBlueprint = this.blueprints?.get(dropId);
        
        // Determine what to spawn based on drop type
        if (dropType.includes('xp')) {
            // XP drops - use qty as XP amount
            const xpAmount = dropBlueprint?.stats?.value || qty;
            this.dropSimpleXP(x, y, xpAmount);
        } else if (dropType.includes('health')) {
            // Health drops
            this.spawnHealthPickup(x, y, qty);
        } else if (dropType === 'metotrexat') {
            // Special Metotrexat drop
            this.spawnMetotrexatPickup(x, y);
        } else if (dropType === 'energy_cell') {
            // PR7: Energy cell drop - for now just give XP as placeholder
            // TODO: Implement proper energy cell mechanics
            this.dropSimpleXP(x, y, qty * 2); // Double XP for energy cells
        } else {
            // Unknown drop type - fallback to XP
            console.debug(`[GameScene] Unknown drop type: ${dropType}, falling back to XP`);
            this.dropSimpleXP(x, y, qty);
        }
    }
    
    /**
     * Spawn health pickup
     */
    spawnHealthPickup(x, y, amount) {
        const healthOrb = this.physics.add.sprite(x, y, '__DEFAULT');
        
        // Generate health orb texture if not exists
        if (!this.textures.exists('simple_health_orb')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0xff0000, 1); // Red
            graphics.fillCircle(6, 6, 6);
            graphics.fillStyle(0xffffff, 1); // White cross
            graphics.fillRect(5, 2, 2, 8);
            graphics.fillRect(2, 5, 8, 2);
            graphics.generateTexture('simple_health_orb', 12, 12);
            graphics.destroy();
        }
        
        healthOrb.setTexture('simple_health_orb');
        healthOrb.setScale(1);
        healthOrb.setDepth(15);
        healthOrb.body.setCircle(6);
        
        // Store health amount
        healthOrb.healAmount = amount;
        healthOrb.isHealthOrb = true;
        
        // Simple physics
        healthOrb.setVelocity(
            Phaser.Math.Between(-30, 30),
            Phaser.Math.Between(-50, -20)
        );
        healthOrb.setBounce(0.3);
        healthOrb.setDrag(200);
        
        // Collision with player
        this.physics.add.overlap(this.player, healthOrb, (player, orb) => {
            this.player.heal(orb.healAmount);
            orb.destroy();
            console.log(`Collected ${orb.healAmount} health`);
        });
        
        // Auto-cleanup after 10 seconds
        this.time.delayedCall(10000, () => {
            if (healthOrb && healthOrb.active) {
                healthOrb.destroy();
            }
        });
    }
    
    /**
     * Spawn Metotrexat special pickup
     */
    spawnMetotrexatPickup(x, y) {
        const metotrexat = this.physics.add.sprite(x, y, '__DEFAULT');
        
        // Generate Metotrexat texture if not exists
        if (!this.textures.exists('metotrexat_orb')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0xff00ff, 1); // Magenta
            graphics.fillCircle(8, 8, 8);
            graphics.fillStyle(0xffffff, 1); // White M
            graphics.fillText('M', 4, 11, { fontSize: '10px' });
            graphics.generateTexture('metotrexat_orb', 16, 16);
            graphics.destroy();
        }
        
        metotrexat.setTexture('metotrexat_orb');
        metotrexat.setScale(1);
        metotrexat.setDepth(15);
        metotrexat.body.setCircle(8);
        
        // Store type
        metotrexat.isMetotrexat = true;
        
        // Pulsing effect
        this.tweens.add({
            targets: metotrexat,
            scale: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        // Collision with player
        this.physics.add.overlap(this.player, metotrexat, (player, orb) => {
            this.handleMetotrexatPickup();
            orb.destroy();
        });
        
        // Auto-cleanup after 10 seconds
        this.time.delayedCall(10000, () => {
            if (metotrexat && metotrexat.active) {
                metotrexat.destroy();
            }
        });
    }
    
    /**
     * Drop simple XP orb - PR7 compliant version using blueprints
     */
    dropSimpleXP(x, y, amount) {
        // PR7: Use blueprint-based tier system
        // Optimal decomposition: 10 XP orbs for large amounts, 5 for medium, 1 for small
        const orbs = this._decomposeXPAmount(amount);
        
        // Drop each orb with slight spread
        orbs.forEach((orbData, index) => {
            const offsetX = (Math.random() - 0.5) * 20;
            const offsetY = (Math.random() - 0.5) * 20;
            
            this._dropTieredXPOrb(x + offsetX, y + offsetY, orbData.tier, orbData.value);
        });
    }
    
    /**
     * Decompose XP amount into optimal orb combination
     */
    _decomposeXPAmount(amount) {
        const orbs = [];
        let remaining = amount;
        
        // Calculate optimal decomposition (10, 5, 1)
        const largeOrbs = Math.floor(remaining / 10);
        remaining = remaining % 10;
        
        const mediumOrbs = Math.floor(remaining / 5);
        remaining = remaining % 5;
        
        const smallOrbs = remaining;
        
        // Add large orbs (10 XP each)
        for (let i = 0; i < largeOrbs; i++) {
            orbs.push({ tier: 'large', value: 10 });
        }
        
        // Add medium orbs (5 XP each)
        for (let i = 0; i < mediumOrbs; i++) {
            orbs.push({ tier: 'medium', value: 5 });
        }
        
        // Add small orbs (1 XP each)
        for (let i = 0; i < smallOrbs; i++) {
            orbs.push({ tier: 'small', value: 1 });
        }
        
        return orbs;
    }
    
    /**
     * Drop a tiered XP orb using blueprint data
     */
    _dropTieredXPOrb(x, y, tier, value) {
        // Get blueprint for this tier
        const blueprintId = `item.xp_${tier}`;
        const blueprint = this.blueprintLoader?.get(blueprintId);
        
        if (!blueprint) {
            console.warn(`[GameScene] XP blueprint not found: ${blueprintId}, falling back to legacy`);
            return this._dropLegacyXPOrb(x, y, value);
        }
        
        // Get color from blueprint (now properly loaded as hex)
        const orbColor = blueprint.display?.color || 0x00E8FC;
        const orbSize = tier === 'large' ? 10 : tier === 'medium' ? 8 : 6;
        
        // Create XP orb sprite
        const xpOrb = this.physics.add.sprite(x, y, '__DEFAULT');
        // Set XP orb depth (below enemies)
        xpOrb.setDepth(this.DEPTH_LAYERS.ENEMIES - 100);
        
        // Generate texture for this tier if not exists
        const textureName = `xp_orb_${tier}_${orbColor}`;
        if (!this.textures.exists(textureName)) {
            const graphics = this.add.graphics();
            graphics.fillStyle(orbColor, 1);
            graphics.fillCircle(orbSize, orbSize, orbSize);
            graphics.fillStyle(0xffffff, 0.8); // White center
            graphics.fillCircle(orbSize, orbSize, orbSize * 0.5);
            
            // Add tier indicator
            if (tier === 'large') {
                graphics.lineStyle(2, 0xffffff, 0.9);
                graphics.strokeCircle(orbSize, orbSize, orbSize - 1);
            } else if (tier === 'medium') {
                graphics.lineStyle(1, 0xffffff, 0.7);
                graphics.strokeCircle(orbSize, orbSize, orbSize - 1);
            }
            
            graphics.generateTexture(textureName, orbSize * 2, orbSize * 2);
            graphics.destroy();
        }
        
        xpOrb.setTexture(textureName);
        xpOrb.setScale(1);
        xpOrb.setDepth(15); // Above enemies but below UI
        xpOrb.body.setCircle(orbSize);
        
        // Store XP amount and type
        xpOrb.xpAmount = value;
        xpOrb.isXPOrb = true;
        xpOrb.tier = tier;
        
        // Physics with tier-based variations
        const speedMultiplier = tier === 'large' ? 0.7 : tier === 'medium' ? 0.85 : 1;
        xpOrb.setVelocity(
            Phaser.Math.Between(-30, 30) * speedMultiplier, 
            Phaser.Math.Between(-50, -20) * speedMultiplier
        );
        xpOrb.setBounce(0.3);
        xpOrb.setDrag(200);
        
        // Add bobbing animation based on tier
        this.tweens.add({
            targets: xpOrb,
            scaleX: tier === 'large' ? 1.15 : tier === 'medium' ? 1.1 : 1.05,
            scaleY: tier === 'large' ? 1.15 : tier === 'medium' ? 1.1 : 1.05,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // PR7: Check XP magnet through coreLootSystem
        if (this.coreLootSystem?.magnetLevel > 0) {
            this.time.delayedCall(500, () => {
                if (xpOrb && xpOrb.active) {
                    this.attractXPOrb(xpOrb);
                }
            });
        }
        
        // Add to simple collision detection
        this.physics.add.overlap(this.player, xpOrb, (player, orb) => {
            this.addXP(orb.xpAmount);
            
            // Play pickup sound based on tier
            if (this.newSFXSystem) {
                const sfxId = `sfx.player.xp.${orb.tier}`;
                this.newSFXSystem.play(sfxId);
            }
            
            orb.destroy();
        });
        
        // Auto-cleanup based on blueprint lifetime
        const lifetime = blueprint.stats?.lifetime || 20000;
        this.time.delayedCall(lifetime, () => {
            if (xpOrb && xpOrb.active) {
                // Fade out warning
                this.tweens.add({
                    targets: xpOrb,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => xpOrb.destroy()
                });
            }
        });
    }
    
    /**
     * Legacy fallback for XP orb
     */
    _dropLegacyXPOrb(x, y, value) {
        const xpOrb = this.physics.add.sprite(x, y, '__DEFAULT');
        // Set XP orb depth (below enemies)
        xpOrb.setDepth(this.DEPTH_LAYERS.ENEMIES - 100);
        
        if (!this.textures.exists('simple_xp_orb')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0x00E8FC, 1); // Use correct cyan color
            graphics.fillCircle(6, 6, 6);
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(6, 6, 3);
            graphics.generateTexture('simple_xp_orb', 12, 12);
            graphics.destroy();
        }
        
        xpOrb.setTexture('simple_xp_orb');
        xpOrb.setScale(1);
        xpOrb.setDepth(15);
        xpOrb.body.setCircle(6);
        xpOrb.xpAmount = value;
        xpOrb.isXPOrb = true;
        
        xpOrb.setVelocity(
            Phaser.Math.Between(-30, 30), 
            Phaser.Math.Between(-50, -20)
        );
        xpOrb.setBounce(0.3);
        xpOrb.setDrag(200);
        
        this.physics.add.overlap(this.player, xpOrb, (player, orb) => {
            this.addXP(orb.xpAmount);
            orb.destroy();
        });
        
        this.time.delayedCall(10000, () => {
            if (xpOrb && xpOrb.active) {
                xpOrb.destroy();
            }
        });
    }
    
    /**
     * Attract XP orb to player (for XP magnet power-up)
     */
    attractXPOrb(orb) {
        if (!orb || !orb.active || !this.player || !this.player.active) return;
        
        const attractTween = this.tweens.add({
            targets: orb,
            x: this.player.x,
            y: this.player.y,
            duration: 800,
            ease: 'Power2',
            onComplete: () => {
                if (orb && orb.active) {
                    this.addXP(orb.xpAmount);
                    orb.destroy();
                    // Auto-collected XP
                }
            }
        });
    }
    
    addXP(amount) {
        // Apply XP scaling based on time alive
        const CR = this.configResolver || window.ConfigResolver;
        const scalingEnabled = CR?.get('loot.xpScaling.enabled', { defaultValue: true });
        
        if (scalingEnabled) {
            const growthPerMinute = CR?.get('loot.xpScaling.growthPerMinute', { defaultValue: 0.03 });
            const maxMultiplier = CR?.get('loot.xpScaling.maxMultiplier', { defaultValue: 2.0 });
            
            const minutesAlive = (this.time.now - this.startTime) / 60000;
            const scalingMultiplier = Math.min(1 + (growthPerMinute * minutesAlive), maxMultiplier);
            amount = Math.round(amount * scalingMultiplier);
        }
        
        this.gameStats.xp += amount;
        this.player.xp = this.gameStats.xp;
        
        // Check level up - only process ONE level at a time to prevent stacking
        if (this.gameStats.xp >= this.gameStats.xpToNext && !this.isPaused) {
            // Store excess XP
            const excessXP = this.gameStats.xp - this.gameStats.xpToNext;
            this.gameStats.xp = 0;  // Reset to 0, will add excess after level up
            this.player.xp = this.gameStats.xp;
            
            this.gameStats.level++;
            
            // PR7: Use ConfigResolver for XP calculation with softcap
            const CR = this.configResolver || window.ConfigResolver;
            const baseReq = CR.get('progression.xp.baseRequirement', { defaultValue: 8 });
            const multiplier = CR.get('progression.xp.scalingMultiplier', { defaultValue: 1.18 });
            const softcapStart = CR.get('progression.xp.softcapStart', { defaultValue: 21 });
            const postSlope = CR.get('progression.xp.postSlope', { defaultValue: 0.5 });
            
            // Apply softcap formula
            let effExp = this.gameStats.level - 1;
            if (this.gameStats.level >= softcapStart) {
                const pre = softcapStart - 2;  // exponent at (softcapStart-1)
                const inc = this.gameStats.level - softcapStart + 1;  // steps past softcap
                effExp = pre + postSlope * inc;  // flattened exponent growth
            }
            
            this.gameStats.xpToNext = Math.floor(
                baseReq * Math.pow(multiplier, effExp)
            );
            
            // Store excess XP to be added after unpausing
            this.pendingXP = excessXP;
            
            this.levelUp();
        }
    }
    
    /**
     * PR7: Set pause state - now used by LiteUI
     */
    setPaused(paused) {
        this.isPaused = paused;
        
        if (paused) {
            // Pause projectiles
            if (this.projectileSystem) {
                this.projectileSystem.pauseAll();
            }
            console.log('⏸️ Game paused');
        } else {
            // Resume projectiles
            if (this.projectileSystem) {
                this.projectileSystem.resumeAll();
            }
            console.log('🎮 Game resumed');
        }
    }
    
    
    /**
     * Get power-up options for level-up selection
     */
    getPowerUpOptions() {
        // Enhanced fallback options with medical theme
        const defaultOptions = [
            {
                id: 'powerup.damage_boost',
                name: '🧬 Cytotoxická terapie',
                description: 'Zvyšuje účinnost léčby proti rakovinným buňkám. Více poškození všech útoků.',
                stats: '+25% DMG',
                rarity: 'common',
                icon: '💉',
                level: 0
            },
            {
                id: 'powerup.speed_boost', 
                name: '⚡ Metabolický boost',
                description: 'Urychluje metabolismus pro rychlejší pohyb a reakce. Vyšší rychlost.',
                stats: '+15% SPD',
                rarity: 'common',
                icon: '🏃‍♂️',
                level: 0
            },
            {
                id: 'powerup.max_hp',
                name: '❤️ Imunitní posílení',
                description: 'Posiluje imunitní systém pro lepší odolnost. Více životů.',
                stats: '+20 HP',
                rarity: 'uncommon',
                icon: '🛡️',
                level: 0
            }
        ];
        
        // If we have a proper power-up system, get real options from it
        if (this.corePowerUpSystem && typeof this.corePowerUpSystem._generatePowerUpOptions === 'function') {
            const systemOptions = this.corePowerUpSystem._generatePowerUpOptions();
            if (systemOptions && systemOptions.length > 0) {
                // Map system options to LiteUI format
                return systemOptions.map(opt => ({
                    id: opt.id,
                    name: opt.name || opt.id.replace('powerup.', '').replace(/_/g, ' '),
                    description: opt.description || 'Vylepšení pro Marda',
                    stats: opt.value ? `+${opt.value}` : opt.stats || '',
                    rarity: opt.rarity || 'common',
                    icon: opt.icon || '⚡',
                    level: opt.level || 0
                }));
            }
        }
        
        return defaultOptions;
    }
    
    
    levelUp() {
        console.log(`🎊 LEVEL UP! Level ${this.gameStats.level}`);
        
        // Heal player
        this.player.heal(20);
        
        // Get power-up options
        const options = this.getPowerUpOptions();
        
        // Emit event for UI scene to show power-up selection
        // The UI scene will pause this scene
        console.log('[GameScene] Emitting game-levelup event with options:', options);
        this.game.events.emit('game-levelup', options);
        
        // Power-up selection is handled by the global listener set up in create()
        
        // VFX
        this.cameras.main.flash(500, 255, 255, 0);
        
        // Analytics - use safe method call
        if (this.analyticsManager && typeof this.analyticsManager.trackEvent === 'function') {
            this.analyticsManager.trackEvent('level_up', {
                level: this.gameStats.level,
                time: Math.floor((Date.now() - this.levelStartTime) / 1000)
            });
        }
    }
    
    async gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        
        console.log('💀 GAME OVER!');
        
        // Stop spawning
        if (this.spawnDirector) {
            this.spawnDirector.stop();
        }
        
        // Pause physics
        this.physics.pause();
        this.time.paused = true;
        
        // Calculate survival time
        const survivalTime = Math.floor((this.time.now - this.startTime) / 1000);
        
        // Emit game-over event for GameUIScene to handle
        this.game.events.emit('game-over', {
            survivalTime: survivalTime,
            level: this.gameStats?.level || 1,
            kills: this.gameStats?.enemiesKilled || 0,
            score: this.gameStats?.score || 0
        });
        // Game Over is now handled by GameUIScene with LiteUI
        
        // Keyboard shortcuts are now handled by GameUIScene/GameOverUI
        // Don't add them here to avoid conflicts
        
        // Save high score
        const finalScore = this.gameStats.score;
        const isHighScore = this.highScoreManager.isHighScore(finalScore);
        
        if (isHighScore) {
            this.highScoreModal = new HighScoreModal(
                this,
                finalScore,
                async (name) => {
                    await this.highScoreManager.addScore(name, finalScore);
                    await this.globalHighScoreManager.submitScore(name, finalScore);
                    this.highScoreModal = null;
                }
            );
        }
        
        // Analytics
        await this.analyticsManager?.endSession(
            'game_over',
            this.gameStats,
            { reason: 'player_death' }
        );
    }
    
    async transitionToNextLevel() {
        // Check if we have more levels
        if (this.currentLevel >= this.maxLevel) {
            console.log('🎉 Všechny levely dokončeny! VÝHRA!');
            // Show victory screen instead of continuing
            this.showVictory();
            return;
        }
        
        // Increment level
        this.currentLevel++;
        console.log(`📈 Přechod na Level ${this.currentLevel}`);
        
        // Show level transition UI
        this.showLevelTransition();
        
        // Stop current spawning
        if (this.spawnDirector) {
            this.spawnDirector.stop();
        }
        
        // Clear remaining enemies with delay for visual effect
        this.time.delayedCall(1000, async () => {
            // Clear all enemies
            this.clearAllEnemies();
            
            // Load next spawn table
            const nextSpawnTable = `level${this.currentLevel}`;
            console.log(`📋 Načítám spawn tabulku: ${nextSpawnTable}`);
            
            try {
                await this.spawnDirector.loadSpawnTable(nextSpawnTable);
                
                // Reset spawn director state but keep player progress
                this.spawnDirector.stats = {
                    totalSpawned: 0,
                    spawnedByType: new Map(),
                    eliteSpawnCount: 0,
                    uniqueSpawnCount: 0,
                    bossSpawnCount: 0,
                    spawnedTypes: new Set()
                };
                
                // Start new level
                this.spawnDirector.start({ 
                    scenarioId: nextSpawnTable, 
                    ngPlusLevel: 0 
                });
                
                console.log(`✅ Level ${this.currentLevel} započat!`);
                
                // Hide level transition UI after delay
                this.time.delayedCall(2000, () => {
                    this.hideLevelTransition();
                });
                
            } catch (error) {
                console.error(`❌ Chyba při načítání levelu ${this.currentLevel}:`, error);
                // Fallback - continue with current level
                this.spawnDirector.start();
            }
        });
    }
    
    showLevelTransition() {
        // Create level transition overlay
        const { width, height } = this.scale.gameSize;
        
        if (!this.levelTransitionContainer) {
            this.levelTransitionContainer = this.add.container(width / 2, height / 2);
            this.levelTransitionContainer.setDepth(1000);
            
            // Background overlay
            const overlay = this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.7);
            
            // Level text
            this.levelTransitionText = this.add.text(0, -50, '', {
                fontSize: '48px',
                fontFamily: 'Arial',
                color: '#00ff00',
                stroke: '#ffffff',
                strokeThickness: 4
            }).setOrigin(0.5);
            
            // Sub text
            this.levelTransitionSubText = this.add.text(0, 20, '', {
                fontSize: '24px',
                fontFamily: 'Arial',
                color: '#ffffff'
            }).setOrigin(0.5);
            
            this.levelTransitionContainer.add([overlay, this.levelTransitionText, this.levelTransitionSubText]);
        }
        
        // Update text
        this.levelTransitionText.setText(`LEVEL ${this.currentLevel}`);
        this.levelTransitionSubText.setText('Připrav se na další výzvu!');
        
        // Show with fade in
        this.levelTransitionContainer.setAlpha(0);
        this.levelTransitionContainer.setVisible(true);
        
        this.tweens.add({
            targets: this.levelTransitionContainer,
            alpha: 1,
            duration: 500
        });
        
        // Heal player a bit as reward
        if (this.player && this.player.active) {
            const healAmount = Math.floor(this.player.maxHp * 0.3); // Heal 30% HP
            this.player.heal(healAmount);
            console.log(`💚 Hráč vyléčen o ${healAmount} HP jako odměna za dokončení levelu`);
        }
    }
    
    hideLevelTransition() {
        if (!this.levelTransitionContainer) return;
        
        this.tweens.add({
            targets: this.levelTransitionContainer,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                this.levelTransitionContainer.setVisible(false);
            }
        });
    }
    
    clearAllEnemies() {
        // Clear all enemy groups
        const enemyGroups = [this.enemiesGroup, this.bossGroup];
        
        for (const group of enemyGroups) {
            if (group) {
                const enemies = group.getChildren();
                // Process all enemies, not just active ones
                for (const enemy of enemies) {
                    if (enemy) {
                        // Play death effect only for active enemies
                        if (enemy.active && enemy.playVFX) {
                            enemy.playVFX('death');
                        }
                        // Give XP for cleared active enemies
                        if (enemy.active && enemy.xp && this.addXP) {
                            this.addXP(Math.floor(enemy.xp * 0.5)); // Half XP for auto-cleared
                        }
                        // Mark as inactive first
                        enemy.active = false;
                        enemy.visible = false;
                        if (enemy.body) {
                            enemy.body.enable = false;
                        }
                        // Destroy enemy completely
                        enemy.destroy();
                    }
                }
                // Clear the group completely
                group.clear(true, true);
            }
        }
        
        // Also clear any projectiles
        if (this.projectileSystem) {
            this.projectileSystem.clearAllProjectiles();
        }
        
        console.log('🧹 Všichni nepřátelé a projektily vyčištěni');
    }
    
    showVictory() {
        // Stop spawning
        if (this.spawnDirector) {
            this.spawnDirector.stop();
        }
        
        // Clear enemies
        this.clearAllEnemies();
        
        // Create victory screen
        const { width, height } = this.scale.gameSize;
        
        const victoryContainer = this.add.container(width / 2, height / 2);
        victoryContainer.setDepth(1000);
        
        // Background
        const bg = this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.8);
        
        // Victory text
        const victoryText = this.add.text(0, -100, '🎉 VÍTĚZSTVÍ! 🎉', {
            fontSize: '64px',
            fontFamily: 'Arial',
            color: '#ffd700',
            stroke: '#ffffff',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Stats
        const statsText = this.add.text(0, 0, 
            `Dokončeny všechny levely!\n\n` +
            `Celkové skóre: ${this.gameStats.score}\n` +
            `Čas: ${Math.floor(this.gameStats.time / 60)}:${(this.gameStats.time % 60).toString().padStart(2, '0')}\n` +
            `Zničeno buněk: ${this.gameStats.kills}`,
            {
                fontSize: '24px',
                fontFamily: 'Arial',
                color: '#ffffff',
                align: 'center'
            }
        ).setOrigin(0.5);
        
        // Continue text
        const continueText = this.add.text(0, 150, 
            'Stiskni R pro novou hru nebo ESC pro menu',
            {
                fontSize: '20px',
                fontFamily: 'Arial',
                color: '#aaaaaa'
            }
        ).setOrigin(0.5);
        
        victoryContainer.add([bg, victoryText, statsText, continueText]);
        
        // Add keyboard handlers
        this.input.keyboard.once('keydown-R', () => {
            this.restartGame();
        });
        
        this.input.keyboard.once('keydown-ESC', () => {
            this.returnToMenu();
        });
        
        // Save as high score
        const finalScore = this.gameStats.score;
        if (this.highScoreManager?.isHighScore(finalScore)) {
            this.highScoreModal = new HighScoreModal(
                this,
                finalScore,
                async (name) => {
                    await this.highScoreManager.addScore(name, finalScore);
                    await this.globalHighScoreManager?.submitScore(name, finalScore);
                    this.highScoreModal = null;
                }
            );
        }
    }
    
    updateTime() {
        if (!this.isPaused && !this.isGameOver) {
            this.gameStats.time++;
        }
    }
    
    handleResize(gameSize) {
        const { width, height } = gameSize;
        
        // Update both cameras
        if (this.mainCam) {
            this.mainCam.setSize(width, height);
        }
        
        if (this.uiCam) {
            this.uiCam.setSize(width, height);
        }
        
        // Update UI components
        if (this.unifiedHUD) {
            this.unifiedHUD.onResize?.(width, height);
        }
        
        if (this.pauseMenu) {
            this.pauseMenu.onResize?.(width, height);
        }
        
        if (this.mobileControls?.enabled) {
            this.mobileControls.handleResize(width, height);
        }
    }
    
    /**
     * PR7: REMOVED - Player handles its own shooting
     * @deprecated
     */
    updatePlayerShooting(delta) {
        // PR7: This method is no longer needed
        // Player.js handles shooting internally in preUpdate
        return;
    }
    
    /**
     * Find nearest enemy for auto-aim
     */
    findNearestEnemy() {
        const enemies = this.enemies.getChildren();
        let closestEnemy = null;
        let closestDist = Infinity;
        
        enemies.forEach(enemy => {
            if (enemy.active) {
                const dist = Phaser.Math.Distance.Between(
                    this.player.x, this.player.y,
                    enemy.x, enemy.y
                );
                if (dist < closestDist) {
                    closestDist = dist;
                    closestEnemy = enemy;
                }
            }
        });
        
        return closestEnemy;
    }
    
    
    getColorFromBlueprint(blueprint) {
        // Check multiple sources for color
        const displayColor = blueprint.display?.color || blueprint.graphics?.tint || '#FF0000';
        
        // If it's already a number, return it
        if (typeof displayColor === 'number') {
            return displayColor;
        }
        
        // Convert hex string to number
        if (typeof displayColor === 'string') {
            // Remove # and parse as hex
            const cleanHex = displayColor.replace('#', '');
            const parsed = parseInt(cleanHex, 16);
            
            // Check if parsing was successful
            if (!isNaN(parsed)) {
                return parsed;
            }
        }
        
        // If graphics.tint exists as fallback
        if (blueprint.graphics?.tint && typeof blueprint.graphics.tint === 'number') {
            return blueprint.graphics.tint;
        }
        
        return 0xFF0000; // Default red
    }
    
    /**
     * Restart the game - backward compatibility for keyboard shortcuts
     */
    restartGame() {
        console.log('[GameScene] Restarting game...');
        
        // Clean up systems FIRST before any scene operations
        this.cleanupSystems();
        
        // Clean up player first to prevent destroy errors
        if (this.player && !this.player.active) {
            // Player is already inactive from die(), just remove references
            this.player = null;
        }
        
        // Clean up all enemies
        if (this.enemiesGroup) {
            this.enemiesGroup.clear(true, true);
        }
        
        // Clean up all bosses
        if (this.bossGroup) {
            this.bossGroup.clear(true, true);
        }
        
        // Stop all sounds
        this.sound.stopAll();
        
        // Reset analytics if available
        if (this.analyticsManager && this.analyticsManager.resetSession) {
            this.analyticsManager.resetSession();
        }
        
        // Now stop and restart scenes
        this.scene.stop('GameUIScene');
        this.scene.restart();
    }
    
    /**
     * Return to main menu - backward compatibility for keyboard shortcuts
     */
    returnToMenu() {
        console.log('[GameScene] Returning to main menu...');
        
        // Clean up systems FIRST before any scene operations
        this.cleanupSystems();
        
        // Clean up player first to prevent destroy errors
        if (this.player && !this.player.active) {
            // Player is already inactive from die(), just remove references
            this.player = null;
        }
        
        // Clean up all enemies
        if (this.enemiesGroup) {
            this.enemiesGroup.clear(true, true);
        }
        
        // Clean up all bosses
        if (this.bossGroup) {
            this.bossGroup.clear(true, true);
        }
        
        // Stop all sounds
        this.sound.stopAll();
        
        // Now stop scenes and transition
        this.scene.stop('GameUIScene');
        this.scene.stop('GameScene');
        this.scene.start('MainMenu');
    }
    
    /**
     * Clean up all systems and components
     */
    cleanupSystems() {
        // Clean up PowerUpSystemV2 and its modal
        if (this.powerUpSystem && typeof this.powerUpSystem.destroy === 'function') {
            this.powerUpSystem.destroy();
            this.powerUpSystem = null;
        }
        
        // Clean up LiteUI components
        if (this.powerUpUI && typeof this.powerUpUI.destroy === 'function') {
            this.powerUpUI.destroy();
            this.powerUpUI = null;
        }
        
        // gameOverUI is handled by GameUIScene, no need to clean up here
        
        if (this.pauseUI && typeof this.pauseUI.destroy === 'function') {
            this.pauseUI.destroy();
            this.pauseUI = null;
        }
        
        // Clean up old pause menu if it still exists
        if (this.pauseMenu && typeof this.pauseMenu.destroy === 'function') {
            this.pauseMenu.destroy();
            this.pauseMenu = null;
        }
        
        if (this.gameOverModal && typeof this.gameOverModal.destroy === 'function') {
            this.gameOverModal.destroy();
            this.gameOverModal = null;
        }
        
        // Clean up other systems
        if (this.newVFXSystem && typeof this.newVFXSystem.destroy === 'function') {
            this.newVFXSystem.destroy();
            this.newVFXSystem = null;
        }
        
        if (this.newSFXSystem && typeof this.newSFXSystem.destroy === 'function') {
            this.newSFXSystem.destroy();
            this.newSFXSystem = null;
        }
        
        // Klávesy nečisti manuálně – Phaser si je zlikviduje sám.
        // Jen uvolni reference, ať GC může pracovat.
        // IMPORTANT: Do NOT call destroy on keys, just null the references
        ['escKey', 'f4Key', 'f7Key', 'f8Key', 'f9Key', 'rKey'].forEach(k => {
            if (this[k]) {
                // Remove all event listeners but don't destroy the key
                this[k].removeAllListeners();
                this[k] = null;
            }
        });
        
        // Also clean up the main input keys
        if (this.inputKeys) {
            // Don't destroy, just null the reference
            this.inputKeys = null;
        }
        
        console.log('[GameScene] Systems cleaned up');
    }
}