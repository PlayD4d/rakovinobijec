#!/usr/bin/env node

// Blueprint Converter - converts JS blueprints to JSON5 and moves to new structure

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

class BlueprintConverter {
  constructor() {
    this.converted = [];
    this.errors = [];
  }
  
  async convert() {
    console.log('🔄 Converting blueprints to new structure...\n');
    
    await this.convertBosses();
    await this.convertEnemies();
    await this.convertPowerups();
    await this.convertDrops();
    await this.convertProjectiles();
    await this.convertLootTables();
    await this.convertSpawnTables();
    
    this.printSummary();
  }
  
  async convertBosses() {
    console.log('👑 Converting bosses...');
    
    // New blueprint bosses
    const newBossDir = path.join(projectRoot, 'js/data/blueprints/boss');
    const targetDir = path.join(projectRoot, 'data/blueprints/boss');
    
    await this.convertDirectory(newBossDir, targetDir, 'boss');
    
    // Legacy bosses
    const legacyBossDir = path.join(projectRoot, 'js/data/bosses');
    if (fs.existsSync(legacyBossDir)) {
      const files = fs.readdirSync(legacyBossDir).filter(f => f.endsWith('.js'));
      for (const file of files) {
        await this.convertFile(path.join(legacyBossDir, file), targetDir, 'boss');
      }
    }
  }
  
