/**
 * TelemetryLogger.js - Herní telemetrie pro balance analýzu
 * 
 * Loguje gameplay eventy do JSON souborů pro následnou analýzu.
 * Optimalizováno pro minimální výkonový dopad.
 */

export class TelemetryLogger {
    constructor(gameScene) {
        this.gameScene = gameScene;
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.gameStartTime = 0;
        this.isEnabled = false;
        
        // Event buffers for performance optimization
        this.eventBuffer = [];
        this.bufferSize = 100; // Flush every 100 events
        this.lastFlush = Date.now();
        this.flushInterval = 10000; // Force flush every 10 seconds
        
        // Tracking data for calculations
        this.spawnTimes = new Map(); // enemyId -> spawnTime for TTK calculation
        this.damageStats = {
            playerDamageDealt: 0,
            playerDamageTaken: 0,
            lastUpdate: 0,
            samples: []
        };
        
        // Session counters
        this.counters = {
            spawns: { enemy: 0, miniboss: 0, boss: 0, unique: 0 },
            kills: { enemy: 0, miniboss: 0, boss: 0, unique: 0 },
            loot: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
            ttkSamples: [],
            sessionStart: null,
            ngPlusLevel: 0
        };
        
        this.initialize();
    }

    initialize() {
        // Check if telemetry is enabled via ConfigResolver
        const ConfigResolver = this.gameScene.configResolver || window.ConfigResolver;
        this.isEnabled = ConfigResolver?.get('features.telemetryLogger', { defaultValue: false }) || false;
        
        if (!this.isEnabled) {
            console.log('📊 TelemetryLogger: Disabled via feature flag');
            return;
        }
        
        console.log(`📊 TelemetryLogger: Starting session ${this.sessionId}`);
        
        // Initialize session
        this.gameStartTime = Date.now();
        this.counters.sessionStart = this.gameStartTime;
        this.counters.ngPlusLevel = this.gameScene.ngPlusLevel || 0;
        
        // Log session start event
        this.logEvent('SessionStart', {
            sessionId: this.sessionId,
            timestamp: this.gameStartTime,
            ngPlusLevel: this.counters.ngPlusLevel,
            gameVersion: this.gameScene.game.config.version || '0.2.0'
        });
        
        // Setup periodic damage stats logging
        this.setupPeriodicLogging();
        
        // Setup automatic flushing
        this.setupAutoFlush();
        
        // Expose to debug API
        this.exposeDebugAPI();
    }

    generateSessionId() {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const random = Math.random().toString(36).substr(2, 4);
        return `session_${timestamp}_${random}`;
    }

    setupPeriodicLogging() {
        // Log damage stats every 30 seconds
        this.damageStatsTimer = setInterval(() => {
            if (this.isEnabled) {
                this.logDamageStats();
                this.logPlayerProgress();
            }
        }, 30000);
    }

    setupAutoFlush() {
        // Auto-flush buffer periodically
        this.autoFlushTimer = setInterval(() => {
            if (this.isEnabled && this.eventBuffer.length > 0) {
                this.flushBuffer();
            }
        }, this.flushInterval);
    }

    getGameTime() {
        return Math.round((Date.now() - this.gameStartTime) / 1000);
    }

    // Core logging method
    logEvent(eventType, eventData) {
        if (!this.isEnabled) return;
        
        const event = {
            type: eventType,
            gameTime: this.getGameTime(),
            timestamp: Date.now(),
            sessionId: this.sessionId,
            ...eventData
        };
        
        this.eventBuffer.push(event);
        
        // Auto-flush if buffer is full
        if (this.eventBuffer.length >= this.bufferSize) {
            this.flushBuffer();
        }
    }

