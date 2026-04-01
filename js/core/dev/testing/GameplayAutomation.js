/**
 * GameplayAutomation - Automated gameplay testing engine
 * 
 * Features:
 * - Bot player with AI-driven movement and targeting
 * - Scenario execution with state validation
 * - Performance monitoring and profiling
 * - Error and warning collection
 * - Detailed reporting with metrics
 */

import { DebugLogger } from '../debug/DebugLogger.js';

export class GameplayAutomation {
    constructor(scene) {
        this.scene = scene;
        this.enabled = false;
        this.currentScenario = null;
        
        // Bot configuration
        this.botConfig = {
            movementPattern: 'aggressive', // aggressive, defensive, random, circle
            targetPriority: 'nearest', // nearest, strongest, weakest, boss
            dodgeProjectiles: true,
            collectLoot: true,
            useAbilities: true,
            reactionTime: 100, // ms
            aimAccuracy: 0.9, // 0-1
            movementSpeed: 1.0 // multiplier
        };
        
        // State tracking
        this.state = {
            startTime: null,
            frameCount: 0,
            lastUpdateTime: 0,
            playerPos: { x: 0, y: 0 },
            nearestEnemy: null,
            nearestLoot: null,
            inDanger: false,
            health: 100,
            maxHealth: 100
        };
        
        // Metrics collection
        this.metrics = {
            fps: [],
            memoryUsage: [],
            entityCounts: [],
            eventLog: [],
            errors: [],
            warnings: [],
            stateValidations: [],
            performanceMarks: {}
        };
        
        // Validation rules
        this.validators = new Map();
        this.setupDefaultValidators();
        
        // Performance monitoring
        this.performanceMonitor = {
            lastCheck: Date.now(),
            interval: 1000, // Check every second
            thresholds: {
                minFPS: 30,
                maxMemoryMB: 500,
                maxEntityCount: 500,
                maxProjectiles: 100
            }
        };
        
        DebugLogger.log('GameplayAutomation initialized');
    }
    
    /**
     * Start automated gameplay
     */
    start(scenario = null) {
        if (this.enabled) {
            DebugLogger.warn('GameplayAutomation already running');
            return;
        }
        
        this.enabled = true;
        this.state.startTime = Date.now();
        this.currentScenario = scenario;
        
        // Reset metrics
        this.resetMetrics();
        
        // Install hooks
        this.installHooks();
        
        // Start scenario if provided
        if (scenario) {
            this.executeScenario(scenario);
        }
        
        DebugLogger.log('GameplayAutomation started', { scenario: scenario?.name });
        this.logEvent('automation_started', { scenario: scenario?.name });
    }
    
    /**
     * Stop automated gameplay
     */
    stop() {
        if (!this.enabled) return;
        
        this.enabled = false;
        this.currentScenario = null;
        
        // Remove hooks
        this.removeHooks();
        
        // Generate final report
        const report = this.generateReport();
        
        DebugLogger.log('GameplayAutomation stopped');
        this.logEvent('automation_stopped', { duration: Date.now() - this.state.startTime });
        
        return report;
    }
    
    /**
     * Main update loop for bot behavior
     */
    update(time, delta) {
        if (!this.enabled) return;
        
        this.state.frameCount++;
        this.state.lastUpdateTime = time;
        
        // Update state
        this.updateState();
        
        // Run validations
        this.runValidations();
        
        // Monitor performance
        this.monitorPerformance();
        
        // Execute bot behavior
        this.executeBotBehavior(delta);
        
        // Update scenario
        if (this.currentScenario) {
            this.currentScenario.update(time, delta);
        }
    }
    
    /**
     * Update current game state
     */
    updateState() {
        const player = this.scene.player;
        if (!player) return;
        
        // Update player position
        this.state.playerPos = { x: player.x, y: player.y };
        this.state.health = player.hp || 0;
        this.state.maxHealth = player.maxHp || 100;
        
        // Find nearest enemy
        const enemies = this.scene.enemies?.getChildren() || [];
        this.state.nearestEnemy = this.findNearest(this.state.playerPos, enemies);
        
        // Find nearest loot
        const loot = this.scene.loot?.getChildren() || [];
        this.state.nearestLoot = this.findNearest(this.state.playerPos, loot);
        
        // Check if in danger (projectiles nearby)
        this.state.inDanger = this.checkDanger();
    }
    
