/**
 * SFXSystem - Výkonný zvukový systém s poolováním a blueprint integrací
 * FÁZE 4: Phaser-first SFX systém pro unified blueprint systém
 * Využívá Phaser 3 Audio Manager s optimalizací pro performance
 */

import { sfxRegistry } from './SFXRegistry.js';

export class SFXSystem {
  constructor(scene) {
    this.scene = scene;
    this.registry = sfxRegistry;
    this.activeLoops = new Map(); // id -> sound instance
    this.playingChannels = new Map(); // category -> array of playing sounds
    this.volume = {
      master: 1.0,
      sfx: 1.0,
      music: 1.0,
      voice: 1.0,
      combat: 1.0,
      ui: 1.0
    };
    
    // Phase 6: Performance caps and safety
    this.maxVoices = 12; // Max concurrent sounds
    this.maxLoops = 4;   // Max concurrent loops
    this.soundCooldowns = new Map(); // key -> last play time
    this.minSoundInterval = 30; // Min ms between same sounds
    this._performanceMode = { maxConcurrentSounds: 12, enableLoops: true }; // Default
    
    this.initialized = false;
    this.debug = false; // HOTFIX V3: Keep debug OFF to prevent sound warnings
  }

  /**
   * Inicializace systému - volat v scene.create()
   */
  initialize() {
    if (this.initialized) return;

    // Registrace cleanup handlerů
    this.scene.events.once('shutdown', () => this.shutdown());
    this.scene.events.once('destroy', () => this.destroy());
    
    this.initialized = true;
    console.log(`[SFXSystem] Initialized with ${this.registry.sounds.size} registered sounds`);
  }

