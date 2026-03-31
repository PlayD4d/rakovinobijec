/**
 * DataManager.js - Handles blueprint file I/O operations
 * Loads, saves, and manages blueprint data
 */

export class DataManager {
    constructor(editor) {
        this.editor = editor;
        this.blueprintCache = new Map();
        this.blueprintBasePath = '../data/';  // Changed from '../data/blueprints/' since paths in registry already include 'blueprints/'
        this.registryPath = '../data/registries/index.json';
    }
    
    /**
     * Load list of all available blueprints
     * Scans the blueprint directory structure
     */
    async loadBlueprintList() {
        try {
            // For now, we'll use a predefined structure
            // In production, this would scan the actual file system
            const blueprintTypes = [
                'enemy', 'boss', 'elite', 'unique',
                'powerup', 'projectile', 'loot', 'drop', 'spawn', 'system', 'player', 'item', 'config'
            ];
            
            const blueprints = [];
            
            // Try to load from registry first
            try {
                const response = await fetch(this.registryPath);
                if (response.ok) {
                    const registry = await response.json();
                    
                    // Check if it's the new format with flat index
                    if (registry.index) {
                        console.log(`Loading ${registry.totalEntities} blueprints from registry index`);
                        
                        for (const [id, path] of Object.entries(registry.index)) {
                            // Extract type from ID or path
                            let type = 'unknown';
                            
                            // Try to get type from ID prefix
                            if (id.includes('.')) {
                                type = id.split('.')[0];
                            } else {
                                // Fallback: extract from path
                                const pathParts = path.split('/');
                                if (pathParts.length >= 2) {
                                    type = pathParts[1]; // blueprints/TYPE/file.json5
                                }
                            }
                            
                            // Map some special cases
                            if (type === 'spawnTable') type = 'spawn';
                            if (type === 'lootTable') type = 'loot';
                            if (type === 'proj') type = 'projectile';
                            
                            // Handle special IDs without prefixes
                            if (id === 'player') type = 'player';
                            
                            // Ensure we have valid types for filtering
                            if (!blueprintTypes.includes(type)) {
                                console.warn(`Unknown blueprint type: ${type} for ${id}`);
                            }
                            
                            blueprints.push({
                                id: id,
                                type: type,
                                path: path,
                                name: this.formatDisplayName(id)
                            });
                        }
                        
                        console.log(`Loaded ${blueprints.length} blueprints from registry`);
                        
                        // Add config files manually (they're not in the registry)
                        const configFiles = [
                            { id: 'main_config', name: 'Main Config', path: 'config/main_config.json5' },
                            { id: 'managers_config', name: 'Managers Config', path: 'config/managers_config.json5' },
                            { id: 'features', name: 'Features', path: 'config/features.json5' },
                            { id: 'blueprint_loader', name: 'Blueprint Loader', path: 'config/blueprint_loader.json5' }
                        ];
                        
                        for (const config of configFiles) {
                            blueprints.push({
                                id: config.id,
                                type: 'config',
                                path: config.path,
                                name: config.name
                            });
                        }
                        
                        console.log(`Added ${configFiles.length} config files`);
                        return blueprints;
                    }
                    
                    // Legacy format - process each type in registry
                    for (const type of blueprintTypes) {
                        if (registry[type] && Array.isArray(registry[type])) {
                            registry[type].forEach(entry => {
                                blueprints.push({
                                    id: entry.id,
                                    type: type,
                                    path: entry.path || `blueprints/${type}/${entry.id.replace('.', '_')}.json5`,
                                    name: this.formatDisplayName(entry.id)
                                });
                            });
                        }
                    }
                    
                    console.log(`Loaded ${blueprints.length} blueprints from registry`);
                    
                    // Add config files manually (they're not in the registry)
                    const configFiles = [
                        { id: 'main_config', name: 'Main Config', path: 'config/main_config.json5' },
                        { id: 'managers_config', name: 'Managers Config', path: 'config/managers_config.json5' },
                        { id: 'features', name: 'Features', path: 'config/features.json5' },
                        { id: 'blueprint_loader', name: 'Blueprint Loader', path: 'config/blueprint_loader.json5' }
                    ];
                    
                    for (const config of configFiles) {
                        blueprints.push({
                            id: config.id,
                            type: 'config',
                            path: config.path,
                            name: config.name
                        });
                    }
                    
                    console.log(`Added ${configFiles.length} config files`);
                    return blueprints;
                }
            } catch (error) {
                console.warn('Could not load registry, falling back to manual scan:', error);
            }
            
            // Fallback: manually scan known blueprints
            const knownBlueprints = [
                // Enemies
                { id: 'enemy.necrotic_cell', type: 'enemy' },
                { id: 'enemy.viral_swarm', type: 'enemy' },
                { id: 'enemy.micro_shooter', type: 'enemy' },
                { id: 'enemy.fungal_parasite', type: 'enemy' },
                { id: 'enemy.toxic_spore', type: 'enemy' },
                { id: 'enemy.corrupted_cell', type: 'enemy' },
                { id: 'enemy.support_bacteria', type: 'enemy' },
                
                // Bosses
                { id: 'boss.radiation_core', type: 'boss' },
                { id: 'boss.onkogen', type: 'boss' },
                { id: 'boss.karcinogenni_kral', type: 'boss' },
                
                // Elites
                { id: 'elite.tank_cell', type: 'elite' },
                { id: 'elite.speed_virus', type: 'elite' },
                { id: 'elite.artillery_fungus', type: 'elite' },
                { id: 'elite.micro_shooter', type: 'elite' },
                
                // Powerups
                { id: 'powerup.immuno_boost', type: 'powerup' },
                { id: 'powerup.metabolic_haste', type: 'powerup' },
                { id: 'powerup.shield', type: 'powerup' },
                { id: 'powerup.damage_boost', type: 'powerup' },
                { id: 'powerup.oxidative_burst', type: 'powerup' },
                { id: 'powerup.piercing_arrows', type: 'powerup' },
                { id: 'powerup.chemo_reservoir', type: 'powerup' },
                { id: 'powerup.radiotherapy', type: 'powerup' },
                
                // Projectiles
                { id: 'projectile.cytotoxin', type: 'projectile' },
                { id: 'projectile.cytotoxin_enhanced', type: 'projectile' },
                { id: 'projectile.acid_spit', type: 'projectile' },
                { id: 'projectile.spore_mortar', type: 'projectile' },
                
                // Spawn tables
                { id: 'spawnTable.level1', type: 'spawn' },
                { id: 'spawnTable.level2', type: 'spawn' },
                { id: 'spawnTable.level3', type: 'spawn' },
            ];
            
            knownBlueprints.forEach(bp => {
                blueprints.push({
                    id: bp.id,
                    type: bp.type,
                    path: `blueprints/${bp.type}/${bp.id.replace(/\./g, '_')}.json5`,
                    name: this.formatDisplayName(bp.id)
                });
            });
            
            return blueprints;
            
        } catch (error) {
            console.error('Failed to load blueprint list:', error);
            throw error;
        }
    }
    
