/**
 * BlueprintValidator - Validace blueprintů v development módu
 * Kontroluje strukturu, reference a placeholdery
 */
export class BlueprintValidator {
  
  /**
   * Validuje blueprint a vrací seznam chyb
   * @param {object} blueprint - Unified blueprint
   * @returns {Array<string>} Array of error messages
   */
  static validate(blueprint) {
    const errors = [];
    
    if (!blueprint) {
      errors.push('Blueprint is null or undefined');
      return errors;
    }

    // Základní povinné vlastnosti
    this._validateRequired(blueprint, errors);
    
    // Struktura display
    this._validateDisplay(blueprint, errors);
    
    // Typ-specifické validace  
    this._validateByType(blueprint, errors);
    
    // Reference a závislosti
    this._validateReferences(blueprint, errors);
    
    // Placeholdery v templates
    this._validateTemplates(blueprint, errors);

    return errors;
  }

  /**
   * Validuje povinné základní vlastnosti
   * @private
   */
  static _validateRequired(blueprint, errors) {
    if (!blueprint.id) {
      errors.push('Missing required field: id');
    }
    
    if (!blueprint.type) {
      errors.push('Missing required field: type');
    }
    
    if (blueprint.id && typeof blueprint.id !== 'string') {
      errors.push('Field id must be a string');
    }
    
    const validTypes = ['player', 'enemy', 'boss', 'powerup', 'projectile', 'drop', 'vfx', 'sfx'];
    if (blueprint.type && !validTypes.includes(blueprint.type)) {
      errors.push(`Invalid type: ${blueprint.type}. Valid types: ${validTypes.join(', ')}`);
    }
  }

  /**
   * Validuje display sekci
   * @private
   */
  static _validateDisplay(blueprint, errors) {
    if (!blueprint.display) {
      errors.push('Missing required section: display');
      return;
    }

    const display = blueprint.display;
    
    // Povinné i18n klíče
    if (!display.key) {
      errors.push('Missing required field: display.key');
    }
    
    if (!display.descKey) {
      errors.push('Missing required field: display.descKey');
    }
    
    // Fallback texty pro dev
    if (!display.devNameFallback) {
      errors.push('Missing recommended field: display.devNameFallback');
    }
    
    if (!display.devDescFallback) {
      errors.push('Missing recommended field: display.devDescFallback');
    }
    
    // Barva formát
    if (display.color && !this._isValidColor(display.color)) {
      errors.push(`Invalid color format: ${display.color}. Expected hex string like #ff0000`);
    }
    
    // Validní rarity
    const validRarities = ['common', 'rare', 'epic', 'legendary', 'boss', 'special'];
    if (display.rarity && !validRarities.includes(display.rarity)) {
      errors.push(`Invalid rarity: ${display.rarity}. Valid rarities: ${validRarities.join(', ')}`);
    }
    
    // Validní kategorie
    const validCategories = ['offense', 'defense', 'utility', 'special', 'enemy', 'boss', 'player', 'projectile', 'drop'];
    if (display.category && !validCategories.includes(display.category)) {
      errors.push(`Invalid category: ${display.category}. Valid categories: ${validCategories.join(', ')}`);
    }
    
    // SortOrder musí být číslo
    if (display.sortOrder !== undefined && typeof display.sortOrder !== 'number') {
      errors.push('Field display.sortOrder must be a number');
    }
    
    // Tags musí být array
    if (display.tags && !Array.isArray(display.tags)) {
      errors.push('Field display.tags must be an array');
    }
  }

  /**
   * Validuje podle typu blueprintu
   * @private
   */
  static _validateByType(blueprint, errors) {
    switch (blueprint.type) {
      case 'player':
        this._validatePlayer(blueprint, errors);
        break;
      case 'enemy':
      case 'boss':
        this._validateEnemy(blueprint, errors);
        break;
      case 'powerup':
        this._validatePowerUp(blueprint, errors);
        break;
      case 'projectile':
        this._validateProjectile(blueprint, errors);
        break;
      case 'drop':
        this._validateDrop(blueprint, errors);
        break;
    }
  }

  /**
   * Validuje player blueprint
   * @private
   */
  static _validatePlayer(blueprint, errors) {
    if (!blueprint.stats) {
      errors.push('Player blueprint missing stats section');
      return;
    }
    
    const required = ['maxHp', 'speed'];
    for (const field of required) {
      if (blueprint.stats[field] === undefined) {
        errors.push(`Player blueprint missing stats.${field}`);
      } else if (typeof blueprint.stats[field] !== 'number' || blueprint.stats[field] <= 0) {
        errors.push(`Player blueprint stats.${field} must be positive number`);
      }
    }
  }

