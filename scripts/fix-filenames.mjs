#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const dataRoot = '/Users/miroslav/Desktop/Rakovinobijec/data/blueprints';

async function fixFilenames() {
  const categories = ['boss', 'enemy', 'unique', 'powerup', 'drop', 'projectile', 'lootTable', 'spawn'];
  
  for (const category of categories) {
    const categoryDir = path.join(dataRoot, category);
    if (!fs.existsSync(categoryDir)) continue;
    
    const files = fs.readdirSync(categoryDir);
    
    for (const file of files) {
      if (file.includes('.') && file.endsWith('.json5')) {
        // Get the part before .json5
        const nameWithoutExt = file.replace('.json5', '');
        
        // Replace dots with underscores only in the ID part, keep .json5
        const newName = nameWithoutExt.replace(/\./g, '_') + '.json5';
        
        const oldPath = path.join(categoryDir, file);
        const newPath = path.join(categoryDir, newName);
        
        if (oldPath !== newPath) {
          fs.renameSync(oldPath, newPath);
          console.log(`Fixed: ${file} -> ${newName}`);
        }
      }
    }
  }
}

fixFilenames();