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
                // Validace dat
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
            console.error('Error loading high scores:', error);
        }
        
        // Výchozí prázdný seznam
        return [];
    }
    
    saveHighScores() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.highScores));
        } catch (error) {
            console.error('Error saving high scores:', error);
        }
    }
    
    isHighScore(score) {
        // Je high score pokud:
        // 1. Máme méně než 10 záznamů, NEBO
        // 2. Skóre je vyšší než nejnižší v TOP10
        return this.highScores.length < this.maxEntries || 
               score > this.getLowestScore();
    }
    
    getLowestScore() {
        if (this.highScores.length === 0) return 0;
        return Math.min(...this.highScores.map(entry => entry.score));
    }
    
    addHighScore(name, score, level, enemiesKilled, time, bossesDefeated) {
        // Validace jména (max 8 znaků)
        name = String(name).trim().slice(0, 8);
        if (name.length === 0) name = "Anonym";
        
        const newEntry = {
            name: name,
            score: score,
            level: level,
            enemiesKilled: enemiesKilled,
            time: time, // v sekundách
            bossesDefeated: bossesDefeated,
            date: new Date().toLocaleDateString('cs-CZ')
        };
        
        // Přidat do seznamu
        this.highScores.push(newEntry);
        
        // Seřadit podle skóre (nejvyšší první)
        this.highScores.sort((a, b) => b.score - a.score);
        
        // Omezit na TOP10
        this.highScores = this.highScores.slice(0, this.maxEntries);
        
        // Uložit
        this.saveHighScores();
        
        // Vrátit pozici v žebříčku (1-based)
        const position = this.highScores.findIndex(entry => entry === newEntry) + 1;
        return position;
    }
    
    getHighScores() {
        // Pokud máme méně než 10 záznamů, doplnit defaulty
        const scores = [...this.highScores]; // Kopie skutečných skóre
        
        // Doplnit na 10 záznamů
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
            // Vrátit jméno posledního přidaného hráče (první v seznamu)
            return this.highScores[0].name;
        }
        return null;
    }
    
    getRank(score) {
        // Vrátit pozici, na kterou by skóre bylo zařazeno (1-based)
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