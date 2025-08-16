/**
 * VFXRegistry - Centrální registr všech vizuálních efektů
 * FÁZE 4: Phaser-first VFX systém s unified blueprint integrací
 */

export class VFXRegistry {
  constructor() {
    this.effects = new Map();
    this.preloadKeys = new Set(); // Klíče pro Phaser preload
    this._registerDefaultEffects();
  }

  /**
   * Registruje VFX efekt
   * @param {string} id - Unikátní ID efektu
   * @param {object} config - Phaser konfigurace
   */
  register(id, config) {
    if (this.effects.has(id)) {
      console.warn(`VFXRegistry: Efekt '${id}' již existuje, přepíšu.`);
    }
    
    this.effects.set(id, {
      id,
      type: config.type || 'particles', // particles, sprite, tween
      ...config
    });
    
    // Registruj textury pro preload
    if (config.texture) {
      this.preloadKeys.add(config.texture);
    }
  }

  /**
   * Získá VFX konfiguraci podle ID
   */
  get(id) {
    return this.effects.get(id) || null;
  }

  /**
   * Existuje VFX efekt?
   */
  has(id) {
    return this.effects.has(id);
  }

  /**
   * Získá všechny klíče pro preload
   */
  getPreloadKeys() {
    return Array.from(this.preloadKeys);
  }

