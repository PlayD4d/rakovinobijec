import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { UnifiedHUD } from '../ui/UnifiedHUD.js';
import { MobileControlsManager } from '../managers/MobileControlsManager.js';

// LiteUI komponenty
// GameUIScene zvládne všechny UI overlays
import { HighScoreManager } from '../managers/HighScoreManager.js';
import { GlobalHighScoreManager } from '../managers/GlobalHighScoreManager.js';
import { AnalyticsManager } from '../managers/AnalyticsManager.js';
import { SupabaseClient } from '../utils/supabaseClient.js';
import { UIThemeUtils } from '../ui/UITheme.js';
import { HighScoreModal } from '../ui/HighScoreModal.js';

// Základní systémy - pouze moderní PR7 implementace
import { SimpleLootSystem } from '../core/systems/SimpleLootSystem.js';
import { PowerUpSystem } from '../core/systems/powerup/PowerUpSystem.js';
import { ShapeRenderer } from '../core/utils/ShapeRenderer.js';
import { installDevConsole } from '../core/utils/devConsole.js';
import { EventBus } from '../core/events/EventBus.js';
import { KeyboardManager } from '../core/input/KeyboardManager.js';
import { SimplifiedVFXSystem } from '../core/vfx/SimplifiedVFXSystem.js';
// SimplifiedAudioSystem will be imported dynamically in initializeDataDrivenSystems()
import { initSessionLogger, getSessionLogger } from '../core/logging/SessionLogger.js';
// Registry removed - using simplified systems directly
// AnalyticsSystem removed - functionality merged into AnalyticsManager
import { displayResolver } from '../core/blueprints/DisplayResolver.js';
// ConfigResolver je nyní inicializován globálně v main.js
import { TelemetryLogger } from '../core/TelemetryLogger.js';
import { DebugOverlay } from '../utils/DebugOverlay.js';
import { Phase5Debug } from '../core/debug/Phase5Debug.js';
import { SmokeTest } from '../utils/SmokeTest.js';
// getMusicManager je nyní poskytován SimplifiedAudioSystem

// Data-driven systémy - vše řízeno blueprinty
import { BlueprintLoader } from '../core/data/BlueprintLoader.js';
import { SpawnDirector } from '../core/spawn/SpawnDirector.js';

