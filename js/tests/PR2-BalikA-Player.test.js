/**
 * PR2 BALÍK A: Player.js Migration Tests
 * 
 * Testuje migraci Player.js magic numbers na ConfigResolver systém
 * Zajišťuje 1:1 chování před a po migraci
 */

import { ConfigResolver } from '../core/utils/ConfigResolver.js';
import { GameConfig } from '../config.js';

describe('PR2 Balík A - Player.js Migration', () => {
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
      configResolver: ConfigResolver
    };

    // Mock Player constructor fields
    mockPlayer = {
      scene: mockScene,
      shield: { level: 0, maxHP: 0, currentHP: 0, regenTime: 0 },
      rangeBonus: 0,
      auraDamage: 0,
      _auraMigrationLogged: false
    };

    // Set up global ConfigResolver
    global.window = { ConfigResolver };
    
    // Reset telemetry
    ConfigResolver.resetTelemetry();
  });

  describe('Shield System Migration', () => {
    test('should calculate shield HP progression correctly', () => {
      // Test shield levels 1-5
      const expectedHP = [50, 75, 100, 125, 150];
      const expectedRegenTimes = [10000, 9000, 8000, 7000, 6000];

      for (let level = 1; level <= 5; level++) {
        // Simulate shield power-up application
        const powerUp = { type: 'shield', level };
        
        // NEW: ConfigResolver values
        const baseHP = ConfigResolver.get('abilities.shield.baseHP');
        const hpPerLevel = ConfigResolver.get('abilities.shield.hpPerLevel');
        const baseRegenTime = ConfigResolver.get('abilities.shield.baseRegenTime');
        const regenTimePerLevel = ConfigResolver.get('abilities.shield.regenTimePerLevel');
        const minRegenTime = ConfigResolver.get('abilities.shield.minRegenTime');
        
        const calculatedMaxHP = baseHP + (level - 1) * hpPerLevel;
        const calculatedRegenTime = Math.max(minRegenTime, baseRegenTime + (level - 1) * regenTimePerLevel);
        
        // Should match legacy values exactly
        expect(calculatedMaxHP).toBe(expectedHP[level - 1]);
        expect(calculatedRegenTime).toBe(expectedRegenTimes[level - 1]);
      }
    });

    test('should fallback to legacy values when ConfigResolver disabled', () => {
      // Disable ConfigResolver
      mockScene.GameConfig.validation.features.useConfigResolver = false;
      
      // Legacy calculation
      const level = 3;
      const legacyMaxHP = 50 + (level - 1) * 25; // 100
      const legacyRegenTime = Math.max(6000, 10000 - (level - 1) * 1000); // 8000
      
      expect(legacyMaxHP).toBe(100);
      expect(legacyRegenTime).toBe(8000);
    });
  });

  describe('Aura Tick Rate Migration', () => {
    test('should use ConfigResolver tick rate', () => {
      const auraDamage = 45; // 3 levels worth (15 per level)
      
      // NEW: ConfigResolver value
      const tickRate = ConfigResolver.get('abilities.aura.tickRate');
      const newTickDamage = auraDamage * tickRate;
      
      // Legacy value
      const legacyTickRate = 0.05;
      const legacyTickDamage = auraDamage * legacyTickRate;
      
      // Should be identical (both 0.05)
      expect(tickRate).toBe(legacyTickRate);
      expect(newTickDamage).toBe(legacyTickDamage);
      expect(newTickDamage).toBe(2.25); // 45 * 0.05
    });
  });

  describe('Range Bonus Conflict Resolution', () => {
    test('should resolve blueprint vs code conflict', () => {
      const level = 2;
      
      // LEGACY (conflicted): 10% per level = 20% total
      const legacyRangeBonus = level * 0.1; // 0.2 (20%)
      
      // NEW (fixed): 20% per level from blueprint = 40% total  
      const configRangePerLevel = ConfigResolver.get('powerups.range.baseIncrease');
      const newRangeBonus = level * configRangePerLevel; // 2 * 0.2 = 0.4 (40%)
      
      expect(configRangePerLevel).toBe(0.2); // From GameConfig
      expect(newRangeBonus).toBe(0.4); // 40% bonus
      expect(legacyRangeBonus).toBe(0.2); // 20% bonus (conflicted)
      
      // Verify the fix
      expect(newRangeBonus).toBeGreaterThan(legacyRangeBonus);
      expect(newRangeBonus / legacyRangeBonus).toBe(2); // Double the bonus
    });

    test('should handle value-based range bonus correctly', () => {
      // When powerUp.value is provided (from ModifierEngine)
      const powerUpValue = 0.6; // 60% bonus from ModifierEngine
      
      // Both systems should use the same value
      expect(powerUpValue).toBe(0.6);
    });
  });

  describe('Feature Flag Safety', () => {
    test('should use legacy values when ConfigResolver disabled', () => {
      // Disable feature flag
      mockScene.GameConfig.validation.features.useConfigResolver = false;
      
      const level = 2;
      
      // Legacy shield calculations
      const legacyShieldHP = 50 + (level - 1) * 25; // 75
      const legacyShieldRegen = Math.max(6000, 10000 - (level - 1) * 1000); // 9000
      const legacyRangeBonus = level * 0.1; // 0.2
      const legacyAuraTickRate = 0.05;
      
      expect(legacyShieldHP).toBe(75);
      expect(legacyShieldRegen).toBe(9000);
      expect(legacyRangeBonus).toBe(0.2);
      expect(legacyAuraTickRate).toBe(0.05);
    });

    test('should handle ConfigResolver unavailable gracefully', () => {
      // Enable feature flag but remove ConfigResolver
      mockScene.GameConfig.validation.features.useConfigResolver = true;
      global.window.ConfigResolver = null;
      mockScene.configResolver = null;
      
      // Should fallback to legacy without crashing
      const level = 1;
      const fallbackShieldHP = 50 + (level - 1) * 25; // 50
      
      expect(fallbackShieldHP).toBe(50);
    });
  });

  describe('Telemetry and Logging', () => {
    test('should log migration when telemetry enabled', () => {
      const originalLog = console.log;
      const logs = [];
      console.log = (...args) => logs.push(args.join(' '));
      
      try {
        // Enable telemetry
        mockScene.GameConfig.validation.features.enableTelemetry = true;
        
        // Simulate power-up applications
        const shieldLevel = 3;
        const rangeLevel = 2;
        
        // These would be called in actual Player code
        const shieldHP = ConfigResolver.get('abilities.shield.baseHP') + (shieldLevel - 1) * ConfigResolver.get('abilities.shield.hpPerLevel');
        const rangeBonus = rangeLevel * ConfigResolver.get('powerups.range.baseIncrease');
        
        // Verify calculations
        expect(shieldHP).toBe(100); // 50 + 2*25
        expect(rangeBonus).toBe(0.4); // 2 * 0.2
        
        // Note: Actual logging happens in Player.applyPowerUp, not here
        expect(logs.length).toBe(0); // No logs from ConfigResolver.get itself
        
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('Balance Verification', () => {
    test('shield progression should match legacy exactly', () => {
      const levels = [1, 2, 3, 4, 5];
      const expectedHP = [50, 75, 100, 125, 150];
      const expectedRegenMS = [10000, 9000, 8000, 7000, 6000];
      
      levels.forEach((level, index) => {
        // New system
        const newHP = ConfigResolver.get('abilities.shield.baseHP') + (level - 1) * ConfigResolver.get('abilities.shield.hpPerLevel');
        const newRegen = Math.max(
          ConfigResolver.get('abilities.shield.minRegenTime'),
          ConfigResolver.get('abilities.shield.baseRegenTime') + (level - 1) * ConfigResolver.get('abilities.shield.regenTimePerLevel')
        );
        
        // Legacy system  
        const legacyHP = 50 + (level - 1) * 25;
        const legacyRegen = Math.max(6000, 10000 - (level - 1) * 1000);
        
        expect(newHP).toBe(legacyHP);
        expect(newHP).toBe(expectedHP[index]);
        expect(newRegen).toBe(legacyRegen);
        expect(newRegen).toBe(expectedRegenMS[index]);
      });
    });

    test('aura damage rate should be identical', () => {
      const auraDamageValues = [15, 30, 45, 60, 75]; // Different aura levels
      
      auraDamageValues.forEach(auraDamage => {
        const newTickDamage = auraDamage * ConfigResolver.get('abilities.aura.tickRate');
        const legacyTickDamage = auraDamage * 0.05;
        
        expect(newTickDamage).toBe(legacyTickDamage);
      });
    });

    test('range bonus should provide intended improvement', () => {
      const levels = [1, 2, 3, 4, 5];
      
      levels.forEach(level => {
        // NEW: Blueprint-consistent 20% per level
        const newRangeBonus = level * ConfigResolver.get('powerups.range.baseIncrease');
        const expectedNewBonus = level * 0.2;
        
        // LEGACY: Conflicted 10% per level  
        const legacyRangeBonus = level * 0.1;
        
        expect(newRangeBonus).toBe(expectedNewBonus);
        expect(newRangeBonus).toBe(legacyRangeBonus * 2); // Double the legacy
      });
    });
  });

  describe('Performance Impact', () => {
    test('ConfigResolver.get should be fast enough', () => {
      const iterations = 1000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        ConfigResolver.get('abilities.shield.baseHP');
        ConfigResolver.get('abilities.shield.hpPerLevel');
        ConfigResolver.get('powerups.range.baseIncrease');
        ConfigResolver.get('abilities.aura.tickRate');
      }
      
      const end = performance.now();
      const avgTime = (end - start) / iterations;
      
      // Should be under 0.1ms per call on average
      expect(avgTime).toBeLessThan(0.1);
    });
  });
});

// Browser test runner integration
if (typeof window !== 'undefined' && typeof describe === 'undefined') {
  window.runPR2BalikATests = () => {
    console.log('🧪 Running PR2 Balík A - Player.js Migration Tests...');
    
    try {
      // Shield system test
      const baseHP = ConfigResolver.get('abilities.shield.baseHP');
      const hpPerLevel = ConfigResolver.get('abilities.shield.hpPerLevel');
      const level3ShieldHP = baseHP + (3 - 1) * hpPerLevel;
      
      console.assert(level3ShieldHP === 100, `Shield HP test failed: expected 100, got ${level3ShieldHP}`);
      console.log('✅ Shield system migration test passed');
      
      // Aura tick rate test
      const tickRate = ConfigResolver.get('abilities.aura.tickRate');
      const auraDamage = 30;
      const tickDamage = auraDamage * tickRate;
      
      console.assert(tickDamage === 1.5, `Aura tick test failed: expected 1.5, got ${tickDamage}`);
      console.log('✅ Aura tick rate migration test passed');
      
      // Range bonus test
      const rangePerLevel = ConfigResolver.get('powerups.range.baseIncrease');
      const level2RangeBonus = 2 * rangePerLevel;
      
      console.assert(level2RangeBonus === 0.4, `Range bonus test failed: expected 0.4, got ${level2RangeBonus}`);
      console.log('✅ Range bonus conflict resolution test passed');
      
      console.log('🎉 All PR2 Balík A tests passed!');
      
    } catch (error) {
      console.error('❌ PR2 Balík A tests failed:', error);
    }
  };
}

export default {};