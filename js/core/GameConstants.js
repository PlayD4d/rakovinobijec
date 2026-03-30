/**
 * GameConstants - Central place for all game constants
 *
 * Replaces "magic numbers" scattered throughout the codebase.
 * Makes balancing and maintenance easier.
 */

export const GameConstants = {
    // Collision radiuses
    COLLISION: {
        PROJECTILE: 15,          // Projectile ↔ enemy collision radius
        LOOT_PICKUP: 15,         // Loot pickup radius (LootSystem)
        LOOT_OVERLAP: 20,        // Radius for physics.overlap
        PLAYER_ENEMY: 25,        // Contact damage radius
        EXPLOSION: 50,           // Base explosion radius
    },
    
    // Distances and positions
    DISTANCE: {
        BOSS_SAFE_SPAWN: 220,    // Minimum boss spawn distance from player
        PROJECTILE_VISIBILITY: 20, // Distance for projectile visibility
        OUT_OF_BOUNDS: 50,       // Margin for destroying off-screen projectiles
    },
    
    // Time constants (ms)
    TIME: {
        PROJECTILE_LIFETIME: 1500,  // Projectile lifetime
        INVINCIBILITY_FRAMES: 1000, // i-frames after hit
        BLINK_INTERVAL: 180,        // Metotrexat blink interval
        DEBUG_LOG_THROTTLE: 5000,   // Debug log throttle
    },
    
    // Visual constants
    VISUAL: {
        PROJECTILE_SIZE: 5,      // Player projectile size
        ENEMY_PROJECTILE_SIZE: 4, // Enemy projectile size
        EXPLOSION_SCALE: 2,      // Explosion animation multiplier
        EXPLOSION_DURATION: 300, // ms explosion animation
    },
    
    // Physics constants
    PHYSICS: {
        DIAGONAL_NORMALIZER: Math.sqrt(2), // For normalizing diagonal movement
    },
    
    // Homing projectile blueprints - all parameters configurable
    HOMING: {
        // Default blueprint for basic homing
        DEFAULT: {
            aimErrorMax: 0.3,              // ±rad - persistent aim error
            turnRate: 2.0,                 // rad/s - max rotation speed
            delayMs: 0,                    // ms - straight flight before homing
            speedFactor: 0.85,             // speed multiplier during homing
            lifeMaxMs: 4000,               // ms - max lifespan cap
            slowOnTurn: {
                enabled: false,
                angleThresholdDeg: 60,      // deg - when to trigger slowdown
                factor: 0.6                 // speed reduction factor
            }
        },
        
        // Slow tracking for fair gameplay  
        TRACKING: {
            aimErrorMax: 0.4,              // More inaccurate
            turnRate: 1.5,                 // Slower turning
            delayMs: 200,                  // Brief delay
            speedFactor: 0.7,              // Slower when homing
            lifeMaxMs: 3500,
            slowOnTurn: {
                enabled: true,
                angleThresholdDeg: 45,
                factor: 0.5
            }
        },
        
        // Fast aggressive homing for bosses
        AGGRESSIVE: {
            aimErrorMax: 0.2,              // More accurate
            turnRate: 3.5,                 // Fast turning
            delayMs: 100,                  // Short delay
            speedFactor: 0.9,              // Less speed penalty
            lifeMaxMs: 5000,
            slowOnTurn: {
                enabled: false              // No slowdown
            }
        },
        
        // Lazy homing for basic enemies
        LAZY: {
            aimErrorMax: 0.6,              // Very inaccurate
            turnRate: 1.0,                 // Slow turning
            delayMs: 500,                  // Long delay
            speedFactor: 0.6,              // Much slower
            lifeMaxMs: 2500,
            slowOnTurn: {
                enabled: true,
                angleThresholdDeg: 30,
                factor: 0.4
            }
        }
    },
    
    // Debug constants
    DEBUG: {
        OVERLAY_UPDATE_INTERVAL: 500,  // ms between debug overlay updates
        LOOT_LOG_THROTTLE: 1000,       // Loot debug log throttle
        PERFORMANCE_THRESHOLD: 33,     // ms above which low FPS is logged
    }
};

// Convenience aliases (internal use only)
const COLLISION_RADIUS = GameConstants.COLLISION;
const DISTANCES = GameConstants.DISTANCE;
const TIMINGS = GameConstants.TIME;