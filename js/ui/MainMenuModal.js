/**
 * MainMenuModal - unified main menu komponenta
 * Nahrazuje původní MainMenu scene UI logiku
 */
import { BaseUIComponent } from './BaseUIComponent.js';
import { UI_THEME, UIThemeUtils } from './UITheme.js';
import { RESPONSIVE } from './UiConstants.js';

export class MainMenuModal extends BaseUIComponent {
    constructor(scene, onActionCallback = null) {
        super(scene, 0, 0, {
            width: scene.scale.width,
            height: scene.scale.height,
            theme: 'menu',
            responsive: true
        });
        
        this.onActionCallback = onActionCallback;
        this.menuContainer = null;
        this.currentSubmenu = null;
        this.selectedIndex = 0;
        
        // Menu items
        this.menuItems = [
            { text: 'Začít hru', action: 'start', icon: '🎮' },
            { text: 'TOP 10', action: 'highscores', icon: '🏆' },
            { text: 'Nastavení', action: 'settings', icon: '⚙️' }
        ];
        
        this.createMainMenu();
    }
    
    getComponentDepth() {
        return UI_THEME.depth.background;
    }
    
    /**
     * Vytvoří hlavní menu
     */
    createMainMenu() {
        // Background
        this.createBackground();
        
        // Header with title
        this.createHeader();
        
        // Menu buttons
        this.createMenuButtons();
        
        // Footer with version
        this.createFooter();
    }
    
    /**
     * Vytvoří pozadí menu
     */
    createBackground() {
        const { width, height } = this.scene.scale.gameSize;
        
        // Gradient background
        const bg = this.scene.add.rectangle(
            0, 0, width, height,
            UI_THEME.colors.background.modal
        );
        bg.setOrigin(0);
        
        // Medical cross pattern (subtle)
        for (let i = 0; i < 5; i++) {
            const cross = this.scene.add.graphics();
            cross.lineStyle(2, UI_THEME.colors.borders.default, 0.1);
            
            const x = (width / 5) * (i + 0.5);
            const y = height * 0.7;
            const size = 20;
            
            // Horizontal line
            cross.lineTo(size * 2, 0);
            cross.moveTo(size, -size);
            // Vertical line  
            cross.lineTo(size, size * 2);
            
            cross.x = x - size;
            cross.y = y - size;
            cross.strokePath();
            
            this.add(cross);
        }
        
        this.add(bg);
    }
    
    /**
     * Vytvoří header s titulkem
     */
    createHeader() {
        const { width } = this.scene.scale.gameSize;
        
        // Main title
        const title = this.scene.add.text(
            width / 2,
            100,
            'RAKOVINOBIJEC',
            UIThemeUtils.createFontConfig('title', 'primary', {
                stroke: true,
                strokeThickness: 6,
                isMobile: this.isMobileDevice
            })
        );
        title.setOrigin(0.5);
        
        // Subtitle
        const subtitle = this.scene.add.text(
            width / 2,
            140,
            'Pro Mardu - bojovníka proti rakovině',
            UIThemeUtils.createFontConfig('normal', 'secondary', {
                isMobile: this.isMobileDevice
            })
        );
        subtitle.setOrigin(0.5);
        
        // Medical cross icon
        const crossIcon = this.scene.add.text(
            width / 2,
            60,
            '✚',
            {
                fontFamily: UI_THEME.fonts.primary,
                fontSize: this.isMobileDevice ? '32px' : '40px',
                color: UIThemeUtils.colorToHex(UI_THEME.colors.secondary)
            }
        );
        crossIcon.setOrigin(0.5);
        
        this.add([crossIcon, title, subtitle]);
    }
    
    /**
     * Vytvoří menu tlačítka
     */
    createMenuButtons() {
        const { width, height } = this.scene.scale.gameSize;
        const startY = height * 0.35;
        const buttonSpacing = this.isMobileDevice ? 60 : 70;
        
        // Použít unified positioning pattern místo add.container
        this.menuContainer = this.scene.add.container(width / 2, startY);
        
        this.menuItems.forEach((item, index) => {
            const button = this.createMenuButton(
                item,
                0, index * buttonSpacing,
                index
            );
            this.menuContainer.add(button);
        });
        
        this.add(this.menuContainer);
        
        // Highlight first button
        this.updateSelection();
    }
    
    /**
     * Vytvoří jednotlivé menu tlačítko
     */
    createMenuButton(item, x, y, index) {
        const buttonWidth = this.isMobileDevice ? 280 : 320;
        const buttonHeight = this.isMobileDevice ? 45 : 50;
        
        // Button container
        const buttonContainer = this.scene.add.container(x, y);
        
        // Background
        const background = this.scene.add.rectangle(
            0, 0,
            buttonWidth, buttonHeight,
            UI_THEME.colors.background.card
        );
        background.setStrokeStyle(
            UI_THEME.borderWidth.normal,
            UI_THEME.colors.borders.default
        );
        
        // Icon
        const iconText = this.scene.add.text(
            -buttonWidth / 2 + 25, 0,
            item.icon || '•',
            {
                fontFamily: UI_THEME.fonts.primary,
                fontSize: this.isMobileDevice ? '20px' : '24px',
                color: UIThemeUtils.colorToHex(UI_THEME.colors.primary)
            }
        );
        iconText.setOrigin(0.5);
        
        // Text
        const text = this.scene.add.text(
            -10, 0,
            item.text,
            UIThemeUtils.createFontConfig('normal', 'primary', {
                isMobile: this.isMobileDevice
            })
        );
        text.setOrigin(0.5);
        
        // Add to container
        buttonContainer.add([background, iconText, text]);
        
        // Make interactive
        background.setInteractive();
        background.on('pointerdown', () => this.selectItem(index));
        
        // Store references
        buttonContainer.background = background;
        buttonContainer.text = text;
        buttonContainer.icon = iconText;
        buttonContainer.index = index;
        
        return buttonContainer;
    }
    
