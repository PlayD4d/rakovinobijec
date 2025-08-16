/**
 * MusicManager - Centrální správce hudby
 * PR7 kompatibilní - načítá konfiguraci z main_config.json5
 * Respektuje nastavení hlasitosti z SettingsManager
 */

export class MusicManager {
    constructor(scene) {
        this.scene = scene;
        this.currentMusic = null;
        this.currentTrackIndex = -1;
        this.tracks = [];
        this.category = null; // 'mainMenu', 'game', 'boss'
        this.config = null;
        this.fadeInTime = 1000;
        this.fadeOutTime = 500;
        this.isTransitioning = false;
        
        // Volume settings
        this.masterVolume = 1.0;
        this.musicVolume = 0.5;
        this.musicEnabled = true;
        
        // Initialize from ConfigResolver
        this.loadConfig();
        
        // Listen for settings changes
        this.setupSettingsListener();
    }
    
    /**
     * Load configuration from ConfigResolver
     */
    loadConfig() {
        const CR = window.ConfigResolver;
        if (!CR) {
            console.warn('[MusicManager] ConfigResolver not available');
            return;
        }
        
        // Load audio scene configuration
        this.scenesConfig = {
            mainMenu: CR.get('audio.scenes.mainMenu', { defaultValue: {} }),
            game: CR.get('audio.scenes.game', { defaultValue: {} }),
            boss: CR.get('audio.scenes.boss', { defaultValue: {} })
        };
        
        console.log('[MusicManager] Loaded config:', this.scenesConfig);
    }
    
    /**
     * Setup listener for settings changes
     */
    setupSettingsListener() {
        // Get initial settings from SettingsManager
        const settingsManager = window.settingsManager || this.scene.settingsManager;
        if (settingsManager) {
            this.updateVolumeFromSettings(settingsManager);
            
            // Listen for changes
            settingsManager.addListener('audio.musicVolume', (value) => {
                this.musicVolume = value;
                this.updateCurrentMusicVolume();
            });
            
            settingsManager.addListener('audio.masterVolume', (value) => {
                this.masterVolume = value;
                this.updateCurrentMusicVolume();
            });
            
            settingsManager.addListener('audio.musicEnabled', (value) => {
                this.musicEnabled = value;
                if (!value) {
                    this.stop();
                } else if (this.category) {
                    // Resume if we were playing something
                    this.playCategory(this.category);
                }
            });
        }
    }
    
    /**
     * Update volume from settings manager
     */
    updateVolumeFromSettings(settingsManager) {
        this.masterVolume = settingsManager.get('audio.masterVolume', 1.0);
        this.musicVolume = settingsManager.get('audio.musicVolume', 0.5);
        this.musicEnabled = settingsManager.get('audio.musicEnabled', true);
    }
    
    /**
     * Update volume of currently playing music
     */
    updateCurrentMusicVolume() {
        if (this.currentMusic) {
            const effectiveVolume = this.musicVolume * this.masterVolume;
            this.currentMusic.setVolume(effectiveVolume);
        }
    }
    
    /**
     * Play music for a specific scene category
     * @param {string} category - 'mainMenu', 'game', or 'boss'
     */
    playCategory(category) {
        if (!this.musicEnabled) {
            console.log('[MusicManager] Music disabled in settings');
            return;
        }
        
        const config = this.scenesConfig[category];
        if (!config) {
            console.warn(`[MusicManager] No config for category: ${category}`);
            return;
        }
        
        this.category = category;
        this.config = config;
        
        // Get tracks based on category
        if (category === 'mainMenu' && config.backgroundMusic) {
            this.tracks = [config.backgroundMusic];
        } else if (config.tracks && Array.isArray(config.tracks)) {
            this.tracks = [...config.tracks];
        } else {
            console.warn(`[MusicManager] No tracks for category: ${category}`);
            return;
        }
        
        // Fade in/out times
        this.fadeInTime = config.fadeIn || 1000;
        this.fadeOutTime = config.fadeOut || 500;
        
        // Start playing
        if (config.randomize && this.tracks.length > 1) {
            this.playRandomTrack();
        } else {
            this.playTrack(0);
        }
    }
    
    /**
     * Play a random track from the current list
     */
    playRandomTrack() {
        if (this.tracks.length === 0) return;
        
        let newIndex;
        if (this.tracks.length === 1) {
            newIndex = 0;
        } else {
            // Pick a different track than current
            do {
                newIndex = Math.floor(Math.random() * this.tracks.length);
            } while (newIndex === this.currentTrackIndex && this.tracks.length > 1);
        }
        
        this.playTrack(newIndex);
    }
    
