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
    // Cache merged config on first call (avoids per-frame spread allocation)
    if (!mem._config) {
        mem._config = {
            speed: cfg?.speed || 120,
            safeDistance: cfg?.safeDistance || 300,
            panicDistance: cfg?.panicDistance || 100,
            hysteresis: {
                exitFactor: cfg?.hysteresis?.exitFactor ?? 1.2
            }
        };
    }
    const config = mem._config;
    
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
    
    // EMA smoothing (scoped under mem.flee to avoid namespace pollution)
    const alpha = 0.25;
    mem.flee.prevDist = (mem.flee.prevDist == null) ? rawDist : (mem.flee.prevDist * (1 - alpha) + rawDist * alpha);
    const distance = mem.flee.prevDist;
    
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

