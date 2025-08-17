#!/usr/bin/env node

/**
 * VFX Prefix Fixer
 * Automatically adds "vfx." prefix to VFX values that don't have it
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSON5 from 'json5';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Statistics
let totalFiles = 0;
let modifiedFiles = 0;
let totalFixes = 0;

/**
 * Fix VFX values in an object recursively
 */
function fixVfxValues(obj, path = '') {
    let fixes = 0;
    
    if (typeof obj !== 'object' || obj === null) {
        return fixes;
    }
    
    // Handle VFX object specifically
    if (path === '' && obj.vfx && typeof obj.vfx === 'object') {
        Object.keys(obj.vfx).forEach(key => {
            const value = obj.vfx[key];
            if (typeof value === 'string' && value && !value.startsWith('vfx.')) {
                console.log(`  Fixing vfx.${key}: "${value}" → "vfx.${value}"`);
                obj.vfx[key] = `vfx.${value}`;
                fixes++;
            }
        });
    }
    
    // Recursively fix nested objects
    Object.keys(obj).forEach(key => {
        if (key !== 'vfx' && typeof obj[key] === 'object') {
            fixes += fixVfxValues(obj[key], `${path}/${key}`);
        }
    });
    
    return fixes;
}

/**
 * Process a single blueprint file
 */
function processFile(filePath) {
    const relativePath = path.relative(rootDir, filePath);
    
    try {
        // Read file
        const content = fs.readFileSync(filePath, 'utf8');
        const isJson5 = filePath.endsWith('.json5');
        
        // Parse
        const blueprint = isJson5 ? JSON5.parse(content) : JSON.parse(content);
        
        // Fix VFX values
        const fixes = fixVfxValues(blueprint);
        
        if (fixes > 0) {
            console.log(`📝 ${relativePath}: ${fixes} fixes`);
            
            // Write back
            const newContent = isJson5 
                ? JSON5.stringify(blueprint, null, 2)
                : JSON.stringify(blueprint, null, 2);
            
            fs.writeFileSync(filePath, newContent + '\n');
            
            modifiedFiles++;
            totalFixes += fixes;
        }
        
        totalFiles++;
        
    } catch (error) {
        console.error(`❌ Error processing ${relativePath}: ${error.message}`);
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🔧 VFX Prefix Fixer');
    console.log('================================================');
    console.log('Adding "vfx." prefix to VFX values...\n');
    
    // Find all blueprint files
    const blueprintFiles = glob.sync('data/blueprints/**/*.{json,json5}', {
        cwd: rootDir,
        ignore: ['**/templates/**', '**/README.md']
    });
    
    console.log(`📁 Found ${blueprintFiles.length} blueprint files\n`);
    
    // Process each file
    blueprintFiles.forEach(file => {
        processFile(path.join(rootDir, file));
    });
    
    // Summary
    console.log('\n================================================');
    console.log('📊 Summary:');
    console.log(`   📁 Files processed: ${totalFiles}`);
    console.log(`   📝 Files modified: ${modifiedFiles}`);
    console.log(`   🔧 Total fixes: ${totalFixes}`);
    
    if (totalFixes > 0) {
        console.log('\n✅ VFX prefixes fixed successfully!');
        console.log('Run validation again to verify: npm run validate:blueprints');
    } else {
        console.log('\n✅ No VFX prefix issues found!');
    }
}

// Run
main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});