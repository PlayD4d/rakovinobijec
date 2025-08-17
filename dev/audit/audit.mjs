#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Ignore patterns
const IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  'assets',
  'vendor',
  '.git',
  'dev/audit'
];

const IGNORE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.mp3', '.ogg', '.wav', '.gif', '.ico'];

// Collected data
const inventory = [];
const allImports = new Map(); // file -> [imported files]
const allExports = new Map(); // file -> [exported symbols]

// Helper: Check if path should be ignored
function shouldIgnore(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  
  // Check directory patterns
  for (const pattern of IGNORE_PATTERNS) {
    if (normalized.includes(`/${pattern}/`) || normalized.startsWith(`${pattern}/`)) {
      return true;
    }
  }
  
  // Check file extensions
  const ext = path.extname(filePath).toLowerCase();
  if (IGNORE_EXTENSIONS.includes(ext)) {
    return true;
  }
  
  return false;
}

// Helper: Get all JS files recursively
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

// Helper: Count lines of code
function countLOC(content) {
  return content.split('\n').length;
}

// Helper: Extract imports from file content
function extractImports(content) {
  const imports = [];
  
  // ES6 imports
  const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)?\s*(?:,\s*{[^}]*})?\s*from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  // CommonJS requires
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

// Helper: Extract exports from file content
function extractExports(content) {
  const exports = [];
  
  // ES6 named exports
  const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  
  // ES6 default export
  if (/export\s+default\s+/.test(content)) {
    exports.push('default');
  }
  
  // ES6 export from
  const exportFromRegex = /export\s+{([^}]+)}\s+from/g;
  while ((match = exportFromRegex.exec(content)) !== null) {
    const items = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]);
    exports.push(...items);
  }
  
  // CommonJS exports
  const commonjsRegex = /module\.exports\s*=\s*{([^}]+)}/g;
  while ((match = commonjsRegex.exec(content)) !== null) {
    const items = match[1].split(',').map(s => s.trim().split(':')[0].trim());
    exports.push(...items);
  }
  
  if (/module\.exports\s*=\s*\w+/.test(content)) {
    exports.push('default');
  }
  
  return [...new Set(exports)];
}

// Helper: Extract classes and functions
function extractClassesAndFunctions(content) {
  const items = [];
  
  // Classes
  const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+([.\w]+))?/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    items.push({
      type: 'class',
      name: match[1],
      extends: match[2] || null
    });
  }
  
  // Functions
  const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
  while ((match = functionRegex.exec(content)) !== null) {
    items.push({
      type: 'function',
      name: match[1]
    });
  }
  
  // Arrow functions assigned to const/let/var
  const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    items.push({
      type: 'function',
      name: match[1]
    });
  }
  
  return items;
}

// Helper: Determine file kind
function determineKind(filePath, content, classesAndFunctions) {
  const fileName = path.basename(filePath, '.js').toLowerCase();
  const dirName = path.dirname(filePath).split('/').pop();
  
  // Check for Scene
  if (classesAndFunctions.some(item => item.type === 'class' && item.extends && item.extends.includes('Scene'))) {
    return 'scene';
  }
  
  // Check for System
  if (fileName.includes('system') || (fileName.endsWith('system') && /this\.(add|physics|tweens|cameras|sound)/.test(content))) {
    return 'system';
  }
  
  // Check for UI Component
  if (dirName === 'ui' || fileName.includes('modal') || fileName.includes('hud') || fileName.includes('button') || 
      /RexUI|Modal|HUD|Panel|Chip/.test(content)) {
    return 'ui-component';
  }
  
  // Check for Factory
  if (fileName.includes('factory') || classesAndFunctions.some(f => f.name && f.name.startsWith('create'))) {
    return 'factory';
  }
  
  // Check for Manager
  if (fileName.includes('manager')) {
    return 'manager';
  }
  
  // Check for Entity
  if (dirName === 'entities' || fileName === 'player' || fileName === 'enemy' || fileName === 'boss') {
    return 'entity';
  }
  
  // Check for Util
  if (dirName === 'utils' || dirName === 'core/utils' || 
      classesAndFunctions.every(f => f.type === 'function') && classesAndFunctions.length > 0) {
    return 'util';
  }
  
  // Check for Test
  if (fileName.includes('test') || fileName.includes('smoke') || dirName === 'tests') {
    return 'test';
  }
  
  // Check for Config/Data
  if (fileName === 'config' || fileName.includes('constants') || fileName.includes('resolver')) {
    return 'config';
  }
  
  return 'other';
}

