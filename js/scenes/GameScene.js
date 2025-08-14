// GameConfig removed - PR7 compliance requires ConfigResolver only
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { UnifiedHUD } from '../ui/UnifiedHUD.js';
import { PauseMenuModal } from '../ui/PauseMenuModal.js';
import { MobileControlsManager } from '../managers/MobileControlsManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { HighScoreManager } from '../managers/HighScoreManager.js';
import { globalAudioLoader } from '../managers/AudioLoader.js';
import { GlobalHighScoreManager } from '../managers/GlobalHighScoreManager.js';
import { AnalyticsManager } from '../managers/AnalyticsManager.js';
import { SupabaseClient } from '../utils/supabaseClient.js';
import { UIThemeUtils } from '../ui/UITheme.js';
import { HighScoreModal } from '../ui/HighScoreModal.js';

// Základní systémy - pouze moderní PR7 implementace
import { LootSystem } from '../core/systems/LootSystem.js';
import { PowerUpSystem } from '../core/systems/PowerUpSystem.js';
import { InputSystem } from '../core/systems/InputSystem.js';
import { MovementSystem } from '../core/systems/MovementSystem.js';
import { ShieldSystem } from '../core/systems/ShieldSystem.js';
import { CollisionSystem } from '../core/systems/CollisionSystem.js';
import { SpawnSystem } from '../core/systems/SpawnSystem.js';
import { installDevConsole } from '../core/utils/devConsole.js';
import { buildSfxManifest } from '../core/audio/AudioAssets.js';
import { EventBus } from '../core/events/EventBus.js';
import { VfxRouter } from '../core/vfx/VfxRouter.js';
import { VfxSystem } from '../core/vfx/VFXSystem.js';
import { SFXSystem } from '../core/sfx/SFXSystem.js';
import { vfxRegistry } from '../core/vfx/VFXRegistry.js';
import { sfxRegistry } from '../core/sfx/SFXRegistry.js';
import { settingsManager } from '../core/settings/SettingsManager.js';
import { AnalyticsSystem } from '../core/systems/AnalyticsSystem.js';
import { displayResolver } from '../core/blueprints/DisplayResolver.js';
// ConfigResolver je nyní inicializován globálně v main.js
import { TelemetryLogger } from '../core/TelemetryLogger.js';
import { DebugOverlay } from '../utils/DebugOverlay.js';
import { Phase5Debug } from '../core/debug/Phase5Debug.js';
import { SmokeTest } from '../utils/SmokeTest.js';

