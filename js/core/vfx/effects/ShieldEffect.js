/**
 * ShieldEffect - PR7 compliant shield visual effect
 * Creates an animated shield bubble around an entity
 */

export class ShieldEffect {
    constructor(scene, type, config = {}) {
        this.scene = scene;
        this.type = type;
        this.config = config;
        
        // PR7: Get configuration from ConfigResolver
        const CR = scene.configResolver || window.ConfigResolver;
        this.radius = config.radius || CR?.get('vfx.shield.radius', { defaultValue: 30 }) || 30;
        this.color = config.color || CR?.get('vfx.shield.color', { defaultValue: 0x00ffff }) || 0x00ffff;
        this.lineWidth = config.lineWidth || CR?.get('vfx.shield.lineWidth', { defaultValue: 2 }) || 2;
        
        // Visual components
        this.graphics = null;
        this.entity = null;
        this.active = false;
        
        // Animation parameters
        this.animationTime = 0;
        this.pulseSpeed = config.pulseSpeed || 0.005;
        this.rotationSpeed = config.rotationSpeed || 0.002;
    }
    
    /**
     * Attach effect to an entity
     * @param {Phaser.GameObjects.Sprite} entity
     */
    attach(entity) {
        if (this.active) this.detach();
        
        this.entity = entity;
        this.active = true;
        
        // Create graphics object
        this.graphics = this.scene.add.graphics();
        this.graphics.setDepth(entity.depth - 1);
        
        // Initial draw
        this._drawShield();
        
        // Play activation VFX through VFXSystem
        if (this.scene.newVFXSystem) {
            this.scene.newVFXSystem.play('vfx.shield.activate', entity.x, entity.y);
        }
        
        // Play activation SFX through SFXSystem
        if (this.scene.newSFXSystem) {
            this.scene.newSFXSystem.play('sfx.shield.activate');
        }
    }
    
    /**
     * Detach effect from entity
     */
    detach() {
        if (!this.active) return;
        
        this.active = false;
        this.entity = null;
        
        // Play deactivation VFX if entity still exists
        if (this.entity && this.scene.newVFXSystem) {
            this.scene.newVFXSystem.play('vfx.shield.break', this.entity.x, this.entity.y);
        }
        
        // Clean up graphics
        if (this.graphics) {
            this.graphics.destroy();
            this.graphics = null;
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
        
        // Follow entity position
        this.graphics.x = this.entity.x;
        this.graphics.y = this.entity.y;
        
        // Animate rotation
        this.graphics.rotation = time * this.rotationSpeed;
        
        // Animate pulse
        const pulse = 0.5 + 0.3 * Math.sin(time * this.pulseSpeed);
        this.graphics.alpha = pulse;
        
        // Redraw shield with animation
        this._drawShield();
    }
    
    /**
     * Draw the shield
     * @private
     */
    _drawShield() {
        if (!this.graphics) return;
        
        this.graphics.clear();
        
        // Main shield circle
        this.graphics.lineStyle(this.lineWidth, this.color, 0.8);
        this.graphics.strokeCircle(0, 0, this.radius);
        
        // Add hexagonal pattern for more sci-fi look
        const hexRadius = this.radius * 0.9;
        const hexSides = 6;
        
        this.graphics.lineStyle(1, this.color, 0.4);
        this.graphics.beginPath();
        
        for (let i = 0; i <= hexSides; i++) {
            const angle = (Math.PI * 2 / hexSides) * i - Math.PI / 2;
            const x = Math.cos(angle) * hexRadius;
            const y = Math.sin(angle) * hexRadius;
            
            if (i === 0) {
                this.graphics.moveTo(x, y);
            } else {
                this.graphics.lineTo(x, y);
            }
        }
        
        this.graphics.strokePath();
        
        // Add energy particles effect
        if (Math.random() < 0.1) {
            const particleAngle = Math.random() * Math.PI * 2;
            const particleRadius = this.radius * (0.9 + Math.random() * 0.2);
            const particleX = Math.cos(particleAngle) * particleRadius;
            const particleY = Math.sin(particleAngle) * particleRadius;
            
            this.graphics.fillStyle(this.color, 0.6);
            this.graphics.fillCircle(particleX, particleY, 2);
        }
    }
    
    /**
     * Reset the effect with new configuration
     * @param {object} config
     */
    reset(config = {}) {
        this.config = config;
        this.animationTime = 0;
        
        // Update parameters from new config
        const CR = this.scene.configResolver || window.ConfigResolver;
        this.radius = config.radius || CR?.get('vfx.shield.radius', { defaultValue: 30 }) || 30;
        this.color = config.color || CR?.get('vfx.shield.color', { defaultValue: 0x00ffff }) || 0x00ffff;
        this.lineWidth = config.lineWidth || CR?.get('vfx.shield.lineWidth', { defaultValue: 2 }) || 2;
    }
    
    /**
     * Destroy the effect
     */
    destroy() {
        this.detach();
    }
}