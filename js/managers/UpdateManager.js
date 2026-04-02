import { DebugLogger } from '../core/debug/DebugLogger.js';
import { getSession } from '../core/debug/SessionLog.js';

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
                // Keep SessionLog game time in sync for accurate telemetry
                getSession()?.setGameTime(Math.floor(scene.sceneTimeSec));
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
                // Use for-loop on live array — no forEach closure allocation per frame
                const enemies = scene.enemiesGroup?.children ? scene.enemiesGroup.getChildren() : null;
                if (enemies) {
                    for (let i = 0, len = enemies.length; i < len; i++) {
                        const e = enemies[i];
                        if (e && e.active && e.update) e.update(time, delta);
                    }
                }
                const bosses = scene.bossGroup?.children ? scene.bossGroup.getChildren() : null;
                if (bosses) {
                    for (let i = 0, len = bosses.length; i < len; i++) {
                        const b = bosses[i];
                        if (b && b.active && b.update) b.update(time, delta);
                    }
                }
            }
        }, 'enemy_updates');
        
        // Spawn director
        this.addTask('ai_spawn', (time, delta) => {
            if (scene.spawnDirector && !scene.isPaused) {
                scene.spawnDirector.update(delta);
            }
        }, 'spawn_director');
        
        // Projectile system — Phaser handles updates via runChildUpdate: true on groups.
        // No manual update needed (ProjectileSystem.update() is a no-op).
        
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
        
        // HUD updates — now handled by GameUIScene.update()
        // Refresh at 2Hz via GameUIScene
        let _lastHudRefresh = 0;
        let _lastHudLevel = -1;
        let _lastHudStage = -1;
        let _cachedHud = null;
        this.addTask('hud', (time, delta) => {
            const hud = _cachedHud ?? (_cachedHud = scene.scene.get('GameUIScene')?.hud);
            if (!hud) return;

            // Refresh HP/XP/score/kills at 10Hz
            if (time - _lastHudRefresh > 100) {
                _lastHudRefresh = time;
                hud.refresh();
            }

            // Level/stage change detection — use HUD API, not direct text access
            const lvl = scene.gameStats.level;
            const stg = scene.currentLevel;
            if (lvl !== _lastHudLevel || stg !== _lastHudStage) {
                _lastHudLevel = lvl;
                _lastHudStage = stg;
                hud.updateStats({ level: lvl, stage: stg });
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

        // Prevent duplicate task registration
        const resolvedName = taskName || `task_${phase.tasks.length}`;
        if (taskName && phase.tasks.some(t => t.name === taskName)) {
            DebugLogger.warn('general', `[UpdateManager] Task '${taskName}' already registered in phase '${phaseName}', skipping`);
            return;
        }

        phase.tasks.push({
            fn,
            name: resolvedName,
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

        // Periodic cleanup of dead (inactive) sprites from groups — prevents memory leak
        if (!this._lastCleanup || time - this._lastCleanup >= 10000) {
            this._lastCleanup = time;
            this._cleanupDeadSprites();
        }

        // Lightweight perf snapshot every 5s → session log
        if (!this._lastPerfLog || time - this._lastPerfLog >= 5000) {
            this._lastPerfLog = time;
            const fps = Math.round(this.scene.game?.loop?.actualFps || 0);
            const frameMs = Math.round(delta);
            const eg = this.scene.enemiesGroup;
            const enemies = eg?.children?.size ?? 0;
            const enemiesActive = eg?.children ? eg.countActive() : 0;
            const pb = this.scene.projectileSystem?.playerBullets;
            const eb = this.scene.projectileSystem?.enemyBullets;
            const projectiles = (pb?.children ? pb.countActive() : 0) + (eb?.children ? eb.countActive() : 0);
            const loot = this.scene.lootSystem?.lootGroup?.children?.size ?? 0;
            const vfxEffects = this.scene.vfxSystem?.activeEmitters?.size || 0;
            const vfxPowerUp = this.scene.vfxSystem?.powerUpEffects?.size || 0;
            // Chrome-only JS heap (MB), 0 if unavailable
            const heapMB = Math.round((performance.memory?.usedJSHeapSize || 0) / 1048576);
            getSession()?.log('perf', 'snapshot', { fps, frameMs, enemies, enemiesActive, projectiles, loot, vfxEffects, vfxPowerUp, heapMB: heapMB || undefined });
            // Warn on perf issues
            if (fps < 30) getSession()?.log('perf', 'fps_drop', { fps, enemies, projectiles, loot });
            if (enemies > 100) getSession()?.log('perf', 'entity_overload', { enemies, enemiesActive });

            // Player stats snapshot every 10s — essential for balance analysis
            if (!this._lastStatsLog || time - this._lastStatsLog >= 10000) {
                this._lastStatsLog = time;
                const player = this.scene.player;
                const stats = player?._stats?.();
                const gs = this.scene.gameStats;
                if (stats && gs) {
                    const activePU = this.scene.powerUpSystem?.getActivePowerUps?.() || [];
                    getSession()?.log('balance', 'player_snapshot', {
                        time: Math.floor(this.scene.sceneTimeSec),
                        level: gs.level,
                        hp: Math.round(player.hp),
                        maxHp: Math.round(player.maxHp),
                        dmg: Math.round(stats.projectileDamage),
                        atkMs: Math.round(stats.attackIntervalMs),
                        moveSpd: Math.round(stats.moveSpeed),
                        critChance: Math.round(stats.critChance * 100),
                        projCount: stats.projectileCount,
                        projSpeed: Math.round(stats.projectileSpeed),
                        dmgReduction: Math.round(stats.damageReduction || 0),
                        kills: gs.kills || 0,
                        score: gs.score || 0,
                        powerups: activePU.map(p => p.id.replace('powerup.', '') + ':' + p.level).join(',')
                    });
                }
            }
        }

        // Use cached sorted phases (rebuilt only when phases change)
        if (!this._sortedPhasesCache) {
            this._rebuildSortedPhases();
        }
        const sortedPhases = this._sortedPhasesCache;

        // Cache debug flag (set once, avoids deep property traversal per-phase)
        if (this._isDebug === undefined) {
            this._isDebug = !!this.scene.game?.config?.physics?.arcade?.debug;
        }
        const isDebug = this._isDebug;

        // Execute each phase
        for (const phase of sortedPhases) {
            if (!phase.enabled || phase.tasks.length === 0) continue;

            const startTime = isDebug ? performance.now() : 0;

            for (const task of phase.tasks) {
                if (task.enabled) {
                    try {
                        task.fn(time, delta);
                    } catch (error) {
                        DebugLogger.error('general', `[UpdateManager] Error in ${phase.name}/${task.name}:`, error);
                    }
                }
            }

            if (isDebug) {
                this.trackPhaseMetrics(phase.name, performance.now() - startTime);
            }
        }

        if (isDebug) {
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
     * Remove inactive (dead) sprites from physics groups to prevent memory buildup.
     * Called every 10 seconds. Inactive sprites are destroyed and removed from groups.
     */
    _cleanupDeadSprites() {
        let cleaned = 0;

        // Cleanup dead enemies
        const enemiesGroup = this.scene.enemiesGroup;
        if (enemiesGroup?.children) {
            const children = enemiesGroup.getChildren();
            for (let i = children.length - 1; i >= 0; i--) {
                const child = children[i];
                if (child && !child.active) {
                    child.destroy();
                    cleaned++;
                }
            }
        }

        // Cleanup dead bosses
        const bossGroup = this.scene.bossGroup;
        if (bossGroup?.children) {
            const children = bossGroup.getChildren();
            for (let i = children.length - 1; i >= 0; i--) {
                const child = children[i];
                if (child && !child.active) {
                    child.destroy();
                    cleaned++;
                }
            }
        }

        // Loot group uses Phaser-native pooling — inactive items are pool members, not garbage.
        // Do NOT destroy them here; they are reused by lootGroup.get().

        if (cleaned > 0) {
            getSession()?.log('perf', 'cleanup', { cleaned, enemies: enemiesGroup?.children?.size || 0 });
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

