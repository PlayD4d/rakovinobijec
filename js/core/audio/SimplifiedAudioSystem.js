/**
 * SimplifiedAudioSystem - Direct audio system without registry
 * PR7 Compliant - Uses direct file paths from blueprints
 * 
 * Handles both SFX and music playback
 * No registry needed - just play files directly
 */

import { DebugLogger } from '../debug/DebugLogger.js';

export class SimplifiedAudioSystem {
    constructor(scene) {
        this.scene = scene;
        
        // Sound tracking
        this.activeSounds = new Map();
        this.loopingSounds = new Map();
        this.soundPool = new Map(); // Reuse sound objects
        
        // Music tracking
        this.currentMusic = null;
        this.currentMusicPath = null;
        this.currentMusicCategory = null;
        this.musicTracks = {
            game: [],
            boss: [],
            menu: []
        };
        this.currentTrackIndex = 0;
        this.musicVolume = 0.5;
        this.sfxVolume = 1.0;
        this.masterVolume = 1.0;
        
        // Performance settings
        this.maxConcurrentSounds = 12;
        this.minSoundInterval = 30; // Min ms between same sounds
        this.lastPlayTimes = new Map();
        
        this.initialized = false;
        this.enabled = true;
    }
    
    /**
     * Initialize the audio system
     */
    initialize() {
        if (this.initialized) return;
        
        // Load volume settings if available
        this.loadVolumeSettings();
        
        // Load music tracks from configuration
        this.loadMusicTracks();
        
        // Setup cleanup handlers
        this.scene.events.once('shutdown', () => this.shutdown());
        this.scene.events.once('destroy', () => this.destroy());
        
        this.initialized = true;
        DebugLogger.info('audio', '[SimplifiedAudioSystem] Initialized');
    }
    
    /**
     * Load music tracks from configuration
     */
    loadMusicTracks() {
        try {
            // Try to get from ConfigResolver if available
            if (this.scene.configResolver) {
                const CR = this.scene.configResolver;
                this.musicTracks.game = CR.get('audio.scenes.game.tracks', { defaultValue: [] });
                this.musicTracks.boss = CR.get('audio.scenes.boss.tracks', { defaultValue: [] });
                this.musicTracks.menu = [CR.get('audio.scenes.mainMenu.backgroundMusic', { defaultValue: null })].filter(Boolean);
            } else {
                // Fallback to hardcoded tracks with normalized filenames
                this.musicTracks.game = [
                    'music/8bit_track1_norm.mp3',
                    'music/8bit_track2_norm.mp3',
                    'music/8bit_track3_norm.mp3',
                    'music/8bit_track4_norm.mp3'
                ];
                this.musicTracks.boss = [
                    'music/8bit_boss1_norm.mp3',
                    'music/8bit_boss2_norm.mp3'
                ];
                this.musicTracks.menu = ['music/8bit_main_menu_norm.mp3'];
            }
            
            DebugLogger.info('audio', '[SimplifiedAudioSystem] Music tracks loaded:', {
                game: this.musicTracks.game.length,
                boss: this.musicTracks.boss.length,
                menu: this.musicTracks.menu.length
            });
        } catch (error) {
            DebugLogger.warn('audio', '[SimplifiedAudioSystem] Failed to load music tracks:', error);
        }
    }
    
    /**
     * Play a sound effect
     * @param {string} soundPath - Direct path to sound file (e.g., "sound/hit.mp3")
     * @param {object} options - Playback options
     */
    play(soundPath, options = {}) {
        if (!this.initialized || !this.enabled || !soundPath) return null;
        
        // Check if it's a file path
        if (!this._isFilePath(soundPath)) {
            // Legacy ID - try to map to file
            soundPath = this._mapLegacyId(soundPath);
            if (!soundPath) return null;
        }
        
        // Extract filename as key
        const soundKey = this._extractSoundKey(soundPath);
        
        // Check cooldown
        if (!this._checkCooldown(soundKey)) {
            return null;
        }
        
        // Check concurrent sounds limit
        if (this.activeSounds.size >= this.maxConcurrentSounds) {
            this._stopOldestSound();
        }
        
        // Play the sound
        try {
            const sound = this._playSound(soundKey, soundPath, options);
            if (sound) {
                this._trackSound(soundKey, sound);
                return sound;
            }
        } catch (error) {
            DebugLogger.warn('audio', `[SimplifiedAudioSystem] Failed to play: ${soundPath}`, error);
        }
        
        return null;
    }
    
