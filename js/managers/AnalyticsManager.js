/**
 * AnalyticsManager - Správce analytických dat
 * 
 * PR7 kompatibilní - všechny konstanty z ConfigResolver
 * Sbírá a odesílá herní data pro analýzu a vylepšení hry
 */

import { getCachedVersion } from '../utils/version.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';

export class AnalyticsManager {
    constructor(supabase, settings = {}) {
        this.supabase = supabase;
        this.enabled = settings.allowAnalytics !== false && !!supabase; // Enabled only with valid supabase
        
        if (!this.enabled) {
            DebugLogger.info('general', '📊 Analytics disabled', !supabase ? '(no Supabase)' : '(user settings)');
            // Initialize minimal state for no-op mode
            this.sessionId = this.generateSessionId();
            this.sessionStartTime = Date.now();
            this.sessionData = {};
            this.eventQueue = [];
            this.fpsHistory = [];
            return;
        }
        
        // Session tracking
        this.sessionId = this.generateSessionId();
        this.sessionStartTime = Date.now();
        this.sessionData = {
            session_id: this.sessionId,
            player_name: null,
            browser: this.getBrowserInfo(),
            user_agent: navigator.userAgent,
            screen_width: screen.width,
            screen_height: screen.height,
            game_version: getCachedVersion(),
            connection_type: this.supabase ? 'supabase' : 'local'
        };
        
        // Event queue pro batch upload
        this.eventQueue = [];
        
        // PR7: Flag pro kontrolu, zda je session vytvořena
        this.sessionCreated = false;
        this.sessionCreationPending = false;
        
        // PR7: Získat interval z ConfigResolver
        const CR = window.ConfigResolver;
        this.flushInterval = CR?.get('analytics.flushInterval', { defaultValue: 30000 }) || 30000; // 30 sekund
        this.startFlushTimer();
        
        // Performance monitoring
        this.fpsHistory = [];
        this.startPerformanceMonitoring();
        
        // Performance snapshots & diagnostics
        this.performanceSnapshotIntervalMs = CR?.get('analytics.performanceSnapshotInterval', { defaultValue: 60000 }) || 60000; // 60s
        this.performanceSnapshotTimer = null;
        this.lastUploadLatencyMs = null;
        this.lastLowFpsIssueAt = 0;
        this.lowFpsDebounceMs = CR?.get('analytics.lowFpsDebounce', { defaultValue: 10000 }) || 10000; // min 10s mezi low_fps eventy
        this.startPerformanceSnapshots();
        
        DebugLogger.info('general', '📊 Analytics initialized:', this.sessionId);
        
        // PR7: Okamžitě vytvořit session v databázi, aby enemy_stats měly foreign key
        this.createInitialSession();
    }
    
    /**
     * Vytvoří počáteční session záznam v databázi
     * PR7 kompatibilní - řeší foreign key constraint
     */
    async createInitialSession() {
        if (!this.enabled || !this.supabase) return;
        
        if (this.sessionCreationPending || this.sessionCreated) return;
        this.sessionCreationPending = true;
        
        try {
            const initialData = {
                session_id: this.sessionId,
                player_name: this.sessionData.player_name,
                browser: this.sessionData.browser,
                user_agent: this.sessionData.user_agent,
                screen_width: this.sessionData.screen_width,
                screen_height: this.sessionData.screen_height,
                game_version: this.sessionData.game_version,
                connection_type: this.sessionData.connection_type,
                started_at: new Date().toISOString(),
                // Placeholder hodnoty - budou aktualizovány později
                level_reached: 1,
                enemies_killed: 0,
                score: 0
                // Poznámka: duration_seconds je GENERATED column v DB, nepotřebujeme ho posílat
            };
            
            const { error } = await this.supabase
                .from('game_sessions')
                .insert([initialData]);
                
            if (error) {
                DebugLogger.warn('bootstrap', '⚠️ Failed to create initial session:', error.message);
                this.sessionCreationPending = false;
            } else {
                DebugLogger.info('general', '✅ Initial session created:', this.sessionId);
                this.sessionCreated = true;
                this.sessionCreationPending = false;
            }
        } catch (error) {
            DebugLogger.warn('bootstrap', '⚠️ Failed to create initial session:', error.message);
            this.sessionCreationPending = false;
        }
    }
    
