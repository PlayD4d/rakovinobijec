import { DebugLogger } from '../../../debug/DebugLogger.js';
import { getSession } from '../../../debug/SessionLog.js';

/**
 * ShieldRegeneration - Handles shield HP regeneration and damage absorption
 * Extracted from PowerUpAbilities for file size compliance (< 500 LOC)
 *
 * Manages: _updateShieldRegeneration, processDamageWithShield
 */
export class ShieldRegeneration {
    constructor(scene, powerUpSystem) {
        this.scene = scene;
        this.powerUpSystem = powerUpSystem;
    }

    /**
     * Update shield regeneration (called each frame)
     * @param {object} player - Player object
     * @param {number} time - Absolute game time
     */
    update(player, time) {
        if (!player || !player.shieldActive) return;

        // Update shield hitbox position (follows player)
        if (player._shieldHitbox?.active) {
            player._shieldHitbox.setPosition(player.x, player.y);
        }

        // Push enemies at shield boundary (lightweight — only enemies already overlapping)
        if (player.shieldHP > 0) {
            this._pushEnemiesAtBoundary(player);
        }

        // Shield auto-regeneration logic
        if (player.shieldHP < player.maxShieldHP) {
            // Start recharge if not already recharging
            if (!player.shieldRecharging) {
                player.shieldRecharging = true;
                player.shieldRechargeAt = time + player.shieldRechargeTime;
                DebugLogger.info('powerup', `[ShieldRegeneration] Shield recharge started - will regenerate in ${player.shieldRechargeTime}ms`);
            }

            // Check if recharge time has elapsed
            if (time >= player.shieldRechargeAt) {
                player.shieldHP = player.maxShieldHP;
                player.shieldRecharging = false;
                player.shieldRechargeAt = 0;

                DebugLogger.info('powerup', `[ShieldRegeneration] SHIELD REGENERATED - HP: ${player.shieldHP}/${player.maxShieldHP}`);
                getSession()?.log('shield', 'regenerated', { shieldHP: player.shieldHP, maxShieldHP: player.maxShieldHP });

                // Restore shield VFX
                const vfxManager = this.powerUpSystem?.vfxManager;
                if (vfxManager) {
                    vfxManager.attachEffect(player, 'shield', {
                        radius: 40 + (player.shieldLevel * 5),
                        color: 0x00ffff,
                        alpha: 0.3
                    });
                    getSession()?.log('shield', 'vfx_restored', { shieldHP: player.shieldHP });
                }
            }
        }
    }

    /**
     * Process damage through shield system (PR7: Moved from Player.js)
     * @param {object} player - Player object
     * @param {number} amount - Damage amount
     * @param {number} time - Current game time
     * @returns {number} Remaining damage after shield absorption
     */
    processDamageWithShield(player, amount, time) {
        if (!player.shieldActive || player.shieldHP <= 0) {
            return amount; // No shield, return full damage
        }

        const absorbed = Math.min(amount, player.shieldHP);
        player.shieldHP -= absorbed;
        const remainingDamage = amount - absorbed;

        DebugLogger.info('powerup', `[ShieldRegeneration] SHIELD ABSORBED ${absorbed} damage - Shield HP: ${player.shieldHP}/${player.maxShieldHP}`);
        getSession()?.log('shield', 'absorbed', { absorbed, remainingDamage, shieldHP: player.shieldHP, maxShieldHP: player.maxShieldHP });

        // Trigger visual hit flash on shield effect
        const vfxManager = this.powerUpSystem?.vfxManager;
        if (vfxManager && player._vfxUid) {
            const shieldEffect = vfxManager.powerUpEffects?.get(`${player._vfxUid}_shield`);
            if (shieldEffect?.flash) shieldEffect.flash();
        }

        // If shield depleted, start recharge timer
        if (player.shieldHP <= 0) {
            player.shieldHP = 0;
            player.shieldRecharging = true;
            player.shieldRechargeAt = time + player.shieldRechargeTime;
            DebugLogger.info('powerup', `[ShieldRegeneration] SHIELD DEPLETED - Recharging in ${player.shieldRechargeTime}ms`);
            getSession()?.log('shield', 'broken', { rechargeTime: player.shieldRechargeTime });

            // Remove shield visual effect
            const vfxManager = this.powerUpSystem?.vfxManager;
            if (vfxManager) {
                vfxManager.detachEffect(player, 'shield');
            }
        }

        return remainingDamage;
    }

