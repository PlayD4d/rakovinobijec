/**
 * RadiationCoreAbilities - Standalone functions for boss-specific ability handlers
 *
 * Each function receives (bossAbilities, abilityData, params) where
 * bossAbilities provides access to boss, scene, and _schedule.
 */
import { DebugLogger } from '../../../core/debug/DebugLogger.js';

/**
 * Radiation Pulse - expanding radioactive wave
 */
export function executeRadiationPulse(bossAbilities, abilityData, params) {
    DebugLogger.info('boss', '[BossAbilities] Executing radiation pulse');

    // Visual warning before damage
    if (bossAbilities.scene.vfxSystem) {
        // Warning circle that expands
        bossAbilities.scene.vfxSystem.play('boss.radiation.warning', bossAbilities.boss.x, bossAbilities.boss.y);

        // Actual pulse after warning
        bossAbilities._schedule(500, () => {
            if (bossAbilities.scene?.vfxSystem) {
                bossAbilities.scene.vfxSystem.play('boss.radiation.pulse', bossAbilities.boss.x, bossAbilities.boss.y);
            }
        });
    }

    // Play audio
    if (bossAbilities.scene.audioSystem) {
        bossAbilities.scene.audioSystem.play('sound/boss_radiation.mp3');
    }

    // Damage nearby player AFTER WARNING DELAY
    const pulseRange = abilityData.range || abilityData.radius || 140;
    const pulseDamage = abilityData.damage || 5;
    bossAbilities._schedule(500, () => {
        const player = bossAbilities.scene?.player;
        if (player && player.active && bossAbilities.boss) {
            const dx = bossAbilities.boss.x - player.x;
            const dy = bossAbilities.boss.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= pulseRange) {
                DebugLogger.info('boss', `[BossAbilities] Radiation pulse hit player for ${pulseDamage} damage at distance ${distance}`);
                if (player.takeDamage) {
                    player.takeDamage(pulseDamage, 'radiation');
                }
            }
        }
    });

    return true;
}

/**
 * Toxic Pools - create damaging pools on ground
 */
export function executeToxicPools(bossAbilities, abilityData, params) {
    DebugLogger.info('boss', '[BossAbilities] Executing toxic pools');

    // Play audio
    if (bossAbilities.scene.audioSystem) {
        bossAbilities.scene.audioSystem.play('sound/toxic_pools.mp3');
    }

    // Create multiple toxic pools around boss
    const poolCount = abilityData.poolCount || 3;
    const poolRadius = abilityData.poolRadius || 80;

    for (let i = 0; i < poolCount; i++) {
        const angle = (i / poolCount) * Math.PI * 2;
        const distance = 100 + Math.random() * 150;
        const poolX = bossAbilities.boss.x + Math.cos(angle) * distance;
        const poolY = bossAbilities.boss.y + Math.sin(angle) * distance;

        if (bossAbilities.scene.vfxSystem) {
            bossAbilities.scene.vfxSystem.play('boss.special', poolX, poolY);
        }
    }

    return true;
}

/**
 * Beam Sweep - rotating laser beam
 */
export function executeBeamSweep(bossAbilities, abilityData, params) {
    DebugLogger.info('boss', '[BossAbilities] Executing beam sweep');
    const player = bossAbilities.scene.player;
    if (!player?.active) return false;

    // VFX warning
    if (bossAbilities.scene.vfxSystem) {
        bossAbilities.scene.vfxSystem.play('boss.beam.warning', bossAbilities.boss.x, bossAbilities.boss.y);
    }

    // Deal damage to player if in range
    const dx = player.x - bossAbilities.boss.x;
    const dy = player.y - bossAbilities.boss.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const range = abilityData.range || 300;
    const damage = abilityData.damage || 10;

    if (dist <= range && player.canTakeDamage?.()) {
        bossAbilities._schedule(abilityData.chargeTime || 1000, () => {
            if (player?.active) {
                player.takeDamage(damage, bossAbilities.boss);
            }
        });
    }

    return true;
}

/**
 * Summon Irradiated - spawn irradiated enemies
 */
