#!/usr/bin/env node

/**
 * Audio Manifest Generator
 * 
 * Projde všechny blueprinty a extrahuje audio cesty pro preload.
 * Generuje data/generated/audio_manifest.json pro použití v GameScene.
 * 
 * PR7 compliant - 100% data-driven, žádné hardcoded seznamy
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSON5 from 'json5';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

// Paths
const BLUEPRINTS_DIR = path.join(ROOT_DIR, 'data', 'blueprints');
const CONFIG_FILE = path.join(ROOT_DIR, 'data', 'config', 'main_config.json5');
const OUTPUT_DIR = path.join(ROOT_DIR, 'data', 'generated');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'audio_manifest.json');

// Audio paths collection
const audioPaths = new Set();
const audioSources = {
    music: [],
    sfx: {
        fromBlueprints: [],
        fromMusic: []
    }
};

/**
 * Recursively scan directory for JSON5 files
 */
function scanDirectory(dir) {
    const files = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            files.push(...scanDirectory(fullPath));
        } else if (item.endsWith('.json5')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

/**
 * Extract audio paths from blueprint
 */
function extractAudioFromBlueprint(blueprint, filePath) {
    const extracted = [];
    
    // Extract SFX paths
    if (blueprint.sfx) {
        Object.entries(blueprint.sfx).forEach(([key, value]) => {
            if (typeof value === 'string' && value.length > 0) {
                audioPaths.add(value);
                extracted.push({
                    path: value,
                    source: `${blueprint.id || 'unknown'}.sfx.${key}`
                });
            }
        });
    }
    
    // Check for audio in other common locations
    const checkPaths = [
        'audio',
        'sounds', 
        'music',
        'mechanics.audio',
        'abilities'
    ];
    
    checkPaths.forEach(pathStr => {
        const parts = pathStr.split('.');
        let current = blueprint;
        
        for (const part of parts) {
            if (current && current[part]) {
                current = current[part];
            } else {
                return;
            }
        }
        
        // If we found audio data, extract it
        if (typeof current === 'object') {
            extractAudioFromObject(current, `${blueprint.id || 'unknown'}.${pathStr}`, extracted);
        }
    });
    
    return extracted;
}

/**
 * Recursively extract audio paths from object
 */
function extractAudioFromObject(obj, prefix, extracted) {
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && 
            (value.includes('.mp3') || value.includes('.ogg') || value.includes('.wav'))) {
            audioPaths.add(value);
            extracted.push({
                path: value,
                source: `${prefix}.${key}`
            });
        } else if (typeof value === 'object' && value !== null) {
            extractAudioFromObject(value, `${prefix}.${key}`, extracted);
        }
    }
}

/**
 * Extract music from main config
 */
function extractMusicFromConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        console.warn('⚠️  main_config.json5 not found');
        return;
    }
    
    const configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON5.parse(configContent);
    
    // Extract music from scenes
    if (config.audio && config.audio.scenes) {
        Object.entries(config.audio.scenes).forEach(([sceneName, sceneConfig]) => {
            // Single track
            if (sceneConfig.backgroundMusic) {
                audioPaths.add(sceneConfig.backgroundMusic);
                audioSources.music.push({
                    path: sceneConfig.backgroundMusic,
                    scene: sceneName,
                    type: 'background'
                });
            }
            
            // Multiple tracks
            if (sceneConfig.tracks && Array.isArray(sceneConfig.tracks)) {
                sceneConfig.tracks.forEach(track => {
                    audioPaths.add(track);
                    audioSources.music.push({
                        path: track,
                        scene: sceneName,
                        type: 'track'
                    });
                });
            }
        });
    }
    
    return config;
}

/**
 * Main function
 */
async function generateAudioManifest() {
    console.log('🎵 Audio Manifest Generator');
    console.log('==========================\n');
    
    // Step 1: Extract music from config
    console.log('📖 Reading main_config.json5...');
    const config = extractMusicFromConfig();
    console.log(`   Found ${audioSources.music.length} music tracks`);
    
    // Step 2: Scan blueprints
    console.log('\n📂 Scanning blueprints directory...');
    const blueprintFiles = scanDirectory(BLUEPRINTS_DIR);
    console.log(`   Found ${blueprintFiles.length} blueprint files`);
    
    // Step 3: Extract audio from blueprints
    console.log('\n🔍 Extracting audio paths...');
    let blueprintCount = 0;
    let errorCount = 0;
    
    for (const file of blueprintFiles) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const blueprint = JSON5.parse(content);
            const extracted = extractAudioFromBlueprint(blueprint, file);
            
            if (extracted.length > 0) {
                audioSources.sfx.fromBlueprints.push(...extracted);
                blueprintCount++;
            }
        } catch (error) {
            console.error(`   ❌ Error parsing ${path.basename(file)}: ${error.message}`);
            errorCount++;
        }
    }
    
    console.log(`   Processed ${blueprintCount} blueprints with audio`);
    if (errorCount > 0) {
        console.log(`   ⚠️  ${errorCount} files had errors`);
    }
    
    // Step 4: Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`\n📁 Created output directory: ${OUTPUT_DIR}`);
    }
    
    // Step 5: Generate manifest
    const manifest = {
        version: '1.0.0',
        generated: new Date().toISOString(),
        stats: {
            totalFiles: audioPaths.size,
            musicFiles: audioSources.music.length,
            sfxFiles: audioSources.sfx.fromBlueprints.length,
            blueprintsScanned: blueprintFiles.length,
            blueprintsWithAudio: blueprintCount
        },
        audio: Array.from(audioPaths).sort(),
        sources: audioSources
    };
    
    // Step 6: Write manifest
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
    console.log(`\n✅ Audio manifest generated: ${OUTPUT_FILE}`);
    console.log(`   Total audio files: ${audioPaths.size}`);
    console.log(`   - Music: ${audioSources.music.length}`);
    console.log(`   - SFX: ${audioSources.sfx.fromBlueprints.length}`);
    
    // Step 7: Verify all files exist
    console.log('\n🔍 Verifying audio files exist...');
    let missingCount = 0;
    
    for (const audioPath of audioPaths) {
        const fullPath = path.join(ROOT_DIR, audioPath);
        if (!fs.existsSync(fullPath)) {
            console.warn(`   ⚠️  Missing: ${audioPath}`);
            missingCount++;
        }
    }
    
    if (missingCount === 0) {
        console.log('   ✅ All audio files exist!');
    } else {
        console.log(`   ⚠️  ${missingCount} audio files are missing`);
    }
    
    console.log('\n✨ Done!');
}

// Run
generateAudioManifest().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});