#!/usr/bin/env node
/**
 * Compare Telemetry - CLI nástroj pro porovnání dvou telemetrických sessions
 * 
 * Porovnává před/po balance změnách a generuje diff reporty.
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import { mkdir } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

import { compareRuns } from '../tools/telemetry/compareRuns.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * CLI konfigurace
 */
const CLI_OPTIONS = {
    before: {
        type: 'string',
        short: 'b'
    },
    after: {
        type: 'string', 
        short: 'a'
    },
    output: {
        type: 'string',
        short: 'o',
        default: 'build/reports/comparison'
    },
    csv: {
        type: 'boolean',
        short: 'c',
        default: false
    },
    verbose: {
        type: 'boolean',
        short: 'v',
        default: false
    }
};

/**
 * Hlavní porovnávací funkce
 */
async function main(argv) {
    try {
        const { values: options, positionals: args } = parseArgs({
            args: argv.slice(2),
            options: CLI_OPTIONS,
            allowPositionals: true
        });
        
        // Validate argumenty
        let beforePath = options.before || args[0];
        let afterPath = options.after || args[1];
        
        if (!beforePath || !afterPath) {
            showHelp();
            process.exit(1);
        }
        
        // Zajisti absolute paths
        if (!beforePath.startsWith('/')) {
            beforePath = join(projectRoot, beforePath);
        }
        if (!afterPath.startsWith('/')) {
            afterPath = join(projectRoot, afterPath);
        }
        
        // Výstupní složka
        const outputDir = join(projectRoot, options.output);
        await mkdir(outputDir, { recursive: true });
        
        console.log('🔄 Porovnávám telemetrické sessions...');
        console.log(`📁 Before: ${basename(beforePath)}`);
        console.log(`📁 After:  ${basename(afterPath)}`);
        console.log(`📂 Output: ${outputDir}`);
        
        // Spusť porovnání
        const result = await compareRuns(beforePath, afterPath, outputDir, {
            generateMarkdown: true,
            generateCSV: options.csv,
            verbose: options.verbose
        });
        
        // Zobraz výsledky
        console.log('\n✅ Porovnání dokončeno!');
        console.log('📊 Vygenerované soubory:');
        
        Object.entries(result.reportFiles).forEach(([type, path]) => {
            if (typeof path === 'string') {
                console.log(`  📄 ${type}: ${basename(path)}`);
            } else if (typeof path === 'object') {
                Object.entries(path).forEach(([subType, subPath]) => {
                    console.log(`  📄 ${type}.${subType}: ${basename(subPath)}`);
                });
            }
        });
        
        // Shrnutí klíčových změn
        const insights = result.comparison.insights;
        
        if (insights.improvements.length > 0) {
            console.log('\n✅ Klíčová zlepšení:');
            insights.improvements.forEach(imp => console.log(`  • ${imp}`));
        }
        
        if (insights.regressions.length > 0) {
            console.log('\n❌ Regressions:');
            insights.regressions.forEach(reg => console.log(`  • ${reg}`));
        }
        
        if (insights.observations.length > 0) {
            console.log('\n👀 Pozorování:');
            insights.observations.slice(0, 3).forEach(obs => console.log(`  • ${obs}`));
        }
        
        console.log(`\n📁 Kompletní report: ${outputDir}/comparison.md`);
        
    } catch (error) {
        console.error('\n❌ Porovnání selhalo:', error.message);
        if (options && options.verbose) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

/**
 * Zobrazí nápovědu
 */
function showHelp() {
    console.log(`
🔄 Compare Telemetry - Porovnání telemetrických sessions

POUŽITÍ:
  npm run compare:runs -- before.json after.json
  npm run compare:runs -- --before logs/old.json --after logs/new.json

MOŽNOSTI:
  -b, --before <file>     Before session (reference)
  -a, --after <file>      After session (comparison target)
  -o, --output <dir>      Výstupní složka (výchozí: build/reports/comparison)
  -c, --csv               Generuj také CSV soubory
  -v, --verbose           Detailní výstup

PŘÍKLADY:
  # Porovnej dva konkrétní logy
  npm run compare:runs -- logs/before_balance.json logs/after_balance.json
  
  # S CSV exportem a detailním výstupem
  npm run compare:runs -- --before logs/v1.json --after logs/v2.json --csv --verbose
  
  # Vlastní výstupní složka
  npm run compare:runs -- old.json new.json --output reports/balance_test

VÝSTUPY:
  comparison.md           Markdown comparison report
  comparison.json         JSON data pro další zpracování
  ttk_comparison.csv      TTK metriky (s --csv)
  summary_comparison.csv  Summary metriky (s --csv)
    `);
}

// Spustit CLI pokud je soubor spuštěn přímo
if (import.meta.url === `file://${process.argv[1]}`) {
    main(process.argv);
}

export { main };