    /**
     * Execute bot AI behavior
     */
    executeBotBehavior(delta) {
        const player = this.scene.player;
        if (!player || !player.active) return;
        
        // Reaction time delay
        if (Math.random() > this.botConfig.reactionTime / 1000) return;
        
        // Priority system
        if (this.state.inDanger && this.botConfig.dodgeProjectiles) {
            this.dodgeProjectiles();
        } else if (this.state.health < this.state.maxHealth * 0.3) {
            this.seekHealth();
        } else if (this.state.nearestLoot && this.botConfig.collectLoot) {
            this.collectLoot();
        } else if (this.state.nearestEnemy) {
            this.engageEnemy();
        } else {
            this.patrol();
        }
        
        // Use abilities if configured
        if (this.botConfig.useAbilities) {
            this.useAbilities();
        }
    }
    
    /**
     * Dodge incoming projectiles
     */
    dodgeProjectiles() {
        const projectiles = this.scene.enemyProjectiles?.getChildren() || [];
        const dangerousProjectiles = projectiles.filter(p => {
            const dist = Phaser.Math.Distance.Between(
                this.state.playerPos.x, this.state.playerPos.y,
                p.x, p.y
            );
            return dist < 100 && p.active;
        });
        
        if (dangerousProjectiles.length === 0) return;
        
        // Calculate safe direction
        let safeX = 0, safeY = 0;
        dangerousProjectiles.forEach(p => {
            const angle = Phaser.Math.Angle.Between(p.x, p.y, 
                this.state.playerPos.x, this.state.playerPos.y);
            safeX += Math.cos(angle);
            safeY += Math.sin(angle);
        });
        
        // Move away from danger
        this.movePlayer(safeX, safeY);
        this.logEvent('dodge_projectiles', { count: dangerousProjectiles.length });
    }
    
    /**
     * Seek health pickups
     */
    seekHealth() {
        const healthPickups = this.scene.loot?.getChildren().filter(l => 
            l.type === 'health' && l.active
        ) || [];
        
        const nearest = this.findNearest(this.state.playerPos, healthPickups);
        if (nearest) {
            this.moveToward(nearest);
            this.logEvent('seek_health', { distance: this.getDistance(nearest) });
        }
    }
    
    /**
     * Collect nearby loot
     */
    collectLoot() {
        if (!this.state.nearestLoot) return;
        
        const distance = this.getDistance(this.state.nearestLoot);
        if (distance < 200) {
            this.moveToward(this.state.nearestLoot);
            this.logEvent('collect_loot', { type: this.state.nearestLoot.type, distance });
        }
    }
    
    /**
     * Engage nearest enemy
     */
    engageEnemy() {
        if (!this.state.nearestEnemy) return;
        
        const enemy = this.state.nearestEnemy;
        const distance = this.getDistance(enemy);
        
        // Aim at enemy with accuracy
        const aimOffset = (1 - this.botConfig.aimAccuracy) * 50;
        const targetX = enemy.x + (Math.random() - 0.5) * aimOffset;
        const targetY = enemy.y + (Math.random() - 0.5) * aimOffset;
        
        // Simulate mouse position for aiming
        if (this.scene.input) {
            this.scene.input.activePointer.x = targetX;
            this.scene.input.activePointer.y = targetY;
        }
        
        // Movement based on pattern
        switch (this.botConfig.movementPattern) {
            case 'aggressive':
                if (distance > 150) this.moveToward(enemy);
                break;
            case 'defensive':
                if (distance < 200) this.moveAway(enemy);
                break;
            case 'circle':
                this.circleAround(enemy);
                break;
            case 'random':
                this.moveRandom();
                break;
        }
        
        this.logEvent('engage_enemy', { 
            enemyId: enemy.blueprintId, 
            distance, 
            pattern: this.botConfig.movementPattern 
        });
    }
    
    /**
     * Patrol movement when no targets
     */
    patrol() {
        switch (this.botConfig.movementPattern) {
            case 'circle':
                const centerX = this.scene.cameras.main.width / 2;
                const centerY = this.scene.cameras.main.height / 2;
                this.circleAround({ x: centerX, y: centerY }, 200);
                break;
            default:
                this.moveRandom();
        }
    }
    
