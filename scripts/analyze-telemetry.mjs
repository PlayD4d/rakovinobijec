#!/usr/bin/env node
/**
 * Analyze Telemetry - Automatizovaný nástroj pro analýzu telemetrických logů
 * 
 * Zpracovává JSON logy z TelemetryLogger a generuje vizuální reporty
 * pro analýzu balance a výkonu hry.
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import { readFile, readdir, stat, mkdir } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';
import { glob } from 'glob';

import { parseAndAggregate } from '../tools/telemetry/parseAndAggregate.mjs';
import { renderReport } from '../tools/telemetry/renderReport.mjs';
import { generateCharts } from '../tools/telemetry/chartGenerator.mjs';
import { generateInsights } from '../tools/telemetry/insights.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * CLI konfigurace a možnosti
 */
const CLI_OPTIONS = {
    mode: {
        type: 'string',
        short: 'm',
        default: 'session'
    },
    out: {
        type: 'string',
        short: 'o',
        default: 'build/reports'
    },
    html: {
        type: 'boolean',
        short: 'h',
        default: false
    },
    aggregate: {
        type: 'boolean',
        short: 'a',
        default: false
    },
    'ng-only': {
        type: 'string',
        short: 'n'
    },
    window: {
        type: 'string',
        short: 'w',
        default: '60'
    },
    verbose: {
        type: 'boolean',
        short: 'v',
        default: false
    }
};

/**
 * Hlavní třída pro analýzu telemetrie
 */
class TelemetryAnalyzer {
    constructor(options = {}) {
        this.options = {
            outputDir: 'build/reports',
            generateHtml: false,
            rollingWindow: 60,
            verbose: false,
            ngFilter: null,
            ...options
        };
        
        this.stats = {
            totalSessions: 0,
            totalEvents: 0,
            totalDuration: 0,
            startTime: Date.now()
        };
    }

    /**
     * Analyzuje jednu session ze souboru
     * @param {string} filePath - Cesta k JSON souboru
     * @returns {Promise<Object>} Výsledek analýzy
     */
    async analyzeSession(filePath) {
        const startTime = Date.now();
        
        this.log(`🔍 Analyzuji session: ${basename(filePath)}`);
        
        try {
            // Načtení a parsování dat
            const rawData = await readFile(filePath, 'utf8');
            const sessionData = JSON.parse(rawData);
            
            if (!sessionData.events || !Array.isArray(sessionData.events)) {
                throw new Error('Neplatný formát telemetrických dat');
            }
            
            // Aplikace NG+ filtru
            let filteredEvents = sessionData.events;
            if (this.options.ngFilter !== null && this.options.ngFilter !== undefined) {
                filteredEvents = filteredEvents.filter(event => 
                    event.ngPlusLevel === parseInt(this.options.ngFilter)
                );
                this.log(`🔽 Filtr NG+${this.options.ngFilter}: ${filteredEvents.length}/${sessionData.events.length} eventů`);
            }
            
            // Agregace dat
            const aggregatedData = parseAndAggregate(filteredEvents, {
                rollingWindow: this.options.rollingWindow,
                verbose: this.options.verbose
            });
            
            // Určení output složky
            const sessionId = sessionData.sessionId || `session_${Date.now()}`;
            const outputPath = join(projectRoot, this.options.outputDir, sessionId);
            
            // Vytvoření output struktury
            await mkdir(outputPath, { recursive: true });
            await mkdir(join(outputPath, 'charts'), { recursive: true });
            
            // Generování grafů
            this.log('📊 Generuji grafy...');
            const chartPaths = await generateCharts(aggregatedData, join(outputPath, 'charts'));
            
            // Generování insights
            this.log('💡 Generuji doporučení...');
            const insights = generateInsights(aggregatedData);
            
            // Renderování reportu
            this.log('📝 Renderuji report...');
            const reportData = {
                sessionId,
                filePath: basename(filePath),
                aggregatedData,
                chartPaths,
                insights,
                metadata: {
                    totalEvents: filteredEvents.length,
                    originalEvents: sessionData.events.length,
                    ngFilter: this.options.ngFilter,
                    analysisTime: Date.now() - startTime,
                    generatedAt: new Date().toISOString()
                }
            };
            
            await renderReport(reportData, outputPath, {
                generateHtml: this.options.generateHtml,
                verbose: this.options.verbose
            });
            
            // Statistiky
            this.stats.totalSessions++;
            this.stats.totalEvents += filteredEvents.length;
            this.stats.totalDuration += aggregatedData.summary.sessionDuration;
            
            this.log(`✅ Session analyzována za ${Date.now() - startTime}ms`);
            this.log(`📁 Report uložen: ${outputPath}`);
            
            return {
                sessionId,
                outputPath,
                aggregatedData,
                metadata: reportData.metadata
            };
            
        } catch (error) {
            console.error(`❌ Chyba při analýze ${filePath}:`, error.message);
            if (this.options.verbose) {
                console.error(error.stack);
            }
            throw error;
        }
    }

