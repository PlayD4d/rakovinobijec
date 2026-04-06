# Systems Reference — Rakovinobijec v0.9.49

> Authoritative architecture map. Updated 2026-04-06.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│  SCENE LAYER                                                │
│  GameScene (thin hub) ←→ GameUIScene (parallel overlay)     │
│  CentralEventBus connects both                              │
└────────┬───────────────────────────────────┬────────────────┘
         │                                   │
┌────────▼────────────┐         ┌────────────▼───────────────┐
│  MANAGERS            │         │  UI                        │
│  BootstrapManager    │         │  UnifiedHUD                │
│  UpdateManager       │         │  PauseUI / PowerUpUI       │
│  TransitionManager   │         │  GameOverUI                │
│  EnemyManager        │         └───────────────────────────┘
└────────┬────────────┘
         │
┌────────▼─────────────────────────────────────────────────┐
│  SYSTEMS                                                  │
│  ProjectileSystem  SimpleLootSystem  PowerUpSystem         │
│  SpawnDirector     VFXSystem         AudioSystem           │
│  GraphicsFactory   TargetingSystem   ProgressionSystem     │
└────────┬─────────────────────────────────────────────────┘
         │
┌────────▼─────────────────────────────────────────────────┐
│  ENTITIES                                                 │
│  Player (Combat + Stats + AttackController)               │
│  Enemy (EnemyCore + EnemyBehaviors)                       │
│  Boss (BossCore + Phases + Abilities + Movement)          │
└────────┬─────────────────────────────────────────────────┘
         │
┌────────▼─────────────────────────────────────────────────┐
│  DATA (JSON5 Blueprints)                                  │
│  /data/blueprints/{enemy,boss,elite,unique,powerup,       │
│   projectile,spawn,items,system}/                         │
│  /data/config/main_config.json5, features.json5           │
└──────────────────────────────────────────────────────────┘
```

---

## Game Start Flow

```
MainMenu.startGame()
  → scene.start('GameScene')
    → GameScene.create()
       ├── events.once('shutdown', this.shutdown)
       ├── new DisposableRegistry()
       ├── await _initializeBlueprintLoader()
       ├── new ProgressionSystem(this)
       └── new BootstrapManager(this).bootstrap()
```

### BootstrapManager — 12 Phases

| Phase | What happens |
|-------|-------------|
| 1 | `setupWorldAndDepth()` — physics bounds, DEPTH_LAYERS, camera |
| 2 | `setupInput()` — WASD + arrows, optional mobile controls |
| 2.5 | `DisplayResolver.load('cs')` — i18n |
| 3 | `SystemsInitializer.initializeAll()` — creates all systems |
| 4 | `new Player(scene, cx, cy, blueprint)` |
| 5 | `launch('GameUIScene')`, connect HUD |
| 7 | `registerEventListeners()` — scene events + CentralEventBus |
| 8 | `resumePhysics()` + `setupCollisions()` |
| 9 | `initializeUpdateManager()` + `initializeTransitionManager()` |
| 10 | `startGame()` — fade in, load spawnTable.level1, start spawning |
| 11 | `setupDevTools()` — DEV console |
| 12 | `startGameTimer()` — 1s interval |

### SystemsInitializer — Init Order

1. GraphicsFactory (textures first — others depend on it)
2. SimplifiedAudioSystem
3. VFXSystem
4. ProjectileSystem
5. TargetingSystem
6. SimpleLootSystem
7. PowerUpSystem
8. EnemyManager (creates enemiesGroup + bossGroup)
9. SpawnDirector
10. KeyboardManager
11. FrameworkDebugAPI

---

## Update Loop (UpdateManager)

| Priority | Task | What runs |
|----------|------|-----------|
| 5 | `game_timer` | `sceneTimeSec += delta/1000`, sync SessionLog gt |
| 20 | `spawn_director` | `SpawnDirector.update(delta)` — wave spawning + boss triggers |
| 25 | `player_update` | `Player.update()` — movement + auto-attack |
| 30 | `enemy_updates` | For-loop `enemiesGroup` + `bossGroup` — AI behaviors |
| 60 | `loot_system` | `SimpleLootSystem.update()` — XP magnet pull |
| 70 | `powerup_system` | `PowerUpSystem.update()` — active ability ticks |
| 80 | `vfx_system` | VFX + shield effects update |
| 90 | `hud_update` | 10Hz HUD refresh via `hud.refresh()` |
| 100 | `debug_overlay` | DebugOverlay (dev only) |

Periodic tasks (inside UpdateManager):
- Every 10s: `_cleanupDeadSprites()` — destroy inactive enemies/bosses from groups
- Every 5s: performance snapshot to SessionLog (fps, entity counts, heap)

---

## Game Flow

```
MainMenu → GameScene.create() → BootstrapManager (12 phases)
  → SpawnDirector.start() → enemy waves
    → kill enemies → XP orbs + per-enemy drops + chests
      → level up → PowerUpUI selection → apply
        → boss trigger (time/kills) → boss fight
          → boss die → gold chest + level transition
            → next spawn table → repeat
              → 7 bosses killed → VICTORY
              → player HP ≤ 0 → GAME OVER → retry/menu
