import { DebugLogger } from '../core/debug/DebugLogger.js';

/**
 * UpdateManager - Centralized update orchestration for GameScene
 * PR7 compliant - deterministic update phases with priority ordering
 */

export class UpdateManager {
    constructor(scene) {
        this.scene = scene;
        this.phases = new Map();
        this._sortedPhasesCache = null; // Cached sorted phase list
        this.enabled = true;
        
        // Performance metrics for DEV mode
        this.metrics = {
            frameCount: 0,
            phaseTimings: new Map(),
            lastReport: 0
        };
        
        // Initialize default phases with priorities
        this.initializePhases();
    }
    
    /**
     * Initialize standard update phases
     */
    initializePhases() {
        // Lower number = higher priority (runs first)
        this.registerPhase('timer', 5);        // Game timer updates
        this.registerPhase('input', 10);       // Input polling
        this.registerPhase('ai_spawn', 20);    // AI and spawn management
        this.registerPhase('player', 25);      // Player updates
        this.registerPhase('enemies', 30);     // Enemy updates
        this.registerPhase('projectiles', 40); // Projectile physics
        this.registerPhase('collisions', 50);  // Manual collision checks
        this.registerPhase('loot', 60);        // Loot and magnet effects
        this.registerPhase('powerups', 70);    // Power-up effects
        this.registerPhase('vfx', 80);         // Visual effects
        this.registerPhase('hud', 90);         // HUD updates
        this.registerPhase('debug', 100);      // Debug overlay
    }
    
    /**
     * Register all game scene tasks
     * Called from GameScene to set up all update tasks
     */
    registerGameSceneTasks(scene) {
        // Timer updates
        this.addTask('timer', (time, delta) => {
            if (!scene.isPaused) {
                scene.sceneTimeSec += delta / 1000;
                scene.gameStats.time = Math.floor(scene.sceneTimeSec);
                
                const currentSec = Math.floor(scene.sceneTimeSec);
                if (scene._lastTimeUi !== currentSec) {
                    scene._lastTimeUi = currentSec;
                    const minutes = Math.floor(currentSec / 60);
                    const seconds = currentSec % 60;
                    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    
                    if (scene.unifiedHUD?.timeText) {
                        scene.unifiedHUD.timeText.setText(timeStr);
                    }
                }
            }
        }, 'game_timer');
        
        // Player update and safety check
        this.addTask('player', (time, delta) => {
            if (scene.player) {
                // Safety check
                if (scene.player.hp > 0 && !scene.player.active) {
                    DebugLogger.warn('general', '[GameScene] Player was inactive but has HP - reactivating!');
                    scene.player.setActive(true);
                    scene.player.setVisible(true);
                    if (scene.player.body) {
                        scene.player.body.enable = true;
                    }
                }
                
                // Call player update
                if (scene.player.active && scene.player.update) {
                    scene.player.update(time, delta);
                }
            }
        }, 'player_update');
        
        // Enemy updates
        this.addTask('enemies', (time, delta) => {
            if (!scene.isPaused) {
                if (scene.enemiesGroup) {
                    scene.enemiesGroup.getChildren().forEach(enemy => {
                        if (enemy.active && enemy.update) {
                            enemy.update(time, delta);
                        }
                    });
                }
                
                if (scene.bossGroup) {
                    scene.bossGroup.getChildren().forEach(boss => {
                        if (boss.active && boss.update) {
                            boss.update(time, delta);
                        }
                    });
                }
            }
        }, 'enemy_updates');
        
        // Spawn director
        this.addTask('ai_spawn', (time, delta) => {
            if (scene.spawnDirector && !scene.isPaused) {
                scene.spawnDirector.update(delta);
            }
        }, 'spawn_director');
        
        // Projectile system
        this.addTask('projectiles', (time, delta) => {
            if (scene.projectileSystem && !scene.isPaused) {
                scene.projectileSystem.update(time, delta);
            }
        }, 'projectile_system');
        
        // Loot system
        this.addTask('loot', (time, delta) => {
            if (scene.lootSystem && !scene.isPaused) {
                scene.lootSystem.update(time, delta);
            }
        }, 'loot_system');
        
        // VFX system
        this.addTask('vfx', (time, delta) => {
            if (!scene.isPaused) {
                if (scene.vfxSystem) {
                    scene.vfxSystem.update(time, delta);
                }
                if (scene.armorShieldEffect) {
                    scene.armorShieldEffect.update(time, delta);
                }
                if (scene.playerShieldEffect) {
                    scene.playerShieldEffect.update(time, delta);
                }
            }
        }, 'vfx_system');
        
        // PowerUp system
        this.addTask('powerups', (time, delta) => {
            if (scene.powerUpSystem && !scene.isPaused) {
                scene.powerUpSystem.update(time, delta);
            }
        }, 'powerup_system');
        
        // HUD updates — only setText when values actually change
        let _lastHudLevel = -1;
        let _lastHudStage = -1;
        this.addTask('hud', (time, delta) => {
            if (scene.unifiedHUD) {
                scene.unifiedHUD.update();

                const lvl = scene.gameStats.level;
                const stg = scene.currentLevel;
                if (scene.unifiedHUD.levelText && (lvl !== _lastHudLevel || stg !== _lastHudStage)) {
                    _lastHudLevel = lvl;
                    _lastHudStage = stg;
                    scene.unifiedHUD.levelText.setText(`Level: ${lvl} | Stage: ${stg}`);
                }
            }
        }, 'hud_update');
        
        // Debug overlay
        this.addTask('debug', (time, delta) => {
            if (scene.debugOverlay) {
                scene.debugOverlay.update(time, delta);
            }
        }, 'debug_overlay');
    }
    