    /**
     * Analyzuje více sessions a vytvoří agregovaný report
     * @param {string[]} filePaths - Cesty k JSON souborům
     * @returns {Promise<Object>} Výsledek agregované analýzy
     */
    async analyzeMultipleSessions(filePaths) {
        this.log(`🔍 Analyzuji ${filePaths.length} sessions pro agregaci`);
        
        const results = [];
        const errors = [];
        
        // Analyzuj každou session jednotlivě
        for (const filePath of filePaths) {
            try {
                const result = await this.analyzeSession(filePath);
                results.push(result);
            } catch (error) {
                errors.push({ filePath, error: error.message });
            }
        }
        
        if (results.length === 0) {
            throw new Error('Žádné sessions se nepodařilo analyzovat');
        }
        
        // Vytvoř agregovaný report
        this.log('📊 Vytvářím agregovaný report...');
        
        const aggregateOutputPath = join(projectRoot, this.options.outputDir, '_aggregate');
        await mkdir(aggregateOutputPath, { recursive: true });
        await mkdir(join(aggregateOutputPath, 'charts'), { recursive: true });
        
        // Agreguj data ze všech sessions
        const aggregatedComparison = this.aggregateMultipleSessions(
            results.map(r => r.aggregatedData)
        );
        
        // Generuj srovnávací grafy
        const chartPaths = await generateCharts(
            aggregatedComparison, 
            join(aggregateOutputPath, 'charts'),
            { isAggregate: true }
        );
        
        // Generuj agregované insights
        const insights = generateInsights(aggregatedComparison, {
            isMultiSession: true,
            sessionCount: results.length
        });
        
        // Renderuj agregovaný report
        const reportData = {
            sessionIds: results.map(r => r.sessionId),
            filePaths: filePaths.map(fp => basename(fp)),
            aggregatedData: aggregatedComparison,
            chartPaths,
            insights,
            individualResults: results,
            errors,
            metadata: {
                totalSessions: results.length,
                totalEvents: this.stats.totalEvents,
                totalErrors: errors.length,
                analysisTime: Date.now() - this.stats.startTime,
                generatedAt: new Date().toISOString()
            }
        };
        
        await renderReport(reportData, aggregateOutputPath, {
            generateHtml: this.options.generateHtml,
            isAggregate: true,
            verbose: this.options.verbose
        });
        
        this.log(`✅ Agregovaný report vytvořen: ${aggregateOutputPath}`);
        
        return {
            outputPath: aggregateOutputPath,
            results,
            errors,
            metadata: reportData.metadata
        };
    }

