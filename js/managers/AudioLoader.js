/**
 * Centrální správce načítání audio souborů
 * PR7 kompatibilní - načítá manifest z ConfigResolver
 */
export class AudioLoader {
    constructor() {
        this.AUDIO_MANIFEST = null;
        this.loaded = false;
        this.loadPromise = null;
        this.manifestLoaded = false;
    }

    /**
     * Načte audio manifest z ConfigResolver
     * PR7 kompatibilní - vše data-driven
     */
    async loadManifest() {
        if (this.manifestLoaded) return;
        
        const CR = window.ConfigResolver;
        if (!CR) {
            console.warn('[AudioLoader] ConfigResolver není dostupný, používám záložní manifest');
            // Záložní manifest pro kompatibilitu
            this.AUDIO_MANIFEST = {
                music: {
                    'levelMusic1': 'music/level_1.mp3',
                    'levelMusic2': 'music/level_2.mp3', 
                    'levelMusic3': 'music/level_3.mp3',
                    'bossMusic': 'music/boss.mp3'
                },
                sfx: {
                    'hit': 'sound/player_hit.mp3',
                    'intro': 'sound/intro.mp3', 
                    'levelup': 'sound/levelup.mp3',
                    'pickup': 'sound/pickup.mp3',
                    'playerDeath': 'sound/player_death.mp3',
                    'powerup': 'sound/powerup.mp3',
                    'readyFight': 'sound/ready_fight.mp3',
                    'bossEnter': 'sound/boss_enter.mp3',
                    'gameOver': 'sound/game_over.mp3',
                    'metotrexat': 'sound/metotrexat.mp3'
                },
                sfxExtended: {}
            };
            return;
        }
        
        // Načíst manifest z ConfigResolver
        this.AUDIO_MANIFEST = {
            music: CR.get('audioManifest.music', { defaultValue: {} }),
            sfx: CR.get('audioManifest.sfx', { defaultValue: {} }),
            sfxExtended: CR.get('audioManifest.sfxExtended', { defaultValue: {} }),
            loadConfig: CR.get('audioManifest.loadConfig', { 
                defaultValue: {
                    autoLoad: ['music', 'sfx'],
                    onDemand: ['sfxExtended'],
                    loadTimeout: 10000,
                    retryAttempts: 3,
                    retryDelay: 1000
                }
            })
        };
        
        this.manifestLoaded = true;
        console.log('[AudioLoader] Manifest načten z ConfigResolver:', {
            music: Object.keys(this.AUDIO_MANIFEST.music).length,
            sfx: Object.keys(this.AUDIO_MANIFEST.sfx).length,
            sfxExtended: Object.keys(this.AUDIO_MANIFEST.sfxExtended).length
        });
    }

    /**
     * Načte všechny audio soubory jednou
     * @param {Phaser.Scene} scene - Phaser scéna pro loading
     * @param {boolean} includeExtended - Načíst i rozšířené SFX
     */
    async loadAllAudio(scene, includeExtended = false) {
        // Nejprve načíst manifest
        await this.loadManifest();
        
        if (this.loaded) {
            console.log('🎵 Audio already loaded, skipping...');
            return Promise.resolve();
        }

        console.log('🎵 Starting centralized audio loading...');
        
        let totalFiles = 0;

        // Zjistit, které kategorie načítat
        const loadConfig = this.AUDIO_MANIFEST.loadConfig || {};
        const autoLoad = loadConfig.autoLoad || ['music', 'sfx'];
        const onDemand = loadConfig.onDemand || ['sfxExtended'];
        
        // Načíst automatické kategorie
        if (autoLoad.includes('music') && this.AUDIO_MANIFEST.music) {
            Object.entries(this.AUDIO_MANIFEST.music).forEach(([key, path]) => {
                if (!scene.cache.audio.has(key)) {
                    scene.load.audio(key, path);
                    totalFiles++;
                }
            });
        }
        
        if (autoLoad.includes('sfx') && this.AUDIO_MANIFEST.sfx) {
            Object.entries(this.AUDIO_MANIFEST.sfx).forEach(([key, path]) => {
                if (!scene.cache.audio.has(key)) {
                    scene.load.audio(key, path);
                    totalFiles++;
                }
            });
        }
        
        // Načíst rozšířené SFX pokud požadováno
        if (includeExtended && onDemand.includes('sfxExtended') && this.AUDIO_MANIFEST.sfxExtended) {
            Object.entries(this.AUDIO_MANIFEST.sfxExtended).forEach(([key, path]) => {
                if (!scene.cache.audio.has(key)) {
                    scene.load.audio(key, path);
                    totalFiles++;
                }
            });
        }

        console.log(`🎵 Queued ${totalFiles} audio files for loading`);
        this.loaded = true;
        
        return Promise.resolve();
    }

    /**
     * Zkontroluje zda je zvuk načtený
     * @param {string} key - Klíč zvuku
     * @param {Phaser.Scene} scene - Phaser scéna
     */
    isAudioLoaded(key, scene) {
        return scene.cache.audio.has(key);
    }

    /**
     * Získá všechny načtené audio klíče
     * @param {Phaser.Scene} scene - Phaser scéna
     */
    getLoadedAudioKeys(scene) {
        const keys = [];
        scene.cache.audio.entries.each((key) => {
            keys.push(key);
        });
        return keys;
    }

    /**
     * Debug vypíše stav načtených souborů
     * @param {Phaser.Scene} scene - Phaser scéna
     */
    debugAudioStatus(scene) {
        console.log('🎵 === Audio Status Debug ===');
        
        // Hudba
        console.log('🎵 Music:');
        Object.keys(this.AUDIO_MANIFEST.music || {}).forEach(key => {
            const loaded = this.isAudioLoaded(key, scene);
            console.log(`  ${key}: ${loaded ? '✅' : '❌'}`);
        });
        
        // SFX
        console.log('🎵 SFX:');
        Object.keys(this.AUDIO_MANIFEST.sfx || {}).forEach(key => {
            const loaded = this.isAudioLoaded(key, scene);
            console.log(`  ${key}: ${loaded ? '✅' : '❌'}`);
        });
        
        // Extended SFX
        console.log('🎵 Extended SFX:');
        Object.keys(this.AUDIO_MANIFEST.sfxExtended || {}).forEach(key => {
            const loaded = this.isAudioLoaded(key, scene);
            console.log(`  ${key}: ${loaded ? '✅' : '❌'}`);
        });
    }

    /**
     * Reset loader pro re-loading
     */
    reset() {
        this.loaded = false;
        this.loadPromise = null;
        console.log('🎵 AudioLoader reset');
    }
}

// Singleton instance
export const globalAudioLoader = new AudioLoader();