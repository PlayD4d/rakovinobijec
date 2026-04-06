import { DebugLogger } from '../core/debug/DebugLogger.js';
import { executeVictory } from './transitions/VictorySequence.js';
import { executeGameOver } from './transitions/GameOverSequence.js';
import { executeLevelTransition } from './transitions/LevelTransition.js';

/**
 * TransitionManager - Handles all game flow transitions
 * PR7 compliant - centralized victory/defeat/level transitions
 *
 * Sequence logic is extracted into:
 *   transitions/VictorySequence.js
 *   transitions/GameOverSequence.js
 *   transitions/LevelTransition.js
 */

export class TransitionManager {
    constructor(scene) {
        this.scene = scene;

        // Re-entrancy guards
        this.isTransitioning = false;
        this.isShowingVictory = false;
        this.isShowingDefeat = false;
        this.isResetting = false;
        this.currentTransition = null;

        // Telemetry history
        this._history = [];
        this._maxHistorySize = 50;
    }

    // ─── Telemetry ───────────────────────────────────────────────

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

        this._history.push(record);

        if (this._history.length > this._maxHistorySize) {
            this._history.shift();
        }

        DebugLogger.info('transition', `[TransitionManager] ${event}`, data);
        return record;
    }

    getTransitionHistory(count = 10) {
        return [...this._history].slice(-count);
    }

    // ─── Transition entry points (thin wrappers) ─────────────────

    /**
     * Show victory screen
     */
    async showVictory() {
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
            await executeVictory(this);
        } catch (error) {
            DebugLogger.error('transition', '[TransitionManager] Victory sequence failed:', error);
            this.resetTransitionState();
        } finally {
            this.isShowingVictory = false;
            this.isTransitioning = false;
        }
    }

    /**
     * Handle game over
     */
    async gameOver() {
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
            await executeGameOver(this);
            // Keep isShowingDefeat=true until player takes action (retry/menu)
        } catch (error) {
            DebugLogger.error('transition', '[TransitionManager] Game over sequence failed:', error);
            this.isShowingDefeat = false;
            this.isTransitioning = false;
        }
    }

    /**
     * Transition to next level
     */
    async transitionToNextLevel(nextLevel) {
        if (this.isTransitioning) {
            DebugLogger.warn('transition', '[TransitionManager] Transition already in progress, ignoring');
            this._log('level_transition_blocked', { reason: 'already_in_progress' });
            return;
        }

        this._log('level_transition_start', {
            fromLevel: this.scene.currentLevel || 1,
            toLevel: nextLevel,
            score: this.scene.gameStats?.score || 0
        });

        this.isTransitioning = true;
        this.currentTransition = nextLevel;

        try {
            await executeLevelTransition(this, nextLevel);
        } catch (error) {
            DebugLogger.error('transition', '[TransitionManager] Level transition failed:', error);
            try {
                this.resetLevel();
            } catch (resetError) {
                DebugLogger.error('transition', '[TransitionManager] Reset also failed:', resetError);
            }
        } finally {
            this.isTransitioning = false;
            this.currentTransition = null;
        }
    }

    // ─── Reset level (small, stays in main file) ─────────────────

    async resetLevel() {
        if (this.isResetting || this.isTransitioning) {
            DebugLogger.warn('transition', '[TransitionManager] Reset already in progress, ignoring');
            return;
        }

        this.isResetting = true;

        try {
            DebugLogger.info('transition', '[TransitionManager] Resetting current level');

            // Inline cleanup — clear enemies, projectiles, stop spawns
            this.scene.spawnDirector?.stop();
            this.scene.projectileSystem?.clearAll();
            if (this.scene.enemyManager) this.scene.enemyManager.clearAll();
            if (this.scene.vfxSystem?.stopAllEffects) this.scene.vfxSystem.stopAllEffects();

            if (this.scene.player) {
                this.scene.player.resetTimersAfterPause();
                const scale = this.scene.getScaleManager();
                this.scene.player.x = scale.width / 2;
                this.scene.player.y = scale.height / 2;
            }

            // Game timer and kill stats are cumulative across the entire run (not reset per level)

            // Inline re-initialize — reload current spawn table
            if (this.scene.spawnDirector) {
                await this.scene.spawnDirector.loadSpawnTable(`spawnTable.level${this.scene.currentLevel}`);
                this.scene.spawnDirector.start();
            }

            this.resumeGameSystems();
            this.isResetting = false;

        } catch (error) {
            DebugLogger.error('transition', '[TransitionManager] Reset failed:', error);
            this.isResetting = false;
            this.scene.restartScene();
        }
    }

    // ─── Shared helpers (used by extracted sequences) ────────────

    pauseGameSystems() {
        this.scene.isPaused = true;
        this.scene.pausePhysics();

        if (this.scene.spawnDirector) {
            this.scene.spawnDirector.stop();
        }

        if (this.scene.updateManager) {
            this.scene.updateManager.setPhaseEnabled('ai_spawn', false);
            this.scene.updateManager.setPhaseEnabled('enemies', false);
            this.scene.updateManager.setPhaseEnabled('projectiles', false);
        }
    }

    resumeGameSystems() {
        this.scene.isPaused = false;
        this.scene.resumePhysics();

        if (this.scene.updateManager) {
            this.scene.updateManager.setPhaseEnabled('ai_spawn', true);
            this.scene.updateManager.setPhaseEnabled('enemies', true);
            this.scene.updateManager.setPhaseEnabled('projectiles', true);
        }
    }

    async showUIModal(eventName, data) {
        const { centralEventBus } = await import('../core/events/CentralEventBus.js');

        // Wait for UI scene to acknowledge modal is shown, with timeout fallback
        return new Promise((resolve) => {
            const timeout = setTimeout(resolve, 2000); // fallback if UI never responds
            centralEventBus.once('ui:modal-ready', () => {
                clearTimeout(timeout);
                resolve();
            });
            centralEventBus.emit(eventName, data);
            DebugLogger.info('transition', `[TransitionManager] Emitted ${eventName}, waiting for ui:modal-ready`);
        });
    }

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

    // ─── Analytics ───────────────────────────────────────────────

    resetTransitionState() {
        this.isTransitioning = false;
        this.isShowingVictory = false;
        this.isShowingDefeat = false;
        this.isResetting = false;
        this.currentTransition = null;
    }

    shutdown() {
        this.resetTransitionState();
    }
}

