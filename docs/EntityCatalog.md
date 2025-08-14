# Entity Catalog & Game Progression Design Document

## Game Overview

**Target Run Duration:** ~30 minutes  
**Core Loop:** Stage progression → Boss encounter → Power escalation → NG+ unlock  
**Replay Value:** NG+ system, global high scores, rare cosmetics, research points  

---

## Game Progression Structure

### Stage System
- **3 Main Stages** (10 min each)
  - Stage 1: Tutorial & Introduction (0-10 min)
  - Stage 2: Core Challenge (10-20 min)  
  - Stage 3: Endgame Escalation (20-30 min)
- **Boss Encounters:** End of each stage
- **Mini-Boss Windows:** 2-3 per stage at specific time/kill thresholds
- **Unique Enemy Spawns:** 1-3% chance throughout

### Difficulty Scaling

| Metric | Stage 1 | Stage 2 | Stage 3 | NG+ Multiplier |
|--------|---------|---------|---------|----------------|
| Enemy HP | 1.0x | 1.5x | 2.2x | +50% per cycle |
| Enemy Damage | 1.0x | 1.3x | 1.8x | +40% per cycle |
| Spawn Rate | 1.0x | 1.4x | 2.0x | +30% per cycle |
| TTK Target | 2.5s | 2.0s | 1.5s | -20% per cycle |
| Elite Frequency | 5% | 10% | 18% | +5% per cycle |

---

## Boss Catalog

### Main Stage Bosses

| ID | Name | Stage | HP | Phases | Key Mechanics | Loot Tier | Status |
|----|------|-------|-----|--------|---------------|-----------|--------|
| `boss.onkogen_prime` | Onkogen Prime | 1 | 1200 | 3 | Dash attacks, Circle bursts, Laser sweep | Epic | ✅ Implemented |
| `boss.radiation_core` | Radiation Core | 2 | 1400 | 3 | Zone control, Toxic pools, Beam attacks | Epic | ✅ Implemented |
| `boss.chemorezistence` | Chemoresistance Hydra | 3 | 1800 | 3 | Multi-head, Regeneration, Chemical storms | Legendary | 🔄 Pending |

#### NG+ Boss Modifications
- **NG+1:** +50% HP, +30% attack speed, new ability per phase
- **NG+2:** +100% HP, +50% attack speed, permanent aura effects
- **NG+3:** +200% HP, double projectiles, instant phase transitions

### Mini-Bosses

| ID | Name | Spawn Level | HP | Key Mechanics | Loot Tier | Status |
|----|------|-------------|-----|---------------|-----------|--------|
| `miniboss.metastatic_swarm` | Metastatic Swarm Leader | All | 400 | Summons swarms, Speed buff allies | Rare | 🔄 Pending |
| `miniboss.toxic_myeloid` | Toxic Myeloid Overlord | 2-3 | 500 | AoE poison, DoT trails | Rare | 🔄 Pending |
| `miniboss.virus_carrier` | Virus Carrier Alpha | 2-3 | 450 | Explosive death, Infection spread | Rare | 🔄 Pending |
| `miniboss.karcinogenni_kral` | Carcinogenic King | 3 | 600 | Triple shot, Rage mode | Epic | 🔄 Pending |
| `miniboss.metastaza` | Metastasis Prime | 2-3 | 550 | Teleport, Clone spawn | Epic | 🔄 Pending |
| `miniboss.genova_mutace` | Gene Mutation Core | 3 | 650 | Evolving abilities, Adaptation | Epic | 🔄 Pending |

### Unique Named Enemies

