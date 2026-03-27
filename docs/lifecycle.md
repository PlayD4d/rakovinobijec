# Game Lifecycle Documentation

## Overview
This document describes the lifecycle of the Rakovinobijec game, including initialization, game flow, and cleanup processes.

## 🚀 Initialization Flow

### 1. Scene Creation (GameScene.create)
```
GameScene.create()
├── BootstrapManager.bootstrap()
│   ├── Phase 1: Core Systems
│   │   ├── DisposableRegistry
│   │   ├── UpdateManager
│   │   └── TransitionManager
│   ├── Phase 2: Data & Config
│   │   ├── BlueprintLoader
│   │   └── ConfigResolver
│   ├── Phase 3: Game Systems
│   │   ├── SystemsInitializer.initializeSystems()
│   │   │   ├── GraphicsFactory
│   │   │   ├── AudioSystem
│   │   │   ├── VFXSystem
│   │   │   ├── ProjectileSystem
│   │   │   ├── SimpleLootSystem
│   │   │   ├── PowerUpSystem
│   │   │   ├── PlayerFactory
│   │   │   ├── EnemyManager
│   │   │   └── SpawnDirector
│   │   └── setupCollisions()
│   ├── Phase 4: Player & HUD
│   │   ├── createPlayer()
│   │   └── UnifiedHUD
│   └── Phase 5: Start Game
│       └── spawnDirector.start()
```

### 2. BootstrapManager vs SystemsInitializer

#### Rozdělení zodpovědností

**BootstrapManager** (Orchestrátor)
- **Vlastní**: Celkový bootstrap flow
- **Zodpovědnost**: Správné pořadí inicializace
- **Volá**: SystemsInitializer, setup metody
- **Neděla**: Žádnou konkrétní inicializaci

**SystemsInitializer** (Implementátor)
- **Vlastní**: Konkrétní systémy
- **Zodpovědnost**: Data-driven setup
- **Vytváří**: Factories, Systems, Managers
- **Neděla**: Orchestraci nebo pořadí

```javascript
// BootstrapManager - ORCHESTRÁTOR
class BootstrapManager {
    bootstrap() {
        // Phase 1: Core
        this.initializeCore();     // DisposableRegistry, UpdateManager
        
        // Phase 2: Data
        this.loadData();           // Blueprints, Config
        
        // Phase 3: Systems - DELEGUJE!
        this.systemsInitializer = new SystemsInitializer(this.scene);
        this.systemsInitializer.initializeSystems();
        
        // Phase 4: Game
        this.setupGame();          // Player, HUD
    }
}

// SystemsInitializer - IMPLEMENTÁTOR
class SystemsInitializer {
    initializeSystems() {
        // Vytváří konkrétní systémy
        this.scene.graphicsFactory = new GraphicsFactory(this.scene);
        this.scene.audioSystem = new AudioSystem(this.scene);
        this.scene.vfxSystem = new VFXSystem(this.scene);
        // ...
    }
}
```

#### Co který systém dělá

The SystemsInitializer is responsible for setting up all data-driven systems:

- **GraphicsFactory**: Texture generation with pooling
- **AudioSystem**: SFX and music management
- **VFXSystem**: Visual effects with presets
- **ProjectileSystem**: Projectile pooling and management
- **SimpleLootSystem**: Drop system with animations
- **PowerUpSystem**: Power-up management
- **PlayerFactory**: Player blueprint creation
- **EnemyManager**: Enemy spawning and lifecycle
- **SpawnDirector**: Wave-based enemy spawning

## 🎮 Game Flow

### Update Loop (managed by UpdateManager)
```
UpdateManager.update(time, delta)
├── Phase 1: Input & Player
│   ├── handleInput()
│   └── player.update()
├── Phase 2: AI & Enemies
│   ├── spawnDirector.update()
│   └── enemies.update()
├── Phase 3: Systems
│   ├── projectileSystem.update()
│   ├── lootSystem.update()
│   └── vfxSystem.update()
└── Phase 4: UI
    └── unifiedHUD.update()
```

### Transition Management
TransitionManager handles all game state transitions:

#### Victory Flow
```
Player defeats boss
    ↓
BossSystem.onBossDeath()
    ↓
TransitionManager.showVictory()
    ├── Check re-entrancy guard
    ├── Log telemetry event
    ├── Pause physics
    ↓
game.events.emit('ui:victory:show')
    ↓
GameUIScene.showVictoryModal()
    ├── Display score/stats
    ├── Show continue button
    ↓
User clicks continue
    ↓
scene.events.emit('victory:continue')
    ↓
TransitionManager.transitionToNextLevel()
    ├── Clear all enemies
    ├── Reset player position
    ├── Load next spawn table
    └── Resume physics
```

#### Game Over Flow
```
Player HP reaches 0
    ↓
Player.die()
    ↓
TransitionManager.gameOver()
    ├── Check re-entrancy guard
    ├── Log telemetry event
    ├── Stop spawn director
    ↓
game.events.emit('ui:gameover:show')
    ↓
GameUIScene.showGameOverModal()
    ├── Display final score
    ├── Show retry/menu buttons
    ↓
User clicks retry
    ↓
scene.events.emit('gameover:retry')
    ↓
TransitionManager.restartGame()
    ├── Full cleanup
    ├── Reset all systems
    └── Restart from level 1
```

