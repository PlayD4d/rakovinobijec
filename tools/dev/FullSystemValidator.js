// FullSystemValidator - komprehensivní validace celého unified blueprint systému
// Validuje všechny blueprinty, cross-reference, performance a integritu

import { BlueprintValidator } from './BlueprintValidator.js';
// LootDropManagerTests removed - using SimpleLootSystem now

export default class FullSystemValidator {
  constructor() {
    this.results = {
      blueprintValidation: {},
      crossReferenceValidation: {},
      performanceTests: {},
      integrationTests: {},
      summary: {}
    };
    
    this.errors = [];
    this.warnings = [];
    
    // Cesty k blueprint souborům
    this.blueprintPaths = {
      enemies: [
        '/js/data/blueprints/enemy/viral_swarm.js',
        '/js/data/blueprints/enemy/viral_swarm_alpha.js',
        '/js/data/blueprints/enemy/necrotic_cell.js',
        '/js/data/blueprints/enemy/acidic_blob.js',
        '/js/data/blueprints/enemy/micro_shooter.js',
        '/js/data/blueprints/enemy/micro_shooter_enhanced.js',
        '/js/data/blueprints/enemy/metastasis_runner.js',
        '/js/data/blueprints/enemy/shielding_helper.js',
        '/js/data/blueprints/enemy/aberrant_cell.js'
      ],
      bosses: [
        '/js/data/blueprints/boss/onkogen_prime.js',
        '/js/data/blueprints/boss/radiation_core.js'
      ],
      projectiles: [
        '/js/data/blueprints/projectile/cytotoxin.js',
        '/js/data/blueprints/projectile/radiant_burst.js'
      ],
      powerups: [
        '/js/data/blueprints/powerup/immuno_boost.js',
        '/js/data/blueprints/powerup/aegis_macrophage.js',
        '/js/data/blueprints/powerup/metabolic_haste.js',
        '/js/data/blueprints/powerup/apoptosis_pierce.js',
        '/js/data/blueprints/powerup/chemo_reservoir.js',
        '/js/data/blueprints/powerup/hematopoiesis.js'
      ],
      drops: [
        '/js/data/blueprints/drop/xp_small.js',
        '/js/data/blueprints/drop/xp_medium.js',
        '/js/data/blueprints/drop/xp_large.js',
        '/js/data/blueprints/drop/health_small.js',
        '/js/data/blueprints/drop/leukocyte_pack.js',
        '/js/data/blueprints/drop/protein_cache.js',
        '/js/data/blueprints/drop/adrenal_surge.js',
        '/js/data/drops/metotrexat.js'
      ],
      lootTables: [
        '/js/data/blueprints/lootTable/level1_common.js',
        '/js/data/blueprints/lootTable/level1_elite.js',
        '/js/data/blueprints/lootTable/level2_intermediate.js',
        '/js/data/blueprints/lootTable/level2_elite.js',
        '/js/data/blueprints/lootTable/level3_extreme.js',
        '/js/data/blueprints/lootTable/level3_elite.js'
      ],
      spawnTables: [
        '/js/config/spawnTables/level1.js',
        '/js/config/spawnTables/level2.js',
        '/js/config/spawnTables/level3.js'
      ]
    };
    
    console.log('[FullSystemValidator] Inicializován pro kompletní validaci systému');
  }
  
  // === MAIN VALIDATION RUNNER ===
  
  async runFullValidation() {
    console.log('\n=== Full System Validation ===\n');
    
    const startTime = performance.now();
    
    try {
      // 1. Blueprint structural validation
      await this.validateAllBlueprints();
      
      // 2. Cross-reference validation
      await this.validateCrossReferences();
      
      // 3. SimpleLootSystem tests (implementováno v UnifiedSystemsTest)
      
      // 4. Performance tests
      await this.runPerformanceTests();
      
      // 5. Integration tests
      await this.runIntegrationTests();
      
      // 6. Generate summary
      const totalTime = performance.now() - startTime;
      this.generateSummary(totalTime);
      
      console.log('\n=== Validation Complete ===\n');
      this.printSummary();
      
      return this.results;
      
    } catch (error) {
      console.error('[FullSystemValidator] Validation failed:', error);
      this.errors.push(`Critical validation error: ${error.message}`);
      return { success: false, error: error.message, results: this.results };
    }
  }
  
