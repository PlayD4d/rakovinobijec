/**
 * PowerUpUI - Level-up power-up selection modal
 * Displays 3 power-up cards for selection
 * UITheme integration for consistent styling
 */
import { SimpleModal } from './SimpleModal.js';
import { UI_THEME } from '../UITheme.js';

export class PowerUpUI {
  constructor(scene, onSelection) {
    this.scene = scene;
    this.onSelection = onSelection; // Store callback for later use
    this.modal = new SimpleModal(scene, { 
      width: 1000, 
      height: 600, 
      depth: UI_THEME.depth.modal,
      bgColor: UI_THEME.colors.background.modal,
      bgAlpha: 0.98
    });
    
    const cx = scene.cameras.main.width / 2;
    const cy = scene.cameras.main.height / 2;
    
    // Title with glow effect (constructor — Container owns rendering, no scene.add)
    this.title = new Phaser.GameObjects.Text(scene, cx, cy - 220, '🎉 LEVEL UP! 🎉', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '42px',
      color: `#${UI_THEME.colors.text.accent.toString(16).padStart(6, '0')}`,
      stroke: '#004444',
      strokeThickness: 4
    }).setOrigin(0.5);
    this.modal.addChild(this.title);

    // Subtitle with better styling (constructor — no scene.add)
    this.subtitle = new Phaser.GameObjects.Text(scene, cx, cy - 160, '🔬 Vyber vylepšení pro Marda:', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '22px',
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.modal.addChild(this.subtitle);

    // Cards array for cleanup
    this.cards = [];

    // Hint text with animation (constructor — no scene.add)
    this.hint = new Phaser.GameObjects.Text(scene, cx, cy + 200, '👆 Klikni na kartu pro výběr', {
      fontFamily: UI_THEME.fonts.primary,
      fontSize: '16px',
      color: '#888888',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(0.5);
    
    // Blinking animation — created paused, started only on show()
    this.hintTween = scene.tweens.add({
      targets: this.hint,
      alpha: 0.5,
      duration: 800,
      yoyo: true,
      repeat: -1,
      paused: true
    });

    this.modal.addChild(this.hint);
  }
  
  /**
   * Show power-up selection with 3 options
   */
  show(powerUps, onPick) {
    this._selecting = false; // Reset guard from previous cycle
    const callback = onPick || this.onSelection;

    // Clear old cards
    this.cards.forEach(card => card.destroy());
    this.cards = [];
    
    const cx = this.scene.cameras.main.width / 2;
    const cy = this.scene.cameras.main.height / 2;
    const spacing = 320;
    const startX = cx - ((powerUps.length - 1) * spacing) / 2;
    
    // Create cards for each power-up
    powerUps.forEach((pu, index) => {
      const x = startX + index * spacing;
      const y = cy + 20;
      
      // Card container (constructor — no scene.add to avoid double display-list)
      const s = this.scene;
      const card = new Phaser.GameObjects.Container(s, x, y);

      const cardWidth = 280;
      const cardHeight = 220;
      const rarityColor = this.getRarityColor(pu.rarity || 'common');

      // All children via constructors (Container owns rendering exclusively)
      const bgDark = new Phaser.GameObjects.Rectangle(s, 0, 0, cardWidth, cardHeight, UI_THEME.colors.background.modal, 0.95)
        .setStrokeStyle(2, 0x16213e, 0.8);
      const bgGradient = new Phaser.GameObjects.Rectangle(s, 0, -cardHeight/4, cardWidth-4, cardHeight/2, 0x0f3460, 0.3);
      const border = new Phaser.GameObjects.Rectangle(s, 0, 0, cardWidth+4, cardHeight+4, rarityColor, 0.0)
        .setStrokeStyle(3, rarityColor, 0.8);
      const iconBg = new Phaser.GameObjects.Arc(s, 0, -70, 32, 0, 360, false, rarityColor, 0.2)
        .setStrokeStyle(2, rarityColor, 0.6);
      const icon = new Phaser.GameObjects.Text(s, 0, -70, pu.icon || '⚡', { fontSize: '42px' }).setOrigin(0.5);
      const cPrimary = `#${UI_THEME.colors.text.primary.toString(16).padStart(6, '0')}`;
      const cSecondary = `#${UI_THEME.colors.text.secondary.toString(16).padStart(6, '0')}`;
      const name = new Phaser.GameObjects.Text(s, 0, -20, pu.name || 'Power-up', {
        fontFamily: UI_THEME.fonts.primary, fontSize: '18px', color: cPrimary,
        stroke: '#000000', strokeThickness: 2, wordWrap: { width: 260 }, align: 'center'
      }).setOrigin(0.5);
      const desc = new Phaser.GameObjects.Text(s, 0, 25, pu.description || '', {
        fontFamily: UI_THEME.fonts.primary, fontSize: '13px', color: cSecondary,
        align: 'center', wordWrap: { width: 250 }, lineSpacing: 2
      }).setOrigin(0.5);
      const stats = new Phaser.GameObjects.Text(s, 0, 80, pu.stats || '', {
        fontFamily: UI_THEME.fonts.primary, fontSize: '14px', color: cPrimary,
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5);

      card.add([border, bgDark, bgGradient, iconBg, icon, name, desc, stats]);
      card._bg = bgDark;
      
      // Make interactive with improved hover effects
      bgDark.setInteractive()
        .on('pointerover', () => {
          // Hover effects
          card.setScale(1.08);
          border.setStrokeStyle(4, rarityColor, 1.0);
          bgGradient.setAlpha(0.5);
          iconBg.setAlpha(0.4);
          
          // Cursor
          if (this.scene.input?.setDefaultCursor) {
            this.scene.input.setDefaultCursor('pointer');
          }
          
          // Hover sound effect
          if (this.scene.sound) {
            // this.scene.sound.play('ui_hover', { volume: 0.3 });
          }
        })
        .on('pointerout', () => {
          // Reset hover effects
          card.setScale(1.0);
          border.setStrokeStyle(3, rarityColor, 0.8);
          bgGradient.setAlpha(0.3);
          iconBg.setAlpha(0.2);
          
          // Cursor
          if (this.scene.input?.setDefaultCursor) {
            this.scene.input.setDefaultCursor('default');
          }
        })
        .on('pointerdown', () => {
          // Click down effect
          card.setScale(1.02);
          bgDark.setFillStyle(0xdddddd, 0.8);
        })
        .on('pointerup', () => {
          // Guard against double-click (callback fires twice otherwise)
          if (this._selecting) return;
          this._selecting = true;

          card.setScale(1.08);
          bgDark.setFillStyle(0xffffff, 0.9);
          
          // Selection sound
          if (this.scene.sound) {
            // this.scene.sound.play('ui_select', { volume: 0.5 });
          }
          
          // Flash effect
          this.scene.tweens.add({
            targets: border,
            alpha: 1,
            duration: 100,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
              // Select this power-up after animation
              this.hide(() => {
                if (callback) callback(pu);
              });
            }
          });
        });
      
      // Add card to modal
      this.modal.addChild(card);
      this.cards.push(card);
    });
    
    // Resume hint animation
    if (this.hintTween) {
      this.hint.alpha = 1;
      this.hintTween.resume();
    }

    this.modal.show(false);
  }
  
  /**
   * Hide modal
   */
  hide(onComplete) {
    if (this.hintTween) this.hintTween.pause();
    if (this.cards) this.cards.forEach(c => { if (c._bg?.disableInteractive) c._bg.disableInteractive(); });
    this.modal.hide(false, 0, () => {
        this._selecting = false;
        if (onComplete) onComplete();
    });
  }
  
  /**
   * Get color based on power-up rarity
   */
  getRarityColor(rarity) {
    switch (rarity?.toLowerCase()) {
      case 'legendary': return 0xff6b35; // Orange
      case 'epic': return 0x9c27b0;      // Purple
      case 'rare': return 0x2196f3;      // Blue
      case 'uncommon': return 0x4caf50;  // Green
      case 'common':
      default: return 0x9e9e9e;          // Gray
    }
  }
  
  /**
   * Clean destroy
   */
  destroy() {
    // Stop the infinite tween first (try/catch: scene may be mid-teardown)
    if (this.hintTween) {
      try { this.hintTween.stop(); } catch (_) {}
      this.hintTween = null;
    }
    
    this.cards.forEach(card => card?.destroy());
    this.cards = [];
    this.modal?.destroy();
  }
}