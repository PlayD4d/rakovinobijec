/**
 * PowerUpSystem - Main orchestrator for power-up system
 * PR7 Compliant - 100% data-driven via blueprints
 * 
 * This is the main entry point - delegates to specialized modules
 */

import { PowerUpModifiers } from './PowerUpModifiers.js';
import { DebugLogger } from '../../debug/DebugLogger.js';
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
        
        DebugLogger.info('powerup', '[PowerUpSystem] Initialized with modular architecture');
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
        DebugLogger.info('powerup', `[PowerUpSystem] 🎯 APPLYING POWERUP: ${powerUpId} at level ${level}`);
        
        const blueprint = this.scene.blueprintLoader.get(powerUpId);
        if (!blueprint) {
            DebugLogger.error('powerup', `[PowerUpSystem] ❌ Blueprint not found: ${powerUpId}`);
            return false;
        }
        
        // Validate blueprint structure
        if (!this._validateBlueprint(blueprint)) {
            DebugLogger.error('powerup', `[PowerUpSystem] ❌ Invalid blueprint structure: ${powerUpId}`);
            return false;
        }
        
        const currentData = this.appliedPowerUps.get(powerUpId) || { level: 0, modifiers: [], abilities: [] };
        const levelDelta = level - currentData.level;
        
        DebugLogger.info('powerup', `[PowerUpSystem] 📊 Level progression: ${currentData.level} → ${level} (delta: ${levelDelta})`);
        
        if (levelDelta <= 0) {
            DebugLogger.warn('powerup', `[PowerUpSystem] ⚠️ Power-up ${powerUpId} already at level ${currentData.level}`);
            return false;
        }
        
        DebugLogger.info('powerup', `[PowerUpSystem] Applying ${powerUpId} from level ${currentData.level} to ${level}`);
        
        // Process through modules - pass current level for 'base' type calculations
        const modifiers = this.modifiers.processModifiers(blueprint, levelDelta, currentData.level);
        const abilities = this.abilities.processAbilities(blueprint, level);
        
        DebugLogger.info('powerup', `[PowerUpSystem] 📋 Generated ${modifiers.length} modifiers and ${abilities.length} abilities`);
        if (modifiers.length > 0) {
            DebugLogger.info('powerup', '[PowerUpSystem] Modifiers:', modifiers.map(m => `${m.path}:${m.type}:${m.value}`));
        }
        if (abilities.length > 0) {
            DebugLogger.info('powerup', '[PowerUpSystem] Abilities:', abilities.map(a => `${a.type}:level${a.level}`));
        }
        
        // Apply to player
        this._applyToPlayer(modifiers, abilities, level, powerUpId);
        
        // Update tracking
        this.appliedPowerUps.set(powerUpId, {
            blueprint,
            level,
            modifiers: [...currentData.modifiers, ...modifiers],
            abilities
        });
        
        DebugLogger.info('powerup', `[PowerUpSystem] ✅ Successfully applied ${powerUpId} level ${level}`);
        DebugLogger.info('powerup', `[PowerUpSystem] Player now has ${this.scene.player?.activeModifiers?.length || 0} active modifiers`);
        
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
                DebugLogger.error('powerup', '[PowerUpSystem] Cannot show modal - scene is inactive');
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
            DebugLogger.error('powerup', '[PowerUpSystem] Failed to show selection modal:', error);
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
     * Generate power-up options for level-up selection
     * Public method for GameScene to call
     */
    generatePowerUpOptions() {
        const options = this._generatePowerUpOptions();
        
        // Convert to UI format - extract emoji from blueprint name
        return options.map(opt => {
            // Extract emoji from name if present (data-driven from blueprints)
            const name = opt.name || opt.id.replace('powerup.', '').replace(/_/g, ' ');
            const emojiMatch = name.match(/^([^\s]+)\s/); // Match first non-space chars
            const emoji = emojiMatch && emojiMatch[1].match(/[\u{1F300}-\u{1FAD6}]/u) ? emojiMatch[1] : '⭐';
            
            return {
                id: opt.id,
                name: name,
                description: opt.description || '',
                stats: opt.stats || '',
                rarity: opt.rarity || 'common',
                icon: emoji, // Extracted from blueprint, not hardcoded
                level: opt.level || 0
            };
        });
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
     * Process damage through power-up systems (PR7: Delegate to PowerUpAbilities)
     * @param {Player} player - Player object
     * @param {number} amount - Damage amount  
     * @param {number} time - Current game time
     * @returns {number} Remaining damage after power-up processing
     */
    processDamage(player, amount, time) {
        if (!this.abilities?.processDamageWithShield) {
            return amount; // No shield system, return full damage
        }
        
        return this.abilities.processDamageWithShield(player, amount, time);
    }
    
    /**
     * Reset timers after pause/resume (PR7: Delegate to PowerUpAbilities)
     * Called when scene resumes from pause
     */
    resetTimersAfterPause() {
        // Delegate to PowerUpAbilities module (proper PR7 architecture)
        if (this.abilities?.resetTimersAfterPause) {
            this.abilities.resetTimersAfterPause();
        }
        
        DebugLogger.info('powerup', '[PowerUpSystem] Delegated timer reset to PowerUpAbilities');
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
            DebugLogger.warn('powerup', `[PowerUpSystem] Blueprint ${blueprint.id} has no modifiers or ability`);
            return false;
        }
        
        return true;
    }
    
    _applyToPlayer(modifiers, abilities, level, powerUpId) {
        const player = this.scene.player;
        if (!player) {
            DebugLogger.error('powerup', '[PowerUpSystem] No player to apply power-ups to');
            return;
        }
        
        DebugLogger.info('powerup', `[PowerUpSystem] 🎮 Applying to player:`);
        DebugLogger.info('powerup', `  - Modifiers: ${modifiers.length}`);
        DebugLogger.info('powerup', `  - Abilities: ${abilities.length}`);
        DebugLogger.info('powerup', `  - PowerUp ID: ${powerUpId}`);
        
        // Apply modifiers
        this.modifiers.applyToPlayer(player, modifiers, level, powerUpId);
        
        // Apply abilities
        this.abilities.applyToPlayer(player, abilities);
        
        // Force stats recalculation
        if (player._statsCache) {
            player._statsCache = null;
            player._statsCacheTime = null;
        }
        
        DebugLogger.info('powerup', `[PowerUpSystem] 📊 Player stats after application:`);
        DebugLogger.info('powerup', `  - Active modifiers: ${player.activeModifiers?.length || 0}`);
        if (player.activeModifiers?.length > 0) {
            DebugLogger.info('powerup', `  - Modifier details:`, player.activeModifiers.map(m => `${m.path}:${m.type}:${m.value}`));
        }
    }
    
    _generatePowerUpOptions() {
        const allPowerUps = this.scene.blueprintLoader.getAll('powerup') || [];
        const options = [];
        
        DebugLogger.info('powerup', `[PowerUpSystem] Found ${allPowerUps.length} total powerup blueprints`);
        
        for (const blueprint of allPowerUps) {
            if (!blueprint?.id) {
                DebugLogger.warn('powerup', '[PowerUpSystem] Skipping blueprint without ID:', blueprint);
                continue;
            }
            
            // Skip templates and backup files
            if (blueprint.id.includes('template') || blueprint.id.includes('.bak')) {
                DebugLogger.debug('powerup', `[PowerUpSystem] Skipping template/backup: ${blueprint.id}`);
                continue;
            }
            
            const current = this.appliedPowerUps.get(blueprint.id);
            const currentLevel = current?.level || 0;
            const maxLevel = blueprint.stats?.maxLevel || 10;
            
            if (currentLevel >= maxLevel) {
                DebugLogger.debug('powerup', `[PowerUpSystem] Skipping maxed powerup: ${blueprint.id} (${currentLevel}/${maxLevel})`);
                continue;
            }
            
            // Calculate next level value for display
            const nextLevel = currentLevel + 1;
            const nextValue = this._calculateValueForLevel(blueprint, nextLevel);
            
            DebugLogger.debug('powerup', `[PowerUpSystem] Adding powerup option: ${blueprint.id} (level ${currentLevel} -> ${nextLevel})`);
            
            options.push({
                id: blueprint.id,
                name: this._getBlueprintName(blueprint),
                description: this._getBlueprintDescription(blueprint),
                type: blueprint.category || 'passive',
                level: currentLevel,
                nextLevel: nextLevel,
                maxLevel: maxLevel,
                value: nextValue,
                icon: blueprint.display?.icon,
                color: blueprint.display?.color,
                stats: this._formatPowerUpStats(blueprint, nextLevel),
                rarity: blueprint.display?.rarity || 'common'
            });
        }
        
        DebugLogger.info('powerup', `[PowerUpSystem] Generated ${options.length} valid powerup options`);
        
        // Weighted random selection based on rarity
        const rarityWeights = {
            'common': 4,
            'rare': 2,
            'epic': 1,
            'legendary': 0.5
        };
        
        // Calculate weighted list
        const weightedOptions = [];
        for (const option of options) {
            const weight = rarityWeights[option.rarity] || 1;
            for (let i = 0; i < weight * 10; i++) {
                weightedOptions.push(option);
            }
        }
        
        // Randomly select 3 unique options
        const selected = [];
        const usedIds = new Set();
        
        while (selected.length < 3 && weightedOptions.length > 0) {
            const index = Math.floor(Math.random() * weightedOptions.length);
            const option = weightedOptions[index];
            
            if (!usedIds.has(option.id)) {
                selected.push(option);
                usedIds.add(option.id);
                // Remove all instances of this option from weighted list
                for (let i = weightedOptions.length - 1; i >= 0; i--) {
                    if (weightedOptions[i].id === option.id) {
                        weightedOptions.splice(i, 1);
                    }
                }
            }
        }
        
        DebugLogger.info('powerup', `[PowerUpSystem] Selected ${selected.length} powerups for display:`, selected.map(p => `${p.id} (L${p.nextLevel})`));
        
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
    
    _calculateValueForLevel(blueprint, level) {
        const mods = blueprint.mechanics?.modifiersPerLevel;
        if (mods && mods.length > 0) {
            const firstMod = mods[0];
            if (firstMod.type === 'base') {
                // Base type: value * level
                return firstMod.value * level;
            } else if (firstMod.type === 'set') {
                // Set type: use value as-is
                return firstMod.value;
            } else {
                // Add/multiply: accumulate value
                return firstMod.value * level;
            }
        }
        
        // Check ability values
        if (blueprint.ability) {
            const ability = blueprint.ability;
            if (ability.baseShieldHP) return ability.baseShieldHP * level;
            if (ability.damagePerLevel) return ability.damagePerLevel[level - 1] || ability.damagePerLevel[0];
            if (ability.rangePerLevel) return ability.rangePerLevel[level - 1] || ability.rangePerLevel[0];
            if (ability.baseDamage) return ability.baseDamage + (level - 1) * 5;
        }
        
        return 0;
    }
    
    _formatPowerUpStats(blueprint, level = 1) {
        // Try to extract meaningful stats from the blueprint
        const mods = blueprint.mechanics?.modifiersPerLevel;
        if (mods && mods.length > 0) {
            const firstMod = mods[0];
            const value = this._calculateValueForLevel(blueprint, level);
            
            if (firstMod.path === 'projectileDamage') {
                return `+${value} DMG`;
            } else if (firstMod.path === 'moveSpeed') {
                return `+${Math.round(value * 100)}% SPD`;
            } else if (firstMod.path === 'attackIntervalMs') {
                return `+${Math.abs(Math.round(value * 100))}% AS`;
            } else if (firstMod.path === 'shieldHP') {
                return `${value} HP štít`;
            }
        }
        
        // Check for ability-based power-ups
        if (blueprint.ability?.type === 'shield') {
            const hp = (blueprint.ability.baseShieldHP || 50) * level;
            return `${hp} HP štít`;
        } else if (blueprint.ability?.type === 'radiotherapy') {
            return 'Radiační paprsky';
        } else if (blueprint.ability?.type === 'flamethrower') {
            return 'Plamenomety';
        }
        
        return '+???';
    }
    
}

