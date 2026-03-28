import { DebugLogger } from '../../core/debug/DebugLogger.js';

/**
 * VictorySequence - Extracted victory transition logic
 * Called by TransitionManager.showVictory()
 *
 * @param {import('../TransitionManager.js').TransitionManager} tm
 */
export async function executeVictory(tm) {
    const scene = tm.scene;

    DebugLogger.info('transition', '[TransitionManager] Showing victory screen');

    // 1. Pause game systems
    tm.pauseGameSystems();

    // 2. Calculate and log stats
    const stats = tm.calculateFinalStats();
    tm.logAnalytics('level_complete', stats);

    // 3. Clear enemies with celebration effect
    await clearAllEnemiesWithEffect(tm);

    // 4. Show UI victory modal via event
    await tm.showUIModal('ui:victory:show', {
        stats,
        level: scene.currentLevel,
        time: Math.floor(scene.sceneTimeSec)
    });

    // 5. Wait for user input (handled by UI scene)
    // UI scene will emit 'ui:victory:continue' when ready
}

/**
 * Clear all enemies with staggered celebration effect
 *
 * @param {import('../TransitionManager.js').TransitionManager} tm
 */
export async function clearAllEnemiesWithEffect(tm) {
    const scene = tm.scene;
    const enemies = [];

    // Collect all active enemies
    if (scene.enemiesGroup) {
        enemies.push(...scene.enemiesGroup.getChildren().filter(e => e.active));
    }
    if (scene.bossGroup) {
        enemies.push(...scene.bossGroup.getChildren().filter(b => b.active));
    }

    // Create staggered destruction effect
    const staggerDelay = Math.min(50, 1000 / Math.max(enemies.length, 1));

    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];

        // Delay for stagger effect
        await new Promise(resolve => {
            if (scene?.time) {
                scene.time.delayedCall(i * staggerDelay, resolve);
            } else {
                resolve();
            }
        });

        // VFX at enemy position
        if (scene.vfxSystem) {
            scene.vfxSystem.play('vfx.enemy.celebration_death', enemy.x, enemy.y);
        }

        // Destroy enemy
        if (enemy.die) {
            enemy.die(true); // Skip loot drops
        } else {
            enemy.destroy();
        }
    }

    // Final celebration burst
    if (scene.vfxSystem) {
        scene.vfxSystem.play('vfx.level.complete',
            scene.getScaleManager().width / 2,
            scene.getScaleManager().height / 2
        );
    }

    return new Promise(resolve => {
        if (scene?.time) {
            scene.time.delayedCall(500, resolve);
        } else {
            resolve();
        }
    });
}
