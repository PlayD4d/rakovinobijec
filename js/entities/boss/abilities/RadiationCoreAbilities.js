/**
 * RadiationCoreAbilities - Boss-specific ability handlers with full VFX
 *
 * Each function receives (bossAbilities, abilityData, params) where
 * bossAbilities provides access to boss, scene, and _schedule.
 *
 * All abilities use:
 * - playTelegraph: progressive fill circle that follows boss
 * - playDangerZone: persistent area for DoT abilities
 * - playBeamEffect: visible beam line for beam attacks
 * - playExplosionEffect: burst on damage impact
 */
import { DebugLogger } from '../../../core/debug/DebugLogger.js';
import { getSession } from '../../../core/debug/SessionLog.js';

/**
 * Radiation Pulse - expanding radioactive wave with progressive telegraph
 */
export function executeRadiationPulse(bossAbilities, abilityData, params) {
    const pulseRange = abilityData.range || abilityData.radius || 140;
    const pulseDamage = abilityData.damage || 5;
    const warningTime = abilityData.warningTime || 800;
    const boss = bossAbilities.boss;
    const vfx = bossAbilities.scene.vfxSystem;

    getSession()?.log('boss', 'ability_execute', { ability: 'radiation_pulse', range: pulseRange, damage: pulseDamage });

    // Telegraph: progressive red fill circle that follows boss
    if (vfx?.playTelegraph) {
        vfx.playTelegraph(boss.x, boss.y, {
            radius: pulseRange,
            color: 0xDD1111,
            duration: warningTime,
            followTarget: boss
        });
    }

    if (bossAbilities.scene.audioSystem) {
        bossAbilities.scene.audioSystem.play('sound/boss_radiation.mp3');
    }

    // Damage + explosion VFX fires AFTER telegraph fills
    bossAbilities._schedule(warningTime, () => {
        if (!boss?.active) return;
        if (vfx?.playExplosionEffect) {
            vfx.playExplosionEffect(boss.x, boss.y, {
                color: 0xDD1111, radius: pulseRange, duration: 300
            });
        }
        const player = bossAbilities.scene?.player;
        if (player?.active) {
            const dx = boss.x - player.x;
            const dy = boss.y - player.y;
            if (dx * dx + dy * dy <= pulseRange * pulseRange) {
                player.takeDamage(pulseDamage, 'radiation');
            }
        }
    });

    return true;
}

/**
 * Toxic Pools - create damaging pools on ground (VFX only — cosmetic hazards)
 */
export function executeToxicPools(bossAbilities, abilityData, params) {
    const poolCount = abilityData.poolCount || abilityData.count || 3;
    getSession()?.log('boss', 'ability_execute', { ability: 'toxic_pools', poolCount });

    if (bossAbilities.scene.audioSystem) {
        bossAbilities.scene.audioSystem.play('sound/toxic_pools.mp3');
    }

    const boss = bossAbilities.boss;
    const vfx = bossAbilities.scene.vfxSystem;

    for (let i = 0; i < poolCount; i++) {
        const angle = (i / poolCount) * Math.PI * 2;
        const distance = 100 + Math.random() * 150;
        const poolX = boss.x + Math.cos(angle) * distance;
        const poolY = boss.y + Math.sin(angle) * distance;

        if (vfx) {
            vfx.play('boss.special', poolX, poolY);
        }
    }

    return true;
}

/**
 * Beam Sweep - directional rectangle telegraph + beam VFX
 */
