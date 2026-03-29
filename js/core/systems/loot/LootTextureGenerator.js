/**
 * LootTextureGenerator - Programmatic texture generation for loot items
 *
 * Design principles:
 * - XP orbs: small diamonds, muted colors — background layer
 * - Loot items: uniform hexagonal shape with letter symbol — mid layer
 * - All items same size (20px) for visual consistency
 * - Hexagon shape = unique, never confused with circular/square enemies
 * - Letter inside identifies item type at a glance
 */

import { DebugLogger } from '../../debug/DebugLogger.js';

/** Draw a regular hexagon centered at (cx, cy) with given radius */
function drawHexagon(graphics, cx, cy, radius, fillColor, fillAlpha = 1, strokeColor = null, strokeWidth = 0) {
    const points = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2; // Start from top
        points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    }
    graphics.fillStyle(fillColor, fillAlpha);
    graphics.fillPoints(points, true);
    if (strokeColor != null && strokeWidth > 0) {
        graphics.lineStyle(strokeWidth, strokeColor, 0.8);
        graphics.strokePoints(points, true);
    }
}

/** Draw a simple letter/symbol centered at (cx, cy) */
function drawSymbol(graphics, cx, cy, symbol, color = 0xFFFFFF) {
    graphics.fillStyle(color, 1);
    switch (symbol) {
        case '+': // Health cross
            graphics.fillRect(cx - 1, cy - 4, 3, 8);
            graphics.fillRect(cx - 4, cy - 1, 8, 3);
            break;
        case 'M': // Metotrexat
            graphics.fillRect(cx - 4, cy - 3, 2, 7); // left
            graphics.fillRect(cx + 2, cy - 3, 2, 7); // right
            graphics.fillRect(cx - 2, cy - 1, 2, 3); // mid-left
            graphics.fillRect(cx, cy - 1, 2, 3);      // mid-right
            break;
        case 'E': // Energy
            graphics.fillRect(cx - 3, cy - 3, 2, 7);
            graphics.fillRect(cx - 1, cy - 3, 5, 2);
            graphics.fillRect(cx - 1, cy - 1, 4, 2);
            graphics.fillRect(cx - 1, cy + 2, 5, 2);
            break;
        case 'R': // Research
            graphics.fillRect(cx - 3, cy - 3, 2, 7);
            graphics.fillRect(cx - 1, cy - 3, 4, 2);
            graphics.fillRect(cx + 2, cy - 1, 2, 2);
            graphics.fillRect(cx - 1, cy - 1, 4, 2);
            graphics.fillRect(cx + 1, cy + 1, 2, 3);
            break;
        case 'P': // Protein
            graphics.fillRect(cx - 3, cy - 3, 2, 7);
            graphics.fillRect(cx - 1, cy - 3, 4, 2);
            graphics.fillRect(cx + 2, cy - 1, 2, 2);
            graphics.fillRect(cx - 1, cy - 1, 4, 2);
            break;
        default: // Dot
            graphics.fillCircle(cx, cy, 2);
    }
}