#### Power-Up Selection Flow
```
Player levels up
    ↓
ExperienceSystem.onLevelUp()
    ↓
TransitionManager.pauseForPowerUp()
    ├── Pause game physics
    ├── Generate 3 random power-ups
    ↓
game.events.emit('ui:powerup:show', options)
    ↓
GameUIScene.showPowerUpSelection()
    ├── Display 3 cards
    ├── Block game input
    ↓
User selects power-up
    ↓
scene.events.emit('powerup:selected', choice)
    ↓
PowerUpSystem.applyPowerUp(choice)
    ↓
TransitionManager.resumeFromPowerUp()
    └── Resume physics
```

#### Level Transition Flow
```
Level completion trigger
    ↓
SpawnDirector.onLevelComplete()
    ↓
TransitionManager.transitionToNextLevel()
    ├── Fade out current level
    ├── Clear all entities
    ↓
game.events.emit('ui:level-transition:show')
    ↓
GameUIScene.showLevelTransition()
    ├── "Level 2" text
    ├── Brief pause
    ↓
Auto-continue after 2s
    ↓
scene.events.emit('level:ready')
    ↓
SpawnDirector.loadNextLevel()
    ├── Load new spawn table
    ├── Reset difficulty scaling
    └── Begin spawning
```

Each transition includes:
1. Re-entrancy guards to prevent duplicate transitions
2. Telemetry logging for analytics
3. Clean event-based communication with UI scene
4. Deterministic cleanup order

## 🧹 Cleanup & Resource Management

### DisposableRegistry
Central registry for all disposable resources:

```javascript
// Usage
disposableRegistry.add(timer);
disposableRegistry.trackListener(target, 'event', fn);
disposableRegistry.trackTimer(scene, 1000, callback);
disposableRegistry.trackEmitter(particleEmitter);

// Cleanup
disposableRegistry.disposeAll(); // Called in shutdown()
```

### Shutdown Sequence (GameScene.shutdown)
```
GameScene.shutdown()
├── disposableRegistry.disposeAll()
├── updateManager.shutdown()
├── transitionManager.shutdown()
├── enemyManager.shutdown()
├── projectileSystem.clearAll()
├── lootSystem.clearAll()
├── vfxSystem.shutdown()
├── audioSystem.shutdown()
└── Clear all references
```

## 📜 UI Event Contract

The UI system uses a strict event contract for communication:

### Event Flow
- **GameScene → GameUIScene**: Via game.events
- **GameUIScene → GameScene**: Via scene events

### Standard Events
```javascript
UI_EVENTS = {
    LEVEL_TRANSITION_SHOW: 'ui:level-transition:show',
    VICTORY_SHOW: 'ui:victory:show',
    GAMEOVER_SHOW: 'ui:gameover:show',
    PAUSE_SHOW: 'ui:pause:show',
    POWERUP_SHOW: 'ui:powerup:show'
}
```

### Input Isolation
When UI overlays are shown:
1. GameUIScene calls `setTopOnly(true)`
2. Overlay container is set interactive
3. GameScene physics are paused
4. Input events don't propagate to game layer

## 🔒 Ownership Rules

### Who Owns What

**BootstrapManager**:
- Initial scene setup
- System initialization order
- Phase-based bootstrapping

**SystemsInitializer**:
- Data-driven system creation
- Blueprint and registry loading
- Factory callback setup

**UpdateManager**:
- Update loop orchestration
- Phase-based update priority
- Performance monitoring

**TransitionManager**:
- Victory/defeat handling
- Level transitions
- Analytics event logging
- May call: clearAllEnemies(), UI events

**EnemyManager**:
- Enemy/boss spawning
- Enemy lifecycle management
- Active count tracking

**DisposableRegistry**:
- Resource tracking
- Unified cleanup
- Memory leak prevention

## 🚨 Important Rules

1. **No Direct Phaser API in GameScene**
   - No `this.add.*`, `this.physics.add.*`, `this.tweens.add`
   - Use appropriate managers/systems instead

2. **UI Supremacy**
   - All UI elements in GameUIScene
   - GameUIScene always on top via `bringToTop()`
   - Input isolation via `setTopOnly(true)`

3. **Data-Driven Everything**
   - All constants from ConfigResolver
   - All entities from BlueprintLoader
   - No hardcoded gameplay values

4. **Clean Separation**
   - GameScene: Game logic only
   - GameUIScene: UI/overlays only
   - Managers: Specific responsibilities
   - Systems: Reusable functionality

## 📊 Telemetry Points

Key events logged by TransitionManager:
- `victory_start`: Victory sequence begins
- `gameover_start`: Game over sequence begins
- `level_transition_start`: Level transition begins
- `*_blocked`: When transition blocked by re-entrancy guard

Access history: `transitionManager.getTransitionHistory()`

## 🔍 Debugging

### Check System Health
```javascript
// In browser console
__framework.healthcheck()
enemyManager.getStats()
disposableRegistry.getStats()
transitionManager.getTransitionHistory()
```

### Memory Leak Detection
```javascript
// Run leak test
DEV.killAll()
// Check counts
enemyManager.getActiveCount() // Should be 0
projectileSystem.getActiveCount() // Should be 0
```

### Guard Validation
```bash
npm run guard:check       # Check GameScene
npm run guard:check-all   # Check all files
npm run guard:phaser      # Check Phaser API usage
```