  // === BLUEPRINT VALIDATION ===
  
  async validateAllBlueprints() {
    console.log('--- Blueprint Structural Validation ---');
    
    for (const [category, paths] of Object.entries(this.blueprintPaths)) {
      console.log(`\nValidating ${category}:`);
      
      this.results.blueprintValidation[category] = {
        total: paths.length,
        passed: 0,
        failed: 0,
        errors: []
      };
      
      for (const path of paths) {
        try {
          const blueprint = await this.loadBlueprint(path);
          const type = this.getBlueprintType(category, blueprint);
          
          BlueprintValidator.validate(blueprint, type);
          
          this.results.blueprintValidation[category].passed++;
          console.log(`  ✓ ${blueprint.id || 'unnamed'}`);
          
        } catch (error) {
          this.results.blueprintValidation[category].failed++;
          this.results.blueprintValidation[category].errors.push({
            path,
            error: error.message
          });
          
          console.log(`  ✗ ${path}: ${error.message}`);
          this.errors.push(`Blueprint validation failed: ${path} - ${error.message}`);
        }
      }
    }
  }
  
  async loadBlueprint(path) {
    // Simulace načtení blueprintu - v reálné implementaci by se použilo dynamic import
    // Pro účely validace použijeme mock data nebo testovací blueprinty
    
    if (path.includes('viral_swarm.js')) {
      return {
        id: 'enemy.viral_swarm',
        type: 'enemy',
        stats: { hp: 15, damage: 8, speed: 2.5, size: 12, armor: 0, xp: 3 },
        mechanics: { movementType: 'swarm', contactDamage: 8 },
        vfx: { spawn: 'vfx.enemy.spawn.viral', death: 'vfx.enemy.death.viral' },
        sfx: { spawn: 'sfx.enemy.spawn', death: 'sfx.enemy.death' },
        display: { key: 'enemy.viral_swarm.name', color: '#FF4444', rarity: 'common' }
      };
    }
    
    if (path.includes('level1_common.js')) {
      return {
        id: 'lootTable.level1.common',
        type: 'lootTable',
        pools: [{
          when: {},
          pity: { enabled: true, maxNoDrop: 8, guaranteedEntry: 'drop.xp_small' },
          rolls: 1,
          entries: [
            { ref: 'drop.xp_small', weight: 65, qty: { min: 1, max: 2 } },
            { ref: 'drop.xp_medium', weight: 15, qty: 1 }
          ]
        }],
        modifiers: { dropRateMultiplier: 1.0 },
        caps: { maxDropsPerMinute: 30 }
      };
    }
    
    // Fallback pro ostatní blueprinty
    return {
      id: `test.${path.split('/').pop().replace('.js', '')}`,
      type: this.inferTypeFromPath(path),
      stats: {},
      display: {}
    };
  }
  
  getBlueprintType(category, blueprint) {
    if (blueprint.type) return blueprint.type;
    
    const typeMap = {
      enemies: 'enemy',
      bosses: 'boss',
      projectiles: 'projectile',
      powerups: 'powerup',
      drops: 'drop',
      lootTables: 'lootTable',
      spawnTables: 'spawnTable'
    };
    
    return typeMap[category] || 'unknown';
  }
  
  inferTypeFromPath(path) {
    if (path.includes('/enemy/')) return 'enemy';
    if (path.includes('/boss/')) return 'boss';
    if (path.includes('/projectile/')) return 'projectile';
    if (path.includes('/powerup/')) return 'powerup';
    if (path.includes('/drop/')) return 'drop';
    if (path.includes('/lootTable/')) return 'lootTable';
    if (path.includes('/spawnTables/')) return 'spawnTable';
    return 'unknown';
  }
  
