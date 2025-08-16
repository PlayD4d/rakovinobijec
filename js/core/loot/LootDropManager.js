// LootDropManager - centralizovaný systém pro drop mechaniky
// Plně kompatibilní s unified blueprint frameworkem

export default class LootDropManager {
  constructor(scene, configResolver = null) {
    this.scene = scene;
    this.configResolver = configResolver || window.ConfigResolver;
    
    // Registrované loot tables
    this.registeredTables = new Map();
    this.levelTables = new Map();
    
    // Pity tracking per pool/table
    this.pityCounters = new Map();
    
    // Global state tracking
    this.globalState = {
      timeMs: 0,
      enemiesKilled: 0,
      elitesKilled: 0,
      bossesKilled: 0,
      level: 1,
      playerLuck: 1.0,
      lastRareDropTime: 0,
      lastPowerupTime: 0,
      lastMetotrexatTime: 0,
      streakNoDrop: 0
    };
    
    // Anti-flood tracking
    this.recentDrops = [];
    this.dropCounts = new Map();
    this.cooldowns = new Map();
    
    // Feature flag
    this.enabled = this.configResolver?.get('features.lootTablesEnabled', { defaultValue: true }) ?? true;
    
    // Telemetrie
    this.telemetry = {
      totalRolls: 0,
      hitsByEntry: new Map(),
      pityActivations: 0,
      dropsPerMinute: [],
      qualityDistribution: new Map()
    };
    
    // Debug mode
    this.debug = this.configResolver?.get('debug.lootTables', { defaultValue: false }) ?? false;
    
    if (this.debug) {
      console.log('[LootDropManager] Inicializován s debug módem');
    }
  }
  
  // === REGISTRACE TABULEK ===
  
  registerTable(tableBlueprint) {
    if (!tableBlueprint || !tableBlueprint.id) {
      console.warn('[LootDropManager] Neplatný table blueprint');
      return false;
    }
    
    this.registeredTables.set(tableBlueprint.id, tableBlueprint);
    
    // Inicializace pity counterů pro každý pool
    if (tableBlueprint.pools) {
      tableBlueprint.pools.forEach((pool, poolIndex) => {
        if (pool.pity?.enabled) {
          const pityKey = `${tableBlueprint.id}:pool${poolIndex}`;
          this.pityCounters.set(pityKey, 0);
        }
      });
    }
    
    if (this.debug) {
      console.log(`[LootDropManager] Zaregistrována tabulka: ${tableBlueprint.id}`);
    }
    
    return true;
  }
  
  registerLevelTables(levelId, tableIds) {
    if (!Array.isArray(tableIds)) {
      tableIds = [tableIds];
    }
    
    this.levelTables.set(levelId, tableIds);
    
    if (this.debug) {
      console.log(`[LootDropManager] Level ${levelId} tabulky: ${tableIds.join(', ')}`);
    }
  }
  
  // === HLAVNÍ API ===
  
  getDropsForEnemy(enemy, context = {}) {
    if (!this.enabled) return [];
    
    // NEW: Direct drop system - get drops from enemy blueprint
    const blueprint = this.getEnemyBlueprint(enemy);
    if (!blueprint || !blueprint.drops) {
      // No drops defined - return empty array
      // Don't try legacy system as it causes warnings
      return [];
    }
    
    // Process direct drops with simple percentage chances
    const drops = this.processDirectDrops(blueprint.drops, context);
    
    // Update statistics
    const enemyType = this.determineEnemyType(enemy);
    this.updateStats(enemyType, drops);
    
    return drops;
  }
  
  // Legacy method - deprecated, returns empty array
  getDropsForEnemyLegacy(enemy, context = {}) {
    // Legacy loot tables are no longer supported
    // All drops should be defined directly in blueprints
    return [];
  }
  
  getDropsForBoss(boss, context = {}) {
    if (!this.enabled) return [];
    
    const bossType = 'boss';
    const tableId = this.getTableIdForBoss(context.level || this.globalState.level);
    
    if (!tableId) return [];
    
    // Boss context s bonusy
    const fullContext = this.buildContext(boss, context, bossType);
    fullContext.boss = true;
    fullContext.dualBoss = context.dualBoss || false;
    
    const drops = this.roll(tableId, fullContext);
    
    // Update boss statistik
    this.updateStats(bossType, drops);
    this.globalState.bossesKilled++;
    
    return drops;
  }
  
