export class GlobalHighScoreManager {
    constructor() {
        // Supabase konfigurace - ANON klíč je bezpečný pro veřejné použití!
        // Funguje pouze s RLS policies, nemůže způsobit škodu
        this.SUPABASE_URL = 'https://gonsippgsrbutwanzpyo.supabase.co';
        this.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvbnNpcHBnc3JidXR3YW56cHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MzAyNDEsImV4cCI6MjA3MDMwNjI0MX0.2FINt1ku94IMVYzp7zKJvFSt0Z7t6gj-lCsAwcwMCXs';
        
        // Inicializace Supabase klienta
        if (typeof window.supabase !== 'undefined') {
            this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
            console.log('✅ Supabase client initialized');
        } else {
            console.error('❌ Supabase client not loaded');
            this.supabase = null;
        }
        
        // Fallback na lokální scores
        this.localManager = null;
        
        // Cache pro rychlejší loading
        this.cachedScores = null;
        this.lastFetchTime = 0;
        this.cacheTimeout = 60000; // 1 minuta cache
        
        // Mock storage pro fallback
        this.mockStorage = [];
        
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
            enemies_killed: Math.max(0, Math.min(99999, parseInt(enemiesKilled) || 0)),
            play_time: Math.max(0, Math.min(86400, parseInt(time) || 0)), // Max 24 hodin
            bosses_defeated: Math.max(0, Math.min(99, parseInt(bossesDefeated) || 0)),
            version: '0.1.1'
        };
    }
    
    async fetchGlobalScores() {
        if (!this.isOnline || !this.supabase) {
            console.log('📡 Offline or Supabase not available - returning cached scores');
            return this.cachedScores || this.mockStorage;
        }
        
        // Check cache
        if (this.cachedScores && (Date.now() - this.lastFetchTime) < this.cacheTimeout) {
            console.log('⚡ Using cached global scores');
            return this.cachedScores;
        }
        
        try {
            console.log('🌐 Fetching global high scores from Supabase...');
            
            const { data, error } = await this.supabase
                .from('high_scores')
                .select('*')
                .order('score', { ascending: false })
                .limit(10);
            
            if (error) {
                throw error;
            }
            
            this.cachedScores = data || [];
            this.lastFetchTime = Date.now();
            console.log('✅ Global scores loaded:', this.cachedScores.length);
            return this.cachedScores;
            
        } catch (error) {
            console.warn('❌ Failed to fetch global scores:', error.message);
            console.log('🔄 Falling back to mock/local scores');
            
            // Fallback na mock API
            return this.mockFetchScores();
        }
    }
    
    // Mock API pro demo/fallback - v případě výpadku Supabase
    async mockFetchScores() {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('📊 Mock fetch - current storage:', this.mockStorage);
                resolve([...this.mockStorage]); // Vrátit kopii aktuálních scores
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
                sanitizedScore.enemies_killed, 
                sanitizedScore.play_time, 
                sanitizedScore.bosses_defeated
            );
        }
        
        if (!this.isOnline || !this.supabase) {
            console.log('📡 Offline or Supabase not available - score saved locally only');
            // Uložit do mock storage jako fallback
            await this.mockSubmitScore(sanitizedScore);
            return false;
        }
        
        try {
            console.log('🌐 Submitting score to Supabase...');
            
            const { data, error } = await this.supabase
                .from('high_scores')
                .insert([sanitizedScore])
                .select();
            
            if (error) {
                throw error;
            }
            
            console.log('✅ Score submitted to Supabase!', data);
            // Invalidate cache
            this.cachedScores = null;
            this.lastFetchTime = 0;
            return true;
            
        } catch (error) {
            console.warn('❌ Failed to submit to Supabase:', error.message);
            console.log('💾 Saving to mock storage as backup');
            
            // Fallback na mock storage
            await this.mockSubmitScore(sanitizedScore);
            return false;
        }
    }
    
    // Mock submit pro fallback
    async mockSubmitScore(scoreData) {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('📊 Mock submit - adding score:', scoreData);
                
                // Přidat nové skóre do mock storage
                this.mockStorage.push(scoreData);
                
                // Seřadit podle skóre (nejvyšší první)
                this.mockStorage.sort((a, b) => b.score - a.score);
                
                // Omezit na TOP 10
                this.mockStorage = this.mockStorage.slice(0, 10);
                
                console.log('📊 Mock storage after submit:', this.mockStorage);
                resolve({ success: true });
            }, 500);
        });
    }
    
    async getHighScores() {
        const globalScores = await this.fetchGlobalScores();
        
        // Sort podle score, vzestupně
        const sortedScores = (globalScores || [])
            .sort((a, b) => b.score - a.score)
            .slice(0, 10); // TOP 10
        
        // Padding na 10 položek - stejně jako lokální verze
        while (sortedScores.length < 10) {
            sortedScores.push({
                name: 'PLAYD4D',
                score: 0,
                level: 0,
                enemies_killed: 0,
                play_time: 0,
                bosses_defeated: 0,
                date: '--.--.--'
            });
        }
        
        return sortedScores;
    }
    
    async isHighScore(score) {
        // Nejdřív zkusit Supabase
        if (this.isOnline && this.supabase) {
            try {
                // Získat 10. nejlepší skóre
                const { data, error } = await this.supabase
                    .from('high_scores')
                    .select('score')
                    .order('score', { ascending: false })
                    .limit(1)
                    .range(9, 9); // 10. pozice (index 9)
                
                if (error) throw error;
                
                // Pokud je méně než 10 záznamů, nebo je score vyšší než 10. místo
                return !data || data.length === 0 || score > (data[0]?.score || 0);
                
            } catch (error) {
                console.warn('Failed to check high score:', error);
            }
        }
        
        // Fallback na cache nebo mock
        if (!this.cachedScores && !this.mockStorage.length) return true;
        
        const scores = (this.cachedScores || this.mockStorage).sort((a, b) => b.score - a.score);
        
        // Pokud máme méně než 10 scores, nebo je score vyšší než nejnižší
        return scores.length < 10 || score > (scores[9]?.score || 0);
    }
    
    getConnectionStatus() {
        return {
            online: this.isOnline,
            supabaseAvailable: !!this.supabase,
            cached: !!this.cachedScores,
            lastFetch: this.lastFetchTime,
            hasLocal: !!this.localManager
        };
    }
}