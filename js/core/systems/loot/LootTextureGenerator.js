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

    // ==================== XP Gems (6 tiers — diamonds, size+color scales with value) ====================

    // Tier 1: Small (1 XP) — tiny cyan diamond
    if (!textures.exists('item_xp_small')) {
        const g = gf.create(); const s = 6;
        g.fillStyle(0x00C8DD, 0.7);
        g.fillPoints([{ x: s/2, y: 0 }, { x: s, y: s/2 }, { x: s/2, y: s }, { x: 0, y: s/2 }], true);
        g.generateTexture('item_xp_small', s, s); gf.release(g);
    }

    // Tier 2: Tiny (2 XP) — small blue diamond
    if (!textures.exists('item_xp_tiny')) {
        const g = gf.create(); const s = 7;
        g.fillStyle(0x4499FF, 0.8);
        g.fillPoints([{ x: s/2, y: 0 }, { x: s, y: s/2 }, { x: s/2, y: s }, { x: 0, y: s/2 }], true);
        g.fillStyle(0xFFFFFF, 0.5); g.fillCircle(s/2, s/2, 1);
        g.generateTexture('item_xp_tiny', s, s); gf.release(g);
    }

    // Tier 3: Medium (5 XP) — green diamond
    if (!textures.exists('item_xp_medium')) {
        const g = gf.create(); const s = 9;
        g.fillStyle(0x00DD77, 0.8);
        g.fillPoints([{ x: s/2, y: 0 }, { x: s, y: s/2 }, { x: s/2, y: s }, { x: 0, y: s/2 }], true);
        g.fillStyle(0xFFFFFF, 0.6); g.fillCircle(s/2, s/2, 1.5);
        g.generateTexture('item_xp_medium', s, s); gf.release(g);
    }

    // Tier 4: Large (10 XP) — gold diamond
    if (!textures.exists('item_xp_large')) {
        const g = gf.create(); const s = 11;
        g.fillStyle(0xDDBB00, 0.85);
        g.fillPoints([{ x: s/2, y: 0 }, { x: s, y: s/2 }, { x: s/2, y: s }, { x: 0, y: s/2 }], true);
        g.fillStyle(0xFFFFFF, 0.7); g.fillCircle(s/2, s/2, 2);
        g.generateTexture('item_xp_large', s, s); gf.release(g);
    }

    // Tier 5: Big (25 XP) — orange diamond
    if (!textures.exists('item_xp_big')) {
        const g = gf.create(); const s = 13;
        g.fillStyle(0xFF8800, 0.9);
        g.fillPoints([{ x: s/2, y: 0 }, { x: s, y: s/2 }, { x: s/2, y: s }, { x: 0, y: s/2 }], true);
        g.fillStyle(0xFFDD88, 0.5);
        g.fillPoints([{ x: s/2, y: 2 }, { x: s-2, y: s/2 }, { x: s/2, y: s-2 }, { x: 2, y: s/2 }], true);
        g.fillStyle(0xFFFFFF, 0.8); g.fillCircle(s/2, s/2, 2);
        g.generateTexture('item_xp_big', s, s); gf.release(g);
    }

    // Tier 6: Diamond (50 XP) — white/prismatic diamond
    if (!textures.exists('item_xp_diamond')) {
        const g = gf.create(); const s = 16;
        g.fillStyle(0xFFFFFF, 0.95);
        g.fillPoints([{ x: s/2, y: 0 }, { x: s, y: s/2 }, { x: s/2, y: s }, { x: 0, y: s/2 }], true);
        g.fillStyle(0xAADDFF, 0.4);
        g.fillPoints([{ x: s/2, y: 2 }, { x: s-2, y: s/2 }, { x: s/2, y: s-2 }, { x: 2, y: s/2 }], true);
        g.fillStyle(0xFFFFFF, 0.9); g.fillCircle(s/2, s/2, 3);
        g.generateTexture('item_xp_diamond', s, s); gf.release(g);
    }

    // Superorb (red pulsing gem — accumulates XP when field is full)
    if (!textures.exists('item_xp_super')) {
        const g = gf.create(); const s = 20;
        // Outer glow
        g.fillStyle(0xFF2200, 0.4);
        g.fillPoints([{ x: s/2, y: 0 }, { x: s, y: s/2 }, { x: s/2, y: s }, { x: 0, y: s/2 }], true);
        // Inner bright red
        g.fillStyle(0xFF4444, 1);
        g.fillPoints([{ x: s/2, y: 2 }, { x: s-2, y: s/2 }, { x: s/2, y: s-2 }, { x: 2, y: s/2 }], true);
        // White center highlight
        g.fillStyle(0xFFAAAA, 0.9);
        g.fillPoints([{ x: s/2, y: 5 }, { x: s-5, y: s/2 }, { x: s/2, y: s-5 }, { x: 5, y: s/2 }], true);
        g.generateTexture('item_xp_super', s, s); gf.release(g);
    }

    // Magnet texture generated below after ITEM_SIZE/CX/CY/HEX_R are defined

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

    // Magnet pickup — blue hexagon with U shape
    if (!textures.exists('item_magnet')) {
        const g = gf.create();
        drawHexagon(g, CX, CY, HEX_R, 0x2196F3, 1, 0x64B5F6, 1.5);
        g.fillStyle(0xFFFFFF, 1);
        g.fillRect(CX - 4, CY - 3, 2, 5);
        g.fillRect(CX + 2, CY - 3, 2, 5);
        g.fillRect(CX - 4, CY + 1, 8, 2);
        g.generateTexture('item_magnet', ITEM_SIZE, ITEM_SIZE); gf.release(g);
    }

    // Adrenaline Shot — orange hexagon with A
    if (!textures.exists('item_adrenaline_shot')) {
        const g = gf.create();
        drawHexagon(g, CX, CY, HEX_R, 0xE65100, 1, 0xFF9800, 1.5);
        drawSymbol(g, CX, CY, 'A');
        g.generateTexture('item_adrenaline_shot', ITEM_SIZE, ITEM_SIZE);
        gf.release(g);
    }

    // Cell Membrane — teal hexagon with C
    if (!textures.exists('item_cell_membrane')) {
        const g = gf.create();
        drawHexagon(g, CX, CY, HEX_R, 0x00695C, 1, 0x4DB6AC, 1.5);
        drawSymbol(g, CX, CY, 'C');
        g.generateTexture('item_cell_membrane', ITEM_SIZE, ITEM_SIZE);
        gf.release(g);
    }

    // Mutation Catalyst — red-orange hexagon with X
    if (!textures.exists('item_mutation_catalyst')) {
        const g = gf.create();
        drawHexagon(g, CX, CY, HEX_R, 0xBF360C, 1, 0xFF6E40, 1.5);
        drawSymbol(g, CX, CY, 'X');
        g.generateTexture('item_mutation_catalyst', ITEM_SIZE, ITEM_SIZE);
        gf.release(g);
    }

    // ==================== Loot Chests (VS-style — larger, distinct shape) ====================
    const CHEST_S = 28;
    const CC = CHEST_S / 2;

    function drawChest(g, color, strokeColor, tierSymbol) {
        // Box body
        g.fillStyle(color, 1);
        g.fillRect(3, 8, CHEST_S - 6, CHEST_S - 12);
        // Lid (slightly wider)
        g.fillStyle(color, 1);
        g.fillRect(2, 6, CHEST_S - 4, 6);
        // Stroke
        g.lineStyle(1.5, strokeColor, 0.9);
        g.strokeRect(2, 6, CHEST_S - 4, CHEST_S - 10);
        // Lock/clasp
        g.fillStyle(0xFFFFFF, 0.9);
        g.fillRect(CC - 2, 10, 4, 4);
        // Tier symbol inside
        g.fillStyle(0xFFFFFF, 0.8);
        g.fillCircle(CC, 20, 3);
    }

    if (!textures.exists('item_chest_gold')) {
        const g = gf.create();
        drawChest(g, 0xCCA200, 0xFFD700, 'G');
        g.generateTexture('item_chest_gold', CHEST_S, CHEST_S); gf.release(g);
    }
    if (!textures.exists('item_chest_silver')) {
        const g = gf.create();
        drawChest(g, 0x888899, 0xC0C0C0, 'S');
        g.generateTexture('item_chest_silver', CHEST_S, CHEST_S); gf.release(g);
    }
    if (!textures.exists('item_chest_bronze')) {
        const g = gf.create();
        drawChest(g, 0x8B5E3C, 0xCD7F32, 'B');
        g.generateTexture('item_chest_bronze', CHEST_S, CHEST_S); gf.release(g);
    }

    DebugLogger.info('loot', 'Item textures generated (hexagonal design + chests)');
}
