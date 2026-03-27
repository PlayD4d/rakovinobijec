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
 * @param {Object} mem - Persistent memory
 * @param {Function} setState - State transition function
 */
export function chase(cap, cfg, dt, mem, setState) {
    // Get configuration with defaults
    const config = {
        speed: cfg?.speed || 140,
        attackRange: cfg?.attackRange || 160,
        loseRange: cfg?.loseRange || 400,
        predictiveChase: cfg?.predictiveChase || false,
        hysteresis: {
            enterFactor: cfg?.hysteresis?.enterFactor ?? 0.9,  // Enter shoot at 90% range
            minShootStickMs: cfg?.hysteresis?.minShootStickMs ?? 250,  // Min time in shoot
            ...cfg?.hysteresis
        },
        ...cfg
    };
    
    // Get positions
    let pos = cap.getPos();
    
    // Get player reference
    const player = cap.scene?.player;
    if (!player || !player.active) {
        // Lost player, return to idle
        setState('idle');
        return;
    }
    
    // Get positions (reuse from debug section)
    pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const rawDist = Math.sqrt(dx * dx + dy * dy);
    
    // 🔹 EMA smoothing to reduce jitter
    const alpha = 0.25;
    mem.prevDist = (mem.prevDist == null) ? rawDist : (mem.prevDist * (1 - alpha) + rawDist * alpha);
    const distance = mem.prevDist;
    
    // Check if out of chase range
    if (distance > config.loseRange) {
        cap.setVelocity(0, 0);
        setState('idle');
        return;
    }
    
    // 🔹 Check sticky time - can we switch states?
    const now = cap.scene?.time?.now || Date.now();
    const canSwitch = now >= (mem.stickyUntil || 0);
    
    // 🔹 Hysteresis: enter shoot at 90% of attack range
    if (canSwitch && distance <= config.attackRange * config.hysteresis.enterFactor) {
        // Stop and switch to shooting with minimum sticky time
        cap.setVelocity(0, 0);
        setState('shoot', { stickyMs: config.hysteresis.minShootStickMs });
        return;
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
    
    // Calculate direction to target
    const angle = Math.atan2(player.y - pos.y, player.x - pos.x);
    
    // Apply velocity
    const vx = Math.cos(angle) * config.speed;
    const vy = Math.sin(angle) * config.speed;
    
    cap.setVelocity(vx, vy);
    cap.faceTo(player.x, player.y);
}

export default chase;