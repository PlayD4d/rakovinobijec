/**
 * DevDebugCommands - Debug logging and collision monitoring DEV commands
 */

import { DebugLogger } from '../debug/DebugLogger.js';

export function registerDebugCommands(DEV, getScene) {

    DEV.debug = {
        enable: (category) => DebugLogger.enable(category),
        disable: (category) => DebugLogger.disable(category),
        setLevel: (level) => DebugLogger.setLevel(level),
        preset: (name) => DebugLogger.preset(name),
        list: () => DebugLogger.list(),
        silence: () => DebugLogger.silence(),
        verbose: () => DebugLogger.enableVerbose(),
        reset: () => DebugLogger.reset(),
        showActive: () => DebugLogger.showActive(),
        // Quick preset toggles
        combat: () => DebugLogger.preset('combat'),
        ai: () => DebugLogger.preset('ai'),
        perf: () => DebugLogger.preset('perf'),
        ui: () => DebugLogger.preset('ui'),
        game: () => DebugLogger.preset('game'),
        fx: () => DebugLogger.preset('fx'),
        all: () => DebugLogger.preset('all'),
        none: () => DebugLogger.preset('none')
    };

    // Collision monitoring with interval
    let _monitorInterval = null;

    DEV.startCollisionMonitoring = () => {
        try {
            if (_monitorInterval) clearInterval(_monitorInterval);

            console.log('[DEV] Starting collision monitoring (every 1s)...');
            _monitorInterval = setInterval(() => {
                try {
                    const scene = getScene();
                    if (!scene) return;
                    const stats = scene.projectileSystem?.getStats?.() || { player: 0, enemy: 0 };
                    const enemies = scene.enemyManager?.getActiveCount?.() || 0;
                    const hp = scene.player?.hp || 0;
                    const maxHp = scene.player?.maxHp || 0;
                    console.log(`[MONITOR] Bullets: p=${stats.player || 0} e=${stats.enemy || 0} | Enemies: ${enemies} | HP: ${hp}/${maxHp}`);
                } catch (e) {
                    console.warn('[MONITOR] Stats collection failed:', e.message);
                }
            }, 1000);
        } catch (e) { console.error('[DEV] startCollisionMonitoring failed:', e); }
    };

    DEV.stopCollisionMonitoring = () => {
        try {
            if (_monitorInterval) {
                clearInterval(_monitorInterval);
                _monitorInterval = null;
                console.log('Collision monitoring stopped.');
            } else {
                console.log('No active monitoring.');
            }
        } catch (e) { console.error('[DEV] stopCollisionMonitoring failed:', e); }
    };
}
