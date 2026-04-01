import { DebugLogger } from '../../../debug/DebugLogger.js';
import { getSession } from '../../../debug/SessionLog.js';
import { registerDynamicOverlap, registerDynamicCollider } from '../../../../handlers/setupCollisions.js';

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
            // Sync physics body immediately — moves:false body doesn't auto-follow setPosition
            player._shieldHitbox.body?.reset(player.x, player.y);
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
                        radius: 28,
                        color: 0x00ccff,
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

        const shieldRadius = 40; // Larger than player — visually clear shield bubble

        // Invisible zone with circular body — setOrigin(0.5) for center alignment
        const hitbox = scene.add.zone(player.x, player.y, shieldRadius * 2, shieldRadius * 2);
        hitbox.setOrigin(0.5);
        scene.physics.add.existing(hitbox, false); // dynamic body
        hitbox.body.setCircle(shieldRadius);
        hitbox.body.setImmovable(true);
        hitbox.body.moves = false;
        hitbox.body.setAllowGravity(false);
        hitbox.setDepth(-1);

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

        // Shield body — physically blocks enemies (collider, not overlap)
        // Using the same hitbox for both bullet interception and enemy blocking
        // Enemies that touch the shield take no player damage — shield absorbs it
        this._shieldContactTicks = new WeakMap(); // Track per-enemy contact tick time

        // Collider: shield vs enemies — physically stops them + contact damage to shield
        if (scene.enemiesGroup) {
            player._shieldEnemyCollider = registerDynamicCollider(
                scene, hitbox, scene.enemiesGroup,
                (shield, enemy) => this._onEnemyContactShield(player, enemy),
                () => player.shieldActive && player.shieldHP > 0
            );
        }
        // Boss: overlap only (contact damage to shield, but NO physical knockback)
        if (scene.bossGroup) {
            player._shieldBossCollider = registerDynamicOverlap(
                scene, hitbox, scene.bossGroup,
                (shield, boss) => this._onEnemyContactShield(player, boss),
                () => player.shieldActive && player.shieldHP > 0
            );
        }
    }

    /**
     * Callback: enemy bullet hit shield hitbox
     */
    _onBulletHitShield(player, bullet) {
        if (!bullet?.active || bullet._shieldIntercepted) return;
        if (!player.shieldActive || player.shieldHP <= 0) return;

        // Flag bullet BEFORE processing — prevents same-frame double-hit via player overlap
        bullet._shieldIntercepted = true;

        const damage = bullet.damage || 5;
        const time = this.scene?.time?.now || 0;
        this.processDamageWithShield(player, damage, time);

        // Spark VFX
        if (this.scene?.vfxSystem) {
            this.scene.vfxSystem.play('hit.small', bullet.x, bullet.y, { color: 0x00CCFF });
        }

        // Kill bullet
        if (bullet.kill) bullet.kill();
        else { bullet.setActive(false).setVisible(false); if (bullet.body) bullet.body.enable = false; }

        // No player iFrames for shield interceptions — shield absorbed it, not the player.
        // _shieldIntercepted flag on bullet prevents same-frame double-hit.

        getSession()?.log('shield', 'bullet_intercepted', { damage, shieldHP: player.shieldHP });
    }

    /**
     * Remove shield hitbox (when shield breaks or power-up lost)
     */
    destroyShieldHitbox(player) {
        const world = this.scene?.physics?.world;
        // Remove all shield colliders and overlaps
        for (const key of ['_shieldOverlap', '_shieldEnemyCollider', '_shieldBossCollider']) {
            if (player[key]) {
                world?.removeCollider(player[key]);
                player[key] = null;
            }
        }
        // Destroy hitbox sprite
        if (player._shieldHitbox) {
            player._shieldHitbox.destroy();
            player._shieldHitbox = null;
        }
        this._shieldContactTicks = null;
    }

    /**
     * Collider callback: enemy physically blocked by shield + contact damage to shield
     * Tick-based — max 1 damage tick per 500ms per enemy to prevent instant drain
     */
    _onEnemyContactShield(player, enemy) {
        if (!enemy?.active || !player.shieldActive || player.shieldHP <= 0) return;

        const now = this.scene?.time?.now || 0;
        const tickMs = 500; // Contact damage tick interval

        // Per-enemy tick tracking
        if (!this._shieldContactTicks) this._shieldContactTicks = new WeakMap();
        const lastTick = this._shieldContactTicks.get(enemy) || 0;
        if (now - lastTick < tickMs) return;
        this._shieldContactTicks.set(enemy, now);

        // Enemy's contact damage hits the shield, not the player
        const contactDamage = enemy.damage || 10;
        this.processDamageWithShield(player, contactDamage, now);

        getSession()?.log('shield', 'contact_absorbed', {
            enemyId: enemy.blueprintId, damage: contactDamage, shieldHP: player.shieldHP
        });
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
