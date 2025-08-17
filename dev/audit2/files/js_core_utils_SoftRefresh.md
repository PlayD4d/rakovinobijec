# Audit Report: js/core/utils/SoftRefresh.js

## 📊 Metrics

- **Category**: core-utils
- **Lines of Code**: 508
- **Dependencies**: 0 imports, 3 exports
- **Violations**: 2
- **TODOs**: 0

## 🏷️ Status

- ⚠️ **ORPHAN**: No file imports this module
- 📏 **LARGE FILE**: Consider splitting (508 LOC)

## 📤 Exports

- SoftRefresh
- extendBlueprintLoader
- extendSpawnDirector

## ⚠️ Violations

### Phaser API Violations (2)

- **Line 398**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `const text = this.scene.add.text(`
- **Line 412**: `scene.tweens.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `this.scene.tweens.add({`

## 💡 Recommendations

- **Split file**: This file has 508 lines. Consider breaking it into smaller modules.
- **Remove Phaser API calls**: Use appropriate managers/systems instead of direct Phaser API.
- **Review necessity**: This file is not imported anywhere. Consider removing if unused.

## 🎯 PR7 Compliance Score

**60/100**

🟠 Moderate compliance, needs attention
