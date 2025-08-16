/**
 * PauseMenuModal - unified pause menu komponenta
 * Postavená na BaseUIComponent s plnou responzivitou
 */
import { BaseUIComponent } from './BaseUIComponent.js';
import { UI_THEME, UIThemeUtils } from './UITheme.js';
import { RESPONSIVE } from './UiConstants.js';
import { SettingsModal } from './SettingsModal.js';

export class PauseMenuModal extends BaseUIComponent {
    constructor(scene, onResumeCallback = null) {
        // Validate scene before using it
        const width = scene?.scale?.width || 800;
        const height = scene?.scale?.height || 600;
        
        super(scene, 0, 0, {
            width: width,
            height: height,
            theme: 'modal',
            responsive: true
        });
        
        this.onResumeCallback = onResumeCallback;
        this.menuContainer = null;
        this.isPaused = false;
        this.isAnimating = false; // Flag pro animace
        
        this.createPauseMenu();
        
        // Set proper depth to be above everything
        const modalDepth = scene.DEPTH_LAYERS?.UI_MODAL || UI_THEME.depth.modal || 20000;
        this.setDepth(modalDepth);
        
        // Hide initially
        this.setVisible(false);
    }
    
    getComponentDepth() {
        return UI_THEME.depth.modal;
    }
    
    /**
     * Vytvoří pause menu - container-based structure
     */
    createPauseMenu() {
        // Validate scene before using it
        if (!this.scene || !this.scene.scale) {
            console.error('[PauseMenuModal] Cannot create pause menu - invalid scene reference');
            return;
        }
        
        // Overlay - přidat do kontejneru přes BaseUIComponent
        this.overlay = this.createModalOverlay(0.7);
        
        // Get modal size
        const modalSize = RESPONSIVE.getModalSize(this.isMobileDevice);
        const menuWidth = Math.min(modalSize.width * 0.6, 400);
        const menuHeight = Math.min(modalSize.height * 0.7, 500);
        
        // Menu container - pozice uprostřed scény
        const { width, height } = this.scene.scale.gameSize;
        this.menuContainer = this.scene.rexUI.add.sizer({
            x: width / 2,
            y: height / 2,
            width: menuWidth,
            height: menuHeight,
            orientation: 'vertical',
            space: { item: UI_THEME.spacing.l }
        });
        
        // Přidat menu container jako dítě BaseUIComponent kontejneru
        this.add(this.menuContainer);
        
        // Background - make it more opaque for better visibility
        const background = this.scene.rexUI.add.roundRectangle(
            0, 0, menuWidth, menuHeight,
            UI_THEME.borderRadius.large,
            0x1a1a2e // Dark opaque background instead of semi-transparent
        ).setStrokeStyle(
            UI_THEME.borderWidth.thick,
            UI_THEME.colors.borders.active
        );
        background.setAlpha(1); // Ensure full opacity
        
        this.menuContainer.addBackground(background);
        
        // Title
        const titleText = this.scene.add.text(0, 0, 'PAUZA',
            UIThemeUtils.createFontConfig('title', 'primary', {
                stroke: true,
                strokeThickness: 4,
                isMobile: this.isMobileDevice
            })
        ).setOrigin(0.5);
        
        this.menuContainer.add(titleText, {
            proportion: 0,
            align: 'center',
            padding: { top: UI_THEME.spacing.xl, bottom: UI_THEME.spacing.l }
        });
        
        // Menu buttons
        this.createMenuButtons();
        
        // Instructions
        const instructionText = this.scene.add.text(0, 0,
            'ESC pro pokračování',
            UIThemeUtils.createFontConfig('small', 'secondary', {
                isMobile: this.isMobileDevice
            })
        ).setOrigin(0.5);
        
        this.menuContainer.add(instructionText, {
            proportion: 0,
            align: 'center',
            padding: { bottom: UI_THEME.spacing.l }
        });
        
        // Layout the menu
        this.menuContainer.layout();
        
        // Hide menu container initially
        this.menuContainer.setVisible(false);
        
        // Do not add to container, RexUI handles its own rendering
        // this.add(this.menuContainer);
    }
    
