/**
 * MainMenu — clean main menu scene
 * LiteUI, menu music, keyboard ESC for fullscreen toggle
 */
import { centralEventBus } from '../core/events/CentralEventBus.js';
import { KeyboardManager } from '../core/input/KeyboardManager.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
import { MainMenuUI } from '../ui/lite/MainMenuUI.js';
import { loadGameVersion, getCachedVersion } from '../utils/version.js';

export class MainMenu extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenu' });
        this.mainMenuUI = null;
        this.musicManager = null;
        this.keyboardManager = null;
    }

    init() {
        this._shutdownDone = false;
        this._musicStarted = false;
    }

    preload() {
        // Menu click sound
        const key = 'sound_pickup_mp3';
        if (!this.cache.audio.has(key)) {
            this.load.audio(key, 'sound/pickup.mp3');
        }
    }

    async create() {
        // Pause physics — menu doesn't need it
        try { this.physics?.world?.pause(); } catch (_) {}
        // Stop any lingering sounds from previous scene
        try { this.sound?.stopAll(); } catch (_) {}

        // Load version
        try {
            this.gameVersion = await loadGameVersion();
        } catch (_) {
            this.gameVersion = getCachedVersion();
        }

        // Fade in
        this.cameras.main.fadeIn(400, 0, 0, 0);

        // UI
        this.mainMenuUI = new MainMenuUI(this, this.gameVersion);

        // Keyboard (ESC = exit fullscreen)
        try {
            this.keyboardManager = new KeyboardManager(this, centralEventBus);
            this.keyboardManager.register('ESC', 'ui:menu-escape', 'menu');
            centralEventBus.on('ui:menu-escape', () => {
                if (this.scale.isFullscreen) this.scale.stopFullscreen();
            }, this);
        } catch (_) {}

        // Audio — deferred until first user gesture (Chrome autoplay policy)
        this.input.once('pointerdown', () => this._startMenuAudio());

        // Cleanup on shutdown
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

        // Lower FPS in menu — saves battery, menu is simple
        try { this.game.loop.targetFps = 30; } catch (_) {}
    }

    startGame() {
        if (this.musicManager) this.musicManager.stopMusic();
        try { this.game.loop.targetFps = 60; } catch (_) {}
        try { this.musicManager?.play('sound/pickup.mp3', { volume: 0.5 }); } catch (_) {}

        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameScene');
        });
    }

    async _startMenuAudio() {
        if (this._musicStarted) return;
        this._musicStarted = true;

        if (this.sound?.context?.state === 'suspended') {
            try { await this.sound.context.resume(); } catch (_) {}
        }

        try {
            const { SimplifiedAudioSystem } = await import('../core/audio/SimplifiedAudioSystem.js');
            this.musicManager = new SimplifiedAudioSystem(this);
            await this.musicManager.initialize();
            this.musicManager.playMusic('music/8bit_main_menu.mp3');
        } catch (_) {}
    }

    shutdown() {
        if (this._shutdownDone) return;
        this._shutdownDone = true;

        this.keyboardManager?.destroy();
        this.musicManager?.destroy();
        this.mainMenuUI?.destroy();

        this.keyboardManager = null;
        this.musicManager = null;
        this.mainMenuUI = null;

        try { this.game.loop.targetFps = 60; } catch (_) {}
        centralEventBus.removeAllListeners(this);
    }
}
