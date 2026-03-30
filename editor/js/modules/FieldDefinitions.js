/**
 * FieldDefinitions.js - Definitions for smart field editing
 * Provides dropdowns, tooltips, and specialized editors for blueprint fields
 */

export class FieldDefinitions {
    constructor() {
        this.audioData = null;
        this.itemData = null;
        this.loadingPromises = [];
        this.loadingPromises.push(this.loadAudioManifest());
        this.loadingPromises.push(this.loadItemData());
    }
    
    /**
     * Wait for all initialization to complete
     */
    async waitForInitialization() {
        await Promise.all(this.loadingPromises);
    }
    
    /**
     * Load audio data - PR7 compliant, uses AudioScanner
     */
    async loadAudioManifest() {
        try {
            // PR7: Import AudioScanner instead of loading manifest
            const { audioScanner } = await import('./AudioScanner.js');
            const audioFiles = await audioScanner.getAudioFiles();
            
            // Convert to old format for compatibility
            this.audioData = {
                sfx: {},
                music: {},
                sfxExtended: {}
            };
            
            // Map files to old format (key -> path)
            audioFiles.sfx.forEach(file => {
                this.audioData.sfx[file.key] = file.path;
                // Also add with sfx. prefix for compatibility
                this.audioData.sfx['sfx.' + file.key] = file.path;
            });
            
            audioFiles.music.forEach(file => {
                this.audioData.music[file.key] = file.path;
            });
            
            console.log('[FieldDefinitions] Loaded audio data with', audioFiles.all.length, 'files from AudioScanner');
            
        } catch (error) {
            console.error('[FieldDefinitions] Failed to load audio data:', error);
            // Fallback to hardcoded data
            this.audioData = {
                sfx: {
                    'hit': 'sound/player_hit.mp3',
                    'playerDeath': 'sound/player_death.mp3',
                    'player_hit': 'sound/player_hit.mp3',
                    'player_death': 'sound/player_death.mp3',
                    'player_spawn': 'sound/player_spawn.mp3',
                    'levelup': 'sound/levelup.mp3',
                    'heal': 'sound/heal.mp3',
                    'shoot': 'sound/shoot.mp3',
                    'player_shoot': 'sound/player_shoot.mp3',
                    'laser': 'sound/laser.mp3',
                    'npc_death': 'sound/npc_death.mp3',
                    'npc_hit': 'sound/npc_hit.mp3',
                    'boss_enter': 'sound/boss_enter.mp3',
                    'boss_death': 'sound/boss_death.mp3',
                    'pickup': 'sound/pickup.mp3',
                    'powerup': 'sound/powerup.mp3'
                },
                sfxExtended: {
                    'explosion_small': 'sound/explosion_small.mp3',
                    'explosion_large': 'sound/explosion_large.mp3'
                }
            };
        }
    }
    
    /**
     * Load item data for drop editors
     */
    async loadItemData() {
        try {
            // Load all available items from the registry
            const items = {
                xp: [
                    { id: 'item.xp_small', name: 'Small XP', icon: '⭐', value: 5 },
                    { id: 'item.xp_medium', name: 'Medium XP', icon: '⭐⭐', value: 10 },
                    { id: 'item.xp_large', name: 'Large XP', icon: '⭐⭐⭐', value: 25 }
                ],
                health: [
                    { id: 'item.health_small', name: 'Small Health', icon: '❤️', value: 10 },
                    { id: 'item.heal_orb', name: 'Heal Orb', icon: '💚', value: 20 },
                    { id: 'item.protein_cache', name: 'Protein Cache', icon: '🥩', value: 'full' }
                ],
                special: [
                    { id: 'item.energy_cell', name: 'Energy Cell', icon: '🔋', effect: 'energy' },
                    { id: 'item.metotrexat', name: 'Metotrexat', icon: '💊', effect: 'instant_kill' },
                    { id: 'item.research_point', name: 'Research Point', icon: '🔬', effect: 'research' }
                ]
            };
            
            this.itemData = items;
            console.log('[FieldDefinitions] Loaded item data with', 
                Object.values(items).reduce((sum, cat) => sum + cat.length, 0), 'items');
        } catch (error) {
            console.error('[FieldDefinitions] Failed to load item data:', error);
            // Use fallback item list
            this.itemData = {
                xp: [], health: [], special: []
            };
        }
    }
    
