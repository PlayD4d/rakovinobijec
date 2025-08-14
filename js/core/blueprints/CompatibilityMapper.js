/**
 * CompatibilityMapper - Převádí staré blueprint formáty na unified schema
 * Zajišťuje backward compatibility během migrace
 */
export class CompatibilityMapper {
  
  /**
   * Převede jakýkoli blueprint na unified formát
   * @param {object} rawBlueprint - Původní blueprint
   * @returns {object} Unified blueprint
   */
  static toUnified(rawBlueprint) {
    if (!rawBlueprint) return null;
    
    // Pokud už je unified, vrátit jak je
    if (rawBlueprint.type && rawBlueprint.display) {
      return rawBlueprint;
    }

    // Detekce typu podle struktury
    const type = this._detectType(rawBlueprint);
    
    switch (type) {
      case 'player':
        return this._mapPlayer(rawBlueprint);
      case 'enemy':
        return this._mapEnemy(rawBlueprint);
      case 'boss':
        return this._mapBoss(rawBlueprint);
      case 'powerup':
        return this._mapPowerUp(rawBlueprint);
      case 'projectile':
        return this._mapProjectile(rawBlueprint);
      case 'drop':
        return this._mapDrop(rawBlueprint);
      default:
        return this._mapGeneric(rawBlueprint, type);
    }
  }

  /**
   * Detekuje typ blueprintu podle struktury
   * @private
   */
  static _detectType(blueprint) {
    // Explicit type
    if (blueprint.type) return blueprint.type;
    
    // Detekce podle známých vlastností
    if (blueprint.name && blueprint.displayName && blueprint.maxLevel !== undefined) {
      return 'powerup';
    }
    if (blueprint.bossName || (blueprint.hp > 500 && blueprint.phases)) {
      return 'boss';  
    }
    if (blueprint.hp && blueprint.damage && blueprint.xp) {
      return 'enemy';
    }
    if (blueprint.speed && blueprint.range && blueprint.damage && !blueprint.hp) {
      return 'projectile';
    }
    if (blueprint.type === 'xp' || blueprint.type === 'health') {
      return 'drop';
    }
    if (blueprint.maxHp && !blueprint.xp) {
      return 'player';
    }

    // Fallback
    return 'unknown';
  }

  /**
   * Mapuje player blueprint
   * @private
   */
  static _mapPlayer(raw) {
    return {
      id: raw.id || 'default_player',
      type: 'player',
      
      stats: {
        maxHp: raw.maxHp || raw.hp || 100,
        speed: raw.speed || 200,
        size: raw.size || 30,
        damage: raw.damage || raw.projectileDamage || 25,
        projectileSpeed: raw.projectileSpeed || 400,
        projectileRange: raw.projectileRange || 300,
        projectileCount: raw.projectileCount || 1,
        attackSpeed: raw.attackSpeed || 1.0
      },

      mechanics: {
        invulnerabilityMs: raw.invulnerabilityMs || 1000,
        canMove: raw.canMove !== false,
        canShoot: raw.canShoot !== false
      },

      display: {
        key: 'player.default.name',
        descKey: 'player.default.desc', 
        devNameFallback: 'Player',
        devDescFallback: 'The player character',
        icon: raw.icon || 'player_icon',
        color: raw.color || '#00ff00',
        rarity: 'special',
        category: 'player',
        sortOrder: 0,
        tags: ['player', 'controllable'],
        templates: {
          short: '{{stats.maxHp}} HP, {{stats.speed}} speed',
          long: 'Player with {{stats.maxHp}} health and {{stats.speed}} movement speed'
        }
      },

      vfx: raw.vfx || {},
      sfx: raw.sfx || {},
      
      // Zachovat původní data pro kompatibilitu
      _legacy: raw
    };
  }

