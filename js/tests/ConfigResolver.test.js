/**
 * Unit testy pro ConfigResolver
 * 
 * Testuje bezpečné čtení konfiguračních hodnot s fallback systémem
 */

import { ConfigResolver } from '../core/utils/ConfigResolver.js';

// Mock GameConfig pro testy
const mockGameConfig = {
  player: {
    projectile: {
      baseDamage: 15
    }
  },
  weapons: {
    explosive: {
      damageMultiplier: 0.8
    }
  }
};

// Mock blueprint pro testy
const mockBlueprint = {
  stats: {
    damage: 25
  },
  modifiers: [
    {
      path: 'projectile.damage',
      type: 'add',
      value: 10
    }
  ]
};

describe('ConfigResolver', () => {
  beforeEach(() => {
    // Reset telemetrie před každým testem
    ConfigResolver.resetTelemetry();
    
    // Mock GameConfig
    Object.defineProperty(ConfigResolver, '_mockGameConfig', {
      value: mockGameConfig,
      writable: true
    });
  });

  describe('Basic functionality', () => {
    test('should resolve value from GameConfig', () => {
      // Temporarily override GameConfig import
      const originalResolvePath = ConfigResolver._resolvePath;
      ConfigResolver._resolvePath = (obj, path) => {
        if (obj === mockGameConfig) {
          return originalResolvePath.call(ConfigResolver, obj, path);
        }
        return originalResolvePath.call(ConfigResolver, obj, path);
      };

      const value = ConfigResolver.get('player.projectile.baseDamage', {
        source: 'config',
        warnIfMissing: false
      });

      expect(value).toBe(15);
    });

    test('should resolve value from blueprint when provided', () => {
      const value = ConfigResolver.get('stats.damage', {
        blueprint: mockBlueprint,
        source: 'blueprint',
        warnIfMissing: false
      });

      expect(value).toBe(25);
    });

    test('should use fallback when value not found', () => {
      const value = ConfigResolver.get('player.projectile.baseDamage', {
        source: 'blueprint', // Force to skip config
        warnIfMissing: false
      });

      expect(value).toBe(10); // From fallback registry
    });

    test('should use explicit defaultValue when no other source available', () => {
      const value = ConfigResolver.get('nonexistent.path', {
        defaultValue: 42,
        warnIfMissing: false
      });

      expect(value).toBe(42);
    });

    test('should return undefined when no value found anywhere', () => {
      const value = ConfigResolver.get('totally.nonexistent.path', {
        warnIfMissing: false
      });

      expect(value).toBeUndefined();
    });
  });

  describe('Source priority', () => {
    test('should prefer blueprint over config in auto mode', () => {
      // Blueprint má hodnotu 25, config má 15, fallback má 10
      const value = ConfigResolver.get('player.projectile.baseDamage', {
        blueprint: { player: { projectile: { baseDamage: 25 } } },
        source: 'auto',
        warnIfMissing: false
      });

      expect(value).toBe(25); // Blueprint wins
    });

    test('should respect source=config constraint', () => {
      const value = ConfigResolver.get('weapons.explosive.damageMultiplier', {
        blueprint: { weapons: { explosive: { damageMultiplier: 0.5 } } },
        source: 'config',
        warnIfMissing: false
      });

      // Should get from config (0.8), not blueprint (0.5)
      expect(value).toBe(0.8);
    });

    test('should respect source=blueprint constraint', () => {
      const value = ConfigResolver.get('weapons.explosive.damageMultiplier', {
        blueprint: { weapons: { explosive: { damageMultiplier: 0.5 } } },
        source: 'blueprint',
        warnIfMissing: false
      });

      expect(value).toBe(0.5); // Blueprint only
    });
  });

  describe('Multiple value resolution', () => {
    test('getMany should resolve multiple paths', () => {
      const result = ConfigResolver.getMany([
        'player.projectile.baseDamage',
        'weapons.explosive.damageMultiplier'
      ], { warnIfMissing: false });

      expect(result).toEqual({
        'player.projectile.baseDamage': 10,    // From fallback
        'weapons.explosive.damageMultiplier': 0.8  // From fallback
      });
    });
  });

  describe('Path resolution edge cases', () => {
    test('should handle nested paths correctly', () => {
      const obj = {
        level1: {
          level2: {
            level3: 'found'
          }
        }
      };

      const value = ConfigResolver._resolvePath(obj, 'level1.level2.level3');
      expect(value).toBe('found');
    });

    test('should return undefined for invalid paths', () => {
      const obj = { a: { b: 1 } };

      expect(ConfigResolver._resolvePath(obj, 'a.c.d')).toBeUndefined();
      expect(ConfigResolver._resolvePath(obj, 'x.y.z')).toBeUndefined();
    });

    test('should handle null/undefined objects gracefully', () => {
      expect(ConfigResolver._resolvePath(null, 'any.path')).toBeUndefined();
      expect(ConfigResolver._resolvePath(undefined, 'any.path')).toBeUndefined();
    });

    test('should handle empty paths', () => {
      const obj = { value: 42 };
      expect(ConfigResolver._resolvePath(obj, '')).toBeUndefined();
      expect(ConfigResolver._resolvePath(obj, null)).toBeUndefined();
    });
  });

  describe('Existence checking', () => {
    test('has() should check value existence', () => {
      expect(ConfigResolver.has('player.projectile.baseDamage')).toBe(true);
      expect(ConfigResolver.has('nonexistent.path')).toBe(false);
    });

    test('has() should respect source parameter', () => {
      expect(ConfigResolver.has('player.projectile.baseDamage', 'any')).toBe(true);
      expect(ConfigResolver.has('player.projectile.baseDamage', 'blueprint')).toBe(true); // In fallbacks
    });
  });

  describe('Telemetry', () => {
    test('should record missing paths when warnIfMissing=true', () => {
      // Disable console.warn for clean test output
      const originalWarn = console.warn;
      console.warn = jest.fn();

      ConfigResolver.get('missing.path.1', { warnIfMissing: true });
      ConfigResolver.get('missing.path.2', { warnIfMissing: true });
      ConfigResolver.get('missing.path.1', { warnIfMissing: true }); // Duplicate

      const report = ConfigResolver.getTelemetryReport();

      expect(report.totalMissingPaths).toBe(2);
      expect(report.topMissing).toContainEqual({ path: 'missing.path.1', count: 2 });
      expect(report.topMissing).toContainEqual({ path: 'missing.path.2', count: 1 });

      // Restore console.warn
      console.warn = originalWarn;
    });

    test('should not record when warnIfMissing=false', () => {
      ConfigResolver.get('another.missing.path', { warnIfMissing: false });

      const report = ConfigResolver.getTelemetryReport();
      expect(report.totalMissingPaths).toBe(0);
    });
  });

  describe('Fallback registration', () => {
    test('should allow registering new fallbacks', () => {
      ConfigResolver.registerFallback('test.custom.value', 123);
      
      const value = ConfigResolver.get('test.custom.value', {
        warnIfMissing: false
      });

      expect(value).toBe(123);
    });
  });

  describe('Validation', () => {
    test('should validate required paths', () => {
      const requiredPaths = [
        'player.projectile.baseDamage',
        'weapons.explosive.damageMultiplier',
        'missing.path'
      ];

      const validation = ConfigResolver.validate(requiredPaths);

      expect(validation.valid).toBe(false);
      expect(validation.missing).toContain('missing.path');
      expect(validation.found).toContain('player.projectile.baseDamage');
      expect(validation.coverage).toBe(66.67); // 2/3 paths found
    });
  });
});

