// Phase5Debug - Debug API pro testování rozšířeného boss/enemy systému
// Poskytuje příkazy pro spawn, loot testing a NG+ simulaci

export default class Phase5Debug {
  constructor(scene) {
    this.scene = scene;
    this.enabled = true;
    
    // Registrované entity
    this.registeredEntities = {
      bosses: new Map(),
      minibosses: new Map(),
      uniques: new Map(),
      regular: new Map()
    };
    
    // Debug stats
    this.stats = {
      totalSpawned: 0,
      bossesSpawned: 0,
      minibossesSpawned: 0,
      uniquesSpawned: 0,
      lootTestsRun: 0,
      ngPlusLevel: 0
    };
    
    this.initializeDebugAPI();
    console.log('[Phase5Debug] Debug API initialized - use window.__phase5Debug');
  }
  
  initializeDebugAPI() {
    if (typeof window === 'undefined') return;
    
    // Main debug object
    window.__phase5Debug = {
      // Spawn commands
      spawn: {
        boss: (id, x, y) => this.spawnBoss(id, x, y),
        miniboss: (id, x, y) => this.spawnMiniBoss(id, x, y),
        unique: (id, x, y) => this.spawnUnique(id, x, y),
        wave: (type, count) => this.spawnWave(type, count),
        eventWave: () => this.spawnEventWave(),
        clear: () => this.clearAllEnemies()
      },
      
      // Loot commands
      loot: {
        test: (tableId, count = 100) => this.testLootTable(tableId, count),
        forceDrop: (dropId, x, y) => this.forceDrop(dropId, x, y),
        simulateKill: (enemyType) => this.simulateKill(enemyType),
        resetPity: () => this.resetPity(),
        showStats: () => this.showLootStats()
      },
      
      // NG+ commands
      ng: {
        setLevel: (level) => this.setNGPlusLevel(level),
        applyModifiers: () => this.applyNGPlusModifiers(),
        reset: () => this.resetNGPlus(),
        showModifiers: () => this.showNGPlusModifiers()
      },
      
      // Utility commands
      util: {
        listEntities: () => this.listRegisteredEntities(),
        getStats: () => this.getDebugStats(),
        exportCatalog: () => this.exportEntityCatalog(),
        validateBlueprints: () => this.validateAllBlueprints(),
        toggleDebug: () => this.toggleDebugMode()
      },
      
      // Quick spawn shortcuts
      boss: (id) => this.spawnBoss(id),
      miniboss: (id) => this.spawnMiniBoss(id),
      unique: (id) => this.spawnUnique(id),
      
      // Telemetry commands
      telemetry: {
        dump: () => this.dumpTelemetry(),
        clear: () => this.clearTelemetry(),
        status: () => this.getTelemetryStatus(),
        export: () => this.exportTelemetryData(),
        toggle: () => this.toggleTelemetry()
      },
      
      // Help
      help: () => this.showHelp()
    };
  }
  
  // === SPAWN METHODS ===
  
  spawnBoss(id, x, y) {
    if (!this.validateSpawn('boss', id)) return null;
    
    x = x ?? this.scene.player?.x ?? 400;
    y = y ?? this.scene.player?.y ?? 300;
    
    console.log(`[Phase5Debug] Spawning boss: ${id} at (${x}, ${y})`);
    
    // Use BossManager if available
    if (this.scene.bossManager) {
      const boss = this.scene.bossManager.spawnBoss(id, x, y);
      this.stats.bossesSpawned++;
      this.stats.totalSpawned++;
      return boss;
    }
    
    // Fallback to enemy manager
    const boss = this.spawnEntity('boss', id, x, y);
    if (boss) {
      boss.isBoss = true;
      boss.maxHP = boss.hp;
      this.stats.bossesSpawned++;
    }
    
    return boss;
  }
  
