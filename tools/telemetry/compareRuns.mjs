/**
 * CompareRuns - Porovnání dvou telemetrických sessions
 * 
 * Bonus nástroj pro porovnání před/po balance změnách.
 * Generuje diff report s konkrétními změnami v metrikách.
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { parseAndAggregate } from './parseAndAggregate.mjs';

/**
 * Porovná dvě telemetrické sessions
 * @param {string} beforePath - Cesta k "before" session
 * @param {string} afterPath - Cesta k "after" session
 * @param {string} outputDir - Výstupní složka
 * @param {Object} options - Možnosti
 * @returns {Promise<Object>} Comparison report
 */
export async function compareRuns(beforePath, afterPath, outputDir, options = {}) {
    const opts = {
        generateMarkdown: true,
        generateCSV: false,
        verbose: false,
        ...options
    };
    
    if (opts.verbose) {
        console.log(`🔄 Porovnávám runs: ${beforePath} vs ${afterPath}`);
    }
    
    try {
        // Načti a parsuj obě sessions
        const beforeData = await loadAndParseSession(beforePath);
        const afterData = await loadAndParseSession(afterPath);
        
        // Vytvoř comparison
        const comparison = createComparison(beforeData, afterData);
        
        // Generuj reporty
        const reportFiles = {};
        
        if (opts.generateMarkdown) {
            const markdownPath = join(outputDir, 'comparison.md');
            const markdown = generateComparisonMarkdown(comparison);
            await writeFile(markdownPath, markdown, 'utf8');
            reportFiles.markdown = markdownPath;
            
            if (opts.verbose) {
                console.log(`✅ Markdown report: ${markdownPath}`);
            }
        }
        
        if (opts.generateCSV) {
            const csvFiles = await generateComparisonCSV(comparison, outputDir);
            reportFiles.csv = csvFiles;
            
            if (opts.verbose) {
                console.log(`✅ CSV soubory: ${Object.keys(csvFiles).length} souborů`);
            }
        }
        
        // JSON summary
        const summaryPath = join(outputDir, 'comparison.json');
        await writeFile(summaryPath, JSON.stringify(comparison, null, 2), 'utf8');
        reportFiles.summary = summaryPath;
        
        if (opts.verbose) {
            console.log(`✅ Porovnání dokončeno: ${Object.keys(reportFiles).length} souborů`);
        }
        
        return {
            comparison,
            reportFiles
        };
        
    } catch (error) {
        console.error('❌ Chyba při porovnávání runs:', error.message);
        throw error;
    }
}

/**
 * Načte a parsuje session z JSON souboru
 * @param {string} filePath - Cesta k session souboru
 * @returns {Promise<Object>} Parsovaná data
 */
async function loadAndParseSession(filePath) {
    const { readFile } = await import('fs/promises');
    const rawData = await readFile(filePath, 'utf8');
    const sessionData = JSON.parse(rawData);
    
    if (!sessionData.events || !Array.isArray(sessionData.events)) {
        throw new Error(`Neplatný formát session v ${filePath}`);
    }
    
    return parseAndAggregate(sessionData.events, { verbose: false });
}

/**
 * Vytvoří detailní porovnání dvou sessions
 * @param {Object} beforeData - Before session data
 * @param {Object} afterData - After session data
 * @returns {Object} Comparison data
 */
function createComparison(beforeData, afterData) {
    const comparison = {
        metadata: {
            beforeSession: beforeData.summary?.sessionId || 'unknown',
            afterSession: afterData.summary?.sessionId || 'unknown',
            comparisonTime: new Date().toISOString()
        },
        summary: compareSummaries(beforeData.summary, afterData.summary),
        ttk: compareTTK(beforeData.ttk, afterData.ttk),
        spawns: compareSpawns(beforeData.spawns, afterData.spawns),
        loot: compareLoot(beforeData.loot, afterData.loot),
        dps: compareDPS(beforeData.dps, afterData.dps),
        progression: compareProgression(beforeData.progression, afterData.progression),
        insights: generateComparisonInsights(beforeData, afterData)
    };
    
    return comparison;
}

/**
 * Porovná základní summary metriky
 * @param {Object} before - Before summary
 * @param {Object} after - After summary
 * @returns {Object} Summary comparison
 */
