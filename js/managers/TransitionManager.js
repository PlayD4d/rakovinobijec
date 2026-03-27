import { DebugLogger } from '../core/debug/DebugLogger.js';

/**
 * TransitionManager - Handles all game flow transitions
 * PR7 compliant - centralized victory/defeat/level transitions
 * 
 * Features:
 * - Re-entrancy guards for all transitions
 * - Clean event-based communication with UI scene
 * - Deterministic cleanup order
 * - Analytics integration
 */

export class TransitionManager {
    constructor(scene) {
        this.scene = scene;
        
        // Re-entrancy guards
        this.isTransitioning = false;
        this.isShowingVictory = false;
        this.isShowingDefeat = false;
        this.isResetting = false;
        
        // Transition state
        this.currentTransition = null;
        this.transitionQueue = [];
        
        // Analytics buffer
        this.pendingAnalytics = [];
        
        // Cleanup tracking
        this.cleanupOrder = [
            'pausePhysics',
            'stopSpawns',
            'clearProjectiles',
            'clearEnemies',
            'clearLoot',
            'stopVFX',
            'unpauseTime'
        ];
        
        // Telemetry history
        this._history = [];
        this._maxHistorySize = 50;
    }
    
    /**
     * Log transition event for telemetry
     */
    _log(event, data = {}) {
        const record = {
            event,
            timestamp: Date.now(),
            scene: this.scene.sys.settings.key,
            gameTime: this.scene.time?.now || 0,
            ...data
        };
        
        // Add to history
        this._history.push(record);
        
        // Trim history if too large
        if (this._history.length > this._maxHistorySize) {
            this._history.shift();
        }
        
        // Send to analytics if available
        if (this.scene.analyticsManager) {
            this.scene.analyticsManager.trackEvent(event, record);
        }
        
        // Console log for debugging
        DebugLogger.info('transition', `[TransitionManager] ${event}`, data);
        
        return record;
    }
    
    /**
     * Get transition history
     */
    getTransitionHistory(count = 10) {
        return [...this._history].slice(-count);
    }
    
    /**
     * Show victory screen
     * Extracted from GameScene.showVictory()
     */
    async showVictory() {
        // Re-entrancy guard
        if (this.isShowingVictory || this.isTransitioning) {
            DebugLogger.warn('transition', '[TransitionManager] Victory already in progress, ignoring');
            this._log('victory_blocked', { reason: 'already_in_progress' });
            return;
        }
        
        this._log('victory_start', {
            score: this.scene.gameStats?.score || 0,
            level: this.scene.gameStats?.level || 1,
            time: this.scene.time?.now || 0
        });
        
        this.isShowingVictory = true;
        this.isTransitioning = true;
        
        try {
            DebugLogger.info('transition', '[TransitionManager] Showing victory screen');
            
            // 1. Pause game systems
            this.pauseGameSystems();
            
            // 2. Calculate and log stats
            const stats = this.calculateFinalStats();
            this.logAnalytics('level_complete', stats);
            
            // 3. Clear enemies with celebration effect
            await this.clearAllEnemiesWithEffect();
            
            // 4. Show UI victory modal via event
            await this.showUIModal('ui:victory:show', {
                stats,
                level: this.scene.currentLevel,
                time: Math.floor(this.scene.sceneTimeSec)
            });
            
            // 5. Wait for user input (handled by UI scene)
            // UI scene will emit 'ui:victory:continue' when ready
            
        } catch (error) {
            DebugLogger.error('transition', '[TransitionManager] Victory sequence failed:', error);
            this.resetTransitionState();
        }
    }
    
