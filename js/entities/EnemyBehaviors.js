/**
 * EnemyBehaviors.js - AI behavior router for enemies
 * 
 * Manages behavior state machine and delegates to behavior modules
 * No Phaser API calls - uses capability interface
 */

// Import behavior modules
import { idle } from './ai/behaviors/idle.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
import { chase } from './ai/behaviors/chase.js';
import { shoot } from './ai/behaviors/shoot.js';
import { flee } from './ai/behaviors/flee.js';
import { patrol } from './ai/behaviors/patrol.js';
import { orbit } from './ai/behaviors/orbit.js';

// Behavior registry
const BEHAVIORS = {
    idle,
    chase,
    shoot,
    flee,
    patrol,
    orbit
};

// Default AI configuration
const DEFAULT_AI = {
    hysteresis: {
        enterFactor: 0.9,    // Enter new state at 90% threshold
        exitFactor: 1.2,     // Exit state at 120% threshold
    },
    stateReentryCooldownMs: 300,  // Prevent rapid re-entry
    minDwellMs: 300,              // Default minimum time in state
    
    // Per-state defaults
    idle: {
        minDwellMs: 500,
        detectRange: 350,
        wanderChance: 0.01
    },
    chase: {
        minDwellMs: 300,
        speed: 140,
        attackRange: 160,
        loseRange: 700
    },
    shoot: {
        minDwellMs: 600,
        cadenceMs: 900,
        attackRange: 160,
        burstCount: 1
    },
    flee: {
        minDwellMs: 500,
        speed: 120,
        safeDistance: 300,
        panicDistance: 100
    },
    patrol: {
        minDwellMs: 300,
        speed: 60,
        radius: 100,
        detectRange: 150,
        waypointDeadZone: 10
    },
    orbit: {
        minDwellMs: 400,
        speed: 100,
        orbitRadius: 150,
        orbitSpeed: 1.5,
        angleSnapThreshold: 0.087  // ~5 degrees in radians
    }
};

export class EnemyBehaviors {
    constructor(enemy) {
        // Store reference to enemy (provides capability interface)
        this.enemy = enemy;
        
        // Get initial behavior from blueprint
        const blueprint = enemy.blueprint || {};
        const aiConfig = blueprint.ai || {};
        
        // Map legacy behavior names to behavior types
        const behaviorTypeMapping = {
            'chase': 'aggressive',
            'patrol': 'patrol',
            'defensive': 'defensive',
            'aggressive': 'aggressive',
            'simple': 'simple'
        };
        
        // Initial state - aggressive enemies start in chase, others in idle
        const rawBehavior = aiConfig.behavior || 'simple';
        const isAggressive = rawBehavior === 'chase' || rawBehavior === 'aggressive' || 
                            rawBehavior === 'homing_simple' || rawBehavior === 'shoot';
        this.state = aiConfig.initialState || (isAggressive ? 'chase' : 'idle');
        
        // Merge blueprint config with defaults AND legacy mechanics
        const legacyMechanics = blueprint.mechanics || {};
        const combinedParams = {
            ...aiConfig.params,
            detectRange: legacyMechanics.aggroRange || aiConfig.params?.detectRange,
            speed: blueprint.stats?.speed || aiConfig.params?.speed,
            attackRange: legacyMechanics.aggroRange * 0.8 || aiConfig.params?.attackRange,
            canShoot: legacyMechanics.canShoot || aiConfig.params?.canShoot || false,
            ...aiConfig.params
        };
        this.config = this.mergeConfig(combinedParams);
        
        // Behavior type from blueprint (map legacy names)
        const rawBehaviorType = aiConfig.behavior || 'simple';
        this.behaviorType = behaviorTypeMapping[rawBehaviorType] || rawBehaviorType;
        
        if (Math.random() < 0.1) { // 10% chance to log blueprint analysis
            DebugLogger.info('enemy', `[EnemyBehaviors] ${blueprint.id}: ${rawBehaviorType}→${this.behaviorType}, detectRange: ${this.config.idle?.detectRange}`);
        }
        
        // State machine config
        this.transitions = aiConfig.transitions || this.getDefaultTransitions();
        
        // Combat state
        this.isInCombat = false;
        this.target = null;
        
        // State timing - use absolute time from scene
        this.stateEnterAt = 0;              // When entered current state
        this.lastStateChangeAt = 0;         // Last state change time
        this.canChangeStateAt = 0;          // Earliest time for next change
        this.stateChangeThisFrame = false;  // Re-entry guard
        
        // 🔹 Per-enemy AI memory (persists across frames)
        this.mem = {
            prevDist: null,          // Previous distance for EMA smoothing
            lastShotAt: -Infinity,   // Last shot time in ms
            stickyUntil: 0,          // Stay in current state until this time
            patrol: {},              // Patrol state
            orbit: { angle: 0 },     // Orbit state
            stuck: { pos: null, since: 0 }  // Stuck detection
        };
        
        // Pre-create capability object (reused every frame to avoid GC pressure)
        this._capability = this._buildCapability();

        DebugLogger.info('enemy', `[EnemyBehaviors] Initialized ${this.behaviorType} AI in ${this.state} state - DetectRange: ${this.config.idle?.detectRange}`);
    }
    
