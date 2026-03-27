/**
 * Boss - Thin Composer pro boss entity
 * 
 * Refaktorována z 1097 LOC monolitického souboru na thin orchestrator.
 * Deleguje na specializované systémy podle PR7 Thin Composer Pattern.
 * 
 * Zodpovědnosti:
 * - BossCore: Phaser integrace + capability interface
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

export class Boss extends BossCore {
    constructor(scene, x, y, blueprint, opts = {}) {
        // Validace povinných systémů (PR7 - fail fast)
        if (!scene) throw new Error('[Boss] Chybí scéna');
        if (!scene.configResolver) throw new Error('[Boss] Chybí ConfigResolver');
        if (!scene.projectileSystem?.createEnemyProjectile) throw new Error('[Boss] Chybí ProjectileSystem');
        if (!blueprint || blueprint.type !== 'boss' || !blueprint.id) {
            throw new Error('[Boss] Neplatný boss blueprint');
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
        
        // Boss depth slightly above regular enemies
        const bossDepth = scene.DEPTH_LAYERS?.ENEMIES || 1000;
        this.setDepth(bossDepth + 100);
        
        // Initialize specialized systems - Thin Composer pattern
        this.initializeBossSystems();
        
        DebugLogger.info('boss', `[Boss] Thin composer initialized: ${blueprint.id}`);
    }
    
    /**
     * Inicializuje specializované boss systémy
     */
    initializeBossSystems() {
        try {
            // Initialize AI behaviors for movement (PR7: reuse existing system)
            this.behaviors = new EnemyBehaviors(this);
            
            // Movement system - řeší tween violation (for special moves like dash/teleport)
            this.movement = new BossMovement(this);
            
            // Phase system - HP threshold management
            this.phases = new BossPhases(this);
            
            // Pass abilities from blueprint to BossAbilities
            this.abilities = this.blueprint.mechanics?.abilities || {};
            
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
     * Propojí systémy pro vzájemnou komunikaci
     */
    linkSystems() {
        // Abilities může používat movement system
        if (this.abilitiesSystem && this.movement) {
            this.abilitiesSystem.movement = this.movement;
        }
        
        // Phases může triggernout abilities
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
        
        // Map movePattern to behavior
        const behaviorMap = {
            'seek_player': 'chase',
            'circle_player': 'orbit', 
            'stationary': 'idle',
            'patrol': 'patrol',
            'aggressive': 'chase',
            'defensive': 'orbit'
        };
        
        const behavior = behaviorMap[movePattern] || 'chase';
        
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
        
        // Set behavior and config
        if (this.behaviors) {
            this.behaviors.setBehavior(behavior);
            this.behaviors.config = { ...this.behaviors.config, ...bossAIConfig };
            DebugLogger.info('boss', `[Boss] AI configured: ${behavior} behavior from ${movePattern} pattern`);
        }
        
        // AI decision interval for abilities - boss decides every 2-4 seconds
        this.aiInterval = 2000 + Math.random() * 2000;
        this.nextAiDecisionAt = 0; // Will be initialized in update()
        
        DebugLogger.info('boss', `[Boss] AI setup: ${behavior} behavior, ${this.aiInterval}ms ability interval`);
    }
    
    /**
     * Main update - deleguje na všechny systémy
     */
    update(time, delta) {
        if (!this.active || this.hp <= 0) return;
        
        // Update AI behaviors for movement (PR7: reuse existing system)
        if (this.behaviors) {
            this.behaviors.update(time, delta);
        }
        
        // BUGFIX: Parent update - EnemyCore očekává jen delta čas
        super.update(delta / 1000);
        
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
        
        // Movement system nemá vlastní update - je event-driven
    }
    
    /**
     * Handle phase change - update AI behavior based on new phase
     * PR7: Data-driven phase-based behavior changes
     */
    onPhaseChange(phase) {
        const phaseData = this.phases?.getPhaseData(phase);
        if (!phaseData) return;
        
        const movePattern = phaseData.movePattern || 'seek_player';
        
        // Map movePattern to behavior
        const behaviorMap = {
            'seek_player': 'chase',
            'circle_player': 'orbit', 
            'stationary': 'idle',
            'patrol': 'patrol',
            'aggressive': 'chase',
            'defensive': 'orbit'
        };
        
        const behavior = behaviorMap[movePattern] || 'chase';
        
        // Update behavior for new phase
        if (this.behaviors) {
            this.behaviors.setBehavior(behavior);
            DebugLogger.info('boss', `[Boss] Phase ${phase} - switching to ${behavior} behavior`);
        }
    }
    
    /**
     * Boss AI decision making - vybrání a execution schopnosti
     */
    makeBossDecision(time, delta) {
        // Získej dostupné schopnosti pro aktuální fázi
        const availableAbilities = this.phases?.getCurrentPhaseAbilities() || [];
        
        DebugLogger.info('boss', `[Boss] AI Decision - Phase: ${this.getCurrentPhase()}, Available abilities: ${availableAbilities.length}`);
        
        if (availableAbilities.length === 0) {
            DebugLogger.info('boss', `[Boss] AI Decision - No available abilities for current phase`);
            return;
        }
        
        // Základní AI - vyber random dostupnou schopnost
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
     * Deleguje ability execution na BossAbilities systém
     */
    executeAbility(abilityId, params = {}) {
        if (this.abilitiesSystem) {
            return this.abilitiesSystem.executeAbility(abilityId, params);
        }
        return false;
    }
    
    /**
     * Override damage handling pro phase transitions
     */
    takeDamage(amount, source = null) {
        // Parent damage handling
        const damageDealt = super.takeDamage(amount, source);
        
        // Update boss HP bar if damage was dealt
        if (damageDealt > 0 && this.scene.unifiedHUD) {
            this.scene.unifiedHUD.setBossHealth(this.hp, this.maxHp);
        }
        
        // Trigger boss decision after taking damage
        if (damageDealt > 0) {
            // 30% chance to use ability when damaged
            if (Math.random() < 0.3) {
                this.scene.time.delayedCall(500, () => {
                    const time = this.scene.time?.now || 0;
                    this.makeBossDecision(time, 16);
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
        if (!this.active) return;
        
        // Death VFX/SFX
        this.spawnVfx('death');
        this.playSfx('death');
        
        // Hide boss HP bar
        if (this.scene.unifiedHUD) {
            this.scene.unifiedHUD.hideBoss();
        }
        
        // Emit boss-specific death event (not enemyDeath)
        // This triggers level transition in BootstrapManager
        if (this.scene.events) {
            this.scene.events.emit('boss:die', { 
                boss: this,
                bossId: this.blueprint?.id,
                killer: killer 
            });
            
            DebugLogger.info('boss', `[Boss] ${this.blueprint?.id} died - emitting boss:die event`);
        }
        
        // Loot handled by GameScene/EnemyManager
        // Don't set active/visible false here - let manager handle cleanup
    }
    
    /**
     * Override pro boss-specific cleanup
     */
    cleanup() {
        // Cleanup specialized systems
        if (this.movement) {
            this.movement.cleanup();
            this.movement = null;
        }
        
        if (this.phases) {
            this.phases.cleanup();
            this.phases = null;
        }
        
        if (this.abilitiesSystem) {
            this.abilitiesSystem.cleanup();
            this.abilitiesSystem = null;
        }
        
        // Parent cleanup
        super.cleanup();
        
        DebugLogger.info('boss', '[Boss] Thin composer cleanup completed');
    }
    
    /**
     * Debug informace o boss stavu
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