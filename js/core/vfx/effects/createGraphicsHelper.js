/**
 * Shared graphics factory helper for VFX effects (DRY — replaces 3 identical copies)
 * PR7: Tries GraphicsFactory first, falls back to scene.add.graphics
 *
 * @param {Phaser.Scene} scene
 * @param {string} label - Effect name for debug logging
 * @returns {Phaser.GameObjects.Graphics|null}
 */
import { DebugLogger } from '../../debug/DebugLogger.js';

export function createGraphicsForEffect(scene, label = 'Effect') {
    if (scene.graphicsFactory) {
        return scene.graphicsFactory.create();
    }

    if (scene.vfxSystem?._createGraphics) {
        return scene.vfxSystem._createGraphics();
    }

    if (scene?.add?.graphics) {
        DebugLogger.warn('vfx', `[${label}] Using scene.add.graphics fallback — needs GraphicsFactory`);
        return scene.add.graphics();
    }

    DebugLogger.error('vfx', `[${label}] Cannot create graphics — no factory available`);
    return null;
}
