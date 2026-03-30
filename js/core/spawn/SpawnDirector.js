/**
 * SpawnDirector - Systém spawnu řízený daty používající spawn tabulky
 *
 * Spravuje spawn nepřátel na základě spawn tabulek z /data/blueprints/spawn/
 * Zajišťuje vlny, elite okna, unikátní spawny a boss triggery
 *
 * Deleguje na:
 *  - SpawnWaveProcessor (vlny, elity, unikáty)
 *  - BossSpawnController (boss triggery a spawn)
 *  - NgPlusScaler (NG+ škálování s cache)
 */

import { DebugLogger } from '../debug/DebugLogger.js';
import { XpRetuner } from './XpRetuner.js';
import { getSpawnPosition } from './SpawnPositionCalculator.js';
import { processEnemyWaves, processEliteWindows, processUniqueSpawns } from './SpawnWaveProcessor.js';
import { shouldSpawnBoss, spawnBoss } from './BossSpawnController.js';
import { NgPlusScaler } from './NgPlusScaler.js';

export class SpawnDirector {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.blueprints = options.blueprints;
        this.config = options.config || window.ConfigResolver;
        this.vfx = options.vfx;
        this.sfx = options.sfx;

        // Delegate modules
        this._xpRetuner = new XpRetuner(this.blueprints, this.config);
        this._ngPlusScaler = new NgPlusScaler();

        // Aktuální spawn tabulka
        this.currentTable = null;
        this.scenarioId = null;
        this.ngPlusLevel = 0;

        // Stav běhu aplikace
        this.running = false;
        this.startTime = 0; // When spawning started (absolute time)
        this.gameTime = 0; // Still needed for compatibility
        this.lastSpawnTime = 0;

        // Správa vln
        this.currentWaveIndex = 0;
        this.activeWaves = [];

        // Cooldowny (doba čekání)
        this.eliteCooldowns = new Map();
        this.uniqueCooldowns = new Map();
        this.lastBossSpawn = 0;

        // Statistiky
        this.stats = {
            totalSpawned: 0,
            spawnedByType: new Map(),
            eliteSpawnCount: 0,
            uniqueSpawnCount: 0,
            bossSpawnCount: 0,
            spawnedTypes: new Set()
        };

