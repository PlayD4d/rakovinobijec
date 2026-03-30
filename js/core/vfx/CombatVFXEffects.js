/**
 * CombatVFXEffects - Explosion, beam, and lightning visual effects
 *
 * Instant combat feedback visuals (not telegraphs/warnings).
 * All use GraphicsFactory pooling and Phaser tweens.
 * Methods are mixed into VFXSystem via installCombatVFX().
 */

import { VFXPresets } from './VFXPresets.js';

/**
 * Install combat VFX methods on a VFX system instance.
 * @param {VFXSystem} vfxSystem
 */
export function installCombatVFX(vfxSystem) {
    vfxSystem.playExplosionEffect = playExplosionEffect;
    vfxSystem.playBeamEffect = playBeamEffect;
    vfxSystem.playLightningBolt = playLightningBolt;
}

/**
 * Multi-layer explosion — particle burst + expanding shockwave ring + center flash.
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {object} opts - { color, radius, duration }
 */
function playExplosionEffect(x, y, opts = {}) {
    if (!this.scene?.sys?.isActive()) return;

    const color = opts.color || 0xFF6600;
    const radius = opts.radius || 60;
    const duration = opts.duration || 400;

    // Layer 1: Particle burst
    this.play(VFXPresets.explosion('medium', color), x, y);

    // Layer 2: Expanding shockwave ring
    const gf = this.scene.graphicsFactory;
    const ring = gf.create();
    ring.clear();
    ring.setAlpha(1);
    ring.setScale(1);
    ring.setPosition(x, y);
    ring.setDepth(this.scene.DEPTH_LAYERS?.VFX || 3000);

    ring.lineStyle(3, color, 0.8);
    ring.strokeCircle(0, 0, 5);
    ring.fillStyle(color, 0.15);
    ring.fillCircle(0, 0, 5);

    this.scene.tweens.add({
        targets: ring,
        scaleX: radius / 5,
        scaleY: radius / 5,
        alpha: 0,
        duration: duration,
        ease: 'Power2',
        onComplete: () => {
            if (gf) gf.release(ring); else ring.destroy();
        }
    });

    // Layer 3: Brief center flash
    const flash = gf.create();
    flash.clear();
    flash.setAlpha(1);
    flash.setScale(1);
    flash.setPosition(x, y);
    flash.setDepth((this.scene.DEPTH_LAYERS?.VFX || 3000) + 1);
    flash.fillStyle(0xFFFFFF, 0.9);
    flash.fillCircle(0, 0, radius * 0.3);

    this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: duration * 0.4,
        ease: 'Power3',
        onComplete: () => {
            if (gf) gf.release(flash); else flash.destroy();
        }
    });
}

/**
 * Beam VFX — line from source to target with glow + fade.
 * @param {number} x1 - Source X
 * @param {number} y1 - Source Y
 * @param {number} x2 - Target X
 * @param {number} y2 - Target Y
 * @param {object} opts - { color, width, duration }
 */
function playBeamEffect(x1, y1, x2, y2, opts = {}) {
    if (!this.scene?.sys?.isActive()) return;

    const color = opts.color || 0xFF4400;
    const width = opts.width || 4;
    const duration = opts.duration || 200;

    const gf = this.scene.graphicsFactory;
    const g = gf.create();
    g.clear();
    g.setAlpha(1);
    g.setScale(1);
    g.setPosition(0, 0);
    g.setDepth(this.scene.DEPTH_LAYERS?.VFX || 3000);

    // Main beam line
    g.lineStyle(width, color, 0.9);
    g.lineBetween(x1, y1, x2, y2);

    // Glow (wider, more transparent)
    g.lineStyle(width * 3, color, 0.2);
    g.lineBetween(x1, y1, x2, y2);

    this.scene.tweens.add({
        targets: g,
        alpha: 0,
        duration: duration,
        ease: 'Power2',
        onComplete: () => {
            if (gf) gf.release(g); else g.destroy();
        }
    });
}

/**
 * Lightning bolt — jagged line with glow + impact spark + fade.
 * @param {number} x1 - Start X
 * @param {number} y1 - Start Y
 * @param {number} x2 - End X
 * @param {number} y2 - End Y
 * @param {object} opts - { color, width, duration, segments }
 */
function playLightningBolt(x1, y1, x2, y2, opts = {}) {
    if (!this.scene?.sys?.isActive()) return;

    const color = opts.color || 0x4488FF;
    const width = opts.width || 3;
    const duration = opts.duration || 200;
    const segments = opts.segments || 6;

    const gf = this.scene.graphicsFactory;
    const g = gf.create();
    g.clear();
    g.setAlpha(1);
    g.setScale(1);
    g.setPosition(0, 0);
    g.setDepth((this.scene.DEPTH_LAYERS?.VFX || 3000) + 1);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const perpX = -dy;
    const perpY = dx;
    const len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
    const normPX = perpX / len;
    const normPY = perpY / len;

    // Glow layer
    g.lineStyle(width + 4, color, 0.3);
    g.beginPath();
    g.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const jitter = (Math.random() - 0.5) * 20;
        g.lineTo(x1 + dx * t + normPX * jitter, y1 + dy * t + normPY * jitter);
    }
    g.lineTo(x2, y2);
    g.strokePath();

    // Core bolt
    g.lineStyle(width, 0xFFFFFF, 0.9);
    g.beginPath();
    g.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const jitter = (Math.random() - 0.5) * 12;
        g.lineTo(x1 + dx * t + normPX * jitter, y1 + dy * t + normPY * jitter);
    }
    g.lineTo(x2, y2);
    g.strokePath();

    // Impact spark
    this.play(VFXPresets.smallHit(color, 6), x2, y2);

    this.scene.tweens.add({
        targets: g,
        alpha: 0,
        duration: duration,
        ease: 'Power2',
        onComplete: () => {
            if (gf) gf.release(g); else g.destroy();
        }
    });
}
