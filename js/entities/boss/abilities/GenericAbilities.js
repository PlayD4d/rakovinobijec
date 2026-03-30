/**
 * GenericAbilities - Standalone functions for generic boss ability handlers
 *
 * Each function receives (bossAbilities, abilityData, params) where
 * bossAbilities provides access to boss, scene, and _schedule.
 */
import { DebugLogger } from '../../../core/debug/DebugLogger.js';
import { getSession } from '../../../core/debug/SessionLog.js';

/**
 * Zakladni utok
 */
export function executeBasicAttack(bossAbilities, abilityData, params) {
    getSession()?.log('boss', 'ability_execute', { ability: 'basic_attack', damage: abilityData.damage || 20 });
    const target = bossAbilities.scene.player;
    if (!target) return false;

    const damage = abilityData.damage || 20;
    const pattern = abilityData.pattern || 'single_shot';

    bossAbilities.boss.shoot(pattern, {
        damage,
        target,
        projectileId: abilityData.projectileId || 'projectile.boss_basic'
    });

    // Attack VFX/SFX
    bossAbilities.boss.spawnVfx('vfx.boss.attack.basic', bossAbilities.boss.x, bossAbilities.boss.y);
    bossAbilities.boss.playSfx('sfx.boss.attack');

    return true;
}

/**
 * Projektilovy burst
 */
export function executeProjectileBurst(bossAbilities, abilityData, params) {
    getSession()?.log('boss', 'ability_execute', { ability: 'projectile_burst', count: abilityData.count || 8, damage: abilityData.damage || 15 });
    const count = abilityData.count || 8;
    const damage = abilityData.damage || 15;
    const spread = abilityData.spreadAngle || 360;
    const chargeTime = abilityData.chargeTime || 600; // telegraph duration before firing

    // Telegraph: progressive fill at boss position warns player of incoming burst
    const vfx = bossAbilities.scene.vfxSystem;
    if (vfx?.playTelegraph) {
        vfx.playTelegraph(bossAbilities.boss.x, bossAbilities.boss.y, {
            radius: 50, color: 0xDD1111, duration: chargeTime, followTarget: bossAbilities.boss
        });
    }

    // Fire projectiles AFTER telegraph completes
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * spread * (Math.PI / 180);
        bossAbilities._schedule(chargeTime + i * 100, () => {
            bossAbilities.boss.shoot('directional', {
                damage, angle,
                projectileId: abilityData.projectileId || 'projectile.boss_burst'
            });
        });
    }

    bossAbilities.boss.playSfx('sfx.boss.burst');

    return true;
}

/**
 * Spawn minionu
 */
export function executeMinionSpawn(bossAbilities, abilityData, params) {
    getSession()?.log('boss', 'ability_execute', { ability: 'minion_spawn', count: abilityData.count || 3, enemyType: abilityData.enemyType || 'enemy.viral_swarm' });
    const count = abilityData.count || 3;
    const enemyType = abilityData.enemyType || 'enemy.viral_swarm';
    const spawnRadius = abilityData.spawnRadius || 100;

    bossAbilities.boss.spawnMinions(count, enemyType, { radius: spawnRadius });

    bossAbilities.boss.spawnVfx('vfx.boss.spawn.minions', bossAbilities.boss.x, bossAbilities.boss.y);
    bossAbilities.boss.playSfx('sfx.boss.summon');

    return true;
}

/**
 * Teleport strike
 */
export function executeTeleportStrike(bossAbilities, abilityData, params) {
    getSession()?.log('boss', 'ability_execute', { ability: 'teleport_strike', damage: abilityData.damage || 30 });
    const target = bossAbilities.scene.player;
    if (!target) return false;

    const damage = abilityData.damage || 30;

    // Deleguje na BossMovement system
    if (bossAbilities.boss.movement) {
        bossAbilities.boss.movement.executeTeleportStrike(target, damage);
    }

    bossAbilities.boss.playSfx('sfx.boss.teleport');

    return true;
}

/**
 * Dash utok
 */
