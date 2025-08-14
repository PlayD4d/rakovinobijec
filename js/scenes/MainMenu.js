// PR7: GameConfig removed - use ConfigResolver only
// import { GameConfig } from '../config.js';
import { calculateGameSize } from '../config.js';
import { HighScoreManager } from '../managers/HighScoreManager.js';
import { GlobalHighScoreManager } from '../managers/GlobalHighScoreManager.js';
import { globalAudioLoader } from '../managers/AudioLoader.js';
import { VfxSystem } from '../core/vfx/VFXSystem.js';
import { buildSfxManifest } from '../core/audio/AudioAssets.js';
import { EventBus } from '../core/events/EventBus.js';
import { MainMenuModal } from '../ui/MainMenuModal.js';
import { HighScoresModal } from '../ui/HighScoresModal.js';
import { SettingsModal } from '../ui/SettingsModal.js';
import { loadGameVersion, getCachedVersion } from '../utils/version.js';

export class MainMenu extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenu' });
        
        this.mainMenuModal = null;
        this.highScoreManager = null;
        this.globalHighScoreManager = null;
        
        // Flag pro tracking fullscreen stavu
        this.isFullscreenMode = false;
    }
    
    preload() {
        // Načíst rexUI plugin do této scény
        this.load.scenePlugin({
            key: 'rexuiplugin',
            url: 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins/dist/rexuiplugin.min.js',
            sceneKey: 'rexUI'
        });
        
        // Načíst checkbox plugin pouze pokud ještě není registrován
        if (!this.plugins?.plugins?.rexcheckboxplugin) {
            this.load.plugin('rexcheckboxplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexcheckboxplugin.min.js', true);
        }

        // Načíst audio centrálně pokud ještě není načteno (včetně rozšířených SFX)
        globalAudioLoader.loadAllAudio(this, true);
        // Načíst SFX manifest z katalogu
        try {
            const manifest = buildSfxManifest();
            for (const { key, urls } of manifest) {
                if (!this.cache.audio.has(key)) {
                    this.load.audio(key, urls);
                }
            }
        } catch (_) {}
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
        
        // Vytvoření main menu modal
        this.mainMenuModal = new MainMenuModal(this, (action, item) => {
            this.handleMenuAction(action, item);
        });
        
        // Keyboard controls
        this.setupKeyboardControls();
        
        // Init EventBus + VFX pro menu
        try {
            this.eventBus = new EventBus();
            this.vfxSystem = new VfxSystem(this);
            this.vfxSystem.initialize();
        } catch (_) {}

        // Přehrát intro zvuk přes router (použij leaf klíč, asset je v kořeni)
        try { this.eventBus && this.eventBus.emit('ui.ready_fight', { sfx: 'ready_fight' }); } catch (_) {}

        // Responzivní resize handler pro menu (uložit a odregistrovat při shutdown)
        this._onResize = (gameSize) => {
            if (this.mainMenuModal) {
                this.mainMenuModal.onResize(gameSize);
            }
        };
        this.scale.on('resize', this._onResize);
        // Ujistit se, že při ukončení scény proběhne úklid (odregistrování posluchačů)
        try {
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
            this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
        } catch (_) {}

        // Blur/Focus: uspání při ztrátě fokusu, probuzení při návratu
        this._onBlur = () => { console.log('[MainMenu] BLUR → sleep'); try { this.game.loop.sleep(); } catch (_) {} };
        this._onFocus = () => { console.log('[MainMenu] FOCUS → wake'); try { this.game.loop.wake(); } catch (_) {} };
        this.game.events.on(Phaser.Core.Events.BLUR, this._onBlur);
        this.game.events.on(Phaser.Core.Events.FOCUS, this._onFocus);

        // Uspat až PO prvním vykreslení – ale ARMovat wake až po krátké prodlevě, jinak nereaguje po cold startu
        try {
            this._sleepAfterFirstPaint = () => {
                console.log('[MainMenu] sleep() after first paint');
                try { this.game.loop.sleep(); } catch (_) {}
                // Po krátké prodlevě povolit wake reagovat (cold start fix)
                this._wakeArmedAt = Date.now() + 150; // 150 ms okno ignorovat "teplé" eventy
                this.time.delayedCall(160, () => { this._wakeArmedAt = 0; });
            };
            this.game.events.once(Phaser.Core.Events.POST_RENDER, this._sleepAfterFirstPaint);
        } catch (_) {}

        // Probuzení na první uživatelskou interakci (klik/klávesa), aby šlo menu ovládat
        try {
            if (!this._wakeListenersRegistered) {
                this._wakeListenersRegistered = true;
                console.log('[MainMenu] registering wake listeners');
                this._wakeOnPointer = () => {
                    if (this._wakeArmedAt && Date.now() < this._wakeArmedAt) return;
                    console.log('[MainMenu] wake() on pointer');
                    try { this.game.loop.wake(); } catch (_) {}
                };
                this._wakeOnKey = () => {
                    if (this._wakeArmedAt && Date.now() < this._wakeArmedAt) return;
                    console.log('[MainMenu] wake() on key');
                    try { this.game.loop.wake(); } catch (_) {}
                };
                try { this.input.on('pointerdown', this._wakeOnPointer); } catch (_) {}
                try { this.input.keyboard && this.input.keyboard.on('keydown', this._wakeOnKey); } catch (_) {}
                // Fallback: DOM posluchače (pro případ, že Phaser input je pauznutý)
                this._wakeOnPointerDom = () => {
                    if (this._wakeArmedAt && Date.now() < this._wakeArmedAt) return;
                    console.log('[MainMenu] wake() on pointer (DOM)');
                    try { this.game.loop.wake(); } catch (_) {}
                };
                this._wakeOnKeyDom = () => {
                    if (this._wakeArmedAt && Date.now() < this._wakeArmedAt) return;
                    console.log('[MainMenu] wake() on key (DOM)');
                    try { this.game.loop.wake(); } catch (_) {}
                };
                try { window.addEventListener('pointerdown', this._wakeOnPointerDom, { passive: true }); } catch (_) {}
                try { window.addEventListener('keydown', this._wakeOnKeyDom); } catch (_) {}
            }
        } catch (_) {}

        // Bezpečné odložené uspání po sestavení UI (0 ms) – minimalizuje riziko probuzení dalším frame
        try {
            this.time.delayedCall(0, () => {
                console.log('[MainMenu] delayed sleep() call');
                try { this.game.loop.sleep(); } catch (_) {}
            });
        } catch (_) {}
    }
    
    /**
     * Setup keyboard controls
     */
    setupKeyboardControls() {
        const keys = this.input.keyboard.addKeys('UP,DOWN,ENTER,ESC,W,S');
        
        keys.UP.on('down', () => this.mainMenuModal?.navigateUp());
        keys.W.on('down', () => this.mainMenuModal?.navigateUp());
        keys.DOWN.on('down', () => this.mainMenuModal?.navigateDown());
        keys.S.on('down', () => this.mainMenuModal?.navigateDown());
        keys.ENTER.on('down', () => this.mainMenuModal?.selectItem());
        keys.ESC.on('down', () => this.handleEscKey());
    }
    
    /**
     * Handle menu actions
     */
    handleMenuAction(action, item) {
        console.log(`Menu action: ${action}`, item);
        
        switch (action) {
            case 'start':
                this.startGame();
                break;
            case 'highscores':
                this.showHighScores();
                break;
            case 'settings':
                this.showSettings();
                break;
            case 'audio':
                this.showAudioSettings();
                break;
            case 'enemies':
                this.showEnemyInfo();
                break;
        }
    }
    
    /**
     * Start the game
     */
    startGame() {
        // Probuď loop před přechodem do hry
        try { this.game.loop.wake(); } catch (_) {}
        // Pro jistotu okamžitě uklidit posluchače z MainMenu ještě před přepnutím scény
        try { this.shutdown(); } catch (_) {}
        // Emit menu confirm (reuse drop.pickup jako jednoduchý potvrzovací zvuk)
        try { this.eventBus && this.eventBus.emit('drop.pickup', {}); } catch (_) {}
        
        // Transition to game
        this.scene.start('GameScene');
    }
    
    /**
     * Show high scores
     */
    async showHighScores() {
        console.log('Loading high scores...');
        
        try {
            const scores = await this.globalHighScoreManager.getHighScores();
            console.log('High scores:', scores);
            
            // Zobrazit high scores modal
            this.highScoresModal = new HighScoresModal(this, scores, () => {
                this.highScoresModal = null;
            });
            
        } catch (error) {
            console.error('Error loading high scores:', error);
        }
    }
    
    /**
     * Show settings
     */
    showSettings() {
        const settingsModal = new SettingsModal(this, () => {
            // On close callback - sem můžeme přidat aplikaci nastavení
            console.log('Settings modal closed');
        });
        
        // Přidat do scene
        this.add.existing(settingsModal);
    }
    
    /**
     * Show audio settings
     */
    showAudioSettings() {
        console.log('Audio settings not implemented yet');
        // TODO: Implement audio settings modal
    }
    
    /**
     * Show enemy information
     */
    showEnemyInfo() {
        console.log('Enemy info not implemented yet');
        // TODO: Implement enemy info modal
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
            try { this.eventBus && this.eventBus.emit('ui.ready_fight', { sfx: 'ready_fight' }); } catch (_) {}
        });
    }
    
    /**
     * Resize handler 
     */
    onResize(gameSize, baseSize, displaySize) {
        console.log(`MainMenu.onResize: ${gameSize.width}x${gameSize.height}`);
        
        if (this.mainMenuModal) {
            this.mainMenuModal.onResize(gameSize, baseSize, displaySize);
        }
    }
    
    /**
     * Cleanup when leaving scene
     */
    shutdown() {
        // Odregistrovat resize listener a uklidit routery/systémy
        try { this.scale.off('resize', this._onResize); } catch (_) {}
        this._onResize = null;
        try { this.game.events.off(Phaser.Core.Events.BLUR, this._onBlur); } catch (_) {}
        try { this.game.events.off(Phaser.Core.Events.FOCUS, this._onFocus); } catch (_) {}
        try { this.game.events.off(Phaser.Core.Events.POST_RENDER, this._sleepAfterFirstPaint); } catch (_) {}
        this._onBlur = null;
        this._onFocus = null;
        this._sleepAfterFirstPaint = null;
        // Zrušit wake poslechy
        try { this.input.off('pointerdown', this._wakeOnPointer); } catch (_) {}
        try { this.input.keyboard && this.input.keyboard.off('keydown', this._wakeOnKey); } catch (_) {}
        try { window.removeEventListener('pointerdown', this._wakeOnPointerDom); } catch (_) {}
        try { window.removeEventListener('keydown', this._wakeOnKeyDom); } catch (_) {}
        this._wakeOnPointer = null;
        this._wakeOnKey = null;
        this._wakeOnPointerDom = null;
        this._wakeOnKeyDom = null;
        try { this.sfxRouter && this.sfxRouter.destroy(); } catch (_) {}
        this.sfxRouter = null;
        this.sfxSystem = null;
        this.vfxSystem = null;
        this.eventBus = null;
        if (this.highScoresModal) {
            this.highScoresModal.destroy();
            this.highScoresModal = null;
        }
    }
}

export default MainMenu;