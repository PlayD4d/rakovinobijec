/**
 * SFX Soundboard UI
 * Interactive panel for testing and debugging sound effects
 */

export class SFXSoundboard {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.container = null;
    
    // Sound list management
    this.allSounds = [];
    this.filteredSounds = [];
    this.currentFilter = '';
    this.selectedSound = null;
    
    // UI elements
    this.soundItems = [];
    this.scrollOffset = 0;
    this.maxVisibleItems = 12;
    
    // Currently playing sound
    this.currentlyPlaying = null;
    
    this.create();
  }
  
  create() {
    const cam = this.scene.cameras.main;
    const panelWidth = 400;
    const panelHeight = 500;
    const x = cam.width / 2;
    const y = cam.height / 2;
    
    // Main container
    this.container = this.scene.add.container(x, y);
    this.container.setDepth(20002); // Above all game UI
    this.container.setVisible(false);
    this.container.setScrollFactor(0);
    
    // Background
    this.background = this.scene.add.graphics();
    this.background.fillStyle(0x000000, 0.95);
    this.background.fillRoundedRect(-panelWidth/2, -panelHeight/2, panelWidth, panelHeight, 8);
    this.background.lineStyle(2, 0x00aaff, 1);
    this.background.strokeRoundedRect(-panelWidth/2, -panelHeight/2, panelWidth, panelHeight, 8);
    this.container.add(this.background);
    
    // Title
    this.titleText = this.scene.add.text(0, -panelHeight/2 + 20, '🔊 SFX SOUNDBOARD', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#00aaff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.container.add(this.titleText);
    
    // Subtitle
    this.subtitleText = this.scene.add.text(0, -panelHeight/2 + 40, '[F8 to toggle]', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#888888'
    }).setOrigin(0.5);
    this.container.add(this.subtitleText);
    
    // Search field
    this.createSearchField(-panelWidth/2 + 20, -panelHeight/2 + 70);
    
    // Sound list area
    this.createSoundList(-panelWidth/2 + 20, -panelHeight/2 + 120);
    
    // Info panel
    this.createInfoPanel(-panelWidth/2 + 20, panelHeight/2 - 80);
    
    // Close button
    this.createCloseButton(panelWidth/2 - 25, -panelHeight/2 + 20);
    
    // Scroll controls
    this.setupScrollControls();
    
    // Load sound list
    this.loadSoundList();
  }
  
  createSearchField(x, y) {
    // Search label
    this.searchLabel = this.scene.add.text(x, y, 'Search:', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff'
    });
    this.container.add(this.searchLabel);
    
    // Search input background
    this.searchBg = this.scene.add.graphics();
    this.searchBg.fillStyle(0x222222, 1);
    this.searchBg.fillRoundedRect(x + 60, y - 5, 300, 28, 4);
    this.searchBg.lineStyle(1, 0x00aaff, 0.5);
    this.searchBg.strokeRoundedRect(x + 60, y - 5, 300, 28, 4);
    this.container.add(this.searchBg);
    
    // Search text
    this.searchText = this.scene.add.text(x + 70, y + 9, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0, 0.5);
    this.container.add(this.searchText);
    
    // Search placeholder
    this.searchPlaceholder = this.scene.add.text(x + 70, y + 9, 'Type to filter sounds...', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#666666'
    }).setOrigin(0, 0.5);
    this.container.add(this.searchPlaceholder);
    
    // Clear button
    this.clearBtn = this.scene.add.text(x + 340, y + 9, '✕', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ff6666'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    this.clearBtn.on('pointerdown', () => this.clearSearch());
    this.clearBtn.setVisible(false);
    this.container.add(this.clearBtn);
    
    // Setup keyboard input
    this.setupKeyboardInput();
  }
  
  createSoundList(x, y) {
    // List container
    this.listContainer = this.scene.add.container(0, 0);
    this.container.add(this.listContainer);
    
    // Create sound items (reusable pool)
    for (let i = 0; i < this.maxVisibleItems; i++) {
      const itemY = y + i * 28;
      
      // Item background
      const itemBg = this.scene.add.rectangle(x + 180, itemY + 10, 360, 26, 0x111111, 0.5)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      
      // Item text
      const itemText = this.scene.add.text(x + 10, itemY + 10, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff'
      }).setOrigin(0, 0.5);
      
      // Play button
      const playBtn = this.scene.add.text(x + 340, itemY + 10, '▶', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#00ff88'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      
      const item = {
        bg: itemBg,
        text: itemText,
        playBtn: playBtn,
        soundId: null
      };
      
      // Setup interactions
      itemBg.on('pointerover', () => this.onItemHover(item));
      itemBg.on('pointerout', () => this.onItemOut(item));
      itemBg.on('pointerdown', () => this.onItemClick(item));
      playBtn.on('pointerdown', () => this.playSound(item.soundId));
      
      this.soundItems.push(item);
      this.listContainer.add([itemBg, itemText, playBtn]);
    }
    
    // Scroll indicators
    this.scrollUpIndicator = this.scene.add.text(0, y - 15, '▲ More above', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#00aaff'
    }).setOrigin(0.5).setVisible(false);
    this.container.add(this.scrollUpIndicator);
    
    this.scrollDownIndicator = this.scene.add.text(0, y + this.maxVisibleItems * 28, '▼ More below', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#00aaff'
    }).setOrigin(0.5).setVisible(false);
    this.container.add(this.scrollDownIndicator);
  }
  
  createInfoPanel(x, y) {
    // Info background
    this.infoBg = this.scene.add.graphics();
    this.infoBg.fillStyle(0x111111, 0.8);
    this.infoBg.fillRoundedRect(x, y - 60, 360, 70, 4);
    this.infoBg.lineStyle(1, 0x00aaff, 0.3);
    this.infoBg.strokeRoundedRect(x, y - 60, 360, 70, 4);
    this.container.add(this.infoBg);
    
    // Info text
    this.infoText = this.scene.add.text(x + 10, y - 50, 'Select a sound to see details', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#888888',
      wordWrap: { width: 340 }
    });
    this.container.add(this.infoText);
  }
  
  createCloseButton(x, y) {
    this.closeBtn = this.scene.add.text(x, y, '✕', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ff6666',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    this.closeBtn.on('pointerdown', () => this.hide());
    this.closeBtn.on('pointerover', () => this.closeBtn.setColor('#ff8888'));
    this.closeBtn.on('pointerout', () => this.closeBtn.setColor('#ff6666'));
    
    this.container.add(this.closeBtn);
  }
  
  setupKeyboardInput() {
    // Track if we're typing
    this.isTyping = false;
    
    // Keyboard handlers will be registered through KeyboardManager when shown
  }
  
  setupScrollControls() {
    // Mouse wheel scrolling
    this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.visible) return;
      
      // Check if pointer is over the soundboard
      const bounds = this.background.getBounds();
      if (!bounds.contains(pointer.x - this.container.x, pointer.y - this.container.y)) {
        return;
      }
      
      if (deltaY > 0) {
        this.scrollDown();
      } else {
        this.scrollUp();
      }
    });
    
    // Arrow key scrolling will be handled by KeyboardManager when modal is shown
  }
  
  loadSoundList() {
    // Get all sounds from SFX Registry
    const sfxSystem = this.scene.sfxSystem;
    if (!sfxSystem || !sfxSystem.registry) {
      console.warn('[SFXSoundboard] SFX System not available');
      return;
    }
    
    // Get all registered sounds
    this.allSounds = [];
    sfxSystem.registry.sounds.forEach((config, id) => {
      this.allSounds.push({
        id: id,
        config: config,
        exists: this.checkSoundExists(id)
      });
    });
    
    // Sort alphabetically
    this.allSounds.sort((a, b) => a.id.localeCompare(b.id));
    
    console.log(`[SFXSoundboard] Loaded ${this.allSounds.length} sounds`);
    
    // Initial filter
    this.filterSounds();
  }
  
  checkSoundExists(soundId) {
    const sfxSystem = this.scene.sfxSystem;
    if (!sfxSystem || !sfxSystem.registry) return false;
    
    const config = sfxSystem.registry.get(soundId);
    if (!config) return false;
    
    // Check if audio file exists in cache
    return this.scene.cache.audio.exists(config.key);
  }
  
  filterSounds() {
    if (!this.currentFilter) {
      this.filteredSounds = [...this.allSounds];
    } else {
      const filter = this.currentFilter.toLowerCase();
      this.filteredSounds = this.allSounds.filter(sound => 
        sound.id.toLowerCase().includes(filter)
      );
    }
    
    // Reset scroll
    this.scrollOffset = 0;
    
    // Update display
    this.updateSoundList();
  }
  
  updateSearch() {
    this.searchText.setText(this.currentFilter);
    this.searchPlaceholder.setVisible(this.currentFilter.length === 0);
    this.clearBtn.setVisible(this.currentFilter.length > 0);
    
    this.filterSounds();
  }
  
  clearSearch() {
    this.currentFilter = '';
    this.updateSearch();
  }
  
  updateSoundList() {
    // Clear all items first
    this.soundItems.forEach(item => {
      item.bg.setVisible(false);
      item.text.setVisible(false);
      item.playBtn.setVisible(false);
      item.soundId = null;
    });
    
    // Update visible items
    const startIdx = this.scrollOffset;
    const endIdx = Math.min(startIdx + this.maxVisibleItems, this.filteredSounds.length);
    
    for (let i = startIdx; i < endIdx; i++) {
      const itemIdx = i - startIdx;
      const item = this.soundItems[itemIdx];
      const sound = this.filteredSounds[i];
      
      item.soundId = sound.id;
      item.bg.setVisible(true);
      item.text.setVisible(true);
      item.playBtn.setVisible(true);
      
      // Set text color based on existence
      if (sound.exists) {
        item.text.setColor('#ffffff');
        item.playBtn.setColor('#00ff88');
      } else {
        item.text.setColor('#ff6666');
        item.playBtn.setColor('#ff6666');
      }
      
      // Truncate long IDs
      const displayId = sound.id.length > 35 ? 
        sound.id.substring(0, 32) + '...' : 
        sound.id;
      item.text.setText(displayId);
      
      // Highlight if currently playing
      if (this.currentlyPlaying === sound.id) {
        item.bg.setFillStyle(0x00aaff, 0.3);
        item.playBtn.setText('■');
      } else {
        item.bg.setFillStyle(0x111111, 0.5);
        item.playBtn.setText('▶');
      }
    }
    
    // Update scroll indicators
    this.scrollUpIndicator.setVisible(this.scrollOffset > 0);
    this.scrollDownIndicator.setVisible(endIdx < this.filteredSounds.length);
  }
  
  scrollUp() {
    if (this.scrollOffset > 0) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 3);
      this.updateSoundList();
    }
  }
  
  scrollDown() {
    const maxScroll = Math.max(0, this.filteredSounds.length - this.maxVisibleItems);
    if (this.scrollOffset < maxScroll) {
      this.scrollOffset = Math.min(maxScroll, this.scrollOffset + 3);
      this.updateSoundList();
    }
  }
  
  onItemHover(item) {
    if (item.soundId) {
      item.bg.setFillStyle(0x00aaff, 0.2);
    }
  }
  
  onItemOut(item) {
    if (item.soundId && this.currentlyPlaying !== item.soundId) {
      item.bg.setFillStyle(0x111111, 0.5);
    }
  }
  
  onItemClick(item) {
    if (item.soundId) {
      this.selectSound(item.soundId);
    }
  }
  
  selectSound(soundId) {
    this.selectedSound = soundId;
    
    const sound = this.allSounds.find(s => s.id === soundId);
    if (!sound) return;
    
    // Update info panel
    const lines = [];
    lines.push(`ID: ${soundId}`);
    
    if (sound.config) {
      lines.push(`File: ${sound.config.key || 'unknown'}`);
      lines.push(`Volume: ${sound.config.volume || 1.0}`);
      
      if (sound.config.category) {
        lines.push(`Category: ${sound.config.category}`);
      }
      
      if (sound.config.detuneRange) {
        lines.push(`Detune: [${sound.config.detuneRange.join(', ')}]`);
      }
      
      if (sound.config.loop) {
        lines.push(`Loop: true`);
      }
    }
    
    if (!sound.exists) {
      lines.push('⚠️ MISSING - Audio file not found!');
      
      // Track as missing asset
      if (window.__missingAssets) {
        window.__missingAssets.sfx.add(soundId);
      }
    }
    
    this.infoText.setText(lines.join('\n'));
    this.infoText.setColor(sound.exists ? '#aaaaaa' : '#ff6666');
  }
  
  playSound(soundId) {
    if (!soundId) return;
    
    const sfxSystem = this.scene.sfxSystem;
    if (!sfxSystem) {
      console.warn('[SFXSoundboard] SFX System not available');
      return;
    }
    
    // Stop currently playing sound if it's the same
    if (this.currentlyPlaying === soundId) {
      this.stopCurrentSound();
      return;
    }
    
    // Stop any currently playing sound
    this.stopCurrentSound();
    
    // Play the new sound
    console.log(`[SFXSoundboard] Playing: ${soundId}`);
    const soundInstance = sfxSystem.play(soundId);
    
    if (soundInstance) {
      this.currentlyPlaying = soundId;
      this.currentSoundInstance = soundInstance;
      
      // Update UI
      this.updateSoundList();
      
      // Clear when sound ends
      soundInstance.once('complete', () => {
        if (this.currentlyPlaying === soundId) {
          this.currentlyPlaying = null;
          this.currentSoundInstance = null;
          this.updateSoundList();
        }
      });
      
      soundInstance.once('stop', () => {
        if (this.currentlyPlaying === soundId) {
          this.currentlyPlaying = null;
          this.currentSoundInstance = null;
          this.updateSoundList();
        }
      });
    } else {
      // Sound failed to play - mark as missing
      const sound = this.allSounds.find(s => s.id === soundId);
      if (sound) {
        sound.exists = false;
        this.updateSoundList();
        
        // Update info if selected
        if (this.selectedSound === soundId) {
          this.selectSound(soundId);
        }
      }
    }
  }
  
  stopCurrentSound() {
    if (this.currentSoundInstance) {
      this.currentSoundInstance.stop();
      this.currentSoundInstance = null;
    }
    this.currentlyPlaying = null;
    this.updateSoundList();
  }
  
  show() {
    this.visible = true;
    this.container.setVisible(true);
    
    // Pause game
    this.scene.scene.pause();
    
    // Register keyboard handlers via KeyboardManager
    if (this.scene.keyboardManager) {
      // Text input handler
      this.scene.keyboardManager.registerTextInput('sfxsoundboard', (event) => {
        if (!this.visible) return;
        
        if (event.key === 'Escape') {
          this.hide();
          return;
        }
        
        if (event.key === 'Enter') {
          // Play first filtered sound
          if (this.filteredSounds.length > 0) {
            this.playSound(this.filteredSounds[0].id);
          }
          return;
        }
        
        if (event.key === 'Backspace') {
          this.currentFilter = this.currentFilter.slice(0, -1);
          this.updateSearch();
          return;
        }
        
        // Handle regular typing
        if (event.key.length === 1) {
          this.currentFilter += event.key;
          this.updateSearch();
        }
      });
      
      // Arrow key handlers
      this.scene.keyboardManager.registerModal('sfxsoundboard', 'UP', () => {
        if (this.visible) this.scrollUp();
      });
      
      this.scene.keyboardManager.registerModal('sfxsoundboard', 'DOWN', () => {
        if (this.visible) this.scrollDown();
      });
    }
    
    // Refresh sound list
    this.loadSoundList();
    
    // Focus on search
    this.currentFilter = '';
    this.updateSearch();
    
    console.log('[SFXSoundboard] Opened');
  }
  
  hide() {
    this.visible = false;
    this.container.setVisible(false);
    
    // Cleanup keyboard handlers via KeyboardManager
    if (this.scene.keyboardManager) {
      this.scene.keyboardManager.cleanupModal('sfxsoundboard');
    }
    
    // Stop any playing sound
    this.stopCurrentSound();
    
    // Resume game
    this.scene.scene.resume();
    
    console.log('[SFXSoundboard] Closed');
  }
  
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  destroy() {
    this.stopCurrentSound();
    
    // Cleanup modal keyboard handlers
    if (this.scene && this.scene.keyboardManager) {
      this.scene.keyboardManager.cleanupModal('sfxsoundboard');
    }
    
    if (this.container) {
      this.container.destroy();
    }
  }
}