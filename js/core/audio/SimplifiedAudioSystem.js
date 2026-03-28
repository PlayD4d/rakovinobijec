/**
 * SimplifiedAudioSystem - Direct audio system without registry
 * PR7 Compliant - Uses direct file paths from blueprints
 *
 * Delegates SFX to SFXPlayer and music to MusicPlayer.
 * Keeps: constructor, initialize, volume management, pooling, shutdown.
 */

import { DebugLogger } from '../debug/DebugLogger.js';
import { SFXPlayer } from './SFXPlayer.js';
import { MusicPlayer } from './MusicPlayer.js';

export class SimplifiedAudioSystem {
    constructor(scene) {
        this.scene = scene;

        // Sound tracking — keyed by unique play ID to avoid overwrite collisions
        this.activeSounds = new Map();
        this._playIdCounter = 0;
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

        // Delegate modules
        this.sfxPlayer = new SFXPlayer(this);
        this.musicPlayer = new MusicPlayer(this);
    }

    /**
     * Initialize the audio system
     */
    initialize() {
        if (this.initialized) return;

        this.loadVolumeSettings();
        this.musicPlayer.loadMusicTracks();

        // NOTE: No self-registered shutdown listener — GameScene.shutdown() calls us explicitly
        // Self-registration causes double-shutdown race with the explicit loop

        this.initialized = true;
        DebugLogger.info('audio', '[SimplifiedAudioSystem] Initialized');
    }

    // === PUBLIC API (delegates) ===

    /** Play a sound effect */
    play(soundPath, options = {}) {
        return this.sfxPlayer.play(soundPath, options);
    }

    /** Play a looping sound */
    playLoop(soundPath, options = {}) {
        return this.sfxPlayer.playLoop(soundPath, options);
    }

    /** Stop a looping sound */
    stopLoop(soundPath) {
        this.sfxPlayer.stopLoop(soundPath);
    }

    /** Play background music */
    playMusic(musicPath, options = {}) {
        return this.musicPlayer.playMusic(musicPath, options);
    }

    /** Switch music category (game, boss, menu) */
    switchMusicCategory(category, options = {}) {
        this.musicPlayer.switchMusicCategory(category, options);
    }

    /** Play next track in current category */
    playNextTrack(options = {}) {
        this.musicPlayer.playNextTrack(options);
    }

    /** Stop current music */
    stopMusic() {
        this.musicPlayer.stopMusic();
    }

    /** Load music tracks from configuration */
    loadMusicTracks() {
        this.musicPlayer.loadMusicTracks();
    }

    // === VOLUME MANAGEMENT ===

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
        for (const sound of this.activeSounds.values()) {
            sound.stop();
        }
        this.activeSounds.clear();

        for (const sound of this.loopingSounds.values()) {
            sound.stop();
        }
        this.loopingSounds.clear();

        this.stopMusic();
    }

    /**
     * Stop immediately without any fade effects
     */
    stopImmediately() {
        if (this.currentMusic) {
            this.currentMusic.stop();
            this.currentMusic = null;
        }
        this.stopAll();
    }

    // === INTERNAL METHODS (used by SFXPlayer/MusicPlayer) ===

    _updateAllVolumes() {
        this._updateSFXVolumes();
        if (this.currentMusic) {
            this.currentMusic.setVolume(this.musicVolume * this.masterVolume);
        }
    }

    _updateSFXVolumes() {
        const volume = this.sfxVolume * this.masterVolume;
        for (const sound of this.activeSounds.values()) {
            sound.setVolume(volume);
        }
        for (const sound of this.loopingSounds.values()) {
            sound.setVolume(volume);
        }
    }

    loadVolumeSettings() {
        if (this.scene.settingsManager) {
            this.masterVolume = this.scene.settingsManager.get('audio.masterVolume', 1.0);
            this.sfxVolume = this.scene.settingsManager.get('audio.sfxVolume', 1.0);
            this.musicVolume = this.scene.settingsManager.get('audio.musicVolume', 0.5);
        }
    }

    _stopOldestSound() {
        const firstKey = this.activeSounds.keys().next().value;
        if (firstKey) {
            const sound = this.activeSounds.get(firstKey);
            if (sound) sound.stop();
        }
    }

    /**
     * Track active sound with unique play ID
     */
    _trackSound(soundKey, sound) {
        const playId = `${soundKey}_${this._playIdCounter++}`;
        this.activeSounds.set(playId, sound);

        const cleanup = () => {
            if (sound._poolReturned) return;
            sound._poolReturned = true;
            this.activeSounds.delete(playId);
            this._returnSoundToPool(soundKey, sound);
            sound.off('complete', cleanup);
            sound.off('stop', cleanup);
        };
        sound._poolReturned = false;
        sound.once('complete', cleanup);
        sound.once('stop', cleanup);
    }

    _getSoundFromPool(key) {
        const pool = this.soundPool.get(key);
        if (pool && pool.length > 0) {
            return pool.pop();
        }
        return null;
    }

    _returnSoundToPool(key, sound) {
        if (!this.soundPool.has(key)) {
            this.soundPool.set(key, []);
        }

        const pool = this.soundPool.get(key);
        if (pool.length < 3) {
            pool.push(sound);
        } else {
            sound.destroy();
        }
    }

    // === LIFECYCLE ===

    shutdown() {
        this.stopAll();

        for (const pool of this.soundPool.values()) {
            for (const sound of pool) {
                sound.destroy();
            }
        }
        this.soundPool.clear();
        this.lastPlayTimes.clear();
    }

    destroy() {
        this.shutdown();
        this.scene = null;
    }
}

export default SimplifiedAudioSystem;
