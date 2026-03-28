/**
 * SpawnDirector - Systém spawnu řízený daty používající spawn tabulky
 * 
 * Spravuje spawn nepřátel na základě spawn tabulek z /data/blueprints/spawn/
 * Zajišťuje vlny, elite okna, unikátní spawny a boss triggery
 */

import { DebugLogger } from '../debug/DebugLogger.js';
import { XpRetuner } from './XpRetuner.js';
import { getSpawnPosition } from './SpawnPositionCalculator.js';

export class SpawnDirector {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.blueprints = options.blueprints;
        this.config = options.config || window.ConfigResolver;
        this.vfx = options.vfx;
        this.sfx = options.sfx;

        // Delegate modules
        this._xpRetuner = new XpRetuner(this.blueprints, this.config);
        
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
        this.currentTable = JSON.parse(JSON.stringify(table));
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

        // Clear NG+ cache on level start to avoid stale scaling
        if (this._ngCache) this._ngCache.clear();
        
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
        
        // Check for boss spawn
        if (this.shouldSpawnBoss()) {
            DebugLogger.info('spawn', `Boss spawn condition met!`);
            this.spawnBoss();
            return;
        }
        
        // Skip normal spawns if paused (e.g., during boss fight)
        if (this.pauseNormalSpawns) {
            return;
        }
        
        // Process enemy waves
        this.processEnemyWaves();
        
        // Process elite windows
        this.processEliteWindows();
        
