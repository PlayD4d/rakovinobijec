import { DebugLogger } from '../../../debug/DebugLogger.js';
import { getSession } from '../../../debug/SessionLog.js';
import { getPreset as getParticlePreset } from '../../../vfx/ParticlePresets.js';

/**
 * ChainLightningAbility - Handles chain lightning power-up ability
 * Extracted from PowerUpAbilities for file size compliance (< 500 LOC)
 *
 * Manages: _updateChainLightning, _performChainLightning, _chainToEnemy
 * and associated timer tracking for cleanup.
 */
export class ChainLightningAbility {
    constructor(scene, powerUpSystem) {
        this.scene = scene;
        this.powerUpSystem = powerUpSystem;

        /** @type {Phaser.Time.TimerEvent[]} */
        this._chainTimers = [];

        /** @type {Set|null} Reusable set to avoid per-fire allocation */
        this._chainHitSet = null;
    }

    /**
     * Update chain lightning ability (called each frame while active)
     * @param {number} time - Absolute game time
     * @param {number} delta - Frame delta
     * @param {object} config - Ability configuration
     * @param {object} ability - Active ability record (from activeAbilities map)
     */
    update(time, delta, config, ability) {
        if (!ability) return;

        // Use absolute time instead of delta accumulation
        if (!ability.nextTriggerAt) {
            ability.nextTriggerAt = time + config.interval;
        }

        // Process with catch-up protection
        let triggers = 0;
        while (time >= ability.nextTriggerAt && triggers < 2) {
            this._performChainLightning(config);
            ability.nextTriggerAt += config.interval;
            triggers++;
        }

        if (triggers > 1) {
            DebugLogger.info('powerup', `[ChainLightningAbility] Chain lightning catch-up: ${triggers} triggers`);
        }
    }

    /**
     * Perform chain lightning attack — find closest enemy and start chain
     */
    _performChainLightning(config) {
        const player = this.scene.player;
        if (!player?.active) return;

        const enemies = [
            ...(this.scene.enemiesGroup?.getChildren() || []),
            ...(this.scene.bossGroup?.getChildren() || [])
        ];
        if (enemies.length === 0) return;

        // Find closest enemy or boss (squared distance avoids Math.sqrt)
        let closest = null;
        let minDistSq = config.range * config.range;

        for (const enemy of enemies) {
            if (!enemy?.active) continue;
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closest = enemy;
            }
        }

        if (!closest) return;

        // Start chain — fresh Set per chain to avoid stale entries from pending delayed callbacks
        const chainSet = new Set();
        this._chainToEnemy(closest, config.damage, config.jumps, config.jumpRange, chainSet);
    }

    /**
     * Chain lightning to enemy — recursive with delay between jumps
     */
    _chainToEnemy(enemy, damage, jumpsLeft, jumpRange, hitList) {
        if (!enemy?.active || jumpsLeft <= 0) return;

        hitList.add(enemy);

        // Apply damage
        if (enemy.takeDamage) {
            getSession()?.log('combat', 'chain_lightning_hit', { enemyId: enemy.blueprintId, damage, jumpsLeft });
            enemy.takeDamage({ amount: damage, source: 'chain_lightning' });
        }

        // Impact spark at strike point
        const vfx = this.scene.vfxSystem;
        if (vfx) {
            vfx.play(getParticlePreset('hit.small', 0x4488FF), enemy.x, enemy.y);
        }

        // Draw bolt from player (first hit) or previous enemy to this enemy
        const source = hitList.size <= 1 ? this.scene.player : null;
        if (vfx?.playLightningBolt && source) {
            vfx.playLightningBolt(source.x, source.y, enemy.x, enemy.y, {
                color: 0x4488FF, width: 3, duration: 180
            });
        }

        // Find next target and chain
        if (jumpsLeft > 1) {
            const enemies = [
                ...(this.scene.enemiesGroup?.getChildren() || []),
                ...(this.scene.bossGroup?.getChildren() || [])
            ];
            let next = null;
            let minDistSq = jumpRange * jumpRange;

            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (!e?.active || hitList.has(e)) continue;
                const dx = enemy.x - e.x;
                const dy = enemy.y - e.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    next = e;
                }
            }

            if (next) {
                // Draw bolt between chain targets
                if (vfx?.playLightningBolt) {
                    vfx.playLightningBolt(enemy.x, enemy.y, next.x, next.y, {
                        color: 0x4488FF, width: 2, duration: 180
                    });
                }

                // Continue chain after delay
                const timer = this.scene.time?.delayedCall(150, () => {
                    // Remove from tracking on completion
                    if (this._chainTimers) {
                        const idx = this._chainTimers.indexOf(timer);
                        if (idx !== -1) this._chainTimers.splice(idx, 1);
                    }
                    if (!next?.active || !this.scene) return;
                    this._chainToEnemy(next, damage * 0.8, jumpsLeft - 1, jumpRange, hitList);
                });
                if (timer && this._chainTimers) this._chainTimers.push(timer);
            }
        }
    }

    /**
     * Reset timers after pause/resume
     * @param {number} now - Current game time
     * @param {object} ability - Active ability record
     */
    resetTimersAfterPause(now, ability) {
        if (ability) {
            ability.nextTriggerAt = now + (ability.config?.interval || 2000);
            DebugLogger.info('powerup', '[ChainLightningAbility] Timer reset after pause');
        }
    }

    /**
     * Cleanup all pending timers and references
     */
    destroy() {
        if (this._chainTimers) {
            for (const t of this._chainTimers) { if (t?.destroy) t.destroy(); }
            this._chainTimers = [];
        }
        this._chainHitSet = null;
        this.scene = null;
        this.powerUpSystem = null;
    }
}
