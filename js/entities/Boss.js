/**
 * Boss - Thin Composer for boss entity
 *
 * Refactored from 1097 LOC monolithic file to thin orchestrator.
 * Delegates to specialized systems per PR7 Thin Composer Pattern.
 *
 * Responsibilities:
 * - BossCore: Phaser integration + capability interface
 * - BossMovement: Dash, teleport, complex movement patterns
 * - BossPhases: Phase transitions based on HP thresholds
 * - BossAbilities: Ability execution and cooldown management
 */

import { BossCore } from './boss/BossCore.js';
import { BossMovement } from './boss/BossMovement.js';
import { BossPhases } from './boss/BossPhases.js';
import { BossAbilities } from './boss/BossAbilities.js';
import { EnemyBehaviors } from './EnemyBehaviors.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
import { getSession } from '../core/debug/SessionLog.js';

// Shared behavior map — single source of truth for movePattern→behavior mapping
const BOSS_BEHAVIOR_MAP = {
    'seek_player': 'chase',
    'circle_player': 'orbit',
    'stationary': 'idle',
    'patrol': 'patrol',
    'aggressive': 'chase',
    'defensive': 'orbit'
};

export class Boss extends BossCore {
    static BEHAVIOR_MAP = BOSS_BEHAVIOR_MAP;
    constructor(scene, x, y, blueprint, opts = {}) {
        // Validate required systems (PR7 - fail fast)
        if (!scene) throw new Error('[Boss] Missing scene');
        if (!scene.configResolver) throw new Error('[Boss] Missing ConfigResolver');
        if (!scene.projectileSystem?.createEnemyProjectile) throw new Error('[Boss] Missing ProjectileSystem');
        if (!blueprint || blueprint.type !== 'boss' || !blueprint.id) {
            throw new Error('[Boss] Invalid boss blueprint');
        }
        
        // Initialize BossCore with enemy-compatible interface
        const enemyConfig = {
            ...blueprint.stats,
            ...blueprint.mechanics,
            texture: blueprint.id,
            color: blueprint.display?.color ? parseInt(blueprint.display.color.replace('#', '0x')) : 0xFF0000,
            sfx: blueprint.sfx,
            vfx: blueprint.vfx
        };
        
        // BossCore extends EnemyCore which handles Phaser integration
        super(scene, blueprint, { x, y, ...enemyConfig, ...opts });
        
        // Boss depth — EnemyManager.spawnBoss() sets final depth via DEPTH_LAYERS.BOSSES
        
        // Initialize specialized systems - Thin Composer pattern
        this.initializeBossSystems();

        // Spawn SFX — mirrors Enemy.js pattern
        this.playSfx('spawn');

        DebugLogger.info('boss', `[Boss] Thin composer initialized: ${blueprint.id}`);
    }
    
    /**
     * Initialize specialized boss systems
     */
    initializeBossSystems() {
        try {
            // Initialize AI behaviors for movement (PR7: reuse existing system)
            this.behaviors = new EnemyBehaviors(this);
            
            // Movement system - handles tween violation (for special moves like dash/teleport)
            this.movement = new BossMovement(this);
            
            // Phase system - HP threshold management
            this.phases = new BossPhases(this);
            
            // Abilities system — reads this.abilities from BossCore constructor
            // Abilities system - boss attack patterns
            this.abilitiesSystem = new BossAbilities(this);
            
            // Setup boss AI after all systems are initialized
            this.setupBossAI();
            
            // Link systems for cross-system communication
            this.linkSystems();
            
        } catch (error) {
            DebugLogger.error('boss', '[Boss] Failed to initialize systems:', error);
            throw error;
        }
    }
    
    /**
     * Link systems for cross-system communication
     */
    linkSystems() {
        // Abilities can use the movement system
        if (this.abilitiesSystem && this.movement) {
            this.abilitiesSystem.movement = this.movement;
        }
        
        // Phases can trigger abilities
        if (this.phases && this.abilitiesSystem) {
            this.phases.onPhaseTransition('all', (phase) => {
                // Clear ability cooldowns on phase change
                this.abilitiesSystem.stopAllAbilities();
            });
        }
    }
    
