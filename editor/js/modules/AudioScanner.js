/**
 * AudioScanner.js - PR7 compliant audio file scanner
 * Scans sound/ and music/ directories for available audio files
 * Replaces the old audio_manifest.json5 approach
 */

export class AudioScanner {
    constructor() {
        this.audioFiles = {
            music: [],
            sfx: [],
            all: []
        };
        this.initialized = false;
    }
    
    /**
     * Initialize scanner and load available audio files
     */
    async initialize() {
        if (this.initialized) return this.audioFiles;
        
        console.log('[AudioScanner] Scanning for audio files...');
        
        // PR7: Direct listing of audio files
        // In production, this could be generated dynamically or from a simple file list
        const availableFiles = {
            music: [
                'music/level_1.mp3',
                'music/level_2.mp3',
                'music/level_3.mp3',
                'music/boss.mp3'
            ],
            sfx: [
                // Player sounds
                'sound/player_hit.mp3',
                'sound/player_death.mp3',
                'sound/player_spawn.mp3',
                'sound/player_shoot.mp3',
                'sound/levelup.mp3',
                'sound/heal.mp3',
                'sound/shoot.mp3',
                'sound/laser.mp3',
                
                // Enemy sounds
                'sound/npc_spawn.mp3',
                'sound/npc_hit.mp3',
                'sound/npc_death.mp3',
                'sound/npc_death_1.mp3',
                'sound/npc_death_2.mp3',
                'sound/elite_death.mp3',
                
                // Boss sounds
                'sound/boss_enter.mp3',
                'sound/boss_hit.mp3',
                'sound/boss_death.mp3',
                'sound/boss_phase.mp3',
                
                // Effects
                'sound/explosion_small.mp3',
                'sound/explosion_large.mp3',
                'sound/decay.mp3',
                'sound/hit_soft.mp3',
                'sound/hit_hard.mp3',
                'sound/hit_critical.mp3',
                
                // Special effects
                'sound/flamethrower.mp3',
                'sound/radiotherapy.mp3',
                'sound/machinegun.mp3',
                'sound/laser1.mp3',
                'sound/laser2.mp3',
                
                // UI sounds
                'sound/pickup.mp3',
                'sound/powerup.mp3',
                'sound/metotrexat.mp3',
                'sound/intro.mp3',
                'sound/ready_fight.mp3',
                'sound/game_over.mp3'
            ]
        };
        
        // Process the files
        this.audioFiles.music = availableFiles.music.map(path => ({
            path: path,
            key: this.extractKey(path),
            category: 'music',
            displayName: this.formatDisplayName(path)
        }));
        
        this.audioFiles.sfx = availableFiles.sfx.map(path => ({
            path: path,
            key: this.extractKey(path),
            category: 'sfx',
            displayName: this.formatDisplayName(path)
        }));
        
        this.audioFiles.all = [...this.audioFiles.music, ...this.audioFiles.sfx];
        
        this.initialized = true;
        console.log(`[AudioScanner] Found ${this.audioFiles.all.length} audio files`);
        
        return this.audioFiles;
    }
    
    /**
     * Extract key from file path
     * @param {string} path - e.g. 'sound/laser.mp3'
     * @returns {string} - e.g. 'laser'
     */
    extractKey(path) {
        return path.split('/').pop().replace('.mp3', '');
    }
    
    /**
     * Format display name from path
     * @param {string} path - e.g. 'sound/player_hit.mp3'
     * @returns {string} - e.g. 'Player Hit'
     */
    formatDisplayName(path) {
        const key = this.extractKey(path);
        return key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    /**
     * Get all audio files
     */
    async getAudioFiles() {
        if (!this.initialized) {
            await this.initialize();
        }
        return this.audioFiles;
    }
    
    /**
     * Search audio files
     * @param {string} query - Search term
     * @param {string} category - 'all', 'music', or 'sfx'
     */
    async searchAudioFiles(query = '', category = 'all') {
        const files = await this.getAudioFiles();
        let results = files[category] || files.all;
        
        if (query) {
            const searchTerm = query.toLowerCase();
            results = results.filter(file => 
                file.key.toLowerCase().includes(searchTerm) ||
                file.displayName.toLowerCase().includes(searchTerm) ||
                file.path.toLowerCase().includes(searchTerm)
            );
        }
        
        return results;
    }
    
    /**
     * Get audio file by path
     * @param {string} path - File path
     */
    async getAudioFileByPath(path) {
        const files = await this.getAudioFiles();
        return files.all.find(f => f.path === path);
    }
    
    /**
     * Check if audio file exists
     * @param {string} path - File path
     */
    async audioFileExists(path) {
        const file = await this.getAudioFileByPath(path);
        return !!file;
    }
}

// Export singleton instance
export const audioScanner = new AudioScanner();