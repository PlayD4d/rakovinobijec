/**
 * ModifierEngine - Jednotný systém pro aplikaci modifikátorů
 * 
 * Zajišťuje deterministickou aplikaci všech gameplay modifikátorů
 * v definovaném pořadí s podporou různých typů operací.
 * 
 * Podporované typy modifikátorů:
 * - set: Nastaví hodnotu (override)
 * - add: Přičte k hodnotě
 * - mul: Vynásobí hodnotu (1 + modifier)
 * - enable: Zapne boolean flag
 * 
 * Zero-GC design pro vysoký výkon
 */

export class ModifierEngine {
  // Priority systém - nižší číslo = vyšší priorita (aplikuje se dřív)
  static PRIORITIES = {
    'set': 0,      // Nejdřív override hodnoty
    'add': 1,      // Pak sčítání
    'mul': 2,      // Nakonec násobení
    'enable': 3    // Enable flags jako poslední
  };

  // Pool pro result objekty (zero-GC)
  static _resultPool = [];
  static _maxPoolSize = 10;

  /**
   * Aplikuje seznam modifikátorů na základní stats
   * @param {Object} baseStats - Základní hodnoty
   * @param {Array} modifiers - Seznam aktivních modifikátorů
   * @param {Object} options - Možnosti aplikace
   * @returns {Object} Výsledné stats po aplikaci všech modifikátorů
   */
  static apply(baseStats, modifiers, options = {}) {
    const {
      cache = true,           // Použít cache pro stejné vstupy
      clamp = true,          // Aplikovat min/max limity
      validate = false       // Validovat modifikátory před aplikací
    } = options;

    // Získej result objekt z poolu nebo vytvoř nový
    const result = this._getResultObject();
    
    // Zkopíruj base stats (shallow copy pro performance)
    this._copyStats(baseStats, result);

    // Validace modifikátorů
    if (validate) {
      modifiers = this._validateModifiers(modifiers);
    }

    // Seřaď modifikátory podle priority
    const sorted = this._sortModifiers(modifiers);

    // Aplikuj modifikátory v deterministickém pořadí
    for (const mod of sorted) {
      this._applyModifier(result, mod);
    }

    // Aplikuj globální limity pokud je clamp zapnutý
    if (clamp) {
      this._applyClamps(result);
    }

    return result;
  }

  /**
   * Aplikuje modifikátory s podporou per-level scaling
   * @param {Object} baseStats - Základní hodnoty
   * @param {Array} blueprintModifiers - Modifikátory z blueprintů
   * @param {Object} levels - Aktuální úrovně { powerupId: level }
   * @returns {Object} Výsledné stats
   */
  static applyWithLevels(baseStats, blueprintModifiers, levels) {
    const expandedModifiers = [];

    for (const mod of blueprintModifiers) {
      const level = levels[mod.source] || 0;
      
      if (level === 0) continue;

      // Expanduj modifikátor podle levelu
      if (mod.perLevel !== undefined) {
        expandedModifiers.push({
          path: mod.path,
          type: mod.type,
          value: mod.perLevel * level,
          source: mod.source,
          cap: mod.cap
        });
      } else if (mod.value !== undefined) {
        // Statická hodnota nezávislá na levelu
        expandedModifiers.push({
          path: mod.path,
          type: mod.type,
          value: mod.value,
          source: mod.source,
          cap: mod.cap
        });
      }
    }

    return this.apply(baseStats, expandedModifiers);
  }

  /**
   * Vypočítá finální hodnotu pro konkrétní stat
   * @param {Object} baseStats - Základní stats
   * @param {string} path - Cesta ke statu (např. 'projectile.damage')
   * @param {Array} modifiers - Modifikátory
   * @returns {number} Finální hodnota
   */
  static calculate(baseStats, path, modifiers) {
    const relevantMods = modifiers.filter(m => m.path === path);
    const tempStats = { [path]: this._getNestedValue(baseStats, path) };
    
    const sorted = this._sortModifiers(relevantMods);
    for (const mod of sorted) {
      this._applyModifier(tempStats, mod);
    }
    
    return tempStats[path];
  }

