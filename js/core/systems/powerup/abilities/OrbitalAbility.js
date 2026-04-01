import { DebugLogger } from '../../../debug/DebugLogger.js';
import { ensureTexture, forEachActiveEnemy } from '../../../utils/CombatUtils.js';

/**
 * OrbitalAbility - Sprites orbiting around the player dealing contact damage
 * Extracted from PowerUpAbilities for file-size compliance.
 */
export class OrbitalAbility {
    constructor(scene) {
        this.scene = scene;
        this._sprites = null;
        this._config = null;
        this._hitTimes = null;
        this._lastHitCheck = 0;
    }

    activate(player, config) {
        this.destroy();

        ensureTexture(this.scene, '_orbital_ab', 12, 12, (g) => {
            g.fillStyle(0x00ccff, 1);
            g.fillCircle(6, 6, 6);
        });

        this._sprites = [];
        for (let i = 0; i < config.count; i++) {
            const s = this.scene.add.sprite(player.x, player.y, '_orbital_ab');
            s.setDepth((this.scene.DEPTH_LAYERS?.PROJECTILES || 3000) + 1);
            s.setOrigin(0.5);
            this._sprites.push(s);
        }

        this._config = {
            count: config.count,
            damage: config.damage,
            radius: config.orbitRadius,
            speed: config.speed,
            angle: 0
        };
        this._hitTimes = new WeakMap();
        this._lastHitCheck = 0;

        DebugLogger.info('powerup', `[OrbitalAbility] ${config.count}x ${config.damage}dmg, r=${config.orbitRadius}px`);
    }

    update(time, delta) {
        const p = this.scene?.player;
        if (!p?.active || !this._config || !this._sprites) return;
        const cfg = this._config;

        cfg.angle += cfg.speed * (delta / 1000);

        for (let i = 0; i < this._sprites.length; i++) {
            const spr = this._sprites[i];
            if (!spr?.scene) continue;
            const a = cfg.angle + (i / cfg.count) * Math.PI * 2;
            spr.setPosition(
                p.x + Math.cos(a) * cfg.radius,
                p.y + Math.sin(a) * cfg.radius
            );
        }

        // Hit detection at 10Hz
        if (time - this._lastHitCheck < 100) return;
        this._lastHitCheck = time;

        const hitRSq = 18 * 18;
        for (let i = 0; i < this._sprites.length; i++) {
            const spr = this._sprites[i];
            if (!spr?.scene) continue;
            const ox = spr.x, oy = spr.y;
            forEachActiveEnemy(this.scene, (e) => {
                const dx = e.x - ox, dy = e.y - oy;
                if (dx * dx + dy * dy <= hitRSq) {
                    const lastHit = this._hitTimes.get(e) || 0;
                    if (time - lastHit < 500) return;
                    this._hitTimes.set(e, time);
                    e.takeDamage({ amount: cfg.damage, source: 'orbital' });
                }
            });
        }
    }

    destroy() {
        if (this._sprites) {
            for (let i = this._sprites.length - 1; i >= 0; i--) {
                if (this._sprites[i]?.scene) this._sprites[i].destroy();
            }
            this._sprites = null;
        }
        this._config = null;
        this._hitTimes = null;
    }
}