    /**
     * Merge config with defaults
     */
    mergeConfig(userConfig) {
        const merged = { ...DEFAULT_AI };
        
        // Deep merge state configs
        for (const state of ['idle', 'chase', 'shoot', 'flee', 'patrol', 'orbit']) {
            merged[state] = {
                ...DEFAULT_AI[state],
                ...(userConfig[state] || {})
            };
            
            // Apply global overrides to all states where applicable
            if (userConfig.detectRange !== undefined) {
                merged[state].detectRange = userConfig.detectRange;
            }
            if (userConfig.speed !== undefined) {
                merged[state].speed = userConfig.speed;
            }
            if (userConfig.attackRange !== undefined) {
                merged[state].attackRange = userConfig.attackRange;
            }
            if (userConfig.loseRange !== undefined) {
                merged[state].loseRange = userConfig.loseRange;
            }
        }
        
        // Merge hysteresis
        merged.hysteresis = {
            ...DEFAULT_AI.hysteresis,
            ...(userConfig.hysteresis || {})
        };
        
        // Top-level overrides
        if (userConfig.stateReentryCooldownMs !== undefined) {
            merged.stateReentryCooldownMs = userConfig.stateReentryCooldownMs;
        }
        if (userConfig.minDwellMs !== undefined) {
            merged.minDwellMs = userConfig.minDwellMs;
        }
        
        return merged;
    }
    
    /**
     * Get default state transitions
     */
    getDefaultTransitions() {
        switch (this.behaviorType) {
            case 'aggressive':
                return {
                    idle: ['chase'],
                    chase: ['idle', 'shoot'],
                    shoot: ['chase', 'idle']
                };
            case 'defensive':
                return {
                    idle: ['flee'],
                    flee: ['idle', 'shoot'],
                    shoot: ['flee', 'idle']
                };
            case 'patrol':
                return {
                    idle: ['patrol', 'chase'],
                    patrol: ['idle', 'chase'],
                    chase: ['patrol', 'shoot'],
                    shoot: ['chase', 'patrol']
                };
            default: // simple
                return {
                    idle: ['chase'],
                    chase: ['idle', 'shoot'],
                    shoot: ['chase', 'idle']
                };
        }
    }
    
    /**
     * Main update method
     * @param {number} time - Game time
     * @param {number} delta - Delta time in ms
     */
    update(time, delta) {
        if (!this.enemy.active || this.enemy.hp <= 0) return;
        
        // Use absolute time from scene
        const now = time; // Use time parameter from update
        
        // Reset re-entry guard
        this.stateChangeThisFrame = false;
        
        // Convert delta to seconds for behaviors
        const dt = delta / 1000;
        
        // Removed excessive debug logging
        
        // Get current behavior function
        const behaviorFn = BEHAVIORS[this.state];
        if (!behaviorFn) {
            DebugLogger.warn('enemy', `[EnemyBehaviors] Unknown state: ${this.state}`);
            this.state = 'idle';
            return;
        }
        
        // Create capability interface
        const capability = this.createCapability();
        
        // Create setState callback with guards
        const setState = (nextState, opts = {}) => {
            // Guards
            if (!nextState || nextState === this.state) {
                return;
            }
            if (this.stateChangeThisFrame) {
                return;  // Re-entry guard
            }
            if (!this.canSwitch()) {
                return;          // Timing guards
            }
            
            // Optional sticky time for new state
            if (opts.stickyMs) {
                this.mem.stickyUntil = now + opts.stickyMs;
            }
            
            // Perform transition (log only important transitions)
            if (this.state !== nextState) {
                DebugLogger.info('enemy', `[AI] ${this.enemy.blueprintId}: ${this.state}→${nextState}`);
            }
            this.transitionTo(nextState);
            this.stateChangeThisFrame = true;
        };
        
        // Execute behavior with memory and setState
        try {
            // Pass state-specific config and current time
            const stateConfig = this.config[this.state] || {};
            // Add time to capability for behaviors to use
            capability.now = now;
            behaviorFn(capability, stateConfig, dt, this.mem, setState);
        } catch (error) {
            DebugLogger.error('enemy', `[EnemyBehaviors] Error in ${this.state} behavior:`, error);
            this.state = 'idle';
        }
        
        // Stuck detection for chase state
        if (this.state === 'chase') {
            this.detectStuck(delta);
        }
    }
    
    /**
     * Check if state switch is allowed
     */
    canSwitch() {
        // Get current time from scene
        const now = this.enemy.scene?.time?.now || Date.now();
        
        // Check minimum dwell time
        const minDwell = this.config[this.state]?.minDwellMs || this.config.minDwellMs;
        const dwellCheck = now - this.stateEnterAt >= minDwell;
        
        // Check re-entry cooldown
        const cooldownCheck = now >= this.canChangeStateAt;
        
        // Check sticky time
        const stickyCheck = now >= (this.mem.stickyUntil || 0);
        
        const result = dwellCheck && cooldownCheck && stickyCheck;
        
        // Removed excessive debug logging
        
        return result;
    }
    
