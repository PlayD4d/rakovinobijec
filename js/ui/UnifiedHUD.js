/**
 * UnifiedHUD - hlavní HUD komponenta postavená na unified UI systému
 * Nahrazuje RexHUD a UIManager
 */
import { BaseUIComponent } from './BaseUIComponent.js';
import { UI_THEME, UIThemeUtils } from './UITheme.js';
import { RESPONSIVE, isMobile } from './UiConstants.js';

export class UnifiedHUD extends BaseUIComponent {
    constructor(scene) {
        super(scene, 0, 0, {
            width: scene.scale.width,
            height: scene.scale.height,
            theme: 'hud',
            responsive: true
        });
        
        // HUD elementy
        this.hpBar = null;
        this.hpText = null;
        this.xpBar = null;
        this.xpText = null;
        this.levelText = null;
        this.scoreText = null;
        this.timeText = null;
        this.enemiesText = null;
        this.debugText = null; // HOTFIX V3: Debug info
        
        // Boss HUD
        this.bossContainer = null;
        this.bossNameText = null;
        this.bossBar = null;
        this.bossHealthText = null;
        
        // Game Over
        this.gameOverContainer = null;
        
        // Bar dimensions
        this.BAR_WIDTH = this.isMobileDevice ? 200 : 240;
        this.BAR_HEIGHT = 24;
        this.BAR_INNER_HEIGHT = 20;
        
        // Boss bar dimensions  
        this.BOSS_BAR_WIDTH = this.isMobileDevice ? 400 : 480;
        this.BOSS_BAR_HEIGHT = 24;
        this.BOSS_BAR_MAX_WIDTH = this.BOSS_BAR_WIDTH - 8;
        
        this.createHUD();
    }
    
    getComponentDepth() {
        return UI_THEME.depth.hud;
    }
    
    /**
     * Vytvoří všechny HUD elementy
     */
    createHUD() {
        const padding = RESPONSIVE.getSpacing(this.isMobileDevice);
        
        // Left panel - HP/XP
        this.createLeftPanel(padding);
        
        // Right panel - Stats
        this.createRightPanel(padding);
        
        // Bottom panel - Enemies count
        this.createBottomPanel(padding);
        
        // Boss HUD (hidden by default)
        this.createBossHUD();
        
        // Set proper depth
        this.setDepth(this.getComponentDepth());
    }
    
    /**
     * Vytvoří levý panel s HP a XP bary
     */
    createLeftPanel(padding) {
        const x = padding.large;
        const y = padding.large;
        
        // HP Container
        const hpContainer = this.createBar(
            x, y,
            'HP',
            UI_THEME.colors.success,
            100, 100
        );
        this.hpBar = hpContainer.bar;
        this.hpText = hpContainer.text;
        
        // XP Container
        const xpContainer = this.createBar(
            x, y + this.BAR_HEIGHT + padding.small,
            'XP',
            UI_THEME.colors.info,
            0, 100
        );
        this.xpBar = xpContainer.bar;
        this.xpText = xpContainer.text;
    }
    