    /**
     * Load a specific blueprint file
     */
    async loadBlueprint(filePath) {
        try {
            // Check cache first
            if (this.blueprintCache.has(filePath)) {
                console.log(`Loading ${filePath} from cache`);
                return this.blueprintCache.get(filePath);
            }
            
            // Construct full path
            const fullPath = this.blueprintBasePath + filePath;
            console.log(`Loading blueprint from: ${fullPath}`);
            
            const response = await fetch(fullPath);
            if (!response.ok) {
                // Try to provide more helpful error message
                const errorMsg = `Failed to load blueprint: ${filePath}\nFull URL: ${fullPath}\nHTTP ${response.status}: ${response.statusText}`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            }
            
            const text = await response.text();
            console.log(`Successfully loaded ${filePath}, parsing JSON5...`);
            const blueprint = this.parseJSON5(text);
            
            // Cache the blueprint
            this.blueprintCache.set(filePath, blueprint);
            
            console.log(`Blueprint ${blueprint.id || 'unknown'} loaded successfully`);
            return blueprint;
            
        } catch (error) {
            console.error(`Failed to load blueprint ${filePath}:`, error);
            throw error;
        }
    }
    
    /**
     * Save blueprint to file
     * Note: In browser environment, this requires a server endpoint
     */
    async saveBlueprint(filePath, blueprint) {
        try {
            // Convert to JSON5 format
            const json5Content = this.toJSON5(blueprint);
            
            // In a real implementation, this would POST to a server endpoint
            // For now, we'll simulate saving
            console.log(`Would save to ${filePath}:`, json5Content);
            
            // Update cache
            this.blueprintCache.set(filePath, blueprint);
            
            // For local development, we can use a simple Python server
            // that accepts POST requests to save files
            if (window.location.hostname === 'localhost') {
                try {
                    // Always use the same server that's serving the editor
                    const saveUrl = '/save-blueprint';
                    
                    const response = await fetch(saveUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            path: filePath,
                            content: json5Content
                        })
                    });
                    
                    if (!response.ok) {
                        console.warn('Server save failed, using fallback');
                        this.downloadBlueprint(filePath, json5Content);
                    }
                } catch (error) {
                    // Fallback to download
                    console.warn('Server not available, downloading file instead');
                    this.downloadBlueprint(filePath, json5Content);
                }
            } else {
                // If not on localhost, download the file
                this.downloadBlueprint(filePath, json5Content);
            }
            
            return true;
            
        } catch (error) {
            console.error(`Failed to save blueprint ${filePath}:`, error);
            throw error;
        }
    }
    
    /**
     * Download blueprint as file (fallback for when server save isn't available)
     */
    downloadBlueprint(filePath, content) {
        const blob = new Blob([content], { type: 'application/json5' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filePath.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * Create a new blueprint template
     */
    createBlueprintTemplate(type, id) {
        const templates = {
            enemy: {
                id: id,
                type: 'enemy',
                stats: {
                    hp: 30,
                    damage: 5,
                    speed: 50,
                    size: 16,
                    armor: 0,
                    xp: 5
                },
                graphics: {
                    sprite: id,
                    tint: 0xFFFFFF,
                    scale: 1.0
                },
                ai: {
                    behavior: 'chase',
                    params: {
                        aggroRange: 200,
                        wanderRadius: 50
                    }
                },
                drops: [
                    { itemId: 'item.xp_small', chance: 0.8 },
                    { itemId: 'item.health_small', chance: 0.15 }
                ]
            },
            
            boss: {
                id: id,
                type: 'boss',
                name: id.split('.').pop(),
                stats: {
                    hp: 1000,
                    damage: 20,
                    speed: 40,
                    size: 48,
                    armor: 5,
                    xp: 100
                },
                mechanics: {
                    phases: [
                        {
                            id: 'phase1',
                            thresholdPct: 1.0,
                            abilities: []
                        }
                    ],
                    abilities: {}
                },
                display: {
                    name: 'New Boss',
                    healthBarSize: 'large'
                }
            },
            
            elite: {
                id: id,
                type: 'elite',
                baseEnemyId: 'enemy.necrotic_cell',
                multipliers: {
                    hp: 3.0,
                    damage: 2.0,
                    speed: 1.2,
                    size: 1.3,
                    armor: 2,
                    xp: 3.0
                },
                lootTable: 'lootTable.elite.tier1'
            },
            
            powerup: {
                id: id,
                type: 'powerup',
                stats: { maxLevel: 5 },
                mechanics: {
                    modifiersPerLevel: [
                        { path: 'damage', type: 'add', value: 5 }
                    ],
                    stackable: true,
                    persistent: true
                },
                display: {
                    name: id.split('.').pop(),
                    description: '',
                    icon: 'powerup_default',
                    color: 0x4CAF50
                },
                vfx: { pickup: 'vfx.powerup.pickup' },
                sfx: { pickup: 'sound/powerup_pickup.mp3' }
            },
            
            projectile: {
                id: id,
                type: 'projectile',
                physics: {
                    speed: 300,
                    size: 8,
                    piercing: false,
                    lifespan: 2000
                },
                damage: {
                    amount: 10,
                    type: 'normal'
                },
                visuals: {
                    sprite: id,
                    tint: 0xFFFFFF,
                    scale: 1.0
                }
            },
            
            spawn: {
                id: id,
                type: 'spawnTable',
                level: 1,
                enemyWaves: [],
                bossTriggers: [],
                difficulty: {
                    enemyHpMultiplier: 1.0,
                    enemyDamageMultiplier: 1.0,
                    spawnRateMultiplier: 1.0
                }
            }
        };
        
        return templates[type] || templates.enemy;
    }
    
    /**
     * Parse JSON5 content (with fallback to JSON)
     */
    parseJSON5(text) {
        try {
            // Try to use JSON5 if available
            if (window.JSON5) {
                return window.JSON5.parse(text);
            }
            
            // Fallback: Enhanced JSON5 to JSON conversion
            let cleaned = text;
            
            // Remove single-line comments
            cleaned = cleaned.replace(/\/\/.*$/gm, '');
            
            // Remove multi-line comments
            cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
            
            // Handle unquoted keys (more comprehensive)
            cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
            
            // Handle single quotes to double quotes
            cleaned = cleaned.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"');
            
            // Handle trailing commas (remove them)
            cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
            
            // Handle hex numbers
            cleaned = cleaned.replace(/0x([0-9A-Fa-f]+)/g, (match, hex) => {
                return parseInt(hex, 16);
            });
            
            console.log('Parsing JSON5 fallback completed');
            return JSON.parse(cleaned);
            
        } catch (error) {
            console.error('Failed to parse JSON5:', error);
            console.log('Original text:', text.substring(0, 200) + '...');
            throw new Error(`JSON5 parsing failed: ${error.message}`);
        }
    }
    
    /**
     * Convert object to JSON5 format
     */
    toJSON5(obj) {
        // If JSON5 library is available, use it
        if (window.JSON5) {
            return window.JSON5.stringify(obj, null, 2);
        }
        
        // Otherwise, use regular JSON with some formatting
        let json = JSON.stringify(obj, null, 2);
        
        // Convert hex numbers back to 0x format
        json = json.replace(/"tint":\s*(\d+)/g, (match, num) => {
            const hex = Number(num).toString(16).toUpperCase();
            return `"tint": 0x${hex}`;
        });
        
        // Remove quotes from keys (basic conversion)
        json = json.replace(/"(\w+)":/g, '$1:');
        
        return json;
    }
    
    /**
     * Format blueprint ID for display
     */
    formatDisplayName(id) {
        // Convert enemy.viral_swarm -> Viral Swarm
        const parts = id.split('.');
        const name = parts[parts.length - 1];
        return name
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    /**
     * Clear cache
     */
    clearCache() {
        this.blueprintCache.clear();
        console.log('Blueprint cache cleared');
    }
    
    /**
     * Get cached blueprint
     */
    getCached(filePath) {
        return this.blueprintCache.get(filePath);
    }
    
    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            const response = await fetch(this.blueprintBasePath + filePath, {
                method: 'HEAD'
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

export default DataManager;