import { DebugLogger } from '../../core/debug/DebugLogger.js';
import { getSession } from '../../core/debug/SessionLog.js';

/**
 * VictorySequence - Victory transition logic
 * Called by TransitionManager.showVictory()
 *
 * @param {import('../TransitionManager.js').TransitionManager} tm
 */
export async function executeVictory(tm) {
    const scene = tm.scene;

    DebugLogger.info('transition', '[TransitionManager] Showing victory screen');
    getSession()?.log('game', 'victory_start', { score: scene.gameStats?.score, level: scene.currentLevel });

    // 1. Clear enemies with celebration effect BEFORE pausing (needs scene timer)
    await clearAllEnemiesWithEffect(tm);

    // 2. Now pause game systems
    tm.pauseGameSystems();

    // 3. Calculate and log stats
    const stats = tm.calculateFinalStats();
    tm._log('level_complete', stats);

    // 4. Show UI victory modal via event
    await tm.showUIModal('ui:victory-show', {
        stats,
        level: scene.currentLevel,
        time: Math.floor(scene.sceneTimeSec)
    });
}

/**
 * Clear all enemies with staggered celebration effect.
 * Must run BEFORE scene pause (uses scene.time for stagger delays).
 */
async function clearAllEnemiesWithEffect(tm) {
    const scene = tm.scene;
    const enemies = [];

    if (scene.enemiesGroup?.children) {
        enemies.push(...scene.enemiesGroup.getChildren().filter(e => e.active));
    }
    if (scene.bossGroup?.children) {
        enemies.push(...scene.bossGroup.getChildren().filter(b => b.active));
    }

    if (enemies.length === 0) return;

    // Staggered destruction — short delay between each kill for visual effect
    const staggerDelay = Math.min(50, 1000 / enemies.length);

    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (!enemy?.active) continue;

        // Stagger delay — runs BEFORE pauseGameSystems(), so scene.time is valid
        if (i > 0) {
            await new Promise(resolve => scene.time.delayedCall(staggerDelay, resolve));
        }

        // Celebration VFX at enemy position
        if (scene.vfxSystem) {
            scene.vfxSystem.play('enemy.celebration_death', enemy.x, enemy.y);
        }

        // Kill enemy (die() handles cleanup, VFX, XP)
        if (enemy.active) {
            enemy.setActive(false);
            enemy.setVisible(false);
            if (enemy.body) enemy.body.enable = false;
        }
    }

    // Final celebration burst at screen center
    if (scene.vfxSystem) {
        const cam = scene.cameras?.main;
        if (cam) {
            scene.vfxSystem.play('victory', cam.centerX, cam.centerY);
        }
    }

    // Brief pause for celebration to play out (still pre-pause, scene.time valid)
    await new Promise(resolve => scene.time.delayedCall(500, resolve));
}