  /**
   * Validuje enemy/boss blueprint
   * @private
   */
  static _validateEnemy(blueprint, errors) {
    if (!blueprint.stats) {
      errors.push(`${blueprint.type} blueprint missing stats section`);
      return;
    }
    
    const required = ['hp', 'speed', 'damage', 'xp', 'size'];
    for (const field of required) {
      if (blueprint.stats[field] === undefined) {
        errors.push(`${blueprint.type} blueprint missing stats.${field}`);
      } else if (typeof blueprint.stats[field] !== 'number' || blueprint.stats[field] < 0) {
        errors.push(`${blueprint.type} blueprint stats.${field} must be non-negative number`);
      }
    }
    
    // Boss specifické validace
    if (blueprint.type === 'boss') {
      if (blueprint.mechanics?.phases && !Array.isArray(blueprint.mechanics.phases)) {
        errors.push('Boss blueprint mechanics.phases must be an array');
      }
    }
  }

  /**
   * Validuje power-up blueprint
   * @private
   */
  static _validatePowerUp(blueprint, errors) {
    if (blueprint.maxLevel !== undefined) {
      if (typeof blueprint.maxLevel !== 'number' || blueprint.maxLevel < 1) {
        errors.push('PowerUp blueprint maxLevel must be positive number');
      }
    }
    
    // Validace modifierů
    if (blueprint.modifiers && Array.isArray(blueprint.modifiers)) {
      blueprint.modifiers.forEach((modifier, index) => {
        if (!modifier.path) {
          errors.push(`PowerUp modifier[${index}] missing path`);
        }
        if (!modifier.type) {
          errors.push(`PowerUp modifier[${index}] missing type`);
        }
        const validTypes = ['add', 'mul', 'override', 'enable'];
        if (modifier.type && !validTypes.includes(modifier.type)) {
          errors.push(`PowerUp modifier[${index}] invalid type: ${modifier.type}`);
        }
      });
    }
    
    // Validace ability
    if (blueprint.ability && typeof blueprint.ability !== 'object') {
      errors.push('PowerUp blueprint ability must be an object');
    }
  }

  /**
   * Validuje projectile blueprint
   * @private
   */
  static _validateProjectile(blueprint, errors) {
    if (!blueprint.stats) {
      errors.push('Projectile blueprint missing stats section');
      return;
    }
    
    const required = ['damage', 'speed', 'range'];
    for (const field of required) {
      if (blueprint.stats[field] === undefined) {
        errors.push(`Projectile blueprint missing stats.${field}`);
      } else if (typeof blueprint.stats[field] !== 'number' || blueprint.stats[field] <= 0) {
        errors.push(`Projectile blueprint stats.${field} must be positive number`);
      }
    }
    
    // Validace mechanics
    if (blueprint.mechanics) {
      const mechanics = blueprint.mechanics;
      
      if (mechanics.homingTurnRate !== undefined) {
        if (typeof mechanics.homingTurnRate !== 'number' || mechanics.homingTurnRate < 0) {
          errors.push('Projectile mechanics.homingTurnRate must be non-negative number');
        }
      }
      
      if (mechanics.aimError !== undefined) {
        if (typeof mechanics.aimError !== 'number') {
          errors.push('Projectile mechanics.aimError must be a number');
        }
      }
    }
  }

  /**
   * Validuje drop blueprint
   * @private
   */
  static _validateDrop(blueprint, errors) {
    if (!blueprint.stats) {
      errors.push('Drop blueprint missing stats section');
      return;
    }
    
    if (blueprint.stats.value !== undefined) {
      if (typeof blueprint.stats.value !== 'number' || blueprint.stats.value <= 0) {
        errors.push('Drop blueprint stats.value must be positive number');
      }
    }
    
    if (blueprint.mechanics?.lifetime !== undefined) {
      if (typeof blueprint.mechanics.lifetime !== 'number' || blueprint.mechanics.lifetime <= 0) {
        errors.push('Drop blueprint mechanics.lifetime must be positive number');
      }
    }
  }

  /**
   * Validuje reference na jiné blueprinty nebo assets
   * @private
   */
  static _validateReferences(blueprint, errors) {
    // VFX reference validation with registry
    if (blueprint.vfx) {
      this._validateVFXReferences(blueprint.vfx, blueprint.id, errors);
    }
    
    // SFX reference validation with registry
    if (blueprint.sfx) {
      this._validateSFXReferences(blueprint.sfx, blueprint.id, errors);
    }
    
    // Projectile reference
    if (blueprint.projectileRef) {
      if (typeof blueprint.projectileRef !== 'string') {
        errors.push(`Projectile reference must be string, got ${typeof blueprint.projectileRef}`);
      }
      // TODO: Kontrola existence projectile blueprint
    }
    
    // Inherits reference
    if (blueprint.inherits && Array.isArray(blueprint.inherits)) {
      blueprint.inherits.forEach((parentId, index) => {
        if (typeof parentId !== 'string') {
          errors.push(`Inherits[${index}] must be string, got ${typeof parentId}`);
        }
        // TODO: Kontrola existence parent blueprint
      });
    }
  }

