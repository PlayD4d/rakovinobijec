import { DebugLogger } from '../../debug/DebugLogger.js';

/**
 * RadiotherapyEffect - Rotating radiation beams around the player
 *
 * Damage detection uses Phaser Arcade Physics overlap (broadphase)
 * with a lightweight arc narrowphase — only enemies already inside
 * the circular zone are checked for beam angle.
 */
export class RadiotherapyEffect {
    constructor(scene, type, config = {}) {
        this.scene = scene;
        this.type = type;
        this.config = config;

        // Visual components
        this.graphics = null;
        this.entity = null;
        this.active = false;

        // Beam visual config from blueprint
        this.beamCount = config.beamCount || 1;
        this.beamRange = config.range || 80;
        const maxSafeWidth = ((Math.PI * 2) / Math.max(1, this.beamCount)) * 0.8;
        this.beamWidth = Math.min(config.beamWidth || 0.3, maxSafeWidth);
        this.beamColor = config.beamColor || 0xCCFF00;
        this.beamAlpha = config.beamAlpha || 0.7;
        this.rotationSpeed = config.rotationSpeed || 2;

        // Visual proportions
        this.innerRadius = config.innerRadius || 30;
        this.innerWidthRatio = config.innerWidthRatio || 0.4;
        this.outerWidthRatio = config.outerWidthRatio || 0.8;
        this.glowWidthRatio = config.glowWidthRatio || 0.3;
        this.glowAlpha = config.glowAlpha || 0.3;
        this.strokeWidth = config.strokeWidth || 2;
        this.strokeAlpha = config.strokeAlpha || 0.9;
        this.fillAlpha = config.fillAlpha || 0.7;

        // Damage config
        this.damage = config.damage || 5;
        this.tickRate = config.tickRate || 0.1;
        this.lastDamageTick = 0;

        // Rotation state
        this.currentAngle = 0;

        // Phaser physics zone for broadphase overlap
        this._damageZone = null;
        this._overlapCollider = null;

        // Per-tick tracking to prevent double damage
        this._hitThisTick = new Set();
        this._canDamage = false; // flipped by tick timer in update()
    }

    // ==================== Lifecycle ====================

    attach(entity) {
        if (this.active) this.detach();

        this.entity = entity;
        this.active = true;

        // Graphics for beam visuals
        this.graphics = this._createGraphics();
        if (this.graphics) {
            this.graphics.setDepth(entity.depth - 1);
            this.graphics.x = entity.x;
            this.graphics.y = entity.y;
        }

        // Create invisible circular physics zone for broadphase
        this._createDamageZone();

        DebugLogger.info('vfx', `[Radiotherapy] Attached — ${this.beamCount} beams, range ${this.beamRange}, damage ${this.damage}`);
    }

    detach() {
        if (!this.active) return;
        this.active = false;
        this.entity = null;

        // Destroy physics zone + collider
        this._destroyDamageZone();

        // Return graphics to pool
        if (this.graphics) {
            if (this.scene.graphicsFactory) {
                this.scene.graphicsFactory.release(this.graphics);
            } else {
                this.graphics.destroy();
            }
            this.graphics = null;
        }

        // Stop looping sound
        if (this.loopId && this.scene.audioSystem) {
            this.scene.audioSystem.stopLoop(this.loopId);
            this.loopId = null;
        }

        this._hitThisTick.clear();
    }