    /**
     * Handle game over
     * Extracted from GameScene.gameOver()
     */
    async gameOver() {
        // Re-entrancy guard
        if (this.isShowingDefeat || this.isTransitioning) {
            DebugLogger.warn('transition', '[TransitionManager] Defeat already in progress, ignoring');
            this._log('gameover_blocked', { reason: 'already_in_progress' });
            return;
        }
        
        this._log('gameover_start', {
            score: this.scene.gameStats?.score || 0,
            level: this.scene.gameStats?.level || 1,
            wave: this.scene.gameStats?.currentWave || 0,
            enemiesKilled: this.scene.gameStats?.enemiesKilled || 0
        });
        
        this.isShowingDefeat = true;
        this.isTransitioning = true;
        
        try {
            DebugLogger.info('transition', '[TransitionManager] Game Over sequence starting');
            
            // 1. Pause everything immediately
            this.pauseGameSystems();
            
            // 2. Log analytics
            const stats = this.calculateFinalStats();
            this.logAnalytics('game_over', {
                ...stats,
                cause: this.scene.lastDamageCause || 'unknown'
            });
            
            // 3. Death VFX on player
            if (this.scene.player && this.scene.vfxSystem) {
                this.scene.vfxSystem.play('vfx.player.death', 
                    this.scene.player.x, 
                    this.scene.player.y
                );
            }
            
            // 4. Handle high score if applicable
            const finalScore = this.scene.gameStats.score;
            const isHighScore = this.scene.highScoreManager?.isHighScore(finalScore);
            
            if (isHighScore && this.scene.highScoreManager) {
                // Import HighScoreModal dynamically
                const { HighScoreModal } = await import('../ui/HighScoreModal.js');
                this.scene.highScoreModal = new HighScoreModal(
                    this.scene,
                    finalScore,
                    async (name) => {
                        await this.scene.highScoreManager.addScore(name, finalScore);
                        if (this.scene.globalHighScoreManager) {
                            await this.scene.globalHighScoreManager.submitScore(name, finalScore);
                        }
                        this.scene.highScoreModal = null;
                    }
                );
            }
            
            // 5. Show defeat modal via UI scene (existing game-over event)
            this.scene.game.events.emit('game-over', {
                survivalTime: Math.floor(this.scene.sceneTimeSec),
                level: stats.level,
                kills: stats.enemiesKilled,
                score: stats.score
            });
            
            // 6. Analytics
            if (this.scene.analyticsManager) {
                await this.scene.analyticsManager.endSession(
                    'game_over',
                    this.scene.gameStats,
                    { reason: 'player_death' }
                );
            }
            
            // 7. UI scene will emit 'ui:defeat:restart' or 'ui:defeat:menu'
            
        } catch (error) {
            DebugLogger.error('transition', '[TransitionManager] Game over sequence failed:', error);
            this.resetTransitionState();
        }
    }
    
    /**
     * Transition to next level
     * Extracted from GameScene.transitionToNextLevel()
     */
    async transitionToNextLevel(nextLevel) {
        // Re-entrancy guard
        if (this.isTransitioning) {
            DebugLogger.warn('transition', '[TransitionManager] Transition already in progress, ignoring');
            this._log('level_transition_blocked', { reason: 'already_in_progress' });
            return;
        }
        
        this._log('level_transition_start', {
            fromLevel: this.scene.gameStats?.currentLevel || 1,
            toLevel: nextLevel,
            score: this.scene.gameStats?.score || 0
        });
        
        this.isTransitioning = true;
        this.currentTransition = nextLevel;
        
        try {
            DebugLogger.info('transition', `[TransitionManager] Transitioning to level ${nextLevel}`);
            
            // 1. Pause game but keep time running for animations
            this.scene.isPaused = true;
            if (this.scene.updateManager) {
                this.scene.updateManager.setPhaseEnabled('ai_spawn', false);
                this.scene.updateManager.setPhaseEnabled('enemies', false);
            }
            
            // 2. Show transition UI
            await this.showUIModal('ui:level-transition:show', {
                fromLevel: this.scene.currentLevel,
                toLevel: nextLevel,
                message: `Úroveň ${nextLevel}`
            });
            
            // 3. Auto-collect all loot before clearing
            if (this.scene.lootSystem?.lootGroup) {
                const lootItems = this.scene.lootSystem.lootGroup.getChildren().filter(l => l.active);
                for (const loot of lootItems) {
                    if (this.scene.lootSystem.collectItem) {
                        try { this.scene.lootSystem.collectItem(loot); } catch (_) {}
                    }
                }
            }

            // 4. Clean up current level
            await this.cleanupLevel();
            
            // 4. Initialize next level
            this.scene.currentLevel = nextLevel;
            await this.initializeLevel(nextLevel);
            
            // 5. Hide transition UI
            this.scene.events.emit('ui:level-transition:hide');
            
            // 6. Resume game
            this.resumeGameSystems();
            this.isTransitioning = false;
            this.currentTransition = null;
            
            // 7. Analytics
            this.logAnalytics('level_start', {
                level: nextLevel,
                playerStats: this.getPlayerStats()
            });
            
        } catch (error) {
            DebugLogger.error('transition', '[TransitionManager] Level transition failed:', error);
            this.resetTransitionState();
            // Try to recover by resetting current level
            this.resetLevel();
        }
    }
    
