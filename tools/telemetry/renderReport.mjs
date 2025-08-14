/**
 * RenderReport - Renderování Markdown a HTML reportů z telemetrických dat
 * 
 * Vytváří strukturované reporty s grafy, tabulkami a doporučeními
 * podle požadované sekvenční struktury.
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Renderuje telemetrický report do Markdown a volitelně HTML
 * @param {Object} reportData - Data pro report
 * @param {string} outputPath - Cesta pro výstup
 * @param {Object} options - Možnosti renderování
 */
export async function renderReport(reportData, outputPath, options = {}) {
    const opts = {
        generateHtml: false,
        isAggregate: false,
        verbose: false,
        ...options
    };
    
    if (opts.verbose) {
        console.log(`📝 Renderuji ${opts.isAggregate ? 'agregovaný' : 'session'} report...`);
    }
    
    // Generuj Markdown report
    const markdownContent = opts.isAggregate ? 
        generateAggregateMarkdown(reportData) : 
        generateSessionMarkdown(reportData);
    
    const markdownPath = join(outputPath, 'report.md');
    await writeFile(markdownPath, markdownContent, 'utf8');
    
    if (opts.verbose) {
        console.log(`✅ Markdown report uložen: ${markdownPath}`);
    }
    
    // Generuj summary.json
    const summaryData = extractSummaryData(reportData, opts.isAggregate);
    const summaryPath = join(outputPath, 'summary.json');
    await writeFile(summaryPath, JSON.stringify(summaryData, null, 2), 'utf8');
    
    if (opts.verbose) {
        console.log(`✅ Summary JSON uložen: ${summaryPath}`);
    }
    
    // Generuj HTML report pokud je požadován
    if (opts.generateHtml) {
        const htmlContent = markdownToHtml(markdownContent, reportData);
        const htmlPath = join(outputPath, 'report.html');
        await writeFile(htmlPath, htmlContent, 'utf8');
        
        if (opts.verbose) {
            console.log(`✅ HTML report uložen: ${htmlPath}`);
        }
    }
    
    return {
        markdown: markdownPath,
        summary: summaryPath,
        html: opts.generateHtml ? join(outputPath, 'report.html') : null
    };
}

/**
 * Generuje Markdown report pro jednu session
 * @param {Object} reportData - Data reportu
 * @returns {string} Markdown obsah
 */
function generateSessionMarkdown(reportData) {
    const { sessionId, aggregatedData, chartPaths, insights, metadata } = reportData;
    const data = aggregatedData;
    
    return `# 📊 Telemetrický Report - ${sessionId}

**Vygenerováno:** ${new Date(metadata.generatedAt).toLocaleString('cs-CZ')}  
**Session ID:** \`${sessionId}\`  
**Celkem eventů:** ${metadata.totalEvents.toLocaleString('cs-CZ')}  
**Doba analýzy:** ${metadata.analysisTime}ms  

---

## 1. 📋 Přehled Session

${generateOverviewSection(data)}

## 2. 🎯 Traffic Light Status

${generateTrafficLightSection(data)}

## 3. ⚡ TTK Analýza (Time To Kill)

${generateTTKSection(data, chartPaths)}

## 4. 🎭 Spawns Timeline

${generateSpawnsSection(data, chartPaths)}

## 5. 🎁 Loot Distribuce

${generateLootSection(data, chartPaths)}

## 6. 🔥 DPS vs TTK Analýza

${generateDPSSection(data, chartPaths)}

## 7. 📈 Progrese Hráče

${generateProgressionSection(data, chartPaths)}

## 8. ⭐ NG+ Porovnání

${generateNGPlusSection(data, chartPaths)}

## 9. 💡 Doporučení

${generateRecommendationsSection(insights)}

---

**Metadata:**  
- Eventy zpracovány: ${metadata.totalEvents}/${metadata.originalEvents}
- NG+ filtr: ${metadata.ngFilter !== null ? `NG+${metadata.ngFilter}` : 'Žádný'}
- Rolling window: ${data.metadata.rollingWindow}s
- Vygenerováno pomocí [Rakvinobijec Telemetry Analyzer](../scripts/analyze-telemetry.mjs)

`;
}

/**
 * Generuje Markdown report pro agregované data
 * @param {Object} reportData - Data reportu
 * @returns {string} Markdown obsah
 */