    // 1. SpawnEvent
    logSpawn(entityType, entityId, position = null) {
        const spawnTime = this.getGameTime();
        
        // Track spawn time for TTK calculation
        const trackingId = `${entityId}_${spawnTime}_${Math.random().toString(36).substr(2, 4)}`;
        this.spawnTimes.set(trackingId, spawnTime);
        
        // Update counters
        this.counters.spawns[entityType] = (this.counters.spawns[entityType] || 0) + 1;
        
        this.logEvent('SpawnEvent', {
            entityType, // enemy, miniboss, boss, unique
            entityId,
            trackingId,
            position,
            spawnCount: this.counters.spawns[entityType]
        });
        
        return trackingId; // Return for kill tracking
    }

    // 2. LootDropEvent
    logLootDrop(dropType, quality, sourceType, sourceId, position = null) {
        // Update counters
        this.counters.loot[quality] = (this.counters.loot[quality] || 0) + 1;
        
        this.logEvent('LootDropEvent', {
            dropType, // XP, health, mutator, research_points, skin_fragment, other
            quality, // common, uncommon, rare, epic, legendary
            sourceType, // enemy, elite, boss, unique
            sourceId,
            position,
            totalDropsByQuality: { ...this.counters.loot }
        });
    }

    // 3. TTKEvent (Time To Kill)
    logKill(trackingId, entityType, entityId) {
        if (!this.spawnTimes.has(trackingId)) {
            // Fallback for entities without proper tracking
            this.counters.kills[entityType] = (this.counters.kills[entityType] || 0) + 1;
            return;
        }
        
        const spawnTime = this.spawnTimes.get(trackingId);
        const killTime = this.getGameTime();
        const ttk = killTime - spawnTime;
        
        // Update counters
        this.counters.kills[entityType] = (this.counters.kills[entityType] || 0) + 1;
        
        // Track TTK samples for averages
        this.counters.ttkSamples.push({ entityType, entityId, ttk, gameTime: killTime });
        
        // Keep only last 100 TTK samples for performance
        if (this.counters.ttkSamples.length > 100) {
            this.counters.ttkSamples = this.counters.ttkSamples.slice(-50);
        }
        
        this.logEvent('TTKEvent', {
            trackingId,
            entityType,
            entityId,
            timeToKill: ttk,
            spawnTime,
            killTime,
            killCount: this.counters.kills[entityType]
        });
        
        // Clean up tracking
        this.spawnTimes.delete(trackingId);
    }

    // 4. DamageStatsEvent
    logDamageStats() {
        const gameTime = this.getGameTime();
        const timeDelta = gameTime - (this.damageStats.lastUpdate || 0);
        
        if (timeDelta <= 0) return;
        
        // Calculate DPS
        const playerDPS = this.damageStats.playerDamageDealt / Math.max(timeDelta, 1);
        const incomingDPS = this.damageStats.playerDamageTaken / Math.max(timeDelta, 1);
        
        // Store sample for averages
        this.damageStats.samples.push({ 
            gameTime, 
            playerDPS, 
            incomingDPS,
            totalDamageDealt: this.damageStats.playerDamageDealt,
            totalDamageTaken: this.damageStats.playerDamageTaken
        });
        
        // Keep only last 20 samples (10 minutes of data)
        if (this.damageStats.samples.length > 20) {
            this.damageStats.samples = this.damageStats.samples.slice(-10);
        }
        
        this.logEvent('DamageStatsEvent', {
            playerDPS: Math.round(playerDPS * 10) / 10,
            incomingDPS: Math.round(incomingDPS * 10) / 10,
            totalDamageDealt: this.damageStats.playerDamageDealt,
            totalDamageTaken: this.damageStats.playerDamageTaken,
            interval: timeDelta
        });
        
        // Reset counters for next interval
        this.damageStats.playerDamageDealt = 0;
        this.damageStats.playerDamageTaken = 0;
        this.damageStats.lastUpdate = gameTime;
    }

    // Track damage for DPS calculation
    recordPlayerDamage(amount) {
        if (this.isEnabled) {
            this.damageStats.playerDamageDealt += amount;
        }
    }

