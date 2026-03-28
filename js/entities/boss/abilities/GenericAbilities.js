/**
 * GenericAbilities - Standalone functions for generic boss ability handlers
 *
 * Each function receives (bossAbilities, abilityData, params) where
 * bossAbilities provides access to boss, scene, and _schedule.
 */
import { DebugLogger } from '../../../core/debug/DebugLogger.js';

/**
 * Zakladni utok
 */
export function executeBasicAttack(bossAbilities, abilityData, params) {
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
    const count = abilityData.count || 8;
    const damage = abilityData.damage || 15;
    const spread = abilityData.spreadAngle || 360;

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * spread * (Math.PI / 180);

        bossAbilities._schedule(i * 100, () => {
            bossAbilities.boss.shoot('directional', {
                damage,
                angle,
                projectileId: abilityData.projectileId || 'projectile.boss_burst'
            });
        });
    }

    bossAbilities.boss.spawnVfx('vfx.boss.burst.charge', bossAbilities.boss.x, bossAbilities.boss.y);
    bossAbilities.boss.playSfx('sfx.boss.burst');

    return true;
}

/**
 * Spawn minionu
 */
export function executeMinionSpawn(bossAbilities, abilityData, params) {
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
    const radius = abilityData.radius || 150;
    const damage = abilityData.damage || 20;
    const center = params.center || { x: bossAbilities.boss.x, y: bossAbilities.boss.y };

    // Create damage area - deleguje na ProjectileSystem nebo VFXSystem
    if (bossAbilities.scene.vfxSystem) {
        bossAbilities.scene.vfxSystem.createDamageArea(center.x, center.y, radius, damage);
    }

    bossAbilities.boss.spawnVfx('vfx.boss.area.explosion', center.x, center.y);
    bossAbilities.boss.playSfx('sfx.boss.explosion');

    return true;
}

/**
 * Healing schopnost
 */
export function executeHealing(bossAbilities, abilityData, params) {
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
    const speedMultiplier = abilityData.speedMultiplier || 1.5;
    const damageMultiplier = abilityData.damageMultiplier || 1.3;
    const duration = abilityData.duration || 8000;

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
    const cloudCount = abilityData.cloudCount || 3;
    const cloudRadius = abilityData.cloudRadius || 80;
    const damage = abilityData.damage || 5;
    const duration = abilityData.duration || 8000;

    for (let i = 0; i < cloudCount; i++) {
        const angle = (i / cloudCount) * Math.PI * 2;
        const distance = 120;
        const cloudX = bossAbilities.boss.x + Math.cos(angle) * distance;
        const cloudY = bossAbilities.boss.y + Math.sin(angle) * distance;

        // Create toxic cloud - deleguje na VFXSystem
        if (bossAbilities.scene.vfxSystem) {
            bossAbilities.scene.vfxSystem.createToxicCloud(cloudX, cloudY, cloudRadius, damage, duration);
        }
    }

    bossAbilities.boss.playSfx('sfx.boss.toxic');

    return true;
}