  // === CORE ROLL SYSTÉM ===
  
  roll(tableId, context) {
    if (!this.enabled) return [];
    
    const table = this.registeredTables.get(tableId);
    if (!table) {
      console.warn(`[LootDropManager] Tabulka ${tableId} není zaregistrovaná`);
      return [];
    }
    
    this.telemetry.totalRolls++;
    
    const allDrops = [];
    const currentTime = Date.now();
    
    // Projdi všechny pools
    for (let poolIndex = 0; poolIndex < table.pools.length; poolIndex++) {
      const pool = table.pools[poolIndex];
      
      // Kontrola podmínek when
      if (!this.checkPoolConditions(pool.when, context)) {
        continue;
      }
      
      // Roll počet rolí
      const rollCount = pool.rolls || 1;
      
      for (let roll = 0; roll < rollCount; roll++) {
        const drop = this.rollSinglePool(table, pool, poolIndex, context);
        if (drop) {
          allDrops.push(drop);
        }
      }
    }
    
    // Aplikuj modifiers a caps
    const finalDrops = this.applyTableModifiers(table, allDrops, context);
    const cappedDrops = this.applyCaps(table, finalDrops, currentTime);
    
    // Update cooldowns
    this.updateCooldowns(cappedDrops, currentTime);
    
    // Telemetrie
    this.updateTelemetry(cappedDrops);
    
    if (this.debug && cappedDrops.length > 0) {
      console.log(`[LootDropManager] ${tableId} drops:`, cappedDrops.map(d => `${d.ref} x${d.qty}`));
    }
    
    return cappedDrops;
  }
  
  rollSinglePool(table, pool, poolIndex, context) {
    // Kontrola pity
    const pityKey = `${table.id}:pool${poolIndex}`;
    let pityActivated = false;
    
    if (pool.pity?.enabled) {
      const pityCount = this.pityCounters.get(pityKey) || 0;
      
      if (pityCount >= pool.pity.maxNoDrop) {
        // Aktivace pity - garantovaný drop
        pityActivated = true;
        this.pityCounters.set(pityKey, 0);
        this.telemetry.pityActivations++;
        
        // Najdi garantovaný entry
        const guaranteedEntry = pool.entries.find(e => e.ref === pool.pity.guaranteedEntry) || pool.entries[0];
        
        if (this.debug) {
          console.log(`[LootDropManager] Pity aktivováno pro ${pityKey}: ${guaranteedEntry.ref}`);
        }
        
        return this.createDrop(guaranteedEntry, context, true);
      }
    }
    
    // Normální weighted roll
    const totalWeight = pool.entries.reduce((sum, entry) => sum + (entry.weight || 0), 0);
    if (totalWeight === 0) return null;
    
    const random = Math.random() * totalWeight;
    let currentWeight = 0;
    
    for (const entry of pool.entries) {
      currentWeight += entry.weight || 0;
      
      if (random <= currentWeight) {
        // Kontrola chance
        if (entry.chance && Math.random() > entry.chance) {
          this.incrementPity(pityKey, pool.pity?.enabled);
          return null;
        }
        
        // Kontrola unique
        if (entry.unique && this.hasDroppedUnique(entry.ref, context)) {
          this.incrementPity(pityKey, pool.pity?.enabled);
          return null;
        }
        
        // Kontrola cooldownů
        if (this.isOnCooldown(entry.ref)) {
          this.incrementPity(pityKey, pool.pity?.enabled);
          return null;
        }
        
        // Reset pity při úspěšném dropu
        if (pool.pity?.enabled) {
          this.pityCounters.set(pityKey, 0);
        }
        
        return this.createDrop(entry, context, pityActivated);
      }
    }
    
    // Žádný drop
    this.incrementPity(pityKey, pool.pity?.enabled);
    return null;
  }
  
  createDrop(entry, context, isPityDrop = false) {
    const qty = this.rollQuantity(entry.qty);
    
    const drop = {
      ref: entry.ref,
      qty: qty,
      context: { ...context },
      isPityDrop: isPityDrop,
      timestamp: Date.now()
    };
    
    // Telemetrie
    const hitKey = entry.ref;
    this.telemetry.hitsByEntry.set(hitKey, (this.telemetry.hitsByEntry.get(hitKey) || 0) + 1);
    
    return drop;
  }
  
