/**
 * ErrorDetector - Comprehensive error and issue detection system
 * 
 * Detects:
 * - JavaScript errors and exceptions
 * - Console warnings and errors  
 * - Phaser framework errors
 * - Blueprint validation errors
 * - Performance issues
 * - Memory leaks
 * - Game state inconsistencies
 */

import { DebugLogger } from '../debug/DebugLogger.js';

export class ErrorDetector {
    constructor() {
        this.enabled = false;
        this.startTime = null;
        
        // Error collection
        this.errors = {
            javascript: [],
            console: [],
            phaser: [],
            blueprint: [],
            performance: [],
            memory: [],
            state: [],
            network: []
        };
        
        // Performance tracking
        this.performance = {
            frameDrops: [],
            longFrames: [],
            memorySpikes: [],
            lastMemory: 0,
            lastFrame: 0,
            frameThreshold: 33, // ms (30 FPS)
            memoryThreshold: 50 // MB spike
        };
        
        // State tracking
        this.stateChecks = new Map();
        this.setupDefaultStateChecks();
        
        // Original functions to restore
        this.originalFunctions = {};
        
        // Phaser error tracking
        this.phaserErrors = new Set();
        
        DebugLogger.log('ErrorDetector initialized');
    }
    
    /**
     * Start error detection
     */
    start() {
        if (this.enabled) {
            DebugLogger.warn('ErrorDetector already running');
            return;
        }
        
        this.enabled = true;
        this.startTime = Date.now();
        this.clearErrors();
        
        // Install all hooks
        this.installConsoleHooks();
        this.installErrorHandlers();
        this.installPhaserHooks();
        this.installPerformanceMonitoring();
        this.installNetworkMonitoring();
        
        DebugLogger.log('ErrorDetector started');
    }
    
    /**
     * Stop error detection
     */
    stop() {
        if (!this.enabled) return;
        
        this.enabled = false;
        
        // Remove all hooks
        this.removeConsoleHooks();
        this.removeErrorHandlers();
        this.removePhaserHooks();
        this.removePerformanceMonitoring();
        this.removeNetworkMonitoring();
        
        const report = this.generateReport();
        DebugLogger.log('ErrorDetector stopped', { totalErrors: this.getTotalErrorCount() });
        
        return report;
    }
    
    /**
     * Console hooks for catching console.error and console.warn
     */
    installConsoleHooks() {
        // Store originals
        this.originalFunctions.consoleError = console.error;
        this.originalFunctions.consoleWarn = console.warn;
        this.originalFunctions.consoleLog = console.log;
        
        // Override console.error
        console.error = (...args) => {
            this.captureConsoleError(args);
            this.originalFunctions.consoleError.apply(console, args);
        };
        
        // Override console.warn
        console.warn = (...args) => {
            this.captureConsoleWarning(args);
            this.originalFunctions.consoleWarn.apply(console, args);
        };
        
        // Monitor console.log for specific patterns
        console.log = (...args) => {
            this.scanConsoleLog(args);
            this.originalFunctions.consoleLog.apply(console, args);
        };
    }
    
    removeConsoleHooks() {
        if (this.originalFunctions.consoleError) {
            console.error = this.originalFunctions.consoleError;
        }
        if (this.originalFunctions.consoleWarn) {
            console.warn = this.originalFunctions.consoleWarn;
        }
        if (this.originalFunctions.consoleLog) {
            console.log = this.originalFunctions.consoleLog;
        }
    }
    
    captureConsoleError(args) {
        const error = {
            type: 'console.error',
            message: args.map(a => this.stringifyArg(a)).join(' '),
            args: args,
            timestamp: Date.now(),
            stack: new Error().stack
        };
        
        this.errors.console.push(error);
        this.checkErrorPatterns(error);
    }
    
    captureConsoleWarning(args) {
        const warning = {
            type: 'console.warn',
            message: args.map(a => this.stringifyArg(a)).join(' '),
            args: args,
            timestamp: Date.now(),
            stack: new Error().stack
        };
        
        this.errors.console.push(warning);
        this.checkWarningPatterns(warning);
    }
    