        // Process unique spawns
        this.processUniqueSpawns();
    }
    
    /**
     * Process regular enemy waves
     */
    processEnemyWaves() {
        if (!this.currentTable.enemyWaves) return;

        const now = this.gameTime;
        const maxEnemies = this.config?.get('spawn.maxEnemies', { defaultValue: 50 }) || 50;

        // Read enemy count ONCE per frame
        let enemyCount = this.scene.enemiesGroup ? this.scene.enemiesGroup.countActive() : 0;
        if (enemyCount >= maxEnemies) return;

        // Iterate waves inline instead of allocating a filtered array
        for (const wave of this.currentTable.enemyWaves) {
            const startTime = wave.startAt || 0;
            const endTime = wave.endAt || Infinity;
            if (now < startTime || now > endTime) continue;

            const timeSinceLastSpawn = now - (wave.lastSpawn || 0);
            const interval = wave.interval || wave.spawnRate || 2000;
            if (timeSinceLastSpawn < interval) continue;

            const weight = wave.weight || 100;
            if (Math.random() * 100 >= weight) continue;

            const remainingSlots = maxEnemies - enemyCount;
            if (remainingSlots <= 0) break;

            let count = wave.countRange ? this.randomInRange(wave.countRange) : 1;
            count = Math.min(count, remainingSlots, 5);

            for (let i = 0; i < count; i++) {
                this.spawnEnemy(wave.enemyId, { wave: true });
            }
            wave.lastSpawn = now;
            enemyCount += count;

            DebugLogger.debug('spawn', `Spawned ${count} ${wave.enemyId} at time ${Math.floor(now/1000)}s`);
        }
    }
    
    /**
     * Process elite spawn windows
     */
    processEliteWindows() {
        if (!this.currentTable.eliteWindows) return;
        
        const now = this.gameTime;
        
        // PR7: Check if we can spawn more enemies
        const currentEnemyCount = this.scene.enemiesGroup ? this.scene.enemiesGroup.countActive() : 0;
        const maxEnemies = this.config?.get('spawn.maxEnemies', { defaultValue: 50 }) || 50;
        
        if (currentEnemyCount >= maxEnemies - 5) { // Leave room for regular spawns
            return; // Skip elite spawns if near limit
        }
        
        for (const elite of this.currentTable.eliteWindows) {
            // Check if in window - PR7 compliant format only
            const startTime = elite.startAt || 0;
            const endTime = elite.endAt || Infinity;
            if (now < startTime || now > endTime) continue;
            
            // Check cooldown
            const lastSpawn = this.eliteCooldowns.get(elite.enemyId) || 0;
            if (now - lastSpawn < elite.cooldown) continue;
            
            // Random chance based on weight
            if (Math.random() * 100 < elite.weight) {
                const count = this.randomInRange(elite.countRange);
                for (let i = 0; i < count; i++) {
                    this.spawnEnemy(elite.enemyId, { elite: true });
                }
                this.eliteCooldowns.set(elite.enemyId, now);
                this.stats.eliteSpawnCount++;
            }
        }
    }
    
    /**
     * Process unique enemy spawns
     */
    processUniqueSpawns() {
        if (!this.currentTable.uniqueSpawns) return;
        
        const now = this.gameTime;
        const player = this.scene.player;
        
        for (const unique of this.currentTable.uniqueSpawns) {
            // Check if in window
            if (now < unique.startAt || now > unique.endAt) continue;
            
            // Check cooldown
            const lastSpawn = this.uniqueCooldowns.get(unique.enemyId) || 0;
            if (now - lastSpawn < unique.cooldown) continue;
            
            // Check conditions
            if (unique.conditions) {
                const cond = unique.conditions;
                
                // Player level check
                if (cond.playerLevel) {
                    const level = this.scene.gameStats?.level || 1;
                    if (cond.playerLevel.min && level < cond.playerLevel.min) continue;
                    if (cond.playerLevel.max && level > cond.playerLevel.max) continue;
                }
                
                // Enemies killed check
                if (cond.enemiesKilled) {
                    const killed = this.scene.gameStats?.enemiesKilled || 0;
                    if (cond.enemiesKilled.min && killed < cond.enemiesKilled.min) continue;
                    if (cond.enemiesKilled.max && killed > cond.enemiesKilled.max) continue;
                }
            }
            
            // Random chance based on weight
            if (Math.random() * 100 < unique.weight) {
                const count = this.randomInRange(unique.countRange);
                for (let i = 0; i < count; i++) {
                    this.spawnEnemy(unique.enemyId, { unique: true });
                }
                this.uniqueCooldowns.set(unique.enemyId, now);
                this.stats.uniqueSpawnCount++;
            }
        }
    }
    
    /**
     * PR7: Check individual boss trigger
     */
    checkBossTrigger(trigger) {
        const now = this.gameTime;
        
        // Check if already triggered
        if (trigger._triggered) return false;
        
        switch (trigger.condition) {
            case 'time':
                // Spawn boss after specific time
                if (now >= trigger.value) {
                    DebugLogger.debug('spawn', `Boss trigger met: time ${trigger.value}ms (current: ${now}ms)`);
                    DebugLogger.debug('spawn', `Will spawn boss: ${trigger.bossId}`);
                    return true;
                }
                break;
                
            case 'kills':
                // Spawn boss after certain number of kills
                const kills = this.scene.gameStats?.enemiesKilled || 0;
                if (kills >= trigger.value) {
                    DebugLogger.info('spawn', `Boss trigger met: ${kills} kills`);
                    return true;
                }
                break;
                
            case 'wave':
                // Spawn boss after specific wave number
                const currentWave = Math.floor(now / 30000); // Wave every 30 seconds
                if (currentWave >= trigger.value) {
                    DebugLogger.info('spawn', `Boss trigger met: wave ${currentWave}`);
                    return true;
                }
                break;
        }
        
        return false;
    }
    
    /**
     * Check if boss should spawn - PR7 compliant
     */
    shouldSpawnBoss() {
        // PR7: Only support bossTriggers format
        if (!this.currentTable.bossTriggers) return false;
        
        const now = this.gameTime;
        
        // Already spawned recently
        if (now - this.lastBossSpawn < 60000) return false; // 1 minute cooldown
        
        // Check array of triggers
        for (const trigger of this.currentTable.bossTriggers) {
            if (this.checkBossTrigger(trigger)) {
                this.pendingBossTrigger = trigger;
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Spawn the boss - PR7 compliant
     */
    spawnBoss() {
        // PR7: Only support bossTriggers format
        if (!this.pendingBossTrigger) {
            DebugLogger.error('spawn', 'No pending boss trigger');
            return;
        }
        
        const trigger = this.pendingBossTrigger;
        const bossId = trigger.bossId;
        const clearEnemies = trigger.clearEnemies || false;
        const spawnDelay = trigger.spawnDelay || 0;
        
        // Mark as triggered to prevent re-spawning
        trigger._triggered = true;
        this.pendingBossTrigger = null;
        
        DebugLogger.info('spawn', `Boss spawn triggered: ${bossId}`);
        
        // Clear existing enemies if requested
        if (clearEnemies && this.scene.enemiesGroup) {
            this.scene.enemiesGroup.clear(true, true);
        }
        
        // Spawn boss after delay — tracked for cleanup on shutdown
        if (this._pendingBossTimer) this._pendingBossTimer.destroy();
        this._pendingBossTimer = this.scene.time.delayedCall(spawnDelay, () => {
            this._pendingBossTimer = null;
            if (!this.running || !this.scene) return;
            this.spawnEnemy(bossId, { boss: true });
            this.lastBossSpawn = this.gameTime;
            this.stats.bossSpawnCount++;
            
            // PR7: Notify scene that boss is active
            if (this.scene) {
                this.scene.bossActive = true;
            }
        });
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
        
        // Apply NG+ scaling
        const scaled = this.applyNGPlusScaling(blueprint, this.ngPlusLevel);
        
        // Get spawn position
        const pos = this.getSpawnPosition();
        
        // Create enemy entity through EnemyManager
        try {
            // Delegate to EnemyManager if available
            if (this.scene.enemyManager) {
                const enemy = params.boss ? 
                    this.scene.enemyManager.spawnBoss(enemyId, pos) :
                    this.scene.enemyManager.spawnEnemy(enemyId, pos);
                
                if (enemy) this._trackSpawn(enemyId);
                return enemy;
            } else if (this.scene.createEnemyFromBlueprint) {
                // Fallback to scene method if available
                const enemy = this.scene.createEnemyFromBlueprint(enemyId, {
                    x: pos.x, y: pos.y, blueprint: scaled, ...params
                });

                if (enemy?.setDepth) {
                    const enemyDepth = this.config?.get?.('layers.enemies', { defaultValue: 20 }) || 20;
                    enemy.setDepth(enemyDepth);
                }
                this._trackSpawn(enemyId);
                
                // Play spawn VFX/SFX (temporarily disabled - blueprint IDs don't match registry)
                /*
                if (blueprint.vfx?.spawn && this.vfx) {
                    this.vfx.play(blueprint.vfx.spawn, pos.x, pos.y);
                }
                if (blueprint.sfx?.spawn && this.sfx) {
                    this.sfx.play(blueprint.sfx.spawn);
                }
                */
                
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
     * @param {string} enemyId - Blueprint ID of the enemy to spawn
     * @param {number} x - X coordinate to spawn at
     * @param {number} y - Y coordinate to spawn at
     * @param {Object} params - Additional spawn parameters
     */
    spawnAtPosition(enemyId, x, y, params = {}) {
        if (!this.blueprints) return;
        
        const blueprint = this.blueprints.get(enemyId);
        if (!blueprint) {
            DebugLogger.warn('spawn', `Blueprint not found: ${enemyId}`);
            return;
        }
        
        // Apply NG+ scaling
        const scaled = this.applyNGPlusScaling(blueprint, this.ngPlusLevel);
        
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
                    const enemyDepth = this.config?.get?.('layers.enemies', { defaultValue: 20 }) || 20;
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
     * Apply NG+ scaling to blueprint
     */
    applyNGPlusScaling(blueprint, ngLevel) {
        if (ngLevel <= 0) return blueprint;

        // Get NG+ scaling config
        const ngConfig = this.blueprints?.get('system.ng_plus_scaling');
        if (!ngConfig) return blueprint;

        const scaling = ngConfig.scaling;
        if (!scaling) return blueprint;

        // Cache scaled blueprints to avoid deep-cloning on every spawn
        const cacheKey = `${blueprint.id}_ng${ngLevel}`;
        if (!this._ngCache) this._ngCache = new Map();
        if (this._ngCache.has(cacheKey)) return this._ngCache.get(cacheKey);

        // Clone blueprint once and cache the result
        const scaled = JSON.parse(JSON.stringify(blueprint));

        if (scaled.stats) {
            if (scaled.stats.hp && scaling.hp) {
                scaled.stats.hp = Math.floor(scaled.stats.hp * Math.pow(scaling.hp, ngLevel));
            }
            if (scaled.stats.damage && scaling.damage) {
                scaled.stats.damage = Math.floor(scaled.stats.damage * Math.pow(scaling.damage, ngLevel));
            }
            if (scaled.stats.speed && scaling.speed) {
                scaled.stats.speed = scaled.stats.speed * Math.pow(scaling.speed, ngLevel);
            }
            if (scaled.stats.xp && scaling.xp) {
                scaled.stats.xp = Math.floor(scaled.stats.xp * Math.pow(scaling.xp, ngLevel));
            }
        }

        this._ngCache.set(cacheKey, scaled);
        return scaled;
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
    
    /**
     * Get XP reward for a boss (with clamping) - delegates to XpRetuner
     */
    getBossXpReward(bossId) {
        return this._xpRetuner.getBossXpReward(this.currentTable, bossId);
    }
}