    generateSessionId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    getBrowserInfo() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
        if (ua.includes('Edge')) return 'Edge';
        return 'Unknown';
    }
    
    // ===== SESSION TRACKING =====
    
    async startSession(playerName = null) {
        if (!this.enabled) {
            DebugLogger.info('general', '📊 Analytics disabled - session start skipped');
            return;
        }
        
        DebugLogger.info('general', '📊 Starting session:', this.sessionId, 'for player:', playerName || 'anonymous');
        
        // PR7: Získat limity z ConfigResolver
        const CR = window.ConfigResolver;
        const nameLimit = CR?.get('analytics.limits.playerName', { defaultValue: 12 }) || 12;
        
        // Sanitizace jména hráče (DB limit)
        this.sessionData.player_name = playerName ? String(playerName).substring(0, nameLimit) : null;
        this.sessionData.started_at = new Date().toISOString();
        
        try {
            // Uložit session hned na začátku, aby existovala pro foreign keys
            await this.uploadSessionData({
                ...this.sessionData,
                // Výchozí hodnoty pro povinné sloupce
                final_score: 0,
                final_level: 1,
                total_damage_dealt: 0,
                total_damage_taken: 0,
                enemies_killed: 0,
                bosses_defeated: [],
                xp_collected: 0,
                health_pickups: 0,
                power_ups_collected: 0,
                fps_average: 60
            });
            
            DebugLogger.info('general', '✅ Session started and saved successfully:', this.sessionId);
        } catch (error) {
            DebugLogger.error('general', '❌ Failed to start session:', error);
            throw error;
        }
    }
    
    async endSession(gameStats) {
        if (!this.enabled) {
            DebugLogger.info('general', '📊 Analytics disabled - session end skipped');
            return;
        }
        
        const endTime = Date.now();
        const duration = Math.floor((endTime - this.sessionStartTime) / 1000);
        
        DebugLogger.info('general', '📊 Ending session:', this.sessionId, 'after', duration, 'seconds');
        DebugLogger.info('general', '📊 Final stats:', {
            score: gameStats.score,
            level: gameStats.level,
            enemies: gameStats.enemiesKilled,
            damage_dealt: gameStats.totalDamageDealt,
            damage_taken: gameStats.totalDamageTaken
        });
        
        const sessionUpdate = {
            ended_at: new Date().toISOString(),
            duration: duration,
            final_score: Math.floor(Number(gameStats.score) || 0),
            final_level: Math.floor(Number(gameStats.level) || 1),
            total_damage_dealt: Math.floor(Number(gameStats.totalDamageDealt) || 0),
            total_damage_taken: Math.floor(Number(gameStats.totalDamageTaken) || 0),
            enemies_killed: Math.floor(Number(gameStats.enemiesKilled) || 0),
            bosses_defeated: gameStats.bossesDefeatedList || [],
            xp_collected: Math.floor(Number(gameStats.xpCollected) || 0),
            health_pickups: Math.floor(Number(gameStats.healthPickups) || 0),
            power_ups_collected: Math.floor(Number(gameStats.powerUpsCollected) || 0),
            fps_average: this.getAverageFPS(),
            // Doplnit data o smrti i do game_sessions
            death_cause: this.sessionData?.death_cause ?? null,
            death_position_x: (this.sessionData?.death_position_x ?? null),
            death_position_y: (this.sessionData?.death_position_y ?? null)
        };
        
        try {
            // Enqueue summary performance snapshot
            if (this.supabase) {
                const fpsStats = this.getFPSStats();
                const mem = (typeof performance !== 'undefined' && performance.memory) ? performance.memory : null;
                const memory_used_mb = mem ? Math.round(mem.usedJSHeapSize / (1024 * 1024)) : null;
                const memory_limit_mb = mem ? Math.round(mem.jsHeapSizeLimit / (1024 * 1024)) : null;
                const supabase_available = !!this.supabase;
                const api_latency_ms = this.lastUploadLatencyMs ?? null;
                this.queueEvent('performance_metrics', {
                    session_id: this.sessionId,
                    fps_min: fpsStats.min,
                    fps_max: fpsStats.max,
                    fps_average: fpsStats.avg,
                    fps_drops: fpsStats.drops,
                    memory_used_mb,
                    memory_limit_mb,
                    api_latency_ms,
                    supabase_available
                });
            }
            await this.updateSessionData(sessionUpdate);
            DebugLogger.info('general', '✅ Session ended successfully:', this.sessionId, 'duration:', duration, 'seconds');
        } catch (error) {
            DebugLogger.error('general', '❌ Failed to end session:', this.sessionId, error);
            throw error;
        }
    }
    
    // ===== EVENT TRACKING =====
    // Sanitizace typů nepřátel pro omezenou délku DB sloupce (VARCHAR(50))
    sanitizeEnemyType(rawType) {
        if (!rawType) return 'unknown';
        let t = String(rawType).toLowerCase();
        // Odstranit diakritiku (bez závislosti na emoji regexech)
        try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
        // Speciální handling pro boss:
        if (t.startsWith('boss:')) {
            const name = t.slice(5);
            const slug = name.replace(/[^a-z0-9]+/g, '-');
            t = 'boss:' + slug;
        }
        // Povolit pouze a-z0-9 a ':' a nahradit ostatní za '-'
        t = t.replace(/[^a-z0-9:]+/g, '-');
        // Zbavit se vícenásobných '-'
        t = t.replace(/-+/g, '-');
        // Oříznout začátky/konce '-'
        t = t.replace(/^-+/, '').replace(/-+$/, '');
        if (!t || t === 'boss:') return 'unknown';
        // Limit délky (držet sync s DB)
        if (t.length > 50) t = t.slice(0, 50);
        return t;
    }
    
    trackEnemyKill(enemyType, level, damage) {
        if (!this.enabled) return;
        
        // Validace - neposlat NULL hodnoty
        if (!enemyType) {
            DebugLogger.warn('bootstrap', '⚠️ Analytics: enemyType is null/undefined, skipping trackEnemyKill');
            return;
        }
        
        this.queueEvent('enemy_stats', {
            session_id: this.sessionId,
            enemy_type: this.sanitizeEnemyType(enemyType),
            enemy_level: Math.floor(Number(level) || 1),
            killed_count: 1,
            damage_taken_from_player: Math.floor(Number(damage) || 0)
        });
    }
    
    trackEnemySpawn(enemyType, level) {
        if (!this.enabled) return;
        
        // Validace - neposlat NULL hodnoty
        if (!enemyType) {
            DebugLogger.warn('bootstrap', '⚠️ Analytics: enemyType is null/undefined, skipping trackEnemySpawn');
            return;
        }
        
        this.queueEvent('enemy_stats', {
            session_id: this.sessionId,
            enemy_type: this.sanitizeEnemyType(enemyType),
            enemy_level: Math.floor(Number(level) || 1),
            spawn_count: 1
        });
    }
    
    trackDamageDealt(amount, targetType) {
        if (!this.enabled) return;
        
        // Akumuluj damage statistiky
        if (!this.sessionData.damage_by_target) {
            this.sessionData.damage_by_target = {};
        }
        
        this.sessionData.damage_by_target[targetType] = 
            (this.sessionData.damage_by_target[targetType] || 0) + amount;
    }
    
    trackDamageTaken(amount, sourceType, sourceLevel = null) {
        if (!this.enabled) return;
        
        // Validace - neposlat NULL hodnoty
        if (!sourceType) {
            DebugLogger.warn('bootstrap', '⚠️ Analytics: sourceType is null/undefined, skipping trackDamageTaken');
            return;
        }
        
        this.queueEvent('enemy_stats', {
            session_id: this.sessionId,
            enemy_type: this.sanitizeEnemyType(sourceType),
            enemy_level: Math.floor(Number(sourceLevel) || 1),
            damage_dealt_to_player: Math.floor(Number(amount) || 0)
        });
    }
    
    trackPowerUpOffered(options, level, playerHP, enemiesOnScreen) {
        if (!this.enabled) return;
        
        options.forEach(powerup => {
            this.queueEvent('powerup_events', {
                session_id: this.sessionId,
                event_type: 'offered',
                powerup_name: String(powerup.name || 'unknown'),
                level_selected: Math.floor(Number(level) || 1),
                current_tier: Math.floor(Number((powerup.level || 0) + 1)),
                options_offered: options.map(p => String(p.name || 'unknown')),
                player_hp_at_selection: Math.floor(Number(playerHP) || 0),
                enemies_on_screen: Math.floor(Number(enemiesOnScreen) || 0)
            });
        });
    }
    
    trackPowerUpSelected(powerupName, options, level, playerHP, enemiesOnScreen) {
        if (!this.enabled) return;
        
        // Najít aktuální tier vybraného powerupu (po zvýšení úrovně)
        let currentTier = 1;
        try {
            const selected = (options || []).find(p => String(p.name || 'unknown') === String(powerupName || 'unknown'));
            currentTier = Math.floor(Number(selected?.level || 1));
        } catch (e) { /* ignore */ }

        this.queueEvent('powerup_events', {
            session_id: this.sessionId,
            event_type: 'selected',
            powerup_name: String(powerupName || 'unknown'),
            level_selected: Math.floor(Number(level) || 1),
            current_tier: currentTier,
            options_offered: options.map(p => String(p.name || 'unknown')),
            player_hp_at_selection: Math.floor(Number(playerHP) || 0),
            enemies_on_screen: Math.floor(Number(enemiesOnScreen) || 0)
        });
    }
    
    trackBossEncounter(bossName, level, playerHPStart = null) {
        if (!this.enabled) return;
        
        this.currentBossEncounter = {
            session_id: this.sessionId,
            boss_name: String(bossName || 'Unknown Boss'),
            boss_level: Math.floor(Number(level) || 1),
            timestamp: new Date().toISOString(), // Použít timestamp místo start_time
            damage_dealt_to_boss: 0,
            damage_taken_from_boss: 0,
            special_attacks_used: 0,
            player_hp_start: Math.floor(Number(playerHPStart) || 0),
            death_phase: null,
            started_at: Date.now() // Interní tracking pro duration
        };
    }

    // Logování boss akce/patternu (odlehčené)
    trackBossAction(actionName, phaseIndex) {
        if (!this.enabled || !this.currentBossEncounter) return;
        try {
            this.queueEvent('boss_encounters', {
                session_id: this.sessionId,
                boss_name: this.currentBossEncounter.boss_name,
                event_type: 'action',
                action_name: String(actionName || 'unknown'),
                phase_index: Math.floor(Number(phaseIndex) || 0),
                occurred_at: new Date().toISOString()
            });
        } catch (_) { /* no-op */ }
    }
    
    trackBossDefeat(playerHP) {
        if (!this.enabled || !this.currentBossEncounter) return;
        
        const encounter = {
            ...this.currentBossEncounter,
            defeated: true,
            fight_duration: Math.floor((Date.now() - this.currentBossEncounter.started_at) / 1000),
            player_hp_end: Math.floor(Number(playerHP) || 0)
        };
        
        // Odstranit started_at před odesláním do databáze
        delete encounter.started_at;
        
        this.queueEvent('boss_encounters', encounter);
        this.currentBossEncounter = null;
    }
    
    abortBossEncounter(playerHP) {
        if (!this.enabled || !this.currentBossEncounter) return;
        const encounter = {
            ...this.currentBossEncounter,
            defeated: false,
            fight_duration: Math.floor((Date.now() - this.currentBossEncounter.started_at) / 1000),
            player_hp_end: Math.floor(Number(playerHP) || 0)
        };
        delete encounter.started_at;
        this.queueEvent('boss_encounters', encounter);
        this.currentBossEncounter = null;
    }

    // ===== BOSS ENCOUNTER LIVE UPDATES (in-memory, uloží se při defeat) =====
    recordBossDamageDealt(amount) {
        if (!this.enabled || !this.currentBossEncounter) return;
        const dmg = Math.floor(Number(amount) || 0);
        if (dmg <= 0) return;
        this.currentBossEncounter.damage_dealt_to_boss += dmg;
    }
    
    recordBossDamageTaken(amount) {
        if (!this.enabled || !this.currentBossEncounter) return;
        const dmg = Math.floor(Number(amount) || 0);
        if (dmg <= 0) return;
        this.currentBossEncounter.damage_taken_from_boss += dmg;
    }
    
    incrementBossSpecialAttacksUsed() {
        if (!this.enabled || !this.currentBossEncounter) return;
        this.currentBossEncounter.special_attacks_used += 1;
    }

    setBossPhase(phaseCode) {
        if (!this.enabled || !this.currentBossEncounter) return;
        const code = parseInt(phaseCode, 10);
        if (!Number.isNaN(code)) {
            this.currentBossEncounter.death_phase = code;
        }
    }
    
    trackPlayerDeath(cause, position, gameStats, context = {}) {
        if (!this.enabled) return;
        
        // PR7: Null protection pro cause parameter
        const safePosition = position || { x: 0, y: 0 };
        const safeGameStats = gameStats || {};
        const safeCause = cause || { type: 'unknown', damage: 0 };
        
        const deathEvent = {
            session_id: this.sessionId,
            player_name: String(this.sessionData.player_name || 'anonymous'),
            level: Math.floor(Number(safeGameStats.level) || 1),
            score: Math.floor(Number(safeGameStats.score) || 0),
            survival_time: Math.floor((Date.now() - this.sessionStartTime) / 1000),
            
            killer_type: String(safeCause.type || 'unknown'), // 'enemy:green', 'boss:metastaza', etc.
            killer_damage: Math.floor(Number(safeCause.damage) || 0),
            overkill_damage: Math.floor(Math.max(0, (Number(safeCause.damage) || 0) - (Number(context.playerHP) || 0))),
            
            player_hp_before: Math.floor(Number(context.playerHP) || 0),
            player_max_hp: Math.floor(Number(context.playerMaxHP) || 100),
            position_x: Math.floor(Number(safePosition.x) || 0),
            position_y: Math.floor(Number(safePosition.y) || 0),
            active_power_ups: context.activePowerUps || [],
            
            enemies_on_screen: Math.floor(Number(context.enemiesOnScreen) || 0),
            projectiles_on_screen: Math.floor(Number(context.projectilesOnScreen) || 0),
            was_boss_fight: context.wasBossFight || false
        };
        
        this.sessionData.death_cause = String(safeCause.type || 'unknown');
        this.sessionData.death_position_x = Math.floor(Number(safePosition.x) || 0);
        this.sessionData.death_position_y = Math.floor(Number(safePosition.y) || 0);
        
        this.queueEvent('death_events', deathEvent);

        // Increment enemy_stats.player_deaths_caused pro daný enemy type (mimo boss/projektil)
        try {
            const killerType = String(safeCause.type || 'unknown');
            const isBoss = killerType.startsWith('boss:');
            const isProjectile = killerType === 'projectile' || killerType.startsWith('projectile');
            if (!isBoss && !isProjectile && killerType !== 'unknown') {
                // Zachovat značení elite: pokud existuje
                const enemyType = this.sanitizeEnemyType(killerType);
                this.queueEvent('enemy_stats', {
                    session_id: this.sessionId,
                    enemy_type: enemyType,
                    enemy_level: Math.floor(Number(gameStats.level) || 1),
                    player_deaths_caused: 1
                });
            }
        } catch (e) {
            // best-effort, neblokovat
        }
    }
    
    // ===== LIFECYCLE =====

    shutdown() { this.destroy(); }

    destroy() {
        this.enabled = false;
        this._fpsTrackingActive = false;
        if (this.performanceSnapshotTimer) {
            clearInterval(this.performanceSnapshotTimer);
            this.performanceSnapshotTimer = null;
        }
        if (this._flushTimer) {
            clearInterval(this._flushTimer);
            this._flushTimer = null;
        }
        this.eventQueue = [];
    }

    // ===== PERFORMANCE TRACKING =====

    startPerformanceMonitoring() {
        if (!this.enabled) return;
        
        // FPS tracking
        let lastTime = performance.now();
        const trackFPS = (currentTime) => {
            const fps = 1000 / (currentTime - lastTime);
            this.fpsHistory.push(fps);
            
            // Keep only last 100 measurements
            if (this.fpsHistory.length > 100) {
                this.fpsHistory.shift();
            }
            
            lastTime = currentTime;
            if (this._fpsTrackingActive) requestAnimationFrame(trackFPS);
        };
        this._fpsTrackingActive = true;
        requestAnimationFrame(trackFPS);
    }
    
    startPerformanceSnapshots() {
        if (!this.enabled || this.performanceSnapshotTimer) return;
        this.performanceSnapshotTimer = setInterval(() => {
            // Skip, pokud není Supabase nebo je stránka skrytá
            if (!this.supabase || (typeof document !== 'undefined' && document.hidden)) return;
            
            const fpsStats = this.getFPSStats();
            const mem = (typeof performance !== 'undefined' && performance.memory) ? performance.memory : null;
            const memory_used_mb = mem ? Math.round(mem.usedJSHeapSize / (1024 * 1024)) : null;
            const memory_limit_mb = mem ? Math.round(mem.jsHeapSizeLimit / (1024 * 1024)) : null;
            const supabase_available = !!this.supabase;
            const api_latency_ms = this.lastUploadLatencyMs ?? null;
            
            this.queueEvent('performance_metrics', {
                session_id: this.sessionId,
                fps_min: fpsStats.min,
                fps_max: fpsStats.max,
                fps_average: fpsStats.avg,
                fps_drops: fpsStats.drops,
                memory_used_mb,
                memory_limit_mb,
                api_latency_ms,
                supabase_available
            });
        }, this.performanceSnapshotIntervalMs);
    }
    
    getAverageFPS() {
        if (this.fpsHistory.length === 0) return 60;
        
        const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.fpsHistory.length * 100) / 100;
    }
    
    getFPSStats() {
        if (this.fpsHistory.length === 0) return { min: 60, max: 60, avg: 60, drops: 0 };
        
        const min = Math.min(...this.fpsHistory);
        const max = Math.max(...this.fpsHistory);
        const avg = this.getAverageFPS();
        const drops = this.fpsHistory.filter(fps => fps < 30).length;
        
        return { min, max, avg, drops };
    }
    
    trackPerformanceIssue(type, details = {}) {
        if (!this.enabled) return;
        
        const fpsStats = this.getFPSStats();
        
        // Low FPS: debounce a threshold
        if (type === 'low_fps') {
            const now = Date.now();
            if (now - this.lastLowFpsIssueAt < this.lowFpsDebounceMs) return;
            if (typeof details.fps === 'number' && details.fps > 45) return;
            this.lastLowFpsIssueAt = now;
        }
        
        this.queueEvent('performance_metrics', {
            session_id: this.sessionId,
            fps_min: fpsStats.min,
            fps_max: fpsStats.max,
            fps_average: fpsStats.avg,
            fps_drops: fpsStats.drops,
            error_count: type === 'error' ? 1 : 0,
            error_types: type === 'error' ? [details.error] : []
        });
    }
    
    // ===== DATA MANAGEMENT =====
    
    queueEvent(table, data) {
        this.eventQueue.push({
            table: table,
            data: data
        });
    }
    
    startFlushTimer() {
        if (!this.enabled) return;
        
        this._flushTimer = setInterval(() => {
            this.flushEvents();
        }, this.flushInterval);
    }
    
    async flushEvents() {
        if (!this.enabled || this.eventQueue.length === 0 || !this.supabase) {
            return;
        }
        
        // PR7: Počkat na vytvoření session před odesláním eventů
        if (!this.sessionCreated) {
            if (!this.sessionCreationPending) {
                await this.createInitialSession();
            }
            // Pokud stále není vytvořena, počkat na další flush
            if (!this.sessionCreated) {
                DebugLogger.info('general', '📊 Čekám na vytvoření session...');
                return;
            }
        }
        
        DebugLogger.info('general', `📊 Flushing ${this.eventQueue.length} analytics events...`);
        
        // Group events by table (ignore if supabase is null)
        const eventsByTable = {};
        this.eventQueue.forEach(event => {
            if (!eventsByTable[event.table]) {
                eventsByTable[event.table] = [];
            }
            eventsByTable[event.table].push(event.data);
        });
        
        // Upload each table's data
        for (const [table, events] of Object.entries(eventsByTable)) {
            try {
                DebugLogger.info('general', `📊 Uploading ${events.length} events to ${table}...`);
                const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                const { error } = await this.supabase
                    .from(table)
                    .insert(events, { returning: 'minimal' });
                const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                this.lastUploadLatencyMs = Math.round(t1 - t0);
                
                if (error) {
                    DebugLogger.warn('bootstrap', `❌ Failed to upload ${table}:`, error.message);
                    DebugLogger.warn('bootstrap', '❌ Sample event data:', events[0]);
                    // Don't throw - continue with other tables
                } else {
                    DebugLogger.info('general', `✅ Uploaded ${events.length} ${table} events successfully`);
                }
            } catch (error) {
                DebugLogger.warn('bootstrap', `❌ Exception uploading ${table}:`, error.message);
                DebugLogger.warn('bootstrap', '❌ Sample event data:', events[0]);
                // Don't throw - continue with other tables
            }
        }
        
        // Clear queue
        this.eventQueue = [];
    }
    
    async uploadSessionData(sessionData) {
        if (!this.enabled || !this.supabase) return;
        
        try {
            const { error } = await this.supabase
                .from('game_sessions')
                .insert([sessionData]);
            
            if (error) {
                DebugLogger.warn('bootstrap', '❌ Failed to upload session data:', error.message);
            } else {
                DebugLogger.info('general', '✅ Session data uploaded successfully');
            }
        } catch (error) {
            DebugLogger.warn('bootstrap', '❌ Failed to upload session data:', error.message);
        }
    }
    
    async updateSessionData(sessionUpdate) {
        if (!this.enabled || !this.supabase) {
            DebugLogger.info('general', '📊 Analytics disabled or no Supabase - session update skipped');
            return;
        }
        
        DebugLogger.info('general', '📊 Updating session data for:', this.sessionId);
        
        try {
            // Prefer upsert pro spolehlivost (vyžaduje INSERT i UPDATE policy)
            const payload = { session_id: this.sessionId, ...sessionUpdate };
            const { error } = await this.supabase
                .from('game_sessions')
                .upsert(payload, { onConflict: 'session_id' });
            
            if (error) {
                DebugLogger.error('general', '❌ Database error updating session:', error.message);
                DebugLogger.error('general', '❌ Session ID:', this.sessionId);
                DebugLogger.error('general', '❌ Update data:', sessionUpdate);
                throw error;
            } else {
                DebugLogger.info('general', '✅ Session data updated successfully for:', this.sessionId);
            }
        } catch (error) {
            DebugLogger.error('general', '❌ Exception updating session data:', error.message);
            DebugLogger.error('general', '❌ Session ID:', this.sessionId);
            throw error;
        }
    }
    
    // ===== USER CONTROLS =====
    
    disable() {
        this.enabled = false;
        this.eventQueue = [];
        DebugLogger.info('general', '📊 Analytics disabled');
    }
    
    enable() {
        this.enabled = true;
        DebugLogger.info('general', '📊 Analytics enabled');
    }
    
    // ===== PUBLIC API =====
    
    // Safe public method for external use (always available)
    trackEvent(name, payload = {}) {
        if (!this.enabled) return; // no-op when disabled
        
        try {
            // Route to appropriate internal method based on event name
            switch(name) {
                case 'enemy_killed':
                    if (payload.enemy_type) {
                        this.trackEnemyKill(payload.enemy_type, payload.level || 1, payload.damage || 0);
                    }
                    break;
                case 'enemy_spawned':
                    if (payload.enemy_type) {
                        this.trackEnemySpawn(payload.enemy_type, payload.level || 1);
                    }
                    break;
                default:
                    // Generic event (not implemented for now)
                    break;
            }
        } catch (error) {
            DebugLogger.warn('bootstrap', '[Analytics] Failed to track event:', name, error);
        }
    }
    
    // Safe flush method (always available)
    flush() {
        if (!this.enabled) return Promise.resolve(); // no-op when disabled
        return this.flushEvents().catch(err => {
            DebugLogger.warn('bootstrap', '[Analytics] Flush failed:', err);
        });
    }
    
    getSessionStats() {
        return {
            sessionId: this.sessionId,
            duration: Math.floor((Date.now() - this.sessionStartTime) / 1000),
            eventsQueued: this.eventQueue.length,
            fpsAverage: this.getAverageFPS(),
            enabled: this.enabled
        };
    }
    
    // ===== EVENT BUS INTEGRATION =====
    // Merged from AnalyticsSystem - removes unnecessary abstraction layer
    
    /**
     * Connect to EventBus for automatic event tracking
     * @param {EventBus} eventBus - The scene's event bus
     * @param {Scene} scene - The game scene for context
     */
    connectEventBus(eventBus, scene) {
        this.eventBus = eventBus;
        this.scene = scene;
        this.eventBusConnected = !!(eventBus && this.enabled);
        
        if (this.eventBusConnected) {
            this._setupEventListeners();
            DebugLogger.info('general', '[AnalyticsManager] Connected to EventBus - listening for events');
        } else {
            DebugLogger.info('general', '[AnalyticsManager] EventBus connection skipped (analytics disabled or no EventBus)');
        }
    }
    
    _setupEventListeners() {
        // NOTE: Combat events are not whitelisted in EventBus
        // They should be tracked through direct system calls, not events
        // Keeping handlers commented for reference
        
        // Player události - NOT WHITELISTED
        // this.eventBus.on('player.hit', (data) => this._handlePlayerHit(data)); 
        // this.eventBus.on('player.death', (data) => this._handlePlayerDeath(data));
        
        // Enemy události - NOT WHITELISTED
        // this.eventBus.on('npc.spawn', (data) => this._handleEnemySpawn(data));
        // this.eventBus.on('npc.hit', (data) => this._handleEnemyHit(data));
        // this.eventBus.on('npc.death', (data) => this._handleEnemyDeath(data));
        
        // Weapon/projectile události - NOT WHITELISTED
        // this.eventBus.on('weapon.fire', (data) => this._handleWeaponFire(data));
        // this.eventBus.on('projectile.impact', (data) => this._handleProjectileImpact(data));
        
        // Power-up události - NOT WHITELISTED
        // this.eventBus.on('powerup.select', (data) => this._handlePowerUpSelect(data));
        
        // Boss události - NOT WHITELISTED
        // this.eventBus.on('boss.spawn', (data) => this._handleBossSpawn(data));
        // this.eventBus.on('boss.phase', (data) => this._handleBossPhase(data));
        // this.eventBus.on('boss.action', (data) => this._handleBossAction(data));
        // this.eventBus.on('boss.defeat', (data) => this._handleBossDefeat(data));
        
        // Drop události - NOT WHITELISTED (except special drop)
        // this.eventBus.on('drop.pickup', (data) => this._handleDropPickup(data));
        this.eventBus.on('drop.metotrexat.pickup', (data) => this._handleSpecialDropPickup(data));
        
        // Game události - NOT WHITELISTED (except game.over which is whitelisted)
        // this.eventBus.on('game.levelup', (data) => this._handleLevelUp(data));
        this.eventBus.on('game.over', (data) => this._handleGameOver(data));
    }
    
    // Event handlers - integrated from AnalyticsSystem
    
    _handlePlayerHit(data) {
        if (!this.eventBusConnected) return;
        if (this.trackDamageTaken && data.damage) {
            this.trackDamageTaken(
                data.damage, 
                data.source || 'unknown', 
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handlePlayerDeath(data) {
        if (!this.eventBusConnected) return;
        if (this.trackPlayerDeath) {
            this.trackPlayerDeath(
                data.cause || 'unknown',
                this.scene.gameStats?.level || 1,
                this.scene.gameStats?.time || 0
            );
        }
    }
    
    _handleEnemySpawn(data) {
        if (!this.eventBusConnected) return;
        if (this.trackEnemySpawn && data.enemyType) {
            this.trackEnemySpawn(data.enemyType);
        }
    }
    
    _handleEnemyHit(data) {
        if (!this.eventBusConnected) return;
        if (this.trackDamageDealt && data.damage && data.enemyType) {
            this.trackDamageDealt(data.damage, data.enemyType);
        }
    }
    
    _handleEnemyDeath(data) {
        if (!this.eventBusConnected) return;
        if (this.trackEnemyDeath && data.enemyType) {
            this.trackEnemyDeath(
                data.enemyType,
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handleWeaponFire(data) {
        if (!this.eventBusConnected) return;
        if (this.trackWeaponFire) {
            this.trackWeaponFire(
                data.weaponType || 'basic',
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handleProjectileImpact(data) {
        if (!this.eventBusConnected) return;
        if (this.trackProjectileHit) {
            this.trackProjectileHit(
                data.projectileType || 'basic',
                data.damage || 0
            );
        }
    }
    
    _handlePowerUpSelect(data) {
        if (!this.eventBusConnected) return;
        if (this.trackPowerUpSelection && data.powerUpName) {
            this.trackPowerUpSelection(
                data.powerUpName,
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handleBossSpawn(data) {
        if (!this.eventBusConnected) return;
        if (this.trackBossEncounter && data.bossName) {
            this.trackBossEncounter(
                data.bossName,
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handleBossPhase(data) {
        if (!this.eventBusConnected) return;
        if (this.setBossPhase && data.phase) {
            this.setBossPhase(data.phase);
        }
    }
    
    _handleBossAction(data) {
        if (!this.eventBusConnected) return;
        if (this.trackBossAction && data.action) {
            this.trackBossAction(data.action);
        }
    }
    
    _handleBossDefeat(data) {
        if (!this.eventBusConnected) return;
        if (this.trackBossDefeat && data.bossName) {
            this.trackBossDefeat(
                data.bossName,
                data.timeToKill || 0,
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handleDropPickup(data) {
        if (!this.eventBusConnected) return;
        if (this.trackItemPickup) {
            this.trackItemPickup(
                data.itemType || 'xp',
                data.value || 1
            );
        }
    }
    
    _handleSpecialDropPickup(data) {
        if (!this.eventBusConnected) return;
        if (this.trackSpecialDrop) {
            this.trackSpecialDrop(
                'metotrexat',
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handleLevelUp(data) {
        if (!this.eventBusConnected) return;
        if (this.trackLevelUp) {
            this.trackLevelUp(
                data.newLevel || this.scene.gameStats?.level,
                data.timeToLevel || 0
            );
        }
    }
    
    _handleGameOver(data) {
        if (!this.eventBusConnected) return;
        if (this.trackGameOver) {
            this.trackGameOver(
                this.scene.gameStats?.level || 1,
                this.scene.gameStats?.time || 0,
                data.cause || 'unknown'
            );
        }
    }
    
    /**
     * Disconnect from EventBus and cleanup listeners
     */
    disconnectEventBus() {
        if (this.eventBus && this.eventBusConnected) {
            const events = [
                'player.hit', 'player.death',
                'npc.spawn', 'npc.hit', 'npc.death',
                'weapon.fire', 'projectile.impact',
                'powerup.select',
                'boss.spawn', 'boss.phase', 'boss.action', 'boss.defeat',
                'drop.pickup', 'drop.metotrexat.pickup',
                'game.levelup', 'game.over'
            ];
            
            events.forEach(event => {
                this.eventBus.off(event);
            });
            
            this.eventBusConnected = false;
            DebugLogger.info('general', '[AnalyticsManager] Disconnected from EventBus');
        }
    }
}