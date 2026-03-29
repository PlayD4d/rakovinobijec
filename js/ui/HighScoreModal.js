/**
 * HighScoreModal - Pure Phaser LiteUI high score dialog
 * Pure Phaser implementation using SimpleModal + SimpleButton pattern.
 */
import { SimpleModal } from './lite/SimpleModal.js';
import { SimpleButton } from './lite/SimpleButton.js';
import { UI_THEME, UIThemeUtils } from './UITheme.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';

export class HighScoreModal {
    constructor(scene, gameStats, onSubmitCallback = null) {
        this.scene = scene;
        this.gameStats = gameStats;
        this.onSubmitCallback = onSubmitCallback;
        this.modal = null;
        this.playerName = '';
        this.inputDisplay = null;
        this.hasSubmitted = false;
        this._keyHandler = null;
        this._cursorTimer = null;
        this._cursorVisible = true;
    }

    /** Show name entry dialog */
    showEntry() {
        if (!this.scene?.scale) {
            DebugLogger.error('ui', '[HighScoreModal] Cannot show - invalid scene reference');
            return;
        }

        const cam = this.scene.cameras.main;
        const cx = cam.width / 2;
        const cy = cam.height / 2;

        this.modal = new SimpleModal(this.scene, {
            width: 420,
            height: 380,
            strokeColor: UI_THEME.colors.success,
            strokeAlpha: 1,
            overlayAlpha: 0.8
        });

        const font = (size, color = 'primary', opts = {}) =>
            UIThemeUtils.createFontConfig(size, color, { stroke: true, ...opts });

        // Title (constructor — Container owns rendering, no scene.add)
        this.titleText = new Phaser.GameObjects.Text(
            this.scene, cx, cy - 150, 'GRATULUJEME!\nTOP 10!', {
                ...font('large', 'success', { strokeThickness: 3 }),
                align: 'center'
            }).setOrigin(0.5);
        this.modal.addChild(this.titleText);

        // Stats
        const s = this.gameStats;
        const statsStr = [
            `Skore: ${s.score}`,
            `Uroven: ${s.level}`,
            `Nepratel: ${s.enemiesKilled}`,
            `Bossove: ${s.bossesDefeated || 0}`
        ].join('\n');

        this.statsText = new Phaser.GameObjects.Text(
            this.scene, cx, cy - 60, statsStr, {
                ...font('small', 'primary'),
                align: 'center', lineSpacing: 4
            }).setOrigin(0.5);
        this.modal.addChild(this.statsText);

        // Name prompt
        this.promptText = new Phaser.GameObjects.Text(
            this.scene, cx, cy + 20, 'Zadejte jmeno (max 8 znaku):', {
                ...font('small', 'secondary')
            }).setOrigin(0.5);
        this.modal.addChild(this.promptText);

        // Input field background (constructor — no scene.add)
        this.inputBg = new Phaser.GameObjects.Rectangle(
            this.scene, cx, cy + 60, 260, 44,
            UI_THEME.colors.background.panel, 0.95)
            .setStrokeStyle(2, UI_THEME.colors.borders.active, 0.8);
        this.modal.addChild(this.inputBg);

        // Input text display (constructor — no scene.add)
        this.inputDisplay = new Phaser.GameObjects.Text(
            this.scene, cx, cy + 60, '_', {
                ...font('normal', 'accent'),
                align: 'center'
            }).setOrigin(0.5);
        this.modal.addChild(this.inputDisplay);

        // Submit button (modal.addChild handles display-list — no scene.add needed)
        this.submitBtn = new SimpleButton(
            this.scene, cx, cy + 120, 'ODESLAT', () => this._submit(),
            180, 44, {
                bgColor: UI_THEME.colors.success,
                bgAlpha: 0.3,
                hoverColor: UI_THEME.colors.success,
                strokeColor: UI_THEME.colors.success,
                strokeAlpha: 0.6
            }
        );
        this.modal.addChild(this.submitBtn);

        // Instructions (constructor — no scene.add)
        this.instructionsText = new Phaser.GameObjects.Text(
            this.scene, cx, cy + 160,
            'ENTER = odeslat | prazdne = Anonym',
            UIThemeUtils.createFontConfig('tiny', 'secondary')
        ).setOrigin(0.5);
        this.modal.addChild(this.instructionsText);

        // Keyboard input
        this._setupKeyboard();

        // Ensure cleanup on scene shutdown
        this.scene.events.once('shutdown', () => this._cleanupInput(), this);

        // Blinking cursor
        this._cursorTimer = this.scene.time.addEvent({
            delay: 500, loop: true,
            callback: () => {
                this._cursorVisible = !this._cursorVisible;
                this._refreshInput();
            }
        });

        // Show with animation
        this.modal.show(true, 400);
    }

