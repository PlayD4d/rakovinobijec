# Audit Report: js/tests/boss_pr7_smoketest.js

## 📊 Metrics

- **Category**: tests
- **Lines of Code**: 143
- **Dependencies**: 1 imports, 1 exports
- **Violations**: 3
- **TODOs**: 0

## 🏷️ Status


## 📦 Dependencies

- js/entities/Boss.js

## 📤 Exports

- runBossPR7SmokeTest

## ⚠️ Violations

### Phaser API Violations (3)

- **Line 21**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `{ pattern: /scene\.add\.graphics/g, name: 'scene.add.graphics' },`
- **Line 22**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `{ pattern: /scene\.add\.circle/g, name: 'scene.add.circle' },`
- **Line 23**: `scene.tweens.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `{ pattern: /this\.scene\.tweens\.add/g, name: 'scene.tweens.add' },`

## 💡 Recommendations

- **Remove Phaser API calls**: Use appropriate managers/systems instead of direct Phaser API.

## 🎯 PR7 Compliance Score

**85/100**

🟡 Good compliance with minor issues