    scanConsoleLog(args) {
        const message = args.map(a => this.stringifyArg(a)).join(' ');
        
        // Look for error patterns in regular logs
        const errorPatterns = [
            /error/i,
            /exception/i,
            /failed/i,
            /undefined is not/i,
            /cannot read property/i,
            /cannot set property/i,
            /is not a function/i,
            /is not defined/i,
            /missing/i,
            /invalid/i
        ];
        
        for (const pattern of errorPatterns) {
            if (pattern.test(message)) {
                this.errors.console.push({
                    type: 'console.log.suspicious',
                    message: message,
                    pattern: pattern.toString(),
                    timestamp: Date.now()
                });
                break;
            }
        }
    }
    
    /**
     * Global error handlers
     */
    installErrorHandlers() {
        // Window error handler
        this.windowErrorHandler = (event) => {
            this.errors.javascript.push({
                type: 'window.error',
                message: event.message,
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                error: event.error,
                stack: event.error?.stack,
                timestamp: Date.now()
            });
            
            // Check if it's a Phaser error
            if (event.message?.includes('Phaser') || event.filename?.includes('phaser')) {
                this.errors.phaser.push({
                    type: 'phaser.error',
                    message: event.message,
                    source: event.filename,
                    timestamp: Date.now()
                });
            }
        };
        
        // Unhandled rejection handler
        this.rejectionHandler = (event) => {
            this.errors.javascript.push({
                type: 'unhandledRejection',
                reason: event.reason,
                promise: event.promise,
                timestamp: Date.now()
            });
        };
        
        window.addEventListener('error', this.windowErrorHandler);
        window.addEventListener('unhandledrejection', this.rejectionHandler);
    }
    
    removeErrorHandlers() {
        if (this.windowErrorHandler) {
            window.removeEventListener('error', this.windowErrorHandler);
        }
        if (this.rejectionHandler) {
            window.removeEventListener('unhandledrejection', this.rejectionHandler);
        }
    }
    
    /**
     * Phaser-specific error detection
     */
    installPhaserHooks() {
        // Hook into Phaser's error reporting if available
        if (typeof Phaser !== 'undefined') {
            // Monitor Phaser warnings
            if (Phaser.Utils && Phaser.Utils.Debug) {
                this.originalFunctions.phaserWarn = Phaser.Utils.Debug.warn;
                Phaser.Utils.Debug.warn = (...args) => {
                    this.errors.phaser.push({
                        type: 'phaser.warn',
                        message: args.join(' '),
                        timestamp: Date.now()
                    });
                    if (this.originalFunctions.phaserWarn) {
                        this.originalFunctions.phaserWarn.apply(Phaser.Utils.Debug, args);
                    }
                };
            }
            
            // Monitor texture errors
            this.monitorTextureErrors();
            
            // Monitor audio errors
            this.monitorAudioErrors();
            
            // Monitor physics errors
            this.monitorPhysicsErrors();
        }
    }
    
    removePhaserHooks() {
        if (this.originalFunctions.phaserWarn && Phaser?.Utils?.Debug) {
            Phaser.Utils.Debug.warn = this.originalFunctions.phaserWarn;
        }
    }
    
    monitorTextureErrors() {
        // Check for missing textures periodically
        this.textureCheckInterval = setInterval(() => {
            if (!this.enabled) return;
            
            const game = window.game || window.phaser?.game;
            if (!game) return;
            
            const scene = game.scene.scenes.find(s => s.scene.key === 'GameScene');
            if (!scene) return;
            
            // Check for missing texture warnings
            const textures = scene.textures;
            if (textures && textures.list) {
                const missingTexture = textures.get('__MISSING');
                if (missingTexture && missingTexture.frameTotal > 1) {
                    this.errors.phaser.push({
                        type: 'phaser.texture.missing',
                        message: 'Missing textures detected',
                        count: missingTexture.frameTotal - 1,
                        timestamp: Date.now()
                    });
                }
            }
        }, 5000);
    }
    