| ID | Name | Base Type | Spawn Chance | Key Mechanics | Special Loot | Status |
|----|------|-----------|--------------|---------------|--------------|--------|
| `unique.necrocyte_sentinel` | Necrocyte Sentinel | necrotic_cell | 2% | Necrotic aura, Summoning, Armor shield | Mutator, Research Point | ✅ Implemented |
| `unique.phage_overlord` | Phage Overlord | viral_swarm | 1.5% | Infection projectiles, Viral spread, Phase dash | Biohazard Skin, Research Point | ✅ Implemented |
| `unique.radiomorph_titan` | Radiomorph Titan | necrotic_cell | 3% | Radiation pulses, Phase shift, Death blast | Legendary Mutator, Radiation Skin | ✅ Implemented |
| `unique.mutagen_splicer` | Mutagen Splicer | viral_swarm | 2.5% | Adaptive mutations, Rapid strikes, Evolution | Mutation Skin, Evolution Mutator | ✅ Implemented |
| `unique.chromoblast` | Chromoblast | micro_shooter | 2% | Leukemic bursts, Temporal field, Time echo | Chrono Skin, Temporal Mutator | ✅ Implemented |
| `unique.cytokine_warcaller` | Cytokine Warcaller | shielding_helper | 2.5% | War buffs, Mass summoning, Battle coordination | Commander Skin, Support Mutator | ✅ Implemented |
| `unique.psionic_leukocyte` | Psionic Leukocyte | aberrant_cell | 2.5% | Mind control, Psychic blasts, Neural disruption | Psionic Skin, Psychic Mutator | ✅ Implemented |

#### Unique Enemy Details

**Necrocyte Sentinel** (135 HP, Legendary)
- Nekrotická aura snižuje regeneraci v okolí
- Vyvolává nekrotické spojence
- Aktivuje armor shield při 50% HP
- Exploze při smrti zanechá nekrotické pole

**Phage Overlord** (80 HP, Epic)  
- Infeční projektily šíří viral damage
- Viral spread na okolní nepřátele (+30% damage na infected)
- Phase dash umožňuje rychlé útoky
- Phage burst při 25% HP

**Radiomorph Titan** (200 HP, Legendary)
- Největší unique enemy s nejvyšším HP
- AoE radiation pulses se stackující damage
- Phase shift teleportace s invulnerability
- Masivní death blast s radiačním polem

**Mutagen Splicer** (65 HP, Epic)
- Rychlý assassin s adaptivními mutacemi
- Série rapid strikes s kritickým damage
- Genetic instability způsobuje náhodné efekty
- Final evolution při 20% HP

**Chromoblast** (90 HP, Epic)
- Leukemic burst série explozí ve spirále
- Temporal field zpomaluje čas kolem sebe
- Time echo vytváří časové duplikáty
- Cellular overload spawne miniony při smrti

**Cytokine Warcaller** (110 HP, Epic)
- Battlefield commander se support zaměřením
- War cry buff (+40% damage/speed pro spojence)
- Mass summoning vyvolává vlny nepřátel
- Battle coordination pro koordinované útoky

**Psionic Leukocyte** (75 HP, Epic)
- Mind control přebírá kontrolu nad nepřáteli
- Psychic blast ignoruje armor a omračuje
- Psionic shield odráží damage
- Neural disruption narušuje hráčské systémy

---

## Loot System Integration

### Loot Table Hierarchy

```
Common Enemy → lootTable.level{X}.common
Mini-Boss → lootTable.level{X}.miniboss  
Unique Enemy → lootTable.level{X}.unique
Stage Boss → lootTable.level{X}.boss
```

### Special Drops

| Drop Type | Source | Chance | Effect |
|-----------|--------|--------|--------|
| Research Point | Unique/Mini-boss | 10-20% | Unlock new abilities |
| Skin Fragment | Unique only | 5-10% | Cosmetic unlock (3 needed) |
| Mutator | Boss/Unique | 3-8% | Gameplay modifier |
| Metotrexat+ | Boss only | 5% | Enhanced screen clear |

---

## Spawn Tables Integration

### Mini-Boss Spawn Windows

```javascript
// Level 1 Mini-Boss Window
{
  enemyId: 'miniboss.metastatic_swarm',
  weight: 100,
  countRange: [1, 1],
  startAt: 180000,  // 3 min
  endAt: 200000,    // 3:20
  cooldown: 120000  // 2 min
}
```

### Unique Enemy Integration

```javascript
// Replace normal spawn with unique variant
{
  baseEnemy: 'enemy.viral_swarm',
  uniqueVariant: 'unique.viral_vector_z42',
  replaceChance: 0.01,  // 1%
  conditions: {
    minKills: 20,
    minTime: 60000
  }
}
```

---

## NG+ System

### Unlock Conditions
- **NG+1:** Complete all 3 stages
- **NG+2:** Complete NG+1 with score > 100,000
- **NG+3:** Complete NG+2 without deaths

