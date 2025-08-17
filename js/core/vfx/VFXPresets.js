/**
 * VFXPresets - Simple utility functions for common visual effects
 * PR7 Compliant - No hardcoded values, everything parameterized
 * 
 * These are helper functions that generate Phaser particle configs
 * based on parameters. Blueprints can either use these presets
 * or define their own custom configurations.
 */

export class VFXPresets {
    /**
     * Small hit effect - used for projectile impacts
     * @param {number} color - Tint color (default: white)
     * @param {number} quantity - Number of particles (default: 8)
     */
    static smallHit(color = 0xFFFFFF, quantity = 8) {
        return {
            type: 'particles',
            config: {
                quantity: quantity,
                speed: { min: 50, max: 150 },
                scale: { start: 0.3, end: 0 },
                lifespan: 200,
                tint: color,
                blendMode: 'ADD'
            }
        };
    }
    
    /**
     * Medium hit effect - used for melee hits
     * @param {number} color - Tint color
     * @param {number} quantity - Number of particles
     */
    static mediumHit(color = 0xFFFFFF, quantity = 12) {
        return {
            type: 'particles',
            config: {
                quantity: quantity,
                speed: { min: 80, max: 200 },
                scale: { start: 0.4, end: 0 },
                lifespan: 300,
                tint: color,
                blendMode: 'ADD'
            }
        };
    }
    
    /**
     * Explosion effect - used for deaths and explosions
     * @param {string} size - 'small', 'medium', 'large'
     * @param {number} color - Tint color
     */
    static explosion(size = 'medium', color = 0xFF6600) {
        const configs = {
            small: {
                quantity: 15,
                speed: { min: 100, max: 250 },
                scale: { start: 0.6, end: 0.1 },
                lifespan: 300
            },
            medium: {
                quantity: 25,
                speed: { min: 150, max: 350 },
                scale: { start: 0.8, end: 0.1 },
                lifespan: 400
            },
            large: {
                quantity: 40,
                speed: { min: 200, max: 450 },
                scale: { start: 1.2, end: 0.2 },
                lifespan: 500
            }
        };
        
        const config = configs[size] || configs.medium;
        
        return {
            type: 'particles',
            config: {
                ...config,
                tint: color,
                blendMode: 'ADD'
            }
        };
    }
    
    /**
     * Trail effect - used for projectiles and movement
     * @param {number} color - Tint color
     * @param {number} frequency - How often particles spawn (ms)
     */
    static trail(color = 0xFFFFFF, frequency = 50) {
        return {
            type: 'particles',
            config: {
                frequency: frequency,
                quantity: 1,
                speed: 20,
                scale: { start: 0.3, end: 0 },
                lifespan: 200,
                alpha: { start: 0.8, end: 0 },
                tint: color,
                follow: true
            }
        };
    }
    
    /**
     * Spawn effect - used when entities appear
     * @param {number} color - Tint color
     * @param {number} quantity - Number of particles
     */
    static spawn(color = 0x8844AA, quantity = 12) {
        return {
            type: 'particles',
            config: {
                quantity: quantity,
                speed: { min: 50, max: 120 },
                scale: { start: 0, end: 0.3, ease: 'Power2' },
                lifespan: 400,
                alpha: { start: 0, end: 1, ease: 'Power2' },
                tint: color
            }
        };
    }
    
    /**
     * Death burst effect - used when entities die
     * @param {string} size - 'small', 'medium', 'large'
     * @param {number} color - Tint color
     */
    static deathBurst(size = 'medium', color = 0xFF2222) {
        const configs = {
            small: {
                quantity: 15,
                speed: { min: 60, max: 140 },
                scale: { start: 0.4, end: 0 },
                lifespan: 500
            },
            medium: {
                quantity: 20,
                speed: { min: 80, max: 180 },
                scale: { start: 0.5, end: 0 },
                lifespan: 600
            },
            large: {
                quantity: 30,
                speed: { min: 100, max: 250 },
                scale: { start: 0.8, end: 0 },
                lifespan: 800
            }
        };
        
        const config = configs[size] || configs.medium;
        
        return {
            type: 'particles',
            config: {
                ...config,
                tint: color,
                gravityY: 50
            }
        };
    }
    
