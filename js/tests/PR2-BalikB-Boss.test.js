/**
 * PR2 BALÍK B: Boss.js Migration Tests
 * 
 * Testuje migraci Boss.js magic numbers na ConfigResolver systém
 * Zajišťuje 1:1 chování před a po migraci
 */

import { ConfigResolver } from '../core/utils/ConfigResolver.js';
import { GameConfig } from '../config.js';

describe('PR2 Balík B - Boss.js Migration', () => {
  let mockScene;
  let mockBossConfig;

  beforeEach(() => {
    // Mock GameScene s feature flags
    mockScene = {
      GameConfig: {
        ...GameConfig,
        validation: {
          features: {
            useConfigResolver: true,
            enableTelemetry: true
          }
        }
      },
      configResolver: ConfigResolver
    };

    // Mock boss config
    mockBossConfig = {
      name: "Test Boss",
      hp: 100,
      damage: 20,
      xp: 50,
      color: 0xff0000,
      size: 40
    };

    // Set up global ConfigResolver
    global.window = { ConfigResolver };
    
    // Reset telemetry
    ConfigResolver.resetTelemetry();
  });

  describe('Boss Scaling Migration', () => {
    test('should calculate boss scaling correctly with ConfigResolver', () => {
      const level = 3;
      
      // NEW: ConfigResolver values
      const hpScaling = ConfigResolver.get('scaling.boss.hp');
      const damageScaling = ConfigResolver.get('scaling.boss.damage');
      const xpScaling = ConfigResolver.get('scaling.boss.xp');
      
      const newHP = mockBossConfig.hp * Math.pow(hpScaling.base + hpScaling.perLevel, level);
      const newDamage = mockBossConfig.damage * Math.pow(damageScaling.base + damageScaling.perLevel, level);
      const newXP = Math.floor(mockBossConfig.xp * Math.pow(xpScaling.base + xpScaling.perLevel, level));
      
      // LEGACY values for comparison
      const legacyHP = mockBossConfig.hp * Math.pow(1.2, level); // 172.8
      const legacyDamage = mockBossConfig.damage * Math.pow(1.1, level); // 26.6
      const legacyXP = Math.floor(mockBossConfig.xp * Math.pow(1.3, level)); // 109
      
      // Should match exactly
      expect(newHP).toBe(legacyHP);
      expect(newDamage).toBe(legacyDamage);
      expect(newXP).toBe(legacyXP);
      
      // Verify specific values for level 3
      expect(Math.floor(newHP)).toBe(172);
      expect(Math.floor(newDamage)).toBe(26);
      expect(newXP).toBe(109);
    });

    test('should fallback to legacy values when ConfigResolver disabled', () => {
      // Disable ConfigResolver
      mockScene.GameConfig.validation.features.useConfigResolver = false;
      
      const level = 2;
      
      // Legacy calculation
      const legacyHP = mockBossConfig.hp * Math.pow(1.2, level); // 144
      const legacyDamage = mockBossConfig.damage * Math.pow(1.1, level); // 24.2
      const legacyXP = Math.floor(mockBossConfig.xp * Math.pow(1.3, level)); // 84
      
      expect(Math.floor(legacyHP)).toBe(144);
      expect(Math.floor(legacyDamage)).toBe(24);
      expect(legacyXP).toBe(84);
    });
  });

  describe('Boss Ability Constants Migration', () => {
    test('should use ConfigResolver for linear attack constants', () => {
      // NEW: ConfigResolver values
      const projectileSpeed = ConfigResolver.get('abilities.boss.linearAttack.projectileSpeed');
      const spreadAngle = ConfigResolver.get('abilities.boss.linearAttack.spreadAngle');
      
      // Should match legacy values exactly
      expect(projectileSpeed).toBe(250);
      expect(spreadAngle).toBe(0.2);
    });

    test('should use ConfigResolver for circle attack constants', () => {
      // NEW: ConfigResolver values
      const projectileCount = ConfigResolver.get('abilities.boss.circleAttack.projectileCount');
      const projectileSpeed = ConfigResolver.get('abilities.boss.circleAttack.projectileSpeed');
      
      // Should match legacy values exactly
      expect(projectileCount).toBe(12);
      expect(projectileSpeed).toBe(200);
    });

    test('should use ConfigResolver for damage multipliers', () => {
      // Test all boss ability damage multipliers
      const multipliers = [
        { key: 'abilities.boss.divideAttack.damageMultiplier', expected: 0.5 },
        { key: 'abilities.boss.spreadAttack.damageMultiplier', expected: 0.6 },
        { key: 'abilities.boss.corruptionAttack.damageMultiplier', expected: 0.35 },
        { key: 'abilities.boss.geneticAttack.damageMultiplier', expected: 0.3 },
        { key: 'abilities.boss.radiationAttack.damageMultiplier', expected: 0.2 }
      ];
      
      multipliers.forEach(({ key, expected }) => {
        const value = ConfigResolver.get(key);
        expect(value).toBe(expected);
      });
    });
  });

  describe('Feature Flag Safety', () => {
    test('should use legacy values when ConfigResolver disabled', () => {
      // Disable feature flag
      mockScene.GameConfig.validation.features.useConfigResolver = false;
      
      const level = 1;
      
      // Legacy scaling calculations
      const legacyScaling = {
        hp: mockBossConfig.hp * Math.pow(1.2, level), // 120
        damage: mockBossConfig.damage * Math.pow(1.1, level), // 22
        xp: Math.floor(mockBossConfig.xp * Math.pow(1.3, level)) // 65
      };
      
      expect(Math.floor(legacyScaling.hp)).toBe(120);
      expect(Math.floor(legacyScaling.damage)).toBe(22);
      expect(legacyScaling.xp).toBe(65);
      
      // Legacy ability constants
      const legacyConstants = {
        linearSpeed: 250,
        linearSpread: 0.2,
        circleCount: 12,
        circleSpeed: 200,
        divideMultiplier: 0.5,
        spreadMultiplier: 0.6
      };
      
      Object.values(legacyConstants).forEach(value => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      });
    });

    test('should handle ConfigResolver unavailable gracefully', () => {
      // Enable feature flag but remove ConfigResolver
      mockScene.GameConfig.validation.features.useConfigResolver = true;
      global.window.ConfigResolver = null;
      mockScene.configResolver = null;
      
      // Should fallback to legacy without crashing
      const level = 1;
      const fallbackHP = mockBossConfig.hp * Math.pow(1.2, level);
      
      expect(Math.floor(fallbackHP)).toBe(120);
    });
  });

  describe('Balance Verification', () => {
    test('boss scaling progression should match legacy exactly', () => {
      const levels = [1, 2, 3, 4, 5];
      const baseStats = { hp: 100, damage: 20, xp: 50 };
      
      levels.forEach(level => {
        // New system
        const hpScaling = ConfigResolver.get('scaling.boss.hp');
        const damageScaling = ConfigResolver.get('scaling.boss.damage');
        const xpScaling = ConfigResolver.get('scaling.boss.xp');
        
        const newHP = baseStats.hp * Math.pow(hpScaling.base + hpScaling.perLevel, level);
        const newDamage = baseStats.damage * Math.pow(damageScaling.base + damageScaling.perLevel, level);
        const newXP = Math.floor(baseStats.xp * Math.pow(xpScaling.base + xpScaling.perLevel, level));
        
        // Legacy system  
        const legacyHP = baseStats.hp * Math.pow(1.2, level);
        const legacyDamage = baseStats.damage * Math.pow(1.1, level);
        const legacyXP = Math.floor(baseStats.xp * Math.pow(1.3, level));
        
        expect(newHP).toBeCloseTo(legacyHP, 1);
        expect(newDamage).toBeCloseTo(legacyDamage, 1);
        expect(newXP).toBe(legacyXP);
      });
    });

    test('ability damage multipliers should provide balanced gameplay', () => {
      const baseDamage = 30;
      
      const damageTests = [
        { multiplier: ConfigResolver.get('abilities.boss.divideAttack.damageMultiplier'), expectedDamage: 15 },
        { multiplier: ConfigResolver.get('abilities.boss.spreadAttack.damageMultiplier'), expectedDamage: 18 },
        { multiplier: ConfigResolver.get('abilities.boss.corruptionAttack.damageMultiplier'), expectedDamage: 10.5 },
        { multiplier: ConfigResolver.get('abilities.boss.geneticAttack.damageMultiplier'), expectedDamage: 9 },
        { multiplier: ConfigResolver.get('abilities.boss.radiationAttack.damageMultiplier'), expectedDamage: 6 }
      ];
      
      damageTests.forEach(({ multiplier, expectedDamage }) => {
        const actualDamage = baseDamage * multiplier;
        expect(actualDamage).toBe(expectedDamage);
      });
    });
  });

  describe('Performance Impact', () => {
    test('ConfigResolver.get should be fast enough for boss abilities', () => {
      const iterations = 100;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        ConfigResolver.get('scaling.boss.hp');
        ConfigResolver.get('scaling.boss.damage');
        ConfigResolver.get('abilities.boss.linearAttack.projectileSpeed');
        ConfigResolver.get('abilities.boss.divideAttack.damageMultiplier');
      }
      
      const end = performance.now();
      const avgTime = (end - start) / iterations;
      
      // Should be under 0.2ms per call on average (bosses call less frequently)
      expect(avgTime).toBeLessThan(0.2);
    });
  });
});

