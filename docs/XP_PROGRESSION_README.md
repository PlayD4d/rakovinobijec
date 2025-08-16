# XP Progression System - PR7 Compliant

## Overview
The XP progression system is fully data-driven, allowing precise control over player leveling speed throughout a run. All configuration is done through data files without changing code.

## Configuration Locations

### 1. Global Configuration
**File:** `/data/config/main_config.json5`
**Section:** `progression.xp`

Key parameters:
- `baseRequirement`: Base XP needed for level 2
- `scalingMultiplier`: XP requirement growth per level
- `maxLevel`: Maximum player level
- `softcapStart`: When progression slows down
- `targets.xpPerMinute`: Default XP/min curve
- `enemyXp`: XP values for all enemies

### 2. Level-Specific Configuration
**Files:** `/data/blueprints/spawn/level1.json5`, `level2.json5`, `level3.json5`
**Section:** `meta.extensions.xpPlan`

Per-level overrides:
```json5
extensions: {
  xpPlan: {
    budgetTotal: 1200,              // Total XP budget
    targetXpPerMinute: [85,95,110], // XP/min targets
    pity: {                          // Minimum XP guarantee
      enabled: true,
      minXpPerMinute: 60,
      untilMinute: 4
    },
    boss: {                          // Boss configuration
      id: "boss.radiation_core",
      xp: 300,
      capLevelsGranted: 1.5          // Max levels from boss
    },
    enemyXpOverrides: {              // Level-specific XP values
      "enemy.micro_shooter": 2
    }
  }
}
```

## How It Works

### XP Priority System
When determining XP for an enemy, the system checks in order:
1. Level-specific overrides (`enemyXpOverrides`)
2. Enemy blueprint `stats.xp`
3. Global config `enemyXp`
4. Pattern matching (elite.* = 20, unique.* = 35)
5. Fallback value (3)

### Automatic Retuning
The SpawnDirector automatically adjusts spawn weights to match target XP/minute:
- Calculates expected XP/min from each wave
- Compares with target values
- Adjusts weights and intervals to match targets
- Respects pity floor for early game

### Boss XP Clamping
Bosses never grant more than `capLevelsGranted` levels:
- Calculates maximum allowed XP
- Clamps boss reward to this maximum
- Ensures bosses are impactful but not game-breaking

## Validation Tools

### DEV Console Command
```javascript
DEV.validateXP('spawnTable.level1')
```

Shows:
- Minute-by-minute XP analysis
- Target vs actual comparison
- Deviation percentages
- Boss XP clamping
- Overall tuning assessment

### Example Output
```
| Min | Target | Actual | Delta | % Diff | Status |
|-----|--------|--------|-------|--------|--------|
| 0   | 85     | 82     | -3    |  -3.5% | ✅     |
| 1   | 95     | 91     | -4    |  -4.2% | ✅     |
| 2   | 110    | 105    | -5    |  -4.5% | ✅     |
```

## Tuning Guidelines

### Target XP/Minute Curve
- **Minutes 0-4**: 85-125 XP/min (fast start)
- **Minutes 4-12**: 140-245 XP/min (steady growth)
- **Minutes 12-20**: 260-185 XP/min (slowdown)
- **Minutes 20+**: 185 XP/min (endgame plateau)

### Pity System
- Guarantees minimum XP in early game
- Default: 60 XP/min for first 4 minutes
- Prevents bad RNG from ruining progression

### Boss Rewards
- Should provide 1-1.5 levels worth of XP
- Clamped to prevent over-leveling
- Typical values: 250-600 XP

## Testing Checklist

1. **Run validation:**
   ```javascript
   DEV.validateXP('spawnTable.level1')
   DEV.validateXP('spawnTable.level2')
   DEV.validateXP('spawnTable.level3')
   ```

2. **Check deviations:**
   - ✅ Within ±10%: Good
   - ⚠️ Within ±20%: Acceptable
   - ❌ Over ±20%: Needs tuning

3. **Verify boss clamping:**
   - Check "Boss XP Validation" section
   - Ensure clamped value is reasonable

4. **Test in-game:**
   - Play through level
   - Monitor XP gain rate
   - Check level-up frequency

## Common Issues

### Too Fast Leveling
- Reduce `targetXpPerMinute` values
- Lower enemy XP in `enemyXpOverrides`
- Increase `scalingMultiplier`

### Too Slow Leveling
- Increase `targetXpPerMinute` values
- Raise enemy XP values
- Enable/adjust pity system
- Decrease `scalingMultiplier`

### Boss Gives Too Much XP
- Reduce boss XP value
- Lower `capLevelsGranted`

### Uneven Progression
- Adjust `targetXpPerMinute` curve
- Fine-tune specific minute targets
- Check wave timing overlaps