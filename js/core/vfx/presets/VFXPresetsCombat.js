/**
 * VFXPresetsCombat - Combat-related visual effects
 * PR7 Compliant - Pure functions for combat effects
 *
 * Contains hit effects, explosions, death bursts and combat-related particles
 */

// Module-level config tables — allocated once, not per-call
const EXPLOSION_CONFIGS = {
    small:  { quantity: 15, speed: { min: 80, max: 180 },  scale: { start: 0.4, end: 0 }, lifespan: 300 },
    medium: { quantity: 25, speed: { min: 100, max: 250 }, scale: { start: 0.6, end: 0 }, lifespan: 400 },
    large:  { quantity: 40, speed: { min: 150, max: 350 }, scale: { start: 0.8, end: 0 }, lifespan: 500 }
};

const DEATH_BURST_CONFIGS = {
    small:  { quantity: 10, speed: { min: 60, max: 150 },  scale: { start: 0.3, end: 0 }, lifespan: 250 },
    medium: { quantity: 20, speed: { min: 100, max: 200 }, scale: { start: 0.5, end: 0 }, lifespan: 350 },
    large:  { quantity: 30, speed: { min: 150, max: 300 }, scale: { start: 0.7, end: 0 }, lifespan: 450 }
};

/**
 * Small hit effect - used for projectile impacts
 * @param {number} color - Tint color (default: white)
 * @param {number} quantity - Number of particles (default: 8)
 */
export function smallHit(color = 0xFFFFFF, quantity = 8) {
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
export function mediumHit(color = 0xFFFFFF, quantity = 12) {
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
 * Large hit effect - for heavy impacts
 */
export function largeHit(color = 0xFFFFFF) {
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
 * Explosion effect - configurable size
 * @param {string} size - Size of explosion ('small', 'medium', 'large')
 * @param {number} color - Tint color
 */
export function explosion(size = 'medium', color = 0xFF6600) {
    const config = EXPLOSION_CONFIGS[size] || EXPLOSION_CONFIGS.medium;
    
    return {
        type: 'particles',
        config: {
            ...config,
            tint: color || 0xFF6600,
            blendMode: 'ADD',
            angle: { min: 0, max: 360 }
        }
    };
}

/**
 * Death burst effect - enemy death particles
 * @param {string} size - Size of burst ('small', 'medium', 'large')
 * @param {number} color - Tint color
 */
export function deathBurst(size = 'medium', color = 0xFF2222) {
    const config = DEATH_BURST_CONFIGS[size] || DEATH_BURST_CONFIGS.medium;
    
    return {
        type: 'particles',
        config: {
            ...config,
            tint: color || 0xFF2222,
            blendMode: 'ADD',
            angle: { min: 0, max: 360 },
            alpha: { start: 1, end: 0 }
        }
    };
}

/**
 * Enemy hit effect - standard damage feedback
 */
export function enemyHit(color = 0xFF4444) {
    return {
        type: 'particles', 
        config: {
            quantity: 10,
            speed: { min: 60, max: 160 },
            scale: { start: 0.35, end: 0 },
            lifespan: 250,
            tint: color || 0xFF4444,
            blendMode: 'ADD'
        }
    };
}

/**
 * Enemy shoot effect - small muzzle flash for enemies
 */
export function enemyShoot(color = 0xFF4444) {
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
 * Muzzle flash - used for weapon firing
 * @param {number} color - Tint color
 */
export function muzzleFlash(color = 0xFFFFAA) {
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