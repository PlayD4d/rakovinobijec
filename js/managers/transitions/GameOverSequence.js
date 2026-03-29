import { DebugLogger } from '../../core/debug/DebugLogger.js';
import { getSession } from '../../core/debug/SessionLog.js';

/**
 * GameOverSequence - Extracted game-over transition logic
 * Called by TransitionManager.gameOver()
 *
 * @param {import('../TransitionManager.js').TransitionManager} tm
 */
export async function executeGameOver(tm) {
    const scene = tm.scene;

    DebugLogger.info('transition', '[TransitionManager] Game Over sequence starting');
    getSession()?.log('game', 'gameover_start', { score: scene.gameStats?.score, level: scene.currentLevel, cause: scene.lastDamageCause || 'unknown' });

    // 1. Pause everything immediately
    tm.pauseGameSystems();

    // 2. Log analytics
    const stats = tm.calculateFinalStats();
    tm.logAnalytics('game_over', {
        ...stats,
        cause: scene.lastDamageCause || 'unknown'
    });

    // 3. Death VFX on player
    if (scene.player && scene.vfxSystem) {
        scene.vfxSystem.play('vfx.player.death',
            scene.player.x,
            scene.player.y
        );
    }

    // 4. Handle high score if applicable
    const finalScore = scene.gameStats.score;
    const isHighScore = scene.highScoreManager?.isHighScore(finalScore);

    if (isHighScore && scene.highScoreManager) {
        await showHighScoreModal(tm, finalScore);
    }

    // 5. Show defeat modal via CentralEventBus
    const { centralEventBus } = await import('../../core/events/CentralEventBus.js');
    centralEventBus.emit('game:over', {
        survivalTime: Math.floor(scene.sceneTimeSec),
        level: stats.level,
        kills: stats.enemiesKilled,
        score: stats.score
    });

    // 6. Analytics -- endSession expects (gameStats) only
    if (scene.analyticsManager) {
        await scene.analyticsManager.endSession(scene.gameStats);
    }

    // 7. UI scene will emit 'ui:defeat:restart' or 'ui:defeat:menu'
}

/**
 * Dynamically import and show the HighScoreModal
 *
 * @param {import('../TransitionManager.js').TransitionManager} tm
 * @param {number} finalScore
 */
async function showHighScoreModal(tm, finalScore) {
    const scene = tm.scene;

    try {
        const { HighScoreModal } = await import('../../ui/HighScoreModal.js');
        scene.highScoreModal = new HighScoreModal(
            scene,
            scene.gameStats, // Pass full gameStats object, not just score
            async (name) => {
                const gs = scene.gameStats;
                await scene.highScoreManager.addHighScore(
                    name, finalScore, gs.level, gs.enemiesKilled,
                    gs.time, gs.bossesDefeated
                );
                if (scene.globalHighScoreManager) {
                    await scene.globalHighScoreManager.submitScore(
                        name, finalScore, gs.level, gs.enemiesKilled,
                        gs.time, gs.bossesDefeated
                    );
                }
                scene.highScoreModal = null;
            }
        );
        // Actually show the modal
        if (scene.highScoreModal.showEntry) {
            scene.highScoreModal.showEntry();
        }
    } catch (e) {
        DebugLogger.warn('transition', '[TransitionManager] HighScoreModal failed:', e);
    }
}