function generateAggregateMarkdown(reportData) {
    const { sessionIds, aggregatedData, chartPaths, insights, metadata } = reportData;
    const data = aggregatedData;
    
    return `# 📊 Agregovaný Telemetrický Report

**Vygenerováno:** ${new Date(metadata.generatedAt).toLocaleString('cs-CZ')}  
**Počet sessions:** ${metadata.totalSessions}  
**Celkem eventů:** ${metadata.totalEvents.toLocaleString('cs-CZ')}  
**Celkem chyb:** ${metadata.totalErrors}  

---

## 1. 📋 Souhrn Sessions

${generateAggregateOverviewSection(data)}

## 2. 📊 Srovnání Sessions

${generateSessionComparisonSection(data)}

## 3. ⚡ TTK Srovnání

${generateAggregateTTKSection(data, chartPaths)}

## 4. 🎭 Spawns Srovnání

${generateAggregateSpawnsSection(data, chartPaths)}

## 5. 🎁 Loot Srovnání

${generateAggregateLootSection(data, chartPaths)}

## 6. ⭐ NG+ Breakdown

${generateAggregateNGPlusSection(data, chartPaths)}

## 7. 💡 Multi-Session Insights

${generateAggregateRecommendationsSection(insights)}

---

**Sessions analyzované:**
${sessionIds.map(id => `- \`${id}\``).join('\n')}

**Metadata:**  
- Celkem sessions: ${metadata.totalSessions}
- Úspěšné: ${metadata.totalSessions - metadata.totalErrors}
- Chybné: ${metadata.totalErrors}
- Doba analýzy: ${metadata.analysisTime}ms

`;
}

/**
 * Generuje přehled session
 * @param {Object} data - Agregovaná data
 * @returns {string} Markdown obsah
 */
function generateOverviewSection(data) {
    const summary = data.summary;
    
    return `
| Metrika | Hodnota |
|---------|---------|
| 🕒 **Délka session** | ${formatTime(summary.sessionDuration)} |
| 🎮 **Dosažena stage** | Stage ${summary.reachedStage} |
| 🆙 **Finální level** | Level ${summary.finalLevel} (${summary.finalXP.toLocaleString('cs-CZ')} XP) |
| ⭐ **NG+ úroveň** | ${summary.ngPlusLevel > 0 ? `NG+${summary.ngPlusLevel}` : 'Standardní'} |
| 💀 **Celkem zabití** | ${summary.totalKills.toLocaleString('cs-CZ')} |
| 👾 **Celkem spawnů** | ${summary.totalSpawns.toLocaleString('cs-CZ')} |
| 🎁 **Celkem lootr** | ${summary.totalLoot.toLocaleString('cs-CZ')} |
| ⚔️ **Damage dealt** | ${summary.totalDamageDealt.toLocaleString('cs-CZ')} |
| 🩸 **Damage taken** | ${summary.totalDamageTaken.toLocaleString('cs-CZ')} |
| 🏁 **Důvod ukončení** | ${formatCompletionReason(summary.completionReason)} |
`;
}

/**
 * Generuje traffic light status sekci
 * @param {Object} data - Agregovaná data
 * @returns {string} Markdown obsah
 */
function generateTrafficLightSection(data) {
    if (!data.ttk.targetComparison || Object.keys(data.ttk.targetComparison).length === 0) {
        return '⚠️ **Nedostatek dat pro vyhodnocení TTK cílů**\n\nPro traffic light analýzu je potřeba alespoň několik TTK eventů s informací o player level.';
    }
    
    let section = '| Level | Cíl TTK | Skutečné TTK | Status | Odchylka |\n';
    section += '|-------|---------|--------------|--------|----------|\n';
    
    Object.entries(data.ttk.targetComparison).forEach(([levelKey, comparison]) => {
        const level = levelKey.replace('level', '');
        const statusEmoji = getStatusEmoji(comparison.status);
        const deviation = comparison.deviation > 0 ? 
            `+${comparison.deviation.toFixed(1)}%` : 
            `${comparison.deviation.toFixed(1)}%`;
        
        section += `| L${level} | ${comparison.target.toFixed(1)}s | ${comparison.median.toFixed(2)}s | ${statusEmoji} | ${deviation} |\n`;
    });
    
    return section;
}

/**
 * Generuje TTK analýzu
 * @param {Object} data - Agregovaná data
 * @param {Object} chartPaths - Cesty ke grafům
 * @returns {string} Markdown obsah
 */
function generateTTKSection(data, chartPaths) {
    const ttk = data.ttk;
    
    if (ttk.total === 0) {
        return '⚠️ **Žádná TTK data k analýze**';
    }
    
    let section = `
