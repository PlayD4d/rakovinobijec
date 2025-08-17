# Audit Report: js/core/utils/bossActions.js

## 📊 Metrics

- **Category**: core-utils
- **Lines of Code**: 74
- **Dependencies**: 0 imports, 4 exports
- **Violations**: 2
- **TODOs**: 0

## 🏷️ Status

- ⚠️ **ORPHAN**: No file imports this module

## 📤 Exports

- performShootFan
- performShootCircle
- performTrackingShot
- performPlaceZone

## ⚠️ Violations

### Phaser API Violations (2)

- **Line 50**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `const g = scene.add.graphics();`
- **Line 56**: `scene.tweens.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `scene.tweens.add({ targets: g, alpha: 0.4, duration: 600, yoyo: true, repeat: 3 });`

## 💡 Recommendations

- **Remove Phaser API calls**: Use appropriate managers/systems instead of direct Phaser API.
- **Review necessity**: This file is not imported anywhere. Consider removing if unused.

## 🎯 PR7 Compliance Score

**70/100**

🟡 Good compliance with minor issues
