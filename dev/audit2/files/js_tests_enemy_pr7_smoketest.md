# Audit Report: js/tests/enemy_pr7_smoketest.js

## 📊 Metrics

- **Category**: tests
- **Lines of Code**: 160
- **Dependencies**: 1 imports, 1 exports
- **Violations**: 3
- **TODOs**: 0

## 🏷️ Status


## 📦 Dependencies

- js/entities/Enemy.js

## 📤 Exports

- runEnemyPR7SmokeTest

## ⚠️ Violations

### Phaser API Violations (3)

- **Line 20**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `'scene.add.graphics',`
- **Line 21**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `'scene.add.circle',`
- **Line 24**: `scene.tweens.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `'scene.tweens.add',`

## 💡 Recommendations

- **Remove Phaser API calls**: Use appropriate managers/systems instead of direct Phaser API.

## 🎯 PR7 Compliance Score

**85/100**

🟡 Good compliance with minor issues
