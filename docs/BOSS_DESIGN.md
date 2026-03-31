# Boss Design — 7 Stages of Cancer

## Story Arc

The player is a **cytotoxic agent** (treatment) fighting cancer inside the human body. Each level represents the next stage of tumor progression — from the first tumor clone to the final resistant core.

---

## Boss 1: Primary Clone
**ID:** `boss.primary_clone` | **Level 1** | **Theme: Uncontrolled Proliferation**

The first tumor cell that began dividing uncontrollably. Not yet strong, but already mastering the most important skill — copying itself. Represents the fundamental hallmark of cancer.

### Visual
Larger cell (size 50), **light pink/red** (`#CC4466`). Flashes white during division. Pulses red in enrage.

### Stats
HP: 800 | Damage: 8 | Speed: 35 | Armor: 0 | XP: 200

### Phases

**Phase 1 — Growth (100-70% HP)**
- `projectile_burst`: 4 shots, 360° spread, 3s cooldown
- `minion_spawn`: 2x viral_swarm every 12s ("cell division")

**Phase 2 — Acceleration (70-35% HP)**
- `projectile_burst`: 6 shots, faster (2.5s cooldown)
- `minion_spawn`: 3x viral_swarm every 10s
- `area_damage`: AoE pulse around boss, radius 100, telegraph 1.5s
- Speed x1.2

**Phase 3 — Uncontrolled Division (<35% HP)**
- `projectile_burst`: 8 shots, 2s cooldown
- `massive_summon`: 5x enemies in circle every 15s
- `area_damage`: radius 120, telegraph 1.2s
- Speed x1.4, Damage x1.2

### Unique Trait
**Tutorial boss.** Each phase introduces one new mechanic. Clean patterns, no surprises.

---

## Boss 2: Oncogenic Signal
**ID:** `boss.oncogenic_signal` | **Level 2** | **Theme: Deregulated Cell Signaling**

Oncogenes are mutated genes that send constant "grow!" signals to other cells. This boss represents deregulated signaling — cells receiving false commands to grow and survive.

### Visual
Pulsing **purple/magenta** cell (`#9933CC`), size 45. Visible "signal waves" (pulse VFX) around it. Purple aura in Phase 3.

### Stats
HP: 1000 | Damage: 12 | Speed: 45 | Armor: 3 | XP: 300

### Phases

**Phase 1 — Signal Cascade (100-65% HP)**
- `projectile_burst`: 5 shots, 60° fan toward player, 2.5s cooldown
- `projectile_burst` (tracking): 3 homing shots, 4s cooldown

**Phase 2 — Amplification (65-30% HP)**
- Fan burst: 7 shots, 75° spread, 2s cooldown
- Tracking burst: 4 shots, 3s cooldown
- `toxic_cloud`: "Signal zone" at player position, 4s duration, 8 dmg/tick
- `minion_spawn`: 2x micro_shooter every 15s
- Speed x1.3

**Phase 3 — Signal Storm (<30% HP)**
- Fan burst: 10 shots, 90° spread, 1.5s cooldown
- Tracking burst: 5 shots, 2.5s cooldown
- `toxic_cloud`: 2 zones simultaneously
- `rage_mode`: 12s duration, speed x1.5, damage x1.4
- Speed x1.4 base

### Unique Trait
**Signal overload.** Targeted fan-burst + homing shots + toxic zones force constant repositioning.

---

## Boss 3: Immune Saboteur
**ID:** `boss.immune_saboteur` | **Level 3** | **Theme: Immune Evasion**

Cancer survives by sabotaging the immune system. Tumor cells send signals that "put to sleep" T-lymphocytes and create an immunosuppressive microenvironment. Represents immune evasion — a key Hallmark of Cancer.

### Visual
**Dark green** cell (`#336644`), size 55. Surrounded by visible **green aura** (radiation_field). Green shield flash when spawning minions. Aura expands and yellows in enrage.

### Stats
HP: 1200 | Damage: 10 | Speed: 28 | Armor: 8 | XP: 350

### Phases

**Phase 1 — Immunosuppression (100-65% HP)**
- **Passive aura: radiation_field** — radius 80, 2 dmg/1.5s
- `toxic_pools`: 2 green zones, damage 10, radius 50
- `minion_spawn`: 3x shielding_helper every 15s ("regulatory cells")

**Phase 2 — Regulatory T-cells (65-35% HP)**
- Aura radius expands to 100
- `toxic_pools`: 3 zones, damage 12
- `minion_spawn`: 4x support_bacteria every 12s
- `projectile_burst`: 6 shots, 360° circle, 3s cooldown
- Speed x1.1, Armor +5

**Phase 3 — Checkpoint Blockade (<35% HP)**
- Aura radius 120, damage 3/tick
- `toxic_pools`: 4 zones, damage 15
- `massive_summon`: 6x enemies in circle, 18s cooldown
- `projectile_burst`: 8 shots, 360°, 2.5s cooldown
- `rage_mode`: Aura damage doubles for 8s
- Speed x1.2, Damage x1.3