    /**
     * Pickup effect - used when collecting items
     * @param {number} color - Tint color
     */
    static pickup(color = 0x00FF88) {
        return {
            type: 'particles',
            config: {
                quantity: 8,
                speed: { min: 30, max: 80 },
                scale: { start: 0.3, end: 0 },
                lifespan: 300,
                gravityY: -50,
                tint: color
            }
        };
    }
    
    /**
     * Shield hit effect - used when shield blocks damage
     * @param {number} color - Tint color (default: cyan)
     */
    static shieldHit(color = 0x00FFFF) {
        return {
            type: 'particles',
            config: {
                quantity: 15,
                speed: { min: 100, max: 200 },
                scale: { start: 0.8, end: 0 },
                lifespan: 300,
                tint: color,
                blendMode: 'ADD',
                angle: { min: 0, max: 360 }
            }
        };
    }
    
    /**
     * Muzzle flash - used for weapon firing
     * @param {number} color - Tint color
     */
    static muzzleFlash(color = 0xFFFFAA) {
        return {
            type: 'particles',
            config: {
                quantity: 5,
                speed: { min: 20, max: 60 },
                scale: { start: 0.4, end: 0 },
                lifespan: 100,
                tint: color,
                blendMode: 'ADD'
            }
        };
    }
    
    /**
     * Aura effect - continuous effect around entity
     * @param {number} color - Tint color
     * @param {number} frequency - Particle spawn frequency
     */
    static aura(color = 0x8800FF, frequency = 100) {
        return {
            type: 'particles',
            config: {
                frequency: frequency,
                quantity: 2,
                speed: { min: 20, max: 50 },
                scale: { start: 0.3, end: 0 },
                lifespan: 800,
                alpha: { start: 0.6, end: 0 },
                tint: color,
                blendMode: 'ADD',
                gravityY: -20
            }
        };
    }
    
    /**
     * Flash effect - screen flash for impacts
     * @param {number} alpha - Alpha value (0-1)
     * @param {number} duration - Duration in ms
     */
    static flash(alpha = 0.8, duration = 100) {
        return {
            type: 'flash',
            config: {
                alpha: alpha,
                duration: duration,
                color: 0xFFFFFF
            }
        };
    }
    
    /**
     * Large hit effect - for heavy impacts
     */
    static largeHit(color = 0xFFFFFF) {
        return {
            type: 'particles',
            config: {
                quantity: 20,
                speed: { min: 100, max: 300 },
                scale: { start: 0.6, end: 0 },
                lifespan: 400,
                tint: color || 0xFFFFFF,
                blendMode: 'ADD'
            }
        };
    }
    
    /**
     * Generic effect - fallback for any effect type
     */
    static genericEffect(color = 0xFFFFFF) {
        return {
            type: 'particles',
            config: {
                quantity: 10,
                speed: { min: 50, max: 150 },
                scale: { start: 0.4, end: 0 },
                lifespan: 300,
                tint: color || 0xFFFFFF,
                blendMode: 'ADD'
            }
        };
    }
    
    /**
     * Special effect - for unique/rare events
     */
    static specialEffect(color = 0xFFD700) {
        return {
            type: 'particles',
            config: {
                quantity: 30,
                speed: { min: 100, max: 250 },
                scale: { start: 0.8, end: 0 },
                lifespan: 500,
                tint: color || 0xFFD700,
                blendMode: 'ADD',
                gravityY: -50
            }
        };
    }
    
    /**
     * Telegraph effect - warning indicator
     */
    static telegraph(color = 0xFF0000) {
        return {
            type: 'particles',
            config: {
                quantity: 3,
                speed: 0,
                scale: { start: 1.5, end: 0.5 },
                lifespan: 500,
                tint: color || 0xFF0000,
                alpha: { start: 0.8, end: 0.2 },
                blendMode: 'ADD'
            }
        };
    }
    
