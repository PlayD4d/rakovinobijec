/**
 * Centralized registration of all collisions for GameScene
 * PR7 compliant - single source of truth for physics interactions
 */

import { DebugLogger } from '../core/debug/DebugLogger.js';
import { getSession } from '../core/debug/SessionLog.js';

function session() {
    return getSession();
}

// ===== DRY helpers (shared between enemy and boss collision handlers) =====

/** Apply piercing damage reduction to bullet damage */
function applyPiercingReduction(bullet, baseDamage) {
    if (bullet.piercing && bullet.hitCount > 0 && bullet.damageReduction) {
        return baseDamage * Math.pow(1 - bullet.damageReduction, bullet.hitCount);
    }
    return baseDamage;
}

/** Delegate on-hit power-up effects to PowerUpSystem (chemo explosion, future effects) */
function handlePowerUpOnHit(scene, bullet, damage) {
    scene.powerUpSystem?.onBulletHit(scene, bullet, damage);
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
 * Set up all collisions for the game scene
 * @param {Phaser.Scene} scene - GameScene instance
 * @returns {Array} Colliders for DisposableRegistry cleanup
 */
export function setupCollisions(scene) {
    // Validation
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

    // If shield is active and has HP, shield absorbs contact damage (not player)
    // The actual shield contact logic is in ShieldRegeneration._onEnemyContactShield
    if (player.shieldActive && player.shieldHP > 0) return;

    if (player.canTakeDamage?.()) {
        const damage = enemy.damage || 10;
        const s = session();
        if (s) s.log('collision', 'contact_damage', { enemyId: enemy.blueprintId || enemy.type, damage, playerHP: player.hp });
        player.takeDamage(damage);
    }
}

/**
 * Handle player-boss collision
 */
function handlePlayerBossCollision(player, boss) {
    if (!player.active || !boss.active) return;

    // Shield absorbs boss contact damage when active
    if (player.shieldActive && player.shieldHP > 0) return;

    if (player.canTakeDamage && player.canTakeDamage()) {
        const damage = boss.damage || 20;
        const s = session();
        if (s) s.log('collision', 'player_boss', { bossId: boss.blueprintId || boss.type, damage, playerHP: player.hp });
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
    const s = session();
    if (s) s.log('combat', 'player_hit_enemy', { enemyId: enemy.blueprintId || enemy.type, damage, enemyHP: enemy.hp, killed: enemy.hp <= damage });
    enemy.takeDamage({ amount: damage, isCrit: bullet.isCrit || false });

    handlePowerUpOnHit(scene, bullet, damage);
    handleBulletAfterHit(bullet);
    // Hit VFX/SFX is handled inside enemy.takeDamage() — not here (avoids double-fire)
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
    const s = session();
    if (s) s.log('combat', 'player_hit_boss', { bossId: boss.blueprintId || boss.type, damage, bossHP: boss.hp, killed: boss.hp <= damage });
    if (boss.takeDamage) boss.takeDamage({ amount: damage, isCrit: bullet.isCrit || false });

    handlePowerUpOnHit(scene, bullet, damage);
    handleBulletAfterHit(bullet);
    // Hit VFX/SFX is handled inside boss.takeDamage() — not here
}

/**
 * Handle enemy bullet hitting player body.
 * Primary shield interception happens on the shield hitbox overlap (40px radius,
 * registered in ShieldRegeneration.createShieldHitbox). This handler is a FALLBACK
 * for any bullet that reaches the smaller player body despite the shield.
 * Both paths call interceptBullet() — coordination via bullet.active check.
 */
function handleEnemyBulletPlayerCollision(bullet, player) {
    if (!bullet.active || !player.active) return;

    // Fallback shield intercept — bullet reached player body despite shield overlap
    if (player.shieldActive && player.shieldHP > 0) {
        const shieldRegen = player.scene?.powerUpSystem?.abilities?._shieldRegen;
        if (shieldRegen) {
            const overflow = shieldRegen.interceptBullet(player, bullet);
            if (overflow > 0 && player.canTakeDamage?.()) {
                player.takeDamage(overflow);
            }
            return; // bullet killed inside interceptBullet
        }
    }

    if (player.canTakeDamage?.()) {
        const damage = bullet.damage || 5;
        const s = session();
        if (s) s.log('combat', 'enemy_bullet_hit_player', { damage, playerHP: player.hp, source: bullet.sourceType || 'unknown' });
        player.takeDamage(damage);
    }
    killBullet(bullet);
}

/**
 * Register a dynamic overlap at runtime (e.g., power-up abilities, VFX effects).
 * Centralizes physics.add.overlap calls per architectural contract.
 * Caller must store the returned collider and destroy it on cleanup.
 *
 * @param {Phaser.Scene} scene
 * @param {Phaser.GameObjects.GameObject} a
 * @param {Phaser.GameObjects.Group|Phaser.GameObjects.GameObject} b
 * @param {Function} callback
 * @param {Function} [processCallback]
 * @returns {Phaser.Physics.Arcade.Collider|null}
 */
export function registerDynamicOverlap(scene, a, b, callback, processCallback = null) {
    if (!scene?.physics) return null;
    return scene.physics.add.overlap(a, b, callback, processCallback, scene);
}

/**
 * Register a dynamic collider at runtime (e.g., shield vs enemies — physical separation).
 * Centralizes physics.add.collider calls per architectural contract.
 * Caller must store the returned collider and destroy it on cleanup.
 *
 * @param {Phaser.Scene} scene
 * @param {Phaser.GameObjects.GameObject} a
 * @param {Phaser.GameObjects.Group|Phaser.GameObjects.GameObject} b
 * @param {Function} callback
 * @param {Function} [processCallback]
 * @returns {Phaser.Physics.Arcade.Collider|null}
 */
export function registerDynamicCollider(scene, a, b, callback, processCallback = null) {
    if (!scene?.physics) return null;
    return scene.physics.add.collider(a, b, callback, processCallback, scene);
}

