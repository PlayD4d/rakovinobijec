/**
 * patrol.js - Patrol behavior for enemies
 * 
 * Pure function - no Phaser API calls
 * Enemy patrols around spawn point
 */

/**
 * Patrol behavior - enemy moves in pattern around spawn point
 * @param {Object} cap - Capability interface
 * @param {Object} cfg - Behavior configuration
 * @param {number} dt - Delta time in seconds
 * @returns {string|null} Next state or null to continue
 */
export function patrol(cap, cfg, dt) {
    // Get configuration with defaults
    const config = {
        speed: cfg?.speed || 60,
        radius: cfg?.radius || 100,
        detectRange: cfg?.detectRange || 150,
        pattern: cfg?.pattern || 'circle', // circle, square, random
        changeInterval: cfg?.changeInterval || 2000,
        ...cfg
    };
    
    // Check for player in range
    if (cap.inRangeOfPlayer(config.detectRange)) {
        // Player detected, engage
        return 'chase';
    }
    
    // Get current position and spawn point
    const pos = cap.getPos();
    const spawnX = cap.spawnX || pos.x;
    const spawnY = cap.spawnY || pos.y;
    
    // Initialize patrol state if needed
    if (!cap._patrolState) {
        cap._patrolState = {
            angle: 0,
            lastChange: Date.now(),
            targetX: spawnX,
            targetY: spawnY
        };
    }
    
    const state = cap._patrolState;
    const now = Date.now();
    
    // Update patrol target based on pattern
    if (now - state.lastChange > config.changeInterval) {
        state.lastChange = now;
        
        switch (config.pattern) {
            case 'circle':
                // Move in circle around spawn point
                state.angle += Math.PI / 4;
                state.targetX = spawnX + Math.cos(state.angle) * config.radius;
                state.targetY = spawnY + Math.sin(state.angle) * config.radius;
                break;
                
            case 'square':
                // Move in square pattern
                const side = Math.floor(state.angle / (Math.PI / 2)) % 4;
                switch (side) {
                    case 0: // Right
                        state.targetX = spawnX + config.radius;
                        state.targetY = spawnY;
                        break;
                    case 1: // Down
                        state.targetX = spawnX;
                        state.targetY = spawnY + config.radius;
                        break;
                    case 2: // Left
                        state.targetX = spawnX - config.radius;
                        state.targetY = spawnY;
                        break;
                    case 3: // Up
                        state.targetX = spawnX;
                        state.targetY = spawnY - config.radius;
                        break;
                }
                state.angle += Math.PI / 2;
                break;
                
            case 'random':
                // Random points within radius
                const randomAngle = Math.random() * Math.PI * 2;
                const randomDist = Math.random() * config.radius;
                state.targetX = spawnX + Math.cos(randomAngle) * randomDist;
                state.targetY = spawnY + Math.sin(randomAngle) * randomDist;
                break;
        }
    }
    
    // Move towards target
    const dx = state.targetX - pos.x;
    const dy = state.targetY - pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 5) {
        const vx = (dx / distance) * config.speed;
        const vy = (dy / distance) * config.speed;
        cap.setVelocity(vx, vy);
        cap.faceTo(state.targetX, state.targetY);
    } else {
        // Reached target, wait for next change
        cap.setVelocity(0, 0);
    }
    
    // Stay in patrol state
    return null;
}

export default patrol;