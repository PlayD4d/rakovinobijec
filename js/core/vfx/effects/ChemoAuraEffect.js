/**
 * ChemoAuraEffect - PR7 compliant chemical aura visual effect
 * Creates a pulsing toxic aura around the entity
 */

export class ChemoAuraEffect {
    constructor(scene, type, config = {}) {
        this.scene = scene;
        this.type = type;
        this.config = config;
        
        // PR7: Get configuration from ConfigResolver
        const CR = scene.configResolver || window.ConfigResolver;
        this.radius = config.radius || CR?.get('vfx.chemoAura.radius', { defaultValue: 60 }) || 60;
        this.color = config.color || CR?.get('vfx.chemoAura.color', { defaultValue: 0x00ff00 }) || 0x00ff00;
        this.damageRadius = config.damageRadius || CR?.get('vfx.chemoAura.damageRadius', { defaultValue: 70 }) || 70;
        
        // Visual components
        this.graphics = null;
        this.entity = null;
        this.active = false;
        
        // Animation parameters
        this.animationTime = 0;
        this.pulseSpeed = 0.003;
        this.rotationSpeed = -0.001;
        this.particleTimer = 0;
        this.particleInterval = 100; // ms between toxic particles
        
        // Damage parameters
        this.damageTimer = 0;
        this.damageInterval = 500; // ms between damage ticks
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
            this.graphics.setDepth(entity.depth - 2);
        }
        
        // Play activation VFX
        if (this.scene.newVFXSystem) {
            this.scene.newVFXSystem.play('vfx.chemo.activate', entity.x, entity.y);
        }
        
        // Play activation SFX from powerup blueprint
        if (this.scene.newSFXSystem) {
            // Try to get sound from powerup blueprint (chemo_reservoir)
            const powerupBlueprint = this.scene.blueprintLoader?.getBlueprint('powerup.chemo_reservoir');
            const activateSFX = powerupBlueprint?.sfx?.activate;
            if (activateSFX) {
                this.scene.newSFXSystem.play(activateSFX);
            } else {
                console.warn('[ChemoAuraEffect] Missing activate sound in chemo_reservoir powerup blueprint');
            }
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
        
        // Stop ambient sound
        if (this.scene.newSFXSystem) {
            this.scene.newSFXSystem.stopLoop('sfx.chemo.ambient');
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
        this.damageTimer += delta;
        
        // Follow entity position
        this.graphics.x = this.entity.x;
        this.graphics.y = this.entity.y;
        
        // Draw aura
        this._drawAura();
        
        // Emit toxic particles
        if (this.particleTimer >= this.particleInterval) {
            this._emitToxicParticle();
            this.particleTimer = 0;
        }
        
        // Apply damage to nearby enemies
        if (this.damageTimer >= this.damageInterval) {
            this._applyAuraDamage();
            this.damageTimer = 0;
        }
    }
    
    /**
     * Draw the chemical aura
     * @private
     */
    _drawAura() {
        if (!this.graphics) return;
        
        this.graphics.clear();
        
        // Calculate pulsing radius
        const pulseRadius = this.radius + 10 * Math.sin(this.animationTime * this.pulseSpeed);
        
        // Draw outer ring (damage zone)
        this.graphics.lineStyle(1, this.color, 0.2);
        this.graphics.strokeCircle(0, 0, this.damageRadius);
        
        // Draw main aura ring
        this.graphics.lineStyle(3, this.color, 0.3);
        this.graphics.strokeCircle(0, 0, pulseRadius);
        
        // Draw inner ring
        this.graphics.lineStyle(2, this.color, 0.2);
        this.graphics.strokeCircle(0, 0, pulseRadius * 0.8);
        
        // Draw toxic swirls
        const swirls = 3;
        for (let i = 0; i < swirls; i++) {
            const swirlAngle = (Math.PI * 2 / swirls) * i + this.animationTime * this.rotationSpeed;
            const swirlRadius = pulseRadius * 0.9;
            
            this.graphics.lineStyle(1, this.color, 0.15);
            this.graphics.beginPath();
            
            // Draw spiral
            for (let j = 0; j < 20; j++) {
                const t = j / 20;
                const spiralRadius = swirlRadius * t;
                const spiralAngle = swirlAngle + t * Math.PI;
                const x = Math.cos(spiralAngle) * spiralRadius;
                const y = Math.sin(spiralAngle) * spiralRadius;
                
                if (j === 0) {
                    this.graphics.moveTo(x, y);
                } else {
                    this.graphics.lineTo(x, y);
                }
            }
            
            this.graphics.strokePath();
        }
        
        // Add toxic bubble effects
        if (Math.random() < 0.05) {
            const bubbleAngle = Math.random() * Math.PI * 2;
            const bubbleRadius = this.radius * (0.7 + Math.random() * 0.3);
            const bubbleX = Math.cos(bubbleAngle) * bubbleRadius;
            const bubbleY = Math.sin(bubbleAngle) * bubbleRadius;
            
            this.graphics.fillStyle(this.color, 0.3);
            this.graphics.fillCircle(bubbleX, bubbleY, 3 + Math.random() * 2);
        }
    }
    
    /**
     * Emit toxic particle
     * @private
     */
    _emitToxicParticle() {
        if (!this.scene.newVFXSystem || !this.entity) return;
        
        const particleAngle = Math.random() * Math.PI * 2;
        const particleRadius = this.radius * (0.8 + Math.random() * 0.4);
        
        const particleX = this.entity.x + Math.cos(particleAngle) * particleRadius;
        const particleY = this.entity.y + Math.sin(particleAngle) * particleRadius;
        
        this.scene.newVFXSystem.play('vfx.toxic.particle', particleX, particleY);
    }
    
    /**
     * Apply damage to enemies in aura
     * @private
     */
    _applyAuraDamage() {
        if (!this.entity || !this.scene.enemiesGroup) return;
        
        const damage = this.entity.chemoAuraDamage || 1;
        const enemies = this.scene.enemiesGroup.getChildren();
        
        for (const enemy of enemies) {
            if (!enemy.active) continue;
            
            // Check if enemy is in aura range
            const dx = enemy.x - this.entity.x;
            const dy = enemy.y - this.entity.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= this.damageRadius) {
                // Apply damage through proper system
                if (enemy.takeDamage) {
                    enemy.takeDamage(damage, { type: 'toxic', source: this.entity });
                }
                
                // Apply poison VFX
                if (this.scene.newVFXSystem) {
                    this.scene.newVFXSystem.play('vfx.poison.small', enemy.x, enemy.y);
                }
            }
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
        this.damageTimer = 0;
        
        // Update parameters from new config
        const CR = this.scene.configResolver || window.ConfigResolver;
        this.radius = config.radius || CR?.get('vfx.chemoAura.radius', { defaultValue: 60 }) || 60;
        this.color = config.color || CR?.get('vfx.chemoAura.color', { defaultValue: 0x00ff00 }) || 0x00ff00;
        this.damageRadius = config.damageRadius || CR?.get('vfx.chemoAura.damageRadius', { defaultValue: 70 }) || 70;
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
                console.warn('[ChemoAuraEffect] Using scene.add.graphics fallback - needs PR7 GraphicsFactory');
            }
            return this.scene.add.graphics();
        }
        
        console.error('[ChemoAuraEffect] Cannot create graphics - no factory available');
        return null;
    }
}