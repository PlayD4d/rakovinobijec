// LootSystemBootstrap - inicializace a integrace celého LootTables systému
// Spouští se při startu hry a zajišťuje plnou funkčnost systému

import LootDropManager from './LootDropManager.js';
import LootSystemIntegration from './LootSystemIntegration.js';
import { BlueprintValidator } from '../validation/BlueprintValidator.js';

export default class LootSystemBootstrap {
  constructor(scene) {
    this.scene = scene;
    this.configResolver = scene.configResolver || window.ConfigResolver;
    this.enabled = this.configResolver?.get('features.lootTablesEnabled', { defaultValue: true }) ?? true;
    
    // Core systems
    this.lootDropManager = null;
    this.lootSystemIntegration = null;
    
    // Blueprint registries
    this.loadedBlueprints = {
      enemies: new Map(),
      bosses: new Map(),
      projectiles: new Map(),
      powerups: new Map(),
      drops: new Map(),
      lootTables: new Map()
    };
    
    this.initializationStatus = {
      blueprintsLoaded: false,
      tablesRegistered: false,
      systemsConnected: false,
      validationPassed: false,
      ready: false
    };
    
    console.log(`[LootSystemBootstrap] Inicializován - enabled: ${this.enabled}`);
  }
  
  // === HLAVNÍ BOOTSTRAP PROCES ===
  
  async initialize() {
    console.log('[LootSystemBootstrap] Spouštím inicializaci loot systému...');
    
    try {
      if (!this.enabled) {
        console.log('[LootSystemBootstrap] LootTables systém je vypnutý - používám legacy');
        return { success: true, legacy: true };
      }
      
      // 1. Načti a validuj blueprinty
      await this.loadAndValidateBlueprints();
      this.initializationStatus.blueprintsLoaded = true;
      
      // 2. Inicializuj core systémy
      await this.initializeCoreSystems();
      
      // 3. Zaregistruj loot tables
      await this.registerLootTables();
      this.initializationStatus.tablesRegistered = true;
      
      // 4. Připoj integrace
      await this.connectIntegrations();
      this.initializationStatus.systemsConnected = true;
      
      // 5. Finální validace
      await this.performFinalValidation();
      this.initializationStatus.validationPassed = true;
      
      // 6. Nastavení pro debugging/telemetrii
      await this.setupDebugging();
      
      this.initializationStatus.ready = true;
      
      console.log('[LootSystemBootstrap] ✓ Inicializace dokončena úspěšně');
      return { success: true, systems: this.getSystemReferences() };
      
    } catch (error) {
      console.error('[LootSystemBootstrap] ✗ Inicializace selhala:', error);
      return { success: false, error: error.message };
    }
  }
  
  // === BLUEPRINT LOADING ===
  
  async loadAndValidateBlueprints() {
    console.log('[LootSystemBootstrap] Načítám a validuji blueprinty...');
    
    // PR7 kompatibilní - načítat z BlueprintLoader, ne vytvářet vlastní!
    const blueprintLoader = this.scene.blueprintLoader;
    
    if (!blueprintLoader || !blueprintLoader.loaded) {
      console.error('[LootSystemBootstrap] BlueprintLoader není dostupný nebo nenačtený!');
      // Fallback na staré chování pro zpětnou kompatibilitu
      await this.loadDropBlueprints();
      await this.loadLootTableBlueprints();
    } else {
      // Načíst blueprinty z BlueprintLoader
      await this.loadFromBlueprintLoader(blueprintLoader);
    }
    
    // 3. Validace všech načtených blueprintů
    await this.validateLoadedBlueprints();
    
    console.log(`[LootSystemBootstrap] Načteno ${this.getTotalBlueprintsCount()} blueprintů`);
  }
  
  /**
   * PR7 kompatibilní načítání z BlueprintLoader
   * Načítá skutečné blueprinty místo vytváření vlastních
   */
  async loadFromBlueprintLoader(blueprintLoader) {
    console.log('[LootSystemBootstrap] Načítám z BlueprintLoader...');
    
    // Načíst drop blueprinty
    const dropCategory = blueprintLoader.categories.drop;
    if (dropCategory) {
      for (const [id, blueprint] of dropCategory) {
        this.loadedBlueprints.drops.set(id, blueprint);
        console.log(`  Načten drop: ${id}`);
      }
    }
    
    // Načíst lootTable blueprinty
    const lootTableCategory = blueprintLoader.categories.lootTable;
    if (lootTableCategory) {
      for (const [id, blueprint] of lootTableCategory) {
        this.loadedBlueprints.lootTables.set(id, blueprint);
        console.log(`  Načtena lootTable: ${id}`);
      }
    }
    
    console.log(`[LootSystemBootstrap] Načteno ${this.loadedBlueprints.drops.size} dropů a ${this.loadedBlueprints.lootTables.size} loot tabulek z BlueprintLoader`);
  }
  
