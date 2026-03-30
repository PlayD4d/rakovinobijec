/**
 * TelegraphEffects - Boss attack warning visuals (Albion Online style)
 *
 * Three telegraph types:
 * - Circle (playTelegraph): AoE abilities — progressive fill from center
 * - Directional (playDirectionalTelegraph): Beam abilities — rectangle toward target
 * - Danger Zone (playDangerZone): Persistent DoT areas — pulsing circle
 *
 * All use GraphicsFactory pooling, Phaser tweens, and support followTarget.
 * Methods are mixed into VFXSystem via installTelegraphEffects().
 */

/**
 * Install telegraph methods on a VFX system instance.
 * @param {VFXSystem} vfxSystem
 */
export function installTelegraphEffects(vfxSystem) {
    vfxSystem.playTelegraph = playTelegraph;
    vfxSystem.playDirectionalTelegraph = playDirectionalTelegraph;
    vfxSystem.playDangerZone = playDangerZone;
}

/**
 * Circle telegraph — progressive fill from center to edge.
 * Used for AoE abilities (radiation pulse, core overload, area damage).
 *
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {object} opts - { radius, color, duration, followTarget }
 */
function playTelegraph(x, y, opts = {}) {
    if (!this.scene?.sys?.isActive()) return null;
    if (this._activeTelegraphs.length >= 8) return null;

    const color = opts.color || 0xDD1111;
    const radius = opts.radius || 80;
    const duration = opts.duration || 1000;
    const followTarget = opts.followTarget || null;

    const gf = this.scene.graphicsFactory;
    const g = gf.create();
    g.clear();
    g.setAlpha(1);
    g.setScale(1);
    g.setPosition(x, y);
    g.setDepth((this.scene.DEPTH_LAYERS?.ENEMIES || 1000) - 1);

    const handle = { graphics: g, tween: null, progress: 0 };
    this._activeTelegraphs.push(handle);

    handle.tween = this.scene.tweens.add({
        targets: handle,
        progress: 1,
        duration: duration,
        ease: 'Sine.easeIn',
        onUpdate: () => {
            if (!g.scene) return;

            if (followTarget?.active) {
                g.setPosition(followTarget.x, followTarget.y);
            }

            g.clear();

            // Outer border (full danger area, always visible)
            g.lineStyle(2, color, 0.5);
            g.strokeCircle(0, 0, radius);

            // Progressive fill — grows from center
            const fillRadius = radius * handle.progress;
            if (fillRadius > 1) {
                g.fillStyle(color, 0.12 + handle.progress * 0.18);
                g.fillCircle(0, 0, fillRadius);
            }

            // Leading edge ring at fill boundary
            if (fillRadius > 5) {
                g.lineStyle(2, color, 0.4 + handle.progress * 0.4);
                g.strokeCircle(0, 0, fillRadius);
            }
        },
        onComplete: () => {
            const idx = this._activeTelegraphs.indexOf(handle);
            if (idx !== -1) this._activeTelegraphs.splice(idx, 1);
            if (handle.graphics) {
                if (gf) gf.release(g); else g.destroy();
                handle.graphics = null; // Prevent double-release from clearTelegraphs()
            }
        }
    });

    return handle;
}

/**
 * Directional telegraph — rectangle from source toward target.
 * Used for beam/sweep abilities. Re-aims at player each frame if followSource set.
 *
 * @param {number} x - Source X (boss position)
 * @param {number} y - Source Y
 * @param {object} opts - { targetX, targetY, length, width, color, duration, followSource }
 */