  /**
   * Generuje report o aplikovaných modifikátorech
   * @param {Array} modifiers - Seznam modifikátorů
   * @returns {Object} Report s přehledem modifikátorů
   */
  static generateReport(modifiers) {
    const report = {
      totalModifiers: modifiers.length,
      byType: {},
      byPath: {},
      bySource: {}
    };

    for (const mod of modifiers) {
      // By type
      report.byType[mod.type] = (report.byType[mod.type] || 0) + 1;
      
      // By path
      if (!report.byPath[mod.path]) {
        report.byPath[mod.path] = [];
      }
      report.byPath[mod.path].push({
        type: mod.type,
        value: mod.value,
        source: mod.source
      });
      
      // By source
      if (!report.bySource[mod.source]) {
        report.bySource[mod.source] = [];
      }
      report.bySource[mod.source].push({
        path: mod.path,
        type: mod.type,
        value: mod.value
      });
    }

    return report;
  }

  // === PRIVATE METHODS ===

  /**
   * Získá result objekt z poolu nebo vytvoří nový
   * @private
   */
  static _getResultObject() {
    if (this._resultPool.length > 0) {
      return this._resultPool.pop();
    }
    return {};
  }

  /**
   * Vrátí objekt do poolu pro další použití
   * @private
   */
  static _returnToPool(obj) {
    // Vyčisti objekt
    for (const key in obj) {
      delete obj[key];
    }
    
    // Přidej do poolu pokud není plný
    if (this._resultPool.length < this._maxPoolSize) {
      this._resultPool.push(obj);
    }
  }

