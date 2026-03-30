import { DebugLogger } from '../core/debug/DebugLogger.js';

export class HighScoreManager {
    constructor() {
        this.storageKey = 'rakovinobijec_highscores';
        this.maxEntries = 10;
        this.highScores = this.loadHighScores();
    }
    
    loadHighScores() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const scores = JSON.parse(stored);
                // Data validation
                if (Array.isArray(scores)) {
                    return scores.filter(score => 
                        score && 
                        typeof score.name === 'string' && 
                        typeof score.score === 'number' &&
                        typeof score.level === 'number' &&
                        typeof score.date === 'string'
                    );
                }
            }
        } catch (error) {
            DebugLogger.error('general', 'Error loading high scores:', error);
        }
        
        // Default empty list
        return [];
    }
    
    saveHighScores() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.highScores));
        } catch (error) {
            DebugLogger.error('general', 'Error saving high scores:', error);
        }
    }
    
    isHighScore(score) {
        // Is a high score if:
        // 1. We have fewer than 10 entries, OR
        // 2. Score is higher than the lowest in TOP10
        return this.highScores.length < this.maxEntries || 
               score > this.getLowestScore();
    }
    
    getLowestScore() {
        if (this.highScores.length === 0) return 0;
        return Math.min(...this.highScores.map(entry => entry.score));
    }
    
    addHighScore(name, score, level, enemiesKilled, time, bossesDefeated) {
        // Name validation (max 8 characters)
        name = String(name).trim().slice(0, 8);
        if (name.length === 0) name = "Anonym";
        
        const newEntry = {
            name: name,
            score: score,
            level: level,
            enemiesKilled: enemiesKilled,
            time: time, // in seconds
            bossesDefeated: bossesDefeated,
            date: new Date().toLocaleDateString('cs-CZ')
        };
        
        // Add to the list
        this.highScores.push(newEntry);
        
        // Sort by score (highest first)
        this.highScores.sort((a, b) => b.score - a.score);
        
        // Limit to TOP10
        this.highScores = this.highScores.slice(0, this.maxEntries);
        
        // Save
        this.saveHighScores();
        
        // Return position in the leaderboard (1-based)
        const position = this.highScores.findIndex(entry => entry === newEntry) + 1;
        return position;
    }
    
    getHighScores() {
        // If we have fewer than 10 entries, fill with defaults
        const scores = [...this.highScores]; // Copy of actual scores

        // Fill up to 10 entries
        while (scores.length < 10) {
            scores.push({
                name: 'PLAYD4D',
                score: 0,
                level: 0,
                enemiesKilled: 0,
                time: 0,
                bossesDefeated: 0,
                date: '--.--.--'
            });
        }
        
        return scores;
    }
    
    getLastPlayerName() {
        if (this.highScores.length > 0) {
            // Return the name of the last added player (first in list)
            return this.highScores[0].name;
        }
        return null;
    }
    
    getRank(score) {
        // Return the position at which the score would be ranked (1-based)
        let rank = 1;
        for (const entry of this.highScores) {
            if (score <= entry.score) {
                rank++;
            } else {
                break;
            }
        }
        return rank;
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    clearHighScores() {
        this.highScores = [];
        this.saveHighScores();
    }
}