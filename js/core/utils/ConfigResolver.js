/**
 * ConfigResolver - Bezpečný systém pro čtení konfiguračních hodnot
 * 
 * Zajišťuje jednotný přístup k hodnotám z blueprintů a GameConfig
 * bez hard-coded fallbacků rozptýlených po kódu.
 * 
 * Hierarchie zdrojů:
 * 1. Blueprint (pokud poskytnut)
 * 2. GameConfig
 * 3. Centrální fallback registry
 * 4. Explicitní defaultValue
 */

import { GameConfig } from '../../config.js';
import { DebugLogger } from '../debug/DebugLogger.js';

export class ConfigResolver {
  // Externí konfigurace načtené ze souborů
  static _externalConfigs = {};
  
  // Minimální kritické fallbacky - pouze pro případ chybějící konfigurace
  // PR7: Všechny hodnoty jsou nyní v main_config.json5
  static _fallbacks = {
    // Kritické hodnoty pro případ, že main_config.json5 není dostupný
    'game.version': '0.3.0',
    'game.title': 'Rakovinobijec',
    'debug.enabled': false,
    'features.lootTablesEnabled': true
  };

  // Telemetrie pro sledování chybějících hodnot
  static _telemetry = {
    missingPaths: new Map(), // path -> count
    enabled: true
  };

  /**
   * Získá hodnotu s inteligentním fallbackem
   * @param {string} path - Cesta k hodnotě (např. 'player.projectile.baseDamage')
   * @param {Object} options - Konfigurace resolveru
   * @returns {*} Hodnota nebo bezpečný fallback
   */
  static get(path, options = {}) {
    const {
      blueprint = null,        // Preferovaný blueprint objekt
      defaultValue = null,     // Explicitní fallback hodnota
      warnIfMissing = true,    // Logovat varování při použití fallbacku
      source = 'auto'          // 'blueprint' | 'config' | 'auto'
    } = options;

    // 1. Pokus o blueprint (pokud poskytnut a není zakázán)
    if (blueprint && source !== 'config') {
      const value = this._resolvePath(blueprint, path);
      if (value !== undefined) {
        return value;
      }
    }

    // 2. Externí konfigurace (managers_config, features, atd.)
    // PR7: Zkusit najít v main_config jako první
    if (source !== 'blueprint') {
      // Nejprve zkusit main config
      if (this._externalConfigs.main) {
        const mainValue = this._resolvePath(this._externalConfigs.main, path);
        if (mainValue !== undefined) {
          return mainValue;
        }
      }
      
      // Pak zkusit ostatní externí konfigurace
      const externalValue = this._resolvePath(this._externalConfigs, path);
      if (externalValue !== undefined) {
        return externalValue;
      }
    }
    
    // 3. Pokus o GameConfig (pokud není zakázán)
    if (source !== 'blueprint') {
      const value = this._resolvePath(GameConfig, path);
      if (value !== undefined) {
        return value;
      }
    }

    // 4. Centrální fallback registry
    const fallback = this._fallbacks[path];
    if (fallback !== undefined) {
      if (warnIfMissing && this._telemetry.enabled) {
        DebugLogger.warn('bootstrap', `Missing value for '${path}', using fallback: ${fallback}`);
        this._recordMissing(path);
      }
      return fallback;
    }

    // 5. Explicitní defaultValue
    if (defaultValue !== null) {
      if (warnIfMissing && this._telemetry.enabled) {
        DebugLogger.warn('bootstrap', `Missing value for '${path}', using provided default: ${defaultValue}`);
        this._recordMissing(path);
      }
      return defaultValue;
    }

    // 6. Hodnota nenalezena nikde
    if (warnIfMissing) {
      DebugLogger.error('bootstrap', `No value found for '${path}' and no default provided`);
      this._recordMissing(path);
    }
    return undefined;
  }

  /**
   * Získá více hodnot najednou
   * @param {Array<string>} paths - Seznam cest
   * @param {Object} options - Společné options pro všechny cesty
   * @returns {Object} Objekt s hodnotami
   */
  static getMany(paths, options = {}) {
    const result = {};
    for (const path of paths) {
      result[path] = this.get(path, options);
    }
    return result;
  }

