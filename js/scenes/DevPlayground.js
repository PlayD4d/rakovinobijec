/**
 * Dev Playground Scene
 * Universal sandbox for testing all entity blueprints (bosses and enemies)
 */

export class DevPlayground extends Phaser.Scene {
  constructor() {
    super({ key: 'DevPlayground' });
    
    // Entity management
    this.currentBoss = null;
    this.spawnedEntities = [];
    
    // Blueprint data
    this.bossBlueprints = [];
    this.enemyBlueprints = [];
    this.selectedEntityType = 'boss'; // 'boss' or 'enemy'
    this.selectedBlueprintId = null;
    this.spawnCount = 1;
    
    // Boss specific
    this.currentPhase = 1;
    
    // Auto-cycle
    this.autoCycleActive = false;
    this.autoCycleTimer = null;
    
    // Physics groups - will be properly initialized in create()
    this.enemies = null;
    this.projectiles = null;
  }
  
  preload() {
    // Boss playground doesn't need to preload - assets should be loaded from GameScene
  }
  
  init(data) {
    // Receive data from UI
    if (data) {
      this.selectedEntityType = data.entityType || 'boss';
      this.selectedBlueprintId = data.entityId || data.selectedBossId || null;
      this.currentPhase = data.phase || 1;
      this.spawnCount = data.count || 1;
    }
    
    // Reset entity arrays
    this.spawnedEntities = [];
    this.currentBoss = null;
  }
  
  create() {
    console.log('🎮 Dev Playground Scene started');
    
    // Setup scene basics
    this.setupScene();
    
    // Load all available blueprints
    this.loadAllBlueprints();
    
    // Setup input handlers
    this.setupInputHandlers();
    
    // Initialize systems needed for entity testing
    this.initializeSystems();
    
    // Create simple player for entities to target
    this.createTestPlayer();
    
    // Setup camera
    this.setupCamera();
    
    // Auto-spawn entity if passed from UI
    if (this.selectedBlueprintId) {
      this.time.delayedCall(500, () => {
        if (this.selectedEntityType === 'boss') {
          this.spawnBoss(this.selectedBlueprintId, this.currentPhase);
        } else {
          this.spawnEnemy(this.selectedBlueprintId, this.spawnCount);
        }
      });
    }
  }
  
  setupScene() {
    // Dark background
    this.cameras.main.setBackgroundColor('#111111');
    
    // Add grid for visual reference
    this.createGrid();
    
    // Info text
    this.infoText = this.add.text(10, 10, '🎯 DEV PLAYGROUND MODE', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#00ff88',
      backgroundColor: 'rgba(0,0,0,0.9)',
      padding: { x: 8, y: 6 }
    }).setScrollFactor(0).setDepth(1000);
    
    // Boss stats display
    this.statsText = this.add.text(10, 50, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(1000);
  }
  
  createGrid() {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x222222, 0.3);
    