### 🎯 Klíčové TTK Metriky

| Metrika | Hodnota |
|---------|---------|
| **Celkem vzorků** | ${ttk.total.toLocaleString('cs-CZ')} |
| **Medián TTK** | ${ttk.median.toFixed(2)}s |
| **Průměr TTK** | ${ttk.mean.toFixed(2)}s |
| **90. percentil** | ${ttk.p90.toFixed(2)}s |
| **Min / Max** | ${ttk.min.toFixed(2)}s / ${ttk.max.toFixed(2)}s |

`;
    
    // TTK podle typu nepřítele
    if (Object.keys(ttk.byType).length > 0) {
        section += '\n### 👾 TTK podle typu nepřítele\n\n';
        section += '| Typ | Počet | Medián | Průměr | P90 |\n';
        section += '|-----|-------|--------|--------|----- |\n';
        
        Object.entries(ttk.byType).forEach(([type, typeData]) => {
            const typeName = getEnemyTypeName(type);
            section += `| ${typeName} | ${typeData.count} | ${typeData.median.toFixed(2)}s | ${typeData.mean.toFixed(2)}s | ${typeData.p90.toFixed(2)}s |\n`;
        });
    }
    
    // Graf reference
    if (chartPaths.ttkHistogram) {
        section += `\n![TTK Histogram](charts/${chartPaths.ttkHistogram})\n`;
    }
    
    if (chartPaths.ttkBoxplot) {
        section += `\n![TTK Boxplot podle typu](charts/${chartPaths.ttkBoxplot})\n`;
    }
    
    if (chartPaths.ttkTimeline) {
        section += `\n![TTK Timeline (rolling ${data.metadata.rollingWindow}s)](charts/${chartPaths.ttkTimeline})\n`;
    }
    
    return section;
}

/**
 * Generuje spawns analýzu
 * @param {Object} data - Agregovaná data
 * @param {Object} chartPaths - Cesty ke grafům
 * @returns {string} Markdown obsah
 */
function generateSpawnsSection(data, chartPaths) {
    const spawns = data.spawns;
    
    let section = `
### 🎭 Spawns Metriky

| Metrika | Hodnota |
|---------|---------|
| **Celkem spawnů** | ${spawns.total.toLocaleString('cs-CZ')} |
| **Spawns/min** | ${spawns.rate.toFixed(1)} |

`;
    
    // Spawns podle typu
    if (Object.keys(spawns.byType).length > 0) {
        section += '\n### 👾 Spawns podle typu\n\n';
        section += '| Typ | Počet | Podíl |\n';
        section += '|-----|-------|-------|\n';
        
        const total = spawns.total;
        Object.entries(spawns.byType).forEach(([type, count]) => {
            const typeName = getEnemyTypeName(type);
            const percentage = ((count / total) * 100).toFixed(1);
            section += `| ${typeName} | ${count.toLocaleString('cs-CZ')} | ${percentage}% |\n`;
        });
    }
    
    // Boss/Miniboss momenty
    if (spawns.bossSpawns.length > 0) {
        section += '\n### 👑 Boss & Miniboss spawny\n\n';
        spawns.bossSpawns.forEach(boss => {
            const typeName = getEnemyTypeName(boss.entityType);
            section += `- **${formatTime(boss.gameTime)}:** ${typeName} (${boss.entityId})\n`;
        });
    }
    
    // Unique spawny
    if (spawns.uniqueSpawns.length > 0) {
        section += '\n### ✨ Unique nepřátelé\n\n';
        spawns.uniqueSpawns.forEach(unique => {
            section += `- **${formatTime(unique.gameTime)}:** ${unique.entityId}\n`;
        });
    }
    
    // Graf reference
    if (chartPaths.spawnsTimeline) {
        section += `\n![Spawns Timeline](charts/${chartPaths.spawnsTimeline})\n`;
    }
    
    return section;
}

/**
 * Generuje loot analýzu
 * @param {Object} data - Agregovaná data
 * @param {Object} chartPaths - Cesty ke grafům
 * @returns {string} Markdown obsah
 */
function generateLootSection(data, chartPaths) {
    const loot = data.loot;
    
    let section = `
