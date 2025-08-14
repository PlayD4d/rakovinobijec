#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Translation dictionaries
const translations = {
  cs: {
    // Bosses
    'boss.onkogen_prime.name': 'Onkogen Prime',
    'boss.onkogen_prime.desc': 'Vylepšená verze onkogenu s pokročilými mutačními schopnostmi',
    'boss.radiation_core.name': 'Radiační jádro',
    'boss.radiation_core.desc': 'Koncentrovaný zdroj radiace způsobující masivní poškození',
    
    // Enemies
    'enemy.aberrant_cell.name': 'Aberantní buňka',
    'enemy.aberrant_cell.desc': 'Elitní buňka s narušenou strukturou a vysokou odolností',
    'enemy.acidic_blob.name': 'Kyselý útvar',
    'enemy.acidic_blob.desc': 'Korozivní masa způsobující chemické poškození',
    'enemy.metastasis_runner.name': 'Metastázní běžec',
    'enemy.metastasis_runner.desc': 'Rychlá buňka šířící rakovinu na velké vzdálenosti',
    'enemy.micro_shooter.name': 'Mikro střelec',
    'enemy.micro_shooter.desc': 'Malá buňka útočící přesnými projektily na dálku',
    'enemy.necrotic_cell.name': 'Nekrotická buňka',
    'enemy.necrotic_cell.desc': 'Odumírající buňka s toxickým dotykem',
    'enemy.shielding_helper.name': 'Ochranný pomocník',
    'enemy.shielding_helper.desc': 'Podpůrná buňka poskytující štíty okolním nepřátelům',
    'enemy.viral_swarm.name': 'Virový roj',
    'enemy.viral_swarm.desc': 'Rychlý virový organismus útočící ve skupinách',
    'enemy.viral_swarm_alpha.name': 'Virový roj Alfa',
    'enemy.viral_swarm_alpha.desc': 'Vylepšená verze virového roje s vyšší rychlostí',
    
    // Unique enemies
    'unique.chromoblast.name': 'Chromoblast',
    'unique.chromoblast.desc': 'Časově manipulativní entita s leukemickými výbuchy',
    'unique.mutagen_splicer.name': 'Mutagenní štěpič',
    'unique.mutagen_splicer.desc': 'Adaptivní nepřítel měnící své schopnosti během boje',
    'unique.necrocyte_sentinel.name': 'Nekrocyt strážce',
    'unique.necrocyte_sentinel.desc': 'Nekrotický strážce s aurou rozkladu a vyvolávačské schopnosti',
    'unique.phage_overlord.name': 'Fágový overlord',
    'unique.phage_overlord.desc': 'Dominantní entita šířící virové infekce projektily',
    'unique.radiomorph_titan.name': 'Radiomorfní titan',
    'unique.radiomorph_titan.desc': 'Obří radiační mutant s fázovým posouváním',
    
    // Powerups
    'powerup.chemo_reservoir.name': 'Chemoterapeutický rezervoár',
    'powerup.chemo_reservoir.desc': 'Zásobník léčivých chemikálií pro trvalé účinky',
    'powerup.metabolic_haste.name': 'Metabolický spěch',
    'powerup.metabolic_haste.desc': 'Zrychluje metabolické procesy pro vyšší rychlost',
    
    // Drops
    'drop.adrenal_surge.name': 'Adrenalínový nával',
    'drop.adrenal_surge.desc': 'Poskytuje dočasné zvýšení všech schopností',
    'drop.protein_cache.name': 'Proteinová zásoba',
    'drop.protein_cache.desc': 'Koncentrovaný protein poskytující velké množství XP',
    'drop.xp_small.name': 'Malé XP',
    'drop.xp_small.desc': 'Základní jednotka zkušenosti pro rozvoj',
    
    // Projectiles
    'projectile.cytotoxin.name': 'Cytotoxin',
    'projectile.cytotoxin.desc': 'Jedovatý projektil poškozující buněčnou strukturu',
    
    // Screen reader
    'sr.boss.chemorezistence': 'Chemoresistentní boss odolný vůči léčbě s více fázemi útoku',
    'sr.boss.genova_mutace': 'Geneticky mutující boss měnící DNA struktuře během boje',
    'sr.boss.karcinogenni_kral': 'Mocný karcinogenní král vládnoucí rakovinovým buňkám',
    'sr.boss.onkogen': 'Onkogenní mutace způsobující změny v genetickém kódu',
    'sr.boss.radiation': 'Radiační syndrome způsobující kontinuální poškození zářením',
    'sr.powerup.damage_boost': 'Zvýšení poškození všech útoků pro efektivnější boj',
    'sr.powerup.flamethrower': 'Radioterapeutické paprsky cílené na nejbližší nepřátele',
    'sr.powerup.piercing_arrows': 'Cisplatinové projektily pronikající skrz více nepřátel',
    'sr.powerup.shield': 'Imunitní systémový štít absorbující příchozí poškození',
    'sr.projectile.basic': 'Základní projektil pro standardní útočné manévry'
  },
  
  en: {
    // Bosses  
    'boss.onkogen_prime.name': 'Oncogene Prime',
    'boss.onkogen_prime.desc': 'Enhanced oncogene version with advanced mutation abilities',
    'boss.radiation_core.name': 'Radiation Core',
    'boss.radiation_core.desc': 'Concentrated radiation source causing massive damage',
    
    // Enemies
    'enemy.aberrant_cell.name': 'Aberrant Cell',
    'enemy.aberrant_cell.desc': 'Elite cell with disrupted structure and high resistance',
    'enemy.acidic_blob.name': 'Acidic Blob',
    'enemy.acidic_blob.desc': 'Corrosive mass dealing chemical damage',
    'enemy.metastasis_runner.name': 'Metastasis Runner',
    'enemy.metastasis_runner.desc': 'Fast cell spreading cancer over long distances',
    'enemy.micro_shooter.name': 'Micro Shooter',
    'enemy.micro_shooter.desc': 'Small cell attacking with precise ranged projectiles',
    'enemy.necrotic_cell.name': 'Necrotic Cell',
    'enemy.necrotic_cell.desc': 'Dying cell with toxic touch',
    'enemy.shielding_helper.name': 'Shielding Helper',
    'enemy.shielding_helper.desc': 'Support cell providing shields to nearby enemies',
    'enemy.viral_swarm.name': 'Viral Swarm',
    'enemy.viral_swarm.desc': 'Fast viral organism attacking in groups',
    'enemy.viral_swarm_alpha.name': 'Viral Swarm Alpha',
    'enemy.viral_swarm_alpha.desc': 'Enhanced viral swarm variant with higher speed',
    
    // Unique enemies
    'unique.chromoblast.name': 'Chromoblast',
    'unique.chromoblast.desc': 'Time-manipulating entity with leukemic bursts',
    'unique.mutagen_splicer.name': 'Mutagen Splicer',
    'unique.mutagen_splicer.desc': 'Adaptive enemy changing abilities during combat',
    'unique.necrocyte_sentinel.name': 'Necrocyte Sentinel',
    'unique.necrocyte_sentinel.desc': 'Necrotic guardian with decay aura and summoning abilities',
    'unique.phage_overlord.name': 'Phage Overlord',
    'unique.phage_overlord.desc': 'Dominant entity spreading viral infections through projectiles',
    'unique.radiomorph_titan.name': 'Radiomorph Titan',
    'unique.radiomorph_titan.desc': 'Massive radiation mutant with phase shifting',
    
    // Powerups
    'powerup.chemo_reservoir.name': 'Chemo Reservoir',
    'powerup.chemo_reservoir.desc': 'Chemical reservoir providing sustained treatment effects',
    'powerup.metabolic_haste.name': 'Metabolic Haste',
    'powerup.metabolic_haste.desc': 'Accelerates metabolic processes for increased speed',
    
    // Drops
    'drop.adrenal_surge.name': 'Adrenaline Surge',
    'drop.adrenal_surge.desc': 'Provides temporary boost to all abilities',
    'drop.protein_cache.name': 'Protein Cache',
    'drop.protein_cache.desc': 'Concentrated protein providing large XP amount',
    'drop.xp_small.name': 'Small XP',
    'drop.xp_small.desc': 'Basic experience unit for development',
    
    // Projectiles
    'projectile.cytotoxin.name': 'Cytotoxin',
    'projectile.cytotoxin.desc': 'Poisonous projectile damaging cellular structure',
    
    // Screen reader
    'sr.boss.chemorezistence': 'Chemoresistant boss resistant to treatment with multiple attack phases',
    'sr.boss.genova_mutace': 'Genetically mutating boss altering DNA structure during combat',
    'sr.boss.karcinogenni_kral': 'Powerful carcinogenic king ruling over cancer cells',
    'sr.boss.onkogen': 'Oncogenic mutation causing changes in genetic code',
    'sr.boss.radiation': 'Radiation syndrome causing continuous radiation damage',
    'sr.powerup.damage_boost': 'Damage boost enhancing all attacks for more effective combat',
    'sr.powerup.flamethrower': 'Radiotherapy beams targeting closest enemies',
    'sr.powerup.piercing_arrows': 'Cisplatin projectiles piercing through multiple enemies',
    'sr.powerup.shield': 'Immune system shield absorbing incoming damage',
    'sr.projectile.basic': 'Basic projectile for standard attack maneuvers'
  }
};

