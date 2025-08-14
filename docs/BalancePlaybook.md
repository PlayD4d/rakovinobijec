# Balance Playbook

**Version**: 1.0.0  
**Date**: 2025-08-12  
**Target**: 30-minute gameplay sessions

## Overview

This playbook defines the comprehensive balance framework for **Rakovinobijec**, ensuring optimal 30-minute gameplay sessions with progressive difficulty, fair rewards, and high replay value.

## Core Balance Pillars

### 1. Time-to-Kill (TTK) Targets

| Level | Target TTK | Enemy Health Range | Player DPS Required |
|-------|------------|-------------------|-------------------|
| **Level 1** | 2.5s | 12-45 HP | 18-24 DPS |
| **Level 2** | 2.0s | 20-60 HP | 30-40 DPS |
| **Level 3** | 1.5s | 30-80 HP | 50-65 DPS |

**Rationale**: Decreasing TTK creates escalating intensity while ensuring players feel progression power.

### 2. Wave Pacing Framework

```
Level 1 (4:00 duration):
├─ 0-30s:   Tutorial pace (2.5s intervals)
├─ 30-90s:  Ramp-up (2.0s intervals) 
├─ 90-160s: Steady pressure (1.8s intervals)
├─ 160-200s: Pre-boss chaos (1.5s intervals)
└─ 200s+:   Boss encounter

Level 2 (4:40 duration):
├─ 0-40s:   Quick start (2.0s intervals)
├─ 40-85s:  Mixed groups (1.8s intervals)
├─ 85-135s: Support mechanics (1.5s intervals)
├─ 135-185s: Multi-layer chaos (1.2s intervals)
├─ 185-220s: Final pressure (1.0s intervals)
└─ 220s+:   Boss encounter

Level 3 (5:00 duration):
├─ 0-35s:   Aggressive start (1.5s intervals)
├─ 35-75s:  Full spectrum (1.2s intervals)
├─ 75-120s: Support chaos (1.0s intervals)
├─ 120-170s: Mass combinations (0.8s intervals)
├─ 170-210s: Absolute chaos (0.6s intervals)
└─ 210s+:   Boss encounter(s)
```

### 3. Difficulty Multiplier Progression

| Parameter | Level 1 | Level 2 | Level 3 | NG+ Tier 1 | NG+ Tier 4 |
|-----------|---------|---------|---------|------------|------------|
| **Enemy HP** | 1.0× | 1.3× | 1.8× | 1.25× | 2.5× |
| **Enemy Damage** | 1.0× | 1.2× | 1.6× | 1.15× | 2.0× |
| **Enemy Speed** | 1.0× | 1.1× | 1.3× | 1.05× | 1.3× |
| **Spawn Rate** | 1.0× | 1.4× | 2.0× | 1.2× | 2.2× |
| **Elite Frequency** | 0.8× | 1.2× | 1.8× | 1.3× | 2.5× |

## Enemy Categorization

### Base Enemies
- **Viral Swarm**: Fast, weak, swarm units (12 HP, 4 DMG)
- **Necrotic Cell**: Tanky basic unit (45 HP, 8 DMG)
- **Acidic Blob**: Slow corrosive (30 HP, 6 DMG)
- **Micro Shooter**: Ranged kiter (20 HP, 8 proj DMG)
- **Metastasis Runner**: Fast dash attacker (25 HP, 12 DMG)
- **Shielding Helper**: Support unit (35 HP, 5 DMG, shields others)

### Elite Variants
- **Viral Swarm Alpha**: Enhanced swarm (35 HP, 8 DMG, +50% speed)
- **Micro Shooter Enhanced**: Improved ranged (40 HP, 12 proj DMG)
- **Aberrant Cell**: Elite tank (80 HP, 15 DMG, armor)

### Unique Named Enemies (1-3% spawn chance)
1. **Necrocyte Sentinel**: Decay aura, summons minions
2. **Phage Overlord**: Viral projectile spread
3. **Mutagen Splicer**: Adaptive abilities
4. **Chromoblast**: Time manipulation bursts
5. **Radiomorph Titan**: Phase shifting, massive HP
6. **Cytokine Warcaller**: Mass buff aura
7. **Psionic Leukocyte**: Mind control mechanics

## Loot Balance Framework

### Drop Rate Categories

| Category | Normal Enemies | Elite Enemies | Boss Enemies | Unique Enemies |
|----------|---------------|---------------|--------------|----------------|
| **XP Orbs** | 85% | 95% | 100% | 100% |
| **Health Drops** | 8-15% | 30-60% | 80-100% | 40-80% |
| **Power-ups** | 0-2% | 2-15% | 25-50% | 15-35% |
| **Special Drops** | 0.5-2% | 3-5% | 5-8% | 8-15% |

### Pity System Configuration

