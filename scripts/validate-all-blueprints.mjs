#!/usr/bin/env node

/**
 * Blueprint Validator
 * Validates all blueprints against schema and checks references
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import JSON5 from 'json5';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Initialize AJV
const ajv = new Ajv({ 
    allErrors: true, 
    allowUnionTypes: true,
    strict: false 
});

// Load schema
const schemaPath = path.join(rootDir, 'data/schemas/blueprint.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const validate = ajv.compile(schema);

// Collect all VFX/SFX IDs from registries
function collectRegistryIds() {
    const ids = new Set();
    
    // Add known VFX IDs
    const vfxIds = [
        'vfx.enemy.spawn.default',
        'vfx.enemy.death.small',
        'vfx.enemy.death.burst',
        'vfx.hit.spark.small',
        'vfx.hit.spark.generic',
        'vfx.player.spawn',
        'vfx.player.hit',
        'vfx.player.death',
        'vfx.weapon.muzzle',
        'vfx.player.heal',
        'vfx.boss.spawn',
        'vfx.boss.death',
        'vfx.explosion.small'
    ];
    vfxIds.forEach(id => ids.add(id));
    
    // Add direct sound file paths (new PR7 approach)
    const soundFiles = glob.sync('sound/**/*.{mp3,ogg,wav}', { cwd: rootDir });
    soundFiles.forEach(file => ids.add(file));
    
    // Also add legacy SFX IDs for compatibility
    const sfxIds = [
        'sfx.enemy.spawn',
        'sfx.enemy.hit.soft',
        'sfx.enemy.death.small',
        'sfx.player.spawn',
        'sfx.player.hit',
        'sfx.player.death',
        'sfx.player.shoot',
        'sfx.player.heal',
        'sfx.boss.spawn',
        'sfx.boss.death'
    ];
    sfxIds.forEach(id => ids.add(id));
    
    return ids;
}

// Check if VFX/SFX references exist
function checkReferences(blueprint, registryIds) {
    const warnings = [];
    
    // Check VFX references
    if (blueprint.vfx) {
        Object.entries(blueprint.vfx).forEach(([key, value]) => {
            if (value && !registryIds.has(value)) {
                warnings.push(`VFX reference not found: ${key}="${value}"`);
            }
        });
    }
    
    // Check SFX references (can be IDs or direct paths)
    if (blueprint.sfx) {
        Object.entries(blueprint.sfx).forEach(([key, value]) => {
            if (value) {
                // Check if it's a direct path or an ID
                const isPath = value.includes('/') || value.endsWith('.mp3') || value.endsWith('.ogg');
                if (!isPath && !registryIds.has(value)) {
                    warnings.push(`SFX reference not found: ${key}="${value}"`);
                } else if (isPath && !fs.existsSync(path.join(rootDir, value))) {
                    warnings.push(`SFX file not found: ${key}="${value}"`);
                }
            }
        });
    }
    
    return warnings;
}

// Main validation
async function validateBlueprints() {
    console.log('🔍 Validating all blueprints...');
    console.log('================================================');
    
    const registryIds = collectRegistryIds();
    console.log(`📚 Loaded ${registryIds.size} registry IDs`);
    
    // Find all blueprint files
    const blueprintFiles = glob.sync('data/blueprints/**/*.{json,json5}', { 
        cwd: rootDir,
        ignore: ['**/templates/**', '**/README.md']
    });
    
    console.log(`📁 Found ${blueprintFiles.length} blueprint files\n`);
    
    let totalErrors = 0;
    let totalWarnings = 0;
    let validFiles = 0;
    
    for (const file of blueprintFiles) {
        const fullPath = path.join(rootDir, file);
        const relativePath = path.relative(rootDir, fullPath);
        
        try {
            // Read and parse file
            const content = fs.readFileSync(fullPath, 'utf8');
            const blueprint = file.endsWith('.json5') 
                ? JSON5.parse(content)
                : JSON.parse(content);
            
            // Validate against schema
            const valid = validate(blueprint);
            
            if (!valid) {
                console.log(`❌ ${relativePath}`);
                validate.errors.forEach(err => {
                    console.log(`   ${err.instancePath || '/'}: ${err.message}`);
                    if (err.params) {
                        console.log(`     params: ${JSON.stringify(err.params)}`);
                    }
                });
                totalErrors++;
            } else {
                // Check references
                const warnings = checkReferences(blueprint, registryIds);
                
                if (warnings.length > 0) {
                    console.log(`⚠️  ${relativePath}`);
                    warnings.forEach(w => console.log(`   ${w}`));
                    totalWarnings += warnings.length;
                } else {
                    validFiles++;
                }
            }
            
        } catch (error) {
            console.log(`❌ ${relativePath}`);
            console.log(`   Parse error: ${error.message}`);
            totalErrors++;
        }
    }
    
    // Summary
    console.log('\n================================================');
    console.log('📊 Validation Summary:');
    console.log(`   ✅ Valid files: ${validFiles}/${blueprintFiles.length}`);
    
    if (totalErrors > 0) {
        console.log(`   ❌ Schema errors: ${totalErrors}`);
    }
    
    if (totalWarnings > 0) {
        console.log(`   ⚠️  Reference warnings: ${totalWarnings}`);
    }
    
    if (totalErrors === 0 && totalWarnings === 0) {
        console.log('\n✅ All blueprints are valid!');
        process.exit(0);
    } else if (totalErrors === 0) {
        console.log('\n⚠️  Validation passed with warnings');
        process.exit(0); // Exit 0 for warnings only
    } else {
        console.log('\n❌ Validation failed');
        process.exit(1);
    }
}

// Run validation
validateBlueprints().catch(error => {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
});