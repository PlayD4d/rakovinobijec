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

export class ConfigResolver {
  // Externí konfigurace načtené ze souborů
  static _externalConfigs = {};
  
  // Centrální registry fallbacků - jediné místo s "magic numbers"
  static _fallbacks = {
    // Player projectile defaults - PR7: map to actual GameConfig paths
    'player.projectile.baseDamage': 10,      // maps to player.projectileDamage
    'player.projectile.baseSpeed': 150,      // maps to player.projectileSpeed
    'player.projectile.baseRange': 600,      // maps to player.projectileRange
    'player.projectile.baseInterval': 1000,  // maps to player.projectileInterval
    'player.projectile.muzzleOffset': 24,    // maps to player.muzzleOffset
    
    // Feature flags - PR7: výchozí hodnoty
    'features.lootTablesEnabled': true,
    'features.telemetryLogger': false,
    'features.debugOverlay': false,
    
    // Player stats
    'player.baseHp': 100,
    'player.baseSpeed': 4,
    'player.size': 30,
    'player.baseProjectiles': 1,
    'player.invincibilityTime': 1000,
    
    // Shield defaults
    'player.shield.baseHP': 50,
    'player.shield.hpPerLevel': 25,
    'player.shield.baseRegenTime': 10000,
    'player.shield.regenTimePerLevel': -1000,
    'player.shield.minRegenTime': 6000,
    
    // Ability intervals
    'abilities.radiotherapy.baseInterval': 1000,
    'abilities.radiotherapy.intervalPerLevel': -100,
    'abilities.radiotherapy.minInterval': 300,
    'abilities.lightning.baseInterval': 2000,
    'abilities.lightning.intervalPerLevel': -200,
    'abilities.lightning.minInterval': 800,
    
    // Weapon effects
    'weapons.explosive.baseRadius': 30,
    'weapons.explosive.radiusPerLevel': 10,
    'weapons.explosive.damageMultiplier': 0.8,
    'weapons.piercing.damageReduction': 0.9,
    
    // Aura
    'abilities.aura.tickRate': 0.05,
    'abilities.aura.baseRadius': 50,
    'abilities.aura.radiusGrowth': 1.15,
    
    // Boss scaling
    'scaling.boss.hpMultiplier': 1.2,
    'scaling.boss.damageMultiplier': 1.1,
    'scaling.boss.xpMultiplier': 1.3,
    
    // Elite scaling
    'scaling.elite.baseChance': 0.05,
    'scaling.elite.chancePerLevel': 0.01,
    'scaling.elite.statMultiplier': 1.4,
    
    // XP scaling
    'scaling.xp.perLevel': 0.2,
    'scaling.xp.baseRequirement': 100,
    
    // Loot
    'loot.xp.tier1.value': 1,
    'loot.xp.tier2.value': 5,
    'loot.xp.tier3.value': 10,
    'loot.xp.tier4.value': 50,
    'loot.health.value': 20,
    'loot.health.baseChance': 0.1,
    'loot.health.chanceReduction': 0.9,
    
    // PR5: LootSystem extended constants
    'loot.health.levelStepSize': 5,
    'loot.health.minChance': 0.01,
    'loot.xp.maxSpread': 40,
    'loot.xp.spreadPerOrb': 8,
    'loot.xp.tiers': [
      { value: 50, color: 0xffff00, size: 1.4 },
      { value: 25, color: 0xff8800, size: 1.2 },
      { value: 10, color: 0x00ff88, size: 1.0 },
      { value: 5,  color: 0x00ffff, size: 0.8 },
      { value: 1,  color: 0x4444ff, size: 0.7 }
    ],
    
    // Performance limits
    'limits.maxEmitters': 24,
    'limits.maxProjectiles': 100,
    'limits.maxEnemies': 50,
    'limits.maxTrails': 10,
    
    // PR5: EnemyManager spawning constants
    'spawn.intervalReductionRate': 0.005,
    'spawn.defeatedBossRespawnChance': 0.0001,
    'spawn.baseMaxEnemies': 20,
    'spawn.enemiesPerLevel': 2,
    'scaling.enemy.difficultyPerLevel': 0.1,
    
    // Player rendering constants
    'player.rendering.borderWidth': 2,
    'player.rendering.borderAlpha': 0.8,
    'player.rendering.alphaFrequency': 0.02,
    'player.rendering.speedMultiplier': 100,
    
    // VFX constants
    'vfx.lightning.lineWidth': 4,
    'vfx.lightning.coreWidth': 2,
    'vfx.lightning.duration': 200,
    'vfx.radiotherapy.lineWidth': 3,
    'vfx.radiotherapy.lineAlpha': 0.8,
    
    // Boss VFX constants
    'boss.rendering.outlineWidth': 3,
    'boss.rendering.outlineAlpha': 0.8,
    'boss.vfx.corruption.lineWidth': 6,
    'boss.vfx.corruption.lineAlpha': 0.8,
    'boss.vfx.shield.lineWidth': 5,
    'boss.vfx.shield.lineAlpha': 0.8,
    
    // Enemy rendering constants
    'enemy.rendering.borderWidth': 2,
    'enemy.rendering.borderAlpha': 0.5,
    'enemy.rendering.eliteBorderWidth': 3,
    'enemy.rendering.eliteBorderAlpha': 1.0,
    
    // Enemy projectile constants
    'enemy.projectile.inaccuracyRange': 0.6,
    'enemy.projectile.baseSpeed': 100,
    'enemy.projectile.defaultColor': 0xff0000,
    
    // Enemy support/buff constants
    'enemy.support.buffInterval': 1000,
    'enemy.support.buffDuration': 1500,
    'enemy.support.minBuffRange': 0.6,
    'enemy.support.buffColor': 0x8800ff,
    'enemy.support.buffAlpha': 0.1,
    'enemy.support.buffVfxDuration': 500,
    
    // Enemy shooting constants
    'enemy.shooting.defaultInterval': 2000,
    
    // Enemy stats constraints
    'enemy.stats.minSpeed': 0.1,
    'enemy.stats.minDamage': 1
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

    // 2. Externí konfigurace (audio_manifest, managers_config, atd.)
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
        console.warn(`[ConfigResolver] Missing value for '${path}', using fallback: ${fallback}`);
        this._recordMissing(path);
      }
      return fallback;
    }

    // 5. Explicitní defaultValue
    if (defaultValue !== null) {
      if (warnIfMissing && this._telemetry.enabled) {
        console.warn(`[ConfigResolver] Missing value for '${path}', using provided default: ${defaultValue}`);
        this._recordMissing(path);
      }
      return defaultValue;
    }

    // 6. Hodnota nenalezena nikde
    if (warnIfMissing) {
      console.error(`[ConfigResolver] No value found for '${path}' and no default provided`);
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
      const value = this._resolvePath(GameConfig, path);
      if (value !== undefined) return true;
    }
    
    return this._fallbacks[path] !== undefined;
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
    console.log('[ConfigResolver] Inicializace...');
    
    // Seznam konfiguračních souborů k načtení - PR7 kompletní konfigurace
    const configFiles = [
      { key: 'main', path: 'data/config/main_config.json5' },
      { key: 'blueprintLoader', path: 'data/config/blueprint_loader.json5' },
      { key: 'audioManifest', path: 'data/config/audio_manifest.json5' },
      { key: 'managers', path: 'data/config/managers_config.json5' },
      { key: 'features', path: 'data/config/features.json5' }
    ];
    
    // Načíst všechny konfigurační soubory
    for (const { key, path } of configFiles) {
      try {
        const response = await fetch(path);
        const text = await response.text();
        // Použít JSON5 pro parsování (podporuje komentáře, trailing commas, atd.)
        const data = window.JSON5 ? window.JSON5.parse(text) : JSON.parse(text);
        this._externalConfigs[key] = data;
        console.log(`[ConfigResolver] ✅ Načteno: ${key} z ${path}`);
      } catch (error) {
        console.warn(`[ConfigResolver] ⚠️ Nelze načíst ${path}:`, error.message);
      }
    }
    
    console.log('[ConfigResolver] Inicializace dokončena, načteno ' + Object.keys(this._externalConfigs).length + ' konfiguračních souborů');
  }
}

// Export singleton instance for convenience
export const configResolver = ConfigResolver;
export default ConfigResolver;