    /**
     * Agreguje data z více sessions pro porovnání
     * @param {Object[]} sessionsData - Data ze všech sessions
     * @returns {Object} Agregovaná data
     */
    aggregateMultipleSessions(sessionsData) {
        // Základní struktura pro agregaci
        const aggregate = {
            summary: {
                totalSessions: sessionsData.length,
                totalDuration: 0,
                avgDuration: 0,
                totalKills: 0,
                avgKills: 0,
                ngLevels: new Set()
            },
            ttk: {
                allSamples: [],
                byType: {},
                bySession: []
            },
            spawns: {
                total: 0,
                byType: {},
                bySession: []
            },
            loot: {
                total: 0,
                byRarity: {},
                bySession: []
            },
            dps: {
                samples: [],
                bySession: []
            },
            comparison: {
                sessions: [],
                metrics: {}
            }
        };
        
        // Agreguj data ze každé session
        sessionsData.forEach((sessionData, index) => {
            const session = {
                index,
                sessionId: sessionData.summary.sessionId || `session_${index}`,
                duration: sessionData.summary.sessionDuration,
                kills: sessionData.summary.totalKills,
                ngLevel: sessionData.summary.ngPlusLevel || 0
            };
            
            // Summary data
            aggregate.summary.totalDuration += session.duration;
            aggregate.summary.totalKills += session.kills;
            aggregate.summary.ngLevels.add(session.ngLevel);
            
            // TTK data
            if (sessionData.ttk && sessionData.ttk.samples) {
                aggregate.ttk.allSamples.push(...sessionData.ttk.samples);
                aggregate.ttk.bySession.push({
                    sessionId: session.sessionId,
                    median: sessionData.ttk.median,
                    mean: sessionData.ttk.mean,
                    samples: sessionData.ttk.samples.length
                });
                
                // TTK by type
                Object.keys(sessionData.ttk.byType || {}).forEach(type => {
                    if (!aggregate.ttk.byType[type]) {
                        aggregate.ttk.byType[type] = [];
                    }
                    aggregate.ttk.byType[type].push(...sessionData.ttk.byType[type]);
                });
            }
            
            // Spawns data
            if (sessionData.spawns) {
                aggregate.spawns.total += sessionData.spawns.total || 0;
                aggregate.spawns.bySession.push({
                    sessionId: session.sessionId,
                    total: sessionData.spawns.total,
                    rate: sessionData.spawns.rate
                });
                
                Object.keys(sessionData.spawns.byType || {}).forEach(type => {
                    aggregate.spawns.byType[type] = 
                        (aggregate.spawns.byType[type] || 0) + sessionData.spawns.byType[type];
                });
            }
            
            // Loot data
            if (sessionData.loot) {
                aggregate.loot.total += sessionData.loot.total || 0;
                aggregate.loot.bySession.push({
                    sessionId: session.sessionId,
                    total: sessionData.loot.total,
                    rate: sessionData.loot.rate
                });
                
                Object.keys(sessionData.loot.byRarity || {}).forEach(rarity => {
                    aggregate.loot.byRarity[rarity] = 
                        (aggregate.loot.byRarity[rarity] || 0) + sessionData.loot.byRarity[rarity];
                });
            }
            
            // DPS data
            if (sessionData.dps && sessionData.dps.samples) {
                aggregate.dps.samples.push(...sessionData.dps.samples);
                aggregate.dps.bySession.push({
                    sessionId: session.sessionId,
                    avgPlayerDPS: sessionData.dps.avgPlayerDPS,
                    avgIncomingDPS: sessionData.dps.avgIncomingDPS
                });
            }
            
            aggregate.comparison.sessions.push(session);
        });
        
        // Vypočítej průměry
        aggregate.summary.avgDuration = aggregate.summary.totalDuration / aggregate.summary.totalSessions;
        aggregate.summary.avgKills = aggregate.summary.totalKills / aggregate.summary.totalSessions;
        aggregate.summary.ngLevels = Array.from(aggregate.summary.ngLevels);
        
        // Vypočítaj srovnávací metriky
        aggregate.comparison.metrics = this.calculateComparisonMetrics(aggregate);
        
        return aggregate;
    }

    /**
     * Vypočítá srovnávací metriky pro více sessions
     * @param {Object} aggregateData - Agregovaná data
     * @returns {Object} Srovnávací metriky
     */
    calculateComparisonMetrics(aggregateData) {
        const metrics = {};
        
        // TTK metriky
        if (aggregateData.ttk.bySession.length > 0) {
            const ttkValues = aggregateData.ttk.bySession.map(s => s.median).filter(v => v != null);
            metrics.ttk = {
                min: Math.min(...ttkValues),
                max: Math.max(...ttkValues),
                mean: ttkValues.reduce((a, b) => a + b, 0) / ttkValues.length,
                variance: this.calculateVariance(ttkValues)
            };
        }
        
        // Spawns metriky
        if (aggregateData.spawns.bySession.length > 0) {
            const spawnRates = aggregateData.spawns.bySession.map(s => s.rate).filter(v => v != null);
            metrics.spawns = {
                minRate: Math.min(...spawnRates),
                maxRate: Math.max(...spawnRates),
                avgRate: spawnRates.reduce((a, b) => a + b, 0) / spawnRates.length,
                variance: this.calculateVariance(spawnRates)
            };
        }
        
        // Loot metriky
        if (aggregateData.loot.bySession.length > 0) {
            const lootRates = aggregateData.loot.bySession.map(s => s.rate).filter(v => v != null);
            metrics.loot = {
                minRate: Math.min(...lootRates),
                maxRate: Math.max(...lootRates),
                avgRate: lootRates.reduce((a, b) => a + b, 0) / lootRates.length,
                variance: this.calculateVariance(lootRates)
            };
        }
        
        return metrics;
    }

