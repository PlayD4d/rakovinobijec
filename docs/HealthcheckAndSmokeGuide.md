# Healthcheck & Smoke Testing Guide

**Version**: 1.0.0  
**Framework**: Unified Blueprint System v5 + ConfigResolver  
**Purpose**: Comprehensive verification that new systems are properly integrated and functioning

## Overview

This guide covers the verification tools that ensure **Rakovinobijec** is using modern systems (VFX/SFX, LootTables, SpawnTables) instead of legacy code paths. These tools provide both static validation and runtime verification.

## 📊 Static Verification (Without Running Game)

### 1. Enhanced Data Audit

**Purpose**: Validates that all references in data exist and are properly connected.

```bash
# Basic audit - checks schemas, naming, references
npm run audit:data

# Strict audit - includes i18n validation 
npm run audit:data:strict

# Generate markdown reports
npm run audit:data -- --report-md
```

#### What It Validates

- ✅ **JSON Schema Compliance**: All blueprints match schema definitions
- ✅ **Naming Conventions**: File and ID naming follows standards
- ✅ **Entity References**: All blueprint references exist
- ✅ **Registry References**: VFX/SFX references match registries
- ✅ **Spawn Table Refs**: Enemy/boss IDs in spawn tables exist
- ✅ **Loot Table Refs**: Item IDs in loot tables exist
- ✅ **Asset Coverage**: VFX/SFX assets are preloaded
- ✅ **I18n Completeness**: All translations present, no TODOs

#### Exit Codes
- `0` = Perfect (no errors, no warnings)
- `1` = Warnings only (non-critical issues)
- `2` = Errors (must fix before deployment)

#### Example Output
```
📋 Validating registry references...
✅ Loaded VFXRegistry: 45 entries
✅ Loaded SFXRegistry: 38 entries  
✅ VFX asset coverage: 100%
✅ SFX asset coverage: 100%

📊 ENHANCED DATA AUDIT SUMMARY
Files validated: 31
❌ Errors: 0
⚠️  Warnings: 0
📋 Registry entries: 31
🌐 Missing translations: 0
```

### 2. Asset Coverage Check

**Purpose**: Ensures all VFX/SFX references have corresponding preloaded assets.

Automatically runs as part of `npm run audit:data` but validates:
- VFXRegistry texture references → PreloadScene image loads
- SFXRegistry sound references → PreloadScene audio loads
- Missing assets reported as ERRORS

## 🎮 Runtime Verification (During Gameplay)

### 1. Framework Debug API

**Purpose**: Real-time monitoring of system usage and health.

#### Global Debug Console

When game is running, open browser console and use:

```javascript
// Overall system health
__framework.healthcheck()

// Current scenario information  
__framework.scenario.info()

// Direct system access
__framework.systems.vfx    // VFXSystem instance
__framework.systems.sfx    // SFXSystem instance
__framework.systems.loot   // LootManager instance
__framework.systems.spawn  // SpawnDirector instance
```

#### Healthcheck Response Example

```json
{
  "timestamp": "2025-08-12T06:15:30.123Z",
  "uptime": 45,
  
  "systems": {
    "vfx": { "ready": true, "initialized": true, "activeEmitters": 3 },
    "sfx": { "ready": true, "initialized": true, "activeVoices": 2 },
    "loot": { "ready": true, "tablesLoaded": 8, "pitySystemActive": true },
    "spawnDirector": { "ready": true, "currentLevel": "level1", "tablesLoaded": 3 }
  },
  
  "usage": {
    "vfxCalls": 23,
    "sfxCalls": 31,
    "spawnedFromSpawnTables": 45,
    "spawnedFromLegacy": 0,
    "lootDropsFromTables": 12,
    "legacyLootDrops": 0
  },
  
  "validation": {
    "modernSystemsActive": true,
    "legacySystemsInactive": true,
    "allSystemsReady": true,
    "recommendations": []
  }
}
```

#### Key Metrics to Monitor

| Metric | Good Value | Bad Value | Action |
|--------|------------|-----------|---------|
| `spawnedFromLegacy` | 0 | >0 | Check SpawnDirector integration |
| `vfxCalls` | >0 after 30s | 0 | Check VFXSystem initialization |
| `sfxCalls` | >0 after 30s | 0 | Check SFXSystem initialization |
| `lootDropsFromTables` | >0 | 0 (with legacy >0) | Check LootManager integration |

### 2. Scenario Information

```javascript
__framework.scenario.info()
```

Returns current level state:

```json
{
  "scenario": {
    "id": "level1",
    "stage": 1,
    "currentWave": 3,
    "timeElapsed": 67,
    "dataSource": "spawn_table"  // ✅ Good (not "legacy")
  },
  
  "progress": {
    "enemiesKilled": 23,
    "eliteSpawns": 1,
    "uniqueSpawns": 0,
    "bossesDefeated": 0
  },
  
  "waves": {
    "totalWaves": 14,
    "completedWaves": 3,
    "activeEnemies": 8,
    "spawnRate": 1.2
  }
}
```

## 🔥 Automated Smoke Testing

### 1. Smoke Run Script

**Purpose**: Automated 60-second simulation to verify systems integration.

```bash
# Run smoke test
npm run smoke:test

# Or directly
node scripts/smoke-run.mjs
```

#### What It Tests

- ✅ **Environment Validation**: Required files exist, data audit passes
- ✅ **Spawn Table Usage**: Analyzes spawn configurations and estimates usage
- ✅ **VFX/SFX Integration**: Counts blueprint references and simulates calls
- ✅ **Loot Table Usage**: Analyzes loot configurations
- ✅ **TTK Validation**: Calculates Time-to-Kill against targets
- ✅ **System Thresholds**: Validates against CI/CD requirements