// Register DEV commands for testing
if (typeof window !== 'undefined') {
    window.DEV = window.DEV || {};
    
    window.DEV.applyPowerUp = (id, level = 1) => {
        const scene = window.game?.scene?.getScene('GameScene');
        if (!scene?.powerUpSystem) {
            DebugLogger.error('powerup', 'PowerUpSystem not initialized');
            return;
        }
        
        const success = scene.powerUpSystem.applyPowerUp(id, level);
        DebugLogger.info('powerup', success ? `✅ Applied ${id} at level ${level}` : `❌ Failed to apply ${id}`);
    };
    
    window.DEV.powerUpStatus = () => {
        const scene = window.game?.scene?.getScene('GameScene');
        const player = scene?.player;
        if (!player) {
            DebugLogger.error('powerup', 'Player not found');
            return;
        }
        
        DebugLogger.info('powerup', '========== 🎯 Power-Up Status ==========');
        DebugLogger.info('powerup', 'XP Magnet Level:', player.xpMagnetLevel || 0);
        DebugLogger.info('powerup', 'Shield Active:', player.shieldActive || false);
        DebugLogger.info('powerup', 'Shield Hits:', player.shieldHits || 0);
        DebugLogger.info('powerup', 'Piercing Level:', player.piercingLevel || 0);
        DebugLogger.info('powerup', 'Active Power-Ups:', scene.powerUpSystem?.getActivePowerUps() || []);
        DebugLogger.info('powerup', '=========================================');
    };
}

export default PowerUpSystem;