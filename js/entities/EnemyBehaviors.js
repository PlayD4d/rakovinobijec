/**
 * EnemyBehaviors.js - AI behavior router for enemies
 * 
 * Manages behavior state machine and delegates to behavior modules
 * No Phaser API calls - uses capability interface
 */

// Import behavior modules
import { idle } from './ai/behaviors/idle.js';
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

export class EnemyBehaviors {
    constructor(enemy) {
        // Store reference to enemy (provides capability interface)
        this.enemy = enemy;
        
        // Get initial behavior from blueprint
        const blueprint = enemy.blueprint || {};
        const aiConfig = blueprint.ai || {};
        
        // Initial state
        this.state = aiConfig.initialState || 'idle';
        this.config = aiConfig.params || {};
        
        // Behavior type from blueprint
        this.behaviorType = aiConfig.behavior || 'simple';
        
        // State machine config
        this.transitions = aiConfig.transitions || this.getDefaultTransitions();
        
        // Combat state
        this.isInCombat = false;
        this.target = null;
        
        // Timer for state changes
        this.stateTimer = 0;
        this.lastStateChange = 0;
        
        console.debug(`[EnemyBehaviors] Initialized ${this.behaviorType} AI in ${this.state} state`);
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
        
        // Convert delta to seconds for behaviors
        const dt = delta / 1000;
        
        // Get current behavior function
        const behaviorFn = BEHAVIORS[this.state];
        if (!behaviorFn) {
            console.warn(`[EnemyBehaviors] Unknown state: ${this.state}`);
            this.state = 'idle';
            return;
        }
        
        // Create capability interface
        const capability = this.createCapability();
        
        // Execute behavior
        try {
            const nextState = behaviorFn(capability, this.config, dt);
            
            // Handle state transition
            if (nextState && nextState !== this.state) {
                this.transitionTo(nextState);
            }
        } catch (error) {
            console.error(`[EnemyBehaviors] Error in ${this.state} behavior:`, error);
            this.state = 'idle';
        }
        
        // Update state timer
        this.stateTimer += delta;
    }
    
    /**
     * Create capability interface for behaviors
     */
    createCapability() {
        return {
            // Position
            getPos: () => this.enemy.getPos(),
            setVelocity: (vx, vy) => this.enemy.setVelocity(vx, vy),
            faceTo: (x, y) => this.enemy.faceTo(x, y),
            
            // Combat
            shoot: (pattern, opts) => this.enemy.shoot(pattern, opts),
            inRangeOfPlayer: (range) => this.enemy.inRangeOfPlayer(range),
            
            // Effects
            playSfx: (id, opts) => this.enemy.playSfx(id, opts),
            spawnVfx: (id, at, opts) => this.enemy.spawnVfx(id, at, opts),
            
            // Scheduling
            schedule: (fn, ms) => this.enemy.schedule(fn, ms),
            
            // State
            setState: (state) => this.transitionTo(state),
            getState: () => this.state,
            
            // References
            scene: this.enemy.scene,
            damage: this.enemy.damage,
            speed: this.enemy.speed,
            
            // Spawn position (for patrol)
            spawnX: this.enemy.spawnX,
            spawnY: this.enemy.spawnY
        };
    }
    
    /**
     * Transition to new state
     * @param {string} newState - Target state
     */
    transitionTo(newState) {
        // Check if transition is allowed
        const allowedTransitions = this.transitions[this.state];
        if (allowedTransitions && !allowedTransitions.includes(newState)) {
            console.warn(`[EnemyBehaviors] Invalid transition: ${this.state} -> ${newState}`);
            return;
        }
        
        const oldState = this.state;
        this.state = newState;
        this.stateTimer = 0;
        this.lastStateChange = Date.now();
        
        // Update combat flag
        if (newState === 'chase' || newState === 'shoot') {
            this.isInCombat = true;
        } else if (newState === 'idle' || newState === 'patrol') {
            this.isInCombat = false;
            this.target = null;
        }
        
        console.debug(`[EnemyBehaviors] State transition: ${oldState} -> ${newState}`);
    }
    
    /**
     * Force behavior change
     * @param {string} behavior - New behavior
     */
    setBehavior(behavior) {
        if (BEHAVIORS[behavior]) {
            this.transitionTo(behavior);
        } else {
            console.warn(`[EnemyBehaviors] Unknown behavior: ${behavior}`);
        }
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