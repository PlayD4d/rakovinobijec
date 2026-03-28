/**
 * XpRetuner - Adjusts spawn weights to match target XP/minute
 *
 * Extracted from SpawnDirector for modularity.
 * Handles xpPlan-based retuning and boss XP reward clamping.
 */

import { DebugLogger } from '../debug/DebugLogger.js';

export class XpRetuner {
    /**
     * @param {Object} blueprints - BlueprintLoader instance
     * @param {Object} config - ConfigResolver instance
     */
    constructor(blueprints, config) {
        this.blueprints = blueprints;
        this.config = config;
    }

    /**
     * PR7: Apply XP retuning based on xpPlan
     * This adjusts spawn weights to match target XP/minute
     */
    applyXpRetuning(table) {
        const xpPlan = table.meta?.extensions?.xpPlan;
        if (!xpPlan) return;

        const CR = this.config || window.ConfigResolver;
        const progressionXp = CR.get('progression.xp');
        if (!progressionXp) {
            DebugLogger.warn('spawn', 'No progression.xp config found');
            return;
        }

        DebugLogger.info('spawn', 'Applying XP retuning based on xpPlan:', xpPlan);

        // Get enemy XP values (priority: overrides -> blueprint -> global)
        const getEnemyXp = (enemyId) => {
            // 1. Check xpPlan overrides
            if (xpPlan.enemyXpOverrides && xpPlan.enemyXpOverrides[enemyId]) {
                return xpPlan.enemyXpOverrides[enemyId];
            }

            // 2. Check blueprint stats.xp
            const blueprint = this.blueprints?.get(enemyId);
            if (blueprint?.stats?.xp) {
                return blueprint.stats.xp;
            }

            // 3. Check global config
            if (progressionXp.enemyXp && progressionXp.enemyXp[enemyId]) {
                return progressionXp.enemyXp[enemyId];
            }

            // 4. Pattern matching for elite/unique
            if (enemyId.startsWith('elite.')) {
                return 20; // Default elite XP
            }
            if (enemyId.startsWith('unique.')) {
                return 35; // Default unique XP
            }

            // 5. Fallback
            return 3;
        };

        // Calculate expected XP/minute for each wave
        table.enemyWaves?.forEach((wave, index) => {
            const enemyXp = getEnemyXp(wave.enemyId);
            const avgCount = wave.countRange ? (wave.countRange[0] + wave.countRange[1]) / 2 : 1;
            const spawnsPerMinute = wave.interval > 0 ? 60000 / wave.interval : 0;

            // Base expected XP/min for this wave
            wave._baseXpPerMinute = enemyXp * avgCount * spawnsPerMinute;
            wave._originalWeight = wave.weight;

            DebugLogger.debug('spawn', `  Wave ${index} (${wave.enemyId}): ${wave._baseXpPerMinute.toFixed(1)} XP/min base`);
        });

        // Adjust weights to match target XP/minute
        const pity = xpPlan.pity;
        const targets = xpPlan.targetXpPerMinute;

        // Process each minute
        for (let minute = 0; minute < targets.length; minute++) {
            const startMs = minute * 60000;
            const endMs = (minute + 1) * 60000;

            // Get target for this minute (with pity floor)
            let targetXpPerMin = targets[minute] || targets[targets.length - 1];
            if (pity?.enabled && minute < (pity.untilMinute || 4)) {
                targetXpPerMin = Math.max(targetXpPerMin, pity.minXpPerMinute || 60);
            }

            // Find waves active in this minute
            const activeWaves = table.enemyWaves.filter(w =>
                w.startAt < endMs && w.endAt > startMs
            );

            if (activeWaves.length === 0) continue;

            // Calculate total base XP/min
            const totalBaseXp = activeWaves.reduce((sum, w) => sum + (w._baseXpPerMinute || 0), 0);

            if (totalBaseXp === 0) continue;

            // Calculate adjustment factor
            const adjustmentFactor = targetXpPerMin / totalBaseXp;

            DebugLogger.debug('spawn', `  Minute ${minute}: Target ${targetXpPerMin} XP/min, Factor ${adjustmentFactor.toFixed(2)}`);

            // Apply adjustment to weights
            activeWaves.forEach(wave => {
                // Adjust weight proportionally
                const newWeight = Math.max(0.1, Math.min(100, wave._originalWeight * adjustmentFactor));
                wave.weight = newWeight;

                // Optionally adjust spawn rate if weight alone isn't enough
                // Use _originalInterval to prevent cumulative drift on repeated calls
                if (!wave._originalInterval) wave._originalInterval = wave.interval;
                if (adjustmentFactor > 2.0) {
                    wave.interval = Math.max(1000, wave._originalInterval / 1.5);
                } else if (adjustmentFactor < 0.5) {
                    wave.interval = Math.min(10000, wave._originalInterval * 1.5);
                } else {
                    wave.interval = wave._originalInterval;
                }
            });
        }

        // Handle boss XP clamping
        if (xpPlan.boss) {
            const bossXp = xpPlan.boss.xp;
            const capLevels = xpPlan.boss.capLevelsGranted || 1.5;

            // Calculate max XP based on level cap
            const baseReq = progressionXp.baseRequirement || 10;
            const scaling = progressionXp.scalingMultiplier || 1.5;
            const maxLevelXp = baseReq * Math.pow(scaling, capLevels);

            // Clamp boss XP
            const clampedBossXp = Math.min(bossXp, maxLevelXp);

            // Update boss triggers with clamped XP
            table.bossTriggers?.forEach(trigger => {
                if (trigger.bossId === xpPlan.boss.id) {
                    trigger._xpReward = clampedBossXp;
                    DebugLogger.debug('spawn', `  Boss ${trigger.bossId}: ${clampedBossXp} XP (clamped from ${bossXp}`);
                }
            });
        }

        DebugLogger.info('spawn', 'XP retuning complete');
    }

    /**
     * Get XP reward for a boss (with clamping)
     * @param {Object} currentTable - The current spawn table
     * @param {string} bossId - Boss blueprint ID
     * @returns {number} XP reward
     */
    getBossXpReward(currentTable, bossId) {
        // Check if boss trigger has clamped XP
        const trigger = currentTable?.bossTriggers?.find(t => t.bossId === bossId);
        if (trigger?._xpReward) {
            return trigger._xpReward;
        }

        // Fallback to blueprint or config
        const CR = this.config || window.ConfigResolver;
        const progressionXp = CR.get('progression.xp');

        if (progressionXp?.enemyXp?.[bossId]) {
            return progressionXp.enemyXp[bossId];
        }

        // Default boss XP
        return 300;
    }
}
