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
    
    // Missing asset tracking for dev mode
    this.missingAssets = new Set();
    this._initMissingAssetTracking();
    
    // Track looping sounds for management
    this.loopingSounds = new Map(); // id -> sound instance
  }
  
  /**
   * Initialize missing asset tracking for dev mode
   * @private
   */
  _initMissingAssetTracking() {
    if (typeof window !== 'undefined') {
      window.__missingAssets = window.__missingAssets || { sfx: new Set(), vfx: new Set() };
    }
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
   * Zahraje zvuk podle ID z registru NEBO přímé file path
   * @param {string} sfxIdOrPath - ID zvuku v registru NEBO přímá cesta k souboru (např. 'sound/laser.mp3')
   * @param {object} overrides - volitelné přepisy parametrů
   * @returns {Phaser.Sound.BaseSound|null}
   */
  play(sfxIdOrPath, overrides = {}) {
    // DEBUG: Log all sound plays
    if (window.DEBUG_FLAGS?.sfx) {
      console.log(`[SFX DEBUG] Playing sound: '${sfxIdOrPath}'`);
    }
    
    // Phase 6: Safety checks first
    if (!this._canPlaySound(sfxIdOrPath)) {
      return null;
    }

    // PHASE 2: Smart detection - Registry ID vs Direct File Path
    const isDirectPath = this._isDirectFilePath(sfxIdOrPath);
    
    if (isDirectPath) {
      return this._playDirectFilePath(sfxIdOrPath, overrides);
    } else {
      return this._playFromRegistry(sfxIdOrPath, overrides);
    }
  }

  /**
   * Detekuje zda je vstup přímá cesta k souboru nebo registry ID
   * @param {string} input 
   * @returns {boolean}
   * @private
   */
  _isDirectFilePath(input) {
    // Direct file path detection patterns:
    // - obsahuje '/' (path separator) 
    // - končí audio extension (.mp3, .ogg, .wav)
    // - nezačíná 'sfx.' (registry prefix)
    
    if (input.startsWith('sfx.')) {
      return false; // Registry ID
    }
    
    if (input.includes('/') || /\.(mp3|ogg|wav|m4a)$/i.test(input)) {
      return true; // Direct file path
    }
    
    return false; // Default to registry lookup
  }

  /**
   * Přehraje zvuk z přímé file path
   * @param {string} filePath - např. 'sound/laser.mp3' 
   * @param {object} overrides
   * @returns {Phaser.Sound.BaseSound|null}
   * @private
   */
  _playDirectFilePath(filePath, overrides = {}) {
    // Normalize file path
    const normalizedPath = filePath.replace(/^\/+/, ''); // Remove leading slashes
    
    // Extract audio key from file path for Phaser cache lookup
    const audioKey = this._extractAudioKeyFromPath(normalizedPath);
    
    // DEBUG: Log direct file path play
    if (window.DEBUG_FLAGS?.sfx) {
      console.log(`[SFX DEBUG] Direct file path: '${filePath}' → audioKey: '${audioKey}'`);
    }

    // Check if audio key exists in Phaser cache
    if (!this.scene.cache.audio.exists(audioKey)) {
      // Track missing asset in dev mode
      this._trackMissingAsset(filePath, audioKey);
      
      // Play soft fallback beep
      return this._playFallback(filePath, 'missing_direct_audio');
    }

    // Create config for direct file path (use sensible defaults)
    const finalConfig = {
      volume: this._getEffectiveVolume(
        overrides.category || 'sfx', 
        overrides.volume ?? 0.7 // Default volume for direct files
      ),
      loop: overrides.loop ?? false,
      rate: overrides.rate ?? 1.0,
      detune: overrides.detune ?? 0,
      delay: overrides.delay ?? 0,
      seek: overrides.seek ?? 0,
      mute: overrides.mute ?? false
    };

    try {
      // PR7: Use factory method instead of direct scene.sound call
      const sound = this._createSound(audioKey, finalConfig);
      sound.play();

      // Tracking pro cleanup (use provided category or default)
      this._trackSound(sound, overrides.category || 'sfx');

      if (this.debug || window.DEBUG_FLAGS?.sfx) {
        console.log(`[SFXSystem] Playing direct '${filePath}' (${audioKey}), vol: ${finalConfig.volume.toFixed(2)}`);
      }

      return sound;
    } catch (error) {
      console.error(`[SFXSystem] Error playing direct file '${filePath}':`, error);
      return null;
    }
  }

  /**
   * Přehraje zvuk z registry (legacy způsob)
   * @param {string} sfxId - ID zvuku v registru
   * @param {object} overrides
   * @returns {Phaser.Sound.BaseSound|null}
   * @private
   */
  _playFromRegistry(sfxId, overrides = {}) {
    const config = this.registry.get(sfxId);
    if (!config) {
      // Track missing asset in dev mode
      this._trackMissingAsset(sfxId);
      
      // Play soft fallback beep
      return this._playFallback(sfxId, 'missing_registry');
    }

    // Kontrola zda existuje audio klíč v Phaser cache
    if (!this.scene.cache.audio.exists(config.key)) {
      // Track missing audio file
      this._trackMissingAsset(sfxId, config.key);
      
      // Play soft fallback beep
      return this._playFallback(sfxId, 'missing_audio');
    }
    
    // DEBUG: Log resolved audio key
    if (window.DEBUG_FLAGS?.sfx) {
      console.log(`[SFX DEBUG] Resolved '${sfxId}' to audio key: '${config.key}'`);
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

      if (this.debug || window.DEBUG_FLAGS?.sfx) {
        console.log(`[SFXSystem] Playing '${sfxId}' (${config.key}), vol: ${finalConfig.volume.toFixed(2)}`);
      }

      return sound;
    } catch (error) {
      console.error(`[SFXSystem] Error playing sound '${sfxId}':`, error);
      return null;
    }
  }

  /**
   * Extrahuje audio klíč z file path pro Phaser cache lookup
   * @param {string} filePath - např. 'sound/laser.mp3'
   * @returns {string} - např. 'laser'
   * @private
   */
  _extractAudioKeyFromPath(filePath) {
    // Examples:
    // 'sound/laser.mp3' → 'laser'
    // 'audio/explosion_small.ogg' → 'explosion_small'
    // 'sfx/ui/button_click.wav' → 'button_click'
    
    const fileName = filePath.split('/').pop(); // Get filename
    const audioKey = fileName.replace(/\.(mp3|ogg|wav|m4a)$/i, ''); // Remove extension
    
    return audioKey;
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
   * Play a looping sound
   * @param {string} sfxId - Sound ID from registry
   * @param {object} overrides - Optional parameter overrides
   * @returns {string|null} - Loop ID for stopping later
   */
  playLoop(sfxId, overrides = {}) {
    // Check if we already have this loop playing
    if (this.loopingSounds.has(sfxId)) {
      if (this.debug) {
        console.log(`[SFXSystem] Loop already playing: ${sfxId}`);
      }
      return sfxId;
    }
    
    // Check loop limit
    if (this.loopingSounds.size >= this.maxLoops) {
      if (this.debug) {
        console.warn(`[SFXSystem] Max loops reached (${this.maxLoops})`);
      }
      return null;
    }
    
    // Play with loop forced to true
    const sound = this.play(sfxId, { ...overrides, loop: true });
    if (sound) {
      this.loopingSounds.set(sfxId, sound);
      return sfxId;
    }
    
    return null;
  }
  
  /**
   * Stop a looping sound
   * @param {string} loopId - The loop ID returned from playLoop
   */
  stopLoop(loopId) {
    const sound = this.loopingSounds.get(loopId);
    if (sound) {
      try {
        if (sound.isPlaying) {
          sound.stop();
        }
        sound.destroy();
      } catch (e) {
        // Ignore errors from already destroyed sounds
      }
      this.loopingSounds.delete(loopId);
    }
  }
  
  /**
   * Stop all looping sounds
   */
  stopAllLoops() {
    this.loopingSounds.forEach((sound, id) => {
      this.stopLoop(id);
    });
  }
  
  /**
   * Legacy startLoop method for compatibility
   * @param {string} sfxId
   * @param {object} overrides 
   * @returns {string|null} - loopId pro stop
   */
  startLoop(sfxId, overrides = {}) {
    return this.playLoop(sfxId, overrides);
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
  // Soft Fallback Methods
  // ==========================================
  
  /**
   * Track missing asset and update dev mode tracking
   * @private
   */
  _trackMissingAsset(sfxId, audioKey = null) {
    const assetInfo = audioKey ? `${sfxId} (${audioKey})` : sfxId;
    
    // Check if we've already warned about this asset recently
    const now = Date.now();
    if (!this._lastMissingAssetWarnings) {
      this._lastMissingAssetWarnings = new Map();
    }
    
    const lastWarning = this._lastMissingAssetWarnings.get(assetInfo);
    const warningCooldown = 5000; // Only warn once every 5 seconds per asset
    
    // Add to local tracking
    this.missingAssets.add(assetInfo);
    
    // Add to global tracking for dev overlay
    if (typeof window !== 'undefined' && window.__missingAssets) {
      window.__missingAssets.sfx.add(assetInfo);
    }
    
    // Log warning in dev mode (with rate limiting)
    if (this.debug || window.DEV_MODE === true || (this.scene.game && this.scene.game.config.physics.arcade?.debug)) {
      if (!lastWarning || (now - lastWarning) > warningCooldown) {
        console.warn(`[SFXSystem] Missing asset: ${assetInfo}`);
        this._lastMissingAssetWarnings.set(assetInfo, now);
      }
    }
  }
  
  /**
   * Play a soft fallback sound when asset is missing
   * @private
   */
  _playFallback(sfxId, reason) {
    // Only play fallback in dev mode
    if (!this.debug && !window.DEV_MODE && !(this.scene.game && this.scene.game.config.physics.arcade?.debug)) {
      return null;
    }
    
    try {
      // Try to play a simple beep if available
      if (this.scene.cache.audio.exists('beep') || this.scene.cache.audio.exists('placeholder_beep')) {
        const beepKey = this.scene.cache.audio.exists('beep') ? 'beep' : 'placeholder_beep';
        const sound = this._createSound(beepKey, {
          volume: 0.2,
          detune: reason === 'missing_registry' ? -200 : 
                  reason === 'missing_direct_audio' ? 100 : 0
        });
        sound.play();
        return sound;
      }
      
      // If no beep available, create a simple tone using Web Audio API
      if (this.scene.sound.context) {
        this._playWebAudioBeep(reason);
      }
    } catch (error) {
      // Silent fail - we don't want fallback to crash the game
      if (this.debug) {
        console.error('[SFXSystem] Fallback failed:', error);
      }
    }
    
    return null;
  }
  
  /**
   * Play a simple beep using Web Audio API
   * @private
   */
  _playWebAudioBeep(reason) {
    const context = this.scene.sound.context;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.frequency.value = reason === 'missing_registry' ? 300 : 
                                  reason === 'missing_direct_audio' ? 500 : 400;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);
    
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.1);
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