    static getFieldDef(path, type) {
        // Build full path for matching
        const fullPath = `${type}.${path}`;
        
        // Check specific paths first, then general ones
        return this.definitions[fullPath] || this.definitions[path] || null;
    }
    
    static definitions = {
        // === Universal fields ===
        'type': {
            type: 'select',
            options: ['enemy', 'boss', 'elite', 'unique', 'powerup', 'projectile', 'drop', 'loot', 'spawn', 'player', 'system', 'config'],
            tooltip: 'Blueprint type determines how the entity behaves in the game',
            required: true
        },
        
        // === Config fields (main_config.json5) ===
        'audio.scenes.mainMenu.backgroundMusic': {
            type: 'audio',
            category: 'music',
            tooltip: 'Background music for main menu',
            placeholder: 'music/8bit_main_menu.mp3'
        },
        
        'audio.scenes.game.tracks': {
            type: 'audio_array',
            category: 'music',
            tooltip: 'List of music tracks for gameplay. Will play randomly if randomize is enabled.',
            placeholder: 'Add music track...'
        },
        
        'audio.scenes.boss.tracks': {
            type: 'audio_array',
            category: 'music',
            tooltip: 'List of music tracks for boss battles',
            placeholder: 'Add boss music track...'
        },
        
        'audio.scenes.mainMenu.volume': {
            type: 'number',
            min: 0,
            max: 1,
            step: 0.1,
            tooltip: 'Volume for main menu music (0-1)',
            default: 0.5
        },
        
        'audio.scenes.game.volume': {
            type: 'number',
            min: 0,
            max: 1,
            step: 0.1,
            tooltip: 'Volume for game music (0-1)',
            default: 0.4
        },
        
        'audio.scenes.boss.volume': {
            type: 'number',
            min: 0,
            max: 1,
            step: 0.1,
            tooltip: 'Volume for boss music (0-1)',
            default: 0.6
        },
        
        'audio.scenes.game.randomize': {
            type: 'checkbox',
            tooltip: 'If true, game tracks will play in random order',
            default: true
        },
        
        'audio.scenes.mainMenu.loop': {
            type: 'checkbox',
            tooltip: 'If true, menu music will loop continuously',
            default: true
        },
        
        'audio.scenes.game.loop': {
            type: 'checkbox',
            tooltip: 'If true, each game track will loop before switching to next',
            default: true
        },
        
        'audio.scenes.boss.loop': {
            type: 'checkbox',
            tooltip: 'If true, boss music will loop',
            default: true
        },
        
        'audio.scenes.mainMenu.fadeIn': {
            type: 'number',
            min: 0,
            max: 5000,
            step: 100,
            tooltip: 'Fade in duration in milliseconds',
            default: 1000
        },
        
        'audio.scenes.mainMenu.fadeOut': {
            type: 'number',
            min: 0,
            max: 5000,
            step: 100,
            tooltip: 'Fade out duration in milliseconds',
            default: 500
        },
        
        // === Enemy fields ===
        'enemy.ai.behavior': {
            type: 'select',
            options: ['chase', 'shoot', 'patrol', 'support', 'swarm', 'ambush', 'flee'],
            tooltip: 'AI behavior pattern:\n• chase - Follows player directly\n• shoot - Maintains distance and shoots\n• patrol - Moves in patterns\n• support - Heals/buffs allies\n• swarm - Groups with others\n• ambush - Hides and attacks\n• flee - Runs from player',
            default: 'chase'
        },
        
        'mechanics.movementType': {
            type: 'select',
            options: ['linear', 'adaptive', 'erratic', 'orbit', 'zigzag', 'stationary', 'charge', 'swarm', 'artillery_position', 'hyper_agile'],
            tooltip: 'How the enemy moves:\n• linear - Straight lines\n• adaptive - Adjusts to player\n• erratic - Random movements\n• orbit - Circles around target\n• zigzag - Zig-zag pattern\n• stationary - Doesn\'t move\n• charge - Rushes at player\n• swarm - Moves in groups',
            default: 'linear'
        },
        
        'stats.rarity': {
            type: 'select',
            options: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],
            tooltip: 'Rarity affects drop rates and visual effects',
            default: 'common'
        },
        
