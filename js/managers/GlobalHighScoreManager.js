export class GlobalHighScoreManager {
    constructor() {
        // JSONBin.io API pro jednoduchý globální storage
        this.API_URL = 'https://api.jsonbin.io/v3';
        this.BIN_ID = '677f4a1bad19ca34f8c8e5a2'; // Public bin pro high scores
        this.API_KEY = '$2a$10$jQ8v8K.vQ.4zq9z8K.4zq8z8K.4zq8z8K.4zq8z8K.4zq8z8K.4z'; // Placeholder
        
        // Fallback na lokální scores
        this.localManager = null;
        
        // Cache pro rychlejší loading
        this.cachedScores = null;
        this.lastFetchTime = 0;
        this.cacheTimeout = 60000; // 1 minuta cache
        
        this.isOnline = navigator.onLine;
        this.setupNetworkListeners();
    }
    
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Connected to internet - global scores available');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📡 Offline - using local scores only');
        });
    }
    
    setLocalFallback(localHighScoreManager) {
        this.localManager = localHighScoreManager;
    }
    
    // Sanitize a validate data
    sanitizeScore(name, score, level, enemiesKilled, time, bossesDefeated) {
        return {
            name: String(name || 'Anonym').substring(0, 12).replace(/[<>\"'&]/g, ''),
            score: Math.max(0, Math.min(999999999, parseInt(score) || 0)),
            level: Math.max(1, Math.min(999, parseInt(level) || 1)),
            enemiesKilled: Math.max(0, Math.min(99999, parseInt(enemiesKilled) || 0)),
            time: Math.max(0, Math.min(86400, parseInt(time) || 0)), // Max 24 hodin
            bossesDefeated: Math.max(0, Math.min(99, parseInt(bossesDefeated) || 0)),
            timestamp: Date.now(),
            version: '0.1.1'
        };
    }
    
    async fetchGlobalScores() {
        if (!this.isOnline) {
            console.log('📡 Offline - returning cached scores');
            return this.cachedScores || [];
        }
        
        // Check cache
        if (this.cachedScores && (Date.now() - this.lastFetchTime) < this.cacheTimeout) {
            console.log('⚡ Using cached global scores');
            return this.cachedScores;
        }
        
        try {
            console.log('🌐 Fetching global high scores...');
            
            // Simulace API call - v reálné implementaci by zde byl fetch
            const response = await this.mockFetchScores();
            
            if (response.success) {
                this.cachedScores = response.record.scores || [];
                this.lastFetchTime = Date.now();
                console.log('✅ Global scores loaded:', this.cachedScores.length);
                return this.cachedScores;
            } else {
                throw new Error('API response failed');
            }
        } catch (error) {
            console.warn('❌ Failed to fetch global scores:', error.message);
            console.log('🔄 Falling back to local scores');
            return this.localManager ? this.localManager.getHighScores() : [];
        }
    }
    
    // Mock API pro demo - v produkci by byl skutečný fetch
    async mockFetchScores() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    record: {
                        scores: [
                            { name: 'PlayD4d', score: 50000, level: 25, enemiesKilled: 500, time: 1200, bossesDefeated: 5, timestamp: Date.now() - 3600000 },
                            { name: 'Marda', score: 35000, level: 20, enemiesKilled: 350, time: 900, bossesDefeated: 4, timestamp: Date.now() - 7200000 },
                            { name: 'Bojovník', score: 28000, level: 18, enemiesKilled: 280, time: 800, bossesDefeated: 3, timestamp: Date.now() - 10800000 },
                            { name: 'Survivor', score: 22000, level: 15, enemiesKilled: 220, time: 700, bossesDefeated: 3, timestamp: Date.now() - 14400000 },
                            { name: 'Fighter', score: 18000, level: 12, enemiesKilled: 180, time: 600, bossesDefeated: 2, timestamp: Date.now() - 18000000 }
                        ]
                    }
                });
            }, 800); // Simulace network latency
        });
    }
    
    async submitScore(name, score, level, enemiesKilled, time, bossesDefeated) {
        const sanitizedScore = this.sanitizeScore(name, score, level, enemiesKilled, time, bossesDefeated);
        
        // Vždy uložit lokálně jako backup
        if (this.localManager) {
            this.localManager.addHighScore(
                sanitizedScore.name, 
                sanitizedScore.score, 
                sanitizedScore.level, 
                sanitizedScore.enemiesKilled, 
                sanitizedScore.time, 
                sanitizedScore.bossesDefeated
            );
        }
        
        if (!this.isOnline) {
            console.log('📡 Offline - score saved locally only');
            return false;
        }
        
        try {
            console.log('🌐 Submitting score to global leaderboard...');
            
            // Simulace API submit
            const response = await this.mockSubmitScore(sanitizedScore);
            
            if (response.success) {
                console.log('✅ Score submitted globally!');
                // Invalidate cache
                this.cachedScores = null;
                this.lastFetchTime = 0;
                return true;
            } else {
                throw new Error('Submit failed');
            }
        } catch (error) {
            console.warn('❌ Failed to submit global score:', error.message);
            console.log('💾 Score saved locally as backup');
            return false;
        }
    }
    
    // Mock submit pro demo
    async mockSubmitScore(scoreData) {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('📊 Score submitted:', scoreData);
                resolve({ success: true });
            }, 500);
        });
    }
    
    async getHighScores() {
        const globalScores = await this.fetchGlobalScores();
        
        // Sort podle score, vzestupně
        const sortedScores = globalScores
            .sort((a, b) => b.score - a.score)
            .slice(0, 10); // TOP 10
        
        // Padding na 10 položek
        while (sortedScores.length < 10) {
            sortedScores.push({
                name: 'PRÁZDNÉ',
                score: 0,
                level: 1,
                enemiesKilled: 0,
                time: 0,
                bossesDefeated: 0
            });
        }
        
        return sortedScores;
    }
    
    isHighScore(score) {
        if (!this.cachedScores) return true; // Pokud nemáme data, považuj za high score
        
        const scores = this.cachedScores.sort((a, b) => b.score - a.score);
        
        // Pokud máme méně než 10 scores, nebo je score vyšší než nejnižší
        return scores.length < 10 || score > (scores[9]?.score || 0);
    }
    
    getConnectionStatus() {
        return {
            online: this.isOnline,
            cached: !!this.cachedScores,
            lastFetch: this.lastFetchTime,
            hasLocal: !!this.localManager
        };
    }
}