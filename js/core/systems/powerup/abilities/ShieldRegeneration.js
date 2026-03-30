import { DebugLogger } from '../../../debug/DebugLogger.js';
import { getSession } from '../../../debug/SessionLog.js';
import { registerDynamicOverlap } from '../../../../handlers/setupCollisions.js';

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

        // Update shield hitbox + push zone position (follows player)
        if (player._shieldHitbox?.active) {
            player._shieldHitbox.setPosition(player.x, player.y);
        }
        if (player._shieldPushZone?.active) {
            player._shieldPushZone.setPosition(player.x, player.y);
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
            // Calculate how long was left before pause based on the pause timestamp
            const pauseTime = player._lastPauseTime || now;
            const remainingTime = Math.max(0, player.shieldRechargeAt - pauseTime);
            player.shieldRechargeAt = now + remainingTime;
            player._lastPauseTime = 0; // Clear to prevent stale reference on next cycle
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
            player._shieldOverlap = registerDynamicOverlap(
                scene, hitbox, enemyBullets,
                (shieldBody, bullet) => this._onBulletHitShield(player, bullet),
                () => player.shieldActive && player.shieldHP > 0
            );
        }

        // Create push zone for enemy knockback (slightly larger than shield)
        const pushZone = scene.physics.add.sprite(player.x, player.y, '__DEFAULT');
        pushZone.setVisible(false);
        pushZone.setAlpha(0);
        pushZone.body.setCircle(shieldRadius + 10);
        const pushOffset = (pushZone.width / 2) - (shieldRadius + 10);
        pushZone.body.setOffset(pushOffset, pushOffset);
        pushZone.body.setImmovable(true);
        pushZone.body.moves = false;
        pushZone.setDepth(-1);
        player._shieldPushZone = pushZone;

        // Register overlap: push zone vs enemies — Phaser calls this only for overlapping pairs
        if (scene.enemiesGroup) {
            player._shieldEnemyOverlap = registerDynamicOverlap(
                scene, pushZone, scene.enemiesGroup,
                (zone, enemy) => this._pushEnemyOut(player, enemy, 250),
                () => player.shieldActive && player.shieldHP > 0
            );
        }
        if (scene.bossGroup) {
            player._shieldBossOverlap = registerDynamicOverlap(
                scene, pushZone, scene.bossGroup,
                (zone, boss) => this._pushEnemyOut(player, boss, 125),
                () => player.shieldActive && player.shieldHP > 0
            );
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
        const world = this.scene?.physics?.world;
        // Remove all shield overlaps
        for (const key of ['_shieldOverlap', '_shieldEnemyOverlap', '_shieldBossOverlap']) {
            if (player[key]) {
                world?.removeCollider(player[key]);
                player[key] = null;
            }
        }
        // Destroy hitbox and push zone sprites
        for (const key of ['_shieldHitbox', '_shieldPushZone']) {
            if (player[key]) {
                player[key].destroy();
                player[key] = null;
            }
        }
    }

    /**
     * Overlap callback: push a single enemy out of shield zone
     * Called by Phaser physics only for actually overlapping pairs (not all enemies)
     */
    _pushEnemyOut(player, entity, force) {
        if (!entity?.active || !entity.body) return;
        const dx = entity.x - player.x;
        const dy = entity.y - player.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 1) return;
        const dist = Math.sqrt(distSq);
        entity.body.setVelocity((dx / dist) * force, (dy / dist) * force);
    }

    /**
     * Cleanup
     */
    destroy() {
        const player = this.scene?.player;
        if (player) this.destroyShieldHitbox(player);
        this.scene = null;
        this.powerUpSystem = null;
    }
}