  /**
   * Vylistuje všechny registrované efekty
   */
  listAll() {
    const effects = [];
    for (const [id, config] of this.effects) {
      effects.push({
        id,
        type: config.type,
        description: config.description || 'No description'
      });
    }
    return effects.sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Validuje VFX referenci z blueprintu
   */
  validate(vfxRef, blueprintId = 'unknown') {
    const errors = [];
    
    if (typeof vfxRef === 'string') {
      // Jednoduchá reference
      if (!this.has(vfxRef)) {
        errors.push(`VFX '${vfxRef}' not found in registry (blueprint: ${blueprintId})`);
      }
    } else if (typeof vfxRef === 'object') {
      // Objekt s ID a override parametry
      if (Array.isArray(vfxRef)) {
        // Array efektů
        vfxRef.forEach((effect, index) => {
          if (typeof effect === 'string') {
            if (!this.has(effect)) {
              errors.push(`VFX array[${index}] '${effect}' not found (blueprint: ${blueprintId})`);
            }
          } else if (effect.id && !this.has(effect.id)) {
            errors.push(`VFX array[${index}].id '${effect.id}' not found (blueprint: ${blueprintId})`);
          }
        });
      } else if (vfxRef.id) {
        if (!this.has(vfxRef.id)) {
          errors.push(`VFX.id '${vfxRef.id}' not found in registry (blueprint: ${blueprintId})`);
        }
      }
    }
    
    return errors;
  }

  // === PRIVATE METHODS ===

  /**
   * Registruje výchozí VFX efekty
   */
  _registerDefaultEffects() {
    // === ZÁSAH EFEKTY ===
    this.register('vfx.hit.spark', {
      type: 'particles',
      texture: 'spark',
      description: 'Základní jiskra při zásahu',
      config: {
        scale: { start: 0.3, end: 0.1 },
        speed: { min: 50, max: 150 },
        lifespan: 200,
        quantity: 8,
        blendMode: 'ADD',
        tint: 0xFFFFFF
      }
    });

    // Necrotic hit effect
    this.register('vfx.hit.spark.necrotic', {
      type: 'particles',
      texture: 'spark',
      description: 'Nekrotická jiskra při zásahu',
      config: {
        scale: { start: 0.4, end: 0.05 },
        speed: { min: 30, max: 100 },
        lifespan: 400,
        quantity: 10,
        blendMode: 'MULTIPLY',
        tint: 0x663399,
        gravityY: 50
      }
    });

    this.register('vfx.hit.blood', {
      type: 'particles',
      texture: 'blood_particle',
      description: 'Krvavý efekt při zásahu organických nepřátel',
      config: {
        scale: { start: 0.4, end: 0.0 },
        speed: { min: 30, max: 100 },
        lifespan: 400,
        quantity: 12,
        gravityY: 100,
        tint: 0xFF4444
      }
    });

    this.register('vfx.hit.metal', {
      type: 'particles', 
      texture: 'metal_spark',
      description: 'Metalické jiskry pro mechanické nepřátele',
      config: {
        scale: { start: 0.2, end: 0.05 },
        speed: { min: 80, max: 200 },
        lifespan: 150,
        quantity: 6,
        blendMode: 'ADD',
        tint: 0xCCCCFF
      }
    });

    // === EXPLOZE ===
    this.register('vfx.explosion.small', {
      type: 'particles',
      texture: 'explosion_particle',
      description: 'Malá exploze',
      config: {
        scale: { start: 0.6, end: 0.1 },
        speed: { min: 100, max: 250 },
        lifespan: 300,
        quantity: 15,
        blendMode: 'ADD',
        tint: 0xFF6600
      }
    });

    this.register('vfx.explosion.large', {
      type: 'particles',
      texture: 'explosion_particle',
      description: 'Velká exploze',
      config: {
        scale: { start: 1.2, end: 0.2 },
        speed: { min: 150, max: 400 },
        lifespan: 500,
        quantity: 25,
        blendMode: 'ADD',
        tint: 0xFF4400
      }
    });

    // === TRAIL EFEKTY ===
    this.register('vfx.trail.basic', {
      type: 'particles',
      texture: 'trail_particle',
      description: 'Základní trail za projektily',
      config: {
        scale: { start: 0.3, end: 0.0 },
        speed: 20,
        lifespan: 200,
        frequency: 50,
        alpha: { start: 0.8, end: 0.0 },
        follow: true
      }
    });

    this.register('vfx.trail.fire', {
      type: 'particles',
      texture: 'fire_particle',
      description: 'Ohnivý trail',
      config: {
        scale: { start: 0.4, end: 0.1 },
        speed: 30,
        lifespan: 300,
        frequency: 30,
        alpha: { start: 1.0, end: 0.0 },
        tint: 0xFF4400,
        follow: true
      }
    });

    // === DEATH EFEKTY ===
    this.register('vfx.death.burst.red', {
      type: 'particles',
      texture: 'blood_particle',
      description: 'Červený burst při smrti',
      config: {
        scale: { start: 0.5, end: 0.0 },
        speed: { min: 80, max: 180 },
        lifespan: 600,
        quantity: 20,
        gravityY: 50,
        tint: 0xFF2222
      }
    });

    this.register('vfx.death.burst.green', {
      type: 'particles',
      texture: 'organic_particle',
      description: 'Zelený burst při smrti',
      config: {
        scale: { start: 0.4, end: 0.0 },
        speed: { min: 60, max: 140 },
        lifespan: 500,
        quantity: 18,
        tint: 0x22FF22
      }
    });

    this.register('vfx.death.burst.boss', {
      type: 'particles',
      texture: 'boss_particle',
      description: 'Velký boss death efekt',
      config: {
        scale: { start: 1.0, end: 0.0 },
        speed: { min: 100, max: 300 },
        lifespan: 1000,
        quantity: 40,
        blendMode: 'ADD',
        tint: 0xFFAA00
      }
    });

    // === SPAWN EFEKTY ===
    this.register('vfx.spawn.enemy', {
      type: 'particles',
      texture: 'spawn_particle',
      description: 'Spawn efekt pro nepřátele',
      config: {
        scale: { start: 0.0, end: 0.3, ease: 'Power2' },
        speed: { min: 50, max: 120 },
        lifespan: 400,
        quantity: 12,
        alpha: { start: 0.0, end: 1.0, ease: 'Power2' },
        tint: 0x8844AA
      }
    });

    // Necrotic spawn effect
    this.register('vfx.enemy.spawn.necrotic', {
      type: 'particles',
      texture: 'spawn_particle',
      description: 'Spawn efekt pro nekrotické nepřátele',
      config: {
        scale: { start: 0.0, end: 0.4, ease: 'Power2' },
        speed: { min: 20, max: 60 },
        lifespan: 600,
        quantity: 15,
        alpha: { start: 0.0, end: 0.8, ease: 'Power2' },
        tint: 0x4B0082,
        gravityY: 20
      }
    });

    // Enemy buff aura effect
    this.register('vfx.enemy.buff.aura', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Buff aura efekt pro support enemies',
      config: {
        scale: { start: 0.2, end: 0.0 },
        speed: { min: 30, max: 80 },
        lifespan: 500,
        quantity: 8,
        alpha: { start: 0.8, end: 0.0 },
        tint: 0x8800FF,
        blendMode: 'ADD',
        gravityY: -50
      }
    });

    // Necrotic aura effect
    this.register('vfx.enemy.aura.necrotic', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Nekrotická aura',
      config: {
        scale: { start: 0.3, end: 0.0 },
        speed: { min: 10, max: 40 },
        lifespan: 800,
        quantity: 6,
        alpha: { start: 0.6, end: 0.0 },
        tint: 0x4B0082,
        blendMode: 'MULTIPLY',
        gravityY: -20
      }
    });

