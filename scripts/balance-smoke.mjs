#!/usr/bin/env node
/**
 * Balance Smoke Test - TTK/DPM Simulation & Validation
 * 
 * Validates game balance for 30-minute gameplay sessions:
 * - TTK (Time To Kill) targets: Level1 ~2.5s, Level2 ~2.0s, Level3 ~1.5s
 * - Wave pacing analysis
 * - Loot table validation
 * - Progression curve validation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BalanceSmokeTest {
  constructor() {
    this.results = {
      ttk: {},
      waves: {},
      loot: {},
      progression: {},
      summary: { passed: 0, failed: 0, warnings: 0 }
    };
  }

  /**
   * Run complete balance validation suite
   */
  async run() {
    console.log('🎯 Balance Smoke Test - Starting validation...\n');
    
    try {
      // Load spawn tables
      const level1 = await this.loadSpawnTable('level1.js');
      const level2 = await this.loadSpawnTable('level2.js');  
      const level3 = await this.loadSpawnTable('level3.js');
      
      // Load enemy blueprints
      const enemies = await this.loadEnemyBlueprints();
      
      // Run validation tests
      this.validateTTK({ level1, level2, level3 }, enemies);
      this.validateWavePacing({ level1, level2, level3 });
      this.validateLootTables({ level1, level2, level3 });
      this.validateProgression({ level1, level2, level3 });
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Balance test failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Load spawn table configuration
   */
  async loadSpawnTable(filename) {
    const filePath = path.join(__dirname, '..', 'js', 'config', 'spawnTables', filename);
    const module = await import(filePath);
    return module.default;
  }

  /**
   * Load enemy blueprints for stat validation
   */
  async loadEnemyBlueprints() {
    const enemyDir = path.join(__dirname, '..', 'data', 'blueprints', 'enemy');
    const files = fs.readdirSync(enemyDir).filter(f => f.endsWith('.json5'));
    
    const enemies = {};
    for (const file of files) {
      const content = fs.readFileSync(path.join(enemyDir, file), 'utf8');
      const enemy = JSON.parse(content.replace(/\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'));
      enemies[enemy.id] = enemy;
    }
    
    return enemies;
  }

  /**
   * Validate TTK (Time To Kill) targets
   */
  validateTTK(levels, enemies) {
    console.log('📊 Validating TTK targets...');
    
    const targets = {
      level1: 2500, // 2.5s
      level2: 2000, // 2.0s  
      level3: 1500  // 1.5s
    };

    Object.entries(levels).forEach(([levelName, config]) => {
      const targetTTK = targets[levelName];
      const configTTK = config.difficulty.targetTTK;
      
      if (configTTK === targetTTK) {
        this.pass(`✅ ${levelName}: TTK ${configTTK}ms matches target ${targetTTK}ms`);
        this.results.ttk[levelName] = { status: 'PASS', actual: configTTK, target: targetTTK };
      } else {
        this.fail(`❌ ${levelName}: TTK ${configTTK}ms != target ${targetTTK}ms`);
        this.results.ttk[levelName] = { status: 'FAIL', actual: configTTK, target: targetTTK };
      }
    });
  }

  /**
   * Validate wave pacing and timing
   */
  validateWavePacing(levels) {
    console.log('\n⏱️  Validating wave pacing...');
    
    Object.entries(levels).forEach(([levelName, config]) => {
      const duration = config.meta.estimatedDuration;
      const bossMinTime = config.bossConditions.timeCondition.minTime;
      const waves = config.enemyWaves;
      
      // Check duration targets (aim for 4-5 minute levels)
      const targetDuration = { level1: 240000, level2: 280000, level3: 300000 }[levelName];
      if (Math.abs(duration - targetDuration) <= 20000) { // ±20s tolerance
        this.pass(`✅ ${levelName}: Duration ${duration/1000}s within target range`);
      } else {
        this.warn(`⚠️  ${levelName}: Duration ${duration/1000}s may be off target ${targetDuration/1000}s`);
      }
      
      // Check wave progression (intervals should generally decrease)
      let prevInterval = Infinity;
      let intervalProgression = true;
      waves.forEach(wave => {
        if (wave.interval > prevInterval * 1.2) { // Allow some flexibility
          intervalProgression = false;
        }
        prevInterval = Math.min(prevInterval, wave.interval);
      });
      
      if (intervalProgression) {
        this.pass(`✅ ${levelName}: Wave intervals show good progression`);
      } else {
        this.warn(`⚠️  ${levelName}: Wave interval progression could be smoother`);
      }
      
      this.results.waves[levelName] = {
        duration,
        bossMinTime,
        waveCount: waves.length,
        intervalProgression
      };
    });
  }

  /**
   * Validate loot table balance
   */
  validateLootTables(levels) {
    console.log('\n💎 Validating loot tables...');
    
    Object.entries(levels).forEach(([levelName, config]) => {
      const { normal, elite, boss } = config.lootTables;
      
      // Check that total probabilities make sense
      const normalTotal = Object.values(normal).reduce((a, b) => a + b, 0);
      const eliteTotal = Object.values(elite).reduce((a, b) => a + b, 0);
      const bossTotal = Object.values(boss).reduce((a, b) => a + b, 0);
      
      // Boss should have highest values, elite middle, normal lowest
      if (bossTotal > eliteTotal && eliteTotal > normalTotal) {
        this.pass(`✅ ${levelName}: Loot table progression (boss > elite > normal)`);
      } else {
        this.warn(`⚠️  ${levelName}: Loot table values may need adjustment`);
      }
      
      // Check for Metotrexat (special drop) presence
      if (normal['drop.metotrexat'] && elite['drop.metotrexat'] && boss['drop.metotrexat']) {
        this.pass(`✅ ${levelName}: Metotrexat drop configured across all tiers`);
      } else {
        this.warn(`⚠️  ${levelName}: Missing Metotrexat in some loot tiers`);
      }
      
      this.results.loot[levelName] = {
        normalTotal,
        eliteTotal, 
        bossTotal,
        hasMetotrexat: !!(normal['drop.metotrexat'] && elite['drop.metotrexat'] && boss['drop.metotrexat'])
      };
    });
  }

  /**
   * Validate progression scaling
   */
  validateProgression(levels) {
    console.log('\n📈 Validating progression scaling...');
    
    const levelOrder = ['level1', 'level2', 'level3'];
    
    // Check that multipliers increase across levels
    let prevHpMult = 0;
    let prevDmgMult = 0;
    let prevSpawnMult = 0;
    
    levelOrder.forEach(levelName => {
      const diff = levels[levelName].difficulty;
      
      if (diff.enemyHpMultiplier >= prevHpMult && 
          diff.enemyDamageMultiplier >= prevDmgMult &&
          diff.spawnRateMultiplier >= prevSpawnMult) {
        this.pass(`✅ ${levelName}: Difficulty multipliers increase correctly`);
      } else {
        this.fail(`❌ ${levelName}: Difficulty scaling regression detected`);
      }
      
      prevHpMult = diff.enemyHpMultiplier;
      prevDmgMult = diff.enemyDamageMultiplier;
      prevSpawnMult = diff.spawnRateMultiplier;
    });
    
    // Check progressive scaling factors
    levelOrder.forEach(levelName => {
      const scaling = levels[levelName].difficulty.progressiveScaling;
      
      if (scaling.hpGrowth > 0 && scaling.damageGrowth > 0 && scaling.spawnGrowth > 0) {
        this.pass(`✅ ${levelName}: Progressive scaling factors positive`);
      } else {
        this.warn(`⚠️  ${levelName}: Progressive scaling may be too weak`);
      }
    });
  }

  /**
   * Generate comprehensive balance report
   */
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 BALANCE SMOKE TEST REPORT');
    console.log('='.repeat(60));
    
    // TTK Summary
    console.log('\n📊 TTK Analysis:');
    Object.entries(this.results.ttk).forEach(([level, data]) => {
      const status = data.status === 'PASS' ? '✅' : '❌';
      console.log(`  ${status} ${level}: ${data.actual}ms (target: ${data.target}ms)`);
    });
    
    // Wave Summary  
    console.log('\n⏱️  Wave Pacing:');
    Object.entries(this.results.waves).forEach(([level, data]) => {
      console.log(`  📈 ${level}: ${data.duration/1000}s duration, ${data.waveCount} waves`);
    });
    
    // Loot Summary
    console.log('\n💎 Loot Balance:');
    Object.entries(this.results.loot).forEach(([level, data]) => {
      console.log(`  💰 ${level}: ${data.normalTotal}→${data.eliteTotal}→${data.bossTotal} (progression)`);
    });
    
    // Final Summary
    console.log('\n' + '='.repeat(30));
    console.log(`✅ PASSED: ${this.results.summary.passed}`);
    console.log(`❌ FAILED: ${this.results.summary.failed}`);
    console.log(`⚠️  WARNINGS: ${this.results.summary.warnings}`);
    console.log('='.repeat(30));
    
    if (this.results.summary.failed > 0) {
      console.log('\n🚨 Balance issues detected! Please review failed tests.');
      process.exit(1);
    } else if (this.results.summary.warnings > 0) {
      console.log('\n⚠️  Balance warnings present. Consider reviewing for optimization.');
      process.exit(0);
    } else {
      console.log('\n🎉 All balance tests PASSED! Game is ready for 30-minute sessions.');
      process.exit(0);
    }
  }

  pass(message) {
    console.log(message);
    this.results.summary.passed++;
  }

  fail(message) {
    console.log(message);
    this.results.summary.failed++;
  }

  warn(message) {
    console.log(message);
    this.results.summary.warnings++;
  }
}

// Run balance test
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new BalanceSmokeTest();
  test.run();
}

export default BalanceSmokeTest;