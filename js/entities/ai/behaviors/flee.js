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
 * @param {Object} mem - Persistent memory
 * @param {Function} setState - State transition function
 */
export function flee(cap, cfg, dt, mem, setState) {
    // Get configuration with defaults
    const config = {
        speed: cfg?.speed || 120,
        safeDistance: cfg?.safeDistance || 300,
        panicDistance: cfg?.panicDistance || 100,
        hysteresis: {
            exitFactor: cfg?.hysteresis?.exitFactor ?? 1.2,  // Exit at 120% safe distance
            ...cfg?.hysteresis
        },
        ...cfg
    };
    
    // Initialize flee memory if needed
    if (!mem.flee) {
        mem.flee = {
            enteredAt: 0,
            lastSafeDistance: config.safeDistance
        };
    }
    
    // Get player reference
    const player = cap.scene?.player;
    if (!player || !player.active) {
        // No threat, return to idle
        setState('idle', { stickyMs: 200 });
        return;
    }
    
    // Get positions
    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const rawDist = Math.sqrt(dx * dx + dy * dy);
    
    // EMA smoothing
    const alpha = 0.25;
    mem.prevDist = (mem.prevDist == null) ? rawDist : (mem.prevDist * (1 - alpha) + rawDist * alpha);
    const distance = mem.prevDist;
    
    // Check if at safe distance with hysteresis
    const exitDistance = config.safeDistance * config.hysteresis.exitFactor;
    if (distance >= exitDistance) {
        cap.setVelocity(0, 0);
        setState('idle', { stickyMs: 300 });
        return;
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
}

export default flee;