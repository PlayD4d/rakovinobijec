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
 * @returns {string|null} Next state or null to continue
 */
export function shoot(cap, cfg, dt) {
    // Get configuration with defaults
    const config = {
        shootCooldown: cfg?.shootCooldown || 1000,
        attackRange: cfg?.attackRange || 200,
        burstCount: cfg?.burstCount || 1,
        burstDelay: cfg?.burstDelay || 100,
        projectilePattern: cfg?.projectilePattern || 'straight',
        retreatAfterShoot: cfg?.retreatAfterShoot || false,
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
    
    // Check if player out of range
    if (distance > config.attackRange) {
        // Resume chase
        return 'chase';
    }
    
    // Face player
    cap.faceTo(player.x, player.y);
    
    // Calculate shoot direction
    const angle = Math.atan2(dy, dx);
    
    // Shoot burst
    for (let i = 0; i < config.burstCount; i++) {
        cap.schedule(() => {
            cap.shoot(config.projectilePattern, {
                angle: angle,
                speed: 200,
                damage: cap.damage,
                cooldown: config.shootCooldown
            });
        }, i * config.burstDelay);
    }
    
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
    }
    
    // Schedule return to chase
    cap.schedule(() => {
        cap.setState('chase');
    }, config.shootCooldown);
    
    // Stay in shoot state
    return null;
}

export default shoot;