export function generateLootTextures(scene) {
    const textures = scene.textures;
    const gf = scene.graphicsFactory;
    if (!gf) return;

    // ==================== XP Gems (diamonds — small, muted) ====================

    // XP Small — tiny cyan diamond
    if (!textures.exists('item_xp_small')) {
        const g = gf.create();
        const s = 8;
        g.fillStyle(0x00C8DD, 0.8);
        g.fillPoints([{ x: s/2, y: 0 }, { x: s, y: s/2 }, { x: s/2, y: s }, { x: 0, y: s/2 }], true);
        g.fillStyle(0xFFFFFF, 0.6);
        g.fillCircle(s/2, s/2, 1);
        g.generateTexture('item_xp_small', s, s);
        gf.release(g);
    }

    // XP Medium — green diamond
    if (!textures.exists('item_xp_medium')) {
        const g = gf.create();
        const s = 10;
        g.fillStyle(0x00DD77, 0.8);
        g.fillPoints([{ x: s/2, y: 0 }, { x: s, y: s/2 }, { x: s/2, y: s }, { x: 0, y: s/2 }], true);
        g.fillStyle(0xFFFFFF, 0.7);
        g.fillCircle(s/2, s/2, 1.5);
        g.generateTexture('item_xp_medium', s, s);
        gf.release(g);
    }

    // XP Large — gold diamond
    if (!textures.exists('item_xp_large')) {
        const g = gf.create();
        const s = 12;
        g.fillStyle(0xDDBB00, 0.8);
        g.fillPoints([{ x: s/2, y: 0 }, { x: s, y: s/2 }, { x: s/2, y: s }, { x: 0, y: s/2 }], true);
        g.fillStyle(0xFFFFFF, 0.8);
        g.fillCircle(s/2, s/2, 2);
        g.generateTexture('item_xp_large', s, s);
        gf.release(g);
    }

    // ==================== Loot Items (hexagons — uniform 20px) ====================
    const ITEM_SIZE = 20;
    const HEX_R = 8; // hexagon radius
    const CX = ITEM_SIZE / 2;
    const CY = ITEM_SIZE / 2;

    // Health Small — red hexagon with ✚
    if (!textures.exists('item_health_small')) {
        const g = gf.create();
        drawHexagon(g, CX, CY, HEX_R, 0xCC0000, 1, 0xFF4444, 1.5);
        drawSymbol(g, CX, CY, '+');
        g.generateTexture('item_health_small', ITEM_SIZE, ITEM_SIZE);
        gf.release(g);
    }

    // Heal Orb — brighter red hexagon with ✚ (larger heal)
    if (!textures.exists('item_heal_orb')) {
        const g = gf.create();
        drawHexagon(g, CX, CY, HEX_R, 0xFF2222, 1, 0xFF6666, 1.5);
        drawSymbol(g, CX, CY, '+');
        g.generateTexture('item_heal_orb', ITEM_SIZE, ITEM_SIZE);
        gf.release(g);
    }

    // Protein Cache — green hexagon with P
    if (!textures.exists('item_protein_cache')) {
        const g = gf.create();
        drawHexagon(g, CX, CY, HEX_R, 0x00AA00, 1, 0x44DD44, 1.5);
        drawSymbol(g, CX, CY, 'P');
        g.generateTexture('item_protein_cache', ITEM_SIZE, ITEM_SIZE);
        gf.release(g);
    }

    // Metotrexat — purple hexagon with M
    if (!textures.exists('item_metotrexat')) {
        const g = gf.create();
        drawHexagon(g, CX, CY, HEX_R, 0x7B1FA2, 1, 0xCE93D8, 1.5);
        drawSymbol(g, CX, CY, 'M');
        g.generateTexture('item_metotrexat', ITEM_SIZE, ITEM_SIZE);
        gf.release(g);
    }

    // Metotrexat orb variant (same design)
    if (!textures.exists('metotrexat_orb')) {
        const g = gf.create();
        drawHexagon(g, CX, CY, HEX_R, 0x9C27B0, 1, 0xE040FB, 1.5);
        drawSymbol(g, CX, CY, 'M');
        g.generateTexture('metotrexat_orb', ITEM_SIZE, ITEM_SIZE);
        gf.release(g);
    }

    // Energy Cell — yellow hexagon with E
    if (!textures.exists('item_energy_cell')) {
        const g = gf.create();
        drawHexagon(g, CX, CY, HEX_R, 0xCC9900, 1, 0xFFDD44, 1.5);
        drawSymbol(g, CX, CY, 'E');
        g.generateTexture('item_energy_cell', ITEM_SIZE, ITEM_SIZE);
        gf.release(g);
    }

    // Research Point — blue hexagon with R
    if (!textures.exists('item_research_point')) {
        const g = gf.create();
        drawHexagon(g, CX, CY, HEX_R, 0x1565C0, 1, 0x42A5F5, 1.5);
        drawSymbol(g, CX, CY, 'R');
        g.generateTexture('item_research_point', ITEM_SIZE, ITEM_SIZE);
        gf.release(g);
    }

    DebugLogger.info('loot', 'Item textures generated (hexagonal design)');
}