export function executeSummonIrradiated(bossAbilities, abilityData, params) {
    DebugLogger.info('boss', '[BossAbilities] Executing summon irradiated');
    return _spawnMinionsAroundBoss(
        bossAbilities,
        abilityData.count || 3,
        abilityData.enemyId || 'enemy.viral_swarm',
        100 + Math.random() * 100,
        'random'
    );
}

/**
 * Radiation Storm - area denial
 */
export function executeRadiationStorm(bossAbilities, abilityData, params) {
    DebugLogger.info('boss', '[BossAbilities] Executing radiation storm');
    const player = bossAbilities.scene.player;

    if (bossAbilities.scene.vfxSystem) {
        bossAbilities.scene.vfxSystem.play('boss.radiation.storm', bossAbilities.boss.x, bossAbilities.boss.y);
    }

    // DoT damage in radius over duration
    const damage = abilityData.damage || 3;
    const radius = abilityData.radius || 250;
    const ticks = Math.min(
        Math.floor((abilityData.stormDuration || 3000) / Math.max(abilityData.tickInterval || 500, 100)),
        30 // hard cap to prevent OOM from misconfigured blueprints
    );

    for (let i = 0; i < ticks; i++) {
        bossAbilities._schedule(i * (abilityData.tickInterval || 500), () => {
            if (!player?.active) return;
            const dx = player.x - bossAbilities.boss.x;
            const dy = player.y - bossAbilities.boss.y;
            if (dx * dx + dy * dy <= radius * radius) {
                player.takeDamage(damage, bossAbilities.boss);
            }
        });
    }

    return true;
}

/**
 * Rapid Beams - multiple quick beams
 */
export function executeRapidBeams(bossAbilities, abilityData, params) {
    DebugLogger.info('boss', '[BossAbilities] Executing rapid beams');
    const player = bossAbilities.scene.player;

    const beamCount = abilityData.beamCount || 5;
    const damage = abilityData.damage || 8;
    const range = abilityData.range || 350;

    for (let i = 0; i < beamCount; i++) {
        // fireRate is in ms (blueprint convention) — no *1000 conversion
        bossAbilities._schedule(i * (abilityData.fireRate || 300), () => {
            if (!player?.active) return;
            if (bossAbilities.scene?.vfxSystem) {
                bossAbilities.scene.vfxSystem.play('boss.beam.warning', bossAbilities.boss.x, bossAbilities.boss.y);
            }
            // Damage if in range
            const dx = player.x - bossAbilities.boss.x;
            const dy = player.y - bossAbilities.boss.y;
            if (dx * dx + dy * dy <= range * range) {
                player.takeDamage(damage, bossAbilities.boss);
            }
        });
    }

    return true;
}

/**
 * Massive Summon - spawn many enemies
 */
export function executeMassiveSummon(bossAbilities, abilityData, params) {
    DebugLogger.info('boss', '[BossAbilities] Executing massive summon');
    return _spawnMinionsAroundBoss(
        bossAbilities,
        abilityData.count || 8,
        abilityData.enemyId || 'enemy.viral_swarm',
        150,
        'circle'
    );
}

/**
 * Core Overload - devastating final attack
 */
export function executeCoreOverload(bossAbilities, abilityData, params) {
    DebugLogger.info('boss', '[BossAbilities] Executing core overload');

    if (bossAbilities.scene.vfxSystem) {
        bossAbilities.scene.vfxSystem.play('boss.overload.explosion', bossAbilities.boss.x, bossAbilities.boss.y);
    }

    if (bossAbilities.scene.audioSystem) {
        bossAbilities.scene.audioSystem.play('sound/core_overload.mp3');
    }

    // Massive damage to player
    const player = bossAbilities.scene.player;
    if (player && player.takeDamage) {
        const damage = abilityData.damage || 50;
        player.takeDamage(damage, 'overload');
    }

    return true;
}

/**
 * Shared minion spawn helper (DRY - used by summon_irradiated and massive_summon)
 * @param {object} bossAbilities - BossAbilities instance
 * @param {number} count - Number of enemies to spawn
 * @param {string} enemyId - Blueprint ID
 * @param {number} distance - Spawn distance from boss
 * @param {'circle'|'random'} arrangement - circle=evenly spaced, random=random angles
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
