/**
 * PowerUp Selection Modal - unified UI systém
 * Modal pro výběr power-upů při level up
 * Postavený na BaseUIComponent + UITheme
 */
import { BaseUIComponent } from './BaseUIComponent.js';
import { UI_THEME, UIThemeUtils } from './UITheme.js';
import { RESPONSIVE } from './UiConstants.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';

export class PowerUpSelectionModal extends BaseUIComponent {
    constructor(scene, powerUps = [], onSelectionCallback = null) {
        super(scene, 0, 0, {
            width: 900,
            height: 600,
            theme: 'modal',
            responsive: true
        });
        
        this.powerUps = powerUps;
        this.onSelectionCallback = onSelectionCallback;
        this.cardComponents = [];
        this.selectedPowerUp = null;
        this._interactiveBackgrounds = []; // Track interactive elements for cleanup
        
        // Don't create modal in constructor - let show() handle it
        // This ensures we always have a valid scene reference when creating
        this.modalContainer = null;
        this.modalSizer = null;
        this.overlay = null;
        
        // Debug scene state at construction
        DebugLogger.debug('ui', '[PowerUpSelectionModal] Constructed with scene state:', {
            sceneKey: scene?.scene?.key || 'unknown',
            isActive: scene?.scene?.isActive?.() || false,
            hasSceneManager: !!(scene?.scene),
            timestamp: Date.now()
        });
    }
    
    getComponentDepth() {
        return UI_THEME.depth.modal;
    }
    
    /**
     * Vytvoří celý modal s kartami power-upů
     */
    createModal() {
        // Robustní validace scény (nevyžaduj scene.scale)
        const scene = this.scene;
        const game  = scene?.sys?.game;
        if (!scene || !scene.sys || !game) {
            DebugLogger.error('ui', '[PowerUpSelectionModal] Cannot create modal - invalid scene reference');
            return;
        }
        
        // Overlay - přidat do kontejneru na index 0 (BaseUIComponent to zvládne)
        this.overlay = this.createModalOverlay(0.9);
        this.overlay.setScrollFactor(0); // Pin to UI, not camera
        
        // Modal container
        const modalSize = RESPONSIVE.getModalSize(this.isMobileDevice);
        this.modalContainer = this.createModalContainer(modalSize);
        
        // If container creation failed, don't continue
        if (!this.modalContainer) {
            DebugLogger.error('ui', '[PowerUpSelectionModal] Failed to create modal container');
            return;
        }
        
        // Přidat modal container jako dítě BaseUIComponent kontejneru
        this.add(this.modalContainer);
        
        // Header s titulkem
        this.createHeader();
        
        // Power-up karty
        this.createPowerUpCards();
        
        // Footer s instrukcemi
        this.createFooter();
        
        // DŮLEŽITÉ: Zavolat layout() po sestavení všech komponent
        if (this.modalSizer) {
            this.modalSizer.layout();
        }
    }
    
    /**
     * Vytvoří hlavní container modalu
     */
    createModalContainer(size) {
        // Robustní zdroje rozměrů
        const scene = this.scene;
        const game  = scene?.sys?.game;
        if (!scene || !scene.sys || !game) {
            DebugLogger.error('ui', '[PowerUpSelectionModal] Invalid scene reference');
            return null;
        }
        const scale = scene.scale || game.scale;
        const gameSize = scale?.gameSize;
        const width  = gameSize?.width  ?? game.config.width;
        const height = gameSize?.height ?? game.config.height;
        
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
            UI_THEME.colors.borders.active
        );
        
        container.addBackground(background);
        
        // NEPOUŽÍVAT setDepth uvnitř kontejneru - BaseUIComponent má globální depth
        // NEPŘIDÁVAT do scene.uiLayer - bude přidán do BaseUIComponent kontejneru
        
        // Initially hide until show() is called
        container.setVisible(false);
        
        // Uložit reference pro pozdější layout()
        this.modalSizer = container;
        this.modalContainer = container; // Also store as modalContainer for consistency
        
