/**
 * GameSceneFlow - Game flow helper functions for GameScene
 *
 * Extracted from GameScene to keep it under 500 LOC.
 * Handles XP orb creation, enemy killing, loot drops, and special item effects.
 * All functions take `scene` as first parameter for clean delegation.
 */

import { DebugLogger } from '../core/debug/DebugLogger.js';
import { TelemetryLogger } from '../core/TelemetryLogger.js';
import { DebugOverlay } from '../utils/DebugOverlay.js';

/**
 * Create XP orbs based on XP amount (tiered: small=1, medium=5, large=10)
 */
/**
 * Drop exactly 1 XP gem per kill — tier based on total XP value.
 * VS-style: no multi-orb scatter, clean 1:1 kill-to-gem mapping.
 *
 * Tiers: small(1), tiny(2), medium(5), large(10), big(25), diamond(50)
 */
export function createXPOrbs(scene, x, y, totalXP) {
    if (!totalXP || totalXP <= 0 || !scene.lootSystem) return;

    // Select the best single gem tier for this XP amount
    let itemId;
    if (totalXP >= 50)      itemId = 'item.xp_diamond';
    else if (totalXP >= 25) itemId = 'item.xp_big';
    else if (totalXP >= 10) itemId = 'item.xp_large';
    else if (totalXP >= 5)  itemId = 'item.xp_medium';
    else if (totalXP >= 2)  itemId = 'item.xp_tiny';
    else                    itemId = 'item.xp_small';

    const drop = scene.lootSystem.createDrop(x, y, itemId);
    // Override gem value with exact enemy XP (tier is visual only, value is precise)
    if (drop) drop.value = totalXP;
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

/**
 * Preload all audio files from the generated manifest
 */
export function preloadAllAudio(scene) {
    scene.load.json('audio_manifest', '/data/generated/audio_manifest.json');
    scene.load.on('filecomplete-json-audio_manifest', (key, type, data) => {
        if (!data?.audio) {
            DebugLogger.error('bootstrap', '[AudioPreload] Invalid or missing audio manifest!');
            return;
        }
        let loadedCount = 0;
        DebugLogger.info('bootstrap', `[AudioPreload] Loading ${data.audio.length} files from manifest v${data.version}`);
        data.audio.forEach(path => {
            const k = path.replace(/[^a-zA-Z0-9]/g, '_');
            if (!scene.cache.audio.has(k)) { scene.load.audio(k, path); loadedCount++; }
        });
        DebugLogger.info('bootstrap', `[AudioPreload] Prepared ${loadedCount} audio files`);
    });
}

/**
 * Show a critical error message via the UI scene
 */
export function showCriticalError(scene, title, message) {
    const uiScene = scene.scene.get('GameUIScene');
    if (uiScene?.events) {
        uiScene.events.emit('show-error', { title, message });
    } else {
        DebugLogger.error('game', '[GameScene] Critical error:', title, message);
    }
}

/**
 * Update game time counter
 */
export function updateTime(scene) {
    if (!scene.isPaused && !scene.isGameOver) {
        scene.gameStats.time++;
    }
}

/**
 * Handle window resize
 */
/**
 * Initialize debug/telemetry systems
 */
export function initializeDebugSystems(scene) {
    try {
        scene.telemetryLogger = new TelemetryLogger(scene);
        if (!scene.debugOverlay) {
            scene.debugOverlay = new DebugOverlay(scene);
        }
    } catch (error) {
        DebugLogger.warn('game', 'Debug systems init failed:', error);
    }
}

export function handleResize(scene, gameSize) {
    const { width, height } = gameSize;
    scene.mainCam?.setSize(width, height);
    scene.uiCam?.setSize(width, height);
    scene.pauseMenu?.onResize?.(width, height);
    if (scene.mobileControls?.enabled) scene.mobileControls.handleResize(width, height);
}
