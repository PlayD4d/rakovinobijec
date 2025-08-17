/**
 * VFXPlaceholders - Placeholder VFX registrations
 * PR7 Compliant - Provides minimal visual effects for missing VFX IDs
 */

export class VFXPlaceholders {
    /**
     * Register placeholder VFX in the VFX system
     * @param {Object} vfxSystem - The VFX system to register with
     */
    static register(vfxSystem) {
        console.log('[VFXPlaceholders] Registering placeholder effects...');
        
        // Basic placeholder effects with minimal visuals
        const placeholders = {
            'vfx.placeholder.spark': {
                type: 'particles',
                preset: 'minimal_spark',
                lifespan: 100,
                quantity: 1
            },
            'vfx.placeholder.aura': {
                type: 'particles', 
                preset: 'minimal_aura',
                lifespan: 200,
                quantity: 2
            },
            'vfx.placeholder.burst': {
                type: 'particles',
                preset: 'minimal_burst',
                lifespan: 150,
                quantity: 3
            },
            'vfx.placeholder.trail': {
                type: 'particles',
                preset: 'minimal_trail',
                lifespan: 100,
                quantity: 1
            },
            'vfx.placeholder.none': {
                type: 'empty',
                preset: 'empty'
            },
            'vfx.placeholder.hit': {
                type: 'particles',
                preset: 'minimal_spark',
                lifespan: 50,
                quantity: 1
            },
            'vfx.placeholder.death': {
                type: 'particles',
                preset: 'minimal_burst',
                lifespan: 200,
                quantity: 5
            },
            'vfx.placeholder.spawn': {
                type: 'particles',
                preset: 'minimal_aura',
                lifespan: 300,
                quantity: 3
            },
            'vfx.placeholder.pickup': {
                type: 'particles',
                preset: 'minimal_spark',
                lifespan: 100,
                quantity: 2
            },
            'vfx.placeholder.explosion': {
                type: 'particles',
                preset: 'minimal_burst',
                lifespan: 250,
                quantity: 8
            }
        };
        
        // Register all placeholders
        Object.entries(placeholders).forEach(([id, config]) => {
            if (vfxSystem.register) {
                vfxSystem.register(id, config);
            } else if (vfxSystem.addEffect) {
                // Fallback for different VFX system APIs
                vfxSystem.addEffect(id, config);
            }
        });
        
        console.log(`[VFXPlaceholders] Registered ${Object.keys(placeholders).length} placeholder effects`);
    }
    
    /**
     * Check if an ID is a placeholder
     * @param {string} id - The VFX ID to check
     * @returns {boolean} True if it's a placeholder
     */
    static isPlaceholder(id) {
        return id && id.startsWith('vfx.placeholder.');
    }
    
    /**
     * Get a minimal particle config for placeholders
     * @param {string} preset - The preset name
     * @returns {Object} Particle configuration
     */
    static getMinimalPreset(preset) {
        const presets = {
            'minimal_spark': {
                scale: { start: 0.2, end: 0 },
                speed: { min: 20, max: 40 },
                lifespan: 100,
                alpha: { start: 0.5, end: 0 },
                tint: 0xffffff
            },
            'minimal_aura': {
                scale: { start: 0.3, end: 0.1 },
                speed: { min: 10, max: 20 },
                lifespan: 200,
                alpha: { start: 0.3, end: 0 },
                tint: 0x88ccff
            },
            'minimal_burst': {
                scale: { start: 0.25, end: 0 },
                speed: { min: 50, max: 100 },
                lifespan: 150,
                alpha: { start: 0.6, end: 0 },
                tint: 0xffcc00
            },
            'minimal_trail': {
                scale: { start: 0.15, end: 0 },
                speed: { min: 5, max: 10 },
                lifespan: 100,
                alpha: { start: 0.4, end: 0 },
                tint: 0xcccccc
            },
            'empty': {
                scale: 0,
                speed: 0,
                lifespan: 0,
                quantity: 0
            }
        };
        
        return presets[preset] || presets['empty'];
    }
}

export default VFXPlaceholders;