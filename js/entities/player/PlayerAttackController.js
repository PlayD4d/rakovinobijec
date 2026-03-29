import { DebugLogger } from '../../core/debug/DebugLogger.js';

/**
 * PlayerAttackController - Handles auto-attack targeting and shooting
 *
 * PR7 Capability-based design: Player provides the capability interface,
 * this controller contains the attack logic as a separated concern.
 *
 * Extracted from Player.js to follow Thin Composer pattern.
 */
export class PlayerAttackController {
    /**
     * @param {import('../Player.js').Player} player - The player instance (capability provider)
     */
    constructor(player) {
        this.player = player;
        // Pre-allocated opts object for firePlayer — avoids per-shot allocation
        this._fireOpts = { speedMul: 1, rangeMul: 1, damageMul: 1, tint: 0xffffff, projectileId: 'projectile.player_basic' };
    }

    /**
     * Main update - handles auto-attack logic each frame
     * @param {number} time - Game time
     * @param {number} delta - Delta time in ms
     */
    update(time, delta) {
        this._handleAutoAttack(time, delta);
    }

    /**
     * Handle auto-attack logic
     */
    _handleAutoAttack(time, delta) {
        const player = this.player;

        // Initialize next attack time if not set
        if (!player._nextAttackAt) {
            player._nextAttackAt = time;
        }

        const stats = player._stats();
        const attackInterval = stats.attackIntervalMs;

        // CRITICAL FIX: Prevent timer drift by using absolute time comparison
        // If we're way behind (e.g., after pause), reset the timer
        if (time - player._nextAttackAt > attackInterval * 3) {
            DebugLogger.info('player', '[Player] Attack timer reset - was too far behind');
            player._nextAttackAt = time;
        }

        // Check if we can attack using absolute time
        if (time >= player._nextAttackAt) {
            // Find nearest enemy
            const target = this._findNearestEnemy();

            if (target) {
                // Fire single shot
                this._shootAtTarget(target);

                // Set next attack time based on current time to prevent drift
                // Use Math.max to ensure we don't go backwards in time
                player._nextAttackAt = Math.max(player._nextAttackAt + attackInterval, time + attackInterval);

                DebugLogger.debug('player', '[Player] Attack fired');
            } else {
                // No target — defer next check by half attack interval (not 100ms)
                player._nextAttackAt = time + Math.max(attackInterval * 0.5, 250);
            }
        }
    }

    /**
     * Find nearest enemy for auto-targeting (PR7: Delegate to TargetingSystem)
     * @returns {object|null} The nearest enemy or null
     */
    _findNearestEnemy() {
        const scene = this.player.scene;

        // PR7: Delegate to TargetingSystem for proper separation of concerns
        if (scene.targetingSystem?.findNearestEnemy) {
            return scene.targetingSystem.findNearestEnemy(this.player);
        }

        // Fallback if TargetingSystem not available
        return null;
    }

    /**
     * Roll crit damage
     * @param {number} baseDamage - Base damage value
     * @param {object} stats - Current player stats
     * @returns {number} Final damage (possibly crit)
     */
    _rollCrit(baseDamage, stats) {
        if (Math.random() < stats.critChance) {
            return Math.round(baseDamage * stats.critMult);
        }
        return Math.round(baseDamage);
    }

    /**
     * Shoot projectile at target (PR7: Unified shooting implementation)
     * @param {object} target - The target to shoot at
     */
    _shootAtTarget(target) {
        const player = this.player;
        const scene = player.scene;
        const ps = scene.projectileSystem;

        if (!ps) return;

        // Calculate direction to target
        const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
        const stats = player._stats();
        const projectileCount = Math.max(1, Math.round(stats.projectileCount));

        // Reuse pre-allocated opts — zero allocation per shot
        const opts = this._fireOpts;
        opts.damageMul = this._rollCrit(stats.projectileDamage, stats) / ps.config.damage;
        opts.projectileId = stats.projectileRef || 'projectile.player_basic';

        if (projectileCount > 1) {
            const spreadRad = (stats.spreadDeg * Math.PI) / 180;
            for (let i = 0; i < projectileCount; i++) {
                const t = (i - (projectileCount - 1) / 2);
                const angleOffset = (spreadRad / (projectileCount - 1)) * t;
                const finalAngle = baseAngle + angleOffset;
                opts.damageMul = this._rollCrit(stats.projectileDamage, stats) / ps.config.damage;
                ps.firePlayer(player.x, player.y, Math.cos(finalAngle), Math.sin(finalAngle), opts);
            }
        } else {
            ps.firePlayer(player.x, player.y, Math.cos(baseAngle), Math.sin(baseAngle), opts);
        }

        player._playSfx(player.sfx.shoot);
        scene.frameworkDebug?.onPlayerShoot?.(player, projectileCount);
    }

    /**
     * Public accessor for finding nearest enemy (if needed externally)
     * @returns {object|null}
     */
    findNearestEnemy() {
        return this._findNearestEnemy();
    }
}

