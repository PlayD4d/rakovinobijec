/**
 * AudioManager - Správce zvuků a hudby
 * 
 * PR7 kompatibilní - všechny hodnoty z ConfigResolver
 * Nepoužívá přímé Phaser API, vše přes registry
 */

import { globalAudioLoader } from './AudioLoader.js';

export class AudioManager {
    constructor(scene) {
        this.scene = scene;
        
        this.sounds = {
            levelMusic1: null,
            levelMusic2: null,
            levelMusic3: null,
            bossMusic: null,
            hit: null,
            pickup: null,
            levelup: null,
            heal: null,
            shoot: null,        // Základní útok
            laser: null,        // Radioterapie  
            lightning: null,    // Imunoterapie
            enemyDeath: null,
            bossDeath: null
        };
        
        this.currentLevelTrack = null;
        this.levelTracks = ['levelMusic1', 'levelMusic2', 'levelMusic3'];
        
        // PR7: Získat ConfigResolver - definovat PŘED použitím
        const CR = this.scene.configResolver || window.ConfigResolver;
        
        // PR7: Individuální hlasitosti z ConfigResolver - teď můžeme použít CR
        this.trackVolumes = {
            'levelMusic1': CR?.get('audio.tracks.levelMusic1.volume', { defaultValue: 1.0 }) || 1.0,
            'levelMusic2': CR?.get('audio.tracks.levelMusic2.volume', { defaultValue: 0.8 }) || 0.8,
            'levelMusic3': CR?.get('audio.tracks.levelMusic3.volume', { defaultValue: 1.1 }) || 1.1
        };
        
        this.currentMusic = null;
        this.musicVolume = CR?.get('audio.musicVolume', { defaultValue: 0.35 }) || 0.35;
        this.sfxVolume = CR?.get('audio.sfxVolume', { defaultValue: 0.7 }) || 0.7;
        
        this.createSounds();
        
        // Inicializovat stav povolení zvuků
        this.musicEnabled = true;
        this.soundsEnabled = true;
    }
    
    /**
     * Aplikuje uživatelská nastavení z SettingsManager
     * PR7 kompatibilní - priorita: uživatelské > systémové > výchozí
     * @param {object} settings - Objekt s nastaveními
     */
    applyUserSettings(settings) {
        if (!settings) return;
        
        // Aktualizovat hlasitosti
        const masterVolume = settings.masterVolume ?? 1.0;
        const musicEnabled = settings.musicEnabled ?? true;
        const soundsEnabled = settings.soundsEnabled ?? true;
        
        // Aplikovat hlasitost hudby
        if (settings.musicVolume !== undefined) {
            this.musicVolume = settings.musicVolume * masterVolume;
            
            // Aktualizovat všechny hudební tracky
            Object.keys(this.sounds).forEach(key => {
                if (key.includes('Music') && this.sounds[key]) {
                    const trackVolume = this.trackVolumes[key] || 1.0;
                    this.sounds[key].setVolume(this.musicVolume * trackVolume);
                }
            });
        }
        
        // Aplikovat hlasitost zvuků
        if (settings.soundsVolume !== undefined) {
            this.sfxVolume = settings.soundsVolume * masterVolume;
            
            // Aktualizovat všechny zvukové efekty
            Object.keys(this.sounds).forEach(key => {
                if (!key.includes('Music') && this.sounds[key]) {
                    this.sounds[key].setVolume(this.sfxVolume);
                }
            });
        }
        
        // Zapnout/vypnout hudbu
        if (!musicEnabled && this.currentMusic) {
            this.stopCurrentMusic();
        }
        
        // Uložit stav nastavení
        this.musicEnabled = musicEnabled;
        this.soundsEnabled = soundsEnabled;
        
        console.log('[AudioManager] Uživatelská nastavení aplikována:', {
            musicVolume: this.musicVolume,
            sfxVolume: this.sfxVolume,
            musicEnabled: this.musicEnabled,
            soundsEnabled: this.soundsEnabled
        });
    }
    
