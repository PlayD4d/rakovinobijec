/**
 * BossPhases - Systém pro správu boss fází
 * 
 * Spravuje přechody mezi fázemi na základě HP prahů a jiných podmínek.
 * Implementuje phase transition logiku odděleně od core boss třídy.
 */
import { DebugLogger } from '../../core/debug/DebugLogger.js';
export class BossPhases {
    constructor(bossCore) {
        this.boss = bossCore;
        this.scene = bossCore.scene;
        
        // Phase configuration from blueprint
        this.phaseData = bossCore.phaseData || [];
        this.currentPhase = 0;
        this.lastHpRatio = 1.0;
        
        // Phase transition state
        this.isTransitioning = false;
        this.transitionCallbacks = new Map();
        
        // HP thresholds for phase changes (sorted descending)
        this.hpThresholds = this.calculateHpThresholds();
        
        DebugLogger.info('boss', `[BossPhases] Initialized with ${this.phaseData.length} phases`);
        DebugLogger.info('boss', `[BossPhases] HP thresholds:`, this.hpThresholds);
    }
    
    /**
     * Vypočítá HP prahy pro všechny fáze
     */
    calculateHpThresholds() {
        const thresholds = [];
        
        this.phaseData.forEach((phase, index) => {
            // BUGFIX: Blueprint používá thresholdPct místo hpThreshold
            const threshold = phase.hpThreshold || phase.thresholdPct;
            if (threshold !== undefined) {
                thresholds.push({
                    phase: index,
                    hpRatio: threshold,
                    triggered: index === 0 // First phase is already active
                });
            }
        });
        
        // Seřadit podle HP ratio (descending)
        return thresholds.sort((a, b) => b.hpRatio - a.hpRatio);
    }
    
    /**
     * Update method - kontroluje HP a spouští phase transitions
     */
    update(time, delta) {
        if (this.isTransitioning) return;
        
        const currentHpRatio = this.boss.getHpRatio();
        
        // Kontrola phase transitions při snížení HP
        if (currentHpRatio < this.lastHpRatio) {
            this.checkPhaseTransition(currentHpRatio);
        }
        
        this.lastHpRatio = currentHpRatio;
    }
    
    /**
     * Zkontroluje, zda by mělo dojít k phase transition
     */
    checkPhaseTransition(currentHpRatio) {
        for (const threshold of this.hpThresholds) {
            if (!threshold.triggered && currentHpRatio <= threshold.hpRatio) {
                this.triggerPhaseTransition(threshold.phase);
                threshold.triggered = true;
                break; // Only one transition at a time
            }
        }
    }
    
    /**
     * Spustí přechod na novou fázi
     */
    triggerPhaseTransition(newPhase) {
        if (newPhase === this.currentPhase || this.isTransitioning) return;
        
        DebugLogger.info('boss', `[BossPhases] Triggering transition: ${this.currentPhase} -> ${newPhase}`);
        
        this.isTransitioning = true;
        
        // Pre-transition effects
        this.executePreTransitionEffects(newPhase);
        
        // Update boss phase
        this.boss.transitionToPhase(newPhase);
        this.currentPhase = newPhase;
        
        // Post-transition effects (guarded against boss death during delay)
        this.scene?.time?.delayedCall(500, () => {
            if (!this.boss || !this.scene) return;
            this.executePostTransitionEffects(newPhase);
            this.isTransitioning = false;
        });
        
        // Execute registered callbacks
        this.executeTransitionCallbacks(newPhase);
    }
    
    /**
     * Efekty před přechodem fáze
     */
    executePreTransitionEffects(newPhase) {
        const phaseData = this.phaseData[newPhase];
        if (!phaseData) return;
        
        // Screen shake při phase transition
        if (this.scene.cameras && this.scene.cameras.main) {
            this.scene.cameras.main.shake(300, 0.02);
        }
        
        // Boss invulnerability during transition
        if (this.boss.setInvulnerable) {
            this.boss.setInvulnerable(true);
        }
        
        // Phase transition VFX
        this.boss.spawnVfx('vfx.boss.phase.transition', this.boss.x, this.boss.y);
        
        // Phase transition SFX
        this.boss.playSfx('sfx.boss.phase.change');
        
        DebugLogger.info('boss', `[BossPhases] Pre-transition effects for phase ${newPhase}`);
    }
    
    /**
     * Efekty po přechodu fáze
     */
    executePostTransitionEffects(newPhase) {
        const phaseData = this.phaseData[newPhase];
        if (!phaseData) return;
        
        // Remove invulnerability
        if (this.boss.setInvulnerable) {
            this.boss.setInvulnerable(false);
        }
        
        // Update boss stats based on phase
        this.applyPhaseModifiers(phaseData);
        
        // Clear ability cooldowns for fresh start
        this.boss.abilityCooldowns.clear();
        
        // Spawn minions if specified
        if (phaseData.spawnMinions) {
            const { count, type } = phaseData.spawnMinions;
            this.boss.spawnMinions(count, type);
        }
        
        // Phase-specific effects
        this.applyPhaseSpecificEffects(phaseData);
        
        DebugLogger.info('boss', `[BossPhases] Post-transition effects for phase ${newPhase} completed`);
    }
    