### 🎁 Loot Metriky

| Metrika | Hodnota |
|---------|---------|
| **Celkem loot** | ${loot.total.toLocaleString('cs-CZ')} |
| **Loot/min** | ${loot.rate.toFixed(1)} |

`;
    
    // Loot podle rarity
    if (Object.keys(loot.byRarity).length > 0) {
        section += '\n### 💎 Loot podle rarity\n\n';
        section += '| Rarity | Počet | Podíl |\n';
        section += '|--------|-------|-------|\n';
        
        const total = loot.total;
        Object.entries(loot.byRarity).forEach(([rarity, count]) => {
            const rarityName = getLootRarityName(rarity);
            const percentage = ((count / total) * 100).toFixed(1);
            section += `| ${rarityName} | ${count.toLocaleString('cs-CZ')} | ${percentage}% |\n`;
        });
    }
    
    // Loot podle zdroje
    if (Object.keys(loot.bySource).length > 0) {
        section += '\n### 🎯 Loot podle zdroje\n\n';
        section += '| Zdroj | Počet | Drop rate |\n';
        section += '|-------|-------|-----------||\n';
        
        Object.entries(loot.bySource).forEach(([source, count]) => {
            const sourceName = getEnemyTypeName(source);
            // Drop rate by mohla být vypočtena porovnáním s kill eventy
            section += `| ${sourceName} | ${count.toLocaleString('cs-CZ')} | - |\n`;
        });
    }
    
    // Pity systém analýza
    if (loot.pityAnalysis.activations > 0) {
        section += '\n### 🎰 Pity Systém\n\n';
        section += `- **Aktivace:** ${loot.pityAnalysis.activations}\n`;
        section += `- **Průměrně zabití mezi aktivacemi:** ${loot.pityAnalysis.avgKillsBetween.toFixed(1)}\n`;
        section += `- **Detekce:** ${loot.pityAnalysis.detectionConfidence}\n`;
        
        if (loot.pityAnalysis.triggers.length > 0) {
            section += '\n**Pity triggery:**\n';
            loot.pityAnalysis.triggers.forEach(trigger => {
                section += `- **${formatTime(trigger.gameTime)}:** ${trigger.killsSinceLastLoot} zabití → ${trigger.lootDropped.length} drops\n`;
            });
        }
    }
    
    // Graf reference
    if (chartPaths.lootDistribution) {
        section += `\n![Loot Distribution](charts/${chartPaths.lootDistribution})\n`;
    }
    
    if (chartPaths.lootTimeline) {
        section += `\n![Loot Timeline](charts/${chartPaths.lootTimeline})\n`;
    }
    
    return section;
}

/**
 * Generuje DPS analýzu
 * @param {Object} data - Agregovaná data
 * @param {Object} chartPaths - Cesty ke grafům
 * @returns {string} Markdown obsah
 */
function generateDPSSection(data, chartPaths) {
    const dps = data.dps;
    
    if (dps.samples.length === 0) {
        return '⚠️ **Žádná DPS data k analýze**';
    }
    
    let section = `
### 🔥 DPS Metriky

| Metrika | Hodnota |
|---------|---------|
| **Průměrné Player DPS** | ${dps.avgPlayerDPS.toFixed(1)} |
| **Max Player DPS** | ${dps.maxPlayerDPS.toFixed(1)} |
| **Průměrné Incoming DPS** | ${dps.avgIncomingDPS.toFixed(1)} |
| **Max Incoming DPS** | ${dps.maxIncomingDPS.toFixed(1)} |
| **DPS vzorky** | ${dps.samples.length} |

`;
    
    // Korelace (pokud je dostupná)
    if (dps.correlation) {
        section += '\n### 📊 Korelace\n\n';
        section += `- **DPS vs TTK:** ${dps.correlation.dpsVsTTK || 'N/A'}\n`;
        section += `- **DPS vs Spawns:** ${dps.correlation.dpsVsSpawns || 'N/A'}\n`;
        
        if (dps.correlation.note) {
            section += `\n*${dps.correlation.note}*\n`;
        }
    }
    
    // Graf reference
    if (chartPaths.dpsTimeline) {
        section += `\n![DPS Timeline (30s sampling)](charts/${chartPaths.dpsTimeline})\n`;
    }
    
    return section;
}

/**
 * Generuje progrese analýzu
 * @param {Object} data - Agregovaná data
 * @param {Object} chartPaths - Cesty ke grafům
 * @returns {string} Markdown obsah
 */
function generateProgressionSection(data, chartPaths) {
    const progression = data.progression;
    
    if (progression.levelTimeline.length === 0) {
        return '⚠️ **Žádná progression data k analýze**';
    }
    
    let section = `
