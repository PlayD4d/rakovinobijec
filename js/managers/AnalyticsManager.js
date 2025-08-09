export class AnalyticsManager {
    constructor(supabase, settings = {}) {
        this.supabase = supabase;
        this.enabled = settings.allowAnalytics !== false; // Default true
        
        if (!this.enabled) {
            console.log('📊 Analytics disabled by user settings');
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
            game_version: '0.1.2',
            connection_type: this.supabase ? 'supabase' : 'local'
        };
        
        // Event queue pro batch upload
        this.eventQueue = [];
        this.flushInterval = 30000; // 30 sekund
        this.startFlushTimer();
        
        // Performance monitoring
        this.fpsHistory = [];
        this.startPerformanceMonitoring();
        
        console.log('📊 Analytics initialized:', this.sessionId);
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
    
    startSession(playerName = null) {
        if (!this.enabled) return;
        
        this.sessionData.player_name = playerName;
        this.sessionData.started_at = new Date().toISOString();
        
        console.log('📊 Session started:', this.sessionId);
    }
    
    async endSession(gameStats) {
        if (!this.enabled) return;
        
        const endTime = Date.now();
        const duration = Math.floor((endTime - this.sessionStartTime) / 1000);
        
        const sessionEnd = {
            ...this.sessionData,
            ended_at: new Date().toISOString(),
            duration: duration,
            final_score: gameStats.score || 0,
            final_level: gameStats.level || 1,
            total_damage_dealt: gameStats.totalDamageDealt || 0,
            total_damage_taken: gameStats.totalDamageTaken || 0,
            enemies_killed: gameStats.enemiesKilled || 0,
            bosses_defeated: gameStats.bossesDefeated || [],
            xp_collected: gameStats.xpCollected || 0,
            health_pickups: gameStats.healthPickups || 0,
            power_ups_collected: gameStats.powerUpsCollected || 0,
            fps_average: this.getAverageFPS()
        };
        
        await this.uploadSessionData(sessionEnd);
        console.log('📊 Session ended:', duration, 'seconds');
    }
    
    // ===== EVENT TRACKING =====
    
    trackEnemyKill(enemyType, level, damage) {
        if (!this.enabled) return;
        
        // Validace - neposlat NULL hodnoty
        if (!enemyType) {
            console.warn('⚠️ Analytics: enemyType is null/undefined, skipping trackEnemyKill');
            return;
        }
        
        this.queueEvent('enemy_stats', {
            session_id: this.sessionId,
            enemy_type: String(enemyType),
            enemy_level: level || 1,
            killed_count: 1,
            damage_taken_from_player: damage || 0
        });
    }
    
    trackEnemySpawn(enemyType, level) {
        if (!this.enabled) return;
        
        // Validace - neposlat NULL hodnoty
        if (!enemyType) {
            console.warn('⚠️ Analytics: enemyType is null/undefined, skipping trackEnemySpawn');
            return;
        }
        
        this.queueEvent('enemy_stats', {
            session_id: this.sessionId,
            enemy_type: String(enemyType),
            enemy_level: level || 1,
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
            console.warn('⚠️ Analytics: sourceType is null/undefined, skipping trackDamageTaken');
            return;
        }
        
        this.queueEvent('enemy_stats', {
            session_id: this.sessionId,
            enemy_type: String(sourceType),
            enemy_level: sourceLevel || 1,
            damage_dealt_to_player: amount || 0
        });
    }
    
    trackPowerUpOffered(options, level, playerHP, enemiesOnScreen) {
        if (!this.enabled) return;
        
        options.forEach(powerup => {
            this.queueEvent('powerup_events', {
                session_id: this.sessionId,
                event_type: 'offered',
                powerup_name: powerup.name,
                level_selected: level,
                options_offered: options.map(p => p.name),
                player_hp_at_selection: playerHP,
                enemies_on_screen: enemiesOnScreen
            });
        });
    }
    
    trackPowerUpSelected(powerupName, options, level, playerHP, enemiesOnScreen) {
        if (!this.enabled) return;
        
        this.queueEvent('powerup_events', {
            session_id: this.sessionId,
            event_type: 'selected',
            powerup_name: powerupName,
            level_selected: level,
            options_offered: options.map(p => p.name),
            player_hp_at_selection: playerHP,
            enemies_on_screen: enemiesOnScreen
        });
    }
    
    trackBossEncounter(bossName, level) {
        if (!this.enabled) return;
        
        this.currentBossEncounter = {
            session_id: this.sessionId,
            boss_name: bossName,
            boss_level: level,
            start_time: Date.now(),
            damage_dealt_to_boss: 0,
            damage_taken_from_boss: 0,
            special_attacks_used: 0
        };
    }
    
    trackBossDefeat(playerHP) {
        if (!this.enabled || !this.currentBossEncounter) return;
        
        const encounter = {
            ...this.currentBossEncounter,
            defeated: true,
            fight_duration: Math.floor((Date.now() - this.currentBossEncounter.start_time) / 1000),
            player_hp_end: playerHP
        };
        
        this.queueEvent('boss_encounters', encounter);
        this.currentBossEncounter = null;
    }
    
    trackPlayerDeath(cause, position, gameStats, context = {}) {
        if (!this.enabled) return;
        
        const deathEvent = {
            session_id: this.sessionId,
            player_name: this.sessionData.player_name,
            level: gameStats.level,
            score: gameStats.score,
            survival_time: Math.floor((Date.now() - this.sessionStartTime) / 1000),
            
            killer_type: cause.type, // 'enemy:green', 'boss:metastaza', etc.
            killer_damage: cause.damage || 0,
            overkill_damage: Math.max(0, (cause.damage || 0) - (context.playerHP || 0)),
            
            player_hp_before: context.playerHP || 0,
            player_max_hp: context.playerMaxHP || 100,
            position_x: Math.floor(position.x),
            position_y: Math.floor(position.y),
            active_power_ups: context.activePowerUps || [],
            
            enemies_on_screen: context.enemiesOnScreen || 0,
            projectiles_on_screen: context.projectilesOnScreen || 0,
            was_boss_fight: context.wasBossFight || false
        };
        
        this.sessionData.death_cause = cause.type;
        this.sessionData.death_position_x = Math.floor(position.x);
        this.sessionData.death_position_y = Math.floor(position.y);
        
        this.queueEvent('death_events', deathEvent);
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
            requestAnimationFrame(trackFPS);
        };
        requestAnimationFrame(trackFPS);
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
        
        setInterval(() => {
            this.flushEvents();
        }, this.flushInterval);
    }
    
    async flushEvents() {
        if (!this.enabled || this.eventQueue.length === 0 || !this.supabase) {
            return;
        }
        
        console.log(`📊 Flushing ${this.eventQueue.length} analytics events...`);
        
        // Group events by table
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
                const { error } = await this.supabase
                    .from(table)
                    .insert(events);
                
                if (error) {
                    console.warn(`❌ Failed to upload ${table}:`, error.message);
                } else {
                    console.log(`✅ Uploaded ${events.length} ${table} events`);
                }
            } catch (error) {
                console.warn(`❌ Failed to upload ${table}:`, error.message);
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
                console.warn('❌ Failed to upload session data:', error.message);
            } else {
                console.log('✅ Session data uploaded successfully');
            }
        } catch (error) {
            console.warn('❌ Failed to upload session data:', error.message);
        }
    }
    
    // ===== USER CONTROLS =====
    
    disable() {
        this.enabled = false;
        this.eventQueue = [];
        console.log('📊 Analytics disabled');
    }
    
    enable() {
        this.enabled = true;
        console.log('📊 Analytics enabled');
    }
    
    // ===== PUBLIC API =====
    
    getSessionStats() {
        return {
            sessionId: this.sessionId,
            duration: Math.floor((Date.now() - this.sessionStartTime) / 1000),
            eventsQueued: this.eventQueue.length,
            fpsAverage: this.getAverageFPS(),
            enabled: this.enabled
        };
    }
}