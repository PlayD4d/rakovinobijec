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
import { TransitionManager } from '../managers/TransitionManager.js';
import { BootstrapManager } from '../managers/BootstrapManager.js';
import { SystemsInitializer } from '../managers/SystemsInitializer.js';
import { DisposableRegistry } from '../utils/DisposableRegistry.js';
import { EnemyManager } from '../managers/EnemyManager.js';

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
        // Initialize DisposableRegistry for cleanup
        this.disposables = new DisposableRegistry();
        
        // Complete BlueprintLoader initialization (async)
        await this._initializeBlueprintLoader();
        
        // Store start time for XP scaling
        this.startTime = this.time.now;
        
        // Use BootstrapManager to handle all initialization
        const bootstrapper = new BootstrapManager(this);
        try {
            await bootstrapper.bootstrap();
        } catch (error) {
            console.error('❌ Bootstrap failed:', error);
            return; // Stop if bootstrap fails
        }
    }
    
    async initializeDataDrivenSystems() {
        // Use SystemsInitializer for all system setup
        const initializer = new SystemsInitializer(this);
        await initializer.initializeSystems();
        
        // Additional scene-specific setup
        this.currentLevel = 1;
        this.maxLevel = 3;
        
        // Initialize debug and telemetry if in dev mode
        if (window.DEV_MODE || window.location.search.includes('debug=true')) {
            this.initializeDebugSystems();
        }
    }
    
    initializeDebugSystems() {
        try {
            // Telemetry logger
            this.telemetryLogger = new TelemetryLogger(this);
            
            // Debug overlay (F3 to toggle)
            if (!this.debugOverlay) {
                this.debugOverlay = new DebugOverlay(this);
            }
            
            // Phase5 debug
            this.phase5Debug = new Phase5Debug(this);
        } catch (error) {
            console.warn('Debug systems init failed:', error);
        }
    }
    
    createPlayerBlueprint() {
        // Delegate to PlayerFactory
        if (this.playerFactory) {
            return this.playerFactory.getPlayerBlueprint();
        }
        console.error('[GameScene] PlayerFactory not initialized');
        return null;
    }
    
    
    
    
    
    /**
     * Show critical error overlay - delegate to UI scene
     */
    showCriticalError(title, message) {
        // Delegate to UI scene
        const uiScene = this.scene.get('GameUIScene');
        if (uiScene?.events) {
            uiScene.events.emit('show-error', { title, message });
        } else {
            console.error('[GameScene] Critical error:', title, message);
        }
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
    
    /**
     * Initialize TransitionManager for game flow control
     */
    initializeTransitionManager() {
        this.transitionManager = new TransitionManager(this);
    }
    
    // Collision handlers moved to setupCollisions.js
    
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
     * Create enemy from blueprint - delegates to EnemyManager
     * @param {string} blueprintId - Enemy blueprint ID
     * @param {Object} options - Spawn options
     */
    createEnemyFromBlueprint(blueprintId, options = {}) {
        if (this.enemyManager) {
            return this.enemyManager.spawnEnemy(blueprintId, options);
        }
        console.error('[GameScene] EnemyManager not initialized');
        return null;
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
        // Delegate to TransitionManager
        if (this.transitionManager) {
            await this.transitionManager.gameOver();
        }
    }
    
    async transitionToNextLevel() {
        // Check if we have more levels
        if (this.currentLevel >= this.maxLevel) {
            console.log('🎉 Všechny levely dokončeny! VÝHRA!');
            // Show victory screen instead of continuing
            this.showVictory();
            return;
        }
        
        // Delegate to TransitionManager
        const nextLevel = this.currentLevel + 1;
        if (this.transitionManager) {
            await this.transitionManager.transitionToNextLevel(nextLevel);
        }
    }
    
    // Removed - handled by TransitionManager and UI scene
    // showLevelTransition() - deleted
    
    // Removed - handled by TransitionManager and UI scene
    // hideLevelTransition() - deleted
    
    // Removed - handled by TransitionManager
    // clearAllEnemies() - deleted
    
    async showVictory() {
        // Delegate to TransitionManager
        if (this.transitionManager) {
            await this.transitionManager.showVictory();
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
     * Shutdown handler - called when scene is stopped
     * Clean up all resources to prevent errors during destroy
     */
    shutdown() {
        // 1. Stop gameplay orchestration
        this.spawnDirector?.stop?.();
        this.projectileSystem?.clearAllProjectiles?.();
        this.updateManager?.pause?.();
        
        // 2. Pause physics
        this.physics?.pause?.();
        
        // 3. Kill all tweens
        this.tweens?.killAll?.();
        
        // 4. Clean up timer events and registered disposables
        this.time?.removeAllEvents?.();
        this.disposables?.disposeAll?.();
        
        // 5. Shutdown all systems
        const systems = [
            this.powerUpSystem, this.lootSystem, this.projectileSystem,
            this.vfxSystem, this.audioSystem, this.armorShieldEffect,
            this.playerShieldEffect, this.keyboardManager, this.analyticsManager,
            this.updateManager, this.transitionManager
        ];
        for (const s of systems) {
            if (s?.shutdown) s.shutdown();
            else if (s?.destroy) s.destroy();
        }
        
        // 6. Clear groups
        this.enemiesGroup?.clear?.(true, true);
        this.bossGroup?.clear?.(true, true);
        
        // 7. Nullify references
        this.player = this.spawnDirector = this.projectileSystem = 
        this.lootSystem = this.powerUpSystem = this.vfxSystem = 
        this.audioSystem = this.keyboardManager = this.analyticsManager = null;
    }
    
    /**
     * Handle debug VFX test
     */
    
    /**
     * Clean up all systems and components
     */
    cleanupSystems() {
        // Delegate to shutdown
        this.shutdown();
    }
    
}