    /**
     * Register a new update phase
     */
    registerPhase(name, priority) {
        if (this.phases.has(name)) {
            DebugLogger.warn('general', `[UpdateManager] Phase '${name}' already registered`);
            return;
        }
        
        this.phases.set(name, {
            name,
            priority,
            tasks: [],
            enabled: true
        });
        this._sortedPhasesCache = null;
    }
    
    /**
     * Add a task to a specific phase
     */
    addTask(phaseName, fn, taskName = '') {
        const phase = this.phases.get(phaseName);
        if (!phase) {
            DebugLogger.error('general', `[UpdateManager] Phase '${phaseName}' not found`);
            return;
        }
        
        phase.tasks.push({
            fn,
            name: taskName || `task_${phase.tasks.length}`,
            enabled: true
        });
    }
    
    /**
     * Main update method - orchestrates all phases
     */
    _rebuildSortedPhases() {
        this._sortedPhasesCache = Array.from(this.phases.values())
            .filter(phase => phase.enabled)
            .sort((a, b) => a.priority - b.priority);
    }

    update(time, delta) {
        if (!this.enabled) return;

        // Use cached sorted phases (rebuilt only when phases change)
        if (!this._sortedPhasesCache) {
            this._rebuildSortedPhases();
        }
        const sortedPhases = this._sortedPhasesCache;
        
        // Execute each phase
        for (const phase of sortedPhases) {
            if (!phase.enabled || phase.tasks.length === 0) continue;
            
            const isDebug = this.scene.game?.config?.physics?.arcade?.debug;
            const startTime = isDebug ? performance.now() : 0;

            // Execute all tasks in this phase
            for (const task of phase.tasks) {
                if (task.enabled) {
                    try {
                        task.fn(time, delta);
                    } catch (error) {
                        DebugLogger.error('general', `[UpdateManager] Error in ${phase.name}/${task.name}:`, error);
                    }
                }
            }

            // Track metrics only in DEV mode
            if (isDebug) {
                this.trackPhaseMetrics(phase.name, performance.now() - startTime);
            }
        }
        
        // Report metrics periodically in DEV mode
        if (this.scene.game?.config?.physics?.arcade?.debug) {
            this.reportMetrics(time);
        }
    }
    
    /**
     * Track performance metrics for a phase
     */
    trackPhaseMetrics(phaseName, duration) {
        if (!this.metrics.phaseTimings.has(phaseName)) {
            this.metrics.phaseTimings.set(phaseName, {
                total: 0,
                count: 0,
                max: 0,
                avg: 0
            });
        }
        
        const timing = this.metrics.phaseTimings.get(phaseName);
        timing.total += duration;
        timing.count++;
        timing.max = Math.max(timing.max, duration);
        timing.avg = timing.total / timing.count;
        
        // Log outliers (> 3ms)
        if (duration > 3) {
            DebugLogger.warn('general', `[UpdateManager] Phase '${phaseName}' took ${duration.toFixed(2)}ms`);
        }
    }
    
    /**
     * Report performance metrics periodically
     */
    reportMetrics(time) {
        this.metrics.frameCount++;
        
        // Report every second
        if (time - this.metrics.lastReport < 1000) return;
        
        DebugLogger.info('general', '[UpdateManager] Performance Report:');
        
        // Sort by average time descending
        const sorted = Array.from(this.metrics.phaseTimings.entries())
            .sort((a, b) => b[1].avg - a[1].avg)
            .slice(0, 5); // Top 5 slowest phases
        
        for (const [phase, timing] of sorted) {
            if (timing.avg > 0.1) { // Only show phases taking > 0.1ms avg
                DebugLogger.info('general', `  ${phase}: avg=${timing.avg.toFixed(2)}ms, max=${timing.max.toFixed(2)}ms`);
            }
        }
        
        // Reset metrics
        this.metrics.phaseTimings.clear();
        this.metrics.frameCount = 0;
        this.metrics.lastReport = time;
    }
    
    /**
     * Enable/disable a specific phase
     */
    setPhaseEnabled(phaseName, enabled) {
        const phase = this.phases.get(phaseName);
        if (phase) {
            phase.enabled = enabled;
            this._sortedPhasesCache = null;
        }
    }
    
    /**
     * Enable/disable a specific task
     */
    setTaskEnabled(phaseName, taskName, enabled) {
        const phase = this.phases.get(phaseName);
        if (!phase) return;
        
        const task = phase.tasks.find(t => t.name === taskName);
        if (task) {
            task.enabled = enabled;
        }
    }
    
    /**
     * Clear all tasks from a phase
     */
    clearPhase(phaseName) {
        const phase = this.phases.get(phaseName);
        if (phase) {
            phase.tasks = [];
        }
    }
    
    /**
     * Pause all updates
     */
    pause() {
        this.enabled = false;
    }
    
    /**
     * Resume all updates
     */
    resume() {
        this.enabled = true;
    }
    
    /**
     * Clean shutdown
     */
    shutdown() {
        this.enabled = false;
        this.phases.clear();
        this.metrics.phaseTimings.clear();
    }
}

export default UpdateManager;