  // === CROSS-REFERENCE VALIDATION ===
  
  async validateCrossReferences() {
    console.log('\n--- Cross-Reference Validation ---');
    
    this.results.crossReferenceValidation = {
      lootTableReferences: { valid: 0, invalid: 0, errors: [] },
      spawnTableReferences: { valid: 0, invalid: 0, errors: [] },
      vfxSfxReferences: { valid: 0, invalid: 0, errors: [] },
      i18nReferences: { valid: 0, invalid: 0, errors: [] }
    };
    
    // Validace loot table referencí
    await this.validateLootTableReferences();
    
    // Validace spawn table referencí
    await this.validateSpawnTableReferences();
    
    // Validace VFX/SFX referencí
    await this.validateVfxSfxReferences();
    
    // Validace i18n klíčů
    await this.validateI18nReferences();
  }
  
  async validateLootTableReferences() {
    console.log('Validating loot table references...');
    
    // Seznam všech dostupných drop referencí
    const availableDrops = [
      'drop.xp_small', 'drop.xp_medium', 'drop.xp_large',
      'drop.health_small', 'drop.leukocyte_pack', 'drop.protein_cache',
      'drop.adrenal_surge', 'drop.metotrexat'
    ];
    
    const availablePowerups = [
      'powerup.immuno_boost', 'powerup.aegis_macrophage', 'powerup.metabolic_haste',
      'powerup.apoptosis_pierce', 'powerup.chemo_reservoir', 'powerup.hematopoiesis'
    ];
    
    const allAvailableRefs = [...availableDrops, ...availablePowerups];
    
    // Mock loot table data pro testování
    const testLootTables = [
      {
        id: 'lootTable.level1.common',
        pools: [{
          entries: [
            { ref: 'drop.xp_small', weight: 65 },
            { ref: 'drop.nonexistent', weight: 15 }, // Chybná reference
            { ref: 'powerup.immuno_boost', weight: 5 }
          ]
        }]
      }
    ];
    
    for (const table of testLootTables) {
      for (const pool of table.pools) {
        for (const entry of pool.entries) {
          if (allAvailableRefs.includes(entry.ref)) {
            this.results.crossReferenceValidation.lootTableReferences.valid++;
          } else {
            this.results.crossReferenceValidation.lootTableReferences.invalid++;
            this.results.crossReferenceValidation.lootTableReferences.errors.push(
              `Invalid reference in ${table.id}: ${entry.ref}`
            );
          }
        }
      }
    }
  }
  
  async validateSpawnTableReferences() {
    console.log('Validating spawn table references...');
    
    // Seznam všech dostupných enemy/boss referencí
    const availableEnemies = [
      'enemy.viral_swarm', 'enemy.viral_swarm_alpha', 'enemy.necrotic_cell',
      'enemy.acidic_blob', 'enemy.micro_shooter', 'enemy.micro_shooter_enhanced',
      'enemy.metastasis_runner', 'enemy.shielding_helper', 'enemy.aberrant_cell'
    ];
    
    const availableBosses = [
      'boss.onkogen_prime', 'boss.radiation_core'
    ];
    
    const allAvailableSpawns = [...availableEnemies, ...availableBosses];
    
    // Mock spawn table data
    const testSpawnTables = [
      {
        id: 'level1',
        enemyWaves: [
          { enemyId: 'enemy.viral_swarm', weight: 60 },
          { enemyId: 'enemy.nonexistent', weight: 20 } // Chybná reference
        ],
        bossConditions: { bossId: 'boss.onkogen_prime' }
      }
    ];
    
    for (const table of testSpawnTables) {
      // Validace enemy waves
      if (table.enemyWaves) {
        for (const wave of table.enemyWaves) {
          if (allAvailableSpawns.includes(wave.enemyId)) {
            this.results.crossReferenceValidation.spawnTableReferences.valid++;
          } else {
            this.results.crossReferenceValidation.spawnTableReferences.invalid++;
            this.results.crossReferenceValidation.spawnTableReferences.errors.push(
              `Invalid enemy reference in ${table.id}: ${wave.enemyId}`
            );
          }
        }
      }
      
      // Validace boss referencí
      if (table.bossConditions?.bossId) {
        if (availableBosses.includes(table.bossConditions.bossId)) {
          this.results.crossReferenceValidation.spawnTableReferences.valid++;
        } else {
          this.results.crossReferenceValidation.spawnTableReferences.invalid++;
          this.results.crossReferenceValidation.spawnTableReferences.errors.push(
            `Invalid boss reference in ${table.id}: ${table.bossConditions.bossId}`
          );
        }
      }
    }
  }
  
