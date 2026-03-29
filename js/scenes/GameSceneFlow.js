/**
 * GameSceneFlow - Game flow helper functions for GameScene
 *
 * Extracted from GameScene to keep it under 500 LOC.
 * Handles XP orb creation, enemy killing, loot drops, and special item effects.
 * All functions take `scene` as first parameter for clean delegation.
 */

import { DebugLogger } from '../core/debug/DebugLogger.js';

/**
 * Create XP orbs based on XP amount (tiered: small=1, medium=5, large=10)
 */
export function createXPOrbs(scene, x, y, totalXP) {
    if (!totalXP || totalXP <= 0 || !scene.lootSystem) return;

    const largeOrbs = Math.floor(totalXP / 10);
    const remaining = totalXP % 10;
    const mediumOrbs = Math.floor(remaining / 5);
    const smallOrbs = remaining % 5;

    const spawn = (count, itemId) => {
        for (let i = 0; i < count; i++) {
            const ox = (Math.random() - 0.5) * 30;
            const oy = (Math.random() - 0.5) * 30;
            scene.lootSystem.createDrop(x + ox, y + oy, itemId);
        }
    };

    spawn(largeOrbs, 'item.xp_large');
    spawn(mediumOrbs, 'item.xp_medium');
    spawn(smallOrbs, 'item.xp_small');
}

/**
 * Kill all enemies (for special items like Metotrexat)
 */
export function killAllEnemies(scene) {
    // Delegate to EnemyManager (single source of truth for enemy operations)
    if (scene.enemyManager) {
        scene.enemyManager.killAll();
    }
    scene.flashCamera();
}

/**
 * Handle Metotrexat pickup - kill all enemies + flash + SFX
 */
export function handleMetotrexatPickup(scene) {
    DebugLogger.info('general', '[GameScene] METOTREXAT! Eliminating all enemies!');

    // Flash effect
    scene.flashCamera();

    // Delegate to EnemyManager (single source of truth for enemy operations)
    if (scene.enemyManager) scene.enemyManager.killAll();

    // Play metotrexat SFX
    if (scene.audioSystem) {
        const blueprint = scene.blueprintLoader?.getBlueprint('powerup.metotrexat');
        const pickupSFX = blueprint?.sfx?.pickup;
        if (pickupSFX) {
            scene.audioSystem.play(pickupSFX);
        }
    }
}

/**
 * Spawn a drop from an item blueprint
 */
export function spawnDrop(scene, itemId, x, y) {
    if (!scene.lootSystem || !itemId) return;

    // Get item blueprint
    const itemBlueprint = scene.blueprintLoader?.get(itemId);
    if (!itemBlueprint) {
        DebugLogger.warn('game', `[GameScene] Item blueprint not found: ${itemId}`);
        return;
    }

    // PR7: Use LootSystem to create the drop (single source of truth)
    scene.lootSystem.createDrop(x, y, itemId);
}

/**
 * Spawn a loot drop from a drop definition (used by enemy death handlers)
 */
export function spawnLootDrop(scene, drop, x, y) {
    const dropId = drop?.itemId || drop?.ref;
    if (!dropId) return;
    if (scene.lootSystem) {
        scene.lootSystem.createDrop(x, y, dropId);
    }
}

/**
 * Attract an XP orb toward the player (magnet is now handled natively by SimpleLootSystem.update)
 */
export function attractXPOrb(scene, orb) {
    // No-op — magnet attraction is handled per-frame in SimpleLootSystem.update()
}
