import { DebugLogger } from '../../debug/DebugLogger.js';
import { createGraphicsForEffect } from './createGraphicsHelper.js';

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
        // Shield does NOT rotate — static bubble (avoids visual merge with radiotherapy)
        this._hitFlashUntil = 0; // timestamp until hit flash is visible
    }
    
    /**
     * Update effect configuration (called when power-up levels up)
     * @param {Object} config - New configuration
     */
    updateConfig(config) {
        DebugLogger.info('vfx', '[ShieldEffect] Updating config:', config);
        
        // Update visual parameters
        if (config.radius !== undefined) this.radius = config.radius;
        if (config.color !== undefined) this.color = config.color;
        if (config.lineWidth !== undefined) this.lineWidth = config.lineWidth;
        if (config.pulseSpeed !== undefined) this.pulseSpeed = config.pulseSpeed;
        
        // Redraw shield with new parameters
        if (this.active) {
            this._drawShield();
        }
        
        DebugLogger.info('vfx', `[ShieldEffect] Config updated - Radius: ${this.radius}, Color: 0x${this.color.toString(16)}`);
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
            this.graphics.setDepth(entity.depth - 1);
        }
        
        // Initial draw
        this._drawShield();
        
        // Play activation VFX through VFXSystem
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('vfx.shield.activate', entity.x, entity.y);
        }
        
        // Play activation SFX from player blueprint
        if (this.scene.audioSystem) {
            const player = this.scene.player;
            const activateSFX = player?.blueprint?.sfx?.shield?.activate;
            if (activateSFX) {
                this.scene.audioSystem.play(activateSFX);
            } else {
                DebugLogger.warn('vfx', '[ShieldEffect] Missing shield.activate sound in player blueprint');
            }
        }
    }
    
    /**
     * Detach effect from entity
     */
    detach() {
        if (!this.active) return;

        // Play deactivation VFX before clearing entity reference
        if (this.entity && this.scene.vfxSystem) {
            this.scene.vfxSystem.play('vfx.shield.break', this.entity.x, this.entity.y);
        }

        this.active = false;
        this.entity = null;
        this._shieldDrawn = false;
        this._hitFlashUntil = 0;
        
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

        // Follow entity position (no rotation — static bubble)
        this.graphics.x = this.entity.x;
        this.graphics.y = this.entity.y;

        // Hit flash reaction — bright white flash for 120ms after hit
        if (time < this._hitFlashUntil) {
            this.graphics.alpha = 0.9;
            // Redraw with white tint during flash
            if (!this._flashDrawn) {
                this._drawShield(0xffffff);
                this._flashDrawn = true;
            }
        } else {
            // Normal subtle pulse
            const pulse = 0.4 + 0.2 * Math.sin(time * this.pulseSpeed);
            this.graphics.alpha = pulse;
            if (this._flashDrawn) {
                this._drawShield(); // Restore normal color
                this._flashDrawn = false;
            }
        }

        // Draw shield once on first frame
        if (!this._shieldDrawn) {
            this._drawShield();
            this._shieldDrawn = true;
        }
    }

    /**
     * Trigger hit flash — called when shield absorbs damage
     */
    flash() {
        this._hitFlashUntil = (this.animationTime || 0) + 120;
        this._flashDrawn = false;
    }
    
    /**
     * Draw the shield
     * @private
     */
    _drawShield(colorOverride) {
        if (!this.graphics) return;

        const color = colorOverride ?? this.color;
        this.graphics.clear();

        // Main shield circle
        this.graphics.lineStyle(this.lineWidth, color, 0.8);
        this.graphics.strokeCircle(0, 0, this.radius);

        // Inner glow ring
        this.graphics.lineStyle(1, color, 0.3);
        this.graphics.strokeCircle(0, 0, this.radius * 0.85);

        // Hexagonal pattern for sci-fi look
        const hexRadius = this.radius * 0.9;
        const hexSides = 6;

        this.graphics.lineStyle(1, color, 0.4);
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
    }
    
    /**
     * Reset the effect with new configuration
     * @param {object} config
     */
    reset(config = {}) {
        this.config = config;
        this.animationTime = 0;
        this._shieldDrawn = false;
        
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
        return createGraphicsForEffect(this.scene, 'ShieldEffect');
    }
}