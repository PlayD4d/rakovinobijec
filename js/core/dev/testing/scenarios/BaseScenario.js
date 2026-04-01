/**
 * BaseScenario - Base class for all test scenarios
 * 
 * Provides common functionality for test scenarios:
 * - Setup and teardown
 * - Step execution
 * - Validation
 * - Reporting
 */

import { DebugLogger } from '../../debug/DebugLogger.js';

export class BaseScenario {
    constructor(name, description = '') {
        this.name = name;
        this.description = description;
        this.steps = [];
        this.results = [];
        this.startTime = null;
        this.endTime = null;
        this.status = 'pending'; // pending, running, passed, failed, error
        
        // Default configuration
        this.config = {
            timeout: 60000, // 60 seconds default timeout
            retryOnFailure: false,
            captureScreenshots: false,
            continueOnError: false
        };
        
        DebugLogger.log(`Scenario created: ${name}`);
    }
    
    /**
     * Add a test step
     */
    addStep(name, executeFn, validateFn = null) {
        this.steps.push({
            name,
            execute: executeFn,
            validate: validateFn,
            status: 'pending',
            result: null,
            duration: 0
        });
        return this;
    }
    
    /**
     * Setup - override in subclasses
     */
    async setup(automation) {
        DebugLogger.log(`Setting up scenario: ${this.name}`);
        this.automation = automation;
        this.startTime = Date.now();
        this.status = 'running';
        
        // Start error detection
        if (!automation.errorDetector) {
            const { ErrorDetector } = await import('../ErrorDetector.js');
            automation.errorDetector = new ErrorDetector();
        }
        automation.errorDetector.start();
        
        return true;
    }
    
    /**
     * Teardown - override in subclasses
     */
    async teardown(automation) {
        DebugLogger.log(`Tearing down scenario: ${this.name}`);
        this.endTime = Date.now();
        
        // Stop error detection and get report
        if (automation.errorDetector) {
            const errorReport = automation.errorDetector.stop();
            this.errorReport = errorReport;
        }
        
        // Generate final status
        this.updateStatus();
        
        return true;
    }
    
    /**
     * Execute the scenario
     */
    async execute(automation) {
        try {
            // Setup
            const setupSuccess = await this.setup(automation);
            if (!setupSuccess) {
                throw new Error('Scenario setup failed');
            }
            
            // Execute each step
            for (let i = 0; i < this.steps.length; i++) {
                const step = this.steps[i];
                
                try {
                    await this.executeStep(step, automation);
                } catch (error) {
                    step.status = 'error';
                    step.error = error;
                    
                    if (!this.config.continueOnError) {
                        throw error;
                    }
                }
            }
            
            // Teardown
            await this.teardown(automation);
            
        } catch (error) {
            this.status = 'error';
            this.error = error;
            DebugLogger.error(`Scenario failed: ${this.name}`, error);
            
            // Still try to teardown
            try {
                await this.teardown(automation);
            } catch (teardownError) {
                DebugLogger.error('Teardown failed', teardownError);
            }
        }
        
        return this.generateReport();
    }
    
    /**
     * Execute a single step
     */
    async executeStep(step, automation) {
        DebugLogger.log(`Executing step: ${step.name}`);
        const stepStartTime = Date.now();
        step.status = 'running';
        
        try {
            // Execute with timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Step timeout')), this.config.timeout);
            });
            
            const executePromise = step.execute(automation, this);
            
            step.result = await Promise.race([executePromise, timeoutPromise]);
            
            // Validate if validation function provided
            if (step.validate) {
                const valid = await step.validate(automation, step.result);
                if (!valid) {
                    throw new Error(`Step validation failed: ${step.name}`);
                }
            }
            
            step.status = 'passed';
            step.duration = Date.now() - stepStartTime;
            
