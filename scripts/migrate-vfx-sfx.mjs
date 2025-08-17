#!/usr/bin/env node

/**
 * Migration script for VFX/SFX from registry IDs to direct configuration
 * Converts all blueprints to use VFX presets and direct audio file paths
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, '..');

// VFX mappings from registry IDs to presets
const vfxMappings = {
    // Hit effects
    'vfx.hit.spark': 'hit.small',
    'vfx.hit.spark.small': 'hit.small',
    'vfx.hit.spark.generic': 'hit.small',
    'vfx.hit.spark.soft': 'hit.small',
    'vfx.hit.spark.necrotic': 'hit.small',
    'vfx.hit.impact': 'hit.medium',
    'vfx.hit.critical': 'hit.large',
    
    // Death effects
    'vfx.death.burst': 'death.medium',
    'vfx.enemy.death.burst': 'death.medium',
    'vfx.enemy.death.burst.small': 'death.small',
    'vfx.enemy.death.burst.medium': 'death.medium',
    'vfx.enemy.death.burst.large': 'death.large',
    'vfx.enemy.death.small': 'death.small',
    'vfx.enemy.death.medium': 'death.medium',
    'vfx.enemy.death.large': 'death.large',
    'vfx.enemy.death.default': 'death.small',
    'vfx.death.special': 'death.large',
    
    // Spawn effects
    'vfx.spawn': 'spawn',
    'vfx.enemy.spawn': 'spawn',
    'vfx.enemy.spawn.default': 'spawn',
    'vfx.enemy.spawn.swarm': 'spawn',
    'vfx.spawn.special': 'spawn',
    
    // Trail effects - map to empty for now
    'vfx.trail.viral': 'trail.toxic',
    'vfx.trail.swarm': 'trail.small',
    
    // Explosion effects
    'vfx.explosion.small': 'explosion.small',
    'vfx.explosion.medium': 'explosion.medium',
    'vfx.explosion.large': 'explosion.large',
    'vfx.explosion.toxic': 'explosion.toxic',
    
    // Powerup effects
    'vfx.powerup': 'powerup',
    'vfx.powerup.pickup': 'pickup',
    'vfx.powerup.activate': 'powerup',
    
    // Shield effects
    'vfx.shield': 'shield.hit',
    'vfx.shield.hit': 'shield.hit',
    'vfx.shield.break': 'shield.break',
    
    // Projectile effects
    'vfx.projectile.hit': 'hit.small',
    'vfx.projectile.impact': 'hit.medium',
    
    // Special effects
    'vfx.heal': 'heal',
    'vfx.levelup': 'levelup',
    'vfx.boss.spawn': 'boss.spawn',
    'vfx.boss.death': 'boss.death',
    'vfx.boss.phase': 'boss.phase',
};

// SFX mappings from registry IDs to file paths
const sfxMappings = {
    // Enemy sounds
    'sfx.enemy.spawn': 'sound/npc_spawn_norm.mp3',
    'sfx.enemy.spawn.swarm': 'sound/npc_spawn_norm.mp3',
    'sfx.enemy.hit': 'sound/npc_hit_norm.mp3',
    'sfx.enemy.hit.soft': 'sound/hit_soft_norm.mp3',
    'sfx.enemy.hit.hard': 'sound/hit_hard_norm.mp3',
    'sfx.enemy.hit.small': 'sound/hit_soft_norm.mp3',
    'sfx.enemy.hit.critical': 'sound/hit_critical_norm.mp3',
    'sfx.enemy.death': 'sound/npc_death_norm.mp3',
    'sfx.enemy.death.small': 'sound/npc_death_norm.mp3',
    'sfx.enemy.death.large': 'sound/explosion_small_norm.mp3',
    
    // Player sounds
    'sfx.player.hit': 'sound/player_hit_norm.mp3',
    'sfx.player.death': 'sound/player_death_norm.mp3',
    'sfx.player.shoot': 'sound/player_shoot_norm.mp3',
    'sfx.player.spawn': 'sound/player_spawn_norm.mp3',
    
    // Boss sounds
    'sfx.boss.spawn': 'sound/boss_enter_norm.mp3',
    'sfx.boss.hit': 'sound/boss_hit_norm.mp3',
    'sfx.boss.death': 'sound/boss_death_norm.mp3',
    'sfx.boss.phase': 'sound/boss_phase_norm.mp3',
    
    // Elite sounds
    'sfx.elite.death': 'sound/elite_death_norm.mp3',
    
    // Weapon sounds
    'sfx.weapon.laser': 'sound/laser_norm.mp3',
    'sfx.weapon.shoot': 'sound/shoot_norm.mp3',
    'sfx.laser': 'sound/laser1_norm.mp3',
    'sfx.laser2': 'sound/laser2_norm.mp3',
    'sfx.projectile.hit': 'sound/projectile_hit_norm.mp3',
    'sfx.weapon.machinegun': 'sound/machinegun_norm.mp3',
    'sfx.weapon.flamethrower': 'sound/flamethrower_norm.mp3',
    
    // Powerup sounds
    'sfx.powerup': 'sound/powerup_norm.mp3',
    'sfx.powerup.pickup': 'sound/pickup_norm.mp3',
    'sfx.powerup.activate': 'sound/powerup_norm.mp3',
    'sfx.pickup': 'sound/pickup_norm.mp3',
    
    // Special sounds
    'sfx.heal': 'sound/heal_norm.mp3',
    'sfx.levelup': 'sound/levelup_norm.mp3',
    'sfx.explosion': 'sound/explosion_small_norm.mp3',
    'sfx.explosion.small': 'sound/explosion_small_norm.mp3',
    'sfx.explosion.large': 'sound/explosion_large_norm.mp3',
    'sfx.metotrexat': 'sound/metotrexat_norm.mp3',
    'sfx.radiotherapy': 'sound/radiotherapy_norm.mp3',
    'sfx.decay': 'sound/decay_norm.mp3',
    'sfx.lightning': 'sound/lightning_norm.mp3',
    'sfx.chime': 'sound/chime_norm.mp3',
    'sfx.bleep': 'sound/bleep_norm.mp3',
};

function processBlueprint(content) {
    let modified = content;
    let changeCount = 0;
    
    // Process VFX mappings
    for (const [oldId, newPreset] of Object.entries(vfxMappings)) {
        const regex = new RegExp(`["']${oldId.replace(/\./g, '\\.')}["']`, 'g');
        const matches = modified.match(regex);
        if (matches) {
            modified = modified.replace(regex, `'${newPreset}'`);
            changeCount += matches.length;
        }
    }
    
    // Process SFX mappings
    for (const [oldId, newPath] of Object.entries(sfxMappings)) {
        const regex = new RegExp(`["']${oldId.replace(/\./g, '\\.')}["']`, 'g');
        const matches = modified.match(regex);
        if (matches) {
            modified = modified.replace(regex, `'${newPath}'`);
            changeCount += matches.length;
        }
    }
    
    // Catch-all patterns for unmapped VFX IDs (convert to generic presets)
    const vfxPatterns = [
        { pattern: /["']vfx\.hit\.[^"']*["']/g, replacement: "'hit.small'" },
        { pattern: /["']vfx\.death\.[^"']*["']/g, replacement: "'death.medium'" },
        { pattern: /["']vfx\.enemy\.death\.[^"']*["']/g, replacement: "'death.medium'" },
        { pattern: /["']vfx\.spawn\.[^"']*["']/g, replacement: "'spawn'" },
        { pattern: /["']vfx\.enemy\.spawn\.[^"']*["']/g, replacement: "'spawn'" },
        { pattern: /["']vfx\.explosion\.[^"']*["']/g, replacement: "'explosion.medium'" },
        { pattern: /["']vfx\.trail\.[^"']*["']/g, replacement: "'trail.small'" },
        { pattern: /["']vfx\.powerup\.[^"']*["']/g, replacement: "'powerup'" },
        { pattern: /["']vfx\.projectile\.[^"']*["']/g, replacement: "'hit.small'" },
        // Unique/special effects
        { pattern: /["']vfx\.unique\.spawn\.[^"']*["']/g, replacement: "'spawn'" },
        { pattern: /["']vfx\.unique\.death\.[^"']*["']/g, replacement: "'death.large'" },
        { pattern: /["']vfx\.unique\.[^"']*["']/g, replacement: "'special'" },
        { pattern: /["']vfx\.boss\.[^"']*["']/g, replacement: "'boss.special'" },
        { pattern: /["']vfx\.elite\.[^"']*["']/g, replacement: "'elite.special'" },
        { pattern: /["']vfx\.effect\.[^"']*["']/g, replacement: "'effect'" },
        { pattern: /["']vfx\.telegraph\.[^"']*["']/g, replacement: "'telegraph'" },
        { pattern: /["']vfx\.aura\.[^"']*["']/g, replacement: "'aura'" },
        { pattern: /["']vfx\.shield\.[^"']*["']/g, replacement: "'shield.hit'" },
        // Generic catch-all for any remaining vfx.*
        { pattern: /["']vfx\.[^"']*["']/g, replacement: "'effect'" },
    ];
    
    for (const { pattern, replacement } of vfxPatterns) {
        const matches = modified.match(pattern);
        if (matches) {
            modified = modified.replace(pattern, replacement);
            changeCount += matches.length;
        }
    }
    
    // Catch-all patterns for unmapped SFX IDs (convert to generic sounds)
    const sfxPatterns = [
        { pattern: /["']sfx\.enemy\.hit\.[^"']*["']/g, replacement: "'sound/npc_hit_norm.mp3'" },
        { pattern: /["']sfx\.enemy\.death\.[^"']*["']/g, replacement: "'sound/npc_death_norm.mp3'" },
        { pattern: /["']sfx\.enemy\.spawn\.[^"']*["']/g, replacement: "'sound/npc_spawn_norm.mp3'" },
        { pattern: /["']sfx\.weapon\.[^"']*["']/g, replacement: "'sound/laser_norm.mp3'" },
        { pattern: /["']sfx\.powerup\.[^"']*["']/g, replacement: "'sound/powerup_norm.mp3'" },
        { pattern: /["']sfx\.projectile\.[^"']*["']/g, replacement: "'sound/projectile_hit_norm.mp3'" },
        // Unique/special sounds
        { pattern: /["']sfx\.unique\.spawn\.[^"']*["']/g, replacement: "'sound/npc_spawn_norm.mp3'" },
        { pattern: /["']sfx\.unique\.death\.[^"']*["']/g, replacement: "'sound/elite_death_norm.mp3'" },
        { pattern: /["']sfx\.unique\.hit\.[^"']*["']/g, replacement: "'sound/hit_hard_norm.mp3'" },
        { pattern: /["']sfx\.unique\.[^"']*["']/g, replacement: "'sound/powerup_norm.mp3'" },
        { pattern: /["']sfx\.boss\.[^"']*["']/g, replacement: "'sound/boss_hit_norm.mp3'" },
        { pattern: /["']sfx\.elite\.[^"']*["']/g, replacement: "'sound/elite_death_norm.mp3'" },
        { pattern: /["']sfx\.flamethrower\.[^"']*["']/g, replacement: "'sound/flamethrower_norm.mp3'" },
        // Generic catch-all for any remaining sfx.*
        { pattern: /["']sfx\.[^"']*["']/g, replacement: "'sound/hit_soft_norm.mp3'" },
    ];
    
    for (const { pattern, replacement } of sfxPatterns) {
        const matches = modified.match(pattern);
        if (matches) {
            modified = modified.replace(pattern, replacement);
            changeCount += matches.length;
        }
    }
    
    return { modified, changeCount };
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const { modified, changeCount } = processBlueprint(content);
    
    if (changeCount > 0) {
        // Create backup
        const backupPath = filePath + '.pre-vfx-sfx-migration.bak';
        if (!fs.existsSync(backupPath)) {
            fs.writeFileSync(backupPath, content);
        }
        
        // Write modified content
        fs.writeFileSync(filePath, modified);
        console.log(`✅ ${path.relative(rootDir, filePath)}: ${changeCount} changes`);
        return changeCount;
    }
    
    return 0;
}

function findBlueprintFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            files.push(...findBlueprintFiles(fullPath));
        } else if (item.name.endsWith('.json5')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

// Main execution
console.log('🔄 Starting VFX/SFX migration...\n');

const blueprintDir = path.join(rootDir, 'data', 'blueprints');
const blueprintFiles = findBlueprintFiles(blueprintDir);

console.log(`Found ${blueprintFiles.length} blueprint files\n`);

let totalChanges = 0;
let filesModified = 0;

for (const file of blueprintFiles) {
    const changes = processFile(file);
    if (changes > 0) {
        totalChanges += changes;
        filesModified++;
    }
}

console.log('\n' + '='.repeat(50));
console.log(`✅ Migration complete!`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total changes: ${totalChanges}`);
console.log(`   Backups created with .pre-vfx-sfx-migration.bak extension`);
console.log('='.repeat(50));