// PowerUpSystem – Fáze 5 (základní skeleton s proxy na Player/LootManager)
// Cíl: centralizovat aplikaci modifikátorů a schopností, aby bylo snadné přejít na
// datově řízené blueprinty a později sjednotit s `PowerUpRegistry`.

import { displayResolver } from '../blueprints/DisplayResolver.js';

export class PowerUpSystem {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.player = scene.player; // nastaví se po vytvoření hráče (GameScene vytváří hráče před PowerUpManagerem)
    this.modifiers = []; // budoucí struktura: { path: 'projectile.damage', type: 'add|mul|override', value }
    this.abilities = []; // budoucí abilities s tick funkcí
    /** @type {Map<string, number>} */
    this.appliedLevels = new Map(); // jméno power-upu → aktuálně aplikovaný level
    this._timers = { radiotherapy: 0, lightning: 0 };
    
    // Load power-up blueprints into registry
    this._blueprintsLoaded = this._loadPowerUpBlueprints();
  }
  
  async _loadPowerUpBlueprints() {
    try {
      // Get PowerUpRegistry
      const { PowerUpRegistry } = await import('../registry/PowerUpRegistry.js');
      
      // PR7: Load ALL power-up blueprints from BlueprintLoader using its API
      // 100% data-driven - BlueprintLoader is the single source of truth
      if (this.scene.blueprintLoader) {
        // Use BlueprintLoader's getAll method to get all powerup blueprints
        const powerUpBlueprints = this.scene.blueprintLoader.getAll('powerup') || [];
        
        // Register each power-up blueprint
        for (const blueprint of powerUpBlueprints) {
          if (blueprint && blueprint.id) {
            PowerUpRegistry.register(blueprint);
            console.log(`[PowerUpSystem] Registered blueprint: ${blueprint.id}`);
          }
        }
        
        console.log(`[PowerUpSystem] Loaded ${PowerUpRegistry.list().length} power-up blueprints from BlueprintLoader`);
      } else {
        console.warn('[PowerUpSystem] BlueprintLoader not available - power-ups will not be loaded');
      }
    } catch (error) {
      console.error('[PowerUpSystem] Failed to load power-up blueprints:', error);
    }
  }

  /**
   * Aplikuje efekt specifikovaný mapovaným objektem z PowerUpManageru
   * effectSpec: { type: string, level?: number, value?: number }
   */
  apply(effectSpec) {
    if (!effectSpec || !this.scene || !this.scene.player) return;
    const player = this.scene.player;

    // PR7: Apply power-ups through ModifierEngine or direct property modification
    console.log('[PowerUpSystem] Applying effect:', effectSpec);
    
    // Extract the base type from full ID (e.g., "powerup.damage_boost" -> "damage_boost")
    const effectType = (effectSpec.type || effectSpec.id || '').replace('powerup.', '');
    
    switch (effectType) {
      case 'damage':
      case 'damage_boost':
        // PR7: Get value from effectSpec or default to 0
        const damageBoost = effectSpec.value || 0;
        if (damageBoost === 0) {
          console.warn('[PowerUpSystem] damage effect value is 0');
        }
        // PR7: Use ModifierEngine pattern with correct type 'add' for flat damage increase
        const modifier = {
          path: 'projDamage',
          type: 'add',
          value: damageBoost
        };
        player.addModifier(modifier);
        console.log(`[PowerUp] Damage modifier applied: +${damageBoost} flat damage`);
        break;
        
      case 'speed':
      case 'speed_boots':
        // PR7: Get value from effectSpec
        const speedBoost = effectSpec.value || 0;
        if (speedBoost === 0) {
          console.warn('[PowerUpSystem] speed effect value is 0');
        }
        // PR7: Use ModifierEngine pattern with correct type 'mul' for percentage increase
        const speedModifier = {
          path: 'moveSpeed',
          type: 'mul',
          value: speedBoost / 100
        };
        player.addModifier(speedModifier);
        console.log(`[PowerUp] Speed modifier applied: +${speedBoost}%`);
        break;
        
      case 'maxHp':
      case 'max_hp':
        // PR7: Get value from blueprint, no hardcoded fallbacks
        if (!this.scene.configResolver) {
          console.error('[PowerUpSystem] ConfigResolver not available');
          break;
        }
        const hpBoost = effectSpec.value;
        if (hpBoost === undefined) {
          console.error('[PowerUpSystem] maxHp effect missing value in blueprint');
          break;
        }
        // Use ModifierEngine pattern
        const hpModifier = {
          path: 'hp',
          type: 'add',
          value: hpBoost
        };
        player.addModifier(hpModifier);
        player.heal(hpBoost); // Heal the added amount
        console.log(`[PowerUp] Max HP increased by ${hpBoost}`);
        break;
        
      case 'attackSpeed':
      case 'attack_speed':
        // Decrease attack interval
        const attackSpeedBoost = effectSpec.value || 10;
        player.baseStats.attackIntervalMs = Math.round(player.baseStats.attackIntervalMs * (1 - attackSpeedBoost / 100));
        console.log(`[PowerUp] Attack speed increased by ${attackSpeedBoost}%`);
        break;
        
      case 'projectiles':
      case 'projectile_count':
        // PR7: Use ModifierEngine pattern
        const projectileModifier = {
          path: 'projectileCount',
          type: 'add',
          value: effectSpec.value || 1
        };
        player.addModifier(projectileModifier);
        console.log(`[PowerUp] Projectile count modifier applied: +${effectSpec.value || 1}`);
        break;
        
      case 'xpMagnet':
      case 'xp_magnet':
        this.scene.coreLootSystem?.increaseMagnetLevel?.();
        break;
        
      case 'chemo_reservoir':
        // PR7: Chemo reservoir - toxic aura and explosion effects
        console.log('[PowerUp] Chemo reservoir activated - level:', effectSpec.level || 1);
        
        // Activate chemo aura visual
        player.chemoAuraActive = true;
        player.chemoAuraLevel = effectSpec.level || 1;
        
        // Apply modifiers from blueprint
        if (effectSpec.mechanics?.modifiersPerLevel) {
          const modifiers = effectSpec.mechanics.modifiersPerLevel;
          modifiers.forEach(mod => {
            // Aplikovat modifikátor podle typu
            if (mod.type === 'mul' && mod.path === 'projectile.explosionRadius') {
              player.explosionRadiusMultiplier = (player.explosionRadiusMultiplier || 1) * (1 + mod.value);
            } else if (mod.type === 'mul' && mod.path === 'projectile.explosionDamage') {
              player.explosionDamageMultiplier = (player.explosionDamageMultiplier || 1) * (1 + mod.value);
            } else if (mod.type === 'enable' && mod.path === 'projectile.onHit.explosion') {
              player.hasExplosiveShots = true;
            }
          });
        }
        
        // Add aura damage over time
        player.chemoAuraDamage = 1 * (effectSpec.level || 1);
        player.chemoAuraRadius = 70;
        
        // Activate visual effect through VFX Manager
        if (this.vfxManager) {
          this.vfxManager.attachEffect(player, 'chemoAura', {
            radius: player.chemoAuraRadius,
            damage: player.chemoAuraDamage
          });
        }
        break;
      
      case 'piercing_arrows':
        // PR7: Piercing arrows power-up from blueprint
        if (effectSpec.modifiers) {
          effectSpec.modifiers.forEach(mod => {
            // PR7: Use correct modifier type 'mul' instead of 'multiply'
            if ((mod.type === 'mul' || mod.type === 'multiply') && mod.path === 'projectile.piercing') {
              player.piercingLevel = (player.piercingLevel || 0) + 1;
              player.projectilePiercing = mod.value;
            }
          });
          console.log(`[PowerUp] Piercing arrows level ${player.piercingLevel || 1} applied`);
        }
        break;
      
      case 'flamethrower':
        // PR7: Flamethrower effect - visual cone and area damage
        console.log('[PowerUp] Flamethrower activated - level:', effectSpec.level || 1);
        
        // Activate flamethrower visual
        player.flamethrowerActive = true;
        player.flamethrowerLevel = effectSpec.level || 1;
        
        // Add damage modifier
        const flameModifier = {
          path: 'projDamage',
          type: 'add',
          value: 5 * (effectSpec.level || 1)
        };
        player.addModifier(flameModifier);
        
        // PR7: Apply flame damage to enemies in cone (handled in update)
        player.flamethrowerDamage = 2 * (effectSpec.level || 1);
        player.flamethrowerRange = 80;
        
        // Activate visual effect through VFX Manager
        if (this.vfxManager) {
          this.vfxManager.attachEffect(player, 'flamethrower', {
            damage: player.flamethrowerDamage,
            range: player.flamethrowerRange
          });
        }
        break;
      
      case 'shield':
      case 'immune_shield':
        // PR7: Shield power-up - vše přes ConfigResolver, žádné hardcoded hodnoty
        if (!this.scene.configResolver) {
          console.error('[PowerUpSystem] ConfigResolver not available for shield');
          break;
        }
        
        const CR = this.scene.configResolver;
        
        // Načti hodnoty z blueprintu přes ConfigResolver
        const level = effectSpec.level || 1;
        
        // Získej hodnoty z modifierů v blueprintu - PR7: podporovat obě struktury
        let shieldHits = 1;
        let immunityDuration = 3000;
        
        const modifiers = effectSpec.mechanics?.modifiersPerLevel || effectSpec.modifiers || [];
        if (Array.isArray(modifiers)) {
          modifiers.forEach(mod => {
            if (mod.path === 'player.shield.active') {
              shieldHits = mod.value + ((mod.valuePerLevel || 0) * (level - 1));
            }
            if (mod.path === 'player.shield.immunityDuration') {
              immunityDuration = mod.value;
            }
          });
        }
        
        // Aplikuj shield na hráče
        player.hasShield = true;
        player.shieldActive = true;
        player.shieldDuration = immunityDuration;
        player.shieldHits = shieldHits;
        
        // Activate visual effect through VFX Manager
        if (this.vfxManager) {
          this.vfxManager.attachEffect(player, 'shield', {
            duration: immunityDuration,
            hits: shieldHits
          });
        }
        
        // PR7: VFX přes VFXSystem - použij výchozí ID, blueprint nemusí mít vlastní
        const vfxPickupId = 'vfx.shield.pickup';
        if (this.scene.newVFXSystem) {
          this.scene.newVFXSystem.play(vfxPickupId, player.x, player.y);
        }
        
        // PR7: SFX přes SFXSystem - použij výchozí ID, blueprint nemusí mít vlastní
        const sfxApplyId = 'sfx.shield.activate';
        if (this.scene.newSFXSystem) {
          this.scene.newSFXSystem.play(sfxApplyId);
        }
        
        console.log(`[PowerUp] Shield activated with ${shieldHits} charges, ${immunityDuration}ms immunity`);
        break;
        
      default:
        console.warn('[PowerUpSystem] Unknown effect type:', effectType, 'from', effectSpec.type || effectSpec.id);
        break;
    }
    
    // Store that we applied this power-up
    const powerUpId = effectSpec.id || effectSpec.type;
    const currentLevel = this.appliedLevels.get(powerUpId) || 0;
    this.appliedLevels.set(powerUpId, currentLevel + 1);
    
    // Track power-up collection for stats
    if (this.scene.gameStats) {
        this.scene.gameStats.powerUpsCollected = (this.scene.gameStats.powerUpsCollected || 0) + 1;
    }
  }

  /**
   * Budoucí per-frame tick pro abilities/modifikátory
   */
  update(time, delta) {
    const player = this.scene?.player;
    if (!player) return;

    // Aura damage tick (přesunuto z Player)
    if (player.aura && player.auraDamage > 0) {
      this._tickAura(player);
    }

    // Radioterapie (laser paprsky)
    if (player.hasRadiotherapy && player.radiotherapyLevel > 0) {
      this._timers.radiotherapy += delta;
      // PR2 BALÍK D: Radiotherapy interval migration
      let baseInterval = 1000; // Legacy fallback
      let minInterval = 300; // Legacy fallback
      let intervalPerLevel = 100; // Legacy fallback
      
      if (this.scene.GameConfig?.validation?.features?.useConfigResolver) {
        const ConfigResolver = window.ConfigResolver || this.scene.configResolver;
        if (ConfigResolver) {
          baseInterval = ConfigResolver.get('abilities.radiotherapy.baseInterval', { defaultValue: 1000 });
          minInterval = ConfigResolver.get('abilities.radiotherapy.minInterval', { defaultValue: 300 });
          intervalPerLevel = Math.abs(ConfigResolver.get('abilities.radiotherapy.intervalPerLevel', { defaultValue: -100 }));
        }
      }
      
      const interval = Math.max(minInterval, baseInterval - (player.radiotherapyLevel - 1) * intervalPerLevel);
      if (this._timers.radiotherapy >= interval) {
        this._performRadiotherapy(player);
        this._timers.radiotherapy = 0;
      }
    }

    // Imunoterapie (chain lightning)
    if (player.hasLightningChain && player.lightningChainLevel > 0) {
      this._timers.lightning += delta;
      // PR2 BALÍK D: Lightning interval migration
      let baseInterval = 2000; // Legacy fallback
      let minInterval = 800; // Legacy fallback
      let intervalPerLevel = 200; // Legacy fallback
      
      if (this.scene.GameConfig?.validation?.features?.useConfigResolver) {
        const ConfigResolver = window.ConfigResolver || this.scene.configResolver;
        if (ConfigResolver) {
          baseInterval = ConfigResolver.get('abilities.lightning.baseInterval', { defaultValue: 2000 });
          minInterval = ConfigResolver.get('abilities.lightning.minInterval', { defaultValue: 800 });
          intervalPerLevel = Math.abs(ConfigResolver.get('abilities.lightning.intervalPerLevel', { defaultValue: -200 }));
        }
      }
      
      const interval = Math.max(minInterval, baseInterval - (player.lightningChainLevel - 1) * intervalPerLevel);
      if (this._timers.lightning >= interval) {
        this._performLightningChain(player);
        this._timers.lightning = 0;
      }
    }

    // Aura tick zůstává v Player (vizual + výpočet), ponecháme pro paritu
  }

  // Najde aktivní nepřátele v dosahu - optimalizované distance²
  _findEnemiesInRange(cx, cy, range) {
    const enemies = this.scene.enemiesGroup?.getChildren() || [];
    const rangeSquared = range * range;
    
    return enemies.filter(e => {
      if (!e || !e.active) return false;
      
      // AABB pre-filter (rychlejší než distance)
      const dx = Math.abs(e.x - cx);
      const dy = Math.abs(e.y - cy);
      if (dx > range || dy > range) return false;
      
      // Precise distance² check (bez Math.sqrt)
      const distanceSquared = dx * dx + dy * dy;
      return distanceSquared <= rangeSquared;
    });
  }

  _performRadiotherapy(player) {
    const rayCount = player.radiotherapyLevel;
    // PR2 BALÍK D: Radiotherapy range migration
    let baseRange = 200; // Legacy fallback
    let rangePerLevel = 50; // Legacy fallback
    
    if (this.scene.GameConfig?.validation?.features?.useConfigResolver) {
      const ConfigResolver = window.ConfigResolver || this.scene.configResolver;
      if (ConfigResolver) {
        baseRange = ConfigResolver.get('abilities.radiotherapy.baseRange', { defaultValue: 200 });
        rangePerLevel = ConfigResolver.get('abilities.radiotherapy.rangePerLevel', { defaultValue: 50 });
      }
    }
    
    const levelRangeBonus = (player.radiotherapyLevel - 1) * rangePerLevel;
    const universalRangeBonus = baseRange * (player.rangeBonus || 0);
    const rayRange = baseRange + levelRangeBonus + universalRangeBonus;

    const enemies = this._findEnemiesInRange(player.x, player.y, rayRange);
    if (enemies.length === 0) return;

    // Sound handled by SFX system directly
    if (this.scene.newSFXSystem) {
        this.scene.newSFXSystem.play('sfx.weapon.lightning');
    }

    // Nejbližší cíle
    enemies.sort((a, b) => (
      Phaser.Math.Distance.Between(player.x, player.y, a.x, a.y) -
      Phaser.Math.Distance.Between(player.x, player.y, b.x, b.y)
    ));

    const targetsToHit = Math.min(rayCount, enemies.length);
    for (let i = 0; i < targetsToHit; i++) {
      const target = enemies[i];
      this._radiotherapyRay(player, target);
    }
  }

  _radiotherapyRay(player, target) {
    if (!target || !target.active) return;
    const playerRadius = (this.scene.GameConfig?.player?.size || 30) / 2;
    const angle = Phaser.Math.Angle.Between(player.x, player.y, target.x, target.y);
    const startX = player.x + Math.cos(angle) * (playerRadius + 5);
    const startY = player.y + Math.sin(angle) * (playerRadius + 5);

    // Vizuální paprsek
    const ray = this.scene.add.graphics();
    ray.lineStyle(3, 0xff0000, 0.8);
    ray.beginPath();
    ray.moveTo(startX, startY);
    ray.lineTo(target.x, target.y);
    ray.strokePath();

    // Impact effects handled by VFX/SFX systems directly
    if (this.scene.newVFXSystem) {
        this.scene.newVFXSystem.play('vfx.projectile.impact', target.x, target.y);
    }
    if (this.scene.newSFXSystem) {
        this.scene.newSFXSystem.play('sfx.projectile.impact');
    }

    // Damage
    const damage = (player.projectileDamage || 0) + (player.damageBonus || 0);
    this.scene.recordDamageDealt(damage, target);
    if (target.takeDamage) target.takeDamage(damage);
    if (target.hp <= 0) this.scene.handleEnemyDeath(target);

    // Cleanup vizuálu
    this.scene.time.delayedCall(150, () => { try { ray.destroy(); } catch (_) {} });
  }

  _performLightningChain(player) {
    const enemies = (this.scene.enemiesGroup?.getChildren() || []).filter(e => e && e.active);
    if (enemies.length === 0) return;
    // Najít nejbližší cíl v dosahu
    let closestEnemy = null;
    let closestDistance = Infinity;
    // PR2 BALÍK D: Lightning range and damage migration
    let baseRange = 200; // Legacy fallback
    let baseDamage = 15; // Legacy fallback
    let damagePerLevel = 10; // Legacy fallback
    let baseJumpRange = 80; // Legacy fallback
    let jumpRangePerLevel = 20; // Legacy fallback
    
    if (this.scene.GameConfig?.validation?.features?.useConfigResolver) {
      const ConfigResolver = window.ConfigResolver || this.scene.configResolver;
      if (ConfigResolver) {
        baseRange = ConfigResolver.get('abilities.lightning.baseRange', { defaultValue: 200 });
        baseDamage = ConfigResolver.get('abilities.lightning.baseDamage', { defaultValue: 15 });
        damagePerLevel = ConfigResolver.get('abilities.lightning.damagePerLevel', { defaultValue: 10 });
        baseJumpRange = ConfigResolver.get('abilities.lightning.jumpRange', { defaultValue: 80 });
        jumpRangePerLevel = ConfigResolver.get('abilities.lightning.jumpRangePerLevel', { defaultValue: 20 });
      }
    }
    
    const maxRange = baseRange * (1 + (player.rangeBonus || 0));
    for (const e of enemies) {
      const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y);
      if (d < closestDistance) { closestDistance = d; closestEnemy = e; }
    }
    if (!closestEnemy || closestDistance > maxRange) return;

    // Sound handled by SFX system directly
    if (this.scene.newSFXSystem) {
        this.scene.newSFXSystem.play('sfx.weapon.lightning');
    }

    const calculatedDamage = baseDamage + (player.lightningChainLevel * damagePerLevel);
    const maxJumps = 1 + player.lightningChainLevel;
    const calculatedJumpRange = baseJumpRange + (player.lightningChainLevel * jumpRangePerLevel);
    const jumpRange = calculatedJumpRange * (1 + (player.rangeBonus || 0));
    this._chainLightning(player, closestEnemy, calculatedDamage, maxJumps, jumpRange, []);
  }

  _chainLightning(player, currentEnemy, damage, jumpsLeft, jumpRange, hitEnemies) {
    if (!currentEnemy || !currentEnemy.active || jumpsLeft <= 0) return;
    hitEnemies.push(currentEnemy);

    // Damage + impact efekt
    if (currentEnemy.takeDamage) {
      this.scene.recordDamageDealt(damage, currentEnemy);
      currentEnemy.takeDamage(damage);
      if (currentEnemy.hp <= 0) this.scene.handleEnemyDeath(currentEnemy);
    }
    // Impact effects handled directly
    if (this.scene.newVFXSystem) {
        this.scene.newVFXSystem.play('vfx.projectile.impact', currentEnemy.x, currentEnemy.y);
    }
    if (this.scene.newSFXSystem) {
        this.scene.newSFXSystem.play('sfx.projectile.impact');
    }

    // Vizuální blesk z předchozího bodu
    let fromX, fromY;
    if (hitEnemies.length === 1) {
      const playerRadius = (this.scene.GameConfig?.player?.size || 30) / 2;
      const angle = Phaser.Math.Angle.Between(player.x, player.y, currentEnemy.x, currentEnemy.y);
      fromX = player.x + Math.cos(angle) * (playerRadius + 5);
      fromY = player.y + Math.sin(angle) * (playerRadius + 5);
    } else {
      const prev = hitEnemies[hitEnemies.length - 2];
      fromX = prev.x; fromY = prev.y;
    }
    const lightning = this.scene.add.graphics();
    lightning.lineStyle(4, 0x4444ff, 1);
    lightning.beginPath();
    lightning.moveTo(fromX, fromY);
    lightning.lineTo(currentEnemy.x, currentEnemy.y);
    lightning.strokePath();
    this.scene.tweens.add({ targets: lightning, alpha: 0, duration: 200, onComplete: () => lightning.destroy() });

    // Najít další cíl v dosahu
    if (jumpsLeft > 1) {
      const candidates = (this.scene.enemiesGroup?.getChildren() || [])
        .filter(e => e && e.active && !hitEnemies.includes(e));
      let nextEnemy = null; let minD = Infinity;
      for (const e of candidates) {
        const d = Phaser.Math.Distance.Between(currentEnemy.x, currentEnemy.y, e.x, e.y);
        if (d <= jumpRange && d < minD) { minD = d; nextEnemy = e; }
      }
      if (nextEnemy) {
        // PR2 BALÍK D: Lightning chain damage reduction migration
        let damageReduction = 0.8; // Legacy fallback (20% reduction per jump)
        if (this.scene.GameConfig?.validation?.features?.useConfigResolver) {
          const ConfigResolver = window.ConfigResolver || this.scene.configResolver;
          if (ConfigResolver) {
            damageReduction = ConfigResolver.get('abilities.lightning.damageReduction', { defaultValue: 0.8 });
          }
        }
        
        this.scene.time.delayedCall(150, () => {
          this._chainLightning(player, nextEnemy, damage * damageReduction, jumpsLeft - 1, jumpRange, hitEnemies);
        });
      }
    }
  }

  _tickAura(player) {
    try {
      // Update aura pozice
      player.aura.x = player.x;
      player.aura.y = player.y;
      const radius = player.auraRadius;
      if (radius <= 0) return;
      const enemies = this.scene.enemiesGroup?.getChildren() || [];
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const d = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
        if (d <= radius) {
          // PR2 BALÍK D: Aura tick rate migration
          let tickRate = 0.05; // Legacy fallback
          if (this.scene.GameConfig?.validation?.features?.useConfigResolver) {
            const ConfigResolver = window.ConfigResolver || this.scene.configResolver;
            if (ConfigResolver) {
              tickRate = ConfigResolver.get('abilities.aura.tickRate', { defaultValue: 0.05 });
            }
          }
          
          const auraTickDamage = player.auraDamage * tickRate;
          this.scene.recordDamageDealt(auraTickDamage, enemy);
          if (enemy.takeDamage) enemy.takeDamage(auraTickDamage);
          if (enemy.hp <= 0) this.scene.handleEnemyDeath(enemy);
        }
      }
    } catch (_) {}
  }

  /**
   * Aplikuje změny přímo z blueprintu (inkrementálně podle nového levelu)
   */
  async applyFromBlueprint(powerUpName, newLevel) {
    // Wait for blueprints to be loaded first
    if (this._blueprintsLoaded) {
      await this._blueprintsLoaded;
    }
    
    // Import PowerUpRegistry
    const { PowerUpRegistry } = await import('../registry/PowerUpRegistry.js');
    
    const bp = PowerUpRegistry.get(powerUpName);
    if (!bp) {
      // Fallback: mapuj na starý efekt
      this.apply(this._fallbackEffect(powerUpName, newLevel));
      return;
    }
    
    const prevLevel = this.appliedLevels.get(powerUpName) || 0;
    const levelDelta = Math.max(0, (newLevel || 1) - prevLevel);
    this.appliedLevels.set(powerUpName, newLevel || 1);
    
    console.log(`[PowerUpSystem] Applying ${powerUpName} from level ${prevLevel} to ${newLevel} (delta: ${levelDelta})`);

    // 1) Modifiers (add/mul) - PR7: Read from mechanics.modifiersPerLevel
    const modifiers = bp.mechanics?.modifiersPerLevel || bp.modifiers || [];
    if (Array.isArray(modifiers)) {
        modifiers.forEach(mod => {
          const path = String(mod.path || '');
          const type = String(mod.type || 'add');
          // PR7: Blueprint uses 'value' not 'valuePerLevel'
          const perLevel = Number(mod.value || mod.valuePerLevel || 0);
          if (!path) return;
          switch (path) {
            case 'player.speed':
              if (type === 'add') {
                const delta = perLevel * levelDelta;
                this.apply({ type: 'speed', value: delta });
              }
              break;
            case 'player.maxHp':
              if (type === 'add') {
                const delta = perLevel * levelDelta;
                this.apply({ type: 'maxHp', value: delta });
              }
              break;
            case 'projectile.damage':
              if (type === 'add') {
                const delta = perLevel * levelDelta;
                this.apply({ type: 'damage', value: delta });
              }
              break;
            case 'projectile.count':
              if (type === 'add') {
                const delta = perLevel * levelDelta;
                this.apply({ type: 'projectiles', value: delta });
              }
              break;
            case 'projectile.range':
              // Range multiplier - 20% per level
              if (type === 'mul') {
                const totalMultiplier = perLevel * newLevel; // 0.2 * level
                this.apply({ type: 'projectileRange', value: totalMultiplier });
              } else {
                // Fallback na level-based
                this.apply({ type: 'projectileRange', level: newLevel || 1 });
              }
              break;
            case 'projectile.interval':
              // Negativní hodnota = zkrácení intervalu; používáme additvní redukci
              if (type === 'mul') {
                const delta = perLevel * levelDelta; // např. -0.1 na level
                this.apply({ type: 'attackSpeed', value: delta });
              }
              break;
            default:
              break;
          }
        });
      }

      // 2) Ability enablement
      if (bp.ability && bp.ability.type) {
        switch (bp.ability.type) {
          case 'radiotherapy':
            this.apply({ type: 'flamethrower', level: newLevel || 1 });
            break;
          case 'chain_lightning':
            this.apply({ type: 'lightningChain', level: newLevel || 1 });
            break;
          case 'shield':
            this.apply({ type: 'shield', level: newLevel || 1 });
            break;
          case 'aura':
            // PR7: Get aura damage from blueprint, no hardcoded values
            const per = Number(bp.ability.baseDamagePerTick);
            if (!per) {
              console.error('[PowerUpSystem] aura missing baseDamagePerTick in blueprint');
              break;
            }
            this.apply({ type: 'aura', value: per * levelDelta });
            break;
          case 'xp_magnet':
            // PR7: Get magnet values from blueprint, no hardcoded fallbacks
            if (!bp.ability) {
              console.error('[PowerUpSystem] xp_magnet missing ability section in blueprint');
              break;
            }
            const baseRange = Number(bp.ability.baseRange);
            const rangePerLevel = Number(bp.ability.rangePerLevel);
            const rangeCap = Number(bp.ability.cap);
            
            if (!baseRange || !rangePerLevel || !rangeCap) {
              console.error('[PowerUpSystem] xp_magnet missing required ability values in blueprint');
              break;
            }
            
            const lvl = newLevel || 1;
            const targetRange = Math.min(rangeCap, baseRange + rangePerLevel * (lvl - 1));
            console.log(`[PowerUpSystem] Setting XP magnet range to ${targetRange} (lvl ${lvl})`);
            
            // Apply to LootSystem
            if (this.scene.coreLootSystem) {
              this.scene.coreLootSystem.magnetRange = targetRange;
              this.scene.coreLootSystem.magnetLevel = lvl;
              console.log(`[PowerUpSystem] XP magnet applied: range=${targetRange}, level=${lvl}`);
            } else {
              console.error('[PowerUpSystem] coreLootSystem not available for magnet upgrade');
            }
            break;
          default:
            break;
        }
      }

    // 3) Emit zvuku/vizuálu aplikace power‑upu (pokud je definován v blueprintu)
    try {
      // PR7: Emit proper payload structure according to EventWhitelist
      const payload = {
        type: bp.id || 'unknown',
        level: level || 1,
        source: 'PowerUpSystem'
      };
      this.scene.eventBus && this.scene.eventBus.emit('powerup.apply', payload);
      
      // Play VFX/SFX separately
      if (bp.vfx?.apply && this.scene.vfxSystem) {
        this.scene.vfxSystem.play(bp.vfx.apply, this.scene.player?.x, this.scene.player?.y);
      }
      if (bp.sfx?.apply && this.scene.sfxSystem) {
        this.scene.sfxSystem.play(bp.sfx.apply);
      }
    } catch (_) {}
  }

  _fallbackEffect(id, level) {
    // PR7: No hardcoded values - this method should not be used
    // Log error and return empty effect
    console.error(`[PowerUpSystem] Fallback effect requested for '${id}' - blueprint should be used instead`);
    return { type: id, level };
  }
  
  /**
   * Zobrazí power-up selection modal - migrace z PowerUpManager
   */
  async showPowerUpSelection(callback) {
    try {
      // Generovat 3 náhodné power-up možnosti z registrovaných blueprintů
      const powerUpOptions = await this._generatePowerUpOptionsFromBlueprints(3);
      
      // Import PowerUpSelectionModal
      const module = await import('../../ui/PowerUpSelectionModal.js');
      const { PowerUpSelectionModal } = module;
      const modal = new PowerUpSelectionModal(this.scene, powerUpOptions, (selectedPowerUp) => {
        // Aplikovat vybraný power-up systémově přes blueprint
        if (selectedPowerUp) {
          // selectedPowerUp.id je vlastně blueprint name (viz _convertBlueprintToUIFormat)
          this.applyFromBlueprint(selectedPowerUp.id, selectedPowerUp.level + 1);
        }
        callback?.();
      });
      // PR7: Modal must be added to scene for interaction to work
      this.scene.add.existing(modal);
      modal.show();
    } catch (e) {
      console.warn('[PowerUpSystem] Failed to load PowerUpSelectionModal:', e.message);
      callback?.(); // Pokračovat i při chybě
    }
  }

  /**
   * Generuje náhodné power-up možnosti z registrovaných blueprintů
   */
  async _generatePowerUpOptionsFromBlueprints(count = 3) {
    try {
      // PR7: Use BlueprintLoader directly instead of empty PowerUpRegistry
      const blueprintLoader = this.scene.blueprintLoader || this.scene.blueprints;
      if (!blueprintLoader) {
        console.warn('[PowerUpSystem] No BlueprintLoader available');
        return this._getFallbackPowerUpOptions(); // Use fallback options
      }
      
      // Get all power-up blueprints - use getAll method
      const allPowerUps = blueprintLoader.getAll('powerup');
      const availableOptions = [];
      
      // Convert each blueprint to UI format
      for (const blueprint of allPowerUps) {
        if (!blueprint || !blueprint.id) continue;
        
        const currentLevel = this._getCurrentLevelFromBlueprint(blueprint.id, blueprint);
        
        // Filter out maxed power-ups
        if (currentLevel >= (blueprint.maxLevel || 10)) continue;
        
        // Convert blueprint to UI format
        const uiOption = this._convertBlueprintToUIFormat(blueprint, currentLevel);
        if (uiOption) {
          availableOptions.push(uiOption);
        }
      }
      
      // If no options from blueprints, use fallback
      if (availableOptions.length === 0) {
        console.log('[PowerUpSystem] No blueprint options, using fallback');
        return this._getFallbackPowerUpOptions();
      }
      
      // Randomly select requested count
      const shuffled = [...availableOptions].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(count, availableOptions.length));
      
    } catch (e) {
      console.warn('[PowerUpSystem] Failed to generate options:', e.message);
      return this._getFallbackPowerUpOptions(); // Fallback on error
    }
  }
  
  /**
   * Fallback power-up options when blueprints aren't available
   */
  _getFallbackPowerUpOptions() {
    // PR7: Hardcoded fallback options for emergency use
    return [
      {
        id: 'damage',
        name: '💪 Zvýšený útok',
        description: 'Zvyšuje poškození o 10%',
        type: 'passive',
        level: 0,
        maxLevel: 10,
        value: 10
      },
      {
        id: 'speed',
        name: '👟 Rychlost pohybu',
        description: 'Zvyšuje rychlost pohybu o 15%',
        type: 'passive',
        level: 0,
        maxLevel: 10,
        value: 15
      },
      {
        id: 'maxHp',
        name: '❤️ Více zdraví',
        description: 'Zvyšuje maximální zdraví o 20',
        type: 'passive',
        level: 0,
        maxLevel: 10,
        value: 20
      }
    ];
  }
  
  /**
   * Konvertuje blueprint na formát očekávaný PowerUpSelectionModal
   */
  _convertBlueprintToUIFormat(blueprint, currentLevel) {
    if (!blueprint || !blueprint.id) return null;
    
    return {
      id: blueprint.id, // UI očekává 'id' a blueprinty mají 'id'
      name: this._getBlueprintName(blueprint), // Použij DisplayResolver pro překlad
      description: this._getBlueprintDescription(blueprint),
      type: blueprint.category || 'passive',
      level: currentLevel,
      maxLevel: blueprint.maxLevel || 10,
      value: this._extractValueFromBlueprint(blueprint)
    };
  }
  
  /**
   * Získá aktuální level power-upu z blueprint definice
   */
  _getCurrentLevelFromBlueprint(powerUpId, blueprint) {
    const applied = this.appliedLevels.get(powerUpId) || 0;
    if (applied > 0) return applied;
    
    // Fallback: odhadni z player vlastností (kompatibilita se starým systémem)
    const player = this.scene.player;
    // Extraktuj krátký název z ID (powerup.flamethrower -> flamethrower)
    const shortName = powerUpId.replace('powerup.', '');
    switch (shortName) {
      case 'damage_boost': return Math.floor((player?.damageBonus || 0) / 5);
      case 'speed_boots': return Math.floor((player?.speedBonus || 0) / 0.1);
      case 'max_hp': return Math.floor(Math.max(0, (player?.maxHp || 100) - 100) / 20);
      case 'projectile_count': return Math.max(0, (player?.projectileCount || 1) - 1);
      case 'attack_speed': return Math.floor(Math.abs(player?.attackSpeedBonus || 0) / 0.1);
      case 'projectile_range': return Math.max(0, (player?.projectileRangeLevel || 1) - 1);
      case 'flamethrower': return player?.radiotherapyLevel || 0;
      case 'lightning_chain': return player?.lightningChainLevel || 0;
      case 'explosive_bullets': return player?.explosiveBulletsLevel || 0;
      case 'piercing_arrows': return player?.piercingArrowsLevel || 0;
      case 'shield': return player?.shieldLevel || 0;
      case 'aura': 
        // PR7: Aura level should be tracked, not calculated from damage
        return player?.auraLevel || 0;
      case 'xp_magnet': return this.scene.coreLootSystem?.magnetLevel || 0;
      default: return 0;
    }
  }
  
  /**
   * Získá název power-upu přes DisplayResolver (i18n)
   */
  _getBlueprintName(blueprint) {
    if (!blueprint) return 'Neznámý power-up';
    
    // Pokus o i18n překlad
    const translatedName = displayResolver.t(blueprint.display?.key, 'cs');
    if (translatedName) return translatedName;
    
    // Fallback na český název z cs.json
    const shortId = blueprint.id.replace('powerup.', '');
    const fallbackKey = `powerup.${shortId}.name`;
    const fallbackName = displayResolver.t(fallbackKey, 'cs');
    if (fallbackName) return fallbackName;
    
    // Poslední fallback na devNameFallback nebo ID
    return blueprint.display?.devNameFallback || blueprint.id;
  }
  
  /**
   * Získá popis power-upu přes DisplayResolver (i18n)
   */
  _getBlueprintDescription(blueprint) {
    if (!blueprint) return 'Neznámý power-up';
    
    // Pokus o i18n překlad
    const translatedDesc = displayResolver.t(blueprint.display?.descKey, 'cs');
    if (translatedDesc) return translatedDesc;
    
    // Fallback na český popis z cs.json
    const shortId = blueprint.id.replace('powerup.', '');
    const fallbackKey = `powerup.${shortId}.desc`;
    const fallbackDesc = displayResolver.t(fallbackKey, 'cs');
    if (fallbackDesc) return fallbackDesc;
    
    // Template rendering
    if (blueprint.display?.templates?.short) {
      return displayResolver.renderTemplate(blueprint.display.templates.short, blueprint, 'cs');
    }
    
    // Poslední fallback na devDescFallback
    return blueprint.display?.devDescFallback || 'Power-up vylepšení';
  }
  
  /**
   * Generuje popis z blueprint definice (deprecated - používej _getBlueprintDescription)
   */
  _generateDescriptionFromBlueprint(blueprint) {
    return this._getBlueprintDescription(blueprint);
  }
  
  /**
   * Extrahuje číselnou hodnotu z blueprint definice
   */
  _extractValueFromBlueprint(blueprint) {
    if (blueprint.modifiers && blueprint.modifiers.length > 0) {
      return blueprint.modifiers[0].valuePerLevel || 1;
    }
    if (blueprint.ability && blueprint.ability.baseDamagePerTick) {
      return blueprint.ability.baseDamagePerTick;
    }
    return 1;
  }
  
}


