#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function fixI18n() {
  console.log('🔧 Fixing missing i18n translations...\n');
  
  // Read the i18n report
  const reportPath = path.join(projectRoot, 'build', 'i18n_report.json');
  if (!fs.existsSync(reportPath)) {
    console.error('❌ i18n_report.json not found. Please run enhanced audit first.');
    process.exit(1);
  }
  
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  
  // Group missing translations by locale
  const missingByLocale = {};
  for (const missing of report.missingTranslations) {
    if (!missingByLocale[missing.locale]) {
      missingByLocale[missing.locale] = [];
    }
    missingByLocale[missing.locale].push(missing);
  }
  
  for (const [locale, missingKeys] of Object.entries(missingByLocale)) {
    await addMissingKeysToLocale(locale, missingKeys);
  }
  
  console.log('\n✅ I18n fix completed! Run audit again to verify.');
}

async function addMissingKeysToLocale(locale, missingKeys) {
  const i18nPath = path.join(projectRoot, 'data', 'i18n', `${locale}.json`);
  
  let translations = {};
  if (fs.existsSync(i18nPath)) {
    translations = JSON.parse(fs.readFileSync(i18nPath, 'utf8'));
  }
  
  let addedCount = 0;
  
  for (const missing of missingKeys) {
    const keyPath = missing.key.split('.');
    let current = translations;
    
    // Navigate/create nested structure
    for (let i = 0; i < keyPath.length - 1; i++) {
      const segment = keyPath[i];
      if (!current[segment]) {
        current[segment] = {};
      }
      current = current[segment];
    }
    
    // Add the missing key if it doesn't exist
    const finalKey = keyPath[keyPath.length - 1];
    if (!current[finalKey]) {
      current[finalKey] = missing.suggested;
      addedCount++;
      console.log(`✅ Added ${locale}: ${missing.key} = "${missing.suggested}"`);
    }
  }
  
  // Write back to file with proper formatting
  const sortedTranslations = sortNestedObject(translations);
  await fs.promises.writeFile(i18nPath, JSON.stringify(sortedTranslations, null, 2));
  
  console.log(`📝 Updated ${i18nPath} (${addedCount} new keys)`);
}

function sortNestedObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj = {};
  
  for (const key of sortedKeys) {
    sortedObj[key] = sortNestedObject(obj[key]);
  }
  
  return sortedObj;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixI18n().catch(console.error);
}