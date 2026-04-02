/**
 * RadiationCoreAbilities - Boss-specific ability handlers with full VFX
 *
 * Each function receives (bossAbilities, abilityData, params) where
 * bossAbilities provides access to boss, scene, and _schedule.
 *
 * Visual language:
 * - Telegraph (red 0xDD1111): warning — attack is charging, dodge now
 * - Beam/explosion (green 0x88CC00): active radiation damage
 * - Core overload (yellow 0xFFDD44): nuclear explosion
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

    bossAbilities.scene?.audioSystem?.play('sound/boss_radiation.mp3');

    // Damage + explosion VFX fires AFTER telegraph fills (green = active radiation)
    bossAbilities._schedule(warningTime, () => {
        if (!boss?.active) return;
        if (vfx?.playExplosionEffect) {
            vfx.playExplosionEffect(boss.x, boss.y, {
                color: 0x88CC00, radius: pulseRange, duration: 300
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
 * Toxic Pools - telegraph warning circles at pool positions, then green explosion
 */
export function executeToxicPools(bossAbilities, abilityData, params) {
    const poolCount = abilityData.poolCount || abilityData.count || 2;
    const boss = bossAbilities.boss;
    const vfx = bossAbilities.scene.vfxSystem;
    const warningTime = abilityData.warningTime || 800;

    getSession()?.log('boss', 'ability_execute', { ability: 'toxic_pools', poolCount });

    // Calculate pool positions upfront (so telegraph and explosion match)
    const pools = [];
    for (let i = 0; i < poolCount; i++) {
        const angle = (i / poolCount) * Math.PI * 2 + Math.random() * 0.5;
        const distance = 100 + Math.random() * 120;
        pools.push({
            x: boss.x + Math.cos(angle) * distance,
            y: boss.y + Math.sin(angle) * distance
        });
    }

    // Telegraph: red circle at each pool location
    for (const pool of pools) {
        if (vfx?.playTelegraph) {
            vfx.playTelegraph(pool.x, pool.y, {
                radius: 50, color: 0xDD1111, duration: warningTime
            });
        }
    }

    // Explosion after telegraph — green (toxic) + damage check
    const poolRadius = 50;
    const poolDamage = abilityData.damage || 15;

    bossAbilities._schedule(warningTime, () => {
        if (!boss?.active) return;
        for (const pool of pools) {
            if (vfx?.playExplosionEffect) {
                vfx.playExplosionEffect(pool.x, pool.y, {
                    color: 0x44BB00, radius: poolRadius, duration: 300
                });
            }
        }
        bossAbilities.scene?.audioSystem?.play('sound/toxic_pools.mp3');
        // Damage player if within any pool radius
        const player = bossAbilities.scene?.player;
        if (player?.active) {
            for (const pool of pools) {
                const dx = pool.x - player.x;
                const dy = pool.y - player.y;
                if (dx * dx + dy * dy <= poolRadius * poolRadius) {
                    player.takeDamage(poolDamage, 'toxic');
                    break;
                }
            }
        }
    });

    return true;
}

/**
 * Beam Sweep - directional telegraph with position lock + radioactive beam
 */
