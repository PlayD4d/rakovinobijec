// Audio Debug Script - inject into console to test audio loading

(function() {
    console.log('=== AUDIO DEBUG START ===');
    
    // Check if game exists
    if (typeof game === 'undefined') {
        console.error('Game not found in global scope');
        return;
    }
    
    // Get current scene
    const scenes = game.scene.getScenes();
    const activeScene = scenes.find(s => s.scene.isActive());
    
    if (!activeScene) {
        console.error('No active scene found');
        return;
    }
    
    console.log('Active scene:', activeScene.scene.key);
    
    // Check audio cache
    const audioCache = activeScene.cache.audio;
    if (audioCache && audioCache.entries) {
        const keys = Object.keys(audioCache.entries.entries);
        console.log(`Audio cache has ${keys.length} entries:`);
        
        // Group by type
        const music = keys.filter(k => k.includes('music') || k.includes('8bit') || k.includes('synthwave'));
        const sounds = keys.filter(k => !k.includes('music') && !k.includes('8bit') && !k.includes('synthwave'));
        
        console.log(`  Music tracks (${music.length}):`, music.slice(0, 5));
        console.log(`  Sound effects (${sounds.length}):`, sounds.slice(0, 10));
        
        // Test play a sound
        if (sounds.length > 0) {
            const testKey = sounds[0];
            console.log(`Testing sound playback with key: ${testKey}`);
            try {
                activeScene.sound.play(testKey, { volume: 0.3 });
                console.log('✅ Sound played successfully');
            } catch (e) {
                console.error('❌ Sound playback failed:', e);
            }
        }
        
        // Check music manager
        if (activeScene.musicManager || activeScene.audioSystem) {
            const audioSys = activeScene.musicManager || activeScene.audioSystem;
            console.log('Audio system found:', audioSys.constructor.name);
            console.log('  Volume settings:', audioSys.volume);
            console.log('  Current music:', audioSys.currentMusic);
            console.log('  Music enabled:', audioSys.musicEnabled);
        }
        
    } else {
        console.error('No audio cache found');
    }
    
    // Check Phaser sound manager
    if (game.sound) {
        console.log('Phaser sound manager:');
        console.log('  Locked:', game.sound.locked);
        console.log('  Mute:', game.sound.mute);
        console.log('  Volume:', game.sound.volume);
        console.log('  Context state:', game.sound.context ? game.sound.context.state : 'no context');
    }
    
    console.log('=== AUDIO DEBUG END ===');
    
    // Export debug function for easy testing
    window.testAudio = function(key) {
        if (!key) {
            const keys = Object.keys(activeScene.cache.audio.entries.entries);
            console.log('Available keys:', keys);
            return;
        }
        
        try {
            activeScene.sound.play(key, { volume: 0.5 });
            console.log(`Playing: ${key}`);
        } catch (e) {
            console.error(`Failed to play ${key}:`, e);
        }
    };
    
    console.log('Use testAudio() to list keys or testAudio("key") to play a specific sound');
})();