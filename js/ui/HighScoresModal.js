/**
 * HighScoresModal - unified high scores display komponenta
 * Zobrazí TOP 10 high scores v pěkném RexUI modalu
 */
import { BaseUIComponent } from './BaseUIComponent.js';
import { UI_THEME, UIThemeUtils } from './UITheme.js';
import { RESPONSIVE } from './UiConstants.js';

export class HighScoresModal extends BaseUIComponent {
    constructor(scene, scores = [], onCloseCallback = null) {
        // Validate scene before using it
        const width = scene?.scale?.width || 800;
        const height = scene?.scale?.height || 600;
        
        super(scene, 0, 0, {
            width: width,
            height: height,
            theme: 'modal',
            responsive: true
        });
        
        this.scores = scores;
        this.onCloseCallback = onCloseCallback;
        this.modalContainer = null;
        
        // Don't create modal in constructor - let show() handle it
        this.setDepth(UI_THEME.depth.modal);
    }
    
    getComponentDepth() {
        return UI_THEME.depth.modal;
    }
    
    /**
     * Vytvoří high scores modal - podle PowerUpModal architektury
     */
    createModal() {
        // Modal overlay
        this.createModalOverlay(0.9);
        
        // Modal container
        const modalSize = RESPONSIVE.getModalSize(this.isMobileDevice);
        modalSize.width = Math.min(modalSize.width, this.isMobileDevice ? 380 : 500);
        modalSize.height = Math.min(modalSize.height, (this.scene?.scale?.height || 600) * 0.85);
        
        this.modalContainer = this.createModalContainer(modalSize);
        
        // Header s titulkem
        this.createHeader();
        
        // Scores list
        this.createScoresList();
        
        // Footer s close button
        this.createFooter();
        
        // DŮLEŽITÉ: Zavolat layout() po sestavení všech komponent
        if (this.modalContainer) {
            this.modalContainer.layout();
        }
    }
    
    /**
     * Vytvoří hlavní container modalu - podle PowerUpModal pattern
     */
    createModalContainer(size) {
        // Validate scene before using it
        if (!this.scene || !this.scene.scale) {
            console.error('[HighScoresModal] Cannot create modal - invalid scene reference');
            return null;
        }
        
        const { width, height } = this.scene.scale.gameSize;
        
        // Vytvoření RexUI sizer pro layout - pozice uprostřed scény
        const container = this.scene.rexUI.add.sizer({
            x: width / 2,
            y: height / 2,
            width: size.width,
            height: size.height,
            orientation: 'vertical',
            space: { item: UI_THEME.spacing.l }
        });
        
        // Background panel
        const background = this.scene.rexUI.add.roundRectangle(
            0, 0, size.width, size.height,
            UI_THEME.borderRadius.large,
            UI_THEME.colors.background.modal
        ).setStrokeStyle(
            UI_THEME.borderWidth.thick, 
            UI_THEME.colors.primary
        );
        
        container.addBackground(background);
        this.add(container);
        
        return container;
    }
    
