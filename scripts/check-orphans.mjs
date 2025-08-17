#!/usr/bin/env node

/**
 * Check for orphan files (not imported anywhere)
 * Exit with code 1 if orphans found (excluding dev/_archive/)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Files to ignore
const IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  'assets',
  'vendor',
  '.git',
  'dev/_archive', // Archived orphans are OK
  'dev/audit',
  'dev/audit2'
];

// Entry points that are not imported but are valid
const ENTRY_POINTS = [
  'js/main.js',
  'js/tests/',
  'scripts/',
  'dev/',
  'js/scenes/', // All scenes are loaded by Phaser
  'js/integration/SpawnDirectorIntegration.js' // Integration file
];

// Known used files that are imported dynamically or from scenes
// These are all used by GameScene or GameUIScene dynamically
const WHITELIST = [
  'js/entities/Player.js',
  'js/managers/UpdateManager.js',
  'js/managers/TransitionManager.js',
  'js/managers/BootstrapManager.js',
  'js/managers/SystemsInitializer.js',
  'js/utils/DisposableRegistry.js',
  'js/handlers/setupCollisions.js',
  'js/core/utils/ConfigResolver.js',
  'js/core/utils/devConsole.js',
  'js/ui/UIEventContract.js',
  // Core systems used by GameScene
  'js/core/FrameworkDebugAPI.js',
  'js/core/TelemetryLogger.js',
  'js/core/data/BlueprintLoader.js',
  'js/core/debug/Phase5Debug.js',
  'js/core/dev/HotReload.js',
  'js/core/events/EventBus.js',
  'js/core/graphics/GraphicsFactory.js',
  'js/core/input/KeyboardManager.js',
  'js/core/spawn/SpawnDirector.js',
  'js/core/systems/ProjectileSystem.js',
  'js/core/systems/SimpleLootSystem.js',
  'js/core/systems/powerup/PowerUpSystem.js',
  'js/core/vfx/SimplifiedVFXSystem.js',
  // Managers
  'js/managers/AnalyticsManager.js',
  'js/managers/GlobalHighScoreManager.js',
  'js/managers/HighScoreManager.js',
  'js/managers/MobileControlsManager.js',
  // UI components used by GameUIScene
  'js/ui/DetailsPanel.js',
  'js/ui/HighScoresModal.js',
  'js/ui/SettingsModal.js',
  'js/ui/Tooltip.js',
  'js/ui/UnifiedHUD.js',
  'js/ui/ValueChip.js',
  'js/ui/lite/GameOverUI.js',
  'js/ui/lite/MainMenuUI.js',
  'js/ui/lite/PauseUI.js',
  'js/ui/lite/PowerUpUI.js',
  'js/utils/DebugOverlay.js'
];

function shouldIgnore(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  
  for (const pattern of IGNORE_PATTERNS) {
    if (normalized.includes(`/${pattern}/`) || normalized.startsWith(`${pattern}/`)) {
      return true;
    }
  }
  
  for (const entry of ENTRY_POINTS) {
    if (normalized.startsWith(entry)) {
      return true;
    }
  }
  
  return false;
}

function getAllJsFiles(dir, baseDir = dir) {
  const files = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      
      if (shouldIgnore(relativePath)) continue;
      
      if (entry.isDirectory()) {
        files.push(...getAllJsFiles(fullPath, baseDir));
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(relativePath);
      }
    }
  } catch (err) {
    console.warn(`Could not read directory ${dir}:`, err.message);
  }
  
  return files;
}

function extractImports(content, filePath) {
  const imports = new Set();
  
  // ES6 imports
  const importRegex = /import\s+(?:[^'"]*)?\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    // Resolve relative imports
    if (importPath.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filePath), importPath);
      const relative = path.relative(rootDir, resolved).replace(/\\/g, '/');
      imports.add(relative.replace(/\.js$/, '') + '.js');
    }
  }
  
  // Dynamic imports
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filePath), importPath);
      const relative = path.relative(rootDir, resolved).replace(/\\/g, '/');
      imports.add(relative.replace(/\.js$/, '') + '.js');
    }
  }
  
  return imports;
}

// Main execution
console.log('🔍 Checking for orphan files...\n');

const jsFiles = getAllJsFiles(path.join(rootDir, 'js'), rootDir);
console.log(`Found ${jsFiles.length} JavaScript files to check\n`);

// Build import map
const importedFiles = new Set();
for (const file of jsFiles) {
  const fullPath = path.join(rootDir, file);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const imports = extractImports(content, fullPath);
    for (const imp of imports) {
      importedFiles.add(imp);
    }
  } catch (err) {
    console.warn(`Could not read ${file}:`, err.message);
  }
}

// Find orphans
const orphans = [];
for (const file of jsFiles) {
  if (!importedFiles.has(file)) {
    // Check if it's an entry point
    let isEntry = false;
    for (const entry of ENTRY_POINTS) {
      if (file.startsWith(entry)) {
        isEntry = true;
        break;
      }
    }
    
    if (!isEntry && file !== 'js/main.js' && !WHITELIST.includes(file)) {
      orphans.push(file);
    }
  }
}

if (orphans.length > 0) {
  console.log(`❌ Found ${orphans.length} orphan files:\n`);
  orphans.forEach(file => console.log(`  - ${file}`));
  console.log('\nConsider archiving these files to dev/_archive/ or removing them.');
  process.exit(1);
} else {
  console.log('✅ No orphan files found!');
  process.exit(0);
}