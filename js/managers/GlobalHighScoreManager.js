import { DebugLogger } from '../core/debug/DebugLogger.js';
import { getCachedVersion } from '../utils/version.js';

/**
 * GlobalHighScoreManager - Local-only high score management
 * Delegates to HighScoreManager (localStorage) for all operations.
 */
export class GlobalHighScoreManager {
    constructor() {
        this.localManager = null;
        this.lastSubmitKey = null;
        this.lastSubmitResult = null;
        DebugLogger.info('general', '✅ Global High Score Manager: local mode');
    }

    shutdown() {}

    setLocalFallback(localHighScoreManager) {
        this.localManager = localHighScoreManager;
    }

    sanitizeScore(name, score, level, enemiesKilled, time, bossesDefeated) {
        return {
            name: String(name || 'Anonym').substring(0, 12).replace(/[<>"'&]/g, ''),
            score: Math.max(0, Math.min(999999999, parseInt(score) || 0)),
            level: Math.max(1, Math.min(999, parseInt(level) || 1)),
            enemies_killed: Math.max(0, Math.min(99999, parseInt(enemiesKilled) || 0)),
            play_time: Math.max(0, Math.min(86400, parseInt(time) || 0)),
            bosses_defeated: Math.max(0, Math.min(99, parseInt(bossesDefeated) || 0)),
            version: getCachedVersion()
        };
    }

    async submitScore(name, score, level, enemiesKilled, time, bossesDefeated) {
        const sanitized = this.sanitizeScore(name, score, level, enemiesKilled, time, bossesDefeated);

        const submitKey = `${sanitized.name}|${sanitized.score}|${sanitized.play_time}`;
        if (this.lastSubmitKey === submitKey && this.lastSubmitResult) {
            return this.lastSubmitResult;
        }

        let position = 1;
        if (this.localManager?.addHighScore) {
            position = this.localManager.addHighScore(
                sanitized.name, sanitized.score, sanitized.level,
                sanitized.enemies_killed, sanitized.play_time, sanitized.bosses_defeated
            );
        }

        const result = { position, remoteSaved: false };
        this.lastSubmitKey = submitKey;
        this.lastSubmitResult = result;
        return result;
    }

    async getHighScores() {
        const scores = this.localManager ? this.localManager.getHighScores() : [];
        while (scores.length < 10) {
            scores.push({ name: 'PLAYD4D', score: 0, level: 0, enemies_killed: 0, play_time: 0, bosses_defeated: 0, date: '--.--.--' });
        }
        return scores;
    }

    async isHighScore(score) {
        return this.localManager ? this.localManager.isHighScore(score) : true;
    }

    getConnectionStatus() {
        return { online: false, supabaseAvailable: false, cached: false, lastFetch: 0, hasLocal: !!this.localManager };
    }
}
