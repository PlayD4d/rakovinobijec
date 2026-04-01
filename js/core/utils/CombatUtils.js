/**
 * CombatUtils - Shared combat helpers for AoE damage, enemy iteration, etc.
 * Eliminates 5× duplicated enemy group iteration across powerup abilities.
 */

/**
 * Read a level-indexed value from a blueprint array with fallback.
 * @param {Array} arr - Per-level array from blueprint (e.g. damagePerLevel)
 * @param {number} level - 1-based level
 * @param {*} fallback - Default if array missing or index out of bounds
 */
export function lvl(arr, level, fallback) {
    return (Array.isArray(arr) ? arr[level - 1] : undefined) ?? fallback;
}

/**
 * Iterate all active enemies (regular + bosses) with a callback.
 * Uses reverse for-loop — safe to destroy enemies inside callback.
 */
export function forEachActiveEnemy(scene, callback) {
    const eg = scene.enemiesGroup?.children ? scene.enemiesGroup.getChildren() : [];
    const bg = scene.bossGroup?.children ? scene.bossGroup.getChildren() : [];
    for (const list of [eg, bg]) {
        for (let i = list.length - 1; i >= 0; i--) {
            const e = list[i];
            if (e?.active && typeof e.takeDamage === 'function') callback(e);
        }
    }
}

/**
 * Deal damage to all active enemies within radius of a point.
 * @returns {number} Number of enemies hit
 */
export function damageEnemiesInRadius(scene, cx, cy, radiusSq, damage) {
    let hits = 0;
    forEachActiveEnemy(scene, (e) => {
        const dx = e.x - cx, dy = e.y - cy;
        if (dx * dx + dy * dy <= radiusSq) {
            e.takeDamage(damage);
            hits++;
        }
    });
    return hits;
}

/**
 * Collect all active enemies into a flat array.
 * Useful when you need random targeting.
 */
export function getActiveEnemies(scene) {
    const result = [];
    forEachActiveEnemy(scene, (e) => result.push(e));
    return result;
}

/**
 * Bake a texture from a Graphics draw function (idempotent — skips if key exists).
 * @param {Phaser.Scene} scene
 * @param {string} texKey - Texture key
 * @param {number} w - Width
 * @param {number} h - Height
 * @param {function} drawFn - Receives Graphics object, draws onto it
 */
export function ensureTexture(scene, texKey, w, h, drawFn) {
    if (scene.textures.exists(texKey)) return;
    const gf = scene.graphicsFactory;
    if (!gf) return;
    const g = gf.create();
    g.clear();
    drawFn(g);
    g.generateTexture(texKey, w, h);
    gf.release(g);
}
