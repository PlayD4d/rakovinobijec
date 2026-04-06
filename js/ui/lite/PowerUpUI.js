/**
 * PowerUpUI - Level-up power-up selection modal
 * Clean card-based design, no emoji, consistent with game UI theme
 */
import { SimpleModal } from './SimpleModal.js';
import { UI_THEME } from '../UITheme.js';

export class PowerUpUI {
  constructor(scene, onSelection) {
    this.scene = scene;
    this.onSelection = onSelection;
    this.modal = new SimpleModal(scene, {
      width: 960,
      height: 500,
      depth: UI_THEME.depth.modal,
      overlayColor: 0x000000,
      overlayAlpha: 0.85,
      panelColor: 0x0a0a1e,
      panelAlpha: 0.95,
      strokeColor: 0x334466,
      strokeAlpha: 0.8
    });

    const cx = scene.cameras.main.width / 2;
    const cy = scene.cameras.main.height / 2;

    // Title — clean, no emoji
    this.title = new Phaser.GameObjects.Text(scene, cx, cy - 190, 'LEVEL UP', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '28px',
      color: '#00ffcc',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    this.modal.addChild(this.title);

    // Subtitle
    this.subtitle = new Phaser.GameObjects.Text(scene, cx, cy - 150, 'Choose an upgrade:', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '14px',
      color: '#999999'
    }).setOrigin(0.5);
    this.modal.addChild(this.subtitle);

    this.cards = [];

    // Hint text
    this.hint = new Phaser.GameObjects.Text(scene, cx, cy + 190, 'Click a card to select', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '11px',
      color: '#666666'
    }).setOrigin(0.5);

    this.hintTween = scene.tweens.add({
      targets: this.hint,
      alpha: 0.4, duration: 800,
      yoyo: true, repeat: -1, paused: true
    });