    /**
     * Vytvoří header s titulkem
     */
    createHeader() {
        const titleText = this.scene.add.text(0, 0, '🏆 TOP 10 HIGH SCORES 🏆',
            UIThemeUtils.createFontConfig('large', 'primary', { 
                stroke: true, 
                strokeThickness: 3,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        this.modalContainer.add(titleText, {
            proportion: 0,
            align: 'center'
        });
    }
    
    /**
     * Vytvoří seznam high scores - sexy design s card layoutem
     */
    createScoresList() {
        if (this.scores.length === 0) {
            const noScoresText = this.scene.add.text(0, 0, 'Zatím žádné skóre\n\nZahrajte si hru a staňte se legendárními!',
                {
                    ...UIThemeUtils.createFontConfig('normal', 'secondary', { 
                        isMobile: this.isMobileDevice 
                    }),
                    align: 'center'
                }
            ).setOrigin(0.5);
            
            this.modalContainer.add(noScoresText, {
                proportion: 1,
                align: 'center'
            });
            return;
        }
        
        // Container pro scores - podle PowerUpModal pattern
        const scoresContainer = this.scene.rexUI.add.sizer({
            orientation: 'vertical',
            space: { item: UI_THEME.spacing.s }
        });
        
        // Header row - informativní
        const headerContainer = this.createHeaderRow();
        scoresContainer.add(headerContainer, { 
            proportion: 0, 
            align: 'center',
            padding: { bottom: UI_THEME.spacing.m }
        });
        
        // Score rows - kompaktní řádky
        this.scores.slice(0, 10).forEach((score, index) => {
            const scoreRow = this.createScoreRow(score, index + 1);
            scoresContainer.add(scoreRow, { 
                proportion: 0, 
                align: 'center',
                padding: { top: UI_THEME.spacing.xs / 2, bottom: UI_THEME.spacing.xs / 2 }
            });
        });
        
        // Layout container
        scoresContainer.layout();
        
        this.modalContainer.add(scoresContainer, {
            proportion: 1,
            align: 'center',
            padding: { 
                top: UI_THEME.spacing.m,
                bottom: UI_THEME.spacing.m 
            }
        });
    }
    
    /**
     * Vytvoří footer s close button
     */
    createFooter() {
        const closeButton = this.createThemedButton(
            'ZAVŘÍT',
            0, 0,
            () => this.close(),
            { variant: 'secondary' }
        );
        
        this.modalContainer.add(closeButton, { 
            proportion: 0, 
            align: 'center'
        });
    }
    
    /**
     * Vytvoří header row s názvy sloupců
     */
    createHeaderRow() {
        const headerSizer = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.l },
            width: this.isMobileDevice ? 340 : 450
        });
        
        const positionHeader = this.scene.add.text(0, 0, '#',
            UIThemeUtils.createFontConfig('small', 'accent', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        const nameHeader = this.scene.add.text(0, 0, 'HŘÁČ',
            UIThemeUtils.createFontConfig('small', 'accent', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0, 0.5);
        
        const scoreHeader = this.scene.add.text(0, 0, 'SKÓRE',
            UIThemeUtils.createFontConfig('small', 'accent', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        const levelHeader = this.scene.add.text(0, 0, 'LVL',
            UIThemeUtils.createFontConfig('small', 'accent', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        headerSizer.add(positionHeader, { proportion: 0, align: 'center', minWidth: 40 });
        headerSizer.add(nameHeader, { proportion: 1, align: 'left', minWidth: 120 });
        headerSizer.add(scoreHeader, { proportion: 0, align: 'center', minWidth: 100 });
        headerSizer.add(levelHeader, { proportion: 0, align: 'center', minWidth: 50 });
        
        return headerSizer;
    }
    
    /**
     * Vytvoří řádek pro jeden high score - kompaktní verze s jemnými akcenty
     */
    createScoreRow(score, position) {
        const rowWidth = this.isMobileDevice ? 340 : 450;
        const rowHeight = this.isMobileDevice ? 32 : 36;
        
        // Hlavní row container
        const row = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            width: rowWidth,
            height: rowHeight,
            space: { item: UI_THEME.spacing.m }
        });
        
        // Jemný background pouze pro TOP 3 s přirozenými barvami
        if (position <= 3) {
            let bgColor;
            if (position === 1) bgColor = 0xFFD700; // Zlatá
            else if (position === 2) bgColor = 0xC0C0C0; // Stříbro  
            else if (position === 3) bgColor = 0xCD7F32; // Bronz
            
            const rowBg = this.scene.rexUI.add.roundRectangle(
                0, 0, rowWidth, rowHeight,
                UI_THEME.borderRadius.small,
                bgColor
            ).setAlpha(0.15); // Velmi jemný accent
            
            row.addBackground(rowBg);
        }
        
        // Medal emoji pro top 3 + pozice
        let medal = '';
        let textColor = 'primary';
        if (position === 1) {
            medal = '🥇';
            textColor = 'warning'; // Zlatá barva textu
        } else if (position === 2) {
            medal = '🥈';
            textColor = 'secondary'; // Stříbro
        } else if (position === 3) {
            medal = '🥉';
            textColor = 'accent'; // Bronz
        }
        
        const positionText = this.scene.add.text(0, 0, medal + position.toString(),
            UIThemeUtils.createFontConfig('small', textColor, { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        // Jméno hráče
        const nameText = this.scene.add.text(0, 0, score.name || 'Anonym',
            UIThemeUtils.createFontConfig('small', 'primary', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0, 0.5);
        
        // Skóre s formátováním
        const scoreText = this.scene.add.text(0, 0, score.score?.toLocaleString() || '0',
            UIThemeUtils.createFontConfig('small', 'success', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        // Level
        const levelText = this.scene.add.text(0, 0, score.level?.toString() || '1',
            UIThemeUtils.createFontConfig('small', 'info', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        row.add(positionText, { proportion: 0, align: 'center', minWidth: 40 });
        row.add(nameText, { proportion: 1, align: 'left', minWidth: 120 });
        row.add(scoreText, { proportion: 0, align: 'center', minWidth: 100 });
        row.add(levelText, { proportion: 0, align: 'center', minWidth: 50 });
        
        // Layout řádku
        row.layout();
        
        return row;
    }
    
    /**
     * Zavře modal
     */
    close() {
        this.scene.tweens.add({
            targets: this.modalContainer,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                if (this.onCloseCallback) {
                    this.onCloseCallback();
                }
                this.destroy();
            }
        });
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
     * Show the modal
     */
    show() {
        // Create modal if it doesn't exist
        if (!this.modalContainer) {
            this.createModal();
        }
        
        // Show components
        this.setVisible(true);
        if (this.modalContainer) {
            this.modalContainer.setVisible(true);
        }
    }
    
    /**
     * Hide the modal
     */
    hide() {
        this.setVisible(false);
        if (this.modalContainer) {
            this.modalContainer.setVisible(false);
        }
    }
    
    /**
     * Cleanup
     */
    onCleanup() {
        this.onCloseCallback = null;
        
        if (this.modalContainer) {
            this.modalContainer.destroy();
            this.modalContainer = null;
        }
    }
}

export default HighScoresModal;