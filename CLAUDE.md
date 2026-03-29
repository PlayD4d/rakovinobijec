# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Rakovinobijec — 2D top-down survival shooter built on **Phaser 3.90.0** (loaded from CDN).
100% data-driven architecture (PR7). All gameplay values in JSON5 blueprints.

## Commands

### Development
```bash
npm run dev              # Development server with hot-reload (port 8000)
npm run serve            # Simple Python HTTP server
npm run serve-alt        # Alternative server using npx serve
```

### Testing & Validation
```bash
npm run audit:data       # Validate all blueprints and registry
npm run audit:data:strict # Strict validation with i18n checks
npm run smoke:test       # Run smoke tests
npm run verify:all       # Complete verification (audit + smoke)
npm run guard:check      # Check GameScene guard rules
npm run guard:check-all  # Check all architectural guard rules
npm run guard:phaser     # Check for prohibited Phaser API usage
npm run ci:quick         # Quick CI (guards + smoke)
npm run ci:full          # Complete CI run
```

### Data & Analytics
```bash
npm run rebuild:index    # Rebuild registry index
npm run fix:i18n         # Fix missing i18n keys
npm run analyze:latest   # Analyze latest telemetry session
```

## Architecture

### Layers
1. **GameScene** — Thin hub, NO direct Phaser API. Delegates to managers/systems.
2. **Managers** — UpdateManager, TransitionManager, BootstrapManager, EnemyManager
3. **Systems** — ProjectileSystem, SimpleLootSystem, PowerUpSystem, VFXSystem, AudioSystem, GraphicsFactory
4. **UI** — GameUIScene (all UI elements, modals, RexUI). Input isolation via `setTopOnly(true)`.
5. **Data** — BlueprintLoader + ConfigResolver. All entities in `/data/blueprints/`.

### Event System (2 systems only)
- **`scene.events`** — Intra-scene lifecycle (auto-cleaned by Phaser on shutdown)
- **`CentralEventBus`** — Cross-scene communication (standalone `Phaser.Events.EventEmitter` singleton)
- **NEVER use `game.events`** — risk of name collision with Phaser internals

Cross-scene events: `ui:pause-request`, `game:levelup`, `game:over`, `game:powerup-selected`, `ui:victory-show`, `ui:level-transition-show`

### Patterns
- **Capability-based Design**: EnemyCore provides capabilities, behaviors are pure functions
- **Thin Composer**: Main classes < 100 LOC, delegate to specialized modules
- **DisposableRegistry**: Automatic cleanup of timers, listeners, tweens
- **Files < 500 LOC** (enforced by guard rules)

### Phaser 3.90 Key Rules
- **Object pooling**: `group.get(x, y, key)` auto-revives dead sprites
- **getChildren() iteration**: NEVER `forEach + destroy`. Use reverse for-loop.
- **Overlap vs Collider**: Overlap = sensor (damage/pickup), Collider = physics push
- **Shield hitbox**: Separate invisible sprite with circular body + `physics.add.overlap`
- **Tweens**: `persist` defaults to `false` (3.80+) — completed tweens auto-destroy
- **generateTexture()**: Create from Graphics, release Graphics to pool
- Full reference: `docs/PHASER_390_REFERENCE.md`

### File Structure
```
/data/blueprints/
├── enemy/       boss/       elite/       unique/
├── powerup/     projectile/ spawn/       items/
└── templates/   system/

/js/
├── core/        # Systems (audio, vfx, spawn, events, projectiles, loot)
├── entities/    # Player, Enemy, Boss (core/, ai/behaviors/, boss/, player/)
├── managers/    # Orchestrators (Update, Bootstrap, Transition, Enemy)
├── handlers/    # setupCollisions.js
├── scenes/      # GameScene, GameUIScene, MainMenu
└── ui/          # UI components (lite/, UnifiedHUD)
```

### PROHIBITED
- Files > 500 LOC
- Phaser API in behaviors/pure functions
- Direct `scene.add.graphics()` — use GraphicsFactory
- Direct `scene.sound.play()` — use AudioSystem
- Direct `scene.add.particles()` — use VFXSystem
- `game.events` for cross-scene communication
- Hardcoded gameplay constants
- `forEach + destroy` on group children (use reverse for-loop)

### REQUIRED
- All gameplay values in blueprints
- `DEPTH_LAYERS` constants (no magic numbers)
- Collisions only in `setupCollisions.js`
- Event listeners cleaned up in shutdown
- `centralEventBus.removeAllListeners(this)` on scene shutdown
- Always bump `package.json` version with version-tagged commits

### Blueprint Naming
```
enemy.viral_swarm       boss.radiation_core     elite.tank_cell
unique.golden_cell      powerup.damage_boost    projectile.player_basic
```

### DEV Console
```javascript
DEV.spawnEnemy("enemy.viral_swarm")     DEV.spawnBoss("boss.radiation_core")
DEV.killAll()     DEV.heal(100)     DEV.levelUp()     DEV.exportSession()
__framework.healthcheck()     __framework.quickCheck()
```

### Game Progression (7 Levels)
| Level | Boss | HP |
|-------|------|----|
| 1 | radiation_core | 1200 |
| 2 | onkogen | 1050 |
| 3 | karcinogenni_kral | 1050 |
| 4 | genova_mutace | 1200 |
| 5 | onkogen_prime | 2100 |
| 6 | radiation | 1800 |
| 7 | chemorezistence (FINAL) | 2700 |

## Documentation
- Architecture: @docs/ARCHITECTURE.md
- Dev guidelines: @docs/DEV_GUIDELINES.md
- Phaser 3.90 reference: @docs/PHASER_390_REFERENCE.md
- Game lifecycle: @docs/lifecycle.md
- Code standards: @docs/CODE_STANDARDS.md
- Developer guide: @docs/DEVELOPER_GUIDE.md