// Helper pro spouštění testů v browseru (pokud není Jest dostupný)
if (typeof describe === 'undefined') {
  // Minimální test runner pro browser
  window.runConfigResolverTests = () => {
    console.log('🧪 Running ConfigResolver tests...');
    
    // Test 1: Basic fallback resolution
    try {
      const value = ConfigResolver.get('player.projectile.baseDamage', {
        warnIfMissing: false
      });
      console.assert(value === 10, 'Fallback resolution failed');
      console.log('✅ Fallback resolution test passed');
    } catch (e) {
      console.error('❌ Fallback resolution test failed:', e);
    }

    // Test 2: Blueprint preference
    try {
      const value = ConfigResolver.get('stats.damage', {
        blueprint: { stats: { damage: 42 } },
        warnIfMissing: false
      });
      console.assert(value === 42, 'Blueprint preference failed');
      console.log('✅ Blueprint preference test passed');
    } catch (e) {
      console.error('❌ Blueprint preference test failed:', e);
    }

    // Test 3: Telemetry
    try {
      ConfigResolver.resetTelemetry();
      ConfigResolver.get('missing.test.path', { warnIfMissing: true });
      const report = ConfigResolver.getTelemetryReport();
      console.assert(report.totalMissingPaths === 1, 'Telemetry failed');
      console.log('✅ Telemetry test passed');
    } catch (e) {
      console.error('❌ Telemetry test failed:', e);
    }

    console.log('🎉 ConfigResolver tests completed!');
  };
}

export default ConfigResolver;