    /**
     * Reset current level
     * Extracted from GameScene.resetLevel()
     */
    async resetLevel() {
        // Re-entrancy guard
        if (this.isResetting || this.isTransitioning) {
            DebugLogger.warn('transition', '[TransitionManager] Reset already in progress, ignoring');
            return;
        }
        
        this.isResetting = true;
        
        try {
            DebugLogger.info('transition', '[TransitionManager] Resetting current level');
            
            // 1. Clean up everything
            await this.cleanupLevel();
            
            // 2. Reset player state  
            if (this.scene.player) {
                this.scene.player.resetTimersAfterPause();
                const scale = this.scene.getScaleManager();
                this.scene.player.x = scale.width / 2;
                this.scene.player.y = scale.height / 2;
            }
            
            // 3. Reset game stats
            this.scene.sceneTimeSec = 0;
            this.scene.gameStats.enemiesKilled = 0;
            
            // 4. Re-initialize current level
            await this.initializeLevel(this.scene.currentLevel);
            
            // 5. Resume
            this.resumeGameSystems();
            this.isResetting = false;
            
        } catch (error) {
            DebugLogger.error('transition', '[TransitionManager] Reset failed:', error);
            this.isResetting = false;
            // Last resort - restart scene
            this.scene.restartScene();
        }
    }
    
    /**
     * Clear all enemies with celebration effect
     * Extracted from GameScene.clearAllEnemies()
     */
    async clearAllEnemiesWithEffect() {
        const enemies = [];
        
        // Collect all active enemies
        if (this.scene.enemiesGroup) {
            enemies.push(...this.scene.enemiesGroup.getChildren().filter(e => e.active));
        }
        if (this.scene.bossGroup) {
            enemies.push(...this.scene.bossGroup.getChildren().filter(b => b.active));
        }
        
        // Create staggered destruction effect
        const staggerDelay = Math.min(50, 1000 / Math.max(enemies.length, 1));
        
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            
            // Delay for stagger effect
            await new Promise(resolve => setTimeout(resolve, i * staggerDelay));
            
            // VFX at enemy position
            if (this.scene.vfxSystem) {
                this.scene.vfxSystem.play('vfx.enemy.celebration_death', enemy.x, enemy.y);
            }
            
            // Destroy enemy
            if (enemy.die) {
                enemy.die(true); // Skip loot drops
            } else {
                enemy.destroy();
            }
        }
        
