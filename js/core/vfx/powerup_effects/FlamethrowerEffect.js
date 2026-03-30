import { DebugLogger } from '../../debug/DebugLogger.js';
import { getSession } from '../../debug/SessionLog.js';
import { createGraphicsForEffect } from './createGraphicsHelper.js';
import { registerDynamicOverlap } from '../../../handlers/setupCollisions.js';

/**
 * FlamethrowerEffect - PR7 compliant flamethrower visual effect
 * Creates an animated flame cone in front of entity
 */

export class FlamethrowerEffect {
    constructor(scene, type, config = {}) {
        this.scene = scene;
        this.type = type;
        this.config = config;
        
        // PR7: Get configuration from ConfigResolver
        const CR = scene.configResolver || window.ConfigResolver;
        this.baseLength = config.length || CR?.get('vfx.flamethrower.length', { defaultValue: 80 }) || 80;
        this.coneAngle = config.angle || CR?.get('vfx.flamethrower.angle', { defaultValue: 0.5 }) || 0.5;
        this.color = config.color || CR?.get('vfx.flamethrower.color', { defaultValue: 0xff6600 }) || 0xff6600;
        
        // Visual components
        this.graphics = null;
        this.entity = null;
        this.active = false;
        
        // Animation parameters
        this.animationTime = 0;
        this.flickerSpeed = 0.01;
        this.particleTimer = 0;
        this.particleInterval = 50; // ms between particles
        
        // Damage configuration
        this.damage = config.damage || 3;
        this.tickRate = config.tickRate || 0.1;
        this.lastDamageTick = 0;

        // Phaser physics zone for broadphase overlap
        this._damageZone = null;
        this._overlapCollider = null;
        this._hitThisTick = new Set();
        this._canDamage = false;
        
        DebugLogger.info('vfx', `[FlamethrowerEffect] Created - damage: ${this.damage}, tick rate: ${this.tickRate}s`);
    }
    
    /**
     * Update effect configuration (called when power-up levels up)
     * @param {Object} config - New configuration
     */
    updateConfig(config) {
        DebugLogger.info('vfx', '[FlamethrowerEffect] Updating config:', config);
        
        // Update damage parameters
        if (config.damage !== undefined) this.damage = config.damage;
        if (config.tickRate !== undefined) this.tickRate = config.tickRate;
        
        // Update visual parameters
        if (config.length !== undefined) this.baseLength = config.length;
        if (config.angle !== undefined) this.coneAngle = config.angle;
        if (config.color !== undefined) this.color = config.color;
        
        // Resize physics zone to match new range
        if (this.active && this._damageZone?.body) {
            const d = this.baseLength * 2;
            this._damageZone.setSize(d, d);
            this._damageZone.body.setCircle(this.baseLength);
            this._damageZone.body.setOffset(-this.baseLength + d/2, -this.baseLength + d/2);
        }
        
        DebugLogger.info('vfx', `[FlamethrowerEffect] Config updated - Length: ${this.baseLength}, Angle: ${(this.coneAngle * 180/Math.PI).toFixed(1)}°, Damage: ${this.damage}`);
    }
    
    /**
     * Attach effect to an entity
     * @param {Phaser.GameObjects.Sprite} entity
     */
    attach(entity) {
        if (this.active) this.detach();
        
        this.entity = entity;
        this.active = true;
        
        // PR7: Create graphics through factory
        this.graphics = this._createGraphics();
        if (this.graphics) {
            this.graphics.setDepth(entity.depth + 1);
            this.graphics.setPosition(entity.x, entity.y);
            this.graphics.rotation = entity.rotation || 0;
            this._drawFlame(); // Initial draw — visible immediately on first frame
        }
        
        // Create Phaser physics overlap zone for broadphase damage detection
        this._createPhysicsZone();
        
        // Play looping flamethrower sound — store PATH for stopLoop, not the sound object
        this.loopId = 'sound/flamethrower.mp3';
        if (this.scene.audioSystem) {
            this.scene.audioSystem.playLoop(this.loopId);
        }
    }
    