export function executeBeamSweep(bossAbilities, abilityData, params) {
    const range = abilityData.range || 300;
    const damage = abilityData.damage || 10;
    const chargeTime = abilityData.chargeTime || 1000;
    const beamWidth = abilityData.beamWidth || 40;
    const boss = bossAbilities.boss;
    const player = bossAbilities.scene.player;
    const vfx = bossAbilities.scene.vfxSystem;

    if (!player?.active) return false;

    getSession()?.log('boss', 'ability_execute', { ability: 'beam_sweep', range, damage });

    // Directional rectangle telegraph — aims at player, fills along length
    if (vfx?.playDirectionalTelegraph) {
        vfx.playDirectionalTelegraph(boss.x, boss.y, {
            targetX: player.x, targetY: player.y,
            length: range, width: beamWidth,
            color: 0xDD1111,
            duration: chargeTime,
            followSource: boss
        });
    }

    // After charge: beam fires + damage
    bossAbilities._schedule(chargeTime, () => {
        if (!boss?.active || !player?.active) return;

        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Beam VFX line from boss toward player
        if (vfx?.playBeamEffect) {
            const dirX = dist > 0 ? dx / dist : 1;
            const dirY = dist > 0 ? dy / dist : 0;
            vfx.playBeamEffect(
                boss.x, boss.y,
                boss.x + dirX * range, boss.y + dirY * range,
                { color: 0xFF2200, width: beamWidth * 0.3, duration: 300 }
            );
        }

        if (dist <= range) {
            player.takeDamage(damage, bossAbilities.boss);
        }
    });

    return true;
}

/**
 * Summon Irradiated - spawn irradiated enemies
 */
export function executeSummonIrradiated(bossAbilities, abilityData, params) {
    getSession()?.log('boss', 'ability_execute', { ability: 'summon_irradiated', count: abilityData.count || 3 });
    return _spawnMinionsAroundBoss(
        bossAbilities,
        abilityData.count || 3,
        abilityData.enemyId || 'enemy.viral_swarm',
        100 + Math.random() * 100,
        'random'
    );
}

/**
 * Radiation Storm - persistent danger zone with visible area + DoT ticks
 */
export function executeRadiationStorm(bossAbilities, abilityData, params) {
    const damage = abilityData.damage || 3;
    const radius = abilityData.radius || 250;
    const stormDuration = abilityData.stormDuration || 3000;
    const tickInterval = Math.max(abilityData.tickInterval || 500, 100);
    const boss = bossAbilities.boss;
    const player = bossAbilities.scene.player;
    const vfx = bossAbilities.scene.vfxSystem;

    getSession()?.log('boss', 'ability_execute', { ability: 'radiation_storm', damage, radius });

    // Persistent danger zone — visible pulsing circle on ground for full duration
    if (vfx?.playDangerZone) {
        vfx.playDangerZone(boss.x, boss.y, {
            radius,
            color: 0xDD1111,
            duration: stormDuration,
            followTarget: boss
        });
    }

    if (bossAbilities.scene.audioSystem) {
        bossAbilities.scene.audioSystem.play('sound/boss_radiation.mp3');
    }

    // DoT damage ticks in radius over duration
    const ticks = Math.min(Math.floor(stormDuration / tickInterval), 30);

    for (let i = 0; i < ticks; i++) {
        bossAbilities._schedule(i * tickInterval, () => {
            if (!player?.active || !boss?.active) return;
            const dx = player.x - boss.x;
            const dy = player.y - boss.y;
            if (dx * dx + dy * dy <= radius * radius) {
                player.takeDamage(damage, bossAbilities.boss);
            }
        });
    }

    return true;
}

/**
 * Rapid Beams - directional telegraph per beam + visible beam line VFX
 */