    /**
     * Setup boss AI configuration - map movePattern to behaviors
     * PR7: Data-driven AI configuration from blueprint
     */
    setupBossAI() {
        // Get current phase data for movePattern
        const phaseData = this.phases?.getCurrentPhaseData() || this.blueprint.mechanics?.phases?.[0];
        const movePattern = phaseData?.movePattern || 'seek_player';
        
        const behavior = Boss.BEHAVIOR_MAP[movePattern] || 'chase';
        
        // Configure AI for boss - slower but more persistent
        const bossAIConfig = {
            speed: this.blueprint.stats?.speed || 30,
            attackRange: 250,  // Larger attack range for boss
            loseRange: 1000,   // Never loses player
            orbitRadius: 200,  // For orbit pattern
            predictiveChase: true,  // Smarter chase
            hysteresis: {
                enterFactor: 0.8,
                exitFactor: 1.5
            }
        };
        
        // Set behavior and config — merge into per-layer configs, not top-level
        if (this.behaviors) {
            this.behaviors.setBehavior(behavior);
            for (const layer of Object.keys(this.behaviors.config)) {
                this.behaviors.config[layer] = { ...this.behaviors.config[layer], ...bossAIConfig };
            }
            DebugLogger.info('boss', `[Boss] AI configured: ${behavior} behavior from ${movePattern} pattern`);
        }
        
        // AI decision interval — use phase attackInterval if available, else random 2-4s
        const phaseAttackInterval = phaseData?.attackInterval;
        this.aiInterval = phaseAttackInterval || (2000 + Math.random() * 2000);
        this.nextAiDecisionAt = 0; // Will be initialized in update()
        
        DebugLogger.info('boss', `[Boss] AI setup: ${behavior} behavior, ${this.aiInterval}ms ability interval`);
    }
    
    /**
     * Main update - delegates to all systems
     */
    update(time, delta) {
        if (!this.active || this.hp <= 0) return;
        
        // Update AI behaviors for movement (PR7: reuse existing system)
        if (this.behaviors) {
            this.behaviors.update(time, delta);
        }
        
        // Boss-specific system updates
        if (this.phases) {
            this.phases.update(time, delta);
            
            // Check if phase changed and update AI behavior
            const newPhase = this.phases.getCurrentPhase();
            if (this.lastPhase !== newPhase) {
                this.lastPhase = newPhase;
                this.onPhaseChange(newPhase);
            }
        }
        
        if (this.abilitiesSystem) {
            this.abilitiesSystem.update(time, delta);
        }
        
        // Boss AI decision making - check periodically
        if (!this.nextAiDecisionAt) {
            this.nextAiDecisionAt = time + this.aiInterval;
        }
        
        if (time >= this.nextAiDecisionAt) {
            this.makeBossDecision(time, delta);
            this.nextAiDecisionAt = time + this.aiInterval;
            DebugLogger.info('boss', `[Boss] Ability decision executed, next at: ${this.nextAiDecisionAt}`);
        }
        
        // Movement system has no own update - it is event-driven
    }
    
    /**
     * Handle phase change - update AI behavior based on new phase
     * PR7: Data-driven phase-based behavior changes
     */
    onPhaseChange(phase) {
        const phaseData = this.phases?.getPhaseData(phase);
        if (!phaseData) return;

        const movePattern = phaseData.movePattern || 'seek_player';
        const behavior = Boss.BEHAVIOR_MAP[movePattern] || 'chase';

        // Update behavior for new phase
        if (this.behaviors) {
            this.behaviors.setBehavior(behavior);
            DebugLogger.info('boss', `[Boss] Phase ${phase} - switching to ${behavior} behavior`);
        }

        // Update AI decision interval from phase data
        if (phaseData.attackInterval) {
            this.aiInterval = phaseData.attackInterval;
        }
    }
    
    /**
     * Boss AI decision making - ability selection and execution
     */
    makeBossDecision(time, delta) {
        // Get available abilities for the current phase
        const availableAbilities = this.phases?.getCurrentPhaseAbilities() || [];
        
        DebugLogger.info('boss', `[Boss] AI Decision - Phase: ${this.getCurrentPhase()}, Available abilities: ${availableAbilities.length}`);
        
        if (availableAbilities.length === 0) {
            DebugLogger.info('boss', `[Boss] AI Decision - No available abilities for current phase`);
            return;
        }
        
        // Basic AI - pick a random available ability
        const readyAbilities = availableAbilities.filter(abilityId => {
            // Check if ability is ready using BossCore method
            return this.isAbilityReady(abilityId);
        });
        
        DebugLogger.info('boss', `[Boss] AI Decision - Ready abilities: ${readyAbilities.length}/${availableAbilities.length}`);
        
        if (readyAbilities.length > 0) {
            const randomAbility = readyAbilities[Math.floor(Math.random() * readyAbilities.length)];
            DebugLogger.info('boss', `[Boss] AI Decision - Executing ability: ${randomAbility}`);
            this.executeAbility(randomAbility);
        } else {
            DebugLogger.info('boss', `[Boss] AI Decision - All abilities on cooldown`);
        }
    }
    
    /**
     * Delegate ability execution to BossAbilities system
     */
    executeAbility(abilityId, params = {}) {
        if (this.abilitiesSystem) {
            return this.abilitiesSystem.executeAbility(abilityId, params);
        }
        return false;
    }
    
