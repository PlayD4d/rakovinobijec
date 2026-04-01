import { DebugLogger } from '../../../debug/DebugLogger.js';
import { ensureTexture, forEachActiveEnemy } from '../../../utils/CombatUtils.js';

/**
 * RicochetAbility - Bouncing diamond projectile that ricochets off screen edges
 * Extracted from PowerUpAbilities for file-size compliance.
 */
export class RicochetAbility {
    constructor(scene) {
        this.scene = scene;
        this._timer = null;
        this._active = []; // Tracked in-flight entries for cleanup
    }

    activate(config) {
        this.destroy();

        const { damage, speed, bounces, count, interval } = config;

        // Bake diamond + trail textures
        ensureTexture(this.scene, '_ricochet_cell', 12, 12, (g) => {
            g.fillStyle(0x22aadd, 0.5);
            g.fillPoints([{ x: 6, y: 0 }, { x: 12, y: 6 }, { x: 6, y: 12 }, { x: 0, y: 6 }], true);
            g.fillStyle(0x66eeff, 1);
            g.fillPoints([{ x: 6, y: 1 }, { x: 11, y: 6 }, { x: 6, y: 11 }, { x: 1, y: 6 }], true);
            g.fillStyle(0xffffff, 0.8);
            g.fillPoints([{ x: 6, y: 3 }, { x: 9, y: 6 }, { x: 6, y: 9 }, { x: 3, y: 6 }], true);
        });
        ensureTexture(this.scene, '_ricochet_trail', 4, 4, (g) => {
            g.fillStyle(0x44ddff, 1);
            g.fillCircle(2, 2, 2);
        });

        const projDepth = (this.scene.DEPTH_LAYERS?.PROJECTILES || 3000) + 2;

        this._timer = this.scene.time.addEvent({
            delay: interval,
            loop: true,
            callback: () => {
                const p = this.scene?.player;
                if (!p?.active) return;
                for (let n = 0; n < count; n++) {
                    this._launchCell(p, damage, speed, bounces, projDepth);
                }
            }
        });

        DebugLogger.info('powerup', `[RicochetAbility] ${count}x ${damage}dmg, ${bounces} bounces`);
    }

    _launchCell(player, damage, speed, maxBounces, depth) {
        const angle = Math.random() * Math.PI * 2;
        const spr = this.scene.physics.add.sprite(player.x, player.y, '_ricochet_cell');
        spr.setDepth(depth).setOrigin(0.5);
        spr.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        spr.body.setCollideWorldBounds(true);
        spr.body.setBounce(1, 1);
        spr.body.onWorldBounds = true;
        spr.body.setAllowGravity(false);
        spr.rotation = angle;

        // Trail VFX via VFXSystem (avoids prohibited direct scene.add.particles)
        let trail = null;
        if (this.scene.vfxSystem?.createFollowEmitter) {
            trail = this.scene.vfxSystem.createFollowEmitter(spr, '_ricochet_trail', {
                frequency: 40, lifespan: 250,
                speed: { min: 5, max: 15 }, scale: { start: 0.6, end: 0 },
                alpha: { start: 0.5, end: 0 }, blendMode: 'ADD', quantity: 1
            });
            if (trail) trail.setDepth(depth - 1);
        }
        // Fallback: no trail if VFXSystem doesn't support follow emitters

        let bouncesLeft = maxBounces;
        const hitCooldowns = new WeakMap();

        const entry = { spr, trail, bounceHandler: null, hitTimer: null, safetyTimer: null };
        this._active.push(entry);

        const destroyCell = () => {
            if (entry.bounceHandler) {
                this.scene?.physics?.world?.off('worldbounds', entry.bounceHandler);
                entry.bounceHandler = null;
            }
            if (entry.hitTimer) { entry.hitTimer.remove(); entry.hitTimer = null; }
            if (entry.safetyTimer) { entry.safetyTimer.remove(); entry.safetyTimer = null; }
            if (trail) { trail.destroy(); trail = null; }
            entry.trail = null;
            if (spr?.scene) spr.destroy();
            const idx = this._active?.indexOf(entry);
            if (idx >= 0) this._active.splice(idx, 1);
        };

        entry.bounceHandler = (body) => {
            if (body.gameObject !== spr) return;
            bouncesLeft--;
            if (spr.body) spr.rotation = Math.atan2(spr.body.velocity.y, spr.body.velocity.x);
            if (bouncesLeft <= 0) destroyCell();
        };
        this.scene.physics.world.on('worldbounds', entry.bounceHandler);

        entry.hitTimer = this.scene.time.addEvent({
            delay: 100, loop: true,
            callback: () => {
                if (!spr?.scene || !spr.active) { destroyCell(); return; }
                const now = this.scene.time?.now || 0;
                forEachActiveEnemy(this.scene, (e) => {
                    const ex = e.x - spr.x, ey = e.y - spr.y;
                    if (ex * ex + ey * ey <= 256) { // 16px hit radius
                        const lastHit = hitCooldowns.get(e) || 0;
                        if (now - lastHit < 300) return;
                        hitCooldowns.set(e, now);
                        e.takeDamage({ amount: damage, source: 'ricochet' });
                    }
                });
            }
        });

        entry.safetyTimer = this.scene.time.delayedCall(8000, destroyCell);
    }

    destroy() {
        if (this._timer) { this._timer.remove(); this._timer = null; }
        for (let i = this._active.length - 1; i >= 0; i--) {
            const e = this._active[i];
            if (e.bounceHandler) this.scene?.physics?.world?.off('worldbounds', e.bounceHandler);
            if (e.hitTimer) e.hitTimer.remove();
            if (e.safetyTimer) e.safetyTimer.remove();
            if (e.trail) e.trail.destroy();
            if (e.spr?.scene) e.spr.destroy();
        }
        this._active = [];
    }
}
