/**
 * DevConsole - Singleton DEV tool manager
 * Attaches to active GameScene and registers all DEV.* commands on window.
 * Lazy-loaded via dynamic import in BootstrapManager (dev mode only).
 */

import { DebugLogger } from '../debug/DebugLogger.js';
import { registerSpawnCommands } from './DevSpawnCommands.js';
import { registerPlayerCommands } from './DevPlayerCommands.js';
import { registerSystemCommands } from './DevSystemCommands.js';
import { registerTestCommands } from './DevTestCommands.js';
import { registerDebugCommands } from './DevDebugCommands.js';
import { registerXPValidator } from './DevXPValidator.js';

export class DevConsole {
    static instance = null;

    constructor() {
        this._scene = null;
    }

    static getInstance() {
        if (!DevConsole.instance) DevConsole.instance = new DevConsole();
        return DevConsole.instance;
    }

    get scene() {
        return this._scene;
    }

    attachScene(scene) {
        this._scene = scene;
        this._registerAll();
        DebugLogger.info('dev', '[DevConsole] Attached to scene, DEV commands ready');
    }

    detachScene() {
        this._scene = null;
        DebugLogger.info('dev', '[DevConsole] Detached from scene');
    }

    _registerAll() {
        if (!window.DEV) window.DEV = {};
        const getScene = () => this._scene;

        registerSpawnCommands(window.DEV, getScene);
        registerPlayerCommands(window.DEV, getScene);
        registerSystemCommands(window.DEV, getScene);
        registerTestCommands(window.DEV, getScene);
        registerDebugCommands(window.DEV, getScene);
        registerXPValidator(window.DEV, getScene);

        // --- DEV.inspect namespace for quick diagnostics ---
        window.DEV.inspect = {
            vfx: () => {
                const s = getScene();
                if (!s?.vfxSystem) { console.warn('[DEV] VFX system not available'); return; }
                const stats = s.vfxSystem.getDebugStats?.() || 'getDebugStats not available';
                console.log('VFX Stats:', stats);
                return stats;
            },
            performance: () => {
                const s = getScene();
                const game = window.game || s?.game;
                const report = {
                    fps: game?.loop?.actualFps?.toFixed(1) || 'N/A',
                    enemies: s?.enemyManager?.getActiveCount?.() || 0,
                    projectiles: s?.projectileSystem?.getStats?.() || 'N/A',
                    loot: s?.lootSystem?.getActiveCount?.() || 0,
                    player: {
                        hp: s?.player?.hp || 0,
                        maxHp: s?.player?.maxHp || 0,
                        level: s?.gameStats?.level || 1
                    }
                };
                console.table(report);
                return report;
            },
            config: (path) => {
                const val = window.ConfigResolver?.get(path);
                console.log(`ConfigResolver.get('${path}'):`, val);
                return val;
            },
            modifiers: () => {
                const mods = getScene()?.player?.activeModifiers || [];
                console.log('Active modifiers:', mods);
                return mods;
            },
            blueprints: () => {
                const report = window.ConfigResolver?.getTelemetryReport?.();
                if (report) {
                    console.log('Blueprint telemetry:', report);
                    if (report.missingPaths?.size > 0) {
                        console.warn('Missing paths:', Array.from(report.missingPaths.keys()));
                    }
                }
                return report;
            }
        };

        // --- Help ---
        window.DEV.help = () => {
            console.log('=== DEV Console Commands ===');
            console.log('SPAWN:    spawnEnemy(id,x?,y?), spawnBoss(id,x?,y?), spawnWave(n?,id?), killAll(), clearEnemies(), listEnemies(), listBosses()');
            console.log('PLAYER:   setHealth(hp), setMaxHealth(hp), godMode(), levelUp(n?), addXP(n), setLevel(n), givePowerUp(id,lvl?)');
            console.log('          enableExplosive(r?,d?), enablePiercing(n?)');
            console.log('SYSTEM:   pause(), resume(), victory(), gameOver(), gotoMainMenu(), startGame(), forceLevelTransition(), clearProjectiles()');
            console.log('TEST:     testEnemyBullet(), testHomingBullet(), stressTestBullets(n?), testExplosion(r?)');
            console.log('DEBUG:    debug.enable(cat), debug.disable(cat), debug.setLevel(lvl), debug.preset(name), debug.list(), debug.silence()');
            console.log('          startCollisionMonitoring(), stopCollisionMonitoring()');
            console.log('INSPECT:  inspect.vfx(), inspect.performance(), inspect.config(path), inspect.modifiers(), inspect.blueprints()');
            console.log('XP:       validateXP(spawnTableId?)');
        };

        console.log('[DEV] Console ready. Type DEV.help() for full list.');

        // Validate critical systems
        const missing = ['enemyManager', 'projectileSystem', 'player'].filter(s => !getScene()?.[s]);
        if (missing.length) {
            console.warn(`[DEV] Missing systems: ${missing.join(', ')} - some commands may fail`);
        }
    }
}
