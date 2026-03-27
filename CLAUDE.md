# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
npm run test:golden-path # Test golden path scenarios
npm run test:leak        # Memory leak testing
npm run validate:blueprints # Validate all blueprint files
```

### Guard Rules & Architecture Checks
```bash
npm run guard:check      # Check GameScene guard rules
npm run guard:check-all  # Check all architectural guard rules
npm run guard:phaser     # Check for prohibited Phaser API usage
./dev/refactor/check_guards.sh # Manual guard check script
```

### CI & Build
```bash
npm run ci:full          # Complete CI run
npm run ci:full:verbose  # CI with detailed output
npm run ci:quick         # Quick CI check (guards + smoke)
npm run prebuild         # Pre-build tasks (generate audio manifest)
```

### Data & Content Management
```bash
npm run rebuild:index    # Rebuild registry index
npm run fix:i18n         # Fix missing i18n keys
npm run check:orphans    # Check for orphaned files
npm run generate:audio   # Generate audio manifest
```

### Analytics & Telemetry
```bash
npm run analyze:latest   # Analyze latest telemetry session
npm run analyze:pattern  # Pattern analysis
npm run analyze:aggregate # Aggregate pattern analysis
npm run analyze:verbose  # Verbose analysis with HTML output
npm run compare:runs     # Compare telemetry runs
npm run validate:telemetry # Validate telemetry analyzer
```

## High-Level Architecture

### Core Principles (PR7 Compliance)
- **100% Data-Driven**: All gameplay constants, entities, and systems read from blueprint data
- **Single Source of Truth**: ConfigResolver is the only way to resolve gameplay values
- **No Legacy Code**: No hardcoded constants, no feature flags for old systems
- **Modern Systems Only**: BlueprintLoader, SpawnDirector, ProjectileSystem, VFXSystem
- **No Direct Engine Calls**: No `scene.add.*` or `scene.sound.play` in gameplay logic

### Architectural Patterns

#### 1. Capability-based Design
Separates Phaser API from business logic:
- **Core classes** provide capability interface (e.g., `EnemyCore`)
- **Behaviors** are pure functions without side-effects
- **No direct Phaser API calls** in behaviors
- Communication only through capability methods

#### 2. Thin Composer Pattern
Main classes are thin orchestrators:
- **Minimal logic** - only compose components
- **Delegate to specialized modules** - each has single responsibility
- **Clean public interface** - hides internal complexity
- Files must be **< 500 LOC** (enforced by guard rules)

#### 3. DisposableRegistry Pattern
Automatic resource management:
- **Automatic cleanup** of timers and event listeners
- **Memory leak prevention**
- **Centralized management** of disposable resources

### System Layers

1. **GameScene** (Thin Hub)
   - NO direct Phaser API work
   - Only delegates to managers and systems
   - Event-based communication with UI

2. **Managers** (Orchestrators)
   - UpdateManager: Update loop orchestration
   - TransitionManager: Victory/defeat/level transitions
   - BootstrapManager: Scene initialization
   - EnemyManager: Enemy lifecycle

3. **Systems** (Implementors)
   - ProjectileSystem: Projectiles + pooling
   - SimpleLootSystem: Loot drops + animations
   - PowerUpSystem: Power-up management
   - GraphicsFactory: Texture generation with pooling
   - AudioSystem: SFX/music management
   - VFXSystem: Visual effects with presets

4. **UI Layer** (GameUIScene)
   - ALL UI elements and modals
   - RexUI for components
   - CentralEventBus for events
   - Input isolation with `setTopOnly(true)`

5. **Data Layer**
   - BlueprintLoader: Loads JSON5 blueprints
   - ConfigResolver: Runtime configuration
   - All entities defined in `/data/blueprints/`

### File Structure
```
/data/blueprints/
├── enemy/           # Enemy definitions
├── boss/            # Boss definitions
├── powerup/         # Power-up definitions
├── projectile/      # Projectile definitions
├── spawn/           # Level spawn tables
├── items/           # Loot items (xp, health, special)
├── unique/          # Unique/rare enemies
├── elite/           # Elite enemy variants
└── templates/       # Templates for quick creation

/js/
├── core/            # Core systems (audio, vfx, spawn, etc.)
├── entities/        # Game entities (Player, Enemy, Boss)
│   ├── ai/behaviors/ # Pure function behaviors
│   ├── core/        # Phaser integration (EnemyCore)
│   └── boss/        # Boss-specific components
├── managers/        # High-level orchestrators
├── scenes/          # Phaser scenes (GameScene, GameUIScene, MainMenu)
└── ui/              # UI components
```

### Important Rules & Anti-patterns

#### ❌ PROHIBITED
- Files larger than 500 LOC without approved exception
- Circular dependencies between modules
- Phaser API calls in pure functions/behaviors
- Direct `scene.add.graphics()` - use GraphicsFactory
- Hardcoded gameplay constants
- Global mutable state
- Monolithic files (split using Thin Composer)

#### ✅ REQUIRED
- All gameplay values in blueprints
- Capability interface for Phaser abstraction
- Pure functions for AI behaviors
- DisposableRegistry for resource cleanup
- DEPTH_LAYERS constants (no magic numbers)
- Event-based scene communication
- Input isolation for UI overlays

### Blueprint Naming Conventions
```
enemy.viral_swarm       # Common enemy
elite.tank_cell         # Elite variant
unique.golden_cell      # Unique/rare
boss.radiation_core     # Boss
powerup.damage_boost    # Power-up
projectile.player_basic # Projectile
vfx.explosion.small     # Visual effect
sfx.enemy.spawn         # Sound effect (or direct path: "sound/enemy_spawn.mp3")
```

### Development Console (DEV)
```javascript
// In browser console
DEV.spawnEnemy("enemy.viral_swarm")     // Spawn enemy
DEV.spawnBoss("boss.radiation_core")    // Spawn boss
DEV.killAll()                            // Kill all enemies
DEV.heal(100)                            // Heal player
DEV.givePowerUp("powerup.damage_boost") // Give power-up
DEV.levelUp()                            // Force level up
DEV.toggleDebug('sfx')                   // Toggle debug logging

// Framework diagnostics
__framework.healthcheck()                // Complete health check
__framework.quickCheck()                 // Quick validation
__framework.smokeTest()                  // Run smoke test
```

## Core Documentation
- Architecture overview: @docs/ARCHITECTURE.md
- Code standards and conventions: @docs/CODE_STANDARDS.md
- Developer guide: @docs/DEVELOPER_GUIDE.md
- PR7 guidelines and rules: @docs/DEV_GUIDELINES.md
- Phaser 3 best practices: @docs/PHASER_BEST_PRACTICES.md
- Game lifecycle documentation: @docs/lifecycle.md
- Documentation index: @docs/README.md