        'ai.params.targetPriority': {
            type: 'select',
            options: ['nearest', 'weakest', 'strongest', 'player', 'random', 'farthest'],
            tooltip: 'Which target to prioritize when multiple are available',
            default: 'nearest'
        },
        
        'ai.params.movePattern': {
            type: 'select',
            options: ['direct', 'zigzag', 'orbit', 'spiral', 'random', 'predictive', 'flanking', 'hit_and_run', 'kite', 'slow_tank', 'aberrant_wobble', 'support_hover', 'kite_player'],
            tooltip: 'Specific movement pattern within the behavior type',
            default: 'direct'
        },
        
        // === Boss fields ===
        'boss.mechanics.phases': {
            type: 'phase-editor',
            tooltip: 'Boss phases activate at different HP thresholds. Each phase can have different abilities and behavior.',
            help: 'Click "Edit Phases" to open the phase editor'
        },
        
        'boss.mechanics.abilities': {
            type: 'ability-editor',
            tooltip: 'Special abilities the boss can use. Define damage, cooldown, and visual effects.',
            help: 'Click "Edit Abilities" to configure boss abilities'
        },
        
        // === Modifier fields ===
        'modifiers': {
            type: 'modifier-editor',
            tooltip: 'Modifiers change entity stats dynamically. They can add, multiply, or override values.',
            help: 'Modifiers are powerful tools for creating variations'
        },
        
        'modifiers.type': {
            type: 'select',
            options: ['add', 'mul', 'set', 'enable', 'disable'],
            tooltip: 'Modifier operation:\n• add - Adds to current value\n• mul - Multiplies current value\n• set - Replaces value\n• enable - Enables feature\n• disable - Disables feature',
            default: 'add'
        },
        
        'modifiers.path': {
            type: 'path-selector',
            tooltip: 'Path to the value being modified (e.g., stats.hp, mechanics.speed)',
            placeholder: 'stats.hp',
            suggestions: [
                'stats.hp', 'stats.damage', 'stats.speed', 'stats.armor', 'stats.size',
                'mechanics.movementType', 'mechanics.contactDamage', 'mechanics.aggroRange',
                'ai.behavior', 'ai.params.aggroRange', 'graphics.tint', 'graphics.scale'
            ]
        },
        
        // === Projectile fields ===
        'projectile.damage.type': {
            type: 'select',
            options: ['normal', 'fire', 'ice', 'toxic', 'electric', 'laser', 'explosive', 'piercing'],
            tooltip: 'Damage type affects resistances and visual effects',
            default: 'normal'
        },
        
        'physics.piercing': {
            type: 'checkbox',
            tooltip: 'If true, projectile goes through enemies instead of stopping',
            default: false
        },
        
        'physics.tracking': {
            type: 'checkbox',
            tooltip: 'If true, projectile homes in on targets',
            default: false
        },
        
        // === Powerup fields ===
        'powerup.effects.stat': {
            type: 'select',
            options: ['damage', 'attackSpeed', 'moveSpeed', 'maxHp', 'armor', 'critChance', 'critDamage', 'projectileCount', 'projectileSpeed', 'range'],
            tooltip: 'Which player stat to modify',
            default: 'damage'
        },
        
        'powerup.effects.type': {
            type: 'select',
            options: ['add', 'multiply', 'set'],
            tooltip: 'How to apply the effect:\n• add - Add value to stat\n• multiply - Multiply stat by value\n• set - Set stat to value',
            default: 'multiply'
        },
        
        // === NEW: Direct drop system fields ===
        'drops': {
            type: 'drops_array',
            tooltip: 'Direct drop definitions - items that can drop when this entity dies',
            custom: true  // Will use custom renderer
        },
        
        'drops[].itemId': {
            type: 'item_reference',
            referenceType: 'item',
            tooltip: 'ID of the item to drop (e.g., item.xp_small)',
            placeholder: 'item.xp_small'
        },
        
