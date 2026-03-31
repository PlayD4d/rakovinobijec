# Weapon & Item Design — Rakovinobijec

## Overview

Expanding from 15 power-ups to a full weapon + passive item system inspired by Vampire Survivors, adapted to cancer biology theme.

## Architecture

Two distinct systems:
1. **Weapons** — active abilities chosen at level-up (existing power-up system)
2. **Passive Items** — permanent stat boosts dropped by enemies (new loot system)

---

## NEW WEAPONS (6)

### 1. Orbital Antibodies
**ID:** `powerup.orbital_antibodies` | **Rarity:** rare

Projectiles orbit around the player in a circle, damaging enemies on contact. Like King Bible from VS.

| Level | Orbitals | Damage | Radius | Speed |
|-------|----------|--------|--------|-------|
| 1 | 2 | 8 | 50px | 2 rad/s |
| 2 | 3 | 10 | 55px | 2.2 |
| 3 | 3 | 14 | 60px | 2.5 |
| 4 | 4 | 18 | 65px | 2.8 |
| 5 | 5 | 22 | 70px | 3.0 |

**Implementation:** Timer-based (4Hz). Each tick: calculate orbital positions, check distance to all enemies (both groups). Deal damage to enemies within hit radius. VFX: small colored circles orbiting player via position math (not physics).

**Biology:** Antibodies circulating around a cell, binding to and neutralizing pathogens.

---

### 2. Chemo Pool
**ID:** `powerup.chemo_pool` | **Rarity:** uncommon

Periodically creates a damage zone on the ground at the player's position. Persists for several seconds, damages enemies that walk through. Like Santa Water from VS.

| Level | Damage/tick | Radius | Duration | Interval |
|-------|-------------|--------|----------|----------|
| 1 | 5 | 40px | 3s | 4s |
| 2 | 8 | 50px | 3.5s | 3.5s |
| 3 | 12 | 55px | 4s | 3s |
| 4 | 16 | 60px | 4.5s | 2.5s |
| 5 | 20 | 70px | 5s | 2s |

**Implementation:** Timer creates a zone (Physics.add.zone + overlap with enemiesGroup+bossGroup). Zone has its own lifetime timer. Damage ticks at 500ms via zone-specific timer. VFX: green/teal pulsing circle on ground.

**Biology:** Chemotherapy drug pool — localized area of cytotoxic concentration.

---

### 3. Ricochet Cell
**ID:** `powerup.ricochet_cell` | **Rarity:** rare

Fires a projectile that bounces off screen edges, hitting enemies along the way. Like Runetracer from VS.

| Level | Damage | Speed | Bounces | Projectiles |
|-------|--------|-------|---------|-------------|
| 1 | 10 | 180 | 3 | 1 |
| 2 | 14 | 190 | 4 | 1 |
| 3 | 18 | 200 | 5 | 1 |
| 4 | 22 | 210 | 5 | 2 |
| 5 | 28 | 220 | 6 | 2 |

**Implementation:** Timer fires projectile via ProjectileSystem with `bounce: true`, `collideWorldBounds: true`. Phaser Arcade supports worldBounds bounce natively. Count bounces in preUpdate, kill after max. Need new projectile behavior flag.

**Biology:** Immune cell ricocheting through tissue, attacking multiple targets.

---

### 4. Synaptic Pulse
**ID:** `powerup.synaptic_pulse` | **Rarity:** uncommon

Periodic AoE damage pulse emanating from the player. Hits all enemies in radius. Like Lightning Ring from VS.

| Level | Damage | Radius | Interval |
|-------|--------|--------|----------|
| 1 | 8 | 80px | 2.5s |
| 2 | 12 | 90px | 2.2s |
| 3 | 16 | 100px | 2.0s |
| 4 | 22 | 110px | 1.8s |
| 5 | 30 | 120px | 1.5s |

**Implementation:** Timer-based. Each tick: iterate all enemies in radius (both groups), deal damage. VFX: expanding ring from player position (Graphics circle that scales up and fades). Simple — no projectiles, no physics zones.

**Biology:** Neural signal pulse — the nervous system's damage alert propagating outward.

---

### 5. Antibody Boomerang
**ID:** `powerup.antibody_boomerang` | **Rarity:** rare

Fires a projectile toward nearest enemy that returns to the player, hitting enemies both ways. Like Cross from VS.

| Level | Damage | Speed | Range | Projectiles |
|-------|--------|-------|-------|-------------|
| 1 | 12 | 200 | 150px | 1 |
| 2 | 16 | 210 | 170px | 1 |
| 3 | 20 | 220 | 190px | 1 |
| 4 | 25 | 230 | 200px | 2 |
| 5 | 32 | 240 | 220px | 2 |