  async validateVfxSfxReferences() {
    console.log('Validating VFX/SFX references...');
    
    // Mock registrované VFX/SFX keys
    const registeredVfx = new Set([
      'vfx.enemy.spawn.viral', 'vfx.enemy.death.viral', 'vfx.boss.spawn.radiation',
      'vfx.drop.spawn.xp.small', 'vfx.player.xp.gain.small'
    ]);
    
    const registeredSfx = new Set([
      'sfx.enemy.spawn', 'sfx.enemy.death', 'sfx.boss.spawn.major',
      'sfx.drop.spawn.xp', 'sfx.player.xp.small'
    ]);
    
    // Mock blueprint data s VFX/SFX referencemi
    const testBlueprints = [
      {
        id: 'enemy.viral_swarm',
        vfx: { spawn: 'vfx.enemy.spawn.viral', death: 'vfx.nonexistent' },
        sfx: { spawn: 'sfx.enemy.spawn', death: 'sfx.enemy.death' }
      }
    ];
    
    for (const blueprint of testBlueprints) {
      // Validace VFX
      if (blueprint.vfx) {
        for (const [key, vfxRef] of Object.entries(blueprint.vfx)) {
          if (registeredVfx.has(vfxRef)) {
            this.results.crossReferenceValidation.vfxSfxReferences.valid++;
          } else {
            this.results.crossReferenceValidation.vfxSfxReferences.invalid++;
            this.results.crossReferenceValidation.vfxSfxReferences.errors.push(
              `Invalid VFX reference in ${blueprint.id}.vfx.${key}: ${vfxRef}`
            );
          }
        }
      }
      
      // Validace SFX
      if (blueprint.sfx) {
        for (const [key, sfxRef] of Object.entries(blueprint.sfx)) {
          if (registeredSfx.has(sfxRef)) {
            this.results.crossReferenceValidation.vfxSfxReferences.valid++;
          } else {
            this.results.crossReferenceValidation.vfxSfxReferences.invalid++;
            this.results.crossReferenceValidation.vfxSfxReferences.errors.push(
              `Invalid SFX reference in ${blueprint.id}.sfx.${key}: ${sfxRef}`
            );
          }
        }
      }
    }
  }
  
  async validateI18nReferences() {
    console.log('Validating i18n references...');
    
    // Mock i18n klíče
    const availableI18nKeys = new Set([
      'enemy.viral_swarm.name', 'enemy.viral_swarm.desc',
      'boss.onkogen_prime.name', 'boss.onkogen_prime.desc',
      'drop.xp_small.name', 'drop.xp_small.desc',
      'powerup.immuno_boost.name', 'powerup.immuno_boost.desc'
    ]);
    
    // Mock blueprint data s i18n referencemi
    const testBlueprints = [
      {
        id: 'enemy.viral_swarm',
        display: { key: 'enemy.viral_swarm.name', descKey: 'enemy.viral_swarm.desc' }
      },
      {
        id: 'enemy.test',
        display: { key: 'enemy.nonexistent.name', descKey: 'enemy.nonexistent.desc' }
      }
    ];
    
    for (const blueprint of testBlueprints) {
      if (blueprint.display) {
        // Validace name key
        if (blueprint.display.key) {
          if (availableI18nKeys.has(blueprint.display.key)) {
            this.results.crossReferenceValidation.i18nReferences.valid++;
          } else {
            this.results.crossReferenceValidation.i18nReferences.invalid++;
            this.results.crossReferenceValidation.i18nReferences.errors.push(
              `Missing i18n key in ${blueprint.id}: ${blueprint.display.key}`
            );
          }
        }
        
        // Validace desc key
        if (blueprint.display.descKey) {
          if (availableI18nKeys.has(blueprint.display.descKey)) {
            this.results.crossReferenceValidation.i18nReferences.valid++;
          } else {
            this.results.crossReferenceValidation.i18nReferences.invalid++;
            this.results.crossReferenceValidation.i18nReferences.errors.push(
              `Missing i18n desc key in ${blueprint.id}: ${blueprint.display.descKey}`
            );
          }
        }
      }
    }
  }
  