        'drops[].chance': {
            type: 'percentage',
            tooltip: 'Chance for this item to drop (0.0 to 1.0)',
            min: 0,
            max: 1,
            step: 0.01,
            default: 0.5
        },
        
        'drops[].quantity': {
            type: 'number',
            tooltip: 'Number of items to drop (optional, default is 1)',
            min: 1,
            max: 100,
            default: 1
        },
        
        // Legacy lootTable field (for backward compatibility)
        'lootTable': {
            type: 'reference',
            referenceType: 'lootTable',
            tooltip: '[DEPRECATED] Use drops array instead. Legacy loot table reference',
            placeholder: '',
            deprecated: true
        },
        
        // === Visual fields ===
        'graphics.tint': {
            type: 'color',
            tooltip: 'Tint color applied to the sprite (hex format: 0xRRGGBB)',
            default: '0xFFFFFF'
        },
        
        'display.color': {
            type: 'color',
            tooltip: 'Display color used in UI elements',
            default: '#4CAF50'
        },
        
        'visuals.tint': {
            type: 'color',
            tooltip: 'Visual tint color for the entity',
            default: '0xFFFFFF'
        },
        
        'graphics.scale': {
            type: 'range',
            min: 0.1,
            max: 5,
            step: 0.1,
            tooltip: 'Visual scale of the sprite (1.0 = normal size)',
            default: 1.0
        },
        
        'graphics.shape': {
            type: 'select',
            options: ['circle', 'hexagon', 'square', 'triangle', 'star', 'diamond'],
            tooltip: 'Shape for placeholder texture:\n• circle - Standard circular shape\n• hexagon - 6-sided polygon (XP orbs)\n• square - 4-sided rectangle\n• triangle - 3-sided shape\n• star - 5-pointed star shape\n• diamond - Rotated square shape',
            default: 'circle'
        },
        
        'vfx.spawn': {
            type: 'vfx-selector',
            tooltip: 'Visual effect played when entity spawns',
            category: 'spawn'
        },
        
        'vfx.death': {
            type: 'vfx-selector',
            tooltip: 'Visual effect played when entity dies',
            category: 'death'
        },
        
        'vfx.hit': {
            type: 'vfx-selector',
            tooltip: 'Visual effect played when entity is hit',
            category: 'hit'
        },
        
        'vfx.shoot': {
            type: 'vfx-selector',
            tooltip: 'Visual effect played when entity shoots',
            category: 'shoot'
        },
        
        // === Boss VFX fields ===
        'vfx.phase1': {
            type: 'vfx-selector',
            tooltip: 'Visual effect for boss phase 1 transition',
            category: 'boss'
        },
        
        'vfx.phase2': {
            type: 'vfx-selector',
            tooltip: 'Visual effect for boss phase 2 transition',
            category: 'boss'
        },
        
        'vfx.phase3': {
            type: 'vfx-selector',
            tooltip: 'Visual effect for boss phase 3 transition',
            category: 'boss'
        },
        
        // Boss ability VFX patterns
        'vfx.radiation_pulse': {
            type: 'vfx-selector',
            tooltip: 'Visual effect for radiation pulse ability',
            category: 'boss-ability'
        },
        
        'vfx.beam_sweep': {
            type: 'vfx-selector',
            tooltip: 'Visual effect for beam sweep ability',
            category: 'boss-ability'
        },
        
        'vfx.toxic_pools': {
            type: 'vfx-selector',
            tooltip: 'Visual effect for toxic pools ability',
            category: 'boss-ability'
        },
        
        'vfx.aura': {
            type: 'vfx-selector',
            tooltip: 'Continuous visual aura effect',
            category: 'aura'
        },
        
        'sfx.spawn': {
            type: 'sfx-selector',
            tooltip: 'Sound effect played when entity spawns',
            category: 'spawn'
        },
        
        'sfx.hit': {
            type: 'sfx-selector',
            tooltip: 'Sound effect played when entity is hit',
            category: 'hit'
        },
        
        'sfx.death': {
            type: 'sfx-selector',
            tooltip: 'Sound effect played when entity dies',
            category: 'death'
        },
        