    updateConfig(config) {
        if (config.beamCount !== undefined) {
            this.beamCount = config.beamCount;
            const maxSafeWidth = ((Math.PI * 2) / Math.max(1, this.beamCount)) * 0.8;
            this.beamWidth = Math.min(config.beamWidth || this.beamWidth || 0.3, maxSafeWidth);
        }
        if (config.range !== undefined) {
            this.beamRange = config.range;
            // Resize physics zone to match new range
            this._resizeDamageZone();
        }
        if (config.damage !== undefined) this.damage = config.damage;
        if (config.beamWidth !== undefined) {
            const maxSafeWidth = ((Math.PI * 2) / Math.max(1, this.beamCount)) * 0.8;
            this.beamWidth = Math.min(config.beamWidth, maxSafeWidth);
        }
        if (config.rotationSpeed !== undefined) this.rotationSpeed = config.rotationSpeed;
        if (config.innerRadius !== undefined) this.innerRadius = config.innerRadius;
        if (config.innerWidthRatio !== undefined) this.innerWidthRatio = config.innerWidthRatio;
        if (config.outerWidthRatio !== undefined) this.outerWidthRatio = config.outerWidthRatio;
        if (config.beamColor !== undefined) this.beamColor = config.beamColor;
        if (config.beamAlpha !== undefined) this.beamAlpha = config.beamAlpha;
        if (config.glowAlpha !== undefined) this.glowAlpha = config.glowAlpha;
        if (config.strokeWidth !== undefined) this.strokeWidth = config.strokeWidth;
        if (config.strokeAlpha !== undefined) this.strokeAlpha = config.strokeAlpha;
        if (config.fillAlpha !== undefined) this.fillAlpha = config.fillAlpha;
    }

    // ==================== Update ====================

    update(time, delta) {
        if (!this.active || !this.entity?.active) return;

        // Move graphics + zone to follow entity
        const ex = this.entity.x;
        const ey = this.entity.y;
        if (this.graphics) {
            this.graphics.x = ex;
            this.graphics.y = ey;
        }
        if (this._damageZone?.body) {
            this._damageZone.setPosition(ex, ey);
        }

        // Rotate beams
        this.currentAngle += (this.rotationSpeed * delta) / 1000;
        if (this.currentAngle > Math.PI * 2) this.currentAngle -= Math.PI * 2;

        // Redraw beams
        this.graphics.clear();
        const angleStep = (Math.PI * 2) / this.beamCount;
        for (let i = 0; i < this.beamCount; i++) {
            this._drawBeam(this.currentAngle + angleStep * i);
        }

        // Damage tick
        if (time - this.lastDamageTick > this.tickRate * 1000) {
            this._canDamage = true;
            this._hitThisTick.clear();
            this.lastDamageTick = time;
        }
    }

    // ==================== Physics overlap (broadphase + narrowphase) ====================

    _createDamageZone() {
        const enemiesGroup = this.scene.enemiesGroup || this.scene.enemies;
        if (!enemiesGroup || !this.scene.physics) return;

        // Invisible circle zone — Phaser handles broadphase overlap
        this._damageZone = this.scene.add.zone(this.entity.x, this.entity.y, this.beamRange * 2, this.beamRange * 2);
        this.scene.physics.add.existing(this._damageZone, false);
        this._damageZone.body.setCircle(this.beamRange);
        this._damageZone.body.setOffset(0, 0); // center the circle

        // Register overlap — Phaser calls _onEnemyOverlap only for nearby enemies
        this._overlapCollider = this.scene.physics.add.overlap(
            this._damageZone,
            enemiesGroup,
            (zone, enemy) => this._onEnemyOverlap(enemy)
        );
    }

    _destroyDamageZone() {
        if (this._overlapCollider) {
            this.scene.physics.world.removeCollider(this._overlapCollider);
            this._overlapCollider = null;
        }
        if (this._damageZone) {
            this._damageZone.destroy();
            this._damageZone = null;
        }
    }

    _resizeDamageZone() {
        if (this._damageZone?.body) {
            this._damageZone.setSize(this.beamRange * 2, this.beamRange * 2);
            this._damageZone.body.setCircle(this.beamRange);
        }
    }