function compareSummaries(before, after) {
    const comparison = {
        sessionDuration: createMetricComparison(before?.sessionDuration || 0, after?.sessionDuration || 0, 'seconds'),
        totalKills: createMetricComparison(before?.totalKills || 0, after?.totalKills || 0, 'count'),
        totalSpawns: createMetricComparison(before?.totalSpawns || 0, after?.totalSpawns || 0, 'count'),
        totalLoot: createMetricComparison(before?.totalLoot || 0, after?.totalLoot || 0, 'count'),
        finalLevel: createMetricComparison(before?.finalLevel || 1, after?.finalLevel || 1, 'level'),
        finalXP: createMetricComparison(before?.finalXP || 0, after?.finalXP || 0, 'xp'),
        totalDamageDealt: createMetricComparison(before?.totalDamageDealt || 0, after?.totalDamageDealt || 0, 'damage'),
        totalDamageTaken: createMetricComparison(before?.totalDamageTaken || 0, after?.totalDamageTaken || 0, 'damage')
    };
    
    return comparison;
}

/**
 * Porovná TTK metriky
 * @param {Object} before - Before TTK
 * @param {Object} after - After TTK
 * @returns {Object} TTK comparison
 */
function compareTTK(before, after) {
    const comparison = {
        total: createMetricComparison(before?.total || 0, after?.total || 0, 'count'),
        median: createMetricComparison(before?.median || 0, after?.median || 0, 'seconds'),
        mean: createMetricComparison(before?.mean || 0, after?.mean || 0, 'seconds'),
        p90: createMetricComparison(before?.p90 || 0, after?.p90 || 0, 'seconds'),
        min: createMetricComparison(before?.min || 0, after?.min || 0, 'seconds'),
        max: createMetricComparison(before?.max || 0, after?.max || 0, 'seconds'),
        byType: {}
    };
    
    // Porovnej TTK podle typu
    const allTypes = new Set([
        ...Object.keys(before?.byType || {}),
        ...Object.keys(after?.byType || {})
    ]);
    
    allTypes.forEach(type => {
        const beforeType = before?.byType?.[type];
        const afterType = after?.byType?.[type];
        
        comparison.byType[type] = {
            count: createMetricComparison(beforeType?.count || 0, afterType?.count || 0, 'count'),
            median: createMetricComparison(beforeType?.median || 0, afterType?.median || 0, 'seconds'),
            mean: createMetricComparison(beforeType?.mean || 0, afterType?.mean || 0, 'seconds')
        };
    });
    
    return comparison;
}

/**
 * Porovná spawns metriky
 * @param {Object} before - Before spawns
 * @param {Object} after - After spawns
 * @returns {Object} Spawns comparison
 */
function compareSpawns(before, after) {
    const comparison = {
        total: createMetricComparison(before?.total || 0, after?.total || 0, 'count'),
        rate: createMetricComparison(before?.rate || 0, after?.rate || 0, 'per_minute'),
        byType: {}
    };
    
    // Porovnej spawns podle typu
    const allTypes = new Set([
        ...Object.keys(before?.byType || {}),
        ...Object.keys(after?.byType || {})
    ]);
    
    allTypes.forEach(type => {
        const beforeCount = before?.byType?.[type] || 0;
        const afterCount = after?.byType?.[type] || 0;
        
        comparison.byType[type] = createMetricComparison(beforeCount, afterCount, 'count');
    });
    
    return comparison;
}

/**
 * Porovná loot metriky
 * @param {Object} before - Before loot
 * @param {Object} after - After loot
 * @returns {Object} Loot comparison
 */
function compareLoot(before, after) {
    const comparison = {
        total: createMetricComparison(before?.total || 0, after?.total || 0, 'count'),
        rate: createMetricComparison(before?.rate || 0, after?.rate || 0, 'per_minute'),
        byRarity: {},
        bySource: {}
    };
    
    // Porovnej podle rarity
    const allRarities = new Set([
        ...Object.keys(before?.byRarity || {}),
        ...Object.keys(after?.byRarity || {})
    ]);
    
    allRarities.forEach(rarity => {
        const beforeCount = before?.byRarity?.[rarity] || 0;
        const afterCount = after?.byRarity?.[rarity] || 0;
        
        comparison.byRarity[rarity] = createMetricComparison(beforeCount, afterCount, 'count');
    });
    
    // Porovnej podle zdroje
    const allSources = new Set([
        ...Object.keys(before?.bySource || {}),
        ...Object.keys(after?.bySource || {})
    ]);
    
    allSources.forEach(source => {
        const beforeCount = before?.bySource?.[source] || 0;
        const afterCount = after?.bySource?.[source] || 0;
        
        comparison.bySource[source] = createMetricComparison(beforeCount, afterCount, 'count');
    });
    
    return comparison;
}