    /**
     * Use player abilities
     */
    useAbilities() {
        // Check if abilities are available
        const player = this.scene.player;
        if (!player) return;
        
        // Simulate ability usage based on cooldowns
        if (player.canUseAbility && player.canUseAbility('primary')) {
            if (Math.random() < 0.1) { // 10% chance per frame
                player.useAbility('primary');
                this.logEvent('use_ability', { ability: 'primary' });
            }
        }
    }
    
    /**
     * Movement helpers
     */
    movePlayer(x, y) {
        const player = this.scene.player;
        if (!player) return;
        
        // Normalize movement vector
        const mag = Math.sqrt(x * x + y * y);
        if (mag > 0) {
            x /= mag;
            y /= mag;
        }
        
        // Apply movement speed multiplier
        x *= this.botConfig.movementSpeed;
        y *= this.botConfig.movementSpeed;
        
        // Simulate keyboard input
        if (this.scene.keyboardManager) {
            this.scene.keyboardManager.simulateInput({
                up: y < -0.1,
                down: y > 0.1,
                left: x < -0.1,
                right: x > 0.1
            });
        }
    }
    
    moveToward(target) {
        const dx = target.x - this.state.playerPos.x;
        const dy = target.y - this.state.playerPos.y;
        this.movePlayer(dx, dy);
    }
    
    moveAway(target) {
        const dx = this.state.playerPos.x - target.x;
        const dy = this.state.playerPos.y - target.y;
        this.movePlayer(dx, dy);
    }
    
    circleAround(target, radius = 150) {
        const angle = Phaser.Math.Angle.Between(
            target.x, target.y,
            this.state.playerPos.x, this.state.playerPos.y
        );
        const perpAngle = angle + Math.PI / 2;
        const dx = Math.cos(perpAngle);
        const dy = Math.sin(perpAngle);
        this.movePlayer(dx, dy);
    }
    
    moveRandom() {
        if (Math.random() < 0.02) { // Change direction 2% of the time
            const angle = Math.random() * Math.PI * 2;
            this.randomDirection = { x: Math.cos(angle), y: Math.sin(angle) };
        }
        if (this.randomDirection) {
            this.movePlayer(this.randomDirection.x, this.randomDirection.y);
        }
    }
    
    /**
     * Helper functions
     */
    findNearest(pos, entities) {
        let nearest = null;
        let minDist = Infinity;
        
        entities.forEach(entity => {
            if (!entity.active) return;
            const dist = Phaser.Math.Distance.Between(pos.x, pos.y, entity.x, entity.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = entity;
            }
        });
        
        return nearest;
    }
    
    getDistance(target) {
        return Phaser.Math.Distance.Between(
            this.state.playerPos.x, this.state.playerPos.y,
            target.x, target.y
        );
    }
    
    checkDanger() {
        const projectiles = this.scene.enemyProjectiles?.getChildren() || [];
        return projectiles.some(p => {
            if (!p.active) return false;
            const dist = this.getDistance(p);
            return dist < 100;
        });
    }
    
    /**
     * Validation system
     */
    setupDefaultValidators() {
        // Player health validator
        this.addValidator('player_health', () => {
            const player = this.scene.player;
            if (!player) return { valid: true };
            
            const valid = player.hp >= 0 && player.hp <= player.maxHp;
            return {
                valid,
                message: valid ? null : `Invalid player health: ${player.hp}/${player.maxHp}`
            };
        });
        
        // Enemy count validator
        this.addValidator('enemy_count', () => {
            const enemies = this.scene.enemies?.getChildren() || [];
            const valid = enemies.length <= 200;
            return {
                valid,
                message: valid ? null : `Too many enemies: ${enemies.length}`
            };
        });
        
        // Projectile count validator
        this.addValidator('projectile_count', () => {
            const playerProj = this.scene.playerProjectiles?.getChildren() || [];
            const enemyProj = this.scene.enemyProjectiles?.getChildren() || [];
            const total = playerProj.length + enemyProj.length;
            const valid = total <= 300;
            return {
                valid,
                message: valid ? null : `Too many projectiles: ${total}`
            };
        });
        
        // Memory usage validator
        this.addValidator('memory_usage', () => {
            if (!performance.memory) return { valid: true };
            
            const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024;
            const valid = usedMB < this.performanceMonitor.thresholds.maxMemoryMB;
            return {
                valid,
                message: valid ? null : `High memory usage: ${usedMB.toFixed(2)}MB`
            };
        });
    }
    
