/**
 * Unit testy pro ModifierEngine
 * 
 * Testuje jednotnou aplikaci modifikátorů s priority systémem
 */

import { ModifierEngine } from '../core/utils/ModifierEngine.js';

// Mock base stats pro testy
const mockBaseStats = {
  damage: 10,
  speed: 4,
  hp: 100,
  projectile: {
    count: 1,
    damage: 15,
    speed: 150
  }
};

describe('ModifierEngine', () => {
  beforeEach(() => {
    // Clear any cached results
    ModifierEngine._resultPool.length = 0;
  });

  describe('Basic modifier application', () => {
    test('should apply ADD modifier correctly', () => {
      const modifiers = [
        {
          path: 'damage',
          type: 'add',
          value: 5,
          source: 'test'
        }
      ];

      const result = ModifierEngine.apply(mockBaseStats, modifiers);
      expect(result.damage).toBe(15); // 10 + 5
    });

    test('should apply MUL modifier correctly', () => {
      const modifiers = [
        {
          path: 'speed',
          type: 'mul',
          value: 0.5, // +50%
          source: 'test'
        }
      ];

      const result = ModifierEngine.apply(mockBaseStats, modifiers);
      expect(result.speed).toBe(6); // 4 * (1 + 0.5)
    });

    test('should apply SET modifier correctly', () => {
      const modifiers = [
        {
          path: 'hp',
          type: 'set',
          value: 200,
          source: 'test'
        }
      ];

      const result = ModifierEngine.apply(mockBaseStats, modifiers);
      expect(result.hp).toBe(200);
    });

    test('should apply ENABLE modifier correctly', () => {
      const modifiers = [
        {
          path: 'hasShield',
          type: 'enable',
          source: 'test'
        }
      ];

      const result = ModifierEngine.apply(mockBaseStats, modifiers);
      expect(result.hasShield).toBe(true);
    });
  });

  describe('Nested path handling', () => {
    test('should apply modifiers to nested paths', () => {
      const modifiers = [
        {
          path: 'projectile.damage',
          type: 'add',
          value: 10,
          source: 'test'
        }
      ];

      const result = ModifierEngine.apply(mockBaseStats, modifiers);
      expect(result.projectile.damage).toBe(25); // 15 + 10
    });

    test('should create nested paths if they dont exist', () => {
      const modifiers = [
        {
          path: 'abilities.shield.active',
          type: 'enable',
          source: 'test'
        }
      ];

      const result = ModifierEngine.apply(mockBaseStats, modifiers);
      expect(result.abilities.shield.active).toBe(true);
    });
  });

  describe('Priority system', () => {
    test('should apply modifiers in correct priority order', () => {
      const modifiers = [
        {
          path: 'damage',
          type: 'mul',
          value: 1.0, // +100% (should be applied last)
          source: 'mul_test'
        },
        {
          path: 'damage',
          type: 'add',
          value: 10, // Should be applied before mul
          source: 'add_test'
        },
        {
          path: 'damage',
          type: 'set',
          value: 15, // Should be applied first
          source: 'set_test'
        }
      ];

      const result = ModifierEngine.apply(mockBaseStats, modifiers);
      
      // Order: SET (15) -> ADD (+10 = 25) -> MUL (*2 = 50)
      expect(result.damage).toBe(50);
    });

    test('should sort by source for same priority', () => {
      const modifiers = [
        {
          path: 'damage',
          type: 'add',
          value: 5,
          source: 'z_source' // Later alphabetically
        },
        {
          path: 'damage',
          type: 'add',
          value: 3,
          source: 'a_source' // Earlier alphabetically
        }
      ];

      const result = ModifierEngine.apply(mockBaseStats, modifiers);
      expect(result.damage).toBe(18); // 10 + 3 + 5 (deterministic order)
    });
  });

  describe('Clamping and limits', () => {
    test('should apply caps from modifiers', () => {
      const modifiers = [
        {
          path: 'damage',
          type: 'add',
          value: 100,
          cap: 50, // Cap at 50
          source: 'test'
        }
      ];

      const result = ModifierEngine.apply(mockBaseStats, modifiers);
      expect(result.damage).toBe(50); // Would be 110, but capped at 50
    });

    test('should apply min values from modifiers', () => {
      const modifiers = [
        {
          path: 'speed',
          type: 'set',
          value: -5,
          min: 1, // Minimum 1
          source: 'test'
        }
      ];

      const result = ModifierEngine.apply(mockBaseStats, modifiers);
      expect(result.speed).toBe(1); // Would be -5, but min is 1
    });

    test('should apply global clamps when enabled', () => {
      const stats = { hp: 50 };
      const modifiers = [
        {
          path: 'hp',
          type: 'set',
          value: -10,
          source: 'test'
        }
      ];

      const result = ModifierEngine.apply(stats, modifiers, { clamp: true });
      expect(result.hp).toBe(0); // Global clamp prevents negative HP
    });
  });

  describe('Level-based application', () => {
    test('should expand modifiers based on levels', () => {
      const blueprintModifiers = [
        {
          path: 'damage',
          type: 'add',
          perLevel: 5, // +5 per level
          source: 'damage_boost'
        },
        {
          path: 'speed',
          type: 'mul',
          perLevel: 0.1, // +10% per level
          source: 'speed_boots'
        }
      ];

      const levels = {
        'damage_boost': 3,
        'speed_boots': 2
      };

      const result = ModifierEngine.applyWithLevels(mockBaseStats, blueprintModifiers, levels);
      
      expect(result.damage).toBe(25); // 10 + (5 * 3)
      expect(result.speed).toBe(4.8); // 4 * (1 + 0.1 * 2)
    });

    test('should ignore zero-level modifiers', () => {
      const blueprintModifiers = [
        {
          path: 'damage',
          type: 'add',
          perLevel: 10,
          source: 'inactive_powerup'
        }
      ];

      const levels = {
        'inactive_powerup': 0
      };

      const result = ModifierEngine.applyWithLevels(mockBaseStats, blueprintModifiers, levels);
      expect(result.damage).toBe(10); // Unchanged
    });
  });

  describe('Single stat calculation', () => {
    test('should calculate single stat value', () => {
      const modifiers = [
        {
          path: 'damage',
          type: 'add',
          value: 5,
          source: 'test1'
        },
        {
          path: 'damage',
          type: 'mul',
          value: 0.5,
          source: 'test2'
        },
        {
          path: 'speed', // Different path - should be ignored
          type: 'add',
          value: 100,
          source: 'test3'
        }
      ];

      const finalDamage = ModifierEngine.calculate(mockBaseStats, 'damage', modifiers);
      expect(finalDamage).toBe(22.5); // (10 + 5) * 1.5
    });
  });

  describe('Reporting', () => {
    test('should generate modifier report', () => {
      const modifiers = [
        { path: 'damage', type: 'add', value: 5, source: 'powerup1' },
        { path: 'damage', type: 'mul', value: 0.5, source: 'powerup1' },
        { path: 'speed', type: 'add', value: 2, source: 'powerup2' }
      ];

      const report = ModifierEngine.generateReport(modifiers);

      expect(report.totalModifiers).toBe(3);
      expect(report.byType.add).toBe(2);
      expect(report.byType.mul).toBe(1);
      expect(report.byPath.damage).toHaveLength(2);
      expect(report.bySource.powerup1).toHaveLength(2);
    });
  });

  describe('Validation', () => {
    test('should filter out invalid modifiers', () => {
      const modifiers = [
        {
          path: 'damage',
          type: 'add',
          value: 5,
          source: 'valid'
        },
        {
          // Missing path
          type: 'add',
          value: 3,
          source: 'invalid1'
        },
        {
          path: 'speed',
          // Missing type
          value: 2,
          source: 'invalid2'
        },
        {
          path: 'hp',
          type: 'add',
          // Missing value
          source: 'invalid3'
        }
      ];

      const validModifiers = ModifierEngine._validateModifiers(modifiers);
      expect(validModifiers).toHaveLength(1);
      expect(validModifiers[0].path).toBe('damage');
    });
  });

  describe('Composition', () => {
    test('should compose multiple modifiers for same path', () => {
      const modifiers = [
        { path: 'damage', type: 'add', value: 5, source: 'test1' },
        { path: 'damage', type: 'add', value: 3, source: 'test2' },
        { path: 'damage', type: 'mul', value: 0.5, source: 'test3' }
      ];

      const composite = ModifierEngine.compose(modifiers);

      expect(composite.path).toBe('damage');
      expect(composite.source).toBe('composite');
      // Should combine: add total = 8, mul total = 1.5
    });

    test('should handle SET modifiers in composition', () => {
      const modifiers = [
        { path: 'damage', type: 'set', value: 20, source: 'test1' },
        { path: 'damage', type: 'add', value: 5, source: 'test2' },
        { path: 'damage', type: 'mul', value: 0.5, source: 'test3' }
      ];

      const composite = ModifierEngine.compose(modifiers);

      expect(composite.type).toBe('set');
      // Should be (20 + 5) * 1.5 = 37.5
      expect(composite.value).toBe(37.5);
    });
  });

  describe('Performance', () => {
    test('should use object pooling for results', () => {
      const modifiers = [{ path: 'damage', type: 'add', value: 5, source: 'test' }];
      
      // First application
      const result1 = ModifierEngine.apply(mockBaseStats, modifiers);
      
      // Return to pool manually (normally handled internally)
      ModifierEngine._returnToPool(result1);
      
      // Second application should reuse object
      const result2 = ModifierEngine.apply(mockBaseStats, modifiers);
      
      expect(result2.damage).toBe(15);
      expect(ModifierEngine._resultPool.length).toBe(0); // Object taken from pool
    });

    test('should limit pool size', () => {
      const originalMaxSize = ModifierEngine._maxPoolSize;
      ModifierEngine._maxPoolSize = 2;

      // Add more objects than max size
      for (let i = 0; i < 5; i++) {
        ModifierEngine._returnToPool({});
      }

      expect(ModifierEngine._resultPool.length).toBe(2);
      
      ModifierEngine._maxPoolSize = originalMaxSize;
    });
  });
});