// Helper: Check if file touches Phaser API
function touchesPhaserAPI(content) {
  const phaserPatterns = [
    /this\.(add|physics|tweens|cameras|sound|input|scene|registry|game)\./,
    /Phaser\./,
    /extends\s+Phaser\./
  ];
  
  return phaserPatterns.some(pattern => pattern.test(content));
}

// Helper: Check if file touches blueprints
function touchesBlueprints(content) {
  const blueprintPatterns = [
    /blueprintLoader/i,
    /blueprint/i,
    /getBlueprint/,
    /loadBlueprints/,
    /\.json5/
  ];
  
  return blueprintPatterns.some(pattern => pattern.test(content));
}

// Helper: Check if file owns state
function ownsState(content, kind) {
  // Scenes, systems, managers, and entities typically own state
  if (['scene', 'system', 'manager', 'entity'].includes(kind)) {
    return true;
  }
  
  // Check for state indicators
  const statePatterns = [
    /this\.\w+\s*=\s*(?!null|undefined|false|true|\d)/,
    /constructor\s*\([^)]*\)\s*{[^}]*this\./
  ];
  
  return statePatterns.some(pattern => pattern.test(content));
}

// Helper: Determine UI coupling
function determineUICoupling(content, imports, kind) {
  if (kind === 'ui-component') return 'high';
  
  const uiImports = imports.filter(imp => imp.includes('/ui/') || imp.includes('UI') || imp.includes('Modal') || imp.includes('HUD'));
  const uiReferences = (content.match(/UI|Modal|HUD|Button|Panel/g) || []).length;
  
  if (uiImports.length > 3 || uiReferences > 10) return 'high';
  if (uiImports.length > 0 || uiReferences > 3) return 'mid';
  return 'low';
}

// Main analysis function
async function analyzeFile(filePath) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const loc = countLOC(content);
    const imports = extractImports(content);
    const exports = extractExports(content);
    const classesAndFunctions = extractClassesAndFunctions(content);
    const kind = determineKind(filePath, content, classesAndFunctions);
    
    // Store for cross-reference
    allImports.set(filePath, imports);
    allExports.set(filePath, exports);
    
    // Create entry
    const entry = {
      path: filePath,
      kind,
      loc,
      exports,
      public_api: classesAndFunctions.map(item => item.name),
      depends_on: imports.filter(imp => imp.startsWith('./')).map(imp => {
        // Normalize relative imports
        const dir = path.dirname(filePath);
        const resolved = path.join(dir, imp).replace(/\\/g, '/');
        return resolved.replace(/^\.\//, '').replace(/\.js$/, '') + '.js';
      }),
      depended_by: [], // Will be filled in second pass
      fan_in: 0,
      fan_out: 0,
      owns_state: ownsState(content, kind),
      touches_phaser_api: touchesPhaserAPI(content),
      touches_blueprints: touchesBlueprints(content),
      ui_coupling: determineUICoupling(content, imports, kind),
      notes: generateNotes(filePath, kind, classesAndFunctions, loc)
    };
    
    entry.fan_out = entry.depends_on.length;
    
    return entry;
  } catch (err) {
    console.warn(`Could not analyze ${filePath}:`, err.message);
    return null;
  }
}

// Helper: Generate notes for file
function generateNotes(filePath, kind, classesAndFunctions, loc) {
  const fileName = path.basename(filePath, '.js');
  
  const kindNotes = {
    scene: 'Game scene orchestrator',
    system: 'Core game system',
    'ui-component': 'UI component',
    factory: 'Object factory',
    manager: 'Manager component',
    entity: 'Game entity',
    util: 'Utility functions',
    test: 'Test file',
    config: 'Configuration',
    other: 'Mixed responsibilities'
  };
  
  let note = kindNotes[kind] || 'Unknown purpose';
  
  if (loc > 1000) note += '; very large file';
  if (loc > 2000) note += ' (needs splitting)';
  if (classesAndFunctions.length > 10) note += '; many functions';
  
  return note;
}

// Second pass: Fill in depended_by
function fillDependencies() {
  for (const entry of inventory) {
    // Find who depends on this file
    for (const other of inventory) {
      if (other.path === entry.path) continue;
      
      // Check if other depends on entry
      const entryName = entry.path.replace(/\.js$/, '');
      const entryAlt = './' + entryName;
      const entryAlt2 = '../' + entryName.split('/').pop();
      
      if (other.depends_on.some(dep => 
        dep === entry.path || 
        dep === entryName + '.js' ||
        dep.endsWith('/' + path.basename(entry.path))
      )) {
        entry.depended_by.push(other.path);
      }
    }
    
    entry.fan_in = entry.depended_by.length;
  }
}