  async loadDropBlueprints() {
    // XP drops
    const xpSmall = await this.createXPDropBlueprint('drop.xp_small', 5);
    const xpMedium = await this.createXPDropBlueprint('drop.xp_medium', 12);
    const xpLarge = await this.createXPDropBlueprint('drop.xp_large', 30);
    
    this.loadedBlueprints.drops.set('drop.xp_small', xpSmall);
    this.loadedBlueprints.drops.set('drop.xp_medium', xpMedium);
    this.loadedBlueprints.drops.set('drop.xp_large', xpLarge);
    
    // Health drop
    const healthSmall = await this.createHealthDropBlueprint('drop.health_small', 15);
    this.loadedBlueprints.drops.set('drop.health_small', healthSmall);
    
    // Existing drops integration
    const metotrexat = await this.createMetotrexatBlueprint();
    this.loadedBlueprints.drops.set('drop.metotrexat', metotrexat);
  }
  
  async loadLootTableBlueprints() {
    // Level 1 tables
    const level1Common = await this.createLevel1CommonTable();
    const level1Elite = await this.createLevel1EliteTable();
    
    this.loadedBlueprints.lootTables.set('lootTable.level1.common', level1Common);
    this.loadedBlueprints.lootTables.set('lootTable.level1.elite', level1Elite);
    
    // Level 2 tables
    const level2Intermediate = await this.createLevel2IntermediateTable();
    const level2Elite = await this.createLevel2EliteTable();
    
    this.loadedBlueprints.lootTables.set('lootTable.level2.intermediate', level2Intermediate);
    this.loadedBlueprints.lootTables.set('lootTable.level2.elite', level2Elite);
    
    // Level 3 tables
    const level3Extreme = await this.createLevel3ExtremeTable();
    const level3Elite = await this.createLevel3EliteTable();
    
    this.loadedBlueprints.lootTables.set('lootTable.level3.extreme', level3Extreme);
    this.loadedBlueprints.lootTables.set('lootTable.level3.elite', level3Elite);
  }
  
  // === BLUEPRINT FACTORIES ===
  
  async createXPDropBlueprint(id, xpValue) {
    return {
      id: id,
      type: 'drop',
      stats: {
        xpValue: xpValue,
        healAmount: 0,
        value: xpValue,
        lifetime: 20000 + (xpValue * 500), // Větší XP = delší životnost
        magnetRange: 60 + (xpValue * 2)
      },
      mechanics: {
        autoPickup: false,
        pickupRadius: 25,
        healType: 'none',
        xpType: 'standard',
        stackable: true,
        bobbing: true
      },
      vfx: {
        spawn: `vfx.drop.spawn.xp.${id.split('_')[1]}`,
        pickup: `vfx.player.xp.gain.${id.split('_')[1]}`,
        expire: 'vfx.drop.expire.fade'
      },
      sfx: {
        spawn: 'sfx.drop.spawn.xp',
        pickup: `sfx.player.xp.${id.split('_')[1]}`,
        expire: 'sfx.drop.fade'
      },
      display: {
        key: `${id}.name`,
        descKey: `${id}.desc`,
        color: this.getXPDropColor(id),
        rarity: this.getXPDropRarity(id),
        icon: id,
        category: 'xp',
        tags: ['drop', 'xp', 'immunity', 'stimulator']
      }
    };
  }
  
  getXPDropColor(id) {
    if (id.includes('small')) return '#4CAF50';
    if (id.includes('medium')) return '#2196F3';
    if (id.includes('large')) return '#FF9800';
    return '#4CAF50';
  }
  
  getXPDropRarity(id) {
    if (id.includes('small')) return 'common';
    if (id.includes('medium')) return 'uncommon';
    if (id.includes('large')) return 'rare';
    return 'common';
  }
  