// Data-driven systémy - vše řízeno blueprinty
import { BlueprintLoader } from '../core/data/BlueprintLoader.js';
import { SpawnDirector } from '../core/spawn/SpawnDirector.js';
import { FrameworkDebugAPI } from '../core/FrameworkDebugAPI.js';
import { ProjectileSystem } from '../core/systems/ProjectileSystem.js';
import LootSystemBootstrap from '../core/loot/LootSystemBootstrap.js';
import { ModifierEngine } from '../core/utils/ModifierEngine.js';
import { PowerUpVFXManager } from '../core/vfx/PowerUpVFXManager.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        
        // Core entities
        this.player = null;
        this.enemies = null; // Phaser physics group for all enemies
        this.currentBoss = null;
        
        // UI
        this.unifiedHUD = null;
        this.pauseMenu = null;
        this.mobileControls = null;
        
        // Core systems
        this.audioManager = null;
        this.analyticsManager = null;
        
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
        const xpBase = CR ? CR.get('progression.xp.baseRequirement', { defaultValue: 10 }) : 10;
        
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
    
    async create() {
        console.log('🎮 GameScene starting - DATA-DRIVEN MODE ONLY');
        
        // Setup world bounds
        this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
        
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
        
        // Set input keys explicitly
        this.player.setInputKeys(this.inputKeys);
        
        // Debug: Check input system
        console.log('[GameScene] inputKeys ready?', !!this.inputKeys);
        console.log('[Player] keys attached:', !!this.player.keys);
        
        // Enemy group will be created by SpawnDirectorIntegration
        // this.enemies = this.physics.add.group(); // REMOVED - created by integration
        
        // Initialize audio - PR7: use SFX system only
        this.audioManager = new AudioManager(this);
        // PR7: No preloadSounds - audio is handled by SFX system
        // Background music through SFX system - HOTFIX V3: Silent fail mode
        try {
            if (this.newSFXSystem) {
                this.newSFXSystem.play('music.background', { loop: true, volume: 0.3 });
            }
        } catch (error) {
            console.debug('[SFX] Failed to play background music, continuing:', error.message);
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
        
        // Initialize UI
        this.unifiedHUD = new UnifiedHUD(this);
        this.pauseMenu = new PauseMenuModal(this);
        this.add.existing(this.pauseMenu);
        
        // Setup collisions
        this.setupCollisions();
        
        // Start game
        await this.startGame();
        
        // Install dev console and debug overlay only in DEV mode
        const isDev = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.search.includes('debug=true');
        
        if (isDev) {
            installDevConsole(this);
            
            // Setup F3 toggle for debug overlay (overlay will be created later)
            this.input.keyboard.on('keydown-F3', () => {
                if (this.debugOverlay) {
                    this.debugOverlay.toggle();
                }
            });
            
            // Restore previous state from localStorage
            if (localStorage.getItem('debugOverlay') === 'true') {
                this.debugOverlay.show();
            }
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
        // VFX System (initialize early)
        try {
            this.newVFXSystem = new VfxSystem(this);
            this.newVFXSystem.initialize();
            console.log('✅ VFX System initialized');
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
            
            // Load level1 spawn table
            const spawnTable = 'level1';
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
        
        // Power-up System
        try {
            this.corePowerUpSystem = new PowerUpSystem(this, this.player);
            this.corePowerUpSystem.vfxManager = this.powerUpVFXManager; // Link VFX manager
            console.log('✅ PowerUpSystem initialized');
        } catch (error) {
            console.error('❌ Failed to initialize PowerUpSystem:', error);
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
            const playerBlueprint = this.blueprintLoader.get('player.swordsman');
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
                shoot: 'sfx.weapon.laser1',
                heal: 'sfx.player.heal'
            }
        };
    }
    
    /**
     * Generate player texture programmatically
     */
    generatePlayerTexture() {
        // PR7: Use values from player blueprint - správná metoda je .get(), ne .getBlueprint()
        const playerBlueprint = this.blueprintLoader?.get('player.swordsman');
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
    generateEnemyTexture(textureKey, color, size = 20) {
        if (this.textures.exists(textureKey)) return;
        
        const graphics = this.add.graphics();
        
        // Check entity type from textureKey
        const isUnique = textureKey.includes('unique');
        const isBoss = textureKey.includes('boss');
        const isMiniboss = textureKey.includes('miniboss');
        
        // HOTFIX: Ensure full opacity - Draw enemy as a colored circle with dark border
        graphics.fillStyle(color, 1.0); // Full opacity
        
        // Special border for different types
        if (isBoss) {
            graphics.lineStyle(3, 0xFFD700, 1.0); // Gold border for bosses
        } else if (isUnique) {
            graphics.lineStyle(3, 0xFF00FF, 1.0); // Purple border for unique
        } else if (isMiniboss) {
            graphics.lineStyle(3, 0xFF8800, 1.0); // Orange border for miniboss
        } else {
            graphics.lineStyle(2, 0x000000, 1.0); // Black border for regular
        }
        
        graphics.fillCircle(size/2, size/2, size/2 - 2);
        graphics.strokeCircle(size/2, size/2, size/2 - 2);
        
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
        
        console.log(`✅ Generated enemy texture: ${textureKey} (${size}px, color: 0x${color.toString(16)}, type: ${isBoss ? 'boss' : isUnique ? 'unique' : isMiniboss ? 'miniboss' : 'regular'})`);
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
        
        // PR7: ESC key for pause menu - delegate to PauseMenuModal
        this.escKey = this.input.keyboard.addKey('ESC');
        this.escKey.on('down', () => {
            console.log('[GameScene] ESC key DOWN event, pauseMenu exists:', !!this.pauseMenu, 'isGameOver:', this.isGameOver);
            
            // Pokud je otevřené highScoreModal, ignorovat
            if (this.highScoreModal) return;
            
            // Pokud je game over, vrátit se do menu
            if (this.isGameOver) {
                this.scene.start('MainMenu');
            } else if (this.pauseMenu) {
                // Jinak toggle pause menu
                this.pauseMenu.handleEscKey();
            }
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
        
        // Mobile controls
        try {
            const mobileEnabled = localStorage.getItem('mobileControlsEnabled') === 'true';
            const side = localStorage.getItem('mobileControlsSide') || 'left';
            if (mobileEnabled) {
                this.mobileControls = new MobileControlsManager(this, { side });
                this.mobileControls.enable();
            }
        } catch (_) {}
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
            
            // Debug: Time tracking (less frequent)
            if (currentSec % 5 === 0 && this.sceneTimeSec % 5 < 0.1) {
                console.log('[Tick]', currentSec, 'scene running');
            }
        }
        
        // Update player - PR7: Player uses preUpdate() internally
        // Player's preUpdate checks isPaused flag internally
        
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
        const damage = bullet.damage || this.player.damage;
        enemy.takeDamage(damage);
        
        // Check if enemy died
        if (enemy.hp <= 0 && enemy.active) {
            this.handleEnemyDeath(enemy);
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
    
    handlePlayerLootCollision(player, loot) {
        if (!loot.data) return;
        
        const lootType = loot.data.values?.type || loot.data.list?.type;
        const amount = loot.data.values?.amount || loot.data.list?.amount || 1;
        
        switch (lootType) {
            case 'xp':
                this.addXP(amount);
                this.audioManager?.playSound('xp_collect');
                break;
            case 'health':
                this.player.heal(amount);
                this.audioManager?.playSound('heal');
                break;
            case 'metotrexat':
                this.handleMetotrexatPickup();
                break;
        }
        
        loot.destroy();
    }
    
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
        const size = visuals.size?.w || blueprint.stats?.size || (blueprint.type === 'boss' ? 60 : 20);
        const textureKey = visuals.textureKey || blueprintId; // Use visuals.textureKey if available
        
        // Generate texture for ALL entity types (boss, unique, miniboss, enemy)
        console.log(`[createEnemyFromBlueprint] Creating ${blueprintId} (${blueprint.type}):`, {
            textureKey, color: '0x' + color.toString(16), size
        });
        
        this.generateEnemyTexture(textureKey, color, size);
        
        if (blueprint.type === 'boss') {
            // Create boss with properly generated texture
            const bossConfig = {
                ...blueprint.stats,
                texture: textureKey,
                color: color,
                size: size,
                sfx: blueprint.sfx,
                vfx: blueprint.vfx,
                ...blueprint.mechanics
            };
            
            entity = new Boss(this, x, y, blueprint, options);
            this.bossGroup.add(entity);
            this.currentBoss = entity;
            
            // Ensure boss uses the generated texture
            entity.setTexture(textureKey);
            entity.setDisplaySize(size, size);
            
            // Show boss health bar
            if (this.unifiedHUD?.showBossHealth) {
                this.unifiedHUD.showBossHealth(entity.bossName, entity.hp, entity.maxHp);
            }
        } else {
            // Create regular enemy (includes unique, miniboss, elite)
            const enemyConfig = {
                ...blueprint.stats,
                texture: textureKey,
                color: color,
                size: size,
                sfx: blueprint.sfx,
                vfx: blueprint.vfx,
                ai: blueprint.ai, // PR7 Compliant: Pass AI configuration from blueprint
                ...blueprint.mechanics,
                // Special flags based on type
                isElite: options.elite || blueprint.type === 'elite',
                isUnique: blueprint.type === 'unique',
                isMiniboss: blueprint.type === 'miniboss'
            };
            
            entity = new Enemy(this, x, y, blueprintId, enemyConfig);
            
            // Ensure proper texture and size
            entity.setTexture(textureKey);
            entity.setDisplaySize(size, size);
            entity.setOrigin(0.5);
            
            // Add special visual indicators for unique/miniboss
            if (blueprint.type === 'unique') {
                // Add purple glow for unique enemies
                entity.setTint(0xFF00FF);
            } else if (blueprint.type === 'miniboss') {
                // Add orange glow for minibosses
                entity.setTint(0xFF8800);
            }
            
            this.enemiesGroup.add(entity);
            
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
                
                // Level up after boss
                this.gameStats.level++;
                this.levelUp();
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
            
            // Fallback: Drop XP from blueprint or default
            if (!lootDropped) {
                // Try to get XP from enemy blueprint
                const xpAmount = enemy.xp || enemy.data?.xp || enemy.stats?.xp || 1;
                this.dropSimpleXP(enemy.x, enemy.y, xpAmount);
            }
            
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
        
        // Play sound
        this.audioManager?.playSound('powerup');
    }
    
    /**
     * Spawn loot drop from LootDropManager
     */
    spawnLootDrop(drop, x, y) {
        if (!drop || !drop.ref) return;
        
        // Parse drop reference (e.g., "drop.xp_small")
        const dropType = drop.ref.replace('drop.', '');
        const qty = drop.qty || 1;
        
        // Get blueprint for this drop
        const dropBlueprint = this.blueprints?.get(drop.ref);
        
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
     * Drop simple XP orb
     */
    dropSimpleXP(x, y, amount) {
        // Create simple XP orb sprite
        const xpOrb = this.physics.add.sprite(x, y, '__DEFAULT'); // Use default texture initially
        
        // Generate simple XP orb texture if not exists
        if (!this.textures.exists('simple_xp_orb')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0x00ff00, 1); // Green
            graphics.fillCircle(6, 6, 6);
            graphics.fillStyle(0xffffff, 1); // White center
            graphics.fillCircle(6, 6, 3);
            graphics.generateTexture('simple_xp_orb', 12, 12);
            graphics.destroy();
        }
        
        xpOrb.setTexture('simple_xp_orb');
        xpOrb.setScale(1);
        xpOrb.setDepth(15); // Above enemies but below UI
        xpOrb.body.setCircle(6);
        
        // Store XP amount
        xpOrb.xpAmount = amount;
        xpOrb.isXPOrb = true;
        
        // Simple physics - small bounce
        xpOrb.setVelocity(
            Phaser.Math.Between(-30, 30), 
            Phaser.Math.Between(-50, -20)
        );
        xpOrb.setBounce(0.3);
        xpOrb.setDrag(200);
        
        // PR7: Check XP magnet through coreLootSystem - no hardcoded properties
        // XP magnet is active if magnetLevel > 0 in the LootSystem
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
            orb.destroy();
            // XP collected
        });
        
        // Auto-cleanup after 10 seconds
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
        this.gameStats.xp += amount;
        this.player.xp = this.gameStats.xp;
        
        // Check level up
        while (this.gameStats.xp >= this.gameStats.xpToNext) {
            this.gameStats.xp -= this.gameStats.xpToNext;
            this.player.xp = this.gameStats.xp;
            
            this.gameStats.level++;
            
            // PR7: Use ConfigResolver for XP calculation
            const CR = this.configResolver || window.ConfigResolver;
            const baseReq = CR.get('progression.xp.baseRequirement', { defaultValue: 10 });
            const multiplier = CR.get('progression.xp.scalingMultiplier', { defaultValue: 1.25 });
            
            this.gameStats.xpToNext = Math.floor(
                baseReq * Math.pow(multiplier, this.gameStats.level - 1)
            );
            
            this.levelUp();
        }
    }
    
    /**
     * PR7: Set pause state - called by PauseMenuModal
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
    
    levelUp() {
        console.log(`🎊 LEVEL UP! Level ${this.gameStats.level}`);
        
        // Pause the game immediately
        this.isPaused = true;
        
        // Pause physics immediately
        this.physics.pause();
        
        // DŮLEŽITÉ: NEpauzovat time.paused tady - modal potřebuje tweeny pro animace!
        // Pauzujeme až v callbacku po zobrazení modalu
        
        // PR7: Pause projectiles to ensure they don't move during level up
        if (this.projectileSystem) {
            this.projectileSystem.pauseAll();
        }
        
        // Heal player
        this.player.heal(20);
        
        // Show power-up selection with callback to resume
        if (this.corePowerUpSystem) {
            // Delay time pause to allow modal animation
            this.time.delayedCall(300, () => {
                // Pauzovat timery až po animaci modalu (300ms)
                this.time.paused = true;
            });
            
            this.corePowerUpSystem.showPowerUpSelection(() => {
                // Resume game after selection
                this.isPaused = false;
                
                // Resume timers FIRST (before physics)
                this.time.paused = false;
                
                // Resume physics
                this.physics.resume();
                
                // PR7: Resume projectiles
                if (this.projectileSystem) {
                    this.projectileSystem.resumeAll();
                }
                
                console.log('🎮 Game resumed after power-up selection');
            });
        } else {
            // If no power-up system, resume immediately
            this.isPaused = false;
            this.physics.resume();
            this.time.paused = false;
            
            // PR7: Resume projectiles
            if (this.projectileSystem) {
                this.projectileSystem.resumeAll();
            }
        }
        
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
        
        // Show game over UI
        this.unifiedHUD?.showGameOver();
        
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
    
    updateTime() {
        if (!this.isPaused && !this.isGameOver) {
            this.gameStats.time++;
        }
    }
    
    handleResize(gameSize) {
        const { width, height } = gameSize;
        
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
        const displayColor = blueprint.display?.color || '#FF0000';
        
        // If it's already a number, return it
        if (typeof displayColor === 'number') {
            return displayColor;
        }
        
        // Convert hex string to number
        if (typeof displayColor === 'string') {
            return parseInt(displayColor.replace('#', '0x'));
        }
        
        return 0xFF0000; // Default red
    }
}