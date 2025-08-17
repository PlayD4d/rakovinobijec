#!/usr/bin/env node

/**
 * Generate per-file audit reports
 * Creates detailed reports for each file in dev/audit2/files/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load data
const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, 'inventory.json'), 'utf8'));
const violations = JSON.parse(fs.readFileSync(path.join(__dirname, 'violations.json'), 'utf8'));
const depAnalysis = JSON.parse(fs.readFileSync(path.join(__dirname, 'dependency-analysis.json'), 'utf8'));

// Create files directory
const filesDir = path.join(__dirname, 'files');
if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir, { recursive: true });
}

// Group violations by file
const violationsByFile = {};
violations.phaserAPI.forEach(v => {
  if (!violationsByFile[v.file]) {
    violationsByFile[v.file] = [];
  }
  violationsByFile[v.file].push(v);
});

const todosByFile = {};
violations.todos.forEach(t => {
  if (!todosByFile[t.file]) {
    todosByFile[t.file] = [];
  }
  todosByFile[t.file].push(t);
});

// Generate report for each file
inventory.forEach(file => {
  const fileName = file.path.replace(/\//g, '_').replace('.js', '.md');
  const filePath = path.join(filesDir, fileName);
  
  // Calculate metrics
  const isOrphan = violations.orphanFiles.includes(file.path);
  const isHub = depAnalysis.hubFiles.some(h => h.file === file.path);
  const fileViolations = violationsByFile[file.path] || [];
  const fileTodos = todosByFile[file.path] || [];
  
  // Generate report content
  let content = `# Audit Report: ${file.path}\n\n`;
  content += `## 📊 Metrics\n\n`;
  content += `- **Category**: ${file.category}\n`;
  content += `- **Lines of Code**: ${file.loc}\n`;
  content += `- **Dependencies**: ${file.imports.length} imports, ${file.exports.length} exports\n`;
  content += `- **Violations**: ${fileViolations.length}\n`;
  content += `- **TODOs**: ${fileTodos.length}\n`;
  
  // Status badges
  content += `\n## 🏷️ Status\n\n`;
  if (isOrphan) content += `- ⚠️ **ORPHAN**: No file imports this module\n`;
  if (isHub) content += `- 🌟 **HUB**: High connectivity file\n`;
  if (fileViolations.length > 10) content += `- 🔴 **HIGH VIOLATIONS**: ${fileViolations.length} Phaser API violations\n`;
  if (file.loc > 500) content += `- 📏 **LARGE FILE**: Consider splitting (${file.loc} LOC)\n`;
  
  // Dependencies
  if (file.imports.length > 0) {
    content += `\n## 📦 Dependencies\n\n`;
    file.imports.forEach(imp => {
      content += `- ${imp}\n`;
    });
  }
  
  // Exports
  if (file.exports.length > 0) {
    content += `\n## 📤 Exports\n\n`;
    file.exports.forEach(exp => {
      content += `- ${exp}\n`;
    });
  }
  
  // Violations
  if (fileViolations.length > 0) {
    content += `\n## ⚠️ Violations\n\n`;
    content += `### Phaser API Violations (${fileViolations.length})\n\n`;
    fileViolations.forEach(v => {
      content += `- **Line ${v.line}**: \`${v.match}\`\n`;
      content += `  - Pattern: \`${v.pattern}\`\n`;
      content += `  - Code: \`${v.snippet}\`\n`;
    });
  }
  
  // TODOs
  if (fileTodos.length > 0) {
    content += `\n## 📝 TODOs\n\n`;
    fileTodos.forEach(t => {
      content += `- **Line ${t.line}** [${t.type}]: ${t.message}\n`;
    });
  }
  
  // Recommendations
  content += `\n## 💡 Recommendations\n\n`;
  if (file.loc > 500) {
    content += `- **Split file**: This file has ${file.loc} lines. Consider breaking it into smaller modules.\n`;
  }
  if (fileViolations.length > 0) {
    content += `- **Remove Phaser API calls**: Use appropriate managers/systems instead of direct Phaser API.\n`;
  }
  if (isOrphan) {
    content += `- **Review necessity**: This file is not imported anywhere. Consider removing if unused.\n`;
  }
  if (file.imports.length > 10) {
    content += `- **High coupling**: ${file.imports.length} dependencies indicate high coupling. Consider refactoring.\n`;
  }
  
  // Compliance score
  let score = 100;
  score -= fileViolations.length * 5;
  score -= fileTodos.length * 2;
  if (isOrphan) score -= 20;
  if (file.loc > 500) score -= 10;
  if (file.loc > 1000) score -= 20;
  score = Math.max(0, score);
  
  content += `\n## 🎯 PR7 Compliance Score\n\n`;
  content += `**${score}/100**\n\n`;
  if (score >= 90) content += `✅ Excellent compliance\n`;
  else if (score >= 70) content += `🟡 Good compliance with minor issues\n`;
  else if (score >= 50) content += `🟠 Moderate compliance, needs attention\n`;
  else content += `🔴 Poor compliance, requires refactoring\n`;
  
  // Write report
  fs.writeFileSync(filePath, content);
});

// Generate index
let indexContent = `# File Reports Index\n\n`;
indexContent += `Generated reports for ${inventory.length} files.\n\n`;
indexContent += `## 🔴 Critical Files (Score < 50)\n\n`;

inventory.forEach(file => {
  const fileViolations = violationsByFile[file.path] || [];
  const fileTodos = todosByFile[file.path] || [];
  const isOrphan = violations.orphanFiles.includes(file.path);
  
  let score = 100;
  score -= fileViolations.length * 5;
  score -= fileTodos.length * 2;
  if (isOrphan) score -= 20;
  if (file.loc > 500) score -= 10;
  if (file.loc > 1000) score -= 20;
  score = Math.max(0, score);
  
  if (score < 50) {
    const fileName = file.path.replace(/\//g, '_').replace('.js', '.md');
    indexContent += `- [${file.path}](files/${fileName}) - Score: ${score}/100\n`;
  }
});

indexContent += `\n## 🟡 Files Needing Attention (Score 50-70)\n\n`;

inventory.forEach(file => {
  const fileViolations = violationsByFile[file.path] || [];
  const fileTodos = todosByFile[file.path] || [];
  const isOrphan = violations.orphanFiles.includes(file.path);
  
  let score = 100;
  score -= fileViolations.length * 5;
  score -= fileTodos.length * 2;
  if (isOrphan) score -= 20;
  if (file.loc > 500) score -= 10;
  if (file.loc > 1000) score -= 20;
  score = Math.max(0, score);
  
  if (score >= 50 && score < 70) {
    const fileName = file.path.replace(/\//g, '_').replace('.js', '.md');
    indexContent += `- [${file.path}](files/${fileName}) - Score: ${score}/100\n`;
  }
});

fs.writeFileSync(path.join(__dirname, 'file-reports-index.md'), indexContent);

console.log(`✅ Generated ${inventory.length} file reports in dev/audit2/files/`);
console.log(`✅ Created file-reports-index.md`);