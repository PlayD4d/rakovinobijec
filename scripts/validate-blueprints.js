#!/usr/bin/env node

/**
 * Phase 6: CI blueprint validation script
 * Validuje všechny blueprinty proti VFX/SFX registrům
 * Exit code: 0 = success, 1 = validation errors found
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Mock Phaser objects for Node.js environment
global.Phaser = {
  BlendModes: { ADD: 'add' },
  Math: { Distance: { Between: () => 0 } }
};

console.log('🔍 Blueprint Validation Starting...');

let totalErrors = 0;
let totalBlueprints = 0;

/**
 * Load and validate a single blueprint file
 */
async function validateBlueprint(filepath) {
  try {
    // Dynamically import the blueprint
    const module = await import(filepath);
    const blueprint = module.default;
    
    if (!blueprint || !blueprint.id) {
      console.error(`❌ ${filepath}: Invalid blueprint structure`);
      return 1;
    }

    totalBlueprints++;
    console.log(`📋 Validating: ${blueprint.id}`);

    let errors = 0;

    // Basic structure validation
    if (!blueprint.type) {
      console.error(`  ❌ Missing required field: type`);
      errors++;
    }

    // VFX validation
    if (blueprint.vfx) {
      const vfxErrors = await validateVFXReferences(blueprint.vfx, blueprint.id);
      errors += vfxErrors;
    }

    // SFX validation  
    if (blueprint.sfx) {
      const sfxErrors = await validateSFXReferences(blueprint.sfx, blueprint.id);
      errors += sfxErrors;
    }

    if (errors > 0) {
      console.error(`  ❌ ${errors} errors found in ${blueprint.id}`);
    } else {
      console.log(`  ✅ ${blueprint.id} - OK`);
    }

    return errors;

  } catch (error) {
    console.error(`❌ Failed to load ${filepath}:`, error.message);
    return 1;
  }
}

/**
 * Load VFX registry and validate references
 */
async function validateVFXReferences(vfxSection, blueprintId) {
  try {
    // Load VFX registry
    const vfxRegistryPath = join(projectRoot, 'js/core/vfx/VFXRegistry.js');
    const { vfxRegistry } = await import(vfxRegistryPath);
    
    let errors = 0;

    for (const [event, vfxRef] of Object.entries(vfxSection)) {
      if (typeof vfxRef === 'string') {
        if (!vfxRegistry.has(vfxRef)) {
          console.error(`    ❌ VFX '${vfxRef}' not found in registry (${blueprintId}.vfx.${event})`);
          errors++;
        }
      } else if (Array.isArray(vfxRef)) {
        // Array of effects
        vfxRef.forEach((effect, index) => {
          const effectId = typeof effect === 'string' ? effect : effect.id;
          if (effectId && !vfxRegistry.has(effectId)) {
            console.error(`    ❌ VFX '${effectId}' not found in registry (${blueprintId}.vfx.${event}[${index}])`);
            errors++;
          }
        });
      } else if (vfxRef.id && !vfxRegistry.has(vfxRef.id)) {
        console.error(`    ❌ VFX '${vfxRef.id}' not found in registry (${blueprintId}.vfx.${event})`);
        errors++;
      }
    }

    return errors;
  } catch (error) {
    console.error(`❌ Failed to validate VFX references:`, error.message);
    return 1;
  }
}

/**
 * Load SFX registry and validate references
 */
async function validateSFXReferences(sfxSection, blueprintId) {
  try {
    // Load SFX registry
    const sfxRegistryPath = join(projectRoot, 'js/core/sfx/SFXRegistry.js');
    const { sfxRegistry } = await import(sfxRegistryPath);
    
    let errors = 0;

    for (const [event, sfxRef] of Object.entries(sfxSection)) {
      if (typeof sfxRef === 'string') {
        if (!sfxRegistry.has(sfxRef)) {
          console.error(`    ❌ SFX '${sfxRef}' not found in registry (${blueprintId}.sfx.${event})`);
          errors++;
        }
      } else if (Array.isArray(sfxRef)) {
        // Array of sounds
        sfxRef.forEach((sound, index) => {
          const soundId = typeof sound === 'string' ? sound : sound.id;
          if (soundId && !sfxRegistry.has(soundId)) {
            console.error(`    ❌ SFX '${soundId}' not found in registry (${blueprintId}.sfx.${event}[${index}])`);
            errors++;
          }
        });
      } else if (sfxRef.id && !sfxRegistry.has(sfxRef.id)) {
        console.error(`    ❌ SFX '${sfxRef.id}' not found in registry (${blueprintId}.sfx.${event})`);
        errors++;
      }
    }

    return errors;
  } catch (error) {
    console.error(`❌ Failed to validate SFX references:`, error.message);
    return 1;
  }
}

/**
 * Recursively find all blueprint files
 */
function findBlueprints(dir) {
  const blueprints = [];
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      blueprints.push(...findBlueprints(fullPath));
    } else if (item.endsWith('.js') && !item.includes('.test.')) {
      blueprints.push(fullPath);
    }
  }
  
  return blueprints;
}

/**
 * Main validation function
 */
async function main() {
  const blueprintDir = join(projectRoot, 'js/data');
  const blueprintFiles = findBlueprints(blueprintDir);
  
  console.log(`📁 Found ${blueprintFiles.length} blueprint files`);
  console.log('');

  for (const file of blueprintFiles) {
    const errors = await validateBlueprint(file);
    totalErrors += errors;
  }

  console.log('');
  console.log('📊 Validation Summary:');
  console.log(`   Blueprints: ${totalBlueprints}`);
  console.log(`   Errors: ${totalErrors}`);

  if (totalErrors > 0) {
    console.log('❌ Validation FAILED');
    process.exit(1);
  } else {
    console.log('✅ All blueprints valid!');
    process.exit(0);
  }
}

// Run validation
main().catch(error => {
  console.error('💥 Validation script crashed:', error);
  process.exit(1);
});