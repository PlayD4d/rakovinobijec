# Audit Report: js/entities/Enemy.js

## 📊 Metrics

- **Category**: entities
- **Lines of Code**: 913
- **Dependencies**: 0 imports, 1 exports
- **Violations**: 7
- **TODOs**: 0

## 🏷️ Status

- 📏 **LARGE FILE**: Consider splitting (913 LOC)

## 📤 Exports

- Enemy

## ⚠️ Violations

### Phaser API Violations (7)

- **Line 93**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `scene.add.existing(this);`
- **Line 94**: `scene.physics.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `scene.physics.add.existing(this);`
- **Line 246**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `if (!this.scene || !this.scene.add) return;`
- **Line 249**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `this.auraGraphics = this.scene.add.graphics();`
- **Line 259**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `if (!this.scene || !this.scene.add) return;`
- **Line 263**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `this.goldAuraGraphics = this.scene.add.graphics();`
- **Line 835**: `scene.tweens.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `this.flashTween = this.scene.tweens.add({`

## 💡 Recommendations

- **Split file**: This file has 913 lines. Consider breaking it into smaller modules.
- **Remove Phaser API calls**: Use appropriate managers/systems instead of direct Phaser API.

## 🎯 PR7 Compliance Score

**55/100**

🟠 Moderate compliance, needs attention
