/**
 * SpawnDirector - Data-driven spawn system using spawn tables
 * 
 * Manages enemy spawning based on spawn tables from /data/blueprints/spawn/
 * Handles waves, elite windows, unique spawns, and boss triggers
 */

export class SpawnDirector {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.blueprints = options.blueprints;
        this.config = options.config || window.ConfigResolver;
        this.vfx = options.vfx;
        this.sfx = options.sfx;
        
        // Current spawn table
        this.currentTable = null;
        this.scenarioId = null;
        this.ngPlusLevel = 0;
        
        // Runtime state
        this.running = false;
        this.gameTime = 0; // milliseconds since start
        this.lastSpawnTime = 0;
        
        // Wave management
        this.currentWaveIndex = 0;
        this.activeWaves = [];
        
        // Cooldowns
        this.eliteCooldowns = new Map();
        this.uniqueCooldowns = new Map();
        this.lastBossSpawn = 0;
        
        // Statistics
        this.stats = {
            totalSpawned: 0,
            spawnedByType: new Map(),
            eliteSpawnCount: 0,
            uniqueSpawnCount: 0,
            bossSpawnCount: 0,
            spawnedTypes: new Set()
        };
        
        console.log('[SpawnDirector] Initialized');
    }
    
    /**
     * Load spawn table for a scenario
     */
    async loadSpawnTable(scenarioId) {
        console.log(`[SpawnDirector] Loading spawn table: ${scenarioId}`);
        
        if (!this.blueprints) {
            console.error('[SpawnDirector] No blueprint loader available');
            return false;
        }
        
        const table = this.blueprints.getSpawnTable(scenarioId);
        if (!table) {
            console.error(`[SpawnDirector] Spawn table not found: ${scenarioId}`);
            return false;
        }
        
        this.currentTable = table;
        this.scenarioId = scenarioId;
        
        // PR7: Apply XP retuning if xpPlan exists
        if (table.meta?.extensions?.xpPlan) {
            this.applyXpRetuning(table);
        }
        
        // PR7: Validate boss triggers exist
        if (!table.bossTriggers) {
            console.error(`[SpawnDirector] Missing bossTriggers in spawn table: ${scenarioId}`);
        } else {
            console.log(`[SpawnDirector] Boss triggers found:`, table.bossTriggers);
        }
        
        console.log(`[SpawnDirector] ✅ Loaded spawn table: ${scenarioId}`);
        console.log(`  Waves: ${table.enemyWaves?.length || 0}`);
        console.log(`  Elites: ${table.eliteWindows?.length || 0}`);
        console.log(`  Uniques: ${table.uniqueSpawns?.length || 0}`);
        
        return true;
    }
    
    /**
     * Start spawning
     */
    start(options = {}) {
        if (!this.currentTable) {
            console.error('[SpawnDirector] No spawn table loaded');
            return;
        }
        
        this.scenarioId = options.scenarioId || this.scenarioId;
        this.ngPlusLevel = options.ngPlusLevel || 0;
        
        this.running = true;
        this.gameTime = 0;
        
        // PR7: Reset wave timers when starting new level
        if (this.currentTable.enemyWaves) {
            this.currentTable.enemyWaves.forEach(wave => {
                wave._lastSpawn = 0;
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
        
        console.log(`[SpawnDirector] Started scenario: ${this.scenarioId}, NG+${this.ngPlusLevel}`);
    }
    
    /**
     * Stop spawning
     */
    stop() {
        this.running = false;
        console.log('[SpawnDirector] Stopped');
    }
    
    /**
     * Update spawn logic
     */
    update(delta) {
        if (!this.running || !this.currentTable) return;
        
        this.gameTime += delta;
        
        // Debug: Show game time every 10 seconds
        if (Math.floor(this.gameTime / 10000) !== Math.floor((this.gameTime - delta) / 10000)) {
            console.log(`[SpawnDirector] Game time: ${Math.floor(this.gameTime / 1000)}s`);
        }
        
        // Check for boss spawn
        if (this.shouldSpawnBoss()) {
            console.log(`[SpawnDirector] Boss spawn condition met!`);
            this.spawnBoss();
            return;
        }
        
        // Skip normal spawns if paused (e.g., during boss fight)
        if (this.pauseNormalSpawns) {
            return;
        }
        
        // Process enemy waves
        this.processEnemyWaves(delta);
        
        // Process elite windows
        this.processEliteWindows();
        
        // Process unique spawns
        this.processUniqueSpawns();
    }
    
    /**
     * Process regular enemy waves
     */
    processEnemyWaves(delta) {
        if (!this.currentTable.enemyWaves) return;
        
        const now = this.gameTime;
        
        // PR7: Check maximum enemy limit to prevent performance issues
        const currentEnemyCount = this.scene.enemiesGroup ? this.scene.enemiesGroup.countActive() : 0;
        const maxEnemies = this.config?.get('spawn.maxEnemies', { defaultValue: 50 }) || 50;
        
        if (currentEnemyCount >= maxEnemies) {
            // Skip spawning if too many enemies
            if (Math.random() < 0.01) { // Log occasionally
                console.warn(`[SpawnDirector] Max enemy limit reached (${currentEnemyCount}/${maxEnemies}), skipping spawn`);
            }
            return;
        }
        
        // Find active waves for current time - PR7 compliant format only
        const activeWaves = this.currentTable.enemyWaves.filter(wave => {
            const startTime = wave.startAt || 0;
            const endTime = wave.endAt || Infinity;
            return now >= startTime && now <= endTime;
        });
        
        // Spawn from active waves
        for (const wave of activeWaves) {
            const timeSinceLastSpawn = now - (wave.lastSpawn || 0);
            const interval = wave.interval || wave.spawnRate || 2000;
            
            if (timeSinceLastSpawn >= interval) {
                // Use weighted random selection or simple spawn
                const weight = wave.weight || 100; // Default 100% chance
                if (Math.random() * 100 < weight) {
                    let count = wave.countRange ? this.randomInRange(wave.countRange) : 1;
                    
                    // PR7: Limit spawn count if close to max enemies
                    const currentCount = this.scene.enemiesGroup ? this.scene.enemiesGroup.countActive() : 0;
                    const maxEnemies = this.config?.get('spawn.maxEnemies', { defaultValue: 50 }) || 50;
                    const remainingSlots = maxEnemies - currentCount;
                    
                    if (remainingSlots <= 0) {
                        return; // No room for more enemies
                    }
                    
                    count = Math.min(count, remainingSlots, 5); // Max 5 per spawn to prevent lag spikes
                    
                    for (let i = 0; i < count; i++) {
                        this.spawnEnemy(wave.enemyId, { wave: true });
                    }
                    wave.lastSpawn = now;
                    console.log(`[SpawnDirector] Spawned ${count} ${wave.enemyId} at time ${Math.floor(now/1000)}s`);
                }
            }
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
                    console.log(`[SpawnDirector] Boss trigger met: time ${trigger.value}ms (current: ${now}ms)`);
                    console.log(`[SpawnDirector] Will spawn boss: ${trigger.bossId}`);
                    return true;
                }
                break;
                
            case 'kills':
                // Spawn boss after certain number of kills
                const kills = this.scene.gameStats?.enemiesKilled || 0;
                if (kills >= trigger.value) {
                    console.log(`[SpawnDirector] Boss trigger met: ${kills} kills`);
                    return true;
                }
                break;
                
            case 'wave':
                // Spawn boss after specific wave number
                const currentWave = Math.floor(now / 30000); // Wave every 30 seconds
                if (currentWave >= trigger.value) {
                    console.log(`[SpawnDirector] Boss trigger met: wave ${currentWave}`);
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
            console.error('[SpawnDirector] No pending boss trigger');
            return;
        }
        
        const trigger = this.pendingBossTrigger;
        const bossId = trigger.bossId;
        const clearEnemies = trigger.clearEnemies || false;
        const spawnDelay = trigger.spawnDelay || 0;
        
        // Mark as triggered to prevent re-spawning
        trigger._triggered = true;
        this.pendingBossTrigger = null;
        
        console.log(`[SpawnDirector] Boss spawn triggered: ${bossId}`);
        
        // Clear existing enemies if requested
        if (clearEnemies && this.scene.enemiesGroup) {
            this.scene.enemiesGroup.clear(true, true);
        }
        
        // Spawn boss after delay
        this.scene.time.delayedCall(spawnDelay, () => {
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
            console.warn(`[SpawnDirector] Blueprint not found: ${enemyId}`);
            return;
        }
        
        // Apply NG+ scaling
        const scaled = this.applyNGPlusScaling(blueprint, this.ngPlusLevel);
        
        // Get spawn position
        const pos = this.getSpawnPosition();
        
        // Create enemy entity
        try {
            if (this.scene.createEnemyFromBlueprint) {
                // Use new blueprint system
                const enemy = this.scene.createEnemyFromBlueprint(enemyId, {
                    x: pos.x,
                    y: pos.y,
                    blueprint: scaled,
                    ...params
                });
                
                // HOTFIX V4: Ensure proper depth for spawned enemies
                if (enemy && enemy.setDepth) {
                    const enemyDepth = this.config?.get?.('layers.enemies', { defaultValue: 20 }) || 20;
                    enemy.setDepth(enemyDepth);
                }
                
                // Track spawn
                this.stats.totalSpawned++;
                this.stats.spawnedTypes.add(enemyId);
                const count = this.stats.spawnedByType.get(enemyId) || 0;
                this.stats.spawnedByType.set(enemyId, count + 1);
                
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
                console.error('[SpawnDirector] createEnemyFromBlueprint not available - cannot spawn enemies');
            }
        } catch (error) {
            console.error(`[SpawnDirector] Failed to spawn ${enemyId}:`, error);
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
            console.warn(`[SpawnDirector] Blueprint not found: ${enemyId}`);
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
                
                // Track spawn
                this.stats.totalSpawned++;
                this.stats.spawnedTypes.add(enemyId);
                const count = this.stats.spawnedByType.get(enemyId) || 0;
                this.stats.spawnedByType.set(enemyId, count + 1);
                
                return enemy;
            }
        } catch (error) {
            console.error(`[SpawnDirector] Failed to spawn ${enemyId} at position:`, error);
        }
    }
    
    /**
     * Spawn an enemy immediately at a specific position (alias for spawnAtPosition for backward compatibility)
     * @param {string} enemyId - Blueprint ID of the enemy to spawn
     * @param {number} x - X coordinate to spawn at
     * @param {number} y - Y coordinate to spawn at
     */
    spawnImmediate(enemyId, x, y) {
        return this.spawnAtPosition(enemyId, x, y);
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
        
        // Clone blueprint to avoid mutation
        const scaled = JSON.parse(JSON.stringify(blueprint));
        
        // Apply scaling
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
        
        return scaled;
    }
    
    /**
     * Get spawn position - HOTFIX V3: Clamp to world bounds
     */
    getSpawnPosition() {
        const camera = this.scene.cameras.main;
        const margin = 50;
        const player = this.scene.player;
        const MIN_PLAYER_DISTANCE = 100; // Minimum distance from player
        
        // Get world bounds for clamping
        const worldBounds = this.scene.physics?.world?.bounds;
        const minX = worldBounds?.x || 0;
        const minY = worldBounds?.y || 0;
        const maxX = worldBounds ? (worldBounds.x + worldBounds.width) : this.scene.scale.width;
        const maxY = worldBounds ? (worldBounds.y + worldBounds.height) : this.scene.scale.height;
        
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
            x += Phaser.Math.Between(-variance, variance);
            y += Phaser.Math.Between(-variance, variance);
            
            // Clamp position to world bounds with margin
            const worldMargin = 24;
            x = Math.max(minX + worldMargin, Math.min(maxX - worldMargin, x));
            y = Math.max(minY + worldMargin, Math.min(maxY - worldMargin, y));
            
            attempts++;
            
            // Check distance from player
            if (player && player.active) {
                const distToPlayer = Phaser.Math.Distance.Between(x, y, player.x, player.y);
                if (distToPlayer >= MIN_PLAYER_DISTANCE) {
                    break; // Found valid position
                }
            } else {
                break; // No player, any position is valid
            }
        } while (attempts < maxAttempts);
        
        // Only log in debug mode
        if (this.config?.get?.('debug.spawnLogging', { defaultValue: false })) {
            console.log(`[SpawnDirector] Spawn position: (${Math.floor(x)}, ${Math.floor(y)}) attempts=${attempts}`);
        }
        
        return { x, y };
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
     * PR7: Apply XP retuning based on xpPlan
     * This adjusts spawn weights to match target XP/minute
     */
    applyXpRetuning(table) {
        const xpPlan = table.meta?.extensions?.xpPlan;
        if (!xpPlan) return;
        
        const CR = this.config || window.ConfigResolver;
        const progressionXp = CR.get('progression.xp');
        if (!progressionXp) {
            console.warn('[SpawnDirector] No progression.xp config found');
            return;
        }
        
        console.log('[SpawnDirector] Applying XP retuning based on xpPlan:', xpPlan);
        
        // Get enemy XP values (priority: overrides -> blueprint -> global)
        const getEnemyXp = (enemyId) => {
            // 1. Check xpPlan overrides
            if (xpPlan.enemyXpOverrides && xpPlan.enemyXpOverrides[enemyId]) {
                return xpPlan.enemyXpOverrides[enemyId];
            }
            
            // 2. Check blueprint stats.xp
            const blueprint = this.blueprints?.get(enemyId);
            if (blueprint?.stats?.xp) {
                return blueprint.stats.xp;
            }
            
            // 3. Check global config
            if (progressionXp.enemyXp && progressionXp.enemyXp[enemyId]) {
                return progressionXp.enemyXp[enemyId];
            }
            
            // 4. Pattern matching for elite/unique
            if (enemyId.startsWith('elite.')) {
                return 20; // Default elite XP
            }
            if (enemyId.startsWith('unique.')) {
                return 35; // Default unique XP
            }
            
            // 5. Fallback
            return 3;
        };
        
        // Calculate expected XP/minute for each wave
        table.enemyWaves?.forEach((wave, index) => {
            const enemyXp = getEnemyXp(wave.enemyId);
            const avgCount = (wave.countRange[0] + wave.countRange[1]) / 2;
            const spawnsPerMinute = 60000 / wave.interval;
            
            // Base expected XP/min for this wave
            wave._baseXpPerMinute = enemyXp * avgCount * spawnsPerMinute;
            wave._originalWeight = wave.weight;
            
            console.log(`  Wave ${index} (${wave.enemyId}): ${wave._baseXpPerMinute.toFixed(1)} XP/min base`);
        });
        
        // Adjust weights to match target XP/minute
        const pity = xpPlan.pity;
        const targets = xpPlan.targetXpPerMinute;
        
        // Process each minute
        for (let minute = 0; minute < targets.length; minute++) {
            const startMs = minute * 60000;
            const endMs = (minute + 1) * 60000;
            
            // Get target for this minute (with pity floor)
            let targetXpPerMin = targets[minute] || targets[targets.length - 1];
            if (pity?.enabled && minute < (pity.untilMinute || 4)) {
                targetXpPerMin = Math.max(targetXpPerMin, pity.minXpPerMinute || 60);
            }
            
            // Find waves active in this minute
            const activeWaves = table.enemyWaves.filter(w => 
                w.startAt < endMs && w.endAt > startMs
            );
            
            if (activeWaves.length === 0) continue;
            
            // Calculate total base XP/min
            const totalBaseXp = activeWaves.reduce((sum, w) => sum + (w._baseXpPerMinute || 0), 0);
            
            if (totalBaseXp === 0) continue;
            
            // Calculate adjustment factor
            const adjustmentFactor = targetXpPerMin / totalBaseXp;
            
            console.log(`  Minute ${minute}: Target ${targetXpPerMin} XP/min, Factor ${adjustmentFactor.toFixed(2)}`);
            
            // Apply adjustment to weights
            activeWaves.forEach(wave => {
                // Adjust weight proportionally
                const newWeight = Math.max(0.1, Math.min(100, wave._originalWeight * adjustmentFactor));
                wave.weight = newWeight;
                
                // Optionally adjust spawn rate if weight alone isn't enough
                if (adjustmentFactor > 2.0) {
                    // Also decrease interval to spawn faster
                    wave.interval = Math.max(1000, wave.interval / 1.5);
                } else if (adjustmentFactor < 0.5) {
                    // Increase interval to spawn slower
                    wave.interval = Math.min(10000, wave.interval * 1.5);
                }
            });
        }
        
        // Handle boss XP clamping
        if (xpPlan.boss) {
            const bossXp = xpPlan.boss.xp;
            const capLevels = xpPlan.boss.capLevelsGranted || 1.5;
            
            // Calculate max XP based on level cap
            const baseReq = progressionXp.baseRequirement || 10;
            const scaling = progressionXp.scalingMultiplier || 1.5;
            const maxLevelXp = baseReq * Math.pow(scaling, capLevels);
            
            // Clamp boss XP
            const clampedBossXp = Math.min(bossXp, maxLevelXp);
            
            // Update boss triggers with clamped XP
            table.bossTriggers?.forEach(trigger => {
                if (trigger.bossId === xpPlan.boss.id) {
                    trigger._xpReward = clampedBossXp;
                    console.log(`  Boss ${trigger.bossId}: ${clampedBossXp} XP (clamped from ${bossXp})`);
                }
            });
        }
        
        console.log('[SpawnDirector] XP retuning complete');
    }
    
    /**
     * Get XP reward for a boss (with clamping)
     */
    getBossXpReward(bossId) {
        // Check if boss trigger has clamped XP
        const trigger = this.currentTable?.bossTriggers?.find(t => t.bossId === bossId);
        if (trigger?._xpReward) {
            return trigger._xpReward;
        }
        
        // Fallback to blueprint or config
        const CR = this.config || window.ConfigResolver;
        const progressionXp = CR.get('progression.xp');
        
        if (progressionXp?.enemyXp?.[bossId]) {
            return progressionXp.enemyXp[bossId];
        }
        
        // Default boss XP
        return 300;
    }
}