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
        
        // Damage zone (for collision detection)
        this.damageZone = null;
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
        }
        
        // Create damage zone for collision detection
        this._createDamageZone();
        
        // Play looping flamethrower sound - PR7: používáme newSFXSystem
        if (this.scene.newSFXSystem) {
            this.loopId = this.scene.newSFXSystem.playLoop('flamethrower');
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
        
        // Clean up damage zone (it's just a plain object, not a Phaser GameObject)
        if (this.damageZone) {
            this.damageZone = null;
        }
        
        // Stop looping flame sound - PR7: používáme newSFXSystem
        if (this.loopId && this.scene.newSFXSystem) {
            this.scene.newSFXSystem.stopLoop(this.loopId);
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
        
        // Follow entity position
        this.graphics.x = this.entity.x;
        this.graphics.y = this.entity.y;
        
        // Draw flame cone
        this._drawFlame();
        
        // Update damage zone position
        this._updateDamageZone();
        
        // Emit flame particles
        if (this.particleTimer >= this.particleInterval) {
            this._emitFlameParticle();
            this.particleTimer = 0;
        }
        
        // Apply damage to enemies in cone
        this._applyFlameDamage();
    }
    
    /**
     * Draw the flame cone
     * @private
     */
    _drawFlame() {
        if (!this.graphics) return;
        
        this.graphics.clear();
        
        // Calculate flame length with flicker animation
        const flameLength = this.baseLength + 20 * Math.sin(this.animationTime * this.flickerSpeed);
        
        // Get entity rotation (direction facing)
        const rotation = this.entity.rotation || 0;
        
        // Draw main flame cone
        this.graphics.fillStyle(this.color, 0.4);
        this.graphics.beginPath();
        this.graphics.moveTo(0, 0);
        
        // Create cone arc
        const startAngle = rotation - this.coneAngle;
        const endAngle = rotation + this.coneAngle;
        
        this.graphics.arc(0, 0, flameLength, startAngle, endAngle);
        this.graphics.closePath();
        this.graphics.fillPath();
        
        // Draw inner flame (hotter part)
        const innerLength = flameLength * 0.7;
        this.graphics.fillStyle(0xffff00, 0.3);
        this.graphics.beginPath();
        this.graphics.moveTo(0, 0);
        this.graphics.arc(0, 0, innerLength, startAngle, endAngle);
        this.graphics.closePath();
        this.graphics.fillPath();
        
        // Draw flame tongues
        for (let i = 0; i < 3; i++) {
            const tongueAngle = rotation + (Math.random() - 0.5) * this.coneAngle * 2;
            const tongueLength = flameLength * (0.6 + Math.random() * 0.4);
            const tongueX = Math.cos(tongueAngle) * tongueLength;
            const tongueY = Math.sin(tongueAngle) * tongueLength;
            
            this.graphics.fillStyle(this.color, 0.2);
            this.graphics.fillCircle(tongueX * 0.7, tongueY * 0.7, 8 + Math.random() * 4);
        }
    }
    
    /**
     * Emit flame particle
     * @private
     */
    _emitFlameParticle() {
        if (!this.scene.newVFXSystem || !this.entity) return;
        
        const rotation = this.entity.rotation || 0;
        const particleAngle = rotation + (Math.random() - 0.5) * this.coneAngle * 2;
        const particleDistance = this.baseLength * (0.5 + Math.random() * 0.5);
        
        const particleX = this.entity.x + Math.cos(particleAngle) * particleDistance;
        const particleY = this.entity.y + Math.sin(particleAngle) * particleDistance;
        
        this.scene.newVFXSystem.play('vfx.flame.particle', particleX, particleY);
    }
    
    /**
     * Create damage zone for collision detection
     * @private
     */
    _createDamageZone() {
        // This is a placeholder - actual implementation would create
        // a physics body for overlap detection
        this.damageZone = {
            x: 0,
            y: 0,
            radius: this.baseLength,
            angle: 0
        };
    }
    
    /**
     * Update damage zone position
     * @private
     */
    _updateDamageZone() {
        if (!this.damageZone || !this.entity) return;
        
        this.damageZone.x = this.entity.x;
        this.damageZone.y = this.entity.y;
        this.damageZone.angle = this.entity.rotation || 0;
    }
    
    /**
     * Apply flame damage to enemies in cone
     * @private
     */
    _applyFlameDamage() {
        if (!this.entity || !this.scene.enemiesGroup) return;
        
        const damage = this.entity.flamethrowerDamage || 2;
        const enemies = this.scene.enemiesGroup.getChildren();
        
        for (const enemy of enemies) {
            if (!enemy.active) continue;
            
            // Check if enemy is in flame cone
            if (this._isInFlameCone(enemy)) {
                // Apply damage through proper system
                if (enemy.takeDamage) {
                    enemy.takeDamage(damage, { type: 'flame', source: this.entity });
                }
                
                // Apply burn VFX
                if (this.scene.newVFXSystem) {
                    this.scene.newVFXSystem.play('vfx.burn.small', enemy.x, enemy.y);
                }
            }
        }
    }
    
    /**
     * Check if a target is in the flame cone
     * @private
     */
    _isInFlameCone(target) {
        if (!this.entity || !target) return false;
        
        // Calculate distance
        const dx = target.x - this.entity.x;
        const dy = target.y - this.entity.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if within range
        if (distance > this.baseLength) return false;
        
        // Calculate angle to target
        const angleToTarget = Math.atan2(dy, dx);
        const entityRotation = this.entity.rotation || 0;
        
        // Normalize angle difference
        let angleDiff = angleToTarget - entityRotation;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Check if within cone angle
        return Math.abs(angleDiff) <= this.coneAngle;
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
        // PR7: Check if scene has a graphics factory
        if (this.scene.graphicsFactory) {
            return this.scene.graphicsFactory.create();
        }
        
        // PR7: Check if VFXSystem provides graphics creation
        if (this.scene.newVFXSystem && this.scene.newVFXSystem._createGraphics) {
            return this.scene.newVFXSystem._createGraphics();
        }
        
        // PR7: Fallback with warning
        if (this.scene && this.scene.add && this.scene.add.graphics) {
            if (Math.random() < 0.01) { // Only log occasionally
                console.warn('[FlamethrowerEffect] Using scene.add.graphics fallback - needs PR7 GraphicsFactory');
            }
            return this.scene.add.graphics();
        }
        
        console.error('[FlamethrowerEffect] Cannot create graphics - no factory available');
        return null;
    }
}