export function executeRapidBeams(bossAbilities, abilityData, params) {
    const beamCount = abilityData.beamCount || 5;
    const damage = abilityData.damage || 8;
    const range = abilityData.range || 350;
    const beamWidth = 30;
    const boss = bossAbilities.boss;
    const player = bossAbilities.scene.player;
    const vfx = bossAbilities.scene.vfxSystem;

    getSession()?.log('boss', 'ability_execute', { ability: 'rapid_beams', beamCount, damage });

    // fireRate: blueprint may use seconds (0.3) or ms (300) — normalize to ms
    let fireRateMs = abilityData.fireRate || 300;
    if (fireRateMs < 10) fireRateMs *= 1000;

    // Each beam gets its own short directional telegraph, then fires
    for (let i = 0; i < beamCount; i++) {
        const telegraphTime = Math.min(fireRateMs * 0.6, 250); // Brief warning before each beam

        bossAbilities._schedule(i * fireRateMs, () => {
            if (!player?.active || !boss?.active) return;

            // Directional telegraph — rectangle toward current player position
            if (vfx?.playDirectionalTelegraph) {
                vfx.playDirectionalTelegraph(boss.x, boss.y, {
                    targetX: player.x, targetY: player.y,
                    length: range, width: beamWidth,
                    color: 0xDD1111,
                    duration: telegraphTime,
                    followSource: boss
                });
            }

            // Beam fires after telegraph completes
            bossAbilities._schedule(telegraphTime, () => {
                if (!player?.active || !boss?.active) return;

                const dx = player.x - boss.x;
                const dy = player.y - boss.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Beam VFX line
                if (vfx?.playBeamEffect) {
                    const dirX = dist > 0 ? dx / dist : 1;
                    const dirY = dist > 0 ? dy / dist : 0;
                    vfx.playBeamEffect(
                        boss.x, boss.y,
                        boss.x + dirX * range, boss.y + dirY * range,
                        { color: 0xFF2200, width: 5, duration: 200 }
                    );
                }

                if (dist <= range) {
                    player.takeDamage(damage, bossAbilities.boss);
                }
            });
        });
    }

    return true;
}

/**
 * Massive Summon - spawn many enemies
 */
export function executeMassiveSummon(bossAbilities, abilityData, params) {
    getSession()?.log('boss', 'ability_execute', { ability: 'massive_summon', count: abilityData.count || 8 });
    return _spawnMinionsAroundBoss(
        bossAbilities,
        abilityData.count || 8,
        abilityData.enemyId || 'enemy.viral_swarm',
        150,
        'circle'
    );
}

/**
 * Core Overload - devastating attack with long progressive telegraph
 */
export function executeCoreOverload(bossAbilities, abilityData, params) {
    const damage = abilityData.damage || 50;
    const chargeTime = abilityData.chargeTime || 1500;
    const radius = abilityData.radius || 200;
    const boss = bossAbilities.boss;
    const vfx = bossAbilities.scene.vfxSystem;

    getSession()?.log('boss', 'ability_execute', { ability: 'core_overload', damage });

    // Long progressive telegraph — fills slowly, bright red, follows boss
    if (vfx?.playTelegraph) {
        vfx.playTelegraph(boss.x, boss.y, {
            radius,
            color: 0xFF2200,
            duration: chargeTime,
            followTarget: boss
        });
    }

    if (bossAbilities.scene.audioSystem) {
        bossAbilities.scene.audioSystem.play('sound/boss_radiation.mp3');
    }

    // Damage + explosion AFTER charge
    bossAbilities._schedule(chargeTime, () => {
        if (!boss?.active) return;
        if (vfx?.playExplosionEffect) {
            vfx.playExplosionEffect(boss.x, boss.y, {
                color: 0xFF2200, radius, duration: 500
            });
        }
        if (bossAbilities.scene.audioSystem) {
            bossAbilities.scene.audioSystem.play('sound/core_overload.mp3');
        }
        const player = bossAbilities.scene.player;
        if (player?.active) {
            const dx = player.x - boss.x;
            const dy = player.y - boss.y;
            if (dx * dx + dy * dy <= radius * radius) {
                player.takeDamage(damage, 'overload');
            }
        }
    });

    return true;
}

/**
 * Shared minion spawn helper (DRY - used by summon_irradiated and massive_summon)
 */
function _spawnMinionsAroundBoss(bossAbilities, count, enemyId, distance, arrangement = 'circle') {
    if (!bossAbilities.scene?.enemyManager || !bossAbilities.boss) return false;
    for (let i = 0; i < count; i++) {
        const angle = arrangement === 'circle'
            ? (i / count) * Math.PI * 2
            : Math.random() * Math.PI * 2;
        const d = arrangement === 'random' ? distance * (0.5 + Math.random() * 0.5) : distance;
        const x = bossAbilities.boss.x + Math.cos(angle) * d;
        const y = bossAbilities.boss.y + Math.sin(angle) * d;
        bossAbilities.scene.enemyManager.spawnEnemy(enemyId, { x, y });
    }
    return true;
}
