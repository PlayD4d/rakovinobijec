/**
 * ConfigResolver - Safe system for reading configuration values
 *
 * Provides unified access to values from blueprints and external configurations.
 * No silent fallback to legacy GameConfig — missing data = hard fail.
 *
 * Source hierarchy:
 * 1. Blueprint (if provided)
 * 2. External configuration (main_config.json5, managers_config.json5, etc.)
 * 3. Central fallback registry (only critical boot values)
 * 4. Explicit defaultValue
 */

import { DebugLogger } from '../debug/DebugLogger.js';

export class ConfigResolver {
  // External configurations loaded from files
  static _externalConfigs = {};
  
  // Minimal critical fallbacks - only for missing configuration
  // PR7: All values are now in main_config.json5
  static _fallbacks = {
    // Critical values in case main_config.json5 is unavailable
    'game.version': '0.3.0',
    'game.title': 'Rakovinobijec',
    'debug.enabled': false,
    'features.lootTablesEnabled': true
  };

  // Telemetry for tracking missing values
  static _telemetry = {
    missingPaths: new Map(), // path -> count
    enabled: true
  };

  /**
   * Get a value with intelligent fallback
   * @param {string} path - Path to the value (e.g. 'player.projectile.baseDamage')
   * @param {Object} options - Resolver configuration
   * @returns {*} Value or safe fallback
   */
  static get(path, options = {}) {
    const {
      blueprint = null,        // Preferred blueprint object
      defaultValue = null,     // Explicit fallback value
      warnIfMissing = true,    // Log warning when using fallback
      source = 'auto'          // 'blueprint' | 'config' | 'auto'
    } = options;

    // 1. Try blueprint (if provided and not disabled)
    if (blueprint && source !== 'config') {
      const value = this._resolvePath(blueprint, path);
      if (value !== undefined) {
        return value;
      }
    }

    // 2. External configuration (managers_config, features, etc.)
    // PR7: Try main_config first
    if (source !== 'blueprint') {
      // Try main config first
      if (this._externalConfigs.main) {
        const mainValue = this._resolvePath(this._externalConfigs.main, path);
        if (mainValue !== undefined) {
          return mainValue;
        }
      }
      
      // Then try other external configurations
      const externalValue = this._resolvePath(this._externalConfigs, path);
      if (externalValue !== undefined) {
        return externalValue;
      }
    }
    
    // 3. Central fallback registry
    const fallback = this._fallbacks[path];
    if (fallback !== undefined) {
      if (warnIfMissing && this._telemetry.enabled) {
        DebugLogger.warn('bootstrap', `Missing value for '${path}', using fallback: ${fallback}`);
        this._recordMissing(path);
      }
      return fallback;
    }

    // 4. Explicit defaultValue
    if (defaultValue !== null) {
      if (warnIfMissing && this._telemetry.enabled) {
        DebugLogger.warn('bootstrap', `Missing value for '${path}', using provided default: ${defaultValue}`);
        this._recordMissing(path);
      }
      return defaultValue;
    }

    // 5. Value not found anywhere — hard fail
    const msg = `[ConfigResolver] MISSING: '${path}' — not in blueprint, external configs, or fallbacks. No default provided.`;
    DebugLogger.error('bootstrap', msg);
    this._recordMissing(path);
    console.error(msg);
    return undefined;
  }

  /**
   * Get multiple values at once
   * @param {Array<string>} paths - List of paths
   * @param {Object} options - Shared options for all paths
   * @returns {Object} Object with values
   */
  static getMany(paths, options = {}) {
    const result = {};
    for (const path of paths) {
      result[path] = this.get(path, options);
    }
    return result;
  }

  /**
   * Check if a value exists
   * @param {string} path - Path to the value
   * @param {string} source - Where to look ('blueprint' | 'config' | 'any')
   * @returns {boolean} True if the value exists
   */
  static has(path, source = 'any') {
    if (source === 'blueprint' || source === 'any') {
      if (this._fallbacks[path] !== undefined) return true;
    }

    if (source === 'config' || source === 'any') {
      for (const config of Object.values(this._externalConfigs || {})) {
        if (config && this._resolvePath(config, path) !== undefined) return true;
      }
    }

    return false;
  }

  /**
   * Register a new fallback
   * @param {string} path - Path
   * @param {*} value - Fallback value
   */
  static registerFallback(path, value) {
    this._fallbacks[path] = value;
  }

  /**
   * Get telemetry about missing values
   * @returns {Object} Report with most frequently missing values
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
   * Reset telemetry
   */
  static resetTelemetry() {
    this._telemetry.missingPaths.clear();
  }

  // === PRIVATE METHODS ===

  /**
   * Resolve a dot-separated path and get value from object
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
      
      // Support for array indices: "enemies[0].hp"
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
   * Record a missing path in telemetry
   * @private
   */
  static _recordMissing(path) {
    if (!this._telemetry.enabled) return;
    
    const count = this._telemetry.missingPaths.get(path) || 0;
    this._telemetry.missingPaths.set(path, count + 1);
  }

  /**
   * Validate that all required paths exist
   * @param {Array<string>} requiredPaths - List of required paths
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
   * Initialize ConfigResolver with external configurations
   * PR7 compatible - loads all configurations from data/config/
   * @returns {Promise<void>}
   */
  static async initialize() {
    DebugLogger.info('bootstrap', 'ConfigResolver initializing...');
    
    // List of configuration files to load - PR7 complete configuration
    const configFiles = [
      { key: 'main', path: 'data/config/main_config.json5' },
      { key: 'blueprintLoader', path: 'data/config/blueprint_loader.json5' },
      // audioManifest removed - using direct blueprint loading
      { key: 'managers', path: 'data/config/managers_config.json5' },
      { key: 'features', path: 'data/config/features.json5' }
    ];
    
    // Load all configuration files
    for (const { key, path } of configFiles) {
      try {
        const response = await fetch(path);
        if (!response.ok) {
            DebugLogger.warn('bootstrap', `Failed to load ${path}: ${response.status}`);
            continue;
        }
        const text = await response.text();
        // Use JSON5 for parsing (supports comments, trailing commas, etc.)
        const data = window.JSON5 ? window.JSON5.parse(text) : JSON.parse(text);
        this._externalConfigs[key] = data;
        DebugLogger.debug('bootstrap', `Loaded: ${key} from ${path}`);
      } catch (error) {
        DebugLogger.warn('bootstrap', `Cannot load ${path}:`, error.message);
      }
    }
    
    DebugLogger.info('bootstrap', 'ConfigResolver initialization complete, loaded ' + Object.keys(this._externalConfigs).length + ' configuration files');
  }
}

