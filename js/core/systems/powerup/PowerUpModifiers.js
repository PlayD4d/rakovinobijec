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
        const targetLevel = (currentLevel || 0) + levelDelta;

        for (const modDef of modifierDefs) {
            if (!modDef.path || modDef.value === undefined) continue;

            let value;
            if (modDef.type === 'base') {
                // Base type: absolute value for target level (e.g. shield 50 * level)
                value = modDef.value * targetLevel;
            } else if (modDef.type === 'set') {
                value = modDef.value;
            } else {
                // Add/mul: total cumulative value for target level (not delta)
                // Since old modifiers are removed before applying, we need the full amount
                value = modDef.value * targetLevel;
            }

            modifiers.push({
                source: blueprint.id,
                path: modDef.path,
                type: modDef.type || 'add',
                value: value,
                description: modDef.description
            });
        }

        return modifiers;
    }
    
    /**
     * Apply modifiers to player
     * PR7: Direct application through player's modifier system
     */
    applyToPlayer(player, modifiers, level, powerUpId) {
        // Remove old modifiers from this power-up before adding new ones
        // This prevents accumulation of stale modifiers on level-up
        if (player.activeModifiers) {
            player.activeModifiers = player.activeModifiers.filter(m => m.source !== powerUpId);
        }

        // Apply fresh modifiers
        for (const modifier of modifiers) {
            player.addModifier(modifier);
            this._handleSpecialCases(player, modifier, level, powerUpId);
        }

        // Invalidate stats cache
        player._statsCacheTime = 0;
    }
    
    /**
     * Handle special cases that need direct player property updates
     * PR7: Bridge between modifier system and legacy properties
     */
    _handleSpecialCases(player, modifier, level, powerUpId) {
        // Special cases are minimized — most power-ups work through the modifier pipeline
        // XP Magnet: reads xpMagnetRadius from _stats() — no special handling needed
        // Shield: HP set by PowerUpAbilities._applyAbility, modifier tracks it in pipeline
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