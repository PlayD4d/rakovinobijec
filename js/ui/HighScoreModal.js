/**
 * HighScoreModal - unified high score dialog komponenta
 * Nahrazuje starý inline high score dialog v GameScene
 */
import { BaseUIComponent } from './BaseUIComponent.js';
import { UI_THEME, UIThemeUtils } from './UITheme.js';
import { RESPONSIVE } from './UiConstants.js';

export class HighScoreModal extends BaseUIComponent {
    constructor(scene, gameStats, onSubmitCallback = null) {
        // Validate scene before using it
        const width = scene?.scale?.width || 800;
        const height = scene?.scale?.height || 600;
        
        super(scene, 0, 0, {
            width: width,
            height: height,
            theme: 'modal',
            responsive: true
        });
        
        this.gameStats = gameStats;
        this.onSubmitCallback = onSubmitCallback;
        this.modalContainer = null;
        this.playerName = '';
        this.inputText = null;
        this.keyboardHandler = null;
        this.hasSubmitted = false;
        
        this.setDepth(UI_THEME.depth.modal);
    }
    
    getComponentDepth() {
        return UI_THEME.depth.modal;
    }
    
    /**
     * Zobrazí high score entry modal (zadání jména)
     */
    showEntry() {
        // Validate scene is still valid
        if (!this.scene || !this.scene.scale) {
            console.error('[HighScoreModal] Cannot show - invalid scene reference');
            return;
        }
        
        const { width, height } = this.scene.scale.gameSize;
        
        // Overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(UI_THEME.colors.background.overlay, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(UI_THEME.depth.overlay);
        
        // Add overlay to UI layer if it exists
        if (this.scene.uiLayer) {
            this.scene.uiLayer.add(overlay);
        }
        
        // Modal size
        const modalSize = RESPONSIVE.getModalSize(this.isMobileDevice, width, height);
        modalSize.height = Math.min(modalSize.height, height * 0.8);
        
        // Main container
        this.modalContainer = this.scene.rexUI.add.sizer({
            x: width / 2,
            y: height / 2,
            width: modalSize.width,
            height: modalSize.height,
            orientation: 'vertical',
            space: { item: UI_THEME.spacing.l }
        });
        
        // Background
        const background = this.scene.rexUI.add.roundRectangle(
            0, 0, modalSize.width, modalSize.height,
            UI_THEME.borderRadius.large,
            UI_THEME.colors.background.modal
        ).setStrokeStyle(
            UI_THEME.borderWidth.thick,
            UI_THEME.colors.success
        );
        
        this.modalContainer.addBackground(background);
        
        // Set proper depth and add to UI layer
        this.modalContainer.setDepth(UI_THEME.depth.modal);
        if (this.scene.uiLayer) {
            this.scene.uiLayer.add(this.modalContainer);
        }
        
        // Title - Congratulations
        const titleText = this.scene.add.text(0, 0, 
            '🎉 GRATULUJEME! 🎉\nZískali jste místo v TOP 10!',
            {
                ...UIThemeUtils.createFontConfig('large', 'success', { 
                    stroke: true, 
                    strokeThickness: 3,
                    isMobile: this.isMobileDevice 
                }),
                align: 'center'
            }
        ).setOrigin(0.5);
        
        this.modalContainer.add(titleText, {
            proportion: 0,
            align: 'center',
            padding: { top: UI_THEME.spacing.xl }
        });
        
        // Stats info
        const statsText = this.scene.add.text(0, 0,
            `Skóre: ${this.gameStats.score}\nÚroveň: ${this.gameStats.level}\nNepřátel: ${this.gameStats.enemiesKilled}\nBossové: ${this.gameStats.bossesDefeated || 0}`,
            {
                ...UIThemeUtils.createFontConfig('normal', 'primary', { 
                    stroke: true,
                    isMobile: this.isMobileDevice 
                }),
                align: 'center'
            }
        ).setOrigin(0.5);
        
        this.modalContainer.add(statsText, {
            proportion: 0,
            align: 'center',
            padding: { top: UI_THEME.spacing.m }
        });
        
        // Name prompt
        const namePrompt = this.scene.add.text(0, 0,
            'Zadejte své jméno (max 8 znaků):',
            UIThemeUtils.createFontConfig('normal', 'primary', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        this.modalContainer.add(namePrompt, {
            proportion: 0,
            align: 'center',
            padding: { top: UI_THEME.spacing.l }
        });
        
        // Input container
        const inputContainer = this.scene.rexUI.add.sizer({
            orientation: 'vertical',
            space: { item: UI_THEME.spacing.m }
        });
        
        // Input box background
        const inputBg = this.scene.rexUI.add.roundRectangle(
            0, 0, 240, 50,
            UI_THEME.borderRadius.normal,
            UI_THEME.colors.background.input
        ).setStrokeStyle(
            UI_THEME.borderWidth.normal,
            UI_THEME.colors.borders.default
        );
        
        // Input text
        this.inputText = this.scene.add.text(0, 0, '_',
            UIThemeUtils.createFontConfig('normal', 'primary', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        // Input wrapper - použít RexUI OverlapSizer
        const inputWrapper = this.scene.rexUI.add.overlapSizer({
            width: 240,
            height: 50
        })
        .add(inputBg)
        .add(this.inputText)
        .layout();
        
        inputContainer.add(inputWrapper, { proportion: 0, align: 'center' });
        
        // Instructions
        const instructions = this.scene.add.text(0, 0,
            'Píšte na klávesnici, ENTER pro odeslání (prázdné = Anonym)',
            UIThemeUtils.createFontConfig('small', 'secondary', { 
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        inputContainer.add(instructions, { proportion: 0, align: 'center' });
        inputContainer.layout();
        
        this.modalContainer.add(inputContainer, {
            proportion: 0,
            align: 'center',
            padding: { top: UI_THEME.spacing.m, bottom: UI_THEME.spacing.xl }
        });
        
        // Layout modal
        this.modalContainer.layout();
        
        // Add to scene
        this.add([overlay, this.modalContainer]);
        
        // Setup keyboard input
        this.setupKeyboardInput();
        
        // Fade in animation
        this.modalContainer.alpha = 0;
        this.scene.tweens.add({
            targets: this.modalContainer,
            alpha: 1,
            duration: 500
        });
    }
    
    /**
     * Zobrazí high score result modal (výsledek)
     */
    showResult(position) {
        const { width, height } = this.scene.scale.gameSize;
        
        // Overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(UI_THEME.colors.background.overlay, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(UI_THEME.depth.overlay);
        
        // Add overlay to UI layer if it exists
        if (this.scene.uiLayer) {
            this.scene.uiLayer.add(overlay);
        }
        
        // Modal size
        const modalSize = RESPONSIVE.getModalSize(this.isMobileDevice, width, height);
        
        // Main container
        this.modalContainer = this.scene.rexUI.add.sizer({
            x: width / 2,
            y: height / 2,
            width: modalSize.width,
            height: modalSize.height,
            orientation: 'vertical',
            space: { item: UI_THEME.spacing.l }
        });
        
        // Background
        const background = this.scene.rexUI.add.roundRectangle(
            0, 0, modalSize.width, modalSize.height,
            UI_THEME.borderRadius.large,
            UI_THEME.colors.background.modal
        ).setStrokeStyle(
            UI_THEME.borderWidth.thick,
            UI_THEME.colors.success
        );
        
        this.modalContainer.addBackground(background);
        
        // Set proper depth and add to UI layer
        this.modalContainer.setDepth(UI_THEME.depth.modal);
        if (this.scene.uiLayer) {
            this.scene.uiLayer.add(this.modalContainer);
        }
        
        // Title
        const titleText = this.scene.add.text(0, 0,
            `🏆 Umístili jste se na ${position}. místě! 🏆`,
            {
                ...UIThemeUtils.createFontConfig('large', 'success', { 
                    stroke: true, 
                    strokeThickness: 3,
                    isMobile: this.isMobileDevice 
                }),
                align: 'center'
            }
        ).setOrigin(0.5);
        
        this.modalContainer.add(titleText, {
            proportion: 0,
            align: 'center',
            padding: { top: UI_THEME.spacing.xl }
        });
        
        // Score info
        const scoreText = this.scene.add.text(0, 0,
            `Skóre: ${this.gameStats.score}`,
            {
                ...UIThemeUtils.createFontConfig('normal', 'primary', { 
                    stroke: true,
                    isMobile: this.isMobileDevice 
                }),
                align: 'center'
            }
        ).setOrigin(0.5);
        
        this.modalContainer.add(scoreText, {
            proportion: 1,
            align: 'center',
            padding: { top: UI_THEME.spacing.m }
        });
        
        // Controls info
        const controlsText = this.scene.add.text(0, 0,
            'R - Restart | ESC - Menu',
            UIThemeUtils.createFontConfig('small', 'secondary', { 
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        this.modalContainer.add(controlsText, {
            proportion: 0,
            align: 'center',
            padding: { bottom: UI_THEME.spacing.xl }
        });
        
        // Layout modal
        this.modalContainer.layout();
        
        // Add to scene
        this.add([overlay, this.modalContainer]);
        
        // Fade in animation
        this.modalContainer.alpha = 0;
        this.scene.tweens.add({
            targets: this.modalContainer,
            alpha: 1,
            duration: 500
        });
    }
    
    /**
     * Setup keyboard input for name entry
     */
    setupKeyboardInput() {
        this.keyboardHandler = (event) => {
            if (this.hasSubmitted) return;
            
            if (event.key === 'Enter') {
                // Odeslat jméno (i když je prázdné - použije se "Anonym" v GameScene)
                this.hasSubmitted = true;
                this.scene.input.keyboard.off('keydown', this.keyboardHandler);
                
                if (this.onSubmitCallback) {
                    // Poslat prázdný string nebo trimované jméno
                    this.onSubmitCallback(this.playerName.trim());
                }
            } else if (event.key === 'Backspace') {
                if (this.playerName.length > 0) {
                    this.playerName = this.playerName.slice(0, -1);
                    this.inputText.setText(this.playerName + '_');
                }
            } else if (event.key.length === 1 && this.playerName.length < 8) {
                // Přidat znak (pouze písmena, číslice a základní znaky)
                if (/[a-zA-Z0-9čďěščřžýáíéúů]/i.test(event.key)) {
                    this.playerName += event.key;
                    this.inputText.setText(this.playerName + '_');
                }
            }
        };
        
        this.scene.input.keyboard.on('keydown', this.keyboardHandler);
    }
    
    /**
     * Resize handler
     */
    onResize(gameSize, baseSize, displaySize) {
        super.onResize(gameSize, baseSize, displaySize);
        
        if (this.modalContainer) {
            this.modalContainer.x = gameSize.width / 2;
            this.modalContainer.y = gameSize.height / 2;
        }
    }
    
    /**
     * Cleanup
     */
    onCleanup() {
        if (this.keyboardHandler) {
            this.scene.input.keyboard.off('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        
        this.onSubmitCallback = null;
        
        if (this.modalContainer) {
            this.modalContainer.destroy();
            this.modalContainer = null;
        }
    }
    
    /**
     * Destroy modal
     */
    destroy() {
        this.onCleanup();
        super.destroy();
    }
}

export default HighScoreModal;