    /**
     * Shield break effect
     */
    static shieldBreak(color = 0x00FFFF) {
        return {
            type: 'particles',
            config: {
                quantity: 25,
                speed: { min: 150, max: 300 },
                scale: { start: 0.6, end: 0 },
                lifespan: 400,
                tint: color || 0x00FFFF,
                blendMode: 'ADD',
                angle: { min: 0, max: 360 }
            }
        };
    }
    
    /**
     * Shield activate effect
     */
    static shieldActivate(color = 0x00FFFF) {
        return {
            type: 'particles',
            config: {
                quantity: 15,
                speed: { min: 20, max: 60 },
                scale: { start: 0.5, end: 0.8 },
                lifespan: 600,
                tint: color || 0x00FFFF,
                alpha: { start: 0.8, end: 0 },
                blendMode: 'ADD'
            }
        };
    }
    
    /**
     * Power-up effect - standard
     */
    static powerupEffect(color = 0xFFFF00) {
        return {
            type: 'particles',
            config: {
                quantity: 20,
                speed: { min: 50, max: 150 },
                scale: { start: 0.5, end: 0 },
                lifespan: 500,
                tint: color || 0xFFFF00,
                blendMode: 'ADD',
                gravityY: -30
            }
        };
    }
    
    /**
     * Power-up epic effect - for rare power-ups
     */
    static powerupEpic(color = 0xFF00FF) {
        return {
            type: 'particles',
            config: {
                quantity: 40,
                speed: { min: 100, max: 250 },
                scale: { start: 0.8, end: 0 },
                lifespan: 700,
                tint: color || 0xFF00FF,
                blendMode: 'ADD',
                gravityY: -50,
                angle: { min: 0, max: 360 }
            }
        };
    }
    
    /**
     * Boss spawn effect
     */
    static bossSpawn(color = 0xFF0000) {
        return {
            type: 'particles',
            config: {
                quantity: 50,
                speed: { min: 100, max: 300 },
                scale: { start: 1.2, end: 0 },
                lifespan: 800,
                tint: color || 0xFF0000,
                blendMode: 'ADD',
                angle: { min: 0, max: 360 }
            }
        };
    }
    
    /**
     * Boss death effect (optimized for performance)
     */
    static bossDeath(color = 0xFFFF00) {
        return {
            type: 'particles',
            config: {
                quantity: 40,  // Reduced from 80
                speed: { min: 150, max: 400 },
                scale: { start: 1.5, end: 0 },
                lifespan: 800,  // Reduced from 1000ms
                tint: color || 0xFFFF00,
                blendMode: 'ADD',
                angle: { min: 0, max: 360 },
                gravityY: 50
            }
        };
    }
    
    /**
     * Boss phase change effect
     */
    static bossPhase(color = 0xFF00FF) {
        return {
            type: 'particles',
            config: {
                quantity: 35,
                speed: { min: 50, max: 200 },
                scale: { start: 1.0, end: 0 },
                lifespan: 600,
                tint: color || 0xFF00FF,
                blendMode: 'ADD',
                alpha: { start: 1, end: 0 }
            }
        };
    }
    
    /**
     * Boss special attack effect
     */
    static bossSpecial(color = 0xFF8800) {
        return {
            type: 'particles',
            config: {
                quantity: 30,
                speed: { min: 100, max: 250 },
                scale: { start: 0.8, end: 0 },
                lifespan: 500,
                tint: color || 0xFF8800,
                blendMode: 'ADD'
            }
        };
    }
    
    /**
     * Boss beam warning effect - telegraphs incoming beam attack
     */
    static bossBeamWarning(color = 0xFF0000) {
        return {
            type: 'particles',
            config: {
                quantity: 5,
                speed: 0,
                scale: { start: 2.0, end: 0.5 },
                lifespan: 1000,
                tint: color || 0xFF0000,
                alpha: { start: 0.2, end: 0.8 },
                blendMode: 'ADD',
                frequency: 100
            }
        };
    }
    
    /**
     * Boss overload charge effect - charging up for overload attack
     */
    static bossOverloadCharge(color = 0xFF00FF) {
        return {
            type: 'particles',
            config: {
                quantity: 12,  // Reduced from 20
                speed: { min: 50, max: 150 },
                scale: { start: 0.1, end: 0.8 },
                lifespan: 2000,
                tint: color || 0xFF00FF,
                alpha: { start: 0.3, end: 1.0 },
                blendMode: 'ADD',
                gravityY: -100,
                frequency: 80  // Reduced from 50ms
            }
        };
    }
    
