#!/usr/bin/env node

/**
 * Opravuje caps v loot tabulkách podle BlueprintValidator
 * PR7 kompatibilní
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSON5 from 'json5';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOOT_DIR = path.join(__dirname, '..', 'data', 'blueprints', 'loot');

// Povolené caps podle BlueprintValidator
const VALID_CAPS = [
    'maxDropsPerMinute', 
    'maxSameDropStreak', 
    'cooldownBetweenRare',
    'powerupCooldown', 
    'metotrexatCooldown', 
    'ultraRareCooldown'
];

async function fixLootTable(filePath) {
  const fileName = path.basename(filePath);
  console.log(`  Opravuji: ${fileName}`);
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON5.parse(content);
    
    // Opravit caps
    if (data.caps) {
      const newCaps = {};
      
      // Převést maxDropsPerKill na správný název nebo odstranit
      for (const [key, value] of Object.entries(data.caps)) {
        if (key === 'maxDropsPerKill') {
          // Toto není validní cap, přesunout do stats
          if (!data.stats) data.stats = {};
          data.stats.maxDrops = value;
          console.log(`    - Přesunuto maxDropsPerKill -> stats.maxDrops`);
        } else if (VALID_CAPS.includes(key)) {
          newCaps[key] = value;
        } else {
          console.log(`    - Odstraněn neplatný cap: ${key}`);
        }
      }
      
      data.caps = newCaps;
    }
    
    // Uložit zpět
    const newContent = JSON5.stringify(data, null, 2);
    await fs.writeFile(filePath, newContent, 'utf8');
    console.log(`    ✅ Opraveno`);
  } catch (error) {
    console.error(`    ❌ Chyba: ${error.message}`);
  }
}

async function main() {
  console.log('🔧 Oprava caps v loot tabulkách\n');
  
  try {
    const files = await fs.readdir(LOOT_DIR);
    const lootFiles = files.filter(f => f.startsWith('lootTable') && f.endsWith('.json5'));
    
    console.log(`Nalezeno ${lootFiles.length} loot tabulek k opravě:\n`);
    
    for (const file of lootFiles) {
      await fixLootTable(path.join(LOOT_DIR, file));
    }
    
    console.log('\n✅ Hotovo!');
  } catch (error) {
    console.error('❌ Chyba:', error);
    process.exit(1);
  }
}

main();