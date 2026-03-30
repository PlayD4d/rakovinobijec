/**
 * SpawnWaveProcessor - Processing enemy waves, elite and unique spawns
 *
 * Extracted from SpawnDirector to comply with the 500 LOC limit.
 * All functions receive `director` (SpawnDirector instance) as the first parameter.
 */

import { DebugLogger } from '../debug/DebugLogger.js';
import { getSession } from '../debug/SessionLog.js';

/**
 * Process regular enemy waves
 * @param {SpawnDirector} director
 */
export function processEnemyWaves(director) {
    if (!director.currentTable.enemyWaves) return;

    const now = director.gameTime;
    const maxEnemies = director._maxEnemies;

    // Read total entity count ONCE per frame (enemies + bosses)
    let enemyCount = (director.scene.enemiesGroup?.countActive?.() || 0)
                   + (director.scene.bossGroup?.countActive?.() || 0);

    // Debug: log spawn state every 5 seconds (stateful bucket — exactly 1 log per 5s)
    const tickBucket = Math.floor(now / 5000);
    if (tickBucket !== (director._lastWaveTickBucket ?? -1)) {
        director._lastWaveTickBucket = tickBucket;
        getSession()?.log('spawn', 'wave_tick', { gameTime: Math.floor(now / 1000), enemyCount, maxEnemies, waveCount: director.currentTable.enemyWaves.length });
    }

    if (enemyCount >= maxEnemies) return;

    // Iterate waves inline instead of allocating a filtered array
    for (const wave of director.currentTable.enemyWaves) {
        const startTime = wave.startAt || 0;
        const endTime = wave.endAt || Infinity;
        if (now < startTime || now > endTime) continue;

        const timeSinceLastSpawn = now - (wave.lastSpawn || 0);
        const interval = wave.interval || wave.spawnRate || 2000;
        if (timeSinceLastSpawn < interval) continue;

        const weight = wave.weight || 100;
        if (Math.random() * 100 >= weight) {
            if (Math.floor(now / 5000) !== Math.floor((now - 16) / 5000)) getSession()?.log('spawn', 'wave_skip_weight', { enemyId: wave.enemyId, weight });
            continue;
        }

        const remainingSlots = maxEnemies - enemyCount;
        if (remainingSlots <= 0) break;

        let count = wave.countRange ? director.randomInRange(wave.countRange) : 1;
        count = Math.min(count, remainingSlots, 5);

        for (let i = 0; i < count; i++) {
            director.spawnEnemy(wave.enemyId, { wave: true });
        }
        wave.lastSpawn = now;
        enemyCount += count;

        getSession()?.log('spawn', 'wave_spawned', { enemyId: wave.enemyId, count, gameTime: Math.floor(now / 1000) });
        DebugLogger.debug('spawn', `Spawned ${count} ${wave.enemyId} at time ${Math.floor(now/1000)}s`);
    }
}

/**
 * Process elite spawn windows
 * @param {SpawnDirector} director
 */
export function processEliteWindows(director) {
    if (!director.currentTable.eliteWindows) return;

    const now = director.gameTime;

    // Check total entity count (enemies + bosses)
    const currentEnemyCount = (director.scene.enemiesGroup?.countActive?.() || 0)
                            + (director.scene.bossGroup?.countActive?.() || 0);
    const maxEnemies = director._maxEnemies;

    if (currentEnemyCount >= maxEnemies - 5) { // Leave room for regular spawns
        if (Math.floor(now / 5000) !== Math.floor((now - 16) / 5000)) getSession()?.log('spawn', 'elite_skip_cap', { currentEnemyCount, maxEnemies });
        return; // Skip elite spawns if near limit
    }

    for (const elite of director.currentTable.eliteWindows) {
        // Check if in window - PR7 compliant format only
        const startTime = elite.startAt || 0;
        const endTime = elite.endAt || Infinity;
        if (now < startTime || now > endTime) continue;

        // Check cooldown
        const lastSpawn = director.eliteCooldowns.get(elite.enemyId) || 0;
        if (now - lastSpawn < elite.cooldown) continue;

        // Random chance based on weight
        if (Math.random() * 100 < elite.weight) {
            const count = director.randomInRange(elite.countRange);
            for (let i = 0; i < count; i++) {
                director.spawnEnemy(elite.enemyId, { elite: true });
            }
            director.eliteCooldowns.set(elite.enemyId, now);
            director.stats.eliteSpawnCount++;
            getSession()?.log('spawn', 'elite_spawned', { enemyId: elite.enemyId, count, gameTime: Math.floor(now / 1000) });
        }
    }
}

/**
 * Process unique enemy spawns
 * @param {SpawnDirector} director
 */
export function processUniqueSpawns(director) {
    if (!director.currentTable.uniqueSpawns) return;

    // Respect max enemies cap (same as waves and elites)
    const currentCount = (director.scene.enemiesGroup?.countActive?.() || 0)
                       + (director.scene.bossGroup?.countActive?.() || 0);
    if (currentCount >= director._maxEnemies) return;

    const now = director.gameTime;

    for (const unique of director.currentTable.uniqueSpawns) {
        // Check if in window
        if (now < unique.startAt || now > unique.endAt) continue;

        // Check cooldown
        const lastSpawn = director.uniqueCooldowns.get(unique.enemyId) || 0;
        if (now - lastSpawn < unique.cooldown) continue;

        // Check conditions
        if (unique.conditions) {
            const cond = unique.conditions;

            // Player level check
            if (cond.playerLevel) {
                const level = director.scene.gameStats?.level || 1;
                if (cond.playerLevel.min && level < cond.playerLevel.min) continue;
                if (cond.playerLevel.max && level > cond.playerLevel.max) continue;
            }

            // Enemies killed check
            if (cond.enemiesKilled) {
                const killed = director.scene.gameStats?.enemiesKilled || 0;
                if (cond.enemiesKilled.min && killed < cond.enemiesKilled.min) continue;
                if (cond.enemiesKilled.max && killed > cond.enemiesKilled.max) continue;
            }
        }

        // Random chance based on weight
        if (Math.random() * 100 < unique.weight) {
            const count = director.randomInRange(unique.countRange);
            for (let i = 0; i < count; i++) {
                director.spawnEnemy(unique.enemyId, { unique: true });
            }
            director.uniqueCooldowns.set(unique.enemyId, now);
            director.stats.uniqueSpawnCount++;
            getSession()?.log('spawn', 'unique_spawned', { enemyId: unique.enemyId, count, gameTime: Math.floor(now / 1000) });
        }
    }
}
