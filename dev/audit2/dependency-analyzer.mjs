#!/usr/bin/env node

/**
 * Dependency Analyzer for Rakovinobijec
 * Generates dependency graph and detects cycles
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load inventory if it exists
const inventoryPath = path.join(__dirname, 'inventory.json');
if (!fs.existsSync(inventoryPath)) {
  console.error('❌ inventory.json not found. Run audit.mjs first.');
  process.exit(1);
}

const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

// Build dependency map
const dependencies = new Map();
inventory.forEach(item => {
  dependencies.set(item.path, new Set(item.imports.filter(imp => imp.startsWith('js/'))));
});

// Generate DOT format graph
function generateDotGraph() {
  const lines = ['digraph Dependencies {'];
  lines.push('  rankdir=LR;');
  lines.push('  node [shape=box];');
  lines.push('');
  
  // Color nodes by category
  const categoryColors = {
    'scenes': 'lightblue',
    'managers': 'lightgreen',
    'entities': 'lightyellow',
    'ui': 'lightpink',
    'core-systems': 'lightgray',
    'core-vfx': 'plum',
    'core-audio': 'peachpuff',
    'core-data': 'lightcyan',
    'core-utils': 'wheat',
    'tests': 'lightcoral',
    'utils': 'lavender'
  };
  
  // Group by category
  const categories = {};
  inventory.forEach(item => {
    if (!categories[item.category]) {
      categories[item.category] = [];
    }
    categories[item.category].push(item);
  });
  
  // Add subgraphs for categories
  Object.entries(categories).forEach(([category, items]) => {
    lines.push(`  subgraph cluster_${category.replace('-', '_')} {`);
    lines.push(`    label="${category}";`);
    lines.push(`    style=filled;`);
    lines.push(`    color=lightgrey;`);
    lines.push(`    node [style=filled,color=${categoryColors[category] || 'white'}];`);
    
    items.forEach(item => {
      const label = item.path.split('/').pop();
      lines.push(`    "${item.path}" [label="${label}\\n(${item.loc} LOC)"];`);
    });
    
    lines.push('  }');
    lines.push('');
  });
  
  // Add edges
  dependencies.forEach((deps, source) => {
    deps.forEach(target => {
      lines.push(`  "${source}" -> "${target}";`);
    });
  });
  
  lines.push('}');
  
  return lines.join('\n');
}

// Detect strongly connected components (cycles)
function tarjanSCC() {
  const index = new Map();
  const lowlink = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];
  let currentIndex = 0;
  
  function strongConnect(v) {
    index.set(v, currentIndex);
    lowlink.set(v, currentIndex);
    currentIndex++;
    stack.push(v);
    onStack.add(v);
    
    const neighbors = dependencies.get(v) || new Set();
    for (const w of neighbors) {
      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), index.get(w)));
      }
    }
    
    if (lowlink.get(v) === index.get(v)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      
      if (scc.length > 1) {
        sccs.push(scc);
      }
    }
  }
  
  for (const v of dependencies.keys()) {
    if (!index.has(v)) {
      strongConnect(v);
    }
  }
  
  return sccs;
}

// Find all simple cycles
function findSimpleCycles() {
  const cycles = [];
  const visited = new Set();
  
  function dfs(start, current, path, pathSet) {
    if (pathSet.has(current)) {
      if (current === start && path.length > 1) {
        cycles.push([...path]);
      }
      return;
    }
    
    if (visited.has(current) && current !== start) {
      return;
    }
    
    pathSet.add(current);
    path.push(current);
    
    const neighbors = dependencies.get(current) || new Set();
    for (const next of neighbors) {
      if (next === start || !visited.has(next)) {
        dfs(start, next, path, pathSet);
      }
    }
    
    path.pop();
    pathSet.delete(current);
  }
  
  for (const node of dependencies.keys()) {
    dfs(node, node, [], new Set());
    visited.add(node);
  }
  
  return cycles;
}

// Calculate metrics
function calculateMetrics() {
  const metrics = {
    totalFiles: inventory.length,
    totalDependencies: 0,
    averageDependencies: 0,
    maxDependencies: 0,
    maxDependenciesFile: '',
    orphanFiles: [],
    leafFiles: [],
    hubFiles: []
  };
  
  const inDegree = new Map();
  const outDegree = new Map();
  
  // Initialize degrees
  inventory.forEach(item => {
    inDegree.set(item.path, 0);
    outDegree.set(item.path, 0);
  });
  
  // Calculate degrees
  dependencies.forEach((deps, source) => {
    outDegree.set(source, deps.size);
    metrics.totalDependencies += deps.size;
    
    deps.forEach(target => {
      inDegree.set(target, (inDegree.get(target) || 0) + 1);
    });
  });
  
  // Find special files
  inventory.forEach(item => {
    const inD = inDegree.get(item.path) || 0;
    const outD = outDegree.get(item.path) || 0;
    
    if (inD === 0 && outD === 0) {
      metrics.orphanFiles.push(item.path);
    } else if (outD === 0) {
      metrics.leafFiles.push(item.path);
    } else if (inD > 5 || outD > 10) {
      metrics.hubFiles.push({
        file: item.path,
        inDegree: inD,
        outDegree: outD
      });
    }
    
    if (outD > metrics.maxDependencies) {
      metrics.maxDependencies = outD;
      metrics.maxDependenciesFile = item.path;
    }
  });
  
  metrics.averageDependencies = metrics.totalDependencies / metrics.totalFiles;
  
  return metrics;
}

// Main execution
function main() {
  console.log('🔍 Analyzing dependencies...\n');
  
  // Generate DOT graph
  const dotGraph = generateDotGraph();
  fs.writeFileSync(path.join(__dirname, 'dependency-graph.dot'), dotGraph);
  console.log('✅ dependency-graph.dot created');
  console.log('   To visualize: dot -Tsvg dependency-graph.dot -o dependency-graph.svg');
  
  // Find cycles
  console.log('\n🔄 Detecting cycles...');
  const sccs = tarjanSCC();
  const simpleCycles = findSimpleCycles();
  
  console.log(`- Strongly connected components: ${sccs.length}`);
  console.log(`- Simple cycles: ${simpleCycles.length}`);
  
  if (sccs.length > 0) {
    console.log('\n⚠️  Strongly connected components (circular dependencies):');
    sccs.forEach((scc, i) => {
      console.log(`\n  SCC ${i + 1}:`);
      scc.forEach(file => console.log(`    - ${file}`));
    });
  }
  
  // Calculate metrics
  const metrics = calculateMetrics();
  
  console.log('\n📊 Dependency Metrics:');
  console.log(`- Total files: ${metrics.totalFiles}`);
  console.log(`- Total dependencies: ${metrics.totalDependencies}`);
  console.log(`- Average dependencies per file: ${metrics.averageDependencies.toFixed(2)}`);
  console.log(`- Max dependencies: ${metrics.maxDependencies} (${metrics.maxDependenciesFile})`);
  console.log(`- Orphan files: ${metrics.orphanFiles.length}`);
  console.log(`- Leaf files: ${metrics.leafFiles.length}`);
  console.log(`- Hub files: ${metrics.hubFiles.length}`);
  
  if (metrics.hubFiles.length > 0) {
    console.log('\n🎯 Hub files (high connectivity):');
    metrics.hubFiles
      .sort((a, b) => (b.inDegree + b.outDegree) - (a.inDegree + a.outDegree))
      .slice(0, 10)
      .forEach(hub => {
        console.log(`  - ${hub.file}: ${hub.inDegree} in, ${hub.outDegree} out`);
      });
  }
  
  // Save detailed analysis
  const analysis = {
    metrics,
    cycles: {
      stronglyConnected: sccs,
      simple: simpleCycles.slice(0, 20) // Limit to first 20
    },
    hubFiles: metrics.hubFiles,
    orphanFiles: metrics.orphanFiles
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'dependency-analysis.json'),
    JSON.stringify(analysis, null, 2)
  );
  console.log('\n✅ dependency-analysis.json created');
}

main();