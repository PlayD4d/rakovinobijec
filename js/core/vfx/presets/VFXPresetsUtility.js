/**
 * VFXPresetsUtility - Utility visual effects
 * PR7 Compliant - Pure functions for general-purpose effects
 * 
 * Contains trails, spawns, telegraphs, flash effects and victory celebrations
 */

/**
 * Trail effect - used for projectiles and movement
 * @param {number} color - Tint color (default: white)
 * @param {number} frequency - How often particles spawn in ms (default: 50)
 */
export function trail(color = 0xFFFFFF, frequency = 50) {
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
 * @param {number} color - Tint color (default: purple)
 * @param {number} quantity - Number of particles (default: 12)
 */
export function spawn(color = 0x8844AA, quantity = 12) {
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
 * Flash effect - screen flash for impacts
 * @param {number} alpha - Alpha value 0-1 (default: 0.8)
 * @param {number} duration - Duration in ms (default: 100)
 */
export function flash(alpha = 0.8, duration = 100) {
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
 * Generic effect - fallback for any effect type
 * @param {number} color - Tint color (default: white)
 */
export function genericEffect(color = 0xFFFFFF) {
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
 * @param {number} color - Tint color (default: gold)
 */
export function specialEffect(color = 0xFFD700) {
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
 * @param {number} color - Tint color (default: red)
 */
export function telegraph(color = 0xFF0000) {
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
 * Victory effect - celebration particles (optimized for performance)
 * @param {number} color - Base tint color (default: gold)
 */
export function victory(color = 0xFFD700) {
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
 * Helper to merge preset with custom config
 * Custom config overrides preset values
 * @param {object} preset - Base preset configuration
 * @param {object} custom - Custom overrides
 */
export function merge(preset, custom = {}) {
    if (!preset || !preset.config) return custom;
    
    return {
        type: custom.type || preset.type,
        config: {
            ...preset.config,
            ...(custom.config || custom)
        }
    };
}