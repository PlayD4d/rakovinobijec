import { DebugLogger } from '../../core/debug/DebugLogger.js';

/**
 * PlayerAttackController - Handles auto-attack logic
 *
 * Base attack: 4-directional fixed shots (simple, predictable)
 * Homing powerup: auto-tracking nearest enemy (separate ability)
 */
export class PlayerAttackController {
    constructor(player) {
        this.player = player;
        this._fireOpts = { speedMul: 1, rangeMul: 1, damageMul: 1, tint: 0xffffff, projectileId: 'projectile.player_basic' };
    }

    update(time, delta) {
        this._handleAutoAttack(time, delta);
    }

    _handleAutoAttack(time, delta) {
        const player = this.player;
        if (!player._nextAttackAt) player._nextAttackAt = time;

        const stats = player._stats();
        const attackInterval = stats.attackIntervalMs;

        // Prevent timer drift after pause
        if (time - player._nextAttackAt > attackInterval * 3) {
            player._nextAttackAt = time;
        }

        if (time < player._nextAttackAt) return;

        // Base attack ALWAYS fires (4-directional)
        this._shootDirectional(stats);

        // Homing shot fires ADDITIONALLY if powerup equipped (like VS ability)
        if (player.homingLevel > 0) {
            const target = this._findNearestEnemy();
            if (target) this._shootHoming(target, stats);
        }

        player._nextAttackAt = Math.max(player._nextAttackAt + attackInterval, time + attackInterval);

        player._playSfx(player.sfx.shoot);
        player.scene.frameworkDebug?.onPlayerShoot?.(player, Math.max(1, Math.round(stats.projectileCount)));
    }

    /**
     * Base attack: shoot in 4 fixed directions (up, down, left, right)
     * With multi_shot, adds more directions (8-way, 12-way, etc.)
     */
    _shootDirectional(stats) {
        const player = this.player;
        const ps = player.scene.projectileSystem;
        if (!ps) return;

        const projectileCount = Math.max(1, Math.round(stats.projectileCount));

        // Base 4 directions + extra from multi_shot spread evenly
        const totalDirs = Math.max(4, projectileCount);
        const angleStep = (Math.PI * 2) / totalDirs;
        // Offset rotation by player facing direction for feel
        const baseRotation = player.rotation || 0;

        const opts = this._fireOpts;
        opts.projectileId = stats.projectileRef || 'projectile.player_basic';
        // Apply projectile speed passive (ratio of modified speed to base config speed)
        opts.speedMul = (stats.projectileSpeed || ps.config.speed) / ps.config.speed;

        for (let i = 0; i < totalDirs; i++) {
            const angle = baseRotation + angleStep * i;
            opts.damageMul = this._rollCrit(stats.projectileDamage, stats) / ps.config.damage;
            opts.isCrit = this._lastShotCrit;
            ps.firePlayer(player.x, player.y, Math.cos(angle), Math.sin(angle), opts);
        }
    }

    /**
     * Homing attack: shoot at nearest enemy (from homing_shot powerup)
     */
    /**
     * Homing: projectile count = homingLevel (1-5), NOT stats.projectileCount.
     * multi_shot only affects directional base attack.
     */
    _shootHoming(target, stats) {
        const player = this.player;
        const ps = player.scene.projectileSystem;
        if (!ps) return;
        if (!stats) stats = player._stats();

        const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
        const homingCount = player.homingLevel || 1;

        const opts = this._fireOpts;
        opts.projectileId = stats.projectileRef || 'projectile.player_basic';

        // Apply projectile speed passive + homing speed/range bonuses
        const baseSpeedMul = (stats.projectileSpeed || ps.config.speed) / ps.config.speed;
        const homingBonus = player.homingSpeedBonus || 0;
        const homingRange = player.homingRangeBonus || 0;
        opts.speedMul = baseSpeedMul * (1 + (homingBonus / (stats.projectileSpeed || 200)));
        opts.rangeMul = 1 + (homingRange / (stats.projectileRange || 175));

        if (homingCount > 1) {
            const spreadRad = 0.3; // ~17° tight spread
            for (let i = 0; i < homingCount; i++) {
                const t = (i - (homingCount - 1) / 2);
                const angleOffset = (spreadRad / Math.max(1, homingCount - 1)) * t;
                opts.damageMul = this._rollCrit(stats.projectileDamage, stats) / ps.config.damage;
                opts.isCrit = this._lastShotCrit;
                ps.firePlayer(player.x, player.y, Math.cos(baseAngle + angleOffset), Math.sin(baseAngle + angleOffset), opts);
            }
        } else {
            opts.damageMul = this._rollCrit(stats.projectileDamage, stats) / ps.config.damage;
            opts.isCrit = this._lastShotCrit;
            ps.firePlayer(player.x, player.y, Math.cos(baseAngle), Math.sin(baseAngle), opts);
        }
    }

    _rollCrit(baseDamage, stats) {
        if (Math.random() < stats.critChance) {
            this._lastShotCrit = true;
            return Math.round(baseDamage * stats.critMult);
        }
        this._lastShotCrit = false;
        return Math.round(baseDamage);
    }

    _findNearestEnemy() {
        const scene = this.player.scene;
        if (scene.targetingSystem?.findNearestEnemy) {
            return scene.targetingSystem.findNearestEnemy(this.player);
        }
        return null;
    }

    findNearestEnemy() {
        return this._findNearestEnemy();
    }
}
