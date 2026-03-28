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
 * @param {Object} mem - Persistent memory
 * @param {Function} setState - State transition function
 */
export function patrol(cap, cfg, dt, mem, setState) {
    // Get configuration with defaults
    const config = {
        speed: cfg?.speed || 60,
        radius: cfg?.radius || 100,
        detectRange: cfg?.detectRange || 150,
        pattern: cfg?.pattern || 'circle', // circle, square, random
        changeInterval: cfg?.changeInterval || 2000,
        waypointDeadZone: cfg?.waypointDeadZone || 10,
        hysteresis: {
            detectEnterFactor: cfg?.hysteresis?.detectEnterFactor ?? 0.9,
            ...cfg?.hysteresis
        },
        ...cfg
    };
    
    // Check for player in range with hysteresis
    const detectRange = config.detectRange * config.hysteresis.detectEnterFactor;
    if (cap.inRangeOfPlayer(detectRange)) {
        // Player detected, engage
        setState('chase', { stickyMs: 300 });
        return;
    }
    
    // Get current position and spawn point
    const pos = cap.getPos();
    const spawnX = cap.spawnX || pos.x;
    const spawnY = cap.spawnY || pos.y;
    
    // Initialize patrol state in memory
    if (!mem.patrol?.initialized) {
        mem.patrol = {
            initialized: true,
            angle: 0,
            lastChange: 0,
            targetX: spawnX,
            targetY: spawnY,
            atWaypoint: false,
            waypointReachedAt: 0
        };
    }
    
    const state = mem.patrol;
    const now = cap.now > 0 ? cap.now : (cap.scene?.time?.now || 1);
    
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

            case 'square': {
                // Move in square pattern (block-scoped const)
                const side = Math.floor(state.angle / (Math.PI / 2)) % 4;
                const squareOffsets = [[1,0],[0,1],[-1,0],[0,-1]];
                const [ox, oy] = squareOffsets[side];
                state.targetX = spawnX + ox * config.radius;
                state.targetY = spawnY + oy * config.radius;
                state.angle += Math.PI / 2;
                break;
            }

            case 'random': {
                // Random points within radius (block-scoped const)
                const randomAngle = Math.random() * Math.PI * 2;
                const randomDist = Math.random() * config.radius;
                state.targetX = spawnX + Math.cos(randomAngle) * randomDist;
                state.targetY = spawnY + Math.sin(randomAngle) * randomDist;
                break;
            }
        }
    }
    
    // Move towards target
    const dx = state.targetX - pos.x;
    const dy = state.targetY - pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if reached waypoint with dead zone
    if (distance <= config.waypointDeadZone) {
        if (!state.atWaypoint) {
            // Just reached waypoint
            state.atWaypoint = true;
            state.waypointReachedAt = now;
            cap.setVelocity(0, 0);
        }
        // Stay at waypoint for minimum dwell time
        return;
    } else {
        state.atWaypoint = false;
    }
    
    // Move towards target
    if (distance > config.waypointDeadZone) {
        const vx = (dx / distance) * config.speed;
        const vy = (dy / distance) * config.speed;
        cap.setVelocity(vx, vy);
        cap.faceTo(state.targetX, state.targetY);
    }
}

export default patrol;