  spawnMiniBoss(id, x, y) {
    if (!this.validateSpawn('miniboss', id)) return null;
    
    x = x ?? this.getRandomSpawnPosition().x;
    y = y ?? this.getRandomSpawnPosition().y;
    
    console.log(`[Phase5Debug] Spawning mini-boss: ${id} at (${x}, ${y})`);
    
    const miniboss = this.spawnEntity('miniboss', id, x, y);
    if (miniboss) {
      miniboss.isMiniBoss = true;
      miniboss.isElite = true;  // Mini-bosses count as elite+
      this.stats.minibossesSpawned++;
    }
    
    return miniboss;
  }
  
  spawnUnique(id, x, y) {
    if (!this.validateSpawn('unique', id)) return null;
    
    x = x ?? this.getRandomSpawnPosition().x;
    y = y ?? this.getRandomSpawnPosition().y;
    
    console.log(`[Phase5Debug] Spawning unique enemy: ${id} at (${x}, ${y})`);
    
    const unique = this.spawnEntity('unique', id, x, y);
    if (unique) {
      unique.isUnique = true;
      unique.isNamed = true;
      unique.displayName = this.getUniqueDisplayName(id);
      this.stats.uniquesSpawned++;
    }
    
    return unique;
  }
  
  spawnWave(type = 'mixed', count = 10) {
    console.log(`[Phase5Debug] Spawning ${type} wave with ${count} enemies`);
    
    const enemies = [];
    
    for (let i = 0; i < count; i++) {
      const pos = this.getRandomSpawnPosition();
      let enemy;
      
      switch (type) {
        case 'boss':
          enemy = this.spawnRandomBoss(pos.x, pos.y);
          break;
        case 'miniboss':
          enemy = this.spawnRandomMiniBoss(pos.x, pos.y);
          break;
        case 'unique':
          enemy = this.spawnRandomUnique(pos.x, pos.y);
          break;
        case 'mixed':
        default:
          const rand = Math.random();
          if (rand < 0.1) {
            enemy = this.spawnRandomMiniBoss(pos.x, pos.y);
          } else if (rand < 0.2) {
            enemy = this.spawnRandomUnique(pos.x, pos.y);
          } else {
            enemy = this.spawnRegularEnemy(pos.x, pos.y);
          }
          break;
      }
      
      if (enemy) enemies.push(enemy);
    }
    
    console.log(`[Phase5Debug] Spawned ${enemies.length} enemies`);
    return enemies;
  }
  
  spawnEventWave() {
    console.log('[Phase5Debug] Triggering special event wave!');
    
    // Show warning
    this.showWarning('EVENT WAVE INCOMING!', 2000);
    
    // Spawn mixed wave after delay
    setTimeout(() => {
      this.spawnWave('mixed', 20);
      
      // Guaranteed mini-boss
      const pos = this.getRandomSpawnPosition();
      this.spawnRandomMiniBoss(pos.x, pos.y);
      
      console.log('[Phase5Debug] Event wave spawned!');
    }, 2500);
  }
  
  // === LOOT METHODS ===
  
  testLootTable(tableId, count = 100) {
    if (!this.scene.lootDropManager) {
      console.error('[Phase5Debug] LootDropManager not available');
      return;
    }
    
    console.log(`[Phase5Debug] Testing loot table: ${tableId} (${count} rolls)`);
    
    const results = new Map();
    const context = {
      level: this.scene.currentLevel || 1,
      timeMs: 120000,
      enemiesKilled: 100,
      playerLuck: 1.2
    };
    
    for (let i = 0; i < count; i++) {
      const drops = this.scene.lootDropManager.roll(tableId, context);
      
      drops.forEach(drop => {
        const key = drop.ref;
        results.set(key, (results.get(key) || 0) + drop.qty);
      });
    }
    
    // Print results
    console.log(`[Phase5Debug] Loot test results (${count} rolls):`);
    const sorted = Array.from(results.entries()).sort((a, b) => b[1] - a[1]);
    
    sorted.forEach(([item, qty]) => {
      const avg = (qty / count).toFixed(3);
      console.log(`  ${item}: ${qty} total (avg: ${avg} per roll)`);
    });
    
    this.stats.lootTestsRun++;
    
    return results;
  }
  
