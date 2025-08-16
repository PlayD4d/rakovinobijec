// LootSystem – pooled správa XP/health/special lootů a magnet efektu
// Fáze 2: proxy kompatibilní se stávajícím LootManager API

// PR7: 100% data-driven - using ConfigResolver and BlueprintLoader only
import { DropEffects } from '../drops/effects.js';
import { ShapeRenderer } from '../utils/ShapeRenderer.js';

export class LootSystem {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.loot = scene.physics.add.group();
    
    // PR7: Get values from ConfigResolver
    const cr = scene.configResolver || window.ConfigResolver;
    this.magnetRange = cr?.get('loot.xp.magnetRange', { defaultValue: 50 }) || 50;
    this.magnetLevel = 0;
    this.suppressSpecialDrops = false;
    
    // PERFORMANCE OPTIMIZATION: Object pooling pro loot
    this.xpOrbPool = [];
    this.healthOrbPool = [];
    this.metotrexatPool = [];
    this.poolSize = 50; // Max pooled loot objects
    
    // Registruj defaultní dropy (idempotentně)
    this._registerDefaultDrops();
  }
  
  /**
   * OBJECT POOLING: Return loot object to appropriate pool
   */
  _returnLootToPool(lootObject) {
    // Determine pool based on loot type
    let targetPool;
    switch (lootObject.type) {
      case 'xp':
        targetPool = this.xpOrbPool;
        break;
      case 'health':
        targetPool = this.healthOrbPool;
        break;
      case 'metotrexat':
        targetPool = this.metotrexatPool;
        break;
      default:
        // Unknown type, just destroy
        lootObject.destroy();
        return;
    }
    
    if (targetPool.length < this.poolSize) {
      // Reset object state
      lootObject.setVisible(false);
      lootObject.setActive(false);
      lootObject.body?.setEnable(false);
      this.loot.remove(lootObject, false, false); // Don't destroy
      
      // Stop any tweens
      if (lootObject._tween) {
        lootObject._tween.stop();
        lootObject._tween = null;
      }
      
      targetPool.push(lootObject);
    } else {
      // Pool is full, destroy
      lootObject.destroy();
    }
  }

  // NEW: Process drops from the new loot system
  processDrops(x, y, drops) {
    if (!drops || drops.length === 0) return;
    
    for (const drop of drops) {
      const itemBlueprint = this.scene.blueprintLoader?.get(drop.itemId) || window.BlueprintLoader?.get(drop.itemId);
      if (!itemBlueprint) {
        console.warn(`[LootSystem] Item blueprint not found: ${drop.itemId}`);
        continue;
      }
      
      const quantity = drop.quantity || 1;
      for (let i = 0; i < quantity; i++) {
        this.createItemDrop(x, y, itemBlueprint);
      }
    }
  }
  
  // NEW: Create a drop from an item blueprint
  createItemDrop(x, y, itemBlueprint) {
    if (!itemBlueprint) return;
    
    // Spread drops around the position
    const spread = 20;
    const offsetX = (Math.random() - 0.5) * spread;
    const offsetY = (Math.random() - 0.5) * spread;
    const dropX = x + offsetX;
    const dropY = y + offsetY;
    
    // Route to appropriate creation method based on item type
    switch (itemBlueprint.category) {
      case 'xp':
        // Extract XP value from item effect
        const xpValue = itemBlueprint.effect?.value || 5;
        this.createXPOrb(dropX, dropY, xpValue);
        break;
        
      case 'health':
        if (itemBlueprint.effect?.value === 'full') {
          // Create protein cache (full heal)
          this.createProteinCache(dropX, dropY);
        } else {
          // Create regular health orb
          this.createHealthOrb(dropX, dropY);
        }
        break;
        
      case 'special':
        if (itemBlueprint.id === 'item.metotrexat') {
          this.createMetotrexat(dropX, dropY);
        } else if (itemBlueprint.id === 'item.energy_cell') {
          this.createEnergyCell(dropX, dropY);
        } else if (itemBlueprint.id === 'item.research_point') {
          this.createResearchPoint(dropX, dropY);
        }
        break;
        
      default:
        console.warn(`[LootSystem] Unknown item category: ${itemBlueprint.category}`);
    }
  }
  
  // NEW: Create protein cache (full heal)
  createProteinCache(x, y) {
    // For now, create a special health orb
    const sprite = this.createHealthOrb(x, y);
    if (sprite) {
      sprite.healAmount = 999; // Full heal
      sprite.setScale(1.5); // Make it bigger
      sprite.setTint(0xFF4500); // Orange tint
    }
    return sprite;
  }
  
  // NEW: Create energy cell
  createEnergyCell(x, y) {
    // Similar to XP orb but with different color and effect
    const sprite = this.createXPOrb(x, y, 0);
    if (sprite) {
      sprite.type = 'energy';
      sprite.setTint(0xFFD700); // Gold color
    }
    return sprite;
  }
  
  // NEW: Create research point
  createResearchPoint(x, y) {
    // Similar to XP orb but with different color and effect
    const sprite = this.createXPOrb(x, y, 0);
    if (sprite) {
      sprite.type = 'research';
      sprite.setTint(0x00CED1); // Dark turquoise
      sprite.setScale(1.2);
    }
    return sprite;
  }
  
  dropLoot(x, y, enemy) {
    if (!enemy) return;
    
    // NEW: Use LootDropManager to get drops from enemy blueprint
    if (window.LootDropManager && this.scene.lootDropManager) {
      const drops = this.scene.lootDropManager.getDropsForEnemy(enemy);
      this.processDrops(x, y, drops);
      return;
    }
    
    // LEGACY: Fallback to old system
    let xpValue = enemy.xp || 0;
    // Pokud běží Core a existuje blueprint nepřítele, přečíst LootDrop.xp/healthChance
    try {
      // Načíst loot data z blueprintů
      if (enemy.type) {
        const map = { red: 'basic_cell', orange: 'orange_tumor', green: 'green_heavy', purple: 'purple_support', brown: 'brown_shooter' };
        const bp = this.scene.blueprintLoader?.get(map[enemy.type] || enemy.type);
        if (bp?.components?.LootDrop) {
          const ld = bp.components.LootDrop;
          xpValue = Number(ld.xp ?? xpValue);
          this._healthChanceOverride = typeof ld.healthChance === 'number' ? ld.healthChance : undefined;
        }
      }
    } catch (_) {}
    if (xpValue > 0) this.createOptimalXPOrbs(x, y, xpValue);

    // Health orb šance (dynamická dle levelu hráče)
    const currentDropChance = this.calculateHealthDropChance();
    if (Math.random() < currentDropChance) {
      this.createHealthOrb(x, y);
    }

    // Speciální dropy z registru (váhový výběr)
    if (!this.suppressSpecialDrops) {
      const drop = this._pickSpecialDrop();
      if (drop) this._createDropFromBlueprint(x, y, drop);
    }
  }

  calculateHealthDropChance() {
    const cr = this.scene.configResolver || window.ConfigResolver;
    const baseDropChance = (typeof this._healthChanceOverride === 'number') ? 
      this._healthChanceOverride : 
      (cr?.get('loot.health.dropChance', { defaultValue: 0.15 }) || 0.15);
    const playerLevel = this.scene.gameStats?.level || 1;
    
    // PR7: Health drop chance scaling with ConfigResolver
    const levelStepSize = cr?.get('loot.health.levelStepSize', { defaultValue: 5 }) || 5;
    const chanceReduction = cr?.get('loot.health.chanceReduction', { defaultValue: 0.9 }) || 0.9;
    const minChance = cr?.get('loot.health.minChance', { defaultValue: 0.01 }) || 0.01;
    
    const reductionSteps = Math.floor(playerLevel / levelStepSize);
    let currentChance = baseDropChance;
    for (let i = 0; i < reductionSteps; i++) currentChance *= chanceReduction;
    return Math.max(minChance, currentChance);
  }

  createOptimalXPOrbs(x, y, totalXP) {
    // PR7: Use blueprint-based tier system (1, 5, 10 XP)
    const xpTiers = [
      { value: 10, color: 0x00E8FC, size: 1.2, tier: 'large' },
      { value: 5, color: 0x00E8FC, size: 1.0, tier: 'medium' },
      { value: 1, color: 0x00E8FC, size: 0.8, tier: 'small' }
    ];
    
    // Try to load colors from blueprints if available
    if (this.scene.blueprintLoader) {
      for (const tier of xpTiers) {
        const blueprint = this.scene.blueprintLoader.get(`drop.xp_${tier.tier}`);
        if (blueprint?.display?.color) {
          tier.color = blueprint.display.color;
        }
      }
    }
    let remainingXP = totalXP;
    const orbs = [];
    for (const tier of xpTiers) {
      while (remainingXP >= tier.value) {
        orbs.push(tier);
        remainingXP -= tier.value;
      }
    }
    orbs.forEach(() => {
      // PR7: XP orb spread with ConfigResolver
      const cr = this.scene.configResolver || window.ConfigResolver;
      const maxSpread = cr?.get('loot.xp.maxSpread', { defaultValue: 40 }) || 40;
      const spreadPerOrb = cr?.get('loot.xp.spreadPerOrb', { defaultValue: 8 }) || 8;
      
      const offsetX = (Math.random() - 0.5) * Math.min(maxSpread, orbs.length * spreadPerOrb);
      const offsetY = (Math.random() - 0.5) * Math.min(maxSpread, orbs.length * spreadPerOrb);
      const orbData = orbs.pop();
      this.createXPOrb(x + offsetX, y + offsetY, orbData.value, orbData.color, orbData.size);
    });
  }

  createXPOrb(x, y, value = 1, color = null, sizeMultiplier = 1) {
    const sprite = this.scene.physics.add.sprite(x, y, null);
    const graphics = this.scene.add.graphics();
    // PR7: Get XP orb size and color from ConfigResolver or blueprint
    const CR = this.scene.configResolver || window.ConfigResolver;
    const orbSize = CR ? CR.get('drops.xp.orbSize', { defaultValue: 20 }) : 20;
    const baseSize = orbSize * 0.7;
    const hexSize = baseSize * sizeMultiplier;
    
    // Try to get blueprint and extract color/shape
    let blueprint = null;
    let orbColor = color;
    let shape = 'hexagon';  // Default shape for XP orbs
    
    if (this.scene.blueprintLoader) {
      // Determine tier based on value
      const tier = value >= 10 ? 'large' : value >= 5 ? 'medium' : 'small';
      blueprint = this.scene.blueprintLoader.get(`item.xp_${tier}`);
      if (blueprint) {
        if (blueprint.color) {
          orbColor = blueprint.color;
        }
        // Get shape from blueprint if available
        if (blueprint.graphics?.shape) {
          shape = blueprint.graphics.shape;
        }
        // Attach blueprint for later use
        sprite._dropBlueprint = blueprint;
      }
    }
    
    // Fallback to ConfigResolver or default cyan color
    orbColor = orbColor || (CR ? CR.get('drops.xp.orbColor', { defaultValue: 0x00E8FC }) : 0x00E8FC);
    
    // Draw the shape using ShapeRenderer
    const strokeColor = value > 1 ? 0xffffff : null;
    const strokeWidth = value > 1 ? 2 : 0;
    const strokeAlpha = value > 1 ? 0.6 : 0;
    
    ShapeRenderer.drawShape(graphics, shape, hexSize, hexSize, hexSize, {
      fillColor: orbColor,
      fillAlpha: 1.0,
      strokeColor: strokeColor,
      strokeWidth: strokeWidth,
      strokeAlpha: strokeAlpha
    });
    const textureName = 'xpHex_' + Date.now() + '_' + Math.random();
    graphics.generateTexture(textureName, hexSize * 2, hexSize * 2);
    sprite.setTexture(textureName);
    graphics.destroy();
    sprite.type = 'xp';
    sprite.value = value;
    
    // Add bobbing animation if specified in blueprint
    if (blueprint?.pickup?.bobbing !== false) {
      this.scene.tweens.add({ 
        targets: sprite, 
        scaleX: 1.05, 
        scaleY: 1.05, 
        duration: 800, 
        yoyo: true, 
        repeat: -1, 
        ease: 'Sine.easeInOut' 
      });
    }
    
    // Set lifetime if specified in blueprint
    if (blueprint?.pickup?.lifetime) {
      this.scene.time.delayedCall(blueprint.pickup.lifetime, () => {
        if (sprite && sprite.active) {
          // Fade out and destroy
          this.scene.tweens.add({
            targets: sprite,
            alpha: 0,
            duration: 500,
            onComplete: () => sprite.destroy()
          });
        }
      });
    }
    
    this.loot.add(sprite);
    return sprite;
  }

  createMetotrexat(x, y) {
    const cr = this.scene.configResolver || window.ConfigResolver;
    const sprite = this.scene.physics.add.sprite(x, y, null);
    const graphics = this.scene.add.graphics();
    
    // Try to get blueprint for metotrexat
    let blueprint = null;
    let shape = 'star';  // Default shape for special drops
    let color = cr?.get('drops.metotrexat.color', { defaultValue: 0xFF00FF }) || 0xFF00FF;
    let scale = 1.2;
    
    if (this.scene.blueprintLoader) {
      blueprint = this.scene.blueprintLoader.get('item.metotrexat');
      if (blueprint) {
        if (blueprint.graphics?.shape) {
          shape = blueprint.graphics.shape;
        }
        if (blueprint.color) {
          color = blueprint.color;
        }
        if (blueprint.graphics?.scale) {
          scale = blueprint.graphics.scale;
        }
        sprite._dropBlueprint = blueprint;
      }
    }
    
    const baseSize = (cr?.get('drops.xp.orbSize', { defaultValue: 20 }) || 20) * 0.9;
    const hexSize = baseSize * scale;
    
    // Draw metotrexat with shape
    ShapeRenderer.drawShape(graphics, shape, hexSize, hexSize, hexSize, {
      fillColor: color,
      fillAlpha: 1.0,
      strokeColor: 0xffffff,
      strokeWidth: 2,
      strokeAlpha: 0.9
    });
    const textureName = 'metoHex_' + Date.now() + '_' + Math.random();
    graphics.generateTexture(textureName, hexSize * 2, hexSize * 2);
    sprite.setTexture(textureName);
    graphics.destroy();
    sprite.type = 'metotrexat';
    
    // Add animations based on blueprint
    if (blueprint?.graphics?.pulseAnimation !== false) {
      this.scene.tweens.add({ 
        targets: sprite, 
        scaleX: 1.15, 
        scaleY: 1.15, 
        alpha: 0.6, 
        duration: 300, 
        yoyo: true, 
        repeat: -1, 
        ease: 'Sine.easeInOut' 
      });
    }
    
    // Add glow effect
    if (blueprint?.graphics?.glow) {
      try {
        sprite.setTint(color);
        const blink = this.scene.time.addEvent({ 
          delay: 180, 
          loop: true, 
          callback: () => {
            const current = sprite.tintTopLeft;
            sprite.setTint(current === 0xffffff ? color : 0xffffff);
          }
        });
        sprite.on('destroy', () => blink?.remove(false));
      } catch (_) {}
    }
    
    // Set lifetime if specified in blueprint (longer for rare items)
    if (blueprint?.pickup?.lifetime) {
      this.scene.time.delayedCall(blueprint.pickup.lifetime, () => {
        if (sprite && sprite.active) {
          this.scene.tweens.add({
            targets: sprite,
            alpha: 0,
            duration: 500,
            onComplete: () => sprite.destroy()
          });
        }
      });
    }
    
    this.loot.add(sprite);
    return sprite;
  }

  // ====== Blueprintové dropy ======
  _registerDefaultDrops() {
    // PR7: Drops should be loaded from BlueprintLoader, not legacy imports
    // Registration happens automatically via BlueprintLoader
    // This method is kept for compatibility but does nothing
  }

  _pickSpecialDrop() {
    // Use BlueprintLoader to get drop blueprints
    const allDrops = this.scene.blueprintLoader?.getAll('drop') || [];
    const list = Array.from(allDrops.values());
    if (!list || list.length === 0) return null;
    // Filtr dle pravidel (level apod.)
    const lvl = this.scene.gameStats?.level || 1;
    const candidates = list.filter(d => (d.spawnRules?.minLevel ?? 1) <= lvl);
    if (candidates.length === 0) return null;
    // Jednoduchý váhový výběr (weight v 0..1 = pravděpodobnost)
    for (const d of candidates) {
      const w = Number(d.weight || 0);
      if (w > 0 && Math.random() < w) return d;
    }
    return null;
  }

  _createDropFromBlueprint(x, y, bp) {
    if (!bp || !bp.effect) return;
    if (bp.name === 'metotrexat') {
      // Vizuál metotrexátu ponecháme – efekt spustíme přes šablonu
      const sprite = this.createMetotrexat(x, y);
      sprite._dropBlueprint = bp; // připojit blueprint pro pickup handler
      return sprite;
    }
    // Obecná cesta: fallback na jednoduchý XP orb s jinou barvou (zatím)
    const s = this.createXPOrb(x, y, 5, bp.visual?.color || 0xffffff, bp.visual?.sizeMul || 1);
    s._dropBlueprint = bp;
    return s;
  }

  createHealthOrb(x, y, healAmount = null) {
    const cr = this.scene.configResolver || window.ConfigResolver;
    const sprite = this.scene.physics.add.sprite(x, y, null);
    const graphics = this.scene.add.graphics();
    const size = cr?.get('drops.health.orbSize', { defaultValue: 20 }) || 20;
    
    // Try to get blueprint for health drops
    let blueprint = null;
    let shape = 'circle';  // Default shape for health orbs
    let color = cr?.get('drops.health.color', { defaultValue: 0xFF0000 }) || 0xFF0000;
    
    if (this.scene.blueprintLoader) {
      blueprint = this.scene.blueprintLoader.get('item.health_small') || 
                 this.scene.blueprintLoader.get('item.health_large');
      if (blueprint) {
        if (blueprint.graphics?.shape) {
          shape = blueprint.graphics.shape;
        }
        if (blueprint.color) {
          color = blueprint.color;
        }
        sprite._dropBlueprint = blueprint;
      }
    }
    
    // Draw health orb with shape
    ShapeRenderer.drawShape(graphics, shape, size, size, size, {
      fillColor: color,
      fillAlpha: 1.0
    });
    
    // Add health cross on top
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(size - size * 0.6, size - 2, size * 1.2, 4);
    graphics.fillRect(size - 2, size - size * 0.6, 4, size * 1.2);
    
    const textureName = 'healthOrb_' + Date.now() + '_' + Math.random();
    graphics.generateTexture(textureName, size * 2, size * 2);
    sprite.setTexture(textureName);
    graphics.destroy();
    sprite.type = 'health';
    sprite.value = healAmount || blueprint?.effect?.value || cr?.get('drops.health.healAmount', { defaultValue: 15 }) || 15;
    sprite.healAmount = sprite.value; // For compatibility
    
    // Add bobbing animation if specified in blueprint
    if (blueprint?.pickup?.bobbing !== false) {
      this.scene.tweens.add({ 
        targets: sprite, 
        scaleX: 1.2, 
        scaleY: 1.2, 
        duration: 500, 
        yoyo: true, 
        repeat: -1, 
        ease: 'Sine.easeInOut' 
      });
    }
    
    // Set lifetime if specified in blueprint
    if (blueprint?.pickup?.lifetime) {
      this.scene.time.delayedCall(blueprint.pickup.lifetime, () => {
        if (sprite && sprite.active) {
          this.scene.tweens.add({
            targets: sprite,
            alpha: 0,
            duration: 500,
            onComplete: () => sprite.destroy()
          });
        }
      });
    }
    
    this.loot.add(sprite);
    return sprite;
  }

  update(time, delta) {
    if (this.scene.isPaused) return;
    
    // Performance profiling
    const profiler = this.scene._perfProfiler;
    const startTime = profiler?.startMeasurement('LootSystem');
    
    const player = this.scene.player;
    // Get XP magnet range from player (includes power-up modifiers)
    const actualMagnetRange = player.getXPMagnetRadius ? player.getXPMagnetRadius() : this.magnetRange;
    
    // PERFORMANCE OPTIMALIZATION: Direct iteration místo children.entries.forEach
    const lootObjects = this.loot.children?.list || [];
    const lootCount = lootObjects.length;
    
    for (let i = 0; i < lootCount; i++) {
      const orb = lootObjects[i];
      if (!(orb.active && orb.body)) continue;
      
      const dx = player.x - orb.x;
      const dy = player.y - orb.y;
      const distance = Math.hypot(dx, dy);
      
      // Get pickup radius from blueprint or use default
      let pickupRadius = 25;
      if (orb._dropBlueprint?.pickup?.pickupRadius) {
        pickupRadius = orb._dropBlueprint.pickup.pickupRadius;
      } else {
        const cr = this.scene.configResolver || window.ConfigResolver;
        pickupRadius = cr?.get('collision.lootPickup', { defaultValue: 25 }) || 25;
      }
      
      // Detekce pickup pro VŠECHNY typy lootu při blízkém kontaktu
      if (distance <= pickupRadius) {
        // Check autoPickup flag from blueprint
        if (orb._dropBlueprint?.pickup?.autoPickup === false) {
          // Don't auto-pickup if explicitly disabled (e.g., health at full HP)
          if (orb.type === 'health' && player.hp >= player.maxHp) {
            continue;
          }
        }
        
        // V bezprostřední blízkosti hráče: zajistit správnou pozici TĚLA a vyvolat pickup
        orb.body.setVelocity(0, 0);
        if (orb.body && typeof orb.body.reset === 'function') {
          orb.body.reset(player.x, player.y);
        } else {
          orb.x = player.x;
          orb.y = player.y;
        }
        // Okamžitě zpracovat pickup mimo aktuální iteraci (bezpečné vůči mutaci kolekce)
        this.scene.time.delayedCall(0, () => {
          try { this.scene.handlePlayerLootCollision(this.scene.player.sprite || this.scene.player, orb); } catch (_) {}
        });
        continue;
      }
      
      // Magnet effect - check if item has magnetRange in blueprint
      let magnetRange = 0;
      if (orb._dropBlueprint?.pickup?.magnetRange) {
        magnetRange = orb._dropBlueprint.pickup.magnetRange;
      } else if (orb.type === 'xp') {
        // Default magnet for XP orbs
        magnetRange = actualMagnetRange;
      }
      
      if (magnetRange > 0 && distance <= magnetRange) {
        // Apply magnet effect
        const inv = 1 / (distance || 1);
        const dirX = dx * inv;
        const dirY = dy * inv;
        const t = 1 - (distance / magnetRange);
        const magnetStrength = t * t;
        const baseSpeed = 120;
        const maxBonus = 480;
        const speed = baseSpeed + magnetStrength * maxBonus;
        orb.body.setVelocity(dirX * speed, dirY * speed);
        
        // Rotate XP orbs while being attracted
        if (orb.type === 'xp') {
          orb.rotation += 0.12;
        }
      } else {
        // No magnet effect - stop velocity
        orb.body.setVelocity(0, 0);
      }
    }
    
    // End performance measurement
    profiler?.endMeasurement('LootSystem', startTime);
  }

  increaseMagnetLevel() { 
    this.magnetLevel++; 
    // Přepočítej dosah podle levelu (80 base + 40 per level)
    this.magnetRange = Math.min(560, 80 + this.magnetLevel * 40);
    console.log(`[LootSystem] Magnet level increased to ${this.magnetLevel}, range: ${this.magnetRange}`);
  }
  
  // === PUBLIC API FOR LOOT INTEGRATION ===
  
  /**
   * Spawn XP orb (called from LootSystemIntegration)
   */
  spawnXP(x, y, value) {
    return this.createXPOrb(x, y, value);
  }
  
  /**
   * Spawn health drop (called from LootSystemIntegration)
   */
  spawnHealthDrop(x, y, healAmount) {
    return this.createHealthOrb(x, y, healAmount);
  }
  
  /**
   * Spawn Metotrexat (called from LootSystemIntegration)
   */
  spawnMetotrexat(x, y) {
    return this.createMetotrexat(x, y);
  }
  
  clearAll() { this.loot.clear(true, true); }
}


