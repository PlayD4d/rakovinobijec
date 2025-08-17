/**
 * PowerUpSystem - Main orchestrator for power-up system
 * PR7 Compliant - 100% data-driven via blueprints
 * 
 * This is the main entry point - delegates to specialized modules
 */

import { PowerUpModifiers } from './PowerUpModifiers.js';
import { PowerUpAbilities } from './PowerUpAbilities.js';
import { PowerUpEffects } from './PowerUpEffects.js';

export class PowerUpSystem {
    constructor(scene) {
        this.scene = scene;
        
        // PR7: Required systems validation
        if (!scene.configResolver) throw new Error('[PowerUpSystem] Missing ConfigResolver');
        if (!scene.blueprintLoader) throw new Error('[PowerUpSystem] Missing BlueprintLoader');
        // Modifiers are handled directly without external engine
        
        // Track applied power-ups and their levels
        this.appliedPowerUps = new Map(); // powerUpId -> { blueprint, level, modifiers, abilities }
        
        // Initialize sub-modules
        this.modifiers = new PowerUpModifiers(scene, this);
        this.abilities = new PowerUpAbilities(scene, this);
        this.effects = new PowerUpEffects(scene, this);
        
        // VFX Manager reference (optional)
        this.vfxManager = null;
        
        // Selection modal reference
        this._selectionModal = null;
        
        console.log('[PowerUpSystem] Initialized with modular architecture');
    }
    
    /**
     * Set VFX Manager for visual effects
     */
    setVFXManager(vfxManager) {
        this.vfxManager = vfxManager;
        this.effects.setVFXManager(vfxManager);
    }
    
    /**
     * Apply a power-up from blueprint
     * @param {string} powerUpId - Blueprint ID (e.g., "powerup.damage_boost")
     * @param {number} level - Power-up level to apply
     */
    applyPowerUp(powerUpId, level = 1) {
        const blueprint = this.scene.blueprintLoader.get(powerUpId);
        if (!blueprint) {
            console.error(`[PowerUpSystem] Blueprint not found: ${powerUpId}`);
            return false;
        }
        
        // Validate blueprint structure
        if (!this._validateBlueprint(blueprint)) {
            console.error(`[PowerUpSystem] Invalid blueprint structure: ${powerUpId}`);
            return false;
        }
        
        const currentData = this.appliedPowerUps.get(powerUpId) || { level: 0, modifiers: [], abilities: [] };
        const levelDelta = level - currentData.level;
        
        if (levelDelta <= 0) {
            console.warn(`[PowerUpSystem] Power-up ${powerUpId} already at level ${currentData.level}`);
            return false;
        }
        
        console.log(`[PowerUpSystem] Applying ${powerUpId} from level ${currentData.level} to ${level}`);
        
        // Process through modules
        const modifiers = this.modifiers.processModifiers(blueprint, levelDelta);
        const abilities = this.abilities.processAbilities(blueprint, level);
        
        // Apply to player
        this._applyToPlayer(modifiers, abilities, level, powerUpId);
        
        // Update tracking
        this.appliedPowerUps.set(powerUpId, {
            blueprint,
            level,
            modifiers: [...currentData.modifiers, ...modifiers],
            abilities
        });
        
        // Play effects
        this.effects.playApplyEffects(blueprint, this.scene.player);
        
        // Update stats
        if (this.scene.gameStats) {
            this.scene.gameStats.powerUpsCollected = (this.scene.gameStats.powerUpsCollected || 0) + 1;
        }
        
        return true;
    }
    
    /**
     * Update active abilities
     */
    update(time, delta) {
        this.abilities.update(time, delta);
    }
    
