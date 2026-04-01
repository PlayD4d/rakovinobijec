/**
 * DebugLogger - Centralized debug logging system
 * 
 * Controls all debug output based on configuration.
 * Supports categories, log levels, and runtime control.
 */

// NOTE: No direct import of ConfigResolver — avoids circular dependency.
// Uses window.ConfigResolver (set by GameScene) for runtime config access.

export class DebugLogger {
    // Log level priorities
    static LOG_LEVELS = {
        ALWAYS: 0,    // Always shown (critical errors)
        ERROR: 1,     // Errors
        WARN: 2,      // Warnings
        INFO: 3,      // Important info
        DEBUG: 4,     // Debug info
        VERBOSE: 5    // Detailed trace
    };
    
    // Category descriptions for list command
    static CATEGORY_DESCRIPTIONS = {
        // Core systems
        spawn: 'SpawnDirector logs',
        collision: 'Collision detection',
        physics: 'Physics engine',
        bootstrap: 'Game initialization',
        
        // Entity systems
        player: 'Player actions & state',
        enemy: 'Enemy spawning & lifecycle',
        boss: 'Boss phases & abilities',
        projectile: 'Projectile system',
        
        // Game systems
        loot: 'Loot drops & pickups',
        powerup: 'Power-up applications',
        vfx: 'Visual effects',
        sfx: 'Sound effects',
        
        // UI systems
        ui: 'UI events & updates',
        modal: 'Modal dialogs',
        
        // AI and behaviors
        ai: 'AI state changes',
        behavior: 'Behavior execution',
        
        // Performance
        performance: 'FPS & memory stats',
        telemetry: 'Analytics events',
        
        // Development
        hotreload: 'Hot reload events',
        dev: 'DEV console commands'
    };
    
    // Preset groups
    static PRESETS = {
        combat: ['collision', 'player', 'enemy', 'projectile'],
        ai: ['ai', 'behavior', 'enemy'],
        perf: ['performance', 'telemetry'],
        ui: ['ui', 'modal'],
        game: ['spawn', 'loot', 'powerup'],
        fx: ['vfx', 'sfx'],
        none: [],
        all: Object.keys(DebugLogger.CATEGORY_DESCRIPTIONS)
    };
    
    // Runtime overrides (persists until page reload)
    static runtimeOverrides = {
        enabled: null,
        logLevel: null,
        categories: {}
    };
    
    /**
     * Main logging method
     * @param {string} category - Debug category
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    static log(category, message, ...args) {
        if (!this.shouldLog(category, 'DEBUG')) return;
        console.log(`[${category.toUpperCase()}] ${message}`, ...args);
    }
    
    /**
     * Debug level logging
     */
    static debug(category, message, ...args) {
        if (!this.shouldLog(category, 'DEBUG')) return;
        console.log(`[${category.toUpperCase()}] ${message}`, ...args);
    }
    
    /**
     * Info level logging
     */
    static info(category, message, ...args) {
        if (!this.shouldLog(category, 'INFO')) return;
        console.info(`[${category.toUpperCase()}] ${message}`, ...args);
    }
    
    /**
     * Warning level logging
     */
    static warn(category, message, ...args) {
        if (!this.shouldLog(category, 'WARN')) return;
        console.warn(`⚠️ [${category.toUpperCase()}] ${message}`, ...args);
    }
    
    /**
     * Error level logging
     */
    static error(category, message, ...args) {
        if (!this.shouldLog(category, 'ERROR')) return;
        console.error(`❌ [${category.toUpperCase()}] ${message}`, ...args);
    }
    
    /**
     * Always shown (critical errors)
     */
    static always(category, message, ...args) {
        console.error(`🚨 [${category.toUpperCase()}] ${message}`, ...args);
    }
    
    /**
     * Verbose level logging
     */
    static verbose(category, message, ...args) {
        if (!this.shouldLog(category, 'VERBOSE')) return;
        console.log(`[${category.toUpperCase()}:VERBOSE] ${message}`, ...args);
    }
    
