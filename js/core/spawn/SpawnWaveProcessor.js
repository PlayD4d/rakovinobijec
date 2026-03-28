/**
 * SpawnWaveProcessor - Zpracování vln nepřátel, elitních a unikátních spawnů
 *
 * Extrahováno ze SpawnDirector pro dodržení limitu 500 LOC.
 * Všechny funkce přijímají `director` (SpawnDirector instance) jako první parametr.
 */

import { DebugLogger } from '../debug/DebugLogger.js';

/**
 * Process regular enemy waves
 * @param {SpawnDirector} director
 */
export function processEnemyWaves(director) {
    if (!director.currentTable.enemyWaves) return;

    const now = director.gameTime;
    const maxEnemies = director._maxEnemies;

    // Read enemy count ONCE per frame
    let enemyCount = director.scene.enemiesGroup ? director.scene.enemiesGroup.countActive() : 0;
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
        if (Math.random() * 100 >= weight) continue;

        const remainingSlots = maxEnemies - enemyCount;
        if (remainingSlots <= 0) break;

        let count = wave.countRange ? director.randomInRange(wave.countRange) : 1;
        count = Math.min(count, remainingSlots, 5);

        for (let i = 0; i < count; i++) {
            director.spawnEnemy(wave.enemyId, { wave: true });
        }
        wave.lastSpawn = now;
        enemyCount += count;

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

    // PR7: Check if we can spawn more enemies
    const currentEnemyCount = director.scene.enemiesGroup ? director.scene.enemiesGroup.countActive() : 0;
    const maxEnemies = director._maxEnemies;

    if (currentEnemyCount >= maxEnemies - 5) { // Leave room for regular spawns
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
        }
    }
}

/**
 * Process unique enemy spawns
 * @param {SpawnDirector} director
 */
export function processUniqueSpawns(director) {
    if (!director.currentTable.uniqueSpawns) return;

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
        }
    }
}
