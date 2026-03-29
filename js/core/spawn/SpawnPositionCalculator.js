/**
 * SpawnPositionCalculator - Calculates spawn positions outside camera view
 *
 * Extracted from SpawnDirector for modularity.
 * Uses plain Math instead of Phaser.Math utilities.
 */

import { DebugLogger } from '../debug/DebugLogger.js';

/**
 * Get a spawn position outside the camera view but within world bounds.
 * Ensures minimum distance from the player.
 *
 * @param {Phaser.Scene} scene - The game scene
 * @param {Object} [config] - Optional ConfigResolver instance
 * @returns {{ x: number, y: number }}
 */
export function getSpawnPosition(scene, config) {
    const camera = scene.cameras.main;
    const margin = 100;  // Increased from 50 to ensure spawns are off-screen
    const player = scene.player;
    const MIN_PLAYER_DISTANCE = 150;
    const MIN_PLAYER_DISTANCE_SQ = MIN_PLAYER_DISTANCE * MIN_PLAYER_DISTANCE;

    // Get world bounds for clamping
    const worldBounds = scene.physics?.world?.bounds;
    const minX = worldBounds?.x || 0;
    const minY = worldBounds?.y || 0;
    const maxX = worldBounds ? (worldBounds.x + worldBounds.width) : scene.scale.width;
    const maxY = worldBounds ? (worldBounds.y + worldBounds.height) : scene.scale.height;

    let x, y;
    let attempts = 0;
    const maxAttempts = 10;

    // Try to find a valid spawn position away from player
    do {
        // Spawn outside camera view but within world bounds
        const side = Math.floor(Math.random() * 4);

        switch (side) {
            case 0: // Top
                x = camera.scrollX + Math.random() * camera.width;
                y = camera.scrollY - margin;
                break;
            case 1: // Right
                x = camera.scrollX + camera.width + margin;
                y = camera.scrollY + Math.random() * camera.height;
                break;
            case 2: // Bottom
                x = camera.scrollX + Math.random() * camera.width;
                y = camera.scrollY + camera.height + margin;
                break;
            case 3: // Left
                x = camera.scrollX - margin;
                y = camera.scrollY + Math.random() * camera.height;
                break;
        }

        // HOTFIX V4: Add position variance to avoid repetitive corner spawns
        const variance = 32;
        x += -variance + Math.random() * (variance * 2);
        y += -variance + Math.random() * (variance * 2);

        // Clamp position to world bounds with margin
        const worldMargin = 50;  // Increased from 24 to prevent edge spawns
        x = Math.max(minX + worldMargin, Math.min(maxX - worldMargin, x));
        y = Math.max(minY + worldMargin, Math.min(maxY - worldMargin, y));

        attempts++;

        // Check distance from player
        if (player && player.active) {
            const dx = x - player.x;
            const dy = y - player.y;
            if (dx * dx + dy * dy >= MIN_PLAYER_DISTANCE_SQ) {
                break; // Found valid position
            }
        } else {
            break; // No player, any position is valid
        }
    } while (attempts < maxAttempts);

    // Only log in debug mode
    if (config?.get?.('debug.spawnLogging', { defaultValue: false })) {
        DebugLogger.verbose('spawn', `Spawn position: (${Math.floor(x)}, ${Math.floor(y)}) attempts=${attempts}`);
    }

    return { x, y };
}
