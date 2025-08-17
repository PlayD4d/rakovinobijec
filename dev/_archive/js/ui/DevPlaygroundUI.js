/**
 * Dev Playground UI Overlay
 * Interactive UI panel for entity testing and debugging
 */

export class DevPlaygroundUI {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.panel = null;
    
    // Entity selection
    this.selectedEntityType = 'boss'; // 'boss' or 'enemy'
    this.selectedEntityId = null;
    this.spawnCount = 1;
    
    // Boss specific
    this.selectedPhase = 1;
    this.selectedVariant = 'default';
    
    // Entity lists
    this.bossList = [];
    this.enemyList = [];
    
    // Get reference to Dev Playground scene
    this.playgroundScene = null;
    
    this.create();
  }
  
  create() {
    const cam = this.scene.cameras.main;
    const panelWidth = 320;
    const panelHeight = 400;
    const x = cam.width / 2;
    const y = cam.height / 2;
    
    // Create main panel container
    this.container = this.scene.add.container(x, y);
    this.container.setDepth(20001); // Above all game UI
    this.container.setVisible(false);
    this.container.setScrollFactor(0);
    
    // Panel background
    this.background = this.scene.add.graphics();
    this.background.fillStyle(0x000000, 0.95);
    this.background.fillRoundedRect(-panelWidth/2, -panelHeight/2, panelWidth, panelHeight, 8);
    this.background.lineStyle(2, 0x00ff88, 1);
    this.background.strokeRoundedRect(-panelWidth/2, -panelHeight/2, panelWidth, panelHeight, 8);
    this.container.add(this.background);
    
    // Title
    this.titleText = this.scene.add.text(0, -panelHeight/2 + 15, '🎯 DEV PLAYGROUND', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#00ff88',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.container.add(this.titleText);
    
    // Subtitle
    this.subtitleText = this.scene.add.text(0, -panelHeight/2 + 35, '[F7 to toggle]', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#888888'
    }).setOrigin(0.5);
    this.container.add(this.subtitleText);
    
    // Entity type selector
    this.createEntityTypeSelector(-panelWidth/2 + 20, -panelHeight/2 + 70);
    
    // Entity selection dropdown area
    this.createEntitySelector(-panelWidth/2 + 20, -panelHeight/2 + 110);
    
    // Count input
    this.createCountInput(-panelWidth/2 + 20, -panelHeight/2 + 160);
    
    // Phase/Variant inputs (boss only)
    this.createPhaseVariantInputs(-panelWidth/2 + 20, -panelHeight/2 + 200);
    
    // Control buttons
    this.createControlButtons(-panelWidth/2 + 20, -panelHeight/2 + 230);
    
    // Info display
    this.createInfoDisplay(-panelWidth/2 + 20, -panelHeight/2 + 320);
    
    // Close button
    this.createCloseButton(panelWidth/2 - 25, -panelHeight/2 + 15);
    
    // Load entity lists
    this.loadEntityLists();
  }
  
  createEntityTypeSelector(x, y) {
    // Label
    this.typeLabel = this.scene.add.text(x, y, 'Entity Type:', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff'
    });
    this.container.add(this.typeLabel);
    
    // Boss button
    this.bossTypeBtn = this.scene.add.text(x + 90, y, 'BOSS', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#000000',
      backgroundColor: '#00ff88',
      padding: { x: 8, y: 4 }
    }).setInteractive({ useHandCursor: true });
    
    this.bossTypeBtn.on('pointerdown', () => {
      this.selectEntityType('boss');
    });
    this.container.add(this.bossTypeBtn);
    
    // Enemy button
    this.enemyTypeBtn = this.scene.add.text(x + 150, y, 'ENEMY', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 8, y: 4 }
    }).setInteractive({ useHandCursor: true });
    
    this.enemyTypeBtn.on('pointerdown', () => {
      this.selectEntityType('enemy');
    });
    this.container.add(this.enemyTypeBtn);
  }
  
  selectEntityType(type) {
    this.selectedEntityType = type;
    
    // Update button colors
    if (type === 'boss') {
      this.bossTypeBtn.setBackgroundColor('#00ff88');
      this.bossTypeBtn.setColor('#000000');
      this.enemyTypeBtn.setBackgroundColor('#444444');
      this.enemyTypeBtn.setColor('#ffffff');
      
      // Show phase controls
      if (this.phaseContainer) {
        this.phaseContainer.setVisible(true);
      }
    } else {
      this.enemyTypeBtn.setBackgroundColor('#00ff88');
      this.enemyTypeBtn.setColor('#000000');
      this.bossTypeBtn.setBackgroundColor('#444444');
      this.bossTypeBtn.setColor('#ffffff');
      
      // Hide phase controls
      if (this.phaseContainer) {
        this.phaseContainer.setVisible(false);
      }
    }
    
    // Update dropdown
    this.updateEntityDropdown();
  }
  
  createEntitySelector(x, y) {
    // Label
    this.entityLabel = this.scene.add.text(x, y, 'Entity Blueprint:', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff'
    });
    this.container.add(this.entityLabel);
    
    // Dropdown background
    this.dropdownBg = this.scene.add.graphics();
    this.dropdownBg.fillStyle(0x222222, 1);
    this.dropdownBg.fillRoundedRect(x, y + 20, 280, 30, 4);
    this.dropdownBg.lineStyle(1, 0x00ff88, 0.5);
    this.dropdownBg.strokeRoundedRect(x, y + 20, 280, 30, 4);
    this.container.add(this.dropdownBg);
    
    // Selected boss text
    this.selectedEntityText = this.scene.add.text(x + 10, y + 35, 'Select entity...', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#aaaaaa'
    }).setOrigin(0, 0.5);
    this.container.add(this.selectedEntityText);
    
    // Dropdown arrow
    this.dropdownArrow = this.scene.add.text(x + 260, y + 35, '▼', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#00ff88'
    }).setOrigin(0.5);
    this.container.add(this.dropdownArrow);
    
    // Make dropdown clickable
    const dropdownHitArea = this.scene.add.rectangle(x + 140, y + 35, 280, 30, 0x000000, 0.01);
    dropdownHitArea.setInteractive({ useHandCursor: true });
    dropdownHitArea.on('pointerdown', () => this.showEntityDropdown());
    this.container.add(dropdownHitArea);
  }
  
  createCountInput(x, y) {
    // Label
    this.countLabel = this.scene.add.text(x, y, 'Count:', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff'
    });
    this.container.add(this.countLabel);
    
    // Count input background
    this.countInputBg = this.scene.add.graphics();
    this.countInputBg.fillStyle(0x222222, 1);
    this.countInputBg.fillRoundedRect(x + 60, y - 5, 60, 25, 4);
    this.countInputBg.lineStyle(1, 0x00ff88, 0.5);
    this.countInputBg.strokeRoundedRect(x + 60, y - 5, 60, 25, 4);
    this.container.add(this.countInputBg);
    
    // Count text
    this.countText = this.scene.add.text(x + 90, y + 7, '1', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.container.add(this.countText);
    
    // Count +/- buttons
    this.createCountButtons(x + 130, y + 7);
  }
  
  createCountButtons(x, y) {
    // Minus button
    const minusBtn = this.scene.add.text(x, y, '-', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ff6666',
      backgroundColor: '#222222',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    minusBtn.on('pointerdown', () => {
      this.spawnCount = Math.max(1, this.spawnCount - 1);
      this.countText.setText(this.spawnCount.toString());
    });
    
    this.container.add(minusBtn);
    
    // Plus button
    const plusBtn = this.scene.add.text(x + 25, y, '+', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#66ff66',
      backgroundColor: '#222222',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    plusBtn.on('pointerdown', () => {
      this.spawnCount = Math.min(10, this.spawnCount + 1);
      this.countText.setText(this.spawnCount.toString());
    });
    
    this.container.add(plusBtn);
  }
  
  createPhaseVariantInputs(x, y) {
    // Create container for phase controls (can be hidden for enemies)
    this.phaseContainer = this.scene.add.container(0, 0);
    this.container.add(this.phaseContainer);
    // Phase input
    this.phaseLabel = this.scene.add.text(x, y, 'Phase (Boss):', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff'
    });
    this.phaseContainer.add(this.phaseLabel);
    
    this.phaseInputBg = this.scene.add.graphics();
    this.phaseInputBg.fillStyle(0x222222, 1);
    this.phaseInputBg.fillRoundedRect(x + 60, y - 5, 60, 25, 4);
    this.phaseInputBg.lineStyle(1, 0x00ff88, 0.5);
    this.phaseInputBg.strokeRoundedRect(x + 60, y - 5, 60, 25, 4);
    this.phaseContainer.add(this.phaseInputBg);
    
    this.phaseText = this.scene.add.text(x + 90, y + 7, '1', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.phaseContainer.add(this.phaseText);
    
    // Phase +/- buttons
    this.createPhaseButtons(x + 130, y + 7);
    
    // Variant input
    this.variantLabel = this.scene.add.text(x + 170, y, 'Variant:', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff'
    });
    this.phaseContainer.add(this.variantLabel);
    
    this.variantText = this.scene.add.text(x + 230, y, 'default', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#888888'
    });
    this.phaseContainer.add(this.variantText);
  }
  
  createPhaseButtons(x, y) {
    // Minus button
    const minusBtn = this.scene.add.text(x, y, '-', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ff6666',
      backgroundColor: '#222222',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    minusBtn.on('pointerdown', () => {
      this.selectedPhase = Math.max(1, this.selectedPhase - 1);
      this.phaseText.setText(this.selectedPhase.toString());
    });
    
    this.phaseContainer.add(minusBtn);
    
    // Plus button
    const plusBtn = this.scene.add.text(x + 25, y, '+', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#66ff66',
      backgroundColor: '#222222',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    plusBtn.on('pointerdown', () => {
      this.selectedPhase = Math.min(10, this.selectedPhase + 1);
      this.phaseText.setText(this.selectedPhase.toString());
    });
    
    this.phaseContainer.add(plusBtn);
  }
  
  createControlButtons(x, y) {
    const buttonStyle = {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#000000',
      backgroundColor: '#00ff88',
      padding: { x: 12, y: 6 }
    };
    
    const buttonStyleAlt = {
      ...buttonStyle,
      backgroundColor: '#ff8800'
    };
    
    const buttonStyleDanger = {
      ...buttonStyle,
      backgroundColor: '#ff4444'
    };
    
    // Spawn button
    this.spawnBtn = this.scene.add.text(x, y, '▶ SPAWN', buttonStyle)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.spawnEntity())
      .on('pointerover', () => this.spawnBtn.setBackgroundColor('#44ffaa'))
      .on('pointerout', () => this.spawnBtn.setBackgroundColor('#00ff88'));
    this.container.add(this.spawnBtn);
    
    // Kill button
    this.killBtn = this.scene.add.text(x + 90, y, '💀 KILL', buttonStyleDanger)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.killAll())
      .on('pointerover', () => this.killBtn.setBackgroundColor('#ff6666'))
      .on('pointerout', () => this.killBtn.setBackgroundColor('#ff4444'));
    this.container.add(this.killBtn);
    
    // Next Phase button
    this.nextPhaseBtn = this.scene.add.text(x + 160, y, '📈 PHASE+', buttonStyleAlt)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.nextPhase())
      .on('pointerover', () => this.nextPhaseBtn.setBackgroundColor('#ffaa44'))
      .on('pointerout', () => this.nextPhaseBtn.setBackgroundColor('#ff8800'));
    this.container.add(this.nextPhaseBtn);
    
    // Second row
    const y2 = y + 35;
    
    // Restart button
    this.restartBtn = this.scene.add.text(x, y2, '🔄 RESTART', buttonStyle)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.restart())
      .on('pointerover', () => this.restartBtn.setBackgroundColor('#44ffaa'))
      .on('pointerout', () => this.restartBtn.setBackgroundColor('#00ff88'));
    this.container.add(this.restartBtn);
    
    // Auto-cycle button
    this.autoCycleBtn = this.scene.add.text(x + 105, y2, '🔁 AUTO-CYCLE', {
      ...buttonStyle,
      backgroundColor: '#8888ff'
    })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleAutoCycle())
      .on('pointerover', () => this.autoCycleBtn.setBackgroundColor('#aaaaff'))
      .on('pointerout', () => this.updateAutoCycleButton());
    this.container.add(this.autoCycleBtn);
  }
  
  createInfoDisplay(x, y) {
    this.infoText = this.scene.add.text(x, y, 'Ready to spawn boss...', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#888888'
    });
    this.container.add(this.infoText);
  }
  
  createCloseButton(x, y) {
    this.closeBtn = this.scene.add.text(x, y, '✕', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ff6666',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    this.closeBtn.on('pointerdown', () => this.hide());
    this.closeBtn.on('pointerover', () => this.closeBtn.setColor('#ff8888'));
    this.closeBtn.on('pointerout', () => this.closeBtn.setColor('#ff6666'));
    
    this.container.add(this.closeBtn);
  }
  
  loadEntityLists() {
    // Get all blueprints from GameScene
    const gameScene = this.scene.scene.get('GameScene');
    if (gameScene && gameScene.blueprintLoader) {
      const allBlueprints = gameScene.blueprintLoader.getAllBlueprints();
      
      // Load boss list
      this.bossList = Object.entries(allBlueprints)
        .filter(([id, bp]) => bp.type === 'boss' || id.startsWith('boss.'))
        .map(([id, bp]) => ({
          id: id,
          displayName: bp.meta?.displayName || id.replace('boss.', '')
        }));
      
      // Load enemy list
      this.enemyList = Object.entries(allBlueprints)
        .filter(([id, bp]) => bp.type === 'enemy' || id.startsWith('enemy.'))
        .map(([id, bp]) => ({
          id: id,
          displayName: bp.meta?.displayName || id.replace('enemy.', '')
        }));
      
      console.log(`[DevPlaygroundUI] Found ${this.bossList.length} bosses, ${this.enemyList.length} enemies`);
      
      // Select first entity by default
      this.updateEntityDropdown();
    }
  }
  
  updateEntityDropdown() {
    const list = this.selectedEntityType === 'boss' ? this.bossList : this.enemyList;
    
    if (list.length > 0) {
      this.selectedEntityId = list[0].id;
      this.selectedEntityText.setText(list[0].displayName);
      this.selectedEntityText.setColor('#00ff88');
    } else {
      this.selectedEntityId = null;
      this.selectedEntityText.setText(`No ${this.selectedEntityType}s available`);
      this.selectedEntityText.setColor('#ff6666');
    }
  }
  
  showEntityDropdown() {
    const list = this.selectedEntityType === 'boss' ? this.bossList : this.enemyList;
    if (!list || list.length === 0) return;
    
    // Create dropdown menu
    const dropdownContainer = this.scene.add.container(0, 50);
    this.container.add(dropdownContainer);
    
    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x111111, 0.98);
    bg.fillRoundedRect(-140, 0, 280, Math.min(200, list.length * 25 + 10), 4);
    bg.lineStyle(1, 0x00ff88, 0.8);
    bg.strokeRoundedRect(-140, 0, 280, Math.min(200, list.length * 25 + 10), 4);
    dropdownContainer.add(bg);
    
    // Entity items
    list.forEach((entity, index) => {
      const itemY = 15 + index * 25;
      
      const itemBg = this.scene.add.rectangle(0, itemY, 270, 22, 0x222222, 0.01)
        .setInteractive({ useHandCursor: true });
      
      const itemText = this.scene.add.text(-130, itemY, entity.displayName, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff'
      }).setOrigin(0, 0.5);
      
      itemBg.on('pointerover', () => {
        itemBg.setFillStyle(0x00ff88, 0.2);
        itemText.setColor('#00ff88');
      });
      
      itemBg.on('pointerout', () => {
        itemBg.setFillStyle(0x222222, 0.01);
        itemText.setColor('#ffffff');
      });
      
      itemBg.on('pointerdown', () => {
        this.selectEntity(entity);
        dropdownContainer.destroy();
      });
      
      dropdownContainer.add([itemBg, itemText]);
    });
    
    // Close on outside click
    this.scene.time.delayedCall(100, () => {
      if (this.scene.input) {
        this.scene.input.once('pointerdown', () => {
          if (dropdownContainer && !dropdownContainer.destroyed) {
            dropdownContainer.destroy();
          }
        });
      }
    });
  }
  
  selectEntity(entity) {
    this.selectedEntityId = entity.id;
    this.selectedEntityText.setText(entity.displayName);
    this.selectedEntityText.setColor('#00ff88');
    this.infoText.setText(`Selected: ${entity.id}`);
  }
  
  spawnEntity() {
    if (!this.selectedEntityId) {
      this.infoText.setText(`⚠️ Select a ${this.selectedEntityType} first!`);
      return;
    }
    
    // Get the DevPlayground scene
    const playground = this.scene.scene.get('DevPlayground');
    
    if (!playground || !playground.scene.isActive()) {
      // Start DevPlayground if not active
      this.scene.scene.stop('GameScene');
      this.scene.scene.start('DevPlayground', {
        entityType: this.selectedEntityType,
        entityId: this.selectedEntityId,
        phase: this.selectedPhase,
        count: this.spawnCount
      });
      
      // Hide UI since we're switching scenes
      this.hide();
    } else {
      // Use existing playground scene
      if (this.selectedEntityType === 'boss') {
        playground.spawnBoss(this.selectedEntityId, this.selectedPhase);
      } else {
        playground.spawnEnemy(this.selectedEntityId, this.spawnCount);
      }
      
      // Update info text
      this.infoText.setText(`✅ Spawning ${this.selectedEntityType}: ${this.selectedEntityId}`);
    }
    
    console.log(`[DevPlaygroundUI] Spawning entity: ${this.selectedEntityId}, count: ${this.spawnCount}`);
  }
  
  killAll() {
    const playground = this.scene.scene.get('DevPlayground');
    if (playground && playground.scene && playground.scene.isActive() && playground.killAll) {
      playground.killAll();
      this.infoText.setText('💀 All entities killed');
    } else {
      this.infoText.setText('Playground not active - start it first');
    }
  }
  
  nextPhase() {
    const playground = this.scene.scene.get('DevPlayground');
    if (playground && playground.scene.isActive() && playground.currentBoss) {
      playground.nextPhase();
      this.selectedPhase = playground.currentPhase;
      this.phaseText.setText(this.selectedPhase.toString());
      this.infoText.setText(`📈 Phase ${this.selectedPhase}`);
    } else {
      this.infoText.setText('No boss active');
    }
  }
  
  restart() {
    const playground = this.scene.scene.get('DevPlayground');
    if (playground && playground.scene.isActive()) {
      playground.restart();
      this.selectedPhase = 1;
      this.phaseText.setText('1');
      this.infoText.setText('🔄 Playground reset');
    } else {
      this.infoText.setText('Playground not active');
    }
  }
  
  toggleAutoCycle() {
    const playground = this.scene.scene.get('DevPlayground');
    if (playground && playground.scene.isActive()) {
      playground.toggleAutoCycle();
      this.updateAutoCycleButton();
      
      if (playground.autoCycleActive) {
        this.infoText.setText('🔁 Auto-cycle ON');
      } else {
        this.infoText.setText('🔁 Auto-cycle OFF');
      }
    } else {
      this.infoText.setText('Playground not active');
    }
  }
  
  updateAutoCycleButton() {
    const playground = this.scene.scene.get('DevPlayground');
    if (playground && playground.scene.isActive() && playground.autoCycleActive) {
      this.autoCycleBtn.setBackgroundColor('#ffff88');
    } else {
      this.autoCycleBtn.setBackgroundColor('#8888ff');
    }
  }
  
  show() {
    this.visible = true;
    this.container.setVisible(true);
    
    // Don't pause game - it blocks input
    // this.scene.scene.pause();
    
    console.log('[DevPlaygroundUI] Opened');
  }
  
  hide() {
    this.visible = false;
    this.container.setVisible(false);
    
    // Not needed since we don't pause anymore
    // if (this.scene.scene.isPaused()) {
    //   this.scene.scene.resume();
    // }
    
    console.log('[DevPlaygroundUI] Closed');
  }
  
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  destroy() {
    if (this.container) {
      this.container.destroy();
    }
  }
}