    /**
     * Vytvoří menu tlačítka
     */
    createMenuButtons() {
        const buttonWidth = 250;
        const buttonHeight = 50;
        
        // Resume button
        const resumeButton = this.createMenuButton(
            'Pokračovat',
            buttonWidth, buttonHeight,
            () => this.resume()
        );
        
        this.menuContainer.add(resumeButton, {
            proportion: 0,
            align: 'center',
            padding: { bottom: UI_THEME.spacing.m }
        });
        
        // Settings button
        const settingsButton = this.createMenuButton(
            'Nastavení',
            buttonWidth, buttonHeight,
            () => this.openSettings()
        );
        
        this.menuContainer.add(settingsButton, {
            proportion: 0,
            align: 'center',
            padding: { bottom: UI_THEME.spacing.m }
        });
        
        // Help button (placeholder)
        const helpButton = this.createMenuButton(
            'Nápověda',
            buttonWidth, buttonHeight,
            () => this.showHelp()
        );
        
        this.menuContainer.add(helpButton, {
            proportion: 0,
            align: 'center',
            padding: { bottom: UI_THEME.spacing.m }
        });
        
        // Quit game button
        const quitButton = this.createMenuButton(
            'Ukončit hru',
            buttonWidth, buttonHeight,
            () => this.quitGame(),
            UI_THEME.colors.warning // Different color for destructive action
        );
        
        this.menuContainer.add(quitButton, {
            proportion: 0,
            align: 'center',
            padding: { bottom: UI_THEME.spacing.m }
        });
    }
    
    /**
     * Vytvoří jednotlivé menu tlačítko
     */
    createMenuButton(text, width, height, callback, color = UI_THEME.colors.primary) {
        const button = this.scene.rexUI.add.label({
            width: width,
            height: height,
            background: this.scene.rexUI.add.roundRectangle(
                0, 0, width, height,
                UI_THEME.borderRadius.medium,
                UI_THEME.colors.background.card
            ).setStrokeStyle(
                UI_THEME.borderWidth.normal,
                color
            ),
            text: this.scene.add.text(0, 0, text, {
                fontFamily: UI_THEME.fonts.primary,
                fontSize: UIThemeUtils.getFontSize('normal', this.isMobileDevice) + 'px',
                color: UIThemeUtils.colorToHex(color)
            }),
            space: {
                left: UI_THEME.spacing.m,
                right: UI_THEME.spacing.m,
                top: UI_THEME.spacing.s,
                bottom: UI_THEME.spacing.s
            },
            align: 'center'
        });
        
        // Make interactive
        button.setInteractive();
        
        // Click handler
        button.on('pointerdown', () => {
            // Button press animation
            this.scene.tweens.add({
                targets: button,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: callback
            });
        });
        
        // Hover effects (desktop only)
        if (!this.isMobileDevice) {
            button.on('pointerover', () => {
                button.getElement('background').setFillStyle(UI_THEME.colors.background.panel);
                button.getElement('background').setStrokeStyle(
                    UI_THEME.borderWidth.thick,
                    UI_THEME.colors.borders.active
                );
            });
            
            button.on('pointerout', () => {
                button.getElement('background').setFillStyle(UI_THEME.colors.background.card);
                button.getElement('background').setStrokeStyle(
                    UI_THEME.borderWidth.normal,
                    color
                );
            });
        }
        
        button.layout();
        return button;
    }
    
    /**
     * Zobrazí pause menu
     */
    pause() {
        console.log('[PauseMenuModal] pause() called, isPaused:', this.isPaused);
        if (this.isPaused) return;
        
        this.isPaused = true;
        this.isAnimating = true; // Začíná animace
        
        // Debug: Check depth ordering
        if (this.overlay && this.menuContainer) {
            console.table({
                overlayDepth: this.overlay.depth,
                menuDepth: this.menuContainer.depth,
                uiLayerDepth: this.scene.uiLayer?.depth,
                expectedOverlay: this.scene.DEPTH_LAYERS?.UI_MODAL ? this.scene.DEPTH_LAYERS.UI_MODAL - 1 : 19999,
                expectedModal: this.scene.DEPTH_LAYERS?.UI_MODAL || 20000
            });
        }
        
        // PR7: Notify GameScene about pause state
        if (this.scene.setPaused) {
            this.scene.setPaused(true);
        }
        
        // Zastavit physics hned
        this.scene.physics.pause();
        
        // DŮLEŽITÉ: NEpauzovat scene.time tady - tweeny by se nespustily!
        // Pauzujeme až po dokončení animací
        
        // Použít BaseUIComponent.show() pro pause-safe animace
        this.show(true, 300).then(() => {
            // Po dokončení animace zobrazit menu obsah
            if (this.menuContainer) {
                this.menuContainer.setVisible(true);
                this.menuContainer.layout();
            }
            
            // TEPRVE TEĎ zastavit scene time - po dokončení animací
            this.scene.time.paused = true;
            
            this.isAnimating = false; // Animace dokončena
            console.log('[PauseMenuModal] Pause animation complete, time paused:', this.scene.time.paused);
        });
    }
    
