/**
 * SchemaValidator.js - Validates blueprints against schemas
 * Ensures data integrity and provides helpful error messages
 */

import { FieldDefinitions } from '../modules/FieldDefinitions.js';

export class SchemaValidator {
    constructor(editor) {
        this.editor = editor;
        this.schemas = this.loadSchemas();
    }
    
    /**
     * Load validation schemas for each blueprint type
     */
    loadSchemas() {
        return {
            enemy: {
                required: ['id', 'type', 'stats'],
                optional: ['drops', 'lootTable'],  // Both are optional for backward compatibility
                stats: {
                    required: ['hp', 'damage', 'speed', 'size'],
                    types: {
                        hp: 'number',
                        damage: 'number',
                        speed: 'number',
                        size: 'number',
                        armor: 'number',
                        xp: 'number'
                    },
                    ranges: {
                        hp: [1, 10000],
                        damage: [0, 1000],
                        speed: [0, 500],
                        size: [1, 100],
                        armor: [0, 100],
                        xp: [0, 1000]
                    }
                },
                ai: {
                    required: ['behavior'],
                    validBehaviors: ['chase', 'shoot', 'patrol', 'support', 'swarm']
                },
                drops: {
                    type: 'array',
                    itemSchema: {
                        required: ['itemId', 'chance'],
                        optional: ['quantity'],
                        types: {
                            itemId: 'string',
                            chance: 'number',
                            quantity: 'number'
                        },
                        ranges: {
                            chance: [0, 1],
                            quantity: [1, 100]
                        }
                    }
                }
            },
            
            boss: {
                required: ['id', 'type', 'stats', 'mechanics'],
                optional: ['drops'],  // Drops are optional but recommended for bosses
                stats: {
                    required: ['hp', 'damage', 'speed', 'size'],
                    ranges: {
                        hp: [100, 100000],
                        damage: [5, 1000],
                        speed: [10, 200],
                        size: [20, 100]
                    }
                },
                mechanics: {
                    required: ['phases'],
                    phases: {
                        minCount: 1,
                        required: ['thresholdPct', 'abilities']
                    }
                }
            },
            
            elite: {
                required: ['id', 'type', 'baseEnemyId', 'multipliers'],
                multipliers: {
                    required: ['hp', 'damage'],
                    types: {
                        hp: 'number',
                        damage: 'number',
                        speed: 'number',
                        size: 'number',
                        armor: 'number',
                        xp: 'number'
                    },
                    ranges: {
                        hp: [1.5, 10],
                        damage: [1.2, 5],
                        speed: [0.5, 3],
                        size: [1, 2]
                    }
                }
            },
            
            item: {
                required: ['id', 'type', 'name', 'category', 'rarity', 'effect'],
                validCategories: ['xp', 'health', 'special', 'powerup', 'currency'],
                validRarities: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
                effect: {
                    required: ['type'],
                    validTypes: ['xp', 'heal', 'instant_kill', 'energy', 'research']
                },
                pickup: {
                    optional: ['magnetRange', 'pickupRadius', 'lifetime', 'autoPickup', 'bobbing'],
                    types: {
                        magnetRange: 'number',
                        pickupRadius: 'number',
                        lifetime: 'number',
                        autoPickup: 'boolean',
                        bobbing: 'boolean'
                    }
                }
            },
            
            powerup: {
                required: ['id', 'type'],
                optional: ['stats', 'mechanics', 'effects', 'display', 'vfx', 'sfx'],
                stats: {
                    required: [],
                    optional: ['maxLevel', 'rarity'],
                    validRarities: ['common', 'rare', 'epic', 'legendary']
                },
                mechanics: {
                    required: [],
                    optional: ['modifiersPerLevel', 'stackable', 'persistent']
                }
            },
            
            projectile: {
                required: ['id', 'type'],  // Only id and type are truly required
                // Accept both old and new formats
                optional: ['physics', 'damage', 'stats', 'graphics'],
                stats: {
                    required: [],  // All optional
                    optional: ['damage', 'speed', 'range', 'size', 'pierce', 'lifetime'],
                    ranges: {
                        speed: [50, 2000],
                        size: [1, 50]
                    }
                },
                damage: {
                    required: ['amount'],
                    validTypes: ['normal', 'fire', 'ice', 'toxic', 'electric']
                }
            },
            
            spawnTable: {
                required: ['id', 'type', 'level'],
                validFields: ['enemyWaves', 'eliteWindows', 'uniqueSpawns', 'bossTriggers']
            }
        };
    }
    
