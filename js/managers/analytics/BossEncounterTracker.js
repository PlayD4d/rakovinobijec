/**
 * BossEncounterTracker - Tracks boss fight analytics
 *
 * Extracted from AnalyticsManager to keep files under 500 LOC.
 * Manages in-memory boss encounter state and queues events on defeat/abort.
 */

export class BossEncounterTracker {
    /**
     * @param {object} opts
     * @param {function} opts.getSessionId - Returns current session ID
     * @param {function} opts.queueEvent   - Queues an analytics event (table, data)
     */
    constructor({ getSessionId, queueEvent }) {
        this._getSessionId = getSessionId;
        this._queueEvent = queueEvent;
        this.current = null;
    }

    start(bossName, level, playerHPStart = null) {
        this.current = {
            session_id: this._getSessionId(),
            boss_name: String(bossName || 'Unknown Boss'),
            boss_level: Math.floor(Number(level) || 1),
            timestamp: new Date().toISOString(),
            damage_dealt_to_boss: 0,
            damage_taken_from_boss: 0,
            special_attacks_used: 0,
            player_hp_start: Math.floor(Number(playerHPStart) || 0),
            death_phase: null,
            started_at: Date.now()
        };
    }

    trackAction(actionName, phaseIndex) {
        if (!this.current) return;
        try {
            this._queueEvent('boss_encounters', {
                session_id: this._getSessionId(),
                boss_name: this.current.boss_name,
                event_type: 'action',
                action_name: String(actionName || 'unknown'),
                phase_index: Math.floor(Number(phaseIndex) || 0),
                occurred_at: new Date().toISOString()
            });
        } catch (_) { /* no-op */ }
    }

    defeat(playerHP) {
        if (!this.current) return;
        this._finishEncounter(true, playerHP);
    }

    abort(playerHP) {
        if (!this.current) return;
        this._finishEncounter(false, playerHP);
    }

    recordDamageDealt(amount) {
        if (!this.current) return;
        const dmg = Math.floor(Number(amount) || 0);
        if (dmg > 0) this.current.damage_dealt_to_boss += dmg;
    }

    recordDamageTaken(amount) {
        if (!this.current) return;
        const dmg = Math.floor(Number(amount) || 0);
        if (dmg > 0) this.current.damage_taken_from_boss += dmg;
    }

    incrementSpecialAttacks() {
        if (!this.current) return;
        this.current.special_attacks_used += 1;
    }

    setPhase(phaseCode) {
        if (!this.current) return;
        const code = parseInt(phaseCode, 10);
        if (!Number.isNaN(code)) this.current.death_phase = code;
    }

    _finishEncounter(defeated, playerHP) {
        const encounter = {
            ...this.current,
            defeated,
            fight_duration: Math.floor((Date.now() - this.current.started_at) / 1000),
            player_hp_end: Math.floor(Number(playerHP) || 0)
        };
        delete encounter.started_at;
        this._queueEvent('boss_encounters', encounter);
        this.current = null;
    }
}
