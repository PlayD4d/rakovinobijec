// LootSystemIntegration - propojení LootDropManager s existujícími systémy
// Zajišťuje backward kompatibilitu a smooth přechod na unified loot tables

export default class LootSystemIntegration {
  constructor(scene, lootDropManager, lootSystem) {
    this.scene = scene;
    this.lootDropManager = lootDropManager;
    this.lootSystem = lootSystem; // Existující LootSystem pro spawn mechaniky
    
    // Feature flag pro postupný přechod
    this.enabled = this.scene.configResolver?.get('features.lootTablesEnabled', { defaultValue: true }) ?? true;
    
    // Legacy fallback
    this.legacyMode = !this.enabled;
    
    this.debug = this.scene.configResolver?.get('loot.debug.enabled', { defaultValue: false }) ?? false;
    
    console.log(`[LootSystemIntegration] Inicializován - enabled: ${this.enabled}, legacy: ${this.legacyMode}`);
  }
  
  // === HLAVNÍ INTEGRATION API ===
  
  // Volané z Enemy.js při smrti
  handleEnemyDeath(enemy, killerContext = {}) {
    if (!enemy) return;
    
    if (this.legacyMode) {
      return this.handleLegacyEnemyDeath(enemy, killerContext);
    }
    
    // Nový unified systém
    const context = this.buildDeathContext(enemy, killerContext);
    const drops = this.lootDropManager.getDropsForEnemy(enemy, context);
    
    if (this.debug && drops.length > 0) {
      console.log(`[LootIntegration] Enemy ${enemy.blueprintId || 'unknown'} drops:`, drops);
    }
    
    // Spawn drops přes existující LootSystem
    this.spawnDropsFromResults(drops, enemy.x, enemy.y);
    
    // Update telemetrie
    this.updateDeathTelemetry('enemy', enemy, drops);
    
    return drops;
  }
  
  // Volané z Boss.js při smrti
  handleBossDeath(boss, killerContext = {}) {
    if (!boss) return;
    
    if (this.legacyMode) {
      return this.handleLegacyBossDeath(boss, killerContext);
    }
    
    const context = this.buildDeathContext(boss, killerContext);
    context.boss = true;
    context.dualBoss = killerContext.dualBoss || false;
    
    const drops = this.lootDropManager.getDropsForBoss(boss, context);
    
    if (this.debug) {
      console.log(`[LootIntegration] Boss ${boss.blueprintId || 'unknown'} drops:`, drops);
    }
    
    // Boss drops často v kruhu kolem bosse
    this.spawnBossDropsFromResults(drops, boss.x, boss.y);
    
    this.updateDeathTelemetry('boss', boss, drops);
    
    return drops;
  }
  
  // === CONTEXT BUILDING ===
  
  buildDeathContext(entity, killerContext) {
    const gameScene = this.scene;
    const player = gameScene.player;
    
    // Základní kontext z game state
    const context = {
      level: gameScene.currentLevel || 1,
      timeMs: gameScene.time?.now || Date.now(),
      enemiesKilled: gameScene.enemiesKilled || 0,
      elitesKilled: gameScene.elitesKilled || 0,
      bossesKilled: gameScene.bossesKilled || 0,
      playerLevel: player?.level || 1,
      playerLuck: this.calculatePlayerLuck(player),
      entity: entity,
      killer: killerContext.killer || player,
      damageType: killerContext.damageType || 'projectile',
      overkill: killerContext.overkill || false,
      criticalKill: killerContext.criticalKill || false,
      
      // Entity specific
      entityId: entity.blueprintId || entity.id || 'unknown',
      entityLevel: entity.level || 1,
      entityType: this.determineEntityType(entity),
      
      // Pozice pro spawn
      spawnX: entity.x,
      spawnY: entity.y,
      
      ...killerContext
    };
    
    return context;
  }
  
  calculatePlayerLuck(player) {
    if (!player) return 1.0;
    
    const config = this.scene.configResolver;
    
    const baseLuck = config?.get('loot.luck.basePlayerLuck', { defaultValue: 1.0 }) ?? 1.0;
    const luckPerLevel = config?.get('loot.luck.luckPerLevel', { defaultValue: 0.05 }) ?? 0.05;
    const maxLuck = config?.get('loot.luck.maxLuck', { defaultValue: 2.0 }) ?? 2.0;
    
    let totalLuck = baseLuck + (player.level || 0) * luckPerLevel;
    
    // Bonusy z kill historie
    const eliteLuckBonus = config?.get('loot.luck.eliteLuckBonus', { defaultValue: 0.2 }) ?? 0.2;
    const bossLuckBonus = config?.get('loot.luck.bossLuckBonus', { defaultValue: 0.5 }) ?? 0.5;
    
    if (this.scene.elitesKilled) {
      totalLuck += this.scene.elitesKilled * eliteLuckBonus;
    }
    
    if (this.scene.bossesKilled) {
      totalLuck += this.scene.bossesKilled * bossLuckBonus;
    }
    
    // Power-up bonusy (pokud existují)
    if (player.luckMultiplier) {
      totalLuck *= player.luckMultiplier;
    }
    
    return Math.min(totalLuck, maxLuck);
  }
  
