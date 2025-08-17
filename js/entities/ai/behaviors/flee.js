/**
 * flee.js - Flee behavior for enemies
 * 
 * Pure function - no Phaser API calls
 * Enemy runs away from player
 */

/**
 * Flee behavior - enemy runs away from player
 * @param {Object} cap - Capability interface
 * @param {Object} cfg - Behavior configuration
 * @param {number} dt - Delta time in seconds
 * @returns {string|null} Next state or null to continue
 */
export function flee(cap, cfg, dt) {
    // Get configuration with defaults
    const config = {
        speed: cfg?.speed || 120,
        safeDistance: cfg?.safeDistance || 300,
        panicDistance: cfg?.panicDistance || 100,
        ...cfg
    };
    
    // Get player reference
    const player = cap.scene?.player;
    if (!player || !player.active) {
        // No threat, return to idle
        return 'idle';
    }
    
    // Get positions
    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if at safe distance
    if (distance >= config.safeDistance) {
        cap.setVelocity(0, 0);
        return 'idle';
    }
    
    // Calculate flee velocity (opposite direction from player)
    const fleeAngle = Math.atan2(dy, dx) + Math.PI;
    
    // Panic speed boost if too close
    const speedMult = distance < config.panicDistance ? 1.5 : 1.0;
    const fleeSpeed = config.speed * speedMult;
    
    const vx = Math.cos(fleeAngle) * fleeSpeed;
    const vy = Math.sin(fleeAngle) * fleeSpeed;
    
    cap.setVelocity(vx, vy);
    cap.faceTo(player.x, player.y); // Still face player while fleeing
    
    // Stay in flee state
    return null;
}

export default flee;