import { DebugLogger } from '../../core/debug/DebugLogger.js';
import { getSession } from '../../core/debug/SessionLog.js';

/**
 * LevelTransition - Extracted level transition logic
 * Called by TransitionManager.transitionToNextLevel()
 *
 * @param {import('../TransitionManager.js').TransitionManager} tm
 * @param {number} nextLevel
 */
export async function executeLevelTransition(tm, nextLevel) {
    const scene = tm.scene;

    DebugLogger.info('transition', `[TransitionManager] Transitioning to level ${nextLevel}`);
    getSession()?.transition(scene.currentLevel, nextLevel, 'level_transition');

    // 1. Pause game but keep time running for animations
    scene.isPaused = true;
    if (scene.updateManager) {
        scene.updateManager.setPhaseEnabled('ai_spawn', false);
        scene.updateManager.setPhaseEnabled('enemies', false);
    }

    // 2. Show transition UI
    await tm.showUIModal('ui:level-transition:show', {
        fromLevel: scene.currentLevel,
        toLevel: nextLevel,
        message: `Úroveň ${nextLevel}`
    });

    // 3. Auto-collect all loot before clearing
    if (scene.lootSystem?.lootGroup) {
        const lootItems = scene.lootSystem.lootGroup.getChildren().filter(l => l.active);
        for (const loot of lootItems) {
            if (scene.lootSystem.collectItem) {
                try { scene.lootSystem.collectItem(loot); } catch (_) {}
            }
        }
    }

    // 4. Clean up current level
    await cleanupLevel(tm);

    // 5. Initialize next level
    scene.currentLevel = nextLevel;
    await initializeLevel(tm, nextLevel);

    // 6. Hide transition UI
    scene.events.emit('ui:level-transition:hide');

    // 7. Resume game
    tm.resumeGameSystems();
    tm.isTransitioning = false;
    tm.currentTransition = null;

    // 8. Analytics
    tm.logAnalytics('level_start', {
        level: nextLevel,
        playerStats: tm.getPlayerStats()
    });
}

/**
 * Clean up current level in deterministic order
 *
 * @param {import('../TransitionManager.js').TransitionManager} tm
 */
export async function cleanupLevel(tm) {
    DebugLogger.info('transition', '[TransitionManager] Cleaning up level');

    for (const step of tm.cleanupOrder) {
        await executeCleanupStep(tm, step);
    }
}

/**
 * Execute a single cleanup step
 *
 * @param {import('../TransitionManager.js').TransitionManager} tm
 * @param {string} step
 */
export async function executeCleanupStep(tm, step) {
    const scene = tm.scene;

    switch (step) {
        case 'pausePhysics':
            scene.pausePhysics();
            break;

        case 'stopSpawns':
            if (scene.spawnDirector) {
                scene.spawnDirector.stop();
            }
            break;

        case 'clearProjectiles':
            if (scene.projectileSystem) {
                scene.projectileSystem.clearAll();
            }
            break;

        case 'clearEnemies':
            // Delegate to EnemyManager to properly reset bossActive/currentBoss
            if (scene.enemyManager) {
                scene.enemyManager.clearAll();
            } else {
                // Fallback: direct clear + manual flag reset
                if (scene.enemiesGroup) scene.enemiesGroup.clear(true, true);
                if (scene.bossGroup) scene.bossGroup.clear(true, true);
                scene.currentBoss = null;
                scene.bossActive = false;
            }
            break;

        case 'clearLoot':
            if (scene.lootSystem) {
                scene.lootSystem.clearAll();
            }
            break;

        case 'stopVFX':
            if (scene.vfxSystem?.stopAllEffects) {
                scene.vfxSystem.stopAllEffects();
            }
            break;

        case 'unpauseTime':
            // Time is no longer paused during transitions (breaks delayedCall)
            break;
    }

    // Small delay between steps for stability
    await new Promise(resolve => {
        if (scene?.time) {
            scene.time.delayedCall(10, resolve);
        } else {
            resolve();
        }
    });
}

/**
 * Initialize a level (load spawn table, reset timer, ensure player visible)
 *
 * @param {import('../TransitionManager.js').TransitionManager} tm
 * @param {number} level
 */
export async function initializeLevel(tm, level) {
    const scene = tm.scene;

    DebugLogger.info('transition', `[TransitionManager] Initializing level ${level}`);

    // Reset spawn director for new level
    if (scene.spawnDirector) {
        await scene.spawnDirector.loadSpawnTable(`spawnTable.level${level}`);
        scene.spawnDirector.start();
    }

    // Reset timer
    scene.sceneTimeSec = 0;

    // Ensure player is visible and active
    if (scene.player) {
        scene.player.setActive(true);
        scene.player.setVisible(true);
    }
}