    /** Show result modal (placement) */
    showResult(position) {
        if (!this.scene?.scale) return;
        // Clean up input handlers before destroying modal
        this._cleanupInput?.();
        // Destroy previous modal to prevent leak
        if (this.modal) { this.modal.destroy(); this.modal = null; }

        const cam = this.scene.cameras.main;
        const cx = cam.width / 2;
        const cy = cam.height / 2;

        this.modal = new SimpleModal(this.scene, {
            width: 400,
            height: 260,
            strokeColor: UI_THEME.colors.success,
            strokeAlpha: 1,
            overlayAlpha: 0.8
        });

        const font = (size, color = 'primary', opts = {}) =>
            UIThemeUtils.createFontConfig(size, color, { stroke: true, ...opts });

        // Placement text (constructor — no scene.add)
        this.resultPlacement = new Phaser.GameObjects.Text(
            this.scene, cx, cy - 60,
            `Umisteni: ${position}. misto!`, {
                ...font('large', 'success', { strokeThickness: 3 }),
                align: 'center'
            }).setOrigin(0.5);
        this.modal.addChild(this.resultPlacement);

        // Score text (constructor — no scene.add)
        this.resultScore = new Phaser.GameObjects.Text(
            this.scene, cx, cy, `Skore: ${this.gameStats.score}`, {
                ...font('normal', 'primary'), align: 'center'
            }).setOrigin(0.5);
        this.modal.addChild(this.resultScore);

        // Instructions (constructor — no scene.add)
        this.resultInstructions = new Phaser.GameObjects.Text(
            this.scene, cx, cy + 60, 'R - Restart | ESC - Menu',
            UIThemeUtils.createFontConfig('small', 'secondary')
        ).setOrigin(0.5);
        this.modal.addChild(this.resultInstructions);

        this.modal.show(true, 400);
    }

    // --- Private ---

    _setupKeyboard() {
        this._keyHandler = (event) => {
            if (this.hasSubmitted) return;

            if (event.key === 'Enter') {
                this._submit();
            } else if (event.key === 'Backspace') {
                event.preventDefault();
                if (this.playerName.length > 0) {
                    this.playerName = this.playerName.slice(0, -1);
                    this._refreshInput();
                }
            } else if (event.key.length === 1 && this.playerName.length < 8) {
                if (/[a-zA-Z0-9]/.test(event.key)) {
                    this.playerName += event.key;
                    this._refreshInput();
                }
            }
        };
        this.scene.input.keyboard.on('keydown', this._keyHandler);
    }

    _refreshInput() {
        if (!this.inputDisplay) return;
        const cursor = this._cursorVisible ? '_' : '';
        this.inputDisplay.setText(this.playerName + cursor);
    }

    _submit() {
        if (this.hasSubmitted) return;
        this.hasSubmitted = true;
        this._cleanupInput();
        if (this.onSubmitCallback) {
            this.onSubmitCallback(this.playerName.trim());
        }
    }

    _cleanupInput() {
        if (this._keyHandler && this.scene?.input?.keyboard) {
            this.scene.input.keyboard.off('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this._cursorTimer) {
            this._cursorTimer.destroy();
            this._cursorTimer = null;
        }
    }

    destroy() {
        this._cleanupInput();
        this.onSubmitCallback = null;
        if (this.modal) {
            this.modal.destroy();
            this.modal = null;
        }
        this.inputDisplay = null;
        this.titleText = null;
        this.statsText = null;
        this.promptText = null;
        this.inputBg = null;
        this.submitBtn = null;
        this.instructionsText = null;
        this.resultPlacement = null;
        this.resultScore = null;
        this.resultInstructions = null;
    }
}

