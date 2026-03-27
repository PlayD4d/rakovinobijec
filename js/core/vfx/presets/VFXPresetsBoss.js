/**
 * VFXPresetsBoss - Boss-specific visual effects
 * PR7 Compliant - Pure functions for boss effects
 * 
 * Contains boss spawn, death, phase changes and special attack effects
 */

/**
 * Boss spawn effect
 * @param {number} color - Tint color (default: red)
 */
export function bossSpawn(color = 0xFF0000) {
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
 * @param {number} color - Tint color (default: gold)
 */
export function bossDeath(color = 0xFFFF00) {
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
 * @param {number} color - Tint color (default: purple)
 */
export function bossPhase(color = 0xFF00FF) {
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
 * @param {number} color - Tint color (default: orange)
 */
export function bossSpecial(color = 0xFF8800) {
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
 * @param {number} color - Tint color (default: red)
 */
export function bossBeamWarning(color = 0xFF0000) {
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
 * @param {number} color - Tint color (default: purple)
 */
export function bossOverloadCharge(color = 0xFF00FF) {
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
 * @param {number} color - Tint color (default: yellow)
 */
export function bossOverloadExplosion(color = 0xFFFF00) {
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
 * @param {number} color - Tint color (default: green)
 */
export function bossRadiationStorm(color = 0x00FF00) {
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
 * @param {number} color - Tint color (default: gold)
 */
export function bossVictory(color = 0xFFD700) {
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
 * Radiation pulse effect - used by boss abilities
 * Creates expanding rings with radioactive glow
 * @param {number} color - Tint color (default: lime)
 */
export function radiationPulse(color = 0xCCFF00) {
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