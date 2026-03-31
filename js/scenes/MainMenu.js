import { calculateGameSize } from '../config.js';
import { HighScoreManager } from '../managers/HighScoreManager.js';
import { GlobalHighScoreManager } from '../managers/GlobalHighScoreManager.js';
import { VFXSystem } from '../core/vfx/VFXSystem.js';
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

        // Flag for tracking fullscreen state
        this.isFullscreenMode = false;
    }

    init() {
        this._shutdownDone = false;
    }

    preload() {
        // LiteUI doesn't need external plugins
        // Load only basic UI sounds for menu
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
        // We don't need physics in menu - pause to save CPU
        try { this.physics?.world?.pause(); } catch (_) { }
        // Safety: stop all playing sounds/music after returning from GameScene
        try { this.sound && this.sound.stopAll && this.sound.stopAll(); } catch (_) { }
        try { this.game && this.game.sound && this.game.sound.stopAll && this.game.sound.stopAll(); } catch (_) { }
        // Debug: Check scene dimensions
        DebugLogger.info('menu', '=== MAINMENU SCENE DEBUG ===');
        DebugLogger.info('menu', 'scene.scale.width:', this.scale.width);
        DebugLogger.info('menu', 'scene.scale.height:', this.scale.height);
        DebugLogger.info('menu', 'scene.scale.gameSize:', this.scale.gameSize);
        DebugLogger.info('menu', 'scene.cameras.main size:', this.cameras.main.width, 'x', this.cameras.main.height);

        // Load game version from version.js
        try {
            this.gameVersion = await loadGameVersion();
        } catch (e) {
            this.gameVersion = getCachedVersion();
        }

        // Initialize high score managers
        this.highScoreManager = new HighScoreManager();
        this.globalHighScoreManager = new GlobalHighScoreManager();
        this.globalHighScoreManager.setLocalFallback(this.highScoreManager);

        // Use shared CentralEventBus (Phaser recommended: standalone EventEmitter singleton)
        this.eventBus = centralEventBus;

        // Fade in (from GameScene return or fresh load)
        this.cameras.main.fadeIn(400, 0, 0, 0);

        // Create main menu UI (LiteUI)
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

        // PR7: Init GraphicsFactory and VFX for menu
        try {
            this.graphicsFactory = new GraphicsFactory(this);
            this.vfxSystem = new VFXSystem(this);
            this.vfxSystem.initialize();
        } catch (_) { }

        // Defer audio until first user gesture (Chrome autoplay policy)
        // Phaser's sound manager handles AudioContext resume on user interaction
        this._musicStarted = false;
        this.input.once('pointerdown', () => this._startMenuAudio());

        // LiteUI doesn't need resize handlers - it's simple and fixed
        // Ensure cleanup runs when the scene shuts down (unregister listeners)
        try {
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
        } catch (_) { }

        // Remove blur/focus sleep/wake - it causes input issues in menu
        // Keep the game running in menu for responsive UI
        DebugLogger.info('menu', '[MainMenu] Skipping blur/focus sleep/wake - keeping menu responsive');

        // Do NOT auto-sleep menu - let it run but at a low frame rate
        // Menu is simple and LiteUI doesn't strain the system
        // Sleep only on blur (window focus loss)

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

        // Restore normal FPS before transitioning to game
        try { this.game.loop.targetFps = 60; } catch (_) { }
        // Play pickup sound for menu confirm (before scene transition tears down audio)
        try {
            this.musicManager?.play('sound/pickup.mp3', { volume: 0.5 });
        } catch (_) { }

        // Fade out then transition to game
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameScene');
        });
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
        }, this);

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

    // LiteUI doesn't need resize handlers

    /** Start menu audio after first user gesture (Chrome autoplay policy compliance) */
    async _startMenuAudio() {
        if (this._musicStarted) return;
        this._musicStarted = true;

        // Resume AudioContext if suspended (Phaser handles this, but be explicit)
        if (this.sound?.context?.state === 'suspended') {
            try { await this.sound.context.resume(); } catch (_) {}
        }

        // Menu music only — no intro sound (no intro screen to justify it)
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

        // Cleanup global high score manager
        if (this.globalHighScoreManager) {
            this.globalHighScoreManager.shutdown();
            this.globalHighScoreManager = null;
        }

        // Cleanup event listeners
        // Restore normal FPS when leaving menu
        try { this.game.loop.targetFps = 60; } catch (_) { }

        // No blur/focus listeners to clean up
        try { this.sfxRouter?.destroy(); } catch (_) { }
        try { this.vfxSystem?.shutdown?.(); } catch (_) { }
        try { this.graphicsFactory?.shutdown?.(); } catch (_) { }
        this.sfxRouter = null;
        this.sfxSystem = null;
        this.vfxSystem = null;
        this.graphicsFactory = null;
        // CentralEventBus is a singleton — don't null it, just remove our listeners
        centralEventBus.removeAllListeners(this);
    }
}