### 📈 Level Progress

`;
    
    // Level milníky
    if (progression.levelTimeline.length > 0) {
        section += '**Level milníky:**\n';
        progression.levelTimeline.forEach(level => {
            section += `- **Level ${level.level}:** ${formatTime(level.gameTime)} (${level.xp.toLocaleString('cs-CZ')} XP)\n`;
        });
        section += '\n';
    }
    
    // Power-up milníky
    if (progression.milestones.length > 0) {
        const powerupMilestones = progression.milestones.filter(m => m.type === 'powerup_acquired');
        if (powerupMilestones.length > 0) {
            section += '**Power-up milníky:**\n';
            powerupMilestones.forEach(milestone => {
                section += `- **${formatTime(milestone.gameTime)}:** ${milestone.description}\n`;
            });
            section += '\n';
        }
    }
    
    // Aktivní power-upy summary
    if (progression.activePowerups.length > 0) {
        const uniquePowerups = [...new Set(progression.activePowerups.map(p => p.id))];
        section += `**Použité power-upy:** ${uniquePowerups.join(', ')}\n\n`;
    }
    
    // Graf reference
    if (chartPaths.progressionTimeline) {
        section += `\n![Progression Timeline](charts/${chartPaths.progressionTimeline})\n`;
    }
    
    return section;
}

/**
 * Generuje NG+ analýzu
 * @param {Object} data - Agregovaná data
 * @param {Object} chartPaths - Cesty ke grafům
 * @returns {string} Markdown obsah
 */
function generateNGPlusSection(data, chartPaths) {
    const ngplus = data.ngplus;
    
    if (ngplus.levels.length <= 1) {
        return `**NG+ úroveň:** ${ngplus.levels[0] > 0 ? `NG+${ngplus.levels[0]}` : 'Standardní hra'}\n\n*Tato session obsahuje pouze jednu NG+ úroveň.*`;
    }
    
    let section = `
### ⭐ NG+ Breakdown

`;
    
    Object.entries(ngplus.segmentation).forEach(([key, ngData]) => {
        const ngLevel = ngData.ngLevel;
        const ngTitle = ngLevel > 0 ? `NG+${ngLevel}` : 'NG+0';
        
        section += `#### ${ngTitle}\n\n`;
        section += `- **Doba:** ${formatTime(ngData.duration)}\n`;
        section += `- **Eventy:** ${ngData.totalEvents.toLocaleString('cs-CZ')}\n`;
        
        if (ngData.ttk.total > 0) {
            section += `- **TTK medián:** ${ngData.ttk.median.toFixed(2)}s\n`;
        }
        
        if (ngData.spawns.total > 0) {
            section += `- **Spawns/min:** ${ngData.spawns.rate.toFixed(1)}\n`;
        }
        
        if (ngData.loot.total > 0) {
            section += `- **Loot/min:** ${ngData.loot.rate.toFixed(1)}\n`;
        }
        
        section += '\n';
    });
    
    // Graf reference
    if (chartPaths.ngplusComparison) {
        section += `\n![NG+ Comparison](charts/${chartPaths.ngplusComparison})\n`;
    }
    
    return section;
}

/**
 * Generuje doporučení
 * @param {Object} insights - Insights data
 * @returns {string} Markdown obsah
 */
function generateRecommendationsSection(insights) {
    if (!insights.recommendations || insights.recommendations.length === 0) {
        return '⚠️ **Žádná doporučení nebyla vygenerována**\n\nPro generování doporučení je potřeba více telemetrických dat.';
    }
    
    let section = '';
    
    insights.recommendations.forEach((rec, index) => {
        const priorityEmoji = getPriorityEmoji(rec.priority);
        const categoryEmoji = getCategoryEmoji(rec.category);
        
        section += `### ${priorityEmoji} ${rec.title}\n\n`;
        section += `**Kategorie:** ${categoryEmoji} ${rec.category}  \n`;
        section += `**Priorita:** ${rec.priority}  \n`;
        
        if (rec.evidence && rec.evidence.length > 0) {
            section += `**Důkazy:**\n`;
            rec.evidence.forEach(evidence => {
                section += `- ${evidence}\n`;
            });
            section += '\n';
        }
        
        section += `**Doporučení:** ${rec.recommendation}\n\n`;
        
        if (rec.expectedImprovement) {
            section += `**Očekávané zlepšení:** ${rec.expectedImprovement}\n\n`;
        }
        
        if (index < insights.recommendations.length - 1) {
            section += '---\n\n';
        }
    });
    
    return section;
}

