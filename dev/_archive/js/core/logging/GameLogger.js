/**
 * GameLogger - Centralized logging system for debugging
 * Saves all game events to a log file for each session
 * PR7 compliant - uses ConfigResolver for configuration
 */

export class GameLogger {
    constructor(scene) {
        this.scene = scene;
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.logs = [];
        this.enabled = true;
        
        // PR7: Get config from ConfigResolver
        const CR = scene?.configResolver || window.ConfigResolver;
        this.config = {
            maxLogs: CR?.get('logging.maxLogs', { defaultValue: 10000 }) || 10000,
            saveInterval: CR?.get('logging.saveInterval', { defaultValue: 30000 }) || 30000, // 30 seconds
            logLevel: CR?.get('logging.level', { defaultValue: 'debug' }) || 'debug',
            enableConsole: CR?.get('logging.console', { defaultValue: true }) !== false,
            enableFile: CR?.get('logging.file', { defaultValue: true }) !== false
        };
        
        // Log levels
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            verbose: 4
        };
        
        // Categories for filtering
        this.categories = new Set([
            'system', 'spawn', 'combat', 'player', 'enemy', 'boss',
            'loot', 'powerup', 'vfx', 'sfx', 'ui', 'performance'
        ]);
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize logger
     */
    init() {
        // Override console methods first to capture all logs
        this.interceptConsole();
        
        // Now we can log session start
        this.info('system', `Game session started: ${this.sessionId}`);
        this.info('system', `Platform: ${navigator.platform}, User Agent: ${navigator.userAgent}`);
        
        // Setup auto-save interval
        if (this.config.enableFile) {
            this.saveInterval = setInterval(() => {
                this.saveLogs();
            }, this.config.saveInterval);
        }
        
        // Add download command
        this.exposeDownloadCommand();
    }
    
    /**
     * Generate unique session ID
     */
    generateSessionId() {
        const date = new Date();
        const dateStr = date.toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const random = Math.random().toString(36).substring(2, 8);
        return `game_${dateStr}_${random}`;
    }
    
    /**
     * Log with specific level
     */
    log(level, category, message, data = null) {
        if (!this.enabled) return;
        
        // Check log level
        const levelNum = this.levels[level] || 3;
        const configLevel = this.levels[this.config.logLevel] || 3;
        if (levelNum > configLevel) return;
        
        // Create log entry
        const entry = {
            timestamp: Date.now() - this.startTime,
            time: new Date().toISOString(),
            level: level,
            category: category,
            message: message
        };
        
        if (data !== null) {
            // Sanitize data to prevent circular references
            try {
                entry.data = this.sanitizeData(data);
            } catch (e) {
                entry.data = `[Error serializing data: ${e.message}]`;
            }
        }
        
        // Add to logs
        this.logs.push(entry);
        
        // Trim if too many logs
        if (this.logs.length > this.config.maxLogs) {
            this.logs = this.logs.slice(-this.config.maxLogs);
        }
        
        // Output to console if enabled
        if (this.config.enableConsole) {
            this.outputToConsole(entry);
        }
    }
    
    /**
     * Convenience methods
     */
    error(category, message, data) {
        this.log('error', category, message, data);
    }
    
    warn(category, message, data) {
        this.log('warn', category, message, data);
    }
    
    info(category, message, data) {
        this.log('info', category, message, data);
    }
    
    debug(category, message, data) {
        this.log('debug', category, message, data);
    }
    
    verbose(category, message, data) {
        this.log('verbose', category, message, data);
    }
    
    /**
     * Log spawn event
     */
    logSpawn(enemyId, position, count = 1) {
        this.debug('spawn', `Spawned ${count}x ${enemyId}`, { enemyId, position, count });
    }
    
    /**
     * Log combat event
     */
    logCombat(type, attacker, target, damage) {
        this.debug('combat', `${type}: ${attacker} -> ${target} (${damage} dmg)`, {
            type, attacker, target, damage
        });
    }
    
    /**
     * Log performance metrics
     */
    logPerformance(fps, enemyCount, bulletCount) {
        this.verbose('performance', `FPS: ${fps}, Enemies: ${enemyCount}, Bullets: ${bulletCount}`, {
            fps, enemyCount, bulletCount
        });
    }
    
    /**
     * Log error with stack trace
     */
    logError(error, context = '') {
        this.error('system', `Error in ${context}: ${error.message}`, {
            message: error.message,
            stack: error.stack,
            context: context
        });
    }
    
    /**
     * Sanitize data for JSON serialization
     */
    sanitizeData(data, depth = 0) {
        if (depth > 5) return '[Max depth]';
        
        if (data === null || data === undefined) return data;
        if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') return data;
        
        if (Array.isArray(data)) {
            return data.slice(0, 100).map(item => this.sanitizeData(item, depth + 1));
        }
        
        if (typeof data === 'object') {
            const result = {};
            const keys = Object.keys(data).slice(0, 50);
            for (const key of keys) {
                // Skip circular references and functions
                if (key === 'scene' || key === 'game' || key === 'parent') continue;
                if (typeof data[key] === 'function') continue;
                
                result[key] = this.sanitizeData(data[key], depth + 1);
            }
            return result;
        }
        
        return String(data);
    }
    
