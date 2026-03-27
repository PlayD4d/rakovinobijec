# 🤖 Automated Testing System

## Overview

The Rakovinobijec Automated Testing System provides comprehensive programmatic testing of gameplay mechanics, NPC behavior, power-up systems, boss fights, and performance characteristics. It includes a bot player that can autonomously play the game while detecting errors and validating game systems.

---

## 🚀 Quick Start

### Browser Console (In-Game)

```javascript
// Initialize testing system
await __framework.testing.init()

// Start bot player
DEV.test.bot()

// Run specific test scenario
DEV.test.core()     // Basic gameplay
DEV.test.enemy()    // Enemy AI behaviors
DEV.test.boss()     // Boss mechanics
DEV.test.powerup()  // Power-up combinations
DEV.test.stress()   // Performance stress tests

// Run all tests
DEV.test.all()

// Stop bot
DEV.test.stop()

// Get report
DEV.test.report()
```

### Command Line

```bash
# Run all automated tests
npm run test:automated

# Run specific scenario
npm run test:automated -- -s CoreGameplay

# Verbose output
npm run test:automated:verbose

# Show help
npm run test:automated -- -h
```

---

## 🎮 Bot Player

The bot player (`GameplayAutomation`) is an AI-controlled player that can:

### Movement Patterns

- **aggressive** - Moves directly toward nearest enemy
- **defensive** - Maintains distance, focuses on dodging
- **circle** - Circular strafing pattern
- **random** - Random movement for coverage testing

### Target Priority

- **nearest** - Targets closest enemy
- **strongest** - Targets highest HP enemy
- **weakest** - Targets lowest HP enemy
- **boss** - Prioritizes boss enemies

### Configuration

```javascript
// Custom bot configuration
DEV.test.bot({
    movementPattern: 'aggressive',
    targetPriority: 'nearest',
    dodgeProjectiles: true,
    collectLoot: true,
    useAbilities: true,
    reactionTime: 100,      // ms delay for reactions
    aimAccuracy: 0.9        // 0-1, perfect aim = 1
})
```

---

## 🧪 Test Scenarios

### CoreGameplay
Tests fundamental game mechanics:
- Player initialization and movement
- Enemy spawning
- Combat mechanics
- Loot collection
- Level progression
- VFX/SFX systems
- Blueprint validation
- Performance baseline

### EnemyBehaviors
Validates enemy AI states:
- Idle behavior
- Chase mechanics
- Flee patterns
- Orbit movement
- Patrol routes
- Shooting behavior
- State transitions
- Group coordination

### BossFights
Tests boss-specific mechanics:
- Boss spawning
- Phase transitions
- Ability usage
- Defeat conditions
- Victory triggers

### PowerUpCombos
Validates power-up system:
- Single power-up application
- Stacking mechanics
- Multiple type combinations
- Combat effectiveness

### EdgeCases
Stress tests and boundary conditions:
- Mass enemy spawning (50+ enemies)
- Projectile spam testing
- Rapid spawn/kill cycles
- Memory leak detection
- Player death handling
- Invalid input handling
- Boundary collision
- Performance monitoring

---

## 🔍 Error Detection

The `ErrorDetector` class monitors for:

### JavaScript Errors
- Uncaught exceptions
- Promise rejections
- Type errors
- Reference errors

### Console Warnings
- Console errors
- Console warnings
- Assert failures

### Phaser Framework
- Scene errors
- Physics errors
- Asset loading failures
- Render errors

### Blueprint Issues
- Missing blueprints
- Invalid configurations
- Schema violations

### Performance Problems
- FPS drops below threshold
- Long frame times
- Memory growth
- Render bottlenecks

### State Inconsistencies
- Invalid player state
- Enemy count mismatches
- Resource leaks

---

## 📊 Reports and Metrics

### Automation Report
```javascript
const report = __framework.testing.getReport()
// Returns:
{
    metrics: {
        framesProcessed: 1234,
        actionsPerformed: 567,
        enemiesKilled: 89,
        damageDealt: 4567,
        damageTaken: 234,
        lootCollected: 45,
        powerUpsActivated: 3
    },
    performance: {
        avgFPS: 58.2,
        minFPS: 45,
        maxFPS: 60,
        frameDrops: 3
    },
    events: [...],  // Timestamped game events
    errors: [...]   // Detected errors
}
```

### Scenario Report
Each test scenario generates:
```javascript
{
    scenario: {
        name: "CoreGameplay",
        status: "passed",  // passed/failed/error
        duration: 45678,    // ms
        timestamp: "2024-01-15T10:30:00Z"
    },
    steps: [
        {
            name: "Player Initialization",
            status: "passed",
            duration: 234,
            result: { playerFound: true, hp: 100 }
        }
        // ... more steps
    ],
    summary: {
        totalSteps: 10,
        passed: 9,
        failed: 1,
        error: 0
    },
    errors: null  // Error detection report if available
}
```

