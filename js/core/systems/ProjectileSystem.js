/**
 * ProjectileSystemV2 - Phaser 3 Arcade Physics projectile management
 *
 * PR7 kompatibilni - Zero-GC, built-in pooling, optimal performance.
 * Unified system for all projectiles in the game.
 * Supports player and enemy projectiles with various effects.
 *
 * Texture generation delegated to ProjectileTextureGenerator.
 * Explosion logic delegated to ExplosionHandler.
 */

import { PlayerProjectile } from '../projectiles/PlayerProjectile.js';
import { DebugLogger } from '../debug/DebugLogger.js';
import { EnemyProjectile } from '../projectiles/EnemyProjectile.js';
import { ProjectileTextureGenerator } from '../projectiles/ProjectileTextureGenerator.js';
import { ExplosionHandler } from '../projectiles/ExplosionHandler.js';
// PR7: GameConfig removed - use ConfigResolver only

export class ProjectileSystem {
  constructor(scene) {
    this.scene = scene;

    // Delegate texture generation to extracted module
    this._textureGen = new ProjectileTextureGenerator(scene, () => this._createGraphics());
    this._textureGen.generate();

    // Delegate explosion handling to extracted module
    this._explosionHandler = new ExplosionHandler(scene);

    // PR7: Get pool sizes from ConfigResolver
    const ConfigResolver = this.scene.configResolver || window.ConfigResolver;
    const playerPoolSize = ConfigResolver ? ConfigResolver.get('projectiles.player.poolSize', { defaultValue: 256 }) : 256;
    const enemyPoolSize = ConfigResolver ? ConfigResolver.get('projectiles.enemy.poolSize', { defaultValue: 256 }) : 256;

    // Player projectile group with built-in pooling
    this.playerBullets = scene.physics.add.group({
      classType: PlayerProjectile,
      maxSize: playerPoolSize,
      runChildUpdate: true
    });

    // Enemy projectile group with built-in pooling
    this.enemyBullets = scene.physics.add.group({
      classType: EnemyProjectile,
      maxSize: enemyPoolSize,
      runChildUpdate: true
    });

    // PR7: Use ConfigResolver for all configuration values
    this.config = {
      speed: ConfigResolver ? ConfigResolver.get('player.projectileSpeed', { defaultValue: 300 }) : 300,
      range: ConfigResolver ? ConfigResolver.get('player.projectileRange', { defaultValue: 600 }) : 600,
      damage: ConfigResolver ? ConfigResolver.get('player.projectileDamage', { defaultValue: 10 }) : 10,
      muzzleOffset: ConfigResolver ? ConfigResolver.get('player.muzzleOffset', { defaultValue: 24 }) : 24,
      // Enemy projectile defaults
      enemySpeed: ConfigResolver ? ConfigResolver.get('enemy.projectileSpeed', { defaultValue: 150 }) : 150,
      enemyRange: ConfigResolver ? ConfigResolver.get('enemy.projectileRange', { defaultValue: 400 }) : 400,
      enemyDamage: ConfigResolver ? ConfigResolver.get('enemy.projectileDamage', { defaultValue: 5 }) : 5
    };

    // World-bounds cleanup (prevents invisible projectile buildup)
    this._setupWorldBoundsCleanup();

    // Scene shutdown cleanup
    scene.events.once('shutdown', () => {
      this._cleanupSystem();
    });
  }

  /**
   * Set up handler for automatic projectile cleanup outside world bounds.
   */
  _setupWorldBoundsCleanup() {
    this._onWorldBounds = (body) => {
      const go = body.gameObject;
      if (go && typeof go.kill === 'function') {
        go.kill();
      }
    };

    this.scene.physics.world.on('worldbounds', this._onWorldBounds);
  }

  /**
   * Clean up system resources to prevent memory leaks.
   * Called on scene shutdown.
   */
  _cleanupSystem() {
    if (this._onWorldBounds && this.scene.physics && this.scene.physics.world) {
      this.scene.physics.world.off('worldbounds', this._onWorldBounds);
      this._onWorldBounds = null;
    }

    this.clearAll();
  }

