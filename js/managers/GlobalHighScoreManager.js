import { SupabaseClient } from '../utils/supabaseClient.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
import { getCachedVersion } from '../utils/version.js';

export class GlobalHighScoreManager {
    constructor() {
        // Použít sdílenou Supabase instanci
        this.supabase = SupabaseClient.getInstance();
        
        if (this.supabase) {
            DebugLogger.info('general', '✅ Global High Score Manager: Using shared Supabase client');
        } else {
            DebugLogger.error('general', '❌ Global High Score Manager: Supabase not available');
        }
        
        // Inicializovat isOnline property (bude aktualizován níže)
        this.isOnline = SupabaseClient.isAvailable() && this.supabase !== null;
        
        // Fallback na lokální scores
        this.localManager = null;
        
        // Cache pro rychlejší loading
        this.cachedScores = null;
        this.lastFetchTime = 0;
        this.cacheTimeout = 60000; // 1 minuta cache
        
        // Combine Supabase availability with network status
        this.isOnline = this.isOnline && navigator.onLine;
        this._setupNetworkListeners();

        // Idempotence proti dvojímu submitu (např. autorepeat klávesy)
        this.lastSubmitKey = null;
        this.lastSubmitResult = null;
    }
    
    _setupNetworkListeners() {
        this._onOnline = () => {
            this.isOnline = SupabaseClient.isAvailable();
            if (this.isOnline) DebugLogger.info('general', 'Connected - global scores available');
        };
        this._onOffline = () => {
            this.isOnline = false;
        };
        window.addEventListener('online', this._onOnline);
        window.addEventListener('offline', this._onOffline);
    }

    shutdown() {
        if (this._onOnline) window.removeEventListener('online', this._onOnline);
        if (this._onOffline) window.removeEventListener('offline', this._onOffline);
        this._onOnline = null;
        this._onOffline = null;
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
            version: getCachedVersion()
        };
    }
    
    async fetchGlobalScores() {
        // Pokud jsme offline nebo nemáme Supabase, použij lokální scores
        if (!this.isOnline || !this.supabase) {
            DebugLogger.info('general', '📡 Offline or Supabase not available - using local scores');
            return this.localManager ? this.localManager.getHighScores() : [];
        }
        
        // Check cache
        if (this.cachedScores && (Date.now() - this.lastFetchTime) < this.cacheTimeout) {
            DebugLogger.info('general', '⚡ Using cached global scores');
            return this.cachedScores;
        }
        
        try {
            DebugLogger.info('general', '🌐 Fetching global high scores from Supabase...');
            
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
            DebugLogger.info('general', '✅ Global scores loaded:', this.cachedScores.length);
            return this.cachedScores;
            
        } catch (error) {
            DebugLogger.warn('general', '❌ Failed to fetch global scores:', error.message);
            DebugLogger.info('general', '🔄 Falling back to local scores');
            return this.localManager ? this.localManager.getHighScores() : [];
        }
    }
    
    async submitScore(name, score, level, enemiesKilled, time, bossesDefeated) {
        const sanitizedScore = this.sanitizeScore(name, score, level, enemiesKilled, time, bossesDefeated);

        // Jednoduchý idempotentní klíč (jméno+skóre+čas)
        const submitKey = `${sanitizedScore.name}|${sanitizedScore.score}|${sanitizedScore.play_time}`;
        if (this.lastSubmitKey === submitKey && this.lastSubmitResult) {
            DebugLogger.info('general', '⛔ Duplicate submit ignored');
            return this.lastSubmitResult;
        }

        // 1) Lokální zápis a výpočet pozice
        let position = 1;
        if (this.localManager && typeof this.localManager.addHighScore === 'function') {
            position = this.localManager.addHighScore(
                sanitizedScore.name,
                sanitizedScore.score,
                sanitizedScore.level,
                sanitizedScore.enemies_killed,
                sanitizedScore.play_time,
                sanitizedScore.bosses_defeated
            );
        }

        // 2) Pokus o vzdálený zápis, pokud online a Supabase dostupné
        let remoteSaved = false;
        if (this.isOnline && this.supabase) {
            try {
                DebugLogger.info('general', '🌐 Submitting score to Supabase...');
                const { data, error } = await this.supabase
                    .from('high_scores')
                    .insert([sanitizedScore])
                    .select();
                if (error) throw error;
                DebugLogger.info('general', '✅ Score submitted to Supabase!', data);
                remoteSaved = true;
                // Invalidate cache pro čerstvé TOP10
                this.cachedScores = null;
                this.lastFetchTime = 0;
            } catch (error) {
                DebugLogger.warn('general', '❌ Failed to submit to Supabase:', error.message);
            }
        } else {
            DebugLogger.info('general', '📡 Offline or Supabase not available - remote submit skipped');
        }

        const result = { position, remoteSaved };
        this.lastSubmitKey = submitKey;
        this.lastSubmitResult = result;
        return result;
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
                DebugLogger.warn('general', 'Failed to check high score:', error);
            }
        }
        
        // Fallback na lokální scores
        if (this.localManager) {
            return this.localManager.isHighScore(score);
        }
        
        // Pokud nemáme žádná data, považuj za high score
        return true;
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