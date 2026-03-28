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
     * Cleanup
     */
    destroy() {
        this.scene = null;
        this.powerUpSystem = null;
    }
}
