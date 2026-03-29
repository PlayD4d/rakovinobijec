/**
 * Shared graphics factory helper for VFX effects (DRY — replaces 3 identical copies)
 * PR7: REQUIRES GraphicsFactory — no silent fallbacks
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

    DebugLogger.error('vfx', `[${label}] GraphicsFactory not available — cannot create graphics`);
    console.error(`[${label}] MISSING: scene.graphicsFactory — ensure BootstrapManager initialized GraphicsFactory`);
    return null;
}
