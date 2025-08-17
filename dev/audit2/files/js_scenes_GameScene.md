# Audit Report: js/scenes/GameScene.js

## 📊 Metrics

- **Category**: scenes
- **Lines of Code**: 1117
- **Dependencies**: 36 imports, 1 exports
- **Violations**: 3
- **TODOs**: 0

## 🏷️ Status

- 🌟 **HUB**: High connectivity file
- 📏 **LARGE FILE**: Consider splitting (1117 LOC)

## 📦 Dependencies

- js/entities/Player.js
- js/entities/Enemy.js
- js/entities/Boss.js
- js/ui/UnifiedHUD.js
- js/managers/MobileControlsManager.js
- js/managers/HighScoreManager.js
- js/managers/GlobalHighScoreManager.js
- js/managers/AnalyticsManager.js
- js/utils/supabaseClient.js
- js/ui/UITheme.js
- js/ui/HighScoreModal.js
- js/core/systems/SimpleLootSystem.js
- js/core/systems/powerup/PowerUpSystem.js
- js/core/utils/ShapeRenderer.js
- js/core/utils/devConsole.js
- js/core/events/EventBus.js
- js/core/input/KeyboardManager.js
- js/core/vfx/SimplifiedVFXSystem.js
- js/core/logging/SessionLogger.js
- js/core/blueprints/DisplayResolver.js
- js/core/TelemetryLogger.js
- js/utils/DebugOverlay.js
- js/core/debug/Phase5Debug.js
- js/utils/SmokeTest.js
- js/core/data/BlueprintLoader.js
- js/core/spawn/SpawnDirector.js
- js/core/FrameworkDebugAPI.js
- js/core/systems/ProjectileSystem.js
- js/core/graphics/GraphicsFactory.js
- js/handlers/setupCollisions.js
- js/managers/UpdateManager.js
- js/managers/TransitionManager.js
- js/managers/BootstrapManager.js
- js/managers/SystemsInitializer.js
- js/utils/DisposableRegistry.js
- js/managers/EnemyManager.js

## 📤 Exports

- GameScene

## ⚠️ Violations

### Phaser API Violations (3)

- **Line 569**: `this.cameras.main`
  - Pattern: `this\.cameras\.(main|add)`
  - Code: `this.cameras.main.flash(500, 255, 255, 0);`
- **Line 672**: `this.cameras.main`
  - Pattern: `this\.cameras\.(main|add)`
  - Code: `this.cameras.main.flash(500, 255, 255, 0);`
- **Line 872**: `this.cameras.main`
  - Pattern: `this\.cameras\.(main|add)`
  - Code: `this.cameras.main.flash(500, 255, 255, 0);`

## 💡 Recommendations

- **Split file**: This file has 1117 lines. Consider breaking it into smaller modules.
- **Remove Phaser API calls**: Use appropriate managers/systems instead of direct Phaser API.
- **High coupling**: 36 dependencies indicate high coupling. Consider refactoring.

## 🎯 PR7 Compliance Score

**55/100**

🟠 Moderate compliance, needs attention
