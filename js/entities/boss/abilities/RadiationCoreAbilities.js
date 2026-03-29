/**
 * RadiationCoreAbilities - Standalone functions for boss-specific ability handlers
 *
 * Each function receives (bossAbilities, abilityData, params) where
 * bossAbilities provides access to boss, scene, and _schedule.
 */
import { DebugLogger } from '../../../core/debug/DebugLogger.js';
import { getSession } from '../../../core/debug/SessionLog.js';

/**
 * Radiation Pulse - expanding radioactive wave
 */
export function executeRadiationPulse(bossAbilities, abilityData, params) {
    getSession()?.log('boss', 'ability_execute', { ability: 'radiation_pulse', range: abilityData.range || abilityData.radius || 140, damage: abilityData.damage || 5 });
    DebugLogger.info('boss', '[BossAbilities] Executing radiation pulse');

    const pulseRange = abilityData.range || abilityData.radius || 140;
    const pulseDamage = abilityData.damage || 5;
    const warningTime = abilityData.warningTime || 800;
    const vfx = bossAbilities.scene.vfxSystem;

    // Telegraph: pulsing green circle showing exact damage radius
    if (vfx?.playTelegraph) {
        vfx.playTelegraph(bossAbilities.boss.x, bossAbilities.boss.y, {
            radius: pulseRange, color: 0xCCFF00, duration: warningTime, fillAlpha: 0.1, pulses: 3
        });
    }

    if (bossAbilities.scene.audioSystem) {
        bossAbilities.scene.audioSystem.play('sound/boss_radiation.mp3');
    }

    // Damage + explosion VFX fires AFTER telegraph warning
    bossAbilities._schedule(warningTime, () => {
        if (vfx) vfx.play('boss.radiation.pulse', bossAbilities.boss.x, bossAbilities.boss.y);
        if (vfx?.playExplosionEffect) {
            vfx.playExplosionEffect(bossAbilities.boss.x, bossAbilities.boss.y, {
                color: 0xCCFF00, radius: pulseRange, duration: 300
            });
        }
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
    getSession()?.log('boss', 'ability_execute', { ability: 'toxic_pools', poolCount: abilityData.poolCount || 3 });
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
    getSession()?.log('boss', 'ability_execute', { ability: 'beam_sweep', range: abilityData.range || 300, damage: abilityData.damage || 10 });
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
    getSession()?.log('boss', 'ability_execute', { ability: 'summon_irradiated', count: abilityData.count || 3 });
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
    getSession()?.log('boss', 'ability_execute', { ability: 'radiation_storm', damage: abilityData.damage || 3, radius: abilityData.radius || 250 });
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
    getSession()?.log('boss', 'ability_execute', { ability: 'rapid_beams', beamCount: abilityData.beamCount || 5, damage: abilityData.damage || 8 });
    DebugLogger.info('boss', '[BossAbilities] Executing rapid beams');
    const player = bossAbilities.scene.player;

    const beamCount = abilityData.beamCount || 5;
    const damage = abilityData.damage || 8;
    const range = abilityData.range || 350;

    // fireRate: blueprint may use seconds (0.3) or ms (300) — normalize to ms
    let fireRateMs = abilityData.fireRate || 300;
    if (fireRateMs < 10) fireRateMs *= 1000; // Convert seconds to ms

    for (let i = 0; i < beamCount; i++) {
        bossAbilities._schedule(i * fireRateMs, () => {
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
    getSession()?.log('boss', 'ability_execute', { ability: 'massive_summon', count: abilityData.count || 8 });
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
    getSession()?.log('boss', 'ability_execute', { ability: 'core_overload', damage: abilityData.damage || 50 });
    DebugLogger.info('boss', '[BossAbilities] Executing core overload');

    const damage = abilityData.damage || 50;
    const chargeTime = abilityData.chargeTime || 1500;
    const radius = abilityData.radius || 200;
    const vfx = bossAbilities.scene.vfxSystem;

    // Telegraph: large pulsing danger circle + charge-up particles
    if (vfx?.playTelegraph) {
        vfx.playTelegraph(bossAbilities.boss.x, bossAbilities.boss.y, {
            radius, color: 0xFFDD00, duration: chargeTime, fillAlpha: 0.2, pulses: 5
        });
    }
    if (vfx) {
        vfx.play('boss.overload.charge', bossAbilities.boss.x, bossAbilities.boss.y);
    }

    // Damage + explosion AFTER charge
    bossAbilities._schedule(chargeTime, () => {
        if (vfx) vfx.play('boss.overload.explosion', bossAbilities.boss.x, bossAbilities.boss.y);
        if (vfx?.playExplosionEffect) {
            vfx.playExplosionEffect(bossAbilities.boss.x, bossAbilities.boss.y, {
                color: 0xFFDD00, radius, duration: 500
            });
        }
        if (bossAbilities.scene.audioSystem) {
            bossAbilities.scene.audioSystem.play('sound/core_overload.mp3');
        }
        const player = bossAbilities.scene.player;
        if (player?.active) {
            const dx = player.x - bossAbilities.boss.x;
            const dy = player.y - bossAbilities.boss.y;
            if (dx * dx + dy * dy <= radius * radius) {
                player.takeDamage(damage, 'overload');
            }
        }
    });

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
