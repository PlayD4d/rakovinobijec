/**
 * SFXRegistry - Centrální registr všech zvukových efektů
 * FÁZE 4: Phaser-first SFX systém s unified blueprint integrací
 */

export class SFXRegistry {
  constructor() {
    this.sounds = new Map();
    this.preloadKeys = new Set(); // Audio klíče pro Phaser preload
    this._registerDefaultSounds();
  }

  /**
   * Registruje SFX zvuk
   * @param {string} id - Unikátní ID zvuku
   * @param {object} config - Phaser audio konfigurace
   */
  register(id, config) {
    if (this.sounds.has(id)) {
      console.warn(`SFXRegistry: Zvuk '${id}' již existuje, přepíšu.`);
    }
    
    this.sounds.set(id, {
      id,
      key: config.key, // Phaser audio key
      volume: config.volume ?? 1.0,
      loop: config.loop ?? false,
      detune: config.detune ?? 0,
      detuneRange: config.detuneRange ?? null, // [min, max] pro randomizaci
      rate: config.rate ?? 1.0,
      delay: config.delay ?? 0,
      seek: config.seek ?? 0,
      mute: config.mute ?? false,
      description: config.description || 'No description',
      category: config.category || 'sfx' // sfx, music, voice
    });
    
    // Registruj audio klíč pro preload
    if (config.key) {
      this.preloadKeys.add(config.key);
    }
  }

  /**
   * Získá SFX konfiguraci podle ID
   */
  get(id) {
    return this.sounds.get(id) || null;
  }

  /**
   * Existuje SFX zvuk?
   */
  has(id) {
    return this.sounds.has(id);
  }

  /**
   * Získá všechny klíče pro preload
   */
  getPreloadKeys() {
    return Array.from(this.preloadKeys);
  }