    /**
     * Called by Phaser for each enemy overlapping the circular zone.
     * This is the narrowphase — only a cheap arc angle check.
     */
    _onEnemyOverlap(enemy) {
        // Only process during damage tick window
        if (!this._canDamage) return;
        if (!enemy?.active || enemy.hp <= 0) return;
        if (this._hitThisTick.has(enemy)) return;
        if (typeof enemy.takeDamage !== 'function') return;

        // Arc narrowphase — is enemy inside any beam wedge?
        const dx = enemy.x - this.entity.x;
        const dy = enemy.y - this.entity.y;
        let enemyAngle = Math.atan2(dy, dx);
        if (enemyAngle < 0) enemyAngle += Math.PI * 2;

        const angleStep = (Math.PI * 2) / this.beamCount;
        const halfWidth = this.beamWidth / 2;

        for (let i = 0; i < this.beamCount; i++) {
            let beamAngle = (this.currentAngle + angleStep * i) % (Math.PI * 2);
            let diff = Math.abs(enemyAngle - beamAngle);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;

            if (diff <= halfWidth) {
                this._hitThisTick.add(enemy);
                enemy.takeDamage(this.damage, 'radiotherapy');

                // Throttled VFX
                if (this.scene.vfxSystem && Math.random() < 0.25) {
                    this.scene.vfxSystem.play('vfx.hit.radiation', enemy.x, enemy.y);
                }
                break;
            }
        }

        // After processing all overlapping enemies this frame, close the tick window
        // (done lazily — _canDamage is reset on next tick in update())
    }

    // ==================== Beam drawing ====================

    _drawBeam(angle) {
        const innerR = this.innerRadius;
        const outerR = this.beamRange;
        const innerW = this.beamWidth * this.innerWidthRatio;
        const outerW = this.beamWidth * this.outerWidthRatio;

        const innerStart = angle - innerW / 2;
        const innerEnd = angle + innerW / 2;
        const outerStart = angle - outerW / 2;
        const outerEnd = angle + outerW / 2;

        const color = this.beamColor;
        this.graphics.fillStyle(color, this.beamAlpha * this.fillAlpha);
        this.graphics.lineStyle(this.strokeWidth, color, this.beamAlpha * this.strokeAlpha);

        // Draw wedge shape
        this.graphics.beginPath();
        const sx = Math.cos(innerStart) * innerR;
        const sy = Math.sin(innerStart) * innerR;
        this.graphics.moveTo(sx, sy);

        for (let i = 1; i <= 5; i++) {
            const a = innerStart + (innerEnd - innerStart) * (i / 5);
            this.graphics.lineTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
        }
        this.graphics.lineTo(Math.cos(outerEnd) * outerR, Math.sin(outerEnd) * outerR);
        for (let i = 9; i >= 0; i--) {
            const a = outerStart + (outerEnd - outerStart) * (i / 10);
            this.graphics.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
        }
        this.graphics.lineTo(sx, sy);
        this.graphics.closePath();
        this.graphics.fillPath();
        this.graphics.strokePath();

        // Glow layer
        this.graphics.fillStyle(color, this.beamAlpha * this.glowAlpha);
        const glowR = (innerR + outerR) * 0.5;
        const glowW = (innerW + outerW) * this.glowWidthRatio;
        const glowStart = angle - glowW / 2;
        const glowEnd = angle + glowW / 2;

        this.graphics.beginPath();
        this.graphics.moveTo(Math.cos(glowStart) * innerR, Math.sin(glowStart) * innerR);
        for (let i = 0; i <= 5; i++) {
            const a = glowStart + (glowEnd - glowStart) * (i / 5);
            this.graphics.lineTo(Math.cos(a) * glowR, Math.sin(a) * glowR);
        }
        for (let i = 5; i >= 0; i--) {
            const a = glowStart + (glowEnd - glowStart) * (i / 5);
            this.graphics.lineTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
        }
        this.graphics.closePath();
        this.graphics.fillPath();
    }

    // ==================== Utilities ====================

    isActive() { return this.active; }

    destroy() { this.detach(); }

    _createGraphics() {
        if (this.scene.graphicsFactory) return this.scene.graphicsFactory.create();
        if (this.scene.add?.graphics) return this.scene.add.graphics();
        return null;
    }
}

export default RadiotherapyEffect;