    /**
     * Show power-up selection modal
     */
    async showPowerUpSelection(callback) {
        try {
            // Validate scene is still valid
            if (!this.scene || !this.scene.scene || !this.scene.scene.isActive()) {
                console.error('[PowerUpSystem] Cannot show modal - scene is inactive');
                callback?.();
                return;
            }
            
            // Get available power-ups
            const options = this._generatePowerUpOptions();
            
            // Create or reuse modal
            if (!this._selectionModal || this._selectionModal.isDestroyed) {
                const { PowerUpSelectionModal } = await import('../../../ui/PowerUpSelectionModal.js');
                this._selectionModal = new PowerUpSelectionModal(this.scene, [], null);
                this.scene.add.existing(this._selectionModal);
            }
            
            // Update and show
            this._selectionModal.updatePowerUps(options);
            this._selectionModal.onSelectionCallback = (selected) => {
                if (selected) {
                    const currentLevel = this.appliedPowerUps.get(selected.id)?.level || 0;
                    this.applyPowerUp(selected.id, currentLevel + 1);
                }
                this._selectionModal?.hideModal();
                callback?.();
            };
            
            await this._selectionModal.show();
        } catch (error) {
            console.error('[PowerUpSystem] Failed to show selection modal:', error);
            callback?.();
        }
    }
    
    /**
     * Get current level of a power-up
     */
    getPowerUpLevel(powerUpId) {
        return this.appliedPowerUps.get(powerUpId)?.level || 0;
    }
    
    /**
     * Get all active power-ups
     */
    getActivePowerUps() {
        const active = [];
        for (const [id, data] of this.appliedPowerUps) {
            active.push({
                id: id,
                level: data.level,
                name: data.blueprint.display?.devNameFallback || id
            });
        }
        return active;
    }
    
    /**
     * Get XP magnet radius (for compatibility)
     */
    getXPMagnetRadius() {
        const player = this.scene.player;
        if (!player) return 100;
        
        const magnetLevel = player.xpMagnetLevel || 0;
        if (magnetLevel <= 0) return 100;
        
        // Calculate radius: base * (1.25 ^ level)
        return 100 * Math.pow(1.25, magnetLevel);
    }
    
    /**
     * Check if shield should block damage (for compatibility)
     */
    shouldBlockDamage() {
        const player = this.scene.player;
        return player && player.shieldActive && player.shieldHits > 0 && !player.shieldBroken;
    }
    
    /**
     * Process damage through shield (for compatibility)
     */
    processDamage(damage) {
        if (this.shouldBlockDamage()) {
            // Shield blocks the damage
            const player = this.scene.player;
            player.shieldHits--;
            
            if (player.shieldHits <= 0) {
                player.shieldBroken = true;
                player.shieldRegenTimer = 0;
                if (this.vfxManager) {
                    this.vfxManager.detachEffect(player, 'shield');
                }
            }
            
            return 0; // Damage blocked
        }
        return damage;
    }
    
    /**
     * Cleanup method
     */
    destroy() {
        // Destroy modal
        if (this._selectionModal && !this._selectionModal.isDestroyed) {
            this._selectionModal.destroy();
        }
        this._selectionModal = null;
        
        // Cleanup modules
        this.abilities.destroy();
        this.effects.destroy();
        this.modifiers.destroy();
        
        // Clear data
        this.appliedPowerUps?.clear();
        this.appliedPowerUps = null;
        
        // Clear references
        this.scene = null;
        this.vfxManager = null;
    }
    
    // === PRIVATE METHODS ===
    
    _validateBlueprint(blueprint) {
        if (!blueprint.id || !blueprint.type) return false;
        if (blueprint.type !== 'powerup') return false;
        
        const hasModifiers = blueprint.mechanics?.modifiersPerLevel?.length > 0;
        const hasAbility = blueprint.ability?.type;
        
        if (!hasModifiers && !hasAbility) {
            console.warn(`[PowerUpSystem] Blueprint ${blueprint.id} has no modifiers or ability`);
            return false;
        }
        
        return true;
    }
    