    /**
     * Vypočítá rozptyl pro pole čísel
     * @param {number[]} values - Hodnoty
     * @returns {number} Rozptyl
     */
    calculateVariance(values) {
        if (values.length <= 1) return 0;
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }

    /**
     * Najde nejnovější log soubor
     * @param {string} logsDir - Složka s logy
     * @returns {Promise<string>} Cesta k nejnovějšímu souboru
     */
    async findLatestLog(logsDir = 'logs') {
        const fullLogsPath = join(projectRoot, logsDir);
        
        try {
            const files = await readdir(fullLogsPath);
            const sessionFiles = files
                .filter(file => file.startsWith('session_') && file.endsWith('.json'))
                .map(file => join(fullLogsPath, file));
            
            if (sessionFiles.length === 0) {
                throw new Error(`Žádné session logy nenalezeny v ${fullLogsPath}`);
            }
            
            // Seřaď podle času modifikace
            const filesWithStats = await Promise.all(
                sessionFiles.map(async file => {
                    const stats = await stat(file);
                    return { file, mtime: stats.mtime };
                })
            );
            
            filesWithStats.sort((a, b) => b.mtime - a.mtime);
            
            return filesWithStats[0].file;
            
        } catch (error) {
            throw new Error(`Nepodařilo se najít nejnovější log: ${error.message}`);
        }
    }

    /**
     * Logování s verbose kontrolou
     * @param {string} message - Zpráva k logování
     */
    log(message) {
        if (this.options.verbose) {
            console.log(message);
        }
    }

    /**
     * Zobrazí pomocné informace
     */
    static showHelp() {
        console.log(`
📊 Analyze Telemetry - Nástroj pro analýzu herních logů

POUŽITÍ:
  npm run analyze:session -- soubor.json       # Analyzuje jednu session
  npm run analyze:pattern -- "logs/*.json"     # Analyzuje podle patternu  
  npm run analyze:latest                        # Analyzuje nejnovější log

MOŽNOSTI:
  -m, --mode <typ>        Režim: session|pattern|latest (výchozí: session)
  -o, --out <složka>      Výstupní složka (výchozí: build/reports)
  -h, --html             Generuj také HTML report
  -a, --aggregate        Vytvoř agregovaný report z více sessions
  -n, --ng-only <N>      Filtruj pouze NG+ úroveň N  
  -w, --window <s>       Rolling window v sekundách (výchozí: 60)
  -v, --verbose          Detailní výstup

PŘÍKLADY:
  npm run analyze:session -- logs/session_2025-08-12T19-02-11.json
  npm run analyze:pattern -- "logs/session_*.json" --aggregate --html
  npm run analyze:latest -- --ng-only=2 --verbose
  
VÝSTUPY:
  build/reports/<sessionId>/report.md          # Markdown report
  build/reports/<sessionId>/report.html        # HTML report (s --html)
  build/reports/<sessionId>/charts/*.png       # Grafy
  build/reports/<sessionId>/summary.json       # JSON metriky
  build/reports/_aggregate/                     # Agregované reporty
        `);
    }
}

/**
 * Parsuje CLI argumenty a validuje je
 * @param {string[]} argv - CLI argumenty
 * @returns {Object} Parsed argumenty a možnosti
 */
