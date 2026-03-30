import { EnemyCore } from '../core/EnemyCore.js';
import { DebugLogger } from '../../core/debug/DebugLogger.js';

/**
 * BossCore - Phaser integration for boss entity with capability interface
 *
 * Provides capability methods for boss-specific operations.
 * Extends EnemyCore with boss functionality preserving PR7 principles.
 *
 * @extends EnemyCore
 */
export class BossCore extends EnemyCore {
    constructor(scene, blueprint, options = {}) {
        super(scene, blueprint, options);
        
        // Boss-specific state
        this.currentPhase = 0;
        // BUGFIX: Correct paths to blueprint data - mechanics.phases and mechanics.abilities
        this.phaseData = blueprint.mechanics?.phases || [];
        this.abilities = blueprint.mechanics?.abilities || {};
        this.abilityCooldowns = new Map();
        
        // Movement state
        this.isDashing = false;
        this.moveSpeed = blueprint.stats?.speed || 50;
        this.originalSpeed = this.moveSpeed;
        
        // Debug info
        DebugLogger.info('boss', `[BossCore] Initialized boss: ${blueprint.id}`);
    }
    
    // ===============================
    // BOSS CAPABILITY INTERFACE
    // ===============================
    
    /**
     * Get the current boss phase
     * @returns {number} Current phase number (0-based)
     */
    getCurrentPhase() {
        return this.currentPhase;
    }
    
    /**
     * Get the current HP ratio (0.0 - 1.0)
     * @returns {number} HP ratio
     */
    getHpRatio() {
        return this.maxHp > 0 ? this.hp / this.maxHp : 0;
    }
    
    /**
     * Check if an ability is ready to use
     * @param {string} abilityId Ability ID
     * @returns {boolean} True if the ability is ready
     */
    isAbilityReady(abilityId) {
        const cooldownEnd = this.abilityCooldowns.get(abilityId) || 0;
        const now = this.scene?.time?.now;
        if (now == null) return false; // Scene time truly unavailable
        return now >= cooldownEnd;
    }

    /**
     * Set cooldown for an ability
     * @param {string} abilityId Ability ID
     * @param {number} cooldownMs Cooldown in milliseconds
     */
    setAbilityCooldown(abilityId, cooldownMs) {
        const now = this.scene?.time?.now;
        if (now == null) return; // Scene time truly unavailable (time=0 is valid)
        this.abilityCooldowns.set(abilityId, now + cooldownMs);
    }
    
    /**
     * Get ability data
     * @param {string} abilityId Ability ID
     * @returns {object|null} Ability data or null
     */
    getAbilityData(abilityId) {
        return this.abilities[abilityId] || null;
    }
    
    /**
     * Get current phase data
     * @returns {object|null} Phase data or null
     */
    getCurrentPhaseData() {
        return this.phaseData[this.currentPhase] || null;
    }
    
    /**
     * Transition to a new phase
     * @param {number} newPhase New phase number
     */
    transitionToPhase(newPhase) {
        if (newPhase >= 0 && newPhase < this.phaseData.length) {
            const oldPhase = this.currentPhase;
            this.currentPhase = newPhase;
            DebugLogger.info('boss', `[BossCore] Phase transition: ${oldPhase} -> ${newPhase}`);
            
            // Emit event for phase change
            this.scene.events.emit('boss:phase-change', {
                boss: this,
                oldPhase,
                newPhase,
                phaseData: this.getCurrentPhaseData()
            });
        }
    }
    
    /**
     * Get the list of available abilities for the current phase
     * @returns {string[]} Array ability IDs
     */
    getAvailableAbilities() {
        const phaseData = this.getCurrentPhaseData();
        return phaseData?.abilities || [];
    }
    
    /**
     * Capability for spawning minions - delegates to EnemyManager
     * @param {number} count Number of minions
     * @param {string} enemyType Enemy type
     * @param {object} options Spawn options
     */
    spawnMinions(count, enemyType, options = {}) {
        if (this.scene.enemyManager) {
            const spawnOptions = {
                x: this.x,
                y: this.y,
                spawnRadius: options.radius || 100,
                ...options
            };
            
            for (let i = 0; i < count; i++) {
                this.scene.enemyManager.spawnEnemy(enemyType, spawnOptions);
            }
            
            DebugLogger.info('boss', `[BossCore] Spawned ${count} minions: ${enemyType}`);
        }
    }
    
    /**
     * Capability for dash movement - delegates to VFXSystem for animation
     * @param {number} targetX Target X position
     * @param {number} targetY Target Y position
     * @param {number} duration Dash duration in ms
     * @param {function} onComplete Callback on completion
     */
    dashTo(targetX, targetY, duration = 500, onComplete = null) {
        if (this.isDashing) return; // Prevent multiple dashes
        
        this.isDashing = true;
        const oldSpeed = this.moveSpeed;
        this.moveSpeed = 0; // Stop normal movement
        
        // Delegates to VFXSystem instead of direct tweens call
        if (this.scene.vfxSystem && this.scene.vfxSystem.animateMovement) {
            this.scene.vfxSystem.animateMovement(this, {
                to: { x: targetX, y: targetY },
                duration: duration,
                ease: 'Power2.easeOut',
                onComplete: () => {
                    this.isDashing = false;
                    this.moveSpeed = oldSpeed;
                    
                    // Boss dash VFX
                    this.spawnVfx('vfx.boss.dash.impact', targetX, targetY);
                    
                    if (onComplete) onComplete();
                    
                    // Debug callback
                    this.scene.frameworkDebug?.onBossDash?.(this);
                }
            });
        } else {
            // Fallback - direct position change if VFX system unavailable
            this.setPosition(targetX, targetY);
            this.isDashing = false;
            this.moveSpeed = oldSpeed;
            if (onComplete) onComplete();
        }
    }
    
    /**
     * Capability for teleport - instant relocation
     * @param {number} targetX Target X position
     * @param {number} targetY Target Y position
     */
    teleportTo(targetX, targetY) {
        // Teleport out effect
        this.spawnVfx('vfx.boss.teleport.out', this.x, this.y);
        
        // Move
        this.setPosition(targetX, targetY);
        
        // Teleport in effect
        this.spawnVfx('vfx.boss.teleport.in', targetX, targetY);
        
        DebugLogger.info('boss', `[BossCore] Teleported to (${targetX}, ${targetY}`);
    }
    
    /**
     * Set invulnerability state (used during phase transitions)
     */
    setInvulnerable(value) {
        this._invulnerable = !!value;
    }

    /**
     * Override for boss-specific cleanup
     */
    cleanup() {
        // Clear ability cooldowns
        this.abilityCooldowns.clear();
        
        // Call parent cleanup
        super.cleanup();
        
        DebugLogger.info('boss', '[BossCore] Boss cleanup completed');
    }
}