```

---

## Enemy Lifecycle

### Spawn

```
SpawnDirector.update(delta)
  → SpawnWaveProcessor.processEnemyWaves()
    → EnemyManager.spawnEnemy(blueprintId, {x, y})
       ├── blueprintLoader.get(blueprintId)
       ├── graphicsFactory.generateEnemyTexture()
       ├── new Enemy(scene, blueprint, {x, y})
       │    ├── EnemyCore: Phaser.Physics.Arcade.Sprite
       │    │    └── reads hp, speed, damage, armor, xp from blueprint
       │    └── EnemyBehaviors: multi-layer AI (movement + combat)
       ├── enemiesGroup.add(enemy)
       └── enemy.setDepth(DEPTH_LAYERS.ENEMIES)
```

### Per-Frame Update

```
Enemy.update(time, delta)
  → EnemyBehaviors.update(time, delta)
     ├── movement layer: chase/swarm/orbit/patrol/flee/charge/evasion
     ├── combat layer: shoot/explode/shield_ally
     └── each = pure function(capability, config, dt, memory)
```

### Death

```
EnemyCore.takeDamage(hit) → hp ≤ 0 → die(source)
  ├── setActive(false), setVisible(false), body.enable = false
  ├── EnemyManager.onEnemyDeath(enemy)
  │    ├── death VFX/SFX
  │    ├── createXPOrbs(x, y, enemy.xp)
  │    ├── lootSystem.handleEnemyDeath(enemy)  ← blueprint.drops[]
  │    ├── chest drop (boss=gold, unique=silver, elite=bronze 50%)
  │    └── update gameStats (kills, score)
  └── cleanup() — cancel timers, kill tweens
```

---

## Boss Lifecycle

### Spawn

```
BossSpawnController.spawnBoss()
  → EnemyManager.createBoss(blueprint, x, y)
    → new Boss(scene, x, y, blueprint)
       ├── BossCore (extends EnemyCore)
       └── Boss.initializeBossSystems()
            ├── EnemyBehaviors (reuses regular enemy AI)
            ├── BossMovement (dash, teleport)
            ├── BossPhases (HP threshold transitions)
            └── BossAbilities (ability handlers from blueprint)
```

### Per-Frame Update

```
Boss.update(time, delta)
  ├── behaviors.update()        ← movement AI
  ├── phases.update()           ← HP check → phase transition
  ├── abilitiesSystem.update()  ← ability ticks
  └── makeBossDecision()        ← pick & execute ready ability
```

### Phase Transitions

```
BossPhases.update()
  → HP below threshold
    → transitionToPhase(newPhase)
       ├── invulnerability window
       ├── transition VFX/SFX
       ├── applyPhaseModifiers(speed, damage, attackRate)
       ├── spawn minions (if phaseData.spawnMinions)
       └── update available abilities
