/**
 * HighScoreModal - Pure Phaser LiteUI high score dialog
 * Pure Phaser implementation using SimpleModal + SimpleButton pattern.
 */
import { SimpleModal } from './lite/SimpleModal.js';
import { SimpleButton } from './lite/SimpleButton.js';
import { UI_THEME, UIThemeUtils } from './UITheme.js';

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
            console.error('[HighScoreModal] Cannot show - invalid scene reference');
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

        // Title
        this.modal.addChild(
            this.scene.add.text(cx, cy - 150, 'GRATULUJEME!\nTOP 10!', {
                ...font('large', 'success', { strokeThickness: 3 }),
                align: 'center'
            }).setOrigin(0.5)
        );

        // Stats
        const s = this.gameStats;
        const statsStr = [
            `Skore: ${s.score}`,
            `Uroven: ${s.level}`,
            `Nepratel: ${s.enemiesKilled}`,
            `Bossove: ${s.bossesDefeated || 0}`
        ].join('\n');

        this.modal.addChild(
            this.scene.add.text(cx, cy - 60, statsStr, {
                ...font('small', 'primary'),
                align: 'center', lineSpacing: 4
            }).setOrigin(0.5)
        );

        // Name prompt
        this.modal.addChild(
            this.scene.add.text(cx, cy + 20, 'Zadejte jmeno (max 8 znaku):', {
                ...font('small', 'secondary')
            }).setOrigin(0.5)
        );

        // Input field background
        this.modal.addChild(
            this.scene.add.rectangle(cx, cy + 60, 260, 44,
                UI_THEME.colors.background.panel, 0.95)
                .setStrokeStyle(2, UI_THEME.colors.borders.active, 0.8)
        );

        // Input text display
        this.inputDisplay = this.scene.add.text(cx, cy + 60, '_', {
            ...font('normal', 'accent'),
            align: 'center'
        }).setOrigin(0.5);
        this.modal.addChild(this.inputDisplay);

        // Submit button
        const submitBtn = new SimpleButton(
            this.scene, cx, cy + 120, 'ODESLAT', () => this._submit(),
            180, 44, {
                bgColor: UI_THEME.colors.success,
                bgAlpha: 0.3,
                hoverColor: UI_THEME.colors.success,
                strokeColor: UI_THEME.colors.success,
                strokeAlpha: 0.6
            }
        );
        this.modal.addChild(submitBtn);

        // Instructions
        this.modal.addChild(
            this.scene.add.text(cx, cy + 160,
                'ENTER = odeslat | prazdne = Anonym',
                UIThemeUtils.createFontConfig('tiny', 'secondary')
            ).setOrigin(0.5)
        );

        // Keyboard input
        this._setupKeyboard();

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

        this.modal.addChild(
            this.scene.add.text(cx, cy - 60,
                `Umisteni: ${position}. misto!`, {
                ...font('large', 'success', { strokeThickness: 3 }),
                align: 'center'
            }).setOrigin(0.5)
        );

        this.modal.addChild(
            this.scene.add.text(cx, cy, `Skore: ${this.gameStats.score}`, {
                ...font('normal', 'primary'), align: 'center'
            }).setOrigin(0.5)
        );

        this.modal.addChild(
            this.scene.add.text(cx, cy + 60, 'R - Restart | ESC - Menu',
                UIThemeUtils.createFontConfig('small', 'secondary')
            ).setOrigin(0.5)
        );

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
    }
}

export default HighScoreModal;
