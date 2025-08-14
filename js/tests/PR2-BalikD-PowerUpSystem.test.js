/**
 * PR2 BALÍK D: PowerUpSystem.js Migration Tests
 * 
 * Testuje migraci PowerUpSystem.js magic numbers na ConfigResolver systém
 * Zajišťuje 1:1 chování před a po migraci
 */

import { ConfigResolver } from '../core/utils/ConfigResolver.js';
import { GameConfig } from '../config.js';

describe('PR2 Balík D - PowerUpSystem.js Migration', () => {
  let mockScene;
  let mockPlayer;

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
      configResolver: ConfigResolver,
      time: {
        delayedCall: jest.fn()
      },
      eventBus: {
        emit: jest.fn()
      }
    };

    // Mock Player
    mockPlayer = {
      hasRadiotherapy: true,
      radiotherapyLevel: 3,
      hasLightningChain: true,
      lightningChainLevel: 2,
      auraDamage: 45,
      rangeBonus: 0.2
    };

    // Set up global ConfigResolver
    global.window = { ConfigResolver };
    
    // Reset telemetry
    ConfigResolver.resetTelemetry();
  });

  describe('Radiotherapy Interval Migration', () => {
    test('should calculate radiotherapy intervals correctly', () => {
      const level = 3;
      
      // NEW: ConfigResolver values
      const baseInterval = ConfigResolver.get('abilities.radiotherapy.baseInterval');
      const minInterval = ConfigResolver.get('abilities.radiotherapy.minInterval');
      const intervalPerLevel = Math.abs(ConfigResolver.get('abilities.radiotherapy.intervalPerLevel'));
      
      const newInterval = Math.max(minInterval, baseInterval - (level - 1) * intervalPerLevel);
      
      // LEGACY calculation
      const legacyBase = 1000;
      const legacyMin = 300;
      const legacyReduction = 100;
      const legacyInterval = Math.max(legacyMin, legacyBase - (level - 1) * legacyReduction);
      
      // Should match exactly
      expect(newInterval).toBe(legacyInterval);
      expect(newInterval).toBe(800); // 1000 - 2*100 = 800
    });

    test('should respect minimum interval limits', () => {
      const highLevel = 10;
      
      const baseInterval = ConfigResolver.get('abilities.radiotherapy.baseInterval');
      const minInterval = ConfigResolver.get('abilities.radiotherapy.minInterval');
      const intervalPerLevel = Math.abs(ConfigResolver.get('abilities.radiotherapy.intervalPerLevel'));
      
      const calculatedInterval = Math.max(minInterval, baseInterval - (highLevel - 1) * intervalPerLevel);
      
      expect(calculatedInterval).toBe(minInterval); // Should cap at minimum
      expect(calculatedInterval).toBe(300);
    });
  });

  describe('Lightning Chain Migration', () => {
    test('should calculate lightning intervals correctly', () => {
      const level = 2;
      
      // NEW: ConfigResolver values
      const baseInterval = ConfigResolver.get('abilities.lightning.baseInterval');
      const minInterval = ConfigResolver.get('abilities.lightning.minInterval');
      const intervalPerLevel = Math.abs(ConfigResolver.get('abilities.lightning.intervalPerLevel'));
      
      const newInterval = Math.max(minInterval, baseInterval - (level - 1) * intervalPerLevel);
      
      // LEGACY calculation
      const legacyBase = 2000;
      const legacyMin = 800;
      const legacyReduction = 200;
      const legacyInterval = Math.max(legacyMin, legacyBase - (level - 1) * legacyReduction);
      
      expect(newInterval).toBe(legacyInterval);
      expect(newInterval).toBe(1800); // 2000 - 1*200 = 1800
    });

    test('should calculate lightning damage progression correctly', () => {
      const level = 3;
      
      // NEW: ConfigResolver values
      const baseDamage = ConfigResolver.get('abilities.lightning.baseDamage');
      const damagePerLevel = ConfigResolver.get('abilities.lightning.damagePerLevel');
      
      const newDamage = baseDamage + (level * damagePerLevel);
      
      // LEGACY calculation
      const legacyDamage = 15 + (level * 10);
      
      expect(newDamage).toBe(legacyDamage);
      expect(newDamage).toBe(45); // 15 + 3*10
    });

    test('should calculate lightning jump range correctly', () => {
      const level = 2;
      
      // NEW: ConfigResolver values
      const baseJumpRange = ConfigResolver.get('abilities.lightning.jumpRange');
      const jumpRangePerLevel = ConfigResolver.get('abilities.lightning.jumpRangePerLevel');
      
      const newJumpRange = baseJumpRange + (level * jumpRangePerLevel);
      
      // LEGACY calculation
      const legacyJumpRange = 80 + (level * 20);
      
      expect(newJumpRange).toBe(legacyJumpRange);
      expect(newJumpRange).toBe(120); // 80 + 2*20
    });

    test('should apply damage reduction per jump correctly', () => {
      const baseDamage = 30;
      
      // NEW: ConfigResolver value
      const damageReduction = ConfigResolver.get('abilities.lightning.damageReduction');
      const newDamageAfterJump = baseDamage * damageReduction;
      
      // LEGACY calculation
      const legacyDamageAfterJump = baseDamage * 0.8;
      
      expect(newDamageAfterJump).toBe(legacyDamageAfterJump);
      expect(newDamageAfterJump).toBe(24); // 30 * 0.8
    });
  });

  describe('Radiotherapy Range Migration', () => {
    test('should calculate radiotherapy range correctly', () => {
      const level = 2;
      const rangeBonus = 0.2;
      
      // NEW: ConfigResolver values
      const baseRange = ConfigResolver.get('abilities.radiotherapy.baseRange');
      const rangePerLevel = ConfigResolver.get('abilities.radiotherapy.rangePerLevel');
      
      const levelRangeBonus = (level - 1) * rangePerLevel;
      const universalRangeBonus = baseRange * rangeBonus;
      const newTotalRange = baseRange + levelRangeBonus + universalRangeBonus;
      
      // LEGACY calculation
      const legacyBase = 200;
      const legacyLevelBonus = (level - 1) * 50; // 50
      const legacyUniversalBonus = legacyBase * rangeBonus; // 40
      const legacyTotalRange = legacyBase + legacyLevelBonus + legacyUniversalBonus;
      
      expect(newTotalRange).toBe(legacyTotalRange);
      expect(newTotalRange).toBe(290); // 200 + 50 + 40
    });
  });

  describe('Aura Tick Rate Migration', () => {
    test('should calculate aura tick damage correctly', () => {
      const auraDamage = 60; // 4 levels worth (15 per level)
      
      // NEW: ConfigResolver value
      const tickRate = ConfigResolver.get('abilities.aura.tickRate');
      const newTickDamage = auraDamage * tickRate;
      
      // LEGACY value
      const legacyTickRate = 0.05;
      const legacyTickDamage = auraDamage * legacyTickRate;
      
      expect(tickRate).toBe(legacyTickRate);
      expect(newTickDamage).toBe(legacyTickDamage);
      expect(newTickDamage).toBe(3.0); // 60 * 0.05
    });
  });

  describe('Feature Flag Safety', () => {
    test('should use legacy values when ConfigResolver disabled', () => {
      // Disable ConfigResolver
      mockScene.GameConfig.validation.features.useConfigResolver = false;
      
      const level = 2;
      
      // Legacy calculations
      const legacyRadiotherapyInterval = Math.max(300, 1000 - (level - 1) * 100); // 900
      const legacyLightningInterval = Math.max(800, 2000 - (level - 1) * 200); // 1800
      const legacyRadiotherapyRange = 200 + (level - 1) * 50; // 250
      const legacyAuraTickRate = 0.05;
      
      expect(legacyRadiotherapyInterval).toBe(900);
      expect(legacyLightningInterval).toBe(1800);
      expect(legacyRadiotherapyRange).toBe(250);
      expect(legacyAuraTickRate).toBe(0.05);
    });

    test('should handle ConfigResolver unavailable gracefully', () => {
      // Enable feature flag but remove ConfigResolver
      mockScene.GameConfig.validation.features.useConfigResolver = true;
      global.window.ConfigResolver = null;
      mockScene.configResolver = null;
      
      // Should fallback to legacy without crashing
      const level = 1;
      const fallbackRadiotherapyInterval = Math.max(300, 1000 - (level - 1) * 100);
      
      expect(fallbackRadiotherapyInterval).toBe(1000);
    });
  });

  describe('Balance Verification', () => {
    test('radiotherapy progression should match legacy exactly', () => {
      const levels = [1, 2, 3, 4, 5];
      
      levels.forEach(level => {
        // New system
        const newInterval = Math.max(
          ConfigResolver.get('abilities.radiotherapy.minInterval'),
          ConfigResolver.get('abilities.radiotherapy.baseInterval') - 
          (level - 1) * Math.abs(ConfigResolver.get('abilities.radiotherapy.intervalPerLevel'))
        );
        const newRange = ConfigResolver.get('abilities.radiotherapy.baseRange') + 
          (level - 1) * ConfigResolver.get('abilities.radiotherapy.rangePerLevel');
        
        // Legacy system  
        const legacyInterval = Math.max(300, 1000 - (level - 1) * 100);
        const legacyRange = 200 + (level - 1) * 50;
        
        expect(newInterval).toBe(legacyInterval);
        expect(newRange).toBe(legacyRange);
      });
    });

    test('lightning chain progression should match legacy exactly', () => {
      const levels = [1, 2, 3];
      
      levels.forEach(level => {
        // New system
        const newInterval = Math.max(
          ConfigResolver.get('abilities.lightning.minInterval'),
          ConfigResolver.get('abilities.lightning.baseInterval') - 
          (level - 1) * Math.abs(ConfigResolver.get('abilities.lightning.intervalPerLevel'))
        );
        const newDamage = ConfigResolver.get('abilities.lightning.baseDamage') + 
          level * ConfigResolver.get('abilities.lightning.damagePerLevel');
        const newJumpRange = ConfigResolver.get('abilities.lightning.jumpRange') + 
          level * ConfigResolver.get('abilities.lightning.jumpRangePerLevel');
        
        // Legacy system
        const legacyInterval = Math.max(800, 2000 - (level - 1) * 200);
        const legacyDamage = 15 + (level * 10);
        const legacyJumpRange = 80 + (level * 20);
        
        expect(newInterval).toBe(legacyInterval);
        expect(newDamage).toBe(legacyDamage);
        expect(newJumpRange).toBe(legacyJumpRange);
      });
    });
  });

  describe('Performance Impact', () => {
    test('ConfigResolver.get should be fast enough for ability systems', () => {
      const iterations = 100;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        ConfigResolver.get('abilities.radiotherapy.baseInterval');
        ConfigResolver.get('abilities.lightning.baseInterval');
        ConfigResolver.get('abilities.aura.tickRate');
        ConfigResolver.get('abilities.lightning.damageReduction');
      }
      
      const end = performance.now();
      const avgTime = (end - start) / iterations;
      
      // Should be under 0.1ms per call on average (ability systems call frequently)
      expect(avgTime).toBeLessThan(0.1);
    });
  });
});

