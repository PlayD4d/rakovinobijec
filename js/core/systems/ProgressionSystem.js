/**
 * ProgressionSystem - XP calculation, level-up thresholds, and softcap logic
 *
 * Extracted from GameScene.addXP so the formula lives in one testable place.
 * All tuning knobs come from ConfigResolver (progression.xp.*, loot.xpScaling.*).
 *
 * @module ProgressionSystem
 */

import { DebugLogger } from '../debug/DebugLogger.js';

export class ProgressionSystem {
    /**
     * @param {Phaser.Scene} scene - The owning GameScene (provides time, configResolver, gameStats)
     */
    constructor(scene) {
        this.scene = scene;
        this.gameStats = scene.gameStats;
        this._pendingXP = 0;

        this._cr = scene.configResolver || window.ConfigResolver;
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Add XP with time-based scaling and handle a single level-up.
     * Excess XP is stored as pending and should be re-added after unpause.
     *
     * @param {number} baseAmount - Raw XP before scaling
     */
    addXP(baseAmount) {
        const amount = this._applyTimeScaling(baseAmount);

        this.gameStats.xp += amount;
        if (this.scene.player) {
            this.scene.player.xp = this.gameStats.xp;
        }

        // Process ONE level-up per call to prevent stacking
        if (this.gameStats.xp >= this.gameStats.xpToNext) {
            // If paused (e.g., power-up selection), defer ALL XP — don't consume any
            // The level-up will be processed after unpause via _pendingXP
            if (this.scene.isPaused) {
                this._pendingXP += amount;
                this.gameStats.xp -= amount; // Undo the add above
                if (this.scene.player) this.scene.player.xp = this.gameStats.xp;
                return;
            }
            const excessXP = this.gameStats.xp - this.gameStats.xpToNext;

            this.gameStats.xp = 0;
            if (this.scene.player) {
                this.scene.player.xp = this.gameStats.xp;
            }

            this.gameStats.level++;

            this.gameStats.xpToNext = this.getXPToNextLevel(this.gameStats.level);

            this._pendingXP += excessXP;

            DebugLogger.log('progression', 'DEBUG',
                `Level up → ${this.gameStats.level}  (xpToNext=${this.gameStats.xpToNext}, pending=${this._pendingXP})`);

            // Delegate the actual level-up ceremony back to the scene
            this.scene.levelUp();
        }
    }

    /**
     * Calculate XP required to advance from the given level, applying softcap.
     *
     * Formula: floor( baseReq * multiplier ^ effExp )
     *   where effExp flattens after softcapStart.
     *
     * @param {number} level - Current player level
     * @returns {number} XP needed for the next level
     */
    getXPToNextLevel(level) {
        const cr = this._cr;
        const baseReq      = cr?.get('progression.xp.baseRequirement',   { defaultValue: 8   }) ?? 8;
        const multiplier   = cr?.get('progression.xp.scalingMultiplier', { defaultValue: 1.18 }) ?? 1.18;
        const softcapStart = cr?.get('progression.xp.softcapStart',      { defaultValue: 21   }) ?? 21;
        const postSlope    = cr?.get('progression.xp.postSlope',         { defaultValue: 0.5  }) ?? 0.5;

        let effExp = level - 1;

        if (level >= softcapStart) {
            const pre = softcapStart - 1;                   // exponent at softcapStart (continuous)
            const inc = level - softcapStart;               // 0 at first post-softcap level
            effExp = pre + postSlope * inc;                 // flattened exponent growth
        }

        return Math.floor(baseReq * Math.pow(multiplier, effExp));
    }

    /**
     * @returns {number} XP that overflowed from the last level-up
     */
    getPendingXP() {
        return this._pendingXP;
    }

    /**
     * Consume and return pending XP, resetting it to zero.
     * @returns {number} The pending XP that was cleared
     */
    clearPendingXP() {
        const xp = this._pendingXP;
        this._pendingXP = 0;
        return xp;
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    /**
     * Apply time-based XP scaling (reward late-game survival).
     * @param {number} rawAmount
     * @returns {number} Scaled amount (rounded)
     * @private
     */
    _applyTimeScaling(rawAmount) {
        const cr = this._cr;
        const scalingEnabled = cr?.get('loot.xpScaling.enabled', { defaultValue: true });

        if (!scalingEnabled) return rawAmount;

        const growthPerMinute = cr?.get('loot.xpScaling.growthPerMinute', { defaultValue: 0.03 });
        const maxMultiplier   = cr?.get('loot.xpScaling.maxMultiplier',   { defaultValue: 2.0  });

        const minutesAlive = (this.scene.time.now - (this.scene.startTime ?? this.scene.time.now)) / 60000;
        const scalingMultiplier = Math.min(1 + (growthPerMinute * minutesAlive), maxMultiplier);

        return Math.round(rawAmount * scalingMultiplier);
    }
}