  determineEntityType(entity) {
    if (!entity) return 'normal';
    
    const entityId = entity.blueprintId || entity.id || '';
    
    if (entityId.includes('boss.') || entity.isBoss) return 'boss';
    if (entityId.includes('_alpha') || entityId.includes('_enhanced') || entity.isElite) return 'elite';
    if (entityId.includes('aberrant_cell')) return 'elite';
    
    return 'normal';
  }
  
  // === DROP SPAWNING ===
  
  spawnDropsFromResults(dropResults, x, y) {
    if (!dropResults || dropResults.length === 0) return;
    
    dropResults.forEach((dropResult, index) => {
      this.spawnSingleDrop(dropResult, x, y, index);
    });
  }
  
  spawnBossDropsFromResults(dropResults, centerX, centerY) {
    if (!dropResults || dropResults.length === 0) return;
    
    // Boss drops v kruhovém vzoru
    const radius = 100;
    const angleStep = (2 * Math.PI) / Math.max(dropResults.length, 8);
    
    dropResults.forEach((dropResult, index) => {
      const angle = angleStep * index;
      const x = centerX + Math.cos(angle) * (radius + Math.random() * 50);
      const y = centerY + Math.sin(angle) * (radius + Math.random() * 50);
      
      this.spawnSingleDrop(dropResult, x, y, index);
    });
  }
  
  spawnSingleDrop(dropResult, x, y, index = 0) {
    const { ref, qty, context } = dropResult;
    
    // Spawn jednotlivé quantity jako separate drops (realističtější)
    for (let i = 0; i < qty; i++) {
      // Mírné rozptýlení pozic
      const offsetX = (Math.random() - 0.5) * 40;
      const offsetY = (Math.random() - 0.5) * 40;
      const finalX = x + offsetX + (i * 10); // malé řazení
      const finalY = y + offsetY + (Math.random() - 0.5) * 10;
      
      // Časové rozložení spawnu pro lepší vizuál
      const spawnDelay = index * 50 + i * 100;
      
      this.scene.time.delayedCall(spawnDelay, () => {
        this.spawnDropByRef(ref, finalX, finalY, context);
      });
    }
  }
  
  spawnDropByRef(dropRef, x, y, context = {}) {
    // Mapování drop refs na existující LootSystem metody
    if (dropRef.startsWith('drop.xp_')) {
      this.spawnXPDrop(dropRef, x, y, context);
    } else if (dropRef.startsWith('drop.health_') || dropRef === 'drop.leukocyte_pack') {
      this.spawnHealthDrop(dropRef, x, y, context);
    } else if (dropRef === 'drop.metotrexat') {
      this.spawnMetotrexatDrop(x, y, context);
    } else if (dropRef === 'drop.protein_cache') {
      this.spawnXPDrop('drop.xp_large', x, y, context); // Temp mapping
    } else if (dropRef === 'drop.adrenal_surge') {
      this.spawnBuffDrop(dropRef, x, y, context);
    } else if (dropRef.startsWith('powerup.')) {
      this.spawnPowerUpDrop(dropRef, x, y, context);
    } else {
      console.warn(`[LootIntegration] Neznámý drop ref: ${dropRef}`);
    }
  }
  
  // === DROP SPAWNERS ===
  
  spawnXPDrop(xpType, x, y, context) {
    // Mapování na hodnoty pro existující LootSystem
    let xpValue = 5; // default small
    
    if (xpType === 'drop.xp_medium') xpValue = 12;
    else if (xpType === 'drop.xp_large') xpValue = 30;
    
    // Bonus z context
    if (context.survivalBonus) xpValue *= 1.5;
    if (context.isPityDrop) xpValue *= 1.2;
    
    // Spawn přes existující LootSystem
    if (this.lootSystem && this.lootSystem.spawnXP) {
      this.lootSystem.spawnXP(x, y, Math.ceil(xpValue));
    } else {
      console.warn('[LootIntegration] LootSystem.spawnXP nedostupné');
    }
  }
  