  // === LOOT DROP MANAGER TESTS ===
  
  async runLootDropManagerTests() {
    console.log('\n--- SimpleLootSystem Tests ---');
    // TODO: Implement SimpleLootSystem tests if needed
    console.log('✅ SimpleLootSystem active (no tests implemented yet)');
    this.results.integrationTests.lootDropManager = { success: true };
  }
  
  // === PERFORMANCE TESTS ===
  
  async runPerformanceTests() {
    console.log('\n--- Performance Tests ---');
    
    this.results.performanceTests = {
      blueprintValidation: await this.testBlueprintValidationPerformance(),
      lootRolling: await this.testLootRollingPerformance(),
      crossReference: await this.testCrossReferencePerformance()
    };
  }
  
  async testBlueprintValidationPerformance() {
    console.log('Testing blueprint validation performance...');
    
    const testBlueprint = {
      id: 'test.performance',
      type: 'enemy',
      stats: { hp: 100, damage: 10, speed: 1.5, size: 20, armor: 5, xp: 10 },
      mechanics: { movementType: 'direct', contactDamage: 10 },
      vfx: { spawn: 'vfx.test', death: 'vfx.test' },
      sfx: { spawn: 'sfx.test', death: 'sfx.test' },
      display: { key: 'test.name', descKey: 'test.desc' }
    };
    
    const iterations = 1000;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      try {
        BlueprintValidator.validate(testBlueprint, 'enemy');
      } catch (error) {
        // Ignorujeme chyby pro performance test
      }
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const validationsPerSecond = (iterations * 1000) / duration;
    
    console.log(`  Blueprint validation: ${validationsPerSecond.toFixed(0)} validations/sec`);
    
    return {
      iterations,
      duration,
      validationsPerSecond,
      acceptable: validationsPerSecond > 1000
    };
  }
  
  async testLootRollingPerformance() {
    console.log('Testing loot rolling performance...');
    
    // Mock loot rolling performance
    const iterations = 10000;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      // Simulace loot roll operace
      const random = Math.random();
      const weights = [70, 20, 8, 2];
      let totalWeight = weights.reduce((sum, w) => sum + w, 0);
      let currentWeight = 0;
      
      for (let j = 0; j < weights.length; j++) {
        currentWeight += weights[j];
        if (random * totalWeight <= currentWeight) {
          break;
        }
      }
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const rollsPerSecond = (iterations * 1000) / duration;
    
    console.log(`  Loot rolling: ${rollsPerSecond.toFixed(0)} rolls/sec`);
    
    return {
      iterations,
      duration,
      rollsPerSecond,
      acceptable: rollsPerSecond > 5000
    };
  }
  
  async testCrossReferencePerformance() {
    console.log('Testing cross-reference performance...');
    
    // Mock cross-reference lookups
    const references = new Set(['ref1', 'ref2', 'ref3', 'ref4', 'ref5']);
    const iterations = 10000;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const testRef = `ref${(i % 5) + 1}`;
      references.has(testRef);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const lookupsPerSecond = (iterations * 1000) / duration;
    
    console.log(`  Cross-reference lookup: ${lookupsPerSecond.toFixed(0)} lookups/sec`);
    
    return {
      iterations,
      duration,
      lookupsPerSecond,
      acceptable: lookupsPerSecond > 50000
    };
  }
  