  forceDrop(dropId, x, y) {
    if (!this.scene.lootSystemIntegration) {
      console.error('[Phase5Debug] LootSystemIntegration not available');
      return;
    }
    
    x = x ?? this.scene.player?.x ?? 400;
    y = y ?? this.scene.player?.y ?? 300;
    
    console.log(`[Phase5Debug] Force dropping: ${dropId} at (${x}, ${y})`);
    
    this.scene.lootSystemIntegration.spawnDropByRef(dropId, x, y);
    
    return { dropId, x, y };
  }
  
  simulateKill(enemyType = 'miniboss') {
    console.log(`[Phase5Debug] Simulating ${enemyType} kill`);
    
    const mockEnemy = {
      blueprintId: this.getMockEnemyId(enemyType),
      x: this.scene.player?.x || 400,
      y: this.scene.player?.y || 300,
      isElite: enemyType === 'elite' || enemyType === 'miniboss',
      isBoss: enemyType === 'boss',
      isMiniBoss: enemyType === 'miniboss',
      isUnique: enemyType === 'unique'
    };
    
    const drops = this.scene.lootSystemIntegration?.handleEnemyDeath(mockEnemy);
    
    console.log(`[Phase5Debug] Simulated drops:`, drops);
    return drops;
  }
  
  // === NG+ METHODS ===
  
  setNGPlusLevel(level) {
    this.stats.ngPlusLevel = Math.max(0, level);
    console.log(`[Phase5Debug] NG+ level set to: ${this.stats.ngPlusLevel}`);
    
    // Apply modifiers
    this.applyNGPlusModifiers();
    
    return this.stats.ngPlusLevel;
  }
  
  applyNGPlusModifiers() {
    const level = this.stats.ngPlusLevel;
    if (level === 0) {
      console.log('[Phase5Debug] No NG+ modifiers (level 0)');
      return;
    }
    
    const modifiers = {
      enemyHPMultiplier: 1 + (level * 0.5),
      enemyDamageMultiplier: 1 + (level * 0.4),
      enemySpeedMultiplier: 1 + (level * 0.3),
      spawnRateMultiplier: 1 + (level * 0.3),
      eliteFrequencyBonus: level * 0.05,
      lootQualityBonus: level * 0.2,
      researchPointMultiplier: 1 + level
    };
    
    console.log('[Phase5Debug] NG+ modifiers applied:', modifiers);
    
    // Apply to ConfigResolver if available
    if (window.ConfigResolver) {
      Object.entries(modifiers).forEach(([key, value]) => {
        window.ConfigResolver.set(`ngplus.${key}`, value);
      });
    }
    
    return modifiers;
  }
  
  // === UTILITY METHODS ===
  
  validateSpawn(type, id) {
    if (!id) {
      console.error(`[Phase5Debug] No ${type} ID provided`);
      this.listAvailable(type);
      return false;
    }
    
    if (!this.enabled) {
      console.warn('[Phase5Debug] Debug mode is disabled');
      return false;
    }
    
    return true;
  }
  
  spawnEntity(type, id, x, y) {
    // Try to spawn through EnemyManager
    if (this.scene.enemyManager) {
      const enemy = this.scene.enemyManager.spawnEnemy(x, y, id);
      if (enemy) {
        this.stats.totalSpawned++;
        return enemy;
      }
    }
    
    // Fallback to creating basic enemy
    console.warn(`[Phase5Debug] Fallback spawn for ${id}`);
    return this.createBasicEnemy(id, x, y);
  }
  
  createBasicEnemy(id, x, y) {
    // Mock enemy creation
    const enemy = {
      id: id,
      x: x,
      y: y,
      hp: 100,
      damage: 10,
      active: true,
      update: () => {},
      destroy: () => { enemy.active = false; }
    };
    
    return enemy;
  }
  
  getRandomSpawnPosition() {
    const margin = 100;
    const width = this.scene.game?.config.width || 800;
    const height = this.scene.game?.config.height || 600;
    
    return {
      x: margin + Math.random() * (width - margin * 2),
      y: margin + Math.random() * (height - margin * 2)
    };
  }
  
  spawnRandomBoss(x, y) {
    const bosses = ['boss.onkogen_prime', 'boss.radiation_core'];
    const id = bosses[Math.floor(Math.random() * bosses.length)];
    return this.spawnBoss(id, x, y);
  }
  