    /**
     * Detach effect from entity
     */
    detach() {
        if (!this.active) return;
        
        this.active = false;
        this.entity = null;
        
        // PR7: Clean up graphics properly
        if (this.graphics) {
            // Return to factory pool if available
            if (this.scene.graphicsFactory) {
                this.scene.graphicsFactory.release(this.graphics);
            } else {
                // Fallback to destroy
                this.graphics.destroy();
            }
            this.graphics = null;
        }
        
        // Clean up physics zone
        if (this._overlapCollider) {
            this.scene.physics.world.removeCollider(this._overlapCollider);
            this._overlapCollider = null;
        }
        if (this._damageZone) {
            if (this._damageZone.active) this._damageZone.destroy();
            this._damageZone = null;
        }
        this._hitThisTick.clear();

        // Stop looping flame sound - PR7: using audioSystem
        if (this.loopId && this.scene.audioSystem) {
            this.scene.audioSystem.stopLoop(this.loopId);
            this.loopId = null;
        }
    }
    
    /**
     * Update the effect
     * @param {number} time - Game time
     * @param {number} delta - Delta time
     */
    update(time, delta) {
        if (!this.active || !this.entity || !this.graphics) return;
        
        // Update animation time
        this.animationTime = time;
        this.particleTimer += delta;
        
        // Follow entity position + rotation (transform only — no redraw)
        this.graphics.x = this.entity.x;
        this.graphics.y = this.entity.y;
        this.graphics.rotation = this.entity.rotation || 0;

        // Animate flicker via scale (GPU transform, not CPU redraw)
        // Scale uniformly — since rotation is handled by graphics.rotation,
        // both axes scale along the flame's local coordinate system
        const flicker = 1.0 + 0.08 * Math.sin(this.animationTime * this.flickerSpeed);
        this.graphics.setScale(flicker);

        // Move physics zone to follow entity
        if (this._damageZone?.body) {
            this._damageZone.setPosition(this.entity.x, this.entity.y);
        }

        // Redraw flame geometry only at tick interval (~20fps) not every frame (60fps)
        if (this.particleTimer >= this.particleInterval) {
            this._emitFlameParticle();
            // Mutate pre-allocated tongue objects instead of allocating new array
            if (!this._tongues) {
                this._tongues = [{ offset: 0, lenFactor: 1, radius: 10 },
                                 { offset: 0, lenFactor: 1, radius: 10 },
                                 { offset: 0, lenFactor: 1, radius: 10 }];
            }
            for (let i = 0; i < 3; i++) {
                this._tongues[i].offset = (Math.random() - 0.5) * this.coneAngle * 2;
                this._tongues[i].lenFactor = 0.6 + Math.random() * 0.4;
                this._tongues[i].radius = 8 + Math.random() * 4;
            }
            this._drawFlame(); // Redraw only when tongue geometry changes
            this.particleTimer = 0;
        }

        // Damage tick — reuse Set instead of allocating new WeakSet per tick
        if (time - this.lastDamageTick > this.tickRate * 1000) {
            this._canDamage = true;
            if (!this._hitThisTick) this._hitThisTick = new Set();
            this._hitThisTick.clear();
            this.lastDamageTick = time;
        } else {
            this._canDamage = false;
        }
    }
    
    /**
     * Draw the flame cone
     * @private
     */
    _drawFlame() {
        if (!this.graphics) return;

        this.graphics.clear();

        // Draw at rotation=0 — actual rotation is applied via graphics.rotation transform
        const flameLength = this.baseLength;
        const startAngle = -this.coneAngle;
        const endAngle = this.coneAngle;

        // Main flame cone
        this.graphics.fillStyle(this.color, 0.4);
        this.graphics.beginPath();
        this.graphics.moveTo(0, 0);
        this.graphics.arc(0, 0, flameLength, startAngle, endAngle);
        this.graphics.closePath();
        this.graphics.fillPath();

        // Inner flame (hotter part)
        const innerLength = flameLength * 0.7;
        this.graphics.fillStyle(0xffff00, 0.3);
        this.graphics.beginPath();
        this.graphics.moveTo(0, 0);
        this.graphics.arc(0, 0, innerLength, startAngle, endAngle);
        this.graphics.closePath();
        this.graphics.fillPath();

        // Flame tongues (stable per-tick geometry)
        if (this._tongues) {
            this.graphics.fillStyle(this.color, 0.2);
            for (let i = 0; i < this._tongues.length; i++) {
                const t = this._tongues[i];
                const tLen = flameLength * t.lenFactor;
                this.graphics.fillCircle(Math.cos(t.offset) * tLen * 0.7, Math.sin(t.offset) * tLen * 0.7, t.radius);
            }
        }
    }
    
