# Dev Guidelines — Rakovinobijec v0.5.86+ (Phaser 3.90)

## Core Principles
- **100% Data-Driven**: All gameplay values in blueprints, resolved via ConfigResolver
- **No Hardcoded Constants**: Stats, timing, visuals — everything from data
- **Phaser Abstraction**: No direct `scene.add.*`, `scene.sound.*` in gameplay logic
- **< 500 LOC per file**: Enforced by guard rules, use Thin Composer pattern
- **Capability-based AI**: Pure function behaviors, no Phaser API in AI code

## Systems (Current State)

| System | File | Purpose |
|--------|------|---------|
| **BlueprintLoader** | `js/core/data/BlueprintLoader.js` | Loads JSON5 blueprints from `/data/blueprints/` |
| **ConfigResolver** | `window.ConfigResolver` | Runtime config with fallback rules |
| **SpawnDirector** | `js/core/spawn/SpawnDirector.js` | Wave-based enemy spawning from spawn tables |
| **ProjectileSystem** | `js/core/systems/ProjectileSystem.js` | Player & enemy projectiles with Phaser group pooling |
| **SimpleLootSystem** | `js/core/systems/SimpleLootSystem.js` | Loot drops, XP orbs, magnet, merging |
| **PowerUpSystem** | `js/core/systems/powerup/PowerUpSystem.js` | Power-up management and abilities |
| **GraphicsFactory** | `js/core/graphics/GraphicsFactory.js` | Texture generation with Graphics pooling |
| **SimplifiedAudioSystem** | `js/core/audio/SimplifiedAudioSystem.js` | SFX/music (direct file paths) |
| **VFXSystem** | `js/core/vfx/VFXSystem.js` | Visual effects (particles, telegraphs, beams) |
| **EnemyManager** | `js/managers/EnemyManager.js` | Enemy/boss spawning and lifecycle |
| **UpdateManager** | `js/managers/UpdateManager.js` | Phased update loop orchestration |
| **TransitionManager** | `js/managers/TransitionManager.js` | Victory/defeat/level transitions |
| **BootstrapManager** | `js/managers/BootstrapManager.js` | Scene initialization (12 phases) |
| **CentralEventBus** | `js/core/events/CentralEventBus.js` | Cross-scene events (standalone Phaser EventEmitter) |

## Event Architecture

Two event systems only:
1. **`scene.events`** — Intra-scene lifecycle (auto-managed by Phaser on shutdown)
2. **`CentralEventBus`** — Cross-scene communication (standalone Phaser.Events.EventEmitter singleton)

**Never use `game.events`** — risk of name collision with Phaser internal events.

Cross-scene event names use `namespace:event` format:
```
ui:pause-request, game:levelup, game:over, game:powerup-selected,
ui:victory-show, ui:level-transition-show, ui:escape, ui:menu-escape
```

Cleanup: `centralEventBus.removeAllListeners(this)` in scene shutdown.

## Phaser 3.90 Patterns

See full reference: `docs/PHASER_390_REFERENCE.md`

Key rules:
- **Object pooling**: Use `group.get(x, y, key)` — auto-revives dead members
- **Body disable**: `setActive(false).setVisible(false)` + `body.enable = false`
- **getChildren() iteration**: NEVER destroy/remove during `forEach`. Use reverse for-loop.
- **Overlap vs Collider**: Overlap = sensor (damage), Collider = physics push
- **Shield physics**: Separate invisible hitbox sprite with circular body + `physics.add.overlap`
- **generateTexture()**: Create from Graphics object, then release Graphics to pool
- **Tweens**: `persist` defaults to `false` since Phaser 3.80 — completed tweens auto-destroy

## Content Creation (Quick Reference)

### Add Enemy
1. Create `data/blueprints/enemy/enemy.my_enemy.json5`
2. Register in `data/registries/index.json`
3. Add to spawn table `data/blueprints/spawn/levelN.json5`
4. Test: `DEV.spawnEnemy("enemy.my_enemy")`

### Add Boss
1. Create `data/blueprints/boss/boss.my_boss.json5` (phases, abilities)
2. Register in `data/registries/index.json`
3. Add boss trigger to spawn table
4. Test: `DEV.spawnBoss("boss.my_boss")`

### SFX (Direct File Paths — Recommended)
```json5
sfx: { spawn: "sound/npc_spawn.mp3", hit: "sound/npc_hit.mp3", death: "sound/npc_death.mp3" }
```

### VFX (Registry IDs)
```json5
vfx: { spawn: "vfx.enemy.spawn.default", hit: "vfx.hit.spark.small", death: "vfx.enemy.death.burst" }
```

## DO / DON'T

| DO | DON'T |
|----|-------|
| `graphicsFactory.create()` | `scene.add.graphics()` |
| `vfxSystem.play(id, x, y)` | `scene.add.particles()` |
| `audioSystem.play(path)` | `scene.sound.play()` |
| `lootGroup.get(x, y, key)` | `scene.physics.add.sprite()` for loot |
| `centralEventBus.emit('game:over')` | `game.events.emit('game-over')` |
| `scene.events.on('shutdown', cleanup)` | Forget to clean up listeners |
| Collisions in `setupCollisions.js` | `physics.add.overlap()` anywhere else |
| `DEPTH_LAYERS.ENEMIES` | Magic number `1000` |
| Reverse for-loop for group cleanup | `forEach + destroy` (corrupts iteration) |

## Validation Commands
```bash
npm run guard:check-all   # Architecture guard rules
npm run audit:data        # Blueprint validation
npm run smoke:test        # Smoke test
npm run ci:quick          # Guards + smoke (fast CI)
```

## Session Logging
All game events logged via `getSession()?.log(category, action, data)`.
Export: `DEV.exportSession()` in browser console.
Analyze: `node scripts/analyze-session.mjs session.json --full`