    /**
     * Boss overload explosion effect - massive explosion
     */
    static bossOverloadExplosion(color = 0xFFFF00) {
        return {
            type: 'particles',
            config: {
                quantity: 30,  // Reduced from 60
                speed: { min: 200, max: 500 },
                scale: { start: 1.5, end: 0 },
                lifespan: 800,
                tint: color || 0xFFFF00,
                blendMode: 'ADD',
                angle: { min: 0, max: 360 }
            }
        };
    }
    
    /**
     * Boss radiation storm effect - swirling radiation particles
     */
    static bossRadiationStorm(color = 0x00FF00) {
        return {
            type: 'particles',
            config: {
                quantity: 20,  // Reduced from 40
                speed: { min: 100, max: 300 },
                scale: { start: 0.6, end: 0.1 },
                lifespan: 1500,
                tint: color || 0x00FF00,
                alpha: { start: 0.7, end: 0 },
                blendMode: 'ADD',
                frequency: 100,  // Reduced from 50ms
                rotate: { min: 0, max: 360 },
                gravityX: 50,
                gravityY: 50
            }
        };
    }
    
    /**
     * Boss victory effect - smaller celebration for boss defeat
     */
    static bossVictory(color = 0xFFD700) {
        return {
            type: 'particles',
            config: {
                quantity: 30,  // Less than general victory
                speed: { min: 150, max: 350 },
                scale: { start: 0.8, end: 0 },
                lifespan: 1000,
                tint: [0xFFD700, 0xFFFF00],  // Just gold colors
                blendMode: 'ADD',
                angle: { min: 0, max: 360 },
                gravityY: 150,
                frequency: 80  // Less frequent
            }
        };
    }
    
    /**
     * Victory effect - celebration particles (optimized for performance)
     */
    static victory(color = 0xFFD700) {
        return {
            type: 'particles',
            config: {
                quantity: 40,  // Reduced from 100
                speed: { min: 200, max: 400 },
                scale: { start: 1.0, end: 0 },
                lifespan: 1200,  // Reduced from 2000ms
                tint: [0xFFD700, 0xFF69B4, 0x00CED1, 0xFFFF00],
                blendMode: 'ADD',
                angle: { min: 0, max: 360 },
                gravityY: 200,
                frequency: 50  // Reduced from 20ms
            }
        };
    }
    
    /**
     * Enemy shoot effect - small muzzle flash for enemies
     */
    static enemyShoot(color = 0xFF4444) {
        return {
            type: 'particles',
            config: {
                quantity: 3,
                speed: { min: 20, max: 50 },
                scale: { start: 0.3, end: 0 },
                lifespan: 100,
                tint: color || 0xFF4444,
                blendMode: 'ADD'
            }
        };
    }
    
    /**
     * Radiation pulse effect - used by boss abilities
     * Creates expanding rings with radioactive glow
     */
    static radiationPulse(color = 0xCCFF00) {
        return {
            type: 'particles',
            config: {
                quantity: 20,
                speed: { min: 150, max: 300 },
                scale: { start: 0.1, end: 1.2 },
                lifespan: 600,
                tint: color || 0xCCFF00,
                alpha: { start: 0.8, end: 0 },
                blendMode: 'ADD',
                frequency: 100,
                emitZone: {
                    type: 'edge',
                    source: {
                        type: 'circle',
                        radius: 10
                    },
                    quantity: 20
                }
            }
        };
    }
    
    /**
     * Enemy hit effect - standard damage feedback
     */
    static enemyHit(color = 0xFF4444) {
        return {
            type: 'particles', 
            config: {
                quantity: 10,
                speed: { min: 60, max: 160 },
                scale: { start: 0.4, end: 0 },
                lifespan: 250,
                tint: color || 0xFF4444,
                blendMode: 'ADD'
            }
        };
    }
    
