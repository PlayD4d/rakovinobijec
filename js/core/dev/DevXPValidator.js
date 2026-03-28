/**
 * DevXPValidator - XP progression validation DEV command
 */

export function registerXPValidator(DEV, getScene) {

    DEV.validateXP = (spawnTableId) => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }

            if (!spawnTableId) {
                console.log('Usage: DEV.validateXP("spawnTable.level1")');
                return;
            }

            console.log(`\nXP Validation for ${spawnTableId}`);
            console.log('='.repeat(60));

            // Get spawn table
            const table = scene.blueprintLoader?.getSpawnTable(spawnTableId);
            if (!table) {
                console.error(`Spawn table not found: ${spawnTableId}`);
                return;
            }

            const xpPlan = table.meta?.extensions?.xpPlan;
            if (!xpPlan) {
                console.warn('No xpPlan found in spawn table meta.extensions');
                return;
            }

            // Get progression config
            const CR = window.ConfigResolver;
            const progressionXp = CR?.get('progression.xp');
            if (!progressionXp) {
                console.error('No progression.xp config found');
                return;
            }

            // Helper to get enemy XP
            const getEnemyXp = (enemyId) => {
                if (xpPlan.enemyXpOverrides?.[enemyId]) return xpPlan.enemyXpOverrides[enemyId];
                const bp = scene.blueprintLoader?.get(enemyId);
                if (bp?.stats?.xp) return bp.stats.xp;
                if (progressionXp.enemyXp?.[enemyId]) return progressionXp.enemyXp[enemyId];
                if (enemyId.startsWith('elite.')) return 20;
                if (enemyId.startsWith('unique.')) return 35;
                return 3;
            };

            const results = [];
            const targets = xpPlan.targetXpPerMinute;
            const pity = xpPlan.pity;

            console.log(`\nTarget budget: ${xpPlan.budgetTotal} XP total`);
            console.log(`Boss: ${xpPlan.boss.id} (${xpPlan.boss.xp} XP, cap ${xpPlan.boss.capLevelsGranted} levels)`);
            if (pity?.enabled) {
                console.log(`Pity: Min ${pity.minXpPerMinute} XP/min for first ${pity.untilMinute} minutes`);
            }

            console.log('\n' + '-'.repeat(60));
            console.log('| Min | Target | Actual | Delta | % Diff | Status |');
            console.log('|-----|--------|--------|-------|--------|--------|');

            let totalXp = 0;

            for (let minute = 0; minute < targets.length; minute++) {
                const startMs = minute * 60000;
                const endMs = (minute + 1) * 60000;

                let target = targets[minute] || targets[targets.length - 1];
                if (pity?.enabled && minute < (pity.untilMinute || 4)) {
                    target = Math.max(target, pity.minXpPerMinute || 60);
                }

                let actualXp = 0;
                table.enemyWaves?.forEach(wave => {
                    if (wave.startAt < endMs && wave.endAt > startMs) {
                        const enemyXp = getEnemyXp(wave.enemyId);
                        const avgCount = (wave.countRange[0] + wave.countRange[1]) / 2;
                        const spawnsPerMinute = 60000 / wave.interval;
                        const waveXp = enemyXp * avgCount * spawnsPerMinute * (wave.weight / 100);
                        actualXp += waveXp;
                    }
                });

                table.eliteWindows?.forEach(elite => {
                    if (elite.startAt < endMs && elite.endAt > startMs) {
                        const eliteXp = getEnemyXp(elite.enemyId);
                        const avgCount = (elite.countRange[0] + elite.countRange[1]) / 2;
                        const spawnsPerMinute = 60000 / (elite.cooldown || 15000);
                        const eliteContrib = eliteXp * avgCount * spawnsPerMinute * (elite.weight / 100);
                        actualXp += eliteContrib * 0.3;
                    }
                });

                totalXp += actualXp;

                const delta = actualXp - target;
                const percentDiff = ((actualXp - target) / target * 100).toFixed(1);
                const status = Math.abs(delta) <= target * 0.1 ? 'OK'
                    : Math.abs(delta) <= target * 0.2 ? 'WARN' : 'ERR';

                console.log(
                    `| ${String(minute).padEnd(3)} | ${String(target).padEnd(6)} | ` +
                    `${String(Math.round(actualXp)).padEnd(6)} | ${delta.toFixed(0).padEnd(5)} | ` +
                    `${percentDiff.padStart(6)}% | ${status.padEnd(6)} |`
                );

                results.push({ minute, target, actual: actualXp, delta, percentDiff: parseFloat(percentDiff), status });
            }

            console.log('-'.repeat(60));

            // Summary
            const avgDiff = results.reduce((sum, r) => sum + Math.abs(r.percentDiff), 0) / results.length;
            const withinTolerance = results.filter(r => Math.abs(r.percentDiff) <= 10).length;
            const warnings = results.filter(r => Math.abs(r.percentDiff) > 10 && Math.abs(r.percentDiff) <= 20).length;
            const errors = results.filter(r => Math.abs(r.percentDiff) > 20).length;

            console.log('\nSummary:');
            console.log(`  Total XP accumulated: ${Math.round(totalXp)}`);
            console.log(`  Budget target: ${xpPlan.budgetTotal}`);
            console.log(`  Average deviation: ${avgDiff.toFixed(1)}%`);
            console.log(`  OK (+-10%): ${withinTolerance}/${results.length}`);
            console.log(`  WARN (+-10-20%): ${warnings}/${results.length}`);
            console.log(`  ERR (>+-20%): ${errors}/${results.length}`);

            if (avgDiff <= 10) console.log('\nXP progression is well-tuned.');
            else if (avgDiff <= 20) console.log('\nXP progression needs minor adjustments.');
            else console.log('\nXP progression needs significant retuning.');

            // Boss XP validation
            if (xpPlan.boss) {
                const bossXp = xpPlan.boss.xp;
                const capLevels = xpPlan.boss.capLevelsGranted || 1.5;
                const baseReq = progressionXp.baseRequirement || 10;
                const scaling = progressionXp.scalingMultiplier || 1.5;
                const maxAllowed = baseReq * Math.pow(scaling, capLevels);
                const clamped = Math.min(bossXp, maxAllowed);

                console.log('\nBoss XP Validation:');
                console.log(`  Boss: ${xpPlan.boss.id}`);
                console.log(`  Configured XP: ${bossXp}`);
                console.log(`  Max allowed (${capLevels} levels): ${Math.round(maxAllowed)}`);
                console.log(`  Final XP: ${Math.round(clamped)} ${clamped < bossXp ? '(clamped)' : 'OK'}`);
            }

            console.log('\n' + '='.repeat(60));
        } catch (e) { console.error('[DEV] validateXP failed:', e); }
    };
}
