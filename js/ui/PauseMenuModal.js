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
        super(scene, 0, 0, {
            width: scene.scale.width,
            height: scene.scale.height,
            theme: 'modal',
            responsive: true
        });
        
        this.onResumeCallback = onResumeCallback;
        this.menuContainer = null;
        this.isPaused = false;
        this.isAnimating = false; // Flag pro animace
        
        this.createPauseMenu();
        
        // Set proper depth to be above everything
        this.setDepth(UI_THEME.depth.modal);
        
        // Hide initially
        this.setVisible(false);
    }
    
    getComponentDepth() {
        return UI_THEME.depth.modal;
    }
    
    /**
     * Vytvoří pause menu
     */
    createPauseMenu() {
        // Modal overlay - create directly, not through BaseUIComponent
        const { width, height } = this.scene.scale.gameSize;
        this.overlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.7);
        this.overlay.setOrigin(0, 0);
        // Neděláme overlay interaktivní - neblokuje kliky na menu
        // this.overlay.setInteractive(); // REMOVED - overlay should not block clicks
        this.overlay.setScrollFactor(0); // Připnout k UI, ne ke kameře
        this.overlay.setDepth(UI_THEME.depth.modal - 1); // Pod menu containerem
        this.overlay.setVisible(false); // Hidden initially
        
        // Get modal size
        const modalSize = RESPONSIVE.getModalSize(this.isMobileDevice);
        const menuWidth = Math.min(modalSize.width * 0.6, 400);
        const menuHeight = Math.min(modalSize.height * 0.7, 500);
        
        // Menu container - pozice uprostřed scény
        this.menuContainer = this.scene.rexUI.add.sizer({
            x: width / 2,
            y: height / 2,
            width: menuWidth,
            height: menuHeight,
            orientation: 'vertical',
            space: { item: UI_THEME.spacing.l }
        });
        
        // Set high depth for menu container - must be above overlay
        this.menuContainer.setDepth(UI_THEME.depth.modal + 1);
        this.menuContainer.setAlpha(1); // Ensure full opacity
        
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
        
        // PR7: Notify GameScene about pause state
        if (this.scene.setPaused) {
            this.scene.setPaused(true);
        }
        
        // Zastavit physics hned
        this.scene.physics.pause();
        
        // DŮLEŽITÉ: NEpauzovat scene.time tady - tweeny by se nespustily!
        // Pauzujeme až po dokončení animací
        
        // Show overlay
        if (this.overlay) {
            this.overlay.setVisible(true);
            this.overlay.setAlpha(0);
            this.scene.tweens.add({
                targets: this.overlay,
                alpha: 0.7,
                duration: 300,
                ease: 'Power2'
            });
        }
        
        // Show menu container (RexUI object)
        if (this.menuContainer) {
            this.menuContainer.setVisible(true);
            this.menuContainer.setScale(0.9);
            this.menuContainer.setAlpha(0);
            
            // Animate both alpha and scale for better visibility
            this.scene.tweens.add({
                targets: this.menuContainer,
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                duration: 300,
                ease: 'Back.easeOut',
                onComplete: () => {
                    // Ensure full visibility after animation
                    this.menuContainer.setAlpha(1);
                    this.menuContainer.setScale(1);
                    
                    // TEPRVE TEĎ zastavit scene time - po dokončení animací
                    this.scene.time.paused = true;
                    
                    this.isAnimating = false; // Animace dokončena
                    console.log('[PauseMenuModal] Pause animation complete, alpha:', this.menuContainer.alpha, 'time paused:', this.scene.time.paused);
                }
            });
        } else {
            this.isAnimating = false; // Žádná animace
        }
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
        
        // Hide menu container (RexUI object)
        if (this.menuContainer) {
            this.scene.tweens.add({
                targets: this.menuContainer,
                alpha: 0,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    this.menuContainer.setVisible(false);
                    this.isAnimating = false; // Animace dokončena
                    console.log('[PauseMenuModal] Resume animation complete');
                }
            });
        } else {
            this.isAnimating = false; // Žádná animace
        }
        
        // Hide overlay
        if (this.overlay) {
            this.scene.tweens.add({
                targets: this.overlay,
                alpha: 0,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    this.overlay.setVisible(false);
                    console.log('[PauseMenuModal] Hide overlay complete');
                    if (this.onResumeCallback) {
                        this.onResumeCallback();
                    }
                }
            });
        }
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
        const settingsModal = new SettingsModal(this.scene, () => {
            // On close callback - nastavení aplikována
            console.log('Settings modal closed from pause menu');
        });
        
        // Přidat do scene
        this.scene.add.existing(settingsModal);
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
        this.hide(false);
        this.scene.scene.start('MainMenu');
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
    }
}

export default PauseMenuModal;