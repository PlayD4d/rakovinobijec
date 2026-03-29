/**
 * UnifiedHUD - Main HUD component (LiteUI pattern)
 * Plain JS class that owns a Phaser Container - does NOT extend any Phaser class.
 * Lives in GameUIScene, reads data from GameScene via connect().
 */
import { UI_THEME, UIThemeUtils } from './UITheme.js';
import { RESPONSIVE, isMobile } from './UiConstants.js';

export class UnifiedHUD {
    constructor(scene) {
        /** @type {Phaser.Scene} The UI scene (GameUIScene) */
        this.scene = scene;

        /** @type {Phaser.Scene|null} The game scene (GameScene) — set via connect() */
        this.gameScene = null;

        this.isMobileDevice = isMobile();

        // HUD elements
        this.hpBar = null;
        this.hpText = null;
        this.xpBar = null;
        this.xpText = null;
        this.levelText = null;
        this.scoreText = null;
        this.timeText = null;
        this.enemiesText = null;

        // Boss HUD
        this.bossContainer = null;
        this.bossNameText = null;
        this.bossBar = null;
        this.bossHealthText = null;

        // Bar dimensions
        this.BAR_WIDTH = this.isMobileDevice ? 200 : 240;
        this.BAR_HEIGHT = 24;
        this.BAR_INNER_HEIGHT = 20;

        // Boss bar dimensions
        this.BOSS_BAR_WIDTH = this.isMobileDevice ? 400 : 480;
        this.BOSS_BAR_HEIGHT = 24;
        this.BOSS_BAR_MAX_WIDTH = this.BOSS_BAR_WIDTH - 8;

        // Main container — added to the scene display list
        this.container = new Phaser.GameObjects.Container(scene, 0, 0);
        scene.add.existing(this.container);
        this.container.setDepth(UI_THEME.depth.hud);
        this.container.setScrollFactor(0);

        this._destroyed = false;

        this.createHUD();

        // Listen for resize
        scene.scale.on('resize', this.onResize, this);
    }

    /**
     * Connect to the GameScene so the HUD can read player/gameStats
     */
    connect(gameScene) {
        this.gameScene = gameScene;
    }

    // ─── Creation ────────────────────────────────────────────

    createHUD() {
        const padding = RESPONSIVE.getSpacing(this.isMobileDevice);
        this.createLeftPanel(padding);
        this.createRightPanel(padding);
        this.createBottomPanel(padding);
        this.createBossHUD();
    }

    /**
     * Create a text object via constructor (avoids double display-list add)
     */
    _text(x, y, str, fontCfg) {
        const t = new Phaser.GameObjects.Text(this.scene, x, y, str, fontCfg);
        t.setScrollFactor(0);
        return t;
    }

    /**
     * Create a rectangle via constructor
     */
    _rect(x, y, w, h, color) {
        const r = new Phaser.GameObjects.Rectangle(this.scene, x, y, w, h, color);
        r.setScrollFactor(0);
        return r;
    }

    createLeftPanel(padding) {
        const x = padding.large;
        const y = padding.large;

        // HP bar
        const hpContainer = this.createBar(x, y, 'HP', UI_THEME.colors.success, 100, 100);
        this.hpBar = hpContainer.bar;
        this.hpText = hpContainer.text;

        // XP bar
        const xpContainer = this.createBar(
            x, y + this.BAR_HEIGHT + padding.small,
            'XP', UI_THEME.colors.info, 0, 100
        );
        this.xpBar = xpContainer.bar;
        this.xpText = xpContainer.text;
    }

    createBar(x, y, label, color, value, maxValue) {
        // Background (origin 0,0 — top-left positioning, same as original)
        const bg = this._rect(x + 30, y, this.BAR_WIDTH, this.BAR_HEIGHT, UI_THEME.colors.background.hud);
        bg.setOrigin(0, 0);
        bg.setStrokeStyle(UI_THEME.borderWidth.thin, UI_THEME.colors.borders.default);

        // Bar fill (origin 0,0 — width changes directly)
        const bar = this._rect(
            x + 32, y + 2,
            (this.BAR_WIDTH - 4) * (value / maxValue),
            this.BAR_INNER_HEIGHT, color
        );
        bar.setOrigin(0, 0);

        // Label
        const labelText = this._text(
            x, y + this.BAR_HEIGHT / 2, label,
            UIThemeUtils.createFontConfig('small', 'primary', {
                stroke: true, isMobile: this.isMobileDevice
            })
        );
        labelText.setOrigin(0, 0.5);

        // Value text
        const text = this._text(
            x + 30 + this.BAR_WIDTH / 2, y + this.BAR_HEIGHT / 2,
            `${value}/${maxValue}`,
            UIThemeUtils.createFontConfig('small', 'primary', {
                stroke: true, strokeThickness: 3, isMobile: this.isMobileDevice
            })
        );
        text.setOrigin(0.5, 0.5);

        this.container.add([bg, bar, labelText, text]);

        return { bg, bar, text };
    }

