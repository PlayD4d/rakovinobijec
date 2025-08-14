/**
 * BlueprintRegistry - Centrální registr pro všechny blueprinty
 * 
 * PR7 kompatibilní - jednotné API pro správu všech herních entit
 * Podporuje načítání, cache, dědičnost a validaci blueprintů
 * Všechny entity (hráč, nepřátelé, bossové, power-upy) jsou data-driven
 */
export class BlueprintRegistry {
  constructor() {
    this.blueprints = new Map(); // id -> unified blueprint
    this.rawBlueprints = new Map(); // id -> original blueprint (cache)
    this.loaded = false;
    this.loading = false;
  }

  /**
   * Načte všechny blueprinty ze všech modulů
   * Automaticky řeší dědičnost a aplikuje výchozí hodnoty
   * @returns {Promise<void>}
   */
  async loadAll() {
    if (this.loaded || this.loading) return;
    this.loading = true;

    try {
      console.log('[BlueprintRegistry] Loading all blueprints...');
      
      // Načítání jednotlivých kategorií blueprintů
      await Promise.all([
        this._loadPlayerBlueprints(),
        this._loadEnemyBlueprints(), 
        this._loadBossBlueprints(),
        this._loadPowerUpBlueprints(),
        this._loadProjectileBlueprints(),
        this._loadDropBlueprints(),
        this._loadVfxBlueprints(),
        this._loadSfxBlueprints()
      ]);

      // Řešení dědičnosti mezi blueprinty a aplikace výchozích hodnot
      this._resolveInheritance();
      this._applyDefaults();
      
      // Validace blueprintů pouze v development módu
      if (process.env.NODE_ENV === 'development') {
        await this._validateAll();
      }

      this.loaded = true;
      console.log(`[BlueprintRegistry] Loaded ${this.blueprints.size} blueprints`);
      
    } catch (error) {
      console.error('[BlueprintRegistry] Failed to load blueprints:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Získá blueprint podle ID
   * @param {string} id - ID blueprintu (např. 'enemy.basic_cell')
   * @returns {object|null} Blueprint nebo null pokud neexistuje
   */
  get(id) {
    return this.blueprints.get(id) || null;
  }

  /**
   * Získá všechny blueprinty daného typu
   * @param {string} type - Typ blueprintu ('enemy', 'boss', 'powerup', atd.)
   * @returns {Array} Pole blueprintů daného typu
   */
  getByType(type) {
    return Array.from(this.blueprints.values()).filter(bp => bp.type === type);
  }

  /**
   * Registruje nový blueprint do registru
   * Automaticky konvertuje na jednotný formát přes CompatibilityMapper
   * @param {object} blueprint - Blueprint k registraci
   */
  register(blueprint) {
    if (!blueprint.id) {
      console.warn('[BlueprintRegistry] Blueprint missing ID:', blueprint);
      return;
    }

    // Import CompatibilityMapper pro konverzi starých formátů na PR7
    const { CompatibilityMapper } = require('./CompatibilityMapper.js');
    const unified = CompatibilityMapper.toUnified(blueprint);
    
    this.rawBlueprints.set(blueprint.id, blueprint);
    this.blueprints.set(blueprint.id, unified);
  }

  /**
   * Načte blueprinty hráče z /data/player/
   * @private
   */
  async _loadPlayerBlueprints() {
    try {
      // Zatím máme pouze jeden blueprint hráče
      const defaultPlayer = await import('../../data/player/default_player.js');
      this.register(defaultPlayer.default);
    } catch (error) {
      console.warn('[BlueprintRegistry] Failed to load player blueprints:', error.message);
    }
  }

  /**
   * Načte blueprinty nepřátel z /data/enemies/
   * @private
   */
  async _loadEnemyBlueprints() {
    try {
      const enemies = [
        'basic_cell',
        'orange_tumor', 
        'green_heavy',
        'purple_support',
        'brown_shooter'
      ];

      for (const enemy of enemies) {
        try {
          const module = await import(`../../data/enemies/${enemy}.js`);
          this.register(module.default);
        } catch (error) {
          console.warn(`[BlueprintRegistry] Failed to load enemy ${enemy}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('[BlueprintRegistry] Failed to load enemy blueprints:', error.message);
    }
  }

  /**
   * Načte blueprinty bossů z /data/bosses/
   * @private
   */
  async _loadBossBlueprints() {
    try {
      const bosses = [
        'metastaza',
        'radiation', 
        'onkogen',
        'karcinogenni_kral',
        'genova_mutace',
        'chemorezistence'
      ];

      for (const boss of bosses) {
        try {
          const module = await import(`../../data/bosses/${boss}.js`);
          this.register(module.default);
        } catch (error) {
          console.warn(`[BlueprintRegistry] Failed to load boss ${boss}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('[BlueprintRegistry] Failed to load boss blueprints:', error.message);
    }
  }

  /**
   * Načte blueprinty vylepšení z /data/powerups/
   * @private
   */
  async _loadPowerUpBlueprints() {
    try {
      const powerUps = [
        'damage_boost',
        'speed_boots',
        'max_hp',
        'projectile_count',
        'attack_speed',
        'projectile_range',
        'flamethrower',
        'lightning_chain',
        'explosive_bullets',
        'piercing_arrows',
        'shield',
        'aura',
        'xp_magnet'
      ];

      for (const powerUp of powerUps) {
        try {
          const module = await import(`../../data/powerups/${powerUp}.js`);
          this.register(module.default);
        } catch (error) {
          console.warn(`[BlueprintRegistry] Failed to load powerup ${powerUp}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('[BlueprintRegistry] Failed to load powerup blueprints:', error.message);
    }
  }

  /**
   * Načte blueprinty projektilů z /data/projectiles/
   * Připraveno pro budoucí rozšíření
   * @private
   */
  async _loadProjectileBlueprints() {
    // Připraveno pro budoucí implementaci projektilových blueprintů
    console.log('[BlueprintRegistry] Projektilové blueprinty zatím nejsou implementovány');
  }

  /**
   * Načte blueprinty dropů z /data/drops/
   * Připraveno pro budoucí rozšíření
   * @private
   */
  async _loadDropBlueprints() {
    // Připraveno pro budoucí implementaci drop blueprintů
    console.log('[BlueprintRegistry] Drop blueprinty zatím nejsou implementovány');
  }

  /**
   * Načte blueprinty vizuálních efektů z /data/vfx/
   * Připraveno pro particle systém
   * @private
   */
  async _loadVfxBlueprints() {
    // Připraveno pro budoucí implementaci VFX blueprintů
    console.log('[BlueprintRegistry] VFX blueprinty zatím nejsou implementovány');
  }

  /**
   * Načte blueprinty zvukových efektů z /data/sfx/
   * Připraveno pro budoucí rozšíření
   * @private
   */
  async _loadSfxBlueprints() {
    // Připraveno pro budoucí implementaci SFX blueprintů
    console.log('[BlueprintRegistry] SFX blueprinty zatím nejsou implementovány');
  }

  /**
   * Řeší dědičnost mezi blueprinty pomocí pole 'inherits'
   * Podporuje vícenásobnou dědičnost a detekci cyklických závislostí
   * @private
   */
  _resolveInheritance() {
    const resolved = new Set();
    
    for (const [id, blueprint] of this.blueprints) {
      this._resolveInheritanceRecursive(id, blueprint, resolved, new Set());
    }
  }

  /**
   * Rekurzivní řešení dědičnosti s detekcí cyklů
   * @private
   * @param {string} id - ID blueprintu
   * @param {object} blueprint - Blueprint k vyřešení
   * @param {Set} resolved - Množina již vyřešených blueprintů
   * @param {Set} visiting - Množina právě zpracovávaných (detekce cyklů)
   */
  _resolveInheritanceRecursive(id, blueprint, resolved, visiting) {
    if (resolved.has(id)) return blueprint;
    if (visiting.has(id)) {
      console.error(`[BlueprintRegistry] Circular inheritance detected: ${id}`);
      return blueprint;
    }

    visiting.add(id);

    if (blueprint.inherits && Array.isArray(blueprint.inherits)) {
      let merged = {};
      
      // Řešit rodičovské blueprinty v definovaném pořadí
      for (const parentId of blueprint.inherits) {
        const parent = this.blueprints.get(parentId);
        if (parent) {
          const resolvedParent = this._resolveInheritanceRecursive(
            parentId, parent, resolved, visiting
          );
          merged = this._deepMerge(merged, resolvedParent);
        } else {
          console.warn(`[BlueprintRegistry] Parent blueprint not found: ${parentId}`);
        }
      }

      // Aplikovat vlastní hodnoty blueprintu (přepíšou zděděné)
      blueprint = this._deepMerge(merged, blueprint);
      delete blueprint.inherits; // Odstranit pole inherits po zpracování
    }

    visiting.delete(id);
    resolved.add(id);
    this.blueprints.set(id, blueprint);
    return blueprint;
  }

  /**
   * Aplikuje výchozí hodnoty podle typu blueprintu
   * Zajišťuje, že všechny blueprinty mají požadované vlastnosti
   * @private
   */
  _applyDefaults() {
    const defaults = {
      player: {
        type: 'player',
        stats: {
          maxHp: 100,
          speed: 200,
          size: 30
        },
        display: {
          color: '#00ff00',
          rarity: 'special',
          category: 'player'
        }
      },
      enemy: {
        type: 'enemy',
        stats: {
          hp: 100,
          speed: 1,
          damage: 10,
          xp: 10,
          size: 20
        },
        display: {
          color: '#ff0000', 
          rarity: 'common',
          category: 'enemy'
        }
      },
      boss: {
        type: 'boss',
        stats: {
          hp: 1000,
          speed: 0.5,
          damage: 50,
          xp: 500,
          size: 60
        },
        display: {
          color: '#ff0000',
          rarity: 'boss',
          category: 'boss'
        }
      },
      powerup: {
        type: 'powerup',
        maxLevel: 10,
        display: {
          color: '#ffff00',
          rarity: 'common',
          category: 'utility'
        }
      }
    };

    for (const [id, blueprint] of this.blueprints) {
      if (defaults[blueprint.type]) {
        const merged = this._deepMerge(defaults[blueprint.type], blueprint);
        this.blueprints.set(id, merged);
      }
    }
  }

  /**
   * Validuje všechny načtené blueprinty pomocí BlueprintValidator
   * Běží pouze v development módu pro detekci chyb
   * @private
   */
  async _validateAll() {
    const { BlueprintValidator } = await import('./BlueprintValidator.js');
    
    for (const [id, blueprint] of this.blueprints) {
      const errors = BlueprintValidator.validate(blueprint);
      if (errors.length > 0) {
        console.warn(`[BlueprintRegistry] Validation errors for ${id}:`, errors);
      }
    }
  }

  /**
   * Hluboké sloučení objektů pro dědičnost
   * Rekurzivně slučuje vnořené objekty
   * @private
   * @param {object} target - Cílový objekt
   * @param {object} source - Zdrojový objekt
   * @returns {object} Sloučený objekt
   */
  _deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Vyčistí všechny blueprinty z registru
   * Používá se hlavně pro unit testy
   */
  clear() {
    this.blueprints.clear();
    this.rawBlueprints.clear();
    this.loaded = false;
    this.loading = false;
  }

  /**
   * Vrátí seznam všech registrovaných ID blueprintů
   * @returns {Array<string>} Pole ID blueprintů
   */
  list() {
    return Array.from(this.blueprints.keys());
  }

  /**
   * Vrátí statistiky o načtených blueprintech
   * @returns {object} Objekt s celkovým počtem a počtem podle typů
   */
  getStats() {
    const stats = {};
    for (const blueprint of this.blueprints.values()) {
      stats[blueprint.type] = (stats[blueprint.type] || 0) + 1;
    }
    return {
      total: this.blueprints.size,
      byType: stats
    };
  }
}

// Singleton instance pro globální přístup
export const registry = new BlueprintRegistry();
export default registry;