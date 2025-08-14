#!/usr/bin/env node

/**
 * Opravuje strukturu loot tabulek - převádí drops na pools
 * PR7 kompatibilní
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSON5 from 'json5';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOOT_DIR = path.join(__dirname, '..', 'data', 'blueprints', 'loot');

async function fixLootTable(filePath) {
  console.log(`  Opravuji: ${path.basename(filePath)}`);
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON5.parse(content);
    
    // Pokud už má pools, přeskočit
    if (data.pools) {
      console.log(`    ✅ Již má pools strukturu`);
      return;
    }
    
    // Pokud má drops, převést na pools
    if (data.drops && Array.isArray(data.drops)) {
      data.pools = [{
        rolls: 1,
        items: data.drops
      }];
      delete data.drops;
      
      // Uložit zpět jako JSON5
      const newContent = JSON5.stringify(data, null, 2);
      await fs.writeFile(filePath, newContent, 'utf8');
      console.log(`    ✅ Převedeno z drops na pools`);
    } else {
      console.log(`    ⚠️ Nemá ani drops ani pools`);
    }
  } catch (error) {
    console.error(`    ❌ Chyba: ${error.message}`);
  }
}

async function main() {
  console.log('🔧 Oprava struktury loot tabulek\n');
  
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