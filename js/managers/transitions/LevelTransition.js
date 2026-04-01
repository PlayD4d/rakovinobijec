import { DebugLogger } from '../../core/debug/DebugLogger.js';
import { getSession } from '../../core/debug/SessionLog.js';

/**
 * LevelTransition - Seamless level transition (no pause, no UI overlay, no enemy clear)
 * Called by TransitionManager.transitionToNextLevel()
 *
 * After boss death, the next spawn table is loaded immediately and new enemies
 * begin spawning. Existing enemies stay alive, loot stays on the field.
 * A brief camera flash signals the new level.
 *
 * @param {import('../TransitionManager.js').TransitionManager} tm
 * @param {number} nextLevel
 */
export async function executeLevelTransition(tm, nextLevel) {
    const scene = tm.scene;

    DebugLogger.info('transition', `[TransitionManager] Seamless transition to level ${nextLevel}`);
    getSession()?.transition(scene.currentLevel, nextLevel, 'level_transition');
    getSession()?.log('game', 'level_transition', { from: scene.currentLevel, to: nextLevel });

    // 1. Update level counter
    scene.currentLevel = nextLevel;

    // 2. Load and start next spawn table (enemies keep spawning, no interruption)
    if (scene.spawnDirector) {
        const loaded = await scene.spawnDirector.loadSpawnTable(`spawnTable.level${nextLevel}`);
        if (loaded) {
            scene.spawnDirector.start({ ngPlusLevel: scene.spawnDirector.ngPlusLevel });
            DebugLogger.info('transition', `Level ${nextLevel} spawn table loaded and started`);

            // Switch music if defined
            const table = scene.spawnDirector.currentTable;
            if (table?.music?.ambient && scene.audioSystem) {
                scene.audioSystem.switchMusicCategory?.('game', { fadeOut: 500, fadeIn: 1000 });
            }
        }
    }

    // 3. Reset level timer
    scene.sceneTimeSec = 0;

    // 4. Brief camera flash to signal new level
    scene.flashCamera?.(300, 255, 255, 255);

    // 5. Analytics
    tm._log('level_start', {
        level: nextLevel,
        playerStats: tm.getPlayerStats()
    });
}