// Store BlueprintLoader for synchronous access in preload
window.BlueprintLoaderModule = { BlueprintLoader };
import { FrameworkDebugAPI } from '../core/FrameworkDebugAPI.js';
import { ProjectileSystem } from '../core/systems/ProjectileSystem.js';
// Modifiers are applied directly in Player.js
// PowerUpVFXManager sloučen do SimplifiedVFXSystem
import { GraphicsFactory } from '../core/graphics/GraphicsFactory.js';
import { setupCollisions } from '../handlers/setupCollisions.js';
import { UpdateManager } from '../managers/UpdateManager.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        
        // Hlavní herní entity
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
        this.analyticsManager = null;
        this.musicManager = null;
        
        // Data-driven systémy (PR7 kompatibilní)
        this.blueprints = null; // Zkratka pro blueprintLoader
        this.blueprintLoader = null; // Načítá všechna data z /data/blueprints/
        this.spawnDirector = null; // Řídí spawning nepřátel podle tabulek
        this.frameworkDebug = null; // Debug API pro vývoj
        this.projectileSystem = null; // Správa projektilů s zero-GC poolingem
        this.lootSystem = null; // Systém dropů a odměn
        this.powerUpSystem = null; // Systém vylepšení hráče
        this.vfxSystem = null; // Unified VFX system (particles, power-ups, all effects)
        this.audioSystem = null; // Unified audio system (SFX + Music)
        
        // Compatibility aliases (for legacy code)
        this.lootSystem = null;
        this.powerUpSystem = null;
        this.vfxSystem = null;
        this.audioSystem = null;
        // Modifiers handled directly in Player.js
        
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
        this.keyboardManager = null; // Bude inicializován v create()
    }
    
    /**
     * Preload metoda - načte všechny zvukové soubory automaticky z blueprintů a konfigurace
     * PR7 kompatibilní - 100% data-driven hybrid loading
     * IMPORTANT: Phaser does NOT support async preload - must be synchronous!
     */
    preload() {
        console.log('[GameScene] Preload phase starting...');
        
        // 1. Initialize BlueprintLoader synchronously (basic setup only)
        this._initializeBlueprintLoaderSync();
        
        // 2. Then preload all audio based on config (blueprints not loaded yet)
        this._preloadAllAudio();
        
        console.log('[GameScene] Preload phase completed');
    }
    
    /**
     * Inicializuje BlueprintLoader synchronně v preload fázi
     * Note: Blueprint scanning will be deferred to create() phase
     */
    _initializeBlueprintLoaderSync() {
        try {
            console.log('[GameScene] Creating BlueprintLoader instance in preload...');
            this.blueprints = new BlueprintLoader(this.game);
            this.blueprintLoader = this.blueprints; // Alias for compatibility
            // Note: We can't call async init() here, so blueprint scanning is deferred
            // Audio will use fallback manifest from main_config
            console.log('✅ BlueprintLoader instance created (full init deferred to create)');
        } catch (error) {
            console.warn('⚠️ BlueprintLoader creation failed, using fallback audio only:', error);
            this.blueprintLoader = null;
            this.blueprints = null;
        }
    }
    
    /**
     * Complete BlueprintLoader initialization (async) in create phase
     * This was deferred from preload because Phaser doesn't support async preload
     */
    async _initializeBlueprintLoader() {
        // Skip if already fully loaded
        if (this.blueprintLoader && this.blueprintLoader.loaded) {
            console.log('[GameScene] BlueprintLoader already fully loaded');
            return;
        }
        
        try {
            console.log('[GameScene] Completing BlueprintLoader initialization...');
            
            // Create instance if needed (shouldn't happen if preload worked)
            if (!this.blueprintLoader) {
                this.blueprints = new BlueprintLoader(this.game);
                this.blueprintLoader = this.blueprints;
            }
            
            // Complete the async initialization
            await this.blueprintLoader.init();
            
            console.log('✅ BlueprintLoader fully initialized with', this.blueprintLoader.blueprints.size, 'blueprints');
            
            // Log summary of loaded content
            const categories = ['enemy', 'boss', 'powerup', 'projectile'];
            categories.forEach(cat => {
                const count = this.blueprintLoader.getAll(cat).length;
                if (count > 0) {
                    console.log(`   - ${cat}: ${count} blueprints`);
                }
            });
            
        } catch (error) {
            console.error('❌ BlueprintLoader init failed:', error);
            // Keep the instance but it won't be fully functional
            // Game will continue with fallback audio and limited functionality
        }
    }
    
    /**
     * Hybrid audio loading systém
     * In preload phase: Uses main_config fallback only (blueprints not loaded yet)
     * Future enhancement: Cache blueprint audio paths for next session
     */
    _preloadAllAudio() {
        const audioSources = new Set(); // Automatická deduplikace
        
        // 1. MAIN SOURCE: Core audio from main_config
        // (In preload phase, this is our only source since blueprints aren't loaded yet)
        this._extractAudioFromScenes(audioSources);
        
        // 2. TRY BLUEPRINTS: Usually won't work in preload, but kept for future caching
        this._scanBlueprintsForAudio(audioSources);
        
        // 3. Preload všech unikátních souborů
        const totalFiles = audioSources.size;
        let loadedCount = 0;
        
        audioSources.forEach(path => {
            const key = path.replace(/[^a-zA-Z0-9]/g, '_');
            
            if (!this.cache.audio.has(key)) {
                this.load.audio(key, path);
                console.log(`[AudioPreload] Loading: ${path} -> ${key}`);
                loadedCount++;
            } else {
                console.log(`[AudioPreload] Already cached: ${path}`);
            }
        });
        
        console.log(`[AudioPreload] Prepared ${loadedCount}/${totalFiles} audio files for loading`);
    }
    
    /**
     * Extrahuje audio soubory z main_config.json5 scenes konfigurace + fallback manifest
     * Slouží jako fallback pro core hudbu a základní SFX
     */
    _extractAudioFromScenes(audioSet) {
        const CR = window.ConfigResolver;
        if (!CR) {
            console.warn('[AudioPreload] ConfigResolver not available for scene audio');
            return;
        }
        
        // 1. Načíst hudbu ze scenes
        const scenes = CR.get('audio.scenes', { defaultValue: {} });
        
        Object.entries(scenes).forEach(([sceneName, sceneConfig]) => {
            // Jednoduchá hudba (backgroundMusic)
            if (sceneConfig.backgroundMusic) {
                audioSet.add(sceneConfig.backgroundMusic);
                console.log(`[AudioPreload] Scene '${sceneName}' music: ${sceneConfig.backgroundMusic}`);
            }
            
            // Array hudby (tracks)
            if (sceneConfig.tracks && Array.isArray(sceneConfig.tracks)) {
                sceneConfig.tracks.forEach(track => {
                    audioSet.add(track);
                    console.log(`[AudioPreload] Scene '${sceneName}' track: ${track}`);
                });
            }
        });
        
        // 2. Načíst fallback SFX manifest (pokud blueprint scanning selže)
        const fallbackManifest = CR.get('audio.fallbackManifest', { defaultValue: [] });
        let fallbackCount = 0;
        
        fallbackManifest.forEach(path => {
            if (path && typeof path === 'string') {
                audioSet.add(path);
                fallbackCount++;
                console.log(`[AudioPreload] Fallback SFX: ${path}`);
            }
        });
        
        if (fallbackCount > 0) {
            console.log(`[AudioPreload] Added ${fallbackCount} fallback SFX files from main_config`);
        }
    }
    
    /**
     * Skenuje všechny blueprinty pro audio odkazy
     * PRIORITY: Blueprint audio má přednost před main_config
     * NOTE: In preload phase, blueprints won't be loaded yet, so this is mainly for future use
     */
    _scanBlueprintsForAudio(audioSet) {
        // In preload phase, blueprints aren't loaded yet
        // This function is kept for future use when we implement caching
        if (!this.blueprintLoader || !this.blueprintLoader.loaded) {
            console.log('[AudioPreload] Blueprints not loaded yet (expected in preload phase)');
            return;
        }
        
        try {
            const blueprints = this.blueprintLoader.getAllBlueprints();
            let blueprintCount = 0;
            let audioCount = 0;
            
            // getAllBlueprints() returns an object, so we need Object.values() to iterate
            Object.values(blueprints).forEach(blueprint => {
                blueprintCount++;
                
                // SFX z blueprintů (sfx.hit, sfx.death, sfx.spawn, atd.)
                if (blueprint.sfx && typeof blueprint.sfx === 'object') {
                    Object.entries(blueprint.sfx).forEach(([event, path]) => {
                        if (path && typeof path === 'string' && path.includes('.mp3')) {
                            audioSet.add(path);
                            audioCount++;
                            console.log(`[AudioPreload] Blueprint SFX '${blueprint.id || 'unknown'}': ${event} -> ${path}`);
                        }
                    });
                }
                
                // Hudba z boss fightů, spawn levelů atd.
                if (blueprint.music) {
                    if (typeof blueprint.music === 'string') {
                        audioSet.add(blueprint.music);
                        audioCount++;
                        console.log(`[AudioPreload] Blueprint music '${blueprint.id || 'unknown'}': ${blueprint.music}`);
                    } else if (Array.isArray(blueprint.music)) {
                        blueprint.music.forEach(track => {
                            if (track && typeof track === 'string') {
                                audioSet.add(track);
                                audioCount++;
                                console.log(`[AudioPreload] Blueprint track '${blueprint.id || 'unknown'}': ${track}`);
                            }
                        });
                    }
                }
                
                // Audio odkazy v jiných sekcích (pro budoucí rozšíření)
                if (blueprint.audio && typeof blueprint.audio === 'object') {
                    Object.values(blueprint.audio).forEach(path => {
                        if (path && typeof path === 'string' && (path.includes('.mp3') || path.includes('.ogg'))) {
                            audioSet.add(path);
                            audioCount++;
                        }
                    });
                }
            });
            
            console.log(`[AudioPreload] Scanned ${blueprintCount} blueprints, found ${audioCount} audio references`);
            
        } catch (error) {
            console.error('[AudioPreload] Error scanning blueprints for audio:', error);
        }
    }
    
    async create() {
        console.log('🎮 GameScene starting - DATA-DRIVEN MODE ONLY');
        
        // Complete BlueprintLoader initialization (async) that was deferred from preload
        await this._initializeBlueprintLoader();
        
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
            LOOT: 500,          // XP orbs and health pickups
            ENEMIES: 1000,
            BOSSES: 1100,       // Bosses slightly above enemies
            PLAYER: 2000,
            PROJECTILES: 3000,
            EFFECTS: 4000,      // VFX effects
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
        
        // Player is ready - PowerUpSystem can now interact with it
        
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
            // Music will be handled by SimplifiedAudioSystem
            console.log('[GameScene] Music will be initialized with audio system');
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
            if (selection && this.powerUpSystem) {
                this.powerUpSystem.applyPowerUp(selection.id, (selection.level || 0) + 1);
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
        
        // Initialize UpdateManager for centralized update orchestration
        this.initializeUpdateManager();
        
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
            this.vfxSystem = new SimplifiedVFXSystem(this);
            await this.vfxSystem.initialize();
            this.vfxSystem = this.vfxSystem; // Compatibility alias
            console.log('✅ Simplified VFX System initialized');
            
            // Initialize shield effects for armor and player shield
            const { ArmorShieldEffect } = await import('../core/vfx/effects/ArmorShieldEffect.js');
            this.armorShieldEffect = new ArmorShieldEffect(this);
            console.log('✅ ArmorShieldEffect initialized');
            
            // Initialize ShieldEffect for player shield power-up
            const { ShieldEffect } = await import('../core/vfx/effects/ShieldEffect.js');
            this.playerShieldEffect = new ShieldEffect(this, 'player', {
                radius: 35,
                color: 0x00ffff,
                lineWidth: 3,
                pulseSpeed: 0.003
            });
            console.log('✅ Player ShieldEffect initialized');
        } catch (error) {
            console.warn('VFX System init failed:', error);
        }
        
        // Audio System - create new instance for GameScene (PR7: no singleton issues)
        try {
            console.log('[GameScene] Creating SimplifiedAudioSystem for GameScene...');
            const { SimplifiedAudioSystem } = await import('../core/audio/SimplifiedAudioSystem.js');
            this.audioSystem = new SimplifiedAudioSystem(this);
            await this.audioSystem.initialize();
            
            // Start game music with category system
            this.audioSystem.switchMusicCategory('game', {
                fadeIn: 1000,
                random: true  // Start with random track
            });
            console.log('✅ Simplified Audio System initialized for GameScene');
        } catch (error) {
            console.error('Audio System init failed:', error);
            // Continue without audio rather than crash
            this.audioSystem = null;
        }
        
        // Keyboard Manager - centralized keyboard handling (PR7)
        try {
            this.keyboardManager = new KeyboardManager(this, this.eventBus);
            this.setupKeyboardEvents(); // Setup EventBus listeners for keyboard events
            this.keyboardManager.setupGameKeys();
            this.keyboardManager.setupDebugKeys();
            this.keyboardManager.setupUIKeys();
            console.log('✅ KeyboardManager initialized');
        } catch (error) {
            console.error('KeyboardManager init failed:', error);
            this.keyboardManager = null;
        }
        
        // Blueprint Loader - verify it's loaded
        if (!this.blueprintLoader || !this.blueprintLoader.loaded) {
            console.error('❌ BlueprintLoader not fully loaded');
            // Continue anyway with limited functionality
            console.warn('⚠️ Game will run with limited blueprint functionality');
        } else {
            console.log('✅ BlueprintLoader fully loaded with', this.blueprintLoader.blueprints.size, 'blueprints');
        }
        
        // Simple Loot System will be initialized after PowerUpManager
        
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
                vfx: this.vfxSystem,
                sfx: this.audioSystem
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
        
        // Power-up System - PR7 compliant (uses SimplifiedVFXSystem now)
        try {
            this.powerUpSystem = new PowerUpSystem(this);
            this.powerUpSystem.setVFXManager(this.vfxSystem); // Use unified VFX system
            // Keep compatibility reference
            this.corePowerUpSystem = this.powerUpSystem;
            console.log('✅ PowerUpSystem initialized (PR7 compliant)');
        } catch (error) {
            console.error('❌ Failed to initialize PowerUpSystem:', error);
        }
        
        // Simple Loot System (works with PowerUpSystem for PR7 compliance)
        try {
            this.lootSystem = new SimpleLootSystem(this);
            this.coreLootSystem = this.lootSystem; // Alias for compatibility
            console.log('✅ SimpleLootSystem initialized');
        } catch (error) {
            console.warn('⚠️ SimpleLootSystem failed:', error.message);
            this.lootEnabled = false;
            this.lootSystem = null;
            this.coreLootSystem = null;
        }
        
        // VFX and SFX already initialized at the beginning
        
        // Analytics EventBus integration - merged from AnalyticsSystem
        if (this.analyticsManager) {
            try {
                this.analyticsManager.connectEventBus(this.eventBus, this);
                console.log('✅ AnalyticsManager EventBus connected');
            } catch (error) {
                console.warn('⚠️ AnalyticsManager EventBus connection failed (silenced):', error.message);
            }
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
        
        // All keyboard shortcuts now handled by KeyboardManager + EventBus
        // ESC - handled by GameUIScene via KeyboardManager 'ui.escape' event
        // F3 - debug overlay toggle via KeyboardManager 'debug.overlay.toggle' event
        // F4 - enemy spawn via KeyboardManager 'debug.enemy.spawn' event  
        // F6 - missing assets toggle via KeyboardManager 'debug.missing-assets.toggle' event
        // F7 - boss spawn via KeyboardManager 'debug.boss.spawn' event
        // F8 - SFX soundboard via KeyboardManager 'debug.sfx.soundboard' event
        // F9 - VFX test via KeyboardManager 'debug.vfx.test' event
        // R - game restart via KeyboardManager 'game.restart' event
        
        // Only movement keys remain as direct input for performance
        // WASD/Arrow keys are checked in update() loop for player movement
        
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
        // Delegate all collision setup to centralized handler
        setupCollisions(this);
    }
    
    /**
     * Initialize UpdateManager and register all update tasks
     */
    initializeUpdateManager() {
        this.updateManager = new UpdateManager(this);
        // All update tasks are registered in UpdateManager.registerGameSceneTasks()
        this.updateManager.registerGameSceneTasks(this);
    }
    
    // Collision handlers moved to setupCollisions.js
    
    /**
     * Handle player collecting loot (DEPRECATED - now handled by SimpleLootSystem)
     */
    handlePlayerLootCollision_OLD(player, loot) {
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
                    this.audioSystem?.play(loot._dropBlueprint.sfx.pickup);
                } else {
                    this.audioSystem?.play('sound/pickup.mp3');
                }
                break;
                
            case 'health':
                // Heal player
                if (this.player.heal) {
                    this.player.heal(amount);
                }
                
                // Play heal SFX
                if (loot._dropBlueprint?.sfx?.pickup) {
                    this.audioSystem?.play(loot._dropBlueprint.sfx.pickup);
                } else {
                    this.audioSystem?.play('sound/heal.mp3');
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
                    this.audioSystem?.play(loot._dropBlueprint.sfx.pickup);
                } else {
                    this.audioSystem?.play('sound/metotrexat.mp3');
                }
                break;
                
            case 'energy':
            case 'research':
                // Special orbs - for now just add XP
                this.addXP(5);
                this.audioSystem?.play('sound/pickup.mp3');
                break;
                
            default:
                // Unknown type - try legacy compatibility
                if (loot.isXPOrb) {
                    this.addXP(loot.xpAmount || 1);
                    this.audioSystem?.play('sound/pickup.mp3');
                } else if (loot.isHealthOrb) {
                    if (this.player.heal) {
                        this.player.heal(loot.healAmount || 10);
                    }
                    this.audioSystem?.play('sound/heal.mp3');
                } else if (loot.isMetotrexat) {
                    this.killAllEnemies();
                    this.audioSystem?.play('sound/metotrexat.mp3');
                }
        }
        
        // Play pickup VFX if defined in blueprint
        if (loot._dropBlueprint?.vfx?.pickup && this.vfxSystem) {
            this.vfxSystem.play(loot._dropBlueprint.vfx.pickup, loot.x, loot.y);
        }
        
        // Destroy loot
        loot.destroy();
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
        if (!this.lootSystem || !itemId) return;
        
        // Get item blueprint
        const itemBlueprint = this.blueprintLoader?.get(itemId);
        if (!itemBlueprint) {
            console.warn(`[GameScene] Item blueprint not found: ${itemId}`);
            return;
        }
        
        // PR7: Use LootSystem to create the drop (single source of truth)
        this.lootSystem.createItemDrop(x, y, itemBlueprint);
    }
    
    /**
     * Create XP orbs based on XP amount
     * Uses tiered system: small (1 XP), medium (5 XP), large (10 XP)
     */
    createXPOrbs(x, y, totalXP) {
        if (!totalXP || totalXP <= 0) return;
        
        // Calculate orb distribution
        const largeOrbs = Math.floor(totalXP / 10);
        const remaining = totalXP % 10;
        const mediumOrbs = Math.floor(remaining / 5);
        const smallOrbs = remaining % 5;
        
        // Spawn large XP orbs (10 XP each)
        for (let i = 0; i < largeOrbs; i++) {
            const offsetX = (Math.random() - 0.5) * 30;
            const offsetY = (Math.random() - 0.5) * 30;
            if (this.lootSystem) {
                this.lootSystem.createDrop(x + offsetX, y + offsetY, 'item.xp_large');
            }
        }
        
        // Spawn medium XP orbs (5 XP each)
        for (let i = 0; i < mediumOrbs; i++) {
            const offsetX = (Math.random() - 0.5) * 30;
            const offsetY = (Math.random() - 0.5) * 30;
            if (this.lootSystem) {
                this.lootSystem.createDrop(x + offsetX, y + offsetY, 'item.xp_medium');
            }
        }
        
        // Spawn small XP orbs (1 XP each)
        for (let i = 0; i < smallOrbs; i++) {
            const offsetX = (Math.random() - 0.5) * 30;
            const offsetY = (Math.random() - 0.5) * 30;
            if (this.lootSystem) {
                this.lootSystem.createDrop(x + offsetX, y + offsetY, 'item.xp_small');
            }
        }
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
        
        // Delegate all update logic to UpdateManager
        if (this.updateManager) {
            this.updateManager.update(time, delta);
        }
    }
    
    // All collision handlers have been moved to setupCollisions.js
    
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
            entity.setDepth(this.DEPTH_LAYERS.BOSSES);
            
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
                drops: blueprint.drops, // IMPORTANT: Include drops for loot system
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
        if (!enemy || !enemy.active) return;
        
        // Mark as inactive first
        enemy.active = false;
        
        // Clean up ALL VFX effects immediately before any other cleanup
        if (enemy.cleanupAllVFX && typeof enemy.cleanupAllVFX === 'function') {
            enemy.cleanupAllVFX();
        }
        
        try {
            // Play death VFX
            if (this.vfxSystem && enemy._vfx?.death) {
                this.vfxSystem.play(enemy._vfx.death, enemy.x, enemy.y);
            }
            
            // Play death SFX
            if (this.audioSystem && enemy._sfx?.death) {
                this.audioSystem.play(enemy._sfx.death);
            }
            
            // Create XP orbs based on enemy XP value
            if (enemy.xp && enemy.xp > 0) {
                this.createXPOrbs(enemy.x, enemy.y, enemy.xp);
            }
            
            // Handle drops using SimpleLootSystem (for consumables only, not XP)
            if (this.lootSystem) {
                try {
                    this.lootSystem.handleEnemyDeath(enemy);
                } catch (error) {
                    console.debug('[Loot] Failed to handle enemy death:', error.message);
                }
            }
            
            // Update statistics
            this.gameStats.kills = (this.gameStats.kills || 0) + 1;
            this.gameStats.enemiesKilled++;
            this.gameStats.score += enemy.xp * 10;
            
            // Safe analytics with proper checks
            const enemy_type = enemy.blueprintId || enemy.type || 'unknown';
            if (this.analyticsManager && typeof this.analyticsManager.trackEvent === 'function') {
                this.analyticsManager.trackEvent('enemy_killed', {
                    enemy_type,
                    level: this.gameStats?.level ?? 1
                });
            }
            
            // Handle boss death
            if (enemy instanceof Boss) {
                this.gameStats.bossesDefeated++;
                this.currentBoss = null;
                // Don't auto level up after boss - that's handled by boss:die event
            }
            
        } catch (error) {
            console.warn('[GameScene] enemy death handling failed:', error);
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
     * Spawn loot drop from SimpleLootSystem
     */
    spawnLootDrop(drop, x, y) {
        // Support both old format (ref) and new format (itemId)
        const dropId = drop.itemId || drop.ref;
        if (!drop || !dropId) return;
        
        // Use SimpleLootSystem for all drops
        if (this.lootSystem) {
            const qty = drop.quantity || drop.qty || 1;
            this.lootSystem.createDrop(x, y, dropId, { amount: qty });
        }
    }
    
    /**
     * Attract XP orb to player (for XP magnet power-up)
     */
    attractXPOrb(orb) {
        if (!orb || !orb.active || !this.player || !this.player.active) return;
        
        // Use SimpleLootSystem for animation
        if (this.lootSystem) {
            this.lootSystem.animateAttraction(orb, this.player, () => {
                if (orb && orb.active) {
                    this.addXP(orb.xpAmount);
                    orb.destroy();
                    // Auto-collected XP
                }
            });
        }
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
        if (this.powerUpSystem && typeof this.powerUpSystem._generatePowerUpOptions === 'function') {
            const systemOptions = this.powerUpSystem._generatePowerUpOptions();
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
        
        // IMMEDIATELY ensure player is visible and active
        if (this.player) {
            this.player.setVisible(true);
            this.player.setActive(true);
            if (this.player.body) {
                this.player.body.enable = true;
            }
            console.log('👤 Hráč reaktivován okamžitě při přechodu levelu');
        }
        
        // Clear remaining enemies with SHORT delay for visual effect
        this.time.delayedCall(100, async () => {
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
                
                // Re-attach power-up visual effects AFTER clearing enemies
                if (this.player && this.vfxSystem && this.player.powerUps) {
                    for (const [powerUpId, powerUp] of this.player.powerUps) {
                        if (powerUp.vfxType) {
                            this.vfxSystem.attachEffect(this.player, powerUp.vfxType, powerUp.config);
                        }
                    }
                    console.log('✨ Power-up efekty obnoveny');
                }
                
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
            this.levelTransitionContainer.setDepth(this.DEPTH_LAYERS.UI_MODAL);
            
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
        
        // Show immediately (tweens will be handled by GameUIScene in Step 8C)
        this.levelTransitionContainer.setAlpha(1);
        this.levelTransitionContainer.setVisible(true);
        
        // Heal player a bit as reward
        if (this.player && this.player.active) {
            const healAmount = Math.floor(this.player.maxHp * 0.3); // Heal 30% HP
            this.player.heal(healAmount);
            console.log(`💚 Hráč vyléčen o ${healAmount} HP jako odměna za dokončení levelu`);
        }
    }
    
    hideLevelTransition() {
        if (!this.levelTransitionContainer) return;
        
        // Hide immediately (tweens will be handled by GameUIScene in Step 8C)
        this.levelTransitionContainer.setAlpha(0);
        this.levelTransitionContainer.setVisible(false);
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
        victoryContainer.setDepth(this.DEPTH_LAYERS.UI_MODAL);
        
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
            'Stiskni R pro novou hru nebo ESC pro pause menu',
            {
                fontSize: '20px',
                fontFamily: 'Arial',
                color: '#aaaaaa'
            }
        ).setOrigin(0.5);
        
        victoryContainer.add([bg, victoryText, statsText, continueText]);
        
        // R key restart is handled by KeyboardManager 'game.restart' event
        
        // ESC for return to menu is handled by GameUIScene
        
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
        
        // Stop GameUIScene and transition to menu
        // Don't stop GameScene from itself - let the transition handle it
        this.scene.stop('GameUIScene');
        this.scene.start('MainMenu');
    }
    
    /**
     * Handle game restart via keyboard shortcut
     */
    handleGameRestart() {
        console.log('[GameScene] Restart requested via keyboard');
        this.scene.restart();
    }
    
    /**
     * Handle debug enemy spawn
     */
    handleDebugEnemySpawn() {
        if (this.spawnDirector) {
            console.log('[GameScene] Debug: spawning enemy');
            // Spawn a random enemy from current level
            this.spawnDirector.debugSpawnRandomEnemy();
        }
    }
    
    /**
     * Handle debug boss spawn
     */
    handleDebugBossSpawn() {
        if (this.spawnDirector) {
            console.log('[GameScene] Debug: spawning boss');
            this.spawnDirector.debugSpawnBoss();
        }
    }
    
    /**
     * Handle debug SFX soundboard
     */
    handleDebugSFXSoundboard() {
        if (!this.sfxSoundboard) {
            // Dynamically load SFXSoundboard
            import('../ui/SFXSoundboard.js').then(module => {
                this.sfxSoundboard = new module.SFXSoundboard(this);
                this.sfxSoundboard.show();
            });
        } else {
            this.sfxSoundboard.toggle();
        }
    }
    
    /**
     * Shutdown handler - called when scene is stopped
     * Clean up all resources to prevent errors during destroy
     */
    shutdown() {
        console.log('[GameScene] Shutdown initiated...');
        
        // 1. First pause everything to stop execution
        this.scene.pause();
        this.physics.pause();
        
        // 2. Stop and remove all tweens more safely
        if (this.tweens) {
            // CRITICAL: Kill tweens on ALL scene children first
            // This prevents the "this.manager.removeKey" error
            if (this.children && this.children.list) {
                this.children.list.forEach(child => {
                    if (child) {
                        this.tweens.killTweensOf(child);
                    }
                });
            }
            
            // Get all tweens and stop them individually
            const allTweens = this.tweens.getAllTweens();
            allTweens.forEach(tween => {
                if (tween) {
                    tween.stop();
                    // Do NOT call tween.remove() - let Phaser handle cleanup
                }
            });
            // Then kill all remaining
            this.tweens.killAll();
        }
        
        // 3. Remove all delayed calls and timed events
        if (this.time) {
            // Remove all delayed calls
            this.time.removeAllEvents();
            // Clear the timer queue
            if (this.time.delayedCalls) {
                this.time.delayedCalls.forEach(timer => {
                    if (timer) {
                        timer.destroy();
                        // Do NOT call timer.remove() - use destroy() instead
                    }
                });
            }
        }
        
        // 4. Clean up level transition container explicitly
        if (this.levelTransitionContainer) {
            // Stop any tweens on this container
            if (this.tweens) {
                this.tweens.killTweensOf(this.levelTransitionContainer);
            }
            this.levelTransitionContainer.destroy();
            this.levelTransitionContainer = null;
        }
        
        // 5. Stop all sounds
        if (this.sound) {
            this.sound.stopAll();
            this.sound.removeAll();
        }
        
        // 6. Clean up audio system
        if (this.audioSystem) {
            // Stop music without fade (to avoid creating new tweens)
            if (this.audioSystem.stopImmediately) {
                this.audioSystem.stopImmediately();
            } else {
                // Fallback for older version
                if (this.audioSystem.currentMusic) {
                    this.audioSystem.currentMusic.stop();
                    this.audioSystem.currentMusic = null;
                }
                this.audioSystem.stopAll();
            }
        }
        
        // 7. Clean up VFX system
        if (this.vfxSystem) {
            this.vfxSystem.shutdown();
        }
        
        // 8. Clean up armor shield effect
        if (this.armorShieldEffect) {
            this.armorShieldEffect.shutdown();
        }
        
        // 9. Clean up spawn director
        if (this.spawnDirector) {
            this.spawnDirector.stop();
        }
        
        // 10. Clean up loot system (this will stop all tweens on loot)
        if (this.lootSystem && this.lootSystem.shutdown) {
            this.lootSystem.shutdown();
        }
        
        // 11. Destroy all game objects in groups
        if (this.enemiesGroup) {
            // Kill tweens on all enemies first
            if (this.tweens) {
                this.enemiesGroup.getChildren().forEach(enemy => {
                    if (enemy) {
                        this.tweens.killTweensOf(enemy);
                    }
                });
            }
            this.enemiesGroup.clear(true, true);
        }
        
        if (this.bossGroup) {
            // Kill tweens on all bosses first
            if (this.tweens) {
                this.bossGroup.getChildren().forEach(boss => {
                    if (boss) {
                        this.tweens.killTweensOf(boss);
                    }
                });
            }
            this.bossGroup.clear(true, true);
        }
        
        // Note: loot group already handled by lootSystem.shutdown()
        
        // 12. Clean up player
        if (this.player) {
            if (this.tweens) {
                this.tweens.killTweensOf(this.player);
            }
            this.player = null;
        }
        
        // 13. Clean up UI layer
        if (this.uiLayer) {
            this.uiLayer.destroy();
            this.uiLayer = null;
        }
        
        // 14. Clean up keyboard manager
        if (this.keyboardManager) {
            this.keyboardManager.destroy();
            this.keyboardManager = null;
        }
        
        // 15. Clean up any modals
        if (this.highScoreModal) {
            this.highScoreModal.destroy();
            this.highScoreModal = null;
        }
        
        console.log('[GameScene] Shutdown complete');
    }
    
    /**
     * Handle debug VFX test
     */
    handleDebugVFXTest() {
        if (this.vfxSystem && this.player) {
            console.log('[GameScene] Debug: testing VFX');
            this.vfxSystem.play('vfx.explosion.small', this.player.x, this.player.y);
        }
    }
    
    /**
     * Clean up all systems and components
     */
    cleanupSystems() {
        // Clean up PowerUpSystem and its modal
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
        
        // Clean up ArmorShieldEffect
        if (this.armorShieldEffect && typeof this.armorShieldEffect.destroy === 'function') {
            this.armorShieldEffect.destroy();
            this.armorShieldEffect = null;
        }
        
        // Clean up VFX system
        if (this.vfxSystem && typeof this.vfxSystem.destroy === 'function') {
            this.vfxSystem.destroy();
            this.vfxSystem = null;
            this.newVFXSystem = null; // Clear alias
        }
        
        // Clean up audio system
        if (this.audioSystem && typeof this.audioSystem.destroy === 'function') {
            this.audioSystem.destroy();
            this.audioSystem = null;
            this.newSFXSystem = null; // Clear alias
        }
        
        // Clean up keyboard references - KeyboardManager handles cleanup automatically
        // Movement keys (inputKeys) remain for direct input performance
        
        // Also null the main input keys reference
        this.inputKeys = null;
        
        // Clean up DebugOverlay
        if (this.debugOverlay && typeof this.debugOverlay.destroy === 'function') {
            this.debugOverlay.destroy();
            this.debugOverlay = null;
        }
        
        // Clean up SFXSoundboard
        if (this.sfxSoundboard && typeof this.sfxSoundboard.destroy === 'function') {
            this.sfxSoundboard.destroy();
            this.sfxSoundboard = null;
        }
        
        // Clean up KeyboardManager
        if (this.keyboardManager && typeof this.keyboardManager.destroy === 'function') {
            this.keyboardManager.destroy();
            this.keyboardManager = null;
        }
        
        // Clean up AnalyticsManager EventBus connection
        if (this.analyticsManager && typeof this.analyticsManager.disconnectEventBus === 'function') {
            this.analyticsManager.disconnectEventBus();
        }
        
        console.log('[GameScene] Systems cleaned up');
    }
    
    /**
     * Setup EventBus listeners for keyboard events
     * Centralizované zpracování všech klávesových zkratek přes EventBus
     */
    setupKeyboardEvents() {
        // Game events
        this.eventBus.on('game.restart', () => {
            this.handleGameRestart();
        });
        
        // Debug events
        this.eventBus.on('debug.overlay.toggle', () => {
            if (this.debugOverlay) {
                this.debugOverlay.toggle();
            }
        });
        
        this.eventBus.on('debug.enemy.spawn', () => {
            this.handleDebugEnemySpawn();
        });
        
        this.eventBus.on('debug.missing-assets.toggle', () => {
            if (this.debugOverlay) {
                this.debugOverlay.showMissingAssets = !this.debugOverlay.showMissingAssets;
                this.debugOverlay.missingAssetsText.setVisible(this.debugOverlay.showMissingAssets);
                if (this.debugOverlay.showMissingAssets) {
                    this.debugOverlay._updateMissingAssetsPanel();
                }
            }
        });
        
        this.eventBus.on('debug.boss.spawn', () => {
            this.handleDebugBossSpawn();
        });
        
        this.eventBus.on('debug.sfx.soundboard', () => {
            this.handleDebugSFXSoundboard();
        });
        
        this.eventBus.on('debug.vfx.test', () => {
            this.handleDebugVFXTest();
        });
        
        // UI events - these will be handled by GameUIScene
        this.eventBus.on('ui.escape', () => {
            // Forward to GameUIScene via global events
            this.game.events.emit('game-pause-request');
        });
        
        console.log('[GameScene] Keyboard event listeners registered');
    }
}