    /**
     * Level up effect - player progression celebration
     */
    static levelup(color = 0xFFD700) {
        return {
            type: 'particles',
            config: {
                quantity: 50,
                speed: { min: 100, max: 300 },
                scale: { start: 0.8, end: 0 },
                lifespan: 800,
                tint: color || 0xFFD700,
                blendMode: 'ADD',
                gravityY: -80,
                angle: { min: 0, max: 360 }
            }
        };
    }
    
    /**
     * Heal effect - health restoration visual
     */
    static heal(color = 0x00FF88) {
        return {
            type: 'particles',
            config: {
                quantity: 15,
                speed: { min: 40, max: 100 },
                scale: { start: 0.5, end: 0 },
                lifespan: 500,
                tint: color || 0x00FF88,
                gravityY: -60,
                alpha: { start: 0.8, end: 0 }
            }
        };
    }
    
    /**
     * Helper to merge preset with custom config
     * Custom config overrides preset values
     */
    static merge(preset, custom = {}) {
        if (!preset || !preset.config) return custom;
        
        return {
            type: custom.type || preset.type,
            config: {
                ...preset.config,
                ...(custom.config || custom)
            }
        };
    }
    
    /**
     * Get preset by name with optional color override
     * Useful for blueprint references
     */
    static getPreset(name, color = null) {
        const presets = {
            // Basic hit effects
            'hit.small': () => this.smallHit(color),
            'hit.medium': () => this.mediumHit(color),
            'hit.large': () => this.largeHit(color),
            'small': () => this.smallHit(color), // Alias
            'medium': () => this.mediumHit(color), // Alias
            'enemy.hit': () => this.enemyHit(color),
            
            // Explosion effects
            'explosion.small': () => this.explosion('small', color),
            'explosion.medium': () => this.explosion('medium', color),
            'explosion.large': () => this.explosion('large', color),
            'explosion.toxic': () => this.explosion('medium', 0x00FF00),
            
            // Trail effects
            'trail': () => this.trail(color),
            'trail.small': () => this.trail(color || 0xFFFFFF, 100),
            'trail.toxic': () => this.trail(0x00FF00, 50),
            
            // Death effects
            'death.small': () => this.deathBurst('small', color),
            'death.medium': () => this.deathBurst('medium', color),
            'death.large': () => this.deathBurst('large', color),
            
            // Special effects
            'spawn': () => this.spawn(color),
            'pickup': () => this.pickup(color),
            'powerup': () => this.powerupEffect(color),
            'powerup.epic': () => this.powerupEpic(color),
            'levelup': () => this.levelup(color),
            'heal': () => this.heal(color),
            
            // Shield effects
            'shield.hit': () => this.shieldHit(color),
            'shield.break': () => this.shieldBreak(color),
            'shield.activate': () => this.shieldActivate(color),
            
            // Boss effects
            'boss.spawn': () => this.bossSpawn(color),
            'boss.death': () => this.bossDeath(color),
            'boss.phase': () => this.bossPhase(color),
            'boss.special': () => this.bossSpecial(color),
            'boss.victory': () => this.bossVictory(color),  // Specific boss victory effect
            'boss.radiation.pulse': () => this.radiationPulse(color),
            'boss.beam.warning': () => this.bossBeamWarning(color),
            'boss.overload.charge': () => this.bossOverloadCharge(color),
            'boss.overload.explosion': () => this.bossOverloadExplosion(color),
            'boss.radiation.storm': () => this.bossRadiationStorm(color),
            
            // Generic effects
            'effect': () => this.genericEffect(color),
            'special': () => this.specialEffect(color),
            'telegraph': () => this.telegraph(color),
            'aura': () => this.aura(color),
            'muzzle': () => this.muzzleFlash(color),
            'flash': () => this.flash(),
            'victory': () => this.victory(color),
            'enemy.shoot': () => this.enemyShoot(color),
            
            // Fallback mappings for simple names
            'shoot': () => this.enemyShoot(color),
            'hit': () => this.enemyHit(color)
        };
        
        const presetFn = presets[name];
        if (!presetFn) {
            console.warn(`[VFXPresets] Unknown preset: ${name}`);
            return null;
        }
        
        return presetFn();
    }
}

export default VFXPresets;