/**
 * Porovná DPS metriky
 * @param {Object} before - Before DPS
 * @param {Object} after - After DPS
 * @returns {Object} DPS comparison
 */
function compareDPS(before, after) {
    return {
        avgPlayerDPS: createMetricComparison(before?.avgPlayerDPS || 0, after?.avgPlayerDPS || 0, 'dps'),
        maxPlayerDPS: createMetricComparison(before?.maxPlayerDPS || 0, after?.maxPlayerDPS || 0, 'dps'),
        avgIncomingDPS: createMetricComparison(before?.avgIncomingDPS || 0, after?.avgIncomingDPS || 0, 'dps'),
        maxIncomingDPS: createMetricComparison(before?.maxIncomingDPS || 0, after?.maxIncomingDPS || 0, 'dps'),
        dpsRatio: createMetricComparison(
            (before?.avgPlayerDPS || 0) / Math.max(before?.avgIncomingDPS || 1, 1),
            (after?.avgPlayerDPS || 0) / Math.max(after?.avgIncomingDPS || 1, 1),
            'ratio'
        )
    };
}

/**
 * Porovná progression metriky
 * @param {Object} before - Before progression
 * @param {Object} after - After progression
 * @returns {Object} Progression comparison
 */
function compareProgression(before, after) {
    const beforeLevels = before?.levelTimeline?.length || 0;
    const afterLevels = after?.levelTimeline?.length || 0;
    
    const beforePowerups = new Set((before?.activePowerups || []).map(p => p.id)).size;
    const afterPowerups = new Set((after?.activePowerups || []).map(p => p.id)).size;
    
    return {
        levelMilestones: createMetricComparison(beforeLevels, afterLevels, 'count'),
        uniquePowerups: createMetricComparison(beforePowerups, afterPowerups, 'count'),
        totalMilestones: createMetricComparison(
            before?.milestones?.length || 0,
            after?.milestones?.length || 0,
            'count'
        )
    };
}

/**
 * Vytvoří porovnání jedné metriky
 * @param {number} before - Hodnota před
 * @param {number} after - Hodnota po
 * @param {string} unit - Jednotka
 * @returns {Object} Metric comparison
 */
function createMetricComparison(before, after, unit) {
    const absolute = after - before;
    const relative = before !== 0 ? ((after - before) / before) * 100 : (after > 0 ? 100 : 0);
    
    let trend = 'stable';
    if (Math.abs(relative) >= 5) {
        trend = relative > 0 ? 'increase' : 'decrease';
    }
    
    let significance = 'minor';
    if (Math.abs(relative) >= 20) {
        significance = 'major';
    } else if (Math.abs(relative) >= 10) {
        significance = 'moderate';
    }
    
    return {
        before: Math.round(before * 100) / 100,
        after: Math.round(after * 100) / 100,
        absolute: Math.round(absolute * 100) / 100,
        relative: Math.round(relative * 10) / 10,
        unit,
        trend,
        significance
    };
}

/**
 * Generuje insights z porovnání
 * @param {Object} beforeData - Before data
 * @param {Object} afterData - After data
 * @returns {Object} Comparison insights
 */