  /**
   * Mapuje enemy blueprint  
   * @private
   */
  static _mapEnemy(raw) {
    return {
      id: raw.id || raw.name || 'unknown_enemy',
      type: 'enemy',
      
      stats: {
        hp: raw.hp || 100,
        maxHp: raw.maxHp || raw.hp || 100,
        speed: raw.speed || 1,
        damage: raw.damage || 10,
        xp: raw.xp || 10,
        size: raw.size || 20,
        color: raw.color || 0xff0000
      },

      mechanics: {
        isElite: raw.isElite || false,
        isSupport: raw.isSupport || false,
        canShoot: raw.canShoot || false,
        buffRadius: raw.buffRadius || 0,
        buffMultiplier: raw.buffMultiplier || 1,
        shootInterval: raw.shootInterval || 2000,
        projectileType: raw.projectileType || 'normal',
        projectileDamage: raw.projectileDamage || raw.damage
      },

      display: {
        key: `enemy.${raw.id || raw.name}.name`,
        descKey: `enemy.${raw.id || raw.name}.desc`,
        devNameFallback: raw.displayName || raw.name || 'Enemy',
        devDescFallback: raw.description || 'An enemy',
        icon: raw.icon || 'enemy_icon',
        color: this._colorToHex(raw.color) || '#ff0000',
        rarity: raw.isElite ? 'rare' : 'common',
        category: 'enemy',
        sortOrder: raw.sortOrder || 100,
        tags: this._generateEnemyTags(raw),
        templates: {
          short: '{{stats.hp}} HP, {{stats.damage}} dmg',
          long: 'Enemy with {{stats.hp}} health dealing {{stats.damage}} damage'
        }
      },

      vfx: raw.vfx || raw.VfxSfx || {},
      sfx: raw.sfx || raw.VfxSfx || {},
      
      _legacy: raw
    };
  }

  /**
   * Mapuje boss blueprint
   * @private  
   */
  static _mapBoss(raw) {
    return {
      id: raw.id || raw.name || raw.bossName || 'unknown_boss',
      type: 'boss',
      
      stats: {
        hp: raw.hp || raw.maxHp || 1000,
        maxHp: raw.maxHp || raw.hp || 1000,
        speed: raw.speed || 0.5,
        damage: raw.damage || 50,
        xp: raw.xp || 500,
        size: raw.size || 60,
        color: raw.color || 0xff0000
      },

      mechanics: {
        phases: raw.phases || [],
        bossName: raw.bossName || raw.name,
        abilities: raw.abilities || [],
        immunities: raw.immunities || [],
        weaknesses: raw.weaknesses || []
      },

      display: {
        key: `boss.${raw.id || raw.bossName}.name`,
        descKey: `boss.${raw.id || raw.bossName}.desc`,
        devNameFallback: raw.displayName || raw.bossName || raw.name || 'Boss',
        devDescFallback: raw.description || 'A powerful boss enemy',
        icon: raw.icon || 'boss_icon',
        color: this._colorToHex(raw.color) || '#ff0000',
        rarity: 'boss',
        category: 'boss',
        sortOrder: raw.sortOrder || 1000,
        tags: ['boss', 'elite', ...(raw.tags || [])],
        templates: {
          short: '{{stats.hp}} HP Boss',
          long: 'Boss {{mechanics.bossName}} with {{stats.hp}} health'
        }
      },

      vfx: raw.vfx || raw.VfxSfx || {},
      sfx: raw.sfx || raw.VfxSfx || {},
      
      _legacy: raw
    };
  }

  /**
   * Mapuje power-up blueprint
   * @private
   */
  static _mapPowerUp(raw) {
    return {
      id: raw.name || raw.id || 'unknown_powerup',
      type: 'powerup',
      
      maxLevel: raw.maxLevel || 10,
      
      modifiers: raw.modifiers || [],
      ability: raw.ability || null,

      display: {
        key: `powerup.${raw.name}.name`,
        descKey: `powerup.${raw.name}.desc`, 
        devNameFallback: raw.displayName || raw.name || 'Power Up',
        devDescFallback: raw.description || 'A power up',
        icon: this._extractEmoji(raw.displayName) || raw.icon || '⭐',
        color: this._mapPowerUpColor(raw.category) || '#ffff00',
        rarity: this._mapPowerUpRarity(raw.category, raw.maxLevel),
        category: this._mapPowerUpCategory(raw.category),
        sortOrder: raw.sortOrder || 500,
        tags: this._generatePowerUpTags(raw),
        templates: {
          short: this._generatePowerUpShortTemplate(raw),
          long: this._generatePowerUpLongTemplate(raw)
        }
      },

      vfx: raw.vfx || {},
      sfx: raw.sfx || {},
      
      _legacy: raw
    };
  }

