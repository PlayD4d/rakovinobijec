/**
 * SessionLog — Structured game session logging for debugging
 * Logs key events: spawns, kills, damage, powerups, transitions, errors
 * Stores last 3 sessions in localStorage as JSON
 * Access: DEV.sessions() / DEV.exportSession()
 */

const MAX_SESSIONS = 3;
const STORAGE_KEY = 'rakovinobijec_sessions';

class SessionLog {
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
        this.events.push({
            t: Date.now() - this.startTime, // relative ms
            cat: category,
            act: action,
            ...data
        });

        // Cap at 5000 events per session to prevent memory issues
        if (this.events.length > 5000) {
            this.events = this.events.slice(-4000);
        }
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
        this.meta.endedAt = new Date().toISOString();
        this.meta.result = result;
        this.meta.duration = Date.now() - this.startTime;
        this.meta.eventCount = this.events.length;
        this._save();
    }

    _save() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            stored.push({
                id: this.sessionId,
                meta: this.meta,
                events: this.events
            });
            // Keep only last N sessions
            while (stored.length > MAX_SESSIONS) stored.shift();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        } catch (e) {
            console.warn('[SessionLog] Failed to save:', e.message);
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

        // Count by category
        const counts = {};
        session.events.forEach(e => { counts[e.cat] = (counts[e.cat] || 0) + 1; });
        console.log('Event counts:', counts);

        // Damage summary
        const dmgEvents = session.events.filter(e => e.cat === 'dmg');
        const totalPlayerDmg = dmgEvents.filter(e => e.tgt === 'player').reduce((s, e) => s + (e.amt || 0), 0);
        const totalEnemyDmg = dmgEvents.filter(e => e.tgt !== 'player').reduce((s, e) => s + (e.amt || 0), 0);
        console.log(`Damage dealt: ${totalEnemyDmg} | Damage taken: ${totalPlayerDmg}`);

        // Powerups
        const pups = session.events.filter(e => e.cat === 'powerup');
        if (pups.length > 0) console.log('Powerups:', pups.map(p => `${p.id}@L${p.level}`).join(', '));

        // Errors
        const errors = session.events.filter(e => e.cat === 'error');
        if (errors.length > 0) {
            console.log(`⚠️ Errors (${errors.length}):`);
            errors.forEach(e => console.log(`  [${(e.t/1000).toFixed(1)}s] ${e.act}`, e));
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

export function endSession(result) {
    if (currentSession) {
        currentSession.end(result);
        currentSession = null;
    }
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

export { SessionLog };
export default SessionLog;