    /**
     * Skryje pause menu a pokračuje ve hře
     */
    resume() {
        console.log('[PauseMenuModal] resume() called, isPaused:', this.isPaused);
        if (!this.isPaused) {
            console.log('[PauseMenuModal] Already resumed, skipping');
            return;
        }
        
        this.isPaused = false;
        this.isAnimating = true; // Začíná animace
        
        // Obnovit physics HNED, ne až po animaci
        this.scene.physics.resume();
        
        // Obnovit timery HNED
        this.scene.time.paused = false;
        
        // PR7: Notify GameScene about resume
        if (this.scene.setPaused) {
            this.scene.setPaused(false);
        }
        
        // Skrýt menu obsah nejprve
        if (this.menuContainer) {
            this.menuContainer.setVisible(false);
        }
        
        // Použít BaseUIComponent.hide() pro pause-safe animace
        this.hide(true, 300).then(() => {
            this.isAnimating = false; // Animace dokončena
            console.log('[PauseMenuModal] Resume animation complete');
            if (this.onResumeCallback) {
                this.onResumeCallback();
            }
        });
    }
    
    /**
     * Toggle pause state
     */
    toggle() {
        // PR7 compliant: Use internal state as single source of truth
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }
    
    /**
     * Otevře nastavení
     */
    openSettings() {
        // Reuse existing settings modal or create new one
        if (!this.settingsModal) {
            this.settingsModal = new SettingsModal(this.scene, () => {
                // On close callback - nastavení aplikována
                console.log('Settings modal closed from pause menu');
            });
            
            // Přidat do scene pouze jednou
            this.scene.add.existing(this.settingsModal);
        } else {
            // Just show existing modal
            this.settingsModal.show();
        }
    }
    
    /**
     * Zobrazí nápovědu - placeholder
     */
    showHelp() {
        console.log('Nápověda není ještě implementována');
        // TODO: Implementovat nápovědu později
    }
    
    /**
     * Ukončí hru a vrátí se do hlavního menu
     */
    quitGame() {
        console.log('[PauseMenuModal] Quitting game to main menu');
        
        // Uchovat referenci na scénu před jakýmkoliv cleanupem
        const scene = this.scene;
        if (!scene || !scene.sys) {
            console.error('[PauseMenuModal] Cannot quit - scene invalid');
            return;
        }
        
        // Reset pause state přes uloženou scénu
        this.isPaused = false;
        
        // Resume physics před scene switchem
        if (scene.physics) {
            scene.physics.resume();
        }
        
        // Resume timers
        if (scene.time) {
            scene.time.paused = false;
        }
        
        // Notify GameScene about unpause
        if (scene.setPaused) {
            scene.setPaused(false);
        }
        
        // Stop sounds
        scene.sound.stopAll();
        
        // Znič samotný PauseMenuModal (odstraní listenery a UI komponenty)
        this.destroy();
        
        // Přepni scény na další tick, až skončí current call stack
        scene.time.delayedCall(0, () => {
            scene.scene.stop('GameScene');
            scene.scene.start('MainMenu');
        });
    }
    
    /**
     * Handle ESC key - PR7 compliant
     */
    handleEscKey() {
        console.log('[PauseMenuModal] handleEscKey called, isPaused:', this.isPaused, 'isAnimating:', this.isAnimating);
        
        // Pokud probíhá animace, ignorovat
        if (this.isAnimating) {
            console.log('[PauseMenuModal] Animation in progress, ignoring ESC');
            return;
        }
        
        // Debounce to prevent rapid toggling - zvýšíme na 500ms
        const now = Date.now();
        if (this.lastEscTime && now - this.lastEscTime < 500) {
            console.log('[PauseMenuModal] Ignoring rapid press (debounce)');
            return; // Ignore rapid presses
        }
        this.lastEscTime = now;
        
        // Direct check of internal state to avoid double-triggering
        if (this.isPaused) {
            console.log('[PauseMenuModal] Resuming game');
            this.resume();
        } else {
            console.log('[PauseMenuModal] Pausing game');
            this.pause();
        }
    }
    
    /**
     * Resize handler
     */
    onResize(gameSize, baseSize, displaySize) {
        super.onResize(gameSize, baseSize, displaySize);
        
        // Re-position the menu container
        if (this.menuContainer) {
            this.menuContainer.x = gameSize.width / 2;
            this.menuContainer.y = gameSize.height / 2;
            this.menuContainer.layout();
        }
    }
    
    /**
     * Cleanup
     */
    onCleanup() {
        this.isPaused = false;
        this.onResumeCallback = null;
        
        // Clean up settings modal if exists
        if (this.settingsModal) {
            this.settingsModal.destroy();
            this.settingsModal = null;
        }
        
        // Clean up menu container
        if (this.menuContainer) {
            // Remove from container first
            this.remove(this.menuContainer);
            this.menuContainer.destroy();
            this.menuContainer = null;
        }
    }
    
    /**
     * Override destroy to properly clean up
     */
    destroy() {
        // Clean up all UI elements first
        this.onCleanup();
        
        // Call parent destroy
        super.destroy();
    }
}

export default PauseMenuModal;