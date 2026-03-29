/**
 * GameConstants - Centrální místo pro všechny game konstanty
 * 
 * Nahrazuje "magic numbers" rozházené po celém kódu.
 * Usnadňuje balancing a údržbu.
 */

export const GameConstants = {
    // Kolizní radiusy
    COLLISION: {
        PROJECTILE: 15,          // Radius kolize projektil ↔ enemy
        LOOT_PICKUP: 15,         // Radius sběru lootu (LootSystem)
        LOOT_OVERLAP: 20,        // Radius pro physics.overlap
        PLAYER_ENEMY: 25,        // Radius kontaktního damage
        EXPLOSION: 50,           // Základní radius exploze
    },
    
    // Vzdálenosti a pozice
    DISTANCE: {
        BOSS_SAFE_SPAWN: 220,    // Minimální vzdálenost spawn bosse od hráče
        PROJECTILE_VISIBILITY: 20, // Vzdálenost pro zobrazení projektilu
        OUT_OF_BOUNDS: 50,       // Okraj pro destroy projektilů mimo obrazovku
    },
    
    // Časové konstanty (ms)
    TIME: {
        PROJECTILE_LIFETIME: 1500,  // Životnost projektilu
        INVINCIBILITY_FRAMES: 1000, // i-frames po zásahu
        BLINK_INTERVAL: 180,        // Blikání metotrexátu
        DEBUG_LOG_THROTTLE: 5000,   // Throttle debug logů
    },
    
    // Vizuální konstanty
    VISUAL: {
        PROJECTILE_SIZE: 5,      // Velikost player projektilu
        ENEMY_PROJECTILE_SIZE: 4, // Velikost enemy projektilu
        EXPLOSION_SCALE: 2,      // Multiplier exploze při animaci
        EXPLOSION_DURATION: 300, // ms animace exploze
    },
    
    // Physics konstanty
    PHYSICS: {
        DIAGONAL_NORMALIZER: Math.sqrt(2), // Pro normalizaci diagonálního pohybu
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
    
    // Debug konstanty
    DEBUG: {
        OVERLAY_UPDATE_INTERVAL: 500,  // ms mezi aktualizacemi debug overlay
        LOOT_LOG_THROTTLE: 1000,       // Throttle loot debug logů
        PERFORMANCE_THRESHOLD: 33,     // ms nad kterým se loguje low FPS
    }
};

// Convenience aliases (internal use only)
const COLLISION_RADIUS = GameConstants.COLLISION;
const DISTANCES = GameConstants.DISTANCE;
const TIMINGS = GameConstants.TIME;