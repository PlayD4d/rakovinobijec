/**
 * CombatVFXEffects - Explosion, beam, and lightning visual effects
 *
 * Instant combat feedback visuals (not telegraphs/warnings).
 * All use GraphicsFactory pooling and Phaser tweens.
 * Methods are mixed into VFXSystem via installCombatVFX().
 */

import { getPreset as getParticlePreset } from './ParticlePresets.js';

/**
 * Install combat VFX methods on a VFX system instance.
 * @param {VFXSystem} vfxSystem
 */
export function installCombatVFX(vfxSystem) {
    vfxSystem.playExplosionEffect = playExplosionEffect;
    vfxSystem.playBeamEffect = playBeamEffect;
    vfxSystem.playRotatingBeams = playRotatingBeams;
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
    this.play(getParticlePreset('explosion.medium', color), x, y);

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
    const duration = opts.duration || 600;

    const gf = this.scene.graphicsFactory;
    const g = gf.create();
    g.clear();
    g.setAlpha(1);
    g.setScale(1);
    // Reset ALL transform state — pooled Graphics may carry stale rotation/position from telegraphs
    g.setPosition(0, 0);
    g.setRotation(0);
    g.setDepth(this.scene.DEPTH_LAYERS?.VFX || 3000);

    // Wide outer glow — dominant visual
    g.lineStyle(width * 5, color, 0.3);
    g.lineBetween(x1, y1, x2, y2);

    // Main beam line — thick and bright
    g.lineStyle(width * 2, color, 0.9);
    g.lineBetween(x1, y1, x2, y2);

    // White-hot center core
    g.lineStyle(Math.max(2, width * 0.6), 0xFFFFFF, 0.8);
    g.lineBetween(x1, y1, x2, y2);

    // Pulse: flash bright → hold → fade out
    this.scene.tweens.add({
        targets: g,
        alpha: { from: 1, to: 0 },
        duration: duration,
        ease: 'Cubic.easeIn', // Holds bright longer, fades late
        onComplete: () => {
            if (gf) gf.release(g); else g.destroy();
        }
    });
}

/**
 * Rotating beam wedges — N sectors rotating around a center point.
 * Used for radiation storm, boss radiotherapy, etc.
 * Graphics object is drawn once, then rotated via tween for zero-GC.
 *
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {object} opts - { radius, beamCount, beamWidth, color, duration, rotations, followTarget }
 * @returns {{ graphics, tween }} Handle for cleanup
 */
function playRotatingBeams(x, y, opts = {}) {
    if (!this.scene?.sys?.isActive()) return null;

    const radius = opts.radius || 200;
    const beamCount = opts.beamCount || 3;
    const beamWidth = opts.beamWidth || 0.4;
    const color = opts.color || 0x88CC00;
    const duration = opts.duration || 5000;
    const rotations = opts.rotations || 1.5;
    const followTarget = opts.followTarget || null;

    const gf = this.scene.graphicsFactory;
    const g = gf.create();
    g.setPosition(x, y);
    g.setRotation(0);
    g.setDepth((this.scene.DEPTH_LAYERS?.ENEMIES || 1000) - 2);

    // Draw beam wedges once (static shape — rotation via tween)
    const angleStep = (Math.PI * 2) / beamCount;
    const halfW = beamWidth / 2;
    for (let i = 0; i < beamCount; i++) {
        const angle = angleStep * i;
        // Filled wedge
        g.fillStyle(color, 0.25);
        g.beginPath();
        g.moveTo(0, 0);
        for (let s = 0; s <= 8; s++) {
            const a = angle - halfW + (beamWidth * s / 8);
            g.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
        }
        g.closePath();
        g.fillPath();
        // Edge lines
        g.lineStyle(1.5, color, 0.4);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(angle - halfW) * radius, Math.sin(angle - halfW) * radius);
        g.moveTo(0, 0);
        g.lineTo(Math.cos(angle + halfW) * radius, Math.sin(angle + halfW) * radius);
        g.strokePath();
    }

    // Rotate via tween
    const handle = { graphics: g, angle: 0 };
    handle.tween = this.scene.tweens.add({
        targets: handle,
        angle: Math.PI * 2 * rotations,
        duration: duration,
        ease: 'Linear',
        onUpdate: () => {
            if (!handle.graphics?.scene) return;
            if (followTarget?.active) g.setPosition(followTarget.x, followTarget.y);
            g.setRotation(handle.angle);
        },
        onComplete: () => {
            if (handle.graphics) {
                if (gf) gf.release(g); else g.destroy();
                handle.graphics = null;
            }
            // Remove stale handle from tracking array
            if (this._activeTelegraphs) {
                const idx = this._activeTelegraphs.indexOf(handle);
                if (idx !== -1) this._activeTelegraphs.splice(idx, 1);
            }
        }
    });

    // Track for cleanup on boss death / level transition
    if (this._activeTelegraphs) this._activeTelegraphs.push(handle);

    return handle;
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
    this.play(getParticlePreset('hit.small', color), x2, y2);

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
