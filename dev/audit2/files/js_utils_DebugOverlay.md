# Audit Report: js/utils/DebugOverlay.js

## 📊 Metrics

- **Category**: utils
- **Lines of Code**: 354
- **Dependencies**: 1 imports, 1 exports
- **Violations**: 3
- **TODOs**: 0

## 🏷️ Status


## 📦 Dependencies

- js/utils/PerformanceProfiler.js

## 📤 Exports

- DebugOverlay

## ⚠️ Violations

### Phaser API Violations (3)

- **Line 24**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `this.text = scene.add.text(x, y, '', {`
- **Line 40**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `this.missingAssetsText = scene.add.text(cam.width - margin, margin, '', {`
- **Line 58**: `scene.add`
  - Pattern: `scene\.(add|physics\.add|tweens\.add|sound\.play)`
  - Code: `this._flashText = scene.add.text(x, y - 30, '', {`

## 💡 Recommendations

- **Remove Phaser API calls**: Use appropriate managers/systems instead of direct Phaser API.

## 🎯 PR7 Compliance Score

**85/100**

🟡 Good compliance with minor issues
