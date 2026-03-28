/**
 * Centralizovaná registrace všech kolizí pro GameScene
 * PR7 compliant - single source of truth pro fyzikální interakce
 */

import { DebugLogger } from '../core/debug/DebugLogger.js';

// ===== DRY helpers (shared between enemy and boss collision handlers) =====

/** Apply piercing damage reduction to bullet damage */
function applyPiercingReduction(bullet, baseDamage) {
    if (bullet.piercing && bullet.hitCount > 0 && bullet.damageReduction) {
        return baseDamage * Math.pow(1 - bullet.damageReduction, bullet.hitCount);
    }
    return baseDamage;
}

/** Handle bullet after hit: return to pool (kill) or increment hitCount for piercing */
function handleBulletAfterHit(bullet) {
    if (!bullet.piercing || bullet.hitCount >= bullet.maxPiercing) {
        // Use kill() for pool recycling (disableBody), fallback to destroy for non-pooled
        if (bullet.kill) bullet.kill(); else bullet.destroy();
    } else {
        bullet.hitCount = (bullet.hitCount || 0) + 1;
    }
}

/** Kill or destroy a bullet (pooled objects use kill(), others use destroy()) */
function killBullet(bullet) {
    if (bullet.kill) bullet.kill(); else bullet.destroy();
}

/**
 * Nastaví všechny kolize pro herní scénu
 * @param {Phaser.Scene} scene - GameScene instance
 * @returns {Array} Colliders pro DisposableRegistry cleanup
 */
export function setupCollisions(scene) {
    // Validace
    if (!scene || !scene.physics) {
        DebugLogger.error('collision', '[setupCollisions] Invalid scene or physics not initialized');
        return [];
    }
    
    DebugLogger.info('collision', '[setupCollisions] Setting up collisions...');
    
    const colliders = [];

    // Shared processCallback: skip inactive objects BEFORE allocating callback frame
    const activeFilter = (a, b) => a.active && b.active;

    // Player vs Enemies collision
    if (scene.player && scene.enemiesGroup) {
        const collider = scene.physics.add.overlap(
            scene.player,
            scene.enemiesGroup,
            (player, enemy) => {
                handlePlayerEnemyCollision(player, enemy);
            },
            activeFilter,
            scene
        );
        colliders.push(collider);
        DebugLogger.info('collision', '[setupCollisions] Registered Player vs Enemies collision');
    }

    // Player vs Boss collision
    if (scene.player && scene.bossGroup) {
        colliders.push(
            scene.physics.add.overlap(
                scene.player,
                scene.bossGroup,
                (player, boss) => { handlePlayerBossCollision.call(scene, player, boss); },
                activeFilter,
                scene
            )
        );
    }

    // Player bullets vs Enemies
    if (scene.projectileSystem?.playerBullets && scene.enemiesGroup) {
        const collider = scene.physics.add.overlap(
            scene.projectileSystem.playerBullets,
            scene.enemiesGroup,
            (bullet, enemy) => {
                handlePlayerBulletEnemyCollision.call(scene, bullet, enemy);
            },
            activeFilter,
            scene
        );
        colliders.push(collider);
        DebugLogger.info('collision', '[setupCollisions] Registered Player bullets vs Enemies collision');
    } else {
        DebugLogger.info('collision', '[setupCollisions] SKIPPED Player bullets vs Enemies - missing components');
    }

    // Player bullets vs Boss
    if (scene.projectileSystem?.playerBullets && scene.bossGroup) {
        colliders.push(
            scene.physics.add.overlap(
                scene.projectileSystem.playerBullets,
                scene.bossGroup,
                (bullet, boss) => {
                    handlePlayerBulletBossCollision.call(scene, bullet, boss);
                },
                activeFilter,
                scene
            )
        );
    }

    // Enemy bullets vs Player
    // CRITICAL: Player (sprite) must be first parameter, enemyBullets (group) second
    // This ensures Phaser passes parameters in correct order
    if (scene.projectileSystem?.enemyBullets && scene.player) {
        const collider = scene.physics.add.overlap(
            scene.player,                          // Sprite first (Phaser convention)
            scene.projectileSystem.enemyBullets,   // Group second
            (player, bullet) => {
                handleEnemyBulletPlayerCollision(bullet, player);
            },
            activeFilter,
            scene
        );
        colliders.push(collider);
        DebugLogger.info('collision', '[setupCollisions] Registered Enemy bullets vs Player collision (sprite-first order)');
    } else {
        DebugLogger.info('collision', '[setupCollisions] SKIPPED Enemy bullets vs Player - missing components');
    }

    // Player vs Loot
    if (scene.lootSystem?.lootGroup && scene.player) {
        colliders.push(
            scene.physics.add.overlap(
                scene.player,
                scene.lootSystem.lootGroup,
                (player, loot) => scene.lootSystem.handlePickup(player, loot),
                activeFilter,
                scene
            )
        );
    }

    DebugLogger.debug('collision', `[setupCollisions] Registered ${colliders.length} collisions`);
    return colliders;
}