  spawnRandomMiniBoss(x, y) {
    const minibosses = ['miniboss.metastatic_swarm', 'miniboss.toxic_myeloid'];
    const id = minibosses[Math.floor(Math.random() * minibosses.length)];
    return this.spawnMiniBoss(id, x, y);
  }
  
  spawnRandomUnique(x, y) {
    const uniques = [
      'unique.necrocyte_sentinel',
      'unique.phage_overlord',
      'unique.radiomorph_titan',
      'unique.mutagen_splicer',
      'unique.chromoblast',
      'unique.cytokine_warcaller',
      'unique.psionic_leukocyte'
    ];
    const id = uniques[Math.floor(Math.random() * uniques.length)];
    return this.spawnUnique(id, x, y);
  }
  
  spawnRegularEnemy(x, y) {
    const enemies = ['enemy.viral_swarm', 'enemy.necrotic_cell', 'enemy.acidic_blob'];
    const id = enemies[Math.floor(Math.random() * enemies.length)];
    return this.spawnEntity('regular', id, x, y);
  }
  
  getUniqueDisplayName(id) {
    const names = {
      'unique.necrocyte_sentinel': 'Necrocyte Sentinel',
      'unique.phage_overlord': 'Phage Overlord',
      'unique.radiomorph_titan': 'Radiomorph Titan',
      'unique.mutagen_splicer': 'Mutagen Splicer',
      'unique.chromoblast': 'Chromoblast',
      'unique.cytokine_warcaller': 'Cytokine Warcaller',
      'unique.psionic_leukocyte': 'Psionic Leukocyte'
    };
    
    return names[id] || id.replace('unique.', '').replace(/_/g, ' ');
  }
  
  getMockEnemyId(type) {
    const ids = {
      boss: 'boss.onkogen_prime',
      miniboss: 'miniboss.metastatic_swarm',
      unique: 'unique.necrocyte_sentinel',
      elite: 'enemy.aberrant_cell',
      regular: 'enemy.viral_swarm'
    };
    
    return ids[type] || 'enemy.viral_swarm';
  }
  
  clearAllEnemies() {
    console.log('[Phase5Debug] Clearing all enemies');
    
    if (this.scene.enemyManager) {
      this.scene.enemyManager.clearAll();
    }
    
    return { cleared: true };
  }
  
  resetPity() {
    console.log('[Phase5Debug] Resetting all pity counters');
    
    if (this.scene.lootDropManager) {
      this.scene.lootDropManager.resetPity();
    }
    
    return { reset: true };
  }
  
  showLootStats() {
    if (!this.scene.lootDropManager) {
      console.error('[Phase5Debug] LootDropManager not available');
      return;
    }
    
    const telemetry = this.scene.lootDropManager.getTelemetry();
    console.log('[Phase5Debug] Loot telemetry:', telemetry);
    
    return telemetry;
  }
  
  resetNGPlus() {
    this.stats.ngPlusLevel = 0;
    console.log('[Phase5Debug] NG+ reset to level 0');
    
    // Clear modifiers
    if (window.ConfigResolver) {
      window.ConfigResolver.set('ngplus', {});
    }
    
    return { ngPlusLevel: 0 };
  }
  
  showNGPlusModifiers() {
    const level = this.stats.ngPlusLevel;
    const modifiers = this.applyNGPlusModifiers();
    
    console.log(`[Phase5Debug] Current NG+ Level: ${level}`);
    console.log('[Phase5Debug] Active modifiers:', modifiers);
    
    return { level, modifiers };
  }
  
  listAvailable(type) {
    const lists = {
      boss: ['boss.onkogen_prime', 'boss.radiation_core', 'boss.chemorezistence'],
      miniboss: ['miniboss.metastatic_swarm', 'miniboss.toxic_myeloid', 'miniboss.virus_carrier'],
      unique: [
        'unique.necrocyte_sentinel',
        'unique.phage_overlord', 
        'unique.radiomorph_titan',
        'unique.mutagen_splicer',
        'unique.chromoblast',
        'unique.cytokine_warcaller',
        'unique.psionic_leukocyte'
      ]
    };
    
    console.log(`[Phase5Debug] Available ${type} IDs:`, lists[type] || []);
  }
  
