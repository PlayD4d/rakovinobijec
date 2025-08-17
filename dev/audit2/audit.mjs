#!/usr/bin/env node

/**
 * Enhanced Audit Script for Rakovinobijec
 * Post-refactor comprehensive analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Configuration
const IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  'assets',
  'vendor',
  '.git',
  'dev/audit',
  'dev/audit2/files'
];

const IGNORE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.mp3', '.ogg', '.wav', '.gif', '.ico', '.pdf'];

// Categories for classification
const FILE_CATEGORIES = {
  'scenes': /^js\/scenes\//,
  'managers': /^js\/managers\//,
  'entities': /^js\/entities\//,
  'ui': /^js\/ui\//,
  'core-systems': /^js\/core\/systems\//,
  'core-vfx': /^js\/core\/vfx\//,
  'core-audio': /^js\/core\/(audio|sfx)\//,
  'core-data': /^js\/core\/(data|blueprints)\//,
  'core-utils': /^js\/core\/utils\//,
  'core-other': /^js\/core\//,
  'tests': /^js\/tests\//,
  'integration': /^js\/integration\//,
  'utils': /^js\/utils\//,
  'root': /^js\/[^/]+\.js$/
};

// Phaser API patterns to detect
const PHASER_API_PATTERNS = [
  /this\.add\.(sprite|image|text|graphics|container|rectangle|circle|group|particles)/g,
  /this\.physics\.add\.(collider|overlap|group|sprite|image)/g,
  /this\.tweens\.add/g,
  /this\.sound\.play/g,
  /this\.cameras\.(main|add)/g,
  /this\.time\.(addEvent|delayedCall)/g,
  /scene\.(add|physics\.add|tweens\.add|sound\.play)/g,
  /particles\.createEmitter/g
];

// Data structures
const inventory = [];
const dependencies = new Map(); // file -> Set of imported files
const exportMap = new Map(); // file -> Set of exported symbols
const phaserViolations = [];
const todoComments = [];

// Helper functions
function shouldIgnore(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  
  for (const pattern of IGNORE_PATTERNS) {
    if (normalized.includes(`/${pattern}/`) || normalized.startsWith(`${pattern}/`)) {
      return true;
    }
  }
  
  const ext = path.extname(filePath).toLowerCase();
  if (IGNORE_EXTENSIONS.includes(ext)) {
    return true;
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

function categorizeFile(filePath) {
  for (const [category, pattern] of Object.entries(FILE_CATEGORIES)) {
    if (pattern.test(filePath)) {
      return category;
    }
  }
  return 'other';
}

function extractImports(content, filePath) {
  const imports = new Set();
  
  // ES6 imports
  const importRegex = /import\s+(?:[^'"]*)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    // Resolve relative imports
    if (importPath.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filePath), importPath);
      const relative = path.relative(PROJECT_ROOT, resolved).replace(/\\/g, '/');
      imports.add(relative.replace(/\.js$/, '') + '.js');
    } else {
      imports.add(importPath);
    }
  }
  
  // Dynamic imports
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filePath), importPath);
      const relative = path.relative(PROJECT_ROOT, resolved).replace(/\\/g, '/');
      imports.add(relative.replace(/\.js$/, '') + '.js');
    }
  }
  
  return imports;
}

function extractExports(content) {
  const exports = new Set();
  
  // Named exports
  const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.add(match[1]);
  }
  
  // Export statements
  const exportStmtRegex = /export\s+\{([^}]+)\}/g;
  while ((match = exportStmtRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
    names.forEach(name => exports.add(name));
  }
  
  // Default export
  if (/export\s+default\s+/.test(content)) {
    exports.add('default');
  }
  
  return exports;
}

function detectPhaserAPI(content, filePath) {
  const violations = [];
  
  // Skip allowed files
  if (filePath.includes('GameUIScene') || 
      filePath.includes('MainMenu') || 
      filePath.includes('PreloadScene') ||
      filePath.startsWith('js/core/vfx/') ||
      filePath.startsWith('js/core/audio/') ||
      filePath.startsWith('js/ui/')) {
    return violations;
  }
  
  const lines = content.split('\n');
  
  for (const pattern of PHASER_API_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const position = match.index;
      const lineNum = content.substring(0, position).split('\n').length;
      violations.push({
        file: filePath,
        line: lineNum,
        pattern: pattern.source,
        match: match[0],
        snippet: lines[lineNum - 1]?.trim() || ''
      });
    }
  }
  
  return violations;
}

function findTODOs(content, filePath) {
  const todos = [];
  const lines = content.split('\n');
  const todoRegex = /\b(TODO|FIXME|HACK|XXX)\b:?\s*(.*)/gi;
  
  lines.forEach((line, index) => {
    const match = todoRegex.exec(line);
    if (match) {
      todos.push({
        file: filePath,
        line: index + 1,
        type: match[1].toUpperCase(),
        message: match[2].trim(),
        snippet: line.trim()
      });
    }
    todoRegex.lastIndex = 0; // Reset regex
  });
  
  return todos;
}

function analyzeFile(filePath) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const loc = content.split('\n').length;
    const category = categorizeFile(filePath);
    
    // Extract dependencies
    const imports = extractImports(content, fullPath);
    dependencies.set(filePath, imports);
    
    // Extract exports
    const exports = extractExports(content);
    exportMap.set(filePath, exports);
    
    // Detect Phaser API violations
    const violations = detectPhaserAPI(content, filePath);
    phaserViolations.push(...violations);
    
    // Find TODOs
    const todos = findTODOs(content, filePath);
    todoComments.push(...todos);
    
    // Add to inventory
    inventory.push({
      path: filePath,
      category,
      loc,
      imports: Array.from(imports),
      exports: Array.from(exports),
      violationCount: violations.length,
      todoCount: todos.length
    });
    
    return {
      path: filePath,
      category,
      loc,
      importCount: imports.size,
      exportCount: exports.size,
      violations: violations.length,
      todos: todos.length
    };
  } catch (err) {
    console.warn(`Could not analyze ${filePath}:`, err.message);
    return null;
  }
}

function findCycles() {
  const cycles = [];
  const visited = new Set();
  const stack = new Set();
  
  function dfs(file, path = []) {
    if (stack.has(file)) {
      // Found a cycle
      const cycleStart = path.indexOf(file);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart).concat(file);
        cycles.push(cycle);
      }
      return;
    }
    
    if (visited.has(file)) return;
    
    visited.add(file);
    stack.add(file);
    
    const deps = dependencies.get(file) || new Set();
    for (const dep of deps) {
      if (dep.startsWith('js/')) {
        dfs(dep, [...path, file]);
      }
    }
    
    stack.delete(file);
  }
  
  for (const file of dependencies.keys()) {
    if (!visited.has(file)) {
      dfs(file);
    }
  }
  
  return cycles;
}

function calculateHotspots() {
  const hotspots = [];
  
  for (const item of inventory) {
    const inDegree = Array.from(dependencies.values())
      .filter(deps => deps.has(item.path))
      .length;
    
    const outDegree = item.imports.filter(imp => imp.startsWith('js/')).length;
    
    const complexity = item.loc * (inDegree + outDegree);
    
    hotspots.push({
      file: item.path,
      loc: item.loc,
      inDegree,
      outDegree,
      complexity,
      category: item.category
    });
  }
  
  return hotspots.sort((a, b) => b.complexity - a.complexity);
}

function findOrphans() {
  const allFiles = new Set(inventory.map(item => item.path));
  const importedFiles = new Set();
  
  for (const deps of dependencies.values()) {
    for (const dep of deps) {
      if (dep.startsWith('js/')) {
        importedFiles.add(dep);
      }
    }
  }
  
  const orphans = [];
  for (const file of allFiles) {
    if (!importedFiles.has(file) && !file.includes('main.js') && !file.includes('test')) {
      orphans.push(file);
    }
  }
  
  return orphans;
}

// Main execution
async function main() {
  console.log('🔍 Starting enhanced audit of Rakovinobijec project...\n');
  
  // Get all JS files
  const jsFiles = getAllJsFiles(path.join(PROJECT_ROOT, 'js'), PROJECT_ROOT);
  console.log(`Found ${jsFiles.length} JavaScript files\n`);
  
  // Analyze each file
  console.log('Analyzing files...');
  for (const file of jsFiles) {
    analyzeFile(file);
  }
  
  // Find cycles
  const cycles = findCycles();
  
  // Calculate hotspots
  const hotspots = calculateHotspots();
  
  // Find orphans
  const orphans = findOrphans();
  
  // Generate reports
  console.log('\nGenerating reports...');
  
  // Save inventory
  fs.writeFileSync(
    path.join(__dirname, 'inventory.json'),
    JSON.stringify(inventory, null, 2)
  );
  console.log('✅ inventory.json created');
  
  // Save violations
  fs.writeFileSync(
    path.join(__dirname, 'violations.json'),
    JSON.stringify({
      phaserAPI: phaserViolations,
      todos: todoComments,
      orphanFiles: orphans,
      cycles: cycles.map(c => c.join(' → '))
    }, null, 2)
  );
  console.log('✅ violations.json created');
  
  // Generate hotspots report
  const hotspotsContent = `# Hotspots Analysis

## Top 20 Complex Files (LOC × Dependencies)

| File | LOC | In-Degree | Out-Degree | Complexity | Category |
|------|-----|-----------|------------|------------|----------|
${hotspots.slice(0, 20).map(h => 
  `| ${h.file} | ${h.loc} | ${h.inDegree} | ${h.outDegree} | ${h.complexity} | ${h.category} |`
).join('\n')}

## Statistics

- Total files: ${inventory.length}
- Total LOC: ${inventory.reduce((sum, item) => sum + item.loc, 0)}
- Files with violations: ${new Set(phaserViolations.map(v => v.file)).size}
- Total violations: ${phaserViolations.length}
- Total TODOs: ${todoComments.length}
- Orphan files: ${orphans.length}
- Dependency cycles: ${cycles.length}

## Categories Distribution

${Object.entries(
  inventory.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {})
).map(([cat, count]) => `- ${cat}: ${count} files`).join('\n')}
`;
  
  fs.writeFileSync(path.join(__dirname, 'hotspots.md'), hotspotsContent);
  console.log('✅ hotspots.md created');
  
  // Print summary
  console.log('\n📊 Audit Summary:');
  console.log(`- Total files analyzed: ${inventory.length}`);
  console.log(`- Total lines of code: ${inventory.reduce((sum, item) => sum + item.loc, 0)}`);
  console.log(`- Phaser API violations: ${phaserViolations.length}`);
  console.log(`- TODO/FIXME comments: ${todoComments.length}`);
  console.log(`- Orphan files: ${orphans.length}`);
  console.log(`- Dependency cycles: ${cycles.length}`);
  
  if (phaserViolations.length > 0) {
    console.log('\n⚠️  Top Phaser API violations:');
    const violationsByFile = {};
    phaserViolations.forEach(v => {
      violationsByFile[v.file] = (violationsByFile[v.file] || 0) + 1;
    });
    Object.entries(violationsByFile)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([file, count]) => {
        console.log(`  - ${file}: ${count} violations`);
      });
  }
  
  console.log('\n✅ Audit complete!');
}

main().catch(console.error);