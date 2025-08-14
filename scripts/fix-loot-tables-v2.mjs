#!/usr/bin/env node

/**
 * Opravuje strukturu loot tabulek podle BlueprintValidator
 * PR7 kompatibilní
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSON5 from 'json5';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOOT_DIR = path.join(__dirname, '..', 'data', 'blueprints', 'loot');

// Povolené modifikátory podle BlueprintValidator
const VALID_MODIFIERS = [
    'dropRateMultiplier', 'qualityBonus', 'luckInfluence',
    'eliteBonus', 'bossBonus', 'timeScaling', 'timeScalingRate',
    'chaosMultiplier', 'survivalBonus', 'survivalThreshold', 'survivalMultiplier'
];

async function fixLootTable(filePath) {
  const fileName = path.basename(filePath);
  console.log(`  Opravuji: ${fileName}`);
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON5.parse(content);
    
    // 1. Opravit pools strukturu
    if (data.pools && Array.isArray(data.pools)) {
      data.pools.forEach(pool => {
        // Změnit 'items' na 'entries'
        if (pool.items && !pool.entries) {
          pool.entries = pool.items.map(item => {
            // Převést item strukturu na správný formát
            const entry = {
              ref: item.itemId || item.ref,
              weight: item.weight || 1.0
            };
            
            // Převést minCount/maxCount na qty
            if (item.minCount !== undefined || item.maxCount !== undefined) {
              entry.qty = {
                min: item.minCount || 1,
                max: item.maxCount || 1
              };
            } else if (item.qty !== undefined) {
              entry.qty = item.qty;
            } else {
              entry.qty = 1;
            }
            
            return entry;
          });
          delete pool.items;
        }
        
        // Nastavit výchozí rolls pokud chybí
        if (pool.rolls === undefined) {
          pool.rolls = 1;
        }
      });
    }
    
    // 2. Opravit modifikátory
    if (data.modifiers) {
      const newModifiers = {};
      
      // Převést známé modifikátory na správné
      if (data.modifiers.levelScaling) {
        newModifiers.timeScaling = true;
        newModifiers.timeScalingRate = 0.01; // 1% za minutu
      }
      if (data.modifiers.playerLuckBonus) {
        newModifiers.luckInfluence = 1.0;
      }
      if (data.modifiers.eliteMultiplier) {
        newModifiers.eliteBonus = data.modifiers.eliteMultiplier - 1.0;
      }
      if (data.modifiers.bossKillBonus) {
        newModifiers.bossBonus = 0.5;
      }
      
      // Zachovat pouze validní modifikátory
      for (const [key, value] of Object.entries(data.modifiers)) {
        if (VALID_MODIFIERS.includes(key)) {
          newModifiers[key] = value;
        }
      }
      
      data.modifiers = newModifiers;
    }
    
    // 3. Přidat výchozí caps pokud chybějí
    if (!data.caps) {
      data.caps = {
        maxDropsPerKill: 5,
        maxDropsPerMinute: 300,
        maxSameDropStreak: 3,
        cooldownBetweenRare: 1000
      };
    }
    
    // Uložit zpět jako JSON5 s komentáři
    let newContent = `{
  // Loot tabulka: ${fileName.replace('.json5', '')}
  // PR7 kompatibilní struktura
  
  id: "${data.id}",
  type: "lootTable",
  
  // Statistiky
  stats: ${JSON5.stringify(data.stats, null, 2).split('\n').join('\n  ')},
  
  // Loot pools
  pools: ${JSON5.stringify(data.pools, null, 2).split('\n').join('\n  ')},
  
  // Modifikátory
  modifiers: ${JSON5.stringify(data.modifiers, null, 2).split('\n').join('\n  ')},
  
  // Limity
  caps: ${JSON5.stringify(data.caps, null, 2).split('\n').join('\n  ')}
}`;
    
    await fs.writeFile(filePath, newContent, 'utf8');
    console.log(`    ✅ Opraveno`);
  } catch (error) {
    console.error(`    ❌ Chyba: ${error.message}`);
  }
}

async function main() {
  console.log('🔧 Oprava struktury loot tabulek v2\n');
  
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