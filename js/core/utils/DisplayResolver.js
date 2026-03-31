/**
 * DisplayResolver - Resolves blueprint display names/descriptions from i18n data
 * Loads the Czech locale by default (game's primary language).
 */
import { DebugLogger } from '../debug/DebugLogger.js';

export class DisplayResolver {
    constructor() {
        this._data = null;
        this._loaded = false;
    }

    /**
     * Load i18n translations from JSON file
     */
    async load(locale = 'cs') {
        try {
            const resp = await fetch(`data/i18n/${locale}.json`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            this._data = await resp.json();
            this._loaded = true;
            DebugLogger.info('i18n', `[DisplayResolver] Loaded ${locale} locale`);
        } catch (e) {
            DebugLogger.warn('i18n', `[DisplayResolver] Failed to load ${locale}:`, e);
            this._data = {};
        }
    }

    /**
     * Get localized name for a blueprint
     * @param {object} blueprint - Blueprint with .id field (e.g. "powerup.damage_boost")
     * @returns {string|null}
     */
    getName(blueprint) {
        return this._resolve(blueprint?.id, 'name');
    }

    /**
     * Get localized description for a blueprint
     * @param {object} blueprint - Blueprint with .id field
     * @returns {string|null}
     */
    getDescription(blueprint) {
        return this._resolve(blueprint?.id, 'desc');
    }

    /**
     * Resolve a field from the i18n data using blueprint ID
     * ID format: "type.name" → json[type][name][field]
     */
    _resolve(id, field) {
        if (!this._data || !id) return null;
        const parts = id.split('.');
        if (parts.length < 2) return null;

        const category = parts[0]; // "powerup", "enemy", "boss", etc.
        const key = parts.slice(1).join('.'); // "damage_boost"

        const entry = this._data[category]?.[key];
        return entry?.[field] || null;
    }
}