```

### Death

```
Boss.die(killer)
  ├── clear telegraphs, death VFX/SFX
  ├── EnemyManager.onEnemyDeath(this) — XP, gold chest, stats
  ├── cleanup all subsystems (behaviors, movement, phases, abilities)
  └── scene.events.emit('boss:die')
       → transitionToNextLevel()
```

---

## Player Systems

### Construction

```
new Player(scene, x, y, blueprint)
  ├── Phaser.Physics.Arcade.Sprite
  ├── baseStats from blueprint via ConfigResolver
  ├── PlayerCombat — damage taken, shield, iFrames, death
  ├── PlayerStats — modifier stack with dirty-flag caching
  └── PlayerAttackController — 4-directional auto-attack + homing
```

### Damage Pipeline

```
player.takeDamage(amount, source)
  ├── iFrame guard
  ├── dodge check (dodgeChance stat)
  ├── shield absorption (ShieldRegeneration)
  ├── hp -= finalDamage
  ├── iFrames activated
  ├── VFX/SFX + camera feedback
  └── hp ≤ 0 → die() → emit 'player:die'
```

### Stat System (PlayerStats)

Modifier types: `add` (flat), `mul` (+% bonus), `multiply` (direct ×), `base` (override), `set` (force).

Stats recalculated on `_statsDirty = true`, cached until next dirty. Minimum attack interval enforced at 200ms.

---

## Powerup System

### Sources of Upgrades

1. **Level-up selection** — 3 random options, equal weight, player picks 1
2. **Chest drops** — direct apply, no UI (boss/unique/elite)
3. **Per-level growth** — +0.5 HP and +0.5 DMG per level (automatic)

### Slot System

- 6 weapon slots + 6 passive slots (12 total)
- Each powerup: max level 5
- All slots full + all maxed → overflow heal boosts

### Level-Up Flow

```
ProgressionSystem.addXP() → threshold met
  → GameScene.levelUp()
     ├── heal + per-level stat modifiers
     ├── PowerUpOptionGenerator.generatePowerUpOptions()
     │    └── blueprintLoader.getAll('powerup') → filter → 3 picks
     └── centralEventBus.emit('game:levelup', options)
        → GameUIScene.showPowerUpSelection()
           ├── pause GameScene
           └── PowerUpUI.show(options)
              → player clicks card
                → centralEventBus.emit('game:powerup-selected')
                   → PowerUpSystem.applyPowerUp(id, level)
                      ├── _processModifiers()
                      ├── abilities.processAbilities()
                      └── _applyToPlayer()
                → resume GameScene
```

### Active Abilities (PowerUpAbilities)

| Ability | Module | Behavior |
|---------|--------|----------|
| radiotherapy | RadiotherapyEffect | Rotating damage beams |
| oxidative_burst | Inline (_startOxidativeBurst) | Fire-and-forget flame cone |
| shield | ShieldRegeneration | HP shield + regen timer |
| chain_lightning | ChainLightningAbility | Chain jump damage |
| orbital_antibodies | OrbitalAbility | Orbiting damage bodies |
| chemo_pool | ChemoPoolAbility | Damage zone orbit |
| antibody_boomerang | BoomerangAbility | Throw + return projectile |
| ricochet_cell | RicochetAbility | Bouncing diamond off walls |
| immune_aura | ImmuneAuraEffect | Garlic-style proximity damage |
| synaptic_pulse | Inline | Periodic AoE pulse |

---

## Loot System

### Drop Sources

```
Enemy death
├── XP orbs (per enemy xp, tier-based gem visual)
├── Per-enemy drops (blueprint.drops[], chance 0-1)
│   ├── health_small, protein_cache, heal_orb
│   ├── energy_cell (attack speed buff 10s)
│   ├── metotrexat (kill all), magnet (vacuum XP)
│   └── adrenaline_shot, mutation_catalyst, cell_membrane (permanent stats)
└── Chest drops (by enemy category)
    ├── Boss → Gold chest (100%) — 5 powerup upgrades
    ├── Unique → Silver chest (100%) — 3 powerup upgrades
    └── Elite → Bronze chest (50%) — 2 powerup upgrades