    recordPlayerDamageTaken(amount) {
        if (this.isEnabled) {
            this.damageStats.playerDamageTaken += amount;
        }
    }

    // 5. PlayerProgressEvent
    logPlayerProgress() {
        const player = this.gameScene.player;
        if (!player) return;
        
        // Get active power-ups/mutators
        const activePowerups = [];
        if (this.gameScene.powerUpSystem?.getActivePowerUps) {
            const powerups = this.gameScene.powerUpSystem.getActivePowerUps();
            powerups.forEach(powerup => {
                activePowerups.push({
                    id: powerup.id || 'unknown',
                    level: powerup.level || 1,
                    timeRemaining: powerup.timeRemaining || null
                });
            });
        }
        
        this.logEvent('PlayerProgressEvent', {
            playerXP: player.xp || 0,
            playerLevel: player.level || 1,
            playerHP: player.hp || player.maxHP || 100,
            playerMaxHP: player.maxHP || 100,
            activePowerups,
            totalEnemiesKilled: Object.values(this.counters.kills).reduce((a, b) => a + b, 0),
            currentStage: this.gameScene.currentStage || 1
        });
    }

    // 6. SessionSummaryEvent
    logSessionSummary(reason = 'game_over') {
        if (!this.isEnabled) return;
        
        const sessionDuration = this.getGameTime();
        const totalEnemiesKilled = Object.values(this.counters.kills).reduce((a, b) => a + b, 0);
        
        // Calculate average TTK by enemy type
        const avgTTK = {};
        const ttkByType = {};
        
        this.counters.ttkSamples.forEach(sample => {
            if (!ttkByType[sample.entityType]) {
                ttkByType[sample.entityType] = [];
            }
            ttkByType[sample.entityType].push(sample.ttk);
        });
        
        Object.keys(ttkByType).forEach(type => {
            const samples = ttkByType[type];
            avgTTK[type] = Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 100) / 100;
        });
        
        this.logEvent('SessionSummaryEvent', {
            reason,
            sessionDuration,
            reachedStage: this.gameScene.currentStage || 1,
            ngPlusLevel: this.counters.ngPlusLevel,
            totalEnemiesKilled,
            killsByType: { ...this.counters.kills },
            spawnsByType: { ...this.counters.spawns },
            lootByRarity: { ...this.counters.loot },
            averageTTK: avgTTK,
            finalPlayerLevel: this.gameScene.player?.level || 1,
            finalPlayerXP: this.gameScene.player?.xp || 0,
            totalDamageDealt: this.damageStats.samples.reduce((sum, s) => sum + s.totalDamageDealt, 0),
            totalDamageTaken: this.damageStats.samples.reduce((sum, s) => sum + s.totalDamageTaken, 0)
        });
        
        // Force final flush
        this.flushBuffer();
        