  /**
   * Fire a player projectile - Zero-GC API
   * @param {number} x - Player X position
   * @param {number} y - Player Y position
   * @param {number} dirX - Direction X (normalized)
   * @param {number} dirY - Direction Y (normalized)
   * @param {Object} [opts] - { speedMul, rangeMul, damageMul, tint, projectileId }
   * @returns {boolean} True if projectile was fired
   */
  firePlayer(x, y, dirX, dirY, opts = {}) {
    // Backwards compat: if 5th arg is a number, use legacy positional signature
    if (typeof opts === 'number') {
      const args = arguments;
      opts = {
        speedMul: args[4], rangeMul: args[5], damageMul: args[6],
        tint: args[7], projectileId: args[8]
      };
    }
    const speedMultiplier = opts.speedMul ?? 1.0;
    const rangeMultiplier = opts.rangeMul ?? 1.0;
    const damageMultiplier = opts.damageMul ?? 1.0;
    const tint = opts.tint ?? 0x66DDFF; // Player: bright cyan
    const projectileId = opts.projectileId ?? 'projectile.player_basic';

    const bullet = this.playerBullets.get();
    if (!bullet) {
      if (Math.random() < 0.01) {
        DebugLogger.warn('projectile', '[ProjectileSystemV2] Pool hracskych projektilu je vycerpan');
      }
      return false;
    }

    bullet.setVisible(false);

    // Get texture for this projectile
    bullet.setTexture(this._textureGen.getTexture(projectileId));

    // Play player shoot sound from blueprint - PR7 compliant
    if (this.scene.audioSystem) {
      const player = this.scene.player;
      const shootSFX = player?.blueprint?.sfx?.shoot;
      if (shootSFX) {
        this.scene.audioSystem.play(shootSFX);
      } else {
        DebugLogger.warn('projectile', '[ProjectileSystem] Missing shoot sound in player blueprint');
      }
    }

    // Set projectile depth
    const projectileDepth = this.scene.DEPTH_LAYERS?.PROJECTILES || 3000;
    bullet.setDepth(projectileDepth);

    // Compute final stats with power-up multipliers
    const speed = this.config.speed * speedMultiplier;
    const range = this.config.range * rangeMultiplier;
    const damage = this.config.damage * damageMultiplier;

    bullet.fire(x, y, dirX, dirY, speed, range, damage, tint);

    // Add piercing properties from player if active
    const player = this.scene.player;
    if (player && player.piercingLevel > 0) {
        bullet.piercing = true;
        bullet.maxPiercing = player.piercingMaxPierces || 1;
        bullet.hitCount = 0;
        bullet.damageReduction = player.piercingDamageReduction || 0.1;
        bullet._hitEnemies = new Set(); // Track hit enemies to prevent double-counting

        if (Math.random() < 0.01) {
            DebugLogger.info('projectile', `[ProjectileSystem] PIERCING - Max pierces: ${bullet.maxPiercing}, damage reduction: ${(bullet.damageReduction * 100).toFixed(1)}%`);
        }
    } else {
        bullet.piercing = false;
        bullet.maxPiercing = 0;
        bullet.hitCount = 0;
        bullet._hitEnemies = null;
    }

    return true;
  }

  /**
   * Fire an enemy projectile - Zero-GC API with scalars only
   * @param {number} x - Enemy X position
   * @param {number} y - Enemy Y position
   * @param {number} dirX - Direction X (normalized)
   * @param {number} dirY - Direction Y (normalized)
   * @param {Object} [opts] - { speed, range, damage, tracking, sourceType, tint, projectileId }
   * @returns {boolean} True if projectile was fired
   */
  fireEnemy(x, y, dirX, dirY, opts = {}) {
    // Backwards compat: if 5th arg is a number/null, use legacy positional signature
    if (opts === null || typeof opts === 'number') {
      const args = arguments;
      opts = {
        speed: args[4], range: args[5], damage: args[6],
        tracking: args[7], sourceType: args[8], tint: args[9], projectileId: args[10]
      };
    }
    const speed = opts.speed || this.config.enemySpeed || 150;
    const range = opts.range || this.config.enemyRange || 400;
    const damage = opts.damage || this.config.enemyDamage || 8;
    const tracking = opts.tracking || false;
    const sourceType = opts.sourceType || null;
    const tint = opts.tint ?? 0xff0000;
    const projectileId = opts.projectileId ?? 'projectile.cytotoxin_enhanced';

    const bullet = this.enemyBullets.get();
    if (!bullet) {
      if (Math.random() < 0.01) {
        DebugLogger.warn('projectile', '[ProjectileSystemV2] Pool nepratelskych projektilu je vycerpan');
      }
      return false;
    }

    bullet.setVisible(false);

    // Get texture for enemy projectile
    bullet.setTexture(this._textureGen.getTexture(projectileId));

    // Set projectile depth
    const projectileDepth = this.scene.DEPTH_LAYERS?.PROJECTILES || 3000;
    bullet.setDepth(projectileDepth + 1); // Enemy projectiles slightly above

    bullet.fire(x, y, dirX, dirY, speed, range, damage, tracking, sourceType, tint);

    return true;
  }

  /**
   * Compat method for older code - converts old API to new
   */
  createPlayerProjectile(xOrOptions, y, velocity, damage, color = 0xffffff) {
    // New PR7 style: single options object
    if (typeof xOrOptions === 'object' && xOrOptions.x !== undefined) {
      const opts = xOrOptions;
      const dirX = Math.cos(opts.angleRad || 0);
      const dirY = Math.sin(opts.angleRad || 0);
      const projectileId = opts.projectileBlueprintId || 'projectile.player_basic';
      return this.firePlayer(opts.x, opts.y, dirX, dirY, 1.0, 1.0, (opts.damage || 10) / this.config.damage, 0xffffff, projectileId);
    }

    // Legacy style: separate parameters
    const speed = Math.hypot(velocity.x, velocity.y) || this.config.speed;
    const dirX = speed > 0 ? velocity.x / speed : 1;
    const dirY = speed > 0 ? velocity.y / speed : 0;
    return this.firePlayer(xOrOptions, y, dirX, dirY, 1.0, 1.0, damage / this.config.damage, color, 'projectile.player_basic');
  }