### Unique Trait
**Space control + minion support.** Boss itself attacks little, but aura and toxic pools cover huge area. Support minions heal/protect boss. Player must kill supports first.

---

## Boss 4: Angiogenic Heart
**ID:** `boss.angiogenic_heart` | **Level 4** | **Theme: Tumor Angiogenesis**

The tumor needs its own blood supply to grow. Angiogenesis is the process of recruiting new blood vessels. This boss is the center of the vascular network — the beating heart of the tumor.

### Visual
**Dark red/bloody** (`#881122`), size 60. Pulses like a heartbeat (scale tween). "Veins" spread as beam effects. Turns black with red pulses in Phase 3.

### Stats
HP: 1400 | Damage: 15 | Speed: 22 | Armor: 12 | XP: 400

### Phases

**Phase 1 — Beating Core (100-65% HP)**
- `beam_sweep`: Slow red beam, 180° sweep, damage 12, 5s cooldown
- `radiation_pulse`: Bloody pulse, radius 120, damage 8, 4s cooldown ("heartbeat")

**Phase 2 — Vascular Network (65-30% HP)**
- `beam_sweep`: 2 beams alternating, 3.5s cooldown
- `radiation_pulse`: radius 140, damage 10, 3s cooldown
- `toxic_pools`: 2 "blood pools", damage 10
- `minion_spawn`: 3x necrotic_cell every 14s
- Speed x1.1, Armor +3

**Phase 3 — Hemorrhage (<30% HP)**
- `radiation_storm`: Rotating blood beams, 6s duration
- `beam_sweep`: Fast sweep, 2.5s cooldown
- `radiation_pulse`: radius 160, damage 12, 2.5s cooldown
- `area_damage`: Massive AoE "hemorrhage", radius 180, damage 20, telegraph 2s
- Speed x1.2, Damage x1.4

### Unique Trait
**Beam-heavy boss.** Main threats are beam sweeps and rotating storms covering large areas. Player must read telegraph patterns and find safe gaps. Pulse simulates "heartbeat" rhythm.

---

## Boss 5: Metastatic Emissary
**ID:** `boss.metastatic_emissary` | **Level 5** | **Theme: Metastasis**

Metastasis — the deadliest aspect of cancer. Tumor cells detach, travel through bloodstream, and establish new tumors in other organs. This boss is fast, aggressive, evasive — embodying cancer spread.

### Visual
**Orange/amber** (`#DD7700`), size 38 (smaller, faster). Leaves afterimage trail. Blurs during dash. Spawns "copies" in enrage.

### Stats
HP: 1500 | Damage: 18 | Speed: 55 | Armor: 5 | XP: 450

### Phases (4 phases!)

**Phase 1 — Invasion (100-60% HP)**
- `dash_attack`: Fast dash to player, damage 20, 3.5s cooldown
- `projectile_burst`: 5 shots, 45° fan, 3s cooldown

**Phase 2 — Spread (60-30% HP)**
- `dash_attack`: Faster, 2.5s cooldown, damage 25
- `projectile_burst`: 7 shots, 60° fan, 2.5s cooldown
- `minion_spawn`: 3x metastasis_runner every 12s
- `toxic_cloud`: Toxic trail after dash, 3s duration
- Speed x1.3

**Phase 3 — Dissemination (<30% HP)**
- `dash_attack`: 2s cooldown, damage 30
- `projectile_burst`: 10 shots, 120° spread, 2s cooldown
- `massive_summon`: 5x metastasis_runner every 15s
- `rage_mode`: Speed x1.8, damage x1.5, 10s duration
- Speed x1.5 base, Damage x1.3

**Phase 4 — Last Escape (<15% HP)**
- Extreme rage: speed x2.0, damage x1.5
- `dash_attack`: 1.5s cooldown — constant dashing
- `massive_summon`: Continuous spawning
- Boss desperately tries to "escape and spread"

### Unique Trait
**Mobility and aggression.** Only boss with 4 phases. Dash-heavy gameplay requires movement prediction. Phase 4 "panic mode" is the fastest entity in the game.

---

## Boss 6: Resistant Clone
**ID:** `boss.resistant_clone` | **Level 6** | **Theme: Chemoresistance**

Tumor cells adapt to treatment. They express efflux pumps, repair DNA, or activate alternative survival pathways. This boss represents adaptive resistance — the harder you hit, the tougher it gets.

### Visual
**Grey/silver** (`#889999`) with reflective sheen, size 55. Changes color each phase (grey → blue → gold). Gold pulse in enrage.

### Stats
HP: 1800 | Damage: 15 | Speed: 30 | Armor: 10 (increases per phase!) | XP: 500

### Phases (4 phases!)