```

### Pickup Mechanics

Physics overlap (player ↔ lootGroup) → `handlePickup`:

| Effect Type | Action |
|-------------|--------|
| `xp` | `scene.addXP(value)` |
| `health`/`heal` | `player.heal(amount)` |
| `instant_kill_all` | Kill all enemies on screen |
| `vacuum_xp` | Tag all XP for magnet pull |
| `buff` | Temporary stat modifier (timed) |
| `permanent_stat` | Permanent stat modifier |
| `chest` | ChestHandler.open() — apply N powerup upgrades |

### Chest Upgrade Logic (ChestHandler)

- 70% chance: upgrade random owned powerup (+1 level)
- 30% chance: add new random powerup (if slots open)
- Fallback: heal 25 HP if all maxed

### XP Superorb

When field has 150+ active loot items, all new XP routes into a single pulsing red diamond that accumulates total XP.

---

## Collision Map (setupCollisions.js)

| Overlap | Objects | Effect |
|---------|---------|--------|
| Player ↔ Enemies | player, enemiesGroup | Contact damage (shield-aware) |
| Player ↔ Boss | player, bossGroup | Contact damage (shield-aware) |
| Player bullets ↔ Enemies | playerBullets, enemiesGroup | Bullet damage + piercing + on-hit |
| Player bullets ↔ Boss | playerBullets, bossGroup | Bullet damage + piercing + on-hit |
| Enemy bullets ↔ Player | player, enemyBullets | Projectile damage (shield intercept) |
| Player ↔ Loot | player, lootGroup | Pickup → effect dispatch |

All overlaps use `activeFilter = (a, b) => a.active && b.active` as processCallback.

---

## Event Communication

### CentralEventBus (cross-scene)

| Event | Emitter | Listener |
|-------|---------|----------|
| `game:levelup` | GameScene.levelUp() | GameUIScene → powerup UI |
| `game:powerup-selected` | GameUIScene | BootstrapManager → apply |
| `game:over` | GameOverSequence | GameUIScene → game over UI |
| `game:retry` | GameOverUI | BootstrapManager → restart |
| `game:main-menu` | GameOverUI | BootstrapManager → menu |
| `ui:pause-request` | KeyboardManager (ESC) | GameUIScene → pause |
| `ui:victory-show` | VictorySequence | GameUIScene → victory |
| `ui:level-transition-show` | TransitionManager | GameUIScene → transition |
| `ui:escape` | KeyboardManager | GameUIScene → toggle pause |
| `ui:menu-escape` | KeyboardManager | MainMenu |

### scene.events (intra-scene)

| Event | Emitter | Listener |
|-------|---------|----------|
| `player:die` | PlayerCombat.die() | BootstrapManager → gameOver() |
| `boss:die` | Boss.die() | BootstrapManager → transitionToNextLevel() |
| `boss:hp-update` | Boss.takeDamage() | GameUIScene → hud.setBossHealth() |
| `boss:show-hp` | EnemyManager.createBoss() | GameUIScene → hud.showBoss() |
| `boss:hide-hp` | Boss.die() | GameUIScene → hud.hideBoss() |
| `resume` | Phaser scene resume | BootstrapManager → flush pending XP |

---

## Shutdown & Restart

### Restart Flow

```
GameScene.restartGame()
  ├── _shutdownDone = false
  ├── scene.resume() if paused
  ├── scene.stop('GameUIScene')
  └── scene.restart()
       → Phaser emits 'shutdown' event
         → GameScene.shutdown()
```

### Shutdown Sequence

```
GameScene.shutdown()
  ├── spawnDirector.stop()
  ├── projectileSystem.clearAll()
  ├── enemiesGroup.clear(true, true)
  ├── bossGroup.clear(true, true)
  ├── physics.pause()
  ├── remove all _colliders from physics.world
  ├── disposables.disposeAll()
  ├── shutdown 12 systems
  ├── centralEventBus.removeAllListeners(this)
  ├── scale.off('resize', handler)
  ├── _gameTimerEvent.remove()
  ├── tweens.killAll()
  ├── time.removeAllEvents()
  └── null out 22 references