        DebugLogger.info('spawn', 'Initialized');
    }

    /**
     * Načte spawn tabulku pro daný scénář
     */
    async loadSpawnTable(scenarioId) {
        DebugLogger.info('spawn', `Loading spawn table: ${scenarioId}`);

        if (!this.blueprints) {
            DebugLogger.error('spawn', 'No blueprint loader available');
            return false;
        }

        const table = this.blueprints.getSpawnTable(scenarioId);
        if (!table) {
            DebugLogger.error('spawn', `Spawn table not found: ${scenarioId}`);
            return false;
        }

        // Deep-clone to prevent in-place mutation of cached blueprint data
        this.currentTable = structuredClone(table);
        this.scenarioId = scenarioId;

        // PR7: Apply XP retuning if xpPlan exists — use cloned table, not original
        if (this.currentTable.meta?.extensions?.xpPlan) {
            this._xpRetuner.applyXpRetuning(this.currentTable);
        }

        // PR7: Validate boss triggers exist (use clone, not original)
        if (!this.currentTable.bossTriggers) {
            DebugLogger.error('spawn', `Missing bossTriggers in spawn table: ${scenarioId}`);
        } else {
            DebugLogger.debug('spawn', `Boss triggers found:`, this.currentTable.bossTriggers);
        }

        DebugLogger.info('spawn', `✅ Loaded spawn table: ${scenarioId}`);
        DebugLogger.debug('spawn', `  Waves: ${this.currentTable.enemyWaves?.length || 0}`);
        DebugLogger.debug('spawn', `  Elites: ${this.currentTable.eliteWindows?.length || 0}`);
        DebugLogger.debug('spawn', `  Uniques: ${this.currentTable.uniqueSpawns?.length || 0}`);

        return true;
    }

    /**
     * Start spawning
     */
    start(options = {}) {
        if (!this.currentTable) {
            DebugLogger.error('spawn', 'No spawn table loaded');
            return;
        }

        this.scenarioId = options.scenarioId || this.scenarioId;
        this.ngPlusLevel = options.ngPlusLevel || 0;

        this.running = true;
        this.startTime = this.scene.time.now; // Record absolute start time
        this.gameTime = 0; // Reset for compatibility

        // Cache per-frame config values (avoid ConfigResolver.get on every frame)
        this._maxEnemies = 50; // Max active enemies on field

        // Clear NG+ cache on level start to avoid stale scaling
        this._ngPlusScaler.clear();

        // PR7: Reset wave timers when starting new level
        if (this.currentTable.enemyWaves) {
            this.currentTable.enemyWaves.forEach(wave => {
                wave.lastSpawn = 0;
            });
        }

        // Reset boss triggers
        if (this.currentTable.bossTriggers) {
            this.currentTable.bossTriggers.forEach(trigger => {
                trigger._triggered = false;
            });
        }
        this.lastSpawnTime = 0;

        // Reset cooldowns
        this.eliteCooldowns.clear();
        this.uniqueCooldowns.clear();
        this.lastBossSpawn = 0;

        // Reset stats
        this.stats.totalSpawned = 0;
        this.stats.spawnedByType.clear();
        this.stats.eliteSpawnCount = 0;
        this.stats.uniqueSpawnCount = 0;
        this.stats.bossSpawnCount = 0;
        this.stats.spawnedTypes.clear();

        DebugLogger.info('spawn', `Started scenario: ${this.scenarioId}, NG+${this.ngPlusLevel}`);
    }

    /**
     * Reset timers after pause — re-anchor startTime to prevent spawn burst
     */
    resetTimersAfterPause() {
        if (!this.running) return;
        // Re-anchor: keep elapsed gameTime but shift startTime to current moment
        const now = this.scene.time?.now || 0;
        if (now > 0) {
            this.startTime = now - this.gameTime;
        }
    }

    /**
     * Stop spawning
     */
    stop() {
        this.running = false;
        // Cancel pending boss spawn timer
        if (this._pendingBossTimer) {
            this._pendingBossTimer.destroy();
            this._pendingBossTimer = null;
        }
        DebugLogger.info('spawn', 'Stopped');
    }

    /**
     * Update spawn logic
     */
    update(delta) {
        if (!this.running || !this.currentTable) return;

        // Use absolute time instead of delta accumulation
        const time = this.scene.time.now;
        const gameTime = time - this.startTime;
        this.gameTime = gameTime; // Update for compatibility

        // Debug: Show game time every 10 seconds
        if (Math.floor(this.gameTime / 10000) !== Math.floor((this.gameTime - delta) / 10000)) {
            DebugLogger.verbose('spawn', `Game time: ${Math.floor(this.gameTime / 1000)}s`);
        }

        // Check for boss spawn once per second (no need for per-frame checks)
        if (!this._lastBossCheck || gameTime - this._lastBossCheck >= 1000) {
            this._lastBossCheck = gameTime;
            if (shouldSpawnBoss(this)) {
                DebugLogger.info('spawn', `Boss spawn condition met!`);
                spawnBoss(this);
                return;
            }
        }

        // Skip normal spawns if paused (e.g., during boss fight)
        if (this.pauseNormalSpawns) {
            return;
        }

        // Process spawns (delegated to SpawnWaveProcessor)
        processEnemyWaves(this);
        processEliteWindows(this);
        processUniqueSpawns(this);
    }

    /**
     * Get difficulty multipliers for current game time
     * Uses spawn table difficulty config + progressive scaling over time
     */
    getDifficultyMultipliers() {
        const diff = this.currentTable?.difficulty || {};
        const prog = diff.progressiveScaling || {};
        const elapsedSec = this.gameTime / 1000;

        // Base multipliers from spawn table
        const hpMul = (diff.enemyHpMultiplier || 1) + (prog.hpGrowth || 0) * elapsedSec;
        const dmgMul = (diff.enemyDamageMultiplier || 1) + (prog.damageGrowth || 0) * elapsedSec;
        const spdMul = diff.enemySpeedMultiplier || 1;

        return { hp: hpMul, damage: dmgMul, speed: spdMul };
    }

    /**
     * Apply difficulty scaling to a spawned enemy entity
     * EnemyCore uses: hp, maxHp, damage, speed
     */
    _applyDifficultyScaling(enemy) {
        if (!enemy) return;
        const mul = this.getDifficultyMultipliers();
        if (mul.hp > 1 && enemy.hp != null) {
            const scaledHp = Math.ceil(enemy.hp * mul.hp);
            enemy.hp = scaledHp;
            if (enemy.maxHp != null) enemy.maxHp = scaledHp;
        }
        if (mul.damage > 1 && enemy.damage != null) {
            enemy.damage = Math.ceil(enemy.damage * mul.damage);
        }
        if (mul.speed > 1 && enemy.speed != null) {
            enemy.speed = Math.ceil(enemy.speed * mul.speed);
        }
    }

    /**
     * Spawn an enemy from blueprint
     */
    spawnEnemy(enemyId, params = {}) {
        if (!this.blueprints) return;

        const blueprint = this.blueprints.get(enemyId);
        if (!blueprint) {
            DebugLogger.warn('spawn', `Blueprint not found: ${enemyId}`);
            return;
        }

        // Apply NG+ scaling (delegated to NgPlusScaler)
        const scaled = this._ngPlusScaler.apply(blueprint, this.ngPlusLevel, this.blueprints);

        // Get spawn position
        const pos = this.getSpawnPosition();

        // Create enemy entity through EnemyManager
        try {
            // Delegate to EnemyManager if available
            if (this.scene.enemyManager) {
                const enemy = params.boss ?
                    this.scene.enemyManager.spawnBoss(enemyId, pos) :
                    this.scene.enemyManager.spawnEnemy(enemyId, pos);

                if (enemy) {
                    // Apply progressive difficulty scaling to live entity
                    this._applyDifficultyScaling(enemy);
                    this._trackSpawn(enemyId);
                }
                return enemy;
            } else if (this.scene.createEnemyFromBlueprint) {
                // Fallback to scene method if available
                const enemy = this.scene.createEnemyFromBlueprint(enemyId, {
                    x: pos.x, y: pos.y, blueprint: scaled, ...params
                });

                if (enemy?.setDepth) {
                    const enemyDepth = this.scene.DEPTH_LAYERS?.ENEMIES || 1000;
                    enemy.setDepth(enemyDepth);
                }
                if (enemy) this._applyDifficultyScaling(enemy);
                this._trackSpawn(enemyId);
                return enemy;
            } else {
                // No fallback - PR7 compliance requires createEnemyFromBlueprint
                DebugLogger.error('spawn', 'createEnemyFromBlueprint not available - cannot spawn enemies');
            }
        } catch (error) {
            DebugLogger.error('spawn', `Failed to spawn ${enemyId}:`, error);
        }
    }

    /**
     * Spawn an enemy at a specific position (used by bosses for minion spawning)
     */
    spawnAtPosition(enemyId, x, y, params = {}) {
        if (!this.blueprints) return;

        const blueprint = this.blueprints.get(enemyId);
        if (!blueprint) {
            DebugLogger.warn('spawn', `Blueprint not found: ${enemyId}`);
            return;
        }

        // Apply NG+ scaling (delegated to NgPlusScaler)
        const scaled = this._ngPlusScaler.apply(blueprint, this.ngPlusLevel, this.blueprints);

        // Create enemy entity at specific position
        try {
            if (this.scene.createEnemyFromBlueprint) {
                const enemy = this.scene.createEnemyFromBlueprint(enemyId, {
                    x: x,
                    y: y,
                    blueprint: scaled,
                    ...params
                });

                // Ensure proper depth for spawned enemies
                if (enemy && enemy.setDepth) {
                    const enemyDepth = this.scene.DEPTH_LAYERS?.ENEMIES || 1000;
                    enemy.setDepth(enemyDepth);
                }

                this._trackSpawn(enemyId);
                return enemy;
            }
        } catch (error) {
            DebugLogger.error('spawn', `Failed to spawn ${enemyId} at position:`, error);
        }
    }

    /**
     * Get spawn position - delegates to SpawnPositionCalculator
     */
    getSpawnPosition() {
        return getSpawnPosition(this.scene, this.config);
    }

    /**
     * Track spawn in stats (DRY helper — replaces 3 copy-pasted blocks)
     */
    _trackSpawn(enemyId) {
        this.stats.totalSpawned++;
        this.stats.spawnedTypes.add(enemyId);
        const count = this.stats.spawnedByType.get(enemyId) || 0;
        this.stats.spawnedByType.set(enemyId, count + 1);
    }

    /**
     * Random number in range
     */
    randomInRange(range) {
        if (!Array.isArray(range) || range.length !== 2) return 1;
        const [min, max] = range;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Get current spawn info for debug
     */
    getInfo() {
        return {
            scenarioId: this.scenarioId,
            ngPlusLevel: this.ngPlusLevel,
            running: this.running,
            gameTime: Math.floor(this.gameTime / 1000), // seconds
            stats: {
                totalSpawned: this.stats.totalSpawned,
                eliteSpawns: this.stats.eliteSpawnCount,
                uniqueSpawns: this.stats.uniqueSpawnCount,
                bossSpawns: this.stats.bossSpawnCount,
                uniqueTypes: this.stats.spawnedTypes.size
            }
        };
    }

    destroy() {
        this.stop();
        this._xpRetuner = null;
        this._ngPlusScaler = null;
        this.eliteCooldowns?.clear();
        this.uniqueCooldowns?.clear();
        this.currentTable = null;
        this.scene = null;
    }

    /**
     * Get XP reward for a boss (with clamping) - delegates to XpRetuner
     */
    getBossXpReward(bossId) {
        return this._xpRetuner.getBossXpReward(this.currentTable, bossId);
    }
}
