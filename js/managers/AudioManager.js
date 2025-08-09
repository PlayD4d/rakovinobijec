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
            shoot: null,
            enemyDeath: null,
            bossDeath: null
        };
        
        this.currentLevelTrack = null;
        this.levelTracks = ['levelMusic1', 'levelMusic2', 'levelMusic3'];
        
        // Individuální hlasitosti pro různé level tracky (normalizace)
        this.trackVolumes = {
            'levelMusic1': 1.0,   // Normální hlasitost
            'levelMusic2': 0.8,   // Trochu tišší
            'levelMusic3': 1.1    // Trochu hlasitější
        };
        
        this.currentMusic = null;
        this.musicVolume = 0.35;  // Sníženo o 30% z 0.5
        this.sfxVolume = 0.7;
        
        this.createSounds();
    }
    
    createSounds() {
        console.log('Creating sound objects...');
        
        // Zkontroluj že zvuky jsou načtené v cache
        const checkAndCreateSound = (key, config, logName) => {
            if (this.scene.cache.audio.has(key)) {
                try {
                    const sound = this.scene.sound.add(key, config);
                    console.log(`✓ ${logName} sound object created`);
                    return sound;
                } catch (e) {
                    console.error(`✗ Failed to create ${logName} sound object:`, e);
                    return null;
                }
            } else {
                console.warn(`✗ ${logName} not found in audio cache (${key})`);
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
            ['gameOver', 'Game Over']
        ];
        
        soundEffects.forEach(([key, name]) => {
            this.sounds[key] = checkAndCreateSound(key, {
                volume: this.sfxVolume
            }, name);
        });
        
        // Player death sound
        this.sounds.enemyDeath = checkAndCreateSound('playerDeath', {
            volume: this.sfxVolume * 0.5
        }, 'Player death');
        
        // Shrnutí
        const loadedSounds = Object.entries(this.sounds).filter(([key, sound]) => sound !== null);
        console.log(`Audio setup complete: ${loadedSounds.length}/${Object.keys(this.sounds).length} sounds ready`);
    }
    
    createSyntheticSounds() {
        // Toto je zjednodušená verze - v reálné hře bychom měli skutečné zvukové soubory
        // Pro MVP použijeme jednoduché pípnutí
    }
    
    playLevelMusic() {
        console.log('Attempting to play level music...');
        this.stopCurrentMusic();
        
        // Vybrat náhodný level track
        const randomTrack = this.levelTracks[Math.floor(Math.random() * this.levelTracks.length)];
        console.log(`🎵 Selected random level track: ${randomTrack}`);
        
        this.currentLevelTrack = randomTrack;
        
        if (this.sounds[randomTrack]) {
            try {
                // Zkus pustit hudbu
                const playPromise = this.sounds[randomTrack].play();
                
                // Pokud je to Promise (moderní browsery), zpracuj ho
                if (playPromise && typeof playPromise.then === 'function') {
                    playPromise.then(() => {
                        this.currentMusic = this.sounds[randomTrack];
                        console.log(`✓ Level music started successfully: ${randomTrack}`);
                    }).catch((error) => {
                        console.warn('✗ Level music autoplay blocked:', error.message);
                        console.log('📌 Klikni do hry pro spuštění hudby');
                    });
                } else {
                    // Starší browsery
                    this.currentMusic = this.sounds[randomTrack];
                    console.log(`✓ Level music started (legacy): ${randomTrack}`);
                }
            } catch (e) {
                console.error('✗ Failed to play level music:', e);
            }
        } else {
            console.warn(`✗ Level music track not available: ${randomTrack}`);
        }
    }
    
    playBossMusic() {
        console.log('Attempting to play boss music');
        this.stopCurrentMusic();
        
        if (this.sounds.bossMusic) {
            try {
                this.sounds.bossMusic.play();
                this.currentMusic = this.sounds.bossMusic;
                console.log('Boss music started playing');
            } catch (e) {
                console.error('Failed to play boss music:', e);
            }
        } else {
            console.warn('Boss music not loaded');
        }
    }
    
    stopCurrentMusic() {
        if (this.currentMusic && this.currentMusic.isPlaying) {
            this.currentMusic.stop();
        }
    }
    
    playSound(soundName) {
        console.log(`🔊 Attempting to play sound: ${soundName}`);
        
        // Použít skutečné zvuky pokud existují
        if (this.sounds[soundName] && this.sounds[soundName] !== null) {
            try {
                console.log(`✓ Playing real sound: ${soundName}`);
                this.sounds[soundName].play();
                return;
            } catch (e) {
                console.warn(`Failed to play ${soundName}:`, e.message);
            }
        } else {
            console.warn(`⚠️ Sound ${soundName} not found in this.sounds object`);
            console.log('Available sounds:', Object.keys(this.sounds));
        }
        
        // Záložní syntetické zvuky pro ty, které nemáme
        console.log(`🔊 Playing synthetic sound: ${soundName}`);
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
    
    playTone(frequency, duration, delay = 0) {
        // Použití Web Audio API pro vytvoření jednoduchých tónů
        if (!window.AudioContext && !window.webkitAudioContext) {
            return;
        }
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        
        setTimeout(() => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'square';
            
            gainNode.gain.setValueAtTime(this.sfxVolume * 0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
        }, delay);
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
        console.log(`🎵 Switching to new level track: ${newTrack}`);
        
        this.stopCurrentMusic();
        this.currentLevelTrack = newTrack;
        
        if (this.sounds[newTrack]) {
            try {
                this.sounds[newTrack].play();
                this.currentMusic = this.sounds[newTrack];
                console.log(`✓ Level music switched to: ${newTrack}`);
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
        
        console.log(`🔊 Track ${trackName} volume set to ${multiplier}x (${(this.musicVolume * multiplier).toFixed(2)} absolute)`);
    }
    
    // Zobrazit aktuální hlasitosti všech tracků
    showTrackVolumes() {
        console.log('🎵 Track volumes:');
        Object.entries(this.trackVolumes).forEach(([track, multiplier]) => {
            const absolute = (this.musicVolume * multiplier).toFixed(2);
            console.log(`  ${track}: ${multiplier}x (${absolute} absolute)`);
        });
    }
}