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

    // 1. Pause everything immediately + mark game over
    tm.pauseGameSystems();
    scene.isGameOver = true;

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

    // 4. Show defeat modal via CentralEventBus
    const { centralEventBus } = await import('../../core/events/CentralEventBus.js');
    centralEventBus.emit('game:over', {
        survivalTime: Math.floor(scene.sceneTimeSec),
        level: stats.level,
        kills: stats.enemiesKilled,
        score: stats.score
    });

    // 5. UI scene will emit 'ui:defeat:restart' or 'ui:defeat:menu'
}
