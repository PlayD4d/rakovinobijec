# Audit Report: js/handlers/setupCollisions.js

## 📊 Metrics

- **Category**: other
- **Lines of Code**: 239
- **Dependencies**: 0 imports, 2 exports
- **Violations**: 6
- **TODOs**: 0

## 🏷️ Status


## 📤 Exports

- setupCollisions
- collisionHandlers

## ⚠️ Violations

### Phaser API Violations (6)

- **Line 19**: `scene.physics.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `scene.physics.add.overlap(`
- **Line 30**: `scene.physics.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `scene.physics.add.overlap(`
- **Line 41**: `scene.physics.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `scene.physics.add.overlap(`
- **Line 52**: `scene.physics.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `scene.physics.add.overlap(`
- **Line 63**: `scene.physics.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `scene.physics.add.overlap(`
- **Line 74**: `scene.physics.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `scene.physics.add.overlap(`

## 💡 Recommendations

- **Remove Phaser API calls**: Use appropriate managers/systems instead of direct Phaser API.

## 🎯 PR7 Compliance Score

**70/100**

🟡 Good compliance with minor issues
