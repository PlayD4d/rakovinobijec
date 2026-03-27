#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

// Map file patterns to debug categories
const CATEGORY_MAP = {
  'spawn': ['SpawnDirector', 'spawn', 'Spawn'],
  'enemy': ['Enemy', 'enemy', 'NPC', 'Boss', 'boss'],
  'collision': ['collision', 'Collision', 'overlap'],
  'physics': ['physics', 'Physics', 'velocity', 'body'],
  'powerup': ['PowerUp', 'powerup', 'power-up'],
  'vfx': ['VFX', 'vfx', 'effect', 'particle'],
  'sfx': ['SFX', 'sfx', 'audio', 'sound'],
  'projectile': ['Projectile', 'projectile', 'bullet'],
  'loot': ['Loot', 'loot', 'drop', 'XP'],
  'ui': ['UI', 'ui', 'modal', 'button', 'menu'],
  'bootstrap': ['Bootstrap', 'bootstrap', 'init', 'Initialize'],
  'transition': ['Transition', 'transition', 'victory', 'defeat']
};

// Determine category based on file name and console message
function getCategory(fileName, message) {
  const fileBase = basename(fileName).toLowerCase();
  
  for (const [category, patterns] of Object.entries(CATEGORY_MAP)) {
    for (const pattern of patterns) {
      if (fileBase.includes(pattern.toLowerCase()) || 
          message.toLowerCase().includes(pattern.toLowerCase())) {
        return category;
      }
    }
  }
  
  return 'general'; // default category
}

// Determine log level based on console method and message
function getLogLevel(method, message) {
  if (method === 'error') return 'error';
  if (method === 'warn') return 'warn';
  
  // Check message content
  const msgLower = message.toLowerCase();
  if (msgLower.includes('error') || msgLower.includes('failed')) return 'error';
  if (msgLower.includes('warning') || msgLower.includes('warn')) return 'warn';
  if (msgLower.includes('debug') || msgLower.includes('verbose')) return 'debug';
  
  return 'info'; // default
}

// Process a single file
function processFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  const fileName = basename(filePath);
  let modified = false;
  let changeCount = 0;
  
  // Check if file already imports DebugLogger
  const hasDebugLoggerImport = content.includes("import { DebugLogger }") || 
                               content.includes("from '../core/debug/DebugLogger");
  
  // Match console.log, console.warn, console.error, console.debug
  const consoleRegex = /console\.(log|warn|error|debug)\s*\(/g;
  
  // Replace console calls
  content = content.replace(consoleRegex, (match, method) => {
    // Get the full statement to analyze
    const startIndex = content.lastIndexOf('console.', content.indexOf(match));
    const endIndex = findClosingParen(content, startIndex);
    const fullStatement = content.substring(startIndex, endIndex + 1);
    
    // Extract message for category detection
    const messageMatch = fullStatement.match(/console\.\w+\s*\(\s*['"`]([^'"`]*)/);
    const message = messageMatch ? messageMatch[1] : '';
    
    const category = getCategory(filePath, message);
    const level = getLogLevel(method, message);
    
    changeCount++;
    modified = true;
    
    return `DebugLogger.${level}('${category}', `;
  });
  
  // Add import if modified and not already present
  if (modified && !hasDebugLoggerImport) {
    // Find the right place to add import (after other imports or at top)
    const importMatch = content.match(/^import .* from .*;$/m);
    if (importMatch) {
      const lastImportIndex = content.lastIndexOf(importMatch[0]) + importMatch[0].length;
      content = content.slice(0, lastImportIndex) + 
                "\nimport { DebugLogger } from '../core/debug/DebugLogger.js';" +
                content.slice(lastImportIndex);
    } else {
      // No imports, add at top
      content = "import { DebugLogger } from '../core/debug/DebugLogger.js';\n\n" + content;
    }
  }
  
  if (modified) {
    writeFileSync(filePath, content);
    console.log(`✅ ${fileName}: Converted ${changeCount} console calls`);
    return changeCount;
  }
  
  return 0;
}

// Find closing parenthesis for a function call
function findClosingParen(str, startIndex) {
  let parenCount = 0;
  let inString = false;
  let stringChar = null;
  
  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];
    
    if (!inString) {
      if (char === '"' || char === "'" || char === '`') {
        inString = true;
        stringChar = char;
      } else if (char === '(') {
        parenCount++;
      } else if (char === ')') {
        parenCount--;
        if (parenCount === 0) {
          return i;
        }
      }
    } else {
      if (char === stringChar && str[i - 1] !== '\\') {
        inString = false;
      }
    }
  }
  
  return str.length - 1;
}

// Process directory recursively
function processDirectory(dirPath) {
  let totalChanges = 0;
  
  const files = readdirSync(dirPath);
  for (const file of files) {
    const fullPath = join(dirPath, file);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other irrelevant directories
      if (!file.includes('node_modules') && !file.startsWith('.')) {
        totalChanges += processDirectory(fullPath);
      }
    } else if (file.endsWith('.js') && !file.includes('.backup')) {
      totalChanges += processFile(fullPath);
    }
  }
  
  return totalChanges;
}

// Main execution
const targetPath = process.argv[2] || 'js';
console.log(`🔧 Converting console.* to DebugLogger in ${targetPath}...`);

try {
  const changes = processDirectory(targetPath);
  console.log(`\n✨ Complete! Converted ${changes} console calls to DebugLogger`);
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}