    /**
     * Play a specific track by index
     */
    playTrack(index) {
        if (index < 0 || index >= this.tracks.length) {
            console.warn(`[MusicManager] Invalid track index: ${index}`);
            return;
        }
        
        const trackPath = this.tracks[index];
        const trackKey = this.getKeyFromPath(trackPath);
        
        // Check if audio is loaded
        if (!this.scene.cache.audio.has(trackKey)) {
            console.warn(`[MusicManager] Track not loaded: ${trackKey}`);
            // Try to load it dynamically
            this.loadAndPlayTrack(trackPath, index);
            return;
        }
        
        this.currentTrackIndex = index;
        
        // Stop current music with fade out
        if (this.currentMusic) {
            this.fadeOut(() => {
                this.startNewTrack(trackKey);
            });
        } else {
            this.startNewTrack(trackKey);
        }
    }
    
    /**
     * Load and play a track dynamically
     */
    loadAndPlayTrack(trackPath, index) {
        const trackKey = this.getKeyFromPath(trackPath);
        
        this.scene.load.audio(trackKey, trackPath);
        this.scene.load.once('complete', () => {
            this.playTrack(index);
        });
        this.scene.load.start();
    }
    
    /**
     * Start playing a new track
     */
    startNewTrack(trackKey) {
        const volume = (this.config.volume || 0.5) * this.musicVolume * this.masterVolume;
        const loop = this.config.loop !== false;
        
        this.currentMusic = this.scene.sound.add(trackKey, {
            volume: 0, // Start at 0 for fade in
            loop: loop
        });
        
        this.currentMusic.play();
        
        // Fade in
        this.fadeIn(volume);
        
        // Handle track end for non-looping tracks
        if (!loop) {
            this.currentMusic.once('complete', () => {
                this.onTrackComplete();
            });
        }
        
        console.log(`[MusicManager] Playing: ${trackKey} (category: ${this.category})`);
    }
    
    /**
     * Handle track completion
     */
    onTrackComplete() {
        if (this.config.randomize && this.tracks.length > 1) {
            // Play next random track
            this.playRandomTrack();
        } else if (this.tracks.length > 1) {
            // Play next track in sequence
            const nextIndex = (this.currentTrackIndex + 1) % this.tracks.length;
            this.playTrack(nextIndex);
        } else {
            // Replay same track
            this.playTrack(0);
        }
    }
    
    /**
     * Fade in current music
     */
    fadeIn(targetVolume) {
        if (!this.currentMusic || this.isTransitioning) return;
        
        this.isTransitioning = true;
        
        this.scene.tweens.add({
            targets: this.currentMusic,
            volume: targetVolume,
            duration: this.fadeInTime,
            onComplete: () => {
                this.isTransitioning = false;
            }
        });
    }
    
    /**
     * Fade out current music
     */
    fadeOut(onComplete) {
        if (!this.currentMusic || this.isTransitioning) {
            if (onComplete) onComplete();
            return;
        }
        
        this.isTransitioning = true;
        
        this.scene.tweens.add({
            targets: this.currentMusic,
            volume: 0,
            duration: this.fadeOutTime,
            onComplete: () => {
                if (this.currentMusic) {
                    this.currentMusic.stop();
                    this.currentMusic.destroy();
                    this.currentMusic = null;
                }
                this.isTransitioning = false;
                if (onComplete) onComplete();
            }
        });
    }
    
    /**
     * Stop all music immediately
     */
    stop() {
        if (this.currentMusic) {
            this.currentMusic.stop();
            this.currentMusic.destroy();
            this.currentMusic = null;
        }
        this.currentTrackIndex = -1;
        this.isTransitioning = false;
    }
    
    /**
     * Pause current music
     */
    pause() {
        if (this.currentMusic && this.currentMusic.isPlaying) {
            this.currentMusic.pause();
        }
    }
    
    /**
     * Resume current music
     */
    resume() {
        if (this.currentMusic && this.currentMusic.isPaused) {
            this.currentMusic.resume();
        }
    }
    
    /**
     * Switch to a different category with fade transition
     */
    switchCategory(newCategory) {
        if (this.category === newCategory) return;
        
        this.fadeOut(() => {
            this.playCategory(newCategory);
        });
    }
    
    /**
     * Get audio key from file path
     */
    getKeyFromPath(path) {
        // Extract filename without extension
        const parts = path.split('/');
        const filename = parts[parts.length - 1];
        return filename.split('.')[0];
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.stop();
        
        // Remove settings listeners
        const settingsManager = window.settingsManager || this.scene.settingsManager;
        if (settingsManager) {
            settingsManager.removeListener('audio.musicVolume', null);
            settingsManager.removeListener('audio.masterVolume', null);
            settingsManager.removeListener('audio.musicEnabled', null);
        }
    }
}

// Singleton instance storage
let musicManagerInstance = null;

/**
 * Get or create MusicManager instance
 */
export function getMusicManager(scene) {
    if (!musicManagerInstance || musicManagerInstance.scene !== scene) {
        musicManagerInstance = new MusicManager(scene);
    }
    return musicManagerInstance;
}

export default MusicManager;