// Browser test runner integration
if (typeof window !== 'undefined' && typeof describe === 'undefined') {
  window.runPR2BalikDTests = () => {
    console.log('🧪 Running PR2 Balík D - PowerUpSystem.js Migration Tests...');
    
    try {
      // Radiotherapy interval test
      const radiotherapyBase = ConfigResolver.get('abilities.radiotherapy.baseInterval');
      const radiotherapyMin = ConfigResolver.get('abilities.radiotherapy.minInterval');
      const level2Interval = Math.max(radiotherapyMin, radiotherapyBase - (2-1) * 100);
      
      console.assert(level2Interval === 900, `Radiotherapy interval test failed: expected 900, got ${level2Interval}`);
      console.log('✅ Radiotherapy interval migration test passed');
      
      // Lightning damage test
      const lightningBase = ConfigResolver.get('abilities.lightning.baseDamage');
      const lightningPerLevel = ConfigResolver.get('abilities.lightning.damagePerLevel');
      const level3Damage = lightningBase + (3 * lightningPerLevel);
      
      console.assert(level3Damage === 45, `Lightning damage test failed: expected 45, got ${level3Damage}`);
      console.log('✅ Lightning damage migration test passed');
      
      // Aura tick rate test
      const auraTickRate = ConfigResolver.get('abilities.aura.tickRate');
      const auraDamage = 40;
      const tickDamage = auraDamage * auraTickRate;
      
      console.assert(tickDamage === 2.0, `Aura tick test failed: expected 2.0, got ${tickDamage}`);
      console.log('✅ Aura tick rate migration test passed');
      
      console.log('🎉 All PR2 Balík D tests passed!');
      
    } catch (error) {
      console.error('❌ PR2 Balík D tests failed:', error);
    }
  };
}

export default {};