  /**
   * Kontroluje existenci hodnoty
   * @param {string} path - Cesta k hodnotě
   * @param {string} source - Kde hledat ('blueprint' | 'config' | 'any')
   * @returns {boolean} True pokud hodnota existuje
   */
  static has(path, source = 'any') {
    if (source === 'blueprint' || source === 'any') {
      if (this._fallbacks[path] !== undefined) return true;
    }

    if (source === 'config' || source === 'any') {
      // Check external configs (main, managers, features) first
      for (const config of Object.values(this._externalConfigs || {})) {
        if (config && this._resolvePath(config, path) !== undefined) return true;
      }
      // Then check GameConfig
      const value = this._resolvePath(GameConfig, path);
      if (value !== undefined) return true;
    }

    return false;
  }

  /**
   * Registruje nový fallback
   * @param {string} path - Cesta
   * @param {*} value - Fallback hodnota
   */
  static registerFallback(path, value) {
    this._fallbacks[path] = value;
  }

  /**
   * Získá telemetrii o chybějících hodnotách
   * @returns {Object} Report s nejčastěji chybějícími hodnotami
   */
  static getTelemetryReport() {
    const sorted = Array.from(this._telemetry.missingPaths.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    return {
      totalMissingPaths: this._telemetry.missingPaths.size,
      topMissing: sorted.map(([path, count]) => ({ path, count })),
      fallbacksUsed: sorted.filter(([path]) => this._fallbacks[path] !== undefined).length
    };
  }

  /**
   * Resetuje telemetrii
   */
  static resetTelemetry() {
    this._telemetry.missingPaths.clear();
  }

  // === PRIVATE METHODS ===

  /**
   * Rozloží cestu a získá hodnotu z objektu
   * @private
   */
  static _resolvePath(obj, path) {
    if (!obj || !path) return undefined;
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      // Podpora pro array indexy: "enemies[0].hp"
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        current = current[arrayMatch[1]];
        if (!Array.isArray(current)) return undefined;
        current = current[parseInt(arrayMatch[2])];
      } else {
        current = current[part];
      }
    }
    
    return current;
  }

  /**
   * Zaznamenává chybějící cestu do telemetrie
   * @private
   */
  static _recordMissing(path) {
    if (!this._telemetry.enabled) return;
    
    const count = this._telemetry.missingPaths.get(path) || 0;
    this._telemetry.missingPaths.set(path, count + 1);
  }

  /**
   * Validuje, že všechny požadované cesty existují
   * @param {Array<string>} requiredPaths - Seznam požadovaných cest
   * @returns {Object} Validation result
   */
  static validate(requiredPaths) {
    const missing = [];
    const found = [];
    
    for (const path of requiredPaths) {
      if (this.has(path)) {
        found.push(path);
      } else {
        missing.push(path);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
      found,
      coverage: (found.length / requiredPaths.length) * 100
    };
  }
  
  /**
   * Inicializuje ConfigResolver s externími konfiguracemi
   * PR7 kompatibilní - načítá všechny konfigurace z data/config/
   * @returns {Promise<void>}
   */
  static async initialize() {
    DebugLogger.info('bootstrap', 'ConfigResolver inicializace...');
    
    // Seznam konfiguračních souborů k načtení - PR7 kompletní konfigurace
    const configFiles = [
      { key: 'main', path: 'data/config/main_config.json5' },
      { key: 'blueprintLoader', path: 'data/config/blueprint_loader.json5' },
      // audioManifest removed - using direct blueprint loading
      { key: 'managers', path: 'data/config/managers_config.json5' },
      { key: 'features', path: 'data/config/features.json5' }
    ];
    
    // Načíst všechny konfigurační soubory
    for (const { key, path } of configFiles) {
      try {
        const response = await fetch(path);
        if (!response.ok) {
            DebugLogger.warn('bootstrap', `Failed to load ${path}: ${response.status}`);
            continue;
        }
        const text = await response.text();
        // Použít JSON5 pro parsování (podporuje komentáře, trailing commas, atd.)
        const data = window.JSON5 ? window.JSON5.parse(text) : JSON.parse(text);
        this._externalConfigs[key] = data;
        DebugLogger.debug('bootstrap', `✅ Načteno: ${key} z ${path}`);
      } catch (error) {
        DebugLogger.warn('bootstrap', `⚠️ Nelze načíst ${path}:`, error.message);
      }
    }
    
    DebugLogger.info('bootstrap', 'ConfigResolver inicializace dokončena, načteno ' + Object.keys(this._externalConfigs).length + ' konfiguračních souborů');
  }
}