function playDirectionalTelegraph(x, y, opts = {}) {
    if (!this.scene?.sys?.isActive()) return null;
    if (this._activeTelegraphs.length >= 8) return null;

    const targetX = opts.targetX ?? x + 100;
    const targetY = opts.targetY ?? y;
    const length = opts.length || 300;
    const width = opts.width || 40;
    const color = opts.color || 0xDD1111;
    const duration = opts.duration || 1000;
    const followSource = opts.followSource || null;

    const gf = this.scene.graphicsFactory;
    const g = gf.create();
    g.clear();
    g.setAlpha(1);
    g.setScale(1);
    g.setPosition(x, y);
    g.setDepth((this.scene.DEPTH_LAYERS?.ENEMIES || 1000) - 1);

    // Initial rotation toward target
    g.setRotation(Math.atan2(targetY - y, targetX - x));

    const handle = { graphics: g, tween: null, progress: 0 };
    this._activeTelegraphs.push(handle);

    const halfW = width / 2;

    handle.tween = this.scene.tweens.add({
        targets: handle,
        progress: 1,
        duration: duration,
        ease: 'Sine.easeIn',
        onUpdate: () => {
            if (!g.scene) return;

            // Follow source + re-aim at player
            if (followSource?.active) {
                g.setPosition(followSource.x, followSource.y);
                const player = this.scene?.player;
                if (player?.active) {
                    g.setRotation(Math.atan2(player.y - followSource.y, player.x - followSource.x));
                }
            }

            g.clear();

            // Outer border (full range rectangle)
            g.lineStyle(1, color, 0.4);
            g.strokeRect(0, -halfW, length, width);

            // Progressive fill along length
            const fillLen = length * handle.progress;
            if (fillLen > 1) {
                g.fillStyle(color, 0.10 + handle.progress * 0.20);
                g.fillRect(0, -halfW, fillLen, width);
            }

            // Leading edge line
            if (fillLen > 2) {
                g.lineStyle(2, color, 0.5 + handle.progress * 0.4);
                g.lineBetween(fillLen, -halfW, fillLen, halfW);
            }
        },
        onComplete: () => {
            const idx = this._activeTelegraphs.indexOf(handle);
            if (idx !== -1) this._activeTelegraphs.splice(idx, 1);
            if (handle.graphics) {
                if (gf) gf.release(g); else g.destroy();
                handle.graphics = null;
            }
        }
    });

    return handle;
}

/**
 * Persistent danger zone — pulsing circle on ground for full duration.
 * Used for DoT areas (radiation storm). Follows target entity.
 *
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {object} opts - { radius, color, duration, followTarget }
 */
function playDangerZone(x, y, opts = {}) {
    if (!this.scene?.sys?.isActive()) return null;

    const color = opts.color || 0xDD1111;
    const radius = opts.radius || 100;
    const duration = opts.duration || 3000;
    const followTarget = opts.followTarget || null;

    const gf = this.scene.graphicsFactory;
    const g = gf.create();
    g.clear();
    g.setAlpha(1);
    g.setScale(1);
    g.setPosition(x, y);
    g.setDepth((this.scene.DEPTH_LAYERS?.ENEMIES || 1000) - 1);

    const handle = { graphics: g, tween: null, elapsed: 0 };
    this._activeTelegraphs.push(handle);

    handle.tween = this.scene.tweens.add({
        targets: handle,
        elapsed: 1,
        duration: duration,
        ease: 'Linear',
        onUpdate: () => {
            if (!g.scene) return;

            if (followTarget?.active) {
                g.setPosition(followTarget.x, followTarget.y);
            }

            g.clear();

            // Pulsing alpha (~2 pulses per second)
            const pulse = 0.5 + 0.5 * Math.sin(handle.elapsed * Math.PI * 8);

            g.fillStyle(color, 0.08 + pulse * 0.12);
            g.fillCircle(0, 0, radius);

            g.lineStyle(2, color, 0.3 + pulse * 0.3);
            g.strokeCircle(0, 0, radius);

            g.lineStyle(1, color, 0.15 + pulse * 0.15);
            g.strokeCircle(0, 0, radius * 0.6);
        },
        onComplete: () => {
            const idx = this._activeTelegraphs.indexOf(handle);
            if (idx !== -1) this._activeTelegraphs.splice(idx, 1);
            if (handle.graphics) {
                if (gf) gf.release(g); else g.destroy();
                handle.graphics = null;
            }
        }
    });

    return handle;
}
