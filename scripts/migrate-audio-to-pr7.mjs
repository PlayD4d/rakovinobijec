#!/usr/bin/env node

/**
 * Audio Migration Script - Convert legacy sfx.* references to direct file paths
 * PR7 Compliant
 */

import fs from 'fs';
import path from 'path';
import JSON5 from 'json5';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Legacy to direct path mapping
const AUDIO_MAPPING = {
    // Player sounds
    'sfx.player.spawn': 'sound/player_spawn.mp3',
    'sfx.player.hit': 'sound/player_hit.mp3',
    'sfx.player.death': 'sound/player_death.mp3',
    'sfx.player.shoot': 'sound/player_shoot.mp3',
    'sfx.player.heal': 'sound/heal.mp3',
    'sfx.player.levelup': 'sound/levelup.mp3',
    
    // Enemy sounds
    'sfx.enemy.spawn': 'sound/npc_spawn.mp3',
    'sfx.enemy.hit': 'sound/npc_hit.mp3',
    'sfx.enemy.death': 'sound/npc_death.mp3',
    'sfx.enemy.hit.soft': 'sound/hit_soft.mp3',
    'sfx.enemy.hit.heavy': 'sound/hit_hard.mp3',
    'sfx.enemy.death.small': 'sound/npc_death.mp3',
    'sfx.npc.spawn': 'sound/npc_spawn.mp3',
    'sfx.npc.hit': 'sound/npc_hit.mp3',
    'sfx.npc.death': 'sound/npc_death.mp3',
    
    // Boss sounds
    'sfx.boss.enter': 'sound/boss_enter.mp3',
    'sfx.boss.hit': 'sound/boss_hit.mp3',
    'sfx.boss.death': 'sound/boss_death.mp3',
    'sfx.boss.phase': 'sound/boss_phase.mp3',
    
    // Weapon sounds
    'sfx.weapon.fire.laser': 'sound/laser.mp3',
    'sfx.weapon.fire.bio': 'sound/shoot.mp3',
    'sfx.weapon.fire': 'sound/shoot.mp3',
    'sfx.projectile.hit': 'sound/hit_soft.mp3',
    'sfx.laser': 'sound/laser.mp3',
    'sfx.shoot': 'sound/shoot.mp3',
    
    // Effects
    'sfx.explosion.small': 'sound/explosion_small.mp3',
    'sfx.explosion.large': 'sound/explosion_large.mp3',
    'sfx.hit.spark.small': 'sound/hit_soft.mp3',
    'sfx.hit.spark.generic': 'sound/hit_soft.mp3',
    
    // Pickups
    'sfx.pickup': 'sound/pickup.mp3',
    'sfx.powerup': 'sound/powerup.mp3',
    'sfx.heal': 'sound/heal.mp3',
    
    // UI sounds
    'sfx.ui.button': 'sound/bleep.mp3',
    'sfx.ui.chime': 'sound/chime.mp3',
    'sfx.intro': 'sound/intro.mp3',
    'sfx.ready_fight': 'sound/ready_fight.mp3',
    'sfx.game_over': 'sound/game_over.mp3',
    
    // Shield sounds
    'sfx.shield.activate': 'sound/shield_activate.mp3',
    'sfx.shield.block': 'sound/shield_block.mp3',
    'sfx.shield.break': 'sound/shield_break.mp3',
    
    // VFX placeholders (these don't map to audio)
    'vfx.player.spawn': null,
    'vfx.player.hit': null,
    'vfx.player.death': null,
    'vfx.weapon.muzzle': null,
    'vfx.player.heal': null,
    'vfx.player.levelup': null,
    'vfx.shield.activate': null,
    'vfx.shield.block': null,
    'vfx.shield.break': null
};

/**
 * Migrate audio references in an object
 */
