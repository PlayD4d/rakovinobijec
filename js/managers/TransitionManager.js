import { DebugLogger } from '../core/debug/DebugLogger.js';
import { executeVictory } from './transitions/VictorySequence.js';
import { executeGameOver } from './transitions/GameOverSequence.js';
import { executeLevelTransition, cleanupLevel, initializeLevel } from './transitions/LevelTransition.js';

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
            'stopVFX',
            'unpauseTime'
        ];

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

        if (this.scene.analyticsManager) {
            this.scene.analyticsManager.trackEvent(event, record);
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
            this.flushAnalytics();
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
        } catch (error) {
            DebugLogger.error('transition', '[TransitionManager] Game over sequence failed:', error);
            this.resetTransitionState();
        } finally {
            this.isShowingDefeat = false;
            this.isTransitioning = false;
            this.flushAnalytics();
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
            fromLevel: this.scene.gameStats?.currentLevel || 1,
            toLevel: nextLevel,
            score: this.scene.gameStats?.score || 0
        });

        this.isTransitioning = true;
        this.currentTransition = nextLevel;

        try {
            await executeLevelTransition(this, nextLevel);
        } catch (error) {
            DebugLogger.error('transition', '[TransitionManager] Level transition failed:', error);
            this.resetTransitionState();
            this.resetLevel();
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

            await cleanupLevel(this);

            if (this.scene.player) {
                this.scene.player.resetTimersAfterPause();
                const scale = this.scene.getScaleManager();
                this.scene.player.x = scale.width / 2;
                this.scene.player.y = scale.height / 2;
            }

            this.scene.sceneTimeSec = 0;
            this.scene.gameStats.enemiesKilled = 0;

            await initializeLevel(this, this.scene.currentLevel);

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
        this.scene.game.events.emit(eventName, data);
        DebugLogger.info('transition', `[TransitionManager] Emitted ${eventName}`);

        return new Promise((resolve) => {
            this.scene.time.delayedCall(1500, () => resolve(null));
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

    logAnalytics(event, data) {
        if (this.isTransitioning) {
            this.pendingAnalytics.push({ event, data, timestamp: Date.now() });
            return;
        }

        if (this.scene.analyticsManager) {
            this.scene.analyticsManager.trackEvent(event, data);
        }

        DebugLogger.info('transition', `[Analytics] ${event}:`, data);
    }

    flushAnalytics() {
        if (this.pendingAnalytics.length === 0) return;

        for (const { event, data } of this.pendingAnalytics) {
            this.logAnalytics(event, data);
        }

        this.pendingAnalytics = [];
    }

    // ─── State management ────────────────────────────────────────

    resetTransitionState() {
        this.isTransitioning = false;
        this.isShowingVictory = false;
        this.isShowingDefeat = false;
        this.isResetting = false;
        this.currentTransition = null;
        this.flushAnalytics();
    }

    shutdown() {
        this.flushAnalytics();
        this.resetTransitionState();
        this.transitionQueue = [];
    }
}

export default TransitionManager;
