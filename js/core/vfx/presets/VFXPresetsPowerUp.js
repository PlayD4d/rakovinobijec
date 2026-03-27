/**
 * VFXPresetsPowerUp - Power-up related visual effects
 * PR7 Compliant - Pure functions for power-up effects
 * 
 * Contains shield, power-up pickups, and enhancement effects
 */

/**
 * Shield hit effect - used when shield blocks damage
 * @param {number} color - Tint color (default: cyan)
 */
export function shieldHit(color = 0x00FFFF) {
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
 * Shield break effect
 * @param {number} color - Tint color (default: cyan)
 */
export function shieldBreak(color = 0x00FFFF) {
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
 * @param {number} color - Tint color (default: cyan)
 */
export function shieldActivate(color = 0x00FFFF) {
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
 * @param {number} color - Tint color (default: yellow)
 */
export function powerupEffect(color = 0xFFFF00) {
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
 * @param {number} color - Tint color (default: purple)
 */
export function powerupEpic(color = 0xFF00FF) {
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
 * Pickup effect - used when collecting items
 * @param {number} color - Tint color (default: green)
 */
export function pickup(color = 0x00FF88) {
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
 * Level up effect - player progression celebration
 * @param {number} color - Tint color (default: gold)
 */
export function levelup(color = 0xFFD700) {
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
 * @param {number} color - Tint color (default: light green)
 */
export function heal(color = 0x00FF88) {
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
 * Aura effect - continuous effect around entity
 * @param {number} color - Tint color (default: purple)
 * @param {number} frequency - Particle spawn frequency (default: 100ms)
 */
export function aura(color = 0x8800FF, frequency = 100) {
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