    /**
     * Play a looping sound
     */
    playLoop(soundPath, options = {}) {
        const sound = this.play(soundPath, { ...options, loop: true });
        if (sound) {
            const key = this._extractSoundKey(soundPath);
            this.loopingSounds.set(key, sound);
        }
        return sound;
    }
    
    /**
     * Stop a looping sound
     */
    stopLoop(soundPath) {
        const key = this._extractSoundKey(soundPath);
        const sound = this.loopingSounds.get(key);
        if (sound) {
            sound.stop();
            this.loopingSounds.delete(key);
        }
    }
    
    /**
     * Play background music
     */
    playMusic(musicPath, options = {}) {
        if (!this.initialized || !musicPath) return;
        
        // Stop current music with fade if specified
        if (this.currentMusic) {
            if (options.fadeOut && this.scene && this.scene.tweens) {
                this.scene.tweens.add({
                    targets: this.currentMusic,
                    volume: 0,
                    duration: options.fadeOut,
                    onComplete: () => {
                        if (this.currentMusic) {
                            this.currentMusic.stop();
                        }
                    }
                });
            } else {
                this.currentMusic.stop();
            }
        }
        
        // Play new music
        try {
            const key = this._extractSoundKey(musicPath);
            const startVolume = options.fadeIn ? 0 : this.musicVolume * this.masterVolume;
            const music = this.scene.sound.add(key, {
                volume: startVolume,
                loop: options.loop !== false, // Default to loop
                ...options
            });
            
            music.play();
            this.currentMusic = music;
            this.currentMusicPath = musicPath;
            
            // Fade in if specified
            if (options.fadeIn && this.scene && this.scene.tweens) {
                this.scene.tweens.add({
                    targets: music,
                    volume: this.musicVolume * this.masterVolume,
                    duration: options.fadeIn
                });
            }
            
            // Set up track rotation on completion if not looping
            if (options.loop === false && this.currentMusicCategory === 'game') {
                music.once('complete', () => {
                    DebugLogger.info('audio', '[SimplifiedAudioSystem] Track ended, playing next track');
                    this.playNextTrack();
                });
            }
            
            return music;
        } catch (error) {
            DebugLogger.warn('audio', `[SimplifiedAudioSystem] Failed to play music: ${musicPath}`, error);
        }
        
        return null;
    }
    
    /**
     * Switch music category (game, boss, menu)
     */
    switchMusicCategory(category, options = {}) {
        if (!this.initialized || !this.musicTracks[category]) {
            DebugLogger.warn('audio', `[SimplifiedAudioSystem] Invalid music category: ${category}`);
            return;
        }
        
        const tracks = this.musicTracks[category];
        if (tracks.length === 0) {
            DebugLogger.warn('audio', `[SimplifiedAudioSystem] No tracks for category: ${category}`);
            return;
        }
        
        this.currentMusicCategory = category;
        
        // Select track based on category
        let trackToPlay;
        if (category === 'game') {
            // For game tracks, use rotation or random
            if (options.random) {
                trackToPlay = tracks[Math.floor(Math.random() * tracks.length)];
            } else {
                // Rotate through tracks
                trackToPlay = tracks[this.currentTrackIndex % tracks.length];
            }
        } else {
            // For boss and menu, just use first track (or random for boss)
            trackToPlay = options.random && tracks.length > 1 
                ? tracks[Math.floor(Math.random() * tracks.length)]
                : tracks[0];
        }
        
        // Play the selected track
        this.playMusic(trackToPlay, {
            fadeOut: options.fadeOut || 500,
            fadeIn: options.fadeIn || 1000,
            loop: true
        });
        
        DebugLogger.info('audio', `[SimplifiedAudioSystem] Switched to ${category} music: ${trackToPlay}`);
    }
    