        return container;
    }
    
    /**
     * Vytvoří header s titulkem a pause indikátorem
     */
    createHeader() {
        const headerSizer = this.scene.rexUI.add.sizer({
            orientation: 'vertical',
            space: { item: UI_THEME.spacing.s }
        });
        
        // PAUSED indikátor
        const pausedText = this.scene.add.text(0, 0, 'PAUSED', 
            UIThemeUtils.createFontConfig('large', 'warning', { 
                stroke: true, 
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        // Hlavní titulek
        const titleText = this.scene.add.text(0, 0, 'Level Up! Vyber vylepšení:', 
            UIThemeUtils.createFontConfig('title', 'primary', { 
                stroke: true, 
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        headerSizer.add(pausedText);
        headerSizer.add(titleText);
        
        this.modalContainer.add(headerSizer, { proportion: 0, align: 'center' });
    }
    
    /**
     * Vytvoří karty power-upů
     */
    createPowerUpCards() {
        if (this.powerUps.length === 0) {
            DebugLogger.warn('ui', '[PowerUpSelectionModal] No powerUps to display!');
            return;
        }
        
        DebugLogger.info('ui', '[PowerUpSelectionModal] Creating', this.powerUps.length, 'power-up cards');
        
        // Container pro karty
        const cardsContainer = this.scene.rexUI.add.sizer({
            x: 0,
            y: 0,
            orientation: this.isMobileDevice ? 'vertical' : 'horizontal',
            space: { item: this.isMobileDevice ? UI_THEME.spacing.s : UI_THEME.spacing.m }
        });
        
        // Responsive card sizing
        const cardSize = RESPONSIVE.getCardSize(this.isMobileDevice);
        
        // Vytvořit jednotlivé karty
        this.powerUps.forEach((powerUp, index) => {
            const card = this.createPowerUpCard(powerUp, cardSize);
            cardsContainer.add(card, { proportion: 1, align: 'center' });
            this.cardComponents.push(card);
        });
        
        // Layout cards container
        cardsContainer.layout();
        
        this.modalContainer.add(cardsContainer, { 
            proportion: 1, 
            align: 'center',
            padding: { 
                top: UI_THEME.spacing.m,
                bottom: UI_THEME.spacing.m 
            }
        });
        
        DebugLogger.info('ui', '[PowerUpSelectionModal] Cards created and added to modal');
    }
    
    /**
     * Vytvoří jednotlivou kartu power-upu
     */
    createPowerUpCard(powerUp, size) {
        // Hlavní card container
        const card = this.scene.rexUI.add.sizer({
            x: 0,
            y: 0,
            orientation: 'vertical',
            width: size.width,
            height: size.height,
            space: { item: 6 }  // Větší spacing mezi prvky
        });
        
        // Background s hover efekty
        const cardBg = this.scene.rexUI.add.roundRectangle(
            0, 0, size.width, size.height,
            UI_THEME.borderRadius.medium,
            UI_THEME.colors.background.card
        ).setStrokeStyle(
            UI_THEME.borderWidth.normal,
            this.getPowerUpThemeColor(powerUp.type)
        );
        
        card.addBackground(cardBg);
        
        // Icon (emoji z názvu) - větší velikost s lepším červeným srdcem
        let icon = this.extractIcon(powerUp.name);
        // Vyměnit srdce za hezčí červené
        if (icon === '❤️' || powerUp.id === 'maxHp') {
            icon = '❤️';  // Použít emoji červené srdce
        }
        
        const iconText = this.scene.add.text(0, 0, icon, {
            fontFamily: UI_THEME.fonts.primary,
            fontSize: this.isMobileDevice ? '40px' : '48px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        card.add(iconText, { 
            proportion: 0, 
            align: 'center',
            padding: { top: UI_THEME.spacing.m }  // Odsazení od horního okraje
        });
        
        // Název (bez emoji) - větší font
        const cleanName = this.cleanPowerUpName(powerUp.name);
        const nameText = this.scene.add.text(0, 0, cleanName, {
            ...UIThemeUtils.createFontConfig('large', 'primary', { 
                stroke: true, 
                isMobile: this.isMobileDevice 
            }),
            wordWrap: { width: size.width - UI_THEME.spacing.l },
            align: 'center'
        }).setOrigin(0.5);
        
        card.add(nameText, { 
            proportion: 0, 
            align: 'center',
            padding: { top: UI_THEME.spacing.xs }  // Malé odsazení od ikony
        });
        
        // Level progress - s odsazením
        const progressContainer = this.createProgressSection(powerUp, size.width);
        card.add(progressContainer, { 
            proportion: 0, 
            align: 'center',
            padding: { top: UI_THEME.spacing.s, bottom: UI_THEME.spacing.s }  // Odsazení shora i zdola
        });
        
        // Popis - s odsazením
        const descText = this.scene.add.text(0, 0, powerUp.description, {
            ...UIThemeUtils.createFontConfig('small', 'secondary', { isMobile: this.isMobileDevice }),
            wordWrap: { width: size.width - UI_THEME.spacing.l },
            align: 'center',
            lineSpacing: 3
        }).setOrigin(0.5);
        
        card.add(descText, { 
            proportion: 0, 
            align: 'center',
            padding: { bottom: UI_THEME.spacing.xs }  // Odsazení od dalšího prvku
        });
        
        // Detailní info - s odsazením
        const detailInfo = this.getDetailedInfo(powerUp);
        const detailText = this.scene.add.text(0, 0, detailInfo, {
            ...UIThemeUtils.createFontConfig('tiny', 'accent', { 
                stroke: true, 
                isMobile: this.isMobileDevice 
            }),
            wordWrap: { width: size.width - UI_THEME.spacing.l },
            align: 'center',
            lineSpacing: 3
        }).setOrigin(0.5);
        
        card.add(detailText, { 
            proportion: 0, 
            align: 'center',
            padding: { top: UI_THEME.spacing.xs, bottom: UI_THEME.spacing.s }
        });
        
        // Current stats (pokud existují)
        if (powerUp.level > 0) {
            const currentValue = this.getCurrentValue(powerUp);
            const statsText = this.scene.add.text(0, 0, `Aktuálně: ${currentValue}`, 
                UIThemeUtils.createFontConfig('tiny', 'warning', { isMobile: this.isMobileDevice })
            ).setOrigin(0.5);
            
            card.add(statsText, { proportion: 0, align: 'center' });
        }
        
        // Interaktivita
        this.setupCardInteraction(card, cardBg, powerUp);
        
        // Layout karty
        card.layout();
        
        return card;
    }
    
    /**
     * Vytvoří sekci s progress barem
     */
    createProgressSection(powerUp, cardWidth) {
        const progressContainer = this.scene.rexUI.add.sizer({
            orientation: 'vertical',
            space: { item: UI_THEME.spacing.xs }
        });
        
        // Level text
        const levelText = this.scene.add.text(0, 0, 
            `Level ${powerUp.level + 1}/${powerUp.maxLevel}`,
            UIThemeUtils.createFontConfig('small', 'warning', { 
                stroke: true, 
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        progressContainer.add(levelText, { proportion: 0, align: 'center' });
        
        // Progress bar
        const progressWidth = Math.min(cardWidth - UI_THEME.spacing.xl, 200);
        const progressHeight = 6;
        const progressPercent = (powerUp.level + 1) / powerUp.maxLevel;
        
        const progressBar = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            width: progressWidth,
            height: progressHeight
        });
        
        // Background
        const progressBg = this.scene.rexUI.add.roundRectangle(
            0, 0, progressWidth, progressHeight,
            UI_THEME.borderRadius.small,
            UI_THEME.colors.background.hud
        );
        
        // Fill
        const fillWidth = progressWidth * progressPercent;
        const progressFill = this.scene.rexUI.add.roundRectangle(
            0, 0, fillWidth, progressHeight,
            UI_THEME.borderRadius.small,
            UI_THEME.colors.success
        );
        
        progressBar.addBackground(progressBg);
        progressBar.add(progressFill, { proportion: 0, align: 'left' });
        
        progressContainer.add(progressBar, { proportion: 0, align: 'center' });
        
        return progressContainer;
    }
    
    /**
     * Setup interaktivity pro kartu
     */
    setupCardInteraction(card, background, powerUp) {
        // PR7: RexUI components need proper hit area for interaction
        // Use background as interactive element instead of the sizer
        background.setInteractive();
        this._interactiveBackgrounds.push(background); // Track for cleanup
        
        const originalColor = UI_THEME.colors.background.card;
        const hoverColor = UI_THEME.colors.background.panel;
        const originalStroke = this.getPowerUpThemeColor(powerUp.type);
        const hoverStroke = UI_THEME.colors.borders.active;
        
        // Safe tween helper to prevent crashes
        const safeAddTween = (cfg) => {
            if (!this || this.isDestroyed) return;
            if (!this.scene || !this.scene.tweens) return;
            this.scene.tweens.add(cfg);
        };
        
        // Hover effects (pouze desktop)
        if (!this.isMobileDevice) {
            background.on('pointerover', () => {
                if (this.isDestroyed) return;
                background.setFillStyle(hoverColor);
                background.setStrokeStyle(UI_THEME.borderWidth.thick, hoverStroke);
                
                safeAddTween({
                    targets: card,
                    scaleX: 1.05,
                    scaleY: 1.05,
                    duration: 200,
                    ease: 'Back.easeOut'
                });
            });
            
            background.on('pointerout', () => {
                if (this.isDestroyed) return;
                background.setFillStyle(originalColor);
                background.setStrokeStyle(UI_THEME.borderWidth.normal, originalStroke);
                
                safeAddTween({
                    targets: card,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 200,
                    ease: 'Back.easeIn'
                });
            });
        }
        
        // Click/touch handler
        background.on('pointerdown', () => {
            if (this.isDestroyed) return;
            this.selectPowerUp(powerUp);
        });
    }
    
    /**
     * Vytvoří footer s instrukcemi
     */
    createFooter() {
        const instructionText = this.scene.add.text(0, 0, 
            this.isMobileDevice ? 'Dotkni se karty pro výběr' : 'Klikni na kartu pro výběr vylepšení',
            UIThemeUtils.createFontConfig('small', 'secondary', { isMobile: this.isMobileDevice })
        ).setOrigin(0.5);
        
        this.modalContainer.add(instructionText, { 
            proportion: 0, 
            align: 'center',
            padding: { top: UI_THEME.spacing.m }
        });
    }
    
    /**
     * Výběr power-upu s animací
     */
    selectPowerUp(powerUp) {
        if (this.selectedPowerUp) return; // Prevent double selection
        
        this.selectedPowerUp = powerUp;
        
        // Flash effect na vybranou kartu
        const powerUpIndex = this.powerUps.findIndex(p => p.id === powerUp.id);
        const selectedCard = this.cardComponents[powerUpIndex];
        
        // Proveď "flash" a až PO DOKONČENÍ tweenu zavolej callback (tween běží i když je scene.time pauznuté)
        const runAfterFlash = () => {
            try {
                if (this.onSelectionCallback) {
                    this.onSelectionCallback(powerUp);
                }
            } finally {
                this.hideModal();
            }
        };
        
        if (selectedCard) {
            this.scene.tweens.add({
                targets: selectedCard,
                alpha: 0.3,
                duration: 100,
                yoyo: true,
                repeat: 2,
                onComplete: runAfterFlash
            });
        } else {
            // Bez tweenu pokračuj hned
            runAfterFlash();
        }
    }
    
    /**
     * Update power-ups before showing
     */
    updatePowerUps(newPowerUps) {
        DebugLogger.info('ui', '[PowerUpSelectionModal] updatePowerUps called with', newPowerUps?.length, 'powerups');
        this.powerUps = newPowerUps || [];
        this.selectedPowerUp = null; // Reset selection
        
        // Clear existing cards
        if (this.cardComponents) {
            this.cardComponents.forEach(card => {
                try {
                    if (card && !card._destroyed) {
                        card.destroy();
                    }
                } catch (e) {
                    // Ignore errors
                }
            });
            this.cardComponents = [];
        }
        
        // Clear interactive backgrounds
        if (this._interactiveBackgrounds) {
            this._interactiveBackgrounds.forEach(bg => {
                try {
                    bg.removeAllListeners();
                    bg.disableInteractive();
                } catch(e) {
                    // Ignore
                }
            });
            this._interactiveBackgrounds = [];
        }
        
        // Only destroy and recreate if modal was already visible
        // Otherwise, let show() handle creation
        if (this.modalContainer && this.modalContainer.visible) {
            // Hide existing modal
            this.modalContainer.setVisible(false);
            if (this.overlay) {
                this.overlay.setVisible(false);
            }
            
            // Destroy existing modal to force recreation
            try {
                if (this.modalContainer && !this.modalContainer._destroyed) {
                    this.modalContainer.destroy();
                }
            } catch (e) {
                // Ignore
            }
            this.modalContainer = null;
            this.modalSizer = null;
            
            try {
                if (this.overlay && !this.overlay._destroyed) {
                    this.overlay.destroy();
                }
            } catch (e) {
                // Ignore
            }
            this.overlay = null;
        }
    }
    
    /**
     * Jednoduchá show() metoda - používá super.show() a odstraňuje delayedCall retry logiku
     */
    show(animated = true, duration = 300) {
        DebugLogger.info('ui', '[PowerUpSelectionModal] show() called, powerUps:', this.powerUps.length);
        
        // ✅ Toleruj RUNNING i PAUSED, nevolej ScenePlugin.isActive() bez klíče
        const status = this.scene?.sys?.settings?.status;
        const usable = !!this.scene?.sys && (status === Phaser.Scenes.RUNNING || status === Phaser.Scenes.PAUSED);
        if (!usable) {
            DebugLogger.warn('ui', '[PowerUpSelectionModal] Scene not RUNNING/PAUSED, proceeding best-effort (no tween)');
            animated = false;
        }
        
        // Vytvořit modal pokud neexistuje
        if (!this.modalContainer || this.modalContainer._destroyed) {
            DebugLogger.info('ui', '[PowerUpSelectionModal] Creating modal container');
            this.createModal();
            
            if (!this.modalContainer) {
                DebugLogger.error('ui', '[PowerUpSelectionModal] Failed to create modal container');
                return Promise.resolve();
            }
        }
        
        // Použít BaseUIComponent.show() pro pause-safe animace
        return super.show(animated, duration).then(() => {
            // Po dokončení BaseUIComponent show(), zobrazit modal obsah
            if (this.modalContainer && !this.modalContainer._destroyed) {
                this.modalContainer.setVisible(true);
                
                // Force layout
                if (this.modalSizer && !this.modalSizer._destroyed) {
                    this.modalSizer.layout();
                }
                
                DebugLogger.info('ui', '[PowerUpSelectionModal] Modal content shown');
            }
        });
    }
    
    /**
     * Jednoduchá hideModal() metoda - používá super.hide()
     */
    hideModal() {
        // Skrýt modal obsah nejprve
        if (this.modalContainer) {
            this.modalContainer.setVisible(false);
        }
        
        // Reset selected power-up for next showing
        this.selectedPowerUp = null;
        
        // Použít BaseUIComponent.hide() pro pause-safe animace
        return super.hide();
    }
    
    /**
     * Override destroy to properly clean up RexUI components
     */
    destroy() {
        // Skip if already destroyed
        if (this.isDestroyed) return;
        
        try {
            // Remove from UI layer first
            if (this.scene?.uiLayer) {
                if (this.modalContainer && this.scene.uiLayer.list?.includes(this.modalContainer)) {
                    this.scene.uiLayer.remove(this.modalContainer);
                }
                if (this.overlay && this.scene.uiLayer.list?.includes(this.overlay)) {
                    this.scene.uiLayer.remove(this.overlay);
                }
            }
            
            // Destroy RexUI modal container
            if (this.modalContainer && !this.modalContainer._destroyed) {
                this.modalContainer.destroy(true);
            }
            this.modalContainer = null;
            this.modalSizer = null;
            
            // Destroy overlay
            if (this.overlay && !this.overlay._destroyed) {
                this.overlay.destroy();
            }
            this.overlay = null;
            
            // Clear card references
            this.cardComponents = [];
        } catch (e) {
            DebugLogger.debug('ui', '[PowerUpSelectionModal] Destroy error (safe to ignore):', e.message);
        } finally {
            // Always call parent destroy if not already destroyed
            if (!this.isDestroyed) {
                super.destroy();
            }
        }
    }
    
    // === UTILITY FUNKCE ===
    
    /**
     * Získá theme barvu podle typu power-upu
     */
    getPowerUpThemeColor(type) {
        const colorMap = {
            'weapon': UI_THEME.colors.powerUp.weapon,
            'upgrade': UI_THEME.colors.powerUp.upgrade,
            'passive': UI_THEME.colors.info,
            'defensive': UI_THEME.colors.powerUp.special,
            'ability': UI_THEME.colors.warning
        };
        return colorMap[type] || UI_THEME.colors.primary;
    }
    
    /**
     * Extrahuje emoji ikonu z názvu
     */
    extractIcon(name) {
        const emojiMatch = name.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu);
        return emojiMatch ? emojiMatch[0] : '⭐';
    }
    
    /**
     * Odstraní emoji z názvu
     */
    cleanPowerUpName(name) {
        return name.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
    }
    
    /**
     * Detailní informace o power-upu (převzato z původního kódu)
     */
    getDetailedInfo(powerUp) {
        switch (powerUp.id) {
            case 'flamethrower':
                return `${powerUp.level + 1} laserový paprsek\nCílí na nejbližší nepřátele`;
            case 'radiotherapy':
                const beams = [1, 2, 3, 3, 3][powerUp.level] || 1;
                const range = [80, 80, 80, 100, 120][powerUp.level] || 80;
                const damage = [5, 5, 5, 8, 12][powerUp.level] || 5;
                if (powerUp.level < 3) {
                    return `${beams} rotující paprsek${beams > 1 ? 'y' : ''}\nDosah: ${range}px, Poškození: ${damage}/tick`;
                } else {
                    return `3 rotující paprsky\nDosah: ${range}px, Poškození: ${damage}/tick`;
                }
            case 'explosiveBullets':
                return `Exploze ${30 + (powerUp.level + 1) * 10}px poloměr\nSpustí se při prvním zásahu projektilu`;
            case 'xpMagnet':
                return `+${(powerUp.level + 1) * 30}px dosah\nAutomaticky sbírá XP`;
            case 'lightningChain':
                return `Imunoterapie až ${2 + powerUp.level} cílů\nAktivuje imunitní odezvu`;
            case 'piercingArrows':
                return `Projde ${powerUp.level + 1} buňkami\n-10% poškození za každý průchod`;
            case 'shield':
                const nextShieldLevel = powerUp.level + 1;
                const shieldHP = 50 + (nextShieldLevel - 1) * 25;
                const regenTime = Math.max(6, 10 - (nextShieldLevel - 1));
                return `${shieldHP} HP štít, regenerace ${regenTime}s\nAbsorbuje příchozí poškození`;
            case 'speedBoots':
                return `+${((powerUp.level + 1) * powerUp.value * 100).toFixed(0)}% rychlost pohybu\nZrychluje Mardův metabolismus`;
            case 'aura':
                return `Kontinuální poškození v okolí\nPoloměr účinku roste s levelem`;
            case 'attackSpeed':
                return `-${((powerUp.level + 1) * powerUp.value * 100).toFixed(0)}% interval útoků\nRychlejší střelba`;
            case 'projectileRange':
                return `+${(powerUp.level + 1) * 10}% dosah všech útoků\nProjektily, lasery, blesky`;
            case 'damageBoost':
                return `+${powerUp.value * (powerUp.level + 1)} poškození\nVšechny útoky silnější`;
            case 'maxHp':
                return `+${powerUp.value * (powerUp.level + 1)} maximální HP\nVíce životů`;
            case 'projectileCount':
                return `+${powerUp.value * (powerUp.level + 1)} projektil(ů)\nVíce střel najednou`;
            default:
                return 'Vylepší tvé schopnosti';
        }
    }
    
    /**
     * Aktuální hodnoty power-upu (převzato z původního kódu)
     */
    getCurrentValue(powerUp) {
        try {
            // Zkrať ID z powerup.speed_boots na speed_boots
            const shortId = powerUp.id.replace('powerup.', '');
            switch (shortId) {
                case 'speed_boots':
                    const speedValue = powerUp.value || 0.15;
                    return `+${(powerUp.level * speedValue * 100).toFixed(0)}% rychlost`;
                case 'aura':
                    const auraValue = powerUp.value || 5;
                    return `${powerUp.level * auraValue} dmg/sek`;
                case 'attack_speed':
                    const attackValue = powerUp.value || 0.1;
                    return `+${(powerUp.level * attackValue * 100).toFixed(0)}% rychlost střelby`;
                case 'damage_boost':
                    const damageValue = powerUp.value || 5;
                    return `+${powerUp.level * damageValue}`;
                case 'max_hp':
                    const hpValue = powerUp.value || 20;
                    return `+${powerUp.level * hpValue} HP`;
                case 'projectile_count':
                    const projValue = powerUp.value || 1;
                    return `${powerUp.level + 1} projektilů celkem`;
                case 'flamethrower':
                    return `${powerUp.level} lasery aktivní`;
                case 'radiotherapy':
                    const currentBeams = [0, 1, 2, 3, 3, 3][powerUp.level] || 0;
                    const currentRange = [0, 80, 80, 80, 100, 120][powerUp.level] || 0;
                    const currentDamage = [0, 5, 5, 5, 8, 12][powerUp.level] || 0;
                    if (currentBeams > 0) {
                        return `${currentBeams} paprsek${currentBeams > 1 ? 'y' : ''}, ${currentRange}px dosah`;
                    }
                    return `Neaktivní`;
                case 'explosive_bullets':
                    const explosionRadius = 30 + powerUp.level * 10;
                    return `${explosionRadius}px exploze`;
                case 'xp_magnet':
                    const magnetRange = powerUp.level * 30;
                    return `+${magnetRange}px dosah`;
                case 'lightning_chain':
                    return `až ${1 + powerUp.level} cílů`;
                case 'piercing_arrows':
                    return `${powerUp.level} průchodů`;
                case 'shield':
                    const currentShieldHP = 50 + powerUp.level * 25;
                    return `${currentShieldHP} HP štít`;
                case 'projectile_range':
                    return `+${powerUp.level * 10}% dosah`;
                default:
                    return `Level ${powerUp.level}`;
            }
        } catch (e) {
            DebugLogger.warn('ui', 'getCurrentValue error:', e);
            return `Level ${powerUp.level}`;
        }
    }
    
    /**
     * Custom cleanup
     */
    onCleanup() {
        // Clean up interactive backgrounds first
        this._interactiveBackgrounds?.forEach(bg => {
            try {
                bg.removeAllListeners();
                bg.disableInteractive();
            } catch(e) {
                // Ignore errors if already destroyed
            }
        });
        this._interactiveBackgrounds = [];
        
        // Clean up card components
        this.cardComponents.forEach(card => {
            try {
                if (card && card.destroy) {
                    card.destroy();
                }
            } catch(e) {
                // Ignore errors if already destroyed
            }
        });
        this.cardComponents = [];
        this.selectedPowerUp = null;
        this.onSelectionCallback = null;
    }
}

export default PowerUpSelectionModal;