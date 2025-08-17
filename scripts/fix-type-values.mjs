#!/usr/bin/env node

/**
 * Fix Type Values
 * Fixes invalid type values in blueprints
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSON5 from 'json5';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Type mapping
const typeMapping = {
    'system': 'powerup',    // System files → powerup as closest match
    'systems': 'powerup',
    'spawn': 'enemy',       // Spawn tables → enemy type
    'spawntable': 'enemy',
    'spawnTable': 'enemy',
    'player': 'powerup'     // Player → powerup as special entity
};

// Files that need type fixes
const filesToFix = [
    'data/blueprints/system/pity_system.json5',
    'data/blueprints/system/ng_plus_scaling.json5',
    'data/blueprints/spawn/level1.json5',
    'data/blueprints/spawn/level2.json5',
    'data/blueprints/spawn/level3.json5',
    'data/blueprints/player/player.json5'
];

let fixedCount = 0;

filesToFix.forEach(file => {
    const fullPath = path.join(rootDir, file);
    const relativePath = path.relative(rootDir, fullPath);
    
    try {
        // Read and parse
        const content = fs.readFileSync(fullPath, 'utf8');
        const blueprint = JSON5.parse(content);
        
        // Check and fix type
        if (blueprint.type) {
            const currentType = blueprint.type;
            const newType = typeMapping[currentType];
            
            if (newType && newType !== currentType) {
                blueprint.type = newType;
                console.log(`  Fixing type: "${currentType}" → "${newType}"`);
                
                // Write back
                const newContent = JSON5.stringify(blueprint, null, 2);
                fs.writeFileSync(fullPath, newContent + '\n');
                
                console.log(`✅ ${relativePath}: Type fixed`);
                fixedCount++;
            }
        }
        
        // Also fix spawn table specific issues
        if (file.includes('spawn/level')) {
            // Add display if missing
            if (!blueprint.display) {
                const levelNum = file.match(/level(\d+)/)?.[1] || '1';
                blueprint.display = {
                    name: `Level ${levelNum}`,
                    icon: 'ui.icon.level'
                };
            }
            
            // Fix ID pattern if needed
            if (blueprint.id && !blueprint.id.match(/^[a-z]+\.[a-z_]+$/)) {
                const oldId = blueprint.id;
                blueprint.id = blueprint.id.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
                console.log(`  Fixing ID: "${oldId}" → "${blueprint.id}"`);
            }
            
            // Write back
            const newContent = JSON5.stringify(blueprint, null, 2);
            fs.writeFileSync(fullPath, newContent + '\n');
            fixedCount++;
        }
        
        // Fix player specific issues
        if (file.includes('player/player')) {
            // Fix ID pattern
            if (blueprint.id === 'player') {
                blueprint.id = 'player.main';
            }
            
            // Fix shield/sfx objects that should be strings
            if (blueprint.vfx && typeof blueprint.vfx.shield === 'object') {
                blueprint.vfx.shield = 'vfx.placeholder.shield';
            }
            if (blueprint.sfx && typeof blueprint.sfx.shield === 'object') {
                blueprint.sfx.shield = 'sfx.placeholder.shield';
            }
            
            // Write back
            const newContent = JSON5.stringify(blueprint, null, 2);
            fs.writeFileSync(fullPath, newContent + '\n');
        }
        
    } catch (error) {
        console.error(`❌ Error processing ${relativePath}: ${error.message}`);
    }
});

// Fix special VFX object issues in other files
const specialFixes = [
    'data/blueprints/enemy/enemy_necrotic_cell.json5',
    'data/blueprints/enemy/enemy_micro_shooter_simplified.json5'
];

specialFixes.forEach(file => {
    const fullPath = path.join(rootDir, file);
    const relativePath = path.relative(rootDir, fullPath);
    
    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const blueprint = JSON5.parse(content);
        let modified = false;
        
        // Fix VFX values that are objects instead of strings
        if (blueprint.vfx) {
            Object.keys(blueprint.vfx).forEach(key => {
                if (typeof blueprint.vfx[key] === 'object') {
                    blueprint.vfx[key] = `vfx.placeholder.${key}`;
                    console.log(`  Fixing vfx.${key}: object → string`);
                    modified = true;
                }
            });
        }
        
        if (modified) {
            const newContent = JSON5.stringify(blueprint, null, 2);
            fs.writeFileSync(fullPath, newContent + '\n');
            console.log(`✅ ${relativePath}: VFX values fixed`);
            fixedCount++;
        }
        
    } catch (error) {
        console.error(`❌ Error processing ${relativePath}: ${error.message}`);
    }
});

console.log(`\n📊 Fixed ${fixedCount} files`);