/**
 * SessionLog — Structured game session logging for debugging
 * Logs key events: spawns, kills, damage, powerups, transitions, errors
 * Stores last 3 sessions in localStorage as JSON
 * Access: DEV.sessions() / DEV.exportSession()
 */

const MAX_SESSIONS = 3;
const STORAGE_KEY = 'rakovinobijec_sessions';

class SessionLog {
    // Events that fire 10-50×/sec — aggregated into 1-second buckets
    static AGGREGATE_EVENTS = new Set([
        'xp:add',
        'dmg:hit',
        'combat:player_hit_enemy',
        'combat:radiotherapy_hit',
        'combat:chain_lightning_hit',
        'combat:flamethrower_hit',
        'combat:chemo_cloud_hit',
    ]);

    constructor() {
        this.events = [];
        this.startTime = Date.now();
        this.sessionId = `s_${Date.now().toString(36)}`;
        this.meta = {
            version: null,
            startedAt: new Date().toISOString(),
            endedAt: null,
            result: null // 'death', 'victory', 'quit'
        };
        this._enabled = true;
    }

    /**
     * Log a game event
     * @param {string} category - Event category (spawn, kill, damage, powerup, transition, error, system)
     * @param {string} action - What happened
     * @param {Object} data - Event data
     */
    log(category, action, data = {}) {
        if (!this._enabled) return;

        // High-frequency events are aggregated per second to reduce memory
        // (xp:add, dmg:hit alone can produce 20+ events/sec)
        const aggKey = `${category}:${action}`;
        if (SessionLog.AGGREGATE_EVENTS.has(aggKey)) {
            return this._logAggregated(category, action, data);
        }

        this.events.push({
            t: Date.now() - this.startTime,
            cat: category,
            act: action,
            ...data
        });
    }

    /**
     * Aggregate high-frequency events into 1-second buckets.
     * Instead of 20 individual "xp:add" events per second, stores one summary.
     */
    _logAggregated(category, action, data) {
        const now = Date.now() - this.startTime;
        const bucket = Math.floor(now / 1000); // 1-second bucket
        const key = `${category}:${action}`;

        if (!this._aggBuckets) this._aggBuckets = new Map();
        const prev = this._aggBuckets.get(key);

        if (prev && prev.bucket === bucket) {
            // Same second — aggregate
            prev.count++;
            if (data.damage || data.amt) prev.totalDmg = (prev.totalDmg || 0) + (data.damage || data.amt || 0);
            if (data.scaled || data.raw) prev.totalXP = (prev.totalXP || 0) + (data.scaled || data.raw || 0);
            if (data.absorbed) prev.totalAbsorbed = (prev.totalAbsorbed || 0) + data.absorbed;
        } else {
            // New second — flush previous bucket and start new
            if (prev) this._flushAggBucket(key, prev);
            this._aggBuckets.set(key, { bucket, t: now, cat: category, act: action, count: 1,
                totalDmg: data.damage || data.amt || 0,
                totalXP: data.scaled || data.raw || 0,
                totalAbsorbed: data.absorbed || 0,
                lastData: data });
        }
    }

    _flushAggBucket(key, agg) {
        const entry = { t: agg.t, cat: agg.cat, act: agg.act, count: agg.count };
        if (agg.totalDmg) entry.totalDmg = agg.totalDmg;
        if (agg.totalXP) entry.totalXP = agg.totalXP;
        if (agg.totalAbsorbed) entry.totalAbsorbed = agg.totalAbsorbed;
        this.events.push(entry);
    }

    /** Flush any remaining aggregation buckets (called before export) */
    flushAll() {
        if (!this._aggBuckets) return;
        for (const [key, agg] of this._aggBuckets) {
            this._flushAggBucket(key, agg);
        }
        this._aggBuckets.clear();
    }

    // Shorthand methods
    spawn(type, id, x, y, extra) { this.log('spawn', type, { id, x: Math.round(x), y: Math.round(y), ...extra }); }
    kill(killerId, targetId, damage, extra) { this.log('kill', 'enemy_died', { killer: killerId, target: targetId, dmg: damage, ...extra }); }
    damage(sourceId, targetId, amount, type) { this.log('dmg', type || 'hit', { src: sourceId, tgt: targetId, amt: Math.round(amount) }); }
    powerup(id, level, action) { this.log('powerup', action || 'applied', { id, level }); }
    transition(from, to, action) { this.log('transition', action, { from, to }); }
    error(msg, context) { this.log('error', msg, context); }