    _applyToPlayer(modifiers, abilities, level, powerUpId) {
        const player = this.scene.player;
        if (!player) {
            console.error('[PowerUpSystem] No player to apply power-ups to');
            return;
        }
        
        // Apply modifiers
        this.modifiers.applyToPlayer(player, modifiers, level, powerUpId);
        
        // Apply abilities
        this.abilities.applyToPlayer(player, abilities);
    }
    
    _generatePowerUpOptions() {
        const allPowerUps = this.scene.blueprintLoader.getAll('powerup') || [];
        const options = [];
        
        for (const blueprint of allPowerUps) {
            if (!blueprint?.id) continue;
            
            // Skip templates
            if (blueprint.id.includes('template')) continue;
            
            const current = this.appliedPowerUps.get(blueprint.id);
            const currentLevel = current?.level || 0;
            const maxLevel = blueprint.stats?.maxLevel || 10;
            
            if (currentLevel >= maxLevel) continue;
            
            options.push({
                id: blueprint.id,
                name: this._getBlueprintName(blueprint),
                description: this._getBlueprintDescription(blueprint),
                type: blueprint.category || 'passive',
                level: currentLevel,
                maxLevel: maxLevel,
                value: this._extractValueFromBlueprint(blueprint),
                icon: blueprint.display?.icon,
                color: blueprint.display?.color
            });
        }
        
        // Randomly select 3
        const selected = [];
        while (selected.length < 3 && options.length > 0) {
            const index = Math.floor(Math.random() * options.length);
            selected.push(options.splice(index, 1)[0]);
        }
        
        return selected;
    }
    
    _getBlueprintName(blueprint) {
        if (this.scene.displayResolver) {
            const name = this.scene.displayResolver.getName(blueprint);
            if (name && name !== blueprint.id) return name;
        }
        return blueprint.display?.devNameFallback || blueprint.id.replace('powerup.', '').replace(/_/g, ' ');
    }
    
    _getBlueprintDescription(blueprint) {
        if (this.scene.displayResolver) {
            const desc = this.scene.displayResolver.getDescription(blueprint);
            if (desc) return desc;
        }
        return blueprint.display?.devDescFallback || '';
    }
    
    _extractValueFromBlueprint(blueprint) {
        const mods = blueprint.mechanics?.modifiersPerLevel;
        if (mods && mods.length > 0) {
            const firstMod = mods[0];
            if (firstMod.value !== undefined) {
                return firstMod.value;
            }
        }
        
        if (blueprint.ability) {
            const ability = blueprint.ability;
            if (ability.damagePerLevel) return ability.damagePerLevel[0];
            if (ability.rangePerLevel) return ability.rangePerLevel[0];
            if (ability.baseDamage) return ability.baseDamage;
        }
        
        return 0;
    }
}

// Register DEV commands for testing
if (typeof window !== 'undefined') {
    window.DEV = window.DEV || {};
    
    window.DEV.applyPowerUp = (id, level = 1) => {
        const scene = window.game?.scene?.getScene('GameScene');
        if (!scene?.powerUpSystem) {
            console.error('PowerUpSystem not initialized');
            return;
        }
        
        const success = scene.powerUpSystem.applyPowerUp(id, level);
        console.log(success ? `✅ Applied ${id} at level ${level}` : `❌ Failed to apply ${id}`);
    };
    
    window.DEV.powerUpStatus = () => {
        const scene = window.game?.scene?.getScene('GameScene');
        const player = scene?.player;
        if (!player) {
            console.error('Player not found');
            return;
        }
        
        console.group('🎯 Power-Up Status');
        console.log('XP Magnet Level:', player.xpMagnetLevel || 0);
        console.log('Shield Active:', player.shieldActive || false);
        console.log('Shield Hits:', player.shieldHits || 0);
        console.log('Piercing Level:', player.piercingLevel || 0);
        console.log('Active Power-Ups:', scene.powerUpSystem?.getActivePowerUps() || []);
        console.groupEnd();
    };
}

export default PowerUpSystem;