/**
 * Soft Refresh System
 * Hot-reload JSON5 data without page refresh
 * PR7 compliant - uses existing loader/registry APIs
 */

export class SoftRefresh {
  constructor(scene) {
    this.scene = scene;
    this.lastRefreshTime = Date.now();
    this.previousData = new Map();
    this.isRefreshing = false;
    
    // Track changes
    this.changes = {
      added: [],
      modified: [],
      removed: [],
      errors: []
    };
  }
  
  /**
   * Main refresh entry point
   * Reloads all JSON5 data and applies changes
   */
  async refresh() {
    if (this.isRefreshing) {
      console.warn('[SoftRefresh] Refresh already in progress');
      return;
    }
    
    this.isRefreshing = true;
    console.log('🔄 [SoftRefresh] Starting data refresh...');
    
    // Reset change tracking
    this.changes = {
      added: [],
      modified: [],
      removed: [],
      errors: []
    };
    
    try {
      // Store current data for comparison
      this.captureCurrentData();
      
      // Reload all data types
      const results = await Promise.all([
        this.refreshBlueprints(),
        this.refreshRegistries(),
        this.refreshSpawnTables(),
        this.refreshLootTables()
      ]);
      
      // Apply changes to running game
      this.applyChanges();
      
      // Show diff report
      this.showDiffReport();
      
      // Visual feedback
      this.scene.cameras.main.flash(300, 0, 255, 0, true);
      
      // Update refresh time
      this.lastRefreshTime = Date.now();
      
    } catch (error) {
      console.error('[SoftRefresh] Refresh failed:', error);
      this.changes.errors.push(error.message);
      
      // Error flash
      this.scene.cameras.main.flash(300, 255, 0, 0, true);
    } finally {
      this.isRefreshing = false;
    }
    
    return this.changes;
  }
  
  /**
   * Capture current data for diff comparison
   */
  captureCurrentData() {
    this.previousData.clear();
    
    // Capture blueprints
    if (this.scene.blueprintLoader) {
      const blueprints = this.scene.blueprintLoader.getAllBlueprints();
      Object.entries(blueprints).forEach(([id, data]) => {
        this.previousData.set(`blueprint:${id}`, this.hashData(data));
      });
    }
    
    // Capture registries
    if (this.scene.vfxSystem?.registry) {
      this.scene.vfxSystem.registry.effects.forEach((data, id) => {
        this.previousData.set(`vfx:${id}`, this.hashData(data));
      });
    }
    
    if (this.scene.sfxSystem?.registry) {
      this.scene.sfxSystem.registry.sounds.forEach((data, id) => {
        this.previousData.set(`sfx:${id}`, this.hashData(data));
      });
    }
  }
  
  /**
   * Refresh blueprints
   */
  async refreshBlueprints() {
    console.log('[SoftRefresh] Refreshing blueprints...');
    
    if (!this.scene.blueprintLoader) {
      console.warn('[SoftRefresh] BlueprintLoader not available');
      return;
    }
    
    try {
      // Load registry index with cache buster
      const indexUrl = `data/registries/index.json?t=${Date.now()}`;
      const response = await fetch(indexUrl);
      const index = await response.json();
      
      // Process each blueprint category
      const categories = ['enemy', 'boss', 'powerup', 'drop', 'lootTable', 'spawn'];
      
      for (const category of categories) {
        if (!index[category]) continue;
        
        for (const entry of index[category]) {
          await this.refreshBlueprint(entry);
        }
      }
      
    } catch (error) {
      console.error('[SoftRefresh] Failed to refresh blueprints:', error);
      this.changes.errors.push(`Blueprint refresh: ${error.message}`);
    }
  }
  
  /**
   * Refresh single blueprint
   */
  async refreshBlueprint(entry) {
    try {
      const url = `data/${entry.path}?t=${Date.now()}`;
      const response = await fetch(url);
      const text = await response.text();
      
      // Parse JSON5
      const data = await this.parseJSON5(text);
      
      if (!data || !data.id) {
        throw new Error(`Invalid blueprint format: ${entry.path}`);
      }
      
      // Check for changes
      const key = `blueprint:${data.id}`;
      const newHash = this.hashData(data);
      const oldHash = this.previousData.get(key);
      
      if (!oldHash) {
        this.changes.added.push(data.id);
      } else if (oldHash !== newHash) {
        this.changes.modified.push(data.id);
      }
      
      // Update blueprint in loader
      this.scene.blueprintLoader.updateBlueprint(data.id, data);
      
    } catch (error) {
      console.error(`[SoftRefresh] Failed to load ${entry.path}:`, error);
      this.changes.errors.push(`${entry.id}: ${error.message}`);
    }
  }
  
