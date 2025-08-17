/**
 * MagicNumberLinter - Detekce hard-coded čísel v gameplay kódu
 * 
 * Slouží pro CI/CD pipeline k zachycení nových magic numbers
 * před mergem do main branche.
 */

export class MagicNumberLinter {
  constructor() {
    // Povolené magic numbers (indexy, booleany, matematické konstanty)
    this.allowedNumbers = new Set([
      0, 1, -1, 2, 3, 4, 5, 10, 100, 1000,  // Základní čísla
      Math.PI, Math.E,                       // Matematické konstanty
      0.5, 0.25, 0.75,                      // Běžné zlomky
      360, 180, 90, 45,                     // Úhly ve stupních
      Math.PI * 2, Math.PI / 2, Math.PI / 4 // Úhly v radiánech
    ]);

    // Povolené kontexty (nedetekovat v těchto případech)
    this.allowedContexts = [
      /array\s*\[\s*\d+\s*\]/,              // Array indexy
      /for\s*\(\s*[^;]*;\s*[^;]*<\s*\d+/,   // For loop limits
      /case\s+\d+:/,                        // Switch cases
      /return\s+[01]\s*;/,                  // Return boolean
      /setTimeout\(\s*[^,]*,\s*\d+\s*\)/,   // setTimeout intervals
      /setInterval\(\s*[^,]*,\s*\d+\s*\)/,  // setInterval intervals
      /console\.(log|warn|error)/,          // Console output
      /\/\/.*\d+/,                          // Comments
      /\/\*[\s\S]*?\*\//,                   // Multi-line comments
      /'[^']*\d+[^']*'/,                    // String literals
      /"[^"]*\d+[^"]*"/,                    // String literals
      /`[^`]*\d+[^`]*`/,                    // Template literals
      /0x[0-9A-Fa-f]+/,                     // Hex numbers (colors)
      /#[0-9A-Fa-f]{3,8}/,                  // CSS colors
      /\d+px/,                              // CSS units
      /\d+%/,                               // Percentages
      /version.*\d+\.\d+\.\d+/i             // Version numbers
    ];

    // Gameplay soubory k analýze
    this.gameplayFiles = [
      'js/scenes/GameScene.js',
      'js/entities/Player.js',
      'js/entities/Enemy.js',
      'js/entities/Boss.js',
      'js/core/systems/*.js',
      'js/managers/*.js'
    ];

    // Exclude patterns - kde magic numbers jsou OK
    this.excludePatterns = [
      /js\/config\.js$/,                    // GameConfig soubor
      /js\/tests\/.*\.js$/,                 // Test soubory
      /js\/.*\/.*Registry\.js$/,            // Registry soubory
      /js\/data\/.*\.js$/,                  // Blueprint data soubory
      /js\/core\/utils\/ConfigResolver\.js$/, // ConfigResolver fallbacks
      /js\/ui\/.*\.js$/,                    // UI positioning
      /phaser\.min\.js$/,                   // External libraries
      /node_modules/                        // Dependencies
    ];
  }

  /**
   * Analyzuje soubor a hledá magic numbers
   * @param {string} filePath - Cesta k souboru
   * @param {string} content - Obsah souboru
   * @returns {Array} Seznam nalezených magic numbers
   */
  analyzeFile(filePath, content) {
    // Skip excluded files
    if (this.excludePatterns.some(pattern => pattern.test(filePath))) {
      return [];
    }

    const findings = [];
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
      const lineNum = lineIndex + 1;
      
      // Skip if line is in allowed context
      if (this.allowedContexts.some(pattern => pattern.test(line))) {
        return;
      }

      // Find all numbers in the line
      const numberMatches = line.matchAll(/\b\d*\.?\d+\b/g);
      
      for (const match of numberMatches) {
        const number = parseFloat(match[0]);
        const startPos = match.index;
        
        // Skip allowed numbers
        if (this.allowedNumbers.has(number)) {
          continue;
        }

        // Analyze context around the number
        const context = this._analyzeContext(line, startPos, match[0]);
        
        if (context.isSuspicious) {
          findings.push({
            file: filePath,
            line: lineNum,
            column: startPos + 1,
            number: match[0],
            value: number,
            context: context.description,
            severity: context.severity,
            suggestion: context.suggestion,
            lineContent: line.trim()
          });
        }
      }
    });

