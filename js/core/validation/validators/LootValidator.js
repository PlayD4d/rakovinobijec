/**
 * LootValidator - Validates loot table, loot pool, and pity system blueprints
 * Extracted from BlueprintValidator for <500 LOC compliance
 */

/**
 * Validate loot table blueprint
 * @param {Object} blueprint
 * @param {Array} errors
 */
export function validateLootTable(blueprint, errors) {
    if (!blueprint.pools || !Array.isArray(blueprint.pools)) {
        errors.push('- LootTable blueprint missing pools array');
        return;
    }

    if (blueprint.pools.length === 0) {
        errors.push('- LootTable blueprint pools array cannot be empty');
    }

    blueprint.pools.forEach((pool, poolIndex) => {
        validateLootPool(pool, poolIndex, errors);
    });

    if (blueprint.modifiers) {
        _validateLootModifiers(blueprint.modifiers, errors);
    }

    if (blueprint.caps) {
        _validateLootCaps(blueprint.caps, errors);
    }
}

/**
 * Validate a single loot pool
 * @param {Object} pool
 * @param {number} poolIndex
 * @param {Array} errors
 */
export function validateLootPool(pool, poolIndex, errors) {
    const prefix = `Pool ${poolIndex}:`;

    if (pool.rolls !== undefined) {
        if (typeof pool.rolls !== 'number' || pool.rolls < 0) {
            errors.push(`- ${prefix} rolls must be non-negative number`);
        }
    }

    if (!pool.entries || !Array.isArray(pool.entries)) {
        errors.push(`- ${prefix} missing entries array`);
        return;
    }

    if (pool.entries.length === 0) {
        errors.push(`- ${prefix} entries array cannot be empty`);
    }

    pool.entries.forEach((entry, entryIndex) => {
        _validateLootEntry(entry, poolIndex, entryIndex, errors);
    });

    if (pool.pity) {
        validatePitySystem(pool.pity, poolIndex, errors);
    }

    if (pool.when) {
        _validateWhenConditions(pool.when, poolIndex, errors);
    }
}

/**
 * Validate pity system configuration
 * @param {Object} pity
 * @param {number} poolIndex
 * @param {Array} errors
 */
export function validatePitySystem(pity, poolIndex, errors) {
    const prefix = `Pool ${poolIndex} pity:`;

    if (typeof pity.enabled !== 'boolean') {
        errors.push(`- ${prefix} enabled must be boolean`);
    }

    if (pity.enabled) {
        if (typeof pity.maxNoDrop !== 'number' || pity.maxNoDrop <= 0) {
            errors.push(`- ${prefix} maxNoDrop must be positive number`);
        }

        if (pity.guaranteedEntry && typeof pity.guaranteedEntry !== 'string') {
            errors.push(`- ${prefix} guaranteedEntry must be string`);
        }
    }
}

// === INTERNAL HELPERS ===

function _validateLootEntry(entry, poolIndex, entryIndex, errors) {
    const prefix = `Pool ${poolIndex}, Entry ${entryIndex}:`;

    if (!entry.ref || typeof entry.ref !== 'string') {
        errors.push(`- ${prefix} missing or invalid ref field (must be string)`);
    }

    if (entry.weight !== undefined) {
        if (typeof entry.weight !== 'number' || entry.weight < 0) {
            errors.push(`- ${prefix} weight must be non-negative number`);
        }
    }

    if (entry.chance !== undefined) {
        if (typeof entry.chance !== 'number' || entry.chance < 0 || entry.chance > 1) {
            errors.push(`- ${prefix} chance must be number between 0 and 1`);
        }
    }

    if (entry.qty !== undefined) {
        if (typeof entry.qty === 'number') {
            if (entry.qty < 0) {
                errors.push(`- ${prefix} qty must be non-negative number`);
            }
        } else if (typeof entry.qty === 'object') {
            if (typeof entry.qty.min !== 'number' || entry.qty.min < 0) {
                errors.push(`- ${prefix} qty.min must be non-negative number`);
            }
            if (typeof entry.qty.max !== 'number' || entry.qty.max < 0) {
                errors.push(`- ${prefix} qty.max must be non-negative number`);
            }
            if (entry.qty.min > entry.qty.max) {
                errors.push(`- ${prefix} qty.min cannot be greater than qty.max`);
            }
        } else {
            errors.push(`- ${prefix} qty must be number or object with min/max`);
        }
    }

    if (entry.unique !== undefined && typeof entry.unique !== 'boolean') {
        errors.push(`- ${prefix} unique must be boolean`);
    }
}

function _validateWhenConditions(when, poolIndex, errors) {
    const prefix = `Pool ${poolIndex} when:`;
    const validConditions = [
        'timeGteMs', 'timeLteMs',
        'enemiesKilledGte', 'enemiesKilledLte',
        'levelGte', 'levelLte',
        'playerLuckGte', 'playerLuckLte'
    ];

    for (const [condition, value] of Object.entries(when)) {
        if (!validConditions.includes(condition)) {
            errors.push(`- ${prefix} unknown condition '${condition}'`);
            continue;
        }

        if (typeof value !== 'number') {
            errors.push(`- ${prefix} condition '${condition}' must be number`);
            continue;
        }

        if (condition.includes('time') && value < 0) {
            errors.push(`- ${prefix} ${condition} must be non-negative`);
        }
        if (condition.includes('level') && (value < 1 || !Number.isInteger(value))) {
            errors.push(`- ${prefix} ${condition} must be positive integer`);
        }
        if (condition.includes('luck') && value < 0) {
            errors.push(`- ${prefix} ${condition} must be non-negative`);
        }
    }
}

function _validateLootModifiers(modifiers, errors) {
    const validModifiers = [
        'dropRateMultiplier', 'qualityBonus', 'luckInfluence',
        'eliteBonus', 'bossBonus', 'timeScaling', 'timeScalingRate',
        'chaosMultiplier', 'survivalBonus', 'survivalThreshold', 'survivalMultiplier'
    ];

    for (const [modifier, value] of Object.entries(modifiers)) {
        if (!validModifiers.includes(modifier)) {
            errors.push(`- Unknown modifier '${modifier}'`);
            continue;
        }

        if (['timeScaling', 'survivalBonus', 'guaranteedDrops', 'powerupGuaranteed'].includes(modifier)) {
            if (typeof value !== 'boolean') {
                errors.push(`- Modifier '${modifier}' must be boolean`);
            }
        } else if (typeof value !== 'number' || value < 0) {
            errors.push(`- Modifier '${modifier}' must be non-negative number`);
        }
    }
}

function _validateLootCaps(caps, errors) {
    const validCaps = [
        'maxDropsPerMinute', 'maxSameDropStreak', 'cooldownBetweenRare',
        'powerupCooldown', 'metotrexatCooldown', 'ultraRareCooldown'
    ];

    for (const [cap, value] of Object.entries(caps)) {
        if (!validCaps.includes(cap)) {
            errors.push(`- Unknown cap '${cap}'`);
            continue;
        }

        if (typeof value !== 'number' || value < 0) {
            errors.push(`- Cap '${cap}' must be non-negative number`);
        }

        if (cap === 'maxSameDropStreak' && (!Number.isInteger(value) || value < 1)) {
            errors.push(`- Cap 'maxSameDropStreak' must be positive integer`);
        }
    }
}