  /**
   * Nastavení debug módu
   */
  setDebugMode(enabled) {
    this.debug = enabled;
    if (this.debug) {
      console.log(`[SFXSystem] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Nastavení hlasitosti podle kategorie
   */
  setVolume(category, volume) {
    if (this.volume.hasOwnProperty(category)) {
      this.volume[category] = Math.max(0, Math.min(1, volume));
      
      if (this.debug) {
        console.log(`[SFXSystem] Volume ${category}: ${this.volume[category]}`);
      }
    }
  }

  /**
   * Získání efektivní hlasitosti pro kategorii
   * @private
   */
  _getEffectiveVolume(category, baseVolume = 1.0) {
    const categoryVolume = this.volume[category] || 1.0;
    return baseVolume * categoryVolume * this.volume.master;
  }

  /**
   * Randomizuje detune pokud je definován rozsah
   * @private
   */
  _getRandomDetune(config) {
    if (config.detuneRange && Array.isArray(config.detuneRange)) {
      const [min, max] = config.detuneRange;
      return min + Math.random() * (max - min);
    }
    return config.detune || 0;
  }

  /**
   * Zahraje zvuk podle ID z registru
   * @param {string} sfxId - ID zvuku v registru
   * @param {object} overrides - volitelné přepisy parametrů
   * @returns {Phaser.Sound.BaseSound|null}
   */
  play(sfxId, overrides = {}) {
    // Phase 6: Safety checks first
    if (!this._canPlaySound(sfxId)) {
      return null;
    }

    const config = this.registry.get(sfxId);
    if (!config) {
      if (this.debug) {
        console.warn(`[SFXSystem] Sound '${sfxId}' not found in registry`);
      }
      return null;
    }

    // Kontrola zda existuje audio klíč v Phaser cache
    if (!this.scene.cache.audio.exists(config.key)) {
      if (this.debug) {
        console.warn(`[SFXSystem] Audio key '${config.key}' not loaded`);
      }
      return null;
    }

    // Merge config s overrides
    const finalConfig = {
      volume: this._getEffectiveVolume(
        config.category, 
        overrides.volume ?? config.volume
      ),
      loop: overrides.loop ?? config.loop,
      rate: overrides.rate ?? config.rate,
      detune: overrides.detune ?? this._getRandomDetune(config),
      delay: overrides.delay ?? config.delay,
      seek: overrides.seek ?? config.seek,
      mute: overrides.mute ?? config.mute
    };

    try {
      // PR7: Use factory method instead of direct scene.sound call
      const sound = this._createSound(config.key, finalConfig);
      sound.play();

      // Tracking pro cleanup
      this._trackSound(sound, config.category);

      if (this.debug) {
        console.log(`[SFXSystem] Playing '${sfxId}' (${config.key}), vol: ${finalConfig.volume.toFixed(2)}`);
      }

      return sound;
    } catch (error) {
      console.error(`[SFXSystem] Error playing sound '${sfxId}':`, error);
      return null;
    }
  }

  /**
   * Zahraje zvuk z blueprint reference
   * @param {string|object|array} sfxRef - Reference ze VFX/SFX sekce blueprintu
   * @param {object} overrides - volitelné přepisy
   */
  playFromBlueprint(sfxRef, overrides = {}) {
    if (!sfxRef) return null;

    // String reference
    if (typeof sfxRef === 'string') {
      return this.play(sfxRef, overrides);
    }

    // Object s ID a parameters
    if (typeof sfxRef === 'object' && !Array.isArray(sfxRef)) {
      if (sfxRef.id) {
        const mergedOverrides = { ...sfxRef, ...overrides };
        delete mergedOverrides.id; // ID není Phaser parametr
        return this.play(sfxRef.id, mergedOverrides);
      }
    }

    // Array - přehraje náhodný zvuk
    if (Array.isArray(sfxRef) && sfxRef.length > 0) {
      const randomSound = sfxRef[Math.floor(Math.random() * sfxRef.length)];
      return this.playFromBlueprint(randomSound, overrides);
    }

    if (this.debug) {
      console.warn(`[SFXSystem] Invalid sfx reference:`, sfxRef);
    }
    return null;
  }

  /**
   * Začne přehrávat loop podle ID
   * @param {string} sfxId
   * @param {object} overrides 
   * @returns {string|null} - loopId pro stop
   */
  startLoop(sfxId, overrides = {}) {
    const config = this.registry.get(sfxId);
    if (!config) return null;

    // Generuj unikátní loop ID
    const loopId = `${sfxId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    if (this.activeLoops.has(loopId)) {
      this.stopLoop(loopId);
    }

    const sound = this.play(sfxId, { ...overrides, loop: true });
    if (sound) {
      this.activeLoops.set(loopId, sound);
      
      if (this.debug) {
        console.log(`[SFXSystem] Started loop '${loopId}' (${sfxId})`);
      }
    }

    return loopId;
  }

  /**
   * Zastaví loop podle ID
   */
  stopLoop(loopId) {
    const sound = this.activeLoops.get(loopId);
    if (sound) {
      sound.stop();
      this.activeLoops.delete(loopId);
      
      if (this.debug) {
        console.log(`[SFXSystem] Stopped loop '${loopId}'`);
      }
    }
  }

  /**
   * Zastaví všechny looky
   */
  stopAllLoops() {
    for (const [loopId, sound] of this.activeLoops) {
      sound.stop();
    }
    this.activeLoops.clear();
    
    if (this.debug) {
      console.log(`[SFXSystem] Stopped all loops`);
    }
  }

  /**
   * Fade in zvuk
   */
  fadeIn(sfxId, duration = 1000, targetVolume = null, overrides = {}) {
    const sound = this.play(sfxId, { ...overrides, volume: 0 });
    if (!sound) return null;

    const config = this.registry.get(sfxId);
    const finalVolume = targetVolume ?? this._getEffectiveVolume(
      config?.category || 'sfx', 
      overrides.volume ?? config?.volume ?? 1.0
    );

    this.scene.tweens.add({
      targets: sound,
      volume: finalVolume,
      duration: duration,
      ease: 'Linear'
    });

    return sound;
  }

  /**
   * Fade out zvuk
   */
  fadeOut(sound, duration = 1000, stopAfter = true) {
    if (!sound) return;

    this.scene.tweens.add({
      targets: sound,
      volume: 0,
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        if (stopAfter) {
          sound.stop();
        }
      }
    });
  }

  /**
   * Pausne všechny zvuky v kategorii
   */
  pauseCategory(category) {
    const sounds = this.playingChannels.get(category) || [];
    sounds.forEach(sound => {
      if (sound.isPlaying) {
        sound.pause();
      }
    });

    if (this.debug) {
      console.log(`[SFXSystem] Paused category '${category}' (${sounds.length} sounds)`);
    }
  }

  /**
   * Resume všechny zvuky v kategorii
   */
  resumeCategory(category) {
    const sounds = this.playingChannels.get(category) || [];
    sounds.forEach(sound => {
      if (sound.isPaused) {
        sound.resume();
      }
    });

    if (this.debug) {
      console.log(`[SFXSystem] Resumed category '${category}' (${sounds.length} sounds)`);
    }
  }

  /**
   * Zastaví všechny zvuky v kategorii
   */
  stopCategory(category) {
    const sounds = this.playingChannels.get(category) || [];
    sounds.forEach(sound => sound.stop());
    this.playingChannels.set(category, []);

    if (this.debug) {
      console.log(`[SFXSystem] Stopped category '${category}' (${sounds.length} sounds)`);
    }
  }

  /**
   * Zastaví všechny zvuky
   */
  stopAll() {
    // PR7: Use factory method instead of direct scene.sound call
    this._stopAllSounds();
    this.stopAllLoops();
    this.playingChannels.clear();
    
    if (this.debug) {
      console.log(`[SFXSystem] Stopped all sounds`);
    }
  }

  /**
   * Track sound for cleanup
   * @private
   */
  _trackSound(sound, category) {
    if (!this.playingChannels.has(category)) {
      this.playingChannels.set(category, []);
    }

    const sounds = this.playingChannels.get(category);
    sounds.push(sound);

    // Cleanup po dokončení
    sound.once('complete', () => {
      const index = sounds.indexOf(sound);
      if (index !== -1) {
        sounds.splice(index, 1);
      }
    });

    // Cleanup stopped sounds
    sound.once('stop', () => {
      const index = sounds.indexOf(sound);
      if (index !== -1) {
        sounds.splice(index, 1);
      }
    });
  }

  /**
   * Získá statistiky přehrávaných zvuků
   */
  getStats() {
    const stats = {
      totalActive: 0,
      byCategory: {},
      activeLoops: this.activeLoops.size,
      registeredSounds: this.registry.sounds.size
    };

    for (const [category, sounds] of this.playingChannels) {
      const activeSounds = sounds.filter(s => s.isPlaying || s.isPaused);
      stats.byCategory[category] = activeSounds.length;
      stats.totalActive += activeSounds.length;
    }

    return stats;
  }

  /**
   * Debug info o zvukových kategoriích (rozšířeno pro Phase 5)
   */
  debugInfo() {
    if (!this.debug) return;

    const stats = this.getStats();
    console.log(`[SFXSystem] Active: ${stats.totalActive}, Loops: ${stats.activeLoops}`);
    console.log('[SFXSystem] By category:', stats.byCategory);
    console.log('[SFXSystem] Volumes:', this.volume);
  }

  /**
   * Phase 5: Hlasitostní profily
   */
  setVolumeProfile(profileName) {
    const profiles = {
      silent: { master: 0.0, sfx: 0.0, music: 0.0, voice: 0.0, combat: 0.0, ui: 0.0 },
      quiet: { master: 0.3, sfx: 0.2, music: 0.4, voice: 0.3, combat: 0.1, ui: 0.3 },
      normal: { master: 1.0, sfx: 0.8, music: 0.6, voice: 1.0, combat: 0.7, ui: 0.8 },
      intense: { master: 1.0, sfx: 1.0, music: 0.8, voice: 1.0, combat: 1.0, ui: 0.6 },
      combat: { master: 1.0, sfx: 1.0, music: 0.3, voice: 0.8, combat: 1.2, ui: 0.4 },
      cinematic: { master: 1.0, sfx: 0.6, music: 1.0, voice: 1.0, combat: 0.8, ui: 0.2 }
    };
    
    const profile = profiles[profileName];
    if (!profile) {
      console.warn(`[SFXSystem] Unknown volume profile: ${profileName}`);
      return;
    }
    
    for (const [category, volume] of Object.entries(profile)) {
      this.setVolume(category, volume);
    }
    
    console.log(`[SFXSystem] Applied volume profile: ${profileName}`);
    if (this.debug) {
      console.log('[SFXSystem] Profile volumes:', profile);
    }
  }

  /**
   * Phase 6: Safety caps and polyphony control
   */
  setMaxVoices(count) {
    this.maxVoices = Math.max(1, Math.min(32, count));
    console.log(`[SFXSystem] Max voices set to: ${this.maxVoices}`);
  }

  setMaxLoops(count) {
    this.maxLoops = Math.max(0, Math.min(8, count));
    console.log(`[SFXSystem] Max loops set to: ${this.maxLoops}`);
    
    // Enforce current limit
    this._enforceLoopCap();
  }

  _canPlaySound(sfxId) {
    // Check polyphony limit
    const stats = this.getStats();
    if (stats.totalActive >= this.maxVoices) {
      if (this.debug) {
        console.warn(`[SFXSystem] Voice limit reached (${stats.totalActive}/${this.maxVoices}), dropping sound: ${sfxId}`);
      }
      
      // Drop oldest non-critical sound
      this._dropOldestNonCritical();
      return stats.totalActive < this.maxVoices; // Recheck after dropping
    }

    // Check sound cooldown (prevent spam)
    const now = this.scene.time.now;
    const lastPlay = this.soundCooldowns.get(sfxId) || 0;
    if (now - lastPlay < this.minSoundInterval) {
      if (this.debug) {
        console.warn(`[SFXSystem] Sound cooldown active for: ${sfxId}`);
      }
      return false;
    }

    // Update cooldown
    this.soundCooldowns.set(sfxId, now);
    return true;
  }

  _dropOldestNonCritical() {
    // Priority: ui < pickup < combat < boss < player
    const priorityOrder = ['ui', 'pickup', 'sfx', 'combat', 'boss', 'player'];
    
    for (const category of priorityOrder) {
      const sounds = this.playingChannels.get(category) || [];
      const playingSounds = sounds.filter(s => s.isPlaying);
      
      if (playingSounds.length > 0) {
        const oldest = playingSounds[0]; // First played = oldest
        oldest.stop();
        if (this.debug) {
          console.log(`[SFXSystem] Dropped oldest sound from category: ${category}`);
        }
        return;
      }
    }
  }

  _enforceLoopCap() {
    if (this.activeLoops.size > this.maxLoops) {
      const toStop = this.activeLoops.size - this.maxLoops;
      console.warn(`[SFXSystem] Loop cap exceeded (${this.activeLoops.size}/${this.maxLoops}), stopping ${toStop} oldest`);
      
      let stopped = 0;
      for (const [loopId, sound] of this.activeLoops) {
        if (stopped < toStop) {
          sound.stop();
          this.activeLoops.delete(loopId);
          stopped++;
        } else {
          break;
        }
      }
    }
  }

  /**
   * Phase 5: Performance nastavení
   */
  setPerformanceMode(mode) {
    const modes = {
      low: { 
        maxConcurrentSounds: 5, 
        enableDetailedSounds: false, 
        enableLoops: false,
        description: 'Minimální zvuky pro slabá zařízení' 
      },
      medium: { 
        maxConcurrentSounds: 10, 
        enableDetailedSounds: true, 
        enableLoops: true,
        description: 'Standardní kvalithy zvuků' 
      },
      high: { 
        maxConcurrentSounds: 20, 
        enableDetailedSounds: true, 
        enableLoops: true,
        description: 'Plná kvalita zvuků' 
      }
    };
    
    const config = modes[mode];
    if (!config) {
      console.warn(`[SFXSystem] Unknown performance mode: ${mode}`);
      return;
    }
    
    this._performanceMode = config;
    console.log(`[SFXSystem] Applied performance mode: ${mode} - ${config.description}`);
  }

  /**
   * Testovací funkce pro přehrání všech registrovaných zvuků
   */
  testAllSounds(delayBetween = 500) {
    if (!this.debug) {
      console.warn('[SFXSystem] Enable debug mode first');
      return;
    }

    const sounds = this.registry.listAll();
    console.log(`[SFXSystem] Testing ${sounds.length} registered sounds...`);

    sounds.forEach((sound, index) => {
      this.scene.time.delayedCall(index * delayBetween, () => {
        console.log(`[SFXSystem] Testing: ${sound.id} (${sound.key})`);
        this.play(sound.id);
      });
    });
  }

  /**
   * Cleanup při shutdown scény
   */
  shutdown() {
    this.stopAll();
    console.log('[SFXSystem] Shutdown');
  }

  /**
   * Úplná destrukce systému
   */
  destroy() {
    this.shutdown();
    this.playingChannels.clear();
    this.initialized = false;
    console.log('[SFXSystem] Destroyed');
  }
  
  // ==========================================
  // PR7 Factory Methods - Replace Direct Calls
  // ==========================================
  
  /**
   * Factory method for creating sound objects
   * @param {string} key - Sound asset key
   * @param {Object} config - Sound configuration
   * @returns {Phaser.Sound.BaseSound}
   * @private
   */
  _createSound(key, config) {
    // PR7: Centralized sound creation with potential for pooling
    if (!this.scene || !this.scene.sound) {
      throw new Error('[SFXSystem] Scene sound manager not available');
    }
    
    // Could implement sound pooling here in the future
    return this.scene.sound.add(key, config);
  }
  
  /**
   * Factory method for stopping all sounds
   * @private
   */
  _stopAllSounds() {
    // PR7: Centralized sound stopping
    if (!this.scene || !this.scene.sound) {
      console.warn('[SFXSystem] Scene sound manager not available for stopAll');
      return;
    }
    
    this.scene.sound.stopAll();
  }
}

export default SFXSystem;