### NG+ Modifiers

| Level | Enemy Scaling | New Mechanics | Special Rewards |
|-------|--------------|---------------|-----------------|
| NG+1 | 1.5x all stats | Boss enrage timers | 2x Research Points |
| NG+2 | 2.2x all stats | Elite reinforcements | Exclusive skins |
| NG+3 | 3.0x all stats | Permanent boss auras | Mythic mutators |
| NG+∞ | +50% per level | Random modifiers | Leaderboard glory |

---

## Implementation Status

### ✅ Completed (2025-08-12 Balance Pass)
- [x] **All 7 Unique Named Enemies** implemented and balanced
- [x] **TTK Targets** perfectly tuned (Level1: 2.5s, Level2: 2.0s, Level3: 1.5s)
- [x] **Wave Pacing** optimized for 30-minute sessions
- [x] **Pity System** comprehensive anti-frustration mechanics
- [x] **NG+ Scaling System** infinite replayability with 5+ tiers
- [x] **Balance Smoke Test** automated validation script
- [x] **Data Folder Consolidation** 100% validation guarantee
- [x] **I18n System** complete translations (cs/en)
- [x] **ConfigResolver** hierarchical configuration system
- [x] **JSON5 Blueprints** unified entity definitions
- [x] **Loot Tables** progressive reward scaling
- [x] **Spawn Tables** for levels 1-3 with elite/unique windows
- [x] **Main Boss Blueprints** (Onkogen Prime, Radiation Core, etc.)

### 🔄 Available for Implementation
- [ ] Mini-boss blueprints (framework ready)
- [ ] Research point economy (blueprint defined)
- [ ] Skin fragment collection (system designed)
- [ ] Event wave system (hooks available)

### 📋 Future Enhancements
- [ ] Finale mode (endless after all bosses)
- [ ] Global high score integration
- [ ] Cosmetic unlock UI
- [ ] Mobile optimization
- [ ] Multiplayer modes

---

## Debug Commands

```javascript
// Boss spawning
__phase5Debug.spawn.boss('boss.onkogen_prime')
__phase5Debug.spawn.miniboss('miniboss.metastatic_swarm')
__phase5Debug.spawn.unique('unique.viral_vector_z42')

// Loot testing
__phase5Debug.loot.test('lootTable.level1.miniboss')
__phase5Debug.loot.forceDrop('drop.research_point')

// NG+ testing
__phase5Debug.ng.setLevel(2)
__phase5Debug.ng.applyModifiers()

// Spawn rate testing
__phase5Debug.spawn.setRate(2.0)
__phase5Debug.spawn.forceEventWave()
```

---

## Feature Flags

```javascript
// In GameConfig
features: {
  expandedBossSystem: true,     // Mini-bosses and uniques
  ngPlusSystem: false,          // NG+ progression (pending)
  researchPoints: false,        // Research economy (pending)
  cosmeticUnlocks: false,       // Skin system (pending)
  eventWaves: false,            // Special waves (pending)
  finaleMode: false             // Endless mode (pending)
}
```

---

## Balance Notes

### Time-to-Kill Targets
- **Common enemies:** 2-3s (Stage 1) → 1-2s (Stage 3)
- **Elite enemies:** 5-8s → 3-5s
- **Mini-bosses:** 15-25s → 10-15s
- **Stage bosses:** 60-90s → 45-60s

### Spawn Density
- **Stage 1:** 3-5 enemies/second average
- **Stage 2:** 5-8 enemies/second average
- **Stage 3:** 8-12 enemies/second average
- **NG+:** +30% per level

---

## Monetization Hooks (Future)

- **Cosmetic Store:** Skins, effects, UI themes
- **Battle Pass:** Seasonal content, exclusive bosses
- **Research Boost:** Faster point accumulation
- **Revive Tokens:** Continue after death (limited)

---

## References

- Blueprint definitions: `/js/data/blueprints/`
- Spawn tables: `/js/config/spawnTables/`
- Loot tables: `/js/data/blueprints/lootTable/`
- i18n keys: `/js/i18n/translations/`

---

*Last Updated: 2025-08-12*  
*Version: 0.2.0*  
*Framework: Unified Blueprint System v5*