---

## 🛠️ Advanced Usage

### Custom Scenarios

Create your own test scenario:

```javascript
import { BaseScenario } from './BaseScenario.js';

export class CustomScenario extends BaseScenario {
    constructor() {
        super('CustomScenario', 'Description');
        this.setupSteps();
    }
    
    setupSteps() {
        // Add test steps
        this.addStep(
            'Step Name',
            async (automation) => {
                // Test logic
                await this.spawnEnemy(automation, 'enemy.viral_swarm');
                await this.wait(1000);
                
                return { success: true };
            },
            async (automation, result) => {
                // Validation
                return result.success === true;
            }
        );
    }
}
```

### Performance Profiling

```javascript
// Start profiling
const automation = new GameplayAutomation(scene);
automation.startProfiling();

// Run test
automation.enabled = true;
await wait(60000);  // 1 minute

// Get profile
const profile = automation.getPerformanceProfile();
console.log('Avg FPS:', profile.avgFPS);
console.log('Frame drops:', profile.frameDrops);
```

### Memory Leak Detection

```javascript
// Run memory leak test
async function memoryLeakTest() {
    const before = performance.memory.usedJSHeapSize;
    
    // Spawn and kill many enemies
    for (let i = 0; i < 100; i++) {
        DEV.spawnEnemy("enemy.viral_swarm");
    }
    await wait(1000);
    DEV.killAll();
    await wait(1000);
    
    const after = performance.memory.usedJSHeapSize;
    const leak = (after - before) / 1024 / 1024;  // MB
    
    console.log(`Memory growth: ${leak.toFixed(2)} MB`);
    return leak < 10;  // Pass if less than 10MB growth
}
```

---

## 🔧 Integration with CI/CD

### GitHub Actions Example

```yaml
name: Automated Gameplay Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run automated tests
        run: npm run test:automated
        
      - name: Upload test reports
        uses: actions/upload-artifact@v2
        with:
          name: test-reports
          path: build/test-reports/
```

### Headless Testing

For CI environments without display:

```bash
# Install virtual display
sudo apt-get install xvfb

# Run tests with virtual display
xvfb-run -a npm run test:automated
```

---

## 📋 Test Commands Reference

### Framework Testing API

| Command | Description |
|---------|-------------|
| `__framework.testing.init()` | Initialize testing system |
| `__framework.testing.startBot(config)` | Start bot with config |
| `__framework.testing.stopBot()` | Stop bot player |
| `__framework.testing.getReport()` | Get automation report |
| `__framework.testing.runScenario(name)` | Run specific scenario |
| `__framework.testing.getErrors()` | Get error detection report |
| `__framework.testing.clearErrors()` | Clear error detector |

### DEV Test Commands

| Command | Description |
|---------|-------------|
| `DEV.test.bot(pattern)` | Start bot with movement pattern |
| `DEV.test.stop()` | Stop bot |
| `DEV.test.report()` | Get and display report |
| `DEV.test.core()` | Run CoreGameplay scenario |
| `DEV.test.enemy()` | Run EnemyBehaviors scenario |
| `DEV.test.boss()` | Run BossFights scenario |
| `DEV.test.powerup()` | Run PowerUpCombos scenario |
| `DEV.test.stress()` | Run EdgeCases scenario |
| `DEV.test.all()` | Run all scenarios |

---

## 🐛 Troubleshooting

### Bot Not Moving
- Check if game is paused
- Verify player exists: `scene.player`
- Check automation enabled: `automation.enabled`

### Tests Not Running
- Ensure game is loaded first
- Initialize testing: `__framework.testing.init()`
- Check browser console for errors

### Performance Issues
- Reduce enemy spawn count in stress tests
- Increase wait times between actions
- Check browser performance profiler

### Missing Scenarios
- Verify scenario files exist in `/js/core/testing/scenarios/`
- Check import paths in FrameworkDebugAPI
- Ensure proper export from scenario files

---

## 📈 Best Practices

1. **Always initialize before testing**
   ```javascript
   await __framework.testing.init()
   ```

2. **Reset between scenarios**
   ```javascript
   DEV.killAll()
   await wait(2000)
   ```

3. **Monitor performance during tests**
   ```javascript
   const fps = scene.game.loop.actualFps
   if (fps < 30) console.warn('Performance degraded')
   ```

4. **Use appropriate timeouts**
   - Short actions: 100-500ms
   - Combat sequences: 3000-5000ms
   - Full scenarios: 60000-180000ms

5. **Clean up after tests**
   ```javascript
   automation.enabled = false
   DEV.killAll()
   errorDetector.clear()
   ```

---

## 🔗 Related Documentation

- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Main developer documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [DEV_GUIDELINES.md](./DEV_GUIDELINES.md) - PR7 compliance rules

---

*Created for Rakovinobijec v0.4.1 | Automated Testing System v1.0*