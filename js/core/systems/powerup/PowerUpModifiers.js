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
        }

        // Invalidate stats cache
        player._statsCacheTime = 0;
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.scene = null;
        this.powerUpSystem = null;
    }
}