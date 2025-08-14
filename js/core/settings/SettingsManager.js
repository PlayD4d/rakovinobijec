/**
 * SettingsManager - Phase 6: Perzistence uživatelských nastavení
 * Ukládá audio, VFX, performance a accessibility nastavení do localStorage
 */

export class SettingsManager {
  constructor() {
    this.storageKey = 'rakovinobijec_settings_v1';
    this.eventListeners = new Map(); // PR4: Event system for auto-apply
    this.connectedSystems = { vfx: null, sfx: null, camera: null }; // PR4: System references
    this.defaults = {
      audio: {
        master: 1.0,
        sfx: 0.8,
        music: 0.6,
        voice: 1.0,
        combat: 0.7,
        ui: 0.8,
        profile: 'normal' // silent, quiet, normal, intense, combat, cinematic
      },
      performance: {
        vfx: 'medium', // low, medium, high
        sfx: 'medium', // low, medium, high
        maxEmitters: 24,
        maxVoices: 12,
        enableTrails: true
      },
      accessibility: {
        cameraShake: 1.0, // 0.0 = disabled, 1.0 = full
        flashStrobe: true, // flash effects enabled
        reduceMotion: false // reduced motion mode
      },
      ui: {
        showFPS: false,
        showDebugStats: false,
        compactHUD: false
      }
    };
    
    this.settings = this.load();
  }