  async createHealthDropBlueprint(id, healValue) {
    return {
      id: id,
      type: 'drop',
      stats: {
        healAmount: healValue,
        xpValue: 0,
        value: 10,
        lifetime: 25000,
        magnetRange: 70
      },
      mechanics: {
        autoPickup: false,
        pickupRadius: 30,
        healType: 'instant',
        overHealProtection: true,
        criticalHealBonus: true,
        criticalThreshold: 0.25,
        criticalMultiplier: 1.5
      },
      vfx: {
        spawn: 'vfx.drop.spawn.health.small',
        pickup: 'vfx.player.heal.small',
        critical: 'vfx.player.heal.critical',
        expire: 'vfx.drop.expire.fade'
      },
      sfx: {
        spawn: 'sfx.drop.spawn.health',
        pickup: 'sfx.player.heal.small',
        critical: 'sfx.player.heal.critical',
        expire: 'sfx.drop.fade'
      },
      display: {
        key: `${id}.name`,
        descKey: `${id}.desc`,
        color: '#E53935',
        rarity: 'common',
        icon: id,
        category: 'healing',
        tags: ['drop', 'healing', 'regeneration', 'cell']
      }
    };
  }
  
  async createMetotrexatBlueprint() {
    return {
      id: 'drop.metotrexat',
      type: 'drop',
      stats: {
        value: 1,
        weight: 0.03,
        lifetime: 30000,
        magnetRange: 80
      },
      mechanics: {
        effectType: 'global_damage',
        globalDamage: 250,
        affectBosses: true,
        flashDuration: 300,
        blinkInterval: 180,
        pulsing: true,
        autoPickup: false,
        contactPickup: true
      },
      visual: {
        shape: 'hex',
        color: '#FFFFAA',
        sizeMul: 1.1,
        outline: true,
        outlineColor: '#FF00FF'
      },
      vfx: {
        spawn: 'vfx.drop.spawn.special',
        pickup: 'vfx.flash.strong',
        blink: 'vfx.drop.blink.special',
        expire: 'vfx.drop.fade'
      },
      sfx: {
        spawn: 'sfx.drop.special.spawn',
        pickup: 'sfx.drop.metotrexat.pickup',
        expire: 'sfx.drop.fade'
      },
      display: {
        key: 'drop.metotrexat.name',
        descKey: 'drop.metotrexat.desc',
        color: '#FF00FF',
        rarity: 'legendary',
        icon: 'drop_metotrexat',
        category: 'special',
        tags: ['drop', 'special', 'medicine', 'mass-damage']
      }
    };
  }
  
  // === LOOT TABLE FACTORIES ===
  
  async createLevel1CommonTable() {
    return {
      id: 'lootTable.level1.common',
      type: 'lootTable',
      pools: [{
        when: {},
        pity: { enabled: true, maxNoDrop: 8, guaranteedEntry: 'drop.xp_small' },
        rolls: 1,
        entries: [
          { ref: 'drop.xp_small', weight: 65, qty: { min: 1, max: 2 } },
          { ref: 'drop.xp_medium', weight: 15, qty: 1 },
          { ref: 'drop.health_small', weight: 12, qty: 1, chance: 0.3 },
          { ref: 'drop.metotrexat', weight: 1, qty: 1, unique: true, chance: 0.03 }
        ]
      }],
      modifiers: {
        dropRateMultiplier: 1.0,
        qualityBonus: 0.0,
        luckInfluence: 0.1,
        eliteBonus: 1.5,
        bossBonus: 3.0
      },
      caps: {
        maxDropsPerMinute: 30,
        maxSameDropStreak: 5,
        cooldownBetweenRare: 10000
      },
      display: {
        key: 'lootTable.level1.common.name',
        descKey: 'lootTable.level1.common.desc',
        color: '#4CAF50',
        rarity: 'common',
        category: 'lootTable'
      }
    };
  }
  
  async createLevel1EliteTable() {
    return {
      id: 'lootTable.level1.elite',
      type: 'lootTable',
      pools: [{
        when: {},
        pity: { enabled: true, maxNoDrop: 1, guaranteedEntry: 'drop.xp_large' },
        rolls: 2,
        entries: [
          { ref: 'drop.xp_large', weight: 40, qty: { min: 1, max: 3 } },
          { ref: 'drop.xp_medium', weight: 30, qty: { min: 2, max: 4 } },
          { ref: 'drop.health_small', weight: 25, qty: { min: 1, max: 2 } },
          { ref: 'drop.metotrexat', weight: 3, qty: 1, chance: 0.15 }
        ]
      }],
      modifiers: {
        dropRateMultiplier: 2.5,
        qualityBonus: 0.3,
        luckInfluence: 0.2,
        eliteBonus: 1.0,
        bossBonus: 2.0,
        guaranteedDrops: true
      },
      caps: {
        maxDropsPerMinute: 100,
        maxSameDropStreak: 3,
        cooldownBetweenRare: 5000
      },
      display: {
        key: 'lootTable.level1.elite.name',
        descKey: 'lootTable.level1.elite.desc',
        color: '#FF9800',
        rarity: 'rare',
        category: 'lootTable'
      }
    };
  }
  