    /**
     * Vytvoří universal bar (HP/XP/Boss)
     */
    createBar(x, y, label, color, value, maxValue) {
        // Background
        const bg = this.scene.add.rectangle(
            x + 30, y,
            this.BAR_WIDTH, this.BAR_HEIGHT,
            UI_THEME.colors.background.hud
        );
        bg.setOrigin(0, 0);
        bg.setStrokeStyle(UI_THEME.borderWidth.thin, UI_THEME.colors.borders.default);
        
        // Bar fill
        const bar = this.scene.add.rectangle(
            x + 32, y + 2,
            (this.BAR_WIDTH - 4) * (value / maxValue),
            this.BAR_INNER_HEIGHT,
            color
        );
        bar.setOrigin(0, 0);
        
        // Label
        const labelText = this.scene.add.text(
            x, y + this.BAR_HEIGHT / 2,
            label,
            UIThemeUtils.createFontConfig('small', 'primary', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        );
        labelText.setOrigin(0, 0.5);
        
        // Value text
        const text = this.scene.add.text(
            x + 30 + this.BAR_WIDTH / 2,
            y + this.BAR_HEIGHT / 2,
            `${value}/${maxValue}`,
            UIThemeUtils.createFontConfig('small', 'primary', { 
                stroke: true,
                strokeThickness: 3,
                isMobile: this.isMobileDevice 
            })
        );
        text.setOrigin(0.5, 0.5);
        
        // Add to container
        this.add([bg, bar, labelText, text]);
        
        return { bg, bar, text };
    }
    
    /**
     * Vytvoří pravý panel se statistikami
     */
    createRightPanel(padding) {
        const { width } = this.scene.scale.gameSize;
        const x = width - padding.large;
        const y = padding.large;
        
        // Level
        this.levelText = this.scene.add.text(
            x, y,
            'Level: 1',
            UIThemeUtils.createFontConfig('normal', 'primary', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        );
        this.levelText.setOrigin(1, 0);
        
        // Score
        this.scoreText = this.scene.add.text(
            x, y + 25,
            'Skóre: 0',
            UIThemeUtils.createFontConfig('normal', 'primary', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        );
        this.scoreText.setOrigin(1, 0);
        
        this.add([this.levelText, this.scoreText]);
    }
    
    /**
     * Vytvoří spodní panel s počtem nepřátel a časem (symetrické rozložení)
     */
    createBottomPanel(padding) {
        const { width, height } = this.scene.scale.gameSize;
        
        // Enemies count - levý dolní roh
        this.enemiesText = this.scene.add.text(
            padding.large,
            height - padding.large,
            'Zničeno buněk: 0',
            UIThemeUtils.createFontConfig('normal', 'primary', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        );
        this.enemiesText.setOrigin(0, 1);
        
        // Time - pravý dolní roh (symetrie k enemies)
        this.timeText = this.scene.add.text(
            width - padding.large,
            height - padding.large,
            'Čas: 0:00',
            UIThemeUtils.createFontConfig('normal', 'primary', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        );
        this.timeText.setOrigin(1, 1);
        
        this.add([this.enemiesText, this.timeText]);
    }
    
    /**
     * Vytvoří Boss HUD (skrytý by default) - zarovnán s XP barem
     */
    createBossHUD() {
        const { width } = this.scene.scale.gameSize;
        const padding = RESPONSIVE.getSpacing(this.isMobileDevice);
        
        // Boss bar je zarovnán s XP barem (na stejné úrovni)
        const xpBarY = padding.large + this.BAR_HEIGHT + padding.small;
        const bossBarY = xpBarY + this.BAR_HEIGHT / 2; // Střed boss baru = spodní okraj XP baru
        
        // Boss container
        this.bossContainer = this.scene.add.container(width / 2, bossBarY);
        
        // Boss name - nad barem místo v něm
        this.bossNameText = this.scene.add.text(
            0, -25, // Více nahoru, aby nebyl v baru
            '',
            UIThemeUtils.createFontConfig('large', 'danger', { 
                stroke: true,
                strokeThickness: 4,
                isMobile: this.isMobileDevice 
            })
        );
        this.bossNameText.setOrigin(0.5);
        
        // Boss bar background
        const bossBg = this.scene.add.rectangle(
            0, 0,
            this.BOSS_BAR_WIDTH, this.BOSS_BAR_HEIGHT,
            UI_THEME.colors.background.hud
        );
        bossBg.setStrokeStyle(UI_THEME.borderWidth.thick, UI_THEME.colors.secondary);
        
        // Boss bar fill
        this.bossBar = this.scene.add.rectangle(
            -this.BOSS_BAR_WIDTH / 2 + 4, 0,
            this.BOSS_BAR_MAX_WIDTH, this.BAR_INNER_HEIGHT,
            UI_THEME.colors.secondary
        );
        this.bossBar.setOrigin(0, 0.5);
        
        // Boss health text
        this.bossHealthText = this.scene.add.text(
            0, 0,
            '',
            UIThemeUtils.createFontConfig('small', 'primary', { 
                stroke: true,
                strokeThickness: 3,
                isMobile: this.isMobileDevice 
            })
        );
        this.bossHealthText.setOrigin(0.5);
        
        // Add to boss container
        this.bossContainer.add([bossBg, this.bossBar, this.bossNameText, this.bossHealthText]);
        
        // Hide initially
        this.bossContainer.setVisible(false);
        
        this.add(this.bossContainer);
    }
    
    /**
     * Update HP bar
     */
    updateHP(current, max) {
        const percentage = Math.max(0, current / max);
        this.hpBar.width = (this.BAR_WIDTH - 4) * percentage;
        this.hpText.setText(`${Math.floor(current)}/${Math.floor(max)}`);
        
        // Color change based on HP
        if (percentage > 0.6) {
            this.hpBar.setFillStyle(UI_THEME.colors.success);
        } else if (percentage > 0.3) {
            this.hpBar.setFillStyle(UI_THEME.colors.warning);
        } else {
            this.hpBar.setFillStyle(UI_THEME.colors.secondary);
        }
    }
    
    // Alias for compatibility with Player.js
    setPlayerHealth(current, max) {
        this.updateHP(current, max);
    }
    
    /**
     * Update XP bar
     */
    updateXP(current, max) {
        const percentage = Math.min(1, current / max);
        this.xpBar.width = (this.BAR_WIDTH - 4) * percentage;
        this.xpText.setText(`${Math.floor(current)}/${max}`);
    }
    
    // Alias for compatibility
    setPlayerXP(current, max) {
        this.updateXP(current, max);
    }
    
    /**
     * Update stats
     */
    updateStats(stats) {
        if (stats.level !== undefined) {
            this.levelText.setText(`Level: ${stats.level}`);
        }
        if (stats.score !== undefined) {
            this.scoreText.setText(`Skóre: ${stats.score}`);
        }
        if (stats.time !== undefined) {
            const minutes = Math.floor(stats.time / 60);
            const seconds = Math.floor(stats.time % 60);
            this.timeText.setText(`Čas: ${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
        if (stats.enemies !== undefined) {
            this.enemiesText.setText(`Zničeno buněk: ${stats.enemies}`);
        }
    }
    
    /**
     * Show boss HUD
     */
    showBoss(name, hp, maxHp) {
        this.bossNameText.setText(name);
        this.setBossHealth(hp, maxHp);
        this.bossContainer.setVisible(true);
        
        // Fade in animation
        this.bossContainer.alpha = 0;
        this.scene.tweens.add({
            targets: this.bossContainer,
            alpha: 1,
            duration: 500
        });
    }
    
    /**
     * Update boss health
     */
    setBossHealth(hp, maxHp) {
        const percentage = Math.max(0, hp / maxHp);
        this.bossBar.width = this.BOSS_BAR_MAX_WIDTH * percentage;
        this.bossHealthText.setText(`${Math.floor(hp)}/${Math.floor(maxHp)}`);
    }
    
    /**
     * Hide boss HUD
     */
    hideBoss() {
        this.scene.tweens.add({
            targets: this.bossContainer,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                this.bossContainer.setVisible(false);
            }
        });
    }
    
    /**
     * Show Game Over screen - kompletně RexUI řešení
     */
    showGameOver(stats) {
        if (this.gameOverContainer) return;
        
        const { width, height } = this.scene.scale.gameSize;
        
        // Create modal overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(UI_THEME.colors.background.overlay, 0.8);
        overlay.fillRect(0, 0, width, height);
        
        // Modal size
        const modalSize = RESPONSIVE.getModalSize(this.isMobileDevice, width, height);
        
        // Game Over RexUI sizer
        this.gameOverContainer = this.scene.rexUI.add.sizer({
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
            UI_THEME.colors.secondary
        );
        
        this.gameOverContainer.addBackground(background);
        
        // Title
        const titleText = this.scene.add.text(0, 0, 'GAME OVER',
            UIThemeUtils.createFontConfig('title', 'danger', { 
                stroke: true,
                strokeThickness: 4,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        this.gameOverContainer.add(titleText, {
            proportion: 0,
            align: 'center',
            padding: { top: UI_THEME.spacing.xl }
        });
        
        // Stats
        const statsText = this.scene.add.text(0, 0, this.formatGameOverStats(stats),
            UIThemeUtils.createFontConfig('normal', 'primary', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        );
        statsText.setOrigin(0.5);
        statsText.setAlign('center');
        
        this.gameOverContainer.add(statsText, {
            proportion: 1,
            align: 'center',
            padding: { top: UI_THEME.spacing.m, bottom: UI_THEME.spacing.m }
        });
        
        // Buttons container
        const buttonsContainer = this.scene.rexUI.add.sizer({
            orientation: 'vertical',
            space: { item: UI_THEME.spacing.m }
        });
        
        // Restart button
        const restartButton = this.createGameOverButton(
            'HRÁT ZNOVU (R)',
            () => this.scene.restartGame()
        );
        
        // Menu button
        const menuButton = this.createGameOverButton(
            'UKONČIT (ESC)',
            () => this.scene.returnToMenu()
        );
        
        buttonsContainer.add(restartButton, { proportion: 0, align: 'center' });
        buttonsContainer.add(menuButton, { proportion: 0, align: 'center' });
        buttonsContainer.layout();
        
        this.gameOverContainer.add(buttonsContainer, {
            proportion: 0,
            align: 'center',
            padding: { bottom: UI_THEME.spacing.m }
        });
        
        // Keyboard controls info
        const controlsText = this.scene.add.text(0, 0,
            'R - Hrát znovu | ESC - Ukončit',
            UIThemeUtils.createFontConfig('small', 'secondary', { 
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        this.gameOverContainer.add(controlsText, {
            proportion: 0,
            align: 'center',
            padding: { bottom: UI_THEME.spacing.xl }
        });
        
        // Layout the modal
        this.gameOverContainer.layout();
        
        // Add to scene
        this.add([overlay, this.gameOverContainer]);
        
        // Set depth
        overlay.setDepth(UI_THEME.depth.modal);
        this.gameOverContainer.setDepth(UI_THEME.depth.modal + 1);
        
        // Fade in animation
        this.gameOverContainer.alpha = 0;
        this.scene.tweens.add({
            targets: this.gameOverContainer,
            alpha: 1,
            duration: 500
        });
    }
    
    
    /**
     * Vytvoří tlačítko pro Game Over modal
     */
    createGameOverButton(text, onClickCallback) {
        const buttonWidth = this.isMobileDevice ? 200 : 220;
        const buttonHeight = this.isMobileDevice ? 40 : 45;
        
        // Button container
        const button = this.scene.rexUI.add.sizer({
            width: buttonWidth,
            height: buttonHeight,
            orientation: 'horizontal'
        });
        
        // Background
        const background = this.scene.rexUI.add.roundRectangle(
            0, 0, buttonWidth, buttonHeight,
            UI_THEME.borderRadius.normal,
            UI_THEME.colors.background.card
        ).setStrokeStyle(
            UI_THEME.borderWidth.normal,
            UI_THEME.colors.borders.default
        );
        
        button.addBackground(background);
        
        // Text
        const buttonText = this.scene.add.text(0, 0, text,
            UIThemeUtils.createFontConfig('normal', 'primary', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        button.add(buttonText, { proportion: 1, align: 'center' });
        
        // Interactivity
        button.setInteractive()
            .on('pointerover', () => {
                background.setFillStyle(UI_THEME.colors.background.panel);
                background.setStrokeStyle(UI_THEME.borderWidth.thick, UI_THEME.colors.borders.active);
            })
            .on('pointerout', () => {
                background.setFillStyle(UI_THEME.colors.background.card);
                background.setStrokeStyle(UI_THEME.borderWidth.normal, UI_THEME.colors.borders.default);
            })
            .on('pointerdown', onClickCallback);
        
        return button;
    }
    
    /**
     * Format game over stats
     */
    formatGameOverStats(stats) {
        const minutes = Math.floor(stats.time / 60);
        const seconds = Math.floor(stats.time % 60);
        
        return `
Dosažený level: ${stats.level}
Celkové skóre: ${stats.score}

Zničeno buněk: ${stats.enemiesKilled}
Z toho bossů: ${stats.bossesDefeated || 0}

Čas přežití: ${minutes}:${seconds.toString().padStart(2, '0')}
Power-upy: ${stats.powerUpsCollected}
        `.trim();
    }
    
    /**
     * Update method called from GameScene
     */
    update() {
        // Update player stats if available
        if (this.scene.player) {
            this.setPlayerHealth(this.scene.player.hp, this.scene.player.maxHp);
        }
        
        // Update XP if available
        if (this.scene.gameStats) {
            this.setPlayerXP(this.scene.gameStats.xp, this.scene.gameStats.xpToNext);
            
            // Update other stats
            this.updateStats({
                level: this.scene.gameStats.level,
                score: this.scene.gameStats.score,
                time: this.scene.gameStats.time,
                enemies: this.scene.gameStats.kills || 0
            });
        }
    }
    
    /**
     * Handle resize
     */
    onResize(gameSize, baseSize, displaySize) {
        // Update positions based on new size
        const padding = RESPONSIVE.getSpacing(this.isMobileDevice);
        
        // Update right panel position
        if (this.levelText) {
            const x = gameSize.width - padding.large;
            this.levelText.x = x;
            this.scoreText.x = x;
        }
        
        // Update bottom panel position (enemies + time)
        if (this.enemiesText) {
            this.enemiesText.y = gameSize.height - padding.large;
        }
        if (this.timeText) {
            this.timeText.x = gameSize.width - padding.large;
            this.timeText.y = gameSize.height - padding.large;
        }
        
        // Update boss HUD position - přepočítat Y pozici taky
        if (this.bossContainer) {
            const xpBarY = padding.large + this.BAR_HEIGHT + padding.small;
            const bossBarY = xpBarY + this.BAR_HEIGHT / 2;
            this.bossContainer.x = gameSize.width / 2;
            this.bossContainer.y = bossBarY;
        }
        
        // Update game over position
        if (this.gameOverContainer) {
            this.gameOverContainer.x = gameSize.width / 2;
            this.gameOverContainer.y = gameSize.height / 2;
        }
    }
    
    /**
     * Cleanup
     */
    onCleanup() {
        if (this.gameOverContainer) {
            this.gameOverContainer.destroy();
            this.gameOverContainer = null;
        }
    }
}

export default UnifiedHUD;