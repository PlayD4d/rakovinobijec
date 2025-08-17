/**
 * idle.js - Idle behavior for enemies
 * 
 * Pure function - no Phaser API calls
 * Uses capability interface to interact with enemy
 */

/**
 * Idle behavior - enemy stays in place, may wander slightly
 * @param {Object} cap - Capability interface
 * @param {Object} cfg - Behavior configuration
 * @param {number} dt - Delta time in seconds
 * @returns {string|null} Next state or null to continue
 */
export function idle(cap, cfg, dt) {
    // Get configuration with defaults
    const config = {
        wanderRadius: cfg?.wanderRadius || 50,
        wanderSpeed: cfg?.wanderSpeed || 30,
        wanderChance: cfg?.wanderChance || 0.01,
        detectRange: cfg?.detectRange || 200,
        ...cfg
    };
    
    // Check for player in range
    if (cap.inRangeOfPlayer(config.detectRange)) {
        // Transition to chase
        return 'chase';
    }
    
    // Random chance to wander
    if (Math.random() < config.wanderChance) {
        // Pick random direction
        const angle = Math.random() * Math.PI * 2;
        const vx = Math.cos(angle) * config.wanderSpeed;
        const vy = Math.sin(angle) * config.wanderSpeed;
        
        cap.setVelocity(vx, vy);
        
        // Schedule stop after short duration
        cap.schedule(() => {
            cap.setVelocity(0, 0);
        }, 500 + Math.random() * 1000);
    }
    
    // Stay in idle state
    return null;
}

export default idle;