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
 * @returns {string|null} Next state or null to continue
 */
export function orbit(cap, cfg, dt) {
    // Get configuration with defaults
    const config = {
        speed: cfg?.speed || 100,
        orbitRadius: cfg?.orbitRadius || 150,
        orbitSpeed: cfg?.orbitSpeed || 1.5,
        shootChance: cfg?.shootChance || 0.02,
        fleeDistance: cfg?.fleeDistance || 50,
        ...cfg
    };
    
    // Get player reference
    const player = cap.scene?.player;
    if (!player || !player.active) {
        // Lost player, return to idle
        return 'idle';
    }
    
    // Get positions
    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Too close - flee briefly
    if (distance < config.fleeDistance) {
        return 'flee';
    }
    
    // Initialize orbit angle if needed
    if (!cap._orbitAngle) {
        cap._orbitAngle = Math.atan2(dy, dx);
    }
    
    // Update orbit angle
    cap._orbitAngle += config.orbitSpeed * dt;
    
    // Calculate desired orbit position
    const targetX = player.x + Math.cos(cap._orbitAngle) * config.orbitRadius;
    const targetY = player.y + Math.sin(cap._orbitAngle) * config.orbitRadius;
    
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
        const tangentAngle = cap._orbitAngle + Math.PI / 2;
        const vx = Math.cos(tangentAngle) * config.speed * 0.5;
        const vy = Math.sin(tangentAngle) * config.speed * 0.5;
        cap.setVelocity(vx, vy);
    }
    
    // Always face player while orbiting
    cap.faceTo(player.x, player.y);
    
    // Random chance to shoot while orbiting
    if (Math.random() < config.shootChance) {
        const angle = Math.atan2(player.y - pos.y, player.x - pos.x);
        cap.shoot('straight', { 
            angle: angle,
            cooldown: 1000
        });
    }
    
    // Stay in orbit state
    return null;
}

export default orbit;