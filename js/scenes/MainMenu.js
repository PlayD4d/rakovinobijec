import { calculateGameSize } from '../config.js';
import { HighScoreManager } from '../managers/HighScoreManager.js';
import { GlobalHighScoreManager } from '../managers/GlobalHighScoreManager.js';
import { SimplifiedVFXSystem } from '../core/vfx/SimplifiedVFXSystem.js';
import { GraphicsFactory } from '../core/graphics/GraphicsFactory.js';
import { centralEventBus } from '../core/events/CentralEventBus.js';
import { KeyboardManager } from '../core/input/KeyboardManager.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
// LiteUI components
import { MainMenuUI } from '../ui/lite/MainMenuUI.js';
import { loadGameVersion, getCachedVersion } from '../utils/version.js';

export class MainMenu extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenu' });

        this.mainMenuUI = null;
        this.highScoreManager = null;
        this.globalHighScoreManager = null;
        this.musicManager = null;
        this.keyboardManager = null;

        // Flag pro tracking fullscreen stavu
        this.isFullscreenMode = false;
    }

    preload() {
        // LiteUI doesn't need external plugins
        // Načíst pouze základní UI zvuky pro menu
        const menuSounds = [
            'sound/intro.mp3',
            'sound/pickup.mp3'
        ];

        menuSounds.forEach(path => {
            // Use consistent key generation - same as GameScene and SimplifiedAudioSystem
            const key = path.replace(/[^a-zA-Z0-9]/g, '_');
            if (!this.cache.audio.has(key)) {
                this.load.audio(key, path);
                DebugLogger.info('menu', `[MainMenu] Loading audio: ${path} -> ${key}`);
            }
        });

        // Load menu music if configured
        const CR = window.ConfigResolver;
        if (CR) {
            const menuMusic = CR.get('audio.scenes.mainMenu.backgroundMusic');
            if (menuMusic) {
                // Use same key generation as SimplifiedAudioSystem
                const musicKey = menuMusic.replace(/[^a-zA-Z0-9]/g, '_');
                if (!this.cache.audio.has(musicKey)) {
                    this.load.audio(musicKey, menuMusic);
                    DebugLogger.info('menu', `[MainMenu] Loading menu music: ${menuMusic} -> ${musicKey}`);
                }
            }
        }
    }

    async create() {
        DebugLogger.info('menu', '[MainMenu] create');
        // V menu fyziku nepotřebujeme – pauznout pro úsporu CPU
        try { this.physics?.world?.pause(); } catch (_) { }
        // Bezpečnost: zastavit všechny hrající zvuky/hudbu po návratu z GameScene
        try { this.sound && this.sound.stopAll && this.sound.stopAll(); } catch (_) { }
        try { this.game && this.game.sound && this.game.sound.stopAll && this.game.sound.stopAll(); } catch (_) { }
        // Debug: Check scene dimensions
        DebugLogger.info('menu', '=== MAINMENU SCENE DEBUG ===');
        DebugLogger.info('menu', 'scene.scale.width:', this.scale.width);
        DebugLogger.info('menu', 'scene.scale.height:', this.scale.height);
        DebugLogger.info('menu', 'scene.scale.gameSize:', this.scale.gameSize);
        DebugLogger.info('menu', 'scene.cameras.main size:', this.cameras.main.width, 'x', this.cameras.main.height);

        // Načtení verze hry ze version.js
        try {
            this.gameVersion = await loadGameVersion();
        } catch (e) {
            this.gameVersion = getCachedVersion();
        }

        // Inicializace high score managerů
        this.highScoreManager = new HighScoreManager();
        this.globalHighScoreManager = new GlobalHighScoreManager();
        this.globalHighScoreManager.setLocalFallback(this.highScoreManager);

        // Use shared CentralEventBus (Phaser recommended: standalone EventEmitter singleton)
        this.eventBus = centralEventBus;

        // Vytvoření main menu UI (LiteUI)
        this.mainMenuUI = new MainMenuUI(this, this.gameVersion);

        // Setup KeyboardManager for MainMenu
        try {
            this.keyboardManager = new KeyboardManager(this, this.eventBus);
            this.setupMenuKeyboardEvents();
            this.keyboardManager.register('ESC', 'ui:menu-escape', 'menu');
            DebugLogger.info('menu', '✅ MainMenu KeyboardManager initialized');
        } catch (error) {
            DebugLogger.error('menu', 'MainMenu KeyboardManager init failed:', error);
        }

        // PR7: Init GraphicsFactory and VFX pro menu
        try {
            this.graphicsFactory = new GraphicsFactory(this);
            this.vfxSystem = new SimplifiedVFXSystem(this);
            this.vfxSystem.initialize();
        } catch (_) { }

        // Defer audio until first user gesture (Chrome autoplay policy)
        // Phaser's sound manager handles AudioContext resume on user interaction
        this._musicStarted = false;
        this.input.once('pointerdown', () => this._startMenuAudio());

        // LiteUI doesn't need resize handlers - it's simple and fixed
        // Ujistit se, že při ukončení scény proběhne úklid (odregistrování posluchačů)
        try {
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
            this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
        } catch (_) { }

        // Remove blur/focus sleep/wake - it causes input issues in menu
        // Keep the game running in menu for responsive UI
        DebugLogger.info('menu', '[MainMenu] Skipping blur/focus sleep/wake - keeping menu responsive');

        // NEUSPÁVAT menu automaticky - nechme ho běžet, ale s nízkou frame rate
        // Menu je jednoduché a LiteUI nezatěžuje systém
        // Sleep pouze při blur (ztráta fokusu okna)

        // Keep normal FPS in menu for responsive UI
        // Low FPS can cause input lag and unresponsive buttons
        try {
            this.game.loop.targetFps = 30; // Compromise between performance and responsiveness
        } catch (_) { }
    }

    // Keyboard navigation removed - LiteUI uses mouse/touch only for simplicity

    // Menu action handling is now done directly in MainMenuUI buttons

    /**
     * Start the game
     */
    startGame() {
        // Stop menu music before transitioning
        if (this.musicManager) {
            this.musicManager.stopMusic();
        }

        // Obnovit normální FPS před přechodem do hry
        try { this.game.loop.targetFps = 60; } catch (_) { }
        // Pro jistotu okamžitě uklidit posluchače z MainMenu ještě před přepnutím scény
        try { this.shutdown(); } catch (_) { }
        // Play pickup sound for menu confirm
        try {
            if (this.sound && this.sound.add) {
                const pickupKey = 'sound_pickup_mp3'; // Key generated from 'sound/pickup.mp3'
                if (this.cache.audio.exists(pickupKey)) {
                    this.sound.play(pickupKey, { volume: 0.5 });
                }
            }
        } catch (_) { }

        // Transition to game
        this.scene.start('GameScene');
    }

    // High scores functionality temporarily disabled - will be added to LiteUI later

    // Settings functionality temporarily disabled - will be added to LiteUI later

    // Audio and enemy info functionality will be added to LiteUI later

    /**
     * Setup keyboard event listeners for MainMenu
     */
    setupMenuKeyboardEvents() {
        centralEventBus.on('ui:menu-escape', () => {
            this.handleEscKey();
        });

        DebugLogger.info('menu', '[MainMenu] Menu keyboard event listeners registered');
    }

    /**
     * Handle ESC key
     */
    handleEscKey() {
        // Close any open submenus or exit fullscreen
        if (this.scale.isFullscreen) {
            this.scale.stopFullscreen();
        }
    }

    /**
     * Try to play intro sound
     */
    tryPlayIntro() {
        // Delay to ensure audio is loaded
        this.time.delayedCall(500, () => {
            try {
                if (this.sound && this.sound.add) {
                    const introKey = 'sound_ready_fight_mp3';
                    if (this.cache.audio.exists(introKey)) {
                        this.sound.play(introKey, { volume: 0.5 });
                    }
                }
            } catch (_) { }
        });
    }

    // LiteUI doesn't need resize handlers

    /** Start menu audio after first user gesture (Chrome autoplay policy compliance) */
    async _startMenuAudio() {
        if (this._musicStarted) return;
        this._musicStarted = true;

        // Resume AudioContext if suspended (Phaser handles this, but be explicit)
        if (this.sound?.context?.state === 'suspended') {
            try { await this.sound.context.resume(); } catch (_) {}
        }

        // Intro sound
        try {
            const introKey = 'sound_ready_fight_mp3';
            if (this.cache?.audio?.exists(introKey)) {
                this.sound.play(introKey, { volume: 0.5 });
            }
        } catch (_) {}

        // Menu music
        try {
            const { SimplifiedAudioSystem } = await import('../core/audio/SimplifiedAudioSystem.js');
            this.musicManager = new SimplifiedAudioSystem(this);
            await this.musicManager.initialize();
            this.musicManager.playMusic('music/8bit_main_menu.mp3');
        } catch (_) {}
    }

    /**
     * Cleanup when leaving scene
     */
    shutdown() {
        if (this._shutdownDone) return;
        this._shutdownDone = true;
        // Cleanup KeyboardManager
        if (this.keyboardManager) {
            this.keyboardManager.destroy();
            this.keyboardManager = null;
        }

        // Cleanup music manager
        if (this.musicManager) {
            this.musicManager.destroy();
            this.musicManager = null;
        }

        // Cleanup LiteUI
        if (this.mainMenuUI) {
            this.mainMenuUI.destroy();
            this.mainMenuUI = null;
        }

        // Cleanup event listeners
        // Obnovit normální FPS při opuštění menu
        try { this.game.loop.targetFps = 60; } catch (_) { }

        // No blur/focus listeners to clean up
        try { this.sfxRouter && this.sfxRouter.destroy(); } catch (_) { }
        this.sfxRouter = null;
        this.sfxSystem = null;
        this.vfxSystem = null;
        // CentralEventBus is a singleton — don't null it, just remove our listeners
        centralEventBus.removeAllListeners(this);
    }
}

