/**
 * orbit.js - Orbit behavior for enemies
 * 
 * Pure function - no Phaser API calls
 * Enemy orbits around player at fixed distance
 */

/**
 * Orbit behavior - enemy circles around player
 * @param {Object} cap - Capability interface
 * @param {Object} cfg - Behavior configuration
 * @param {number} dt - Delta time in seconds
 * @param {Object} mem - Persistent memory
 * @param {Function} setState - State transition function
 */
export function orbit(cap, cfg, dt, mem, setState) {
    // Get configuration with defaults
    const config = {
        speed: cfg?.speed || 100,
        orbitRadius: cfg?.orbitRadius || 150,
        orbitSpeed: cfg?.orbitSpeed || 1.5,
        shootChance: cfg?.shootChance || 0.02,
        shootCooldownMs: cfg?.shootCooldownMs || 1000,
        fleeDistance: cfg?.fleeDistance || 50,
        angleSnapThreshold: cfg?.angleSnapThreshold || 0.087, // ~5 degrees
        ...cfg
    };
    
    // Initialize orbit memory
    if (!mem.orbit.initialized) {
        mem.orbit = {
            initialized: true,
            angle: 0,
            lastAngle: 0,
            lastShootAt: -Infinity
        };
    }
    
    // Get player reference
    const player = cap.scene?.player;
    if (!player || !player.active) {
        // Lost player, return to idle
        setState('idle', { stickyMs: 300 });
        return;
    }
    
    // Get positions
    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Too close - flee briefly
    if (distance < config.fleeDistance) {
        setState('flee', { stickyMs: 500 });
        return;
    }
    
    // Initialize orbit angle if needed
    if (mem.orbit.angle === 0) {
        mem.orbit.angle = Math.atan2(dy, dx);
        mem.orbit.lastAngle = mem.orbit.angle;
    }
    
    // Update orbit angle with snap threshold
    const targetAngle = mem.orbit.angle + config.orbitSpeed * dt;
    const angleDiff = Math.abs(targetAngle - mem.orbit.lastAngle);
    
    // Only update if change is significant
    if (angleDiff > config.angleSnapThreshold) {
        mem.orbit.angle = targetAngle;
        mem.orbit.lastAngle = targetAngle;
    }
    
    // Calculate desired orbit position
    const targetX = player.x + Math.cos(mem.orbit.angle) * config.orbitRadius;
    const targetY = player.y + Math.sin(mem.orbit.angle) * config.orbitRadius;
    
    // Move towards orbit position
    const tdx = targetX - pos.x;
    const tdy = targetY - pos.y;
    const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
    
    if (tdist > 5) {
        const vx = (tdx / tdist) * config.speed;
        const vy = (tdy / tdist) * config.speed;
        cap.setVelocity(vx, vy);
    } else {
        // Maintain orbit velocity
        const tangentAngle = mem.orbit.angle + Math.PI / 2;
        const vx = Math.cos(tangentAngle) * config.speed * 0.5;
        const vy = Math.sin(tangentAngle) * config.speed * 0.5;
        cap.setVelocity(vx, vy);
    }
    
    // Always face player while orbiting
    cap.faceTo(player.x, player.y);
    
    // Shoot with proper cooldown
    const now = cap.scene?.time?.now || performance.now();
    if (now - mem.orbit.lastShootAt >= config.shootCooldownMs) {
        if (Math.random() < config.shootChance) {
            const angle = Math.atan2(player.y - pos.y, player.x - pos.x);
            cap.shoot('straight', { 
                angle: angle,
                damage: cap.damage
            });
            mem.orbit.lastShootAt = now;
        }
    }
}

export default orbit;