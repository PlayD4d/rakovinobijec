# Release Checklist

## 📋 Pre-Release Checklist

### Code Quality
- [ ] **GameScene.js ≤ 1200 LOC** 
  - Current: Check with `wc -l js/scenes/GameScene.js`
  - Target: ≤ 1200 lines
  - ✅ Last verified: 1116 LOC

### Guard Checks
- [ ] **GameScene guards pass**
  ```bash
  npm run guard:check
  ```
  - No `this.add.*` calls
  - No `this.physics.add.*` calls
  - No `this.tweens.add` calls
  - No direct Phaser API usage

- [ ] **All files guard check**
  ```bash
  npm run guard:check-all
  ```
  - Validates all JS files except allowed exceptions
  - UI scenes and VFX/SFX systems are exempted

- [ ] **Phaser API containment**
  ```bash
  npm run guard:phaser
  ```
  - Ensures Phaser API only used in allowed modules

### Data Validation
- [ ] **Blueprint validation**
  ```bash
  npm run validate:blueprints
  ```
  - All blueprints match schema
  - VFX/SFX references exist
  - No missing dependencies

- [ ] **Data audit**
  ```bash
  npm run audit:data:strict
  ```
  - All required fields present
  - Value ranges valid
  - No duplicate IDs

### Automated Tests
- [ ] **Golden Path test**
  ```bash
  npm run test:golden-path
  ```
  Tests main game flow:
  - Start game
  - Level up → Select power-up
  - Pause → Resume
  - Boss spawn → Victory
  - Return to menu
  - Restart

- [ ] **Memory leak test**
  ```bash
  npm run test:leak
  ```
  - Run 3-5 game cycles
  - Check active object counts
  - Verify cleanup: enemies = 0, projectiles = 0, loot = 0

- [ ] **Smoke test**
  ```bash
  npm run smoke:test
  ```
  - Basic gameplay verification
  - Spawn table validation
  - TTK metrics check

### Telemetry & Analytics
- [ ] **Telemetry validation**
  ```bash
  npm run validate:telemetry
  ```
  - Event structure correct
  - No missing required fields

- [ ] **Check transition logs**
  - In browser console: `transitionManager.getTransitionHistory()`
  - Verify events logged correctly
  - No error states

### UI Contract
- [ ] **UI event isolation test**
  - Open power-up selection
  - Click on game area
  - Verify: Click doesn't affect game
  - Check: `uiEventContract.testInputIsolation()`

- [ ] **UI responsiveness**
  - Test on mobile viewport
  - Test on desktop
  - Verify touch/click handlers work

## 🚀 Deployment Steps

### 1. Run Full CI
```bash
npm run ci:full
```
This runs:
- All guard checks
- Phaser API validation
- Blueprint validation
- Golden path test

### 2. Quick Verification
```bash
npm run ci:quick
```
Quick smoke test for minor changes

### 3. Build & Deploy
```bash
npm run build
# Deploy to your hosting service
```

### 4. Post-Deploy Verification
- [ ] Game loads without console errors
- [ ] Can complete one full game cycle
- [ ] Analytics events firing
- [ ] No memory leaks after 5 minutes play

## 🔍 Post-Release Monitoring

### First Hour
- [ ] Monitor error logs
- [ ] Check analytics dashboard
- [ ] Verify telemetry flowing
- [ ] No spike in error rates

### First Day
- [ ] Review transition history patterns
- [ ] Check memory usage trends
- [ ] Validate completion rates
- [ ] Review user feedback

### Issue Response
If issues found:
1. Check transition history: `transitionManager.getTransitionHistory()`
2. Review enemy stats: `enemyManager.getStats()`
3. Check disposal: `disposableRegistry.getStats()`
4. Run guards: `npm run guard:check`

## 📊 Success Metrics

### Performance
- [ ] 60 FPS on target devices
- [ ] < 100MB memory usage
- [ ] < 3s load time

### Stability
- [ ] < 1% error rate
- [ ] No memory leaks
- [ ] Clean shutdown/restart

### Code Quality
- [ ] All guards passing
- [ ] GameScene < 1200 LOC
- [ ] No console errors/warnings

## 🚨 Rollback Plan

If critical issues:
1. Revert to previous release
2. Run `npm run guard:check` on reverted code
3. Verify with `npm run ci:quick`
4. Re-deploy stable version
5. Investigate issue in dev environment

## 📝 Release Notes Template

```markdown
## Version X.Y.Z

### Features
- [ ] List new features

### Improvements
- [ ] Performance improvements
- [ ] Code quality (GameScene: XXXX → YYYY LOC)

### Fixes
- [ ] Bug fixes

### Technical
- [ ] Guard checks: ✅ Passing
- [ ] Memory leaks: ✅ None detected
- [ ] Blueprint validation: ✅ Valid
```

## 🔗 Quick Commands Reference

```bash
# Guards
npm run guard:check        # Check GameScene
npm run guard:check-all    # Check all files
npm run guard:phaser       # Check Phaser API

# Testing
npm run test:golden-path   # Main flow test
npm run test:leak          # Memory leak test
npm run smoke:test         # Quick smoke test

# Validation
npm run validate:blueprints  # Blueprint schemas
npm run audit:data:strict    # Data integrity

# CI
npm run ci:full   # Full validation suite
npm run ci:quick  # Quick checks
```

---

*Last updated: Check with `git log -1 --format=%cd docs/release-checklist.md`*