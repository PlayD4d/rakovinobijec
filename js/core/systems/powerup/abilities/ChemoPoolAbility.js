import { DebugLogger } from '../../../debug/DebugLogger.js';
import { ensureTexture, damageEnemiesInRadius } from '../../../utils/CombatUtils.js';

/**
 * ChemoPoolAbility - Santa Water style damage pools orbiting the player
 * Extracted from PowerUpAbilities for file-size compliance.
 */
export class ChemoPoolAbility {
    constructor(scene) {
        this.scene = scene;
        this._timer = null;
        this._subTimers = new Set(); // Track sub-timers for cleanup
        this._sprites = []; // Track pool sprites for cleanup
    }

    activate(config) {
        this.destroy();

        const { damage, poolRadius, duration, interval, poolCount, orbitRadius } = config;

        ensureTexture(this.scene, `_cpool_${poolRadius}`, poolRadius * 2, poolRadius * 2, (g) => {
            g.fillStyle(0x22aa66, 0.15);
            g.fillCircle(poolRadius, poolRadius, poolRadius);
            g.lineStyle(1, 0x22aa66, 0.3);
            g.strokeCircle(poolRadius, poolRadius, poolRadius);
        });

        const texKey = `_cpool_${poolRadius}`;
        const rSq = poolRadius * poolRadius;

        this._timer = this.scene.time.addEvent({
            delay: interval,
            loop: true,
            callback: () => {
                const p = this.scene?.player;
                if (!p?.active) return;

                const baseAngle = Math.random() * Math.PI * 2;
                for (let n = 0; n < poolCount; n++) {
                    const segmentAngle = (n / poolCount) * Math.PI * 2;
                    const jitter = (Math.random() - 0.5) * 0.6;
                    const angle = baseAngle + segmentAngle + jitter;
                    const dist = orbitRadius * (0.6 + Math.random() * 0.4);
                    const px = p.x + Math.cos(angle) * dist;
                    const py = p.y + Math.sin(angle) * dist;

                    const poolSprite = this.scene.add.sprite(px, py, texKey);
                    poolSprite.setOrigin(0.5).setAlpha(0);
                    poolSprite.setDepth((this.scene.DEPTH_LAYERS?.LOOT || 500) + 50);
                    this._sprites.push(poolSprite);

                    this.scene.tweens.add({ targets: poolSprite, alpha: 0.8, duration: 300 });

                    const tickTimer = this.scene.time.addEvent({
                        delay: 500,
                        repeat: Math.floor(duration / 500) - 1,
                        callback: () => damageEnemiesInRadius(this.scene, px, py, rSq, damage)
                    });
                    this._subTimers.add(tickTimer);

                    const expireTimer = this.scene.time.delayedCall(duration, () => {
                        this._subTimers.delete(tickTimer);
                        this._subTimers.delete(expireTimer);
                        tickTimer.remove();
                        if (poolSprite?.scene) {
                            this.scene.tweens.add({
                                targets: poolSprite, alpha: 0, duration: 400,
                                onComplete: () => {
                                    const idx = this._sprites?.indexOf(poolSprite);
                                    if (idx >= 0) this._sprites.splice(idx, 1);
                                    if (poolSprite?.scene) poolSprite.destroy();
                                }
                            });
                        }
                    });
                    this._subTimers.add(expireTimer);
                }
            }
        });

        DebugLogger.info('powerup', `[ChemoPoolAbility] ${poolCount}x ${damage}dmg, r=${poolRadius}px, orbit=${orbitRadius}px, every ${interval}ms`);
    }

    destroy() {
        if (this._timer) { this._timer.remove(); this._timer = null; }
        for (const t of this._subTimers) {
            try { t.remove(); } catch (_) {}
        }
        this._subTimers = new Set();
        for (let i = this._sprites.length - 1; i >= 0; i--) {
            if (this._sprites[i]?.scene) this._sprites[i].destroy();
        }
        this._sprites = [];
    }
}
