/**
 * BlueprintLoader - Centralized loading system for all blueprint data
 * 
 * PR7 kompatibilní - všechny cesty a konfigurace z ConfigResolver
 * Loads and manages blueprints from /data/ folder including:
 * - Enemy, Boss, Unique blueprints
 * - Powerup and Drop blueprints  
 * - Loot tables and Spawn tables
 * - System configurations (NG+, pity system)
 */

// JSON5 will be used via global if available, otherwise fallback to JSON

export class BlueprintLoader {
    constructor(game) {
        this.game = game;
        this.blueprints = new Map();
        this.registryIndex = null;
        this.loaded = false;
        this.config = null;
        
        // Blueprint categories - budou inicializované z konfigurace
        this.categories = {};
        
        console.log('[BlueprintLoader] Initialized');
    }
    
    /**
     * Načte konfiguraci z ConfigResolver
     * PR7 kompatibilní - vše data-driven
     */
    loadConfig() {
        const CR = window.ConfigResolver;
        if (!CR) {
            console.error('[BlueprintLoader] ConfigResolver není dostupný!');
            // Záložní konfigurace
            this.config = {
                paths: {
                    dataRoot: '/data',
                    blueprintsRoot: '/data/blueprints',
                    registryIndex: '/data/registries/index.json'
                },
                spawnTables: [],
                systemConfigs: [],
                categories: ['enemy', 'boss', 'unique', 'powerup', 'drop', 'projectile', 'lootTable', 'spawnTable', 'system', 'item'],
                loadConfig: {
                    parallel: true,
                    maxConcurrent: 10,
                    retryAttempts: 3,
                    retryDelay: 500
                }
            };
        } else {
            this.config = {
                paths: CR.get('blueprintLoader.paths', { 
                    defaultValue: {
                        dataRoot: '/data',
                        blueprintsRoot: '/data/blueprints',
                        registryIndex: '/data/registries/index.json'
                    }
                }),
                spawnTables: CR.get('blueprintLoader.spawnTables', { defaultValue: [] }),
                systemConfigs: CR.get('blueprintLoader.systemConfigs', { defaultValue: [] }),
                categories: CR.get('blueprintLoader.categories', { 
                    defaultValue: ['enemy', 'boss', 'unique', 'powerup', 'drop', 'projectile', 'lootTable', 'spawnTable', 'system', 'item']
                }),
                categoryMapping: CR.get('blueprintLoader.categoryMapping', { defaultValue: {} }),
                loadConfig: CR.get('blueprintLoader.loadConfig', {
                    defaultValue: {
                        parallel: true,
                        maxConcurrent: 10,
                        retryAttempts: 3,
                        retryDelay: 500,
                        loadTimeout: 5000
                    }
                }),
                defaults: CR.get('blueprintLoader.defaults', { defaultValue: {} })
            };
        }
        
        // Inicializovat kategorie z konfigurace
        this.config.categories.forEach(category => {
            this.categories[category] = new Map();
        });
        
        console.log('[BlueprintLoader] Konfigurace načtena:', {
            categories: this.config.categories.length,
            spawnTables: this.config.spawnTables.length,
            systemConfigs: this.config.systemConfigs.length
        });
    }
    
    /**
     * Initialize and load all blueprints
     */
    async init() {
        console.log('[BlueprintLoader] Starting initialization...');
        
        // Nejprve načíst konfiguraci
        this.loadConfig();
        
        try {
            // 1. Load registry index
            await this.loadRegistryIndex();
            
            // 2. Load all blueprints referenced in index
            await this.loadAllBlueprints();
            
            // 3. Load spawn tables
            await this.loadSpawnTables();
            
            // 4. Load system configs
            await this.loadSystemConfigs();
            
            // 5. Load items from subdirectories (new simplified loot system)
            await this.loadItemBlueprints();
            
            this.loaded = true;
            console.log(`[BlueprintLoader] ✅ Loaded ${this.blueprints.size} blueprints total`);
            
            // Log summary
            Object.entries(this.categories).forEach(([category, map]) => {
                if (map.size > 0) {
                    console.log(`  ${category}: ${map.size} items`);
                }
            });
            
            return true;
        } catch (error) {
            console.error('[BlueprintLoader] ❌ Initialization failed:', error);
            return false;
        }
    }
    
    /**
     * Load the main registry index
     */
    async loadRegistryIndex() {
        try {
            const indexPath = this.config.paths.registryIndex;
            const response = await fetch(indexPath);
            if (!response.ok) {
                throw new Error(`Failed to load registry index: ${response.status}`);
            }
            
            this.registryIndex = await response.json();
            console.log(`[BlueprintLoader] Registry index loaded: ${this.registryIndex.totalEntities} entities`);
        } catch (error) {
            console.error('[BlueprintLoader] Failed to load registry index:', error);
            throw error;
        }
    }
    
