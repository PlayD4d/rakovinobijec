/**
 * Enemy - Thin composer that combines EnemyCore and EnemyBehaviors
 * Provides the main Enemy API while delegating to specialized components
 */

import { EnemyCore } from './EnemyCore.js';
import { EnemyBehaviors } from './EnemyBehaviors.js';

export class Enemy extends EnemyCore {
    constructor(scene, x, y, type, config) {
        // Initialize core functionality
        super(scene, x, y, type, config);
        
        // Initialize AI behaviors
        this.behaviors = new EnemyBehaviors(this);
        
        // Emit spawn event
        this.scene.events.emit('enemy:spawn', { enemy: this, type: type });
        
        // Spawn effects
        this._playVfx(this.vfx.spawn, this.x, this.y);
        this._playSfx(this.sfx.spawn);
        
        console.debug(`[Enemy] Created ${type} with ${this.behaviors.behavior} AI`);
    }
    
    /**
     * Main update method - called by Phaser
     */
    update(time, delta) {
        if (this.isDead) return;
        
        // Update AI behaviors
        this.behaviors.update(time, delta);
        
        // Core state updates are handled in preUpdate
    }
    
    /**
     * Change AI behavior
     */
    setBehavior(behavior) {
        if (this.behaviors) {
            this.behaviors.setBehavior(behavior);
        }
    }
    
    /**
     * Get current behavior
     */
    getBehavior() {
        return this.behaviors ? this.behaviors.behavior : 'none';
    }
    
    /**
     * Force target for AI
     */
    setTarget(target) {
        if (this.behaviors) {
            this.behaviors.target = target;
            this.behaviors.isInCombat = !!target;
        }
    }
    
    /**
     * Get current target
     */
    getTarget() {
        return this.behaviors ? this.behaviors.target : null;
    }
    
    /**
     * Check if enemy is in combat
     */
    isInCombat() {
        return this.behaviors ? this.behaviors.isInCombat : false;
    }
    
    /**
     * Override cleanup to include behaviors
     */
    cleanup() {
        if (this.behaviors) {
            this.behaviors.destroy();
            this.behaviors = null;
        }
        
        // Call parent cleanup
        super.cleanup();
    }
}

export default Enemy;