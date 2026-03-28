/**
 * ItemValidator - Validates powerup, item, and drop blueprints
 * Extracted from BlueprintValidator for <500 LOC compliance
 */

/**
 * Validate power-up blueprint
 * @param {Object} blueprint
 * @param {Array} errors
 */
export function validatePowerUp(blueprint, errors) {
    if (!blueprint.displayName || typeof blueprint.displayName !== 'string') {
        errors.push('- PowerUp blueprint missing displayName field');
    }

    if (!blueprint.description || typeof blueprint.description !== 'string') {
        errors.push('- PowerUp blueprint missing description field');
    }

    if (blueprint.modifiers) {
        if (!Array.isArray(blueprint.modifiers)) {
            errors.push('- PowerUp modifiers must be an array');
        } else {
            blueprint.modifiers.forEach((mod, index) => {
                if (!mod.stat || typeof mod.stat !== 'string') {
                    errors.push(`- Modifier ${index}: missing stat field`);
                }
                if (typeof mod.value !== 'number') {
                    errors.push(`- Modifier ${index}: value must be number`);
                }
                if (!['add', 'multiply'].includes(mod.type)) {
                    errors.push(`- Modifier ${index}: type must be 'add' or 'multiply'`);
                }
            });
        }
    }

    if (blueprint.ability) {
        const ab = blueprint.ability;
        if (!ab.type || typeof ab.type !== 'string') {
            errors.push('- PowerUp ability missing type field');
        }
    }
}

/**
 * Validate item blueprint (new loot system)
 * @param {Object} blueprint
 * @param {Array} errors
 */
export function validateItem(blueprint, errors) {
    if (!blueprint.name || typeof blueprint.name !== 'string') {
        errors.push('- Item must have a name (string)');
    }

    if (!blueprint.category || typeof blueprint.category !== 'string') {
        errors.push('- Item must have a category (string)');
    } else if (!['xp', 'health', 'special', 'powerup', 'currency'].includes(blueprint.category)) {
        errors.push('- Item category must be one of: xp, health, special, powerup, currency');
    }

    if (!blueprint.rarity || typeof blueprint.rarity !== 'string') {
        errors.push('- Item must have a rarity (string)');
    } else if (!['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(blueprint.rarity)) {
        errors.push('- Item rarity must be one of: common, uncommon, rare, epic, legendary');
    }

    // Effect validation
    if (!blueprint.effect || typeof blueprint.effect !== 'object') {
        errors.push('- Item must have an effect object');
    } else {
        if (!blueprint.effect.type || typeof blueprint.effect.type !== 'string') {
            errors.push('- Item effect must have a type (string)');
        }

        switch (blueprint.effect.type) {
            case 'xp':
                if (typeof blueprint.effect.value !== 'number' || blueprint.effect.value <= 0) {
                    errors.push('- XP effect value must be positive number');
                }
                break;
            case 'heal':
                if (blueprint.effect.value !== 'full' &&
                    (typeof blueprint.effect.value !== 'number' || blueprint.effect.value <= 0)) {
                    errors.push('- Heal effect value must be positive number or "full"');
                }
                break;
            case 'instant_kill':
            case 'energy':
            case 'research':
                break;
            default:
                errors.push(`- Unknown effect type: ${blueprint.effect.type}`);
        }
    }

    // Pickup properties
    if (blueprint.pickup) {
        const pickup = blueprint.pickup;
        if (pickup.magnetRange && (typeof pickup.magnetRange !== 'number' || pickup.magnetRange < 0)) {
            errors.push('- pickup.magnetRange must be non-negative number');
        }
        if (pickup.pickupRadius && (typeof pickup.pickupRadius !== 'number' || pickup.pickupRadius < 0)) {
            errors.push('- pickup.pickupRadius must be non-negative number');
        }
        if (pickup.lifetime && (typeof pickup.lifetime !== 'number' || pickup.lifetime <= 0)) {
            errors.push('- pickup.lifetime must be positive number');
        }
        if (pickup.autoPickup !== undefined && typeof pickup.autoPickup !== 'boolean') {
            errors.push('- pickup.autoPickup must be boolean');
        }
    }

    // Visual validation (optional)
    if (blueprint.graphics) {
        if (blueprint.graphics.shape && typeof blueprint.graphics.shape !== 'string') {
            errors.push('- graphics.shape must be string');
        }
        if (blueprint.graphics.scale && (typeof blueprint.graphics.scale !== 'number' || blueprint.graphics.scale <= 0)) {
            errors.push('- graphics.scale must be positive number');
        }
    }
}

/**
 * Validate drop blueprint
 * @param {Object} blueprint
 * @param {Array} errors
 */
export function validateDrop(blueprint, errors) {
    const stats = blueprint.stats || {};

    if (typeof stats.weight !== 'number' || stats.weight < 0 || stats.weight > 1) {
        errors.push('- Drop stats.weight must be number between 0 and 1');
    }

    if (!blueprint.mechanics || !blueprint.mechanics.effectType) {
        errors.push('- Drop blueprint missing mechanics.effectType field');
    }

    if (blueprint.spawnRules) {
        const sr = blueprint.spawnRules;
        if (sr.minLevel && (!Number.isInteger(sr.minLevel) || sr.minLevel < 1)) {
            errors.push('- spawnRules.minLevel must be positive integer');
        }
        if (sr.maxLevel && (!Number.isInteger(sr.maxLevel) || sr.maxLevel < 1)) {
            errors.push('- spawnRules.maxLevel must be positive integer');
        }
        if (sr.minLevel && sr.maxLevel && sr.minLevel > sr.maxLevel) {
            errors.push('- spawnRules.minLevel cannot be greater than maxLevel');
        }
    }
}