  /**
   * Validuje templates a jejich placeholdery
   * @private
   */
  static _validateTemplates(blueprint, errors) {
    if (!blueprint.display?.templates) return;
    
    const templates = blueprint.display.templates;
    
    for (const [templateName, template] of Object.entries(templates)) {
      if (typeof template !== 'string') {
        errors.push(`Template ${templateName} must be string`);
        continue;
      }
      
      // Najít všechny placeholdery {{...}}
      const placeholders = this._extractPlaceholders(template);
      
      // Kontrola existence placeholderů v blueprint datech
      for (const placeholder of placeholders) {
        if (!this._hasNestedProperty(blueprint, placeholder)) {
          errors.push(`Template ${templateName} references missing placeholder: {{${placeholder}}}`);
        }
      }
    }
  }

  /**
   * Extrahuje placeholdery z template stringu
   * @private
   */
  static _extractPlaceholders(template) {
    const matches = template.match(/\{\{([^}]+)\}\}/g) || [];
    return matches.map(match => match.slice(2, -2).trim());
  }

  /**
   * Kontroluje existence nested property (např. stats.hp)
   * @private
   */
  static _hasNestedProperty(obj, path) {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return false;
      if (typeof current !== 'object') return false;
      if (!(part in current)) return false;
      current = current[part];
    }
    
    return true;
  }

  /**
   * Kontroluje validní hex color
   * @private
   */
  static _isValidColor(color) {
    return /^#[0-9a-fA-F]{6}$/.test(color);
  }

  /**
   * Validuje všechny blueprinty v registru
   * @param {BlueprintRegistry} registry
   * @returns {object} Validation results
   */
  static validateRegistry(registry) {
    const results = {
      totalBlueprints: 0,
      validBlueprints: 0,
      invalidBlueprints: 0,
      errors: {},
      warnings: {}
    };

    for (const [id, blueprint] of registry.blueprints) {
      results.totalBlueprints++;
      
      const errors = this.validate(blueprint);
      
      if (errors.length === 0) {
        results.validBlueprints++;
      } else {
        results.invalidBlueprints++;
        results.errors[id] = errors;
      }
      
      // Generovat warnings pro missing i18n klíče atd.
      const warnings = this._generateWarnings(blueprint);
      if (warnings.length > 0) {
        results.warnings[id] = warnings;
      }
    }

    return results;
  }

  /**
   * Generuje warnings (ne-kritické problémy)
   * @private
   */
  static _generateWarnings(blueprint) {
    const warnings = [];
    
    // Missing optional fields
    if (!blueprint.display?.icon) {
      warnings.push('Missing recommended field: display.icon');
    }
    
    if (!blueprint.display?.tags || blueprint.display.tags.length === 0) {
      warnings.push('Missing recommended field: display.tags');
    }
    
    if (!blueprint.display?.templates?.short) {
      warnings.push('Missing recommended template: display.templates.short');
    }
    
    if (!blueprint.display?.templates?.long) {
      warnings.push('Missing recommended template: display.templates.long');
    }
    
    return warnings;
  }

  /**
   * Validuje VFX reference proti VFX registru
   * @private
   */
  static _validateVFXReferences(vfxSection, blueprintId, errors) {
    try {
      // Dynamický import pro vyhnutí se circular dependencies
      import('../vfx/VFXRegistry.js').then(({ vfxRegistry }) => {
        for (const [event, vfxRef] of Object.entries(vfxSection)) {
          const vfxErrors = vfxRegistry.validate(vfxRef, blueprintId);
          errors.push(...vfxErrors);
        }
      }).catch(e => {
        errors.push(`Failed to validate VFX references for ${blueprintId}: ${e.message}`);
      });
    } catch (e) {
      errors.push(`VFX validation error for ${blueprintId}: ${e.message}`);
    }
  }

  /**
   * Validuje SFX reference proti SFX registru
   * @private
   */
  static _validateSFXReferences(sfxSection, blueprintId, errors) {
    try {
      // Dynamický import pro vyhnutí se circular dependencies
      import('../sfx/SFXRegistry.js').then(({ sfxRegistry }) => {
        for (const [event, sfxRef] of Object.entries(sfxSection)) {
          const sfxErrors = sfxRegistry.validate(sfxRef, blueprintId);
          errors.push(...sfxErrors);
        }
      }).catch(e => {
        errors.push(`Failed to validate SFX references for ${blueprintId}: ${e.message}`);
      });
    } catch (e) {
      errors.push(`SFX validation error for ${blueprintId}: ${e.message}`);
    }
  }
}

export default BlueprintValidator;