    /**
     * Reset shield timers after pause/resume
     * @param {number} now - Current game time
     * @param {object} player - Player object
     */
    resetTimersAfterPause(now, player) {
        if (!player) return;

        if (player.shieldActive && player.shieldRecharging && player.shieldRechargeAt > 0) {
            const remainingTime = Math.max(0, player.shieldRechargeAt - (player._lastPauseTime || now));
            player.shieldRechargeAt = now + remainingTime;
            DebugLogger.info('powerup', `[ShieldRegeneration] Shield recharge preserved: ${remainingTime}ms remaining`);
        }
    }

    /**
     * Create invisible physics hitbox for shield bullet interception
     * Uses Phaser overlap system instead of per-frame distance checks
     */
    createShieldHitbox(player) {
        const scene = this.scene;
        if (!scene || player._shieldHitbox) return; // Already exists

        const shieldRadius = 40 + (player.shieldLevel || 1) * 5;

        // Invisible sprite with circular body at shield radius
        const hitbox = scene.physics.add.sprite(player.x, player.y, '__DEFAULT');
        hitbox.setVisible(false);
        hitbox.setAlpha(0);
        hitbox.body.setCircle(shieldRadius);
        // Center circular body on sprite
        const offset = (hitbox.width / 2) - shieldRadius;
        hitbox.body.setOffset(offset, offset);
        hitbox.body.setImmovable(true);
        hitbox.body.moves = false;
        hitbox.setDepth(-1); // Below everything

        player._shieldHitbox = hitbox;

        // Register overlap: shield hitbox vs enemy bullets
        const enemyBullets = scene.projectileSystem?.enemyBullets;
        if (enemyBullets) {
            const overlapRef = scene.physics.add.overlap(
                hitbox,
                enemyBullets,
                (shieldBody, bullet) => this._onBulletHitShield(player, bullet),
                () => player.shieldActive && player.shieldHP > 0, // Only when shield is up
                this
            );
            player._shieldOverlap = overlapRef;
        }
    }

    /**
     * Callback: enemy bullet hit shield hitbox
     */
    _onBulletHitShield(player, bullet) {
        if (!bullet?.active || !player.shieldActive || player.shieldHP <= 0) return;

        const damage = bullet.damage || 5;
        const time = this.scene?.time?.now || 0;
        this.processDamageWithShield(player, damage, time);

        // Spark VFX at bullet position (already at shield boundary due to overlap)
        if (this.scene?.vfxSystem) {
            this.scene.vfxSystem.play('vfx.hit.spark.small', bullet.x, bullet.y);
        }

        // Destroy bullet
        bullet.setActive(false).setVisible(false);
        if (bullet.body) bullet.body.enable = false;

        // Brief iFrames to prevent multi-hit
        player._iFramesMsLeft = Math.max(player._iFramesMsLeft || 0, 50);

        getSession()?.log('shield', 'bullet_intercepted', { damage, shieldHP: player.shieldHP });
    }

    /**
     * Remove shield hitbox (when shield breaks or power-up lost)
     */
    destroyShieldHitbox(player) {
        if (player._shieldOverlap) {
            this.scene?.physics?.world?.removeCollider(player._shieldOverlap);
            player._shieldOverlap = null;
        }
        if (player._shieldHitbox) {
            player._shieldHitbox.destroy();
            player._shieldHitbox = null;
        }
    }

    /**
     * Push enemies away that are inside the shield radius
     */
    _pushEnemiesAtBoundary(player) {
        const scene = this.scene;
        const shieldRadius = 40 + (player.shieldLevel || 1) * 5;
        const pushZone = shieldRadius + 10; // Slightly larger than visual
        const pushZoneSq = pushZone * pushZone;
        const pushSpeed = 250;

        // Push regular enemies
        const enemies = scene.enemiesGroup?.getChildren();
        if (enemies) {
            for (let i = 0, len = enemies.length; i < len; i++) {
                const enemy = enemies[i];
                if (!enemy?.active || !enemy.body) continue;
                const dx = enemy.x - player.x;
                const dy = enemy.y - player.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < pushZoneSq && distSq > 1) {
                    const dist = Math.sqrt(distSq);
                    enemy.body.setVelocity((dx / dist) * pushSpeed, (dy / dist) * pushSpeed);
                }
            }
        }

        // Push bosses (lighter force)
        const bosses = scene.bossGroup?.getChildren();
        if (bosses) {
            for (let i = 0, len = bosses.length; i < len; i++) {
                const boss = bosses[i];
                if (!boss?.active || !boss.body) continue;
                const dx = boss.x - player.x;
                const dy = boss.y - player.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < pushZoneSq && distSq > 1) {
                    const dist = Math.sqrt(distSq);
                    boss.body.setVelocity((dx / dist) * pushSpeed * 0.5, (dy / dist) * pushSpeed * 0.5);
                }
            }
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.scene = null;
        this.powerUpSystem = null;
    }
}