    monitorAudioErrors() {
        // Monitor audio decode errors
        if (window.AudioContext || window.webkitAudioContext) {
            const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
            const originalDecodeAudioData = OriginalAudioContext.prototype.decodeAudioData;
            
            if (originalDecodeAudioData) {
                OriginalAudioContext.prototype.decodeAudioData = function(...args) {
                    const errorCallback = args[2];
                    args[2] = (error) => {
                        this.errors.phaser.push({
                            type: 'audio.decode.error',
                            message: 'Audio decode failed',
                            error: error,
                            timestamp: Date.now()
                        });
                        if (errorCallback) errorCallback(error);
                    };
                    return originalDecodeAudioData.apply(this, args);
                }.bind(this);
            }
        }
    }
    
    monitorPhysicsErrors() {
        // Check for physics body errors
        this.physicsCheckInterval = setInterval(() => {
            if (!this.enabled) return;
            
            const game = window.game || window.phaser?.game;
            if (!game) return;
            
            const scene = game.scene.scenes.find(s => s.scene.key === 'GameScene');
            if (!scene || !scene.physics || !scene.physics.world) return;
            
            // Check for invalid bodies
            const bodies = scene.physics.world.bodies.entries;
            let invalidBodies = 0;
            
            bodies.forEach(body => {
                if (body && body.gameObject) {
                    if (isNaN(body.position.x) || isNaN(body.position.y)) {
                        invalidBodies++;
                    }
                }
            });
            
            if (invalidBodies > 0) {
                this.errors.phaser.push({
                    type: 'physics.invalid.bodies',
                    message: `Found ${invalidBodies} bodies with invalid positions`,
                    count: invalidBodies,
                    timestamp: Date.now()
                });
            }
        }, 10000);
    }
    
    /**
     * Performance monitoring
     */
    installPerformanceMonitoring() {
        // Monitor frame timing
        this.frameMonitor = setInterval(() => {
            if (!this.enabled) return;
            
            const game = window.game || window.phaser?.game;
            if (!game || !game.loop) return;
            
            const fps = game.loop.actualFps;
            const delta = game.loop.delta;
            
            // Check for frame drops
            if (fps < 20) {
                this.performance.frameDrops.push({
                    fps: fps,
                    delta: delta,
                    timestamp: Date.now()
                });
                
                this.errors.performance.push({
                    type: 'performance.lowFPS',
                    message: `FPS dropped to ${fps.toFixed(1)}`,
                    fps: fps,
                    timestamp: Date.now()
                });
            }
            
            // Check for long frames
            if (delta > this.performance.frameThreshold) {
                this.performance.longFrames.push({
                    delta: delta,
                    timestamp: Date.now()
                });
            }
        }, 1000);
        
        // Monitor memory usage
        this.memoryMonitor = setInterval(() => {
            if (!this.enabled || !performance.memory) return;
            
            const currentMemory = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
            const memoryDelta = currentMemory - this.performance.lastMemory;
            
            // Check for memory spikes
            if (memoryDelta > this.performance.memoryThreshold) {
                this.performance.memorySpikes.push({
                    previous: this.performance.lastMemory,
                    current: currentMemory,
                    delta: memoryDelta,
                    timestamp: Date.now()
                });
                
                this.errors.memory.push({
                    type: 'memory.spike',
                    message: `Memory spike detected: ${memoryDelta.toFixed(2)}MB increase`,
                    previous: this.performance.lastMemory,
                    current: currentMemory,
                    timestamp: Date.now()
                });
            }
            
            // Check for potential memory leak (continuous growth)
            if (this.checkMemoryLeak(currentMemory)) {
                this.errors.memory.push({
                    type: 'memory.leak.suspected',
                    message: 'Potential memory leak detected',
                    current: currentMemory,
                    timestamp: Date.now()
                });
            }
            
            this.performance.lastMemory = currentMemory;
        }, 5000);
    }
    
    removePerformanceMonitoring() {
        if (this.frameMonitor) {
            clearInterval(this.frameMonitor);
        }
        if (this.memoryMonitor) {
            clearInterval(this.memoryMonitor);
        }
        if (this.textureCheckInterval) {
            clearInterval(this.textureCheckInterval);
        }
        if (this.physicsCheckInterval) {
            clearInterval(this.physicsCheckInterval);
        }
    }
    