**Anti-Frustration Mechanics**:
- XP drought: Guaranteed XP drop after 8 kills
- Health emergency: Guaranteed health when <50% HP after 15 kills
- Power-up stagnation: Guaranteed power-up after 80-120 kills (level-dependent)
- Elite absence: Force elite spawn after 3 minutes
- Unique drought: Guarantee unique spawn after 3-5 minutes
- Special rarity: Guarantee Metotrexat after 200 kills

### Loot Quality Scaling

```json
{
  "qualityMultipliers": {
    "level1": { "base": 1.0, "elite": 1.2, "boss": 1.5, "unique": 1.3 },
    "level2": { "base": 1.1, "elite": 1.4, "boss": 1.8, "unique": 1.5 },
    "level3": { "base": 1.2, "elite": 1.6, "boss": 2.0, "unique": 1.8 }
  }
}
```

## NG+ (New Game Plus) System

### Tier Progression
- **Tier 0**: Base game experience
- **Tier 1**: +25% challenge, +10% rewards, dual boss chance
- **Tier 2**: +60% challenge, +25% rewards, unique everywhere
- **Tier 3**: +100% challenge, +50% rewards, triple boss potential
- **Tier 4+**: Infinite scaling with caps (max 10× HP, 5× damage)

### Unlock Conditions
- **NG+**: Complete any level once
- **NG++**: Complete 3 runs, defeat 5 bosses
- **NG+++**: Complete 7 runs, defeat 15 unique enemies
- **NG++++**: Complete 15 runs, 2+ hours total time

## Validation Tools

### Balance Smoke Test (`scripts/balance-smoke.mjs`)
Validates:
- ✅ TTK targets match specifications
- ✅ Wave progression maintains intensity curve  
- ✅ Loot table progressions (boss > elite > normal)
- ✅ Difficulty multiplier scaling
- ✅ Progressive scaling factors

**Usage**: `npm run balance:test`

### Live Balance Metrics
Monitor during playtesting:
- Average session duration (target: 4-5 minutes per level)
- Player death frequency (target: <30% first-time failure rate)
- Power-up acquisition rate (target: 1 every 60-90 seconds)
- Elite encounter frequency (target: 1 every 90-120 seconds)
- Unique encounter rate (target: 1-2 per session)

## Tuning Guidelines

### When TTK feels wrong:
1. **Too fast**: Increase enemy HP by 10-15%
2. **Too slow**: Reduce enemy HP by 15-20% OR increase player base damage
3. **Inconsistent**: Audit enemy stat variance within levels

### When waves feel wrong:
1. **Too easy**: Reduce spawn intervals by 200-300ms
2. **Too hard**: Increase spawn intervals by 300-500ms
3. **Boring**: Add more enemy type variety within windows

### When loot feels wrong:
1. **Too stingy**: Increase base drop rates by 20-30%
2. **Too generous**: Reduce power-up drop rates first
3. **Unrewarding**: Boost boss/elite drop quality multipliers

### When progression feels wrong:
1. **Too slow**: Reduce NG+ unlock requirements
2. **Too fast**: Increase multiplier caps, add more tiers
3. **Repetitive**: Add more NG+ exclusive features

## Balance Philosophy

**Core Principle**: *"Every 30-second window should contain a moment of challenge, a moment of power, and a moment of progression."*

### Design Values
1. **Escalation**: Difficulty increases smoothly but noticeably
2. **Agency**: Player choices matter more than RNG
3. **Progression**: Always forward momentum, never complete stagnation
4. **Variety**: No two 30-minute sessions feel identical
5. **Mastery**: Skill improvement translates to better performance

### Anti-Patterns to Avoid
- ❌ Difficulty spikes that invalidate player progression
- ❌ RNG streaks that create frustration without recourse
- ❌ Power-up gaps that create boring gameplay windows
- ❌ Trivial enemies that waste player time
- ❌ Bullet sponges without interesting mechanics

## Playtesting Protocol

### Session Structure
1. **Fresh Player** (0 hours): Can they complete Level 1?
2. **Learning Player** (2-5 hours): Can they reach Level 3?
3. **Experienced Player** (10+ hours): Do they find NG+ engaging?

### Key Metrics
- **Engagement**: Are players making meaningful decisions every 10-15 seconds?
- **Flow**: Do players enter "flow state" during optimal challenge windows?
- **Progression**: Do players feel tangibly stronger after each upgrade?
- **Surprise**: Do unique/elite encounters create memorable moments?

### Red Flags
- Player idle time >5 seconds (insufficient pressure)
- Player panic time >15 seconds (excessive pressure)  
- Power-up gaps >2 minutes (progression stall)
- Identical enemy compositions >30 seconds (variety failure)

---

**Next Review**: After 50+ hours of cumulative playtesting data  
**Balance Owner**: Claude & Development Team  
**Last Updated**: 2025-08-12