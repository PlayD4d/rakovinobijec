/**
 * PowerUpUI - Level-up power-up selection modal
 * Zobrazuje 3 karty s power-upy k výběru
 * UITheme integrace pro konzistentní styling
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
    
    // Title with glow effect
    this.title = scene.add.text(cx, cy - 220, '🎉 LEVEL UP! 🎉', {
      fontFamily: 'Arial Black',
      fontSize: '42px',
      color: '#00ffff',
      stroke: '#004444',
      strokeThickness: 4
    }).setOrigin(0.5);
    
    // Add glow effect
    this.title.setPipeline('Light2D');
    this.modal.addChild(this.title);
    
    // Subtitle with better styling
    this.subtitle = scene.add.text(cx, cy - 160, '🔬 Vyber vylepšení pro Marda:', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.modal.addChild(this.subtitle);
    
    // Cards array for cleanup
    this.cards = [];
    
    // Hint text with animation
    this.hint = scene.add.text(cx, cy + 200, '👆 Klikni na kartu pro výběr', {
      fontSize: '16px',
      color: '#888888',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(0.5);
    
    // Add blinking animation
    scene.tweens.add({
      targets: this.hint,
      alpha: 0.5,
      duration: 800,
      yoyo: true,
      repeat: -1
    });
    
    this.modal.addChild(this.hint);
  }
  
  /**
   * Show power-up selection with 3 options
   */
  show(powerUps, onPick) {
    console.log('[PowerUpUI] show() called with:', powerUps, 'callback:', !!onPick || !!this.onSelection);
    
    // Use provided callback or stored one
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
      
      // Card container
      const card = this.scene.add.container(x, y);
      
      // Card dimensions
      const cardWidth = 280;
      const cardHeight = 220;
      
      // Background gradient (simulated with overlapping rectangles)
      const bgDark = this.scene.add.rectangle(0, 0, cardWidth, cardHeight, 0x1a1a2e, 0.95)
        .setStrokeStyle(2, 0x16213e, 0.8);
      
      const bgGradient = this.scene.add.rectangle(0, -cardHeight/4, cardWidth-4, cardHeight/2, 0x0f3460, 0.3);
      
      // Rarity border (thicker, glowing)
      const rarityColor = this.getRarityColor(pu.rarity || 'common');
      const border = this.scene.add.rectangle(0, 0, cardWidth+4, cardHeight+4, rarityColor, 0.0)
        .setStrokeStyle(3, rarityColor, 0.8);
      
      // Icon with background circle
      const iconBg = this.scene.add.circle(0, -70, 32, rarityColor, 0.2)
        .setStrokeStyle(2, rarityColor, 0.6);
      
      const icon = this.scene.add.text(0, -70, pu.icon || '⚡', {
        fontSize: '42px'
      }).setOrigin(0.5);
      
      // Name with better typography
      const name = this.scene.add.text(0, -20, pu.name || 'Power-up', {
        fontFamily: 'Arial Black',
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: { width: 260 },
        align: 'center'
      }).setOrigin(0.5);
      
      // Description with better formatting
      const desc = this.scene.add.text(0, 25, pu.description || '', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#bbbbbb',
        align: 'center',
        wordWrap: { width: 250 },
        lineSpacing: 2
      }).setOrigin(0.5);
      
      // Stats with better styling
      const stats = this.scene.add.text(0, 80, pu.stats || '', {
        fontFamily: 'Courier New',
        fontSize: '14px',
        color: rarityColor,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 1
      }).setOrigin(0.5);
      
      // Add all elements to card (order matters for layering)
      card.add([border, bgDark, bgGradient, iconBg, icon, name, desc, stats]);
      
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
          // Click release - select power-up
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
    
    // Show modal without animation (we're paused)
    console.log('[PowerUpUI] Showing modal with', this.cards.length, 'cards');
    this.modal.show(false);
  }
  
  /**
   * Hide modal
   */
  hide(onComplete) {
    this.modal.hide(false, 0, onComplete);
  }
  
  /**
   * Get localized power-up name
   */
  getPowerUpDisplayName(id) {
    const names = {
      'powerup.damage_boost': '🗡️ Posilující injekce',
      'powerup.shield': '🛡️ Buněčná bariéra', 
      'powerup.speed_boost': '⚡ Metabolický spěch',
      'powerup.health_regen': '❤️ Regenerace tkáně',
      'powerup.piercing_arrows': '🏹 Průbojné šípy',
      'powerup.flamethrower': '🔥 Plamenomet',
      'powerup.metabolic_haste': '💨 Rychlost metabolismu',
      'powerup.chemo_reservoir': '💉 Chemoterapie',
      'powerup.radiotherapy': '☢️ Radioterapie',
      'powerup.xp_magnet': '🧲 XP magnet'
    };
    return names[id] || 'Neznámý power-up';
  }
  
  /**
   * Get power-up description
   */
  getPowerUpDescription(id) {
    const descriptions = {
      'powerup.damage_boost': 'Zvyšuje poškození všech útoků',
      'powerup.shield': 'Poskytuje dočasnou ochranu před zásahy',
      'powerup.speed_boost': 'Zvyšuje rychlost pohybu a útoku',
      'powerup.health_regen': 'Postupně obnovuje zdraví',
      'powerup.piercing_arrows': 'Projektily pronikají skrze nepřátele',
      'powerup.flamethrower': 'Přidává plamenný efekt k útokům',
      'powerup.metabolic_haste': 'Zrychluje všechny procesy organismu',
      'powerup.chemo_reservoir': 'Pravidelně aplikuje chemoterapii',
      'powerup.radiotherapy': 'Silný radiační útok v okolí',
      'powerup.xp_magnet': 'Přitahuje XP orby z větší vzdálenosti'
    };
    return descriptions[id] || 'Popis není dostupný';
  }
  
  /**
   * Get power-up effect description
   */
  getPowerUpEffect(id) {
    const effects = {
      'powerup.damage_boost': '+25% poškození\nTrvání: 30s',
      'powerup.shield': '+50 shield bodů\nTrvání: 45s',
      'powerup.speed_boost': '+20% rychlost\nTrvání: 25s',
      'powerup.health_regen': '+2 HP/s\nTrvání: 60s',
      'powerup.piercing_arrows': 'Průstřel +2\nTrvání: 40s',
      'powerup.flamethrower': 'Oheň 10 DMG/s\nTrvání: 35s',
      'powerup.metabolic_haste': '+30% rychlost\n+15% útok',
      'powerup.chemo_reservoir': '5 DMG/s okolí\nTrvání: 90s',
      'powerup.radiotherapy': 'AoE 20 DMG\nCooldown: 8s',
      'powerup.xp_magnet': 'Dosah +150px\nTrvání: ∞'
    };
    return effects[id] || 'Efekt neznámý';
  }
  
  /**
   * Get max level for power-up
   */
  getPowerUpMaxLevel(id) {
    // Most power-ups have 3 levels
    const maxLevels = {
      'powerup.damage_boost': 5,
      'powerup.shield': 3,
      'powerup.speed_boost': 4,
      'powerup.health_regen': 3,
      'powerup.piercing_arrows': 4,
      'powerup.flamethrower': 3,
      'powerup.metabolic_haste': 3,
      'powerup.chemo_reservoir': 2,
      'powerup.radiotherapy': 3,
      'powerup.xp_magnet': 1
    };
    return maxLevels[id] || 3;
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
    this.cards.forEach(card => card?.destroy());
    this.cards = [];
    this.modal?.destroy();
  }
}