        'sfx.shoot': {
            type: 'sfx-selector',
            tooltip: 'Sound effect played when entity shoots',
            category: 'shoot'
        },
        
        'sfx.pickup': {
            type: 'sfx-selector',
            tooltip: 'Sound effect played when item is picked up',
            category: 'pickup'
        },
        
        // === Player SFX fields ===
        'sfx.heal': {
            type: 'sfx-selector',
            tooltip: 'Sound effect played when player heals',
            category: 'player'
        },
        
        'sfx.levelUp': {
            type: 'sfx-selector',
            tooltip: 'Sound effect played when player levels up',
            category: 'player'
        },
        
        // Player nested shield SFX
        'sfx.shield.activate': {
            type: 'sfx-selector',
            tooltip: 'Sound effect when shield is activated',
            category: 'shield'
        },
        
        'sfx.shield.block': {
            type: 'sfx-selector',
            tooltip: 'Sound effect when shield blocks damage',
            category: 'shield'
        },
        
        'sfx.shield.break': {
            type: 'sfx-selector',
            tooltip: 'Sound effect when shield breaks',
            category: 'shield'
        },
        
        // === Boss SFX fields ===
        'sfx.phase1': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for boss phase 1 transition',
            category: 'boss'
        },
        
        'sfx.phase2': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for boss phase 2 transition',
            category: 'boss'
        },
        
        'sfx.phase3': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for boss phase 3 transition',
            category: 'boss'
        },
        
        // Boss ability SFX patterns
        'sfx.radiation_pulse': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for radiation pulse ability',
            category: 'boss-ability'
        },
        
        'sfx.beam_sweep': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for beam sweep ability',
            category: 'boss-ability'
        },
        
        'sfx.toxic_pools': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for toxic pools ability',
            category: 'boss-ability'
        },
        
        'sfx.summon_irradiated': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for summon ability',
            category: 'boss-ability'
        },
        
        'sfx.radiation_storm': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for radiation storm ability',
            category: 'boss-ability'
        },
        
        'sfx.rapid_beams': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for rapid beams ability',
            category: 'boss-ability'
        },
        
        'sfx.massive_summon': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for massive summon ability',
            category: 'boss-ability'
        },
        
        'sfx.core_overload': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for core overload ability',
            category: 'boss-ability'
        },
        
        // === Spawn table / System audio ===
        'backgroundMusic': {
            type: 'sfx-selector',
            tooltip: 'Background music for this level',
            category: 'music'
        },
        
        'music.background': {
            type: 'sfx-selector',
            tooltip: 'Background music track',
            category: 'music'
        },
        
        'music.boss': {
            type: 'sfx-selector',
            tooltip: 'Boss fight music track',
            category: 'music'
        },
        
        // === General audio patterns ===
        'sfx.buff': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for buff/enhancement',
            category: 'effect'
        },
        
        'sfx.debuff': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for debuff/weakness',
            category: 'effect'
        },
        
        'sfx.ability': {
            type: 'sfx-selector',
            tooltip: 'Sound effect for special ability',
            category: 'ability'
        },
        
        'sfx.ambient': {
            type: 'sfx-selector',
            tooltip: 'Ambient/background sound effect',
            category: 'ambient'
        },
        
        // === Numeric ranges ===
        'stats.hp': {
            type: 'number',
            min: 1,
            max: 10000,
            step: 1,
            tooltip: 'Health points - how much damage entity can take',
            default: 30
        },
        
        'stats.damage': {
            type: 'number',
            min: 0,
            max: 1000,
            step: 1,
            tooltip: 'Base damage dealt to player on contact or attack',
            default: 5
        },
        
        'stats.speed': {
            type: 'number',
            min: 0,
            max: 500,
            step: 5,
            tooltip: 'Movement speed in pixels per second',
            default: 50
        },
        
        'stats.armor': {
            type: 'number',
            min: 0,
            max: 100,
            step: 1,
            tooltip: 'Damage reduction - each point reduces damage by 1',
            default: 0
        },
        
        'stats.size': {
            type: 'number',
            min: 1,
            max: 100,
            step: 1,
            tooltip: 'Collision size in pixels',
            default: 16
        },
        
        'stats.xp': {
            type: 'number',
            min: 0,
            max: 1000,
            step: 1,
            tooltip: 'Experience points given to player when killed',
            default: 5
        },
        
        'mechanics.aggroRange': {
            type: 'number',
            min: 0,
            max: 1000,
            step: 10,
            tooltip: 'Distance at which enemy detects and targets player',
            default: 200
        },
        
        'mechanics.wanderRadius': {
            type: 'number',
            min: 0,
            max: 500,
            step: 10,
            tooltip: 'Radius for random wandering when not attacking',
            default: 50
        },
        
        'mechanics.dropChance': {
            type: 'range',
            min: 0,
            max: 1,
            step: 0.01,
            tooltip: 'Chance to drop loot (0 = never, 1 = always)',
            default: 0.1
        },
        
        'mechanics.healthDropChance': {
            type: 'range',
            min: 0,
            max: 1,
            step: 0.01,
            tooltip: 'Chance to drop health pack',
            default: 0.05
        },

        'mechanics.contactDamage': {
            type: 'number',
            min: 0,
            max: 500,
            step: 1,
            tooltip: 'Damage dealt on contact with the player (0 = no contact damage)',
            default: 0
        },

        'mechanics.attackRange': {
            type: 'number',
            min: 0,
            max: 1000,
            step: 10,
            tooltip: 'Distance at which enemy can attack the player',
            default: 150
        },

        'mechanics.shootCooldown': {
            type: 'number',
            min: 100,
            max: 30000,
            step: 100,
            tooltip: 'Cooldown between ranged attacks in milliseconds',
            default: 2000
        },

        'mechanics.swarmBehavior': {
            type: 'checkbox',
            tooltip: 'If true, enemy uses swarm movement coordinated with nearby allies',
            default: false
        }
    };
    
    /**
     * Get tooltip for a field
     */
    static getTooltip(path, type) {
        const def = this.getFieldDef(path, type);
        return def?.tooltip || null;
    }
    
    /**
     * Get field type (select, number, etc.)
     */
    static getFieldType(path, type) {
        const def = this.getFieldDef(path, type);
        return def?.type || null;
    }
    
    /**
     * Get options for select fields
     */
    static getOptions(path, type) {
        const def = this.getFieldDef(path, type);
        return def?.options || [];
    }
    
    /**
     * Get default value for a field
     */
    static getDefault(path, type) {
        const def = this.getFieldDef(path, type);
        return def?.default !== undefined ? def.default : null;
    }
    
    /**
     * Check if field is required
     */
    static isRequired(path, type) {
        const def = this.getFieldDef(path, type);
        return def?.required || false;
    }
    
    /**
     * Get all known VFX types
     */
    static getVFXTypes() {
        return {
            spawn: [
                'vfx.enemy.spawn.default',
                'vfx.enemy.spawn.elite.major',
                'vfx.enemy.spawn.swarm',
                'vfx.boss.enter'
            ],
            death: [
                'vfx.enemy.death.small',
                'vfx.enemy.death.burst',
                'vfx.enemy.death.elite.explosion',
                'vfx.boss.death.massive'
            ],
            hit: [
                'vfx.hit.spark.small',
                'vfx.hit.spark.generic',
                'vfx.hit.spark.armored',
                'vfx.hit.blood'
            ],
            aura: [
                'vfx.enemy.aura.toxic',
                'vfx.enemy.aura.aberrant',
                'vfx.elite.aura.speed',
                'vfx.boss.aura.radiation'
            ]
        };
    }
    
    /**
     * Validate VFX value (can be string registry ID or config object)
     */
    static validateVFXValue(value) {
        if (!value) return { valid: true }; // Optional field
        
        // String format - registry ID
        if (typeof value === 'string') {
            if (!value.startsWith('vfx.')) {
                return { 
                    valid: false, 
                    error: 'VFX registry ID must start with "vfx."' 
                };
            }
            return { valid: true };
        }
        
        // Object format - direct config
        if (typeof value === 'object' && value !== null) {
            // Required fields
            if (!value.type) {
                return { 
                    valid: false, 
                    error: 'VFX config must have a "type" field' 
                };
            }
            
            // Validate type
            const validTypes = ['spark', 'explosion', 'energy', 'smoke', 'blood', 'hit', 'trail'];
            if (!validTypes.includes(value.type)) {
                return { 
                    valid: false, 
                    error: `Invalid VFX type: ${value.type}. Must be one of: ${validTypes.join(', ')}` 
                };
            }
            
            // Validate numeric fields
            if (value.quantity !== undefined && (typeof value.quantity !== 'number' || value.quantity < 1)) {
                return { 
                    valid: false, 
                    error: 'VFX quantity must be a positive number' 
                };
            }
            
            if (value.lifespan !== undefined && (typeof value.lifespan !== 'number' || value.lifespan < 0)) {
                return { 
                    valid: false, 
                    error: 'VFX lifespan must be a non-negative number' 
                };
            }
            
            // Validate speed object
            if (value.speed) {
                if (typeof value.speed !== 'object' || !value.speed.min === undefined || !value.speed.max === undefined) {
                    return { 
                        valid: false, 
                        error: 'VFX speed must be an object with min and max properties' 
                    };
                }
            }
            
            // Validate scale object
            if (value.scale) {
                if (typeof value.scale !== 'object' || value.scale.start === undefined || value.scale.end === undefined) {
                    return { 
                        valid: false, 
                        error: 'VFX scale must be an object with start and end properties' 
                    };
                }
            }
            
            return { valid: true };
        }
        
        return { 
            valid: false, 
            error: 'VFX value must be a string (registry ID) or object (config)' 
        };
    }
    
    /**
     * Get all known SFX types
     */
    /**
     * Get all available SFX options from audio manifest
     */
    static getSFXTypes() {
        const instance = FieldDefinitions.instance || new FieldDefinitions();
        FieldDefinitions.instance = instance;
        
        if (!instance.audioData) {
            // Fallback to static options if audio data not loaded yet
            return {
                spawn: ['sfx.enemy.spawn', 'sfx.boss.enter', 'sfx.player.spawn'],
                death: ['sfx.enemy.death.small', 'sfx.boss.death', 'sfx.player.death'],
                hit: ['sfx.enemy.hit.soft', 'sfx.enemy.hit.heavy', 'sfx.player.hit'],
                shoot: ['sfx.weapon.fire.laser', 'sfx.weapon.fire.bio', 'sfx.player.shoot'],
                pickup: ['sfx.pickup', 'sfx.powerup', 'sfx.heal']
            };
        }
        
        // Combine all SFX from manifest
        const allSfx = {
            ...(instance.audioData.sfx || {}),
            ...(instance.audioData.sfxExtended || {})
        };
        
        // Categorize SFX based on key patterns
        const categorized = {
            all: Object.keys(allSfx),
            player: [],
            enemy: [],
            weapon: [],
            ui: [],
            boss: [],
            pickup: [],
            spawn: [],
            death: [],
            hit: [],
            shoot: []
        };
        
        Object.keys(allSfx).forEach(key => {
            const lowerKey = key.toLowerCase();
            
            // Primary categories
            if (lowerKey.includes('player')) categorized.player.push(key);
            if (lowerKey.includes('enemy') || lowerKey.includes('npc')) categorized.enemy.push(key);
            if (lowerKey.includes('boss')) categorized.boss.push(key);
            if (lowerKey.includes('weapon') || lowerKey.includes('shoot') || lowerKey.includes('laser')) categorized.weapon.push(key);
            if (lowerKey.includes('pickup') || lowerKey.includes('powerup')) categorized.pickup.push(key);
            if (lowerKey.includes('bleep') || lowerKey.includes('chime') || lowerKey.includes('intro')) categorized.ui.push(key);
            
            // Event categories
            if (lowerKey.includes('spawn')) categorized.spawn.push(key);
            if (lowerKey.includes('death')) categorized.death.push(key);
            if (lowerKey.includes('hit')) categorized.hit.push(key);
            if (lowerKey.includes('shoot') || lowerKey.includes('fire')) categorized.shoot.push(key);
        });
        
        return categorized;
    }
}

export default FieldDefinitions;