    // Decay effect
    this.register('vfx.effect.decay', {
      type: 'particles',
      texture: 'decay_particle',
      description: 'Efekt rozkladu',
      config: {
        scale: { start: 0.2, end: 0.0 },
        speed: { min: 5, max: 20 },
        lifespan: 1000,
        quantity: 4,
        alpha: { start: 0.4, end: 0.0 },
        tint: 0x663399,
        gravityY: 10
      }
    });

    // Necrotic death burst
    this.register('vfx.enemy.death.necrotic.burst', {
      type: 'particles',
      texture: 'organic_particle',
      description: 'Nekrotický výbuch při smrti',
      config: {
        scale: { start: 0.5, end: 0.0 },
        speed: { min: 40, max: 120 },
        lifespan: 700,
        quantity: 20,
        tint: 0x4B0082,
        gravityY: 80
      }
    });

    this.register('vfx.spawn.boss', {
      type: 'particles',
      texture: 'boss_spawn_particle',
      description: 'Spawn efekt pro bossy',
      config: {
        scale: { start: 0.0, end: 0.8, ease: 'Power3' },
        speed: { min: 80, max: 200 },
        lifespan: 800,
        quantity: 30,
        blendMode: 'ADD',
        tint: 0xFF4400
      }
    });

    // === PICKUP EFEKTY ===
    this.register('vfx.pickup.xp', {
      type: 'particles',
      texture: 'xp_particle',
      description: 'XP pickup efekt',
      config: {
        scale: { start: 0.3, end: 0.0 },
        speed: { min: 30, max: 80 },
        lifespan: 300,
        quantity: 8,
        gravityY: -50,
        tint: 0x00FF88
      }
    });

    this.register('vfx.pickup.powerup', {
      type: 'particles',
      texture: 'power_particle',
      description: 'Power-up pickup efekt',
      config: {
        scale: { start: 0.5, end: 0.0 },
        speed: { min: 50, max: 120 },
        lifespan: 500,
        quantity: 15,
        blendMode: 'ADD',
        tint: 0xFFFF00
      }
    });

    this.register('vfx.pickup.health', {
      type: 'particles',
      texture: 'xp_particle',
      description: 'Health pickup efekt',
      config: {
        scale: { start: 0.4, end: 0.0 },
        speed: { min: 40, max: 100 },
        lifespan: 400,
        quantity: 10,
        gravityY: -30,
        tint: 0xFF4444
      }
    });

    // === FLASH EFEKTY ===
    this.register('vfx.flash.damage', {
      type: 'sprite',
      texture: 'white_square',
      description: 'Bílý flash při poškození',
      animation: {
        type: 'tween',
        duration: 100,
        props: {
          alpha: { from: 0.8, to: 0.0 },
          scaleX: { from: 1.0, to: 1.2 },
          scaleY: { from: 1.0, to: 1.2 }
        },
        ease: 'Power2'
      }
    });

    this.register('vfx.flash.strong', {
      type: 'sprite',
      texture: 'white_circle',
      description: 'Silný flash pro speciální eventy',
      animation: {
        type: 'tween',
        duration: 200,
        props: {
          alpha: { from: 1.0, to: 0.0 },
          scaleX: { from: 0.5, to: 3.0 },
          scaleY: { from: 0.5, to: 3.0 }
        },
        ease: 'Power3'
      }
    });

    // === MUZZLE EFEKTY ===
    this.register('vfx.muzzle.basic', {
      type: 'particles',
      texture: 'muzzle_particle',
      description: 'Základní muzzle flash',
      config: {
        scale: { start: 0.4, end: 0.0 },
        speed: { min: 20, max: 60 },
        lifespan: 100,
        quantity: 5,
        blendMode: 'ADD',
        tint: 0xFFFFAA
      }
    });

    // === PLAYER EFEKTY ===
    this.register('vfx.player.spawn', {
      type: 'particles',
      texture: 'spawn_particle',
      description: 'Hráč spawn efekt',
      config: {
        scale: { start: 0.0, end: 0.5, ease: 'Power2' },
        speed: { min: 60, max: 140 },
        lifespan: 500,
        quantity: 15,
        alpha: { start: 0.0, end: 1.0, ease: 'Power2' },
        tint: 0x4444FF
      }
    });