async function replaceTranslations() {
  console.log('🔧 Replacing TODO translations with real text...\n');
  
  for (const [locale, translationMap] of Object.entries(translations)) {
    const i18nPath = path.join(projectRoot, 'data', 'i18n', `${locale}.json`);
    
    if (!fs.existsSync(i18nPath)) {
      console.error(`❌ Translation file not found: ${i18nPath}`);
      continue;
    }
    
    let content = JSON.parse(fs.readFileSync(i18nPath, 'utf8'));
    let replacedCount = 0;
    
    // Replace TODOs with real translations
    for (const [key, translation] of Object.entries(translationMap)) {
      const keyPath = key.split('.');
      let current = content;
      
      // Navigate to the right place in the nested structure
      for (let i = 0; i < keyPath.length - 1; i++) {
        if (current[keyPath[i]]) {
          current = current[keyPath[i]];
        } else {
          console.warn(`⚠️  Path not found for key: ${key}`);
          break;
        }
      }
      
      const finalKey = keyPath[keyPath.length - 1];
      if (current[finalKey] && current[finalKey].startsWith('TODO')) {
        current[finalKey] = translation;
        replacedCount++;
        console.log(`✅ ${locale}: ${key} = "${translation}"`);
      }
    }
    
    // Write back the file
    await fs.promises.writeFile(i18nPath, JSON.stringify(content, null, 2));
    console.log(`📝 Updated ${i18nPath} (${replacedCount} translations replaced)\n`);
  }
  
  console.log('✅ All TODO translations replaced with real text!');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  replaceTranslations().catch(console.error);
}