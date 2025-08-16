/**
 * BlueprintValidator - validace blueprintů při načítání
 * 
 * Zajišťuje konzistenci a správnost blueprint dat při registraci
 * do EnemyRegistry, DropRegistry a PowerUpRegistry.
 */

export class BlueprintValidator {
    static validate(blueprint, type = 'unknown') {
        if (!blueprint) {
            throw new ValidationError(`Blueprint is null or undefined`, type);
        }
        
        const errors = [];
        
        // Základní struktura
        this._validateBasicStructure(blueprint, errors);
        
        // Type-specific validace
        switch (type) {
            case 'enemy':
                this._validateEnemyBlueprint(blueprint, errors);
                break;
            case 'drop':
                this._validateDropBlueprint(blueprint, errors);
                break;
            case 'powerup':
                this._validatePowerUpBlueprint(blueprint, errors);
                break;
            case 'boss':
                this._validateBossBlueprint(blueprint, errors);
                break;
            case 'lootTable':
                this._validateLootTableBlueprint(blueprint, errors);
                break;
            case 'projectile':
                this._validateProjectileBlueprint(blueprint, errors);
                break;
            case 'item':
                this._validateItemBlueprint(blueprint, errors);
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
        // Unified blueprint formát: povinné pole id místo name
        if (!blueprint.id || typeof blueprint.id !== 'string') {
            errors.push('- Missing or invalid "id" field (must be string)');
        }
        
        // Povinné pole type
        if (!blueprint.type || typeof blueprint.type !== 'string') {
            errors.push('- Missing or invalid "type" field (must be string)');
        }
        
        // Stats sekce musí existovat
        if (!blueprint.stats || typeof blueprint.stats !== 'object') {
            errors.push('- Missing or invalid "stats" section (must be object)');
        }
    }
    
    static _validateEnemyBlueprint(blueprint, errors) {
        const stats = blueprint.stats || {};
        
        // Validace základních stats
        if (typeof stats.hp !== 'number' || stats.hp <= 0) {
            errors.push('- Enemy stats.hp must be positive number');
        }
        
        if (typeof stats.speed !== 'number' || stats.speed <= 0) {
            errors.push('- Enemy stats.speed must be positive number');
        }
        
        if (typeof stats.size !== 'number' || stats.size <= 0) {
            errors.push('- Enemy stats.size must be positive number');
        }
        
        // Validace mechanics (volitelné)
        if (blueprint.mechanics) {
            const mechanics = blueprint.mechanics;
            if (mechanics.movementType && typeof mechanics.movementType !== 'string') {
                errors.push('- mechanics.movementType must be string');
            }
            if (mechanics.contactDamage && typeof mechanics.contactDamage !== 'number') {
                errors.push('- mechanics.contactDamage must be number');
            }
        }
        
        // NEW: Validace drops array (nový systém)
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
    
    static _validateDropBlueprint(blueprint, errors) {
        const stats = blueprint.stats || {};
        
        // Weight v stats sekci pro pravděpodobnost
        if (typeof stats.weight !== 'number' || stats.weight < 0 || stats.weight > 1) {
            errors.push('- Drop stats.weight must be number between 0 and 1');
        }
        
        // Mechanics sekce s effectType
        if (!blueprint.mechanics || !blueprint.mechanics.effectType) {
            errors.push('- Drop blueprint missing mechanics.effectType field');
        }
        
        // SpawnRules pokud existuje
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
    
    static _validatePowerUpBlueprint(blueprint, errors) {
        // Základní metadata
        if (!blueprint.displayName || typeof blueprint.displayName !== 'string') {
            errors.push('- PowerUp blueprint missing displayName field');
        }
        
        if (!blueprint.description || typeof blueprint.description !== 'string') {
            errors.push('- PowerUp blueprint missing description field');
        }
        
        // Modifiers pokud existují
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
        
        // Ability pokud existuje
        if (blueprint.ability) {
            const ab = blueprint.ability;
            if (!ab.type || typeof ab.type !== 'string') {
                errors.push('- PowerUp ability missing type field');
            }
        }
    }
    
    static _validateBossBlueprint(blueprint, errors) {
        // Boss je rozšířený enemy, tak nejdříve zkontroluj základní enemy strukturu
        this._validateEnemyBlueprint(blueprint, errors);
        
        // Boss-specific validace
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
    
    static _validateLootTableBlueprint(blueprint, errors) {
        // LootTable musí mít pools
        if (!blueprint.pools || !Array.isArray(blueprint.pools)) {
            errors.push('- LootTable blueprint missing pools array');
            return; // Nemůžeme validovat dále bez pools
        }
        
        if (blueprint.pools.length === 0) {
            errors.push('- LootTable blueprint pools array cannot be empty');
        }
        
        // Validace každého pool
        blueprint.pools.forEach((pool, poolIndex) => {
            this._validateLootPool(pool, poolIndex, errors);
        });
        
        // Validace modifiers (volitelné)
        if (blueprint.modifiers) {
            this._validateLootModifiers(blueprint.modifiers, errors);
        }
        
        // Validace caps (volitelné)
        if (blueprint.caps) {
            this._validateLootCaps(blueprint.caps, errors);
        }
    }
    
    static _validateLootPool(pool, poolIndex, errors) {
        const prefix = `Pool ${poolIndex}:`;
        
        // Rolls musí být pozitivní číslo
        if (pool.rolls !== undefined) {
            if (typeof pool.rolls !== 'number' || pool.rolls < 0) {
                errors.push(`- ${prefix} rolls must be non-negative number`);
            }
        }
        
        // Entries musí existovat a být pole
        if (!pool.entries || !Array.isArray(pool.entries)) {
            errors.push(`- ${prefix} missing entries array`);
            return;
        }
        
        if (pool.entries.length === 0) {
            errors.push(`- ${prefix} entries array cannot be empty`);
        }
        
        // Validace každého entry
        pool.entries.forEach((entry, entryIndex) => {
            this._validateLootEntry(entry, poolIndex, entryIndex, errors);
        });
        
        // Validace pity system (volitelné)
        if (pool.pity) {
            this._validatePitySystem(pool.pity, poolIndex, errors);
        }
        
        // Validace when conditions (volitelné)
        if (pool.when) {
            this._validateWhenConditions(pool.when, poolIndex, errors);
        }
    }
    
    static _validateLootEntry(entry, poolIndex, entryIndex, errors) {
        const prefix = `Pool ${poolIndex}, Entry ${entryIndex}:`;
        
        // Ref musí být string
        if (!entry.ref || typeof entry.ref !== 'string') {
            errors.push(`- ${prefix} missing or invalid ref field (must be string)`);
        }
        
        // Weight musí být nezáporné číslo
        if (entry.weight !== undefined) {
            if (typeof entry.weight !== 'number' || entry.weight < 0) {
                errors.push(`- ${prefix} weight must be non-negative number`);
            }
        }
        
        // Chance musí být mezi 0 a 1
        if (entry.chance !== undefined) {
            if (typeof entry.chance !== 'number' || entry.chance < 0 || entry.chance > 1) {
                errors.push(`- ${prefix} chance must be number between 0 and 1`);
            }
        }
        
        // Quantity validace
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
        
        // Unique musí být boolean
        if (entry.unique !== undefined && typeof entry.unique !== 'boolean') {
            errors.push(`- ${prefix} unique must be boolean`);
        }
    }
    
    static _validatePitySystem(pity, poolIndex, errors) {
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
    
    static _validateWhenConditions(when, poolIndex, errors) {
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
            
            // Specifické validace
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
    
    static _validateLootModifiers(modifiers, errors) {
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
            
            // Boolean modifiers
            if (['timeScaling', 'survivalBonus', 'guaranteedDrops', 'powerupGuaranteed'].includes(modifier)) {
                if (typeof value !== 'boolean') {
                    errors.push(`- Modifier '${modifier}' must be boolean`);
                }
            } 
            // Number modifiers
            else if (typeof value !== 'number' || value < 0) {
                errors.push(`- Modifier '${modifier}' must be non-negative number`);
            }
        }
    }
    
    static _validateLootCaps(caps, errors) {
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
            
            // Specific validations
            if (cap === 'maxSameDropStreak' && (!Number.isInteger(value) || value < 1)) {
                errors.push(`- Cap 'maxSameDropStreak' must be positive integer`);
            }
        }
    }
    
    static _validateProjectileBlueprint(blueprint, errors) {
        const stats = blueprint.stats || {};
        
        // Základní projectile stats
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
        
        // Mechanics validace
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
    
    
    /**
     * Validace pole blueprintů
     * @param {Array} blueprints - pole blueprintů k validaci
     * @param {string} type - typ blueprintů
     * @returns {Object} - {valid: Array, invalid: Array}
     */
    static validateBatch(blueprints, type = 'unknown') {
        const result = {
            valid: [],
            invalid: []
        };
        
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
     * Soft validace - vrací chyby namísto vyhození exception
     * @param {Object} blueprint - blueprint k validaci
     * @param {string} type - typ blueprintu
     * @returns {Array} - pole chyb (prázdné = validní)
     */
    static softValidate(blueprint, type = 'unknown') {
        try {
            this.validate(blueprint, type);
            return [];
        } catch (error) {
            return error.message.split('\n').slice(1); // první řádek je "Blueprint validation failed:"
        }
    }
    
    /**
     * NEW: Validate item blueprints (new loot system)
     */
    static _validateItemBlueprint(blueprint, errors) {
        // Required fields
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
            
            // Type-specific effect validation
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
                    // These types don't require value validation
                    break;
                default:
                    errors.push(`- Unknown effect type: ${blueprint.effect.type}`);
            }
        }
        
        // Pickup properties validation
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
}

/**
 * Custom chyba pro validaci blueprintů
 */
export class ValidationError extends Error {
    constructor(message, blueprintType = 'unknown', blueprintName = 'unnamed') {
        super(message);
        this.name = 'ValidationError';
        this.blueprintType = blueprintType;
        this.blueprintName = blueprintName;
    }
}