export function executeDashAttack(bossAbilities, abilityData, params) {
    getSession()?.log('boss', 'ability_execute', { ability: 'dash_attack', damage: abilityData.damage || 25 });
    const target = bossAbilities.scene.player;
    if (!target) return false;

    const damage = abilityData.damage || 25;
    const dashDistance = abilityData.distance || 200;

    // Vypocitej smer k hraci
    const angle = Math.atan2(target.y - bossAbilities.boss.y, target.x - bossAbilities.boss.x);
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };

    // Deleguje na BossMovement system
    if (bossAbilities.boss.movement) {
        bossAbilities.boss.movement.executeDash(direction, dashDistance);
    }

    bossAbilities.boss.playSfx('sfx.boss.dash');

    return true;
}

/**
 * Area damage
 */
export function executeAreaDamage(bossAbilities, abilityData, params) {
    getSession()?.log('boss', 'ability_execute', { ability: 'area_damage', radius: abilityData.radius || 150, damage: abilityData.damage || 20 });
    const radius = abilityData.radius || 150;
    const damage = abilityData.damage || 20;
    const center = params.center || { x: bossAbilities.boss.x, y: bossAbilities.boss.y };
    const chargeTime = abilityData.chargeTime || 800;
    const scene = bossAbilities.scene;

    // Telegraph: progressive fill at impact location, sized to match damage area
    const isOnBoss = !params.center; // Only follow boss if center is default (boss position)
    if (scene.vfxSystem?.playTelegraph) {
        scene.vfxSystem.playTelegraph(center.x, center.y, {
            radius, color: 0xDD1111, duration: chargeTime,
            followTarget: isOnBoss ? bossAbilities.boss : null
        });
    }

    // Damage + explosion VFX fires AFTER telegraph
    bossAbilities._schedule(chargeTime, () => {
        const player = scene.player;
        if (player?.active) {
            const dx = player.x - center.x;
            const dy = player.y - center.y;
            if (dx * dx + dy * dy <= radius * radius) {
                player.takeDamage(damage, bossAbilities.boss);
            }
        }
        if (scene.vfxSystem?.playExplosionEffect) {
            scene.vfxSystem.playExplosionEffect(center.x, center.y, { color: 0xFF4400, radius });
        }
        bossAbilities.boss.playSfx('sfx.boss.explosion');
    });

    return true;
}

/**
 * Healing schopnost
 */
export function executeHealing(bossAbilities, abilityData, params) {
    getSession()?.log('boss', 'ability_execute', { ability: 'healing', healAmount: abilityData.healAmount || 50 });
    const healAmount = abilityData.healAmount || 50;
    const maxHealRatio = abilityData.maxHealRatio || 0.8; // Max 80% HP

    const maxAllowedHp = bossAbilities.boss.maxHp * maxHealRatio;
    const actualHeal = Math.min(healAmount, maxAllowedHp - bossAbilities.boss.hp);

    if (actualHeal > 0) {
        bossAbilities.boss.hp += actualHeal;

        bossAbilities.boss.spawnVfx('vfx.boss.heal', bossAbilities.boss.x, bossAbilities.boss.y);
        bossAbilities.boss.playSfx('sfx.boss.heal');

        DebugLogger.info('boss', `[BossAbilities] Boss healed for ${actualHeal} HP`);
    }

    return true;
}

/**
 * Shield schopnost
 */
export function executeShield(bossAbilities, abilityData, params) {
    getSession()?.log('boss', 'ability_execute', { ability: 'shield', shieldAmount: abilityData.shieldAmount || 30, duration: abilityData.duration || 5000 });
    const shieldAmount = abilityData.shieldAmount || 30;
    const duration = abilityData.duration || 5000;

    // Temporary damage reduction via flag
    bossAbilities.boss._shielded = true;

    bossAbilities._schedule(duration, () => {
        if (bossAbilities.boss) bossAbilities.boss._shielded = false;
    });

    bossAbilities.boss.spawnVfx('vfx.boss.shield.activate', bossAbilities.boss.x, bossAbilities.boss.y);
    bossAbilities.boss.playSfx('sfx.boss.shield');

    return true;
}

