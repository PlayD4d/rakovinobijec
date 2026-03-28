/**
 * LootTextureGenerator - Programmatic texture generation for loot items
 *
 * Extracted from SimpleLootSystem to keep it under 500 LOC.
 * Uses GraphicsFactory (PR7 compliant) to generate all item textures.
 */

import { DebugLogger } from '../../debug/DebugLogger.js';

/**
 * Generate all loot item textures programmatically
 * @param {Phaser.Scene} scene - The scene to generate textures in
 */
export function generateLootTextures(scene) {
    const textures = scene.textures;
    const graphicsFactory = scene.graphicsFactory;

    if (!graphicsFactory) {
        DebugLogger.warn('loot', 'GraphicsFactory not available, skipping texture generation');
        return;
    }

    // XP Gem - Small (bright cyan diamond, 8px)
    if (!textures.exists('item_xp_small')) {
        const graphics = graphicsFactory.create();
        const s = 8;
        // Diamond shape — distinct from circular enemies
        graphics.fillStyle(0x00F0FF, 1.0);
        graphics.fillPoints([
            { x: s/2, y: 0 }, { x: s, y: s/2 },
            { x: s/2, y: s }, { x: 0, y: s/2 }
        ], true);
        // Bright center highlight
        graphics.fillStyle(0xFFFFFF, 0.9);
        graphics.fillCircle(s/2, s/2, 1.5);
        graphics.generateTexture('item_xp_small', s, s);
        graphicsFactory.release(graphics);
    }

    // XP Gem - Medium (green diamond, 10px)
    if (!textures.exists('item_xp_medium')) {
        const graphics = graphicsFactory.create();
        const s = 10;
        graphics.fillStyle(0x00FF88, 1.0);
        graphics.fillPoints([
            { x: s/2, y: 0 }, { x: s, y: s/2 },
            { x: s/2, y: s }, { x: 0, y: s/2 }
        ], true);
        // Inner facet
        graphics.fillStyle(0x88FFCC, 0.6);
        graphics.fillPoints([
            { x: s/2, y: 2 }, { x: s-2, y: s/2 },
            { x: s/2, y: s-2 }, { x: 2, y: s/2 }
        ], true);
        graphics.fillStyle(0xFFFFFF, 0.9);
        graphics.fillCircle(s/2, s/2, 2);
        graphics.generateTexture('item_xp_medium', s, s);
        graphicsFactory.release(graphics);
    }

    // XP Gem - Large (golden diamond, 14px)
    if (!textures.exists('item_xp_large')) {
        const graphics = graphicsFactory.create();
        const s = 14;
        graphics.fillStyle(0xFFDD00, 1.0);
        graphics.fillPoints([
            { x: s/2, y: 0 }, { x: s, y: s/2 },
            { x: s/2, y: s }, { x: 0, y: s/2 }
        ], true);
        // Inner facet
        graphics.fillStyle(0xFFEE66, 0.6);
        graphics.fillPoints([
            { x: s/2, y: 2 }, { x: s-2, y: s/2 },
            { x: s/2, y: s-2 }, { x: 2, y: s/2 }
        ], true);
        graphics.fillStyle(0xFFFFFF, 0.9);
        graphics.fillCircle(s/2, s/2, 3);
        graphics.generateTexture('item_xp_large', s, s);
        graphicsFactory.release(graphics);
    }

    // Health Small (red circle with cross, 16px)
    if (!textures.exists('item_health_small')) {
        const graphics = graphicsFactory.create();
        const size = 16;
        graphics.fillStyle(0xFF0000, 1);
        graphics.fillCircle(size/2, size/2, size/2);
        graphics.fillStyle(0xFFFFFF, 1);
        graphics.fillRect(size/2 - 1, size/4, 2, size/2);
        graphics.fillRect(size/4, size/2 - 1, size/2, 2);
        graphics.generateTexture('item_health_small', size, size);
        graphicsFactory.release(graphics);
    }

    // Heal Orb (larger red circle, 20px)
    if (!textures.exists('item_heal_orb')) {
        const graphics = graphicsFactory.create();
        const size = 20;
        graphics.fillStyle(0xFF3333, 1);
        graphics.fillCircle(size/2, size/2, size/2);
        graphics.fillStyle(0xFF0000, 0.8);
        graphics.fillCircle(size/2, size/2, size/2 - 2);
        graphics.fillStyle(0xFFFFFF, 1);
        graphics.fillRect(size/2 - 2, size/4, 4, size/2);
        graphics.fillRect(size/4, size/2 - 2, size/2, 4);
        graphics.generateTexture('item_heal_orb', size, size);
        graphicsFactory.release(graphics);
    }

    // Protein Cache (green capsule, 18px)
    if (!textures.exists('item_protein_cache')) {
        const graphics = graphicsFactory.create();
        const size = 18;
        graphics.fillStyle(0x00FF00, 1);
        graphics.fillRoundedRect(size/4, 0, size/2, size, 4);
        graphics.fillStyle(0xFFFFFF, 1);
        graphics.fillCircle(size/2, size/2, 3);
        graphics.generateTexture('item_protein_cache', size, size);
        graphicsFactory.release(graphics);
    }

    // Metotrexat (purple circle, 18px)
    if (!textures.exists('item_metotrexat')) {
        const graphics = graphicsFactory.create();
        const size = 18;
        graphics.fillStyle(0x9C27B0, 1);
        graphics.fillCircle(size/2, size/2, size/2);
        graphics.fillStyle(0xE91E63, 0.5);
        graphics.fillCircle(size/2, size/2, size/2 - 2);
        graphics.fillStyle(0xFFFFFF, 1);
        graphics.fillCircle(size/2, size/2, 4);
        graphics.generateTexture('item_metotrexat', size, size);
        graphicsFactory.release(graphics);
    }

    // Metotrexat orb variant
    if (!textures.exists('metotrexat_orb')) {
        const graphics = graphicsFactory.create();
        graphics.fillStyle(0xff00ff, 1);
        graphics.fillCircle(8, 8, 8);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(8, 8, 3);
        graphics.generateTexture('metotrexat_orb', 16, 16);
        graphicsFactory.release(graphics);
    }

    // Energy Cell (yellow lightning bolt, 18px)
    if (!textures.exists('item_energy_cell')) {
        const graphics = graphicsFactory.create();
        const size = 18;
        graphics.fillStyle(0xFFDD00, 1);
        graphics.fillCircle(size/2, size/2, size/2);
        graphics.fillStyle(0xFFFF88, 0.8);
        graphics.fillCircle(size/2, size/2, size/2 - 2);
        graphics.fillStyle(0xFFFFFF, 1);
        graphics.fillRect(size/2 - 1, size/4, 3, size/2);
        graphics.generateTexture('item_energy_cell', size, size);
        graphicsFactory.release(graphics);
    }

    // Research Point (blue diamond, 16px)
    if (!textures.exists('item_research_point')) {
        const graphics = graphicsFactory.create();
        const size = 16;
        graphics.fillStyle(0x4488FF, 1);
        graphics.fillCircle(size/2, size/2, size/2);
        graphics.fillStyle(0x88BBFF, 0.8);
        graphics.fillCircle(size/2, size/2, size/2 - 2);
        graphics.fillStyle(0xFFFFFF, 1);
        graphics.fillCircle(size/2, size/2, 3);
        graphics.generateTexture('item_research_point', size, size);
        graphicsFactory.release(graphics);
    }

    DebugLogger.info('loot', 'Item textures generated');
}