    /**
     * Flame particle emission removed — graphics-based flame cone is sufficient.
     * Keeping method as no-op so callers don't break.
     * @private
     */
    _emitFlameParticle() {
        // No-op: spark particles removed (Bug fix — nonsensical spark effects)
    }
    
    /**
     * Create Phaser physics zone for broadphase overlap
     * @private
     */
    _createPhysicsZone() {
        const enemiesGroup = this.scene.enemiesGroup || this.scene.enemies;
        if (!enemiesGroup || !this.scene.physics || !this.entity) return;

        const d = this.baseLength * 2;
        this._damageZone = this.scene.add.zone(this.entity.x, this.entity.y, d, d);
        this.scene.physics.add.existing(this._damageZone, false);
        this._damageZone.body.setCircle(this.baseLength);
        this._damageZone.body.setOffset(-this.baseLength + d/2, -this.baseLength + d/2);

        this._overlapCollider = registerDynamicOverlap(
            this.scene, this._damageZone, enemiesGroup,
            (zone, enemy) => this._onEnemyOverlap(enemy)
        );
    }

    /**
     * Phaser overlap callback — only cone narrowphase (cheap atan2 on few enemies)
     * @private
     */
    _onEnemyOverlap(enemy) {
        if (!this.entity) return; // Guard: entity may be nulled mid-frame by detach()
        if (!this._canDamage) return;
        if (!enemy?.active || enemy.hp <= 0) return;
        if (this._hitThisTick.has(enemy)) return;
        if (typeof enemy.takeDamage !== 'function') return;

        // Cone narrowphase
        const dx = enemy.x - this.entity.x;
        const dy = enemy.y - this.entity.y;
        const angleToTarget = Math.atan2(dy, dx);
        const entityRotation = this.entity.rotation || 0;

        let angleDiff = angleToTarget - entityRotation;
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) <= this.coneAngle) {
            this._hitThisTick.add(enemy);
            if (Math.random() < 0.1) getSession()?.log('combat', 'flamethrower_hit', { enemyId: enemy.blueprintId, damage: this.damage });
            enemy.takeDamage({ amount: this.damage, source: 'flamethrower' });
        }
    }
    
    /**
     * Reset the effect with new configuration
     * @param {object} config
     */
    reset(config = {}) {
        this.config = config;
        this.animationTime = 0;
        this.particleTimer = 0;
        
        // Update parameters from new config
        const CR = this.scene.configResolver || window.ConfigResolver;
        this.baseLength = config.length || CR?.get('vfx.flamethrower.length', { defaultValue: 80 }) || 80;
        this.coneAngle = config.angle || CR?.get('vfx.flamethrower.angle', { defaultValue: 0.5 }) || 0.5;
        this.color = config.color || CR?.get('vfx.flamethrower.color', { defaultValue: 0xff6600 }) || 0xff6600;
    }
    
    /**
     * Destroy the effect
     */
    destroy() {
        this.detach();
    }
    
    // ==========================================
    // PR7 Factory Methods - Replace Direct Calls
    // ==========================================
    
    /**
     * Factory method for creating graphics objects
     * PR7 compliant - uses centralized graphics creation
     * @returns {Phaser.GameObjects.Graphics}
     * @private
     */
    _createGraphics() {
        return createGraphicsForEffect(this.scene, 'FlamethrowerEffect');
    }
}