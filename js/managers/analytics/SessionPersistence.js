/**
 * SessionPersistence - Manages session creation and updates in Supabase
 *
 * Extracted from AnalyticsManager to keep files under 500 LOC.
 */

import { DebugLogger } from '../../core/debug/DebugLogger.js';

export class SessionPersistence {
    /**
     * @param {object} opts
     * @param {object|null} opts.supabase - Supabase client
     */
    constructor({ supabase }) {
        this._supabase = supabase;
        this.sessionCreated = false;
        this.sessionCreationPending = false;
    }

    /**
     * Create the initial session row (for foreign key constraints).
     */
    async createInitialSession(sessionData) {
        if (!this._supabase) return;
        if (this.sessionCreationPending || this.sessionCreated) return;
        this.sessionCreationPending = true;

        try {
            const initialData = {
                session_id: sessionData.session_id,
                player_name: sessionData.player_name,
                browser: sessionData.browser,
                user_agent: sessionData.user_agent,
                screen_width: sessionData.screen_width,
                screen_height: sessionData.screen_height,
                game_version: sessionData.game_version,
                connection_type: sessionData.connection_type,
                started_at: new Date().toISOString(),
                level_reached: 1,
                enemies_killed: 0,
                score: 0
            };

            const { error } = await this._supabase
                .from('game_sessions')
                .insert([initialData]);

            if (error) {
                DebugLogger.warn('bootstrap', '⚠️ Failed to create initial session:', error.message);
            } else {
                DebugLogger.info('general', '✅ Initial session created:', sessionData.session_id);
                this.sessionCreated = true;
            }
        } catch (error) {
            DebugLogger.warn('bootstrap', '⚠️ Failed to create initial session:', error.message);
        }
        this.sessionCreationPending = false;
    }

    /**
     * Insert full session data row.
     */
    async uploadSessionData(sessionData) {
        if (!this._supabase) return;
        try {
            const { error } = await this._supabase.from('game_sessions').insert([sessionData]);
            if (error) {
                DebugLogger.warn('bootstrap', '❌ Failed to upload session data:', error.message);
            } else {
                DebugLogger.info('general', '✅ Session data uploaded successfully');
            }
        } catch (error) {
            DebugLogger.warn('bootstrap', '❌ Failed to upload session data:', error.message);
        }
    }

    /**
     * Upsert session update (e.g. end-of-session stats).
     */
    async updateSessionData(sessionId, sessionUpdate) {
        if (!this._supabase) {
            DebugLogger.info('general', '📊 No Supabase - session update skipped');
            return;
        }
        try {
            const payload = { session_id: sessionId, ...sessionUpdate };
            const { error } = await this._supabase
                .from('game_sessions')
                .upsert(payload, { onConflict: 'session_id' });
            if (error) {
                DebugLogger.error('general', '❌ Database error updating session:', error.message);
                throw error;
            } else {
                DebugLogger.info('general', '✅ Session data updated for:', sessionId);
            }
        } catch (error) {
            DebugLogger.error('general', '❌ Exception updating session data:', error.message);
            throw error;
        }
    }
}