  /**
   * Refresh registries (placeholder for future use)
   */
  async refreshRegistries() {
    console.log('[SoftRefresh] Registry refresh skipped - using simplified systems');
    // SimplifiedVFXSystem and SimplifiedAudioSystem don't use registries
    // All configuration is in blueprints now
  }
  
  /**
   * Refresh VFX Registry (deprecated - kept for compatibility)
   */
  async refreshVFXRegistry() {
    // No-op - SimplifiedVFXSystem doesn't use registry
    console.log('[SoftRefresh] VFX registry refresh skipped - using SimplifiedVFXSystem');
  }
  
  /**
   * Refresh SFX Registry (deprecated - kept for compatibility)
   */
  async refreshSFXRegistry() {
    // No-op - SimplifiedAudioSystem doesn't use registry
    console.log('[SoftRefresh] SFX registry refresh skipped - using SimplifiedAudioSystem');
  }
  
  /**
   * Refresh spawn tables
   */
  async refreshSpawnTables() {
    console.log('[SoftRefresh] Refreshing spawn tables...');
    
    if (!this.scene.spawnDirector) {
      console.warn('[SoftRefresh] SpawnDirector not available');
      return;
    }
    
    try {
      // Get spawn table files
      const spawnFiles = [
        'level1.json5',
        'level2.json5', 
        'level3.json5',
        'boss_waves.json5'
      ];
      
      for (const file of spawnFiles) {
        const url = `data/blueprints/spawn/${file}?t=${Date.now()}`;
        
        try {
          const response = await fetch(url);
          if (!response.ok) continue;
          
          const text = await response.text();
          const data = await this.parseJSON5(text);
          
          if (data && data.id) {
            // Update spawn table
            this.scene.spawnDirector.updateSpawnTable(data.id, data);
            
            // Track change
            const key = `spawn:${data.id}`;
            const newHash = this.hashData(data);
            const oldHash = this.previousData.get(key);
            
            if (!oldHash) {
              this.changes.added.push(`spawn:${data.id}`);
            } else if (oldHash !== newHash) {
              this.changes.modified.push(`spawn:${data.id}`);
            }
          }
        } catch (error) {
          // File might not exist, that's okay
        }
      }
    } catch (error) {
      console.error('[SoftRefresh] Failed to refresh spawn tables:', error);
      this.changes.errors.push(`Spawn tables: ${error.message}`);
    }
  }
  
  /**
   * Refresh loot tables
   */
  async refreshLootTables() {
    console.log('[SoftRefresh] Refreshing loot tables...');
    
    if (!this.scene.lootManager) {
      console.warn('[SoftRefresh] LootManager not available');
      return;
    }
    
    try {
      // Get loot table files
      const lootFiles = [
        'common.json5',
        'rare.json5',
        'epic.json5',
        'boss.json5'
      ];
      
      for (const file of lootFiles) {
        const url = `data/blueprints/loot/${file}?t=${Date.now()}`;
        
        try {
          const response = await fetch(url);
          if (!response.ok) continue;
          
          const text = await response.text();
          const data = await this.parseJSON5(text);
          
          if (data && data.id) {
            // Update loot table
            if (this.scene.lootManager.updateTable) {
              this.scene.lootManager.updateTable(data.id, data);
            }
            
            // Track change
            const key = `loot:${data.id}`;
            const newHash = this.hashData(data);
            const oldHash = this.previousData.get(key);
            
            if (!oldHash) {
              this.changes.added.push(`loot:${data.id}`);
            } else if (oldHash !== newHash) {
              this.changes.modified.push(`loot:${data.id}`);
            }
          }
        } catch (error) {
          // File might not exist, that's okay
        }
      }
    } catch (error) {
      console.error('[SoftRefresh] Failed to refresh loot tables:', error);
      this.changes.errors.push(`Loot tables: ${error.message}`);
    }
  }
  
  /**
   * Apply changes to running game
   */
  applyChanges() {
    console.log('[SoftRefresh] Applying changes to game...');
    
    // Update existing enemies with new blueprints
    if (this.scene.enemies) {
      this.scene.enemies.children.entries.forEach(enemy => {
        if (enemy.blueprintId && this.changes.modified.includes(enemy.blueprintId)) {
          // Update enemy stats from new blueprint
          const blueprint = this.scene.blueprintLoader.getBlueprint(enemy.blueprintId);
          if (blueprint && enemy.updateFromBlueprint) {
            enemy.updateFromBlueprint(blueprint);
          }
        }
      });
    }
    
    // Notify systems of changes
    if (this.scene.spawnDirector && this.scene.spawnDirector.onDataRefresh) {
      this.scene.spawnDirector.onDataRefresh(this.changes);
    }
    
    if (this.scene.lootManager && this.scene.lootManager.onDataRefresh) {
      this.scene.lootManager.onDataRefresh(this.changes);
    }
  }
  