        console.log(`📊 TelemetryLogger: Session ${this.sessionId} completed (${sessionDuration}s)`);
    }

    // Buffer management
    flushBuffer() {
        if (!this.isEnabled || this.eventBuffer.length === 0) return;
        
        try {
            // In browser environment, we'll store in localStorage with fallback
            const logData = {
                sessionId: this.sessionId,
                events: [...this.eventBuffer],
                flushTime: Date.now()
            };
            
            // Store in localStorage (browser) or attempt file write (if available)
            this.writeLogData(logData);
            
            // Clear buffer
            this.eventBuffer = [];
            this.lastFlush = Date.now();
            
        } catch (error) {
            console.warn('📊 TelemetryLogger: Failed to flush buffer:', error);
        }
    }

    writeLogData(logData) {
        // Browser environment - use localStorage with rotation
        const storageKey = `telemetry_${this.sessionId}`;
        const logString = JSON.stringify(logData, null, 2);
        
        try {
            localStorage.setItem(storageKey, logString);
            
            // Rotate old logs (keep only last 5 sessions)
            this.rotateStoredLogs();
            
        } catch (error) {
            console.warn('📊 TelemetryLogger: localStorage write failed:', error);
            
            // Fallback: offer download
            this.offerLogDownload(logData);
        }
    }

    rotateStoredLogs() {
        const telemetryKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('telemetry_session_')) {
                telemetryKeys.push(key);
            }
        }
        
        // Sort by timestamp and keep only latest 5
        telemetryKeys.sort().reverse();
        if (telemetryKeys.length > 5) {
            telemetryKeys.slice(5).forEach(key => {
                localStorage.removeItem(key);
            });
        }
    }

    offerLogDownload(logData) {
        // Create downloadable JSON file
        const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.sessionId}.json`;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        console.log(`📊 TelemetryLogger: Log downloaded as ${this.sessionId}.json`);
    }

    // Analytics methods for real-time monitoring
    getRealtimeStats() {
        const gameTime = this.getGameTime();
        const recentTTK = this.counters.ttkSamples
            .filter(sample => gameTime - sample.gameTime <= 60) // Last minute
            .map(sample => sample.ttk);
        
        const avgRecentTTK = recentTTK.length > 0 
            ? Math.round((recentTTK.reduce((a, b) => a + b, 0) / recentTTK.length) * 100) / 100 
            : 0;
        
        return {
            gameTime,
            totalSpawns: Object.values(this.counters.spawns).reduce((a, b) => a + b, 0),
            totalKills: Object.values(this.counters.kills).reduce((a, b) => a + b, 0),
            totalLoot: Object.values(this.counters.loot).reduce((a, b) => a + b, 0),
            avgTTKLastMinute: avgRecentTTK,
            spawnsByType: { ...this.counters.spawns },
            killsByType: { ...this.counters.kills },
            lootByRarity: { ...this.counters.loot },
            bufferedEvents: this.eventBuffer.length
        };
    }

    // Debug API exposure
    exposeDebugAPI() {
        if (typeof window !== 'undefined') {
            window.__phase5Debug = window.__phase5Debug || {};
            window.__phase5Debug.telemetry = {
                dump: () => this.dumpLogs(),
                clear: () => this.clearBuffer(),
                status: () => this.getStatus(),
                stats: () => this.getRealtimeStats(),
                export: () => this.exportSessionData()
            };
        }
    }

    dumpLogs() {
        this.flushBuffer();
        console.log(`📊 TelemetryLogger: Dumped ${this.eventBuffer.length} events for session ${this.sessionId}`);
    }

    clearBuffer() {
        const cleared = this.eventBuffer.length;
        this.eventBuffer = [];
        console.log(`📊 TelemetryLogger: Cleared ${cleared} buffered events`);
        return cleared;
    }

    getStatus() {
        return {
            sessionId: this.sessionId,
            enabled: this.isEnabled,
            gameTime: this.getGameTime(),
            bufferedEvents: this.eventBuffer.length,
            totalEvents: this.counters,
            lastFlush: new Date(this.lastFlush).toISOString()
        };
    }

    exportSessionData() {
        const sessionData = {
            sessionId: this.sessionId,
            startTime: this.gameStartTime,
            currentGameTime: this.getGameTime(),
            counters: this.counters,
            realtimeStats: this.getRealtimeStats(),
            bufferedEvents: this.eventBuffer,
            damageStatsSamples: this.damageStats.samples
        };
        
        this.offerLogDownload({ sessionData, events: this.eventBuffer });
        return sessionData;
    }

    // Cleanup
    destroy() {
        if (this.damageStatsTimer) {
            clearInterval(this.damageStatsTimer);
        }
        if (this.autoFlushTimer) {
            clearInterval(this.autoFlushTimer);
        }
        
        // Final session summary
        this.logSessionSummary('session_ended');
        
        console.log(`📊 TelemetryLogger: Session ${this.sessionId} destroyed`);
    }
}