    addValidator(name, fn) {
        this.validators.set(name, fn);
    }
    
    runValidations() {
        const results = [];
        
        this.validators.forEach((fn, name) => {
            try {
                const result = fn();
                if (!result.valid) {
                    results.push({
                        name,
                        valid: false,
                        message: result.message,
                        timestamp: Date.now()
                    });
                    this.logWarning(`Validation failed: ${name}`, result);
                }
            } catch (error) {
                this.logError(`Validator error: ${name}`, error);
            }
        });
        
        this.metrics.stateValidations.push(...results);
    }
    
    /**
     * Performance monitoring
     */
    monitorPerformance() {
        const now = Date.now();
        if (now - this.performanceMonitor.lastCheck < this.performanceMonitor.interval) {
            return;
        }
        this.performanceMonitor.lastCheck = now;
        
        // Collect FPS
        const fps = this.scene.game.loop.actualFps || 0;
        this.metrics.fps.push({ time: now, value: fps });
        
        // Collect memory usage
        if (performance.memory) {
            const memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
            this.metrics.memoryUsage.push({ time: now, value: memoryMB });
        }
        
        // Collect entity counts
        const entities = {
            enemies: this.scene.enemies?.getChildren().length || 0,
            projectiles: (this.scene.playerProjectiles?.getChildren().length || 0) + 
                        (this.scene.enemyProjectiles?.getChildren().length || 0),
            loot: this.scene.loot?.getChildren().length || 0,
            vfx: this.scene.vfxSystem?.getActiveCount?.() || 0
        };
        this.metrics.entityCounts.push({ time: now, ...entities });
        
        // Check thresholds
        if (fps < this.performanceMonitor.thresholds.minFPS) {
            this.logWarning('Low FPS detected', { fps });
        }
        
        if (entities.enemies > this.performanceMonitor.thresholds.maxEntityCount) {
            this.logWarning('High entity count', entities);
        }
    }
    
    /**
     * Scenario execution
     */
    async executeScenario(scenario) {
        try {
            this.logEvent('scenario_start', { name: scenario.name });
            
            // Initialize scenario
            await scenario.setup(this);
            
            // Run scenario steps
            for (const step of scenario.steps) {
                if (!this.enabled) break;
                
                this.logEvent('scenario_step', { name: step.name });
                await step.execute(this);
                
                // Validate after each step
                if (step.validate) {
                    const valid = await step.validate(this);
                    if (!valid) {
                        this.logError('Scenario step validation failed', { step: step.name });
                        break;
                    }
                }
            }
            
            // Cleanup scenario
            await scenario.teardown(this);
            
            this.logEvent('scenario_complete', { name: scenario.name });
            
        } catch (error) {
            this.logError('Scenario execution failed', error);
        }
    }
    
    /**
     * Hook installation for error detection
     */
    installHooks() {
        // Hook console methods
        this.originalConsole = {
            error: console.error,
            warn: console.warn
        };
        
        console.error = (...args) => {
            this.logError('Console error', args);
            this.originalConsole.error(...args);
        };
        
        console.warn = (...args) => {
            this.logWarning('Console warning', args);
            this.originalConsole.warn(...args);
        };
        
        // Hook window error
        this.errorHandler = (event) => {
            this.logError('Window error', {
                message: event.message,
                source: event.filename,
                line: event.lineno,
                col: event.colno,
                error: event.error
            });
        };
        window.addEventListener('error', this.errorHandler);
        
        // Hook unhandled promise rejection
        this.rejectionHandler = (event) => {
            this.logError('Unhandled promise rejection', {
                reason: event.reason,
                promise: event.promise
            });
        };
        window.addEventListener('unhandledrejection', this.rejectionHandler);
    }
    
    removeHooks() {
        // Restore console
        if (this.originalConsole) {
            console.error = this.originalConsole.error;
            console.warn = this.originalConsole.warn;
        }
        
        // Remove event listeners
        if (this.errorHandler) {
            window.removeEventListener('error', this.errorHandler);
        }
        if (this.rejectionHandler) {
            window.removeEventListener('unhandledrejection', this.rejectionHandler);
        }
    }
    
    /**
     * Logging utilities
     */
    logEvent(type, data = {}) {
        this.metrics.eventLog.push({
            type,
            data,
            timestamp: Date.now(),
            frame: this.state.frameCount
        });
    }
    
