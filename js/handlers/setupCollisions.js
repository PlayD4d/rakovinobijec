/**
 * Centralizovaná registrace všech kolizí pro GameScene
 * PR7 compliant - single source of truth pro fyzikální interakce
 */

/**
 * Nastaví všechny kolize pro herní scénu
 * @param {Phaser.Scene} scene - GameScene instance
 */
export function setupCollisions(scene) {
    // Validace
    if (!scene || !scene.physics) {
        console.error('[setupCollisions] Invalid scene or physics not initialized');
        return;
    }

    // Player vs Enemies collision
    if (scene.player && scene.enemies) {
        scene.physics.add.overlap(
            scene.player,
            scene.enemies,
            handlePlayerEnemyCollision,
            null,
            scene
        );
    }

    // Player vs Boss collision
    if (scene.player && scene.bossGroup) {
        scene.physics.add.overlap(
            scene.player,
            scene.bossGroup,
            handlePlayerBossCollision,
            null,
            scene
        );
    }

    // Player bullets vs Enemies
    if (scene.projectileSystem?.playerBullets && scene.enemies) {
        scene.physics.add.overlap(
            scene.projectileSystem.playerBullets,
            scene.enemies,
            (bullet, enemy) => handlePlayerBulletEnemyCollision.call(scene, bullet, enemy),
            null,
            scene
        );
    }

    // Player bullets vs Boss
    if (scene.projectileSystem?.playerBullets && scene.bossGroup) {
        scene.physics.add.overlap(
            scene.projectileSystem.playerBullets,
            scene.bossGroup,
            handlePlayerBulletBossCollision,
            null,
            scene
        );
    }

    // Enemy bullets vs Player
    if (scene.projectileSystem?.enemyBullets && scene.player) {
        scene.physics.add.overlap(
            scene.projectileSystem.enemyBullets,
            scene.player,
            handleEnemyBulletPlayerCollision,
            null,
            scene
        );
    }

    // Player vs Loot
    if (scene.lootSystem?.lootGroup && scene.player) {
        scene.physics.add.overlap(
            scene.player,
            scene.lootSystem.lootGroup,
            (player, loot) => scene.lootSystem.handlePickup(player, loot),
            null,
            scene
        );
    }

    // Additional collision for spawned health/XP orbs (will be removed in step 3)
    // These will be migrated to SimpleLootSystem
    
    console.log('[setupCollisions] All collisions registered successfully');
}

/**
 * Handle player-enemy collision
 */
function handlePlayerEnemyCollision(player, enemy) {
    if (!player.active || !enemy.active) return;
    
    // Check if player can take damage
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
    
    // Apply damage with piercing reduction
    let damage = bullet.damage || scene.player?.baseStats?.projectileDamage || 10;
    
    // Apply damage reduction for piercing bullets
    if (bullet.piercing && bullet.hitCount > 0 && bullet.damageReduction) {
        const reductionFactor = Math.pow(1 - bullet.damageReduction, bullet.hitCount);
        damage = damage * reductionFactor;
    }
    
    enemy.takeDamage(damage);
    
    // Check if enemy died
    if (enemy.hp <= 0 && enemy.active && scene.handleEnemyDeath) {
        scene.handleEnemyDeath(enemy);
    }
    
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
    
    // Handle piercing
    if (!bullet.piercing || bullet.hitCount >= bullet.maxPiercing) {
        bullet.destroy();
    } else {
        bullet.hitCount = (bullet.hitCount || 0) + 1;
    }
    
    // VFX/SFX - Silent fail mode
    try {
        if (enemy._vfx?.hit && scene.vfxSystem) {
            scene.vfxSystem.play(enemy._vfx.hit, enemy.x, enemy.y);
        }
    } catch (error) {
        console.debug('[VFX] Failed to play hit effect, continuing:', error.message);
    }
    
    try {
        if (enemy._sfx?.hit && scene.audioSystem) {
            scene.audioSystem.play(enemy._sfx.hit);
        }
    } catch (error) {
        console.debug('[SFX] Failed to play hit sound, continuing:', error.message);
    }
}

/**
 * Handle player bullet hitting boss
 */
function handlePlayerBulletBossCollision(bullet, boss) {
    if (!bullet.active || !boss.active) return;
    
    // Apply damage to boss
    if (boss.takeDamage) {
        boss.takeDamage(bullet.damage || 10);
    }
    
    // Destroy bullet (unless piercing)
    if (!bullet.piercing) {
        bullet.destroy();
    }
}

/**
 * Handle enemy bullet hitting player
 */
function handleEnemyBulletPlayerCollision(bullet, player) {
    if (!bullet.active || !player.active) return;
    
    // Check if player can take damage
    if (player.canTakeDamage && player.canTakeDamage()) {
        player.takeDamage(bullet.damage || 5);
        
        // Destroy bullet
        bullet.destroy();
    }
}

// Export callbacks for testing
export const collisionHandlers = {
    handlePlayerEnemyCollision,
    handlePlayerBossCollision,
    handlePlayerBulletEnemyCollision,
    handlePlayerBulletBossCollision,
    handleEnemyBulletPlayerCollision
};