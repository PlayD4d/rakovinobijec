#!/usr/bin/env node

// Enhanced Data Audit Script - validates data/ folder integrity with i18n focus
// Exit codes: 0 = success, 1 = warnings, 2 = errors

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import JSON5 from 'json5';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dataRoot = path.join(projectRoot, 'data');

class EnhancedDataAuditor {
  constructor(options = {}) {
    this.options = {
      strictI18n: options.strictI18n || false,
      fixI18nPlaceholders: options.fixI18nPlaceholders || false,
      generateMarkdown: options.generateMarkdown || false,
      ...options
    };
    
    this.errors = [];
    this.warnings = [];
    this.fixed = [];
    this.validatedCount = 0;
    this.duplicateIds = new Map();
    this.allIds = new Set();
    this.references = new Map();
    this.i18nKeys = new Set();
    this.missingI18n = new Set();
    this.todoTranslations = new Set();
    this.registry = new Map();
    
    this.ajv = new Ajv({ 
      allErrors: true, 
      verbose: true,
      strictSchema: false 
    });
    
    this.schemas = new Map();
    this.report = {
      timestamp: new Date().toISOString(),
      options: this.options,
      summary: {},
      errors: [],
      warnings: [],
      fixed: [],
      duplicates: [],
      missingReferences: [],
      i18nIssues: [],
      coverage: {}
    };
  }
  
  async audit() {
    console.log('🔍 Starting enhanced data audit...\n');
    
    try {
      await this.loadSchemas();
      await this.validateStructure();
      await this.validateNamingConventions();
      await this.validateReferences();
      await this.validateRegistryRefs();
      await this.validateAssetCoverage();
      await this.validateI18n();
      await this.detectDuplicates();
      await this.buildRegistry();
      await this.generateReports();
      
      return this.getExitCode();
    } catch (error) {
      this.addError('AUDIT_FAILED', `Audit failed: ${error.message}`);
      await this.generateReports();
      return 2;
    }
  }
  
  async loadSchemas() {
    const schemaDir = path.join(dataRoot, 'schemas');
    
    if (!fs.existsSync(schemaDir)) {
      this.addError('MISSING_SCHEMAS', 'schemas/ directory not found');
      return;
    }
    
    const schemaFiles = ['blueprint.schema.json', 'lootTable.schema.json', 'spawnTable.schema.json'];
    
    for (const file of schemaFiles) {
      const schemaPath = path.join(schemaDir, file);
      if (fs.existsSync(schemaPath)) {
        try {
          const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
          const schemaName = file.replace('.schema.json', '');
          this.schemas.set(schemaName, this.ajv.compile(schema));
          console.log(`✅ Loaded schema: ${schemaName}`);
        } catch (error) {
          this.addError('SCHEMA_LOAD_ERROR', `Failed to load ${file}: ${error.message}`);
        }
      } else {
        this.addError('MISSING_SCHEMA', `Required schema not found: ${file}`);
      }
    }
  }
  
  async validateStructure() {
    console.log('\n📁 Validating folder structure...');
    
    const expectedFolders = [
      'blueprints/boss',
      'blueprints/enemy',
      'blueprints/elite', 
      'blueprints/miniboss',
      'blueprints/unique',
      'blueprints/powerup',
      'blueprints/items',  // PR7: items místo drop/loot
      'blueprints/projectile',
      'blueprints/spawn',
      'blueprints/system',  // PR7: system konfigurace
      'blueprints/templates',  // PR7: template blueprinty
      'schemas',
      'registries',
      'i18n',
      'config'  // PR7: config složka
    ];
    
    for (const folder of expectedFolders) {
      const folderPath = path.join(dataRoot, folder);
      if (!fs.existsSync(folderPath)) {
        this.addError('MISSING_FOLDER', `Required folder missing: ${folder}`);
      } else {
        console.log(`✅ Found: ${folder}`);
      }
    }
  }
  
  async validateNamingConventions() {
    console.log('\n🏷️  Validating naming conventions...');
    
    const blueprintDir = path.join(dataRoot, 'blueprints');
    
    for (const category of ['boss', 'enemy', 'elite', 'miniboss', 'unique', 'powerup', 'projectile', 'items']) {
      const categoryDir = path.join(blueprintDir, category);
      
      if (!fs.existsSync(categoryDir)) continue;
      
      const files = fs.readdirSync(categoryDir).filter(f => f.endsWith('.json5') || f.endsWith('.js'));
      
      for (const file of files) {
        const filePath = path.join(categoryDir, file);
        await this.validateBlueprintFile(filePath, category);
      }
    }
  }
  
