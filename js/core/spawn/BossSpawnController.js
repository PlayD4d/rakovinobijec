/**
 * BossSpawnController - Logika spawnu bossů a kontrola triggerů
 *
 * Extrahováno ze SpawnDirector pro dodržení limitu 500 LOC.
 * Všechny funkce přijímají `director` (SpawnDirector instance) jako první parametr.
 */

import { DebugLogger } from '../debug/DebugLogger.js';
import { getSession } from '../debug/SessionLog.js';

/**
 * Check individual boss trigger
 * @param {SpawnDirector} director
 * @param {Object} trigger - Boss trigger definition from spawn table
 * @returns {boolean} True if trigger condition is met
 */
function checkBossTrigger(director, trigger) {
    const now = director.gameTime;

    // Check if already triggered
    if (trigger._triggered) return false;

    switch (trigger.condition) {
        case 'time':
            // Spawn boss after specific time
            if (now >= trigger.value) {
                DebugLogger.debug('spawn', `Boss trigger met: time ${trigger.value}ms (current: ${now}ms)`);
                DebugLogger.debug('spawn', `Will spawn boss: ${trigger.bossId}`);
                return true;
            }
            break;

        case 'kills': {
            // Spawn boss after certain number of kills
            const kills = director.scene.gameStats?.enemiesKilled || 0;
            if (kills >= trigger.value) {
                DebugLogger.info('spawn', `Boss trigger met: ${kills} kills`);
                return true;
            }
            break;
        }

        case 'wave': {
            // Spawn boss after specific wave number
            const currentWave = Math.floor(now / 30000); // Wave every 30 seconds
            if (currentWave >= trigger.value) {
                DebugLogger.info('spawn', `Boss trigger met: wave ${currentWave}`);
                return true;
            }
            break;
        }
    }

    return false;
}

/**
 * Check if boss should spawn - PR7 compliant
 * @param {SpawnDirector} director
 * @returns {boolean} True if a boss should be spawned
 */
export function shouldSpawnBoss(director) {
    // PR7: Only support bossTriggers format
    if (!director.currentTable.bossTriggers) return false;

    const now = director.gameTime;

    // Already spawned recently (1 minute cooldown)
    if (now - director.lastBossSpawn < 60000) return false;

    // Check array of triggers
    for (const trigger of director.currentTable.bossTriggers) {
        if (checkBossTrigger(director, trigger)) {
            getSession()?.log('boss', 'trigger_met', { bossId: trigger.bossId, condition: trigger.condition, value: trigger.value });
            director.pendingBossTrigger = trigger;
            return true;
        }
    }

    return false;
}

/**
 * Spawn the boss - PR7 compliant
 * @param {SpawnDirector} director
 */
export function spawnBoss(director) {
    // PR7: Only support bossTriggers format
    if (!director.pendingBossTrigger) {
        DebugLogger.error('spawn', 'No pending boss trigger');
        return;
    }

    const trigger = director.pendingBossTrigger;
    const bossId = trigger.bossId;
    const clearEnemies = trigger.clearEnemies || false;
    const spawnDelay = trigger.spawnDelay || 0;

    // Mark as triggered to prevent re-spawning
    trigger._triggered = true;
    director.pendingBossTrigger = null;

    getSession()?.log('boss', 'spawn', { bossId, clearEnemies, spawnDelay });
    DebugLogger.info('spawn', `Boss spawn triggered: ${bossId}`);

    // Clear existing enemies if requested (use EnemyManager for proper flag reset)
    if (clearEnemies) {
        if (director.scene.enemyManager) {
            director.scene.enemyManager.clearAll();
        } else if (director.scene.enemiesGroup) {
            director.scene.enemiesGroup.clear(true, true);
        }
    }

    // Spawn boss after delay — tracked for cleanup on shutdown
    if (director._pendingBossTimer) director._pendingBossTimer.destroy();
    director._pendingBossTimer = director.scene.time.delayedCall(spawnDelay, () => {
        director._pendingBossTimer = null;
        if (!director.running || !director.scene) return;
        director.spawnEnemy(bossId, { boss: true });
        director.lastBossSpawn = director.gameTime;
        director.stats.bossSpawnCount++;

        // PR7: Notify scene that boss is active
        if (director.scene) {
            director.scene.bossActive = true;
        }
    });
}