function generateComparisonInsights(beforeData, afterData) {
    const insights = {
        improvements: [],
        regressions: [],
        observations: []
    };
    
    // TTK insights
    const beforeTTK = beforeData.ttk?.median || 0;
    const afterTTK = afterData.ttk?.median || 0;
    const ttkChange = ((afterTTK - beforeTTK) / beforeTTK) * 100;
    
    if (Math.abs(ttkChange) >= 10) {
        if (ttkChange < 0) {
            insights.improvements.push(`TTK se zlepšilo o ${Math.abs(ttkChange).toFixed(1)}% (${beforeTTK.toFixed(2)}s → ${afterTTK.toFixed(2)}s)`);
        } else {
            insights.regressions.push(`TTK se zhoršilo o ${ttkChange.toFixed(1)}% (${beforeTTK.toFixed(2)}s → ${afterTTK.toFixed(2)}s)`);
        }
    }
    
    // Loot rate insights
    const beforeLootRate = beforeData.loot?.rate || 0;
    const afterLootRate = afterData.loot?.rate || 0;
    const lootChange = ((afterLootRate - beforeLootRate) / beforeLootRate) * 100;
    
    if (Math.abs(lootChange) >= 15) {
        if (lootChange > 0) {
            insights.improvements.push(`Loot rate zvýšen o ${lootChange.toFixed(1)}% (${beforeLootRate.toFixed(1)} → ${afterLootRate.toFixed(1)}/min)`);
        } else {
            insights.regressions.push(`Loot rate snížen o ${Math.abs(lootChange).toFixed(1)}% (${beforeLootRate.toFixed(1)} → ${afterLootRate.toFixed(1)}/min)`);
        }
    }
    
    // Session duration insights
    const beforeDuration = beforeData.summary?.sessionDuration || 0;
    const afterDuration = afterData.summary?.sessionDuration || 0;
    const durationChange = ((afterDuration - beforeDuration) / beforeDuration) * 100;
    
    if (Math.abs(durationChange) >= 20) {
        if (durationChange > 0) {
            insights.observations.push(`Session délka vzrostla o ${durationChange.toFixed(1)}% - možná lepší engagement`);
        } else {
            insights.observations.push(`Session délka klesla o ${Math.abs(durationChange).toFixed(1)}% - možná vyšší difficulty`);
        }
    }
    
    // DPS balance insights
    const beforePlayerDPS = beforeData.dps?.avgPlayerDPS || 0;
    const afterPlayerDPS = afterData.dps?.avgPlayerDPS || 0;
    const beforeIncomingDPS = beforeData.dps?.avgIncomingDPS || 0;
    const afterIncomingDPS = afterData.dps?.avgIncomingDPS || 0;
    
    const beforeRatio = beforePlayerDPS / Math.max(beforeIncomingDPS, 1);
    const afterRatio = afterPlayerDPS / Math.max(afterIncomingDPS, 1);
    
    if (Math.abs(afterRatio - beforeRatio) >= 0.3) {
        if (afterRatio > beforeRatio) {
            insights.observations.push(`DPS balance posun ve prospěch hráče (${beforeRatio.toFixed(1)} → ${afterRatio.toFixed(1)})`);
        } else {
            insights.observations.push(`DPS balance posun proti hráči (${beforeRatio.toFixed(1)} → ${afterRatio.toFixed(1)})`);
        }
    }
    
    return insights;
}

/**
 * Generuje Markdown comparison report
 * @param {Object} comparison - Comparison data
 * @returns {string} Markdown obsah
 */
