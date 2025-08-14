#!/usr/bin/env node

/**
 * Script pro kontrolu, že všechny entity mají správné vizuální nastavení
 * PR7 kompatibilita - zajišťuje, že všechny blueprinty mají viditelné textury
 */

const fs = require('fs');
const path = require('path');
const JSON5 = require('json5');

const projectRoot = process.cwd();
const dataRoot = path.join(projectRoot, 'data');

class VisualChecker {
  constructor() {
    this.issues = [];
    this.validEntities = [];
  }

  checkBlueprint(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const blueprint = JSON5.parse(content);
      
      const relativePath = path.relative(dataRoot, filePath);
      
      // Check for visual properties
      const hasVisuals = blueprint.visuals || false;
      const hasSize = blueprint.stats?.size || blueprint.visuals?.size || false;
      const hasColor = blueprint.display?.color || blueprint.visuals?.tint || false;
      
      if (!hasVisuals) {
        this.issues.push({
          file: relativePath,
          id: blueprint.id,
          issue: 'Missing visuals section'
        });
      }
      
      if (!hasSize) {
        this.issues.push({
          file: relativePath,
          id: blueprint.id,
          issue: 'Missing size definition'
        });
      }
      
      if (!hasColor) {
        this.issues.push({
          file: relativePath,
          id: blueprint.id,
          issue: 'Missing color/tint definition'
        });
      }
      
      if (hasVisuals && hasSize && hasColor) {
        this.validEntities.push({
          id: blueprint.id,
          textureKey: blueprint.visuals?.textureKey || blueprint.id,
          tint: blueprint.visuals?.tint || blueprint.display?.color,
          size: blueprint.visuals?.size || { w: blueprint.stats?.size, h: blueprint.stats?.size }
        });
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  }

  async checkAllEntities() {
    console.log('🔍 Checking entity visuals for PR7 compliance...\n');
    
    const categories = ['enemy', 'boss', 'elite', 'unique', 'miniboss'];
    
    for (const category of categories) {
      const categoryPath = path.join(dataRoot, 'blueprints', category);
      
      if (!fs.existsSync(categoryPath)) {
        continue;
      }
      
      const files = fs.readdirSync(categoryPath)
        .filter(f => f.endsWith('.json5'));
      
      console.log(`📁 Checking ${category} (${files.length} files)...`);
      
      for (const file of files) {
        const filePath = path.join(categoryPath, file);
        this.checkBlueprint(filePath);
      }
    }
    
    // Report results
    console.log('\n==================================================');
    console.log('📊 VISUAL CHECK SUMMARY');
    console.log('==================================================');
    
    if (this.issues.length === 0) {
      console.log('✅ All entities have proper visual configuration!');
      console.log(`   ${this.validEntities.length} entities validated`);
    } else {
      console.log(`⚠️  Found ${this.issues.length} issues:\n`);
      
      for (const issue of this.issues) {
        console.log(`   ${issue.id}: ${issue.issue}`);
        console.log(`   File: ${issue.file}`);
        console.log('');
      }
    }
    
    // Show valid entities
    if (this.validEntities.length > 0) {
      console.log('\n✅ Valid entities with visuals:');
      for (const entity of this.validEntities) {
        const color = typeof entity.tint === 'number' 
          ? '0x' + entity.tint.toString(16).toUpperCase()
          : entity.tint;
        console.log(`   ${entity.id}: ${color} (${entity.size.w || entity.size}x${entity.size.h || entity.size})`);
      }
    }
    
    console.log('\n==================================================');
    console.log('ℹ️  Note: GameScene will generate placeholder textures');
    console.log('   for any missing sprites automatically (PR7 compliant)');
    console.log('==================================================');
    
    return this.issues.length === 0;
  }
}

// Run the checker
async function main() {
  const checker = new VisualChecker();
  const success = await checker.checkAllEntities();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = VisualChecker;