    this.register('vfx.player.hit', {
      type: 'particles',
      texture: 'blood_particle',
      description: 'Hráč zasažen efekt',
      config: {
        scale: { start: 0.4, end: 0.0 },
        speed: { min: 50, max: 120 },
        lifespan: 300,
        quantity: 8,
        gravityY: 80,
        tint: 0xFF4444
      }
    });

    this.register('vfx.player.death', {
      type: 'particles',
      texture: 'explosion_particle',
      description: 'Hráč smrt efekt',
      config: {
        scale: { start: 0.8, end: 0.0 },
        speed: { min: 100, max: 250 },
        lifespan: 800,
        quantity: 25,
        blendMode: 'ADD',
        tint: 0xFF2222
      }
    });

    this.register('vfx.player.levelup', {
      type: 'particles',
      texture: 'xp_particle',
      description: 'Hráč level up efekt',
      config: {
        scale: { start: 0.6, end: 0.0 },
        speed: { min: 80, max: 180 },
        lifespan: 600,
        quantity: 20,
        gravityY: -100,
        blendMode: 'ADD',
        tint: 0x00FF00
      }
    });

    this.register('vfx.player.invulnerable', {
      type: 'sprite',
      texture: 'white_circle',
      description: 'Hráč neranitelnost efekt',
      animation: {
        type: 'tween',
        duration: 150,
        props: {
          alpha: { from: 0.0, to: 0.3 },
          scaleX: { from: 1.0, to: 1.5 },
          scaleY: { from: 1.0, to: 1.5 }
        },
        ease: 'Power2',
        yoyo: true,
        repeat: 3
      }
    });

    this.register('vfx.player.heal', {
      type: 'particles',
      texture: 'xp_particle',
      description: 'Hráč léčení efekt',
      config: {
        scale: { start: 0.3, end: 0.0 },
        speed: { min: 30, max: 80 },
        lifespan: 400,
        quantity: 12,
        gravityY: -60,
        tint: 0x00FF44
      }
    });