  // === NEW DIRECT DROP METHODS ===
  
  getEnemyBlueprint(enemy) {
    // Get blueprint from enemy entity
    if (enemy.blueprint) return enemy.blueprint;
    
    // Try to get from BlueprintLoader
    const blueprintId = enemy.blueprintId || enemy.id;
    if (blueprintId && window.BlueprintLoader) {
      return window.BlueprintLoader.get(blueprintId);
    }
    
    return null;
  }
  
  processDirectDrops(dropDefinitions, context) {
    const drops = [];
    
    for (const dropDef of dropDefinitions) {
      // Simple percentage chance system
      const roll = Math.random();
      if (roll <= dropDef.chance) {
        // Create drop object
        const drop = {
          itemId: dropDef.itemId,
          quantity: dropDef.quantity || 1,
          context: { ...context },
          timestamp: Date.now()
        };
        
        // Apply any modifiers (luck, difficulty, etc.)
        if (context.playerLuck) {
          // Luck increases drop chance for rare items
          const itemBlueprint = window.BlueprintLoader?.get(dropDef.itemId);
          if (itemBlueprint?.rarity === 'rare' || itemBlueprint?.rarity === 'epic') {
            // Re-roll with luck bonus
            const luckRoll = Math.random();
            if (luckRoll <= dropDef.chance * context.playerLuck) {
              drops.push(drop);
            }
          } else {
            drops.push(drop);
          }
        } else {
          drops.push(drop);
        }
      }
    }
    
    return drops;
  }
  
  // === HELPER METHODS ===
  
  determineEnemyType(enemy) {
    if (!enemy) return 'normal';
    
    // Kontrola elite/boss podle blueprint ID nebo vlastností
    const enemyId = enemy.blueprintId || enemy.id || '';
    
    if (enemyId.includes('boss.') || enemy.isBoss) return 'boss';
    if (enemyId.includes('_alpha') || enemyId.includes('_enhanced') || enemy.isElite) return 'elite';
    if (enemyId.includes('aberrant_cell')) return 'elite';  // true elite
    
    return 'normal';
  }
  
  getTableIdForEnemy(enemyType, level) {
    const levelTables = this.levelTables.get(`level${level}`) || this.levelTables.get('level1');
    
    if (!levelTables) return null;
    
    if (enemyType === 'boss' || enemyType === 'elite') {
      // Najdi elite tabulku pro tento level
      const eliteTable = levelTables.find(tableId => tableId.includes('elite'));
      return eliteTable || levelTables[0];
    }
    
    // Běžná tabulka
    const commonTable = levelTables.find(tableId => !tableId.includes('elite'));
    return commonTable || levelTables[0];
  }
  
  getTableIdForBoss(level) {
    return this.getTableIdForEnemy('boss', level);
  }
  
  buildContext(entity, providedContext, entityType) {
    return {
      level: providedContext.level || this.globalState.level,
      timeMs: providedContext.timeMs || this.globalState.timeMs,
      enemiesKilled: providedContext.enemiesKilled || this.globalState.enemiesKilled,
      elitesKilled: this.globalState.elitesKilled,
      bossesKilled: this.globalState.bossesKilled,
      playerLuck: providedContext.playerLuck || this.globalState.playerLuck,
      entityType: entityType,
      elite: entityType === 'elite' || entityType === 'boss',
      boss: entityType === 'boss',
      streakNoDrop: this.globalState.streakNoDrop,
      entity: entity,
      ...providedContext
    };
  }
  
  checkPoolConditions(when, context) {
    if (!when || Object.keys(when).length === 0) return true;
    
    if (when.timeGteMs && context.timeMs < when.timeGteMs) return false;
    if (when.timeLteMs && context.timeMs > when.timeLteMs) return false;
    if (when.enemiesKilledGte && context.enemiesKilled < when.enemiesKilledGte) return false;
    if (when.enemiesKilledLte && context.enemiesKilled > when.enemiesKilledLte) return false;
    if (when.levelGte && context.level < when.levelGte) return false;
    if (when.levelLte && context.level > when.levelLte) return false;
    if (when.playerLuckGte && context.playerLuck < when.playerLuckGte) return false;
    
    return true;
  }
  