    /**
     * Validate a blueprint against its schema
     */
    validate(blueprint) {
        const errors = [];
        const warnings = [];
        
        if (!blueprint) {
            errors.push('Blueprint is null or undefined');
            return { valid: false, errors, warnings };
        }
        
        if (!blueprint.type) {
            errors.push('Blueprint missing required field: type');
            return { valid: false, errors, warnings };
        }
        
        const schema = this.schemas[blueprint.type];
        if (!schema) {
            warnings.push(`No schema defined for type: ${blueprint.type}`);
            return { valid: true, errors, warnings };
        }
        
        // Check required fields
        this.checkRequired(blueprint, schema.required, '', errors);
        
        // Type-specific validation
        switch (blueprint.type) {
            case 'enemy':
                this.validateEnemy(blueprint, schema, errors, warnings);
                break;
            case 'boss':
                this.validateBoss(blueprint, schema, errors, warnings);
                break;
            case 'elite':
                this.validateElite(blueprint, schema, errors, warnings);
                break;
            case 'powerup':
                this.validatePowerup(blueprint, schema, errors, warnings);
                break;
            case 'projectile':
                this.validateProjectile(blueprint, schema, errors, warnings);
                break;
            case 'spawnTable':
                this.validateSpawnTable(blueprint, schema, errors, warnings);
                break;
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Check required fields recursively
     */
    checkRequired(obj, required, path, errors) {
        if (!required) return;
        
        for (const field of required) {
            if (!(field in obj)) {
                errors.push(`Missing required field: ${path}${field}`);
            }
        }
    }
    
    /**
     * Validate numeric ranges
     */
    validateRange(value, range, field, errors) {
        if (typeof value !== 'number') {
            errors.push(`${field} must be a number, got ${typeof value}`);
            return;
        }
        
        if (value < range[0] || value > range[1]) {
            errors.push(`${field} value ${value} out of range [${range[0]}, ${range[1]}]`);
        }
    }
    
    /**
     * Validate enemy blueprint
     */
    validateEnemy(blueprint, schema, errors, warnings) {
        // Validate stats
        if (blueprint.stats) {
            const statsSchema = schema.stats;
            this.checkRequired(blueprint.stats, statsSchema.required, 'stats.', errors);
            
            // Check ranges
            for (const [field, range] of Object.entries(statsSchema.ranges)) {
                if (field in blueprint.stats) {
                    this.validateRange(blueprint.stats[field], range, `stats.${field}`, errors);
                }
            }
        }
        
        // Validate AI
        if (blueprint.ai) {
            const aiSchema = schema.ai;
            this.checkRequired(blueprint.ai, aiSchema.required, 'ai.', errors);
            
            if (blueprint.ai.behavior && !aiSchema.validBehaviors.includes(blueprint.ai.behavior)) {
                warnings.push(`Unknown AI behavior: ${blueprint.ai.behavior}`);
            }
        }
        
        // Check graphics
        if (!blueprint.graphics || !blueprint.graphics.tint) {
            warnings.push('No tint color specified, will use default');
        }
        
        // Validate VFX fields
        if (blueprint.vfx) {
            this.validateVFXFields(blueprint.vfx, 'vfx', errors, warnings);
        }
    }
    
    /**
     * Validate VFX fields (can be strings or objects)
     */
    validateVFXFields(vfxObject, path, errors, warnings) {
        if (!vfxObject || typeof vfxObject !== 'object') return;
        
        for (const [key, value] of Object.entries(vfxObject)) {
            const fieldPath = `${path}.${key}`;
            const validation = FieldDefinitions.validateVFXValue(value);
            
            if (!validation.valid) {
                errors.push(`${fieldPath}: ${validation.error}`);
            }
        }
    }
    
    /**
     * Validate boss blueprint
     */
    validateBoss(blueprint, schema, errors, warnings) {
        // Validate stats
        if (blueprint.stats) {
            const statsSchema = schema.stats;
            this.checkRequired(blueprint.stats, statsSchema.required, 'stats.', errors);
            
            for (const [field, range] of Object.entries(statsSchema.ranges)) {
                if (field in blueprint.stats) {
                    this.validateRange(blueprint.stats[field], range, `stats.${field}`, errors);
                }
            }
        }
        
        // Validate VFX fields
        if (blueprint.vfx) {
            this.validateVFXFields(blueprint.vfx, 'vfx', errors, warnings);
        }
        
        // Validate mechanics
        if (blueprint.mechanics) {
            const mechSchema = schema.mechanics;
            this.checkRequired(blueprint.mechanics, mechSchema.required, 'mechanics.', errors);
            
            // Validate phases
            if (blueprint.mechanics.phases) {
                if (!Array.isArray(blueprint.mechanics.phases)) {
                    errors.push('mechanics.phases must be an array');
                } else if (blueprint.mechanics.phases.length < mechSchema.phases.minCount) {
                    errors.push(`Boss must have at least ${mechSchema.phases.minCount} phase(s)`);
                } else {
                    // Validate each phase
                    blueprint.mechanics.phases.forEach((phase, i) => {
                        this.checkRequired(phase, mechSchema.phases.required, `mechanics.phases[${i}].`, errors);
                        
                        // Check threshold values
                        if (typeof phase.thresholdPct === 'number') {
                            if (phase.thresholdPct < 0 || phase.thresholdPct > 1) {
                                errors.push(`Phase ${i} thresholdPct must be between 0 and 1`);
                            }
                        }
                    });
                }
            }
        }
    }
    
    /**
     * Validate elite blueprint
     */
    validateElite(blueprint, schema, errors, warnings) {
        // Check base enemy reference
        if (blueprint.baseEnemyId) {
            // Could validate that baseEnemyId exists
            if (!blueprint.baseEnemyId.startsWith('enemy.')) {
                warnings.push('baseEnemyId should reference an enemy blueprint');
            }
        }
        
        // Validate multipliers
        if (blueprint.multipliers) {
            const multSchema = schema.multipliers;
            this.checkRequired(blueprint.multipliers, multSchema.required, 'multipliers.', errors);
            
            for (const [field, range] of Object.entries(multSchema.ranges)) {
                if (field in blueprint.multipliers) {
                    this.validateRange(blueprint.multipliers[field], range, `multipliers.${field}`, errors);
                }
            }
        }
    }
    
    /**
     * Validate powerup blueprint
     */
    validatePowerup(blueprint, schema, errors, warnings) {
        // Validate stats
        if (blueprint.stats) {
            const statsSchema = schema.stats;
            this.checkRequired(blueprint.stats, statsSchema.required, 'stats.', errors);

            if (blueprint.stats.rarity && !statsSchema.validRarities.includes(blueprint.stats.rarity)) {
                errors.push(`Invalid rarity: ${blueprint.stats.rarity}`);
            }
        }

        // Validate mechanics.modifiersPerLevel (new format)
        if (blueprint.mechanics && blueprint.mechanics.modifiersPerLevel) {
            if (!Array.isArray(blueprint.mechanics.modifiersPerLevel)) {
                errors.push('mechanics.modifiersPerLevel must be an array');
            } else if (blueprint.mechanics.modifiersPerLevel.length === 0) {
                warnings.push('Powerup has empty modifiersPerLevel array');
            }
        }

        // Legacy effects[] support
        if (blueprint.effects) {
            if (!Array.isArray(blueprint.effects)) {
                errors.push('effects must be an array');
            }
            warnings.push('Using legacy effects[] format. Consider migrating to mechanics.modifiersPerLevel.');
        }

        // Warn if neither format present
        if (!blueprint.effects && !(blueprint.mechanics && blueprint.mechanics.modifiersPerLevel)) {
            warnings.push('Powerup has no modifiers defined (neither mechanics.modifiersPerLevel nor effects[])');
        }
    }
    
    /**
     * Validate projectile blueprint
     */
    validateProjectile(blueprint, schema, errors, warnings) {
        // Support both old format (physics/damage) and new format (stats/graphics)
        
        // Check if using new format with stats
        if (blueprint.stats) {
            // Validate stats fields
            const statsSchema = schema.stats;
            if (statsSchema && statsSchema.ranges) {
                for (const [field, range] of Object.entries(statsSchema.ranges)) {
                    if (field in blueprint.stats) {
                        this.validateRange(blueprint.stats[field], range, `stats.${field}`, errors);
                    }
                }
            }
        }
        
        // Check if using new format with graphics
        if (blueprint.graphics) {
            // Validate graphics fields
            if (blueprint.graphics.shape) {
                const validShapes = ['circle', 'hexagon', 'square', 'triangle', 'star', 'diamond'];
                if (!validShapes.includes(blueprint.graphics.shape)) {
                    warnings.push(`Unknown shape: ${blueprint.graphics.shape}`);
                }
            }
        }
        
        // Old format support (for backward compatibility)
        if (blueprint.physics) {
            // Just validate if present, don't require
            if (schema.physics && schema.physics.ranges) {
                for (const [field, range] of Object.entries(schema.physics.ranges)) {
                    if (field in blueprint.physics) {
                        this.validateRange(blueprint.physics[field], range, `physics.${field}`, errors);
                    }
                }
            }
        }
        
        // Old format damage validation
        if (blueprint.damage) {
            // Just validate if present, don't require
            if (blueprint.damage.type && schema.damage && schema.damage.validTypes) {
                if (!schema.damage.validTypes.includes(blueprint.damage.type)) {
                    warnings.push(`Unknown damage type: ${blueprint.damage.type}`);
                }
            }
        }
    }
    
    /**
     * Validate spawn table blueprint
     */
    validateSpawnTable(blueprint, schema, errors, warnings) {
        // Check level
        if (typeof blueprint.level !== 'number' || blueprint.level < 1) {
            errors.push('Spawn table must have a valid level (>= 1)');
        }
        
        // Check that at least one spawn type is defined
        const hasSpawns = schema.validFields.some(field => 
            blueprint[field] && Array.isArray(blueprint[field]) && blueprint[field].length > 0
        );
        
        if (!hasSpawns) {
            warnings.push('Spawn table has no enemy waves or triggers defined');
        }
    }
    
    /**
     * Get validation summary
     */
    getSummary(validation) {
        if (validation.valid) {
            if (validation.warnings.length > 0) {
                return `Valid with ${validation.warnings.length} warning(s)`;
            }
            return 'Valid';
        }
        return `Invalid: ${validation.errors.length} error(s)`;
    }
}

export default SchemaValidator;