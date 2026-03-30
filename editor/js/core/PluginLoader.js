/**
 * PluginLoader.js - Manages editor plugins and extensions
 * Allows modular feature additions without modifying core
 */

export class PluginLoader {
    constructor(editor) {
        this.editor = editor;
        this.plugins = new Map();
        this.hooks = {
            'blueprint:loaded': [],
            'blueprint:saved': [],
            'blueprint:changed': [],
            'property:changed': [],
            'preview:update': [],
            'test:run': []
        };
    }
    
    /**
     * Register a new plugin
     */
    async register(plugin) {
        try {
            // Validate plugin structure
            if (!plugin.name || !plugin.version) {
                throw new Error('Plugin must have name and version');
            }
            
            // Check if already registered
            if (this.plugins.has(plugin.name)) {
                console.warn(`Plugin ${plugin.name} already registered`);
                return false;
            }
            
            // Initialize plugin
            if (plugin.init) {
                await plugin.init(this.editor);
            }
            
            // Register plugin hooks
            if (plugin.hooks) {
                for (const [event, handler] of Object.entries(plugin.hooks)) {
                    this.addHook(event, handler);
                }
            }
            
            // Store plugin
            this.plugins.set(plugin.name, plugin);
            
            console.log(`✅ Plugin registered: ${plugin.name} v${plugin.version}`);
            return true;
            
        } catch (error) {
            console.error(`Failed to register plugin:`, error);
            return false;
        }
    }
    
    /**
     * Unregister a plugin
     */
    unregister(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            console.warn(`Plugin ${pluginName} not found`);
            return false;
        }
        
        // Call cleanup if available
        if (plugin.cleanup) {
            plugin.cleanup();
        }
        
        // Remove hooks
        if (plugin.hooks) {
            for (const [event, handler] of Object.entries(plugin.hooks)) {
                this.removeHook(event, handler);
            }
        }
        
        // Remove from registry
        this.plugins.delete(pluginName);
        
        console.log(`Plugin unregistered: ${pluginName}`);
        return true;
    }
    
    /**
     * Add a hook handler
     */
    addHook(event, handler) {
        if (!this.hooks[event]) {
            this.hooks[event] = [];
        }
        this.hooks[event].push(handler);
    }
    
    /**
     * Remove a hook handler
     */
    removeHook(event, handler) {
        if (this.hooks[event]) {
            this.hooks[event] = this.hooks[event].filter(h => h !== handler);
        }
    }
    
    /**
     * Execute hooks for an event
     */
    async executeHooks(event, data) {
        const handlers = this.hooks[event];
        if (!handlers || handlers.length === 0) return data;
        
        let result = data;
        for (const handler of handlers) {
            try {
                const hookResult = await handler(result, this.editor);
                // Allow hooks to modify data
                if (hookResult !== undefined) {
                    result = hookResult;
                }
            } catch (error) {
                console.error(`Hook error in ${event}:`, error);
            }
        }
        
        return result;
    }
    
    /**
     * Get registered plugin
     */
    getPlugin(name) {
        return this.plugins.get(name);
    }
    
    /**
     * Get all plugins
     */
    getAllPlugins() {
        return Array.from(this.plugins.values());
    }
    
    /**
     * Load plugin from URL
     */
    async loadFromURL(url) {
        try {
            const module = await import(url);
            const PluginClass = module.default || module.Plugin;
            
            if (!PluginClass) {
                throw new Error('Plugin module must export a default class or Plugin class');
            }
            
            const plugin = new PluginClass();
            return await this.register(plugin);
            
        } catch (error) {
            console.error(`Failed to load plugin from ${url}:`, error);
            return false;
        }
    }
    
    /**
     * Create a simple plugin
     */
    createPlugin(config) {
        return {
            name: config.name,
            version: config.version || '1.0.0',
            description: config.description || '',
            
            init: config.init || function(editor) {
                console.log(`Plugin ${this.name} initialized`);
            },
            
            cleanup: config.cleanup || function() {
                console.log(`Plugin ${this.name} cleaned up`);
            },
            
            hooks: config.hooks || {}
        };
    }
}

// Example plugin template
export class EditorPlugin {
    constructor() {
        this.name = 'ExamplePlugin';
        this.version = '1.0.0';
        this.description = 'Example plugin template';
    }
    
    async init(editor) {
        console.log(`${this.name} initializing...`);
        this.editor = editor;
        
        // Subscribe to editor events
        editor.on('blueprint:loaded', this.onBlueprintLoaded.bind(this));
    }
    
    cleanup() {
        console.log(`${this.name} cleaning up...`);
        if (this.editor) {
            this.editor.off('blueprint:loaded', this.onBlueprintLoaded.bind(this));
        }
    }
    
    onBlueprintLoaded(data) {
        console.log(`${this.name}: Blueprint loaded`, data.blueprint.id);
    }
    
    // Hook handlers
    hooks = {
        'blueprint:saved': async (data, editor) => {
            console.log(`${this.name}: Blueprint saved hook`);
            // Can modify or validate data
            return data;
        }
    };
}

export default PluginLoader;