  /**
   * Show diff report in console and overlay
   */
  showDiffReport() {
    const total = this.changes.added.length + 
                  this.changes.modified.length + 
                  this.changes.removed.length;
    
    if (total === 0 && this.changes.errors.length === 0) {
      console.log('✅ [SoftRefresh] No changes detected');
      this.showOverlayMessage('No changes detected', '#888888');
      return;
    }
    
    // Console report
    console.group(`🔄 [SoftRefresh] Data refreshed - ${total} changes`);
    
    if (this.changes.added.length > 0) {
      console.group(`✨ Added (${this.changes.added.length}):`);
      this.changes.added.forEach(id => console.log(`  + ${id}`));
      console.groupEnd();
    }
    
    if (this.changes.modified.length > 0) {
      console.group(`📝 Modified (${this.changes.modified.length}):`);
      this.changes.modified.forEach(id => console.log(`  ~ ${id}`));
      console.groupEnd();
    }
    
    if (this.changes.removed.length > 0) {
      console.group(`🗑️ Removed (${this.changes.removed.length}):`);
      this.changes.removed.forEach(id => console.log(`  - ${id}`));
      console.groupEnd();
    }
    
    if (this.changes.errors.length > 0) {
      console.group(`❌ Errors (${this.changes.errors.length}):`);
      this.changes.errors.forEach(err => console.error(`  ! ${err}`));
      console.groupEnd();
    }
    
    console.groupEnd();
    
    // Overlay message
    const message = `Refreshed: +${this.changes.added.length} ~${this.changes.modified.length} -${this.changes.removed.length}`;
    const color = this.changes.errors.length > 0 ? '#ff6666' : '#00ff88';
    this.showOverlayMessage(message, color);
  }
  
  /**
   * Show temporary overlay message
   */
  showOverlayMessage(message, color = '#00ff88') {
    const text = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      100,
      `🔄 ${message}`,
      {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: color,
        backgroundColor: 'rgba(0,0,0,0.9)',
        padding: { x: 12, y: 8 }
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(20003); // Above all game UI and DEV overlays
    
    // Fade out and destroy
    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      y: 80,
      duration: 2000,
      delay: 1000,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }
  
  /**
   * Parse JSON5 text
   */
  async parseJSON5(text) {
    try {
      // Try to use JSON5 library if available
      if (typeof JSON5 !== 'undefined') {
        return JSON5.parse(text);
      }
      
      // Try to dynamically import JSON5
      try {
        const json5Module = await import('/node_modules/json5/dist/index.mjs');
        return json5Module.default.parse(text);
      } catch (importError) {
        // Fallback: basic parsing with eval (dev only!)
        console.warn('[SoftRefresh] JSON5 library not available, using fallback parser');
        
        // Remove comments
        const cleanText = text
          .replace(/\/\/.*$/gm, '') // Remove single-line comments
          .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
        
        // Use Function constructor instead of eval for safety
        return new Function('return ' + cleanText)();
      }
    } catch (error) {
      console.error('[SoftRefresh] JSON5 parse error:', error);
      throw error;
    }
  }
  
  /**
   * Create simple hash of data for comparison
   */
  hashData(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}

// Extension methods for existing systems
export function extendBlueprintLoader(blueprintLoader) {
  // Methods are now built into BlueprintLoader class
  // This function is kept for backward compatibility
  // but doesn't need to do anything
  return;
}

// Extension methods for SpawnDirector
export function extendSpawnDirector(spawnDirector) {
  /**
   * Update spawn table
   */
  spawnDirector.updateSpawnTable = function(id, data) {
    if (!this.spawnTables) {
      this.spawnTables = new Map();
    }
    
    this.spawnTables.set(id, data);
    
    // If this is the current table, update it
    if (this.currentTableId === id) {
      this.currentTable = data;
      console.log(`[SpawnDirector] Updated active table: ${id}`);
    }
  };
  
  /**
   * Handle data refresh
   */
  spawnDirector.onDataRefresh = function(changes) {
    console.log('[SpawnDirector] Processing data refresh...');
    
    // Reload blueprints for spawn system
    if (this.scene.blueprintLoader) {
      this.blueprints = this.scene.blueprintLoader.blueprints;
    }
  };
}