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

/** Handle bullet after hit: destroy or increment hitCount for piercing */
function handleBulletAfterHit(bullet) {
    if (!bullet.piercing || bullet.hitCount >= bullet.maxPiercing) {
        bullet.destroy();
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
    
    // Debug: Comprehensive physics and collision verification
    DebugLogger.info('collision', '[setupCollisions] === COLLISION SYSTEM DEBUG ===');
    DebugLogger.verbose('collision', '  - Player exists:', !!scene.player);
    DebugLogger.verbose('collision', '  - Player physics body:', !!scene.player?.body);
    DebugLogger.verbose('collision', '  - Player active:', scene.player?.active);
    DebugLogger.verbose('collision', '  - Player body size:', scene.player?.body ? { width: scene.player.body.width, height: scene.player.body.height } : null);
    DebugLogger.verbose('collision', '  - Player collision category:', scene.player?.body?.collisionCategory || 'none');
    DebugLogger.verbose('collision', '  - Player collides with:', scene.player?.body?.collidesWith || 'none');
    
    DebugLogger.verbose('collision', '  - Enemies group exists:', !!scene.enemiesGroup);
    DebugLogger.verbose('collision', '  - Enemies group type:', scene.enemiesGroup?.constructor?.name);
    DebugLogger.verbose('collision', '  - Enemies count:', scene.enemiesGroup?.getLength?.() || 0);
    DebugLogger.verbose('collision', '  - Enemies active count:', scene.enemiesGroup?.countActive?.() || 0);
    
    DebugLogger.verbose('collision', '  - Boss group exists:', !!scene.bossGroup);
    DebugLogger.verbose('collision', '  - Boss group type:', scene.bossGroup?.constructor?.name);
    DebugLogger.verbose('collision', '  - Boss count:', scene.bossGroup?.getLength?.() || 0);
    
    DebugLogger.verbose('collision', '  - Player bullets group exists:', !!scene.projectileSystem?.playerBullets);
    DebugLogger.verbose('collision', '  - Player bullets type:', scene.projectileSystem?.playerBullets?.constructor?.name);
    DebugLogger.verbose('collision', '  - Player bullets count:', scene.projectileSystem?.playerBullets?.getLength?.() || 0);
    
    DebugLogger.verbose('collision', '  - Enemy bullets group exists:', !!scene.projectileSystem?.enemyBullets);
    DebugLogger.verbose('collision', '  - Enemy bullets type:', scene.projectileSystem?.enemyBullets?.constructor?.name);
    DebugLogger.verbose('collision', '  - Enemy bullets count:', scene.projectileSystem?.enemyBullets?.getLength?.() || 0);
    
    DebugLogger.verbose('collision', '  - Physics world exists:', !!scene.physics?.world);
    DebugLogger.verbose('collision', '  - Physics world active:', scene.physics?.world?.active || false);
    
    const colliders = [];

    // Player vs Enemies collision
    if (scene.player && scene.enemiesGroup) {
        const collider = scene.physics.add.overlap(
            scene.player,
            scene.enemiesGroup,
            (player, enemy) => {
                DebugLogger.debug('collision', '[Collision] Player-Enemy collision detected!', {
                    playerPos: { x: player.x, y: player.y },
                    enemyPos: { x: enemy.x, y: enemy.y },
                    playerActive: player.active,
                    enemyActive: enemy.active
                });
                handlePlayerEnemyCollision(player, enemy);
            },
            null,
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
                handlePlayerBossCollision,
                null,
                scene
            )
        );
    }

    // Player bullets vs Enemies
    if (scene.projectileSystem?.playerBullets && scene.enemiesGroup) {
        DebugLogger.info('collision', '[setupCollisions] Setting up Player bullets vs Enemies collision:');
        DebugLogger.verbose('collision', '  - PlayerBullets group exists:', !!scene.projectileSystem.playerBullets);
        DebugLogger.verbose('collision', '  - PlayerBullets type:', scene.projectileSystem.playerBullets?.constructor?.name);
        DebugLogger.verbose('collision', '  - PlayerBullets children:', scene.projectileSystem.playerBullets?.getLength?.() || 0);
        
        const collider = scene.physics.add.overlap(
            scene.projectileSystem.playerBullets,
            scene.enemiesGroup,
            (bullet, enemy) => {
                DebugLogger.debug('collision', '[Collision] Player bullet hit enemy!', {
                    bulletPos: { x: bullet.x, y: bullet.y },
                    enemyPos: { x: enemy.x, y: enemy.y },
                    bulletActive: bullet.active,
                    enemyActive: enemy.active
                });
                handlePlayerBulletEnemyCollision.call(scene, bullet, enemy);
            },
            null,
            scene
        );
        colliders.push(collider);
        DebugLogger.info('collision', '[setupCollisions] Registered Player bullets vs Enemies collision');
    } else {
        DebugLogger.info('collision', '[setupCollisions] SKIPPED Player bullets vs Enemies - missing components');
    }

    // Player bullets vs Boss — use .call(scene) for consistency with enemy handler
    if (scene.projectileSystem?.playerBullets && scene.bossGroup) {
        colliders.push(
            scene.physics.add.overlap(
                scene.projectileSystem.playerBullets,
                scene.bossGroup,
                (bullet, boss) => {
                    handlePlayerBulletBossCollision.call(scene, bullet, boss);
                },
                null,
                scene
            )
        );
    }

    // Enemy bullets vs Player
    // CRITICAL: Player (sprite) must be first parameter, enemyBullets (group) second
    // This ensures Phaser passes parameters in correct order
    if (scene.projectileSystem?.enemyBullets && scene.player) {
        DebugLogger.info('collision', '[setupCollisions] Setting up Enemy bullets vs Player collision:');
        DebugLogger.verbose('collision', '  - Player exists:', !!scene.player);
        DebugLogger.verbose('collision', '  - Player type:', scene.player?.constructor?.name);
        DebugLogger.verbose('collision', '  - EnemyBullets group exists:', !!scene.projectileSystem.enemyBullets);
        DebugLogger.verbose('collision', '  - EnemyBullets type:', scene.projectileSystem.enemyBullets?.constructor?.name);
        DebugLogger.verbose('collision', '  - EnemyBullets children:', scene.projectileSystem.enemyBullets?.getLength?.() || 0);
        
        const collider = scene.physics.add.overlap(
            scene.player,                          // Sprite first (Phaser convention)
            scene.projectileSystem.enemyBullets,   // Group second
            (player, bullet) => {                  // Parameters now in correct order
                DebugLogger.debug('collision', '[Collision] Enemy bullet hit player!', {
                    bulletPos: { x: bullet.x, y: bullet.y },
                    playerPos: { x: player.x, y: player.y },
                    bulletActive: bullet.active,
                    playerActive: player.active
                });
                handleEnemyBulletPlayerCollision(bullet, player);
            },
            null,
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
                null,
                scene
            )
        );
    }

    // Additional collision for spawned health/XP orbs (will be removed in step 3)
    // These will be migrated to SimpleLootSystem
    
    // Add global world overlap debug listener
    if (scene.physics && scene.physics.world) {
        const debugListener = (event, bodyA, bodyB) => {
            const objA = bodyA.gameObject;
            const objB = bodyB.gameObject;
            
            DebugLogger.debug('collision', '[Physics World] Overlap detected:', {
                objectA: {
                    type: objA?.constructor?.name || 'Unknown',
                    active: objA?.active,
                    pos: objA ? { x: objA.x, y: objA.y } : null,
                    bodyType: bodyA?.type || 'none',
                    collisionCategory: bodyA?.collisionCategory || 'none',
                    collidesWith: bodyA?.collidesWith || 'none',
                    bodySize: { width: bodyA.width, height: bodyA.height }
                },
                objectB: {
                    type: objB?.constructor?.name || 'Unknown', 
                    active: objB?.active,
                    pos: objB ? { x: objB.x, y: objB.y } : null,
                    bodyType: bodyB?.type || 'none',
                    collisionCategory: bodyB?.collisionCategory || 'none',
                    collidesWith: bodyB?.collidesWith || 'none',
                    bodySize: { width: bodyB.width, height: bodyB.height }
                },
                event: event,
                timestamp: Date.now()
            });
        };
        
        // Listen to all overlap events
        scene.physics.world.on('overlap', debugListener);
        
        // Track for cleanup
        colliders.push({
            name: 'worldOverlapDebugListener',
            cleanup: () => {
                if (scene.physics && scene.physics.world) {
                    scene.physics.world.off('overlap', debugListener);
                }
            }
        });
    }

    DebugLogger.debug('collision', `[setupCollisions] Registered ${colliders.length} collisions + debug listeners`);
    return colliders;
}