/**
 * Handle player-enemy collision
 */
function handlePlayerEnemyCollision(player, enemy) {
    if (!player.active || !enemy.active) return;

    if (player.canTakeDamage && player.canTakeDamage()) {
        const damage = enemy.contactDamage || enemy.damage || 10;
        player.takeDamage(damage);
    }
}

/**
 * Handle player-boss collision
 */
function handlePlayerBossCollision(player, boss) {
    if (!player.active || !boss.active) return;
    
    // Check if player can take damage
    if (player.canTakeDamage && player.canTakeDamage()) {
        const damage = boss.contactDamage || boss.damage || 20;
        player.takeDamage(damage);
    }
}

/**
 * Handle player bullet hitting enemy
 */
function handlePlayerBulletEnemyCollision(bullet, enemy) {
    const scene = this; // 'this' is bound to the scene
    
    if (!bullet.active || !enemy.active) return;
    
    // Skip loot items
    if (enemy.type === 'xp' || enemy.type === 'health' || enemy.type === 'metotrexat') {
        return;
    }
    
    if (!enemy.takeDamage || typeof enemy.takeDamage !== 'function') {
        return;
    }
    
    // Apply damage with piercing reduction (DRY helper)
    let damage = applyPiercingReduction(bullet, bullet.damage || scene.player?.baseStats?.projectileDamage || 10);
    enemy.takeDamage(damage);
    
    // Handle explosive bullets from chemo_reservoir power-up
    if (scene.player?.chemoAuraActive && scene.player.chemoAuraConfig?.enableExplosions) {
        const explosionRadius = scene.player.getExplosionRadius ? scene.player.getExplosionRadius() : 35;
        let explosionDamage = scene.player.getExplosionDamage ? scene.player.getExplosionDamage() : damage * 0.5;
        explosionDamage = Number(explosionDamage) || (damage * 0.5);

        // createExplosion handles VFX+SFX internally — no duplicate calls here
        if (scene.projectileSystem?.createExplosion) {
            scene.projectileSystem.createExplosion(
                bullet.x, bullet.y,
                explosionDamage,
                explosionRadius,
                1
            );
        }
    }
    
    handleBulletAfterHit(bullet);

    // VFX/SFX - Silent fail mode
    try {
        if (enemy._vfx?.hit && scene.vfxSystem) {
            scene.vfxSystem.play(enemy._vfx.hit, enemy.x, enemy.y);
        }
    } catch (error) {
        DebugLogger.debug('vfx', '[VFX] Failed to play hit effect, continuing:', error.message);
    }
    
    try {
        if (enemy._sfx?.hit && scene.audioSystem) {
            scene.audioSystem.play(enemy._sfx.hit);
        }
    } catch (error) {
        DebugLogger.debug('sfx', '[SFX] Failed to play hit sound, continuing:', error.message);
    }
}

/**
 * Handle player bullet hitting boss
 */
function handlePlayerBulletBossCollision(bullet, boss) {
    const scene = this;
    if (!bullet.active || !boss.active) return;

    // Apply damage with piercing reduction (DRY helper)
    const damage = applyPiercingReduction(bullet, bullet.damage || scene?.player?.baseStats?.projectileDamage || 10);
    if (boss.takeDamage) boss.takeDamage(damage);

    // VFX/SFX hit feedback
    try {
        if (boss._vfx?.hit && scene?.vfxSystem) scene.vfxSystem.play(boss._vfx.hit, boss.x, boss.y);
        if (boss._sfx?.hit && scene?.audioSystem) scene.audioSystem.play(boss._sfx.hit);
    } catch (_) {}

    handleBulletAfterHit(bullet);
}

/**
 * Handle enemy bullet hitting player
 */
function handleEnemyBulletPlayerCollision(bullet, player) {
    if (!bullet.active || !player.active) {
        return;
    }
    
    // Apply damage if player can take it
    if (player.canTakeDamage?.()) {
        player.takeDamage(bullet.damage || 5);
    }
    // Always destroy bullet (DRY helper handles kill vs destroy)
    killBullet(bullet);
}

// Export callbacks for testing
export const collisionHandlers = {
    handlePlayerEnemyCollision,
    handlePlayerBossCollision,
    handlePlayerBulletEnemyCollision,
    handlePlayerBulletBossCollision,
    handleEnemyBulletPlayerCollision
};