function generateComparisonMarkdown(comparison) {
    const { metadata, summary, ttk, spawns, loot, dps, progression, insights } = comparison;
    
    return `# 🔄 Session Comparison Report

**Before Session:** \`${metadata.beforeSession}\`  
**After Session:** \`${metadata.afterSession}\`  
**Comparison Time:** ${new Date(metadata.comparisonTime).toLocaleString('cs-CZ')}

---

## 📊 Summary Changes

| Metrika | Before | After | Change | Trend |
|---------|--------|-------|--------|-------|
| Session Duration | ${formatMetric(summary.sessionDuration)} | | ${formatChange(summary.sessionDuration)} | ${getTrendEmoji(summary.sessionDuration.trend)} |
| Total Kills | ${formatMetric(summary.totalKills)} | | ${formatChange(summary.totalKills)} | ${getTrendEmoji(summary.totalKills.trend)} |
| Total Spawns | ${formatMetric(summary.totalSpawns)} | | ${formatChange(summary.totalSpawns)} | ${getTrendEmoji(summary.totalSpawns.trend)} |
| Total Loot | ${formatMetric(summary.totalLoot)} | | ${formatChange(summary.totalLoot)} | ${getTrendEmoji(summary.totalLoot.trend)} |
| Final Level | ${formatMetric(summary.finalLevel)} | | ${formatChange(summary.finalLevel)} | ${getTrendEmoji(summary.finalLevel.trend)} |
| Final XP | ${formatMetric(summary.finalXP)} | | ${formatChange(summary.finalXP)} | ${getTrendEmoji(summary.finalXP.trend)} |

## ⚡ TTK Changes

| Metrika | Before | After | Change | Significance |
|---------|--------|-------|--------|-------------|
| Total Samples | ${ttk.total.before.toLocaleString('cs-CZ')} | ${ttk.total.after.toLocaleString('cs-CZ')} | ${formatChange(ttk.total)} | ${getSignificanceEmoji(ttk.total.significance)} |
| Median TTK | ${ttk.median.before.toFixed(2)}s | ${ttk.median.after.toFixed(2)}s | ${formatChange(ttk.median)} | ${getSignificanceEmoji(ttk.median.significance)} |
| Mean TTK | ${ttk.mean.before.toFixed(2)}s | ${ttk.mean.after.toFixed(2)}s | ${formatChange(ttk.mean)} | ${getSignificanceEmoji(ttk.mean.significance)} |
| P90 TTK | ${ttk.p90.before.toFixed(2)}s | ${ttk.p90.after.toFixed(2)}s | ${formatChange(ttk.p90)} | ${getSignificanceEmoji(ttk.p90.significance)} |

### TTK by Enemy Type

${Object.entries(ttk.byType).map(([type, data]) => 
`- **${getEnemyTypeName(type)}:** ${data.median.before.toFixed(2)}s → ${data.median.after.toFixed(2)}s (${formatChange(data.median)})`
).join('\n')}

## 🎭 Spawns Changes

| Metrika | Before | After | Change |
|---------|--------|-------|--------|
| Total Spawns | ${spawns.total.before.toLocaleString('cs-CZ')} | ${spawns.total.after.toLocaleString('cs-CZ')} | ${formatChange(spawns.total)} |
| Spawns/min | ${spawns.rate.before.toFixed(1)} | ${spawns.rate.after.toFixed(1)} | ${formatChange(spawns.rate)} |

### Spawns by Type

${Object.entries(spawns.byType).map(([type, data]) => 
`- **${getEnemyTypeName(type)}:** ${data.before} → ${data.after} (${formatChange(data)})`
).join('\n')}

## 🎁 Loot Changes

| Metrika | Before | After | Change |
|---------|--------|-------|--------|
| Total Loot | ${loot.total.before.toLocaleString('cs-CZ')} | ${loot.total.after.toLocaleString('cs-CZ')} | ${formatChange(loot.total)} |
| Loot/min | ${loot.rate.before.toFixed(1)} | ${loot.rate.after.toFixed(1)} | ${formatChange(loot.rate)} |

### Loot by Rarity

${Object.entries(loot.byRarity).map(([rarity, data]) => 
`- **${getLootRarityName(rarity)}:** ${data.before} → ${data.after} (${formatChange(data)})`
).join('\n')}

## 🔥 DPS Changes

| Metrika | Before | After | Change |
|---------|--------|-------|--------|
| Avg Player DPS | ${dps.avgPlayerDPS.before.toFixed(1)} | ${dps.avgPlayerDPS.after.toFixed(1)} | ${formatChange(dps.avgPlayerDPS)} |
| Avg Incoming DPS | ${dps.avgIncomingDPS.before.toFixed(1)} | ${dps.avgIncomingDPS.after.toFixed(1)} | ${formatChange(dps.avgIncomingDPS)} |
| DPS Ratio | ${dps.dpsRatio.before.toFixed(1)}:1 | ${dps.dpsRatio.after.toFixed(1)}:1 | ${formatChange(dps.dpsRatio)} |

## 📈 Progression Changes

| Metrika | Before | After | Change |
|---------|--------|-------|--------|
| Level Milestones | ${progression.levelMilestones.before} | ${progression.levelMilestones.after} | ${formatChange(progression.levelMilestones)} |
| Unique Powerups | ${progression.uniquePowerups.before} | ${progression.uniquePowerups.after} | ${formatChange(progression.uniquePowerups)} |

## 💡 Key Insights

${insights.improvements.length > 0 ? `### ✅ Improvements
${insights.improvements.map(imp => `- ${imp}`).join('\n')}
` : ''}

${insights.regressions.length > 0 ? `### ❌ Regressions
${insights.regressions.map(reg => `- ${reg}`).join('\n')}
` : ''}

${insights.observations.length > 0 ? `### 👀 Observations
${insights.observations.map(obs => `- ${obs}`).join('\n')}
` : ''}

---

**Generated:** ${new Date().toLocaleString('cs-CZ')} by Telemetry Analyzer CompareRuns
`;
}

/**
 * Generuje CSV soubory pro Excel/Sheets
 * @param {Object} comparison - Comparison data
 * @param {string} outputDir - Output directory
 * @returns {Promise<Object>} Paths to CSV files
 */
