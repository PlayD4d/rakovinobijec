/**
 * NgPlusScaler - NG+ scaling logic with cache
 *
 * Extracted from SpawnDirector to comply with the 500 LOC limit.
 * Standalone class with internal cache for scaled blueprints.
 */

export class NgPlusScaler {
    constructor() {
        /** @type {Map<string, Object>} Cache scaled blueprints to avoid deep-cloning on every spawn */
        this._cache = new Map();
    }

    /**
     * Clear the cache (call on level start to avoid stale scaling)
     */
    clear() {
        this._cache.clear();
    }

    /**
     * Apply NG+ scaling to blueprint
     * @param {Object} blueprint - Original blueprint
     * @param {number} ngLevel - Current NG+ level
     * @param {Object|null} blueprints - BlueprintLoader for fetching scaling config
     * @returns {Object} Scaled blueprint (or original if no scaling needed)
     */
    apply(blueprint, ngLevel, blueprints) {
        if (ngLevel <= 0) return blueprint;

        // Get NG+ scaling config
        const ngConfig = blueprints?.get('system.ng_plus_scaling');
        if (!ngConfig) return blueprint;

        const scaling = ngConfig.scaling;
        if (!scaling) return blueprint;

        // Check cache first
        const cacheKey = `${blueprint.id}_ng${ngLevel}`;
        if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

        // Clone blueprint once and cache the result
        const scaled = structuredClone(blueprint);

        if (scaled.stats) {
            if (scaled.stats.hp && scaling.hp) {
                scaled.stats.hp = Math.floor(scaled.stats.hp * Math.pow(scaling.hp, ngLevel));
            }
            if (scaled.stats.damage && scaling.damage) {
                scaled.stats.damage = Math.floor(scaled.stats.damage * Math.pow(scaling.damage, ngLevel));
            }
            if (scaled.stats.speed && scaling.speed) {
                scaled.stats.speed = scaled.stats.speed * Math.pow(scaling.speed, ngLevel);
            }
            if (scaled.stats.xp && scaling.xp) {
                scaled.stats.xp = Math.floor(scaled.stats.xp * Math.pow(scaling.xp, ngLevel));
            }
        }

        this._cache.set(cacheKey, scaled);
        return scaled;
    }
}
