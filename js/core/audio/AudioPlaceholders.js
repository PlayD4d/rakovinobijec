/**
 * AudioPlaceholders - Placeholder sound registrations
 * PR7 Compliant - Provides silent/minimal placeholders for missing audio
 */

export class AudioPlaceholders {
    /**
     * Register placeholder sounds in the audio system
     * @param {Object} audioSystem - The audio system to register with
     */
    static register(audioSystem) {
        console.log('[AudioPlaceholders] Registering placeholder sounds...');
        
        // Basic placeholders - very quiet or silent
        const placeholders = [
            'sfx.placeholder.click',
            'sfx.placeholder.confirm',
            'sfx.placeholder.impact',
            'sfx.placeholder.spawn',
            'sfx.placeholder.death',
            'sfx.placeholder.hit',
            'sfx.placeholder.shoot',
            'sfx.placeholder.pickup',
            'sfx.placeholder.powerup',
            'sfx.placeholder.explosion',
            'sfx.placeholder.warning',
            'sfx.placeholder.success',
            'sfx.placeholder.fail',
            'sfx.placeholder.transition',
            'sfx.placeholder.ambient'
        ];
        
        // Register all placeholders with minimal volume
        placeholders.forEach(id => {
            if (audioSystem.register) {
                audioSystem.register(id, 'sound/silent.mp3', 0.01);
            } else if (audioSystem.addSound) {
                // Fallback for different audio system APIs
                audioSystem.addSound(id, { file: 'sound/silent.mp3', volume: 0.01 });
            }
        });
        
        console.log(`[AudioPlaceholders] Registered ${placeholders.length} placeholder sounds`);
    }
    
    /**
     * Check if an ID is a placeholder
     * @param {string} id - The sound ID to check
     * @returns {boolean} True if it's a placeholder
     */
    static isPlaceholder(id) {
        return id && id.startsWith('sfx.placeholder.');
    }
}

export default AudioPlaceholders;