    const gridSize = 50;
    const width = this.cameras.main.width * 2;
    const height = this.cameras.main.height * 2;
    
    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, height);
    }
    
    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(width, y);
    }
    
    graphics.strokePath();
  }
  
  loadAllBlueprints() {
    // Get all blueprints from the game's blueprint loader
    const gameScene = this.scene.get('GameScene');
    if (gameScene && gameScene.blueprintLoader) {
      const allBlueprints = gameScene.blueprintLoader.getAllBlueprints();
      
      // Filter for boss blueprints
      this.bossBlueprints = Object.entries(allBlueprints)
        .filter(([id, bp]) => bp.type === 'boss' || id.startsWith('boss.'))
        .map(([id, bp]) => ({
          id: id,
          blueprint: bp,
          displayName: bp.meta?.displayName || id
        }));
      
      // Filter for enemy blueprints
      this.enemyBlueprints = Object.entries(allBlueprints)
        .filter(([id, bp]) => bp.type === 'enemy' || id.startsWith('enemy.'))
        .map(([id, bp]) => ({
          id: id,
          blueprint: bp,
          displayName: bp.meta?.displayName || id
        }));
      
      console.log(`Found ${this.bossBlueprints.length} boss blueprints:`, 
        this.bossBlueprints.map(b => b.id));
      console.log(`Found ${this.enemyBlueprints.length} enemy blueprints:`, 
        this.enemyBlueprints.map(e => e.id));
      
      // Select first entity by default
      if (this.selectedEntityType === 'boss' && this.bossBlueprints.length > 0) {
        this.selectedBlueprintId = this.bossBlueprints[0].id;
      } else if (this.selectedEntityType === 'enemy' && this.enemyBlueprints.length > 0) {
        this.selectedBlueprintId = this.enemyBlueprints[0].id;
      }
    } else {
      console.warn('GameScene or BlueprintLoader not available');
    }
  }
  
  initializeSystems() {
    const gameScene = this.scene.get('GameScene');
    
    // Try to get systems from GameScene, but have fallbacks
    if (gameScene) {
      // Reference game scene systems with null fallbacks
      this.spawnDirector = gameScene.spawnDirector || null;
      this.vfxSystem = gameScene.vfxSystem || null;
      this.sfxSystem = gameScene.sfxSystem || null;
      this.projectileSystem = gameScene.projectileSystem || null;
      this.blueprintLoader = gameScene.blueprintLoader || null;
      this.configResolver = gameScene.configResolver || null;
    } else {
      // No GameScene available - set all to null
      console.warn('[BossPlayground] GameScene not available, systems will be limited');
      this.spawnDirector = null;
      this.vfxSystem = null;
      this.sfxSystem = null;
      this.projectileSystem = null;
      this.blueprintLoader = null;
      this.configResolver = null;
    }
    
    // Create a mock spawnDirector if we don't have one
    if (!this.spawnDirector) {
      this.spawnDirector = {
        spawnImmediate: async (enemyType, x, y) => {
          console.log(`[DevPlayground] Mock spawn: ${enemyType} at (${x}, ${y})`);
          
          // Ensure we have a blueprintLoader
          if (!this.blueprintLoader) {
            console.warn('[DevPlayground] Cannot spawn minion - no blueprintLoader');
            return null;
          }
          
          // Get blueprint for the enemy type
          const blueprint = this.blueprintLoader.get(enemyType);
          if (!blueprint) {
            console.warn(`[DevPlayground] Cannot spawn minion - blueprint not found: ${enemyType}`);
            return null;
          }
          
          try {
            // Import Enemy class dynamically
            const { Enemy } = await import('../entities/Enemy.js');
            
            // Generate texture for enemy if needed
            const visuals = blueprint.visuals || {};
            const color = visuals.tint || 0xff0000;
            const size = visuals.size?.w || blueprint.stats?.size || 20;
            const textureKey = visuals.textureKey || enemyType;
            this.generateEnemyTexture(textureKey, color, size);
            
            // Create enemy instance at specified position
            const enemy = new Enemy(this, x, y, blueprint);
            
            // Add to physics and make it visible
            this.physics.add.existing(enemy);
            enemy.setActive(true);
            enemy.setVisible(true);
            
            // Add to local enemies group
            this.enemies.add(enemy);
            this.spawnedEntities.push(enemy);
            
            // Ensure enemy uses the generated texture
            enemy.setTexture(textureKey);
            enemy.setDisplaySize(size, size);
            
            // Set target to test player
            if (enemy.setTarget && this.player) {
              enemy.setTarget(this.player);
            }
            
            console.log(`✅ Spawned minion: ${enemyType} at (${x}, ${y})`);
            return enemy;
            
          } catch (err) {
            console.error('[DevPlayground] Failed to spawn minion:', err);
            return null;
          }
        }
      };
    }
    
    // Create local physics groups - don't share with GameScene
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    
    // Create a mock projectileSystem if we don't have one
    if (!this.projectileSystem) {
      this.projectileSystem = {
        fireEnemy: (x, y, dirX, dirY, damage, speed, size, homingType, source, color) => {
          console.log(`[DevPlayground] Mock enemy projectile from ${source}`);
          // Create simple visual projectile
          const projectile = this.physics.add.sprite(x, y, null);
          const graphics = this.add.graphics();
          graphics.fillStyle(color || 0xff0000, 1);
          graphics.fillCircle(0, 0, size || 5);
          graphics.generateTexture('projectile_temp', (size || 5) * 2, (size || 5) * 2);
          graphics.destroy();
          projectile.setTexture('projectile_temp');
          
          this.projectiles.add(projectile);
          
          // Simple movement
          const velocity = speed || 200;
          const norm = Math.sqrt(dirX * dirX + dirY * dirY);
          if (norm > 0) {
            projectile.body.setVelocity((dirX/norm) * velocity, (dirY/norm) * velocity);
          }
          
          // Auto-destroy after 3 seconds
          this.time.delayedCall(3000, () => {
            if (projectile && !projectile.destroyed) {
              projectile.destroy();
            }
          });
          
          return true;
        },
        firePlayer: (x, y, dirX, dirY, speedMult, damageMult, sizeMult, color) => {
          console.log(`[DevPlayground] Mock player projectile`);
          return true;
        }
      };
    }
    
    // Create mock vfxSystem if we don't have one
    if (!this.vfxSystem) {
      this.vfxSystem = {
        play: (effectId, x, y) => {
          console.log(`[DevPlayground] Mock VFX: ${effectId} at (${x}, ${y})`);
        }
      };
    }
    
    // Create mock sfxSystem if we don't have one
    if (!this.sfxSystem) {
      this.sfxSystem = {
        play: (soundId) => {
          console.log(`[DevPlayground] Mock SFX: ${soundId}`);
        }
      };
    }
    
    // Log available systems
    console.log('[DevPlayground] Available systems:', {
      vfx: !!this.vfxSystem,
      sfx: !!this.sfxSystem,
      projectiles: !!this.projectileSystem,
      blueprints: !!this.blueprintLoader,
      spawnDirector: !!this.spawnDirector
    });
  }
  
  createTestPlayer() {
    // Create a simple test player for the boss to target
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    
    // Generate player texture if missing
    if (!this.textures.exists('player')) {
      this.generatePlayerTexture();
    }
    
    this.player = this.physics.add.sprite(centerX, centerY + 200, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setScale(0.5);
    this.player.setTint(0x00ff00);
    
    // Simple stats
    this.player.hp = 1000;
    this.player.maxHp = 1000;
    
    // Make player draggable for positioning
    this.player.setInteractive();
    this.input.setDraggable(this.player);
    
    this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
      gameObject.x = dragX;
      gameObject.y = dragY;
    });
    
    // Player HP bar
    this.createPlayerHealthBar();
  }
  
  createPlayerHealthBar() {
    const barWidth = 100;
    const barHeight = 8;
    
    this.playerHealthBar = this.add.graphics();
    this.updatePlayerHealthBar();
  }
  
  updatePlayerHealthBar() {
    if (!this.player || !this.playerHealthBar) return;
    
    this.playerHealthBar.clear();
    
    const barWidth = 100;
    const barHeight = 8;
    const x = this.player.x - barWidth / 2;
    const y = this.player.y - 40;
    
    // Background
    this.playerHealthBar.fillStyle(0x000000, 0.5);
    this.playerHealthBar.fillRect(x, y, barWidth, barHeight);
    
    // Health
    const healthPercent = Math.max(0, this.player.hp / this.player.maxHp);
    this.playerHealthBar.fillStyle(0x00ff00, 1);
    this.playerHealthBar.fillRect(x, y, barWidth * healthPercent, barHeight);
    
    // Border
    this.playerHealthBar.lineStyle(1, 0xffffff, 0.5);
    this.playerHealthBar.strokeRect(x, y, barWidth, barHeight);
  }
  
  setupCamera() {
    this.cameras.main.setZoom(1);
    this.cameras.main.setBounds(0, 0, this.cameras.main.width * 2, this.cameras.main.height * 2);
    
    // Allow camera panning with middle mouse
    this.input.on('pointermove', (pointer) => {
      if (pointer.middleButtonDown()) {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x);
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y);
      }
    });
    
    // Zoom with wheel
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const zoom = this.cameras.main.zoom;
      if (deltaY > 0) {
        this.cameras.main.setZoom(Math.max(0.5, zoom - 0.1));
      } else {
        this.cameras.main.setZoom(Math.min(2, zoom + 0.1));
      }
    });
  }
  
  setupInputHandlers() {
    // ESC to return to game
    this.input.keyboard.on('keydown-ESC', () => {
      this.returnToGame();
    });
    
    // B - spawn boss
    this.input.keyboard.on('keydown-B', () => {
      if (this.selectedEntityType === 'boss' && this.selectedBlueprintId) {
        this.spawnBoss(this.selectedBlueprintId);
      }
    });
    
    // E - spawn enemy
    this.input.keyboard.on('keydown-E', () => {
      if (this.selectedEntityType === 'enemy' && this.selectedBlueprintId) {
        this.spawnEnemy(this.selectedBlueprintId, this.spawnCount);
      }
    });
    
    // DEL - kill all entities
    this.input.keyboard.on('keydown-DELETE', () => {
      this.killAll();
    });
    
    // Space to toggle auto-cycle
    this.input.keyboard.on('keydown-SPACE', () => {
      this.toggleAutoCycle();
    });
    
    // N for next phase (boss only)
    this.input.keyboard.on('keydown-N', () => {
      this.nextPhase();
    });
    
    // R to restart
    this.input.keyboard.on('keydown-R', () => {
      this.restart();
    });
    
    // Number keys for quick spawn (1-9)
    for (let i = 1; i <= 9; i++) {
      this.input.keyboard.on(`keydown-DIGIT${i}`, () => {
        const list = this.selectedEntityType === 'boss' ? this.bossBlueprints : this.enemyBlueprints;
        if (list[i - 1]) {
          this.selectedBlueprintId = list[i - 1].id;
          if (this.selectedEntityType === 'boss') {
            this.spawnBoss();
          } else {
            this.spawnEnemy(this.selectedBlueprintId, this.spawnCount);
          }
        }
      });
    }
  }
  
  spawnBoss(blueprintId = null, phase = null) {
    // Kill existing boss
    if (this.currentBoss) {
      this.killCurrentBoss();
    }
    
    const bossId = blueprintId || this.selectedBlueprintId;
    if (!bossId) {
      console.warn('No boss blueprint selected');
      return;
    }
    
    // Get blueprint
    const bossData = this.bossBlueprints.find(b => b.id === bossId);
    if (!bossData) {
      console.warn(`Boss blueprint not found: ${bossId}`);
      return;
    }
    
    console.log('🎯 Spawning boss:', bossId);
    this.logBlueprintData(bossData.blueprint);
    
    // Create boss directly in this scene
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2 - 100;
    
    // Get visual properties from blueprint
    const blueprint = bossData.blueprint;
    const visuals = blueprint.visuals || {};
    const color = visuals.tint || 0x4caf50;
    const size = visuals.size?.w || blueprint.stats?.size || 60;
    const textureKey = visuals.textureKey || bossId;
    
    // Generate texture for boss
    this.generateBossTexture(textureKey, color, size);
    
    // Import Boss class dynamically
    import('../entities/Boss.js').then(({ Boss }) => {
      // Create boss instance
      this.currentBoss = new Boss(this, centerX, centerY, blueprint, {
        x: centerX,
        y: centerY,
        boss: true
      });
      
      // Add to physics and make it visible
      this.physics.add.existing(this.currentBoss);
      this.currentBoss.setActive(true);
      this.currentBoss.setVisible(true);
      
      // Add to local enemies group
      this.enemies.add(this.currentBoss);
      
      // Ensure boss uses the generated texture
      this.currentBoss.setTexture(textureKey);
      this.currentBoss.setDisplaySize(size, size);
      
      // Override phase if specified
      if (phase !== null && this.currentBoss.setPhase) {
        this.currentBoss.setPhase(phase);
        this.currentPhase = phase;
      }
      
      // Set target to test player
      if (this.currentBoss.setTarget) {
        this.currentBoss.setTarget(this.player);
      }
      
      // Warn if systems are missing
      if (!this.vfxSystem || !this.sfxSystem) {
        console.warn('[BossPlayground] VFX/SFX systems unavailable - boss abilities may be limited');
        this.infoText.setText('⚠️ Some systems unavailable - limited functionality');
      }
      
      // Track boss events
      this.trackBossEvents();
      
      // Update display
      this.updateStatsDisplay();
    }).catch(err => {
      console.error('Failed to load Boss class:', err);
    });
  }
  
  logBlueprintData(blueprint) {
    console.group(`📋 Blueprint: ${blueprint.id}`);
    
    // Log stats
    if (blueprint.stats) {
      console.log('📊 Stats:', blueprint.stats);
    }
    
    // Log abilities
    if (blueprint.abilities) {
      console.log('⚔️ Abilities:', blueprint.abilities);
    }
    
    // Log VFX
    if (blueprint.vfx) {
      console.log('✨ VFX:', blueprint.vfx);
    }
    
    // Log SFX
    if (blueprint.sfx) {
      console.log('🔊 SFX:', blueprint.sfx);
    }
    
    // Log phases
    if (blueprint.phases) {
      console.log('📈 Phases:', blueprint.phases);
    }
    
    console.groupEnd();
  }
  
  trackBossEvents() {
    if (!this.currentBoss) return;
    
    // Listen for boss events
    if (this.currentBoss.on) {
      this.currentBoss.on('phase-change', (phase) => {
        console.log(`Boss phase changed to: ${phase}`);
        this.currentPhase = phase;
        this.updateStatsDisplay();
      });
      
      this.currentBoss.on('ability-start', (ability) => {
        console.log(`Boss using ability: ${ability}`);
      });
      
      this.currentBoss.on('death', () => {
        console.log('Boss defeated!');
        this.currentBoss = null;
        this.updateStatsDisplay();
      });
    }
  }
  
  killCurrentBoss() {
    if (this.currentBoss) {
      console.log('💀 Killing boss');
      
      if (this.currentBoss.kill) {
        this.currentBoss.kill();
      } else if (this.currentBoss.destroy) {
        this.currentBoss.destroy();
      }
      
      this.currentBoss = null;
      this.updateStatsDisplay();
    }
  }
  
  /**
   * Spawn enemy entities
   * @param {string} enemyId - Enemy blueprint ID
   * @param {number} count - Number of enemies to spawn
   */
  async spawnEnemy(enemyId, count = 1) {
    if (!enemyId) {
      console.warn('No enemy blueprint selected');
      return;
    }
    
    // Get blueprint
    const blueprint = this.blueprintLoader?.get(enemyId);
    if (!blueprint) {
      console.warn(`Blueprint not found: ${enemyId}`);
      return;
    }
    
    console.log(`🎯 Spawning ${count} enemies:`, enemyId);
    
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    
    // Get visual properties from blueprint
    const visuals = blueprint.visuals || {};
    const color = visuals.tint || 0xff0000;
    const size = visuals.size?.w || blueprint.stats?.size || 20;
    const textureKey = visuals.textureKey || enemyId;
    
    // Generate texture for enemy
    this.generateEnemyTexture(textureKey, color, size);
    
    // Import Enemy class dynamically
    try {
      const { Enemy } = await import('../entities/Enemy.js');
      
      for (let i = 0; i < count; i++) {
        const offsetX = (i - Math.floor(count / 2)) * 50;
        const offsetY = Math.random() * 40 - 20;
        
        // Create enemy instance
        const enemy = new Enemy(this, centerX + offsetX, centerY + offsetY, blueprint);
        
        // Add to physics and make it visible
        this.physics.add.existing(enemy);
        enemy.setActive(true);
        enemy.setVisible(true);
        
        // Add to local enemies group
        this.enemies.add(enemy);
        this.spawnedEntities.push(enemy);
        
        // Ensure enemy uses the generated texture
        enemy.setTexture(textureKey);
        enemy.setDisplaySize(size, size);
        
        // Set target to test player
        if (enemy.setTarget && this.player) {
          enemy.setTarget(this.player);
        }
      }
      
      this.updateStatsDisplay();
      console.log(`✅ Spawned ${count} enemies`);
      
    } catch (err) {
      console.error('Failed to spawn enemies:', err);
    }
  }
  
  /**
   * Kill all spawned entities
   */
  killAll() {
    console.log('💀 Killing all entities');
    
    // Kill boss
    if (this.currentBoss) {
      this.killCurrentBoss();
    }
    
    // Kill all enemies
    if (this.spawnedEntities && this.spawnedEntities.length > 0) {
      this.spawnedEntities.forEach(entity => {
        if (entity && !entity.destroyed) {
          if (entity.kill) {
            entity.kill();
          } else if (entity.destroy) {
            entity.destroy();
          }
        }
      });
      this.spawnedEntities = [];
    }
    
    // Clear physics groups if they exist
    if (this.enemies) {
      this.enemies.clear(true, true);
    }
    
    this.updateStatsDisplay();
    console.log('✅ All entities killed');
  }
  
  /**
   * Generate placeholder texture for enemy
   */
  generateEnemyTexture(key, color, size) {
    // Check if texture already exists
    if (this.textures.exists(key)) {
      return;
    }
    
    // Create a graphics object
    const graphics = this.add.graphics();
    
    // Draw enemy shape (circle for regular enemies)
    graphics.fillStyle(color, 1);
    graphics.fillCircle(size/2, size/2, size/2);
    
    // Add inner detail
    graphics.fillStyle(0xffffff, 0.3);
    graphics.fillCircle(size/2, size/2, size/4);
    
    // Generate texture from graphics
    graphics.generateTexture(key, size, size);
    graphics.destroy();
    
    console.log(`✅ Generated enemy texture: ${key} (${size}px, color: 0x${color.toString(16)})`);
  }
  
  nextPhase() {
    if (this.currentBoss && this.currentBoss.setPhase) {
      this.currentPhase++;
      console.log(`📈 Setting boss to phase ${this.currentPhase}`);
      this.currentBoss.setPhase(this.currentPhase);
      this.updateStatsDisplay();
    }
  }
  
  restart() {
    console.log('🔄 Restarting playground');
    
    // Reset phase
    this.currentPhase = 1;
    
    // Kill current boss
    this.killCurrentBoss();
    
    // Reset player
    if (this.player) {
      this.player.hp = this.player.maxHp;
      this.player.x = this.cameras.main.width / 2;
      this.player.y = this.cameras.main.height / 2 + 200;
      this.updatePlayerHealthBar();
    }
    
    // Stop auto-cycle
    if (this.autoCycleActive) {
      this.toggleAutoCycle();
    }
  }
  
  toggleAutoCycle() {
    this.autoCycleActive = !this.autoCycleActive;
    
    if (this.autoCycleActive) {
      console.log('🔄 Auto-cycle attacks: ON');
      this.startAutoCycle();
    } else {
      console.log('🔄 Auto-cycle attacks: OFF');
      this.stopAutoCycle();
    }
    
    this.updateStatsDisplay();
  }
  
  startAutoCycle() {
    if (!this.currentBoss) return;
    
    // Get boss abilities
    const abilities = this.currentBoss.abilities || [];
    if (abilities.length === 0) return;
    
    let abilityIndex = 0;
    
    this.autoCycleTimer = this.time.addEvent({
      delay: 3000, // 3 seconds between abilities
      callback: () => {
        if (this.currentBoss && this.currentBoss.useAbility) {
          const ability = abilities[abilityIndex];
          console.log(`🎯 Auto-triggering ability: ${ability}`);
          this.currentBoss.useAbility(ability);
          
          abilityIndex = (abilityIndex + 1) % abilities.length;
        }
      },
      loop: true
    });
  }
  
  stopAutoCycle() {
    if (this.autoCycleTimer) {
      this.autoCycleTimer.destroy();
      this.autoCycleTimer = null;
    }
  }
  
  updateStatsDisplay() {
    if (!this.statsText) return;
    
    const lines = [];
    
    // Entity stats
    lines.push(`Type: ${this.selectedEntityType.toUpperCase()}`);
    lines.push(`Selected: ${this.selectedBlueprintId || 'none'}`);
    lines.push('');
    
    // Boss info
    if (this.currentBoss) {
      lines.push(`Boss: ${this.selectedBlueprintId}`);
      lines.push(`Phase: ${this.currentPhase}`);
      
      if (this.currentBoss.hp !== undefined) {
        const hpPercent = Math.round((this.currentBoss.hp / this.currentBoss.maxHp) * 100);
        lines.push(`HP: ${this.currentBoss.hp}/${this.currentBoss.maxHp} (${hpPercent}%)`);
      }
    }
    
    // Enemy count
    const enemyCount = this.spawnedEntities.filter(e => e && !e.destroyed).length;
    if (enemyCount > 0) {
      lines.push(`Enemies: ${enemyCount}`);
    }
    
    // Auto-cycle status
    if (this.autoCycleActive) {
      lines.push('Auto-cycle: ACTIVE');
    }
    
    lines.push('');
    lines.push('Controls:');
    lines.push('[B] Spawn Boss  [E] Spawn Enemy');
    lines.push('[DEL] Kill All  [N] Next Phase');
    lines.push('[R] Restart  [SPACE] Auto-cycle');
    lines.push('[ESC] Return to game');
    
    this.statsText.setText(lines.join('\n'));
  }
  
  returnToGame() {
    console.log('Returning to game...');
    
    // Clean up
    this.stopAutoCycle();
    this.killCurrentBoss();
    
    // Kill all entities
    this.killAll();
    
    // Stop playground and restart game
    this.scene.stop('DevPlayground');
    this.scene.start('GameScene');
  }
  
  /**
   * Generate placeholder texture for player
   */
  generatePlayerTexture() {
    const size = 24;
    const graphics = this.add.graphics();
    
    // Draw green square for test player
    graphics.fillStyle(0x00ff00, 1);
    graphics.fillRect(0, 0, size, size);
    
    // Add white center dot
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(size/2, size/2, size/4);
    
    // Generate texture
    graphics.generateTexture('player', size, size);
    graphics.destroy();
    
    console.log('✅ Generated test player texture');
  }
  
  /**
   * Generate placeholder texture for boss
   * Similar to GameScene.generateEnemyTexture but simplified
   */
  generateBossTexture(key, color, size) {
    // Check if texture already exists
    if (this.textures.exists(key)) {
      return;
    }
    
    // Create a graphics object
    const graphics = this.add.graphics();
    
    // Draw boss shape (diamond for bosses)
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(size/2, 0);
    graphics.lineTo(size, size/2);
    graphics.lineTo(size/2, size);
    graphics.lineTo(0, size/2);
    graphics.closePath();
    graphics.fill();
    
    // Add inner detail
    graphics.fillStyle(0xffffff, 0.3);
    const innerSize = size * 0.4;
    const offset = (size - innerSize) / 2;
    graphics.beginPath();
    graphics.moveTo(size/2, offset);
    graphics.lineTo(offset + innerSize, size/2);
    graphics.lineTo(size/2, offset + innerSize);
    graphics.lineTo(offset, size/2);
    graphics.closePath();
    graphics.fill();
    
    // Generate texture from graphics
    graphics.generateTexture(key, size, size);
    graphics.destroy();
    
    console.log(`✅ Generated boss texture: ${key} (${size}px, color: 0x${color.toString(16)})`);
  }
  
  update(time, delta) {
    // Update displays
    this.updatePlayerHealthBar();
    
    // Update boss if it exists
    if (this.currentBoss && this.currentBoss.update) {
      this.currentBoss.update(time, delta);
    }
  }
  
  /**
   * Clean up when scene shuts down
   */
  shutdown() {
    console.log('[BossPlayground] Shutting down...');
    
    // Stop auto-cycle
    this.stopAutoCycle();
    
    // Remove all timers
    this.time.removeAllEvents();
    
    // Kill current boss
    if (this.currentBoss) {
      this.killCurrentBoss();
    }
    
    // Clear physics groups
    if (this.enemies) {
      this.enemies.clear(true, true);
    }
    if (this.projectiles) {
      this.projectiles.clear(true, true);
    }
    
    // Remove input handlers
    this.input.removeAllListeners();
    this.input.keyboard.removeAllListeners();
  }
  
  /**
   * Destroy scene completely
   */
  destroy() {
    this.shutdown();
    
    // Null out references
    this.vfxSystem = null;
    this.sfxSystem = null;
    this.projectileSystem = null;
    this.blueprintLoader = null;
    this.configResolver = null;
    this.spawnDirector = null;
    
    this.player = null;
    this.currentBoss = null;
    this.enemies = null;
    this.projectiles = null;
    
    console.log('[BossPlayground] Destroyed');
  }
}