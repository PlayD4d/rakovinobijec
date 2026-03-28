/**
 * EventQueue - Batched analytics event queue with periodic flushing
 *
 * Extracted from AnalyticsManager to keep files under 500 LOC.
 * Manages the event queue, flush timer, and Supabase upload logic.
 */

import { DebugLogger } from '../../core/debug/DebugLogger.js';

export class EventQueue {
    /**
     * @param {object} opts
     * @param {object|null} opts.supabase      - Supabase client
     * @param {function}    opts.getSessionId   - Returns current session ID
     * @param {function}    opts.isSessionReady - Returns true when session row exists in DB
     * @param {function}    opts.ensureSession  - Creates session row if not yet created
     * @param {function|null} opts.onLatencyMeasured - Callback(ms) after each upload
     */
    constructor({ supabase, getSessionId, isSessionReady, ensureSession, onLatencyMeasured }) {
        this._supabase = supabase;
        this._getSessionId = getSessionId;
        this._isSessionReady = isSessionReady;
        this._ensureSession = ensureSession;
        this._onLatencyMeasured = onLatencyMeasured || null;

        this.queue = [];
        this._flushTimer = null;

        const CR = window.ConfigResolver;
        this.flushInterval =
            CR?.get('analytics.flushInterval', { defaultValue: 30000 }) || 30000;
    }

    // ===== PUBLIC API =====

    /** Add an event to the queue. */
    queueEvent(table, data) {
        this.queue.push({ table, data });
    }

    /** Start the periodic flush timer. */
    startFlushTimer() {
        if (this._flushTimer) return;
        this._flushTimer = setInterval(() => {
            this.flushEvents();
        }, this.flushInterval);
    }

    /** Flush all queued events to Supabase. */
    async flushEvents() {
        if (this.queue.length === 0 || !this._supabase) return;

        // Wait for session row to exist (foreign key constraint)
        if (!this._isSessionReady()) {
            await this._ensureSession();
            if (!this._isSessionReady()) {
                DebugLogger.info('general', 'EventQueue: waiting for session creation...');
                return;
            }
        }

        DebugLogger.info('general', `EventQueue: flushing ${this.queue.length} events...`);

        // Group events by table
        const eventsByTable = {};
        for (const event of this.queue) {
            if (!eventsByTable[event.table]) {
                eventsByTable[event.table] = [];
            }
            eventsByTable[event.table].push(event.data);
        }

        // Upload each table
        for (const [table, events] of Object.entries(eventsByTable)) {
            try {
                DebugLogger.info('general', `EventQueue: uploading ${events.length} events to ${table}...`);
                const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                const { error } = await this._supabase
                    .from(table)
                    .insert(events, { returning: 'minimal' });
                const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                const latency = Math.round(t1 - t0);

                if (this._onLatencyMeasured) {
                    this._onLatencyMeasured(latency);
                }

                if (error) {
                    DebugLogger.warn('bootstrap', `EventQueue: failed to upload ${table}: ${error.message}`);
                    DebugLogger.warn('bootstrap', 'EventQueue: sample event:', events[0]);
                } else {
                    DebugLogger.info('general', `EventQueue: uploaded ${events.length} ${table} events`);
                }
            } catch (error) {
                DebugLogger.warn('bootstrap', `EventQueue: exception uploading ${table}: ${error.message}`);
                DebugLogger.warn('bootstrap', 'EventQueue: sample event:', events[0]);
            }
        }

        // Clear queue
        this.queue = [];
    }

    /** Stop flush timer and do a final best-effort flush. */
    shutdown() {
        if (this._flushTimer) {
            clearInterval(this._flushTimer);
            this._flushTimer = null;
        }
        // Best-effort sync flush of remaining events
        if (this.queue.length > 0) {
            try { this.flushEvents(); } catch (_) {}
        }
        this.queue = [];
    }
}