  async createLevel2IntermediateTable() {
    return {
      id: 'lootTable.level2.intermediate',
      type: 'lootTable',
      pools: [
        {
          when: {},
          pity: { enabled: true, maxNoDrop: 6, guaranteedEntry: 'drop.xp_medium' },
          rolls: 1,
          entries: [
            { ref: 'drop.xp_small', weight: 45, qty: { min: 1, max: 2 } },
            { ref: 'drop.xp_medium', weight: 35, qty: { min: 1, max: 2 } },
            { ref: 'drop.xp_large', weight: 12, qty: 1 },
            { ref: 'drop.health_small', weight: 15, qty: 1, chance: 0.4 },
            { ref: 'drop.metotrexat', weight: 2, qty: 1, unique: true, chance: 0.05 }
          ]
        },
        {
          when: { timeGteMs: 45000, enemiesKilledGte: 30 },
          pity: { enabled: true, maxNoDrop: 10, guaranteedEntry: 'drop.xp_large' },
          rolls: 1,
          entries: [
            { ref: 'drop.xp_large', weight: 50, qty: { min: 1, max: 2 } },
            { ref: 'drop.metotrexat', weight: 5, qty: 1, chance: 0.08 }
          ]
        }
      ],
      modifiers: {
        dropRateMultiplier: 1.3,
        qualityBonus: 0.15,
        luckInfluence: 0.15,
        eliteBonus: 1.8,
        bossBonus: 4.0,
        timeScaling: true,
        timeScalingRate: 0.001
      },
      caps: {
        maxDropsPerMinute: 40,
        maxSameDropStreak: 4,
        cooldownBetweenRare: 8000
      },
      display: {
        key: 'lootTable.level2.intermediate.name',
        descKey: 'lootTable.level2.intermediate.desc',
        color: '#2196F3',
        rarity: 'uncommon',
        category: 'lootTable'
      }
    };
  }
  
  async createLevel2EliteTable() {
    return {
      id: 'lootTable.level2.elite',
      type: 'lootTable',
      pools: [{
        when: {},
        pity: { enabled: true, maxNoDrop: 1, guaranteedEntry: 'drop.xp_large' },
        rolls: 3,
        entries: [
          { ref: 'drop.xp_large', weight: 50, qty: { min: 2, max: 4 } },
          { ref: 'drop.xp_medium', weight: 30, qty: { min: 3, max: 6 } },
          { ref: 'drop.health_small', weight: 35, qty: { min: 1, max: 3 } },
          { ref: 'drop.metotrexat', weight: 8, qty: 1, chance: 0.25 }
        ]
      }],
      modifiers: {
        dropRateMultiplier: 3.5,
        qualityBonus: 0.5,
        luckInfluence: 0.25,
        eliteBonus: 1.0,
        bossBonus: 2.5,
        guaranteedDrops: true,
        timeScaling: true,
        timeScalingRate: 0.002
      },
      caps: {
        maxDropsPerMinute: 150,
        maxSameDropStreak: 3,
        cooldownBetweenRare: 3000
      },
      display: {
        key: 'lootTable.level2.elite.name',
        descKey: 'lootTable.level2.elite.desc',
        color: '#FF5722',
        rarity: 'epic',
        category: 'lootTable'
      }
    };
  }
  
