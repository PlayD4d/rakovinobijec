import { DebugLogger } from '../../core/debug/DebugLogger.js';

/**
 * PlayerStats - Modifier application and stat caching
 * Extracted from Player.js for Thin Composer pattern (PR7)
 */
export class PlayerStats {
    constructor(player) {
        this.player = player;
    }

    /**
     * Apply modifiers to a base value
     */
    applyModifiers(baseValue, statName) {
        let value = baseValue || 0;
        for (const mod of this.player.activeModifiers || []) {
            if (mod.path === statName) {
                if (mod.type === 'add') value += mod.value;
                else if (mod.type === 'multiply') value *= mod.value;
                else if (mod.type === 'mul') value *= (1 + mod.value);
                else if (mod.type === 'base') value = mod.value;
                else if (mod.type === 'set') value = mod.value;
            }
        }
        return value;
    }

    /**
     * Get all stats with modifiers applied (cached via dirty flag)
     */
    getAll() {
        const player = this.player;
        if (this._cache && !player._statsDirty) return this._cache;

        const stats = {};
        if (!this._keys) this._keys = Object.keys(player.baseStats);
        for (const key of this._keys) {
            stats[key] = this.applyModifiers(player.baseStats[key], key);
        }

        // Log once on change
        if (player._statsDirty && player.activeModifiers?.length > 0) {
            const now = player.scene?.time?.now || 0;
            if (!this._lastLogTime || now - this._lastLogTime > 1000) {
                DebugLogger.info('powerup', `[PlayerStats] Recalculated:`, {
                    mods: player.activeModifiers.length,
                    atkInterval: stats.attackIntervalMs,
                    dmg: stats.projectileDamage,
                    spd: stats.moveSpeed
                });
                this._lastLogTime = now;
            }
        }

        this._cache = stats;
        player._statsDirty = false;
        return stats;
    }

    /**
     * Get single stat with modifiers
     */
    get(statName, isInteger = false) {
        const val = this.applyModifiers(this.player.baseStats[statName] || 0, statName);
        return isInteger ? Math.floor(val) : val;
    }

    // Modifier API — delegates set dirty flag on player

    setAll(modArray) {
        if (!Array.isArray(modArray)) throw new Error('[PlayerStats] expects array');
        this.player.activeModifiers = modArray;
        this.player._statsDirty = true;
    }

    add(mod) {
        if (!mod) return;
        this.player.activeModifiers.push(mod);
        this.player._statsDirty = true;
    }

    removeById(id) {
        const a = this.player.activeModifiers;
        for (let i = 0; i < a.length; i++) {
            if (a[i]?.id === id) {
                a.splice(i, 1);
                this.player._statsDirty = true;
                return true;
            }
        }
        return false;
    }

    clearAll() {
        this.player.activeModifiers = [];
        this.player._statsDirty = true;
    }
}