**Phase 1 — Sensitive (100-65% HP)** — Relatively vulnerable
- `projectile_burst`: 6 shots, circle 360°, 3s cooldown
- `beam_sweep`: Slow beam, 5s cooldown
- `minion_spawn`: 2x viral_swarm every 14s
- Armor: 10

**Phase 2 — Adaptation (65-40% HP)** — Adapting
- Color: grey → **blue** (`#4466AA`)
- `projectile_burst`: 8 shots, 2.5s cooldown
- `beam_sweep`: Faster, 3.5s cooldown
- `toxic_cloud`: "Efflux field" damage zone
- `minion_spawn`: 3x aberrant_cell every 12s
- Armor: **18** (+8)
- Speed x1.2

**Phase 3 — Multi-resistance (40-15% HP)** — Fully resistant
- Color: blue → **gold** (`#CCAA33`)
- `projectile_burst`: 10 shots, 360°, 2s cooldown
- `radiation_storm`: Rotating beams, 7s duration
- `toxic_pools`: 3 zones
- `massive_summon`: 4x necrotic_cell every 16s
- Armor: **25** (+7)
- Speed x1.3, Damage x1.3

**Phase 4 — Last Defense (<15% HP)**
- Color: pulsing **gold/red**
- `core_overload`: Massive AoE, radius 200, damage 25, 5s charge
- `radiation_storm` + `projectile_burst` simultaneously
- `rage_mode`: Speed x1.5, damage x1.5, 15s
- Armor: **30**

### Unique Trait
**Increasing armor = treatment adaptation.** Player feels boss hardening each phase. Color changes visualize "mutational adaptation". Strategy: maximize damage in Phase 1 before it hardens.

---

## Boss 7: Tumor Core
**ID:** `boss.tumor_core` | **Level 7 (FINAL)** | **Theme: All Hallmarks Combined**

The final boss — the primary tumor core. Combines all mechanisms cancer uses: uncontrolled growth, angiogenesis, metastasis, immunosuppression, and resistance. The ultimate cancer cell — defeating it means a cure.

### Visual
**Dark red/black** (`#441111`), size 80 — largest boss. Pulses like a heart. Surrounded by **red aura**. Core color changes per phase. Phase 5 glows blinding white — final form.

### Stats
HP: 2500 | Damage: 20 | Speed: 25 | Armor: 15 | XP: 1000

### Phases (5 phases!)

**Phase 1 — Tumor Wall (100-80% HP)**
- **Passive aura: radiation_field** — radius 90, 2 dmg/tick
- `projectile_burst`: 8 shots, circle 360°, 3s cooldown
- `minion_spawn`: 3x viral_swarm every 15s

**Phase 2 — Angiogenesis (80-60% HP)**
- Aura radius → 100
- `beam_sweep`: Bloody beam, damage 15, 4s cooldown
- `projectile_burst`: 10 shots, 2.5s cooldown
- `toxic_pools`: 2 zones, damage 12
- `minion_spawn`: 3x necrotic_cell every 12s
- Speed x1.1

**Phase 3 — Metastasis (60-40% HP)**
- `dash_attack`: Boss moves aggressively! Damage 25, 4s cooldown
- `projectile_burst`: 12 shots, fan 90°, 2s cooldown
- `massive_summon`: 5x metastasis_runner every 16s
- `toxic_cloud`: Lingering zones after dash
- Speed x1.3, Damage x1.2

**Phase 4 — Immunosuppression (40-15% HP)**
- Aura radius → 120, damage 3/tick
- `radiation_storm`: Rotating beams, 7s duration, 12s cooldown
- `beam_sweep` + `projectile_burst` simultaneously
- `minion_spawn`: 4x shielding_helper
- Speed x1.4, Damage x1.3, Armor +5

**Phase 5 — Last Resistance (<15% HP)**
- Boss **glows white** — visual climax
- `core_overload`: Massive AoE, radius 220, damage 30, 6s charge
- `radiation_storm` + `rapid_beams`: Simultaneous beams from all directions
- `rage_mode`: Speed x1.8, damage x1.6, permanent
- `massive_summon`: 6x enemies, 14s cooldown
- Aura radius 140, 4 dmg/tick
- **Everything at once** — player must survive and finish the core

### Unique Trait
**Each phase = different hallmark of cancer.** Phase 1 = proliferation, Phase 2 = angiogenesis, Phase 3 = metastasis, Phase 4 = immunosuppression, Phase 5 = resistance. Defeat = cure.

---

## System Changes Required

1. **Boss fight isolation**: `pauseNormalSpawns = true` when boss spawns, `clearEnemies` before boss fight
2. **Resume normal spawns** after boss death
3. **All player-facing text via i18n** — boss names, phase names, ability descriptions
4. **Blueprint IDs in English** — `boss.primary_clone`, `boss.oncogenic_signal`, etc.

---

*Rakovinobijec | Boss Design v2.0 | 2026-03-31*