  async convertEnemies() {
    console.log('👾 Converting enemies...');
    
    const sourceDir = path.join(projectRoot, 'js/data/blueprints/enemy');
    const targetDir = path.join(projectRoot, 'data/blueprints');
    
    if (!fs.existsSync(sourceDir)) return;
    
    const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
      const filePath = path.join(sourceDir, file);
      const blueprint = await this.loadBlueprint(filePath);
      
      if (!blueprint) continue;
      
      // Determine target folder based on ID or tags
      let targetFolder = 'enemy';
      
      if (blueprint.id && blueprint.id.startsWith('unique.')) {
        targetFolder = 'unique';
      } else if (blueprint.tags && blueprint.tags.includes('miniboss')) {
        targetFolder = 'miniboss';
      } else if (blueprint.tags && (blueprint.tags.includes('elite') && blueprint.stats?.hp > 100)) {
        targetFolder = 'miniboss';
      }
      
      const specificTargetDir = path.join(targetDir, targetFolder);
      await this.convertFile(filePath, specificTargetDir, targetFolder);
    }
  }
  
  async convertPowerups() {
    console.log('⚡ Converting powerups...');
    
    const sourceDir = path.join(projectRoot, 'js/data/blueprints/powerup');
    const targetDir = path.join(projectRoot, 'data/blueprints/powerup');
    
    await this.convertDirectory(sourceDir, targetDir, 'powerup');
    
    // Also convert legacy powerups
    const legacyDir = path.join(projectRoot, 'js/data/powerups');
    if (fs.existsSync(legacyDir)) {
      const files = fs.readdirSync(legacyDir).filter(f => f.endsWith('.js'));
      for (const file of files) {
        await this.convertFile(path.join(legacyDir, file), targetDir, 'powerup');
      }
    }
  }
  
  async convertDrops() {
    console.log('💎 Converting drops...');
    
    const sourceDir = path.join(projectRoot, 'js/data/blueprints/drop');
    const targetDir = path.join(projectRoot, 'data/blueprints/drop');
    
    await this.convertDirectory(sourceDir, targetDir, 'drop');
    
    // Legacy drops
    const legacyDir = path.join(projectRoot, 'js/data/drops');
    if (fs.existsSync(legacyDir)) {
      const files = fs.readdirSync(legacyDir).filter(f => f.endsWith('.js'));
      for (const file of files) {
        await this.convertFile(path.join(legacyDir, file), targetDir, 'drop');
      }
    }
  }
  
  async convertProjectiles() {
    console.log('🚀 Converting projectiles...');
    
    const sourceDir = path.join(projectRoot, 'js/data/blueprints/projectile');
    const targetDir = path.join(projectRoot, 'data/blueprints/projectile');
    
    await this.convertDirectory(sourceDir, targetDir, 'projectile');
    
    // Legacy projectiles
    const legacyDir = path.join(projectRoot, 'js/data/projectiles');
    if (fs.existsSync(legacyDir)) {
      const files = fs.readdirSync(legacyDir).filter(f => f.endsWith('.js'));
      for (const file of files) {
        await this.convertFile(path.join(legacyDir, file), targetDir, 'projectile');
      }
    }
  }
  
  async convertLootTables() {
    console.log('🎲 Converting loot tables...');
    
    const sourceDir = path.join(projectRoot, 'js/data/blueprints/lootTable');
    const targetDir = path.join(projectRoot, 'data/blueprints/lootTable');
    
    await this.convertDirectory(sourceDir, targetDir, 'lootTable');
    
    // Convert loot blueprints
    const lootDir = path.join(projectRoot, 'js/data/blueprints/loot');
    if (fs.existsSync(lootDir)) {
      const files = fs.readdirSync(lootDir).filter(f => f.endsWith('.js'));
      for (const file of files) {
        await this.convertFile(path.join(lootDir, file), targetDir, 'lootTable');
      }
    }
  }
  
  async convertSpawnTables() {
    console.log('📊 Converting spawn tables...');
    
    const sourceDir = path.join(projectRoot, 'js/config/spawnTables');
    const targetDir = path.join(projectRoot, 'data/blueprints/spawn');
    
    await this.convertDirectory(sourceDir, targetDir, 'spawn');
  }
  
  async convertDirectory(sourceDir, targetDir, type) {
    if (!fs.existsSync(sourceDir)) {
      console.log(`⚠️  Source directory not found: ${sourceDir}`);
      return;
    }
    
    await fs.promises.mkdir(targetDir, { recursive: true });
    
    const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      await this.convertFile(sourcePath, targetDir, type);
    }
  }
  
  async convertFile(sourcePath, targetDir, type) {
    try {
      const blueprint = await this.loadBlueprint(sourcePath);
      if (!blueprint) return;
      
      // Fix type if missing or incorrect
      if (!blueprint.type) {
        blueprint.type = type;
      }
      
      // Generate ID if missing
      if (!blueprint.id) {
        const fileName = path.basename(sourcePath, '.js');
        blueprint.id = `${type}.${fileName}`;
      }
      
      // Ensure naming convention
      const expectedFileName = blueprint.id.replace(/\\./g, '_') + '.json5';
      const targetPath = path.join(targetDir, expectedFileName);
      
      // Convert to JSON5 format
      const json5Content = this.toJSON5(blueprint);
      
      await fs.promises.mkdir(targetDir, { recursive: true });
      await fs.promises.writeFile(targetPath, json5Content);
      
      this.converted.push({
        source: sourcePath,
        target: targetPath,
        id: blueprint.id,
        type: blueprint.type
      });
      
      console.log(`✅ Converted: ${blueprint.id} -> ${expectedFileName}`);
      
    } catch (error) {
      this.errors.push({
        file: sourcePath,
        error: error.message
      });
      console.log(`❌ Error converting ${sourcePath}: ${error.message}`);
    }
  }
  
  async loadBlueprint(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Find export default line
      const exportMatch = content.match(/export\s+default\s+{/);
      if (!exportMatch) {
        throw new Error('Cannot find export default');
      }
      
      // Extract the object part (everything from { to the end, minus any trailing semicolon)
      const startIndex = content.indexOf('{', exportMatch.index);
      let objectContent = content.substring(startIndex);
      
      // Remove trailing semicolon and whitespace
      objectContent = objectContent.replace(/;\\s*$/, '').trim();
      
      // Use dynamic import for safer evaluation
      const tempFile = `/tmp/temp_blueprint_${Date.now()}.mjs`;
      await fs.promises.writeFile(tempFile, `export default ${objectContent}`);
      
      try {
        const module = await import(tempFile);
        await fs.promises.unlink(tempFile);
        return module.default;
      } catch (importError) {
        // Fallback to eval (less safe but works for simple objects)
        try {
          const blueprint = eval(`(${objectContent})`);
          return blueprint;
        } catch (evalError) {
          throw new Error(`Cannot evaluate object: ${evalError.message}`);
        }
      }
      
    } catch (error) {
      throw new Error(`Failed to parse blueprint: ${error.message}`);
    }
  }
  
  toJSON5(obj) {
    // Simple JSON5 formatter with comments
    let json = JSON.stringify(obj, null, 2);
    
    // Add helpful comments
    json = json.replace(/^{/, `{\n  // Blueprint: ${obj.id || 'unknown'}`);
    
    return json;
  }
  
  printSummary() {
    console.log('\\n' + '='.repeat(50));
    console.log('📊 CONVERSION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Successfully converted: ${this.converted.length} files`);
    console.log(`❌ Errors: ${this.errors.length} files`);
    
    if (this.errors.length > 0) {
      console.log('\\nErrors:');
      this.errors.forEach(error => {
        console.log(`  - ${error.file}: ${error.error}`);
      });
    }
    
    console.log('\\nConverted by type:');
    const byType = {};
    this.converted.forEach(item => {
      byType[item.type] = (byType[item.type] || 0) + 1;
    });
    
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} files`);
    });
  }
}

// Main execution
async function main() {
  const converter = new BlueprintConverter();
  await converter.convert();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { BlueprintConverter };