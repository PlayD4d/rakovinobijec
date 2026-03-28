/**
 * PerformanceMonitor - FPS tracking and performance diagnostics
 *
 * Extracted from AnalyticsManager to keep files under 500 LOC.
 * Handles FPS history, periodic performance snapshots, and low-FPS issue tracking.
 */

import { DebugLogger } from '../../core/debug/DebugLogger.js';

export class PerformanceMonitor {
    /**
     * @param {object} opts
     * @param {function} opts.getSessionId - Returns current session ID
     * @param {function} opts.queueEvent  - Queues an analytics event (table, data)
     * @param {object|null} opts.supabase - Supabase client (used only to gate snapshots)
     */
    constructor({ getSessionId, queueEvent, supabase }) {
        this._getSessionId = getSessionId;
        this._queueEvent = queueEvent;
        this._supabase = supabase;

        // FPS history
        this.fpsHistory = [];
        this._fpsTrackingActive = false;

        // Performance snapshot timer
        this.performanceSnapshotTimer = null;

        // Latency tracking (written externally by EventQueue after uploads)
        this.lastUploadLatencyMs = null;

        // Low-FPS debounce
        const CR = window.ConfigResolver;
        this.performanceSnapshotIntervalMs =
            CR?.get('analytics.performanceSnapshotInterval', { defaultValue: 60000 }) || 60000;
        this.lowFpsDebounceMs =
            CR?.get('analytics.lowFpsDebounce', { defaultValue: 10000 }) || 10000;
        this.lastLowFpsIssueAt = 0;
    }

    // ===== PUBLIC LIFECYCLE =====

    start() {
        this._startFPSTracking();
        this._startPerformanceSnapshots();
    }

    shutdown() {
        this._fpsTrackingActive = false;
        if (this.performanceSnapshotTimer) {
            clearInterval(this.performanceSnapshotTimer);
            this.performanceSnapshotTimer = null;
        }
    }

    // ===== FPS =====

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

    // ===== PERFORMANCE ISSUES =====

    trackPerformanceIssue(type, details = {}) {
        const fpsStats = this.getFPSStats();

        // Low FPS: debounce & threshold
        if (type === 'low_fps') {
            const now = Date.now();
            if (now - this.lastLowFpsIssueAt < this.lowFpsDebounceMs) return;
            if (typeof details.fps === 'number' && details.fps > 45) return;
            this.lastLowFpsIssueAt = now;
        }

        this._queueEvent('performance_metrics', {
            session_id: this._getSessionId(),
            fps_min: fpsStats.min,
            fps_max: fpsStats.max,
            fps_average: fpsStats.avg,
            fps_drops: fpsStats.drops,
            error_count: type === 'error' ? 1 : 0,
            error_types: type === 'error' ? [details.error] : []
        });
    }

    /**
     * Build a summary performance-metrics payload (used at session end).
     */
    buildSummaryPayload() {
        const fpsStats = this.getFPSStats();
        const mem = (typeof performance !== 'undefined' && performance.memory) ? performance.memory : null;
        return {
            session_id: this._getSessionId(),
            fps_min: fpsStats.min,
            fps_max: fpsStats.max,
            fps_average: fpsStats.avg,
            fps_drops: fpsStats.drops,
            memory_used_mb: mem ? Math.round(mem.usedJSHeapSize / (1024 * 1024)) : null,
            memory_limit_mb: mem ? Math.round(mem.jsHeapSizeLimit / (1024 * 1024)) : null,
            api_latency_ms: this.lastUploadLatencyMs ?? null,
            supabase_available: !!this._supabase
        };
    }

    // ===== INTERNALS =====

    _startFPSTracking() {
        let lastTime = performance.now();
        const trackFPS = (currentTime) => {
            if (!this._fpsTrackingActive || !this.fpsHistory) return; // Guard against post-shutdown fire
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

    _startPerformanceSnapshots() {
        if (this.performanceSnapshotTimer) return;
        this.performanceSnapshotTimer = setInterval(() => {
            // Skip when Supabase is missing or page is hidden
            if (!this._supabase || (typeof document !== 'undefined' && document.hidden)) return;

            this._queueEvent('performance_metrics', this.buildSummaryPayload());
        }, this.performanceSnapshotIntervalMs);
    }
}
