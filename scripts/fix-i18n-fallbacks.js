#!/usr/bin/env node

/**
 * Script pro přidání chybějících devNameFallback a devDescFallback do blueprintů
 * PR7 kompatibilita - všechny blueprinty musí mít fallbacky pro případ chybějícího překladu
 */

const fs = require('fs');
const path = require('path');
const JSON5 = require('json5');

// Mapování ID na fallback názvy a popisy
const fallbackMap = {
  // Enemy blueprints
  'enemy.aberrant_cell': { name: 'Aberantní buňka', desc: 'Elitní buňka s narušenou strukturou' },
  'enemy.acidic_blob': { name: 'Kyselý blob', desc: 'Nebezpečná kyselá hmota' },
  'enemy.metastasis_runner': { name: 'Metastázový běžec', desc: 'Rychlý nepřítel šířící nákazu' },
  'enemy.micro_shooter': { name: 'Mikro střelec', desc: 'Malý ale přesný střelec' },
  'enemy.micro_shooter_enhanced': { name: 'Vylepšený mikro střelec', desc: 'Posílená verze mikro střelce' },
  'enemy.shielding_helper': { name: 'Štítový pomocník', desc: 'Poskytuje štíty ostatním' },
  'enemy.viral_swarm': { name: 'Virový roj', desc: 'Rychlý roj virových částic' },
  'enemy.viral_swarm_alpha': { name: 'Virový roj alfa', desc: 'Vůdce virového roje' },
  
  // Boss blueprints  
  'boss.onkogen_prime': { name: 'Onkogen Prime', desc: 'Vylepšená verze onkogenu' },
  'boss.radiation_core': { name: 'Radiační jádro', desc: 'Koncentrované radiační jádro' },
  'boss.chemorezistence': { name: 'Chemorezistence', desc: 'Odolný boss vůči chemoterapii' },
  'boss.genova_mutace': { name: 'Genová mutace', desc: 'Zmutovaný genetický boss' },
  'boss.karcinogenni_kral': { name: 'Karcinogenní král', desc: 'Nejvyšší vládce rakovinných buněk' },
  'boss.onkogen': { name: 'Onkogen', desc: 'Základní onkogenní boss' },
  'boss.radiation': { name: 'Radiace', desc: 'Radioaktivní boss' },
  
  // Drop blueprints
  'drop.energy_cell': { name: 'Energetická buňka', desc: 'Obnovuje energii' },
  'drop.heal_orb': { name: 'Regenerační orb', desc: 'Větší léčení' },
  'drop.health_small': { name: 'Malé léčení', desc: 'Malé množství zdraví' },
  'drop.research_point': { name: 'Výzkumný bod', desc: 'Body pro výzkum' },
  'drop.xp_large': { name: 'Velké XP', desc: 'Velké množství zkušeností' },
  'drop.xp_medium': { name: 'Střední XP', desc: 'Střední množství zkušeností' },
  'drop.xp_orb': { name: 'XP orb', desc: 'Základní zkušenostní orb' },
  'drop.adrenal_surge': { name: 'Adrenalínový nával', desc: 'Dočasné posílení' },
  'drop.health': { name: 'Lék', desc: 'Obnovuje zdraví' },
  'drop.metotrexat': { name: 'Metotrexát', desc: 'Speciální lék' },
  'drop.protein_cache': { name: 'Proteinová zásoba', desc: 'Koncentrovaný protein' },
  'drop.xp_small': { name: 'Malé XP', desc: 'Malé množství zkušeností' },
  
  // Projectile blueprints
  'projectile.cytotoxin': { name: 'Cytotoxin', desc: 'Toxický projektil' },
  'proj.basic': { name: 'Základní projektil', desc: 'Obyčejný projektil' },
  
  // Powerup blueprints
  'powerup.chemo_reservoir': { name: 'Chemoterapeutický rezervoár', desc: 'Zásobník chemikálií' },
  'powerup.metabolic_haste': { name: 'Metabolický spěch', desc: 'Zrychluje metabolismus' },
  'powerup.oxidative_burst': { name: 'Oxidativní výbuch', desc: 'Neutrofilní oxidativní poškození v kuželu' },
  'powerup.piercing_arrows': { name: 'Cisplatina', desc: 'Průrazné projektily' },
  'powerup.shield': { name: 'Imunitní štít', desc: 'Regenerující se štít' },
  'powerup.damage_boost': { name: 'Posílení poškození', desc: 'Zvyšuje útočnou sílu' },
  'powerup.xp_magnet': { name: 'XP magnet', desc: 'Přitahuje zkušenostní orby' }
};

function processBlueprint(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const blueprint = JSON5.parse(content);
    
    if (!blueprint.display) {
      console.log(`⚠️ Skipping ${filePath} - no display section`);
      return false;
    }
    
    const fallback = fallbackMap[blueprint.id];
    if (!fallback) {
      console.log(`⚠️ No fallback mapping for ${blueprint.id}`);
      return false;
    }
    
    let modified = false;
    
    // Add devNameFallback if missing
    if (!blueprint.display.devNameFallback) {
      blueprint.display.devNameFallback = fallback.name;
      modified = true;
      console.log(`✅ Added devNameFallback to ${blueprint.id}`);
    }
    
    // Add devDescFallback if missing
    if (!blueprint.display.devDescFallback) {
      blueprint.display.devDescFallback = fallback.desc;
      modified = true;
      console.log(`✅ Added devDescFallback to ${blueprint.id}`);
    }
    
    if (modified) {
      // Write back with proper formatting
      const output = JSON5.stringify(blueprint, null, 2);
      fs.writeFileSync(filePath, output);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  const blueprintDirs = [
    'data/blueprints/enemy',
    'data/blueprints/boss',
    'data/blueprints/drop',
    'data/blueprints/projectile',
    'data/blueprints/powerup'
  ];
  
  let totalFixed = 0;
  
  blueprintDirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️ Directory not found: ${fullPath}`);
      return;
    }
    
    const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.json5'));
    console.log(`\n📁 Processing ${dir} (${files.length} files)`);
    
    files.forEach(file => {
      const filePath = path.join(fullPath, file);
      if (processBlueprint(filePath)) {
        totalFixed++;
      }
    });
  });
  
  console.log(`\n✨ Complete! Fixed ${totalFixed} blueprints`);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { processBlueprint, fallbackMap };