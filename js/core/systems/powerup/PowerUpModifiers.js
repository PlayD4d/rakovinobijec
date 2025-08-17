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
     */
    processModifiers(blueprint, levelDelta) {
        const modifiers = [];
        const modifierDefs = blueprint.mechanics?.modifiersPerLevel || [];
        
        for (const modDef of modifierDefs) {
            if (!modDef.path || modDef.value === undefined) continue;
            
            // Calculate actual value based on level delta
            const value = modDef.value * levelDelta;
            
            // Create modifier object for direct application
            const modifier = {
                source: blueprint.id,
                path: modDef.path,
                type: modDef.type || 'add',
                value: value,
                description: modDef.description
            };
            
            modifiers.push(modifier);
            console.log(`[PowerUpModifiers] Modifier: ${modifier.path} ${modifier.type} ${modifier.value}`);
        }
        
        return modifiers;
    }
    
    /**
     * Apply modifiers to player
     */
    applyToPlayer(player, modifiers, level, powerUpId) {
        // Apply modifiers through player's modifier system
        for (const modifier of modifiers) {
            player.addModifier(modifier);
            
            // Special handling for specific power-ups
            this._handleSpecialCases(player, modifier, level, powerUpId);
        }
    }
    
    /**
     * Handle special cases that need direct player property updates
     */
    _handleSpecialCases(player, modifier, level, powerUpId) {
        // XP Magnet - set direct property for SimpleLootSystem
        if (powerUpId === 'powerup.xp_magnet') {
            player.xpMagnetLevel = level;
            console.log(`[PowerUpModifiers] ✅ Set player.xpMagnetLevel = ${level}`);
        }
        
        // Other special cases can be added here as needed
    }
    
    /**
     * Calculate stat with all modifiers applied
     * Simple direct calculation
     */
    calculateStat(baseValue, statPath, modifiers) {
        let value = baseValue || 0;
        
        for (const mod of modifiers || []) {
            if (mod.path === statPath) {
                if (mod.type === 'add') {
                    value += mod.value;
                } else if (mod.type === 'multiply') {
                    value *= mod.value;
                } else if (mod.type === 'mul') {
                    value *= (1 + mod.value);
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