    /**
     * Check if a log should be shown
     * @private
     */
    static shouldLog(category, level = 'DEBUG') {
        // Get config with runtime overrides
        const config = this.getEffectiveConfig();
        
        // Check if debug is enabled
        if (!config.enabled) return false;
        
        // Check log level
        const currentLevel = this.LOG_LEVELS[config.logLevel?.toUpperCase()] || this.LOG_LEVELS.WARN;
        const messageLevel = this.LOG_LEVELS[level] || this.LOG_LEVELS.DEBUG;
        if (messageLevel > currentLevel) return false;
        
        // Check category
        if (!config.categories || config.categories[category] === false) return false;
        
        return true;
    }
    
    /**
     * Get effective config (with runtime overrides)
     * @private
     */
    // Cached config to avoid ConfigResolver.get + object allocation on every log call
    static _cachedConfig = null;
    static _cachedConfigTime = 0;

    // Pre-allocated merged config object — mutated in place, never re-created
    static _mergedConfig = { enabled: true, logLevel: 'WARN', categories: {} };
    static _overridesVersion = 0; // bumped when runtimeOverrides change

    static _resolving = false; // Guard against ConfigResolver ↔ DebugLogger recursion

    static getEffectiveConfig() {
        // Refresh base config every 2 seconds
        const now = Date.now();
        if (!this._cachedConfig || now - this._cachedConfigTime >= 2000) {
            let baseConfig = DebugLogger._defaultDebugConfig;
            const CR = window.ConfigResolver;
            if (CR && !this._resolving) {
                this._resolving = true;
                try { baseConfig = CR.get('debug', { defaultValue: baseConfig }) || baseConfig; }
                catch (_) { /* fallback to defaults */ }
                this._resolving = false;
            }
            this._cachedConfig = {
                enabled: baseConfig.enabled !== undefined ? baseConfig.enabled : true,
                logLevel: baseConfig.logLevel || 'WARN',
                categories: baseConfig.categories || {}
            };
            this._cachedConfigTime = now;
            this._lastMergedVersion = -1; // force re-merge
        }

        // Only rebuild merged config when base or overrides change
        if (this._lastMergedVersion !== this._overridesVersion) {
            const c = this._cachedConfig;
            this._mergedConfig.enabled = this.runtimeOverrides.enabled !== null ? this.runtimeOverrides.enabled : c.enabled;
            this._mergedConfig.logLevel = this.runtimeOverrides.logLevel || c.logLevel;
            // Merge categories in-place
            const merged = this._mergedConfig.categories;
            for (const key in merged) delete merged[key];
            Object.assign(merged, c.categories, this.runtimeOverrides.categories);
            this._lastMergedVersion = this._overridesVersion;
        }

        return this._mergedConfig;
    }

    static _defaultDebugConfig = {};
    
    // === Runtime control methods ===
    
    /**
     * Enable a debug category
     */
    static enable(category) {
        if (!this.CATEGORY_DESCRIPTIONS[category]) {
            console.warn(`Unknown debug category: ${category}`);
            return false;
        }
        
        this.runtimeOverrides.categories[category] = true;
        console.log(`✅ Debug category '${category}' enabled`);
        return true;
    }
    
    /**
     * Disable a debug category
     */
    static disable(category) {
        if (!this.CATEGORY_DESCRIPTIONS[category]) {
            console.warn(`Unknown debug category: ${category}`);
            return false;
        }
        
        this.runtimeOverrides.categories[category] = false;
        console.log(`❌ Debug category '${category}' disabled`);
        return true;
    }
    
    /**
     * Set log level
     */
    static setLevel(level) {
        const upperLevel = level.toUpperCase();
        if (!this.LOG_LEVELS[upperLevel] && this.LOG_LEVELS[upperLevel] !== 0) {
            console.warn(`Unknown log level: ${level}`);
            console.log('Valid levels: ALWAYS, ERROR, WARN, INFO, DEBUG, VERBOSE');
            return false;
        }
        
        this.runtimeOverrides.logLevel = upperLevel;
        console.log(`📊 Log level set to: ${upperLevel}`);
        return true;
    }
    
