/**
 * BossPhases - Systém pro správu boss fází
 * 
 * Spravuje přechody mezi fázemi na základě HP prahů a jiných podmínek.
 * Implementuje phase transition logiku odděleně od core boss třídy.
 */
import { DebugLogger } from '../../core/debug/DebugLogger.js';
import { getSession } from '../../core/debug/SessionLog.js';
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
        
        // Activate persistent passive auras from mechanics.passiveAuras
        this._activeAuras = [];
        const passiveAuras = bossCore.blueprint?.mechanics?.passiveAuras;
        if (passiveAuras) {
            for (const aura of passiveAuras) {
                this._activatePassiveAura(aura);
            }
        }

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
                    // Phase 0 is already active at spawn — mark as triggered to prevent spurious re-trigger
                    triggered: index === 0
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
        if (!this.boss || this.isTransitioning) return;

        // Update persistent aura visuals (follow boss, pulse)
        if (this._activeAuras.length > 0) {
            this._updatePassiveAuras(time);
        }

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
        getSession()?.log('boss', 'phase_transition', { bossId: this.boss?.blueprintId, fromPhase: this.currentPhase, toPhase: newPhase, bossHP: this.boss?.hp });

        this.isTransitioning = true;
        
        // Pre-transition effects
        this.executePreTransitionEffects(newPhase);
        
        // Update boss phase
        this.boss.transitionToPhase(newPhase);
        this.currentPhase = newPhase;
        
        // Post-transition effects — use tracked timer via BossAbilities
        const schedule = this.boss?.abilitiesSystem?._schedule?.bind(this.boss.abilitiesSystem);
        if (schedule) {
            schedule(500, () => {
                if (!this.boss || !this.scene) return;
                this.executePostTransitionEffects(newPhase);
                this.isTransitioning = false;
            });
        } else if (this.scene?.time) {
            // Tracked fallback timer — cancelled in cleanup()
            this._transitionTimer = this.scene.time.delayedCall(500, () => {
                this._transitionTimer = null;
                if (!this.boss || !this.scene) return;
                this.executePostTransitionEffects(newPhase);
                this.isTransitioning = false;
            });
        }
        
        // Execute registered callbacks
        this.executeTransitionCallbacks(newPhase);
    }
    
    /**
     * Efekty před přechodem fáze
     */
    executePreTransitionEffects(newPhase) {
        const phaseData = this.phaseData[newPhase];
        if (!phaseData) return;
        
        // Screen shake via scene interface
        if (this.scene.shakeCamera) {
            this.scene.shakeCamera(300, 0.02);
        }
        
        // Boss invulnerability during transition
        if (this.boss.setInvulnerable) {
            this.boss.setInvulnerable(true);
        }
        
        // Phase transition VFX — dramatic telegraph + explosion
        const vfx = this.scene?.vfxSystem;
        if (vfx?.playTelegraph) {
            vfx.playTelegraph(this.boss.x, this.boss.y, {
                radius: 100, color: 0xFF0000, duration: 400, fillAlpha: 0.2, pulses: 2
            });
        }
        if (vfx?.playExplosionEffect) {
            vfx.playExplosionEffect(this.boss.x, this.boss.y, { color: 0xFF4400, radius: 80, duration: 300 });
        }
        
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
        if (this.boss?.abilityCooldowns) this.boss.abilityCooldowns.clear();
        
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
                this._activatePassiveAura(auraType);
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
     * Activate a persistent passive aura — visual + damage ticks
     * @param {object} auraConfig - { type, radius, damage, tickInterval, slowEffect }
     */
    _activatePassiveAura(auraConfig) {
        const type = auraConfig.type || auraConfig;
        const radius = auraConfig.radius || 64;
        const damage = auraConfig.damage || 1;
        const tickInterval = auraConfig.tickInterval || 1500;
        const boss = this.boss;
        const scene = this.scene;

        DebugLogger.info('boss', `[BossPhases] Activating passive aura: ${type}, radius=${radius}`);

        if (type === 'radiation_field') {
            // Persistent radioactive green/yellow circle — Chernobyl style
            const gf = scene.graphicsFactory;
            if (gf) {
                const g = gf.create();
                g.clear();
                g.setAlpha(1);
                g.setScale(1);
                g.setPosition(boss.x, boss.y);
                g.setDepth((scene.DEPTH_LAYERS?.ENEMIES || 1000) - 2);

                this._activeAuras.push({ type, graphics: g, radius });

                // Damage tick timer
                const timer = scene.time.addEvent({
                    delay: tickInterval,
                    loop: true,
                    callback: () => {
                        if (!boss?.active) return;
                        const player = scene.player;
                        if (!player?.active) return;
                        const dx = player.x - boss.x;
                        const dy = player.y - boss.y;
                        if (dx * dx + dy * dy <= radius * radius) {
                            player.takeDamage(damage, 'radiation_field');
                        }
                    }
                });
                this._activeAuras[this._activeAuras.length - 1].timer = timer;
            }
        } else if (type === 'damage_boost') {
            if (boss.setTint) boss.setTint(0xFF4444);
        }
    }

    /**
     * Update passive aura visuals — follow boss position, pulsing glow
     */
    _updatePassiveAuras(time) {
        for (const aura of this._activeAuras) {
            if (!aura.graphics?.scene) continue;
            const g = aura.graphics;
            g.setPosition(this.boss.x, this.boss.y);

            g.clear();
            // Slow pulse (~1 per second)
            const pulse = 0.5 + 0.5 * Math.sin(time * 0.003);

            // Radioactive glow — yellow-green fill
            g.fillStyle(0x88CC00, 0.04 + pulse * 0.06);
            g.fillCircle(0, 0, aura.radius);

            // Border ring
            g.lineStyle(1.5, 0xAADD00, 0.2 + pulse * 0.2);
            g.strokeCircle(0, 0, aura.radius);
        }
    }

    /**
     * Clean up passive auras on boss death
     */
    _destroyPassiveAuras() {
        const gf = this.scene?.graphicsFactory;
        for (const aura of this._activeAuras) {
            if (aura.timer) aura.timer.destroy();
            if (aura.graphics?.scene) {
                if (gf) gf.release(aura.graphics); else aura.graphics.destroy();
            }
        }
        this._activeAuras.length = 0;
    }
    
    /**
     * Aktivuje speciální chování
     */
    activateSpecialBehavior(behavior) {
        DebugLogger.info('boss', `[BossPhases] Activating special behavior: ${behavior}`);

        // Save original speed on first activation to prevent double-multiply
        if (this._originalMoveSpeed == null) {
            this._originalMoveSpeed = this.boss.moveSpeed;
        }

        switch (behavior) {
            case 'berserker':
                this.boss.moveSpeed = this._originalMoveSpeed * 1.5;
                this.boss.setTint(0xFF0000);
                break;
            case 'defensive':
                this.boss.moveSpeed = this._originalMoveSpeed * 0.7;
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
        // Execute phase-specific callbacks
        const phaseCallbacks = this.transitionCallbacks.get(phase);
        if (phaseCallbacks) {
            phaseCallbacks.forEach(cb => {
                try { cb(phase, this.boss); }
                catch (e) { DebugLogger.error('boss', `[BossPhases] Phase callback error (phase ${phase}):`, e); }
            });
        }
        // Execute 'all' callbacks (registered for every phase transition)
        const allCallbacks = this.transitionCallbacks.get('all');
        if (allCallbacks) {
            allCallbacks.forEach(cb => {
                try { cb(phase, this.boss); }
                catch (e) { DebugLogger.error('boss', `[BossPhases] All-phase callback error:`, e); }
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
        // Clean up persistent passive auras
        this._destroyPassiveAuras();
        // Cancel any pending transition timer
        if (this._transitionTimer) {
            this._transitionTimer.destroy();
            this._transitionTimer = null;
        }
        this.transitionCallbacks.clear();
        this.hpThresholds = [];
        this.boss = null;
        this.scene = null;
        
        DebugLogger.info('boss', '[BossPhases] Cleanup completed');
    }
}