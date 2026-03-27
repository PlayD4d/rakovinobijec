import { EnemyCore } from '../core/EnemyCore.js';
import { DebugLogger } from '../../core/debug/DebugLogger.js';

/**
 * BossCore - Phaser integrace pro boss entity s capability interface
 * 
 * Poskytuje capability methods pro boss-specific operace.
 * Rozšiřuje EnemyCore o boss funkcionalitu zachovávající PR7 principy.
 * 
 * @extends EnemyCore
 */
export class BossCore extends EnemyCore {
    constructor(scene, blueprint, options = {}) {
        super(scene, blueprint, options);
        
        // Boss-specific state
        this.currentPhase = 0;
        // BUGFIX: Správné cesty k blueprint datům - mechanics.phases a mechanics.abilities
        this.phaseData = blueprint.mechanics?.phases || [];
        this.abilities = blueprint.mechanics?.abilities || {};
        this.abilityCooldowns = new Map();
        
        // Movement state
        this.isDashing = false;
        this.originalSpeed = this.moveSpeed;
        
        // Debug info
        DebugLogger.info('boss', `[BossCore] Initialized boss: ${blueprint.id}`);
    }
    
    // ===============================
    // BOSS CAPABILITY INTERFACE
    // ===============================
    
    /**
     * Získá aktuální fázi bosse
     * @returns {number} Číslo aktuální fáze (0-based)
     */
    getCurrentPhase() {
        return this.currentPhase;
    }
    
    /**
     * Získá poměr aktuálního HP (0.0 - 1.0)
     * @returns {number} HP ratio
     */
    getHpRatio() {
        return this.maxHp > 0 ? this.hp / this.maxHp : 0;
    }
    
    /**
     * Zkontroluje, zda je schopnost připravena k použití
     * @param {string} abilityId ID schopnosti
     * @returns {boolean} True pokud je schopnost ready
     */
    isAbilityReady(abilityId) {
        const cooldownEnd = this.abilityCooldowns.get(abilityId) || 0;
        const now = this.scene?.time?.now || Date.now();
        return now >= cooldownEnd;
    }
    
    /**
     * Nastaví cooldown pro schopnost
     * @param {string} abilityId ID schopnosti
     * @param {number} cooldownMs Cooldown v milisekundách
     */
    setAbilityCooldown(abilityId, cooldownMs) {
        const now = this.scene?.time?.now || Date.now();
        this.abilityCooldowns.set(abilityId, now + cooldownMs);
    }
    
    /**
     * Získá data o schopnosti
     * @param {string} abilityId ID schopnosti
     * @returns {object|null} Ability data nebo null
     */
    getAbilityData(abilityId) {
        return this.abilities[abilityId] || null;
    }
    
    /**
     * Získá data aktuální fáze
     * @returns {object|null} Phase data nebo null
     */
    getCurrentPhaseData() {
        return this.phaseData[this.currentPhase] || null;
    }
    
    /**
     * Přepne na následující fázi
     * @param {number} newPhase Nové číslo fáze
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
     * Získá seznam dostupných schopností pro aktuální fázi
     * @returns {string[]} Array ability IDs
     */
    getAvailableAbilities() {
        const phaseData = this.getCurrentPhaseData();
        return phaseData?.abilities || [];
    }
    
    /**
     * Capability pro spawn minions - deleguje na EnemyManager
     * @param {number} count Počet minionů
     * @param {string} enemyType Typ nepřítele
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
     * Capability pro dash movement - deleguje na VFXSystem pro animaci
     * @param {number} targetX Cílová X pozice
     * @param {number} targetY Cílová Y pozice
     * @param {number} duration Délka dashe v ms
     * @param {function} onComplete Callback po dokončení
     */
    dashTo(targetX, targetY, duration = 500, onComplete = null) {
        if (this.isDashing) return; // Prevent multiple dashes
        
        this.isDashing = true;
        const oldSpeed = this.moveSpeed;
        this.moveSpeed = 0; // Stop normal movement
        
        // Deleguje na VFXSystem místo přímého tweens volání
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
     * Capability pro teleport - okamžitý přesun
     * @param {number} targetX Cílová X pozice
     * @param {number} targetY Cílová Y pozice
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
     * Override pro boss-specific cleanup
     */
    cleanup() {
        // Clear ability cooldowns
        this.abilityCooldowns.clear();
        
        // Call parent cleanup
        super.cleanup();
        
        DebugLogger.info('boss', '[BossCore] Boss cleanup completed');
    }
}