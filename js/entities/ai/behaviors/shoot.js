/**
 * shoot.js - Shooting behavior for enemies
 * 
 * Pure function - no Phaser API calls
 * Uses capability interface to interact with enemy
 */

/**
 * Shoot behavior - enemy shoots at player
 * @param {Object} cap - Capability interface
 * @param {Object} cfg - Behavior configuration
 * @param {number} dt - Delta time in seconds
 * @param {Object} mem - Persistent memory
 * @param {Function} setState - State transition function
 */
export function shoot(cap, cfg, dt, mem, setState) {
    // Get configuration with defaults
    const config = {
        shootCooldown: cfg?.shootCooldown || 900,
        attackRange: cfg?.attackRange || 160,
        burstCount: cfg?.burstCount || 1,
        burstDelay: cfg?.burstDelay || 100,
        projectilePattern: cfg?.projectilePattern || 'straight',
        retreatAfterShoot: cfg?.retreatAfterShoot || false,
        hysteresis: {
            exitFactor: cfg?.hysteresis?.exitFactor ?? 1.2,  // Exit shoot at 120% range
            minChaseStickMs: cfg?.hysteresis?.minChaseStickMs ?? 200,  // Min time in chase
            ...cfg?.hysteresis
        },
        ...cfg
    };
    
    // Get player reference
    const player = cap.scene?.player;
    if (!player || !player.active) {
        // Lost player, return to idle
        setState('idle');
        return;
    }
    
    // Get positions
    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const rawDist = Math.sqrt(dx * dx + dy * dy);
    
    // 🔹 Shared EMA smoothing with chase
    const alpha = 0.25;
    mem.prevDist = (mem.prevDist == null) ? rawDist : (mem.prevDist * (1 - alpha) + rawDist * alpha);
    const distance = mem.prevDist;
    
    // Face player
    cap.faceTo(player.x, player.y);
    
    // 🔹 Check sticky time - can we leave shoot state?
    const now = cap.scene?.time?.now || Date.now();
    const canLeaveShoot = now >= (mem.stickyUntil || 0);
    
    // 🔹 Dead zone: exit shoot only when significantly further (120% range)
    if (canLeaveShoot && distance > config.attackRange * config.hysteresis.exitFactor) {
        // Resume chase with minimum sticky time
        setState('chase', { stickyMs: config.hysteresis.minChaseStickMs });
        return;
    }
    
    // 🔫 Shoot with proper cooldown
    if (now - (mem.lastShotAt || -Infinity) >= config.shootCooldown) {
        // Calculate shoot direction
        const angle = Math.atan2(dy, dx);
        
        // Shoot burst
        for (let i = 0; i < config.burstCount; i++) {
            cap.schedule(() => {
                cap.shoot(config.projectilePattern, {
                    angle: angle,
                    speed: 200,
                    damage: cap.damage
                });
                
                // Play shoot sound if available
                if (cap.playSfx) {
                    cap.playSfx('sfx.enemy.shoot');
                }
            }, i * config.burstDelay);
        }
        
        // Update last shot time
        mem.lastShotAt = now;
        
        // Handle post-shoot behavior
        if (config.retreatAfterShoot) {
            // Brief retreat
            const retreatAngle = angle + Math.PI;
            const vx = Math.cos(retreatAngle) * 50;
            const vy = Math.sin(retreatAngle) * 50;
            cap.setVelocity(vx, vy);
            
            // Stop after short time
            cap.schedule(() => {
                cap.setVelocity(0, 0);
            }, 300);
        } else {
            // Stand still while shooting
            cap.setVelocity(0, 0);
        }
    }
}

export default shoot;