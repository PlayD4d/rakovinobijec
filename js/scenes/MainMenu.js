// PR7: GameConfig removed - use ConfigResolver only
// import { GameConfig } from '../config.js';
import { calculateGameSize } from '../config.js';
import { HighScoreManager } from '../managers/HighScoreManager.js';
import { GlobalHighScoreManager } from '../managers/GlobalHighScoreManager.js';
// AudioLoader removed - using direct loading
import { VfxSystem } from '../core/vfx/VFXSystem.js';
import { GraphicsFactory } from '../core/graphics/GraphicsFactory.js';
// buildSfxManifest removed - using direct loading
import { EventBus } from '../core/events/EventBus.js';
// LiteUI components - replacing RexUI modals
import { MainMenuUI } from '../ui/lite/MainMenuUI.js';
import { loadGameVersion, getCachedVersion } from '../utils/version.js';
import { getMusicManager } from '../core/audio/MusicManager.js';

export class MainMenu extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenu' });
        
        this.mainMenuUI = null;
        this.highScoreManager = null;
        this.globalHighScoreManager = null;
        this.musicManager = null;
        
        // Flag pro tracking fullscreen stavu
        this.isFullscreenMode = false;
    }
    
    preload() {
        // LiteUI doesn't need external plugins
        // Načíst pouze základní UI zvuky pro menu
        const menuSounds = [
            'sound/intro.mp3',
            'sound/ready_fight.mp3',
            'sound/pickup.mp3'
        ];
        
        menuSounds.forEach(path => {
            const key = path.split('/').pop().replace('.mp3', '');
            if (!this.cache.audio.has(key)) {
                this.load.audio(key, path);
            }
        });
        
        // Load menu music if configured
        const CR = window.ConfigResolver;
        if (CR) {
            const menuMusic = CR.get('audio.scenes.mainMenu.backgroundMusic');
            if (menuMusic) {
                const musicKey = menuMusic.split('/').pop().split('.')[0];
                if (!this.cache.audio.has(musicKey)) {
                    this.load.audio(musicKey, menuMusic);
                }
            }
        }
    }
    
    async create() {        
        console.log('[MainMenu] create');
        // V menu fyziku nepotřebujeme – pauznout pro úsporu CPU
        try { this.physics?.world?.pause(); } catch (_) {}
        // Bezpečnost: zastavit všechny hrající zvuky/hudbu po návratu z GameScene
        try { this.sound && this.sound.stopAll && this.sound.stopAll(); } catch (_) {}
        try { this.game && this.game.sound && this.game.sound.stopAll && this.game.sound.stopAll(); } catch (_) {}
        // Debug: Check scene dimensions
        console.log('=== MAINMENU SCENE DEBUG ===');
        console.log('scene.scale.width:', this.scale.width);
        console.log('scene.scale.height:', this.scale.height);
        console.log('scene.scale.gameSize:', this.scale.gameSize);
        console.log('scene.cameras.main size:', this.cameras.main.width, 'x', this.cameras.main.height);
        
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
        
        // Vytvoření main menu UI (LiteUI)
        this.mainMenuUI = new MainMenuUI(this);
        
        // Simple keyboard controls for ESC
        if (this.input.keyboard) {
            this.input.keyboard.on('keydown-ESC', this.handleEscKey, this);
        }
        
        // PR7: Init GraphicsFactory first, then EventBus + VFX pro menu
        try {
            this.graphicsFactory = new GraphicsFactory(this);
            this.eventBus = new EventBus();
            this.vfxSystem = new VfxSystem(this);
            this.vfxSystem.initialize();
        } catch (_) {}

        // Přehrát intro zvuk přes router (použij leaf klíč, asset je v kořeni)
        try { this.eventBus && this.eventBus.emit('ui.ready_fight', { sfx: 'ready_fight' }); } catch (_) {}
        
        // Initialize and start menu music
        try {
            this.musicManager = getMusicManager(this);
            this.musicManager.playCategory('mainMenu');
        } catch (e) {
            console.warn('[MainMenu] Failed to start music:', e);
        }

        // LiteUI doesn't need resize handlers - it's simple and fixed
        // Ujistit se, že při ukončení scény proběhne úklid (odregistrování posluchačů)
        try {
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
            this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
        } catch (_) {}

        // Remove blur/focus sleep/wake - it causes input issues in menu
        // Keep the game running in menu for responsive UI
        console.log('[MainMenu] Skipping blur/focus sleep/wake - keeping menu responsive');

        // NEUSPÁVAT menu automaticky - nechme ho běžet, ale s nízkou frame rate
        // Menu je jednoduché a LiteUI nezatěžuje systém
        // Sleep pouze při blur (ztráta fokusu okna)

        // Keep normal FPS in menu for responsive UI
        // Low FPS can cause input lag and unresponsive buttons
        try {
            this.game.loop.targetFps = 30; // Compromise between performance and responsiveness
        } catch (_) {}
    }
    
    // Keyboard navigation removed - LiteUI uses mouse/touch only for simplicity
    
    // Menu action handling is now done directly in MainMenuUI buttons
    
    /**
     * Start the game
     */
    startGame() {
        // Stop menu music before transitioning
        if (this.musicManager) {
            this.musicManager.stop();
        }
        
        // Obnovit normální FPS před přechodem do hry
        try { this.game.loop.targetFps = 60; } catch (_) {}
        // Pro jistotu okamžitě uklidit posluchače z MainMenu ještě před přepnutím scény
        try { this.shutdown(); } catch (_) {}
        // Emit menu confirm (reuse drop.pickup jako jednoduchý potvrzovací zvuk)
        try { this.eventBus && this.eventBus.emit('drop.pickup', {}); } catch (_) {}
        
        // Transition to game
        this.scene.start('GameScene');
    }
    
    // High scores functionality temporarily disabled - will be added to LiteUI later
    
    // Settings functionality temporarily disabled - will be added to LiteUI later
    
    // Audio and enemy info functionality will be added to LiteUI later
    
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
            try { this.eventBus && this.eventBus.emit('ui.ready_fight', { sfx: 'ready_fight' }); } catch (_) {}
        });
    }
    
    // LiteUI doesn't need resize handlers
    
    /**
     * Cleanup when leaving scene
     */
    shutdown() {
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
        try { this.game.loop.targetFps = 60; } catch (_) {}
        
        // No blur/focus listeners to clean up
        try { this.sfxRouter && this.sfxRouter.destroy(); } catch (_) {}
        this.sfxRouter = null;
        this.sfxSystem = null;
        this.vfxSystem = null;
        this.eventBus = null;
        // RexUI modals removed - using LiteUI now
    }
}

export default MainMenu;