    /**
     * Load all blueprints from registry index
     */
    async loadAllBlueprints() {
        if (!this.registryIndex || !this.registryIndex.index) {
            console.warn('[BlueprintLoader] No registry index available');
            return;
        }
        
        const loadPromises = [];
        
        for (const [id, path] of Object.entries(this.registryIndex.index)) {
            loadPromises.push(this.loadBlueprint(id, path));
        }
        
        // Load in parallel with error handling
        const results = await Promise.allSettled(loadPromises);
        
        // Log any failures
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const [id] = Object.entries(this.registryIndex.index)[index];
                console.warn(`[BlueprintLoader] Failed to load ${id}:`, result.reason);
            }
        });
    }
    
    /**
     * Load a single blueprint
     */
    async loadBlueprint(id, path) {
        try {
            const fullPath = `${this.config.paths.dataRoot}/${path}`;
            const response = await fetch(fullPath);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const text = await response.text();
            let blueprint;
            
            // Parse JSON5 or JSON
            try {
                // Try JSON5 if available globally
                if (typeof JSON5 !== 'undefined') {
                    blueprint = JSON5.parse(text);
                } else {
                    // Fallback to regular JSON
                    blueprint = JSON.parse(text);
                }
            } catch (e) {
                // Last resort - try regular JSON
                blueprint = JSON.parse(text);
            }
            
            // Store in main map
            this.blueprints.set(id, blueprint);
            
            // Categorize
            const category = this.getCategoryFromId(id);
            if (category && this.categories[category]) {
                this.categories[category].set(id, blueprint);
            }
            
            return blueprint;
        } catch (error) {
            console.warn(`[BlueprintLoader] Failed to load ${id} from ${path}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Load spawn tables
     */
    async loadSpawnTables() {
        const spawnTables = this.config.spawnTables.filter(table => table.autoLoad !== false);
        
        for (const tableConfig of spawnTables) {
            try {
                const path = `${this.config.paths.blueprintsRoot}/${tableConfig.path}`;
                const response = await fetch(path);
                
                if (!response.ok) continue;
                
                const text = await response.text();
                const table = typeof JSON5 !== 'undefined' ? JSON5.parse(text) : JSON.parse(text);
                
                const tableId = tableConfig.id;
                this.categories.spawnTable.set(tableId, table);
                this.blueprints.set(`spawn.${tableId}`, table);
                
                console.log(`[BlueprintLoader] Loaded spawn table: ${tableId}`);
            } catch (error) {
                console.warn(`[BlueprintLoader] Failed to load spawn table ${tableId}:`, error);
            }
        }
    }
    
    /**
     * Load system configurations
     */
    async loadSystemConfigs() {
        const configs = this.config.systemConfigs.filter(cfg => cfg.autoLoad !== false);
        
        for (const configItem of configs) {
            try {
                const path = `${this.config.paths.blueprintsRoot}/${configItem.path}`;
                const response = await fetch(path);
                
                if (!response.ok) continue;
                
                const text = await response.text();
                const config = typeof JSON5 !== 'undefined' ? JSON5.parse(text) : JSON.parse(text);
                
                const configId = configItem.id;
                this.categories.system.set(configId, config);
                this.blueprints.set(`system.${configId}`, config);
                
                console.log(`[BlueprintLoader] Loaded system config: ${configId}`);
            } catch (error) {
                console.warn(`[BlueprintLoader] Failed to load system config ${configId}:`, error);
            }
        }
    }
    
    /**
     * Load item blueprints from subdirectories
     * New simplified loot system - PR7 compliant
     */
    async loadItemBlueprints() {
        const itemSubdirs = ['xp', 'health', 'special', 'powerup', 'currency'];
        const loadPromises = [];
        
        for (const subdir of itemSubdirs) {
            // Try to load all JSON5 files from each subdirectory
            const itemFiles = [
                // XP items
                { subdir: 'xp', files: ['item_xp_small.json5', 'item_xp_medium.json5', 'item_xp_large.json5'] },
                // Health items
                { subdir: 'health', files: ['item_health_small.json5', 'item_heal_orb.json5', 'item_protein_cache.json5'] },
                // Special items
                { subdir: 'special', files: ['item_energy_cell.json5', 'item_metotrexat.json5', 'item_research_point.json5'] },
            ];
        }
        
        // Load known item files
        const itemFiles = [
            // XP items
            'items/xp/item_xp_small.json5',
            'items/xp/item_xp_medium.json5',
            'items/xp/item_xp_large.json5',
            // Health items
            'items/health/item_health_small.json5',
            'items/health/item_heal_orb.json5',
            'items/health/item_protein_cache.json5',
            // Special items
            'items/special/item_energy_cell.json5',
            'items/special/item_metotrexat.json5',
            'items/special/item_research_point.json5',
        ];
        
        for (const filePath of itemFiles) {
            try {
                const fullPath = `${this.config.paths.blueprintsRoot}/${filePath}`;
                const response = await fetch(fullPath);
                
                if (!response.ok) {
                    console.warn(`[BlueprintLoader] Item file not found: ${filePath}`);
                    continue;
                }
                
                const text = await response.text();
                const item = typeof JSON5 !== 'undefined' ? JSON5.parse(text) : JSON.parse(text);
                
                if (item.id) {
                    this.blueprints.set(item.id, item);
                    this.categories.item = this.categories.item || new Map();
                    this.categories.item.set(item.id, item);
                    console.log(`[BlueprintLoader] Loaded item: ${item.id}`);
                }
            } catch (error) {
                console.warn(`[BlueprintLoader] Failed to load item ${filePath}:`, error);
            }
        }
    }
    
    /**
     * Get category from blueprint ID
     * PR7 kompatibilní - používá mapování z konfigurace
     */
    getCategoryFromId(id) {
        // Zkusit najít v mapování
        if (this.config.categoryMapping) {
            for (const [prefix, category] of Object.entries(this.config.categoryMapping)) {
                if (id.startsWith(prefix)) {
                    return category;
                }
            }
        }
        
        // Záložní logika
        const parts = id.split('.');
        if (parts.length > 0) {
            const category = parts[0];
            // Handle lootTable special case
            if (id.startsWith('lootTable')) return 'lootTable';
            return category;
        }
        return null;
    }
    
    /**
     * Get a blueprint by ID
     */
    get(id) {
        return this.blueprints.get(id);
    }
    
    /**
     * Check if blueprint exists
     */
    has(id) {
        return this.blueprints.has(id);
    }
    
    /**
     * List all blueprints of a type
     */
    list(type) {
        if (this.categories[type]) {
            return Array.from(this.categories[type].keys());
        }
        return [];
    }
    
    /**
     * Get all blueprints of a type
     */
    getAll(type) {
        if (this.categories[type]) {
            return Array.from(this.categories[type].values());
        }
        return [];
    }
    
    /**
     * Get spawn table by ID
     * PR7 kompatibilní - JEDEN správný formát: spawnTable.XXX
     */
    getSpawnTable(scenarioId) {
        // Očekáváme ID ve formátu spawnTable.XXX
        const expectedId = scenarioId.startsWith('spawnTable.') ? scenarioId : `spawnTable.${scenarioId}`;
        
        const table = this.categories.spawnTable?.get(expectedId) || 
                     this.blueprints.get(expectedId);
        
        if (!table) {
            console.error(`[BlueprintLoader] Spawn table not found: ${expectedId}`);
        }
        
        return table;
    }
    
    /**
     * Get loot table by ID
     */
    getLootTable(tableId) {
        return this.categories.lootTable.get(tableId) || 
               this.blueprints.get(tableId);
    }
    
    /**
     * Get all blueprints as an object
     * Used by dev tools and soft refresh
     */
    getAllBlueprints() {
        const all = {};
        this.blueprints.forEach((data, id) => {
            all[id] = data;
        });
        return all;
    }
    
    /**
     * Get single blueprint by ID
     * Alias for get() method for consistency
     */
    getBlueprint(id) {
        return this.get(id);
    }
    
    /**
     * Update or add a blueprint
     * Used by soft refresh system
     */
    updateBlueprint(id, data) {
        // Store in main map
        this.blueprints.set(id, data);
        
        // Also update in category if applicable
        const category = this.getCategoryFromId(id);
        if (category && this.categories[category]) {
            this.categories[category].set(id, data);
        }
        
        console.log(`[BlueprintLoader] Updated blueprint: ${id}`);
    }
    
    /**
     * Validate all loaded blueprints
     */
    async validate() {
        const validator = await import('../validation/BlueprintValidator.js');
        const results = [];
        
        for (const [id, blueprint] of this.blueprints) {
            try {
                const isValid = await validator.BlueprintValidator.validate(blueprint);
                results.push({ id, valid: isValid });
            } catch (error) {
                results.push({ id, valid: false, error: error.message });
            }
        }
        
        return results;
    }
}