/**
 * Generuje agregovaný přehled
 * @param {Object} data - Agregovaná data
 * @returns {string} Markdown obsah
 */
function generateAggregateOverviewSection(data) {
    const summary = data.summary;
    
    return `
| Metrika | Hodnota |
|---------|---------|
| 🔢 **Celkem sessions** | ${summary.totalSessions} |
| 🕒 **Celková doba** | ${formatTime(summary.totalDuration)} |
| 📊 **Průměrná doba** | ${formatTime(summary.avgDuration)} |
| 💀 **Celkem zabití** | ${summary.totalKills.toLocaleString('cs-CZ')} |
| 📈 **Průměrně zabití** | ${Math.round(summary.avgKills).toLocaleString('cs-CZ')} |
| ⭐ **NG+ úrovně** | ${summary.ngLevels.join(', ') || 'N/A'} |
`;
}

/**
 * Generuje srovnání sessions
 * @param {Object} data - Agregovaná data
 * @returns {string} Markdown obsah
 */
function generateSessionComparisonSection(data) {
    if (!data.comparison.sessions || data.comparison.sessions.length === 0) {
        return '⚠️ **Žádná data pro srovnání sessions**';
    }
    
    let section = `
| Session | Doba | Zabití | NG+ |
|---------|------|--------|-----|
`;
    
    data.comparison.sessions.forEach((session, index) => {
        section += `| ${session.sessionId.slice(-8)} | ${formatTime(session.duration)} | ${session.kills.toLocaleString('cs-CZ')} | ${session.ngLevel > 0 ? `NG+${session.ngLevel}` : 'NG+0'} |\n`;
    });
    
    // Srovnávací metriky
    const metrics = data.comparison.metrics;
    if (metrics && Object.keys(metrics).length > 0) {
        section += '\n### 📊 Srovnávací metriky\n\n';
        
        if (metrics.ttk) {
            section += `**TTK rozptyl:** ${metrics.ttk.variance.toFixed(3)} (${metrics.ttk.min.toFixed(2)}s - ${metrics.ttk.max.toFixed(2)}s)\n`;
        }
        
        if (metrics.spawns) {
            section += `**Spawns/min rozptyl:** ${metrics.spawns.variance.toFixed(3)} (${metrics.spawns.minRate.toFixed(1)} - ${metrics.spawns.maxRate.toFixed(1)})\n`;
        }
        
        if (metrics.loot) {
            section += `**Loot/min rozptyl:** ${metrics.loot.variance.toFixed(3)} (${metrics.loot.minRate.toFixed(1)} - ${metrics.loot.maxRate.toFixed(1)})\n`;
        }
    }
    
    return section;
}

/**
 * Generuje agregované TTK srovnání
 * @param {Object} data - Agregovaná data
 * @param {Object} chartPaths - Cesty ke grafům
 * @returns {string} Markdown obsah
 */
function generateAggregateTTKSection(data, chartPaths) {
    const ttk = data.ttk;
    
    let section = `
### ⚡ TTK Srovnání Across Sessions

| Session | Median TTK | Vzorky |
|---------|------------|---------|
`;
    
    if (ttk.bySession && ttk.bySession.length > 0) {
        ttk.bySession.forEach(session => {
            section += `| ${session.sessionId.slice(-8)} | ${session.median.toFixed(2)}s | ${session.samples.toLocaleString('cs-CZ')} |\n`;
        });
    }
    
    // Graf reference
    if (chartPaths.aggregateTTKComparison) {
        section += `\n![Aggregate TTK Comparison](charts/${chartPaths.aggregateTTKComparison})\n`;
    }
    
    return section;
}

/**
 * Generuje agregované spawns srovnání
 * @param {Object} data - Agregovaná data
 * @param {Object} chartPaths - Cesty ke grafům
 * @returns {string} Markdown obsah
 */