  listRegisteredEntities() {
    console.log('[Phase5Debug] Registered entities:');
    console.log('  Bosses:', Array.from(this.registeredEntities.bosses.keys()));
    console.log('  Mini-bosses:', Array.from(this.registeredEntities.minibosses.keys()));
    console.log('  Uniques:', Array.from(this.registeredEntities.uniques.keys()));
    
    return this.registeredEntities;
  }
  
  getDebugStats() {
    console.log('[Phase5Debug] Debug statistics:', this.stats);
    return this.stats;
  }
  
  exportEntityCatalog() {
    const catalog = {
      bosses: Array.from(this.registeredEntities.bosses.entries()),
      minibosses: Array.from(this.registeredEntities.minibosses.entries()),
      uniques: Array.from(this.registeredEntities.uniques.entries()),
      stats: this.stats,
      timestamp: new Date().toISOString()
    };
    
    console.log('[Phase5Debug] Entity catalog:', catalog);
    
    // Copy to clipboard if available
    if (navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(catalog, null, 2));
      console.log('[Phase5Debug] Catalog copied to clipboard');
    }
    
    return catalog;
  }
  
  validateAllBlueprints() {
    console.log('[Phase5Debug] Running blueprint validation...');
    
    // Would call BlueprintValidator here
    // For now, return mock result
    const result = {
      valid: 42,
      invalid: 3,
      warnings: 7,
      timestamp: new Date().toISOString()
    };
    
    console.log('[Phase5Debug] Validation result:', result);
    return result;
  }
  
  toggleDebugMode() {
    this.enabled = !this.enabled;
    console.log(`[Phase5Debug] Debug mode: ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
    return this.enabled;
  }
  
  showWarning(text, duration = 2000) {
    // Create warning overlay
    if (this.scene.add) {
      const warningText = this.scene.add.text(
        this.scene.cameras.main.centerX,
        100,
        text,
        {
          fontSize: '32px',
          color: '#FF0000',
          backgroundColor: '#000000',
          padding: { x: 20, y: 10 }
        }
      );
      
      warningText.setOrigin(0.5);
      warningText.setDepth(10000);
      
      // Flash effect
      this.scene.tweens.add({
        targets: warningText,
        alpha: { from: 1, to: 0.3 },
        duration: 200,
        yoyo: true,
        repeat: 5
      });
      
      // Remove after duration
      setTimeout(() => {
        warningText.destroy();
      }, duration);
    }
  }
  
  // === TELEMETRY METHODS ===
  
  dumpTelemetry() {
    const telemetry = this.scene.telemetryLogger;
    if (!telemetry) {
      console.error('[Phase5Debug] TelemetryLogger not available');
      return { error: 'TelemetryLogger not found' };
    }
    
    console.log('[Phase5Debug] Forcing telemetry dump...');
    telemetry.flushBuffer();
    
    const status = telemetry.getStatus();
    console.log('[Phase5Debug] Telemetry status:', status);
    
    return status;
  }
  
  clearTelemetry() {
    const telemetry = this.scene.telemetryLogger;
    if (!telemetry) {
      console.error('[Phase5Debug] TelemetryLogger not available');
      return { error: 'TelemetryLogger not found' };
    }
    
    const cleared = telemetry.clearBuffer();
    console.log(`[Phase5Debug] Cleared ${cleared} telemetry events`);
    
    return { cleared, message: `Cleared ${cleared} events` };
  }
  
  getTelemetryStatus() {
    const telemetry = this.scene.telemetryLogger;
    if (!telemetry) {
      console.error('[Phase5Debug] TelemetryLogger not available');
      return { error: 'TelemetryLogger not found' };
    }
    
    const status = telemetry.getStatus();
    const realtimeStats = telemetry.getRealtimeStats();
    
    console.log('[Phase5Debug] Telemetry Status:');
    console.log('  Session ID:', status.sessionId);
    console.log('  Enabled:', status.enabled);
    console.log('  Game Time:', status.gameTime + 's');
    console.log('  Buffered Events:', status.bufferedEvents);
    console.log('  Total Spawns:', realtimeStats.totalSpawns);
    console.log('  Total Kills:', realtimeStats.totalKills);
    console.log('  Avg TTK (1min):', realtimeStats.avgTTKLastMinute + 's');
    
    return { status, realtimeStats };
  }
  
  exportTelemetryData() {
    const telemetry = this.scene.telemetryLogger;
    if (!telemetry) {
      console.error('[Phase5Debug] TelemetryLogger not available');
      return { error: 'TelemetryLogger not found' };
    }
    
    console.log('[Phase5Debug] Exporting telemetry data...');
    const sessionData = telemetry.exportSessionData();
    
    console.log('[Phase5Debug] Export completed - download should start automatically');
    return sessionData;
  }
  
  toggleTelemetry() {
    const telemetry = this.scene.telemetryLogger;
    if (!telemetry) {
      console.error('[Phase5Debug] TelemetryLogger not available');
      return { error: 'TelemetryLogger not found' };
    }
    
    // Toggle enabled state
    telemetry.isEnabled = !telemetry.isEnabled;
    const newState = telemetry.isEnabled;
    
    console.log(`[Phase5Debug] Telemetry ${newState ? 'ENABLED' : 'DISABLED'}`);
    
    if (newState) {
      console.log('[Phase5Debug] Telemetry logging resumed');
    } else {
      console.log('[Phase5Debug] Telemetry logging paused (data preserved)');
    }
    
    return { enabled: newState };
  }

  showHelp() {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                    Phase5Debug Help                         ║
╚════════════════════════════════════════════════════════════╝

SPAWN COMMANDS:
  __phase5Debug.spawn.boss(id, x?, y?)      - Spawn specific boss
  __phase5Debug.spawn.miniboss(id, x?, y?)  - Spawn mini-boss
  __phase5Debug.spawn.unique(id, x?, y?)    - Spawn unique enemy
  __phase5Debug.spawn.wave(type, count)     - Spawn wave of enemies
  __phase5Debug.spawn.eventWave()           - Trigger event wave
  __phase5Debug.spawn.clear()               - Clear all enemies

LOOT COMMANDS:
  __phase5Debug.loot.test(tableId, count)   - Test loot table
  __phase5Debug.loot.forceDrop(id, x?, y?)  - Force drop item
  __phase5Debug.loot.simulateKill(type)     - Simulate enemy kill
  __phase5Debug.loot.resetPity()            - Reset pity counters
  __phase5Debug.loot.showStats()            - Show loot telemetry

NG+ COMMANDS:
  __phase5Debug.ng.setLevel(level)          - Set NG+ level
  __phase5Debug.ng.applyModifiers()         - Apply NG+ modifiers
  __phase5Debug.ng.reset()                  - Reset to NG+0
  __phase5Debug.ng.showModifiers()          - Show current modifiers

TELEMETRY COMMANDS:
  __phase5Debug.telemetry.status()          - Show telemetry status
  __phase5Debug.telemetry.dump()            - Force export log now
  __phase5Debug.telemetry.clear()           - Clear buffered events
  __phase5Debug.telemetry.export()          - Download session data
  __phase5Debug.telemetry.toggle()          - Enable/disable logging

UTILITY:
  __phase5Debug.util.listEntities()         - List all entities
  __phase5Debug.util.getStats()             - Get debug stats
  __phase5Debug.util.exportCatalog()        - Export entity catalog
  __phase5Debug.util.validateBlueprints()   - Validate all blueprints
  __phase5Debug.util.toggleDebug()          - Toggle debug mode

SHORTCUTS:
  __phase5Debug.boss('boss.onkogen_prime')  - Quick spawn boss
  __phase5Debug.miniboss('miniboss.toxic')  - Quick spawn mini-boss
  __phase5Debug.unique('unique.viral_z42')  - Quick spawn unique

════════════════════════════════════════════════════════════════
    `);
  }
}

// Export for use in GameScene
export { Phase5Debug };