**Implementation:** Custom projectile with two-phase movement: phase 1 = fly out in direction, phase 2 = return to player. Hits enemies in both directions (clear _hitEnemies between phases). Timer-based firing.

**Biology:** Y-shaped antibody — binds to antigen, returns to immune cell for processing.

---

### 6. T-Cell Swarm
**ID:** `powerup.tcell_swarm` | **Rarity:** epic

Spawns autonomous "pet" T-cells that chase and attack nearby enemies independently. Like Peachone from VS.

| Level | T-Cells | Damage | Speed | Attack Rate |
|-------|---------|--------|-------|-------------|
| 1 | 1 | 6 | 120 | 1.5s |
| 2 | 1 | 10 | 130 | 1.3s |
| 3 | 2 | 14 | 140 | 1.1s |
| 4 | 2 | 18 | 150 | 0.9s |
| 5 | 3 | 22 | 160 | 0.8s |

**Implementation:** Create invisible sprites with chase AI (simplified — just move toward nearest enemy). Each T-cell has its own attack timer that deals damage to the enemy it's touching. T-cells orbit near player when no enemies present.

**Biology:** T-lymphocytes — the immune system's autonomous hunter-killer cells.

---

## PASSIVE ITEMS (4)

Dropped by enemies as loot. Permanent stat boosts, stackable. Use existing loot/drop system.

### 1. Protein Cache
**ID:** `item.protein_cache` | **Drop chance:** 2% from elites, 5% from uniques

+5 Max HP per pickup. Permanent. Stackable.

**Implementation:** Already exists as `item.protein_cache` in items/health/. Just needs to be added to elite/unique drop tables.

---

### 2. Adrenaline Shot
**ID:** `item.adrenaline_shot` | **Drop chance:** 3% from any enemy

+3% Move speed per pickup. Permanent. Stackable (max 10 stacks = +30%).

**Implementation:** New item blueprint. On pickup: `player.addModifier({ id: 'adrenaline_N', path: 'moveSpeed', type: 'mul', value: 0.03 })`.

---

### 3. Mutation Catalyst
**ID:** `item.mutation_catalyst` | **Drop chance:** 1% from elites, 3% from bosses

+4 Projectile damage per pickup. Permanent. Stackable.

**Implementation:** New item blueprint. On pickup: `player.addModifier({ id: 'catalyst_N', path: 'projectileDamage', type: 'add', value: 4 })`.

---

### 4. Cell Membrane
**ID:** `item.cell_membrane` | **Drop chance:** 2% from elites

+1 Armor per pickup. Permanent. Stackable.

**Implementation:** New item blueprint. On pickup: `player.addModifier({ id: 'membrane_N', path: 'damageReduction', type: 'add', value: 1 })`.

---

## REPLACE: angiogenesis_inhibitor → Synaptic Pulse

The current `angiogenesis_inhibitor` (slow aura) duplicates `immune_aura`'s slow mechanic. Replace it with **Synaptic Pulse** — a periodic AoE damage pulse.

**Migration:**
1. Delete `powerup_angiogenesis_inhibitor.json5`
2. Create `powerup_synaptic_pulse.json5`
3. Update registry, i18n, config
4. Remove slow_aura code from PowerUpAbilities
5. Add synaptic_pulse handler

---

## IMPLEMENTATION PRIORITY

### Wave 1 — Replace + simplest new weapons
1. Replace angiogenesis_inhibitor → Synaptic Pulse (timer + distance check, no physics)
2. Orbital Antibodies (timer + position math, no physics)
3. Chemo Pool (zone + overlap, existing pattern from immune_aura)

### Wave 2 — Complex weapons
4. Antibody Boomerang (custom projectile behavior)
5. Ricochet Cell (bounce projectile)
6. T-Cell Swarm (autonomous sprites)

### Wave 3 — Passive items
7. Create 4 new item blueprints
8. Add to enemy drop tables
9. Implement pickup handlers

---

## TOTAL ROSTER AFTER IMPLEMENTATION

### Weapons (20):
**Offense:** damage_boost, multi_shot, piercing_arrows (Cisplatina)
**Weapon:** homing_shot, oxidative_burst, ion_therapy, **orbital_antibodies**, **ricochet_cell**, **antibody_boomerang**
**Defense:** shield, cytoprotection, regenerative_therapy
**Special:** radiotherapy, immune_aura, chemo_reservoir, **chemo_pool**, **synaptic_pulse**, **tcell_swarm**
**Utility:** metabolic_haste, xp_magnet

### Passive Items (4+):
protein_cache, adrenaline_shot, mutation_catalyst, cell_membrane

---

*Rakovinobijec | Weapon & Item Design v1.0 | 2026-03-31*
