/**
 * AnalyticsManager - Orchestrator for analytics data
 * PR7 kompatibilni - delegates to PerformanceMonitor, EventQueue,
 * BossEncounterTracker, and SessionPersistence.
 */
import { getCachedVersion } from '../utils/version.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
import { PerformanceMonitor } from './analytics/PerformanceMonitor.js';
import { EventQueue } from './analytics/EventQueue.js';
import { BossEncounterTracker } from './analytics/BossEncounterTracker.js';
import { SessionPersistence } from './analytics/SessionPersistence.js';

const _int = (v, fallback = 0) => Math.floor(Number(v) || fallback);

export class AnalyticsManager {
    constructor(supabase, settings = {}) {
        this.supabase = supabase;
        this.enabled = settings.allowAnalytics !== false && !!supabase;
        this.sessionId = this.generateSessionId();
        this.sessionStartTime = Date.now();
        if (!this.enabled) {
            DebugLogger.info('general', '📊 Analytics disabled', !supabase ? '(no Supabase)' : '(user settings)');
            this.sessionData = {};
            this.fpsHistory = [];
            return;
        }
        this.sessionData = {
            session_id: this.sessionId, player_name: null,
            browser: this.getBrowserInfo(), user_agent: navigator.userAgent,
            screen_width: screen.width, screen_height: screen.height,
            game_version: getCachedVersion(),
            connection_type: this.supabase ? 'supabase' : 'local'
        };
        // Sub-components
        this._eventQueue = new EventQueue({
            supabase, getSessionId: () => this.sessionId,
            isSessionReady: () => this.sessionCreated,
            ensureSession: () => this.createInitialSession(),
            onLatencyMeasured: (ms) => { this._perfMonitor.lastUploadLatencyMs = ms; }
        });
        this._eventQueue.startFlushTimer();
        this._perfMonitor = new PerformanceMonitor({
            getSessionId: () => this.sessionId,
            queueEvent: (t, d) => this.queueEvent(t, d), supabase
        });
        this._perfMonitor.start();
        this._bossTracker = new BossEncounterTracker({
            getSessionId: () => this.sessionId,
            queueEvent: (t, d) => this.queueEvent(t, d)
        });
        this._sessionPersistence = new SessionPersistence({ supabase });
        this.fpsHistory = this._perfMonitor.fpsHistory;
        DebugLogger.info('general', '📊 Analytics initialized:', this.sessionId);
        this.createInitialSession();
    }