    /**
     * Aplikuje modifikátory pro danou fázi
     */
    applyPhaseModifiers(phaseData) {
        if (phaseData.modifiers) {
            const { speedMultiplier, damageMultiplier, attackRateMultiplier } = phaseData.modifiers;
            
            if (speedMultiplier) {
                this.boss.moveSpeed = this.boss.originalSpeed * speedMultiplier;
            }
            
            if (damageMultiplier) {
                this.boss.damageMultiplier = damageMultiplier;
            }
            
            if (attackRateMultiplier) {
                this.boss.attackRateMultiplier = attackRateMultiplier;
            }
            
            DebugLogger.info('boss', `[BossPhases] Applied phase modifiers:`, phaseData.modifiers);
        }
    }
    
    /**
     * Aplikuje specifické efekty pro fázi
     */
    applyPhaseSpecificEffects(phaseData) {
        // Passive auras
        if (phaseData.passiveAuras) {
            phaseData.passiveAuras.forEach(auraType => {
                this.activatePassiveAura(auraType);
            });
        }
        
        // Special behaviors
        if (phaseData.specialBehaviors) {
            phaseData.specialBehaviors.forEach(behavior => {
                this.activateSpecialBehavior(behavior);
            });
        }
    }
    
    /**
     * Aktivuje pasivní auru
     */
    activatePassiveAura(auraType) {
        DebugLogger.info('boss', `[BossPhases] Activating passive aura: ${auraType}`);
        
        switch (auraType) {
            case 'radiation_field':
                this.boss.spawnVfx('vfx.boss.aura.radiation', this.boss.x, this.boss.y);
                break;
            case 'healing_disruption':
                this.boss.spawnVfx('vfx.boss.aura.healing_disrupt', this.boss.x, this.boss.y);
                break;
            case 'damage_boost':
                // Visual indicator for damage boost
                this.boss.setTint(0xFF4444);
                break;
        }
    }
    
    /**
     * Aktivuje speciální chování
     */
    activateSpecialBehavior(behavior) {
        DebugLogger.info('boss', `[BossPhases] Activating special behavior: ${behavior}`);
        
        switch (behavior) {
            case 'berserker':
                this.boss.moveSpeed *= 1.5;
                this.boss.setTint(0xFF0000);
                break;
            case 'defensive':
                this.boss.moveSpeed *= 0.7;
                this.boss.setTint(0x4444FF);
                break;
        }
    }
    
    /**
     * Registruje callback pro phase transition
     */
    onPhaseTransition(phase, callback) {
        if (!this.transitionCallbacks.has(phase)) {
            this.transitionCallbacks.set(phase, []);
        }
        this.transitionCallbacks.get(phase).push(callback);
    }
    
    /**
     * Vykoná registrované callbacks pro fázi
     */
    executeTransitionCallbacks(phase) {
        const callbacks = this.transitionCallbacks.get(phase);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(phase, this.boss);
                } catch (error) {
                    DebugLogger.error('boss', `[BossPhases] Callback error for phase ${phase}:`, error);
                }
            });
        }
    }
    
    /**
     * Získá dostupné schopnosti pro aktuální fázi
     */
    getCurrentPhaseAbilities() {
        const phaseData = this.phaseData[this.currentPhase];
        return phaseData?.abilities || [];
    }
    
    /**
     * Zkontroluje, zda je schopnost dostupná v aktuální fázi
     */
    isAbilityAvailableInCurrentPhase(abilityId) {
        const abilities = this.getCurrentPhaseAbilities();
        return abilities.includes(abilityId);
    }
    
    /**
     * Získá číslo aktuální fáze
     * @returns {number} Current phase number
     */
    getCurrentPhase() {
        return this.currentPhase;
    }
    
    /**
     * Získá data pro specifickou fázi
     * @param {number} phase - Phase number
     * @returns {object|null} Phase data or null
     */
    getPhaseData(phase) {
        return this.phaseData[phase] || null;
    }
    
    /**
     * Získá data pro aktuální fázi
     * @returns {object|null} Current phase data or null
     */
    getCurrentPhaseData() {
        return this.getPhaseData(this.currentPhase);
    }
    
    /**
     * Manuální přechod na fázi (pro testing nebo speciální případy)
     */
    forcePhaseTransition(newPhase) {
        if (newPhase >= 0 && newPhase < this.phaseData.length) {
            this.triggerPhaseTransition(newPhase);
        }
    }
    
    /**
     * Cleanup při odstranění bosse
     */
    cleanup() {
        this.isTransitioning = false;
        this.transitionCallbacks.clear();
        this.hpThresholds = [];
        this.boss = null;
        this.scene = null;
        
        DebugLogger.info('boss', '[BossPhases] Cleanup completed');
    }
}