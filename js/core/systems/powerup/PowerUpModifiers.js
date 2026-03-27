import { DebugLogger } from '../../debug/DebugLogger.js';

/**
 * PowerUpModifiers - Handles stat modifications from power-ups
 * PR7 Compliant - Direct modifier application for all stat changes
 */

export class PowerUpModifiers {
    constructor(scene, powerUpSystem) {
        this.scene = scene;
        this.powerUpSystem = powerUpSystem;
        // Direct modifier handling without external dependencies
    }
    
    /**
     * Process modifiers from blueprint
     * PR7: Support different modifier types including 'base' for level-based values
     */
    processModifiers(blueprint, levelDelta, currentLevel) {
        const modifiers = [];
        const modifierDefs = blueprint.mechanics?.modifiersPerLevel || [];
        
        for (const modDef of modifierDefs) {
            if (!modDef.path || modDef.value === undefined) continue;
            
            let value;
            
            // PR7: Calculate value based on type
            if (modDef.type === 'base') {
                // Base type: value = baseValue * currentLevel (not delta)
                // For shield: 50 * level = 50, 100, 150, 200, 250
                const targetLevel = (currentLevel || 0) + levelDelta;
                value = modDef.value * targetLevel;
            } else if (modDef.type === 'set') {
                // Set type: just use the value as-is
                value = modDef.value;
            } else {
                // Add/multiply types: value increases by delta
                value = modDef.value * levelDelta;
            }
            
            // Create modifier object for direct application
            const modifier = {
                source: blueprint.id,
                path: modDef.path,
                type: modDef.type || 'add',
                value: value,
                description: modDef.description
            };
            
            modifiers.push(modifier);
            DebugLogger.info('powerup', `[PowerUpModifiers] Modifier: ${modifier.path} ${modifier.type} ${modifier.value}`);
        }
        
        return modifiers;
    }
    
    /**
     * Apply modifiers to player
     * PR7: Direct application through player's modifier system
     */
    applyToPlayer(player, modifiers, level, powerUpId) {
        DebugLogger.info('powerup', `[PowerUpModifiers] Applying ${modifiers.length} modifiers to player for ${powerUpId} level ${level}`);
        
        // Apply modifiers through player's modifier system
        for (const modifier of modifiers) {
            DebugLogger.info('powerup', `[PowerUpModifiers] Adding modifier: ${modifier.path} = ${modifier.value} (${modifier.type})`);
            player.addModifier(modifier);
            
            // Special handling for specific power-ups
            this._handleSpecialCases(player, modifier, level, powerUpId);
        }
        
        // Log player state after application
        DebugLogger.info('powerup', `[PowerUpModifiers] Player now has ${player.activeModifiers?.length || 0} active modifiers`);
    }
    
    /**
     * Handle special cases that need direct player property updates
     * PR7: Bridge between modifier system and legacy properties
     */
    _handleSpecialCases(player, modifier, level, powerUpId) {
        // XP Magnet - set direct property for SimpleLootSystem
        if (powerUpId === 'powerup.xp_magnet') {
            player.xpMagnetLevel = level;
            DebugLogger.info('powerup', `[PowerUpModifiers] ✅ Set player.xpMagnetLevel = ${level}`);
        }
        
        // Shield HP - set direct property for shield system
        if (powerUpId === 'powerup.shield' && modifier.path === 'shieldHP') {
            // These are set by PowerUpAbilities, but we track them here too
            DebugLogger.info('powerup', `[PowerUpModifiers] Shield HP modifier applied: ${modifier.value} HP`);
        }
        
        // Other special cases can be added here as needed
    }
    
    /**
     * Calculate stat with all modifiers applied
     * PR7: Support all modifier types including 'base' and 'set'
     */
    calculateStat(baseValue, statPath, modifiers) {
        let value = baseValue || 0;
        let hasSetModifier = false;
        
        for (const mod of modifiers || []) {
            if (mod.path === statPath) {
                if (mod.type === 'set' || mod.type === 'base') {
                    // Set/base replaces the value entirely
                    value = mod.value;
                    hasSetModifier = true;
                } else if (!hasSetModifier) {
                    // Only apply add/multiply if no set modifier was found
                    if (mod.type === 'add') {
                        value += mod.value;
                    } else if (mod.type === 'multiply') {
                        value *= mod.value;
                    } else if (mod.type === 'mul') {
                        value *= (1 + mod.value);
                    }
                }
            }
        }
        
        return value;
    }
    
    /**
     * Remove modifiers from player
     */
    removeFromPlayer(player, modifiers) {
        for (const modifier of modifiers) {
            if (modifier.id) {
                player.removeModifierById(modifier.id);
            }
        }
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.scene = null;
        this.powerUpSystem = null;
    }
}