            DebugLogger.log(`Step completed: ${step.name} (${step.duration}ms)`);
            
        } catch (error) {
            step.status = 'failed';
            step.error = error.message;
            step.duration = Date.now() - stepStartTime;
            
            DebugLogger.error(`Step failed: ${step.name}`, error);
            
            if (this.config.retryOnFailure) {
                DebugLogger.log(`Retrying step: ${step.name}`);
                // One retry attempt
                try {
                    step.result = await step.execute(automation, this);
                    step.status = 'passed';
                } catch (retryError) {
                    throw retryError;
                }
            } else {
                throw error;
            }
        }
    }
    
    /**
     * Helper methods for common test actions
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async waitForCondition(conditionFn, timeout = 10000, checkInterval = 100) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (await conditionFn()) {
                return true;
            }
            await this.wait(checkInterval);
        }
        
        throw new Error('Condition timeout');
    }
    
    async waitForPlayer(automation) {
        return this.waitForCondition(() => {
            const scene = this.getGameScene();
            return scene && scene.player && scene.player.active;
        });
    }
    
    async waitForEnemies(automation, minCount = 1) {
        return this.waitForCondition(() => {
            const scene = this.getGameScene();
            const enemies = scene?.enemies?.getChildren() || [];
            return enemies.filter(e => e.active).length >= minCount;
        });
    }
    
    async waitForBoss(automation) {
        return this.waitForCondition(() => {
            const scene = this.getGameScene();
            const bosses = scene?.enemies?.getChildren().filter(e => e.isBoss) || [];
            return bosses.length > 0 && bosses[0].active;
        });
    }
    
    async waitForPowerUp(automation) {
        return this.waitForCondition(() => {
            const scene = this.getGameScene();
            return scene?.isPowerUpSelectionActive || false;
        });
    }
    
    /**
     * Common actions
     */
    async spawnEnemy(automation, enemyId) {
        const scene = this.getGameScene();
        if (!scene || !window.DEV) {
            throw new Error('Cannot spawn enemy - DEV API not available');
        }
        
        window.DEV.spawnEnemy(enemyId);
        await this.wait(100);
        
        return true;
    }
    
    async spawnBoss(automation, bossId) {
        const scene = this.getGameScene();
        if (!scene || !window.DEV) {
            throw new Error('Cannot spawn boss - DEV API not available');
        }
        
        window.DEV.spawnBoss(bossId);
        await this.wait(500);
        
        return true;
    }
    
    async givePowerUp(automation, powerUpId) {
        if (!window.DEV) {
            throw new Error('DEV API not available');
        }
        
        window.DEV.givePowerUp(powerUpId);
        await this.wait(100);
        
        return true;
    }
    
    async levelUp(automation) {
        if (!window.DEV) {
            throw new Error('DEV API not available');
        }
        
        window.DEV.levelUp();
        await this.wait(500);
        
        return true;
    }
    
    async killAll(automation) {
        if (!window.DEV) {
            throw new Error('DEV API not available');
        }
        
        window.DEV.killAll();
        await this.wait(100);
        
        return true;
    }
    
    /**
     * Validation helpers
     */
    validatePlayerHealth(minHealth = 0) {
        const scene = this.getGameScene();
        const player = scene?.player;
        
        if (!player) return false;
        
        return player.hp >= minHealth && player.hp <= player.maxHp;
    }
    
    validateEnemyCount(min = 0, max = 100) {
        const scene = this.getGameScene();
        const enemies = scene?.enemies?.getChildren() || [];
        const activeCount = enemies.filter(e => e.active).length;
        
        return activeCount >= min && activeCount <= max;
    }
    
    validateNoErrors(automation) {
        if (!automation.errorDetector) return true;
        
        const errors = automation.errorDetector.errors;
        const criticalErrors = errors.javascript.length + errors.phaser.length + errors.state.length;
        
        return criticalErrors === 0;
    }
    
    validatePerformance(automation, minFPS = 30) {
        const scene = this.getGameScene();
        if (!scene || !scene.game) return true;
        
        const fps = scene.game.loop.actualFps;
        return fps >= minFPS;
    }
    
    /**
     * Utility methods
     */
    getGameScene() {
        const game = window.game || window.phaser?.game;
        if (!game) return null;
        
        return game.scene.scenes.find(s => s.scene.key === 'GameScene');
    }
    
    getPlayer() {
        return this.getGameScene()?.player;
    }
    
    getEnemies() {
        return this.getGameScene()?.enemies?.getChildren() || [];
    }
    
    captureScreenshot() {
        if (!this.config.captureScreenshots) return null;
        
        const game = window.game || window.phaser?.game;
        if (!game || !game.renderer) return null;
        
        try {
            const canvas = game.renderer.canvas;
            return canvas.toDataURL('image/png');
        } catch (error) {
            DebugLogger.error('Failed to capture screenshot', error);
            return null;
        }
    }
    
    /**
     * Update scenario status based on step results
     */
    updateStatus() {
        const hasError = this.steps.some(s => s.status === 'error');
        const hasFailed = this.steps.some(s => s.status === 'failed');
        const allPassed = this.steps.every(s => s.status === 'passed');
        
        if (hasError) {
            this.status = 'error';
        } else if (hasFailed) {
            this.status = 'failed';
        } else if (allPassed) {
            this.status = 'passed';
        } else {
            this.status = 'incomplete';
        }
    }
    
    /**
     * Generate scenario report
     */
    generateReport() {
        const duration = this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime;
        
        const report = {
            scenario: {
                name: this.name,
                description: this.description,
                status: this.status,
                duration: duration,
                timestamp: new Date().toISOString()
            },
            
            steps: this.steps.map(step => ({
                name: step.name,
                status: step.status,
                duration: step.duration,
                error: step.error || null,
                result: step.result
            })),
            
            summary: {
                totalSteps: this.steps.length,
                passed: this.steps.filter(s => s.status === 'passed').length,
                failed: this.steps.filter(s => s.status === 'failed').length,
                error: this.steps.filter(s => s.status === 'error').length,
                pending: this.steps.filter(s => s.status === 'pending').length
            },
            
            errors: this.errorReport || null,
            
            screenshot: this.captureScreenshot()
        };
        
        // Store for debugging
        window.__scenarioReport = report;
        
        return report;
    }
}