    this.modal.addChild(this.hint);
  }

  show(powerUps, onPick) {
    this._selecting = false;
    const callback = onPick || this.onSelection;

    // Clear old cards
    this.cards.forEach(card => card.destroy());
    this.cards = [];

    const cx = this.scene.cameras.main.width / 2;
    const cy = this.scene.cameras.main.height / 2;
    const cardWidth = 260;
    const cardHeight = 280;
    const spacing = cardWidth + 30;
    const startX = cx - ((powerUps.length - 1) * spacing) / 2;

    powerUps.forEach((pu, index) => {
      const x = startX + index * spacing;
      const y = cy + 15;
      const s = this.scene;
      const card = new Phaser.GameObjects.Container(s, x, y);
      const slotColor = (pu.slot === 'passive') ? 0x4488cc : 0xcc8844; // blue=passive, orange=weapon

      // Card background
      const bg = new Phaser.GameObjects.Rectangle(s, 0, 0, cardWidth, cardHeight, 0x0f0f2a, 0.95)
        .setStrokeStyle(2, 0x222244, 0.8);

      // Slot-type accent line at top (weapon=orange, passive=blue)
      const accentLine = new Phaser.GameObjects.Rectangle(s, 0, -cardHeight / 2 + 3, cardWidth - 4, 3, slotColor, 0.9);

      // Slot type badge (top-left) — weapon vs passive
      const isPassive = pu.slot === 'passive';
      const slotLabel = isPassive ? 'PASSIVE' : 'WEAPON';
      const slotColor = isPassive ? '#66bb6a' : '#42a5f5';
      const slotBadge = new Phaser.GameObjects.Text(s, -cardWidth / 2 + 10, -cardHeight / 2 + 10, slotLabel, {
        fontFamily: UI_THEME.fonts.primary, fontSize: '8px', color: slotColor,
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0, 0);

      // Level badge (top-right)
      const isOverflow = pu._overflow || pu.maxLevel === 0;
      const nextLevel = (pu.level || 0) + 1;
      const maxLevel = pu.maxLevel || 5;
      const lvlLabel = isOverflow ? 'BOOST' : (nextLevel > 1 ? `Lv.${nextLevel}/${maxLevel}` : 'NEW');
      const lvlColor = isOverflow ? '#ff8844' : (nextLevel > 1 ? '#ffcc00' : '#44ff44');
      const lvlBadge = new Phaser.GameObjects.Text(s, cardWidth / 2 - 10, -cardHeight / 2 + 10, lvlLabel, {
        fontFamily: UI_THEME.fonts.primary, fontSize: '10px', color: lvlColor,
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(1, 0);

      // Power-up name
      const name = new Phaser.GameObjects.Text(s, 0, -80, pu.name || 'Power-up', {
        fontFamily: UI_THEME.fonts.primary, fontSize: '16px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 2,
        wordWrap: { width: cardWidth - 20 }, align: 'center'
      }).setOrigin(0.5);

      // Separator line
      const sep = new Phaser.GameObjects.Rectangle(s, 0, -50, cardWidth - 40, 1, 0x334466, 0.5);

      // Description
      const desc = new Phaser.GameObjects.Text(s, 0, -10, pu.description || '', {
        fontFamily: UI_THEME.fonts.primary, fontSize: '11px', color: '#aaaaaa',
        align: 'center', wordWrap: { width: cardWidth - 24 }, lineSpacing: 4
      }).setOrigin(0.5);

      // Stats line (bottom) — word-wrapped to stay inside card
      const stats = new Phaser.GameObjects.Text(s, 0, 60, pu.stats || '', {
        fontFamily: UI_THEME.fonts.primary, fontSize: '10px', color: '#00ffcc',
        stroke: '#000000', strokeThickness: 2,
        wordWrap: { width: cardWidth - 20 }, align: 'center', lineSpacing: 2
      }).setOrigin(0.5);

      card.add([bg, accentLine, slotBadge, lvlBadge, name, sep, desc, stats]);
      card._bg = bg;
      card._accentLine = accentLine;

      // Interaction
      bg.setInteractive()
        .on('pointerover', () => {
          card.setScale(1.05);
          bg.setStrokeStyle(2, slotColor, 0.9);
          if (s.input?.setDefaultCursor) s.input.setDefaultCursor('pointer');
          try { s.scene?.get('GameScene')?.audioSystem?.play('sound/bleep.mp3', { volume: 0.2 }); } catch (_) {}
        })
        .on('pointerout', () => {
          card.setScale(1.0);
          bg.setStrokeStyle(2, 0x222244, 0.8);
          if (s.input?.setDefaultCursor) s.input.setDefaultCursor('default');
        })
        .on('pointerdown', () => {
          card.setScale(0.98);
        })
        .on('pointerup', () => {
          if (this._selecting) return;
          this._selecting = true;
          card.setScale(1.05);
          bg.setFillStyle(0x1a1a3e, 1);
          try { s.scene?.get('GameScene')?.audioSystem?.play('sound/pickup.mp3', { volume: 0.4 }); } catch (_) {}

          s.tweens.add({
            targets: accentLine, alpha: 0, duration: 80, yoyo: true, repeat: 1,
            onComplete: () => {
              this.hide(() => { if (callback) callback(pu); });
            }
          });
        });

      this.modal.addChild(card);
      this.cards.push(card);
    });

    if (this.hintTween) {
      this.hint.alpha = 1;
      this.hintTween.resume();
    }

    this.modal.show(true, 250);
  }

  hide(onComplete) {
    if (this.hintTween) this.hintTween.pause();
    if (this.cards) this.cards.forEach(c => { if (c._bg?.disableInteractive) c._bg.disableInteractive(); });
    this.modal.hide(false, 0, () => {
      this._selecting = false;
      if (onComplete) onComplete();
    });
  }

  // Rarity colors removed — equal-weight selection means rarity labels mislead players

  destroy() {
    // Stop tween BEFORE destroying modal (modal.destroy() destroys hint child first,
    // and stopping a tween on a destroyed target throws in Phaser 3.90)
    if (this.hintTween) {
      try { this.hintTween.stop(); } catch (_) {}
      this.hintTween = null;
    }
    this.cards.forEach(card => card?.destroy());
    this.cards = [];
    this.modal?.destroy();
  }
}