    logError(message, details) {
        this.metrics.errors.push({
            message,
            details,
            timestamp: Date.now(),
            frame: this.state.frameCount,
            stack: new Error().stack
        });
        DebugLogger.error(`[GameplayAutomation] ${message}`, details);
    }
    
    logWarning(message, details) {
        this.metrics.warnings.push({
            message,
            details,
            timestamp: Date.now(),
            frame: this.state.frameCount
        });
        DebugLogger.warn(`[GameplayAutomation] ${message}`, details);
    }
    
    /**
     * Performance marks for measuring specific operations
     */
    markStart(name) {
        this.metrics.performanceMarks[name] = {
            start: performance.now()
        };
    }
    
    markEnd(name) {
        if (this.metrics.performanceMarks[name]) {
            this.metrics.performanceMarks[name].end = performance.now();
            this.metrics.performanceMarks[name].duration = 
                this.metrics.performanceMarks[name].end - 
                this.metrics.performanceMarks[name].start;
        }
    }
    
    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            fps: [],
            memoryUsage: [],
            entityCounts: [],
            eventLog: [],
            errors: [],
            warnings: [],
            stateValidations: [],
            performanceMarks: {}
        };
    }
    
    /**
     * Generate comprehensive report
     */
    generateReport() {
        const duration = Date.now() - this.state.startTime;
        
        // Calculate averages
        const avgFPS = this.metrics.fps.length > 0 ?
            this.metrics.fps.reduce((sum, f) => sum + f.value, 0) / this.metrics.fps.length : 0;
        
        const avgMemory = this.metrics.memoryUsage.length > 0 ?
            this.metrics.memoryUsage.reduce((sum, m) => sum + m.value, 0) / this.metrics.memoryUsage.length : 0;
        
        // Find min/max values
        const minFPS = Math.min(...this.metrics.fps.map(f => f.value));
        const maxFPS = Math.max(...this.metrics.fps.map(f => f.value));
        
        const report = {
            summary: {
                duration,
                frames: this.state.frameCount,
                scenario: this.currentScenario?.name || 'free_play',
                status: this.metrics.errors.length === 0 ? 'PASSED' : 'FAILED',
                timestamp: new Date().toISOString()
            },
            
            performance: {
                fps: {
                    average: avgFPS.toFixed(2),
                    min: minFPS.toFixed(2),
                    max: maxFPS.toFixed(2),
                    samples: this.metrics.fps.length
                },
                memory: {
                    average: avgMemory.toFixed(2) + 'MB',
                    samples: this.metrics.memoryUsage.length
                },
                marks: this.metrics.performanceMarks
            },
            
            issues: {
                errors: this.metrics.errors.length,
                warnings: this.metrics.warnings.length,
                validationFailures: this.metrics.stateValidations.length,
                details: {
                    errors: this.metrics.errors.slice(0, 10), // First 10
                    warnings: this.metrics.warnings.slice(0, 10),
                    validations: this.metrics.stateValidations.slice(0, 10)
                }
            },
            
            events: {
                total: this.metrics.eventLog.length,
                byType: this.groupEventsByType(),
                timeline: this.metrics.eventLog.slice(-100) // Last 100 events
            },
            
            entities: {
                maxCounts: this.getMaxEntityCounts(),
                timeline: this.metrics.entityCounts
            },
            
            botStats: {
                config: this.botConfig,
                finalState: this.state
            }
        };
        
        // Store in window for debugging
        window.__automationReport = report;
        
        return report;
    }
    
    groupEventsByType() {
        const groups = {};
        this.metrics.eventLog.forEach(event => {
            if (!groups[event.type]) {
                groups[event.type] = 0;
            }
            groups[event.type]++;
        });
        return groups;
    }
    
    getMaxEntityCounts() {
        const max = {
            enemies: 0,
            projectiles: 0,
            loot: 0,
            vfx: 0
        };
        
        this.metrics.entityCounts.forEach(count => {
            max.enemies = Math.max(max.enemies, count.enemies || 0);
            max.projectiles = Math.max(max.projectiles, count.projectiles || 0);
            max.loot = Math.max(max.loot, count.loot || 0);
            max.vfx = Math.max(max.vfx, count.vfx || 0);
        });
        
        return max;
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.GameplayAutomation = GameplayAutomation;
}