function migrateAudioInObject(obj, path = '') {
    let changesMade = false;
    
    if (typeof obj !== 'object' || obj === null) {
        return { obj, changesMade };
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            const result = migrateAudioInObject(obj[i], `${path}[${i}]`);
            if (result.changesMade) {
                obj[i] = result.obj;
                changesMade = true;
            }
        }
        return { obj, changesMade };
    }
    
    // Handle objects
    for (const key in obj) {
        const value = obj[key];
        const currentPath = path ? `${path}.${key}` : key;
        
        // Check if this is an audio field (sfx.* or in sfx/music sections)
        if (typeof value === 'string') {
            // Check if it's a legacy reference
            if (value.startsWith('sfx.') || value.startsWith('vfx.')) {
                const directPath = AUDIO_MAPPING[value];
                if (directPath !== undefined) {
                    if (directPath !== null) {
                        console.log(`  📝 ${currentPath}: "${value}" → "${directPath}"`);
                        obj[key] = directPath;
                        changesMade = true;
                    } else {
                        // It's a VFX reference, leave it as is
                        console.log(`  ⏭️  ${currentPath}: "${value}" (VFX reference, keeping)`);
                    }
                } else if (value.startsWith('sfx.')) {
                    console.warn(`  ⚠️  ${currentPath}: Unknown legacy reference "${value}"`);
                }
            }
        } else if (typeof value === 'object' && value !== null) {
            // Recurse into nested objects
            const result = migrateAudioInObject(value, currentPath);
            if (result.changesMade) {
                changesMade = true;
            }
        }
    }
    
    return { obj, changesMade };
}

/**
 * Process a single blueprint file
 */
async function processBlueprint(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const blueprint = JSON5.parse(content);
        
        console.log(`\n📄 Processing: ${path.relative(rootDir, filePath)}`);
        
        const result = migrateAudioInObject(blueprint);
        
        if (result.changesMade) {
            // Create backup
            const backupPath = filePath + '.pre-audio-migration.bak';
            fs.copyFileSync(filePath, backupPath);
            console.log(`  💾 Backup created: ${path.basename(backupPath)}`);
            
            // Write updated blueprint
            const updatedContent = JSON5.stringify(result.obj, null, 2);
            fs.writeFileSync(filePath, updatedContent, 'utf8');
            console.log(`  ✅ Blueprint updated successfully`);
            
            return true;
        } else {
            console.log(`  ✨ No changes needed`);
            return false;
        }
    } catch (error) {
        console.error(`  ❌ Error processing ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Find all blueprint files
 */
function findBlueprintFiles(dir) {
    const files = [];
    
    function scan(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                scan(fullPath);
            } else if (entry.isFile() && (entry.name.endsWith('.json5') || entry.name.endsWith('.json'))) {
                files.push(fullPath);
            }
        }
    }
    
    scan(dir);
    return files;
}

/**
 * Main migration function
 */
async function main() {
    console.log('🚀 PR7 Audio Migration Tool');
    console.log('=============================');
    console.log('Converting legacy sfx.* references to direct file paths\n');
    
    const blueprintDir = path.join(rootDir, 'data', 'blueprints');
    
    if (!fs.existsSync(blueprintDir)) {
        console.error('❌ Blueprint directory not found:', blueprintDir);
        process.exit(1);
    }
    
    const files = findBlueprintFiles(blueprintDir);
    console.log(`Found ${files.length} blueprint files\n`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const file of files) {
        const wasUpdated = await processBlueprint(file);
        if (wasUpdated) updatedCount++;
        else if (wasUpdated === null) errorCount++;
    }
    
    console.log('\n=============================');
    console.log('📊 Migration Summary:');
    console.log(`  ✅ Updated: ${updatedCount} files`);
    console.log(`  ✨ Unchanged: ${files.length - updatedCount - errorCount} files`);
    if (errorCount > 0) {
        console.log(`  ❌ Errors: ${errorCount} files`);
    }
    console.log('\n✅ Migration complete!');
    
    if (updatedCount > 0) {
        console.log('\n💡 Tip: Backup files created with .pre-audio-migration.bak extension');
        console.log('   You can delete them after verifying everything works correctly.');
    }
}

// Run the migration
main().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
});