export function executeBeamSweep(bossAbilities, abilityData, params) {
    const range = abilityData.range || 300;
    const damage = abilityData.damage || 10;
    const chargeTime = abilityData.chargeTime || 1500;
    const beamWidth = abilityData.beamWidth || 40;
    const boss = bossAbilities.boss;
    const player = bossAbilities.scene.player;
    const vfx = bossAbilities.scene.vfxSystem;

    if (!player?.active) return false;

    getSession()?.log('boss', 'ability_execute', { ability: 'beam_sweep', range, damage });

    // Directional telegraph — tracks player, locks direction at 80% for dodge window
    if (vfx?.playDirectionalTelegraph) {
        vfx.playDirectionalTelegraph(boss.x, boss.y, {
            targetX: player.x, targetY: player.y,
            length: range, width: beamWidth,
            color: 0xDD1111,
            duration: chargeTime,
            followSource: boss,
            lockFraction: 0.80
        });
    }

    // Lock angle independently from VFX handle (captures even if VFX is unavailable)
    let lockedAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
    bossAbilities._schedule(Math.floor(chargeTime * 0.80), () => {
        if (player?.active && boss?.active) {
            lockedAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
        }
    });

    // After charge: beam fires in LOCKED direction
    bossAbilities._schedule(chargeTime, () => {
        if (!boss?.active) return;

        const angle = lockedAngle;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);

        // Radioactive green beam VFX (telegraph red → beam green = clear phase distinction)
        if (vfx?.playBeamEffect) {
            vfx.playBeamEffect(
                boss.x, boss.y,
                boss.x + dirX * range, boss.y + dirY * range,
                { color: 0x88CC00, width: 10, duration: 600 }
            );
        }

        // Damage if player is in beam line (within range + rough width check)
        if (player?.active) {
            const dx = player.x - boss.x;
            const dy = player.y - boss.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= range) {
                // Check if player is within beam width (perpendicular distance)
                const cross = Math.abs(dx * dirY - dy * dirX);
                if (cross <= beamWidth / 2) {
                    player.takeDamage(damage, bossAbilities.boss);
                }
            }
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
 * Radiation Storm - 3 rotating beams (boss version of player's radiotherapy)
 * Phase 1: Red wedge telegraph (reusable playWedgeTelegraph) — shows exact beam shape
 * Phase 2: Green rotating beams (reusable playRotatingBeams) — damage in arc narrowphase
 */
export function executeRadiationStorm(bossAbilities, abilityData, params) {
    const damage = abilityData.damage || 3;
    const radius = abilityData.radius || 250;
    const stormDuration = abilityData.stormDuration || 5000;
    const tickInterval = Math.max(abilityData.tickInterval || 400, 100);
    const chargeTime = abilityData.chargeTime || 600;
    const beamCount = abilityData.beamCount || 3;
    const beamWidth = abilityData.beamWidth || 0.4;
    const rotations = abilityData.rotations || 1.5;
    const boss = bossAbilities.boss;
    const player = bossAbilities.scene.player;
    const vfx = bossAbilities.scene.vfxSystem;

    getSession()?.log('boss', 'ability_execute', { ability: 'radiation_storm', damage, radius });

    // Phase 1: Wedge telegraph — red, same shape as beams, progressive fill
    if (vfx?.playWedgeTelegraph) {
        vfx.playWedgeTelegraph(boss.x, boss.y, {
            radius, beamCount, beamWidth,
            color: 0xDD1111,
            duration: chargeTime,
            followTarget: boss
        });
    }

    // Phase 2: Green rotating beams (after telegraph)
    bossAbilities._schedule(chargeTime, () => {
        if (!boss?.active) return;

        if (bossAbilities.scene.audioSystem) {
            bossAbilities.scene.audioSystem.play('sound/boss_radiation.mp3');
        }

        // Reusable rotating beam VFX
        if (vfx?.playRotatingBeams) {
            vfx.playRotatingBeams(boss.x, boss.y, {
                radius, beamCount, beamWidth,
                color: 0x88CC00,
                duration: stormDuration,
                rotations,
                followTarget: boss
            });
        }

        // Damage ticks — arc narrowphase
        const ticks = Math.min(Math.floor(stormDuration / tickInterval), 30);
        const rotSpeed = (Math.PI * 2 * rotations) / stormDuration;
        const angleStep = (Math.PI * 2) / beamCount;
        const halfW = beamWidth / 2;

        for (let i = 0; i < ticks; i++) {
            bossAbilities._schedule(i * tickInterval, () => {
                if (!player?.active || !boss?.active) return;
                const dx = player.x - boss.x;
                const dy = player.y - boss.y;
                if (dx * dx + dy * dy > radius * radius) return;

                let playerAngle = Math.atan2(dy, dx);
                if (playerAngle < 0) playerAngle += Math.PI * 2;

                const currentRot = (rotSpeed * (i * tickInterval)) % (Math.PI * 2);
                for (let b = 0; b < beamCount; b++) {
                    let beamAngle = (currentRot + angleStep * b) % (Math.PI * 2);
                    let diff = Math.abs(playerAngle - beamAngle);
                    if (diff > Math.PI) diff = Math.PI * 2 - diff;
                    if (diff <= halfW) {
                        player.takeDamage(damage, bossAbilities.boss);
                        break;
                    }
                }
            });
        }
    });

    return true;
}

/**
 * Radiation Beam - single targeted beam with position lock
 * Tracks player → locks direction → fires in locked direction
 * Player must dodge sideways during the lock window
 */
export function executeRapidBeams(bossAbilities, abilityData, params) {
    const damage = abilityData.damage || 8;
    const range = abilityData.range || 350;
    const beamWidth = abilityData.beamWidth || 36;
    const chargeTime = abilityData.chargeTime || 1200;
    const boss = bossAbilities.boss;
    const player = bossAbilities.scene.player;
    const vfx = bossAbilities.scene.vfxSystem;

    if (!player?.active) return false;

    getSession()?.log('boss', 'ability_execute', { ability: 'rapid_beams', beamCount: 1, damage });

    // Directional telegraph — tracks player, locks direction at 80%
    if (vfx?.playDirectionalTelegraph) {
        vfx.playDirectionalTelegraph(boss.x, boss.y, {
            targetX: player.x, targetY: player.y,
            length: range, width: beamWidth,
            color: 0xDD1111,
            duration: chargeTime,
            followSource: boss,
            lockFraction: 0.80
        });
    }

    // Lock angle independently from VFX handle
    let lockedAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
    bossAbilities._schedule(Math.floor(chargeTime * 0.80), () => {
        if (player?.active && boss?.active) {
            lockedAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
        }
    });

    // Beam fires in LOCKED direction after charge
    bossAbilities._schedule(chargeTime, () => {
        if (!boss?.active) return;

        const angle = lockedAngle;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);

        // Radioactive green beam (telegraph red → beam green)
        if (vfx?.playBeamEffect) {
            vfx.playBeamEffect(
                boss.x, boss.y,
                boss.x + dirX * range, boss.y + dirY * range,
                { color: 0x88CC00, width: 10, duration: 600 }
            );
        }

        // Damage check: player within beam line (range + perpendicular width)
        if (player?.active) {
            const dx = player.x - boss.x;
            const dy = player.y - boss.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= range) {
                const cross = Math.abs(dx * dirY - dy * dirX);
                if (cross <= beamWidth / 2) {
                    player.takeDamage(damage, bossAbilities.boss);
                }
            }
        }
    });

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
    const chargeTime = abilityData.chargeTime || 5000;
    const radius = abilityData.radius || 200;
    const boss = bossAbilities.boss;
    const vfx = bossAbilities.scene.vfxSystem;

    getSession()?.log('boss', 'ability_execute', { ability: 'core_overload', damage });

    // Two-layer telegraph: inner red circle + outer red circle for maximum visibility
    if (vfx?.playTelegraph) {
        vfx.playTelegraph(boss.x, boss.y, {
            radius,
            color: 0xDD1111,
            duration: chargeTime,
            followTarget: boss
        });
        // Second smaller inner telegraph for urgency
        vfx.playTelegraph(boss.x, boss.y, {
            radius: radius * 0.5,
            color: 0xFF4444,
            duration: chargeTime,
            followTarget: boss
        });
    }

    bossAbilities.scene?.audioSystem?.play('sound/boss_radiation.mp3');

    // Damage + nuclear explosion AFTER charge (bright yellow-white — distinct from telegraph)
    bossAbilities._schedule(chargeTime, () => {
        if (!boss?.active) return;
        if (vfx?.playExplosionEffect) {
            vfx.playExplosionEffect(boss.x, boss.y, {
                color: 0xFFDD44, radius, duration: 600
            });
        }
        bossAbilities.scene?.audioSystem?.play('sound/core_overload.mp3');
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