    createSounds() {
        // Debug logy byly omezeny kvůli čitelnosti konzole
        
        // Zkontroluj že zvuky jsou načtené v cache
        const checkAndCreateSound = (key, config, logName) => {
            if (this.scene.cache.audio.has(key)) {
                try {
                    const sound = this.scene.sound.add(key, config);
                    // console.log(`✓ ${logName} sound object created`);
                    return sound;
                } catch (e) {
                    console.error(`✗ Failed to create ${logName} sound object:`, e);
                    return null;
                }
            } else {
                // console.warn(`✗ ${logName} not found in audio cache (${key})`);
                return null;
            }
        };
        
        // Hudba - více level tracků s individuálními hlasitostmi
        this.sounds.levelMusic1 = checkAndCreateSound('levelMusic1', {
            loop: true,
            volume: this.musicVolume * this.trackVolumes['levelMusic1']
        }, 'Level music 1');
        
        this.sounds.levelMusic2 = checkAndCreateSound('levelMusic2', {
            loop: true,
            volume: this.musicVolume * this.trackVolumes['levelMusic2']
        }, 'Level music 2');
        
        this.sounds.levelMusic3 = checkAndCreateSound('levelMusic3', {
            loop: true,
            volume: this.musicVolume * this.trackVolumes['levelMusic3']
        }, 'Level music 3');
        
        this.sounds.bossMusic = checkAndCreateSound('bossMusic', {
            loop: true,
            volume: this.musicVolume
        }, 'Boss music');
        
        // Zvukové efekty
        const soundEffects = [
            ['hit', 'Hit'],
            ['levelup', 'Level up'],
            ['pickup', 'Pickup'],
            ['powerup', 'Power up'],
            ['intro', 'Intro'],
            ['readyFight', 'Ready Fight'],
            ['bossEnter', 'Boss Enter'],
            ['gameOver', 'Game Over'],
            // Specifické zvuky pro různé útoky hráče
            ['shoot', 'Basic attack'],
            ['laser', 'Radiotherapy'],
            ['lightning', 'Immunotherapy'],
            ['npcDeath1', 'Enemy death 1'],
            ['npcDeath2', 'Enemy death 2'],
            ['eliteDeath', 'Elite enemy death'],
            ['bossHit', 'Boss hit'],
            ['bossDeath', 'Boss death'],
            ['projectileHit', 'Projectile impact'],
            ['playerHit', 'Player hit (alternative)'],
            ['metotrexat', 'Metotrexat special'],
            ['heal', 'Heal pickup']
        ];
        
        soundEffects.forEach(([key, name]) => {
            this.sounds[key] = checkAndCreateSound(key, {
                volume: this.sfxVolume
            }, name);
        });
        
        // Player death sound (specific)
        this.sounds.playerDeath = checkAndCreateSound('playerDeath', {
            volume: this.sfxVolume * 0.5
        }, 'Player death');
        
        // Shrnutí
        // const loadedSounds = Object.entries(this.sounds).filter(([key, sound]) => sound !== null);
        // console.log(`Audio setup complete: ${loadedSounds.length}/${Object.keys(this.sounds).length} sounds ready`);
    }
    
    createSyntheticSounds() {
        // Toto je zjednodušená verze - v reálné hře bychom měli skutečné zvukové soubory
        // Pro MVP použijeme jednoduché pípnutí
    }
    
    playLevelMusic() {
        // Kontrola, zda je hudba povolená
        if (!this.musicEnabled) return;
        
        // Pokus o přehrání hudby levelu
        this.stopCurrentMusic();
        
        // Vybrat náhodný level track
        const randomTrack = this.levelTracks[Math.floor(Math.random() * this.levelTracks.length)];
        // console.log(`🎵 Selected random level track: ${randomTrack}`);
        
        this.currentLevelTrack = randomTrack;
        
        if (this.sounds[randomTrack]) {
            try {
                // Zkus pustit hudbu
                const playPromise = this.sounds[randomTrack].play();
                
                // Pokud je to Promise (moderní browsery), zpracuj ho
                if (playPromise && typeof playPromise.then === 'function') {
                    playPromise.then(() => {
                        this.currentMusic = this.sounds[randomTrack];
                        // console.log(`✓ Level music started successfully: ${randomTrack}`);
                    }).catch((error) => {
                        // console.warn('✗ Level music autoplay blocked:', error.message);
                        // console.log('📌 Klikni do hry pro spuštění hudby');
                    });
                } else {
                    // Starší browsery
                    this.currentMusic = this.sounds[randomTrack];
                    // console.log(`✓ Level music started (legacy): ${randomTrack}`);
                }
            } catch (e) {
                console.error('✗ Failed to play level music:', e);
            }
        } else {
            // console.warn(`✗ Level music track not available: ${randomTrack}`);
        }
    }
    
    playBossMusic() {
        // Kontrola, zda je hudba povolená
        if (!this.musicEnabled) return;
        
        // Přehrání boss hudby
        this.stopCurrentMusic();
        
        if (this.sounds.bossMusic) {
            try {
                this.sounds.bossMusic.play();
                this.currentMusic = this.sounds.bossMusic;
                // console.log('Boss hudba spuštěna');
            } catch (e) {
                console.error('Nepodařilo se přehrát boss hudbu:', e);
            }
        } else {
            // console.warn('Boss hudba není načtena');
        }
    }
    
