#!/usr/bin/env node

/**
 * Fix sound paths in blueprints - remove _norm suffix
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, '..');

function fixSoundPaths(content) {
    let modified = content;
    let changeCount = 0;
    
    // Remove _norm suffix from sound paths
    const regex = /sound\/([^'"]*?)_norm\.mp3/g;
    const matches = modified.match(regex);
    if (matches) {
        modified = modified.replace(regex, 'sound/$1.mp3');
        changeCount = matches.length;
    }
    
    return { modified, changeCount };
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const { modified, changeCount } = fixSoundPaths(content);
    
    if (changeCount > 0) {
        fs.writeFileSync(filePath, modified);
        console.log(`✅ ${path.relative(rootDir, filePath)}: ${changeCount} sound paths fixed`);
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
console.log('🔧 Fixing sound paths (removing _norm suffix)...\n');

const blueprintDir = path.join(rootDir, 'data', 'blueprints');
const blueprintFiles = findBlueprintFiles(blueprintDir);

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
console.log(`✅ Sound path fix complete!`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total paths fixed: ${totalChanges}`);
console.log('='.repeat(50));