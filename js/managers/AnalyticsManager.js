/**
 * AnalyticsManager - No-op stub (Supabase removed)
 *
 * Telemetry is now handled by SessionLog + TelemetryLogger + dev-server SQLite.
 * This stub preserves the API surface so existing call sites don't need changes.
 * All methods are silent no-ops.
 */
export class AnalyticsManager {
    constructor() {
        this.enabled = false;
        this.sessionId = null;
        this.sessionData = {};
        this.fpsHistory = [];
    }

    trackEvent() {}
    trackPlayerDeath() {}
    trackEnemySpawn() {}
    trackBossEncounter() {}
    queueEvent() {}
    async endSession() {}
    async createInitialSession() {}
    shutdown() {}
    generateSessionId() { return null; }
    getBrowserInfo() { return 'unknown'; }
    getStats() { return { enabled: false }; }
}
