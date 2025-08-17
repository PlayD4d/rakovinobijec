/**
 * Base třída pro všechny UI komponenty v unified UI systému
 * Poskytuje společnou funkcionalnost, event handling a lifecycle management
 */
import { UI_THEME, UIThemeUtils } from './UITheme.js';
import { RESPONSIVE, isMobile } from './UiConstants.js';

export class BaseUIComponent extends Phaser.GameObjects.Container {
    constructor(scene, x = 0, y = 0, config = {}) {
        super(scene, x, y);
        
        // Základní konfigurace
        this.config = {
            width: 200,
            height: 100,
            theme: 'default',
            responsive: true,
            touchOptimized: true,
            ...config
        };
        
        // State management
        this.isVisible = false;
        this.isInteractive = false;
        this.isDestroyed = false;
        
        
        // Responsive detection
        this.isMobileDevice = isMobile();
        this.screenType = RESPONSIVE.getScreenType();
        
        // Theme aplikace
        this.applyTheme();
        
        // Přidat se podle situace buď do scene.uiLayer, nebo do scene
        if (scene.uiLayer && typeof scene.uiLayer.add === 'function') {
            scene.uiLayer.add(this);
            // UI layer already manages depth properly
        } else {
            scene.add.existing(this);
            // Only set depth when not in UI layer
            this.setDepth(this.getComponentDepth());
        }
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    /**
     * Aplikuje theme styling na komponentu
     */
    applyTheme() {
        // Override v child třídách pro specifické theming
        this.backgroundColor = UI_THEME.colors.background.panel;
        this.textColor = UI_THEME.colors.text.primary;
        this.borderColor = UI_THEME.colors.borders.default;
    }
    
    /**
     * Získá depth podle typu komponenty
     */
    getComponentDepth() {
        // Override v child třídách
        return UI_THEME.depth.content;
    }
    
    /**
     * Setup základních event listenerů
     */
    setupEventListeners() {
        // Window resize handler pro responsive design
        if (this.config.responsive) {
            this.scene.scale.on('resize', this.handleResize, this);
        }
        
        // Cleanup při destroy scény
        this.scene.events.once('shutdown', this.cleanup, this);
        this.scene.events.once('destroy', this.cleanup, this);
    }
    
    /**
     * Handle window resize pro responsive design
     */
    handleResize(gameSize, baseSize, displaySize) {
        if (this.isDestroyed) return;
        
        const newScreenType = RESPONSIVE.getScreenType(gameSize.width);
        if (newScreenType !== this.screenType) {
            this.screenType = newScreenType;
            this.onScreenTypeChanged(newScreenType);
        }
        
        this.onResize(gameSize, baseSize, displaySize);
    }
    
    /**
     * Called když se změní screen type (mobile -> desktop atd.)
     */
    onScreenTypeChanged(newScreenType) {
        // Override v child třídách
        console.log(`${this.constructor.name} screen type changed to: ${newScreenType}`);
    }
    
    /**
     * Called při resize events
     */
    onResize(gameSize, baseSize, displaySize) {
        // Override v child třídách pro custom resize logic
    }
    
    /**
     * Zobrazí komponentu s optional animací - pause-safe
     */
    show(animated = true, duration = 250) {
        if (this.isDestroyed) return Promise.resolve();
        this.setVisible(true);
        this.isVisible = true;

        const canTween = !!this.scene?.tweens && this.scene?.time?.paused !== true;
        if (!animated || !canTween) {
            this.alpha = 1;
            this.onShowComplete();
            return Promise.resolve();
        }

        this.alpha = 0;
        return new Promise((resolve) => {
            const tween = this.scene.tweens.add({
                targets: this,
                alpha: 1,
                duration,
                ease: 'Power2',
                onComplete: () => {
                    this.onShowComplete();
                    resolve();
                }
            });
        });
    }

    /**
     * Skryje komponentu s optional animací - pause-safe
     */
    hide(animated = true, duration = 200) {
        if (this.isDestroyed) return Promise.resolve();
        this.isVisible = false;

        const canTween = !!this.scene?.tweens && this.scene?.time?.paused !== true;
        if (!animated || !canTween) {
            this.alpha = 0;
            this.setVisible(false);
            this.onHideComplete();
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const tween = this.scene.tweens.add({
                targets: this,
                alpha: 0,
                duration,
                ease: 'Power2',
                onComplete: () => {
                    // Cleanup zjednodušen
                    this.setVisible(false);
                    this.onHideComplete();
                    resolve();
                }
            });
            // Tween tracking zjednodušeno
        });
    }
    
    /**
     * Called po dokončení show animace
     */
    onShowComplete() {
        // Override v child třídách
    }
    
    /**
     * Called po dokončení hide animace
     */
    onHideComplete() {
        // Override v child třídách
        console.log('[BaseUIComponent] onHideComplete called for:', this.constructor.name);
    }
    
    /**
     * Vytvoří standardní pozadí komponenty
     */
    createBackground(width = this.config.width, height = this.config.height, options = {}) {
        const config = {
            color: this.backgroundColor,
            strokeColor: this.borderColor,
            strokeWidth: UI_THEME.borderWidth.normal,
            radius: UI_THEME.borderRadius.medium,
            alpha: 1,
            ...options
        };
        
        const background = this.scene.rexUI.add.roundRectangle(
            0, 0, width, height, config.radius, config.color
        );
        
        if (config.strokeWidth > 0) {
            background.setStrokeStyle(config.strokeWidth, config.strokeColor);
        }
        
        background.setAlpha(config.alpha);
        this.add(background);
        
        return background;
    }
    
