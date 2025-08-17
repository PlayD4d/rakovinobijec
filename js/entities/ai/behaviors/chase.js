/**
 * chase.js - Chase behavior for enemies
 * 
 * Pure function - no Phaser API calls
 * Uses capability interface to interact with enemy
 */

/**
 * Chase behavior - enemy pursues player
 * @param {Object} cap - Capability interface
 * @param {Object} cfg - Behavior configuration
 * @param {number} dt - Delta time in seconds
 * @returns {string|null} Next state or null to continue
 */
export function chase(cap, cfg, dt) {
    // Get configuration with defaults
    const config = {
        speed: cfg?.speed || 100,
        attackRange: cfg?.attackRange || 150,
        loseRange: cfg?.loseRange || 400,
        predictiveChase: cfg?.predictiveChase || false,
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
    
    // Check if out of chase range
    if (distance > config.loseRange) {
        cap.setVelocity(0, 0);
        return 'idle';
    }
    
    // Check if in attack range
    if (distance <= config.attackRange) {
        // Stop and switch to shooting
        cap.setVelocity(0, 0);
        return 'shoot';
    }
    
    // Calculate chase velocity
    let targetX = player.x;
    let targetY = player.y;
    
    // Predictive chase - aim where player will be
    if (config.predictiveChase && player.body) {
        const predictionTime = distance / config.speed * 0.5;
        targetX += player.body.velocity.x * predictionTime;
        targetY += player.body.velocity.y * predictionTime;
    }
    
    // Recalculate direction to target
    const tdx = targetX - pos.x;
    const tdy = targetY - pos.y;
    const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
    
    if (tdist > 0) {
        // Normalize and apply speed
        const vx = (tdx / tdist) * config.speed;
        const vy = (tdy / tdist) * config.speed;
        
        cap.setVelocity(vx, vy);
        cap.faceTo(targetX, targetY);
    }
    
    // Stay in chase state
    return null;
}

export default chase;