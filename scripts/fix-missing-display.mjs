#!/usr/bin/env node

/**
 * Fix Missing Display Properties
 * Adds display property to blueprints that are missing it
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSON5 from 'json5';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Display templates per type
const displayTemplates = {
    'item_xp_small': { name: 'Small XP Orb', icon: 'ui.icon.xp.small' },
    'item_xp_medium': { name: 'Medium XP Orb', icon: 'ui.icon.xp.medium' },
    'item_xp_large': { name: 'Large XP Orb', icon: 'ui.icon.xp.large' },
    'item_heal_orb': { name: 'Heal Orb', icon: 'ui.icon.heal' },
    'item_health_small': { name: 'Health Pack', icon: 'ui.icon.health' },
    'item_protein_cache': { name: 'Protein Cache', icon: 'ui.icon.protein' },
    'item_energy_cell': { name: 'Energy Cell', icon: 'ui.icon.energy' },
    'item_metotrexat': { name: 'Metotrexat', icon: 'ui.icon.special' },
    'item_research_point': { name: 'Research Point', icon: 'ui.icon.research' },
    'enemy_simple_example': { name: 'Simple Enemy', icon: 'ui.icon.enemy' }
};

// Files that need display property
const filesToFix = [
    'data/blueprints/items/xp/item_xp_small.json5',
    'data/blueprints/items/xp/item_xp_medium.json5',
    'data/blueprints/items/xp/item_xp_large.json5',
    'data/blueprints/items/health/item_heal_orb.json5',
    'data/blueprints/items/health/item_health_small.json5',
    'data/blueprints/items/health/item_protein_cache.json5',
    'data/blueprints/items/special/item_energy_cell.json5',
    'data/blueprints/items/special/item_metotrexat.json5',
    'data/blueprints/items/special/item_research_point.json5',
    'data/blueprints/enemy/enemy_simple_example.json5'
];

let fixedCount = 0;

filesToFix.forEach(file => {
    const fullPath = path.join(rootDir, file);
    const relativePath = path.relative(rootDir, fullPath);
    
    try {
        // Read and parse
        const content = fs.readFileSync(fullPath, 'utf8');
        const blueprint = JSON5.parse(content);
        
        // Check if display is missing
        if (!blueprint.display) {
            // Get template based on ID
            const idParts = blueprint.id.split('.');
            const key = idParts[idParts.length - 1];
            
            const template = displayTemplates[key] || {
                name: blueprint.id,
                icon: 'ui.icon.placeholder'
            };
            
            // Add display property
            blueprint.display = template;
            
            // Write back
            const newContent = JSON5.stringify(blueprint, null, 2);
            fs.writeFileSync(fullPath, newContent + '\n');
            
            console.log(`✅ ${relativePath}: Added display property`);
            fixedCount++;
        }
    } catch (error) {
        console.error(`❌ Error processing ${relativePath}: ${error.message}`);
    }
});

console.log(`\n📊 Fixed ${fixedCount} files`);