function generateAggregateSpawnsSection(data, chartPaths) {
    const spawns = data.spawns;
    
    let section = `
### 🎭 Spawns Srovnání

| Session | Celkem | Spawns/min |
|---------|--------|------------|
`;
    
    if (spawns.bySession && spawns.bySession.length > 0) {
        spawns.bySession.forEach(session => {
            section += `| ${session.sessionId.slice(-8)} | ${session.total.toLocaleString('cs-CZ')} | ${session.rate.toFixed(1)} |\n`;
        });
    }
    
    // Spawns podle typu napříč sessions
    if (Object.keys(spawns.byType).length > 0) {
        section += '\n### 👾 Celkové spawns podle typu\n\n';
        section += '| Typ | Celkem |\n|-----|--------|\n';
        
        Object.entries(spawns.byType).forEach(([type, count]) => {
            const typeName = getEnemyTypeName(type);
            section += `| ${typeName} | ${count.toLocaleString('cs-CZ')} |\n`;
        });
    }
    
    return section;
}

/**
 * Generuje agregované loot srovnání
 * @param {Object} data - Agregovaná data
 * @param {Object} chartPaths - Cesty ke grafům
 * @returns {string} Markdown obsah
 */
function generateAggregateLootSection(data, chartPaths) {
    const loot = data.loot;
    
    let section = `
### 🎁 Loot Srovnání

| Session | Celkem | Loot/min |
|---------|--------|----------|
`;
    
    if (loot.bySession && loot.bySession.length > 0) {
        loot.bySession.forEach(session => {
            section += `| ${session.sessionId.slice(-8)} | ${session.total.toLocaleString('cs-CZ')} | ${session.rate.toFixed(1)} |\n`;
        });
    }
    
    return section;
}

/**
 * Generuje agregované NG+ srovnání
 * @param {Object} data - Agregovaná data
 * @param {Object} chartPaths - Cesty ke grafům
 * @returns {string} Markdown obsah
 */
function generateAggregateNGPlusSection(data, chartPaths) {
    return `
### ⭐ NG+ Breakdown Across Sessions

**Analyzované NG+ úrovně:** ${data.summary.ngLevels.join(', ')}

*NG+ segmentovaná analýza bude implementována v další verzi.*
`;
}

/**
 * Generuje agregovaná doporučení
 * @param {Object} insights - Insights data
 * @returns {string} Markdown obsah
 */
function generateAggregateRecommendationsSection(insights) {
    if (!insights.multiSessionRecommendations || insights.multiSessionRecommendations.length === 0) {
        return '⚠️ **Žádná multi-session doporučení nebyla vygenerována**';
    }
    
    return generateRecommendationsSection({ 
        recommendations: insights.multiSessionRecommendations 
    });
}

/**
 * Extrahuje summary data pro JSON
 * @param {Object} reportData - Data reportu
 * @param {boolean} isAggregate - Je agregovaný report
 * @returns {Object} Summary data
 */
function extractSummaryData(reportData, isAggregate) {
    if (isAggregate) {
        return {
            type: 'aggregate',
            sessions: reportData.sessionIds.length,
            totalEvents: reportData.metadata.totalEvents,
            totalErrors: reportData.metadata.totalErrors,
            analysisTime: reportData.metadata.analysisTime,
            generatedAt: reportData.metadata.generatedAt,
            summary: reportData.aggregatedData.summary,
            comparison: reportData.aggregatedData.comparison.metrics
        };
    } else {
        return {
            type: 'session',
            sessionId: reportData.sessionId,
            totalEvents: reportData.metadata.totalEvents,
            analysisTime: reportData.metadata.analysisTime,
            generatedAt: reportData.metadata.generatedAt,
            summary: reportData.aggregatedData.summary,
            metrics: {
                ttk: {
                    median: reportData.aggregatedData.ttk.median,
                    mean: reportData.aggregatedData.ttk.mean,
                    total: reportData.aggregatedData.ttk.total
                },
                spawns: {
                    total: reportData.aggregatedData.spawns.total,
                    rate: reportData.aggregatedData.spawns.rate
                },
                loot: {
                    total: reportData.aggregatedData.loot.total,
                    rate: reportData.aggregatedData.loot.rate
                }
            }
        };
    }
}

/**
 * Převede Markdown na HTML (základní implementace)
 * @param {string} markdown - Markdown obsah
 * @param {Object} reportData - Data reportu
 * @returns {string} HTML obsah
 */