    createRightPanel(padding) {
        const { width } = this.scene.scale.gameSize;
        const x = width - padding.large;
        const y = padding.large;

        this.levelText = this._text(
            x, y, 'Level: 1',
            UIThemeUtils.createFontConfig('normal', 'primary', {
                stroke: true, isMobile: this.isMobileDevice
            })
        );
        this.levelText.setOrigin(1, 0);

        this.scoreText = this._text(
            x, y + 25, 'Sk\u00f3re: 0',
            UIThemeUtils.createFontConfig('normal', 'primary', {
                stroke: true, isMobile: this.isMobileDevice
            })
        );
        this.scoreText.setOrigin(1, 0);

        this.container.add([this.levelText, this.scoreText]);
    }

    createBottomPanel(padding) {
        const { width, height } = this.scene.scale.gameSize;

        this.enemiesText = this._text(
            padding.large, height - padding.large,
            'Zni\u010deno bun\u011bk: 0',
            UIThemeUtils.createFontConfig('normal', 'primary', {
                stroke: true, isMobile: this.isMobileDevice
            })
        );
        this.enemiesText.setOrigin(0, 1);

        this.timeText = this._text(
            width - padding.large, height - padding.large,
            '\u010cas: 0:00',
            UIThemeUtils.createFontConfig('normal', 'primary', {
                stroke: true, isMobile: this.isMobileDevice
            })
        );
        this.timeText.setOrigin(1, 1);

        this.container.add([this.enemiesText, this.timeText]);
    }

    createBossHUD() {
        const { width } = this.scene.scale.gameSize;
        const padding = RESPONSIVE.getSpacing(this.isMobileDevice);

        const xpBarY = padding.large + this.BAR_HEIGHT + padding.small;
        const bossBarY = xpBarY + this.BAR_HEIGHT / 2;

        this.bossContainer = new Phaser.GameObjects.Container(this.scene, width / 2, bossBarY);
        this.bossContainer.setScrollFactor(0);

        // Boss name
        this.bossNameText = this._text(
            0, -25, '',
            UIThemeUtils.createFontConfig('large', 'danger', {
                stroke: true, strokeThickness: 4, isMobile: this.isMobileDevice
            })
        );
        this.bossNameText.setOrigin(0.5);

        // Boss bar background
        const bossBg = this._rect(0, 0, this.BOSS_BAR_WIDTH, this.BOSS_BAR_HEIGHT, UI_THEME.colors.background.hud);
        bossBg.setStrokeStyle(UI_THEME.borderWidth.thick, UI_THEME.colors.secondary);

        // Boss bar fill
        this.bossBar = this._rect(
            -this.BOSS_BAR_WIDTH / 2 + 4, 0,
            this.BOSS_BAR_MAX_WIDTH, this.BAR_INNER_HEIGHT,
            UI_THEME.colors.secondary
        );
        this.bossBar.setOrigin(0, 0.5);

        // Boss health text
        this.bossHealthText = this._text(
            0, 0, '',
            UIThemeUtils.createFontConfig('small', 'primary', {
                stroke: true, strokeThickness: 3, isMobile: this.isMobileDevice
            })
        );
        this.bossHealthText.setOrigin(0.5);

        this.bossContainer.add([bossBg, this.bossBar, this.bossNameText, this.bossHealthText]);
        this.bossContainer.setVisible(false);

        this.container.add(this.bossContainer);
    }

    // ─── Runtime API ─────────────────────────────────────────

    updateHP(current, max) {
        const percentage = Math.max(0, current / max);
        this.hpBar.width = (this.BAR_WIDTH - 4) * percentage;
        this.hpText.setText(`${Math.floor(current)}/${Math.floor(max)}`);

        if (percentage > 0.6) {
            this.hpBar.setFillStyle(UI_THEME.colors.success);
        } else if (percentage > 0.3) {
            this.hpBar.setFillStyle(UI_THEME.colors.warning);
        } else {
            this.hpBar.setFillStyle(UI_THEME.colors.secondary);
        }
    }

    setPlayerHealth(current, max) {
        this.updateHP(current, max);
    }