  /**
   * Mapuje projectile blueprint
   * @private
   */
  static _mapProjectile(raw) {
    return {
      id: raw.id || raw.name || 'unknown_projectile',
      type: 'projectile',
      
      stats: {
        damage: raw.damage || 25,
        speed: raw.speed || 400,
        range: raw.range || 300,
        size: raw.size || 6,
        lifespan: raw.lifespan || null
      },

      mechanics: {
        piercing: raw.piercing || false,
        homing: raw.homing || false,
        explosive: raw.explosive || false,
        homingTurnRate: raw.homingTurnRate || 0.03,
        homingDelay: raw.homingDelay || 0,
        aimError: raw.aimError || 0
      },

      display: {
        key: `projectile.${raw.id}.name`,
        descKey: `projectile.${raw.id}.desc`,
        devNameFallback: raw.name || 'Projectile',
        devDescFallback: raw.description || 'A projectile',
        icon: raw.icon || 'projectile_icon',
        color: this._colorToHex(raw.color) || '#ffffff',
        rarity: 'common',
        category: 'projectile',
        sortOrder: raw.sortOrder || 200,
        tags: this._generateProjectileTags(raw),
        templates: {
          short: '{{stats.damage}} dmg, {{stats.speed}} speed',
          long: 'Projectile dealing {{stats.damage}} damage at {{stats.speed}} speed'
        }
      },

      vfx: raw.vfx || {},
      sfx: raw.sfx || {},
      
      _legacy: raw
    };
  }

  /**
   * Mapuje drop blueprint
   * @private
   */
  static _mapDrop(raw) {
    return {
      id: raw.id || raw.type || 'unknown_drop',
      type: 'drop',
      
      stats: {
        value: raw.value || 1,
        rarity: raw.rarity || 1,
        size: raw.size || 16
      },

      mechanics: {
        magnetizable: raw.magnetizable !== false,
        lifetime: raw.lifetime || 30000,
        effect: raw.effect || null
      },

      display: {
        key: `drop.${raw.type}.name`,
        descKey: `drop.${raw.type}.desc`,
        devNameFallback: raw.displayName || raw.type || 'Drop',
        devDescFallback: raw.description || 'A collectible item',
        icon: raw.icon || this._getDropIcon(raw.type),
        color: this._getDropColor(raw.type),
        rarity: this._getDropRarity(raw.type),
        category: 'drop',
        sortOrder: raw.sortOrder || 300,
        tags: [raw.type, 'collectible'],
        templates: {
          short: '+{{stats.value}}',
          long: 'Grants {{stats.value}} {{type}}'
        }
      },

      vfx: raw.vfx || {},
      sfx: raw.sfx || {},
      
      _legacy: raw
    };
  }

  /**
   * Generic mapper pro neznámé typy
   * @private
   */
  static _mapGeneric(raw, type) {
    return {
      id: raw.id || raw.name || 'unknown',
      type: type || 'generic',
      
      display: {
        key: `${type}.${raw.id || raw.name}.name`,
        descKey: `${type}.${raw.id || raw.name}.desc`,
        devNameFallback: raw.displayName || raw.name || 'Unknown',
        devDescFallback: raw.description || 'Unknown item',
        icon: raw.icon || '?',
        color: raw.color || '#ffffff',
        rarity: 'common',
        category: type,
        sortOrder: 999,
        tags: [type],
        templates: {
          short: '{{id}}',
          long: 'Unknown item: {{id}}'
        }
      },

      _legacy: raw
    };
  }