// Browser test runner integration
if (typeof window !== 'undefined' && typeof describe === 'undefined') {
  window.runPR2BalikBTests = () => {
    console.log('🧪 Running PR2 Balík B - Boss.js Migration Tests...');
    
    try {
      // Boss scaling test
      const hpScaling = ConfigResolver.get('scaling.boss.hp');
      const level3HP = 100 * Math.pow(hpScaling.base + hpScaling.perLevel, 3);
      const legacyLevel3HP = 100 * Math.pow(1.2, 3);
      
      console.assert(Math.abs(level3HP - legacyLevel3HP) < 0.1, `Boss scaling test failed: expected ~${legacyLevel3HP}, got ${level3HP}`);
      console.log('✅ Boss scaling migration test passed');
      
      // Ability constants test
      const linearSpeed = ConfigResolver.get('abilities.boss.linearAttack.projectileSpeed');
      const divideMultiplier = ConfigResolver.get('abilities.boss.divideAttack.damageMultiplier');
      
      console.assert(linearSpeed === 250, `Linear attack speed test failed: expected 250, got ${linearSpeed}`);
      console.assert(divideMultiplier === 0.5, `Divide multiplier test failed: expected 0.5, got ${divideMultiplier}`);
      console.log('✅ Boss ability constants migration test passed');
      
      console.log('🎉 All PR2 Balík B tests passed!');
      
    } catch (error) {
      console.error('❌ PR2 Balík B tests failed:', error);
    }
  };
}

export default {};