function parseCliArgs(argv) {
    try {
        const { values: options, positionals: args } = parseArgs({
            args: argv.slice(2),
            options: CLI_OPTIONS,
            allowPositionals: true
        });
        
        // Převeď číselné hodnoty
        if (options.window) {
            options.window = parseInt(options.window);
            if (isNaN(options.window) || options.window < 1) {
                throw new Error('--window musí být kladné číslo');
            }
        }
        
        if (options['ng-only']) {
            options.ngOnly = parseInt(options['ng-only']);
            if (isNaN(options.ngOnly) || options.ngOnly < 0) {
                throw new Error('--ng-only musí být nezáporné číslo');
            }
        }
        
        return { options, args };
        
    } catch (error) {
        console.error(`❌ Chyba v argumentech: ${error.message}`);
        TelemetryAnalyzer.showHelp();
        process.exit(1);
    }
}

/**
 * Hlavní funkce CLI
 * @param {string[]} argv - CLI argumenty
 */
async function main(argv) {
    const startTime = Date.now();
    
    try {
        const { options, args } = parseCliArgs(argv);
        
        // Převeď options na formát pro TelemetryAnalyzer
        const analyzerOptions = {
            outputDir: options.out,
            generateHtml: options.html,
            rollingWindow: options.window,
            verbose: options.verbose,
            ngFilter: options.ngOnly
        };
        
        const analyzer = new TelemetryAnalyzer(analyzerOptions);
        
        // Určení režimu a souborů
        let filePaths = [];
        
        switch (options.mode) {
            case 'session':
                if (args.length === 0) {
                    throw new Error('V session režimu musíte zadat cestu k souboru');
                }
                filePaths = [args[0]];
                break;
                
            case 'pattern':
                if (args.length === 0) {
                    throw new Error('V pattern režimu musíte zadat pattern');
                }
                filePaths = await glob(args[0], { absolute: true });
                if (filePaths.length === 0) {
                    throw new Error(`Žádné soubory nenalezeny pro pattern: ${args[0]}`);
                }
                break;
                
            case 'latest':
                const latestFile = await analyzer.findLatestLog();
                filePaths = [latestFile];
                console.log(`📝 Nejnovější log: ${basename(latestFile)}`);
                break;
                
            default:
                throw new Error(`Neznámý režim: ${options.mode}`);
        }
        
        // Výběr analýzy podle počtu souborů a aggregate flagy
        let result;
        
        if (options.aggregate && filePaths.length > 1) {
            result = await analyzer.analyzeMultipleSessions(filePaths);
            console.log(`\n✅ Agregovaná analýza dokončena!`);
            console.log(`📁 Výstup: ${result.outputPath}`);
            console.log(`📊 Sessions: ${result.results.length}/${filePaths.length}`);
            if (result.errors.length > 0) {
                console.log(`⚠️  Chyby: ${result.errors.length}`);
            }
        } else if (filePaths.length === 1) {
            result = await analyzer.analyzeSession(filePaths[0]);
            console.log(`\n✅ Analýza session dokončena!`);
            console.log(`📁 Výstup: ${result.outputPath}`);
            console.log(`📊 Eventy: ${result.metadata.totalEvents}`);
        } else {
            // Více souborů bez aggregate - analyzuj jednotlivě
            const results = [];
            for (const filePath of filePaths) {
                try {
                    const result = await analyzer.analyzeSession(filePath);
                    results.push(result);
                } catch (error) {
                    console.error(`❌ ${basename(filePath)}: ${error.message}`);
                }
            }
            
            console.log(`\n✅ Analýza ${results.length}/${filePaths.length} sessions dokončena!`);
            console.log(`📁 Výstupy v: ${options.out}/`);
        }
        
        // Finální statistiky
        const totalTime = Date.now() - startTime;
        console.log(`⏱️  Celkový čas: ${totalTime}ms`);
        console.log(`📈 Celkem sessions: ${analyzer.stats.totalSessions}`);
        console.log(`📊 Celkem eventů: ${analyzer.stats.totalEvents}`);
        
    } catch (error) {
        console.error(`\n❌ Analýza selhala: ${error.message}`);
        if (argv.includes('--verbose')) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Spuštění CLI pokud je soubor spuštěn přímo
if (import.meta.url === `file://${process.argv[1]}`) {
    main(process.argv);
}

export { TelemetryAnalyzer, main };