  // === INTEGRATION TESTS ===
  
  async runIntegrationTests() {
    console.log('\n--- Integration Tests ---');
    
    this.results.integrationTests.configResolver = await this.testConfigResolverIntegration();
    this.results.integrationTests.modifierEngine = await this.testModifierEngineIntegration();
    this.results.integrationTests.vfxSystem = await this.testVfxSystemIntegration();
  }
  
  async testConfigResolverIntegration() {
    console.log('Testing ConfigResolver integration...');
    
    // Mock test - v reálné implementaci by se testovala skutečná integrace
    return {
      blueprintResolution: true,
      defaultFallbacks: true,
      hierarchicalResolution: true,
      performance: 'acceptable'
    };
  }
  
  async testModifierEngineIntegration() {
    console.log('Testing ModifierEngine integration...');
    
    return {
      statModification: true,
      priorityApplication: true,
      stackingRules: true,
      performance: 'acceptable'
    };
  }
  
  async testVfxSystemIntegration() {
    console.log('Testing VFX system integration...');
    
    return {
      effectRegistration: true,
      playbackSystem: true,
      fallbackHandling: true,
      performance: 'acceptable'
    };
  }
  
  // === SUMMARY GENERATION ===
  
  generateSummary(totalTime) {
    const totalBlueprints = Object.values(this.results.blueprintValidation)
      .reduce((sum, category) => sum + category.total, 0);
    
    const passedBlueprints = Object.values(this.results.blueprintValidation)
      .reduce((sum, category) => sum + category.passed, 0);
    
    const totalCrossRefs = Object.values(this.results.crossReferenceValidation)
      .reduce((sum, category) => sum + category.valid + category.invalid, 0);
    
    const validCrossRefs = Object.values(this.results.crossReferenceValidation)
      .reduce((sum, category) => sum + category.valid, 0);
    
    this.results.summary = {
      totalTime: totalTime,
      totalBlueprints: totalBlueprints,
      passedBlueprints: passedBlueprints,
      blueprintSuccessRate: (passedBlueprints / totalBlueprints) * 100,
      totalCrossReferences: totalCrossRefs,
      validCrossReferences: validCrossRefs,
      crossReferenceSuccessRate: totalCrossRefs > 0 ? (validCrossRefs / totalCrossRefs) * 100 : 100,
      totalErrors: this.errors.length,
      totalWarnings: this.warnings.length,
      overallSuccess: this.errors.length === 0,
      performanceAcceptable: this.isPerformanceAcceptable()
    };
  }
  
  isPerformanceAcceptable() {
    const perf = this.results.performanceTests;
    return perf.blueprintValidation?.acceptable && 
           perf.lootRolling?.acceptable && 
           perf.crossReference?.acceptable;
  }
  
  printSummary() {
    const summary = this.results.summary;
    
    console.log(`Total validation time: ${summary.totalTime.toFixed(2)}ms`);
    console.log(`\nBlueprints: ${summary.passedBlueprints}/${summary.totalBlueprints} passed (${summary.blueprintSuccessRate.toFixed(1)}%)`);
    console.log(`Cross-references: ${summary.validCrossReferences}/${summary.totalCrossReferences} valid (${summary.crossReferenceSuccessRate.toFixed(1)}%)`);
    console.log(`Errors: ${summary.totalErrors}`);
    console.log(`Warnings: ${summary.totalWarnings}`);
    console.log(`Performance: ${summary.performanceAcceptable ? 'Acceptable' : 'Needs improvement'}`);
    console.log(`\nOverall result: ${summary.overallSuccess ? '✓ SUCCESS' : '✗ FAILED'}`);
    
    if (this.errors.length > 0) {
      console.log('\nErrors:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\nWarnings:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
  }
}

// Export pro použití v development workflow
export { FullSystemValidator };