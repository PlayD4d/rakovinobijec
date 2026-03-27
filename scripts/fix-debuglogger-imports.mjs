#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Calculate correct relative path from source to target
function calculateRelativePath(fromFile, toFile) {
    const fromDir = path.dirname(fromFile);
    let relativePath = path.relative(fromDir, toFile);
    
    // Ensure forward slashes for ES6 imports
    relativePath = relativePath.replace(/\\/g, '/');
    
    // Add ./ if it doesn't start with ../
    if (!relativePath.startsWith('../')) {
        relativePath = './' + relativePath;
    }
    
    return relativePath;
}

// Fix imports in a file
function fixImportsInFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file has incorrect DebugLogger import (handle both quote types)
    const incorrectPattern = /import\s*{\s*DebugLogger\s*}\s*from\s*(['"])\.\.\/core\/debug\/DebugLogger\.js\1/;
    
    if (!incorrectPattern.test(content)) {
        return false; // No incorrect import found
    }
    
    // Calculate correct path
    const debugLoggerPath = path.join(projectRoot, 'js', 'core', 'debug', 'DebugLogger.js');
    const correctPath = calculateRelativePath(filePath, debugLoggerPath);
    
    // Replace incorrect import with correct one (preserve quote type)
    const fixedContent = content.replace(
        incorrectPattern,
        (match, quote) => `import { DebugLogger } from ${quote}${correctPath}${quote}`
    );
    
    fs.writeFileSync(filePath, fixedContent);
    console.log(`✅ Fixed: ${path.relative(projectRoot, filePath)}`);
    console.log(`   Changed to: ${correctPath}`);
    
    return true;
}

// Find all JS files with incorrect imports
function findAndFixFiles() {
    const jsDir = path.join(projectRoot, 'js');
    let fixedCount = 0;
    
    function walkDir(dir) {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                // Skip node_modules and other irrelevant directories
                if (!file.startsWith('.') && file !== 'node_modules') {
                    walkDir(filePath);
                }
            } else if (file.endsWith('.js')) {
                try {
                    if (fixImportsInFile(filePath)) {
                        fixedCount++;
                    }
                } catch (error) {
                    console.error(`❌ Error fixing ${filePath}:`, error.message);
                }
            }
        }
    }
    
    console.log('🔍 Searching for files with incorrect DebugLogger imports...\n');
    walkDir(jsDir);
    
    console.log(`\n📊 Summary: Fixed ${fixedCount} files`);
}

// Run the fix
findAndFixFiles();