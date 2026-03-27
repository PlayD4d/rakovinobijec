import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { UnifiedHUD } from '../ui/UnifiedHUD.js';
import { MobileControlsSystem } from '../core/systems/MobileControlsSystem.js';

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
// PowerUpSystem is imported and initialized by BootstrapManager
import { ShapeRenderer } from '../core/utils/ShapeRenderer.js';
import { installDevConsole } from '../core/utils/devConsole.js';
import { EventBus } from '../core/events/EventBus.js';
// KeyboardManager is imported and initialized by BootstrapManager
import { SimplifiedVFXSystem } from '../core/vfx/SimplifiedVFXSystem.js';
// SimplifiedAudioSystem will be imported dynamically in initializeDataDrivenSystems()
// Registry removed - using simplified systems directly
// AnalyticsSystem removed - functionality merged into AnalyticsManager
import { displayResolver } from '../core/blueprints/DisplayResolver.js';
// ConfigResolver je nyní inicializován globálně v main.js
import { TelemetryLogger } from '../core/TelemetryLogger.js';
import { DebugOverlay } from '../utils/DebugOverlay.js';
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
import { DisposableRegistry } from '../utils/DisposableRegistry.js';
import { EnemyManager } from '../managers/EnemyManager.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        
        // Hlavní herní entity
        this.player = null;
        this.enemies = null; // Phaser physics group for all enemies
        this.currentBoss = null;
        
        // UI
        this.unifiedHUD = null;
        this.mobileControls = null;

        // Core systems
        this.analyticsManager = null;
        this.musicManager = null;

        // Data-driven systems (PR7)
        this.blueprintLoader = null;
        this.spawnDirector = null;
        this.frameworkDebug = null;
        this.projectileSystem = null;
        this.lootSystem = null;
        this.powerUpSystem = null;
        this.vfxSystem = null;
        this.audioSystem = null;
        
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
     * PR7 Audio Loading System
     * Loads all audio from pre-generated manifest (build-time)
     * No hardcoded lists, 100% data-driven from blueprints
     */
    _preloadAllAudio() {
        // Load audio manifest generated from blueprints
        this.load.json('audio_manifest', '/data/generated/audio_manifest.json');
        
        // Once manifest is loaded, use it to preload all audio
        this.load.on('filecomplete-json-audio_manifest', (key, type, data) => {
            if (!data || !data.audio) {
                console.error('[AudioPreload] Invalid or missing audio manifest!');
                return;
            }
            
            const audioFiles = data.audio;
            let loadedCount = 0;
            
            console.log(`[AudioPreload] Loading ${audioFiles.length} audio files from manifest v${data.version}`);
            
            // Preload all audio files from manifest
            audioFiles.forEach(path => {
                const key = path.replace(/[^a-zA-Z0-9]/g, '_');
                
                if (!this.cache.audio.has(key)) {
                    this.load.audio(key, path);
                    loadedCount++;
                }
            });
            
            console.log(`[AudioPreload] ✅ Prepared ${loadedCount} audio files for loading`);
        });
    }
    
    // REMOVED: _extractAudioFromScenes() - replaced by audio_manifest.json
    // Old fallback system removed - all audio now loaded from generated manifest
    
    // REMOVED: _scanBlueprintsForAudio() - replaced by build-time generation
    
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
        
        // PowerUp selection is handled by BootstrapManager.registerEventListeners()
        // Do NOT register a second listener here — it causes double application
    }
    
    setupResumeHandlers() {
        // Setup resume handler for timer resets
        this.events.on('resume', () => {
            const now = this.time.now;
            console.log('[GameScene] Resuming from pause - resetting timers');
            
            // Reset player timers
            if (this.player && this.player.resetTimersAfterPause) {
                this.player.resetTimersAfterPause();
            }
            
            // Reset enemy behavior timers
            if (this.enemiesGroup) {
                this.enemiesGroup.getChildren().forEach(enemy => {
                    if (enemy.behaviors && enemy.behaviors.resetTimersAfterPause) {
                        enemy.behaviors.resetTimersAfterPause();
                    }
                });
            }
            
            // Reset boss timers
            if (this.bossGroup) {
                this.bossGroup.getChildren().forEach(boss => {
                    if (boss.behaviors && boss.behaviors.resetTimersAfterPause) {
                        boss.behaviors.resetTimersAfterPause();
                    }
                });
            }
            
            // Reset spawn director timers
            if (this.spawnDirector && this.spawnDirector.resetTimersAfterPause) {
                this.spawnDirector.resetTimersAfterPause();
            }
            
            // Reset power-up system timers (chain lightning, etc.)
            if (this.powerUpSystem && this.powerUpSystem.resetTimersAfterPause) {
                this.powerUpSystem.resetTimersAfterPause();
            }
        });
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
            console.warn('Debug systems init failed:', error);
        }
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
                this.mobileControls = new MobileControlsSystem(this, { side });
                this.mobileControls.enable();
            }
        } catch (_) {}
        
        // Phaser calls shutdown() automatically on scene stop — no need for explicit listener
        // (explicit listener caused double-shutdown → removeKey crash)
    }
    
    setupCollisions() {
        // Delegate all collision setup to centralized handler
        return setupCollisions(this);
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
        
        // Start spawn director with first level spawn table
        if (this.spawnDirector) {
            // Load spawn table first
            const loaded = await this.spawnDirector.loadSpawnTable('spawnTable.level1');
            
            if (loaded) {
                this.spawnDirector.start();

                // Start level music from spawn table
                const table = this.spawnDirector.currentTable;
                if (table?.music?.ambient && this.audioSystem) {
                    this.audioSystem.playMusic(table.music.ambient);
                }

                console.log('🎮 Game started! SpawnDirector activated with level1 spawn table');
            } else {
                console.error('⚠️ Failed to load spawn table - no enemies will spawn');
            }
        } else {
            console.warn('⚠️ SpawnDirector not initialized - no enemies will spawn');
            console.log('🎮 Game started!');
        }
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
        if (!enemy) return;
        // Note: enemy.active may already be false (set by EnemyCore.die/Boss.die)
        // Use a processed flag to prevent double-processing
        if (enemy._deathProcessed) return;
        enemy._deathProcessed = true;
        
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
        }

        // Deactivate (don't destroy — Boss.die() still runs after this returns)
        // Phaser group.clear() in cleanupLevel will destroy sprites properly
        if (enemy.active) {
            enemy.setActive(false);
            enemy.setVisible(false);
            if (enemy.body) enemy.body.enable = false;
        }
    }
    
    handleMetotrexatPickup() {
        DebugLogger.info('general', '[GameScene] METOTREXAT! Eliminating all enemies!');

        // Flash effect
        this.cameras.main.flash(500, 255, 255, 0);

        // Destroy all enemies
        const enemies = this.enemies?.getChildren() || [];
        enemies.forEach(enemy => {
            if (enemy.active && !(enemy instanceof Boss)) {
                this.handleEnemyDeath(enemy);
            }
        });

        // Play metotrexat SFX
        if (this.audioSystem) {
            const blueprint = this.blueprintLoader?.getBlueprint('powerup.metotrexat');
            const pickupSFX = blueprint?.sfx?.pickup;
            if (pickupSFX) {
                this.audioSystem.play(pickupSFX);
            }
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
        // Simple delegation to PowerUpSystem if available
        if (this.powerUpSystem && typeof this.powerUpSystem.generatePowerUpOptions === 'function') {
            const options = this.powerUpSystem.generatePowerUpOptions();
            if (options && options.length > 0) {
                return options;
            }
        }
        
        // Fallback options if system is not available
        const fallbackOptions = [
            {
                id: 'powerup.damage_boost',
                name: '🧬 Cytotoxická terapie',
                description: 'Zvyšuje účinnost léčby proti rakovinným buňkám.',
                stats: '+5 DMG',
                rarity: 'common',
                icon: '💉',
                level: 0
            },
            {
                id: 'powerup.metabolic_haste', 
                name: '⚡ Metabolický boost',
                description: 'Urychluje metabolismus pro rychlejší pohyb a reakce.',
                stats: '+8% SPD',
                rarity: 'common',
                icon: '🏃‍♂️',
                level: 0
            },
            {
                id: 'powerup.shield',
                name: '🛡️ Ochranný štít',
                description: 'Vytváří ochranný štít, který blokuje poškození.',
                stats: '3 hity',
                rarity: 'uncommon',
                icon: '🛡️',
                level: 0
            }
        ];
        
        return fallbackOptions;
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
    
    // ========== PR7 Phaser API Interface Methods ==========
    // These methods provide controlled access to Phaser API
    // for managers to use instead of direct calls
    
    /**
     * Pause physics world
     */
    pausePhysics() {
        if (this.physics?.world) {
            this.physics.world.pause();
        }
    }
    
    /**
     * Resume physics world
     */
    resumePhysics() {
        if (this.physics?.world) {
            this.physics.world.resume();
        }
    }
    
    /**
     * Pause time system
     */
    pauseTime() {
        if (this.time) {
            this.time.paused = true;
        }
    }
    
    /**
     * Resume time system
     */
    resumeTime() {
        if (this.time) {
            this.time.paused = false;
        }
    }
    
    /**
     * Set world bounds
     */
    setWorldBounds(x, y, width, height) {
        if (this.physics?.world) {
            this.physics.world.setBounds(x, y, width, height);
        }
    }
    
    /**
     * Set UI layer (created by BootstrapManager)
     */
    setUILayer(layer) {
        this.uiLayer = layer;
    }
    
    /**
     * Launch UI scene
     */
    launchUIScene(sceneKey) {
        this.scene.launch(sceneKey);
    }
    
    /**
     * Add time event
     */
    addTimeEvent(config) {
        return this.time.addEvent(config);
    }
    
    /**
     * Add delayed call
     */
    addDelayedCall(delay, callback, args, scope) {
        return this.time.delayedCall(delay, callback, args, scope);
    }
    
    /**
     * Get main camera
     */
    getMainCamera() {
        return this.cameras.main;
    }
    
    /**
     * Get scale manager
     */
    getScaleManager() {
        return this.scale;
    }
    
    /**
     * Restart current scene
     */
    restartScene() {
        this.scene.restart();
    }
    
    // ========== End of PR7 Interface Methods ==========
    
    /**
     * Find nearest enemy for auto-aim
     */
    findNearestEnemy() {
        if (!this.player || !this.enemies) return null;
        const px = this.player.x;
        const py = this.player.y;
        let closestEnemy = null;
        let closestDistSq = Infinity;

        const enemies = this.enemies.getChildren();
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy.active) continue;
            const dx = px - enemy.x;
            const dy = py - enemy.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < closestDistSq) {
                closestDistSq = distSq;
                closestEnemy = enemy;
            }
        }

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
        console.log('[GameScene] Starting shutdown sequence...');
        
        try {
            // 1. Stop spawning and clear active enemies first (high priority)
            if (this.spawnDirector?.stop) {
                this.spawnDirector.stop();
            }
            
            // 2. Clear all projectiles
            if (this.projectileSystem?.clearAllProjectiles) {
                this.projectileSystem.clearAllProjectiles();
            }
            
            // 3. Clear groups
            try { this.enemiesGroup?.clear(true, true); } catch (_) {}
            try { this.bossGroup?.clear(true, true); } catch (_) {}

            // 4. Pause physics, kill tweens, remove timers
            try { this.physics?.pause(); } catch (_) {}
            try { this.tweens?.killAll(); } catch (_) {}
            try { this.time?.removeAllEvents(); } catch (_) {}
            
            // 7. Dispose registered resources
            if (this.disposables) {
                try {
                    this.disposables.disposeAll();
                } catch (e) {
                    console.warn('[GameScene] Error disposing resources:', e);
                }
            }
            
            // 8. Shutdown systems in reverse dependency order
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
                { name: 'debugOverlay', ref: this.debugOverlay }
            ];
            
            for (const system of systemsToShutdown) {
                if (system.ref) {
                    try {
                        if (typeof system.ref.shutdown === 'function') {
                            system.ref.shutdown();
                        } else if (typeof system.ref.destroy === 'function') {
                            system.ref.destroy();
                        }
                    } catch (e) {
                        console.warn(`[GameScene] Error shutting down ${system.name}:`, e);
                    }
                }
            }
            
            // 9. Clean up game-level event listeners (not auto-cleaned by Phaser)
            if (this._bootstrapGameListeners) {
                this._bootstrapGameListeners.forEach(({ event, fn }) => {
                    this.game.events.off(event, fn);
                });
                this._bootstrapGameListeners = null;
            }

            // 10. Nullify references to prevent memory leaks
            this.player = null;
            this.spawnDirector = null;
            this.projectileSystem = null;
            this.lootSystem = null;
            this.powerUpSystem = null;
            this.vfxSystem = null;
            this.audioSystem = null;
            this.keyboardManager = null;
            this.analyticsManager = null;
            this.updateManager = null;
            this.transitionManager = null;
            this.enemiesGroup = null;
            this.bossGroup = null;
            this.debugOverlay = null;
            
            console.log('[GameScene] Shutdown sequence completed successfully');
            
        } catch (e) {
            console.error('[GameScene] Critical error during shutdown:', e);
        }
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