    /**
     * Vytvoří footer s verzí, ovládáním a copyrightem
     */
    createFooter() {
        const { width, height } = this.scene.scale.gameSize;
        const footerY = height - 20; // Všechno na stejné horizontální úrovni
        
        // Version (levý dolní roh) - dynamicky ze version.js
        const versionText = this.scene.add.text(
            20, footerY,
            this.scene.gameVersion ? `v${this.scene.gameVersion}` : '',
            UIThemeUtils.createFontConfig('tiny', 'secondary', {
                isMobile: this.isMobileDevice
            })
        );
        versionText.setOrigin(0, 1);
        
        // Controls (střed)
        const controlsText = this.scene.add.text(
            width / 2, footerY,
            this.isMobileDevice ? 
                'Dotkni se pro výběr | ESC - Zpět' :
                'Enter - Vybrat | Šipky - Navigace | ESC - Zpět',
            UIThemeUtils.createFontConfig('tiny', 'secondary', {
                isMobile: this.isMobileDevice
            })
        );
        controlsText.setOrigin(0.5, 1);
        
        // Copyright (pravý dolní roh)
        const copyrightText = this.scene.add.text(
            width - 20, footerY,
            '© PlayD4d 2025',
            UIThemeUtils.createFontConfig('tiny', 'secondary', {
                isMobile: this.isMobileDevice
            })
        );
        copyrightText.setOrigin(1, 1);
        
        this.add([versionText, controlsText, copyrightText]);
    }
    
    /**
     * Aktualizuje vizuální výběr
     */
    updateSelection() {
        if (!this.menuContainer) return;
        
        this.menuContainer.list.forEach((button, index) => {
            const isSelected = index === this.selectedIndex;
            
            if (isSelected) {
                // Highlight selected button
                button.background.setFillStyle(UI_THEME.colors.background.panel);
                button.background.setStrokeStyle(
                    UI_THEME.borderWidth.thick,
                    UI_THEME.colors.borders.active
                );
                button.text.setColor(UIThemeUtils.colorToHex(UI_THEME.colors.text.accent));
                button.icon.setColor(UIThemeUtils.colorToHex(UI_THEME.colors.primary));
                
                // Subtle scale animation – s guardem
                if (button._tween) {
                    try { button._tween.stop(); } catch (_) {}
                    button._tween = null;
                }
                button._tween = this.scene.tweens.add({
                    targets: button,
                    scaleX: 1.05,
                    scaleY: 1.05,
                    duration: 200,
                    ease: 'Power2'
                });
            } else {
                // Reset unselected buttons
                button.background.setFillStyle(UI_THEME.colors.background.card);
                button.background.setStrokeStyle(
                    UI_THEME.borderWidth.normal,
                    UI_THEME.colors.borders.default
                );
                button.text.setColor(UIThemeUtils.colorToHex(UI_THEME.colors.text.primary));
                button.icon.setColor(UIThemeUtils.colorToHex(UI_THEME.colors.text.secondary));
                
                if (button._tween) {
                    try { button._tween.stop(); } catch (_) {}
                    button._tween = null;
                }
                button._tween = this.scene.tweens.add({
                    targets: button,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 200,
                    ease: 'Power2'
                });
            }
        });
    }
    
    /**
     * Navigace šipkami
     */
    navigateUp() {
        this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
        this.updateSelection();
    }
    
    navigateDown() {
        this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
        this.updateSelection();
    }
    
    /**
     * Vybere položku
     */
    selectItem(index = this.selectedIndex) {
        const item = this.menuItems[index];
        if (!item) return;
        
        // Visual feedback
        const button = this.menuContainer.list[index];
        this.scene.tweens.add({
            targets: button,
            scaleX: 0.95,
            scaleY: 0.95,
            duration: 100,
            yoyo: true,
            onComplete: () => {
                // Execute action
                if (this.onActionCallback) {
                    this.onActionCallback(item.action, item);
                }
            }
        });
    }
    
    /**
     * Keyboard navigation
     */
    handleKeyDown(key) {
        switch (key) {
            case 'ArrowUp':
            case 'W':
                this.navigateUp();
                break;
            case 'ArrowDown':
            case 'S':
                this.navigateDown();
                break;
            case 'Enter':
            case ' ':
                this.selectItem();
                break;
        }
    }
    
    /**
     * Show submenu
     */
    showSubmenu(submenuType) {
        // TODO: Implement submenus (settings, highscores, etc.)
        console.log(`Showing submenu: ${submenuType}`);
    }
    
    /**
     * Resize handler
     */
    onResize(gameSize, baseSize, displaySize) {
        super.onResize(gameSize, baseSize, displaySize);
        // Debounce + rebuild jen při reálné změně
        const w = gameSize?.width || this.width;
        const h = gameSize?.height || this.height;
        if (this._lastSize && this._lastSize.w === w && this._lastSize.h === h) {
            return;
        }
        this._lastSize = { w, h };
        clearTimeout(this._resizeT);
        this._resizeT = setTimeout(() => {
            try {
                this.removeAll(true);
                this.createMainMenu();
            } catch (_) {}
        }, 150);
    }
    
    /**
     * Cleanup
     */
    onCleanup() {
        this.onActionCallback = null;
        this.currentSubmenu = null;
        clearTimeout(this._resizeT);
        this._resizeT = null;
        this._lastSize = null;
    }
}

export default MainMenuModal;