    /**
     * Detect if enemy is stuck
     */
    detectStuck(delta) {
        if (!this.enemy.body) return;
        
        const vel = this.enemy.body.velocity;
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        const now = this.enemy.scene?.time?.now || Date.now();
        
        // Check if effectively not moving
        if (speed < 5) {
            if (!this.mem.stuck.since) {
                this.mem.stuck.since = now;
                this.mem.stuck.pos = { x: this.enemy.x, y: this.enemy.y };
            } else if (now - this.mem.stuck.since > 2000) {
                // Stuck for 2 seconds - nudge
                this.nudge();
                this.mem.stuck.since = now;
            }
        } else {
            // Moving - reset stuck detection
            this.mem.stuck.since = 0;
            this.mem.stuck.pos = null;
        }
    }
    
    /**
     * Nudge enemy when stuck
     */
    nudge() {
        const angle = Math.random() * Math.PI * 2;
        const force = 100;
        this.enemy.setVelocity(
            Math.cos(angle) * force,
            Math.sin(angle) * force
        );
    }
    
    /**
     * Create capability interface for behaviors
     */
    /**
     * Build the capability object once (called from constructor)
     */
    _buildCapability() {
        const self = this;
        const enemy = this.enemy;
        return {
            // Position
            getPos: () => enemy.getPos(),
            setVelocity: (vx, vy) => enemy.setVelocity(vx, vy),
            faceTo: (x, y) => enemy.faceTo(x, y),

            // Combat
            shoot: (pattern, opts) => enemy.shoot(pattern, opts),
            inRangeOfPlayer: (range) => enemy.inRangeOfPlayer(range),

            // Effects
            playSfx: (id, opts) => enemy.playSfx(id, opts),
            spawnVfx: (id, at, opts) => enemy.spawnVfx(id, at, opts),

            // Scheduling
            schedule: (fn, ms) => enemy.schedule(fn, ms),

            // State (read-only — setState is passed as 5th arg to behaviors with guards)
            getState: () => self.state,

            // References (mutable — refreshed before each frame via createCapability)
            scene: enemy.scene,
            damage: enemy.damage,
            speed: enemy.speed,
            spawnX: enemy.spawnX,
            spawnY: enemy.spawnY,

            // Time — set per-frame in createCapability()
            now: 0
        };
    }

    /**
     * Refresh mutable fields on cached capability (called each frame)
     */
    createCapability() {
        const cap = this._capability;
        cap.damage = this.enemy.damage;
        cap.speed = this.enemy.speed;
        cap.scene = this.enemy.scene;
        return cap;
    }
    
    /**
     * Transition to new state
     * @param {string} newState - Target state
     */
    transitionTo(newState) {
        // Check if transition is allowed
        const allowedTransitions = this.transitions[this.state];
        if (allowedTransitions && !allowedTransitions.includes(newState)) {
            DebugLogger.warn('enemy', `[EnemyBehaviors] Invalid transition: ${this.state} -> ${newState}`);
            return;
        }
        
        const oldState = this.state;
        const now = this.enemy.scene?.time?.now || Date.now();
        
        // Update state
        this.state = newState;
        this.stateEnterAt = now;
        this.lastStateChangeAt = now;
        this.canChangeStateAt = now + this.config.stateReentryCooldownMs;
        
        // Update combat flag
        if (newState === 'chase' || newState === 'shoot') {
            this.isInCombat = true;
        } else if (newState === 'idle' || newState === 'patrol') {
            this.isInCombat = false;
            this.target = null;
        }
        
        // Debug logging (only if enabled)
        if (this.enemy.scene?.configResolver?.get('debug.ai', { defaultValue: false })) {
            DebugLogger.info('enemy', `[EnemyBehaviors] State transition: ${oldState} -> ${newState}`);
        }
    }
    
    /**
     * Force behavior change
     * @param {string} behavior - New behavior
     */
    setBehavior(behavior) {
        if (BEHAVIORS[behavior]) {
            this.transitionTo(behavior);
        } else {
            DebugLogger.warn('enemy', `[EnemyBehaviors] Unknown behavior: ${behavior}`);
        }
    }
    
    /**
     * Reset timers after pause/resume
     * Called when scene resumes from pause
     */
    resetTimersAfterPause() {
        const now = this.enemy.scene?.time?.now || Date.now();
        const minDwell = this.config[this.state]?.minDwellMs || this.config.minDwellMs;
        
        // Reset state timing to prevent immediate transitions
        this.stateEnterAt = now;
        this.canChangeStateAt = now + minDwell;
        
        // Reset sticky time if it was set
        if (this.mem.stickyUntil > 0) {
            this.mem.stickyUntil = now + minDwell;
        }
        
        // Reset stuck detection
        this.mem.stuck.since = 0;
        this.mem.stuck.pos = null;
        
        DebugLogger.info('enemy', `[EnemyBehaviors] Timers reset after pause for ${this.enemy.blueprintId}`);
    }
    
    /**
     * Clean up
     */
    destroy() {
        this.enemy = null;
        this.target = null;
    }
}

export default EnemyBehaviors;