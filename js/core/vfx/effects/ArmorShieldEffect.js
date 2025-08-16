/**
 * ArmorShieldEffect - PR7 compliant armor shield visual effect
 * Creates an animated protective shield around armored enemies
 * Similar to player's immunity shield but for enemy armor
 */

export class ArmorShieldEffect {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.config = config;
        
        // PR7: Get configuration from ConfigResolver
        const CR = scene.configResolver || window.ConfigResolver;
        
        // Visual parameters from config or defaults
        this.baseRadius = config.radius || CR?.get('vfx.armorShield.radius', { defaultValue: 1.2 }) || 1.2; // Multiplier of enemy size
        this.baseColor = config.color || CR?.get('vfx.armorShield.color', { defaultValue: 0x808080 }) || 0x808080; // Gray/metallic
        this.lineWidth = config.lineWidth || CR?.get('vfx.armorShield.lineWidth', { defaultValue: 2 }) || 2;
        this.baseAlpha = config.alpha || CR?.get('vfx.armorShield.alpha', { defaultValue: 0.6 }) || 0.6;
        
        // Active shields
        this.activeShields = new Map();
        
        // Animation parameters
        this.pulseSpeed = config.pulseSpeed || 0.003;
        this.hitFlashDuration = 200; // ms
    }
    
    /**
     * Create armor shield for an enemy
     * @param {Enemy} enemy - The enemy entity
     */
    createArmorShield(enemy) {
        if (!enemy || !enemy.armor || enemy.armor <= 0) return;
        
        // Remove existing shield if any
        this.removeArmorShield(enemy);
        
        // Calculate shield strength based on armor value
        const armorRatio = Math.min(enemy.armor / 10, 1); // Max 10 armor
        
        // Create graphics through factory
        const graphics = this._createGraphics();
        if (!graphics) return;
        
        // Store shield data
        const shieldData = {
            graphics: graphics,
            enemy: enemy,
            radius: (enemy.size || 20) * this.baseRadius,
            maxArmor: enemy.armor,
            currentArmor: enemy.armor,
            alpha: this.baseAlpha * (0.4 + armorRatio * 0.6), // 0.4-1.0 based on armor
            color: this._getArmorColor(enemy.armor),
            animationTime: 0,
            hitFlashTime: 0,
            lastHp: enemy.hp
        };
        
        this.activeShields.set(enemy, shieldData);
        
        // Set initial depth
        graphics.setDepth(enemy.depth - 1);
        
        // Initial draw
        this._drawShield(shieldData);
    }
    
    /**
     * Remove armor shield from an enemy
     * @param {Enemy} enemy
     */
    removeArmorShield(enemy) {
        const shieldData = this.activeShields.get(enemy);
        if (!shieldData) return;
        
        // Break effect
        this._playBreakEffect(enemy.x, enemy.y);
        
        // Clean up graphics
        if (shieldData.graphics) {
            if (this.scene.graphicsFactory) {
                this.scene.graphicsFactory.release(shieldData.graphics);
            } else {
                shieldData.graphics.destroy();
            }
        }
        
        this.activeShields.delete(enemy);
    }
    
    /**
     * Update all active armor shields
     * @param {number} time - Game time
     * @param {number} delta - Delta time
     */
    update(time, delta) {
        this.activeShields.forEach((shieldData, enemy) => {
            if (!enemy.active) {
                this.removeArmorShield(enemy);
                return;
            }
            
            // Update animation time
            shieldData.animationTime += delta;
            
            // Check if enemy took damage
            if (enemy.hp < shieldData.lastHp) {
                this._onHit(shieldData);
                shieldData.lastHp = enemy.hp;
            }
            
            // Update armor value if it changed
            if (enemy.armor !== shieldData.currentArmor) {
                shieldData.currentArmor = enemy.armor;
                
                // Remove shield if armor is depleted
                if (enemy.armor <= 0) {
                    this.removeArmorShield(enemy);
                    return;
                }
                
                // Update shield strength
                const armorRatio = Math.min(enemy.armor / shieldData.maxArmor, 1);
                shieldData.alpha = this.baseAlpha * (0.2 + armorRatio * 0.8); // Fade as armor decreases
            }
            
            // Update hit flash
            if (shieldData.hitFlashTime > 0) {
                shieldData.hitFlashTime -= delta;
            }
            
            // Update position to follow enemy
            shieldData.graphics.x = enemy.x;
            shieldData.graphics.y = enemy.y;
            
            // Redraw shield with animations
            this._drawShield(shieldData);
        });
    }
    
    /**
     * Draw the shield
     * @private
     */
    _drawShield(shieldData) {
        const graphics = shieldData.graphics;
        graphics.clear();
        
        // Calculate animated values
        const time = shieldData.animationTime * this.pulseSpeed;
        const pulseFactor = 1 + Math.sin(time) * 0.05; // Subtle pulse
        const radius = shieldData.radius * pulseFactor;
        
        // Flash effect when hit
        let color = shieldData.color;
        let alpha = shieldData.alpha;
        if (shieldData.hitFlashTime > 0) {
            const flashIntensity = shieldData.hitFlashTime / this.hitFlashDuration;
            color = this._lerpColor(color, 0xffffff, flashIntensity * 0.5);
            alpha = Math.min(1, alpha + flashIntensity * 0.3);
        }
        
        // Main shield circle
        graphics.lineStyle(this.lineWidth, color, alpha);
        graphics.strokeCircle(0, 0, radius);
        
        // Inner glow
        graphics.lineStyle(1, color, alpha * 0.5);
        graphics.strokeCircle(0, 0, radius - 3);
        
        // Hexagonal pattern for tech look (optional)
        if (shieldData.currentArmor >= 3) {
            this._drawHexPattern(graphics, radius, color, alpha * 0.3, time);
        }
        
        // Outer glow when strong
        if (shieldData.currentArmor >= 5) {
            graphics.lineStyle(1, color, alpha * 0.2);
            graphics.strokeCircle(0, 0, radius + 3);
        }
    }
    
    /**
     * Draw hexagonal pattern
     * @private
     */
    _drawHexPattern(graphics, radius, color, alpha, time) {
        const sides = 6;
        const rotation = time * 0.5;
        
        graphics.lineStyle(1, color, alpha);
        graphics.beginPath();
        
        for (let i = 0; i <= sides; i++) {
            const angle = (i / sides) * Math.PI * 2 + rotation;
            const x = Math.cos(angle) * radius * 0.9;
            const y = Math.sin(angle) * radius * 0.9;
            
            if (i === 0) {
                graphics.moveTo(x, y);
            } else {
                graphics.lineTo(x, y);
            }
        }
        
        graphics.closePath();
        graphics.strokePath();
    }
    
    /**
     * Handle hit effect
     * @private
     */
    _onHit(shieldData) {
        shieldData.hitFlashTime = this.hitFlashDuration;
        
        // Play hit VFX at impact point
        if (this.scene.newVFXSystem) {
            // Create ripple effect at shield edge
            const angle = Math.random() * Math.PI * 2;
            const x = shieldData.enemy.x + Math.cos(angle) * shieldData.radius;
            const y = shieldData.enemy.y + Math.sin(angle) * shieldData.radius;
            this.scene.newVFXSystem.play('vfx.shield.hit', x, y);
        }
        
        // Play hit SFX from player blueprint
        if (this.scene.newSFXSystem) {
            const player = this.scene.player;
            const hitSFX = player?.blueprint?.sfx?.shield?.block;
            if (hitSFX) {
                this.scene.newSFXSystem.play(hitSFX);
            } else {
                console.warn('[ArmorShieldEffect] Missing shield.block sound in player blueprint');
            }
        }
    }
    
    /**
     * Play break effect when shield is destroyed
     * @private
     */
    _playBreakEffect(x, y) {
        if (this.scene.newVFXSystem) {
            this.scene.newVFXSystem.play('vfx.shield.break', x, y);
        }
        
        if (this.scene.newSFXSystem) {
            const player = this.scene.player;
            const breakSFX = player?.blueprint?.sfx?.shield?.break;
            if (breakSFX) {
                this.scene.newSFXSystem.play(breakSFX);
            } else {
                console.warn('[ArmorShieldEffect] Missing shield.break sound in player blueprint');
            }
        }
    }
    
    /**
     * Get color based on armor strength
     * @private
     */
    _getArmorColor(armor) {
        if (armor >= 5) return 0xc0c0c0; // Silver for high armor
        if (armor >= 3) return 0x909090; // Medium gray
        if (armor >= 1) return 0x707070; // Dark gray
        return 0x505050; // Very dark gray
    }
    
    /**
     * Lerp between two colors
     * @private
     */
    _lerpColor(color1, color2, t) {
        const r1 = (color1 >> 16) & 0xFF;
        const g1 = (color1 >> 8) & 0xFF;
        const b1 = color1 & 0xFF;
        
        const r2 = (color2 >> 16) & 0xFF;
        const g2 = (color2 >> 8) & 0xFF;
        const b2 = color2 & 0xFF;
        
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        
        return (r << 16) | (g << 8) | b;
    }
    
    /**
     * Create graphics object through factory
     * @private
     */
    _createGraphics() {
        if (this.scene.graphicsFactory) {
            return this.scene.graphicsFactory.create();
        } else {
            // Fallback for compatibility
            console.warn('[ArmorShieldEffect] GraphicsFactory not available, using direct creation');
            return this.scene.add.graphics();
        }
    }
    
    /**
     * Clean up all shields
     */
    destroy() {
        this.activeShields.forEach((shieldData, enemy) => {
            this.removeArmorShield(enemy);
        });
        this.activeShields.clear();
    }
}

export default ArmorShieldEffect;