async function generateComparisonCSV(comparison, outputDir) {
    const csvFiles = {};
    
    // TTK comparison CSV
    const ttkCSV = generateTTKComparisonCSV(comparison.ttk);
    const ttkPath = join(outputDir, 'ttk_comparison.csv');
    await writeFile(ttkPath, ttkCSV, 'utf8');
    csvFiles.ttk = ttkPath;
    
    // Summary comparison CSV
    const summaryCSV = generateSummaryComparisonCSV(comparison.summary);
    const summaryPath = join(outputDir, 'summary_comparison.csv');
    await writeFile(summaryPath, summaryCSV, 'utf8');
    csvFiles.summary = summaryPath;
    
    return csvFiles;
}

/**
 * Generuje TTK comparison CSV
 * @param {Object} ttkData - TTK comparison data
 * @returns {string} CSV content
 */
function generateTTKComparisonCSV(ttkData) {
    let csv = 'Metric,Before,After,Absolute Change,Relative Change (%),Trend,Significance\n';
    
    const metrics = [
        ['Total Samples', ttkData.total],
        ['Median TTK (s)', ttkData.median],
        ['Mean TTK (s)', ttkData.mean],
        ['P90 TTK (s)', ttkData.p90],
        ['Min TTK (s)', ttkData.min],
        ['Max TTK (s)', ttkData.max]
    ];
    
    metrics.forEach(([name, data]) => {
        csv += `${name},${data.before},${data.after},${data.absolute},${data.relative},${data.trend},${data.significance}\n`;
    });
    
    // Add by-type data
    csv += '\nEnemy Type,Metric,Before,After,Absolute Change,Relative Change (%)\n';
    Object.entries(ttkData.byType).forEach(([type, typeData]) => {
        csv += `${getEnemyTypeName(type)},Count,${typeData.count.before},${typeData.count.after},${typeData.count.absolute},${typeData.count.relative}\n`;
        csv += `${getEnemyTypeName(type)},Median,${typeData.median.before},${typeData.median.after},${typeData.median.absolute},${typeData.median.relative}\n`;
        csv += `${getEnemyTypeName(type)},Mean,${typeData.mean.before},${typeData.mean.after},${typeData.mean.absolute},${typeData.mean.relative}\n`;
    });
    
    return csv;
}

/**
 * Generuje Summary comparison CSV
 * @param {Object} summaryData - Summary comparison data
 * @returns {string} CSV content
 */
function generateSummaryComparisonCSV(summaryData) {
    let csv = 'Metric,Before,After,Absolute Change,Relative Change (%),Unit,Trend,Significance\n';
    
    const metrics = [
        ['Session Duration', summaryData.sessionDuration],
        ['Total Kills', summaryData.totalKills],
        ['Total Spawns', summaryData.totalSpawns],
        ['Total Loot', summaryData.totalLoot],
        ['Final Level', summaryData.finalLevel],
        ['Final XP', summaryData.finalXP],
        ['Total Damage Dealt', summaryData.totalDamageDealt],
        ['Total Damage Taken', summaryData.totalDamageTaken]
    ];
    
    metrics.forEach(([name, data]) => {
        csv += `${name},${data.before},${data.after},${data.absolute},${data.relative},${data.unit},${data.trend},${data.significance}\n`;
    });
    
    return csv;
}

// Helper funkce pro formátování

function formatMetric(metric) {
    if (metric.unit === 'seconds') {
        return metric.before < 60 ? `${metric.before}s` : `${Math.round(metric.before / 60)}m`;
    }
    return metric.before.toLocaleString('cs-CZ');
}

function formatChange(metric) {
    const sign = metric.relative >= 0 ? '+' : '';
    return `${sign}${metric.relative.toFixed(1)}%`;
}

function getTrendEmoji(trend) {
    switch (trend) {
        case 'increase': return '📈';
        case 'decrease': return '📉';
        default: return '➡️';
    }
}

function getSignificanceEmoji(significance) {
    switch (significance) {
        case 'major': return '🔴';
        case 'moderate': return '🟡';
        default: return '🟢';
    }
}

function getEnemyTypeName(type) {
    const names = {
        'enemy': 'Běžný',
        'elite': 'Elite',
        'miniboss': 'Mini-boss',
        'boss': 'Boss',
        'unique': 'Unique'
    };
    return names[type] || type;
}

function getLootRarityName(rarity) {
    const names = {
        'common': 'Běžný',
        'uncommon': 'Neobvyklý',
        'rare': 'Vzácný',
        'epic': 'Epický',
        'legendary': 'Legendární'
    };
    return names[rarity] || rarity;
}