    checkMemoryLeak(currentMemory) {
        // Simple leak detection: continuous growth over time
        if (!this.memoryHistory) {
            this.memoryHistory = [];
        }
        
        this.memoryHistory.push(currentMemory);
        
        // Keep last 10 samples
        if (this.memoryHistory.length > 10) {
            this.memoryHistory.shift();
        }
        
        // Check if memory is consistently increasing
        if (this.memoryHistory.length >= 10) {
            let increasing = true;
            for (let i = 1; i < this.memoryHistory.length; i++) {
                if (this.memoryHistory[i] <= this.memoryHistory[i - 1]) {
                    increasing = false;
                    break;
                }
            }
            return increasing;
        }
        
        return false;
    }
    
    /**
     * Network monitoring for failed resource loads
     */
    installNetworkMonitoring() {
        // Monitor fetch errors
        this.originalFetch = window.fetch;
        window.fetch = (...args) => {
            return this.originalFetch(...args).catch(error => {
                this.errors.network.push({
                    type: 'network.fetch.error',
                    url: args[0],
                    error: error.message,
                    timestamp: Date.now()
                });
                throw error;
            });
        };
        
        // Monitor XMLHttpRequest errors
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        const detector = this;
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._url = url;
            this._method = method;
            return originalOpen.apply(this, [method, url, ...args]);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
            this.addEventListener('error', function() {
                detector.errors.network.push({
                    type: 'network.xhr.error',
                    url: this._url,
                    method: this._method,
                    timestamp: Date.now()
                });
            });
            
            this.addEventListener('load', function() {
                if (this.status >= 400) {
                    detector.errors.network.push({
                        type: 'network.xhr.httpError',
                        url: this._url,
                        method: this._method,
                        status: this.status,
                        timestamp: Date.now()
                    });
                }
            });
            
            return originalSend.apply(this, args);
        };
    }
    
    removeNetworkMonitoring() {
        if (this.originalFetch) {
            window.fetch = this.originalFetch;
        }
    }
    
    /**
     * Blueprint validation error detection
     */
    checkBlueprintErrors(blueprint, id) {
        const errors = [];
        
        // Check required fields
        if (!blueprint.id) {
            errors.push({
                type: 'blueprint.missing.id',
                blueprintId: id,
                message: 'Blueprint missing required field: id'
            });
        }
        
        if (!blueprint.type) {
            errors.push({
                type: 'blueprint.missing.type',
                blueprintId: id,
                message: 'Blueprint missing required field: type'
            });
        }
        
        // Check for invalid references
        if (blueprint.vfx) {
            Object.entries(blueprint.vfx).forEach(([key, value]) => {
                if (typeof value === 'string' && value.startsWith('vfx.') && !this.vfxExists(value)) {
                    errors.push({
                        type: 'blueprint.invalid.vfx',
                        blueprintId: id,
                        field: `vfx.${key}`,
                        value: value,
                        message: `Invalid VFX reference: ${value}`
                    });
                }
            });
        }
        
        if (blueprint.sfx) {
            Object.entries(blueprint.sfx).forEach(([key, value]) => {
                if (typeof value === 'string' && !value.includes('/') && !this.sfxExists(value)) {
                    errors.push({
                        type: 'blueprint.invalid.sfx',
                        blueprintId: id,
                        field: `sfx.${key}`,
                        value: value,
                        message: `Invalid SFX reference: ${value}`
                    });
                }
            });
        }
        
        errors.forEach(error => {
            this.errors.blueprint.push({
                ...error,
                timestamp: Date.now()
            });
        });
        
        return errors;
    }
    
    vfxExists(id) {
        // Check if VFX is registered
        const scene = this.getGameScene();
        if (scene?.vfxSystem?.registry) {
            return scene.vfxSystem.registry.has(id);
        }
        return true; // Assume valid if can't check
    }
    
    sfxExists(id) {
        // Check if SFX is registered or is a file path
        if (id.includes('/')) return true; // File path
        
        const scene = this.getGameScene();
        if (scene?.audioSystem?.registry) {
            return scene.audioSystem.registry.has(id);
        }
        return true; // Assume valid if can't check
    }
    
    /**
     * State consistency checks
     */
    setupDefaultStateChecks() {
        // Player state check
        this.stateChecks.set('player', () => {
            const scene = this.getGameScene();
            if (!scene?.player) return null;
            
            const player = scene.player;
            const errors = [];
            
            if (player.hp < 0 || player.hp > player.maxHp) {
                errors.push(`Invalid player HP: ${player.hp}/${player.maxHp}`);
            }
            
            if (isNaN(player.x) || isNaN(player.y)) {
                errors.push(`Invalid player position: ${player.x}, ${player.y}`);
            }
            
            return errors.length > 0 ? errors : null;
        });
        
        // Enemy state check
        this.stateChecks.set('enemies', () => {
            const scene = this.getGameScene();
            if (!scene?.enemies) return null;
            
            const errors = [];
            const enemies = scene.enemies.getChildren();
            
            enemies.forEach((enemy, index) => {
                if (enemy.hp < 0) {
                    errors.push(`Enemy ${index} has negative HP: ${enemy.hp}`);
                }
                
                if (isNaN(enemy.x) || isNaN(enemy.y)) {
                    errors.push(`Enemy ${index} has invalid position`);
                }
                
                if (enemy.active && !enemy.body) {
                    errors.push(`Active enemy ${index} missing physics body`);
                }
            });
            
            return errors.length > 0 ? errors : null;
        });
        
        // Projectile state check
        this.stateChecks.set('projectiles', () => {
            const scene = this.getGameScene();
            if (!scene) return null;
            
            const errors = [];
            const playerProj = scene.playerProjectiles?.getChildren() || [];
            const enemyProj = scene.enemyProjectiles?.getChildren() || [];
            const allProjectiles = [...playerProj, ...enemyProj];
            
            if (allProjectiles.length > 500) {
                errors.push(`Too many projectiles: ${allProjectiles.length}`);
            }
            
            allProjectiles.forEach((proj, index) => {
                if (proj.active && (isNaN(proj.x) || isNaN(proj.y))) {
                    errors.push(`Projectile ${index} has invalid position`);
                }
            });
            
            return errors.length > 0 ? errors : null;
        });
    }
    
    runStateChecks() {
        this.stateChecks.forEach((checkFn, name) => {
            try {
                const errors = checkFn();
                if (errors) {
                    this.errors.state.push({
                        type: `state.inconsistency.${name}`,
                        errors: errors,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                this.errors.state.push({
                    type: `state.check.error.${name}`,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        });
    }
    
    /**
     * Pattern matching for known issues
     */
    checkErrorPatterns(error) {
        const patterns = {
            'texture.missing': /texture.*not found|missing.*texture/i,
            'audio.missing': /audio.*not found|missing.*audio|sound.*not found/i,
            'null.reference': /cannot read.*null|cannot read.*undefined/i,
            'type.error': /is not a function|is not defined/i,
            'blueprint.error': /blueprint.*error|blueprint.*invalid/i,
            'vfx.error': /vfx.*error|effect.*not found/i,
            'sfx.error': /sfx.*error|sound.*error/i
        };
        
        Object.entries(patterns).forEach(([type, pattern]) => {
            if (pattern.test(error.message)) {
                error.category = type;
            }
        });
    }
    
    checkWarningPatterns(warning) {
        const patterns = {
            'deprecation': /deprecated|will be removed/i,
            'performance': /performance|slow|lag/i,
            'memory': /memory|leak|heap/i,
            'missing.asset': /missing|not found|404/i
        };
        
        Object.entries(patterns).forEach(([type, pattern]) => {
            if (pattern.test(warning.message)) {
                warning.category = type;
            }
        });
    }
    
    /**
     * Utility functions
     */
    getGameScene() {
        const game = window.game || window.phaser?.game;
        if (!game) return null;
        
        return game.scene.scenes.find(s => s.scene.key === 'GameScene');
    }
    
    stringifyArg(arg) {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg, null, 2);
            } catch {
                return arg.toString();
            }
        }
        return String(arg);
    }
    
    clearErrors() {
        Object.keys(this.errors).forEach(key => {
            this.errors[key] = [];
        });
        
        this.performance.frameDrops = [];
        this.performance.longFrames = [];
        this.performance.memorySpikes = [];
    }
    
    getTotalErrorCount() {
        return Object.values(this.errors).reduce((sum, arr) => sum + arr.length, 0);
    }
    
    /**
     * Generate comprehensive error report
     */
    generateReport() {
        const duration = Date.now() - this.startTime;
        
        // Categorize errors by severity
        const critical = [];
        const warnings = [];
        const info = [];
        
        // JavaScript errors are critical
        critical.push(...this.errors.javascript);
        
        // Console errors based on content
        this.errors.console.forEach(error => {
            if (error.type === 'console.error') {
                critical.push(error);
            } else if (error.type === 'console.warn') {
                warnings.push(error);
            } else {
                info.push(error);
            }
        });
        
        // Phaser errors are usually critical
        critical.push(...this.errors.phaser);
        
        // Blueprint errors are warnings
        warnings.push(...this.errors.blueprint);
        
        // Performance issues are warnings
        warnings.push(...this.errors.performance);
        
        // Memory issues can be critical
        this.errors.memory.forEach(error => {
            if (error.type === 'memory.leak.suspected') {
                critical.push(error);
            } else {
                warnings.push(error);
            }
        });
        
        // State inconsistencies are critical
        critical.push(...this.errors.state);
        
        // Network errors are warnings
        warnings.push(...this.errors.network);
        
        const report = {
            summary: {
                duration: duration,
                totalErrors: this.getTotalErrorCount(),
                critical: critical.length,
                warnings: warnings.length,
                info: info.length,
                status: critical.length === 0 ? 'PASSED' : 'FAILED',
                timestamp: new Date().toISOString()
            },
            
            errorsByType: {
                javascript: this.errors.javascript.length,
                console: this.errors.console.length,
                phaser: this.errors.phaser.length,
                blueprint: this.errors.blueprint.length,
                performance: this.errors.performance.length,
                memory: this.errors.memory.length,
                state: this.errors.state.length,
                network: this.errors.network.length
            },
            
            critical: critical.slice(0, 20), // First 20
            warnings: warnings.slice(0, 20),
            info: info.slice(0, 10),
            
            performance: {
                frameDrops: this.performance.frameDrops.length,
                longFrames: this.performance.longFrames.length,
                memorySpikes: this.performance.memorySpikes.length,
                worstFPS: this.performance.frameDrops.length > 0 ?
                    Math.min(...this.performance.frameDrops.map(f => f.fps)) : null,
                longestFrame: this.performance.longFrames.length > 0 ?
                    Math.max(...this.performance.longFrames.map(f => f.delta)) : null
            },
            
            patterns: this.analyzeErrorPatterns(),
            
            recommendations: this.generateRecommendations(critical, warnings)
        };
        
        // Store for debugging
        window.__errorDetectorReport = report;
        
        return report;
    }
    
    analyzeErrorPatterns() {
        const patterns = {};
        
        // Count errors by category
        Object.values(this.errors).flat().forEach(error => {
            if (error.category) {
                patterns[error.category] = (patterns[error.category] || 0) + 1;
            }
        });
        
        return patterns;
    }
    
    generateRecommendations(critical, warnings) {
        const recommendations = [];
        
        if (critical.some(e => e.type?.includes('texture'))) {
            recommendations.push('Missing textures detected - check asset loading');
        }
        
        if (critical.some(e => e.type?.includes('audio'))) {
            recommendations.push('Audio errors detected - check sound file paths');
        }
        
        if (this.errors.memory.some(e => e.type === 'memory.leak.suspected')) {
            recommendations.push('Potential memory leak - check object disposal');
        }
        
        if (this.errors.performance.length > 10) {
            recommendations.push('Performance issues detected - optimize rendering');
        }
        
        if (this.errors.state.length > 0) {
            recommendations.push('State inconsistencies found - review game logic');
        }
        
        if (this.errors.network.length > 0) {
            recommendations.push('Network errors detected - check resource URLs');
        }
        
        return recommendations;
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.ErrorDetector = ErrorDetector;
}