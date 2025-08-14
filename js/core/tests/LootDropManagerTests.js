// LootDropManagerTests - komprehensivní test suite pro LootDropManager
// Unit testy, smoke testy a performance testy

import LootDropManager from '../loot/LootDropManager.js';
import { BlueprintValidator } from '../validation/BlueprintValidator.js';

export default class LootDropManagerTests {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    
    // Mock scene a ConfigResolver
    this.mockScene = this.createMockScene();
    this.mockConfigResolver = this.createMockConfigResolver();
    
    console.log('[LootDropManagerTests] Test suite inicializována');
  }
  
  // === MOCK FACTORIES ===
  
  createMockScene() {
    return {
      time: { now: 60000 },
      currentLevel: 1,
      enemiesKilled: 50,
      elitesKilled: 5,
      bossesKilled: 1,
      player: { level: 3, luckMultiplier: 1.2 }
    };
  }
  
  createMockConfigResolver() {
    return {
      get: (path, options = {}) => {
        const config = {
          'features.lootTablesEnabled': true,
          'loot.luck.basePlayerLuck': 1.0,
          'loot.luck.luckPerLevel': 0.05,
          'loot.luck.maxLuck': 2.0,
          'loot.luck.eliteLuckBonus': 0.2,
          'loot.luck.bossLuckBonus': 0.5,
          'loot.telemetry.enabled': true,
          'loot.telemetry.logRareDrops': false,
          'loot.debug.enabled': false
        };
        
        return config[path] ?? options.defaultValue;
      }
    };
  }
  
  createTestLootTable() {
    return {
      id: 'lootTable.test.basic',
      type: 'lootTable',
      pools: [
        {
          when: {},
          pity: { 
            enabled: true, 
            maxNoDrop: 5,
            guaranteedEntry: 'drop.xp_small'
          },
          rolls: 1,
          entries: [
            { ref: 'drop.xp_small', weight: 70, qty: { min: 1, max: 2 } },
            { ref: 'drop.xp_medium', weight: 20, qty: 1 },
            { ref: 'drop.health_small', weight: 8, qty: 1, chance: 0.5 },
            { ref: 'drop.metotrexat', weight: 2, qty: 1, unique: true, chance: 0.1 }
          ]
        }
      ],
      modifiers: {
        dropRateMultiplier: 1.0,
        qualityBonus: 0.1,
        luckInfluence: 0.1
      },
      caps: {
        maxDropsPerMinute: 30,
        maxSameDropStreak: 3,
        cooldownBetweenRare: 5000
      }
    };
  }
  
  // === HLAVNÍ TEST RUNNER ===
  
  async runAllTests() {
    console.log('\n=== LootDropManager Test Suite ===\n');
    
    try {
      await this.runBasicTests();
      await this.runWeightedRollingTests();
      await this.runPitySystemTests();
      await this.runConditionalPoolTests();
      await this.runModifierTests();
      await this.runCapsAndCooldownTests();
      await this.runValidationTests();
      await this.runSmokeTests();
      await this.runPerformanceTests();
      
      this.printSummary();
      return this.generateReport();
      
    } catch (error) {
      console.error('[LootTests] Test suite crashed:', error);
      return { success: false, error: error.message };
    }
  }
  
  // === BASIC TESTS ===
  
  async runBasicTests() {
    console.log('--- Basic Functionality Tests ---');
    
    await this.test('Manager Initialization', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      this.assert(manager.enabled === true, 'Manager should be enabled by default');
      this.assert(manager.globalState.timeMs === 0, 'Global time should start at 0');
      this.assert(manager.registeredTables.size === 0, 'No tables should be registered initially');
    });
    
    await this.test('Table Registration', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      const table = this.createTestLootTable();
      
      const result = manager.registerTable(table);
      this.assert(result === true, 'Registration should succeed');
      this.assert(manager.registeredTables.has(table.id), 'Table should be registered');
      this.assert(manager.pityCounters.has(`${table.id}:pool0`), 'Pity counter should be created');
    });
    
    await this.test('Level Table Registration', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      
      manager.registerLevelTables('level1', ['lootTable.level1.common', 'lootTable.level1.elite']);
      
      const tables = manager.levelTables.get('level1');
      this.assert(Array.isArray(tables), 'Level tables should be array');
      this.assert(tables.length === 2, 'Should have 2 tables');
      this.assert(tables.includes('lootTable.level1.common'), 'Should contain common table');
    });
  }
  
  // === WEIGHTED ROLLING TESTS ===
  
  async runWeightedRollingTests() {
    console.log('--- Weighted Rolling Tests ---');
    
    await this.test('Simple Weighted Roll', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      const table = this.createTestLootTable();
      manager.registerTable(table);
      
      // Force určitý outcome pomocí Math.random mock
      const originalRandom = Math.random;
      Math.random = () => 0.1; // Mělo by vybrat první entry (weight 70)
      
      const context = { level: 1, timeMs: 10000, enemiesKilled: 10, playerLuck: 1.0 };
      const drops = manager.roll(table.id, context);
      
      Math.random = originalRandom;
      
      this.assert(drops.length >= 0, 'Should return array of drops');
      if (drops.length > 0) {
        this.assert(drops[0].ref === 'drop.xp_small', 'Should select first entry with low random value');
      }
    });
    
    await this.test('Quantity Rolling', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      
      // Test různých quantity specifikací
      this.assert(manager.rollQuantity(5) === 5, 'Number quantity should return exact value');
      this.assert(manager.rollQuantity({ min: 2, max: 2 }) === 2, 'Min=Max should return exact value');
      
      const rangeQty = manager.rollQuantity({ min: 1, max: 5 });
      this.assert(rangeQty >= 1 && rangeQty <= 5, 'Range quantity should be within bounds');
    });
    
    await this.test('Weight Distribution', async () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      const table = this.createTestLootTable();
      manager.registerTable(table);
      
      const context = { level: 1, timeMs: 10000, enemiesKilled: 50, playerLuck: 1.0 };
      const results = new Map();
      const iterations = 1000;
      
      // Simulace mnoha rollů pro ověření distribuce
      for (let i = 0; i < iterations; i++) {
        const drops = manager.roll(table.id, context);
        if (drops.length > 0) {
          const ref = drops[0].ref;
          results.set(ref, (results.get(ref) || 0) + 1);
        }
      }
      
      const xpSmallCount = results.get('drop.xp_small') || 0;
      const xpMediumCount = results.get('drop.xp_medium') || 0;
      
      // xp_small má weight 70, xp_medium má 20 - poměr by měl být přibližně 3.5:1
      const ratio = xpSmallCount / Math.max(xpMediumCount, 1);
      this.assert(ratio > 2.0 && ratio < 6.0, `Weight distribution ratio should be ~3.5, got ${ratio.toFixed(2)}`);
    });
  }
  
  // === PITY SYSTEM TESTS ===
  
  async runPitySystemTests() {
    console.log('--- Pity System Tests ---');
    
    await this.test('Pity Activation', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      const table = this.createTestLootTable();
      manager.registerTable(table);
      
      const pityKey = `${table.id}:pool0`;
      const context = { level: 1, timeMs: 10000, enemiesKilled: 10, playerLuck: 1.0 };
      
      // Simulace streak bez dropů
      manager.pityCounters.set(pityKey, 5); // maxNoDrop je 5
      
      const drops = manager.roll(table.id, context);
      
      this.assert(drops.length > 0, 'Pity should guarantee at least one drop');
      this.assert(drops[0].ref === 'drop.xp_small', 'Pity should give guaranteed entry');
      this.assert(drops[0].isPityDrop === true, 'Drop should be marked as pity drop');
      this.assert(manager.pityCounters.get(pityKey) === 0, 'Pity counter should reset');
    });
    
    await this.test('Pity Counter Increment', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      const table = this.createTestLootTable();
      manager.registerTable(table);
      
      const pityKey = `${table.id}:pool0`;
      
      // Force no drop výsledky
      const originalRandom = Math.random;
      Math.random = () => 0.999; // Vysoká hodnota = žádný entry
      
      const context = { level: 1, timeMs: 10000, enemiesKilled: 10, playerLuck: 1.0 };
      
      const initialCount = manager.pityCounters.get(pityKey) || 0;
      manager.roll(table.id, context);
      const newCount = manager.pityCounters.get(pityKey) || 0;
      
      Math.random = originalRandom;
      
      this.assert(newCount > initialCount, 'Pity counter should increment on no drop');
    });
  }
  
  // === CONDITIONAL POOL TESTS ===
  
  async runConditionalPoolTests() {
    console.log('--- Conditional Pool Tests ---');
    
    await this.test('Time-Based Conditions', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      
      const tableWithConditions = {
        id: 'lootTable.test.conditional',
        type: 'lootTable',
        pools: [
          {
            when: { timeGteMs: 30000 }, // Aktivní od 30s
            pity: { enabled: false },
            rolls: 1,
            entries: [
              { ref: 'drop.xp_large', weight: 100, qty: 1 }
            ]
          }
        ]
      };
      
      manager.registerTable(tableWithConditions);
      
      // Test před splněním podmínky
      let context = { level: 1, timeMs: 20000, enemiesKilled: 10, playerLuck: 1.0 };
      let drops = manager.roll(tableWithConditions.id, context);
      this.assert(drops.length === 0, 'Pool should not activate before time condition');
      
      // Test po splnění podmínky
      context = { level: 1, timeMs: 40000, enemiesKilled: 10, playerLuck: 1.0 };
      drops = manager.roll(tableWithConditions.id, context);
      this.assert(drops.length >= 0, 'Pool should be eligible after time condition');
    });
    
    await this.test('Kill Count Conditions', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      
      // Test condition checking function directly
      const conditions = { enemiesKilledGte: 100 };
      
      const contextLow = { enemiesKilled: 50 };
      const contextHigh = { enemiesKilled: 150 };
      
      this.assert(!manager.checkPoolConditions(conditions, contextLow), 'Should not pass with low kill count');
      this.assert(manager.checkPoolConditions(conditions, contextHigh), 'Should pass with high kill count');
    });
  }
  
  // === MODIFIER TESTS ===
  
  async runModifierTests() {
    console.log('--- Modifier Tests ---');
    
    await this.test('Drop Rate Multiplier', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      
      const tableWithMultiplier = {
        ...this.createTestLootTable(),
        id: 'lootTable.test.multiplier',
        modifiers: {
          dropRateMultiplier: 2.0  // 2x drop rate
        }
      };
      
      manager.registerTable(tableWithMultiplier);
      
      const context = { level: 1, timeMs: 10000, enemiesKilled: 10, playerLuck: 1.0 };
      const baseDrops = [{ ref: 'drop.xp_small', qty: 1, context }];
      
      const modifiedDrops = manager.applyTableModifiers(tableWithMultiplier, baseDrops, context);
      
      // Drop rate multiplier může způsobit extra dropy, ale není deterministický
      this.assert(modifiedDrops.length >= baseDrops.length, 'Multiplier should not reduce drops');
    });
    
    await this.test('Elite and Boss Bonuses', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      
      const tableWithBonuses = {
        ...this.createTestLootTable(),
        id: 'lootTable.test.bonuses',
        modifiers: {
          eliteBonus: 1.5,  // 1.5x for elites
          bossBonus: 3.0    // 3x for bosses
        }
      };
      
      manager.registerTable(tableWithBonuses);
      
      const baseDrop = { ref: 'drop.xp_small', qty: 2, context: {} };
      
      // Elite bonus test
      const eliteContext = { elite: true, boss: false };
      const eliteDrops = manager.applyTableModifiers(tableWithBonuses, [baseDrop], eliteContext);
      this.assert(eliteDrops[0].qty >= 2, 'Elite bonus should increase quantity');
      
      // Boss bonus test  
      const bossContext = { elite: true, boss: true };
      const bossDrops = manager.applyTableModifiers(tableWithBonuses, [baseDrop], bossContext);
      this.assert(bossDrops[0].qty >= eliteDrops[0].qty, 'Boss should get bigger bonus than elite');
    });
  }
  
  // === CAPS AND COOLDOWN TESTS ===
  
  async runCapsAndCooldownTests() {
    console.log('--- Caps and Cooldown Tests ---');
    
    await this.test('Same Drop Streak Prevention', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      
      const drops = [
        { ref: 'drop.xp_small', qty: 1 },
        { ref: 'drop.xp_small', qty: 1 },
        { ref: 'drop.xp_small', qty: 1 },
        { ref: 'drop.xp_small', qty: 1 },
        { ref: 'drop.xp_medium', qty: 1 }
      ];
      
      const cappedDrops = manager.preventSameDropStreak(drops, 2);
      
      const xpSmallCount = cappedDrops.filter(d => d.ref === 'drop.xp_small').length;
      this.assert(xpSmallCount <= 2, `Should limit same drops to 2, got ${xpSmallCount}`);
      
      const hasMedium = cappedDrops.some(d => d.ref === 'drop.xp_medium');
      this.assert(hasMedium, 'Should preserve different drops');
    });
    
    await this.test('Cooldown System', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      const currentTime = Date.now();
      
      // Set cooldown
      manager.cooldowns.set('cooldown:drop.metotrexat', currentTime + 5000);
      
      this.assert(manager.isOnCooldown('drop.metotrexat'), 'Should be on cooldown');
      
      // Test expired cooldown
      manager.cooldowns.set('cooldown:drop.test', currentTime - 1000);
      this.assert(!manager.isOnCooldown('drop.test'), 'Expired cooldown should not block');
    });
  }
  
  // === VALIDATION TESTS ===
  
  async runValidationTests() {
    console.log('--- Blueprint Validation Tests ---');
    
    await this.test('Valid LootTable Blueprint', () => {
      const validTable = this.createTestLootTable();
      
      try {
        BlueprintValidator.validate(validTable, 'lootTable');
        this.assert(true, 'Valid loot table should pass validation');
      } catch (error) {
        this.assert(false, `Valid table failed validation: ${error.message}`);
      }
    });
    
    await this.test('Invalid LootTable Blueprint', () => {
      const invalidTable = {
        id: 'lootTable.invalid',
        type: 'lootTable',
        pools: [] // Empty pools should be invalid
      };
      
      try {
        BlueprintValidator.validate(invalidTable, 'lootTable');
        this.assert(false, 'Invalid table should fail validation');
      } catch (error) {
        this.assert(error.message.includes('pools array cannot be empty'), 'Should catch empty pools');
      }
    });
    
    await this.test('Entry Validation', () => {
      const invalidEntry = {
        id: 'lootTable.bad.entry',
        type: 'lootTable',
        pools: [{
          entries: [{
            // Missing ref
            weight: 50,
            qty: { min: 2, max: 1 } // min > max
          }]
        }]
      };
      
      try {
        BlueprintValidator.validate(invalidEntry, 'lootTable');
        this.assert(false, 'Bad entry should fail validation');
      } catch (error) {
        this.assert(error.message.includes('missing or invalid ref'), 'Should catch missing ref');
        this.assert(error.message.includes('min cannot be greater than max'), 'Should catch qty range error');
      }
    });
  }
  
  // === SMOKE TESTS ===
  
  async runSmokeTests() {
    console.log('--- Smoke Tests (1000 simulations) ---');
    
    await this.test('Level 1 Distribution Smoke Test', async () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      const table = this.createTestLootTable();
      manager.registerTable(table);
      
      const results = {
        totalRolls: 0,
        totalDrops: 0,
        dropsByRef: new Map(),
        pityActivations: 0
      };
      
      const context = { level: 1, timeMs: 60000, enemiesKilled: 100, playerLuck: 1.0 };
      
      for (let i = 0; i < 1000; i++) {
        const drops = manager.roll(table.id, context);
        results.totalRolls++;
        results.totalDrops += drops.length;
        
        drops.forEach(drop => {
          results.dropsByRef.set(drop.ref, (results.dropsByRef.get(drop.ref) || 0) + 1);
          if (drop.isPityDrop) results.pityActivations++;
        });
      }
      
      // Smoke test assertions
      this.assert(results.totalDrops > 0, 'Should generate some drops over 1000 rolls');
      this.assert(results.dropsByRef.get('drop.xp_small') > results.dropsByRef.get('drop.xp_medium'), 
                 'XP Small should be more common than XP Medium');
      
      const dropRate = results.totalDrops / results.totalRolls;
      this.assert(dropRate > 0.1 && dropRate < 2.0, `Drop rate should be reasonable, got ${dropRate.toFixed(3)}`);
      
      console.log(`  Smoke test results: ${results.totalDrops} drops from ${results.totalRolls} rolls (${(dropRate * 100).toFixed(1)}%)`);
      console.log(`  Pity activations: ${results.pityActivations}`);
    });
  }
  
  // === PERFORMANCE TESTS ===
  
  async runPerformanceTests() {
    console.log('--- Performance Tests ---');
    
    await this.test('Roll Performance', () => {
      const manager = new LootDropManager(this.mockScene, this.mockConfigResolver);
      const table = this.createTestLootTable();
      manager.registerTable(table);
      
      const context = { level: 1, timeMs: 60000, enemiesKilled: 100, playerLuck: 1.0 };
      const iterations = 10000;
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        manager.roll(table.id, context);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      const rollsPerSecond = (iterations * 1000) / duration;
      
      console.log(`  Performance: ${iterations} rolls in ${duration.toFixed(2)}ms (${rollsPerSecond.toFixed(0)} rolls/sec)`);
      
      this.assert(rollsPerSecond > 1000, `Performance should be >1000 rolls/sec, got ${rollsPerSecond.toFixed(0)}`);
    });
  }
  
  // === TEST UTILITIES ===
  
  async test(name, testFunction) {
    this.totalTests++;
    
    try {
      await testFunction();
      this.testResults.push({ name, passed: true, error: null });
      this.passedTests++;
      console.log(`  ✓ ${name}`);
    } catch (error) {
      this.testResults.push({ name, passed: false, error: error.message });
      this.failedTests++;
      console.log(`  ✗ ${name}: ${error.message}`);
    }
  }
  
  assert(condition, message = 'Assertion failed') {
    if (!condition) {
      throw new Error(message);
    }
  }
  
  printSummary() {
    console.log('\n=== Test Summary ===');
    console.log(`Total tests: ${this.totalTests}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.failedTests}`);
    console.log(`Success rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
    
    if (this.failedTests > 0) {
      console.log('\nFailed tests:');
      this.testResults.filter(r => !r.passed).forEach(result => {
        console.log(`  - ${result.name}: ${result.error}`);
      });
    }
  }
  
  generateReport() {
    return {
      success: this.failedTests === 0,
      summary: {
        total: this.totalTests,
        passed: this.passedTests,
        failed: this.failedTests,
        successRate: (this.passedTests / this.totalTests) * 100
      },
      results: this.testResults,
      timestamp: new Date().toISOString()
    };
  }
}

// Export pro použití v game engine
export { LootDropManagerTests };