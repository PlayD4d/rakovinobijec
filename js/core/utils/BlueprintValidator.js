/**
 * BlueprintValidator - Rozšířený validační systém pro blueprinty
 * 
 * Zajišťuje validaci blueprintů proti GameConfig requirements
 * a detekuje chybějící hodnoty před runtime.
 */

import { GameConfig } from '../../config.js';
import { ConfigResolver } from './ConfigResolver.js';

export class BlueprintValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.validatedBlueprints = new Map();
  }

  /**
   * Validuje blueprint podle typu
   * @param {Object} blueprint - Blueprint k validaci
   * @returns {Object} Validation result
   */
  validate(blueprint) {
    this.errors = [];
    this.warnings = [];

    if (!blueprint) {
      this.errors.push('Blueprint is null or undefined');
      return this._createResult(false);
    }

    // Základní struktura
    this._validateBasicStructure(blueprint);
    
    // Type-specific validace
    switch (blueprint.type) {
      case 'powerup':
        this._validatePowerUp(blueprint);
        break;
      case 'enemy':
        this._validateEnemy(blueprint);
        break;
      case 'boss':
        this._validateBoss(blueprint);
        break;
      case 'projectile':
        this._validateProjectile(blueprint);
        break;
      default:
        this.warnings.push(`Unknown blueprint type: ${blueprint.type}`);
    }

    // Config consistency check
    this._validateConfigConsistency(blueprint);

    const isValid = this.errors.length === 0;
    const result = this._createResult(isValid);
    
    // Cache result
    if (blueprint.id) {
      this.validatedBlueprints.set(blueprint.id, result);
    }

    return result;
  }

  /**
   * Validates multiple blueprints
   * @param {Array} blueprints - Array of blueprints
   * @returns {Object} Aggregate validation result
   */
  validateMany(blueprints) {
    const results = blueprints.map(bp => this.validate(bp));
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

    return {
      valid: totalErrors === 0,
      totalBlueprints: blueprints.length,
      validBlueprints: results.filter(r => r.valid).length,
      totalErrors,
      totalWarnings,
      results
    };
  }

  /**
   * Validates consistency between blueprint and GameConfig
   * @param {Object} blueprint - Blueprint to check
   */
  _validateConfigConsistency(blueprint) {
    if (blueprint.type === 'powerup' && blueprint.modifiers) {
      for (const modifier of blueprint.modifiers) {
        // Check if the path exists in GameConfig structure
        const configPath = this._mapModifierPathToConfig(modifier.path);
        if (configPath && !ConfigResolver.has(configPath)) {
          this.warnings.push(
            `Modifier path '${modifier.path}' maps to config '${configPath}' which doesn't exist`
          );
        }

        // Validate value ranges
        this._validateModifierValueRanges(modifier);
      }
    }
  }

  /**
   * Maps modifier path to corresponding GameConfig path
   * @private
   */
  _mapModifierPathToConfig(modifierPath) {
    const pathMap = {
      'player.speed': 'player.baseSpeed',
      'player.maxHp': 'player.baseHP',
      'projectile.damage': 'player.projectileDamage',
      'projectile.count': 'player.baseProjectiles',
      'projectile.range': 'player.projectileRange',
      'projectile.speed': 'player.projectileSpeed'
    };
    return pathMap[modifierPath];
  }

  /**
   * Validates modifier value ranges
   * @private
   */
  _validateModifierValueRanges(modifier) {
    const limits = GameConfig.validation?.limits;
    if (!limits) return;

    const path = modifier.path.replace(/^(player|projectile)\./, 'stats.');
    const limit = limits[path];
    
    if (limit && modifier.value !== undefined) {
      if (limit.min !== undefined && modifier.value < limit.min) {
        this.errors.push(
          `Modifier ${modifier.path} value ${modifier.value} below minimum ${limit.min}`
        );
      }
      if (limit.max !== undefined && modifier.value > limit.max) {
        this.errors.push(
          `Modifier ${modifier.path} value ${modifier.value} above maximum ${limit.max}`
        );
      }
    }
  }

  /**
   * Validates basic blueprint structure
   * @private
   */
  _validateBasicStructure(blueprint) {
    // Required fields for all blueprints
    const requiredFields = ['id', 'type'];
    
    for (const field of requiredFields) {
      if (!(field in blueprint)) {
        this.errors.push(`Missing required field: ${field}`);
      }
    }

    // ID format validation
    if (blueprint.id && !blueprint.id.match(/^[\w.-]+$/)) {
      this.errors.push(`Invalid ID format: ${blueprint.id}. Use only letters, numbers, dots, and hyphens.`);
    }

    // Type validation
    const validTypes = ['powerup', 'enemy', 'boss', 'projectile', 'drop', 'player'];
    if (blueprint.type && !validTypes.includes(blueprint.type)) {
      this.warnings.push(`Unknown type: ${blueprint.type}. Valid types: ${validTypes.join(', ')}`);
    }
  }

  /**
   * Validates power-up specific structure
   * @private
   */
  _validatePowerUp(blueprint) {
    const required = GameConfig.validation?.required?.powerup || [];
    
    // Check required fields
    for (const field of required) {
      if (!this._getNestedValue(blueprint, field)) {
        this.errors.push(`PowerUp missing required field: ${field}`);
      }
    }

    // Validate maxLevel
    if (blueprint.maxLevel) {
      const limits = GameConfig.validation?.limits?.maxLevel;
      if (limits) {
        if (blueprint.maxLevel < limits.min) {
          this.errors.push(`maxLevel ${blueprint.maxLevel} below minimum ${limits.min}`);
        }
        if (blueprint.maxLevel > limits.max) {
          this.warnings.push(`maxLevel ${blueprint.maxLevel} above recommended maximum ${limits.max}`);
        }
      }
    }

    // Validate modifiers
    if (blueprint.modifiers) {
      if (!Array.isArray(blueprint.modifiers)) {
        this.errors.push('modifiers must be an array');
      } else {
        blueprint.modifiers.forEach((mod, index) => {
          this._validateModifier(mod, index);
        });
      }
    }

    // Validate display section
    this._validateDisplay(blueprint);
  }

  /**
   * Validates enemy blueprint
   * @private  
   */
  _validateEnemy(blueprint) {
    const required = GameConfig.validation?.required?.enemy || [];
    
    for (const field of required) {
      if (!this._getNestedValue(blueprint, field)) {
        this.errors.push(`Enemy missing required field: ${field}`);
      }
    }

    // Validate stats ranges
    if (blueprint.stats) {
      this._validateStatsRanges(blueprint.stats, 'enemy');
    }
  }

  /**
   * Validates boss blueprint  
   * @private
   */
  _validateBoss(blueprint) {
    const required = GameConfig.validation?.required?.boss || [];
    
    for (const field of required) {
      if (!this._getNestedValue(blueprint, field)) {
        this.errors.push(`Boss missing required field: ${field}`);
      }
    }

    // Boss-specific validations
    if (blueprint.stats) {
      this._validateStatsRanges(blueprint.stats, 'boss');
      
      // Bosses should have significantly more HP than enemies
      if (blueprint.stats.hp && blueprint.stats.hp < 100) {
        this.warnings.push('Boss HP seems low (< 100). Consider increasing for proper difficulty.');
      }
    }
  }

  /**
   * Validates projectile blueprint
   * @private
   */
  _validateProjectile(blueprint) {
    const required = GameConfig.validation?.required?.projectile || [];
    
    for (const field of required) {
      if (!this._getNestedValue(blueprint, field)) {
        this.errors.push(`Projectile missing required field: ${field}`);
      }
    }

    if (blueprint.stats) {
      this._validateStatsRanges(blueprint.stats, 'projectile');
    }
  }

  /**
   * Validates individual modifier
   * @private
   */
  _validateModifier(modifier, index) {
    const requiredFields = ['path', 'type'];
    
    for (const field of requiredFields) {
      if (!(field in modifier)) {
        this.errors.push(`Modifier[${index}] missing required field: ${field}`);
      }
    }

    // Type validation
    const validTypes = ['add', 'mul', 'set', 'enable'];
    if (modifier.type && !validTypes.includes(modifier.type)) {
      this.errors.push(`Modifier[${index}] invalid type: ${modifier.type}. Valid: ${validTypes.join(', ')}`);
    }

    // Value validation
    if (modifier.type !== 'enable' && modifier.value === undefined && modifier.perLevel === undefined) {
      this.errors.push(`Modifier[${index}] missing value or perLevel`);
    }

    // Path validation
    const validPaths = [
      'player.speed', 'player.maxHp', 'projectile.damage', 'projectile.count', 
      'projectile.range', 'projectile.speed', 'projectile.interval'
    ];
    if (modifier.path && !validPaths.includes(modifier.path)) {
      this.warnings.push(`Modifier[${index}] unknown path: ${modifier.path}`);
    }
  }

  /**
   * Validates display section
   * @private
   */
  _validateDisplay(blueprint) {
    if (!blueprint.display) {
      this.warnings.push('Missing display section - UI will use fallbacks');
      return;
    }

    // Check for i18n keys vs fallbacks
    if (!blueprint.display.key && !blueprint.display.devNameFallback) {
      this.warnings.push('Display section missing both i18n key and fallback name');
    }

    if (!blueprint.display.descKey && !blueprint.display.devDescFallback) {
      this.warnings.push('Display section missing both i18n desc key and fallback description');
    }

    // Validate color format
    if (blueprint.display.color && typeof blueprint.display.color === 'string') {
      if (!blueprint.display.color.match(/^#[0-9A-Fa-f]{6}$/)) {
        this.warnings.push(`Invalid color format: ${blueprint.display.color}. Use #RRGGBB format.`);
      }
    }
  }

  /**
   * Validates stats ranges
   * @private
   */
  _validateStatsRanges(stats, entityType) {
    const limits = GameConfig.validation?.limits;
    if (!limits) return;

    for (const [statName, value] of Object.entries(stats)) {
      const limitKey = `stats.${statName}`;
      const limit = limits[limitKey];
      
      if (limit && typeof value === 'number') {
        if (limit.min !== undefined && value < limit.min) {
          this.errors.push(`${entityType} stats.${statName} value ${value} below minimum ${limit.min}`);
        }
        if (limit.max !== undefined && value > limit.max) {
          this.warnings.push(`${entityType} stats.${statName} value ${value} above recommended maximum ${limit.max}`);
        }
      }
    }
  }

  /**
   * Gets nested value from object
   * @private
   */
  _getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  /**
   * Creates validation result object
   * @private
   */
  _createResult(valid) {
    return {
      valid,
      errors: [...this.errors],
      warnings: [...this.warnings],
      errorCount: this.errors.length,
      warningCount: this.warnings.length
    };
  }

  /**
   * Generates validation report for all cached validations
   * @returns {Object} Summary report
   */
  generateReport() {
    const results = Array.from(this.validatedBlueprints.values());
    const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warningCount, 0);
    
    return {
      totalBlueprints: results.length,
      validBlueprints: results.filter(r => r.valid).length,
      invalidBlueprints: results.filter(r => !r.valid).length,
      totalErrors,
      totalWarnings,
      coverage: results.length > 0 ? (results.filter(r => r.valid).length / results.length) * 100 : 0,
      results
    };
  }

  /**
   * Clears validation cache
   */
  clearCache() {
    this.validatedBlueprints.clear();
  }
}

// Export singleton instance
export const blueprintValidator = new BlueprintValidator();
export default BlueprintValidator;