#### Thresholds (Must Pass for CI)

```javascript
thresholds: {
  spawnsFromLegacy: 0,         // Must be exactly 0
  spawnsFromSpawnTables: 10,   // At least 10 spawns detected
  vfxCalls: 5,                 // At least 5 VFX calls
  sfxCalls: 5,                 // At least 5 SFX calls  
  dropsFromLootTables: 3,      // At least 3 loot drops
  minEnemiesKilled: 8          // At least 8 enemies killed
}
```

#### Exit Codes
- `0` = All validations passed
- `1` = Failed critical validations
- `2` = Error during testing

#### Generated Reports

**JSON Report**: `build/smoke_report.json`
```json
{
  "status": "PASS",
  "validation": {
    "legacySpawnsInactive": true,
    "sufficientSpawnTableUsage": true,
    "vfxSystemActive": true,
    "sfxSystemActive": true,
    "lootTablesActive": true,
    "allSystemsGo": true
  },
  "metrics": {
    "spawnsFromSpawnTables": 24,
    "spawnsFromLegacy": 0,
    "vfxCalls": 15,
    "sfxCalls": 18
  }
}
```

**Markdown Report**: `build/smoke_report.md`

| Check | Status | Threshold | Actual |
|-------|--------|-----------|--------|
| Legacy Spawns Inactive | ✅ | ≤ 0 | 0 |
| Spawn Tables Used | ✅ | ≥ 10 | 24 |
| VFX System Active | ✅ | ≥ 5 | 15 |
| SFX System Active | ✅ | ≥ 5 | 18 |
| Loot Tables Active | ✅ | ≥ 3 | 7 |

## 🚀 CI/CD Integration

### Package.json Scripts

```json
{
  "scripts": {
    "audit:data": "node scripts/enhanced-data-audit.mjs",
    "audit:data:strict": "node scripts/enhanced-data-audit.mjs --strict-i18n",
    "audit:report": "node scripts/enhanced-data-audit.mjs --report-md",
    "smoke:test": "node scripts/smoke-run.mjs",
    "verify:all": "npm run audit:data:strict && npm run smoke:test"
  }
}
```

### GitHub Actions Workflow

```yaml
name: Data Validation & Smoke Test

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run data audit (strict)
        run: npm run audit:data:strict
      
      - name: Run smoke test
        run: npm run smoke:test
      
      - name: Upload reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: validation-reports
          path: build/
```

## 🔧 Troubleshooting

### Common Issues

#### ❌ "VFX reference 'vfx.hit.spark' not found in VFXRegistry"
- **Cause**: Blueprint references VFX not defined in VFXRegistry.js
- **Fix**: Add VFX definition to VFXRegistry or fix blueprint reference

#### ❌ "Legacy spawn system detected"
- **Cause**: Game still using old spawn system instead of SpawnDirector
- **Fix**: Ensure GameScene initializes SpawnDirector and uses spawn tables

#### ❌ "Missing assets: ['player_hit', 'enemy_death']"
- **Cause**: VFX/SFX registry references assets not preloaded
- **Fix**: Add asset loading to PreloadScene.js

#### ❌ "TODO translation found for cs:enemy.viral_swarm.name"
- **Cause**: Translation still uses TODO placeholder
- **Fix**: Replace with actual translation in data/i18n/cs.json

### Debug Workflow

1. **Start with static validation**:
   ```bash
   npm run audit:data:strict
   ```

2. **If errors, fix data issues first** before runtime testing

3. **Run smoke test for integration validation**:
   ```bash
   npm run smoke:test
   ```

4. **For runtime issues, use debug API in browser console**:
   ```javascript
   __framework.healthcheck()
   ```

5. **Check specific systems**:
   ```javascript
   __framework.systems.spawn  // Is SpawnDirector loaded?
   __framework.systems.vfx    // Is VFXSystem working?
   ```

## 📋 Quality Gates

### Definition of Done (DoD)

A feature is considered properly integrated when:

✅ **Static Validation**:
- `npm run audit:data:strict` returns exit code 0
- 100% asset coverage for VFX/SFX
- 0 orphaned references
- 0 TODO translations

✅ **Runtime Validation**:
- `__framework.healthcheck()` shows all systems ready
- `spawnedFromLegacy === 0`
- `vfxCalls > 0` and `sfxCalls > 0` after 30 seconds
- `modernSystemsActive === true`

✅ **Smoke Test**:
- `npm run smoke:test` returns exit code 0
- All thresholds met
- TTK targets within acceptable range

✅ **Integration Proof**:
- Game uses SpawnDirector (not legacy spawning)
- Game uses LootTables (not hardcoded drops)
- Game plays VFX/SFX from registries
- No legacy code paths active

## 🎯 Best Practices

### For Developers

1. **Always run audit before committing**:
   ```bash
   npm run audit:data:strict
   ```

2. **Test new features with healthcheck**:
   ```javascript
   // After adding new VFX
   __framework.healthcheck().usage.vfxCalls // Should increase
   ```

3. **Use smoke test for major changes**:
   ```bash
   npm run smoke:test
   ```

4. **Check reports directory** for detailed analysis:
   - `build/data_audit_report.json`
   - `build/i18n_report.md`
   - `build/smoke_report.md`

### For CI/CD

1. **Pre-commit hooks** run basic audit
2. **PR checks** run full validation suite
3. **Deploy gates** require smoke test pass
4. **Monitor reports** in build artifacts

---

**Next Steps**: Run `npm run verify:all` to validate your current setup!

*Last Updated: 2025-08-12*  
*Framework Version: Unified Blueprint System v5*