    // === SHIELD EFEKTY ===
    this.register('vfx.shield.block', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Shield blokování útoku',
      config: {
        scale: { start: 0.8, end: 0.0 },
        speed: { min: 100, max: 200 },
        lifespan: 300,
        quantity: 15,
        blendMode: 'ADD',
        tint: 0x00FFFF,
        angle: { min: 0, max: 360 }
      }
    });

    this.register('vfx.shield.break', {
      type: 'particles',
      texture: 'spark',
      description: 'Shield rozbit',
      config: {
        scale: { start: 1.0, end: 0.0 },
        speed: { min: 150, max: 300 },
        lifespan: 500,
        quantity: 25,
        blendMode: 'ADD',
        tint: 0x00CCFF,
        angle: { min: 0, max: 360 }
      }
    });

    this.register('vfx.shield.pickup', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Shield pickup efekt',
      config: {
        scale: { start: 0.5, end: 0.0 },
        speed: { min: 50, max: 120 },
        lifespan: 400,
        quantity: 12,
        gravityY: -50,
        blendMode: 'ADD',
        tint: 0x00FFFF
      }
    });

    this.register('vfx.powerup.pickup.shield', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Shield powerup pickup efekt',
      config: {
        scale: { start: 0.6, end: 0.0 },
        speed: { min: 60, max: 140 },
        lifespan: 500,
        quantity: 18,
        gravityY: -60,
        blendMode: 'ADD',
        tint: 0x607D8B
      }
    });

    // === WEAPON/PROJECTILE EFEKTY ===
    this.register('vfx.weapon.muzzle', {
      type: 'particles',
      texture: 'muzzle_particle',
      description: 'Muzzle flash při výstřelu',
      config: {
        scale: { start: 0.3, end: 0.0 },
        speed: { min: 20, max: 50 },
        lifespan: 80,
        quantity: 3,
        blendMode: 'ADD',
        tint: 0xFFFFAA
      }
    });

    this.register('vfx.projectile.impact', {
      type: 'particles',
      texture: 'spark',
      description: 'Projektil dopad efekt',
      config: {
        scale: { start: 0.2, end: 0.0 },
        speed: { min: 80, max: 150 },
        lifespan: 150,
        quantity: 6,
        blendMode: 'ADD',
        tint: 0xFFEE88
      }
    });

    // === BOSS EFEKTY ===
    this.register('vfx.boss.spawn', {
      type: 'particles',
      texture: 'boss_spawn_particle',
      description: 'Boss spawn s intenzivním efektem',
      config: {
        scale: { start: 0.0, end: 1.0, ease: 'Power3' },
        speed: { min: 100, max: 250 },
        lifespan: 1000,
        quantity: 40,
        blendMode: 'ADD',
        tint: 0xFF4400
      }
    });

    this.register('vfx.boss.hit.heavy', {
      type: 'particles',
      texture: 'metal_spark',
      description: 'Těžký zásah bosse',
      config: {
        scale: { start: 0.6, end: 0.1 },
        speed: { min: 120, max: 300 },
        lifespan: 400,
        quantity: 15,
        blendMode: 'ADD',
        tint: 0xFFCC00
      }
    });

    this.register('vfx.boss.hit.medium', {
      type: 'particles',
      texture: 'metal_spark',
      description: 'Střední zásah bosse',
      config: {
        scale: { start: 0.4, end: 0.08 },
        speed: { min: 100, max: 250 },
        lifespan: 350,
        quantity: 12,
        blendMode: 'ADD',
        tint: 0xFFAA00
      }
    });

    this.register('vfx.boss.phase.change', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Boss změna fáze',
      config: {
        scale: { start: 1.0, end: 0.0 },
        speed: { min: 80, max: 200 },
        lifespan: 800,
        quantity: 30,
        blendMode: 'ADD',
        tint: 0xFF00FF
      }
    });

    this.register('vfx.boss.muzzle.fan', {
      type: 'particles',
      texture: 'muzzle_particle',
      description: 'Boss fan střelba muzzle',
      config: {
        scale: { start: 0.5, end: 0.0 },
        speed: { min: 30, max: 80 },
        lifespan: 150,
        quantity: 8,
        blendMode: 'ADD',
        tint: 0xFFAA00
      }
    });

    this.register('vfx.boss.muzzle.tracking', {
      type: 'particles',
      texture: 'muzzle_particle',
      description: 'Boss tracking střelba muzzle',
      config: {
        scale: { start: 0.4, end: 0.0 },
        speed: { min: 20, max: 60 },
        lifespan: 120,
        quantity: 5,
        blendMode: 'ADD',
        tint: 0xFF6600
      }
    });

    this.register('vfx.boss.muzzle.circle', {
      type: 'particles',
      texture: 'muzzle_particle',
      description: 'Boss kruhová střelba muzzle',
      config: {
        scale: { start: 0.6, end: 0.0 },
        speed: { min: 40, max: 100 },
        lifespan: 200,
        quantity: 12,
        blendMode: 'ADD',
        tint: 0xFFDD00
      }
    });

    // === BOSS SPECIFIC VFX EFEKTY ===
    
    // Boss spawn efekty
    this.register('vfx.boss.spawn.radiation', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Radiační boss spawn',
      config: {
        scale: { start: 0.0, end: 1.2, ease: 'Power3' },
        speed: { min: 120, max: 280 },
        lifespan: 1200,
        quantity: 50,
        blendMode: 'ADD',
        tint: 0x4CAF50,
        gravityY: -20
      }
    });

    this.register('vfx.boss.spawn.onkogen', {
      type: 'particles',
      texture: 'energy_particle', 
      description: 'Onkogen boss spawn',
      config: {
        scale: { start: 0.0, end: 1.0, ease: 'Power3' },
        speed: { min: 100, max: 250 },
        lifespan: 1000,
        quantity: 40,
        blendMode: 'ADD',
        tint: 0xFF5722
      }
    });

    // Boss phase efekty
    this.register('vfx.boss.phase.radiation.low', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Radiační boss fáze 1',
      config: {
        scale: { start: 0.8, end: 0.0 },
        speed: { min: 60, max: 150 },
        lifespan: 600,
        quantity: 20,
        blendMode: 'ADD',
        tint: 0x81C784
      }
    });

    this.register('vfx.boss.phase.radiation.medium', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Radiační boss fáze 2',
      config: {
        scale: { start: 1.0, end: 0.0 },
        speed: { min: 80, max: 180 },
        lifespan: 700,
        quantity: 25,
        blendMode: 'ADD',
        tint: 0x4CAF50
      }
    });

    this.register('vfx.boss.phase.radiation.high', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Radiační boss fáze 3',
      config: {
        scale: { start: 1.2, end: 0.0 },
        speed: { min: 100, max: 220 },
        lifespan: 800,
        quantity: 35,
        blendMode: 'ADD',
        tint: 0x2E7D32
      }
    });

    // Boss ability efekty
    this.register('vfx.boss.radiation.pulse', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Radiační puls útok',
      config: {
        scale: { start: 1.5, end: 0.0 },
        speed: { min: 150, max: 300 },
        lifespan: 500,
        quantity: 30,
        blendMode: 'ADD',
        tint: 0x4CAF50,
        angle: { min: 0, max: 360 }
      }
    });

    this.register('vfx.boss.spawn.minions', {
      type: 'particles',
      texture: 'spawn_particle',
      description: 'Boss spawn minions efekt',
      config: {
        scale: { start: 0.0, end: 0.6, ease: 'Power2' },
        speed: { min: 80, max: 160 },
        lifespan: 600,
        quantity: 15,
        alpha: { start: 0.0, end: 1.0, ease: 'Power2' },
        tint: 0x8844AA
      }
    });

    this.register('vfx.boss.radiation.beam', {
      type: 'particles',
      texture: 'muzzle_particle',
      description: 'Radiační paprsek útok',
      config: {
        scale: { start: 0.8, end: 0.0 },
        speed: { min: 50, max: 120 },
        lifespan: 300,
        quantity: 12,
        blendMode: 'ADD',
        tint: 0x4CAF50
      }
    });

    this.register('vfx.boss.radiation.storm', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Radiační bouře útok',
      config: {
        scale: { start: 1.0, end: 0.0 },
        speed: { min: 100, max: 250 },
        lifespan: 800,
        quantity: 40,
        blendMode: 'ADD',
        tint: 0x4CAF50,
        gravityY: -30
      }
    });

    this.register('vfx.boss.radiation.overload', {
      type: 'particles',
      texture: 'explosion_particle',
      description: 'Core overload exploze',
      config: {
        scale: { start: 2.0, end: 0.0 },
        speed: { min: 200, max: 400 },
        lifespan: 800,
        quantity: 60,
        blendMode: 'ADD',
        tint: 0x4CAF50
      }
    });

    this.register('vfx.boss.circle.burst', {
      type: 'particles',
      texture: 'muzzle_particle',
      description: 'Boss kruhový burst',
      config: {
        scale: { start: 1.0, end: 0.0 },
        speed: { min: 120, max: 250 },
        lifespan: 400,
        quantity: 20,
        blendMode: 'ADD',
        tint: 0xFF5722,
        angle: { min: 0, max: 360 }
      }
    });

    this.register('vfx.boss.dash.onkogen', {
      type: 'particles',
      texture: 'trail_particle',
      description: 'Onkogen dash útok',
      config: {
        scale: { start: 0.8, end: 0.0 },
        speed: { min: 80, max: 150 },
        lifespan: 300,
        quantity: 15,
        blendMode: 'ADD',
        tint: 0xFF5722,
        follow: true
      }
    });

    this.register('vfx.boss.laser.sweep', {
      type: 'particles',
      texture: 'muzzle_particle',
      description: 'Boss laser sweep',
      config: {
        scale: { start: 1.2, end: 0.0 },
        speed: { min: 100, max: 200 },
        lifespan: 600,
        quantity: 25,
        blendMode: 'ADD',
        tint: 0xFF3300
      }
    });

    this.register('vfx.boss.enrage.aura', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Boss enrage aura',
      config: {
        scale: { start: 1.5, end: 0.0 },
        speed: { min: 50, max: 120 },
        lifespan: 1000,
        quantity: 30,
        blendMode: 'ADD',
        tint: 0xFF0000,
        gravityY: -40
      }
    });

    // Boss death efekty
    this.register('vfx.boss.death.radiation.explosion', {
      type: 'particles',
      texture: 'explosion_particle',
      description: 'Radiační boss smrt',
      config: {
        scale: { start: 2.5, end: 0.0 },
        speed: { min: 200, max: 500 },
        lifespan: 1200,
        quantity: 80,
        blendMode: 'ADD',
        tint: 0x4CAF50
      }
    });

    this.register('vfx.boss.death.explosion', {
      type: 'particles',
      texture: 'explosion_particle',
      description: 'Boss explozní smrt',
      config: {
        scale: { start: 2.0, end: 0.0 },
        speed: { min: 150, max: 400 },
        lifespan: 1000,
        quantity: 60,
        blendMode: 'ADD',
        tint: 0xFF4400
      }
    });

    // Boss victory efekt
    this.register('vfx.boss.victory', {
      type: 'particles',
      texture: 'xp_particle',
      description: 'Boss poražen victory efekt',
      config: {
        scale: { start: 1.0, end: 0.0 },
        speed: { min: 100, max: 300 },
        lifespan: 1500,
        quantity: 50,
        blendMode: 'ADD',
        tint: 0xFFD700,
        gravityY: -100
      }
    });
    
    // === CHYBĚJÍCÍ BOSS VFX EFEKTY ===
    
    // Beam warning efekt
    this.register('vfx.boss.beam.warning', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Varování před beam útokem',
      config: {
        scale: { start: 0.2, end: 0.8 },
        speed: { min: 20, max: 50 },
        lifespan: 1500,
        quantity: 8,
        blendMode: 'ADD',
        tint: 0xFF9800,
        alpha: { start: 0.8, end: 0.2 }
      }
    });
    
    // Rapid beam efekt
    this.register('vfx.boss.beam.rapid', {
      type: 'particles',
      texture: 'muzzle_particle',
      description: 'Rychlé paprsky',
      config: {
        scale: { start: 1.0, end: 0.0 },
        speed: { min: 300, max: 500 },
        lifespan: 200,
        quantity: 15,
        blendMode: 'ADD',
        tint: 0x4CAF50,
        angle: { min: -15, max: 15 }
      }
    });
    
    // Core overload charge efekt
    this.register('vfx.boss.overload.charge', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Nabíjení core overload',
      config: {
        scale: { start: 0.1, end: 1.5 },
        speed: { min: 50, max: 150 },
        lifespan: 2000,
        quantity: 40,
        blendMode: 'ADD',
        tint: 0xFF0000,
        gravityY: -50,
        alpha: { start: 0.2, end: 1.0 }
      }
    });
    
    // Core overload explosion efekt
    this.register('vfx.boss.overload.explosion', {
      type: 'particles',
      texture: 'explosion_particle',
      description: 'Exploze core overload',
      config: {
        scale: { start: 3.0, end: 0.0 },
        speed: { min: 300, max: 600 },
        lifespan: 1000,
        quantity: 80,
        blendMode: 'ADD',
        tint: 0x4CAF50,
        angle: { min: 0, max: 360 }
      }
    });
    
    // Radiation aura efekt
    this.register('vfx.boss.radiation.aura', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Radiační aura kolem bosse',
      config: {
        scale: { start: 0.5, end: 0.0 },
        speed: { min: 30, max: 80 },
        lifespan: 1500,
        quantity: 20,
        blendMode: 'ADD',
        tint: 0x4CAF50,
        gravityY: -20,
        alpha: { start: 0.6, end: 0.0 },
        follow: true
      }
    });

    // Boss phase efekty pro onkogen
    this.register('vfx.boss.phase.moderate', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Boss střední fáze',
      config: {
        scale: { start: 0.8, end: 0.0 },
        speed: { min: 70, max: 160 },
        lifespan: 600,
        quantity: 20,
        blendMode: 'ADD',
        tint: 0xFFA500
      }
    });

    this.register('vfx.boss.phase.aggressive', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Boss agresivní fáze',
      config: {
        scale: { start: 1.0, end: 0.0 },
        speed: { min: 90, max: 200 },
        lifespan: 700,
        quantity: 30,
        blendMode: 'ADD',
        tint: 0xFF5722
      }
    });

    this.register('vfx.boss.phase.extreme', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Boss extrémní fáze',
      config: {
        scale: { start: 1.3, end: 0.0 },
        speed: { min: 120, max: 250 },
        lifespan: 800,
        quantity: 40,
        blendMode: 'ADD',
        tint: 0xFF0000
      }
    });

    // === ELITE ENEMY EFEKTY ===
    this.register('vfx.elite.spawn.tank', {
      type: 'particles',
      texture: 'energy_particle',
      description: 'Elite tank spawn efekt',
      config: {
        scale: { start: 0.0, end: 0.6, ease: 'Power2' },
        speed: { min: 60, max: 150 },
        lifespan: 600,
        quantity: 20,
        alpha: { start: 0.0, end: 0.9, ease: 'Power2' },
        tint: 0x9E9E9E,
        blendMode: 'ADD'
      }
    });
    
    this.register('vfx.elite.aura.tank', {
      type: 'particles',
      texture: 'shield_particle',
      description: 'Elite tank aura',
      config: {
        scale: { start: 0.3, end: 0.1 },
        speed: { min: 20, max: 50 },
        lifespan: 800,
        quantity: 3,
        alpha: { start: 0.6, end: 0.0 },
        tint: 0x00FFFF,
        blendMode: 'ADD',
        frequency: 100
      }
    });
    
    this.register('vfx.elite.death.tank_explosion', {
      type: 'particles',
      texture: 'metal_chunk',
      description: 'Elite tank death explosion',
      config: {
        scale: { start: 0.8, end: 0.2 },
        speed: { min: 150, max: 300 },
        lifespan: 800,
        quantity: 25,
        gravityY: 200,
        tint: 0x9E9E9E
      }
    });
    
    this.register('vfx.hit.spark.heavy', {
      type: 'particles',
      texture: 'spark',
      description: 'Heavy hit spark for elite enemies',
      config: {
        scale: { start: 0.5, end: 0.1 },
        speed: { min: 80, max: 200 },
        lifespan: 300,
        quantity: 12,
        blendMode: 'ADD',
        tint: 0xFFDD00
      }
    });
    
    // === UNIQUE ENEMY EFEKTY ===
    this.register('vfx.unique.spawn.golden', {
      type: 'particles',
      texture: 'gold_particle',
      description: 'Golden unique spawn',
      config: {
        scale: { start: 0.0, end: 0.8, ease: 'Power3' },
        speed: { min: 80, max: 200 },
        lifespan: 1000,
        quantity: 30,
        alpha: { start: 0.0, end: 1.0, ease: 'Power2' },
        tint: 0xFFD700,
        blendMode: 'ADD'
      }
    });
    
    this.register('vfx.unique.aura.golden', {
      type: 'particles',
      texture: 'sparkle',
      description: 'Golden aura for unique enemies',
      config: {
        scale: { start: 0.4, end: 0.0 },
        speed: { min: 30, max: 80 },
        lifespan: 1000,
        quantity: 5,
        alpha: { start: 0.8, end: 0.0 },
        tint: 0xFFD700,
        blendMode: 'ADD',
        frequency: 80
      }
    });
    
    this.register('vfx.unique.death.golden_explosion', {
      type: 'particles',
      texture: 'gold_particle',
      description: 'Golden unique death',
      config: {
        scale: { start: 1.0, end: 0.0 },
        speed: { min: 200, max: 400 },
        lifespan: 1000,
        quantity: 40,
        tint: 0xFFD700,
        blendMode: 'ADD'
      }
    });
    
    this.register('vfx.unique.golden.pulse', {
      type: 'particles',
      texture: 'energy_wave',
      description: 'Golden pulse wave',
      config: {
        scale: { start: 0.5, end: 2.0 },
        speed: 0,
        lifespan: 500,
        quantity: 1,
        alpha: { start: 0.8, end: 0.0 },
        tint: 0xFFD700,
        blendMode: 'ADD'
      }
    });
    
    this.register('vfx.hit.spark.golden', {
      type: 'particles',
      texture: 'gold_spark',
      description: 'Golden hit effect',
      config: {
        scale: { start: 0.6, end: 0.1 },
        speed: { min: 100, max: 250 },
        lifespan: 400,
        quantity: 15,
        blendMode: 'ADD',
        tint: 0xFFD700
      }
    });
    
    // Shield effects for elite entities
    this.register('vfx.elite.shield.active', {
      type: 'particles',
      texture: 'shield_particle',
      description: 'Active shield effect',
      config: {
        scale: { start: 0.4, end: 0.1 },
        speed: { min: 10, max: 30 },
        lifespan: 600,
        quantity: 2,
        alpha: { start: 0.5, end: 0.0 },
        tint: 0x00FFFF,
        blendMode: 'ADD',
        frequency: 150
      }
    });
    
    this.register('vfx.elite.shield.impact', {
      type: 'particles',
      texture: 'shield_impact',
      description: 'Shield impact effect',
      config: {
        scale: { start: 0.3, end: 0.8 },
        speed: 0,
        lifespan: 200,
        quantity: 1,
        alpha: { start: 0.9, end: 0.0 },
        tint: 0x00FFFF,
        blendMode: 'ADD'
      }
    });

    console.log(`VFXRegistry: Registrováno ${this.effects.size} výchozích efektů`);
  }
}

// Singleton instance
export const vfxRegistry = new VFXRegistry();
export default vfxRegistry;