# Audit Report: js/core/systems/powerup/PowerUpEffects.js

## 📊 Metrics

- **Category**: core-systems
- **Lines of Code**: 201
- **Dependencies**: 0 imports, 1 exports
- **Violations**: 3
- **TODOs**: 0

## 🏷️ Status


## 📤 Exports

- PowerUpEffects

## ⚠️ Violations

### Phaser API Violations (3)

- **Line 164**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `if (!this.scene.add) return;`
- **Line 166**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `const text = this.scene.add.text(`
- **Line 183**: `scene.tweens.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `this.scene.tweens.add({`

## 💡 Recommendations

- **Remove Phaser API calls**: Use appropriate managers/systems instead of direct Phaser API.

## 🎯 PR7 Compliance Score

**85/100**

🟡 Good compliance with minor issues
