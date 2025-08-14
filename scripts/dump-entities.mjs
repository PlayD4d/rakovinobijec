#!/usr/bin/env node

// Entity Dumper - automatický export bossů, mini-bossů a unique nepřátel
// Generuje JSON a CSV katalog všech entit pro další práci

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// === ENTITY SCANNER ===

class EntityScanner {
  constructor() {
    this.bosses = [];
    this.miniBosses = [];
    this.uniqueEnemies = [];
    this.regularEnemies = [];
    this.allBlueprints = new Map();
    
    this.blueprintPaths = {
      bosses: path.join(projectRoot, 'js/data/blueprints/boss'),
      enemies: path.join(projectRoot, 'js/data/blueprints/enemy'),
      legacy: path.join(projectRoot, 'js/data/bosses')
    };
  }
  
  async scan() {
    console.log('🔍 Scanning entity blueprints...\n');
    
    // Scan všech blueprint složek
    await this.scanBossBlueprints();
    await this.scanEnemyBlueprints();
    await this.scanLegacyBosses();
    
    // Kategorizace podle tagů
    this.categorizeEntities();
    
    // Export výsledků
    await this.exportResults();
    
    this.printSummary();
  }
  
  async scanBossBlueprints() {
    const bossDir = this.blueprintPaths.bosses;
    
    if (!fs.existsSync(bossDir)) {
      console.log(`⚠️  Boss directory not found: ${bossDir}`);
      return;
    }
    
    const files = fs.readdirSync(bossDir).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
      const blueprintPath = path.join(bossDir, file);
      const blueprint = await this.loadBlueprint(blueprintPath);
      
      if (blueprint) {
        blueprint.source = 'blueprints/boss';
        blueprint.type = 'boss';
        this.allBlueprints.set(blueprint.id, blueprint);
      }
    }
  }
  
  async scanEnemyBlueprints() {
    const enemyDir = this.blueprintPaths.enemies;
    
    if (!fs.existsSync(enemyDir)) {
      console.log(`⚠️  Enemy directory not found: ${enemyDir}`);
      return;
    }
    
    const files = fs.readdirSync(enemyDir).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
      const blueprintPath = path.join(enemyDir, file);
      const blueprint = await this.loadBlueprint(blueprintPath);
      
      if (blueprint) {
        blueprint.source = 'blueprints/enemy';
        blueprint.type = blueprint.type || 'enemy';
        this.allBlueprints.set(blueprint.id, blueprint);
      }
    }
  }
  
  async scanLegacyBosses() {
    const legacyDir = this.blueprintPaths.legacy;
    
    if (!fs.existsSync(legacyDir)) {
      console.log(`⚠️  Legacy directory not found: ${legacyDir}`);
      return;
    }
    
    const files = fs.readdirSync(legacyDir).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
      const blueprintPath = path.join(legacyDir, file);
      const blueprint = await this.loadBlueprint(blueprintPath);
      
      if (blueprint) {
        blueprint.source = 'legacy/bosses';
        blueprint.type = 'boss';
        blueprint.legacy = true;
        this.allBlueprints.set(blueprint.id || `legacy.${file.replace('.js', '')}`, blueprint);
      }
    }
  }
  
  async loadBlueprint(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Parse export default object
      const match = content.match(/export\s+default\s+({[\s\S]*});?$/m);
      if (!match) return null;
      
      // Bezpečné parsování objektu (simplified - v produkci použít proper parser)
      const objectStr = match[1];
      
      // Extrakce klíčových dat pomocí regex
      const blueprint = {
        id: this.extractValue(objectStr, 'id'),
        type: this.extractValue(objectStr, 'type'),
        stats: this.extractStats(objectStr),
        mechanics: this.extractMechanics(objectStr),
        display: this.extractDisplay(objectStr),
        vfx: this.extractKeys(objectStr, 'vfx'),
        sfx: this.extractKeys(objectStr, 'sfx'),
        tags: this.extractTags(objectStr),
        filePath: path.relative(projectRoot, filePath)
      };
      
      return blueprint;
      
    } catch (error) {
      console.error(`❌ Error loading ${filePath}:`, error.message);
      return null;
    }
  }
  
  extractValue(content, key) {
    const regex = new RegExp(`${key}:\\s*['"\`]([^'"\`]+)['"\`]`);
    const match = content.match(regex);
    return match ? match[1] : null;
  }
  
  extractStats(content) {
    const stats = {};
    const statsMatch = content.match(/stats:\s*{([^}]*)}/);
    
    if (statsMatch) {
      const statsContent = statsMatch[1];
      
      // Extract numeric values
      const hpMatch = statsContent.match(/hp:\s*(\d+)/);
      const damageMatch = statsContent.match(/damage:\s*(\d+)/);
      const speedMatch = statsContent.match(/speed:\s*([\d.]+)/);
      const armorMatch = statsContent.match(/armor:\s*(\d+)/);
      const xpMatch = statsContent.match(/xp:\s*(\d+)/);
      
      if (hpMatch) stats.hp = parseInt(hpMatch[1]);
      if (damageMatch) stats.damage = parseInt(damageMatch[1]);
      if (speedMatch) stats.speed = parseFloat(speedMatch[1]);
      if (armorMatch) stats.armor = parseInt(armorMatch[1]);
      if (xpMatch) stats.xp = parseInt(xpMatch[1]);
    }
    
    return stats;
  }
  
  extractMechanics(content) {
    const mechanics = {};
    const mechanicsMatch = content.match(/mechanics:\s*{([\s\S]*?)^  \}/m);
    
    if (mechanicsMatch) {
      const mechanicsContent = mechanicsMatch[1];
      
      // Check for phases
      if (mechanicsContent.includes('phases:')) {
        const phasesMatch = mechanicsContent.match(/phases:\s*\[([\s\S]*?)\]/);
        if (phasesMatch) {
          mechanics.phases = (phasesMatch[1].match(/atHp:/g) || []).length;
        }
      }
      
      // Check for abilities
      if (mechanicsContent.includes('abilities:')) {
        const abilitiesMatch = mechanicsContent.match(/abilities:\s*{([\s\S]*?)^    \}/m);
        if (abilitiesMatch) {
          mechanics.abilities = (abilitiesMatch[1].match(/\w+:\s*{/g) || [])
            .map(a => a.replace(/:\s*{/, '').trim());
        }
      }
      
      // Movement type
      const moveMatch = mechanicsContent.match(/movementType:\s*['"]([^'"]+)['"]/);
      if (moveMatch) mechanics.movementType = moveMatch[1];
    }
    
    return mechanics;
  }
  
  extractDisplay(content) {
    const display = {};
    const displayMatch = content.match(/display:\s*{([\s\S]*?)^  \}/m);
    
    if (displayMatch) {
      const displayContent = displayMatch[1];
      
      display.key = this.extractValue(displayContent, 'key');
      display.color = this.extractValue(displayContent, 'color');
      display.rarity = this.extractValue(displayContent, 'rarity');
      display.category = this.extractValue(displayContent, 'category');
    }
    
    return display;
  }
  
  extractKeys(content, section) {
    const keys = [];
    const sectionMatch = content.match(new RegExp(`${section}:\\s*{([^}]*)}`));
    
    if (sectionMatch) {
      const matches = sectionMatch[1].match(/\w+:\s*['"][^'"]+['"]/g);
      if (matches) {
        matches.forEach(match => {
          const keyMatch = match.match(/(\w+):\s*['"]([^'"]+)['"]/);
          if (keyMatch) {
            keys.push(`${keyMatch[1]}: ${keyMatch[2]}`);
          }
        });
      }
    }
    
    return keys;
  }
  
  extractTags(content) {
    const tagsMatch = content.match(/tags:\s*\[([^\]]*)\]/);
    
    if (tagsMatch) {
      return tagsMatch[1]
        .split(',')
        .map(tag => tag.trim().replace(/['"]/g, ''))
        .filter(tag => tag.length > 0);
    }
    
    return [];
  }
  
  categorizeEntities() {
    for (const [id, blueprint] of this.allBlueprints) {
      const tags = blueprint.tags || [];
      
      if (blueprint.type === 'boss') {
        // Check if it's actually a mini-boss based on stats or tags
        if (tags.includes('miniboss') || blueprint.stats.hp < 800) {
          blueprint.category = 'miniboss';
          this.miniBosses.push(blueprint);
        } else {
          blueprint.category = 'boss';
          this.bosses.push(blueprint);
        }
      } else if (blueprint.type === 'enemy') {
        if (tags.includes('unique') || tags.includes('named')) {
          blueprint.category = 'unique';
          this.uniqueEnemies.push(blueprint);
        } else if (tags.includes('elite') || tags.includes('miniboss')) {
          blueprint.category = 'miniboss';
          this.miniBosses.push(blueprint);
        } else {
          blueprint.category = 'regular';
          this.regularEnemies.push(blueprint);
        }
      }
    }
  }
  
  async exportResults() {
    const buildDir = path.join(projectRoot, 'build');
    
    // Ensure build directory exists
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }
    
    // Prepare data for export
    const catalog = {
      metadata: {
        generated: new Date().toISOString(),
        version: '0.2.0',
        totalEntities: this.allBlueprints.size,
        counts: {
          bosses: this.bosses.length,
          miniBosses: this.miniBosses.length,
          uniqueEnemies: this.uniqueEnemies.length,
          regularEnemies: this.regularEnemies.length
        }
      },
      bosses: this.bosses.map(b => this.formatEntity(b)),
      miniBosses: this.miniBosses.map(b => this.formatEntity(b)),
      uniqueEnemies: this.uniqueEnemies.map(b => this.formatEntity(b)),
      regularEnemies: this.regularEnemies.map(b => this.formatEntity(b))
    };
    
    // Export JSON
    const jsonPath = path.join(buildDir, 'entity_catalog.json');
    fs.writeFileSync(jsonPath, JSON.stringify(catalog, null, 2));
    console.log(`✅ JSON exported to: ${jsonPath}`);
    
    // Export CSV
    const csvPath = path.join(buildDir, 'entity_catalog.csv');
    await this.exportCSV(csvPath, catalog);
    console.log(`✅ CSV exported to: ${csvPath}`);
  }
  
  formatEntity(blueprint) {
    return {
      id: blueprint.id,
      category: blueprint.category,
      displayKey: blueprint.display?.key || blueprint.id,
      hp: blueprint.stats?.hp || 0,
      damage: blueprint.stats?.damage || 0,
      speed: blueprint.stats?.speed || 0,
      armor: blueprint.stats?.armor || 0,
      xp: blueprint.stats?.xp || 0,
      phases: blueprint.mechanics?.phases || 0,
      abilities: blueprint.mechanics?.abilities || [],
      movementType: blueprint.mechanics?.movementType || 'default',
      rarity: blueprint.display?.rarity || 'common',
      color: blueprint.display?.color || '#FFFFFF',
      tags: blueprint.tags || [],
      vfxCount: blueprint.vfx?.length || 0,
      sfxCount: blueprint.sfx?.length || 0,
      source: blueprint.source,
      legacy: blueprint.legacy || false,
      filePath: blueprint.filePath
    };
  }
  
  async exportCSV(filePath, catalog) {
    const headers = [
      'ID', 'Category', 'Display Key', 'HP', 'Damage', 'Speed', 'Armor', 'XP',
      'Phases', 'Abilities', 'Movement', 'Rarity', 'Tags', 'Source', 'Legacy'
    ];
    
    const rows = [];
    
    // Add all entities
    const allEntities = [
      ...catalog.bosses,
      ...catalog.miniBosses,
      ...catalog.uniqueEnemies,
      ...catalog.regularEnemies
    ];
    
    for (const entity of allEntities) {
      rows.push([
        entity.id,
        entity.category,
        entity.displayKey,
        entity.hp,
        entity.damage,
        entity.speed,
        entity.armor,
        entity.xp,
        entity.phases,
        entity.abilities.join(';'),
        entity.movementType,
        entity.rarity,
        entity.tags.join(';'),
        entity.source,
        entity.legacy ? 'Y' : 'N'
      ]);
    }
    
    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    fs.writeFileSync(filePath, csvContent);
  }
  
  printSummary() {
    console.log('\n📊 Entity Catalog Summary:');
    console.log('━'.repeat(40));
    console.log(`Total Entities: ${this.allBlueprints.size}`);
    console.log(`  🎯 Bosses: ${this.bosses.length}`);
    console.log(`  ⚔️  Mini-Bosses: ${this.miniBosses.length}`);
    console.log(`  ⭐ Unique Enemies: ${this.uniqueEnemies.length}`);
    console.log(`  👾 Regular Enemies: ${this.regularEnemies.length}`);
    console.log('━'.repeat(40));
    
    // List bosses
    if (this.bosses.length > 0) {
      console.log('\n🎯 Main Bosses:');
      this.bosses.forEach(b => {
        console.log(`  - ${b.id} (HP: ${b.stats?.hp || '?'}, Phases: ${b.mechanics?.phases || 0})`);
      });
    }
    
    // List mini-bosses
    if (this.miniBosses.length > 0) {
      console.log('\n⚔️  Mini-Bosses:');
      this.miniBosses.forEach(b => {
        console.log(`  - ${b.id} (HP: ${b.stats?.hp || '?'})`);
      });
    }
    
    // List unique enemies
    if (this.uniqueEnemies.length > 0) {
      console.log('\n⭐ Unique Enemies:');
      this.uniqueEnemies.forEach(b => {
        console.log(`  - ${b.id} (Tags: ${b.tags?.join(', ') || 'none'})`);
      });
    }
    
    // Warnings
    const needsTagging = [];
    
    for (const [id, blueprint] of this.allBlueprints) {
      if (!blueprint.tags || blueprint.tags.length === 0) {
        needsTagging.push(id);
      }
    }
    
    if (needsTagging.length > 0) {
      console.log('\n⚠️  Entities missing tags:');
      needsTagging.forEach(id => console.log(`  - ${id}`));
    }
  }
}

// === MAIN EXECUTION ===

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║     Entity Catalog Dump Utility        ║');
  console.log('║     Version 1.0.0                      ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const scanner = new EntityScanner();
  
  try {
    await scanner.scan();
    console.log('\n✅ Entity catalog generation complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { EntityScanner };