  /**
   * Vylistuje všechny registrované zvuky
   */
  listAll() {
    const sounds = [];
    for (const [id, config] of this.sounds) {
      sounds.push({
        id,
        key: config.key,
        category: config.category,
        description: config.description
      });
    }
    return sounds.sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Vylistuje zvuky podle kategorie
   */
  listByCategory(category) {
    const sounds = [];
    for (const [id, config] of this.sounds) {
      if (config.category === category) {
        sounds.push({ id, key: config.key, description: config.description });
      }
    }
    return sounds.sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Validuje SFX referenci z blueprintu
   */
  validate(sfxRef, blueprintId = 'unknown') {
    const errors = [];
    
    if (typeof sfxRef === 'string') {
      // Jednoduchá reference
      if (!this.has(sfxRef)) {
        errors.push(`SFX '${sfxRef}' not found in registry (blueprint: ${blueprintId})`);
      }
    } else if (typeof sfxRef === 'object') {
      // Objekt s ID a override parametry
      if (Array.isArray(sfxRef)) {
        // Array zvuků
        sfxRef.forEach((sound, index) => {
          if (typeof sound === 'string') {
            if (!this.has(sound)) {
              errors.push(`SFX array[${index}] '${sound}' not found (blueprint: ${blueprintId})`);
            }
          } else if (sound.id && !this.has(sound.id)) {
            errors.push(`SFX array[${index}].id '${sound.id}' not found (blueprint: ${blueprintId})`);
          }
        });
      } else if (sfxRef.id) {
        if (!this.has(sfxRef.id)) {
          errors.push(`SFX.id '${sfxRef.id}' not found in registry (blueprint: ${blueprintId})`);
        }
      }
    }
    
    return errors;
  }

  // === PRIVATE METHODS ===

  /**
   * Registruje výchozí SFX zvuky
   */
  _registerDefaultSounds() {
    // === HIT SOUNDS ===
    this.register('sfx.hit.soft', {
      key: 'hit_soft',
      volume: 0.6,
      detuneRange: [-100, 100],
      description: 'Měkký zásah (organické nepřátele)',
      category: 'combat'
    });

    this.register('sfx.hit.hard', {
      key: 'hit_hard',
      volume: 0.8,
      detuneRange: [-50, 50],
      description: 'Tvrdý zásah (kovové nepřátele)',
      category: 'combat'
    });

    this.register('sfx.hit.critical', {
      key: 'hit_critical',
      volume: 1.0,
      detune: 200,
      description: 'Kritický zásah',
      category: 'combat'
    });

    // === EXPLOSION SOUNDS ===
    this.register('sfx.explosion.small', {
      key: 'explosion_small',
      volume: 0.8,
      detuneRange: [-200, 200],
      description: 'Malá exploze',
      category: 'combat'
    });

    this.register('sfx.explosion.large', {
      key: 'explosion_large',
      volume: 1.0,
      detuneRange: [-100, 100],
      description: 'Velká exploze',
      category: 'combat'
    });

    // === WEAPON SOUNDS ===
    this.register('sfx.weapon.laser1', {
      key: 'laser1',
      volume: 0.4,
      detuneRange: [-300, 300],
      description: 'Laserový zásah typ 1',
      category: 'weapon'
    });

    this.register('sfx.weapon.laser2', {
      key: 'laser2', 
      volume: 0.5,
      detuneRange: [-200, 200],
      description: 'Laserový zásah typ 2',
      category: 'weapon'
    });

    this.register('sfx.weapon.machinegun', {
      key: 'machinegun',
      volume: 0.3,
      detuneRange: [-150, 150],
      description: 'Kulometný zásah',
      category: 'weapon'
    });

    // === ENEMY SOUNDS ===
    this.register('sfx.npc.spawn', {
      key: 'npc_spawn',
      volume: 0.5,
      detuneRange: [-400, 400],
      description: 'Spawn nepřítele',
      category: 'enemy'
    });

    this.register('sfx.enemy.spawn.heavy', {
      key: 'npc_spawn',
      volume: 0.6,
      detune: -200,
      description: 'Spawn těžkého nepřítele',
      category: 'enemy'
    });

    this.register('sfx.npc.hit', {
      key: 'npc_hit',
      volume: 0.6,
      detuneRange: [-200, 200],
      description: 'Nepřítel zasažen',
      category: 'enemy'
    });

    this.register('sfx.npc.death', {
      key: 'npc_death',
      volume: 0.7,
      detuneRange: [-300, 300],
      description: 'Smrt nepřítele',
      category: 'enemy'
    });

    this.register('sfx.enemy.hit.necrotic', {
      key: 'npc_hit',
      volume: 0.5,
      detune: -400,
      description: 'Nekrotický zásah',
      category: 'enemy'
    });

    this.register('sfx.enemy.death.heavy', {
      key: 'npc_death',
      volume: 0.8,
      detune: -300,
      description: 'Smrt těžkého nepřítele',
      category: 'enemy'
    });

    this.register('sfx.effect.decay', {
      key: 'decay',
      volume: 0.4,
      loop: true,
      description: 'Zvuk rozkladu',
      category: 'ambient'
    });

    // === BOSS SOUNDS ===
    this.register('sfx.boss.enter', {
      key: 'boss_enter',
      volume: 1.0,
      description: 'Boss vstup',
      category: 'boss'
    });

    this.register('sfx.boss.hit', {
      key: 'boss_hit',
      volume: 0.8,
      detuneRange: [-100, 100],
      description: 'Boss zasažen',
      category: 'boss'
    });

    this.register('sfx.boss.death', {
      key: 'boss_death',
      volume: 1.0,
      description: 'Boss smrt',
      category: 'boss'
    });

    this.register('sfx.boss.phase.change', {
      key: 'boss_phase',
      volume: 0.9,
      description: 'Boss změna fáze',
      category: 'boss'
    });

    // === PLAYER SOUNDS ===
    this.register('sfx.player.spawn', {
      key: 'player_spawn',
      volume: 0.8,
      description: 'Hráč spawn',
      category: 'player'
    });

    this.register('sfx.player.hit', {
      key: 'player_hit',
      volume: 0.7,
      description: 'Hráč zasažen',
      category: 'player'
    });

    this.register('sfx.player.death', {
      key: 'player_death',
      volume: 0.9,
      description: 'Hráč smrt',
      category: 'player'
    });

    this.register('sfx.player.shoot', {
      key: 'player_shoot',
      volume: 0.3,
      detuneRange: [-100, 100],
      description: 'Hráč střelba',
      category: 'player'
    });

    this.register('sfx.player.levelup', {
      key: 'levelup',
      volume: 0.8,
      description: 'Level up',
      category: 'player'
    });

    this.register('sfx.player.heal', {
      key: 'heal',
      volume: 0.6,
      description: 'Léčení',
      category: 'player'
    });

    // === PICKUP SOUNDS ===
    this.register('sfx.pickup.xp', {
      key: 'pickup_xp',
      volume: 0.4,
      detuneRange: [0, 500],
      description: 'XP pickup',
      category: 'pickup'
    });

    this.register('sfx.pickup.health', {
      key: 'pickup_health',
      volume: 0.6,
      description: 'Health pickup',
      category: 'pickup'
    });

    this.register('sfx.powerup.pickup', {
      key: 'powerup_pickup',
      volume: 0.7,
      description: 'Power-up pickup',
      category: 'powerup'
    });

    this.register('sfx.powerup.apply', {
      key: 'powerup_apply',
      volume: 0.5,
      description: 'Power-up aplikace',
      category: 'powerup'
    });

    this.register('sfx.powerup.levelup', {
      key: 'powerup_levelup',
      volume: 0.6,
      description: 'Power-up level up',
      category: 'powerup'
    });

    // === SPECIAL SOUNDS ===
    this.register('sfx.drop.metotrexat.pickup', {
      key: 'metotrexat',
      volume: 0.9,
      description: 'Metotrexát pickup - speciální',
      category: 'special'
    });

    this.register('sfx.drop.special.spawn', {
      key: 'special_spawn',
      volume: 0.8,
      detuneRange: [-200, 200],
      description: 'Speciální drop spawn',
      category: 'special'
    });

    // === SHIELD SOUNDS ===
    this.register('sfx.shield.block', {
      key: 'shield_block',
      volume: 0.7,
      detuneRange: [-50, 50],
      description: 'Shield blokuje útok',
      category: 'combat'
    });

    this.register('sfx.shield.break', {
      key: 'shield_break',
      volume: 0.8,
      description: 'Shield se rozbíjí',
      category: 'combat'
    });

    this.register('sfx.shield.activate', {
      key: 'shield_activate',
      volume: 0.6,
      description: 'Shield aktivace',
      category: 'powerup'
    });

    // === PROJECTILE SOUNDS ===
    this.register('sfx.projectile.fire', {
      key: 'projectile_fire',
      volume: 0.3,
      detuneRange: [-150, 150],
      description: 'Projektil vystřelen',
      category: 'projectile'
    });

    this.register('sfx.projectile.hit', {
      key: 'projectile_hit',
      volume: 0.5,
      detuneRange: [-100, 100],
      description: 'Projektil zásah',
      category: 'projectile'
    });

    this.register('sfx.projectile.ricochet', {
      key: 'ricochet',
      volume: 0.4,
      detuneRange: [-300, 300],
      description: 'Projektil ricochet',
      category: 'projectile'
    });

    console.log(`SFXRegistry: Registrováno ${this.sounds.size} výchozích zvuků`);
  }
}

// Singleton instance
export const sfxRegistry = new SFXRegistry();
export default sfxRegistry;