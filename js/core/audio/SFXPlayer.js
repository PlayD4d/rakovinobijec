/**
 * SFXPlayer - Sound effects playback module
 * Extracted from SimplifiedAudioSystem for <500 LOC compliance
 *
 * Handles: play(), playLoop(), stopLoop(), cooldown checks, legacy ID mapping
 */

import { DebugLogger } from '../debug/DebugLogger.js';

export class SFXPlayer {
    constructor(audioSystem) {
        this.audioSystem = audioSystem;
    }

    /**
     * Play a sound effect
     * @param {string} soundPath - Direct path to sound file (e.g., "sound/hit.mp3")
     * @param {object} options - Playback options
     */
    play(soundPath, options = {}) {
        const as = this.audioSystem;
        if (!as.initialized || !as.enabled || !soundPath) return null;

        // Check if it's a file path
        if (!this._isFilePath(soundPath)) {
            soundPath = this._mapLegacyId(soundPath);
            if (!soundPath) return null;
        }

        const soundKey = this._extractSoundKey(soundPath);

        // Check cooldown (bypass for looping sounds)
        if (!options.bypassCooldown && !this._checkCooldown(soundKey)) {
            return null;
        }

        // Check concurrent sounds limit
        if (as.activeSounds.size >= as.maxConcurrentSounds) {
            as._stopOldestSound();
        }

        // Play the sound
        try {
            const sound = this._playSound(soundKey, soundPath, options);
            if (sound) {
                // Commit cooldown only after successful play
                const now = as.scene?.time?.now || 0;
                if (now) as.lastPlayTimes.set(soundKey, now);
                as._trackSound(soundKey, sound);
                return sound;
            }
        } catch (error) {
            DebugLogger.warn('audio', `[SFXPlayer] Failed to play: ${soundPath}`, error);
        }

        return null;
    }

    /**
     * Play a looping sound
     */
    playLoop(soundPath, options = {}) {
        const sound = this.play(soundPath, { ...options, loop: true, bypassCooldown: true });
        if (sound) {
            const key = this._extractSoundKey(soundPath);
            this.audioSystem.loopingSounds.set(key, sound);
        }
        return sound;
    }

    /**
     * Stop a looping sound
     */
    stopLoop(soundPath) {
        const key = this._extractSoundKey(soundPath);
        const sound = this.audioSystem.loopingSounds.get(key);
        if (sound) {
            sound.stop();
            this.audioSystem.loopingSounds.delete(key);
        }
    }

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
        return soundPath.replace(/[^a-zA-Z0-9]/g, '_');
    }

    /**
     * Map legacy sound IDs to file paths
     */
    _mapLegacyId(soundId) {
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
        const as = this.audioSystem;
        const lastTime = as.lastPlayTimes.get(soundKey);
        const now = as.scene?.time?.now || 0;
        if (!now) return true;

        if (lastTime && (now - lastTime) < as.minSoundInterval) {
            return false;
        }

        return true;
    }

    /**
     * Play sound with Phaser
     */
    _playSound(key, path, options) {
        const as = this.audioSystem;

        if (!as.scene.cache.audio.exists(key)) {
            DebugLogger.warn('audio', `[SFXPlayer] Sound not preloaded: ${key} (${path})`);
            return null;
        }

        let sound = as._getSoundFromPool(key);

        if (!sound) {
            sound = as.scene.sound.add(key, {
                volume: (options.volume || 1.0) * as.sfxVolume * as.masterVolume,
                loop: options.loop || false,
                detune: options.detune || 0,
                rate: options.rate || 1.0
            });
        } else {
            sound.setVolume((options.volume || 1.0) * as.sfxVolume * as.masterVolume);
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
}

export default SFXPlayer;
