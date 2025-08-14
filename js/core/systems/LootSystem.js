// LootSystem – pooled správa XP/health/special lootů a magnet efektu
// Fáze 2: proxy kompatibilní se stávajícím LootManager API

// PR7: GameConfig removed - use ConfigResolver only
// import { GameConfig } from '../../config.js';
import { DropRegistry } from '../registry/DropRegistry.js';
import { DropEffects } from '../drops/effects.js';
import { EnemyRegistry } from '../registry/EnemyRegistry.js';

export class LootSystem {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.loot = scene.physics.add.group();
    this.magnetRange = GameConfig.xp.magnetRange;
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

  dropLoot(x, y, enemy) {
    if (!enemy) return;
    let xpValue = enemy.xp || 0;
    // Pokud běží Core a existuje blueprint nepřítele, přečíst LootDrop.xp/healthChance
    try {
      // Načíst loot data z blueprintů
      if (enemy.type) {
        const map = { red: 'basic_cell', orange: 'orange_tumor', green: 'green_heavy', purple: 'purple_support', brown: 'brown_shooter' };
        const bp = EnemyRegistry.get(map[enemy.type] || enemy.type);
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
    const baseDropChance = (typeof this._healthChanceOverride === 'number') ? this._healthChanceOverride : GameConfig.health.dropChance;
    const playerLevel = this.scene.gameStats.level;
    
    // PR5: Health drop chance scaling with ConfigResolver
    let levelStepSize, chanceReduction, minChance;
    if (this.scene.GameConfig?.validation?.features?.useConfigResolver) {
      const ConfigResolver = window.ConfigResolver || this.scene.configResolver;
      if (ConfigResolver) {
        levelStepSize = ConfigResolver.get('loot.health.levelStepSize', { defaultValue: 5 });
        chanceReduction = ConfigResolver.get('loot.health.chanceReduction', { defaultValue: 0.9 });
        minChance = ConfigResolver.get('loot.health.minChance', { defaultValue: 0.01 });
      } else {
        levelStepSize = 5;
        chanceReduction = 0.9;
        minChance = 0.01;
      }
    } else {
      levelStepSize = 5;
      chanceReduction = 0.9;
      minChance = 0.01;
    }
    
    const reductionSteps = Math.floor(playerLevel / levelStepSize);
    let currentChance = baseDropChance;
    for (let i = 0; i < reductionSteps; i++) currentChance *= chanceReduction;
    return Math.max(minChance, currentChance);
  }

  createOptimalXPOrbs(x, y, totalXP) {
    // PR5: XP Tier configuration with ConfigResolver fallback
    let xpTiers;
    if (this.scene.GameConfig?.validation?.features?.useConfigResolver) {
      const ConfigResolver = window.ConfigResolver || this.scene.configResolver;
      if (ConfigResolver) {
        xpTiers = ConfigResolver.get('loot.xp.tiers', {
          defaultValue: [
            { value: 50, color: 0xffff00, size: 1.4 },
            { value: 25, color: 0xff8800, size: 1.2 },
            { value: 10, color: 0x00ff88, size: 1.0 },
            { value: 5,  color: 0x00ffff, size: 0.8 },
            { value: 1,  color: 0x4444ff, size: 0.7 }
          ]
        });
      } else {
        xpTiers = [
          { value: 50, color: 0xffff00, size: 1.4 },
          { value: 25, color: 0xff8800, size: 1.2 },
          { value: 10, color: 0x00ff88, size: 1.0 },
          { value: 5,  color: 0x00ffff, size: 0.8 },
          { value: 1,  color: 0x4444ff, size: 0.7 }
        ];
      }
    } else {
      xpTiers = [
        { value: 50, color: 0xffff00, size: 1.4 },
        { value: 25, color: 0xff8800, size: 1.2 },
        { value: 10, color: 0x00ff88, size: 1.0 },
        { value: 5,  color: 0x00ffff, size: 0.8 },
        { value: 1,  color: 0x4444ff, size: 0.7 }
      ];
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
      // PR5: XP orb spread with ConfigResolver
      let maxSpread, spreadPerOrb;
      if (this.scene.GameConfig?.validation?.features?.useConfigResolver) {
        const ConfigResolver = window.ConfigResolver || this.scene.configResolver;
        maxSpread = ConfigResolver.get('loot.xp.maxSpread', { defaultValue: 40 });
        spreadPerOrb = ConfigResolver.get('loot.xp.spreadPerOrb', { defaultValue: 8 });
      } else {
        maxSpread = 40;
        spreadPerOrb = 8;
      }
      
      const offsetX = (Math.random() - 0.5) * Math.min(maxSpread, orbs.length * spreadPerOrb);
      const offsetY = (Math.random() - 0.5) * Math.min(maxSpread, orbs.length * spreadPerOrb);
      const orbData = orbs.pop();
      this.createXPOrb(x + offsetX, y + offsetY, orbData.value, orbData.color, orbData.size);
    });
  }

  createXPOrb(x, y, value = 1, color = null, sizeMultiplier = 1) {
    const sprite = this.scene.physics.add.sprite(x, y, null);
    const graphics = this.scene.add.graphics();
    // PR7: Get XP orb size and color from ConfigResolver
    const CR = this.scene.configResolver || window.ConfigResolver;
    const orbSize = CR ? CR.get('drops.xp.orbSize', { defaultValue: 20 }) : 20;
    const baseSize = orbSize * 0.7;
    const hexSize = baseSize * sizeMultiplier;
    const orbColor = color || (CR ? CR.get('drops.xp.orbColor', { defaultValue: 0x00ff00 }) : 0x00ff00);
    graphics.fillStyle(orbColor, 1);
    graphics.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = hexSize + Math.cos(angle) * hexSize;
      const py = hexSize + Math.sin(angle) * hexSize;
      if (i === 0) graphics.moveTo(px, py); else graphics.lineTo(px, py);
    }
    graphics.closePath();
    graphics.fill();
    if (value > 1) {
      graphics.lineStyle(2, 0xffffff, 0.6);
      graphics.strokePath();
    }
    const textureName = 'xpHex_' + Date.now() + '_' + Math.random();
    graphics.generateTexture(textureName, hexSize * 2, hexSize * 2);
    sprite.setTexture(textureName);
    graphics.destroy();
    sprite.type = 'xp';
    sprite.value = value;
    this.scene.tweens.add({ targets: sprite, scaleX: 1.05, scaleY: 1.05, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.loot.add(sprite);
    return sprite;
  }

  createMetotrexat(x, y) {
    const metoCfg = GameConfig.specialDrops?.metotrexat || {};
    const sprite = this.scene.physics.add.sprite(x, y, null);
    const graphics = this.scene.add.graphics();
    const baseSize = GameConfig.xp.orbSize * 0.9;
    const hexSize = baseSize * (metoCfg.orbSizeMultiplier ?? 1.1);
    const orbColor = metoCfg.orbColor ?? 0xffffaa;
    graphics.fillStyle(orbColor, 1);
    graphics.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = hexSize + Math.cos(angle) * hexSize;
      const py = hexSize + Math.sin(angle) * hexSize;
      if (i === 0) graphics.moveTo(px, py); else graphics.lineTo(px, py);
    }
    graphics.closePath();
    graphics.fill();
    graphics.lineStyle(2, 0xffffff, 0.9);
    graphics.strokePath();
    const textureName = 'metoHex_' + Date.now() + '_' + Math.random();
    graphics.generateTexture(textureName, hexSize * 2, hexSize * 2);
    sprite.setTexture(textureName);
    graphics.destroy();
    sprite.type = 'metotrexat';
    this.scene.tweens.add({ targets: sprite, scaleX: 1.15, scaleY: 1.15, alpha: 0.6, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    try {
      sprite.setTint(orbColor);
      const blink = this.scene.time.addEvent({ delay: 180, loop: true, callback: () => {
        const current = sprite.tintTopLeft;
        sprite.setTint(current === 0xffffff ? orbColor : 0xffffff);
      }});
      sprite.on('destroy', () => blink?.remove(false));
    } catch (_) {}
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
    const list = DropRegistry.list();
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

  createHealthOrb(x, y) {
    const sprite = this.scene.physics.add.sprite(x, y, null);
    const graphics = this.scene.add.graphics();
    const size = GameConfig.health.orbSize;
    graphics.fillStyle(GameConfig.health.orbColor, 1);
    graphics.fillCircle(size, size, size);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(size - size * 0.6, size - 2, size * 1.2, 4);
    graphics.fillRect(size - 2, size - size * 0.6, 4, size * 1.2);
    const textureName = 'healthOrb_' + Date.now() + '_' + Math.random();
    graphics.generateTexture(textureName, size * 2, size * 2);
    sprite.setTexture(textureName);
    graphics.destroy();
    sprite.type = 'health';
    sprite.value = GameConfig.health.healAmount;
    this.scene.tweens.add({ targets: sprite, scaleX: 1.2, scaleY: 1.2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.loot.add(sprite);
    return sprite;
  }

  update(time, delta) {
    if (this.scene.isPaused) return;
    
    // Performance profiling
    const profiler = this.scene._perfProfiler;
    const startTime = profiler?.startMeasurement('LootSystem');
    
    const player = this.scene.player;
    // magnetRange už obsahuje finální hodnotu z PowerUpSystem
    const actualMagnetRange = this.magnetRange;
    
    // PERFORMANCE OPTIMALIZATION: Direct iteration místo children.entries.forEach
    const lootObjects = this.loot.children?.list || [];
    const lootCount = lootObjects.length;
    
    for (let i = 0; i < lootCount; i++) {
      const orb = lootObjects[i];
      if (!(orb.active && orb.body)) continue;
      
      const dx = player.x - orb.x;
      const dy = player.y - orb.y;
      const distance = Math.hypot(dx, dy);
      
      // Detekce pickup pro VŠECHNY typy lootu při blízkém kontaktu
      if (distance <= GameConfig.collision.lootPickup) {
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
          try { this.scene.handlePlayerLootCollision(this.scene.player.sprite, orb); } catch (_) {}
        });
        continue;
      }
      
      // Magnetický efekt POUZE pro XP orby
      if (orb.type === 'xp') {
        if (distance > actualMagnetRange) {
          orb.body.setVelocity(0, 0);
          continue;
        }
        
        const inv = 1 / (distance || 1);
        const dirX = dx * inv;
        const dirY = dy * inv;
        const t = 1 - (distance / actualMagnetRange);
        const magnetStrength = t * t;
        const baseSpeed = 120;
        const maxBonus = 480;
        const speed = baseSpeed + magnetStrength * maxBonus;
        orb.body.setVelocity(dirX * speed, dirY * speed);
        orb.rotation += 0.12;
      } else {
        // Non-XP loot: žádný magnet, jen zastavit velocity
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
  clearAll() { this.loot.clear(true, true); }
}