        // Final celebration burst
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('vfx.level.complete', 
                this.scene.getScaleManager().width / 2,
                this.scene.getScaleManager().height / 2
            );
        }
        
        return new Promise(resolve => setTimeout(resolve, 500));
    }
    
    /**
     * Pause all game systems
     */
    pauseGameSystems() {
        this.scene.isPaused = true;

        // Pause physics
        this.scene.pausePhysics();

        // Stop spawn director (don't set .enabled — property doesn't exist)
        if (this.scene.spawnDirector) {
            this.scene.spawnDirector.stop();
        }

        // Pause update manager phases
        if (this.scene.updateManager) {
            this.scene.updateManager.setPhaseEnabled('ai_spawn', false);
            this.scene.updateManager.setPhaseEnabled('enemies', false);
            this.scene.updateManager.setPhaseEnabled('projectiles', false);
        }
        // NOTE: Don't pause scene.time — it breaks delayedCall timers used by showUIModal
    }
    
    /**
     * Resume all game systems
     */
    resumeGameSystems() {
        this.scene.isPaused = false;

        // Resume physics
        this.scene.resumePhysics();

        // Resume update manager phases
        if (this.scene.updateManager) {
            this.scene.updateManager.setPhaseEnabled('ai_spawn', true);
            this.scene.updateManager.setPhaseEnabled('enemies', true);
            this.scene.updateManager.setPhaseEnabled('projectiles', true);
        }
        // SpawnDirector is restarted by initializeLevel, not here
    }
    
    /**
     * Clean up current level
     */
    async cleanupLevel() {
        DebugLogger.info('transition', '[TransitionManager] Cleaning up level');
        
        // Execute cleanup in deterministic order
        for (const step of this.cleanupOrder) {
            await this.executeCleanupStep(step);
        }
    }
    
    /**
     * Execute a single cleanup step
     */
    async executeCleanupStep(step) {
        switch(step) {
            case 'pausePhysics':
                this.scene.pausePhysics();
                break;
                
            case 'stopSpawns':
                if (this.scene.spawnDirector) {
                    this.scene.spawnDirector.stop();
                }
                break;
                
            case 'clearProjectiles':
                if (this.scene.projectileSystem) {
                    this.scene.projectileSystem.clearAll();
                }
                break;
                
            case 'clearEnemies':
                if (this.scene.enemiesGroup) {
                    this.scene.enemiesGroup.clear(true, true);
                }
                if (this.scene.bossGroup) {
                    this.scene.bossGroup.clear(true, true);
                }
                break;
                
            case 'clearLoot':
                if (this.scene.lootSystem) {
                    this.scene.lootSystem.clearAll();
                }
                break;
                
            case 'stopVFX':
                if (this.scene.vfxSystem?.stopAllEffects) {
                    this.scene.vfxSystem.stopAllEffects();
                }
                break;
                
            case 'unpauseTime':
                // Time is no longer paused during transitions (breaks delayedCall)
                break;
        }
        
        // Small delay between steps for stability
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    /**
     * Initialize a level
     */
    async initializeLevel(level) {
        DebugLogger.info('transition', `[TransitionManager] Initializing level ${level}`);
        
        // Reset spawn director for new level
        if (this.scene.spawnDirector) {
            await this.scene.spawnDirector.loadSpawnTable(`level${level}`);
            this.scene.spawnDirector.start();
        }
        
        // Reset timer
        this.scene.sceneTimeSec = 0;
        
        // Ensure player is visible and active
        if (this.scene.player) {
            this.scene.player.setActive(true);
            this.scene.player.setVisible(true);
        }
    }
    
    /**
     * Show UI modal and wait for response
     */
    async showUIModal(eventName, data) {
        // Emit to game-level events so GameUIScene can receive it
        this.scene.game.events.emit(eventName, data);
        DebugLogger.info('transition', `[TransitionManager] Emitted ${eventName}`);

        // Brief delay for visual transition effect
        return new Promise((resolve) => {
            this.scene.time.delayedCall(1500, () => resolve(null));
        });
    }
    
    /**
     * Calculate final stats for analytics
     */
    calculateFinalStats() {
        return {
            level: this.scene.currentLevel,
            time: Math.floor(this.scene.sceneTimeSec),
            enemiesKilled: this.scene.gameStats.enemiesKilled || 0,
            xp: this.scene.gameStats.xp || 0,
            playerLevel: this.scene.gameStats.level || 1,
            score: this.scene.gameStats.score || 0,
            powerUps: this.scene.powerUpSystem?.getActivePowerUps() || []
        };
    }
    
    /**
     * Get current player stats
     */
    getPlayerStats() {
        if (!this.scene.player) return {};
        
        return {
            hp: this.scene.player.hp,
            maxHp: this.scene.player.maxHp,
            level: this.scene.gameStats.level,
            xp: this.scene.gameStats.xp,
            powerUps: this.scene.powerUpSystem?.getActivePowerUps() || []
        };
    }
    
    /**
     * Log analytics event
     */
    logAnalytics(event, data) {
        // Buffer analytics if in transition
        if (this.isTransitioning) {
            this.pendingAnalytics.push({ event, data, timestamp: Date.now() });
            return;
        }
        
        // Send to analytics manager
        if (this.scene.analyticsManager) {
            this.scene.analyticsManager.track(event, data);
        }
        
        // Log for debugging
        DebugLogger.info('transition', `[Analytics] ${event}:`, data);
    }
    
    /**
     * Flush pending analytics
     */
    flushAnalytics() {
        if (this.pendingAnalytics.length === 0) return;
        
        for (const { event, data } of this.pendingAnalytics) {
            this.logAnalytics(event, data);
        }
        
        this.pendingAnalytics = [];
    }
    
    /**
     * Reset all transition states
     */
    resetTransitionState() {
        this.isTransitioning = false;
        this.isShowingVictory = false;
        this.isShowingDefeat = false;
        this.isResetting = false;
        this.currentTransition = null;
        
        // Flush any pending analytics
        this.flushAnalytics();
    }
    
    /**
     * Handle scene shutdown
     */
    shutdown() {
        // Flush analytics
        this.flushAnalytics();
        
        // Reset all states
        this.resetTransitionState();
        
        // Clear queue
        this.transitionQueue = [];
    }
}

export default TransitionManager;