  async createLevel3ExtremeTable() {
    return {
      id: 'lootTable.level3.extreme',
      type: 'lootTable',
      pools: [
        {
          when: {},
          pity: { enabled: true, maxNoDrop: 4, guaranteedEntry: 'drop.xp_large' },
          rolls: 2,
          entries: [
            { ref: 'drop.xp_small', weight: 25, qty: { min: 1, max: 2 } },
            { ref: 'drop.xp_medium', weight: 45, qty: { min: 2, max: 3 } },
            { ref: 'drop.xp_large', weight: 25, qty: { min: 1, max: 2 } },
            { ref: 'drop.health_small', weight: 20, qty: { min: 1, max: 2 }, chance: 0.5 },
            { ref: 'drop.metotrexat', weight: 4, qty: 1, unique: true, chance: 0.08 }
          ]
        },
        {
          when: { timeGteMs: 120000, enemiesKilledGte: 150 },
          pity: { enabled: false },
          rolls: 1,
          entries: [
            { ref: 'drop.metotrexat', weight: 40, qty: { min: 1, max: 2 }, chance: 0.2 }
          ]
        }
      ],
      modifiers: {
        dropRateMultiplier: 2.0,
        qualityBonus: 0.3,
        luckInfluence: 0.2,
        eliteBonus: 2.5,
        bossBonus: 5.0,
        timeScaling: true,
        timeScalingRate: 0.003,
        chaosMultiplier: 1.5,
        survivalBonus: true,
        survivalThreshold: 180000,
        survivalMultiplier: 2.0
      },
      caps: {
        maxDropsPerMinute: 60,
        maxSameDropStreak: 2,
        cooldownBetweenRare: 5000
      },
      display: {
        key: 'lootTable.level3.extreme.name',
        descKey: 'lootTable.level3.extreme.desc',
        color: '#9C27B0',
        rarity: 'legendary',
        category: 'lootTable'
      }
    };
  }
  
  async createLevel3EliteTable() {
    return {
      id: 'lootTable.level3.elite',
      type: 'lootTable',
      pools: [
        {
          when: {},
          pity: { enabled: true, maxNoDrop: 1, guaranteedEntry: 'drop.xp_large' },
          rolls: 4,
          entries: [
            { ref: 'drop.xp_large', weight: 60, qty: { min: 3, max: 6 } },
            { ref: 'drop.xp_medium', weight: 40, qty: { min: 4, max: 8 } },
            { ref: 'drop.health_small', weight: 45, qty: { min: 2, max: 4 } },
            { ref: 'drop.metotrexat', weight: 15, qty: { min: 1, max: 2 }, chance: 0.4 }
          ]
        },
        {
          when: { timeGteMs: 180000 },
          pity: { enabled: false },
          rolls: 2,
          entries: [
            { ref: 'drop.metotrexat', weight: 60, qty: { min: 2, max: 4 }, chance: 0.3 }
          ]
        }
      ],
      modifiers: {
        dropRateMultiplier: 5.0,
        qualityBonus: 0.8,
        luckInfluence: 0.3,
        eliteBonus: 1.0,
        bossBonus: 3.0,
        guaranteedDrops: true,
        timeScaling: true,
        timeScalingRate: 0.004,
        chaosMultiplier: 2.0,
        survivalBonus: true,
        survivalThreshold: 120000,
        survivalMultiplier: 3.0
      },
      caps: {
        maxDropsPerMinute: 300,
        maxSameDropStreak: 2,
        cooldownBetweenRare: 1000
      },
      display: {
        key: 'lootTable.level3.elite.name',
        descKey: 'lootTable.level3.elite.desc',
        color: '#E91E63',
        rarity: 'mythic',
        category: 'lootTable'
      }
    };
  }
  
  // === SYSTEM INITIALIZATION ===
  
  async initializeCoreSystems() {
    console.log('[LootSystemBootstrap] Inicializuji core systémy...');
    
    // 1. LootDropManager
    this.lootDropManager = new LootDropManager(this.scene, this.configResolver);
    
    // 2. LootSystemIntegration
    this.lootSystemIntegration = new LootSystemIntegration(
      this.scene, 
      this.lootDropManager, 
      this.scene.lootSystem
    );
    
    console.log('[LootSystemBootstrap] Core systémy inicializovány');
  }
  
  async registerLootTables() {
    console.log('[LootSystemBootstrap] Registruji loot tables...');
    
    // Registrace všech loot tabulek
    for (const [id, table] of this.loadedBlueprints.lootTables) {
      this.lootDropManager.registerTable(table);
    }
    
    // Registrace level tabulek
    this.lootDropManager.registerLevelTables('level1', [
      'lootTable.level1.common',
      'lootTable.level1.elite'
    ]);
    
    this.lootDropManager.registerLevelTables('level2', [
      'lootTable.level2.intermediate',
      'lootTable.level2.elite'
    ]);
    
    this.lootDropManager.registerLevelTables('level3', [
      'lootTable.level3.extreme',
      'lootTable.level3.elite'
    ]);
    
    console.log('[LootSystemBootstrap] Loot tables zaregistrovány');
  }
  