  async validateBlueprintFile(filePath, expectedCategory) {
    try {
      let content;
      const fileName = path.basename(filePath);
      
      if (filePath.endsWith('.js')) {
        this.addWarning('LEGACY_JS_FILE', `JS file should be converted to JSON5: ${fileName}`, filePath);
        return;
      } else {
        try {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          content = JSON5.parse(fileContent);
        } catch (parseError) {
          this.addError('JSON_PARSE_ERROR', `Cannot parse JSON5: ${parseError.message}`, filePath);
          return;
        }
      }
      
      this.validatedCount++;
      
      // Validate ID format
      if (!content.id) {
        this.addError('MISSING_ID', `Blueprint missing ID: ${fileName}`, filePath);
        return;
      }
      
      // Check ID naming convention
      const idPattern = /^[a-z]+\.[a-z_]+$/;
      if (!idPattern.test(content.id)) {
        this.addError('INVALID_ID_FORMAT', `ID '${content.id}' doesn't follow type.slug convention`, filePath);
      }
      
      // Check if ID matches file name
      const expectedFileName = content.id.replace(/\./g, '_') + '.json5';
      if (fileName !== expectedFileName && !fileName.endsWith('.js')) {
        this.addWarning('FILENAME_MISMATCH', `File '${fileName}' should be '${expectedFileName}'`, filePath);
      }
      
      // Check type consistency (PR7: elite/unique now use type:"enemy" with meta.category)
      if (expectedCategory === 'elite' || expectedCategory === 'unique') {
        // Elite and unique entities should have type:"enemy" with meta.category
        if (content.type !== 'enemy') {
          this.addError('TYPE_MISMATCH', `Type '${content.type}' should be 'enemy' for ${expectedCategory}`, filePath);
        }
        if (!content.meta || content.meta.category !== expectedCategory) {
          this.addWarning('MISSING_META_CATEGORY', `${expectedCategory} entity should have meta.category:'${expectedCategory}'`, filePath);
        }
      } else if (content.type !== expectedCategory) {
        this.addError('TYPE_MISMATCH', `Type '${content.type}' doesn't match folder '${expectedCategory}'`, filePath);
      }
      
      // Track IDs for duplicate detection
      if (this.allIds.has(content.id)) {
        this.duplicateIds.set(content.id, (this.duplicateIds.get(content.id) || []).concat(filePath));
      } else {
        this.allIds.add(content.id);
        this.registry.set(content.id, filePath);
      }
      
      // Validate against schema
      if (this.schemas.has('blueprint')) {
        const validate = this.schemas.get('blueprint');
        if (!validate(content)) {
          validate.errors.forEach(error => {
            this.addError('SCHEMA_VIOLATION', `${fileName}: ${error.instancePath} ${error.message}`, filePath);
          });
        }
      }
      
      // Collect references
      this.collectReferences(content, filePath);
      
      // Collect i18n keys
      this.collectI18nKeys(content);
      
      // Validate display templates if fixing placeholders
      if (this.options.fixI18nPlaceholders) {
        this.validateDisplayTemplates(content, filePath);
      }
      
      console.log(`✅ Validated: ${content.id}`);
      
    } catch (error) {
      this.addError('FILE_PARSE_ERROR', `Cannot parse ${fileName}: ${error.message}`, filePath);
    }
  }
  
  collectReferences(content, filePath) {
    const refs = [];
    
    if (content.baseType) refs.push(content.baseType);
    if (content.vfx) Object.values(content.vfx).forEach(vfxRef => refs.push(vfxRef));
    if (content.sfx) Object.values(content.sfx).forEach(sfxRef => refs.push(sfxRef));
    
    this.references.set(filePath, refs);
  }
  
  collectI18nKeys(content) {
    if (content.display) {
      if (content.display.key) this.i18nKeys.add(content.display.key);
      if (content.display.descKey) this.i18nKeys.add(content.display.descKey);
      if (content.display.srKey) this.i18nKeys.add(content.display.srKey);
    }
  }
  