/**
 * Handle player-enemy collision
 */
function handlePlayerEnemyCollision(player, enemy) {
    DebugLogger.debug('collision', '[handlePlayerEnemyCollision] Called with:', {
        playerActive: player?.active,
        enemyActive: enemy?.active,
        canTakeDamage: !!player?.canTakeDamage,
        enemyDamage: enemy?.damage
    });
    
    if (!player.active || !enemy.active) return;
    
    // Check if player can take damage
    if (player.canTakeDamage && player.canTakeDamage()) {
        const damage = enemy.contactDamage || enemy.damage || 10;
        DebugLogger.debug('collision', '[handlePlayerEnemyCollision] Applying damage:', damage);
        player.takeDamage(damage);
    } else {
        DebugLogger.debug('collision', '[handlePlayerEnemyCollision] Player cannot take damage (iframes or shield)');
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
        
        // Create explosion effect
        if (scene.projectileSystem?.createExplosion) {
            scene.projectileSystem.createExplosion(
                bullet.x, bullet.y, 
                explosionDamage, 
                explosionRadius, 
                1
            );
        }
        
        // Play explosion VFX
        if (scene.vfxSystem) {
            scene.vfxSystem.play('vfx.explosion.small', bullet.x, bullet.y);
        }
        
        // Play explosion SFX  
        if (scene.audioSystem) {
            scene.audioSystem.play('sound/explosion_small.mp3');
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