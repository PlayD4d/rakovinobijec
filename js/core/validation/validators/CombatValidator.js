/**
 * CombatValidator - Validates enemy, boss, and projectile blueprints
 * Extracted from BlueprintValidator for <500 LOC compliance
 */

/**
 * Validate enemy blueprint
 * @param {Object} blueprint
 * @param {Array} errors - Mutated with any found errors
 */
export function validateEnemy(blueprint, errors) {
    const stats = blueprint.stats || {};

    if (typeof stats.hp !== 'number' || stats.hp <= 0) {
        errors.push('- Enemy stats.hp must be positive number');
    }

    if (typeof stats.speed !== 'number' || stats.speed <= 0) {
        errors.push('- Enemy stats.speed must be positive number');
    }

    if (typeof stats.size !== 'number' || stats.size <= 0) {
        errors.push('- Enemy stats.size must be positive number');
    }

    // Mechanics (optional)
    if (blueprint.mechanics) {
        const mechanics = blueprint.mechanics;
        if (mechanics.movementType && typeof mechanics.movementType !== 'string') {
            errors.push('- mechanics.movementType must be string');
        }
        if (mechanics.contactDamage && typeof mechanics.contactDamage !== 'number') {
            errors.push('- mechanics.contactDamage must be number');
        }
    }

    // Drops array (new system)
    if (blueprint.drops) {
        if (!Array.isArray(blueprint.drops)) {
            errors.push('- drops must be an array');
        } else {
            blueprint.drops.forEach((drop, index) => {
                if (!drop.itemId || typeof drop.itemId !== 'string') {
                    errors.push(`- drops[${index}].itemId must be a string`);
                }
                if (typeof drop.chance !== 'number' || drop.chance < 0 || drop.chance > 1) {
                    errors.push(`- drops[${index}].chance must be number between 0 and 1`);
                }
                if (drop.quantity && (!Number.isInteger(drop.quantity) || drop.quantity < 1)) {
                    errors.push(`- drops[${index}].quantity must be positive integer`);
                }
            });
        }
    }
}

/**
 * Validate boss blueprint (extends enemy validation)
 * @param {Object} blueprint
 * @param {Array} errors
 */
export function validateBoss(blueprint, errors) {
    // Boss is extended enemy
    validateEnemy(blueprint, errors);

    // Boss-specific
    if (!blueprint.phases || !Array.isArray(blueprint.phases)) {
        errors.push('- Boss blueprint missing phases array');
    } else {
        blueprint.phases.forEach((phase, index) => {
            if (!phase.name || typeof phase.name !== 'string') {
                errors.push(`- Phase ${index}: missing name field`);
            }
            if (!phase.actions || !Array.isArray(phase.actions)) {
                errors.push(`- Phase ${index}: missing actions array`);
            }
            if (typeof phase.hpThreshold !== 'number' || phase.hpThreshold < 0 || phase.hpThreshold > 1) {
                errors.push(`- Phase ${index}: hpThreshold must be number between 0 and 1`);
            }
        });
    }
}

/**
 * Validate projectile blueprint
 * @param {Object} blueprint
 * @param {Array} errors
 */
export function validateProjectile(blueprint, errors) {
    const stats = blueprint.stats || {};

    if (typeof stats.damage !== 'number' || stats.damage <= 0) {
        errors.push('- Projectile stats.damage must be positive number');
    }

    if (typeof stats.speed !== 'number' || stats.speed <= 0) {
        errors.push('- Projectile stats.speed must be positive number');
    }

    if (stats.range !== undefined && (typeof stats.range !== 'number' || stats.range <= 0)) {
        errors.push('- Projectile stats.range must be positive number');
    }

    if (stats.size !== undefined && (typeof stats.size !== 'number' || stats.size <= 0)) {
        errors.push('- Projectile stats.size must be positive number');
    }

    if (blueprint.mechanics) {
        const mechanics = blueprint.mechanics;

        if (mechanics.piercing !== undefined && typeof mechanics.piercing !== 'boolean') {
            errors.push('- Projectile mechanics.piercing must be boolean');
        }

        if (mechanics.explosive !== undefined && typeof mechanics.explosive !== 'boolean') {
            errors.push('- Projectile mechanics.explosive must be boolean');
        }

        if (mechanics.homing !== undefined && typeof mechanics.homing !== 'boolean') {
            errors.push('- Projectile mechanics.homing must be boolean');
        }
    }
}