  validateDisplayTemplates(content, filePath) {
    if (content.display && content.display.templates) {
      for (const [templateKey, template] of Object.entries(content.display.templates)) {
        // Check for orphaned placeholders
        const placeholders = template.match(/\{\{[^}]+\}\}/g) || [];
        for (const placeholder of placeholders) {
          // Validate placeholder format {{path|formatter}}
          const match = placeholder.match(/\{\{([^|]+)(\|([^}]+))?\}\}/);
          if (!match) {
            this.addWarning('INVALID_PLACEHOLDER', `Invalid placeholder format: ${placeholder} in ${templateKey}`, filePath);
          }
        }
      }
    }
  }
  
  async validateReferences() {
    console.log('\n🔗 Validating references...');
    
    for (const [filePath, refs] of this.references) {
      for (const ref of refs) {
        if (ref.startsWith('vfx.') || ref.startsWith('sfx.')) {
          continue; // Skip VFX/SFX validation - handled in validateRegistryRefs
        }
        
        if (!this.allIds.has(ref)) {
          this.addWarning('ORPHANED_REFERENCE', `Reference '${ref}' not found`, filePath);
        }
      }
    }
  }

  async validateRegistryRefs() {
    console.log('\n📋 Validating registry references...');
    
    // Load VFX/SFX registries if they exist
    const vfxRegistry = await this.loadRegistry('VFXRegistry');
    const sfxRegistry = await this.loadRegistry('SFXRegistry');
    
    // Validate VFX/SFX references in blueprints
    for (const [filePath, refs] of this.references) {
      for (const ref of refs) {
        if (ref.startsWith('vfx.') && vfxRegistry) {
          if (!vfxRegistry.has(ref)) {
            this.addError('VFX_REFERENCE_NOT_FOUND', `VFX reference '${ref}' not found in VFXRegistry`, filePath);
          }
        }
        if (ref.startsWith('sfx.') && sfxRegistry) {
          if (!sfxRegistry.has(ref)) {
            this.addError('SFX_REFERENCE_NOT_FOUND', `SFX reference '${ref}' not found in SFXRegistry`, filePath);
          }
        }
      }
    }
    
    // Validate spawn table and loot table references
    await this.validateSpawnTableRefs();
    await this.validateLootTableRefs();
  }

  async loadRegistry(registryName) {
    // Try different registry locations based on name
    let registryPath;
    if (registryName === 'VFXRegistry') {
      registryPath = path.join(projectRoot, 'js', 'core', 'vfx', 'VFXRegistry.js');
    } else if (registryName === 'SFXRegistry') {
      registryPath = path.join(projectRoot, 'js', 'core', 'sfx', 'SFXRegistry.js');
    } else {
      registryPath = path.join(projectRoot, 'js', 'registries', `${registryName}.js`);
    }
    
    if (!fs.existsSync(registryPath)) {
      this.addWarning('REGISTRY_NOT_FOUND', `${registryName} not found at ${registryPath}`);
      return null;
    }

    try {
      // Simple parsing of registry exports (assumes VFXRegistry = { key: config } format)
      const content = fs.readFileSync(registryPath, 'utf8');
      const keys = new Set();
      
      // Extract keys from registry format (looking for this.register calls)
      const registerMatches = content.match(/this\.register\(['"]([^'"]+)['"]/g) || [];
      registerMatches.forEach(match => {
        const key = match.match(/['"]([^'"]+)['"]/)[1];
        keys.add(key);
      });
      
      console.log(`✅ Loaded ${registryName}: ${keys.size} entries`);
      return keys;
    } catch (error) {
      this.addError('REGISTRY_LOAD_ERROR', `Failed to load ${registryName}: ${error.message}`);
      return null;
    }
  }

  async validateSpawnTableRefs() {
    const spawnDir = path.join(dataRoot, 'blueprints', 'spawn');
    if (!fs.existsSync(spawnDir)) return;

    const spawnFiles = fs.readdirSync(spawnDir).filter(f => f.endsWith('.json5'));
    
    for (const file of spawnFiles) {
      const filePath = path.join(spawnDir, file);
      try {
        const content = JSON5.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Validate enemy references in spawn waves
        if (content.enemyWaves) {
          content.enemyWaves.forEach((wave, index) => {
            if (wave.enemyId && !this.allIds.has(wave.enemyId)) {
              this.addError('SPAWN_ENEMY_NOT_FOUND', 
                `Enemy '${wave.enemyId}' in wave ${index} not found`, filePath);
            }
          });
        }
        
        // Validate elite window references
        if (content.eliteWindows) {
          content.eliteWindows.forEach((window, index) => {
            if (window.enemyId && !this.allIds.has(window.enemyId)) {
              this.addError('ELITE_ENEMY_NOT_FOUND', 
                `Elite enemy '${window.enemyId}' in window ${index} not found`, filePath);
            }
          });
        }
        
        // Validate unique spawn references
        if (content.uniqueSpawns) {
          content.uniqueSpawns.forEach((spawn, index) => {
            if (spawn.enemyId && !this.allIds.has(spawn.enemyId)) {
              this.addError('UNIQUE_ENEMY_NOT_FOUND', 
                `Unique enemy '${spawn.enemyId}' in spawn ${index} not found`, filePath);
            }
          });
        }
        
        // Validate boss references
        if (content.bossConditions && content.bossConditions.bossId) {
          if (!this.allIds.has(content.bossConditions.bossId)) {
            this.addError('BOSS_NOT_FOUND', 
              `Boss '${content.bossConditions.bossId}' not found`, filePath);
          }
        }
        
      } catch (error) {
        this.addError('SPAWN_TABLE_PARSE_ERROR', `Cannot parse spawn table ${file}: ${error.message}`, filePath);
      }
    }
  }

  async validateLootTableRefs() {
    const lootDir = path.join(dataRoot, 'blueprints', 'loot');
    if (!fs.existsSync(lootDir)) return;

    const lootFiles = fs.readdirSync(lootDir).filter(f => f.endsWith('.json5'));
    
    for (const file of lootFiles) {
      const filePath = path.join(lootDir, file);
      try {
        const content = JSON5.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (content.items) {
          Object.keys(content.items).forEach(itemId => {
            if (!this.allIds.has(itemId)) {
              this.addError('LOOT_ITEM_NOT_FOUND', 
                `Loot item '${itemId}' not found`, filePath);
            }
          });
        }
        
      } catch (error) {
        this.addError('LOOT_TABLE_PARSE_ERROR', `Cannot parse loot table ${file}: ${error.message}`, filePath);
      }
    }
  }

  async validateAssetCoverage() {
    console.log('\n🎨 Validating asset coverage...');
    
    // Load preload manifest if it exists
    const preloadPath = path.join(projectRoot, 'js', 'scenes', 'PreloadScene.js');
    if (!fs.existsSync(preloadPath)) {
      this.addWarning('PRELOAD_SCENE_NOT_FOUND', 'PreloadScene.js not found - cannot validate asset coverage');
      return;
    }
    
    try {
      const preloadContent = fs.readFileSync(preloadPath, 'utf8');
      const assetKeys = new Set();
      
      // Extract asset keys from preload calls (this.load.image('key', 'path'))
      const imageMatches = preloadContent.match(/\.load\.image\s*\(\s*['"]([^'"]+)['"]/g) || [];
      const audioMatches = preloadContent.match(/\.load\.audio\s*\(\s*['"]([^'"]+)['"]/g) || [];
      
      imageMatches.forEach(match => {
        const key = match.match(/['"]([^'"]+)['"]/)[1];
        assetKeys.add(key);
      });
      
      audioMatches.forEach(match => {
        const key = match.match(/['"]([^'"]+)['"]/)[1];
        assetKeys.add(key);
      });
      
      console.log(`📦 Found ${assetKeys.size} preloaded assets`);
      
      // Load VFX/SFX registries and check coverage
      const vfxRegistry = await this.loadRegistry('VFXRegistry');
      const sfxRegistry = await this.loadRegistry('SFXRegistry');
      
      if (vfxRegistry) {
        await this.validateAssetRegistryCoverage(vfxRegistry, assetKeys, 'VFX');
      }
      
      if (sfxRegistry) {
        await this.validateAssetRegistryCoverage(sfxRegistry, assetKeys, 'SFX');
      }
      
    } catch (error) {
      this.addError('ASSET_COVERAGE_ERROR', `Failed to validate asset coverage: ${error.message}`);
    }
  }

  async validateAssetRegistryCoverage(registry, preloadedAssets, registryType) {
    const registryPath = path.join(projectRoot, 'js', 'registries', `${registryType}Registry.js`);
    
    try {
      const registryContent = fs.readFileSync(registryPath, 'utf8');
      const missingAssets = [];
      
      // Extract asset references from registry (texture: 'key', sound: 'key')
      const assetRefs = registryContent.match(/(?:texture|sound):\s*['"]([^'"]+)['"]/g) || [];
      
      assetRefs.forEach(ref => {
        const asset = ref.match(/['"]([^'"]+)['"]/)[1];
        if (!preloadedAssets.has(asset)) {
          missingAssets.push(asset);
        }
      });
      
      if (missingAssets.length > 0) {
        this.addError('MISSING_ASSETS', 
          `${registryType} registry references ${missingAssets.length} assets not in PreloadScene: ${missingAssets.join(', ')}`);
      } else {
        console.log(`✅ ${registryType} asset coverage: 100%`);
      }
      
    } catch (error) {
      this.addError('ASSET_COVERAGE_CHECK_ERROR', 
        `Failed to check ${registryType} asset coverage: ${error.message}`);
    }
  }
  
  async validateI18n() {
    console.log('\n🌐 Validating i18n...');
    
    const i18nDir = path.join(dataRoot, 'i18n');
    const locales = ['cs', 'en'];
    const translations = new Map();
    
    // Load existing translations
    for (const locale of locales) {
      const localePath = path.join(i18nDir, `${locale}.json`);
      if (fs.existsSync(localePath)) {
        try {
          const content = JSON.parse(fs.readFileSync(localePath, 'utf8'));
          const flatKeys = this.flattenKeys(content);
          translations.set(locale, new Set(flatKeys));
          
          // Check for TODO translations
          flatKeys.forEach(key => {
            const value = this.getNestedValue(content, key);
            if (typeof value === 'string' && value.includes('TODO')) {
              this.todoTranslations.add(`${locale}:${key}`);
            }
          });
          
          console.log(`✅ Loaded ${locale} translations (${flatKeys.length} keys)`);
        } catch (error) {
          this.addError('I18N_PARSE_ERROR', `Cannot parse ${locale}.json: ${error.message}`);
        }
      } else {
        this.addError('MISSING_I18N', `Missing translation file: ${locale}.json`);
        translations.set(locale, new Set());
      }
    }
    
    // Check for missing translations
    for (const key of this.i18nKeys) {
      for (const locale of locales) {
        const localeTranslations = translations.get(locale) || new Set();
        if (!localeTranslations.has(key)) {
          this.missingI18n.add(`${locale}:${key}`);
          this.addWarning('MISSING_TRANSLATION', `Missing ${locale} translation for key: ${key}`);
        }
      }
    }
    
    // In strict mode, TODO translations are errors
    if (this.options.strictI18n && this.todoTranslations.size > 0) {
      for (const todoKey of this.todoTranslations) {
        const [locale, key] = todoKey.split(':', 2);
        this.addError('TODO_TRANSLATION', `TODO translation found for ${locale}:${key}`);
      }
    }
  }
  
  getNestedValue(obj, key) {
    return key.split('.').reduce((current, segment) => current?.[segment], obj);
  }
  
  flattenKeys(obj, prefix = '') {
    const keys = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        keys.push(...this.flattenKeys(value, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }
  
  async detectDuplicates() {
    console.log('\n🔍 Detecting duplicates...');
    
    for (const [id, files] of this.duplicateIds) {
      if (files.length > 1) {
        this.addError('DUPLICATE_ID', `Duplicate ID '${id}' found in: ${files.join(', ')}`);
      }
    }
    
    console.log(`Found ${this.duplicateIds.size} duplicate IDs`);
  }
  
  async buildRegistry() {
    console.log('\n📋 Building registry...');
    
    const registryData = {
      version: "1.0.0",
      generated: new Date().toISOString(),
      totalEntities: this.registry.size,
      index: {}
    };
    
    for (const [id, filePath] of this.registry) {
      registryData.index[id] = path.relative(dataRoot, filePath);
    }
    
    // DISABLED: Registry is now built by rebuild-registry-index.mjs
    // const registryPath = path.join(dataRoot, 'registries', 'index.json');
    // await fs.promises.mkdir(path.dirname(registryPath), { recursive: true });
    // await fs.promises.writeFile(registryPath, JSON.stringify(registryData, null, 2));
    
    console.log(`✅ Built registry with ${this.registry.size} entities`);
  }
  
  async generateReports() {
    // Prepare report data
    this.report.summary = {
      validatedFiles: this.validatedCount,
      totalErrors: this.errors.length,
      totalWarnings: this.warnings.length,
      totalFixed: this.fixed.length,
      duplicateIds: this.duplicateIds.size,
      missingTranslations: this.missingI18n.size,
      todoTranslations: this.todoTranslations.size,
      registryEntries: this.registry.size
    };
    
    this.report.errors = this.errors;
    this.report.warnings = this.warnings;
    this.report.fixed = this.fixed;
    this.report.coverage = {
      totalEntities: this.registry.size,
      byType: this.getTypeStats(),
      i18nCoverage: this.getI18nCoverage()
    };
    
    // Write JSON reports
    const buildDir = path.join(projectRoot, 'build');
    await fs.promises.mkdir(buildDir, { recursive: true });
    
    const reportPath = path.join(buildDir, 'data_audit_report.json');
    await fs.promises.writeFile(reportPath, JSON.stringify(this.report, null, 2));
    
    // Generate i18n specific report
    await this.generateI18nReport();
    
    // Generate markdown reports if requested
    if (this.options.generateMarkdown) {
      await this.generateMarkdownReports();
    }
    
    console.log(`\n📊 Audit complete! Reports saved to: ${buildDir}`);
    this.printSummary();
  }
  
  async generateI18nReport() {
    const i18nReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalKeys: this.i18nKeys.size,
        missingKeys: this.missingI18n.size,
        todoKeys: this.todoTranslations.size,
        coverage: this.getI18nCoverage()
      },
      missingTranslations: [],
      todoTranslations: Array.from(this.todoTranslations)
    };

    // Process missing translations
    for (const missing of this.missingI18n) {
      const [locale, key] = missing.split(':', 2);
      const entityId = this.getEntityIdFromKey(key);
      const entityType = entityId ? entityId.split('.')[0] : 'unknown';
      
      i18nReport.missingTranslations.push({
        key,
        locale,
        entityId,
        entityType,
        suggested: this.generateTranslationSuggestion(key, locale)
      });
    }

    const i18nReportPath = path.join(projectRoot, 'build', 'i18n_report.json');
    await fs.promises.writeFile(i18nReportPath, JSON.stringify(i18nReport, null, 2));

    // Generate markdown i18n report
    await this.generateI18nMarkdownReport(i18nReport);
  }

  async generateI18nMarkdownReport(i18nReport) {
    let markdown = `# I18n Translation Report\n\n`;
    markdown += `Generated: ${i18nReport.timestamp}\n\n`;
    markdown += `## Summary\n`;
    markdown += `- Total i18n keys used: ${i18nReport.summary.totalKeys}\n`;
    markdown += `- Missing translations: ${i18nReport.summary.missingKeys}\n`;
    markdown += `- TODO translations: ${i18nReport.summary.todoKeys}\n`;
    markdown += `- Coverage: ${i18nReport.summary.coverage.coverage}\n\n`;

    if (i18nReport.missingTranslations.length > 0) {
      markdown += `## Missing Translations\n\n`;
      markdown += `| Key | Locale | Entity | Type | Suggested |\n`;
      markdown += `|-----|--------|--------|------|-----------|\n`;
      
      for (const missing of i18nReport.missingTranslations) {
        markdown += `| ${missing.key} | ${missing.locale} | ${missing.entityId} | ${missing.entityType} | ${missing.suggested} |\n`;
      }
    }

    if (i18nReport.todoTranslations.length > 0) {
      markdown += `\n## TODO Translations\n\n`;
      markdown += `The following translations are marked as TODO and need to be completed:\n\n`;
      for (const todo of i18nReport.todoTranslations) {
        const [locale, key] = todo.split(':', 2);
        markdown += `- **${locale}**: ${key}\n`;
      }
    }

    const markdownPath = path.join(projectRoot, 'build', 'i18n_report.md');
    await fs.promises.writeFile(markdownPath, markdown);
  }

  async generateMarkdownReports() {
    let mainMarkdown = `# Data Audit Report\n\n`;
    mainMarkdown += `Generated: ${this.report.timestamp}\n\n`;
    mainMarkdown += `## Summary\n`;
    mainMarkdown += `- Files validated: ${this.report.summary.validatedFiles}\n`;
    mainMarkdown += `- Errors: ${this.report.summary.totalErrors}\n`;
    mainMarkdown += `- Warnings: ${this.report.summary.totalWarnings}\n`;
    mainMarkdown += `- Registry entries: ${this.report.summary.registryEntries}\n\n`;

    if (this.errors.length > 0) {
      mainMarkdown += `## Errors\n\n`;
      for (const error of this.errors) {
        mainMarkdown += `- **[${error.code}]** ${error.message}\n`;
      }
      mainMarkdown += `\n`;
    }

    if (this.warnings.length > 0) {
      mainMarkdown += `## Warnings\n\n`;
      for (const warning of this.warnings.slice(0, 20)) {
        mainMarkdown += `- **[${warning.code}]** ${warning.message}\n`;
      }
      if (this.warnings.length > 20) {
        mainMarkdown += `... and ${this.warnings.length - 20} more warnings\n`;
      }
    }

    const mainReportPath = path.join(projectRoot, 'build', 'data_audit_report.md');
    await fs.promises.writeFile(mainReportPath, mainMarkdown);
  }
  
  getEntityIdFromKey(key) {
    const parts = key.split('.');
    if (parts.length >= 2) {
      return `${parts[0]}.${parts[1]}`;
    }
    return null;
  }

  generateTranslationSuggestion(key, locale) {
    return locale === 'cs' ? 'TODO – doplnit překlad' : 'TODO – add translation';
  }
  
  getTypeStats() {
    const stats = {};
    for (const [id] of this.registry) {
      const type = id.split('.')[0];
      stats[type] = (stats[type] || 0) + 1;
    }
    return stats;
  }
  
  getI18nCoverage() {
    return {
      totalKeys: this.i18nKeys.size,
      missingKeys: this.missingI18n.size,
      todoKeys: this.todoTranslations.size,
      coverage: this.i18nKeys.size > 0 ? 
        ((this.i18nKeys.size - this.missingI18n.size) / this.i18nKeys.size * 100).toFixed(1) + '%' 
        : '0%'
    };
  }
  
  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 ENHANCED DATA AUDIT SUMMARY');
    console.log('='.repeat(50));
    console.log(`📁 Files validated: ${this.validatedCount}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`🔧 Fixed: ${this.fixed.length}`);
    console.log(`📋 Registry entries: ${this.registry.size}`);
    console.log(`🌐 Missing translations: ${this.missingI18n.size}`);
    console.log(`📝 TODO translations: ${this.todoTranslations.size}`);
    console.log('='.repeat(50));
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.slice(0, 10).forEach(error => {
        console.log(`  - [${error.code}] ${error.message}`);
      });
      if (this.errors.length > 10) {
        console.log(`  ... and ${this.errors.length - 10} more errors`);
      }
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.slice(0, 5).forEach(warning => {
        console.log(`  - [${warning.code}] ${warning.message}`);
      });
      if (this.warnings.length > 5) {
        console.log(`  ... and ${this.warnings.length - 5} more warnings`);
      }
    }
  }
  
  getExitCode() {
    if (this.errors.length > 0) return 2;
    if (this.warnings.length > 0) return 1;
    return 0;
  }
  
  addError(code, message, filePath = null) {
    this.errors.push({ code, message, filePath, timestamp: new Date().toISOString() });
  }
  
  addWarning(code, message, filePath = null) {
    this.warnings.push({ code, message, filePath, timestamp: new Date().toISOString() });
  }
  
  addFixed(code, message, filePath = null) {
    this.fixed.push({ code, message, filePath, timestamp: new Date().toISOString() });
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  if (args.includes('--strict-i18n')) {
    options.strictI18n = true;
  }
  
  if (args.includes('--fix-i18n-placeholders')) {
    options.fixI18nPlaceholders = true;
  }
  
  if (args.includes('--report-md')) {
    options.generateMarkdown = true;
  }
  
  return options;
}

// Main execution
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║     Enhanced Data Audit & Validation   ║');
  console.log('║              Version 2.0.0             ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const options = parseArgs();
  const auditor = new EnhancedDataAuditor(options);
  
  try {
    const exitCode = await auditor.audit();
    process.exit(exitCode);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(2);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { EnhancedDataAuditor };