  async connectIntegrations() {
    console.log('[LootSystemBootstrap] Připojuji integrace...');
    
    // Připojení k scene
    this.scene.lootDropManager = this.lootDropManager;
    this.scene.lootSystemIntegration = this.lootSystemIntegration;
    
    // Připojení k update loop
    this.scene.events.on('update', (time, delta) => {
      this.lootSystemIntegration.update(delta);
    });
    
    console.log('[LootSystemBootstrap] Integrace připojeny');
  }
  
  // === VALIDATION ===
  
  async validateLoadedBlueprints() {
    console.log('[LootSystemBootstrap] Validuji načtené blueprinty...');
    
    let totalValidated = 0;
    let totalErrors = 0;
    
    for (const [category, blueprints] of Object.entries(this.loadedBlueprints)) {
      for (const [id, blueprint] of blueprints) {
        try {
          const type = blueprint.type || category.slice(0, -1); // removes 's' from category
          BlueprintValidator.validate(blueprint, type);
          totalValidated++;
        } catch (error) {
          console.warn(`[LootSystemBootstrap] Blueprint validation failed for ${id}:`, error.message);
          totalErrors++;
        }
      }
    }
    
    console.log(`[LootSystemBootstrap] Validace: ${totalValidated} úspěšných, ${totalErrors} chyb`);
    
    if (totalErrors > 0) {
      throw new Error(`Blueprint validation failed: ${totalErrors} errors found`);
    }
  }
  
  async performFinalValidation() {
    console.log('[LootSystemBootstrap] Finální validace systému...');
    
    // Test základní funkčnosti
    const testContext = {
      level: 1,
      timeMs: 60000,
      enemiesKilled: 50,
      playerLuck: 1.0
    };
    
    const mockEnemy = { blueprintId: 'enemy.viral_swarm', x: 100, y: 100 };
    
    try {
      const drops = this.lootDropManager.getDropsForEnemy(mockEnemy, testContext);
      console.log(`[LootSystemBootstrap] Test roll úspěšný: ${drops.length} dropů`);
    } catch (error) {
      throw new Error(`Final validation failed: ${error.message}`);
    }
  }
  
  async setupDebugging() {
    console.log('[LootSystemBootstrap] Nastavuji debugging...');
    
    // Debug API pro globální přístup
    if (typeof window !== 'undefined') {
      window.__lootSystemDebug = {
        manager: this.lootDropManager,
        integration: this.lootSystemIntegration,
        blueprints: this.loadedBlueprints,
        status: this.initializationStatus,
        
        // Debug commands
        testRoll: (tableId, context = {}) => {
          return this.lootDropManager.roll(tableId, {
            level: 1,
            timeMs: 60000,
            enemiesKilled: 50,
            playerLuck: 1.0,
            ...context
          });
        },
        
        getTelemetry: () => {
          return this.lootDropManager.getTelemetry();
        },
        
        resetPity: (tableId) => {
          this.lootDropManager.resetPity(tableId);
        },
        
        simulateRolls: (tableId, count = 100) => {
          const results = [];
          for (let i = 0; i < count; i++) {
            results.push(this.testRoll(tableId));
          }
          return results;
        }
      };
      
      console.log('[LootSystemBootstrap] Debug API dostupné jako window.__lootSystemDebug');
    }
  }
  
  // === UTILITY METHODS ===
  
  getTotalBlueprintsCount() {
    return Object.values(this.loadedBlueprints)
      .reduce((total, map) => total + map.size, 0);
  }
  
  getSystemReferences() {
    return {
      lootDropManager: this.lootDropManager,
      lootSystemIntegration: this.lootSystemIntegration,
      blueprints: this.loadedBlueprints,
      status: this.initializationStatus
    };
  }
  
  // === PUBLIC API ===
  
  isReady() {
    return this.initializationStatus.ready;
  }
  
  getStatus() {
    return {
      enabled: this.enabled,
      initialization: this.initializationStatus,
      blueprintCounts: Object.fromEntries(
        Object.entries(this.loadedBlueprints).map(([key, map]) => [key, map.size])
      ),
      systemReferences: this.getSystemReferences()
    };
  }
}

// Export pro použití v GameScene
export { LootSystemBootstrap };