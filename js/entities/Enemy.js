/**
 * Enemy - Thin composer that combines EnemyCore and EnemyBehaviors
 * Provides the main Enemy API while delegating to specialized components
 */

import { EnemyCore } from './core/EnemyCore.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
import { EnemyBehaviors } from './EnemyBehaviors.js';

export class Enemy extends EnemyCore {
    constructor(scene, blueprint, spawnOpts) {
        // Initialize core functionality
        super(scene, blueprint, spawnOpts);
        
        // Initialize AI behaviors
        this.behaviors = new EnemyBehaviors(this);
        
        // Spawn effects (SFX only, no spark VFX)
        this.playSfx('spawn');
        
        DebugLogger.info('enemy', `[Enemy] Created ${blueprint.id} with ${this.behaviors.behaviorType} AI`);
    }
    
    /**
     * Main update method - called by Phaser
     */
    update(time, delta) {
        if (!this.active || this.hp <= 0) return;
        
        // Update AI behaviors
        if (this.behaviors) {
            this.behaviors.update(time, delta);
        }
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