    /**
     * End session and save to localStorage
     */
    end(result = 'unknown') {
        this.flushAll(); // Flush aggregated buckets before saving
        this.meta.endedAt = new Date().toISOString();
        this.meta.result = result;
        this.meta.duration = Date.now() - this.startTime;
        this.meta.eventCount = this.events.length;
        this._save();
        this._sendToTelemetry();
    }

    _save() {
        // Save only compact summary to localStorage (no raw events — those are MB+)
        // Full event data is available via DEV.exportSession() → JSON file → telemetry DB
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            stored.push({
                id: this.sessionId,
                meta: this.meta,
                summary: this._computeSummary()
            });
            while (stored.length > MAX_SESSIONS) stored.shift();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        } catch (e) {
            console.warn('[SessionLog] Failed to save:', e.message);
        }
    }

    _computeSummary() {
        const counts = {};
        for (const e of this.events) {
            const key = `${e.cat}:${e.act}`;
            counts[key] = (counts[key] || 0) + 1;
        }
        return { eventCount: this.events.length, counts };
    }

    /**
     * Send session data to dev server telemetry endpoint.
     * Fires and forgets — no error shown to player if server unavailable.
     */
    _sendToTelemetry() {
        try {
            const payload = JSON.stringify({
                id: this.sessionId,
                meta: this.meta,
                events: this.events
            });
            fetch('/api/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            }).then(r => {
                if (r.ok) console.log(`[SessionLog] Telemetry sent (${this.events.length} events)`);
            }).catch(() => {
                // Dev server not running — silently ignore
            });
        } catch (_) {
            // Ignore errors — telemetry is best-effort
        }
    }

    /**
     * Get all stored sessions
     */
    static getSessions() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    /**
     * Get latest session
     */
    static getLatest() {
        const sessions = SessionLog.getSessions();
        return sessions.length > 0 ? sessions[sessions.length - 1] : null;
    }

    /**
     * Print session summary to console
     */
    static printSummary(session) {
        if (!session) { console.log('No session data'); return; }
        const m = session.meta;
        console.log(`=== Session ${session.id} ===`);
        console.log(`Duration: ${(m.duration / 1000).toFixed(1)}s | Result: ${m.result} | Events: ${m.eventCount}`);

        // Use compact summary (localStorage) or full events (in-memory)
        if (session.summary?.counts) {
            console.log('Event counts:', session.summary.counts);
        } else if (session.events) {
            const counts = {};
            session.events.forEach(e => { counts[e.cat] = (counts[e.cat] || 0) + 1; });
            console.log('Event counts:', counts);
        }

        return session;
    }

    /**
     * Export session as downloadable JSON
     */
    static exportLatest() {
        const session = SessionLog.getLatest();
        if (!session) { console.log('No session to export'); return; }
        const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session_${session.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('Session exported as', a.download);
    }
}

// Singleton current session
let currentSession = null;

export function startSession(version) {
    currentSession = new SessionLog();
    currentSession.meta.version = version;
    return currentSession;
}

export function getSession() {
    return currentSession;
}

// DEV commands
if (typeof window !== 'undefined') {
    window.DEV = window.DEV || {};
    window.DEV.sessions = () => {
        const sessions = SessionLog.getSessions();
        sessions.forEach(s => SessionLog.printSummary(s));
        return sessions;
    };
    window.DEV.exportSession = () => {
        // Export CURRENT running session if available, otherwise last saved
        if (currentSession) {
            // Flush aggregated buckets before export
            currentSession.flushAll();
        }
        if (currentSession && currentSession.events.length > 0) {
            const data = {
                id: currentSession.sessionId,
                meta: { ...currentSession.meta, exportedAt: new Date().toISOString(), status: 'running' },
                events: currentSession.events
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `session_${currentSession.sessionId}.json`;
            a.click();
            URL.revokeObjectURL(url);
            console.log(`Session exported (${currentSession.events.length} events)`, a.download);
            // Also send to telemetry DB
            currentSession._sendToTelemetry();
            return;
        }
        SessionLog.exportLatest();
    };
    window.DEV.sessionLog = () => {
        // Show current running session if available
        if (currentSession) {
            console.log(`=== Current Session ${currentSession.sessionId} (running) ===`);
            console.log(`Events: ${currentSession.events.length}, Duration: ${((Date.now() - currentSession.startTime) / 1000).toFixed(1)}s`);
            const counts = {};
            currentSession.events.forEach(e => { counts[e.cat] = (counts[e.cat] || 0) + 1; });
            console.log('Event counts:', counts);
            return currentSession;
        }
        const s = SessionLog.getLatest();
        if (s) SessionLog.printSummary(s);
        return s;
    };
}