  // === HELPER METODY ===

  /**
   * Převede hex color na string
   * @private
   */
  static _colorToHex(color) {
    if (typeof color === 'string') return color;
    if (typeof color === 'number') {
      return '#' + color.toString(16).padStart(6, '0');
    }
    return null;
  }

  /**
   * Extrahuje emoji z textu
   * @private
   */
  static _extractEmoji(text) {
    if (!text) return null;
    const emojiMatch = text.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu);
    return emojiMatch ? emojiMatch[0] : null;
  }

  /**
   * Mapuje power-up kategorii
   * @private
   */
  static _mapPowerUpCategory(category) {
    const categoryMap = {
      'weapon': 'offense',
      'passive': 'utility', 
      'defensive': 'defense',
      'ability': 'offense'
    };
    return categoryMap[category] || 'utility';
  }

  /**
   * Mapuje power-up raritu
   * @private
   */
  static _mapPowerUpRarity(category, maxLevel) {
    if (maxLevel >= 10) return 'common';
    if (maxLevel >= 5) return 'rare';
    return 'epic';
  }

  /**
   * Mapuje power-up barvu podle kategorie
   * @private
   */
  static _mapPowerUpColor(category) {
    const colorMap = {
      'weapon': '#ff6600',
      'passive': '#00ff00',
      'defensive': '#0066ff',
      'ability': '#ff0066'
    };
    return colorMap[category] || '#ffff00';
  }

  /**
   * Generuje tagy pro enemy
   * @private
   */
  static _generateEnemyTags(enemy) {
    const tags = ['enemy'];
    if (enemy.isElite) tags.push('elite');
    if (enemy.isSupport) tags.push('support');
    if (enemy.canShoot) tags.push('ranged');
    return tags;
  }

  /**
   * Generuje tagy pro power-up
   * @private
   */
  static _generatePowerUpTags(powerUp) {
    const tags = ['powerup'];
    if (powerUp.ability) tags.push('ability');
    if (powerUp.modifiers?.length > 0) tags.push('modifier');
    return tags;
  }

  /**
   * Generuje tagy pro projectile
   * @private
   */
  static _generateProjectileTags(projectile) {
    const tags = ['projectile'];
    if (projectile.piercing) tags.push('piercing');
    if (projectile.homing) tags.push('homing');
    if (projectile.explosive) tags.push('explosive');
    return tags;
  }

  /**
   * Generuje short template pro power-up
   * @private
   */
  static _generatePowerUpShortTemplate(powerUp) {
    if (powerUp.modifiers && powerUp.modifiers.length > 0) {
      const mod = powerUp.modifiers[0];
      const value = mod.valuePerLevel || mod.value || 1;
      return `+${value} per level`;
    }
    if (powerUp.ability) {
      return `Level {{level}} ability`;
    }
    return 'Power up';
  }

  /**
   * Generuje long template pro power-up
   * @private
   */
  static _generatePowerUpLongTemplate(powerUp) {
    return powerUp.description || 'Enhances player capabilities';
  }

  /**
   * Získá ikonu pro drop
   * @private
   */
  static _getDropIcon(type) {
    const iconMap = {
      'xp': '💎',
      'health': '❤️', 
      'metotrexat': '💊'
    };
    return iconMap[type] || '🎁';
  }

  /**
   * Získá barvu pro drop
   * @private
   */
  static _getDropColor(type) {
    const colorMap = {
      'xp': '#00ffff',
      'health': '#ff0000',
      'metotrexat': '#ff00ff'
    };
    return colorMap[type] || '#ffff00';
  }

  /**
   * Získá raritu pro drop
   * @private
   */
  static _getDropRarity(type) {
    const rarityMap = {
      'xp': 'common',
      'health': 'rare',
      'metotrexat': 'legendary'
    };
    return rarityMap[type] || 'common';
  }
}

export default CompatibilityMapper;