  /**
   * Zkopíruje stats do result objektu
   * @private
   */
  static _copyStats(source, target) {
    for (const key in source) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        target[key] = {};
        this._copyStats(source[key], target[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Seřadí modifikátory podle priority
   * @private
   */
  static _sortModifiers(modifiers) {
    // PR7: Ochrana proti null/undefined modifiers
    if (!modifiers || !Array.isArray(modifiers)) {
      return [];
    }
    return [...modifiers].sort((a, b) => {
      const priorityA = this.PRIORITIES[a.type] ?? 999;
      const priorityB = this.PRIORITIES[b.type] ?? 999;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Stejná priorita - seřaď podle source pro deterministické pořadí
      return (a.source || '').localeCompare(b.source || '');
    });
  }

  /**
   * Aplikuje jeden modifikátor
   * @private
   */
  static _applyModifier(stats, modifier) {
    const currentValue = this._getNestedValue(stats, modifier.path);
    let newValue = currentValue;

    switch (modifier.type) {
      case 'set':
        newValue = modifier.value;
        break;
        
      case 'add':
        newValue = (currentValue || 0) + modifier.value;
        break;
        
      case 'mul':
      case 'multiply':  // PR7: Support both 'mul' and 'multiply' for backwards compatibility
        // Multiplicative stacking: result = base * (1 + mod1) * (1 + mod2) ...
        // Pro jednotlivý modifier: new = current * (1 + modifier)
        newValue = (currentValue || 1) * (1 + modifier.value);
        break;
        
      case 'enable':
        newValue = true;
        break;
        
      default:
        console.warn(`[ModifierEngine] Unknown modifier type: ${modifier.type}`);
        return;
    }

    // Aplikuj cap pokud je definován
    if (modifier.cap !== undefined && typeof newValue === 'number') {
      newValue = Math.min(newValue, modifier.cap);
    }

    // Aplikuj min pokud je definován
    if (modifier.min !== undefined && typeof newValue === 'number') {
      newValue = Math.max(newValue, modifier.min);
    }

    // Nastav hodnotu
    this._setNestedValue(stats, modifier.path, newValue);
  }

  /**
   * Získá hodnotu z vnořené cesty
   * @private
   */
  static _getNestedValue(obj, path) {
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
   * Nastaví hodnotu na vnořené cestě
   * @private
   */
  static _setNestedValue(obj, path, value) {
    const parts = path.split('.');
    const lastPart = parts.pop();
    let current = obj;
    
    // Vytvoř vnořené objekty pokud neexistují
    for (const part of parts) {
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[lastPart] = value;
  }

  /**
   * Aplikuje globální limity na stats
   * @private
   */
  static _applyClamps(stats) {
    // HP nemůže být záporné
    if (stats.hp !== undefined && stats.hp < 0) {
      stats.hp = 0;
    }
    if (stats.maxHp !== undefined && stats.maxHp < 1) {
      stats.maxHp = 1;
    }
    
    // Damage nemůže být záporný
    if (stats.damage !== undefined && stats.damage < 0) {
      stats.damage = 0;
    }
    
    // Speed limity
    if (stats.speed !== undefined) {
      stats.speed = Math.max(0, Math.min(stats.speed, 20));
    }
    
    // Projektil limity
    if (stats.projectile) {
      if (stats.projectile.count !== undefined) {
        stats.projectile.count = Math.max(1, Math.min(stats.projectile.count, 20));
      }
      if (stats.projectile.damage !== undefined && stats.projectile.damage < 0) {
        stats.projectile.damage = 0;
      }
    }
    
    // Cooldown/interval nemůže být záporný
    if (stats.shootInterval !== undefined && stats.shootInterval < 100) {
      stats.shootInterval = 100; // Minimální interval 100ms
    }
  }

  /**
   * Validuje modifikátory
   * @private
   */
  static _validateModifiers(modifiers) {
    const valid = [];
    
    for (const mod of modifiers) {
      if (!mod.path) {
        console.warn('[ModifierEngine] Modifier missing path:', mod);
        continue;
      }
      
      if (!mod.type) {
        console.warn('[ModifierEngine] Modifier missing type:', mod);
        continue;
      }
      
      if (mod.type !== 'enable' && mod.value === undefined) {
        console.warn('[ModifierEngine] Modifier missing value:', mod);
        continue;
      }
      
      valid.push(mod);
    }
    
    return valid;
  }

  /**
   * Vytvoří kompozitní modifikátor z více modifikátorů stejné cesty
   * @param {Array} modifiers - Modifikátory pro stejnou cestu
   * @returns {Object} Kompozitní modifikátor
   */
  static compose(modifiers) {
    if (modifiers.length === 0) return null;
    if (modifiers.length === 1) return modifiers[0];
    
    const path = modifiers[0].path;
    let totalAdd = 0;
    let totalMul = 1;
    let hasSet = false;
    let setValue = 0;
    
    // Nejdřív najdi SET modifikátory (override)
    for (const mod of modifiers) {
      if (mod.type === 'set') {
        hasSet = true;
        setValue = mod.value; // Poslední SET vyhrává
      }
    }
    
    // Pak sečti ADD modifikátory
    for (const mod of modifiers) {
      if (mod.type === 'add') {
        totalAdd += mod.value;
      }
    }
    
    // Nakonec vynásob MUL modifikátory
    for (const mod of modifiers) {
      if (mod.type === 'mul') {
        totalMul *= (1 + mod.value);
      }
    }
    
    // Vytvoř kompozitní modifikátor
    if (hasSet) {
      // SET override všechno
      return {
        path,
        type: 'set',
        value: (setValue + totalAdd) * totalMul,
        source: 'composite'
      };
    } else if (totalAdd !== 0 && totalMul !== 1) {
      // Kombinace ADD a MUL
      return {
        path,
        type: 'composite',
        addValue: totalAdd,
        mulValue: totalMul - 1,
        source: 'composite'
      };
    } else if (totalAdd !== 0) {
      // Jen ADD
      return {
        path,
        type: 'add',
        value: totalAdd,
        source: 'composite'
      };
    } else if (totalMul !== 1) {
      // Jen MUL
      return {
        path,
        type: 'mul',
        value: totalMul - 1,
        source: 'composite'
      };
    }
    
    return null;
  }
}

// Export singleton instance for convenience
export const modifierEngine = ModifierEngine;
export default ModifierEngine;