    /**
     * Vytvoří text s theme styling
     */
    createThemedText(text, x = 0, y = 0, style = {}) {
        const defaultStyle = {
            fontFamily: UI_THEME.fonts.primary,
            fontSize: `${UIThemeUtils.getFontSize('normal', this.isMobileDevice)}px`,
            color: UIThemeUtils.colorToHex(this.textColor),
            ...style
        };
        
        const textObject = this.scene.add.text(x, y, text, defaultStyle);
        this.add(textObject);
        
        return textObject;
    }
    
    /**
     * Vytvoří button s theme styling a touch optimization
     */
    createThemedButton(text, x = 0, y = 0, callback = null, config = {}) {
        const touchSize = RESPONSIVE.getTouchTargetSize();
        
        const defaultConfig = {
            width: Math.max(touchSize.recommended * 3, 120),
            height: touchSize.recommended,
            backgroundColor: UI_THEME.colors.primary,
            textColor: UI_THEME.colors.text.primary,
            fontSize: UIThemeUtils.getFontSize('normal', this.isMobileDevice),
            borderRadius: UI_THEME.borderRadius.small,
            ...config
        };
        
        // Vytvoření button pomocí RexUI
        const button = this.scene.rexUI.add.label({
            x: x,
            y: y,
            background: this.scene.rexUI.add.roundRectangle(
                0, 0, 
                defaultConfig.width, 
                defaultConfig.height, 
                defaultConfig.borderRadius, 
                defaultConfig.backgroundColor
            ),
            text: this.scene.add.text(0, 0, text, {
                fontFamily: UI_THEME.fonts.primary,
                fontSize: `${defaultConfig.fontSize}px`,
                color: UIThemeUtils.colorToHex(defaultConfig.textColor)
            }),
            space: { 
                left: UI_THEME.spacing.m, 
                right: UI_THEME.spacing.m,
                top: UI_THEME.spacing.s,
                bottom: UI_THEME.spacing.s
            },
            align: 'center'
        });
        
        // Touch/click handling
        if (callback) {
            button.setInteractive();
            button.on('pointerdown', callback);
            
            // Hover effects pro desktop
            if (!this.isMobileDevice) {
                button.on('pointerover', () => {
                    button.getElement('background').setFillStyle(UI_THEME.colors.borders.active);
                });
                button.on('pointerout', () => {
                    button.getElement('background').setFillStyle(defaultConfig.backgroundColor);
                });
            }
        }
        
        this.add(button);
        return button;
    }
    
    /**
     * Aplikuje standardní modal overlay styling
     * Kritické: overlay je vždy přidán do kontejneru na index 0
     */
    createModalOverlay(alpha = 0.8, makeInteractive = false) {
        const { width, height } = this.scene.scale.gameSize;
        
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(UI_THEME.colors.background.overlay, alpha);
        overlay.fillRect(0, 0, width, height);
        
        // Only make interactive if explicitly requested (for blocking background clicks)
        if (makeInteractive) {
            overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        }
        
        // Kritické: overlay je dítě kontejneru na index 0
        this.addAt(overlay, 0);
        
        return overlay;
    }
    
    /**
     * Centruje komponentu na obrazovce
     */
    centerOnScreen() {
        if (this.isDestroyed) return;
        
        // Pozice 0,0 je levý horní roh scene - nepotřebujeme posouvat
        // Komponenty si samy spravují své vnitřní centrování
        this.setPosition(0, 0);
    }
    
    /**
     * Nastaví position podle responsive guidelines
     */
    setResponsivePosition(position = 'center') {
        if (this.isDestroyed) return;
        
        const { width, height } = this.scene.scale.gameSize;
        const spacing = RESPONSIVE.getSpacing(this.isMobileDevice);
        
        switch (position) {
            case 'center':
                this.setPosition(width / 2, height / 2);
                break;
            case 'top':
                this.setPosition(width / 2, spacing.large);
                break;
            case 'bottom':
                this.setPosition(width / 2, height - spacing.large);
                break;
            case 'topLeft':
                this.setPosition(spacing.large, spacing.large);
                break;
            case 'topRight':
                this.setPosition(width - spacing.large, spacing.large);
                break;
            case 'bottomLeft':
                this.setPosition(spacing.large, height - spacing.large);
                break;
            case 'bottomRight':
                this.setPosition(width - spacing.large, height - spacing.large);
                break;
        }
    }
    
    /**
     * Bezpečné cleanup při destroy
     */
    cleanup() {
        if (this.isDestroyed) return;
        
        this.isDestroyed = true;
        
        // Odstranit event listeners
        if (this.scene.scale) {
            this.scene.scale.off('resize', this.handleResize, this);
        }
        
        // Cleanup scene event listeners
        if (this.scene.events) {
            this.scene.events.off('shutdown', this.cleanup, this);
            this.scene.events.off('destroy', this.cleanup, this);
        }
        
        // Zastavit všechny tweens
        if (this.scene.tweens) {
            this.scene.tweens.killTweensOf(this);
        }
        
        // Clean interactive elements (WeakSet will auto-cleanup when elements are destroyed)
        // But we'll still destroy any children that are interactive
        this.list?.forEach(child => {
            if (child && child.input) {
                child.removeInteractive();
            }
        });
        
        // Custom cleanup
        this.onCleanup();
    }
    
    /**
     * Custom cleanup hook pro child třídy
     */
    onCleanup() {
        // Override v child třídách
    }
    
    /**
     * Destroy komponenty
     */
    destroy() {
        this.cleanup();
        super.destroy();
    }
    
    /**
     * Utility: Vytvoří separator line
     */
    createSeparator(width = 200, color = UI_THEME.colors.borders.default, thickness = 1) {
        const separator = this.scene.add.graphics();
        separator.lineStyle(thickness, color, 0.6);
        separator.lineTo(width, 0);
        separator.strokePath();
        
        this.add(separator);
        return separator;
    }
    
}

export default BaseUIComponent;