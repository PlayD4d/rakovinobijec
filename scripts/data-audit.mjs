#!/usr/bin/env node

// Data Audit Script - validates data/ folder integrity
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

class DataAuditor {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.fixed = [];
    this.validatedCount = 0;
    this.duplicateIds = new Map();
    this.allIds = new Set();
    this.references = new Map();
    this.i18nKeys = new Set();
    this.missingI18n = new Set();
    this.mixinSuggestions = [];
    this.registry = new Map();
    
    // Initialize AJV
    this.ajv = new Ajv({ 
      allErrors: true, 
      verbose: true,
      strictSchema: false 
    });
    
    this.schemas = new Map();
    this.report = {
      timestamp: new Date().toISOString(),
      summary: {},
      errors: [],
      warnings: [],
      fixed: [],
      duplicates: [],
      missingReferences: [],
      i18nIssues: [],
      mixinSuggestions: [],
      coverage: {}
    };
  }
  
  async audit() {
    console.log('🔍 Starting data audit...\n');
    
    try {
      await this.loadSchemas();
      await this.validateStructure();
      await this.validateNamingConventions();
      await this.validateReferences();
      await this.validateI18n();
      await this.detectDuplicates();
      await this.generateMixinSuggestions();
      await this.buildRegistry();
      await this.generateReport();
      
      return this.getExitCode();
    } catch (error) {
      this.addError('AUDIT_FAILED', `Audit failed: ${error.message}`);
      await this.generateReport();
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
    console.log('\\n📁 Validating folder structure...');
    
    const expectedFolders = [
      'blueprints/boss',
      'blueprints/enemy', 
      'blueprints/miniboss',
      'blueprints/unique',
      'blueprints/powerup',
      'blueprints/drop',
      'blueprints/projectile',
      'blueprints/lootTable',
      'blueprints/spawn',
      'schemas',
      'registries',
      'i18n'
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
    console.log('\\n🏷️  Validating naming conventions...');
    
    const blueprintDir = path.join(dataRoot, 'blueprints');
    
    for (const category of ['boss', 'enemy', 'miniboss', 'unique', 'powerup', 'drop', 'projectile']) {
      const categoryDir = path.join(blueprintDir, category);
      
      if (!fs.existsSync(categoryDir)) continue;
      
      const files = fs.readdirSync(categoryDir).filter(f => f.endsWith('.json5') || f.endsWith('.js'));
      
      for (const file of files) {
        const filePath = path.join(categoryDir, file);
        
        // Check file extension
        if (!file.endsWith('.json5')) {
          this.addWarning('WRONG_EXTENSION', `File should use .json5 extension: ${file}`, filePath);
        }
        
        // Validate file content
        await this.validateBlueprintFile(filePath, category);
      }
    }
  }
  
  async validateBlueprintFile(filePath, expectedCategory) {
    try {
      let content;
      const fileName = path.basename(filePath);
      
      if (filePath.endsWith('.js')) {
        // Skip JS files for now - they should be converted to JSON5
        this.addWarning('LEGACY_JS_FILE', `JS file should be converted to JSON5: ${fileName}`, filePath);
        return;
      } else {
        // Try to parse as JSON5/JSON
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
      
      // Check type consistency  
      if (content.type !== expectedCategory) {
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
      
      console.log(`✅ Validated: ${content.id}`);
      
    } catch (error) {
      this.addError('FILE_PARSE_ERROR', `Cannot parse ${fileName}: ${error.message}`, filePath);
    }
  }
  
  collectReferences(content, filePath) {
    const refs = [];
    
    // Collect baseType references
    if (content.baseType) {
      refs.push(content.baseType);
    }
    
    // Collect VFX references
    if (content.vfx) {
      Object.values(content.vfx).forEach(vfxRef => refs.push(vfxRef));
    }
    
    // Collect SFX references
    if (content.sfx) {
      Object.values(content.sfx).forEach(sfxRef => refs.push(sfxRef));
    }
    
    // Store references for validation
    this.references.set(filePath, refs);
  }
  
  collectI18nKeys(content) {
    if (content.display) {
      if (content.display.key) {
        this.i18nKeys.add(content.display.key);
      }
      if (content.display.descKey) {
        this.i18nKeys.add(content.display.descKey);
      }
    }
  }
  
  async validateReferences() {
    console.log('\\n🔗 Validating references...');
    
    // TODO: Load VFX/SFX registries and validate references
    // For now, just collect orphaned references
    
    for (const [filePath, refs] of this.references) {
      for (const ref of refs) {
        if (ref.startsWith('vfx.') || ref.startsWith('sfx.')) {
          // Skip VFX/SFX validation for now
          continue;
        }
        
        if (!this.allIds.has(ref)) {
          this.addWarning('ORPHANED_REFERENCE', `Reference '${ref}' not found`, filePath);
        }
      }
    }
  }
  
  async validateI18n() {
    console.log('\\n🌐 Validating i18n...');
    
    const i18nDir = path.join(dataRoot, 'i18n');
    const locales = ['cs', 'en'];
    const translations = new Map();
    
    // Load existing translations
    for (const locale of locales) {
      const localePath = path.join(i18nDir, `${locale}.json`);
      if (fs.existsSync(localePath)) {
        try {
          const content = JSON.parse(fs.readFileSync(localePath, 'utf8'));
          translations.set(locale, new Set(this.flattenKeys(content)));
          console.log(`✅ Loaded ${locale} translations (${translations.get(locale).size} keys)`);
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
    console.log('\\n🔍 Detecting duplicates...');
    
    for (const [id, files] of this.duplicateIds) {
      if (files.length > 1) {
        this.addError('DUPLICATE_ID', `Duplicate ID '${id}' found in: ${files.join(', ')}`);
        this.report.duplicates.push({ id, files });
      }
    }
    
    console.log(`Found ${this.duplicateIds.size} duplicate IDs`);
  }
  
  async generateMixinSuggestions() {
    console.log('\\n🧩 Analyzing for mixin opportunities...');
    
    // Analyze common patterns in blueprints
    const patterns = new Map();
    
    // TODO: Implement pattern detection for mixins
    // This would analyze common stat blocks, ability patterns, etc.
    
    console.log(`Generated ${this.mixinSuggestions.length} mixin suggestions`);
  }
  
  async buildRegistry() {
    console.log('\\n📋 Building registry...');
    
    const registryData = {
      version: "1.0.0",
      generated: new Date().toISOString(),
      totalEntities: this.registry.size,
      index: {}
    };
    
    // Convert Map to object for JSON serialization
    for (const [id, filePath] of this.registry) {
      registryData.index[id] = path.relative(dataRoot, filePath);
    }
    
    // Write registry
    const registryPath = path.join(dataRoot, 'registries', 'index.json');
    await fs.promises.mkdir(path.dirname(registryPath), { recursive: true });
    await fs.promises.writeFile(registryPath, JSON.stringify(registryData, null, 2));
    
    console.log(`✅ Built registry with ${this.registry.size} entities`);
  }
  
  async generateReport() {
    this.report.summary = {
      validatedFiles: this.validatedCount,
      totalErrors: this.errors.length,
      totalWarnings: this.warnings.length,
      totalFixed: this.fixed.length,
      duplicateIds: this.duplicateIds.size,
      orphanedReferences: this.references.size,
      missingTranslations: this.missingI18n.size,
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
    
    // Write report
    const reportPath = path.join(projectRoot, 'build', 'data_audit_report.json');
    await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.promises.writeFile(reportPath, JSON.stringify(this.report, null, 2));
    
    console.log(`\\n📊 Audit complete! Report saved to: ${reportPath}`);
    this.printSummary();
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
      coverage: ((this.i18nKeys.size - this.missingI18n.size) / this.i18nKeys.size * 100).toFixed(1) + '%'
    };
  }
  
  printSummary() {
    console.log('\\n' + '='.repeat(50));
    console.log('📊 DATA AUDIT SUMMARY');
    console.log('='.repeat(50));
    console.log(`📁 Files validated: ${this.validatedCount}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`🔧 Fixed: ${this.fixed.length}`);
    console.log(`📋 Registry entries: ${this.registry.size}`);
    console.log(`🌐 Missing translations: ${this.missingI18n.size}`);
    console.log('='.repeat(50));
    
    if (this.errors.length > 0) {
      console.log('\\n❌ ERRORS:');
      this.errors.slice(0, 10).forEach(error => {
        console.log(`  - [${error.code}] ${error.message}`);
      });
      if (this.errors.length > 10) {
        console.log(`  ... and ${this.errors.length - 10} more errors`);
      }
    }
    
    if (this.warnings.length > 0) {
      console.log('\\n⚠️  WARNINGS:');
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

// Main execution
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║        Data Audit & Validation         ║');
  console.log('║            Version 1.0.0               ║');
  console.log('╚════════════════════════════════════════╝\\n');
  
  const auditor = new DataAuditor();
  
  try {
    const exitCode = await auditor.audit();
    process.exit(exitCode);
  } catch (error) {
    console.error('\\n❌ Fatal error:', error.message);
    process.exit(2);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DataAuditor };