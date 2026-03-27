import { DebugLogger } from '../../../core/debug/DebugLogger.js';

/**
 * idle.js - Idle behavior for enemies
 * 
 * Pure function - no Phaser API calls
 * Uses capability interface to interact with enemy
 */

/**
 * Idle behavior - enemy stays in place, may wander slightly
 * @param {Object} cap - Capability interface
 * @param {Object} cfg - Behavior configuration
 * @param {number} dt - Delta time in seconds
 * @param {Object} mem - Persistent memory
 * @param {Function} setState - State transition function
 */
export function idle(cap, cfg, dt, mem, setState) {
    // Get configuration with defaults
    const config = {
        wanderRadius: cfg?.wanderRadius || 50,
        wanderSpeed: cfg?.wanderSpeed || 30,
        wanderChance: cfg?.wanderChance || 0.01,
        detectRange: cfg?.detectRange || 200,
        hysteresis: {
            detectEnterFactor: cfg?.hysteresis?.detectEnterFactor ?? 0.9,
            ...cfg?.hysteresis
        },
        ...cfg
    };
    
    // DEBUG: Log idle behavior execution (reduced frequency)
    const pos = cap.getPos();
    if (Math.random() < 0.001) { // 0.1% chance - much less spam
        DebugLogger.info('general', '[Idle Behavior] Executing:', {
            entityPos: pos,
            detectRange: config.detectRange,
            enterRange: config.detectRange * config.hysteresis.detectEnterFactor,
            hasPlayer: !!cap.scene?.player,
            playerPos: cap.scene?.player ? { x: cap.scene.player.x, y: cap.scene.player.y } : null,
            playerActive: cap.scene?.player?.active,
            inRange: cap.inRangeOfPlayer ? cap.inRangeOfPlayer(config.detectRange * config.hysteresis.detectEnterFactor) : 'method missing'
        });
    }
    
    // Initialize idle memory if needed
    if (!mem.idle) {
        mem.idle = {
            lastDetectRange: null,
            wandering: false,
            wanderUntil: 0
        };
    }
    
    // Check for player in range with hysteresis
    const effectiveRange = mem.idle.lastDetectRange || config.detectRange;
    const enterRange = config.detectRange * config.hysteresis.detectEnterFactor;
    
    const playerInRange = cap.inRangeOfPlayer(enterRange);
    
    if (playerInRange) {
        // Player detected - transition to chase (log only transitions)
        DebugLogger.info('general', '[Idle→Chase] Enemy transitioning to chase state');
        mem.idle.lastDetectRange = config.detectRange;
        setState('chase', { stickyMs: 300 });
        return;
    }
    
    // Update last detect range for hysteresis
    mem.idle.lastDetectRange = effectiveRange;
    
    // Check if currently wandering
    const now = cap.scene?.time?.now || performance.now();
    if (mem.idle.wandering && now < mem.idle.wanderUntil) {
        // Continue wandering
        return;
    } else if (mem.idle.wandering) {
        // Stop wandering
        cap.setVelocity(0, 0);
        mem.idle.wandering = false;
    }
    
    // Random chance to wander
    const wanderRoll = Math.random();
    if (!mem.idle.wandering && wanderRoll < config.wanderChance) {
        // Pick random direction
        const angle = Math.random() * Math.PI * 2;
        const vx = Math.cos(angle) * config.wanderSpeed;
        const vy = Math.sin(angle) * config.wanderSpeed;
        
        cap.setVelocity(vx, vy);
        
        // Set wander duration
        mem.idle.wandering = true;
        mem.idle.wanderUntil = now + 500 + Math.random() * 1000;
    } else if (!mem.idle.wandering) {
        // Not wandering, ensure velocity is 0
        cap.setVelocity(0, 0);
    }
}

export default idle;