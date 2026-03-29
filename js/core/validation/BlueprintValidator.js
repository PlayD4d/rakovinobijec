/**
 * BlueprintValidator - validace blueprintů při načítání
 *
 * Delegates type-specific validation to sub-modules:
 *   - CombatValidator (enemy, boss, projectile)
 *   - LootValidator (lootTable, pools, pity)
 *   - ItemValidator (powerup, item, drop)
 *
 * Keeps: validate() dispatcher, validateBatch(), softValidate(), ValidationError
 */

import { validateEnemy, validateBoss, validateProjectile } from './validators/CombatValidator.js';
import { validateLootTable } from './validators/LootValidator.js';
import { validatePowerUp, validateItem, validateDrop } from './validators/ItemValidator.js';

export class BlueprintValidator {
    static validate(blueprint, type = 'unknown') {
        if (!blueprint) {
            throw new ValidationError(`Blueprint is null or undefined`, type);
        }

        const errors = [];

        // Basic structure
        this._validateBasicStructure(blueprint, errors);

        // Type-specific validation (delegated)
        switch (type) {
            case 'enemy':
                validateEnemy(blueprint, errors);
                break;
            case 'drop':
                validateDrop(blueprint, errors);
                break;
            case 'powerup':
                validatePowerUp(blueprint, errors);
                break;
            case 'boss':
                validateBoss(blueprint, errors);
                break;
            case 'lootTable':
                validateLootTable(blueprint, errors);
                break;
            case 'projectile':
                validateProjectile(blueprint, errors);
                break;
            case 'item':
                validateItem(blueprint, errors);
                break;
        }

        if (errors.length > 0) {
            throw new ValidationError(
                `Blueprint validation failed:\n${errors.join('\n')}`,
                type,
                blueprint.id
            );
        }

        return true;
    }

    static _validateBasicStructure(blueprint, errors) {
        if (!blueprint.id || typeof blueprint.id !== 'string') {
            errors.push('- Missing or invalid "id" field (must be string)');
        }

        if (!blueprint.type || typeof blueprint.type !== 'string') {
            errors.push('- Missing or invalid "type" field (must be string)');
        }

        if (!blueprint.stats || typeof blueprint.stats !== 'object') {
            errors.push('- Missing or invalid "stats" section (must be object)');
        }
    }

    /**
     * Validate an array of blueprints
     * @param {Array} blueprints
     * @param {string} type
     * @returns {Object} {valid: Array, invalid: Array}
     */
    static validateBatch(blueprints, type = 'unknown') {
        const result = { valid: [], invalid: [] };

        if (!Array.isArray(blueprints)) {
            throw new Error('blueprints parameter must be an array');
        }

        blueprints.forEach((blueprint, index) => {
            try {
                this.validate(blueprint, type);
                result.valid.push(blueprint);
            } catch (error) {
                result.invalid.push({
                    index,
                    blueprint,
                    error: error.message
                });
            }
        });

        return result;
    }

    /**
     * Soft validation - returns errors instead of throwing
     * @param {Object} blueprint
     * @param {string} type
     * @returns {Array} Array of error strings (empty = valid)
     */
    static softValidate(blueprint, type = 'unknown') {
        try {
            this.validate(blueprint, type);
            return [];
        } catch (error) {
            return error.message.split('\n').slice(1);
        }
    }
}

/**
 * Custom validation error
 */
class ValidationError extends Error {
    constructor(message, blueprintType = 'unknown', blueprintName = 'unnamed') {
        super(message);
        this.name = 'ValidationError';
        this.blueprintType = blueprintType;
        this.blueprintName = blueprintName;
    }
}