    stopCurrentMusic() {
        if (this.currentMusic && this.currentMusic.isPlaying) {
            this.currentMusic.stop();
        }
    }
    
    playSound(soundName) {
        // Kontrola, zda jsou zvuky povolené
        if (!this.soundsEnabled) return;
        
        // Ztišené: logování každého zvuku by zahltilo konzoli
        
        // Použít skutečné zvuky pokud existují
        if (this.sounds[soundName] && this.sounds[soundName] !== null) {
            try {
                // console.log(`✓ Přehrávám zvuk: ${soundName}`);
                this.sounds[soundName].play();
                return;
            } catch (e) {
                console.warn(`Nepodařilo se přehrát ${soundName}:`, e.message);
            }
        } else {
            // console.warn(`⚠️ Zvuk ${soundName} nenalezen`);
            // console.log('Dostupné zvuky:', Object.keys(this.sounds));
        }
        
        // Záložní syntetické zvuky pro ty, které nemáme
        // console.log(`🔊 Playing synthetic sound: ${soundName}`);
        switch(soundName) {
            case 'heal':
                if (this.sounds.powerup && this.sounds.powerup !== null) {
                    try {
                        this.sounds.powerup.play();
                    } catch (e) {
                        this.playTone(600, 0.15);
                        this.playTone(800, 0.15, 75);
                    }
                } else {
                    this.playTone(600, 0.15);
                    this.playTone(800, 0.15, 75);
                }
                break;
            case 'shoot':
                this.playTone(150, 0.05);
                break;
            case 'enemyDeath':
                this.playTone(200, 0.1);
                break;
            case 'bossDeath':
                if (this.sounds.levelup && this.sounds.levelup !== null) {
                    try {
                        this.sounds.levelup.play();
                    } catch (e) {
                        // pokračuj k tónům
                    }
                }
                this.playTone(100, 0.3);
                this.playTone(150, 0.3, 150);
                this.playTone(200, 0.3, 300);
                break;
            default:
                // Pro neznámé zvuky použít generický tón
                this.playTone(400, 0.1);
        }
    }
    
    stopAll() {
        this.stopCurrentMusic();
        // Zastavit všechny zvuky
        Object.values(this.sounds).forEach(sound => {
            if (sound && sound.isPlaying) {
                sound.stop();
            }
        });
    }
    
    switchLevelMusic() {
        // Přepnout na jiný náhodný track (různý od aktuálního)
        const availableTracks = this.levelTracks.filter(track => track !== this.currentLevelTrack);
        if (availableTracks.length === 0) return; // Jen jeden track dostupný
        
        const newTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
        // console.log(`🎵 Switching to new level track: ${newTrack}`);
        
        this.stopCurrentMusic();
        this.currentLevelTrack = newTrack;
        
        if (this.sounds[newTrack]) {
            try {
                this.sounds[newTrack].play();
                this.currentMusic = this.sounds[newTrack];
                // console.log(`✓ Level music switched to: ${newTrack}`);
            } catch (e) {
                console.error('✗ Failed to switch level music:', e);
            }
        }
    }
    
    setMusicVolume(volume) {
        this.musicVolume = volume;
        if (this.currentMusic && this.currentLevelTrack) {
            // Aplikuj individuální hlasitost tracku
            const trackMultiplier = this.trackVolumes[this.currentLevelTrack] || 1.0;
            this.currentMusic.setVolume(volume * trackMultiplier);
        } else if (this.currentMusic) {
            // Pro jiné hudební tracky (boss music apod.)
            this.currentMusic.setVolume(volume);
        }
    }
    
    setSFXVolume(volume) {
        this.sfxVolume = volume;
    }
    
    // Helper metoda pro nastavení individuální hlasitosti tracku
    setTrackVolume(trackName, multiplier) {
        this.trackVolumes[trackName] = multiplier;
        
        // Aktualizuj hlasitost pokud je tento track právě přehráván
        if (this.currentLevelTrack === trackName && this.currentMusic) {
            this.currentMusic.setVolume(this.musicVolume * multiplier);
        }
        
        // console.log(`🔊 Track ${trackName} volume set to ${multiplier}x (${(this.musicVolume * multiplier).toFixed(2)} absolute)`);
    }
    
    // Zobrazit aktuální hlasitosti všech tracků
    showTrackVolumes() {
        // console.log('🎵 Track volumes:');
        Object.entries(this.trackVolumes).forEach(([track, multiplier]) => {
            const absolute = (this.musicVolume * multiplier).toFixed(2);
            console.log(`  ${track}: ${multiplier}x (${absolute} absolute)`);
        });
    }
}