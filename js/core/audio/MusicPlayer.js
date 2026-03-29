/**
 * MusicPlayer - Background music playback module
 * Extracted from SimplifiedAudioSystem for <500 LOC compliance
 *
 * Handles: playMusic(), switchMusicCategory(), playNextTrack(), stopMusic(), loadMusicTracks()
 */

import { DebugLogger } from '../debug/DebugLogger.js';

export class MusicPlayer {
    constructor(audioSystem) {
        this.audioSystem = audioSystem;
    }

    /**
     * Load music tracks from configuration
     */
    loadMusicTracks() {
        const as = this.audioSystem;
        try {
            if (as.scene.configResolver) {
                const CR = as.scene.configResolver;
                as.musicTracks.game = CR.get('audio.scenes.game.tracks', { defaultValue: [] });
                as.musicTracks.boss = CR.get('audio.scenes.boss.tracks', { defaultValue: [] });
                as.musicTracks.menu = [CR.get('audio.scenes.mainMenu.backgroundMusic', { defaultValue: null })].filter(Boolean);
            } else {
                as.musicTracks.game = [
                    'music/8bit_track1_norm.mp3',
                    'music/8bit_track2_norm.mp3',
                    'music/8bit_track3_norm.mp3',
                    'music/8bit_track4_norm.mp3'
                ];
                as.musicTracks.boss = [
                    'music/8bit_boss1_norm.mp3',
                    'music/8bit_boss2_norm.mp3'
                ];
                as.musicTracks.menu = ['music/8bit_main_menu_norm.mp3'];
            }

            DebugLogger.info('audio', '[MusicPlayer] Music tracks loaded:', {
                game: as.musicTracks.game.length,
                boss: as.musicTracks.boss.length,
                menu: as.musicTracks.menu.length
            });
        } catch (error) {
            DebugLogger.warn('audio', '[MusicPlayer] Failed to load music tracks:', error);
        }
    }

    /**
     * Play background music
     */
    playMusic(musicPath, options = {}) {
        const as = this.audioSystem;
        if (!as.initialized || !musicPath) return null;

        // Stop current music with fade if specified
        if (as.currentMusic) {
            const oldMusic = as.currentMusic;
            if (options.fadeOut && as.scene?.sys?.isActive() && as.scene.tweens) {
                as.scene.tweens.add({
                    targets: oldMusic,
                    volume: 0,
                    duration: options.fadeOut,
                    onComplete: () => {
                        if (oldMusic.isPlaying) oldMusic.stop();
                    }
                });
            } else {
                if (oldMusic.isPlaying) oldMusic.stop();
            }
        }

        // Play new music
        try {
            const key = musicPath.replace(/[^a-zA-Z0-9]/g, '_');
            const startVolume = options.fadeIn ? 0 : as.musicVolume * as.masterVolume;
            const music = as.scene.sound.add(key, {
                volume: startVolume,
                loop: options.loop !== false,
                ...options
            });

            music.play();
            as.currentMusic = music;
            as.currentMusicPath = musicPath;

            // Fade in if specified
            if (options.fadeIn && as.scene && as.scene.tweens) {
                as.scene.tweens.add({
                    targets: music,
                    volume: as.musicVolume * as.masterVolume,
                    duration: options.fadeIn
                });
            }

            // Set up track rotation on completion if not looping
            if (options.loop === false && as.currentMusicCategory === 'game') {
                music.once('complete', () => {
                    DebugLogger.info('audio', '[MusicPlayer] Track ended, playing next track');
                    this.playNextTrack();
                });
            }

            return music;
        } catch (error) {
            DebugLogger.warn('audio', `[MusicPlayer] Failed to play music: ${musicPath}`, error);
        }

        return null;
    }

    /**
     * Switch music category (game, boss, menu)
     */
    switchMusicCategory(category, options = {}) {
        const as = this.audioSystem;
        if (!as.initialized || !as.musicTracks[category]) {
            DebugLogger.warn('audio', `[MusicPlayer] Invalid music category: ${category}`);
            return;
        }

        const tracks = as.musicTracks[category];
        if (tracks.length === 0) {
            DebugLogger.warn('audio', `[MusicPlayer] No tracks for category: ${category}`);
            return;
        }

        as.currentMusicCategory = category;

        // Select track based on category
        let trackToPlay;
        if (category === 'game') {
            if (options.random) {
                trackToPlay = tracks[Math.floor(Math.random() * tracks.length)];
            } else {
                trackToPlay = tracks[as.currentTrackIndex % tracks.length];
            }
        } else {
            trackToPlay = options.random && tracks.length > 1
                ? tracks[Math.floor(Math.random() * tracks.length)]
                : tracks[0];
        }

        this.playMusic(trackToPlay, {
            fadeOut: options.fadeOut || 500,
            fadeIn: options.fadeIn || 1000,
            loop: true
        });

        DebugLogger.info('audio', `[MusicPlayer] Switched to ${category} music: ${trackToPlay}`);
    }

    /**
     * Play next track in current category
     */
    playNextTrack(options = {}) {
        const as = this.audioSystem;
        if (!as.currentMusicCategory) {
            DebugLogger.warn('audio', '[MusicPlayer] No music category set');
            return;
        }

        const tracks = as.musicTracks[as.currentMusicCategory];
        if (tracks.length <= 1) {
            DebugLogger.info('audio', '[MusicPlayer] Only one track in category, continuing current');
            return;
        }

        as.currentTrackIndex = (as.currentTrackIndex + 1) % tracks.length;
        const nextTrack = tracks[as.currentTrackIndex];

        this.playMusic(nextTrack, {
            fadeOut: options.fadeOut || 500,
            fadeIn: options.fadeIn || 1000,
            loop: true
        });

        DebugLogger.info('audio', `[MusicPlayer] Playing next track: ${nextTrack}`);
    }

    /**
     * Stop current music
     */
    stopMusic() {
        const as = this.audioSystem;
        if (as.currentMusic) {
            as.currentMusic.stop();
            as.currentMusic = null;
        }
    }
}

