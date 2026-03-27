#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Missing translations from the report
const missingTranslations = {
  cs: {
    "enemy.fungal_parasite": {
      name: "Houbový parazit",
      desc: "Vysává zdraví a při smrti vypouští spory"
    },
    "enemy.support_bacteria": {
      name: "Podpůrná bakterie",
      desc: "Léčí okolní nepřátele v dosahu"
    },
    "elite.artillery_fungus": {
      name: "Elitní dělostřelecká houba",
      desc: "Elitní houba střílející explozivní spory na velkou vzdálenost"
    },
    "elite.micro_shooter": {
      name: "Elitní mikro střelec",
      desc: "Elitní verze mikro střelce s vylepšenou rychlostí střelby"
    },
    "elite.speed_virus": {
      name: "Elitní rychlý virus",
      desc: "Extrémně rychlý elitní virus se schopností přeskakování"
    },
    "elite.tank_cell": {
      name: "Elitní tanková buňka",
      desc: "Silně opancéřovaná elitní buňka s regenerujícím štítem"
    },
    "unique.golden_cell": {
      name: "Zlatá buňka",
      desc: "Vzácná zlatá buňka poskytující velké odměny"
    },
    "unique.rainbow_virus": {
      name: "Duhový virus",
      desc: "Mystický virus měnící barvy s jedinečnými schopnostmi"
    },
    "projectile.cytotoxin_enhanced": {
      name: "Vylepšený cytotoxin",
      desc: "Zesílený jedovatý projektil s větším dosahem"
    },
    "projectile.cytotoxin_small": {
      name: "Malý cytotoxin",
      desc: "Menší verze cytotoxinu pro rychlé útoky"
    },
    "projectile.player_basic": {
      name: "Základní projektil hráče",
      desc: "Standardní projektil vystřelovaný hráčem"
    }
  },
  en: {
    "elite.micro_shooter": {
      name: "Elite Micro Shooter",
      desc: "Elite version of micro shooter with enhanced fire rate"
    },
    "projectile.cytotoxin_enhanced": {
      name: "Enhanced Cytotoxin",
      desc: "Powered-up toxic projectile with greater range"
    },
    "projectile.cytotoxin_small": {
      name: "Small Cytotoxin",
      desc: "Smaller cytotoxin variant for rapid attacks"
    },
    "projectile.player_basic": {
      name: "Player Basic Projectile",
      desc: "Standard projectile fired by the player"
    }
  }
};

// Load existing translation files
const csPath = path.join(__dirname, '..', 'data', 'i18n', 'cs.json');
const enPath = path.join(__dirname, '..', 'data', 'i18n', 'en.json');

const csData = JSON.parse(fs.readFileSync(csPath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Function to add translations
function addTranslations(data, missing) {
  let added = 0;
  
  for (const [key, translations] of Object.entries(missing)) {
    const [category, ...rest] = key.split('.');
    const entityId = rest.join('.');
    
    if (!data[category]) {
      data[category] = {};
    }
    
    if (!data[category][entityId]) {
      data[category][entityId] = {};
      console.log(`  Adding new entity: ${category}.${entityId}`);
    }
    
    if (!data[category][entityId].name) {
      data[category][entityId].name = translations.name;
      added++;
      console.log(`    Added name: ${translations.name}`);
    }
    
    if (!data[category][entityId].desc) {
      data[category][entityId].desc = translations.desc;
      added++;
      console.log(`    Added desc: ${translations.desc}`);
    }
  }
  
  return added;
}

console.log('Fixing missing i18n translations...\n');

// Add Czech translations
console.log('Adding Czech translations:');
const csAdded = addTranslations(csData, missingTranslations.cs);

// Add English translations  
console.log('\nAdding English translations:');
const enAdded = addTranslations(enData, missingTranslations.en);

// Sort keys for consistent formatting
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      sorted[key] = sortObject(obj[key]);
    } else {
      sorted[key] = obj[key];
    }
  }
  return sorted;
}

// Save updated files
fs.writeFileSync(csPath, JSON.stringify(sortObject(csData), null, 2) + '\n', 'utf8');
fs.writeFileSync(enPath, JSON.stringify(sortObject(enData), null, 2) + '\n', 'utf8');

console.log(`\n✅ Fixed ${csAdded} Czech translations`);
console.log(`✅ Fixed ${enAdded} English translations`);
console.log('\nTranslation files updated successfully!');