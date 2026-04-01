/**
 * FlameVFX - Flamethrower/fire cone visual effect
 *
 * Creates a widening cone of flame sprites from player toward target.
 * Used by oxidative_burst (flamethrower) ability.
 * Installed on VFXSystem via installFlameVFX().
 */

import { getPreset as getParticlePreset } from './ParticlePresets.js';

/**
 * Install flame VFX method on VFXSystem instance.
 */
export function installFlameVFX(vfxSystem) {
    vfxSystem.playFlameEffect = playFlameEffect;
}

/**
 * Flame cone — series of expanding/fading flame sprites along a line.
 * Wider at the end (cone shape), natural random spread, staggered timing.
 *
 * @param {number} ox - Origin X (player)
 * @param {number} oy - Origin Y
 * @param {number} tx - Target X (enemy)
 * @param {number} ty - Target Y
 * @param {object} opts - { range, radius, color, duration }
 */
function playFlameEffect(ox, oy, tx, ty, opts = {}) {
    if (!this.scene?.sys?.isActive()) return;

    const range = opts.range || 150;
    const radius = opts.radius || 40;
    const color = opts.color || 0xFF6600;
    const duration = opts.duration || 350;
    const gf = this.scene.graphicsFactory;
    if (!gf) return;

    const dx = tx - ox, dy = ty - oy;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist, ny = dy / dist;
    const perpX = -ny, perpY = nx;
    const vfxDepth = this.scene.DEPTH_LAYERS?.VFX || 3000;

    // 5-7 flame sprites along the cone
    const steps = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps; // 0→1 along line
        const d = range * t;
        const spread = radius * t; // Cone: wider at end
        const offset = (Math.random() - 0.5) * spread * 2;

        const fx = ox + nx * d + perpX * offset;
        const fy = oy + ny * d + perpY * offset;

        const flame = gf.create();
        flame.clear();
        const size = 4 + t * 8;
        const alpha = 0.7 - t * 0.3;

        // Dual-color: orange core + yellow highlight
        flame.fillStyle(color, alpha);
        flame.fillCircle(0, 0, size);
        flame.fillStyle(0xFFDD00, alpha * 0.5);
        flame.fillCircle(0, 0, size * 0.5);

        flame.setPosition(fx, fy);
        flame.setDepth(vfxDepth);
        flame.setScale(0.5);

        this.scene.tweens.add({
            targets: flame,
            x: fx + nx * 15 + (Math.random() - 0.5) * 10,
            y: fy + ny * 15 + (Math.random() - 0.5) * 10,
            scaleX: 1.5 + Math.random(),
            scaleY: 1.5 + Math.random(),
            alpha: 0,
            duration: duration + Math.random() * 150,
            delay: i * 20,
            ease: 'Power2',
            onComplete: () => {
                if (gf) gf.release(flame); else flame.destroy();
            }
        });
    }

    // Muzzle flash at origin
    this.play(getParticlePreset('hit.small', 0xFFAA00), ox + nx * 15, oy + ny * 15);
}