    updateXP(current, max) {
        if (!max || max <= 0) return;
        const percentage = Math.min(1, current / max);
        this.xpBar.width = (this.BAR_WIDTH - 4) * percentage;
        this.xpText.setText(`${Math.floor(current)}/${max}`);
    }

    setPlayerXP(current, max) {
        this.updateXP(current, max);
    }

    updateStats(stats) {
        if (stats.level !== undefined) {
            const stageStr = stats.stage ? ` | Stage: ${stats.stage}` : '';
            this.levelText.setText(`Level: ${stats.level}${stageStr}`);
        }
        if (stats.score !== undefined) {
            this.scoreText.setText(`Sk\u00f3re: ${stats.score}`);
        }
        if (stats.time !== undefined) {
            const minutes = Math.floor(stats.time / 60);
            const seconds = Math.floor(stats.time % 60);
            this.timeText.setText(`\u010cas: ${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
        if (stats.enemies !== undefined) {
            this.enemiesText.setText(`Zni\u010deno bun\u011bk: ${stats.enemies}`);
        }
    }

    showBoss(name, hp, maxHp) {
        if (this._destroyed || !this.bossContainer) return;
        // Kill any in-flight hideBoss tween to prevent its onComplete hiding the new bar
        this.scene.tweens.killTweensOf(this.bossContainer);
        this._hidingBoss = false;
        this.bossNameText.setText(name);
        this.setBossHealth(hp, maxHp);
        this.bossContainer.setVisible(true);
        this.bossContainer.alpha = 0;
        this.scene.tweens.add({ targets: this.bossContainer, alpha: 1, duration: 500 });
    }

    setBossHealth(hp, maxHp) {
        if (this._destroyed || !this.bossBar) return;
        const percentage = Math.max(0, hp / maxHp);
        this.bossBar.width = this.BOSS_BAR_MAX_WIDTH * percentage;
        this.bossHealthText.setText(`${Math.floor(hp)}/${Math.floor(maxHp)}`);
    }

    hideBoss() {
        if (this._destroyed || !this.bossContainer || this._hidingBoss) return;
        this._hidingBoss = true;
        this.scene.tweens.add({
            targets: this.bossContainer, alpha: 0, duration: 500,
            onComplete: () => {
                this._hidingBoss = false;
                this.bossContainer?.setVisible(false);
            }
        });
    }

    /**
     * Per-frame update: only time display needs polling
     */
    update() {
        if (!this.gameScene?.gameStats) return;
        const t = this.gameScene.gameStats.time;
        // Only update text when the integer second changes (avoids 60/s string allocation)
        if (t === this._lastTimeSec) return;
        this._lastTimeSec = t;
        const minutes = Math.floor(t / 60);
        const seconds = Math.floor(t % 60);
        this.timeText?.setText(`Čas: ${minutes}:${seconds.toString().padStart(2, '0')}`);
    }

    /**
     * Refresh all HUD values — call on discrete events (damage, XP, kill, level-up)
     */
    refresh() {
        if (!this.gameScene) return;

        if (this.gameScene.player) {
            this.setPlayerHealth(this.gameScene.player.hp, this.gameScene.player.maxHp);
        }
        if (this.gameScene.gameStats) {
            this.setPlayerXP(this.gameScene.gameStats.xp, this.gameScene.gameStats.xpToNext);
            this.updateStats({
                level: this.gameScene.gameStats.level,
                score: this.gameScene.gameStats.score,
                time: this.gameScene.gameStats.time,
                enemies: this.gameScene.gameStats.kills || 0
            });
        }
    }

    /**
     * Handle resize
     */
    onResize(gameSize) {
        if (this._destroyed) return;
        const padding = RESPONSIVE.getSpacing(this.isMobileDevice);

        if (this.levelText) {
            const x = gameSize.width - padding.large;
            this.levelText.x = x;
            this.scoreText.x = x;
        }

        if (this.enemiesText) {
            this.enemiesText.y = gameSize.height - padding.large;
        }
        if (this.timeText) {
            this.timeText.x = gameSize.width - padding.large;
            this.timeText.y = gameSize.height - padding.large;
        }

        if (this.bossContainer) {
            const xpBarY = padding.large + this.BAR_HEIGHT + padding.small;
            const bossBarY = xpBarY + this.BAR_HEIGHT / 2;
            this.bossContainer.x = gameSize.width / 2;
            this.bossContainer.y = bossBarY;
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        this.scene.scale.off('resize', this.onResize, this);

        if (this.scene.tweens) {
            this.scene.tweens.killTweensOf(this.bossContainer);
        }

        this.container?.destroy();
        this.container = null;
        this.bossContainer = null;
        this.gameScene = null;
    }
}