  spawnHealthDrop(healthType, x, y, context) {
    let healValue = 15; // default small
    
    if (healthType === 'drop.leukocyte_pack') healValue = 25;
    
    // Bonusy
    if (context.survivalBonus) healValue *= 1.3;
    if (context.isPityDrop) healValue *= 1.2;
    
    if (this.lootSystem && this.lootSystem.spawnHealthDrop) {
      this.lootSystem.spawnHealthDrop(x, y, Math.ceil(healValue));
    } else {
      console.warn('[LootIntegration] LootSystem.spawnHealthDrop nedostupné');
    }
  }
  
  spawnMetotrexatDrop(x, y, context) {
    if (this.lootSystem && this.lootSystem.spawnMetotrexat) {
      this.lootSystem.spawnMetotrexat(x, y);
    } else {
      console.warn('[LootIntegration] LootSystem.spawnMetotrexat nedostupné');
    }
    
    // Log rare drop
    if (this.scene.configResolver?.get('loot.telemetry.logRareDrops', { defaultValue: true })) {
      console.log(`[LootIntegration] 🧬 Metotrexat spawn na ${Math.round(x)},${Math.round(y)}`);
    }
  }
  
  spawnBuffDrop(buffType, x, y, context) {
    // Zatím jako XP drop dokud nemáme buff systém
    this.spawnXPDrop('drop.xp_medium', x, y, context);
    
    if (this.debug) {
      console.log(`[LootIntegration] Buff drop ${buffType} spawnut jako XP (placeholder)`);
    }
  }
  
  spawnPowerUpDrop(powerupType, x, y, context) {
    // Power-ups přes PowerUpManager pokud existuje
    if (this.scene.powerUpManager && this.scene.powerUpManager.spawnPowerUp) {
      // Extrahuj typ z blueprintu
      const powerupId = powerupType.replace('powerup.', '');
      this.scene.powerUpManager.spawnPowerUp(powerupId, x, y);
    } else {
      // Fallback na velký XP
      this.spawnXPDrop('drop.xp_large', x, y, context);
      
      if (this.debug) {
        console.log(`[LootIntegration] Power-up ${powerupType} spawnut jako XP (fallback)`);
      }
    }
  }
  
  // === LEGACY SUPPORT ===
  
  handleLegacyEnemyDeath(enemy, killerContext) {
    console.log('[LootIntegration] Legacy enemy death handler');
    // Volej původní loot logiku pokud existuje
    if (this.lootSystem && this.lootSystem.handleEnemyDrop) {
      return this.lootSystem.handleEnemyDrop(enemy, killerContext);
    }
    return [];
  }
  
  handleLegacyBossDeath(boss, killerContext) {
    console.log('[LootIntegration] Legacy boss death handler');
    if (this.lootSystem && this.lootSystem.handleBossDrop) {
      return this.lootSystem.handleBossDrop(boss, killerContext);
    }
    return [];
  }
  
  // === TELEMETRIE ===
  
  updateDeathTelemetry(entityType, entity, drops) {
    const telemetryEnabled = this.scene.configResolver?.get('loot.telemetry.enabled', { defaultValue: true }) ?? true;
    if (!telemetryEnabled) return;
    
    // Základní stats
    if (!this.scene.lootTelemetry) {
      this.scene.lootTelemetry = {
        enemyDeaths: 0,
        eliteDeaths: 0,
        bossDeaths: 0,
        totalDrops: 0,
        dropsByRarity: new Map()
      };
    }
    
    const telemetry = this.scene.lootTelemetry;
    
    if (entityType === 'enemy') telemetry.enemyDeaths++;
    else if (entityType === 'boss') telemetry.bossDeaths++;
    
    telemetry.totalDrops += drops.length;
    
    // Rarity tracking
    drops.forEach(drop => {
      const rarity = this.getDropRarity(drop.ref);
      telemetry.dropsByRarity.set(rarity, (telemetry.dropsByRarity.get(rarity) || 0) + 1);
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
      integration: {
        enabled: this.enabled,
        legacyMode: this.legacyMode
      },
      lootDropManager: this.lootDropManager?.getTelemetry(),
      scene: this.scene.lootTelemetry || {}
    };
  }
  
  // === UPDATE LOOP ===
  
  update(deltaTime) {
    // Update LootDropManager global state
    if (this.lootDropManager) {
      this.lootDropManager.updateGlobalState(deltaTime);
    }
  }
}

// Export pro snadnější import
export { LootSystemIntegration };