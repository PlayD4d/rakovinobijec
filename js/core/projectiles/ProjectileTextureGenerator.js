/**
 * ProjectileTextureGenerator - Generates projectile textures from blueprints
 *
 * Extracted from ProjectileSystem for SoC (< 500 LOC rule).
 * Responsible for creating and caching all projectile textures at init time.
 */

import { DebugLogger } from '../debug/DebugLogger.js';
import { ShapeRenderer } from '../utils/ShapeRenderer.js';

export class ProjectileTextureGenerator {
  /**
   * @param {Phaser.Scene} scene - The game scene
   * @param {Function} createGraphicsFn - Factory function that returns a Phaser.GameObjects.Graphics
   */
  constructor(scene, createGraphicsFn) {
    this.scene = scene;
    this._createGraphics = createGraphicsFn;
  }

  /**
   * Generate all projectile textures (default + blueprint-based).
   * Called once during ProjectileSystem init.
   */
  generate() {
    this._generateDefaultBulletTexture();
    this._generateFromBlueprints();
  }

  /**
   * Get the texture key for a given projectile blueprint ID.
   * Falls back to 'bullet8' when no matching texture exists.
   * @param {string} projectileId - Blueprint ID (e.g. 'projectile.cytotoxin')
   * @returns {string} Phaser texture key
   */
  getTexture(projectileId) {
    if (!projectileId) return 'bullet8';

    const textureName = `projectile_${projectileId.replace('projectile.', '')}`;

    if (this.scene.textures.exists(textureName)) {
      return textureName;
    }

    return 'bullet8';
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  /**
   * Generate the default 8x8 white circle fallback texture ('bullet8').
   */
  _generateDefaultBulletTexture() {
    if (this.scene.textures.exists('bullet8')) return;

    const graphics = this._createGraphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture('bullet8', 8, 8);

    this._releaseGraphics(graphics);
  }

  /**
   * Iterate all loaded projectile blueprints and generate a texture for each.
   */
  _generateFromBlueprints() {
    if (!this.scene.blueprintLoader) return;

    const allBlueprints = this.scene.blueprintLoader.getAll
      ? this.scene.blueprintLoader.getAll()
      : this.scene.blueprintLoader.blueprints || {};

    for (const [id, blueprint] of Object.entries(allBlueprints)) {
      if (!blueprint || blueprint.type !== 'projectile') continue;
      this._generateSingleTexture(id, blueprint);
    }
  }

  /**
   * Generate a texture for one projectile blueprint.
   * @param {string} id - Blueprint ID
   * @param {object} blueprint - Blueprint data
   */
  _generateSingleTexture(id, blueprint) {
    const graphicsCfg = blueprint.graphics || {};
    const shape = graphicsCfg.shape || 'circle';
    const tint = graphicsCfg.tint || 0xFFFFFF;
    const size = graphicsCfg.size || 8;

    const textureName = `projectile_${id.replace('projectile.', '')}`;
    if (this.scene.textures.exists(textureName)) return;

    const gfx = this._createGraphics();

    ShapeRenderer.drawShape(gfx, shape, size / 2, size / 2, size / 2 - 1, {
      fillColor: tint,
      fillAlpha: 1.0,
      strokeColor: shape === 'star' ? 0xFFFFFF : null,
      strokeWidth: shape === 'star' ? 1 : 0,
      strokeAlpha: 0.8
    });

    gfx.generateTexture(textureName, size, size);
    this._releaseGraphics(gfx);

    DebugLogger.info('projectile', `[ProjectileTextureGenerator] Generated texture '${textureName}' with shape '${shape}'`);
  }

  /**
   * Return a graphics object to the pool (or destroy it).
   * @param {Phaser.GameObjects.Graphics} graphics
   */
  _releaseGraphics(graphics) {
    if (this.scene.graphicsFactory) {
      this.scene.graphicsFactory.release(graphics);
    } else {
      graphics.destroy();
    }
  }
}