    /**
     * Apply a preset
     */
    static preset(name) {
        const preset = this.PRESETS[name];
        if (!preset) {
            console.warn(`Unknown preset: ${name}`);
            console.log(`Available presets: ${Object.keys(this.PRESETS).join(', ')}`);
            return false;
        }
        
        // First disable all
        Object.keys(this.CATEGORY_DESCRIPTIONS).forEach(cat => {
            this.runtimeOverrides.categories[cat] = false;
        });
        
        // Then enable preset categories
        preset.forEach(cat => {
            this.runtimeOverrides.categories[cat] = true;
        });
        
        console.log(`🎯 Preset '${name}' applied (${preset.length} categories enabled)`);
        return true;
    }
    
    /**
     * Show active categories
     */
    static showActive() {
        const config = this.getEffectiveConfig();
        const active = Object.entries(config.categories || {})
            .filter(([_, enabled]) => enabled)
            .map(([cat, _]) => cat);
        
        if (active.length === 0) {
            console.log('❌ No debug categories are active');
        } else {
            console.log(`✅ Active debug categories (${active.length}):`);
            active.forEach(cat => {
                console.log(`  • ${cat}: ${this.CATEGORY_DESCRIPTIONS[cat] || 'No description'}`);
            });
        }
        
        console.log(`📊 Current log level: ${config.logLevel}`);
        return active;
    }
    
    /**
     * Silence all except errors
     */
    static silence() {
        this.runtimeOverrides.logLevel = 'ERROR';
        Object.keys(this.CATEGORY_DESCRIPTIONS).forEach(cat => {
            this.runtimeOverrides.categories[cat] = false;
        });
        console.log('🔇 Debug silenced (only errors will show)');
        return true;
    }
    
    /**
     * Enable verbose mode
     */
    static enableVerbose() {
        this.runtimeOverrides.enabled = true;
        this.runtimeOverrides.logLevel = 'VERBOSE';
        Object.keys(this.CATEGORY_DESCRIPTIONS).forEach(cat => {
            this.runtimeOverrides.categories[cat] = true;
        });
        // Verbose mode enabled (silently)
        return true;
    }
    
    /**
     * List all available categories with status
     */
    static list() {
        const config = this.getEffectiveConfig();
        
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║                 DEBUG CATEGORIES                        ║');
        console.log('╠══════════════╦═════════╦════════════════════════════════╣');
        console.log('║ Category     ║ Status  ║ Description                    ║');
        console.log('╠══════════════╬═════════╬════════════════════════════════╣');
        
        Object.entries(this.CATEGORY_DESCRIPTIONS).forEach(([cat, desc]) => {
            const enabled = config.categories && config.categories[cat];
            const status = enabled ? '✅ ON ' : '❌ OFF';
            const paddedCat = cat.padEnd(12);
            const paddedDesc = desc.padEnd(30);
            console.log(`║ ${paddedCat} ║ ${status} ║ ${paddedDesc} ║`);
        });
        
        console.log('╚══════════════╩═════════╩════════════════════════════════╝');
        console.log(`Current log level: ${config.logLevel}`);
        console.log(`Debug system: ${config.enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log('');
        console.log('Commands:');
        console.log("  DEV.debug.enable('category')  - Turn on a category");
        console.log("  DEV.debug.disable('category') - Turn off a category");
        console.log("  DEV.debug.preset('name')      - Apply a preset");
        console.log("  DEV.debug.setLevel('level')   - Set log level");
        console.log('');
        console.log(`Available presets: ${Object.keys(this.PRESETS).join(', ')}`);
        console.log('Available levels: ALWAYS, ERROR, WARN, INFO, DEBUG, VERBOSE');
        
        return true;
    }
    
    /**
     * Reset all runtime overrides
     */
    static reset() {
        this.runtimeOverrides = {
            enabled: null,
            logLevel: null,
            categories: {}
        };
        this._overridesVersion++;
        console.log('🔄 Debug settings reset to config defaults');
        return true;
    }
}

// Export for global access
window.DebugLogger = DebugLogger;