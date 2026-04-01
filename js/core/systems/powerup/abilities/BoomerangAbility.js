import { DebugLogger } from '../../../debug/DebugLogger.js';
import { ensureTexture, forEachActiveEnemy } from '../../../utils/CombatUtils.js';

/**
 * BoomerangAbility - Projectile flies toward nearest enemy, returns to player
 * Extracted from PowerUpAbilities for file-size compliance.
 */
export class BoomerangAbility {
    constructor(scene) {
        this.scene = scene;
        this._timer = null;
        this._hitTimers = new Set(); // Track in-flight hit timers for cleanup
        this._sprites = new Set(); // Track in-flight sprites for cleanup
    }

    activate(config) {
        this.destroy();

        const { damage, speed, range, count, interval } = config;

        ensureTexture(this.scene, '_antibody_boom', 10, 10, (g) => {
            g.fillStyle(0xffcc00, 1);
            g.fillCircle(5, 5, 5);
            g.lineStyle(1, 0xffffff, 0.6);
            g.strokeCircle(5, 5, 5);
        });

        this._timer = this.scene.time.addEvent({
            delay: interval,
            loop: true,
            callback: () => {
                const p = this.scene?.player;
                if (!p?.active) return;

                const target = this.scene.findNearestEnemy?.();
                if (!target?.active) return;

                for (let n = 0; n < count; n++) {
                    this._launchBoomerang(p, target, damage, speed, range, count, n);
                }
            }
        });

        DebugLogger.info('powerup', `[BoomerangAbility] ${count}x ${damage}dmg, range=${range}px`);
    }

    _launchBoomerang(player, target, damage, speed, range, totalCount, index) {
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const dist = Math.hypot(dx, dy) || 1;
        const spread = totalCount > 1 ? (index - (totalCount - 1) / 2) * 0.2 : 0;
        const angle = Math.atan2(dy / dist, dx / dist) + spread;

        const spr = this.scene.add.sprite(player.x, player.y, '_antibody_boom');
        spr.setDepth((this.scene.DEPTH_LAYERS?.PROJECTILES || 3000) + 2);
        spr.setOrigin(0.5);
        this._sprites.add(spr);

        const flyDist = Math.min(range, dist + 30);
        const destX = player.x + Math.cos(angle) * flyDist;
        const destY = player.y + Math.sin(angle) * flyDist;
        const flyTime = (flyDist / speed) * 1000;
        const hitEnemies = new Set();

        const hitTimer = this.scene.time.addEvent({
            delay: 100, loop: true,
            callback: () => {
                if (!spr?.scene) { hitTimer.remove(); return; }
                forEachActiveEnemy(this.scene, (e) => {
                    if (hitEnemies.has(e)) return;
                    const ex = e.x - spr.x, ey = e.y - spr.y;
                    if (ex * ex + ey * ey <= 400) { // 20px hit radius
                        hitEnemies.add(e);
                        e.takeDamage(damage);
                    }
                });
            }
        });
        this._hitTimers.add(hitTimer);

        // Fly out
        this.scene.tweens.add({
            targets: spr, x: destX, y: destY,
            duration: flyTime, ease: 'Sine.easeOut',
            onComplete: () => {
                hitEnemies.clear();
                // Return
                this.scene.tweens.add({
                    targets: spr, x: player.x, y: player.y,
                    duration: flyTime * 0.8, ease: 'Sine.easeIn',
                    onComplete: () => {
                        hitTimer.remove();
                        this._hitTimers.delete(hitTimer);
                        this._sprites.delete(spr);
                        if (spr?.scene) spr.destroy();
                    }
                });
            }
        });
    }

    destroy() {
        if (this._timer) { this._timer.remove(); this._timer = null; }
        for (const t of this._hitTimers) {
            try { t.remove(); } catch (_) {}
        }
        this._hitTimers = new Set();
        for (const s of this._sprites) {
            if (s?.scene) {
                this.scene?.tweens?.killTweensOf(s);
                s.destroy();
            }
        }
        this._sprites = new Set();
    }
}
