import { createGraphicsForEffect } from './createGraphicsHelper.js';

/**
 * ImmuneAuraEffect — Garlic-style visible aura ring around player
 * Shows exact damage radius with pulsing green circle.
 */
export class ImmuneAuraEffect {
    constructor(scene, type, config = {}) {
        this.scene = scene;
        this.type = type;
        this.radius = config.radius || 60;
        this.color = config.color || 0x44ff44;
        this.alpha = config.alpha || 0.15;
        this.graphics = null;
        this.entity = null;
        this.active = false;
    }

    attach(entity) {
        if (this.active) this.detach();
        this.entity = entity;
        this.active = true;

        this.graphics = createGraphicsForEffect(this.scene, 'ImmuneAuraEffect');
        if (this.graphics) {
            this.graphics.setDepth(entity.depth - 1);
            this._draw();
        }
    }

    detach() {
        this.active = false;
        this.entity = null;
        if (this.graphics) {
            if (this.scene?.graphicsFactory) {
                this.scene.graphicsFactory.release(this.graphics);
            } else {
                this.graphics.destroy();
            }
            this.graphics = null;
        }
    }

    updateConfig(config) {
        if (config.radius !== undefined) this.radius = config.radius;
        if (config.color !== undefined) this.color = config.color;
        if (this.active) this._draw();
    }

    update(time, delta) {
        if (!this.active || !this.entity || !this.graphics) return;

        // Follow player
        this.graphics.x = this.entity.x;
        this.graphics.y = this.entity.y;

        // Subtle pulse — radius breathes ±3px, alpha breathes
        const pulse = Math.sin(time * 0.003);
        const breathe = 1 + pulse * 0.04;
        this.graphics.setScale(breathe);
        this.graphics.alpha = this.alpha + pulse * 0.05;
    }

    _draw() {
        if (!this.graphics) return;
        this.graphics.clear();

        // Outer ring — main visible boundary
        this.graphics.lineStyle(2, this.color, 0.6);
        this.graphics.strokeCircle(0, 0, this.radius);

        // Inner soft glow ring
        this.graphics.lineStyle(4, this.color, 0.15);
        this.graphics.strokeCircle(0, 0, this.radius * 0.85);

        // Subtle fill — very transparent
        this.graphics.fillStyle(this.color, 0.04);
        this.graphics.fillCircle(0, 0, this.radius);
    }

    destroy() {
        this.detach();
    }
}