    /**
     * Play next track in current category
     */
    playNextTrack(options = {}) {
        if (!this.currentMusicCategory) {
            DebugLogger.warn('audio', '[SimplifiedAudioSystem] No music category set');
            return;
        }
        
        const tracks = this.musicTracks[this.currentMusicCategory];
        if (tracks.length <= 1) {
            DebugLogger.info('audio', '[SimplifiedAudioSystem] Only one track in category, continuing current');
            return;
        }
        
        // Increment track index
        this.currentTrackIndex = (this.currentTrackIndex + 1) % tracks.length;
        const nextTrack = tracks[this.currentTrackIndex];
        
        // Play next track
        this.playMusic(nextTrack, {
            fadeOut: options.fadeOut || 500,
            fadeIn: options.fadeIn || 1000,
            loop: true
        });
        
        DebugLogger.info('audio', `[SimplifiedAudioSystem] Playing next track: ${nextTrack}`);
    }
    
    /**
     * Stop current music
     */
    stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.stop();
            this.currentMusic = null;
        }
    }
    
    /**
     * Set volume levels
     */
    setVolume(type, value) {
        value = Math.max(0, Math.min(1, value));
        
        switch (type) {
            case 'master':
                this.masterVolume = value;
                this._updateAllVolumes();
                break;
            case 'sfx':
                this.sfxVolume = value;
                this._updateSFXVolumes();
                break;
            case 'music':
                this.musicVolume = value;
                if (this.currentMusic) {
                    this.currentMusic.setVolume(value * this.masterVolume);
                }
                break;
        }
    }
    
    /**
     * Stop all sounds
     */
    stopAll() {
        // Stop all active sounds
        for (const sound of this.activeSounds.values()) {
            sound.stop();
        }
        this.activeSounds.clear();
        
        // Stop looping sounds
        for (const sound of this.loopingSounds.values()) {
            sound.stop();
        }
        this.loopingSounds.clear();
        
        // Stop music
        this.stopMusic();
    }
    
    /**
     * Stop immediately without any fade effects
     * Used during scene shutdown to avoid creating new tweens
     */
    stopImmediately() {
        // Stop music immediately without fade
        if (this.currentMusic) {
            this.currentMusic.stop();
            this.currentMusic = null;
        }
        // Stop all active sounds
        this.stopAll();
    }
    
    // === PRIVATE METHODS ===
    
    /**
     * Check if string is a file path
     */
    _isFilePath(str) {
        return str && (
            str.includes('.mp3') || 
            str.includes('.ogg') || 
            str.includes('.wav') ||
            str.includes('/')
        );
    }
    
    /**
     * Extract sound key from file path
     */
    _extractSoundKey(soundPath) {
        // Generate Phaser-compatible key: replace non-alphanumeric with underscore
        // This must match how MainMenu and GameScene load audio
        return soundPath.replace(/[^a-zA-Z0-9]/g, '_');
    }
    
    /**
     * Map legacy sound IDs to file paths
     */
    _mapLegacyId(soundId) {
        // Common mappings
        const mappings = {
            'sfx.hit.soft': 'sound/hit_soft_norm.mp3',
            'sfx.hit.hard': 'sound/hit_hard_norm.mp3',
            'sfx.enemy.spawn': 'sound/npc_spawn_norm.mp3',
            'sfx.enemy.hit': 'sound/npc_hit_norm.mp3',
            'sfx.enemy.death': 'sound/npc_death_norm.mp3',
            'sfx.player.hit': 'sound/player_hit_norm.mp3',
            'sfx.player.death': 'sound/player_death_norm.mp3',
            'sfx.weapon.laser': 'sound/laser_norm.mp3',
            'sfx.explosion.small': 'sound/explosion_small_norm.mp3',
            'sfx.explosion.large': 'sound/explosion_large_norm.mp3',
            'sfx.pickup': 'sound/pickup_norm.mp3',
            'sfx.powerup': 'sound/powerup_norm.mp3',
            'sfx.levelup': 'sound/levelup_norm.mp3'
        };
        
        return mappings[soundId] || null;
    }
    
    /**
     * Check cooldown for sound
     */
    _checkCooldown(soundKey) {
        const lastTime = this.lastPlayTimes.get(soundKey);
        const now = Date.now();
        
        if (lastTime && (now - lastTime) < this.minSoundInterval) {
            return false;
        }
        
        this.lastPlayTimes.set(soundKey, now);
        return true;
    }
    
    /**
     * Play sound with Phaser
     */
    _playSound(key, path, options) {
        // Check if sound is loaded
        if (!this.scene.cache.audio.exists(key)) {
            // Try to load it (this might not work in production)
            DebugLogger.warn('audio', `[SimplifiedAudioSystem] Sound not preloaded: ${key} (${path})`);
            return null;
        }
        
        // Get or create sound object
        let sound = this._getSoundFromPool(key);
        
        if (!sound) {
            sound = this.scene.sound.add(key, {
                volume: (options.volume || 1.0) * this.sfxVolume * this.masterVolume,
                loop: options.loop || false,
                detune: options.detune || 0,
                rate: options.rate || 1.0
            });
        } else {
            // Update settings
            sound.setVolume((options.volume || 1.0) * this.sfxVolume * this.masterVolume);
            sound.setLoop(options.loop || false);
            sound.setDetune(options.detune || 0);
            sound.setRate(options.rate || 1.0);
        }
        
        // Add random detune for variation
        if (options.detuneRange) {
            const [min, max] = options.detuneRange;
            sound.setDetune(Phaser.Math.Between(min, max));
        }
        
        sound.play();
        return sound;
    }
    
    /**
     * Track active sound
     */
    _trackSound(key, sound) {
        this.activeSounds.set(key, sound);
        
        // Auto-remove when complete
        sound.once('complete', () => {
            this.activeSounds.delete(key);
            this._returnSoundToPool(key, sound);
        });
        
        sound.once('stop', () => {
            this.activeSounds.delete(key);
            this._returnSoundToPool(key, sound);
        });
    }
    
    /**
     * Get sound from pool
     */
    _getSoundFromPool(key) {
        const pool = this.soundPool.get(key);
        if (pool && pool.length > 0) {
            return pool.pop();
        }
        return null;
    }
    
    /**
     * Return sound to pool
     */
    _returnSoundToPool(key, sound) {
        if (!this.soundPool.has(key)) {
            this.soundPool.set(key, []);
        }
        
        const pool = this.soundPool.get(key);
        if (pool.length < 3) { // Keep max 3 per sound
            pool.push(sound);
        } else {
            sound.destroy();
        }
    }
    
    /**
     * Stop oldest sound
     */
    _stopOldestSound() {
        const firstKey = this.activeSounds.keys().next().value;
        if (firstKey) {
            const sound = this.activeSounds.get(firstKey);
            if (sound) sound.stop();
        }
    }
    
    /**
     * Update all volumes
     */
    _updateAllVolumes() {
        this._updateSFXVolumes();
        if (this.currentMusic) {
            this.currentMusic.setVolume(this.musicVolume * this.masterVolume);
        }
    }
    
    /**
     * Update SFX volumes
     */
    _updateSFXVolumes() {
        const volume = this.sfxVolume * this.masterVolume;
        for (const sound of this.activeSounds.values()) {
            sound.setVolume(volume);
        }
        for (const sound of this.loopingSounds.values()) {
            sound.setVolume(volume);
        }
    }
    
    /**
     * Load volume settings from settings manager
     */
    loadVolumeSettings() {
        if (this.scene.settingsManager) {
            this.masterVolume = this.scene.settingsManager.get('audio.masterVolume', 1.0);
            this.sfxVolume = this.scene.settingsManager.get('audio.sfxVolume', 1.0);
            this.musicVolume = this.scene.settingsManager.get('audio.musicVolume', 0.5);
        }
    }
    
    /**
     * Shutdown the system
     */
    shutdown() {
        this.stopAll();
        
        // Clear pools
        for (const pool of this.soundPool.values()) {
            for (const sound of pool) {
                sound.destroy();
            }
        }
        this.soundPool.clear();
    }
    
    /**
     * Destroy the system
     */
    destroy() {
        this.shutdown();
        this.scene = null;
    }
}

export default SimplifiedAudioSystem;