/**
 * Rage mode
 */
export function executeRageMode(bossAbilities, abilityData, params) {
    if (bossAbilities.boss._rageActive) return false;

    getSession()?.log('boss', 'ability_execute', { ability: 'rage_mode', speedMult: abilityData.speedMultiplier || 1.5, damageMult: abilityData.damageMultiplier || 1.3, duration: abilityData.duration || 8000 });
    const speedMultiplier = abilityData.speedMultiplier || 1.5;
    const damageMultiplier = abilityData.damageMultiplier || 1.3;
    const duration = abilityData.duration || 8000;

    bossAbilities.boss._rageActive = true;

    // Store original values
    const originalSpeed = bossAbilities.boss.moveSpeed;
    const originalDamage = bossAbilities.boss.damageMultiplier || 1.0;

    // Apply rage bonuses
    bossAbilities.boss.moveSpeed *= speedMultiplier;
    bossAbilities.boss.damageMultiplier = originalDamage * damageMultiplier;
    // Visual indicator via capability — setTint is a Phaser sprite method on BossCore
    if (bossAbilities.boss.setTint) bossAbilities.boss.setTint(0xFF4444);

    // Restore after duration (tracked for cleanup)
    bossAbilities._schedule(duration, () => {
        if (bossAbilities.boss) {
            bossAbilities.boss._rageActive = false;
            bossAbilities.boss.moveSpeed = originalSpeed;
            bossAbilities.boss.damageMultiplier = originalDamage;
            if (bossAbilities.boss.clearTint) bossAbilities.boss.clearTint();
        }
    });

    bossAbilities.boss.spawnVfx('vfx.boss.rage.activate', bossAbilities.boss.x, bossAbilities.boss.y);
    bossAbilities.boss.playSfx('sfx.boss.rage');

    return true;
}

/**
 * Toxic cloud
 */
export function executeToxicCloud(bossAbilities, abilityData, params) {
    getSession()?.log('boss', 'ability_execute', { ability: 'toxic_cloud', cloudCount: abilityData.cloudCount || 3, damage: abilityData.damage || 5 });
    const cloudCount = abilityData.cloudCount || 3;
    const cloudRadius = abilityData.cloudRadius || 80;
    const damage = abilityData.damage || 5;
    const duration = abilityData.duration || 8000;

    const scene = bossAbilities.scene;
    const player = scene.player;

    for (let i = 0; i < cloudCount; i++) {
        const angle = (i / cloudCount) * Math.PI * 2;
        const distance = 120;
        const cloudX = bossAbilities.boss.x + Math.cos(angle) * distance;
        const cloudY = bossAbilities.boss.y + Math.sin(angle) * distance;

        // Telegraph: progressive fill at each cloud position
        if (scene.vfxSystem?.playTelegraph) {
            scene.vfxSystem.playTelegraph(cloudX, cloudY, {
                radius: cloudRadius, color: 0x44BB00, duration: 800
            });
        }

        // Damage: periodic tick on player if in cloud radius (using scene.time)
        const tickInterval = 500;
        let ticks = 0;
        const maxTicks = Math.floor(duration / tickInterval);
        if (maxTicks <= 0) continue;
        const timer = scene.time.addEvent({
            delay: tickInterval,
            repeat: maxTicks - 1,
            callback: () => {
                if (!player?.active) return;
                const dx = player.x - cloudX;
                const dy = player.y - cloudY;
                if (dx * dx + dy * dy <= cloudRadius * cloudRadius) {
                    player.takeDamage(damage, 'toxic_cloud');
                }
                ticks++;
                // Re-pulse VFX every 2 ticks for lingering visual
                if (ticks % 4 === 0 && scene.vfxSystem) {
                    scene.vfxSystem.play('vfx.explosion.toxic', cloudX, cloudY);
                }
            }
        });
        // Track for cleanup if boss dies (scene.time.Clock auto-cleans on shutdown)
        if (bossAbilities._pendingTimers) bossAbilities._pendingTimers.push(timer);
    }

    bossAbilities.boss.playSfx('sfx.boss.toxic');

    return true;
}
