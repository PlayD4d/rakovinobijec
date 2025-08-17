# Audit Report: js/core/systems/powerup/PowerUpAbilities.js

## 📊 Metrics

- **Category**: core-systems
- **Lines of Code**: 362
- **Dependencies**: 0 imports, 1 exports
- **Violations**: 4
- **TODOs**: 0

## 🏷️ Status


## 📤 Exports

- PowerUpAbilities

## ⚠️ Violations

### Phaser API Violations (4)

- **Line 178**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `if (!player.aura && this.scene.add) {`
- **Line 179**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `player.aura = this.scene.add.graphics();`
- **Line 302**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `const gfx = this.scene.add.graphics();`
- **Line 310**: `scene.tweens.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `this.scene.tweens.add({`

## 💡 Recommendations

- **Remove Phaser API calls**: Use appropriate managers/systems instead of direct Phaser API.

## 🎯 PR7 Compliance Score

**80/100**

🟡 Good compliance with minor issues
