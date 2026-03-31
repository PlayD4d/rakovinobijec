/**
 * BossPhases - Boss phase management system
 *
 * Manages transitions between phases based on HP thresholds and other conditions.
 * Implements phase transition logic separately from the core boss class.
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
     * Calculate HP thresholds for all phases
     */
    calculateHpThresholds() {
        const thresholds = [];
        
        this.phaseData.forEach((phase, index) => {
            // Support all threshold field name variants used across blueprints
            const threshold = phase.hpThreshold ?? phase.thresholdPct ?? phase.threshold;
            if (threshold !== undefined) {
                thresholds.push({
                    phase: index,
                    hpRatio: threshold,
                    // Phase 0 is already active at spawn — mark as triggered to prevent spurious re-trigger
                    triggered: index === 0
                });
            }
        });
        
        // Sort by HP ratio (descending)
        return thresholds.sort((a, b) => b.hpRatio - a.hpRatio);
    }
    
    /**
     * Update method - checks HP and triggers phase transitions
     */
    update(time, delta) {
        if (!this.boss || this.isTransitioning) return;

        // Update persistent aura visuals (follow boss, pulse)
        if (this._activeAuras.length > 0) {
            this._updatePassiveAuras(time);
        }

        const currentHpRatio = this.boss.getHpRatio();
        
        // Check phase transitions on HP decrease
        if (currentHpRatio < this.lastHpRatio) {
            this.checkPhaseTransition(currentHpRatio);
        }
        
        this.lastHpRatio = currentHpRatio;
    }
    
    /**
     * Check if a phase transition should occur
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
     * Trigger transition to a new phase
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
     * Pre-transition phase effects
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
     * Post-transition phase effects
     */
    executePostTransitionEffects(newPhase) {
        const phaseData = this.phaseData[newPhase];
        if (!phaseData) return;
        
        // Remove invulnerability
        if (this.boss.setInvulnerable) {
            this.boss.setInvulnerable(false);
        }

        // If boss reached 0 HP during invulnerability, kill it now
        if (this.boss?.hp <= 0 && this.boss?.active) {
            this.boss.die('phase_transition_death');
            return;
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
     * Apply modifiers for the given phase
     */
    applyPhaseModifiers(phaseData) {
        // Support both nested `modifiers: { speedMultiplier }` and flat `movementSpeed` fields
        const mods = phaseData.modifiers || {};
        const speedMul = mods.speedMultiplier || phaseData.movementSpeed || null;
        const damageMul = mods.damageMultiplier || phaseData.damageMultiplier || null;
        const attackRateMul = mods.attackRateMultiplier || phaseData.attackRateMultiplier || null;

        if (speedMul) {
            this.boss.moveSpeed = this.boss.originalSpeed * speedMul;
        }

        if (damageMul) {
            this.boss.damageMultiplier = damageMul;
        }

        if (attackRateMul) {
            this.boss.attackRateMultiplier = attackRateMul;
        }

        if (speedMul || damageMul || attackRateMul) {
            DebugLogger.info('boss', `[BossPhases] Applied phase modifiers: speed=${speedMul}, damage=${damageMul}, attackRate=${attackRateMul}`);
        }
    }
    
    /**
     * Apply phase-specific effects
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

        // Prevent duplicate auras of the same type
        if (this._activeAuras.some(a => a.type === type)) return;

        const radius = auraConfig.radius || 64;
        const damage = auraConfig.damage || 1;
        const tickInterval = auraConfig.tickInterval || 1500;
        const boss = this.boss;
        const scene = this.scene;

        DebugLogger.info('boss', `[BossPhases] Activating passive aura: ${type}, radius=${radius}`);

        if (type === 'radiation_field') {
            // Bake aura circle into a texture once, then use a Sprite for per-frame updates
            // (avoids expensive Graphics.clear()+redraw every frame)
            const textureKey = `_aura_radiation_${radius}`;
            if (!scene.textures.exists(textureKey)) {
                const gf = scene.graphicsFactory;
                if (!gf) return;
                const g = gf.create();
                g.clear();
                g.fillStyle(0x88CC00, 0.08);
                g.fillCircle(radius, radius, radius);
                g.lineStyle(1.5, 0xAADD00, 0.35);
                g.strokeCircle(radius, radius, radius);
                g.generateTexture(textureKey, radius * 2, radius * 2);
                gf.release(g);
            }

            const sprite = scene.add.sprite(boss.x, boss.y, textureKey);
            sprite.setDepth((scene.DEPTH_LAYERS?.ENEMIES || 1000) - 2);
            sprite.setOrigin(0.5);

            // Pulse alpha via tween (zero-GC per frame)
            const pulseTween = scene.tweens.add({
                targets: sprite,
                alpha: { from: 0.5, to: 1 },
                duration: 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this._activeAuras.push({ type, sprite, pulseTween, radius });

            // Damage tick timer
            const timer = scene.time.addEvent({
                delay: tickInterval,
                loop: true,
                callback: () => {
                    if (!this.boss?.active || !this.scene) {
                        const auraEntry = this._activeAuras?.find(a => a.type === type);
                        auraEntry?.timer?.remove();
                        return;
                    }
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
        } else if (type === 'damage_boost') {
            if (boss.setTint) boss.setTint(0xFF4444);
        }
    }

    /**
     * Update passive aura visuals — follow boss position, pulsing glow
     */
    _updatePassiveAuras(time) {
        for (const aura of this._activeAuras) {
            // Sprite-based aura: just follow boss position (pulse via tween, no redraw)
            if (aura.sprite?.scene) {
                aura.sprite.setPosition(this.boss.x, this.boss.y);
            }
        }
    }

    /**
     * Clean up passive auras on boss death
     */
    _destroyPassiveAuras() {
        for (const aura of this._activeAuras) {
            if (aura.timer) aura.timer.remove();
            if (aura.pulseTween) aura.pulseTween.stop();
            if (aura.sprite?.scene) aura.sprite.destroy();
            // Legacy Graphics-based aura cleanup
            if (aura.graphics?.scene) {
                const gf = this.scene?.graphicsFactory;
                if (gf) gf.release(aura.graphics); else aura.graphics.destroy();
            }
        }
        this._activeAuras.length = 0;
    }
    
    /**
     * Activate special behavior
     */
    activateSpecialBehavior(behavior) {
        DebugLogger.info('boss', `[BossPhases] Activating special behavior: ${behavior}`);

        // Use BossCore's originalSpeed as the canonical baseline
        const baseSpeed = this.boss.originalSpeed ?? this.boss.moveSpeed;

        switch (behavior) {
            case 'berserker':
                this.boss.moveSpeed = baseSpeed * 1.5;
                this.boss.setTint(0xFF0000);
                break;
            case 'defensive':
                this.boss.moveSpeed = baseSpeed * 0.7;
                this.boss.setTint(0x4444FF);
                break;
        }
    }
    
    /**
     * Register a callback for phase transition
     */
    onPhaseTransition(phase, callback) {
        if (!this.transitionCallbacks.has(phase)) {
            this.transitionCallbacks.set(phase, []);
        }
        this.transitionCallbacks.get(phase).push(callback);
    }
    
    /**
     * Execute registered callbacks for a phase
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
     * Get available abilities for the current phase
     */
    getCurrentPhaseAbilities() {
        const phaseData = this.phaseData[this.currentPhase];
        return phaseData?.abilities || [];
    }
    
    /**
     * Check if an ability is available in the current phase
     */
    isAbilityAvailableInCurrentPhase(abilityId) {
        const abilities = this.getCurrentPhaseAbilities();
        return abilities.includes(abilityId);
    }
    
    /**
     * Get the current phase number
     * @returns {number} Current phase number
     */
    getCurrentPhase() {
        return this.currentPhase;
    }
    
    /**
     * Get data for a specific phase
     * @param {number} phase - Phase number
     * @returns {object|null} Phase data or null
     */
    getPhaseData(phase) {
        return this.phaseData[phase] || null;
    }
    
    /**
     * Get data for the current phase
     * @returns {object|null} Current phase data or null
     */
    getCurrentPhaseData() {
        return this.getPhaseData(this.currentPhase);
    }
    
    /**
     * Manual phase transition (for testing or special cases)
     */
    forcePhaseTransition(newPhase) {
        if (newPhase >= 0 && newPhase < this.phaseData.length) {
            this.triggerPhaseTransition(newPhase);
        }
    }
    
    /**
     * Cleanup on boss removal
     */
    cleanup() {
        this.isTransitioning = false;
        // Clean up persistent passive auras
        this._destroyPassiveAuras();
        // Cancel any pending transition timer
        if (this._transitionTimer) {
            this._transitionTimer.remove();
            this._transitionTimer = null;
        }
        this.transitionCallbacks.clear();
        this.hpThresholds = [];
        this.boss = null;
        this.scene = null;
        
        DebugLogger.info('boss', '[BossPhases] Cleanup completed');
    }
}