  /**
   * Compat method for enemy projectiles
   */
  createEnemyProjectile(xOrOptions, y, velocity, damage, color = 0xff0000, tracking = false, sourceType = null) {
    // New PR7 style: single options object
    if (typeof xOrOptions === 'object' && xOrOptions.x !== undefined) {
      const opts = xOrOptions;
      const vel = opts.velocity || { x: 0, y: 0 };

      const speed = Math.hypot(vel.x, vel.y) || this.config.enemySpeed;
      const dirX = speed > 0 ? vel.x / speed : 1;
      const dirY = speed > 0 ? vel.y / speed : 0;

      const projectileId = opts.projectileId || opts.projectileBlueprintId || 'projectile.cytotoxin_enhanced';
      return this.fireEnemy(
        opts.x, opts.y, dirX, dirY,
        speed, opts.range || null, opts.damage || null,
        opts.homing || false, opts.owner?.type || null,
        opts.color || 0xff0000, projectileId
      );
    }

    // Legacy style: separate parameters
    const speed = Math.hypot(velocity.x, velocity.y) || this.config.enemySpeed;
    const dirX = speed > 0 ? velocity.x / speed : 1;
    const dirY = speed > 0 ? velocity.y / speed : 0;
    return this.fireEnemy(xOrOptions, y, dirX, dirY, speed, null, damage, tracking, sourceType, color);
  }

  /**
   * Update method - kept for compat, actual updates via runChildUpdate
   */
  update(time, delta) {
    // Physics group with runChildUpdate: true handles updates automatically
  }

  /**
   * PR7: Pause all projectiles - stop their movement
   */
  pauseAll() {
    const groups = [this.getPlayerBullets(), this.getEnemyBullets()];
    for (const bullets of groups) {
      for (let i = 0, len = bullets.length; i < len; i++) {
        const b = bullets[i];
        if (b?.body) {
          b._pvx = b.body.velocity.x;
          b._pvy = b.body.velocity.y;
          b.body.setVelocity(0, 0);
        }
      }
    }
  }

  resumeAll() {
    const groups = [this.getPlayerBullets(), this.getEnemyBullets()];
    for (const bullets of groups) {
      for (let i = 0, len = bullets.length; i < len; i++) {
        const b = bullets[i];
        if (b?.body && b._pvx !== undefined) {
          b.body.setVelocity(b._pvx, b._pvy);
          b._pvx = undefined;
          b._pvy = undefined;
        }
      }
    }
  }

  /**
   * Clear all projectiles without destroying pools.
   */
  clearAll() {
    const groups = [this.getPlayerBullets(), this.getEnemyBullets()];
    for (const bullets of groups) {
      for (let i = 0, len = bullets.length; i < len; i++) {
        if (bullets[i]?.kill) bullets[i].kill();
      }
    }
  }

  /**
   * Alias for clearAll for consistency with GameScene
   */
  clearAllProjectiles() {
    this.clearAll();
  }

  /**
   * @returns {Array} Active player projectiles
   */
  getPlayerBullets() {
    if (!this.playerBullets || !this.playerBullets.children) return [];
    try {
      return this.playerBullets.getChildren() || [];
    } catch (e) {
      return [];
    }
  }

  /**
   * @returns {Array} Active enemy projectiles
   */
  getEnemyBullets() {
    if (!this.enemyBullets || !this.enemyBullets.children) return [];
    try {
      return this.enemyBullets.getChildren() || [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Create an explosion at the given position.
   * Delegates to ExplosionHandler.
   * @param {number} x - X centre
   * @param {number} y - Y centre
   * @param {number} damage - Explosion damage
   * @param {number} radius - Explosion radius in pixels
   * @param {number} level - Power-up level for scaling
   * @returns {number} Number of enemies hit
   */
  createExplosion(x, y, damage, radius, level) {
    return this._explosionHandler.create(x, y, damage, radius, level);
  }

  /**
   * Get stats for debugging and analytics.
   * @returns {object} Pool statistics
   */
  getStats() {
    return {
      player: {
        active: this.playerBullets.countActive(),
        total: this.playerBullets.children.size,
        pooled: this.playerBullets.children.size - this.playerBullets.countActive()
      },
      enemy: {
        active: this.enemyBullets.countActive(),
        total: this.enemyBullets.children.size,
        pooled: this.enemyBullets.children.size - this.enemyBullets.countActive()
      }
    };
  }

  // ==========================================
  // PR7 Factory Methods
  // ==========================================

  /**
   * Factory method for creating graphics objects.
   * Used internally and passed to ProjectileTextureGenerator.
   * @returns {Phaser.GameObjects.Graphics}
   * @private
   */
  _createGraphics() {
    if (!this.scene || !this.scene.graphicsFactory) {
      DebugLogger.warn('projectile', '[ProjectileSystem] GraphicsFactory not available, using fallback');
      if (!this.scene.add) {
        throw new Error('[ProjectileSystem] Scene not available for graphics creation');
      }
      return this.scene.add.graphics();
    }
    return this.scene.graphicsFactory.create();
  }
}