  rollQuantity(qtySpec) {
    if (!qtySpec) return 1;
    if (typeof qtySpec === 'number') return qtySpec;
    
    const min = qtySpec.min || 1;
    const max = qtySpec.max || min;
    
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  
  incrementPity(pityKey, enabled) {
    if (enabled && pityKey) {
      const current = this.pityCounters.get(pityKey) || 0;
      this.pityCounters.set(pityKey, current + 1);
    }
  }
  
  hasDroppedUnique(dropRef, context) {
    // Implementace unique tracking - např. per level/session
    const uniqueKey = `${context.level}:${dropRef}`;
    return this.cooldowns.has(`unique:${uniqueKey}`);
  }
  
  isOnCooldown(dropRef) {
    const now = Date.now();
    const cooldownKey = `cooldown:${dropRef}`;
    const cooldownEnd = this.cooldowns.get(cooldownKey);
    
    return cooldownEnd && now < cooldownEnd;
  }
  
  applyTableModifiers(table, drops, context) {
    if (!table.modifiers || drops.length === 0) return drops;
    
    const modifiers = table.modifiers;
    let modifiedDrops = [...drops];
    
    // Drop rate multiplier
    if (modifiers.dropRateMultiplier && modifiers.dropRateMultiplier !== 1.0) {
      // Aplikuj šanci na další dropy
      const baseCount = modifiedDrops.length;
      const multiplier = modifiers.dropRateMultiplier;
      
      if (multiplier > 1.0) {
        const extraChance = multiplier - 1.0;
        modifiedDrops = modifiedDrops.concat(
          modifiedDrops.filter(() => Math.random() < extraChance)
        );
      }
    }
    
    // Quality bonus - zvýšení qty u existujících dropů
    if (modifiers.qualityBonus) {
      modifiedDrops.forEach(drop => {
        if (Math.random() < modifiers.qualityBonus) {
          drop.qty = Math.ceil(drop.qty * 1.5);
        }
      });
    }
    
    // Elite/Boss bonus
    if (context.elite && modifiers.eliteBonus && modifiers.eliteBonus !== 1.0) {
      modifiedDrops.forEach(drop => {
        drop.qty = Math.ceil(drop.qty * modifiers.eliteBonus);
      });
    }
    
    if (context.boss && modifiers.bossBonus && modifiers.bossBonus !== 1.0) {
      modifiedDrops.forEach(drop => {
        drop.qty = Math.ceil(drop.qty * modifiers.bossBonus);
      });
    }
    
    // Time scaling
    if (modifiers.timeScaling && modifiers.timeScalingRate) {
      const timeBonus = 1.0 + (context.timeMs / 1000 * modifiers.timeScalingRate);
      modifiedDrops.forEach(drop => {
        drop.qty = Math.ceil(drop.qty * timeBonus);
      });
    }
    
    // Survival bonus
    if (modifiers.survivalBonus && context.timeMs >= modifiers.survivalThreshold) {
      const survivalMult = modifiers.survivalMultiplier || 2.0;
      modifiedDrops.forEach(drop => {
        drop.qty = Math.ceil(drop.qty * survivalMult);
        drop.survivalBonus = true;
      });
    }
    
    return modifiedDrops;
  }
  
  applyCaps(table, drops, currentTime) {
    if (!table.caps || drops.length === 0) return drops;
    
    const caps = table.caps;
    let cappedDrops = [...drops];
    
    // Max drops per minute
    if (caps.maxDropsPerMinute) {
      this.updateDropCounters(currentTime);
      const currentRate = this.getDropsPerMinute();
      
      if (currentRate >= caps.maxDropsPerMinute) {
        cappedDrops = cappedDrops.slice(0, Math.max(0, caps.maxDropsPerMinute - currentRate));
      }
    }
    
    // Max same drop streak
    if (caps.maxSameDropStreak) {
      cappedDrops = this.preventSameDropStreak(cappedDrops, caps.maxSameDropStreak);
    }
    
    return cappedDrops;
  }
  
  updateCooldowns(drops, currentTime) {
    const table = this.registeredTables.values().next().value; // Get any table for caps
    
    drops.forEach(drop => {
      // Unique items cooldown
      if (drop.unique) {
        const uniqueKey = `unique:${drop.context.level}:${drop.ref}`;
        this.cooldowns.set(uniqueKey, currentTime + (24 * 60 * 60 * 1000)); // 24h pro unique
      }
      
      // Rare drops cooldown
      const cooldownBetweenRare = table?.caps?.cooldownBetweenRare || 0;
      if (cooldownBetweenRare > 0 && this.isRareDrop(drop.ref)) {
        this.cooldowns.set(`cooldown:${drop.ref}`, currentTime + cooldownBetweenRare);
      }
      
      // Power-up cooldown
      const powerupCooldown = table?.caps?.powerupCooldown || 0;
      if (powerupCooldown > 0 && drop.ref.startsWith('powerup.')) {
        this.cooldowns.set(`cooldown:powerup`, currentTime + powerupCooldown);
      }
      
      // Metotrexat cooldown
      const metotrexatCooldown = table?.caps?.metotrexatCooldown || 0;
      if (metotrexatCooldown > 0 && drop.ref === 'drop.metotrexat') {
        this.cooldowns.set(`cooldown:metotrexat`, currentTime + metotrexatCooldown);
      }
    });
  }
  
  // === STATE MANAGEMENT ===
  
  updateGlobalState(deltaTime) {
    this.globalState.timeMs += deltaTime;
    
    // Cleanup starých cooldownů
    const now = Date.now();
    for (const [key, expiry] of this.cooldowns.entries()) {
      if (now >= expiry) {
        this.cooldowns.delete(key);
      }
    }
  }
  
  updateStats(enemyType, drops) {
    if (drops.length === 0) {
      this.globalState.streakNoDrop++;
    } else {
      this.globalState.streakNoDrop = 0;
    }
    
    if (enemyType === 'elite') {
      this.globalState.elitesKilled++;
    } else if (enemyType === 'normal') {
      this.globalState.enemiesKilled++;
    }
  }
  
  // === UTILITY METHODS ===
  
  isRareDrop(dropRef) {
    return dropRef.includes('metotrexat') || 
           dropRef.includes('protein_cache') || 
           dropRef.startsWith('powerup.');
  }
  
  updateDropCounters(currentTime) {
    const windowSize = 60000; // 1 minute
    const cutoff = currentTime - windowSize;
    
    // Odstranit staré záznamy
    this.recentDrops = this.recentDrops.filter(time => time > cutoff);
  }
  
  getDropsPerMinute() {
    return this.recentDrops.length;
  }
  
  preventSameDropStreak(drops, maxStreak) {
    if (drops.length <= 1) return drops;
    
    const result = [drops[0]];
    let streakCount = 1;
    let lastDropRef = drops[0].ref;
    
    for (let i = 1; i < drops.length; i++) {
      const currentDrop = drops[i];
      
      if (currentDrop.ref === lastDropRef) {
        streakCount++;
        if (streakCount <= maxStreak) {
          result.push(currentDrop);
        }
      } else {
        result.push(currentDrop);
        lastDropRef = currentDrop.ref;
        streakCount = 1;
      }
    }
    
    return result;
  }
  
  updateTelemetry(drops) {
    // Update per-minute tracking
    const currentMinute = Math.floor(Date.now() / 60000);
    this.telemetry.dropsPerMinute[currentMinute] = (this.telemetry.dropsPerMinute[currentMinute] || 0) + drops.length;
    
    // Update quality distribution
    drops.forEach(drop => {
      const rarity = this.getDropRarity(drop.ref);
      this.telemetry.qualityDistribution.set(rarity, (this.telemetry.qualityDistribution.get(rarity) || 0) + 1);
    });
  }
  
  getDropRarity(dropRef) {
    if (dropRef.includes('metotrexat')) return 'legendary';
    if (dropRef.startsWith('powerup.')) return 'rare';
    if (dropRef.includes('protein_cache') || dropRef.includes('adrenal_surge')) return 'uncommon';
    return 'common';
  }
  
  // === DEBUG API ===
  
  getTelemetry() {
    return {
      ...this.telemetry,
      pityCounters: Object.fromEntries(this.pityCounters),
      globalState: { ...this.globalState },
      registeredTables: Array.from(this.registeredTables.keys()),
      levelTables: Object.fromEntries(this.levelTables)
    };
  }
  
  resetPity(tableId = null) {
    if (tableId) {
      // Reset pity pro konkrétní tabulku
      for (const [key] of this.pityCounters.entries()) {
        if (key.startsWith(`${tableId}:`)) {
          this.pityCounters.set(key, 0);
        }
      }
    } else {
      // Reset všech pity counterů
      this.pityCounters.clear();
    }
  }
}