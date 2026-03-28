/**
 * ExplosionHandler - Handles area-of-effect explosion damage and effects
 *
 * Extracted from ProjectileSystem for SoC (< 500 LOC rule).
 * Performs single-pass AABB + circle hit detection against active enemies.
 */

export class ExplosionHandler {
  /**
   * @param {Phaser.Scene} scene - The game scene
   */
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Create an explosion at the given position, damaging all enemies in radius.
   * Uses AABB pre-filter + circle check for optimal performance (single pass).
   *
   * @param {number} x - X centre of explosion
   * @param {number} y - Y centre of explosion
   * @param {number} damage - Damage dealt to each enemy in range
   * @param {number} radius - Explosion radius in pixels
   * @param {number} _level - Power-up level (reserved for future scaling)
   * @returns {number} Number of enemies hit
   */
  create(x, y, damage, radius, _level) {
    const enemiesGroup = this.scene.enemiesGroup;
    if (!enemiesGroup) return 0;

    const enemies = enemiesGroup.getChildren?.() || [];
    const radiusSquared = radius * radius;
    // Timestamp as cheap unique ID to prevent double-hit in the same explosion
    const explosionId = this.scene.time?.now || 0;
    let hitCount = 0;

    for (let i = 0, len = enemies.length; i < len; i++) {
      const enemy = enemies[i];
      if (!enemy.active) continue;
      if (enemy._lastExplosionId === explosionId) continue;

      // AABB pre-filter
      const dx = Math.abs(enemy.x - x);
      const dy = Math.abs(enemy.y - y);
      if (dx > radius || dy > radius) continue;

      // Circle check
      if (dx * dx + dy * dy > radiusSquared) continue;

      enemy._lastExplosionId = explosionId;
      hitCount++;

      if (enemy.takeDamage) {
        enemy.takeDamage(damage);
        try { this.scene.recordDamageDealt?.(damage, enemy); } catch (_e) { /* noop */ }
        if (enemy.hp <= 0) this.scene.handleEnemyDeath?.(enemy);
      }
    }

    // VFX / SFX (single call, no duplicates)
    if (this.scene.vfxSystem) {
      this.scene.vfxSystem.play('vfx.explosion.small', x, y);
    }
    if (this.scene.audioSystem) {
      this.scene.audioSystem.play('sound/explosion_small.mp3');
    }

    return hitCount;
  }
}