  /**
   * Načíst nastavení z localStorage
   */
  load() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge s defaults pro nové nastavení
        return this._mergeWithDefaults(parsed);
      }
    } catch (e) {
      console.warn('[SettingsManager] Failed to load settings:', e);
    }
    
    return { ...this.defaults };
  }

  /**
   * Uložit nastavení do localStorage
   */
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      console.log('[SettingsManager] Settings saved');
    } catch (e) {
      console.error('[SettingsManager] Failed to save settings:', e);
    }
  }

  /**
   * Merge s defaults pro backward compatibility
   */
  _mergeWithDefaults(stored) {
    const merged = { ...this.defaults };
    
    for (const [category, values] of Object.entries(stored)) {
      if (merged[category]) {
        merged[category] = { ...merged[category], ...values };
      } else {
        merged[category] = values;
      }
    }
    
    return merged;
  }

  // === Audio Settings ===

  setAudioVolume(category, volume) {
    const oldValue = this.settings.audio[category];
    this.settings.audio[category] = Math.max(0, Math.min(1, volume));
    this.save();
    
    // PR4: Auto-apply to connected SFX system and emit event
    if (oldValue !== this.settings.audio[category]) {
      if (this.connectedSystems.sfx) {
        this.connectedSystems.sfx.setVolume(category, this.settings.audio[category]);
      }
      this._emitSettingChange('audio.volume.' + category, this.settings.audio[category]);
    }
  }

  setAudioProfile(profile) {
    const oldProfile = this.settings.audio.profile;
    this.settings.audio.profile = profile;
    this.save();
    
    // PR4: Auto-apply profile to connected SFX system and emit event
    if (oldProfile !== profile) {
      if (this.connectedSystems.sfx) {
        this.connectedSystems.sfx.setVolumeProfile(profile);
      }
      this._emitSettingChange('audio.profile', profile);
    }
  }

  getAudioSettings() {
    return { ...this.settings.audio };
  }

  // === Performance Settings ===

  setPerformanceMode(category, mode) {
    if (category === 'vfx' || category === 'sfx') {
      const oldMode = this.settings.performance[category];
      this.settings.performance[category] = mode;
      this.save();
      
      // PR4: Auto-apply to connected systems and emit event
      if (oldMode !== mode) {
        if (category === 'vfx' && this.connectedSystems.vfx) {
          this.connectedSystems.vfx.setPerformanceMode(mode);
        } else if (category === 'sfx' && this.connectedSystems.sfx) {
          this.connectedSystems.sfx.setPerformanceMode(mode);
        }
        this._emitSettingChange('performance.' + category, mode);
      }
    }
  }

  setPerformanceLimits(maxEmitters, maxVoices) {
    this.settings.performance.maxEmitters = maxEmitters;
    this.settings.performance.maxVoices = maxVoices;
    this.save();
  }

  getPerformanceSettings() {
    return { ...this.settings.performance };
  }

  // === Accessibility Settings ===

  setCameraShakeIntensity(intensity) {
    const oldIntensity = this.settings.accessibility.cameraShake;
    this.settings.accessibility.cameraShake = Math.max(0, Math.min(1, intensity));
    this.save();
    
    // PR4: Auto-apply to camera system
    if (this.connectedSystems.camera && oldIntensity !== this.settings.accessibility.cameraShake) {
      this.connectedSystems.camera.setShakeIntensity(this.settings.accessibility.cameraShake);
      this._emitSettingChange('accessibility.cameraShake', this.settings.accessibility.cameraShake);
    }
  }

  setFlashStrobeEnabled(enabled) {
    const oldValue = this.settings.accessibility.flashStrobe;
    this.settings.accessibility.flashStrobe = enabled;
    this.save();
    
    // PR4: Auto-apply to VFX system
    if (this.connectedSystems.vfx && oldValue !== enabled) {
      this.connectedSystems.vfx.setFlashEnabled(enabled);
      this._emitSettingChange('accessibility.flashStrobe', enabled);
    }
  }

  setReducedMotion(enabled) {
    const oldValue = this.settings.accessibility.reduceMotion;
    this.settings.accessibility.reduceMotion = enabled;
    this.save();
    
    // PR4: Auto-apply to VFX system
    if (this.connectedSystems.vfx && oldValue !== enabled) {
      this.connectedSystems.vfx.setReducedMotion(enabled);
      this._emitSettingChange('accessibility.reduceMotion', enabled);
    }
  }

  getAccessibilitySettings() {
    return { ...this.settings.accessibility };
  }

  // === UI Settings ===

  setUIOption(option, value) {
    if (this.settings.ui.hasOwnProperty(option)) {
      this.settings.ui[option] = value;
      this.save();
    }
  }

  getUISettings() {
    return { ...this.settings.ui };
  }

  // === Utility Methods ===

  /**
   * Reset na výchozí nastavení
   */
  resetToDefaults() {
    this.settings = { ...this.defaults };
    this.save();
    console.log('[SettingsManager] Settings reset to defaults');
  }

  /**
   * Export nastavení pro debugging
   */
  exportSettings() {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import nastavení (s validací)
   */
  importSettings(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.settings = this._mergeWithDefaults(imported);
      this.save();
      console.log('[SettingsManager] Settings imported successfully');
      return true;
    } catch (e) {
      console.error('[SettingsManager] Failed to import settings:', e);
      return false;
    }
  }

  /**
   * Aplikovat nastavení na VFX/SFX systémy
   */
  applyToSystems(vfxSystem, sfxSystem) {
    if (sfxSystem) {
      // Audio nastavení
      const audio = this.settings.audio;
      for (const [category, volume] of Object.entries(audio)) {
        if (category !== 'profile') {
          sfxSystem.setVolume(category, volume);
        }
      }
      
      // Performance nastavení
      const perf = this.settings.performance;
      sfxSystem.setPerformanceMode(perf.sfx);
      sfxSystem.setMaxVoices(perf.maxVoices);
    }

    if (vfxSystem) {
      // Performance nastavení
      const perf = this.settings.performance;
      vfxSystem.setPerformanceMode(perf.vfx);
      vfxSystem.setMaxEmitters(perf.maxEmitters);
      
      // Accessibility nastavení
      const access = this.settings.accessibility;
      if (vfxSystem.setCameraShakeIntensity) {
        vfxSystem.setCameraShakeIntensity(access.cameraShake);
      }
      if (vfxSystem.setFlashEnabled) {
        vfxSystem.setFlashEnabled(access.flashStrobe);
      }
    }

    console.log('[SettingsManager] Settings applied to systems');
  }

  // === PR4: Auto-Apply System ===

  /**
   * Connect systems for auto-apply functionality
   */
  connectSystems({ vfx = null, sfx = null, camera = null } = {}) {
    this.connectedSystems.vfx = vfx;
    this.connectedSystems.sfx = sfx;
    this.connectedSystems.camera = camera;
    
    console.log('[SettingsManager] Systems connected:', {
      vfx: !!vfx,
      sfx: !!sfx, 
      camera: !!camera
    });
  }

  /**
   * Add event listener for setting changes
   */
  addEventListener(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType, callback) {
    if (this.eventListeners.has(eventType)) {
      const listeners = this.eventListeners.get(eventType);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit setting change event
   * @private
   */
  _emitSettingChange(eventType, newValue) {
    if (this.eventListeners.has(eventType)) {
      this.eventListeners.get(eventType).forEach(callback => {
        try {
          callback(newValue, eventType);
        } catch (e) {
          console.error('[SettingsManager] Event listener error:', e);
        }
      });
    }
  }

  /**
   * Apply predefined profile sets for quick switching
   */
  applyProfile(profileName) {
    const profiles = {
      silent: {
        audio: { master: 0, sfx: 0, music: 0, voice: 0, combat: 0, ui: 0 },
        performance: { vfx: 'low', sfx: 'low' },
        accessibility: { cameraShake: 0, flashStrobe: false, reduceMotion: true }
      },
      quiet: {
        audio: { master: 0.3, sfx: 0.2, music: 0.1, voice: 0.4, combat: 0.1, ui: 0.3 },
        performance: { vfx: 'low', sfx: 'medium' },
        accessibility: { cameraShake: 0.3, flashStrobe: false, reduceMotion: true }
      },
      combat: {
        audio: { master: 0.8, sfx: 1.0, music: 0.4, voice: 0.8, combat: 1.0, ui: 0.6 },
        performance: { vfx: 'high', sfx: 'high' },
        accessibility: { cameraShake: 0.8, flashStrobe: true, reduceMotion: false }
      },
      cinematic: {
        audio: { master: 1.0, sfx: 0.9, music: 0.8, voice: 1.0, combat: 0.7, ui: 0.5 },
        performance: { vfx: 'high', sfx: 'high' },
        accessibility: { cameraShake: 1.0, flashStrobe: true, reduceMotion: false }
      }
    };

    const profile = profiles[profileName];
    if (!profile) {
      console.warn(`[SettingsManager] Unknown profile: ${profileName}`);
      return;
    }

    // Apply audio settings
    for (const [key, value] of Object.entries(profile.audio)) {
      this.setAudioVolume(key, value);
    }

    // Apply performance settings
    for (const [key, value] of Object.entries(profile.performance)) {
      this.setPerformanceMode(key, value);
    }

    // Apply accessibility settings
    if (profile.accessibility.cameraShake !== undefined) {
      this.setCameraShakeIntensity(profile.accessibility.cameraShake);
    }
    if (profile.accessibility.flashStrobe !== undefined) {
      this.setFlashStrobeEnabled(profile.accessibility.flashStrobe);
    }
    if (profile.accessibility.reduceMotion !== undefined) {
      this.setReducedMotion(profile.accessibility.reduceMotion);
    }

    // Update profile name
    this.settings.audio.profile = profileName;
    this.save();

    console.log(`[SettingsManager] Applied profile: ${profileName}`);
    this._emitSettingChange('profile.applied', profileName);
  }

  /**
   * Debug info pro dev konzoli
   */
  debugInfo() {
    console.log('[SettingsManager] Current settings:');
    console.log('Audio:', this.settings.audio);
    console.log('Performance:', this.settings.performance);
    console.log('Accessibility:', this.settings.accessibility);
    console.log('UI:', this.settings.ui);
    console.log('Connected systems:', this.connectedSystems);
    console.log('Event listeners:', this.eventListeners.size);
  }
}

// Singleton instance
export const settingsManager = new SettingsManager();
export default settingsManager;