    /**
     * Override damage handling for phase transitions
     */
    takeDamage(amountOrHit, source = null) {
        // Shield ability blocks all damage while active
        if (this._shielded) {
            this.spawnVfx('hit');
            return 0;
        }

        // Normalize: accept both plain number and {amount, source} object
        // (abilities call takeDamage({amount, source}), collisions call takeDamage(number))
        let hit;
        if (amountOrHit != null && typeof amountOrHit === 'object') {
            hit = amountOrHit; // Already in {amount, source} format
        } else {
            hit = { amount: amountOrHit, source };
        }

        const damageDealt = super.takeDamage(hit);

        // Log boss damage
        if (damageDealt > 0) {
            getSession()?.log('boss', 'damage_taken', { bossId: this.blueprint?.id, amount: damageDealt, hp: this.hp, maxHp: this.maxHp, phase: this.phases?.currentPhase });
        }

        // Notify UI via event (Phaser recommended scene communication pattern)
        if (damageDealt > 0 && this.scene?.events) {
            this.scene.events.emit('boss:hp-update', { hp: this.hp, maxHp: this.maxHp });
        }

        // Trigger boss decision after taking damage (tracked timer)
        if (damageDealt > 0 && this.hp > 0) {
            if (Math.random() < 0.3 && this.abilitiesSystem?._schedule) {
                this.abilitiesSystem._schedule(500, () => {
                    this.makeBossDecision(this.scene.time.now, 16);
                });
            }
        }

        return damageDealt;
    }
    
    /**
     * Override die method for boss-specific death handling
     * PR7: Boss emits different event than regular enemies
     */
    die(killer) {
        if (!this.active || this._bossDying) return;
        this._bossDying = true; // Re-entrancy guard for die() — distinct from _deathProcessed used by EnemyManager
        try {
            getSession()?.log('boss', 'death', { bossId: this.blueprint?.id, killer });

            // Death VFX/SFX (while still visible — Boss handles its own, onEnemyDeath skips VFX for bosses)
            this.spawnVfx('death');
            this.playSfx('death');

            // Clear active telegraph warnings (boss ability circles still on screen)
            if (this.scene?.vfxSystem?.clearTelegraphs) {
                this.scene.vfxSystem.clearTelegraphs();
            }

            // Notify UI to hide boss HP bar (event-based, no direct scene reference)
            if (this.scene?.events) {
                this.scene.events.emit('boss:hide-hp');
            }

            // Process loot/XP/stats BEFORE deactivating (needs position)
            // _deathProcessed is set by EnemyManager.onEnemyDeath — do NOT set it here
            if (this.scene.handleEnemyDeath) {
                this.scene.handleEnemyDeath(this);
            }

            // NOW deactivate — prevents further damage/updates
            this.setActive(false);
            this.setVisible(false);
            if (this.body) this.body.enable = false;

            // Capture phase before cleanup nulls it
            const finalPhase = this.phases?.getCurrentPhase?.() ?? 0;

            // Cleanup subsystems via single cleanup() method (DRY)
            this.cleanup();

            // Emit boss-specific event for level transition (after cleanup)
            if (this.scene?.events) {
                this.scene.events.emit('boss:die', {
                    bossId: this.blueprint?.id,
                    killer: killer,
                    phase: finalPhase
                });
            }
        } finally {
            if (this.active) {
                this.setActive(false);
                this.setVisible(false);
            }
            if (this.body) this.body.enable = false;
        }
    }
    
    /**
     * Override for boss-specific cleanup
     */
    cleanup() {
        // Cleanup order matters: cancel ability timers BEFORE phases
        // (phase transition callbacks are scheduled through abilitiesSystem)
        if (this.behaviors) {
            try { this.behaviors.destroy?.(); } catch (_) {}
            this.behaviors = null;
        }
        if (this.movement) {
            try { this.movement.cleanup?.(); } catch (_) {}
            this.movement = null;
        }
        if (this.abilitiesSystem) {
            try { this.abilitiesSystem.cleanup?.(); } catch (_) {}
            this.abilitiesSystem = null;
        }
        if (this.phases) {
            try { this.phases.cleanup?.(); } catch (_) {}
            this.phases = null;
        }

        // Parent cleanup
        super.cleanup();
    }
    
    /**
     * Debug info about boss state
     */
    getDebugInfo() {
        return {
            id: this.blueprint?.id,
            hp: `${this.hp}/${this.maxHp}`,
            phase: this.getCurrentPhase(),
            activeAbilities: this.abilitiesSystem?.getActiveAbilities() || [],
            isMoving: this.movement?.isExecutingMovement || false
        };
    }
}