    // --- Session creation (delegated) ---
    get sessionCreated() { return this._sessionPersistence?.sessionCreated ?? false; }
    async createInitialSession() {
        if (this.enabled) await this._sessionPersistence?.createInitialSession(this.sessionData);
    }
    generateSessionId() { return Date.now() + '_' + Math.random().toString(36).substr(2, 9); }
    getBrowserInfo() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
        if (ua.includes('Edge')) return 'Edge';
        return 'Unknown';
    }

    // --- Session start / end ---
    async startSession(playerName = null) {
        if (!this.enabled) return;
        const CR = window.ConfigResolver;
        const nameLimit = CR?.get('analytics.limits.playerName', { defaultValue: 12 }) || 12;
        this.sessionData.player_name = playerName ? String(playerName).substring(0, nameLimit) : null;
        this.sessionData.started_at = new Date().toISOString();
        await this.uploadSessionData({
            ...this.sessionData,
            final_score: 0, final_level: 1, total_damage_dealt: 0, total_damage_taken: 0,
            enemies_killed: 0, bosses_defeated: [], xp_collected: 0, health_pickups: 0,
            power_ups_collected: 0, fps_average: 60
        });
    }

    async endSession(gameStats) {
        if (!this.enabled) return;
        const duration = _int((Date.now() - this.sessionStartTime) / 1000);
        const sessionUpdate = {
            ended_at: new Date().toISOString(), duration,
            final_score: _int(gameStats.score), final_level: _int(gameStats.level, 1),
            total_damage_dealt: _int(gameStats.totalDamageDealt),
            total_damage_taken: _int(gameStats.totalDamageTaken),
            enemies_killed: _int(gameStats.enemiesKilled),
            bosses_defeated: gameStats.bossesDefeatedList || [],
            xp_collected: _int(gameStats.xpCollected),
            health_pickups: _int(gameStats.healthPickups),
            power_ups_collected: _int(gameStats.powerUpsCollected),
            fps_average: this.getAverageFPS(),
            death_cause: this.sessionData?.death_cause ?? null,
            death_position_x: this.sessionData?.death_position_x ?? null,
            death_position_y: this.sessionData?.death_position_y ?? null
        };
        if (this.supabase) this.queueEvent('performance_metrics', this._perfMonitor.buildSummaryPayload());
        await this.updateSessionData(sessionUpdate);
    }

    // --- Event tracking ---
    sanitizeEnemyType(rawType) {
        if (!rawType) return 'unknown';
        let t = String(rawType).toLowerCase();
        try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
        if (t.startsWith('boss:')) t = 'boss:' + t.slice(5).replace(/[^a-z0-9]+/g, '-');
        t = t.replace(/[^a-z0-9:]+/g, '-').replace(/-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
        if (!t || t === 'boss:') return 'unknown';
        return t.length > 50 ? t.slice(0, 50) : t;
    }

    trackEnemyKill(enemyType, level, damage) {
        if (!this.enabled || !enemyType) return;
        this.queueEvent('enemy_stats', {
            session_id: this.sessionId, enemy_type: this.sanitizeEnemyType(enemyType),
            enemy_level: _int(level, 1), killed_count: 1, damage_taken_from_player: _int(damage)
        });
    }
    trackEnemySpawn(enemyType, level) {
        if (!this.enabled || !enemyType) return;
        this.queueEvent('enemy_stats', {
            session_id: this.sessionId, enemy_type: this.sanitizeEnemyType(enemyType),
            enemy_level: _int(level, 1), spawn_count: 1
        });
    }
    trackDamageDealt(amount, targetType) {
        if (!this.enabled) return;
        if (!this.sessionData.damage_by_target) this.sessionData.damage_by_target = {};
        this.sessionData.damage_by_target[targetType] = (this.sessionData.damage_by_target[targetType] || 0) + amount;
    }
    trackDamageTaken(amount, sourceType, sourceLevel = null) {
        if (!this.enabled || !sourceType) return;
        this.queueEvent('enemy_stats', {
            session_id: this.sessionId, enemy_type: this.sanitizeEnemyType(sourceType),
            enemy_level: _int(sourceLevel, 1), damage_dealt_to_player: _int(amount)
        });
    }

    trackPowerUpOffered(options, level, playerHP, enemiesOnScreen) {
        if (!this.enabled) return;
        const shared = {
            session_id: this.sessionId, event_type: 'offered',
            level_selected: _int(level, 1),
            options_offered: options.map(p => String(p.name || 'unknown')),
            player_hp_at_selection: _int(playerHP), enemies_on_screen: _int(enemiesOnScreen)
        };
        options.forEach(pu => {
            this.queueEvent('powerup_events', {
                ...shared, powerup_name: String(pu.name || 'unknown'),
                current_tier: _int((pu.level || 0) + 1)
            });
        });
    }
    trackPowerUpSelected(powerupName, options, level, playerHP, enemiesOnScreen) {
        if (!this.enabled) return;
        let currentTier = 1;
        try {
            const sel = (options || []).find(p => String(p.name || 'unknown') === String(powerupName || 'unknown'));
            currentTier = _int(sel?.level, 1);
        } catch (_) {}
        this.queueEvent('powerup_events', {
            session_id: this.sessionId, event_type: 'selected',
            powerup_name: String(powerupName || 'unknown'), level_selected: _int(level, 1),
            current_tier: currentTier,
            options_offered: options.map(p => String(p.name || 'unknown')),
            player_hp_at_selection: _int(playerHP), enemies_on_screen: _int(enemiesOnScreen)
        });
    }

    // --- Boss tracking (delegated) ---
    get currentBossEncounter() { return this._bossTracker?.current ?? null; }
    trackBossEncounter(bossName, level, hpStart = null) { if (this.enabled) this._bossTracker?.start(bossName, level, hpStart); }
    trackBossAction(action, phase) { if (this.enabled) this._bossTracker?.trackAction(action, phase); }
    trackBossDefeat(playerHP) { if (this.enabled) this._bossTracker?.defeat(playerHP); }
    abortBossEncounter(playerHP) { if (this.enabled) this._bossTracker?.abort(playerHP); }
    recordBossDamageDealt(amount) { if (this.enabled) this._bossTracker?.recordDamageDealt(amount); }
    recordBossDamageTaken(amount) { if (this.enabled) this._bossTracker?.recordDamageTaken(amount); }
    incrementBossSpecialAttacksUsed() { if (this.enabled) this._bossTracker?.incrementSpecialAttacks(); }
    setBossPhase(phaseCode) { if (this.enabled) this._bossTracker?.setPhase(phaseCode); }

    // --- Player death ---
    trackPlayerDeath(cause, position, gameStats, context = {}) {
        if (!this.enabled) return;
        const pos = position || { x: 0, y: 0 };
        const gs = gameStats || {};
        const c = cause || { type: 'unknown', damage: 0 };
        const killerType = String(c.type || 'unknown');
        const killerDmg = _int(c.damage);
        this.queueEvent('death_events', {
            session_id: this.sessionId,
            player_name: String(this.sessionData.player_name || 'anonymous'),
            level: _int(gs.level, 1), score: _int(gs.score),
            survival_time: _int((Date.now() - this.sessionStartTime) / 1000),
            killer_type: killerType, killer_damage: killerDmg,
            overkill_damage: _int(Math.max(0, killerDmg - _int(context.playerHP))),
            player_hp_before: _int(context.playerHP), player_max_hp: _int(context.playerMaxHP, 100),
            position_x: _int(pos.x), position_y: _int(pos.y),
            active_power_ups: context.activePowerUps || [],
            enemies_on_screen: _int(context.enemiesOnScreen),
            projectiles_on_screen: _int(context.projectilesOnScreen),
            was_boss_fight: context.wasBossFight || false
        });
        this.sessionData.death_cause = killerType;
        this.sessionData.death_position_x = _int(pos.x);
        this.sessionData.death_position_y = _int(pos.y);
        try {
            const isBoss = killerType.startsWith('boss:');
            const isProj = killerType === 'projectile' || killerType.startsWith('projectile');
            if (!isBoss && !isProj && killerType !== 'unknown') {
                this.queueEvent('enemy_stats', {
                    session_id: this.sessionId, enemy_type: this.sanitizeEnemyType(killerType),
                    enemy_level: _int(gs.level, 1), player_deaths_caused: 1
                });
            }
        } catch (_) {}
    }

    // --- Delegated: Performance ---
    getAverageFPS() { return this._perfMonitor ? this._perfMonitor.getAverageFPS() : 60; }
    getFPSStats() { return this._perfMonitor ? this._perfMonitor.getFPSStats() : { min: 60, max: 60, avg: 60, drops: 0 }; }
    trackPerformanceIssue(type, details) { this._perfMonitor?.trackPerformanceIssue(type, details); }

    // --- Delegated: Event Queue ---
    queueEvent(table, data) { this._eventQueue?.queueEvent(table, data); }
    async flushEvents() { if (this._eventQueue) await this._eventQueue.flushEvents(); }
    get eventQueue() { return this._eventQueue ? this._eventQueue.queue : []; }
    set eventQueue(val) { if (this._eventQueue) this._eventQueue.queue = val; }

    // --- Lifecycle ---
    shutdown() { this.destroy(); }
    destroy() {
        this._eventQueue?.shutdown();
        this._perfMonitor?.shutdown();
        this.enabled = false;
    }

    // --- Session persistence (delegated) ---
    async uploadSessionData(data) { if (this.enabled) await this._sessionPersistence?.uploadSessionData(data); }
    async updateSessionData(update) { if (this.enabled) await this._sessionPersistence?.updateSessionData(this.sessionId, update); }

    // --- User controls ---
    disable() { this.enabled = false; this.eventQueue = []; }
    enable() { this.enabled = true; }

    // --- Public API ---
    trackEvent(name, payload = {}) {
        if (!this.enabled) return;
        try {
            switch (name) {
                case 'enemy_killed':
                    if (payload.enemy_type) this.trackEnemyKill(payload.enemy_type, payload.level || 1, payload.damage || 0);
                    break;
                case 'enemy_spawned':
                    if (payload.enemy_type) this.trackEnemySpawn(payload.enemy_type, payload.level || 1);
                    break;
                case 'level_complete': case 'game_over': case 'level_start': case 'level_up':
                    this.queueEvent('game_events', { type: name, ...payload, timestamp: Date.now() });
                    break;
                default:
                    DebugLogger.debug('analytics', `[Analytics] Unhandled event: ${name}`);
            }
        } catch (error) {
            DebugLogger.warn('bootstrap', '[Analytics] Failed to track event:', name, error);
        }
    }

    flush() {
        if (!this.enabled) return Promise.resolve();
        return this.flushEvents().catch(err => DebugLogger.warn('bootstrap', '[Analytics] Flush failed:', err));
    }
    getSessionStats() {
        return {
            sessionId: this.sessionId,
            duration: _int((Date.now() - this.sessionStartTime) / 1000),
            eventsQueued: this.eventQueue.length,
            fpsAverage: this.getAverageFPS(),
            enabled: this.enabled
        };
    }

    // --- EventBus integration ---
    connectEventBus(eventBus, scene) {
        this.eventBus = eventBus;
        this.scene = scene;
        this.eventBusConnected = !!(eventBus && this.enabled);
        if (this.eventBusConnected) {
            // Store handler references for proper removal in disconnectEventBus
            this._onMetotrexat = (d) => this._handleSpecialDropPickup(d);
            this._onGameOver = (d) => this._handleGameOver(d);
            this.eventBus.on('drop.metotrexat.pickup', this._onMetotrexat);
            this.eventBus.on('game.over', this._onGameOver);
            DebugLogger.info('general', '[AnalyticsManager] Connected to EventBus');
        }
    }
    _handleSpecialDropPickup(_data) { /* reserved */ }
    _handleGameOver(_data) { /* reserved */ }

    disconnectEventBus() {
        if (this.eventBus && this.eventBusConnected) {
            // Remove only the handlers we actually registered (with stored references)
            if (this._onMetotrexat) this.eventBus.off('drop.metotrexat.pickup', this._onMetotrexat);
            if (this._onGameOver) this.eventBus.off('game.over', this._onGameOver);
            this._onMetotrexat = null;
            this._onGameOver = null;
            this.eventBusConnected = false;
        }
    }
}