    /**
     * Output to console
     */
    outputToConsole(entry) {
        // Use original console methods to avoid recursion
        if (!this._originalConsole) return;
        
        const prefix = `[${entry.category}]`;
        const message = `${prefix} ${entry.message}`;
        
        switch (entry.level) {
            case 'error':
                this._originalConsole.error(message, entry.data || '');
                break;
            case 'warn':
                this._originalConsole.warn(message, entry.data || '');
                break;
            case 'info':
                this._originalConsole.log(message, entry.data || '');
                break;
            case 'debug':
                this._originalConsole.debug(message, entry.data || '');
                break;
            case 'verbose':
                this._originalConsole.debug(`[V] ${message}`, entry.data || '');
                break;
        }
    }
    
    /**
     * Intercept console methods
     */
    interceptConsole() {
        // Save original console methods BEFORE overriding
        this._originalConsole = {
            log: console.log.bind(console),
            error: console.error.bind(console),
            warn: console.warn.bind(console),
            debug: console.debug.bind(console)
        };
        
        const self = this;
        
        // Override console methods - log to our system but DON'T call console again
        console.log = (...args) => {
            // Only log to our system, output will be handled by outputToConsole
            self.debug('console', args.map(a => String(a)).join(' '));
        };
        
        console.error = (...args) => {
            // Only log to our system, output will be handled by outputToConsole
            self.error('console', args.map(a => String(a)).join(' '));
        };
        
        console.warn = (...args) => {
            // Only log to our system, output will be handled by outputToConsole
            self.warn('console', args.map(a => String(a)).join(' '));
        };
        
        console.debug = (...args) => {
            // Only log to our system, output will be handled by outputToConsole
            self.verbose('console', args.map(a => String(a)).join(' '));
        };
    }
    
    /**
     * Save logs to file (download)
     */
    saveLogs() {
        if (!this.config.enableFile || this.logs.length === 0) return;
        
        const logData = {
            sessionId: this.sessionId,
            startTime: new Date(Date.now() - (Date.now() - this.startTime)).toISOString(),
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            logCount: this.logs.length,
            logs: this.logs
        };
        
        const json = JSON.stringify(logData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Store for manual download
        this._lastLogBlob = blob;
        this._lastLogUrl = url;
        
        // Log save event
        this.info('system', `Logs ready for download (${this.logs.length} entries)`);
    }
    
    /**
     * Download logs manually
     */
    downloadLogs() {
        // Save current logs first
        this.saveLogs();
        
        if (!this._lastLogUrl) {
            console.warn('No logs to download');
            return;
        }
        
        // Create download link
        const a = document.createElement('a');
        a.href = this._lastLogUrl;
        a.download = `${this.sessionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        console.log(`Downloaded log file: ${this.sessionId}.json`);
    }
    
    /**
     * Expose download command
     */
    exposeDownloadCommand() {
        window.downloadGameLog = () => this.downloadLogs();
        window.clearGameLog = () => {
            this.logs = [];
            this.info('system', 'Log cleared');
        };
        window.gameLogStats = () => {
            console.log(`Log stats: ${this.logs.length} entries`);
            const byLevel = {};
            const byCategory = {};
            
            this.logs.forEach(log => {
                byLevel[log.level] = (byLevel[log.level] || 0) + 1;
                byCategory[log.category] = (byCategory[log.category] || 0) + 1;
            });
            
            console.log('By level:', byLevel);
            console.log('By category:', byCategory);
        };
    }
    
    /**
     * Get filtered logs
     */
    getFilteredLogs(filter = {}) {
        let filtered = this.logs;
        
        if (filter.level) {
            filtered = filtered.filter(log => log.level === filter.level);
        }
        
        if (filter.category) {
            filtered = filtered.filter(log => log.category === filter.category);
        }
        
        if (filter.search) {
            const search = filter.search.toLowerCase();
            filtered = filtered.filter(log => 
                log.message.toLowerCase().includes(search) ||
                JSON.stringify(log.data).toLowerCase().includes(search)
            );
        }
        
        if (filter.timeFrom) {
            filtered = filtered.filter(log => log.timestamp >= filter.timeFrom);
        }
        
        if (filter.timeTo) {
            filtered = filtered.filter(log => log.timestamp <= filter.timeTo);
        }
        
        return filtered;
    }
    
    /**
     * Cleanup
     */
    destroy() {
        // Save final logs
        this.info('system', 'Game session ended');
        this.saveLogs();
        
        // Clear interval
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        
        // Restore console
        if (this._originalConsole) {
            console.log = this._originalConsole.log;
            console.error = this._originalConsole.error;
            console.warn = this._originalConsole.warn;
            console.debug = this._originalConsole.debug;
        }
        
        // Cleanup blob URLs
        if (this._lastLogUrl) {
            URL.revokeObjectURL(this._lastLogUrl);
        }
    }
}

export default GameLogger;