#!/usr/bin/env node

/**
 * Skript pro regeneraci registry indexu
 * PR7 kompatibilní - automaticky načítá všechny blueprinty
 * a vytváří aktuální index pro BlueprintLoader
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Cesty ke klíčovým složkám
const BLUEPRINTS_DIR = path.join(projectRoot, 'data', 'blueprints');
const REGISTRY_DIR = path.join(projectRoot, 'data', 'registries');
const INDEX_FILE = path.join(REGISTRY_DIR, 'index.json');

/**
 * Načte všechny JSON5 blueprinty ze složky
 */
async function scanBlueprints() {
    console.log('🔍 Skenování blueprintů...\n');
    
    const blueprintIndex = {};
    const categories = {};
    let totalCount = 0;
    
    // Hledat všechny .json5 soubory v blueprints složce
    const pattern = path.join(BLUEPRINTS_DIR, '**/*.json5');
    const files = glob.sync(pattern);
    
    console.log(`📁 Nalezeno ${files.length} blueprint souborů\n`);
    
    for (const filePath of files) {
        try {
            // Přečíst soubor
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Extrahovat ID z obsahu (hledáme řádek s id:)
            const idMatch = content.match(/^\s*["\']?id["\']?\s*:\s*["\']([^"']+)["\']?/m);
            
            if (!idMatch) {
                console.warn(`⚠️  Soubor bez ID: ${path.relative(projectRoot, filePath)}`);
                continue;
            }
            
            const id = idMatch[1];
            
            // Relativní cesta od data/ složky
            const relativePath = path.relative(path.join(projectRoot, 'data'), filePath)
                .replace(/\\/g, '/'); // Windows fix
            
            // Přidat do indexu
            blueprintIndex[id] = relativePath;
            
            // Kategorizovat podle typu (první část ID nebo složka)
            const category = id.split('.')[0] || 'unknown';
            if (!categories[category]) {
                categories[category] = 0;
            }
            categories[category]++;
            
            totalCount++;
            console.log(`✅ ${id} -> ${relativePath}`);
            
        } catch (error) {
            console.error(`❌ Chyba při čtení ${filePath}: ${error.message}`);
        }
    }
    
    return { blueprintIndex, categories, totalCount };
}

/**
 * Vytvoří nový registry index
 */
async function createRegistryIndex(blueprintData) {
    const { blueprintIndex, totalCount } = blueprintData;
    
    // Vytvořit registry složku pokud neexistuje
    if (!fs.existsSync(REGISTRY_DIR)) {
        fs.mkdirSync(REGISTRY_DIR, { recursive: true });
        console.log(`\n📁 Vytvořena složka: ${REGISTRY_DIR}`);
    }
    
    // Připravit index objekt
    const index = {
        version: "2.0.0",
        generated: new Date().toISOString(),
        totalEntities: totalCount,
        index: blueprintIndex
    };
    
    // Zapsat index soubor
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
    console.log(`\n💾 Registry index uložen: ${INDEX_FILE}`);
    
    return index;
}

/**
 * Vytvoří souhrn pro zobrazení
 */
function printSummary(blueprintData, index) {
    const { categories } = blueprintData;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 SOUHRN REGISTRY INDEXU');
    console.log('='.repeat(50));
    console.log(`📅 Vygenerováno: ${new Date().toLocaleString('cs-CZ')}`);
    console.log(`📦 Celkem entit: ${index.totalEntities}`);
    console.log('\n📂 Kategorie:');
    
    // Seřadit kategorie podle počtu
    const sortedCategories = Object.entries(categories)
        .sort((a, b) => b[1] - a[1]);
    
    for (const [category, count] of sortedCategories) {
        const icon = getIconForCategory(category);
        console.log(`  ${icon} ${category}: ${count} položek`);
    }
    
    console.log('='.repeat(50));
}

/**
 * Vrátí ikonu pro kategorii
 */
function getIconForCategory(category) {
    const icons = {
        enemy: '👾',
        boss: '👹',
        unique: '⭐',
        drop: '💎',
        loot: '📦',
        lootTable: '📋',
        powerup: '⚡',
        projectile: '🔫',
        spawn: '🎯',
        spawnTable: '📅',
        system: '⚙️',
        proj: '💥'
    };
    return icons[category] || '📄';
}

/**
 * Hlavní funkce
 */
async function main() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Registry Index Builder - PR7 v2.0   ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    try {
        // Skenovat blueprinty
        const blueprintData = await scanBlueprints();
        
        if (blueprintData.totalCount === 0) {
            console.error('❌ Žádné blueprinty nenalezeny!');
            process.exit(1);
        }
        
        // Vytvořit index
        const index = await createRegistryIndex(blueprintData);
        
        // Zobrazit souhrn
        printSummary(blueprintData, index);
        
        console.log('\n✅ Registry index úspěšně vytvořen!');
        console.log('🎮 Hra nyní načte všechny blueprinty správně.');
        
    } catch (error) {
        console.error('\n❌ Kritická chyba:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Spustit
main();