/**
 * Centralizovaná registrace všech kolizí pro GameScene
 * PR7 compliant - single source of truth pro fyzikální interakce
 */

import { DebugLogger } from '../core/debug/DebugLogger.js';
import { getSession } from '../core/debug/SessionLog.js';

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
        DebugLogger.info('collision', `[setupCollisions] Registering Player vs Loot: player=${!!scene.player.body}, lootGroup children=${scene.lootSystem.lootGroup.getLength()}`);
        colliders.push(
            scene.physics.add.overlap(
                scene.player,
                scene.lootSystem.lootGroup,
                (player, loot) => {
                    scene.lootSystem.handlePickup(player, loot);
                },
                activeFilter,
                scene
            )
        );
    } else {
        DebugLogger.error('collision', `[setupCollisions] SKIPPED Player vs Loot! lootSystem=${!!scene.lootSystem}, lootGroup=${!!scene.lootSystem?.lootGroup}, player=${!!scene.player}`);
    }

    DebugLogger.debug('collision', `[setupCollisions] Registered ${colliders.length} collisions`);
    return colliders;
}

/**
 * Handle player-enemy collision
 * If shield is active: enemy is pushed back to shield boundary + shield takes damage
 */
function handlePlayerEnemyCollision(player, enemy) {
    if (!player.active || !enemy.active) return;

    // Shield knockback is handled per-frame in ShieldRegeneration._pushEnemiesAtBoundary()

    if (player.canTakeDamage?.()) {
        const damage = enemy.contactDamage || enemy.damage || 10;
        getSession()?.log('collision', 'contact_damage', {
            enemyId: enemy.blueprintId || enemy.type, damage, playerHP: player.hp
        });
        player.takeDamage(damage);
    }
}

/**
 * Handle player-boss collision
 */
function handlePlayerBossCollision(player, boss) {
    if (!player.active || !boss.active) return;

    // Shield knockback is handled per-frame in ShieldRegeneration._pushEnemiesAtBoundary()

    if (player.canTakeDamage && player.canTakeDamage()) {
        const damage = boss.contactDamage || boss.damage || 20;
        getSession()?.log('collision', 'player_boss', { bossId: boss.blueprintId || boss.type, damage, playerHP: player.hp });
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

    // Skip enemies already hit by this piercing bullet (overlap fires every frame)
    if (bullet._hitEnemies) {
        if (bullet._hitEnemies.has(enemy)) return;
        bullet._hitEnemies.add(enemy);
    }

    // Apply damage with piercing reduction (DRY helper)
    let damage = applyPiercingReduction(bullet, bullet.damage || scene.player?.baseStats?.projectileDamage || 10);
    getSession()?.log('combat', 'player_hit_enemy', { enemyId: enemy.blueprintId || enemy.type, damage, enemyHP: enemy.hp, killed: enemy.hp <= damage });
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

    // Skip bosses already hit by this piercing bullet (overlap fires every frame)
    if (bullet._hitEnemies) {
        if (bullet._hitEnemies.has(boss)) return;
        bullet._hitEnemies.add(boss);
    }

    // Apply damage with piercing reduction (DRY helper)
    const damage = applyPiercingReduction(bullet, bullet.damage || scene?.player?.baseStats?.projectileDamage || 10);
    getSession()?.log('combat', 'player_hit_boss', { bossId: boss.blueprintId || boss.type, damage, bossHP: boss.hp, killed: boss.hp <= damage });
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
 * Note: Shield intercept is handled by a separate overlap on the shield hitbox
 * (registered in ShieldRegeneration.createShieldHitbox). Bullets that reach
 * this handler have either bypassed the shield or shield is inactive.
 */
function handleEnemyBulletPlayerCollision(bullet, player) {
    if (!bullet.active || !player.active) return;

    if (player.canTakeDamage?.()) {
        const damage = bullet.damage || 5;
        getSession()?.log('combat', 'enemy_bullet_hit_player', { damage, playerHP: player.hp, source: bullet.sourceType || 'unknown' });
        player.takeDamage(damage);
    }
    killBullet(bullet);
}

// Shield knockback is handled per-frame in ShieldRegeneration._pushEnemiesAtBoundary()

// Export callbacks for testing
export const collisionHandlers = {
    handlePlayerEnemyCollision,
    handlePlayerBossCollision,
    handlePlayerBulletEnemyCollision,
    handlePlayerBulletBossCollision,
    handleEnemyBulletPlayerCollision
};