function markdownToHtml(markdown, reportData) {
    // Základní HTML template
    const htmlContent = `
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telemetrický Report - ${reportData.sessionId || 'Agregovaný'}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 40px; }
        h3 { color: #7f8c8d; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: 600; }
        img { max-width: 100%; height: auto; margin: 20px 0; }
        code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        .status-good { color: #27ae60; }
        .status-warning { color: #f39c12; }
        .status-bad { color: #e74c3c; }
        .metadata { background-color: #ecf0f1; padding: 20px; border-radius: 5px; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="container">
${convertMarkdownToHtml(markdown)}
    </div>
</body>
</html>
    `;
    
    return htmlContent;
}

/**
 * Zjednodušený Markdown → HTML konvertor
 * @param {string} markdown - Markdown text
 * @returns {string} HTML text
 */
function convertMarkdownToHtml(markdown) {
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
    
    // Code blocks
    html = html.replace(/`([^`]*)`/gim, '<code>$1</code>');
    
    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^\)]*)\)/gim, '<img alt="$1" src="$2" />');
    
    // Tables (zjednodušené)
    html = html.replace(/\|([^\n]+)\|\n\|([^\n]+)\|/gim, (match, header, separator) => {
        return `<table><thead><tr>${header.split('|').map(cell => `<th>${cell.trim()}</th>`).join('')}</tr></thead><tbody>`;
    });
    
    // Line breaks
    html = html.replace(/\n\n/gim, '</p><p>');
    html = '<p>' + html + '</p>';
    
    return html;
}

// === HELPER FUNKCE PRO FORMÁTOVÁNÍ ===

/**
 * Formátuje čas v sekundách na lidsky čitelný formát
 * @param {number} seconds - Sekundy
 * @returns {string} Formátovaný čas
 */
function formatTime(seconds) {
    if (seconds < 60) {
        return `${Math.round(seconds)}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    
    if (minutes < 60) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}

/**
 * Formátuje důvod ukončení session
 * @param {string} reason - Důvod ukončení
 * @returns {string} Formátovaný důvod
 */
function formatCompletionReason(reason) {
    const reasonMap = {
        'game_over': '💀 Game Over',
        'player_quit': '🚪 Hráč odešel',
        'session_ended': '⏹️ Session ukončena',
        'scene_shutdown': '🔄 Scene restart',
        'unknown': '❓ Neznámý'
    };
    
    return reasonMap[reason] || reason;
}

/**
 * Získá emoji pro status
 * @param {string} status - Status
 * @returns {string} Emoji
 */
function getStatusEmoji(status) {
    const statusMap = {
        'good': '✅',
        'warning': '⚠️',
        'bad': '❌'
    };
    
    return statusMap[status] || '❓';
}

/**
 * Získá název typu nepřítele
 * @param {string} type - Typ nepřítele
 * @returns {string} Název
 */
function getEnemyTypeName(type) {
    const typeMap = {
        'enemy': '👾 Běžný',
        'elite': '💀 Elite',
        'miniboss': '👑 Mini-boss',
        'boss': '🐉 Boss',
        'unique': '✨ Unique'
    };
    
    return typeMap[type] || type;
}

/**
 * Získá název rarity loot
 * @param {string} rarity - Rarity
 * @returns {string} Název
 */
function getLootRarityName(rarity) {
    const rarityMap = {
        'common': '⚪ Běžný',
        'uncommon': '🟢 Neobvyklý',
        'rare': '🔵 Vzácný',
        'epic': '🟣 Epický',
        'legendary': '🟠 Legendární'
    };
    
    return rarityMap[rarity] || rarity;
}

/**
 * Získá emoji pro prioritu
 * @param {string} priority - Priorita
 * @returns {string} Emoji
 */
function getPriorityEmoji(priority) {
    const priorityMap = {
        'high': '🔴',
        'medium': '🟡',
        'low': '🟢'
    };
    
    return priorityMap[priority] || '⚪';
}

/**
 * Získá emoji pro kategorii
 * @param {string} category - Kategorie
 * @returns {string} Emoji
 */
function getCategoryEmoji(category) {
    const categoryMap = {
        'balance': '⚖️',
        'performance': '⚡',
        'difficulty': '🎯',
        'progression': '📈',
        'loot': '🎁'
    };
    
    return categoryMap[category] || '📊';
}