    return findings;
  }

  /**
   * Analyzuje kontext okolo číslice
   * @private
   */
  _analyzeContext(line, position, numberStr) {
    const before = line.substring(0, position).toLowerCase();
    const after = line.substring(position + numberStr.length).toLowerCase();
    const number = parseFloat(numberStr);

    // High severity patterns (definite magic numbers)
    const highSeverityPatterns = [
      // Damage/HP calculations
      { pattern: /(damage|hp|health|maxhp)\s*[+\-*/=]/, severity: 'high', suggestion: 'Use ConfigResolver.get() for damage/HP values' },
      { pattern: /\*\s*math\.pow\s*\(\s*[\d.]+/, severity: 'high', suggestion: 'Move scaling formulas to GameConfig.scaling' },
      { pattern: /(speed|velocity)\s*[+\-*/=]/, severity: 'high', suggestion: 'Use ConfigResolver.get() for speed values' },
      
      // Time intervals
      { pattern: /settimeout|setinterval|delay/i, severity: 'high', suggestion: 'Use ConfigResolver.get() for timing constants' },
      { pattern: /(interval|cooldown|timer)\s*[+\-*/=]/, severity: 'medium', suggestion: 'Use ConfigResolver.get() for intervals' },
      
      // Multipliers and scaling
      { pattern: /\*\s*[\d.]+$/, severity: 'medium', suggestion: 'Use ConfigResolver.get() for multipliers' },
      { pattern: /Math\.(max|min)\s*\(\s*[\d.]+/, severity: 'medium', suggestion: 'Use ConfigResolver.get() for limits' },
      
      // Game mechanics
      { pattern: /(level|count|size|radius|range)\s*[+\-*/=]/, severity: 'medium', suggestion: 'Use ConfigResolver.get() for game mechanics' }
    ];

    for (const pattern of highSeverityPatterns) {
      if (pattern.pattern.test(before + numberStr + after)) {
        return {
          isSuspicious: true,
          severity: pattern.severity,
          description: `Potential ${pattern.severity} magic number: ${numberStr}`,
          suggestion: pattern.suggestion
        };
      }
    }

    // Medium severity (suspicious contexts)
    if (number > 10 && number < 1000 && !Number.isInteger(number)) {
      // Decimal numbers in gameplay code are often multipliers
      return {
        isSuspicious: true,
        severity: 'medium',
        description: `Suspicious decimal constant: ${numberStr}`,
        suggestion: 'Consider moving to GameConfig if this affects gameplay'
      };
    }

    if (Number.isInteger(number) && number > 50 && number < 10000) {
      // Large integers are often gameplay constants
      if (/[=+\-*/]/.test(before.slice(-5)) || /[=+\-*/]/.test(after.slice(0, 5))) {
        return {
          isSuspicious: true,
          severity: 'low',
          description: `Large integer in calculation: ${numberStr}`,
          suggestion: 'Verify if this should be configurable'
        };
      }
    }

    return { isSuspicious: false };
  }

  /**
   * Analyzuje více souborů
   * @param {Object} fileContents - Map<filePath, content>
   * @returns {Object} Celkový report
   */
  analyzeFiles(fileContents) {
    const allFindings = [];
    const fileReports = {};

    for (const [filePath, content] of Object.entries(fileContents)) {
      const findings = this.analyzeFile(filePath, content);
      allFindings.push(...findings);
      
      if (findings.length > 0) {
        fileReports[filePath] = {
          findings,
          high: findings.filter(f => f.severity === 'high').length,
          medium: findings.filter(f => f.severity === 'medium').length,
          low: findings.filter(f => f.severity === 'low').length
        };
      }
    }

    return {
      totalFiles: Object.keys(fileContents).length,
      filesWithIssues: Object.keys(fileReports).length,
      totalFindings: allFindings.length,
      high: allFindings.filter(f => f.severity === 'high').length,
      medium: allFindings.filter(f => f.severity === 'medium').length,
      low: allFindings.filter(f => f.severity === 'low').length,
      fileReports,
      findings: allFindings
    };
  }

  /**
   * Generuje report pro CI/CD
   * @param {Object} analysisResult - Výsledek z analyzeFiles
   * @returns {string} Formatted report
   */
  generateCIReport(analysisResult) {
    const { totalFiles, filesWithIssues, totalFindings, high, medium, low } = analysisResult;
    
    let report = '# Magic Number Linter Report\n\n';
    
    if (totalFindings === 0) {
      report += '✅ **No magic numbers detected!**\n\n';
      report += `Analyzed ${totalFiles} files - all clean.\n`;
      return report;
    }

    report += `📊 **Summary**: ${totalFindings} potential magic numbers found in ${filesWithIssues}/${totalFiles} files\n\n`;
    report += `- 🔴 **High Priority**: ${high} issues\n`;
    report += `- 🟡 **Medium Priority**: ${medium} issues\n`;
    report += `- 🟢 **Low Priority**: ${low} issues\n\n`;

    if (high > 0) {
      report += '## 🔴 High Priority Issues (Must Fix)\n\n';
      analysisResult.findings
        .filter(f => f.severity === 'high')
        .forEach(finding => {
          report += `**${finding.file}:${finding.line}:${finding.column}**\n`;
          report += `\`${finding.lineContent}\`\n`;
          report += `Issue: ${finding.context}\n`;
          report += `Suggestion: ${finding.suggestion}\n\n`;
        });
    }

    if (medium > 0 && high === 0) {
      report += '## 🟡 Medium Priority Issues\n\n';
      analysisResult.findings
        .filter(f => f.severity === 'medium')
        .slice(0, 5) // Limit to first 5 for readability
        .forEach(finding => {
          report += `**${finding.file}:${finding.line}**\n`;
          report += `\`${finding.lineContent}\`\n`;
          report += `${finding.context} - ${finding.suggestion}\n\n`;
        });
      
      if (medium > 5) {
        report += `... and ${medium - 5} more medium priority issues.\n\n`;
      }
    }

    // Exit code suggestion
    if (high > 0) {
      report += '❌ **CI Status**: FAIL (high priority issues detected)\n';
    } else if (medium > 3) {
      report += '⚠️ **CI Status**: WARNING (multiple medium priority issues)\n';
    } else {
      report += '✅ **CI Status**: PASS (only low/medium priority issues)\n';
    }

    return report;
  }

  /**
   * Kontroluje, zda je soubor čistý (pro pre-commit hook)
   * @param {string} filePath - Cesta k souboru
   * @param {string} content - Obsah souboru
   * @returns {boolean} True pokud je soubor čistý
   */
  isClean(filePath, content) {
    const findings = this.analyzeFile(filePath, content);
    return findings.filter(f => f.severity === 'high').length === 0;
  }

  /**
   * Přidá číslo do whitelistu
   * @param {number} number - Číslo k povolení
   */
  allowNumber(number) {
    this.allowedNumbers.add(number);
  }

  /**
   * Přidá kontext do whitelistu
   * @param {RegExp} pattern - Pattern k povolení
   */
  allowContext(pattern) {
    this.allowedContexts.push(pattern);
  }
}

// Export singleton instance
export const magicNumberLinter = new MagicNumberLinter();
export default MagicNumberLinter;