```

After restart: `init()` resets state → `preload()` → `create()` → full bootstrap again.

### GameUIScene Shutdown

```
GameUIScene.shutdown()
  ├── input.setTopOnly(false)
  ├── hud.destroy() → null
  ├── pauseUI.destroy() → null
  ├── powerUpUI.destroy() → null
  ├── gameOverUI.destroy() → null
  └── _removeEventListeners()
```

---

## Telemetry

### Time Fields

| Field | Source | Pauses? |
|-------|--------|---------|
| `t` | `Date.now() - sessionStart` (wall-clock ms) | No |
| `gt` | `sceneTimeSec` (game time seconds) | Yes |

### Key Telemetry Events

| Category | Events |
|----------|--------|
| `ui` | pause_show, pause_resume, powerup_show, powerup_card_clicked, powerup_resume, powerup_apply_error, gameover_show, victory_show, quit_to_menu |
| `powerup` | options_offered, selected, applied, ability_applied, apply_error |
| `loot` | enemy_drop, chest_dropped, chest_opened, chest_contents, magnet_used, permanent_stat |
| `boss` | spawn, death, damage_taken, ability_used, ability_execute, phase_transition |
| `spawn` | enemy, wave_spawned, wave_tick, elite_spawned, unique_spawned, boss |
| `kill` | enemy_died (with killer attribution) |
| `player` | take_damage, heal, death |
| `game` | level_up, level_transition |
| `perf` | snapshot (fps, enemies, loot, projectiles, heap), cleanup |
| `balance` | player_snapshot (10s intervals — level, hp, dmg, atkMs, speed, crit, kills, powerups) |

### Session Analysis

```bash
npm run analyze:session                    # Latest session
npm run analyze:session path/to/file.json  # Specific file
npm run analyze:session --all              # All sessions
```

---

## File Reference

| File | Role | LOC |
|------|------|-----|
| `js/scenes/GameScene.js` | Thin hub, state, lifecycle | ~420 |
| `js/scenes/GameUIScene.js` | Parallel UI overlay | ~270 |
| `js/managers/BootstrapManager.js` | 12-phase init orchestrator | ~400 |
| `js/managers/SystemsInitializer.js` | Creates systems in order | ~100 |
| `js/managers/UpdateManager.js` | Phased update loop | ~310 |
| `js/managers/EnemyManager.js` | Enemy/boss spawn + death | ~380 |
| `js/managers/TransitionManager.js` | Victory/defeat/level API | ~250 |
| `js/entities/Player.js` | Thin composer | ~240 |
| `js/entities/Enemy.js` | Thin composer | ~100 |
| `js/entities/core/EnemyCore.js` | Phaser sprite + capabilities | ~470 |
| `js/entities/EnemyBehaviors.js` | Multi-layer AI | ~300 |
| `js/entities/Boss.js` | Thin composer + AI decision | ~360 |
| `js/entities/boss/BossCore.js` | Capability interface | ~150 |
| `js/entities/boss/BossPhases.js` | HP threshold transitions | ~490 |
| `js/entities/boss/BossAbilities.js` | Ability dispatch | ~260 |
| `js/core/systems/ProjectileSystem.js` | Pool-based projectiles | ~290 |
| `js/core/systems/SimpleLootSystem.js` | Drops, pickups, magnet | ~460 |
| `js/core/systems/loot/ChestHandler.js` | VS-style chest upgrades | ~130 |
| `js/core/systems/powerup/PowerUpSystem.js` | Powerup orchestrator | ~340 |
| `js/core/systems/powerup/PowerUpAbilities.js` | Active ability manager | ~470 |
| `js/core/spawn/SpawnDirector.js` | Delta-time wave spawning | ~390 |
| `js/handlers/setupCollisions.js` | All physics overlaps | ~280 |
| `js/core/events/CentralEventBus.js` | Cross-scene events | ~95 |

---

*Rakovinobijec v0.9.49 | Phaser 3.90.0 | Last updated: 2026-04-06*