// Generate dependency graph
function generateDependencyGraph() {
  const lines = ['digraph Dependencies {'];
  lines.push('  rankdir=LR;');
  lines.push('  node [shape=box];');
  lines.push('');
  
  // Color scheme for different kinds
  const colors = {
    scene: '#ff9999',
    system: '#99ccff',
    'ui-component': '#ffcc99',
    factory: '#ccffcc',
    manager: '#ffccff',
    entity: '#ccccff',
    util: '#ffffcc',
    test: '#cccccc',
    config: '#ffcccc',
    other: '#ffffff'
  };
  
  // Group by directories
  const groups = {};
  for (const entry of inventory) {
    const dir = path.dirname(entry.path).split('/')[1] || 'root';
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(entry);
  }
  
  // Create subgraphs
  for (const [dir, entries] of Object.entries(groups)) {
    lines.push(`  subgraph cluster_${dir} {`);
    lines.push(`    label="${dir}";`);
    lines.push('    style=filled;');
    lines.push('    color=lightgrey;');
    
    for (const entry of entries) {
      const id = entry.path.replace(/[\/\.]/g, '_');
      const color = colors[entry.kind] || '#ffffff';
      lines.push(`    "${id}" [label="${path.basename(entry.path)}\\n${entry.kind}\\n${entry.loc} LOC", fillcolor="${color}", style=filled];`);
    }
    
    lines.push('  }');
    lines.push('');
  }
  
  // Add edges
  for (const entry of inventory) {
    const fromId = entry.path.replace(/[\/\.]/g, '_');
    for (const dep of entry.depends_on) {
      const depEntry = inventory.find(e => e.path === dep || e.path === dep.replace(/^\.\//, ''));
      if (depEntry) {
        const toId = depEntry.path.replace(/[\/\.]/g, '_');
        lines.push(`  "${fromId}" -> "${toId}";`);
      }
    }
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

// Generate hotspots report
function generateHotspots() {
  const lines = ['# Hotspots Analysis\n'];
  lines.push('Files with highest risk score (LOC × (fan-in + fan-out))\n');
  lines.push('| Soubor | LOC | Fan-in | Fan-out | Kind | Score | Poznámka |');
  lines.push('|--------|-----|--------|---------|------|-------|----------|');
  
  // Calculate scores and sort
  const scored = inventory.map(entry => ({
    ...entry,
    score: entry.loc * (entry.fan_in + entry.fan_out)
  })).sort((a, b) => b.score - a.score);
  
  // Top 20 hotspots
  for (const entry of scored.slice(0, 20)) {
    const warning = generateWarning(entry);
    lines.push(`| ${entry.path} | ${entry.loc} | ${entry.fan_in} | ${entry.fan_out} | ${entry.kind} | ${entry.score} | ${warning} |`);
  }
  
  return lines.join('\n');
}

// Helper: Generate warning for hotspot
function generateWarning(entry) {
  const warnings = [];
  
  if (entry.loc > 2000) warnings.push('velmi velký soubor');
  if (entry.loc > 1000 && entry.kind === 'scene') warnings.push('příliš mnoho logiky v scéně');
  if (entry.fan_out > 15) warnings.push('mnoho závislostí');
  if (entry.fan_in > 10) warnings.push('hodně závislý');
  if (entry.kind === 'other') warnings.push('nejasná odpovědnost');
  if (entry.ui_coupling === 'high' && !['ui-component', 'scene'].includes(entry.kind)) {
    warnings.push('vysoká vazba na UI');
  }
  if (entry.owns_state && entry.kind === 'util') warnings.push('util drží stav');
  
  return warnings.join(', ') || 'OK';
}

// Generate per-file reports
function generateFileReports() {
  for (const entry of inventory) {
    const lines = [`# ${entry.path}`];
    lines.push(`**Role:** ${entry.kind}`);
    lines.push(`**Veřejné API:** ${entry.public_api.join(', ') || '—'}`);
    lines.push(`**Závislosti (importuje):** ${entry.depends_on.join(', ') || '—'}`);
    lines.push(`**Závislosti (je importován):** ${entry.depended_by.join(', ') || '—'}`);
    lines.push('**Funkce/třídy:**');
    
    if (entry.public_api.length > 0) {
      for (const api of entry.public_api) {
        lines.push(`- ${api} — ${getApiDescription(api, entry.kind)}`);
      }
    } else {
      lines.push('- —');
    }
    
    lines.push('**Poznámky:**');
    lines.push(`- ${entry.notes}`);
    if (entry.loc > 1000) lines.push(`- Vysoký počet řádků (${entry.loc} LOC)`);
    if (entry.fan_out > 10) lines.push(`- Mnoho závislostí (${entry.fan_out})`);
    if (entry.touches_phaser_api) lines.push('- Přímé volání Phaser API');
    if (entry.touches_blueprints) lines.push('- Práce s blueprinty');
    
    const filePath = path.join(__dirname, 'files', entry.path.replace(/\.js$/, '.md'));
    const fileDir = path.dirname(filePath);
    
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, lines.join('\n'));
  }
}

// Helper: Get API description
function getApiDescription(apiName, kind) {
  const commonDescriptions = {
    constructor: 'inicializace',
    create: 'vytvoření scény/objektu',
    update: 'herní smyčka',
    preload: 'načtení assetů',
    init: 'inicializace',
    destroy: 'úklid paměti',
    render: 'vykreslení',
    pause: 'pozastavení',
    resume: 'obnovení',
    shutdown: 'ukončení'
  };
  
  return commonDescriptions[apiName.toLowerCase()] || `${kind} funkce`;
}

// Generate summary report
function generateSummary() {
  const lines = ['# Rakovinobijec - Audit Summary\n'];
  
  // Statistics
  lines.push('## Statistiky\n');
  lines.push(`- **Celkem souborů:** ${inventory.length}`);
  lines.push(`- **Celkem LOC:** ${inventory.reduce((sum, e) => sum + e.loc, 0)}`);
  lines.push(`- **Průměr LOC:** ${Math.round(inventory.reduce((sum, e) => sum + e.loc, 0) / inventory.length)}`);
  lines.push('');
  
  // Architecture map
  lines.push('## Architektonická mapa\n');
  const byKind = {};
  for (const entry of inventory) {
    if (!byKind[entry.kind]) byKind[entry.kind] = [];
    byKind[entry.kind].push(entry);
  }
  
  for (const [kind, entries] of Object.entries(byKind)) {
    lines.push(`### ${kind} (${entries.length} souborů, ${entries.reduce((sum, e) => sum + e.loc, 0)} LOC)`);
    lines.push(`Hlavní soubory: ${entries.slice(0, 3).map(e => path.basename(e.path)).join(', ')}`);
    lines.push('');
  }
  
  // One source of truth violations
  lines.push('## "One Source of Truth" porušení\n');
  const gameScene = inventory.find(e => e.path === 'js/scenes/GameScene.js');
  if (gameScene && gameScene.loc > 1500) {
    lines.push(`1. **GameScene (${gameScene.loc} LOC)** - obsahuje duplicitní logiku:`);
    lines.push('   - Ruční spawn XP/health (má být v SimpleLootSystem)');
    lines.push('   - Generování textur (má být v systémech)');
    lines.push('   - Přímé tweens pro efekty (má být ve VFX systému)');
    lines.push('   - Rozprostřené kolize (mají být centralizované)');
  }
  
  lines.push('2. **Duplicitní VFX/SFX systémy** - SimplifiedVFXSystem vs VFXRegistry vs přímé volání');
  lines.push('3. **Rozptýlená UI logika** - části v GameScene, části v GameUIScene, části v modalech');
  lines.push('');
  
  // Top 5 risks
  lines.push('## Top 5 rizik\n');
  const scored = inventory.map(e => ({
    ...e,
    score: e.loc * (e.fan_in + e.fan_out)
  })).sort((a, b) => b.score - a.score);
  
  for (let i = 0; i < Math.min(5, scored.length); i++) {
    const entry = scored[i];
    lines.push(`${i + 1}. **${entry.path}** (Score: ${entry.score})`);
    lines.push(`   - ${entry.loc} LOC, fan-in: ${entry.fan_in}, fan-out: ${entry.fan_out}`);
    lines.push(`   - Riziko: ${generateWarning(entry)}`);
    lines.push('');
  }
  
  // Refactoring priorities
  lines.push('## Priority refaktoringu\n');
  lines.push('### Fáze 1: Vyčištění GameScene');
  lines.push('1. **Extrakce kolizí** - vytvořit setupCollisions() funkci');
  lines.push('2. **Odstranění spawn logiky** - vše přes SimpleLootSystem');
  lines.push('3. **Smazání generování textur** - textury generují systémy z blueprintů');
  lines.push('4. **Centralizace depth vrstev** - konzistentní DEPTH_LAYERS');
  lines.push('5. **Odstranění duplicitních tweens** - VFX přes SimplifiedVFXSystem');
  lines.push('');
  
  lines.push('### Fáze 2: Konsolidace systémů');
  lines.push('- Sloučit VFX systémy do jednoho');
  lines.push('- Sjednotit audio systémy');
  lines.push('- Centralizovat UI management');
  lines.push('');
  
  lines.push('### Fáze 3: Modularizace');
  lines.push('- Rozdělit velké soubory (>1000 LOC)');
  lines.push('- Vytvořit jasné rozhraní mezi vrstvami');
  lines.push('- Implementovat event-driven komunikaci');
  lines.push('');
  
  // Definition of Done
  lines.push('## Definition of Done (Fáze 1)\n');
  lines.push('- ✅ GameScene ≤ 1200 LOC');
  lines.push('- ✅ Žádné přímé generování projektilů/loot/VFX v GameScene');
  lines.push('- ✅ Kolize registrované na jednom místě (setupCollisions)');
  lines.push('- ✅ Všechny spawn přes SimpleLootSystem');
  lines.push('- ✅ Konzistentní depth management');
  lines.push('- ✅ Testy projdou beze změny chování');
  
  return lines.join('\n');
}

// Main execution
async function main() {
  console.log('Starting code audit...\n');
  
  // Create output directories
  const auditDir = path.join(__dirname);
  const filesDir = path.join(auditDir, 'files');
  
  if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir, { recursive: true });
  }
  
  // Get all JS files
  console.log('Scanning for JS files...');
  const jsFiles = getAllJsFiles(path.join(PROJECT_ROOT, 'js'), PROJECT_ROOT);
  console.log(`Found ${jsFiles.length} JS files\n`);
  
  // Analyze each file
  console.log('Analyzing files...');
  for (const file of jsFiles) {
    const entry = await analyzeFile(file);
    if (entry) {
      inventory.push(entry);
    }
  }
  
  // Second pass for dependencies
  console.log('Resolving dependencies...');
  fillDependencies();
  
  // Generate outputs
  console.log('Generating reports...\n');
  
  // 1. Inventory
  fs.writeFileSync(
    path.join(auditDir, 'inventory.json'),
    JSON.stringify(inventory, null, 2)
  );
  console.log('✓ inventory.json generated');
  
  // 2. Dependency graph
  fs.writeFileSync(
    path.join(auditDir, 'dependency-graph.dot'),
    generateDependencyGraph()
  );
  console.log('✓ dependency-graph.dot generated');
  
  // 3. Hotspots
  fs.writeFileSync(
    path.join(auditDir, 'hotspots.md'),
    generateHotspots()
  );
  console.log('✓ hotspots.md generated');
  
  // 4. Per-file reports
  generateFileReports();
  console.log('✓ Per-file reports generated');
  
  // 5. Summary
  fs.writeFileSync(
    path.join(auditDir, 'summary.md'),
    generateSummary()
  );
  console.log('✓ summary.md generated');
  
  // Final statistics
  console.log('\n=== Audit Complete ===\n');
  console.log(`Total files analyzed: ${inventory.length}`);
  console.log(`Total LOC: ${inventory.reduce((sum, e) => sum + e.loc, 0)}`);
  console.log(`Average LOC: ${Math.round(inventory.reduce((sum, e) => sum + e.loc, 0) / inventory.length)}`);
  
  // Top 10 largest files
  console.log('\nTop 10 largest files:');
  const bySize = [...inventory].sort((a, b) => b.loc - a.loc);
  for (let i = 0; i < Math.min(10, bySize.length); i++) {
    console.log(`  ${i + 1}. ${bySize[i].path} (${bySize[i].loc} LOC)`);
  }
  
  console.log('\nOutputs generated in:');
  console.log(`  - ${path.join(auditDir, 'inventory.json')}`);
  console.log(`  - ${path.join(auditDir, 'dependency-graph.dot')}`);
  console.log(`  - ${path.join(auditDir, 'hotspots.md')}`);
  console.log(`  - ${path.join(auditDir, 'summary.md')}`);
  console.log(`  - ${path.join(auditDir, 'files/')}*.md`);
}

// Run
main().catch(console.error);