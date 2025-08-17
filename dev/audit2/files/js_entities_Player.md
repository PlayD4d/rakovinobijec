# Audit Report: js/entities/Player.js

## 📊 Metrics

- **Category**: entities
- **Lines of Code**: 680
- **Dependencies**: 0 imports, 2 exports
- **Violations**: 2
- **TODOs**: 0

## 🏷️ Status

- 📏 **LARGE FILE**: Consider splitting (680 LOC)

## 📤 Exports

- Player
- default

## ⚠️ Violations

### Phaser API Violations (2)

- **Line 37**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `scene.add.existing(this);`
- **Line 38**: `scene.physics.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `scene.physics.add.existing(this);`

## 💡 Recommendations

- **Split file**: This file has 680 lines. Consider breaking it into smaller modules.
- **Remove Phaser API calls**: Use appropriate managers/systems instead of direct Phaser API.

## 🎯 PR7 Compliance Score

**80/100**

🟡 Good compliance with minor issues