// Helper pro spouštění testů v browseru (pokud není Jest dostupný)
if (typeof describe === 'undefined') {
  window.runModifierEngineTests = () => {
    console.log('🧪 Running ModifierEngine tests...');

    // Test 1: Basic ADD modifier
    try {
      const stats = { damage: 10 };
      const modifiers = [{ path: 'damage', type: 'add', value: 5, source: 'test' }];
      const result = ModifierEngine.apply(stats, modifiers);
      console.assert(result.damage === 15, 'ADD modifier failed');
      console.log('✅ ADD modifier test passed');
    } catch (e) {
      console.error('❌ ADD modifier test failed:', e);
    }

    // Test 2: Priority system
    try {
      const stats = { damage: 10 };
      const modifiers = [
        { path: 'damage', type: 'mul', value: 1.0, source: 'mul' }, // Should be last
        { path: 'damage', type: 'set', value: 20, source: 'set' },  // Should be first
        { path: 'damage', type: 'add', value: 5, source: 'add' }    // Should be middle
      ];
      const result = ModifierEngine.apply(stats, modifiers);
      // SET(20) -> ADD(+5=25) -> MUL(*2=50)
      console.assert(result.damage === 50, `Priority test failed: got ${result.damage}, expected 50`);
      console.log('✅ Priority system test passed');
    } catch (e) {
      console.error('❌ Priority system test failed:', e);
    }

    // Test 3: Level-based application
    try {
      const stats = { damage: 10 };
      const blueprints = [{ path: 'damage', type: 'add', perLevel: 5, source: 'powerup' }];
      const levels = { powerup: 3 };
      const result = ModifierEngine.applyWithLevels(stats, blueprints, levels);
      console.assert(result.damage === 25, `Level test failed: got ${result.damage}, expected 25`);
      console.log('✅ Level-based application test passed');
    } catch (e) {
      console.error('❌ Level-based application test failed:', e);
    }

    // Test 4: Nested paths
    try {
      const stats = { projectile: { damage: 15 } };
      const modifiers = [{ path: 'projectile.damage', type: 'add', value: 10, source: 'test' }];
      const result = ModifierEngine.apply(stats, modifiers);
      console.assert(result.projectile.damage === 25, 'Nested path failed');
      console.log('✅ Nested path test passed');
    } catch (e) {
      console.error('❌ Nested path test failed:', e);
    }

    console.log('🎉 ModifierEngine tests completed!');
  };
}

export default ModifierEngine;