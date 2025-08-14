/**
 * Insights - Heuristický systém pro generování balance doporučení
 * 
 * Analyzuje telemetrická data a generuje konkrétní doporučení pro balance
 * podle předem definovaných pravidel a cílových metrik.
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 */

/**
 * Cílové hodnoty pro balance
 */
const BALANCE_TARGETS = {
    // TTK cíle podle levelu (sekundy)
    ttk: {
        level1: 2.5,
        level2: 2.0,
        level3: 1.5
    },
    
    // Spawns/min cíle
    spawns: {
        early: 8,    // prvních 5 minut
        mid: 15,     // 5-15 minut
        late: 25     // 15+ minut
    },
    
    // Loot drop rates (%)
    loot: {
        common: 70,
        uncommon: 20,
        rare: 8,
        epic: 1.8,
        legendary: 0.2
    },
    
    // DPS balance
    dps: {
        minPlayerDPS: 50,    // minimální sustainable DPS
        maxIncomingDPS: 30,  // maximální incoming DPS pro balance
        dpsRatio: 2.0        // player:incoming ratio
    },
    
    // Session délka cíle
    session: {
        minDuration: 300,    // 5 minut minimum
        targetDuration: 1800, // 30 minut cíl
        maxDuration: 3600    // 60 minut maximum
    }
};

/**
 * Generuje insights a doporučení z agregovaných dat
 * @param {Object} aggregatedData - Agregovaná telemetrická data
 * @param {Object} options - Možnosti pro insights
 * @returns {Object} Insights a doporučení
 */
export function generateInsights(aggregatedData, options = {}) {
    const opts = {
        isMultiSession: false,
        sessionCount: 1,
        verbose: false,
        ...options
    };
    
    console.log('💡 Generuji insights a doporučení...');
    
    const insights = {
        recommendations: [],
        multiSessionRecommendations: [],
        analysis: {
            ttkAnalysis: analyzeTTK(aggregatedData.ttk),
            spawnsAnalysis: analyzeSpawns(aggregatedData.spawns),
            lootAnalysis: analyzeLoot(aggregatedData.loot),
            dpsAnalysis: analyzeDPS(aggregatedData.dps),
            progressionAnalysis: analyzeProgression(aggregatedData.progression),
            overallAnalysis: analyzeOverall(aggregatedData.summary)
        },
        metrics: {
            balanceScore: 0,
            difficultyScore: 0,
            engagementScore: 0
        }
    };
    
    // Generuj doporučení podle analýzy
    insights.recommendations = generateRecommendations(insights.analysis, aggregatedData);
    
    // Multi-session doporučení
    if (opts.isMultiSession) {
        insights.multiSessionRecommendations = generateMultiSessionRecommendations(
            aggregatedData, opts.sessionCount
        );
    }
    
    // Vypočítej celkové skóre
    insights.metrics = calculateMetrics(insights.analysis);
    
    if (opts.verbose) {
        console.log(`✅ Vygenerováno ${insights.recommendations.length} doporučení`);
        console.log(`📊 Balance Score: ${insights.metrics.balanceScore}/100`);
    }
    
    return insights;
}

/**
 * Analyzuje TTK metriky
 * @param {Object} ttkData - TTK data
 * @returns {Object} TTK analýza
 */
function analyzeTTK(ttkData) {
    const analysis = {
        status: 'unknown',
        issues: [],
        strengths: [],
        score: 50 // 0-100
    };
    
    if (!ttkData || ttkData.total === 0) {
        analysis.status = 'insufficient_data';
        analysis.issues.push('Nedostatek TTK dat pro analýzu');
        analysis.score = 0;
        return analysis;
    }
    
    // Porovnání s cílovými TTK
    const targetComparison = ttkData.targetComparison || {};
    let targetHits = 0;
    let targetMisses = 0;
    let worstDeviation = 0;
    
    Object.entries(BALANCE_TARGETS.ttk).forEach(([levelKey, target]) => {
        const comparisonKey = levelKey.replace('level', 'level');
        const comparison = targetComparison[comparisonKey];
        
        if (comparison) {
            const deviation = Math.abs(comparison.deviation);
            
            if (comparison.status === 'good') {
                targetHits++;
                analysis.strengths.push(`Level ${levelKey.replace('level', '')}: TTK v cíli (${comparison.median.toFixed(2)}s)`);
            } else {
                targetMisses++;
                worstDeviation = Math.max(worstDeviation, deviation);
                
                if (comparison.median > target) {
                    analysis.issues.push(`Level ${levelKey.replace('level', '')}: TTK příliš vysoké (${comparison.median.toFixed(2)}s vs cíl ${target}s)`);
                } else {
                    analysis.issues.push(`Level ${levelKey.replace('level', '')}: TTK příliš nízké (${comparison.median.toFixed(2)}s vs cíl ${target}s)`);
                }
            }
        }
    });
    
    // Celkové TTK hodnocení
    const overallTTK = ttkData.median;
    if (overallTTK > 3.0) {
        analysis.issues.push(`Celkový medián TTK příliš vysoký (${overallTTK.toFixed(2)}s)`);
    } else if (overallTTK < 1.0) {
        analysis.issues.push(`Celkový medián TTK příliš nízký (${overallTTK.toFixed(2)}s)`);
    } else {
        analysis.strengths.push(`Celkový medián TTK v rozumném rozmezí (${overallTTK.toFixed(2)}s)`);
    }
    
    // Rozptyl TTK
    const ttkRange = ttkData.max - ttkData.min;
    if (ttkRange > 10) {
        analysis.issues.push(`Velký rozptyl TTK (${ttkData.min.toFixed(1)}s - ${ttkData.max.toFixed(1)}s)`);
    } else {
        analysis.strengths.push(`Přijatelný rozptyl TTK (rozmezí ${ttkRange.toFixed(1)}s)`);
    }
    
    // P90 analýza (outliers)
    if (ttkData.p90 > overallTTK * 2) {
        analysis.issues.push(`90% percentil příliš vysoký (${ttkData.p90.toFixed(2)}s) - možné outlier nepřátelé`);
    }
    
    // Vypočítej skóre
    const targetScore = targetHits > 0 ? (targetHits / (targetHits + targetMisses)) * 40 : 0;
    const rangeScore = ttkRange <= 5 ? 30 : Math.max(0, 30 - (ttkRange - 5) * 3);
    const medianScore = (overallTTK >= 1.5 && overallTTK <= 2.5) ? 30 : Math.max(0, 30 - Math.abs(overallTTK - 2.0) * 10);
    
    analysis.score = Math.round(targetScore + rangeScore + medianScore);
    analysis.status = analysis.score >= 70 ? 'good' : (analysis.score >= 40 ? 'warning' : 'bad');
    
    return analysis;
}

/**
 * Analyzuje spawns metriky
 * @param {Object} spawnsData - Spawns data
 * @returns {Object} Spawns analýza
 */
function analyzeSpawns(spawnsData) {
    const analysis = {
        status: 'unknown',
        issues: [],
        strengths: [],
        score: 50
    };
    
    if (!spawnsData || spawnsData.total === 0) {
        analysis.status = 'insufficient_data';
        analysis.issues.push('Nedostatek spawns dat');
        analysis.score = 0;
        return analysis;
    }
    
    // Spawns/min analýza
    const spawnRate = spawnsData.rate;
    
    if (spawnRate < 5) {
        analysis.issues.push(`Nízká spawn rate (${spawnRate.toFixed(1)}/min) - může být nudné`);
    } else if (spawnRate > 30) {
        analysis.issues.push(`Vysoká spawn rate (${spawnRate.toFixed(1)}/min) - může být overwhelming`);
    } else {
        analysis.strengths.push(`Vhodná spawn rate (${spawnRate.toFixed(1)}/min)`);
    }
    
    // Distribuce podle typu
    const byType = spawnsData.byType || {};
    const total = spawnsData.total;
    
    // Boss/Miniboss podíl
    const bossCount = (byType.boss || 0) + (byType.miniboss || 0);
    const bossRatio = (bossCount / total) * 100;
    
    if (bossRatio < 2) {
        analysis.issues.push(`Málo boss spawnů (${bossRatio.toFixed(1)}%) - chybí výzvy`);
    } else if (bossRatio > 10) {
        analysis.issues.push(`Příliš boss spawnů (${bossRatio.toFixed(1)}%) - může být frustrující`);
    } else {
        analysis.strengths.push(`Dobrý boss podíl (${bossRatio.toFixed(1)}%)`);
    }
    
    // Elite podíl
    const eliteRatio = ((byType.elite || 0) / total) * 100;
    
    if (eliteRatio < 5) {
        analysis.issues.push(`Málo elite nepřátel (${eliteRatio.toFixed(1)}%)`);
    } else if (eliteRatio > 20) {
        analysis.issues.push(`Příliš elite nepřátel (${eliteRatio.toFixed(1)}%)`);
    } else {
        analysis.strengths.push(`Dobrý elite podíl (${eliteRatio.toFixed(1)}%)`);
    }
    
    // Timeline analýza (pokud dostupná)
    if (spawnsData.timeline && spawnsData.timeline.length > 0) {
        const timeline = spawnsData.timeline;
        const earlyMinutes = timeline.slice(0, 5);
        const lateMinutes = timeline.slice(-5);
        
        if (earlyMinutes.length === 0 || lateMinutes.length === 0) {
            return analysis; // Skip spawn escalation analysis if no data
        }
        
        const earlyAvg = earlyMinutes.reduce((sum, t) => sum + t.rate, 0) / earlyMinutes.length;
        const lateAvg = lateMinutes.reduce((sum, t) => sum + t.rate, 0) / lateMinutes.length;
        
        const escalation = lateAvg / earlyAvg;
        
        if (escalation < 1.5) {
            analysis.issues.push(`Slabá eskalace intenzity (${escalation.toFixed(1)}x)`);
        } else if (escalation > 4.0) {
            analysis.issues.push(`Příliš rychlá eskalace (${escalation.toFixed(1)}x)`);
        } else {
            analysis.strengths.push(`Dobrá eskalace intenzity (${escalation.toFixed(1)}x)`);
        }
    }
    
    // Vypočítaj skóre
    const rateScore = (spawnRate >= 10 && spawnRate <= 25) ? 40 : Math.max(0, 40 - Math.abs(spawnRate - 17.5) * 2);
    const bossScore = (bossRatio >= 3 && bossRatio <= 8) ? 30 : Math.max(0, 30 - Math.abs(bossRatio - 5.5) * 3);
    const eliteScore = (eliteRatio >= 8 && eliteRatio <= 15) ? 30 : Math.max(0, 30 - Math.abs(eliteRatio - 11.5) * 2);
    
    analysis.score = Math.round(rateScore + bossScore + eliteScore);
    analysis.status = analysis.score >= 70 ? 'good' : (analysis.score >= 40 ? 'warning' : 'bad');
    
    return analysis;
}

/**
 * Analyzuje loot metriky
 * @param {Object} lootData - Loot data
 * @returns {Object} Loot analýza
 */
function analyzeLoot(lootData) {
    const analysis = {
        status: 'unknown',
        issues: [],
        strengths: [],
        score: 50
    };
    
    if (!lootData || lootData.total === 0) {
        analysis.status = 'insufficient_data';
        analysis.issues.push('Nedostatek loot dat');
        analysis.score = 0;
        return analysis;
    }
    
    // Loot rate analýza
    const lootRate = lootData.rate;
    
    if (lootRate < 10) {
        analysis.issues.push(`Nízká loot rate (${lootRate.toFixed(1)}/min) - nedostatek odměn`);
    } else if (lootRate > 50) {
        analysis.issues.push(`Vysoká loot rate (${lootRate.toFixed(1)}/min) - může znehodnotit odměny`);
    } else {
        analysis.strengths.push(`Přiměřená loot rate (${lootRate.toFixed(1)}/min)`);
    }
    
    // Distribuce podle rarity
    const byRarity = lootData.byRarity || {};
    const total = lootData.total;
    
    Object.entries(BALANCE_TARGETS.loot).forEach(([rarity, targetPercentage]) => {
        const actualCount = byRarity[rarity] || 0;
        const actualPercentage = (actualCount / total) * 100;
        const deviation = Math.abs(actualPercentage - targetPercentage);
        
        if (deviation <= targetPercentage * 0.3) { // 30% tolerance
            analysis.strengths.push(`${rarity} loot v cíli (${actualPercentage.toFixed(1)}%)`);
        } else {
            if (actualPercentage > targetPercentage) {
                analysis.issues.push(`Příliš ${rarity} loot (${actualPercentage.toFixed(1)}% vs cíl ${targetPercentage}%)`);
            } else {
                analysis.issues.push(`Málo ${rarity} loot (${actualPercentage.toFixed(1)}% vs cíl ${targetPercentage}%)`);
            }
        }
    });
    
    // Legendary drop rate specifická analýza
    const legendaryPercentage = ((byRarity.legendary || 0) / total) * 100;
    if (legendaryPercentage > 0.5) {
        analysis.issues.push('Legendary drop rate příliš vysoká - znehodnocuje vzácnost');
    } else if (legendaryPercentage === 0 && total > 500) {
        analysis.issues.push('Žádné legendary drops při vysokém počtu loot - možný problém s drop tables');
    }
    
    // Pity systém analýza
    const pityAnalysis = lootData.pityAnalysis || {};
    if (pityAnalysis.activations > 0) {
        if (pityAnalysis.avgKillsBetween > 20) {
            analysis.issues.push(`Pity systém aktivován pozdě (${pityAnalysis.avgKillsBetween.toFixed(1)} zabití)`);
        } else {
            analysis.strengths.push(`Pity systém funguje (aktivace po ${pityAnalysis.avgKillsBetween.toFixed(1)} zabití)`);
        }
    } else if (total > 100) {
        analysis.issues.push('Pity systém nebyl aktivován - možné problémy s anti-frustration mechanikami');
    }
    
    // Vypočítaj skóre
    const rateScore = (lootRate >= 15 && lootRate <= 35) ? 30 : Math.max(0, 30 - Math.abs(lootRate - 25) * 1);
    
    let rarityScore = 0;
    Object.entries(BALANCE_TARGETS.loot).forEach(([rarity, target]) => {
        const actual = ((byRarity[rarity] || 0) / total) * 100;
        const deviation = Math.abs(actual - target) / target;
        rarityScore += Math.max(0, 14 - deviation * 14); // 70 bodů celkem / 5 rarities
    });
    
    analysis.score = Math.round(rateScore + rarityScore);
    analysis.status = analysis.score >= 70 ? 'good' : (analysis.score >= 40 ? 'warning' : 'bad');
    
    return analysis;
}

/**
 * Analyzuje DPS metriky
 * @param {Object} dpsData - DPS data
 * @returns {Object} DPS analýza
 */
function analyzeDPS(dpsData) {
    const analysis = {
        status: 'unknown',
        issues: [],
        strengths: [],
        score: 50
    };
    
    if (!dpsData || dpsData.samples.length === 0) {
        analysis.status = 'insufficient_data';
        analysis.issues.push('Nedostatek DPS dat');
        analysis.score = 20; // Není kritické
        return analysis;
    }
    
    const playerDPS = dpsData.avgPlayerDPS;
    const incomingDPS = dpsData.avgIncomingDPS;
    const dpsRatio = playerDPS / Math.max(incomingDPS, 1);
    
    // Player DPS analýza
    if (playerDPS < BALANCE_TARGETS.dps.minPlayerDPS) {
        analysis.issues.push(`Nízké player DPS (${playerDPS.toFixed(1)}) - combat může být pomalý`);
    } else if (playerDPS > BALANCE_TARGETS.dps.minPlayerDPS * 3) {
        analysis.issues.push(`Vysoké player DPS (${playerDPS.toFixed(1)}) - možná příliš snadné`);
    } else {
        analysis.strengths.push(`Player DPS v rozumném rozmezí (${playerDPS.toFixed(1)})`);
    }
    
    // Incoming DPS analýza
    if (incomingDPS > BALANCE_TARGETS.dps.maxIncomingDPS) {
        analysis.issues.push(`Vysoké incoming DPS (${incomingDPS.toFixed(1)}) - může být frustrující`);
    } else if (incomingDPS < 10) {
        analysis.issues.push(`Nízké incoming DPS (${incomingDPS.toFixed(1)}) - chybí výzva`);
    } else {
        analysis.strengths.push(`Incoming DPS vybalancované (${incomingDPS.toFixed(1)})`);
    }
    
    // DPS ratio analýza
    if (dpsRatio < 1.5) {
        analysis.issues.push(`Nízký DPS poměr (${dpsRatio.toFixed(1)}:1) - hráč má málo advantage`);
    } else if (dpsRatio > 4.0) {
        analysis.issues.push(`Vysoký DPS poměr (${dpsRatio.toFixed(1)}:1) - příliš snadné`);
    } else {
        analysis.strengths.push(`Dobrý DPS poměr (${dpsRatio.toFixed(1)}:1)`);
    }
    
    // Timeline analýza (pokud dostupná)
    if (dpsData.timeline && dpsData.timeline.length > 1) {
        const timeline = dpsData.timeline;
        const firstHalf = timeline.slice(0, Math.floor(timeline.length / 2));
        const secondHalf = timeline.slice(Math.floor(timeline.length / 2));
        
        if (firstHalf.length === 0 || secondHalf.length === 0) {
            return analysis; // Skip DPS timeline analysis if no data
        }
        
        const earlyPlayerDPS = firstHalf.reduce((sum, t) => sum + t.playerDPS, 0) / firstHalf.length;
        const latePlayerDPS = secondHalf.reduce((sum, t) => sum + t.playerDPS, 0) / secondHalf.length;
        
        const progression = latePlayerDPS / earlyPlayerDPS;
        
        if (progression < 1.2) {
            analysis.issues.push('Slabá DPS progrese - power-upy možná nedostatečné');
        } else if (progression > 3.0) {
            analysis.issues.push('Příliš rychlá DPS progrese - možná OP power-upy');
        } else {
            analysis.strengths.push(`Dobrá DPS progrese (${progression.toFixed(1)}x)`);
        }
    }
    
    // Vypočítaj skóre
    const playerScore = (playerDPS >= 50 && playerDPS <= 150) ? 30 : Math.max(0, 30 - Math.abs(playerDPS - 100) * 0.3);
    const incomingScore = (incomingDPS >= 15 && incomingDPS <= 30) ? 30 : Math.max(0, 30 - Math.abs(incomingDPS - 22.5) * 2);
    const ratioScore = (dpsRatio >= 1.8 && dpsRatio <= 3.0) ? 40 : Math.max(0, 40 - Math.abs(dpsRatio - 2.4) * 15);
    
    analysis.score = Math.round(playerScore + incomingScore + ratioScore);
    analysis.status = analysis.score >= 70 ? 'good' : (analysis.score >= 40 ? 'warning' : 'bad');
    
    return analysis;
}

/**
 * Analyzuje progrese metriky
 * @param {Object} progressionData - Progression data
 * @returns {Object} Progression analýza
 */
function analyzeProgression(progressionData) {
    const analysis = {
        status: 'unknown',
        issues: [],
        strengths: [],
        score: 50
    };
    
    if (!progressionData || progressionData.levelTimeline.length === 0) {
        analysis.status = 'insufficient_data';
        analysis.issues.push('Nedostatek progression dat');
        analysis.score = 30;
        return analysis;
    }
    
    const levelTimeline = progressionData.levelTimeline;
    const finalLevel = levelTimeline[levelTimeline.length - 1].level;
    const sessionDuration = levelTimeline[levelTimeline.length - 1].gameTime;
    
    // Level progression rate
    const levelsPerMinute = (finalLevel - 1) / (sessionDuration / 60);
    
    if (levelsPerMinute < 0.5) {
        analysis.issues.push(`Pomalá level progrese (${levelsPerMinute.toFixed(2)}/min)`);
    } else if (levelsPerMinute > 2.0) {
        analysis.issues.push(`Rychlá level progrese (${levelsPerMinute.toFixed(2)}/min) - možná příliš snadné`);
    } else {
        analysis.strengths.push(`Dobrý level progression tempo (${levelsPerMinute.toFixed(2)}/min)`);
    }
    
    // Power-up usage analýza
    const activePowerups = progressionData.activePowerups || [];
    const uniquePowerups = new Set(activePowerups.map(p => p.id)).size;
    
    if (uniquePowerups < 3) {
        analysis.issues.push('Málo různých power-upů použito - možná limited variety');
    } else if (uniquePowerups > 8) {
        analysis.strengths.push('Dobrá diverzita power-upů');
    } else {
        analysis.strengths.push('Přiměřená power-up diverzita');
    }
    
    // Milníky analýza
    const milestones = progressionData.milestones || [];
    const powerupMilestones = milestones.filter(m => m.type === 'powerup_acquired').length;
    
    if (powerupMilestones < 2) {
        analysis.issues.push('Málo power-up milníků');
    }
    
    // Vypočítaj skóre
    const rateScore = (levelsPerMinute >= 0.8 && levelsPerMinute <= 1.5) ? 50 : Math.max(0, 50 - Math.abs(levelsPerMinute - 1.15) * 25);
    const varietyScore = Math.min(50, uniquePowerups * 8);
    
    analysis.score = Math.round((rateScore + varietyScore) / 2);
    analysis.status = analysis.score >= 70 ? 'good' : (analysis.score >= 40 ? 'warning' : 'bad');
    
    return analysis;
}

/**
 * Analyzuje celkové metriky session
 * @param {Object} summaryData - Summary data
 * @returns {Object} Overall analýza
 */
function analyzeOverall(summaryData) {
    const analysis = {
        status: 'unknown',
        issues: [],
        strengths: [],
        score: 50
    };
    
    if (!summaryData) {
        analysis.status = 'insufficient_data';
        analysis.score = 0;
        return analysis;
    }
    
    const duration = summaryData.sessionDuration;
    const totalKills = summaryData.totalKills;
    const finalLevel = summaryData.finalLevel;
    const reason = summaryData.completionReason;
    
    // Session délka analýza
    if (duration < BALANCE_TARGETS.session.minDuration) {
        analysis.issues.push(`Krátká session (${Math.round(duration / 60)}min) - možná příliš těžké nebo nudné`);
    } else if (duration > BALANCE_TARGETS.session.maxDuration) {
        analysis.issues.push(`Velmi dlouhá session (${Math.round(duration / 60)}min) - možná příliš snadné`);
    } else if (duration >= BALANCE_TARGETS.session.targetDuration * 0.7) {
        analysis.strengths.push(`Dobrá session délka (${Math.round(duration / 60)}min)`);
    }
    
    // Kill rate analýza
    const killRate = totalKills / (duration / 60);
    
    if (killRate < 10) {
        analysis.issues.push(`Nízká kill rate (${killRate.toFixed(1)}/min) - možná nudné tempo`);
    } else if (killRate > 50) {
        analysis.issues.push(`Vysoká kill rate (${killRate.toFixed(1)}/min) - možná chaotické`);
    } else {
        analysis.strengths.push(`Přiměřená kill rate (${killRate.toFixed(1)}/min)`);
    }
    
    // Completion reason analýza
    if (reason === 'game_over') {
        analysis.strengths.push('Session ukončena game over - hráč byl dostatečně vyzván');
    } else if (reason === 'player_quit') {
        analysis.issues.push('Hráč odešel - možná frustrace nebo nuda');
    }
    
    // Level achievement analýza
    const levelRate = (finalLevel - 1) / (duration / 60);
    if (levelRate < 0.5) {
        analysis.issues.push('Pomalý level progression');
    } else if (levelRate > 2.0) {
        analysis.issues.push('Rychlý level progression');
    }
    
    // Vypočítaj skóre
    const durationScore = (duration >= 600 && duration <= 2400) ? 40 : Math.max(0, 40 - Math.abs(duration - 1500) * 0.02);
    const killRateScore = (killRate >= 15 && killRate <= 35) ? 30 : Math.max(0, 30 - Math.abs(killRate - 25) * 1);
    const completionScore = reason === 'game_over' ? 30 : (reason === 'session_ended' ? 20 : 10);
    
    analysis.score = Math.round(durationScore + killRateScore + completionScore);
    analysis.status = analysis.score >= 70 ? 'good' : (analysis.score >= 40 ? 'warning' : 'bad');
    
    return analysis;
}

/**
 * Generuje konkrétní doporučení na základě analýzy
 * @param {Object} analysis - Kompletní analýza
 * @param {Object} aggregatedData - Původní data
 * @returns {Array} Seznam doporučení
 */
function generateRecommendations(analysis, aggregatedData) {
    const recommendations = [];
    
    // TTK doporučení
    if (analysis.ttkAnalysis.status === 'bad') {
        analysis.ttkAnalysis.issues.forEach(issue => {
            if (issue.includes('příliš vysoké')) {
                recommendations.push({
                    priority: 'high',
                    category: 'balance',
                    title: 'Snížit HP nepřátel nebo zvýšit player damage',
                    recommendation: 'TTK je příliš vysoké. Doporučuji snížit HP běžných nepřátel o 15-20% nebo zvýšit base damage hráče o 10-15%.',
                    evidence: [issue],
                    expectedImprovement: 'TTK by mělo klesnout na cílové hodnoty, zlepšit flow combatu'
                });
            } else if (issue.includes('příliš nízké')) {
                recommendations.push({
                    priority: 'medium',
                    category: 'balance',
                    title: 'Zvýšit HP nepřátel nebo snížit player damage',
                    recommendation: 'TTK je příliš nízké. Zvyšte HP nepřátel o 20-30% nebo snižte base damage o 10%.',
                    evidence: [issue],
                    expectedImprovement: 'Combat bude více challengující a engaging'
                });
            }
        });
    }
    
    // Spawns doporučení
    if (analysis.spawnsAnalysis.status !== 'good') {
        analysis.spawnsAnalysis.issues.forEach(issue => {
            if (issue.includes('Nízká spawn rate')) {
                recommendations.push({
                    priority: 'high',
                    category: 'difficulty',
                    title: 'Zvýšit spawn rate nepřátel',
                    recommendation: 'Spawn rate je příliš nízká. Snižte spawn intervaly o 20-30% nebo přidejte více spawn pointů.',
                    evidence: [issue],
                    expectedImprovement: 'Více akce, menší nuda, lepší flow'
                });
            } else if (issue.includes('Vysoká spawn rate')) {
                recommendations.push({
                    priority: 'medium',
                    category: 'performance',
                    title: 'Snížit spawn rate pro lepší performance',
                    recommendation: 'Spawn rate může být overwhelming. Zvyšte spawn intervaly o 15-20% nebo implementujte dynamic spawning.',
                    evidence: [issue],
                    expectedImprovement: 'Lepší performance, menší chaos na obrazovce'
                });
            } else if (issue.includes('Málo boss spawnů')) {
                recommendations.push({
                    priority: 'medium',
                    category: 'progression',
                    title: 'Zvýšit boss spawn rate',
                    recommendation: 'Přidejte více boss encounter. Zvyšte boss spawn chance o 50% nebo přidejte guaranteed boss spawny na milníky.',
                    evidence: [issue],
                    expectedImprovement: 'Více variety, výzvy a možností pro lepší loot'
                });
            }
        });
    }
    
    // Loot doporučení
    if (analysis.lootAnalysis.status !== 'good') {
        analysis.lootAnalysis.issues.forEach(issue => {
            if (issue.includes('Nízká loot rate')) {
                recommendations.push({
                    priority: 'high',
                    category: 'progression',
                    title: 'Zvýšit drop rates napříč všemi nepřáteli',
                    recommendation: 'Loot rate je příliš nízká. Zvyšte base drop chance o 30-50% nebo přidejte guaranteed drops z elite nepřátel.',
                    evidence: [issue],
                    expectedImprovement: 'Lepší progression feel, více odměn za effort'
                });
            } else if (issue.includes('legendary')) {
                if (issue.includes('Málo')) {
                    recommendations.push({
                        priority: 'low',
                        category: 'loot',
                        title: 'Zvýšit legendary drop rate z boss nepřátel',
                        recommendation: 'Legendary drop rate je nízká. Zvyšte legendary weight v boss loot tables o 25-50%.',
                        evidence: [issue],
                        expectedImprovement: 'Více exciting momentů, lepší long-term motivace'
                    });
                } else if (issue.includes('příliš')) {
                    recommendations.push({
                        priority: 'medium',
                        category: 'loot',
                        title: 'Snížit legendary drop rate',
                        recommendation: 'Legendary drops jsou příliš časté. Snižte legendary drop chance o 40-60%.',
                        evidence: [issue],
                        expectedImprovement: 'Zachování vzácnosti a hodnoty legendary items'
                    });
                }
            }
        });
    }
    
    // DPS doporučení
    if (analysis.dpsAnalysis.status === 'bad') {
        analysis.dpsAnalysis.issues.forEach(issue => {
            if (issue.includes('Nízké player DPS')) {
                recommendations.push({
                    priority: 'high',
                    category: 'balance',
                    title: 'Buffnout player damage nebo power-upy',
                    recommendation: 'Player DPS je nízké. Zvyšte base damage o 20% nebo zlepšete power-up efekty o 15-25%.',
                    evidence: [issue],
                    expectedImprovement: 'Rychlejší combat, lepší feel of power'
                });
            } else if (issue.includes('Vysoké incoming DPS')) {
                recommendations.push({
                    priority: 'high',
                    category: 'balance',
                    title: 'Snížit enemy damage nebo zlepšit defensive options',
                    recommendation: 'Incoming damage je příliš vysoké. Snižte enemy damage o 15-20% nebo přidejte více defensive power-upů.',
                    evidence: [issue],
                    expectedImprovement: 'Menší frustrace, lepší survivability'
                });
            }
        });
    }
    
    // Progression doporučení
    if (analysis.progressionAnalysis.status !== 'good') {
        analysis.progressionAnalysis.issues.forEach(issue => {
            if (issue.includes('Pomalá level progrese')) {
                recommendations.push({
                    priority: 'medium',
                    category: 'progression',
                    title: 'Snížit XP requirements nebo zvýšit XP gains',
                    recommendation: 'Level progression je pomalý. Snižte XP requirements o 20% nebo zvyšte XP z nepřátel o 30%.',
                    evidence: [issue],
                    expectedImprovement: 'Rychlejší sense of progression, více power-up opportunities'
                });
            } else if (issue.includes('Málo power-up')) {
                recommendations.push({
                    priority: 'medium',
                    category: 'progression',
                    title: 'Přidat více power-up variety nebo drop rates',
                    recommendation: 'Málo power-up diverzity. Přidejte 2-3 nové power-upy nebo zvyšte drop rates o 25%.',
                    evidence: [issue],
                    expectedImprovement: 'Více build variety, replay value'
                });
            }
        });
    }
    
    // Overall/session doporučení
    if (analysis.overallAnalysis.status !== 'good') {
        analysis.overallAnalysis.issues.forEach(issue => {
            if (issue.includes('Krátká session')) {
                recommendations.push({
                    priority: 'high',
                    category: 'difficulty',
                    title: 'Analyzovat difficulty curve a early game balance',
                    recommendation: 'Sessions jsou příliš krátké. Zkontrolujte early game difficulty - možná je příliš těžké nebo nudné.',
                    evidence: [issue],
                    expectedImprovement: 'Delší engagement, lepší retention'
                });
            } else if (issue.includes('odešel')) {
                recommendations.push({
                    priority: 'high',
                    category: 'difficulty',
                    title: 'Vylepšit player onboarding a mid-game pacing',
                    recommendation: 'Hráči odcházejí. Přidejte better tutorials, clear goals, a vylepšete mid-game content variety.',
                    evidence: [issue],
                    expectedImprovement: 'Lepší player retention, méně rage quits'
                });
            }
        });
    }
    
    // Pokud žádné významné problémy, přidej obecná vylepšení
    if (recommendations.length === 0) {
        recommendations.push({
            priority: 'low',
            category: 'balance',
            title: 'Fine-tuning balance parametrů',
            recommendation: 'Základní balance je dobrý. Zvažte jemné adjustmenty na základě player feedback.',
            evidence: ['Všechny hlavní metriky jsou v cílových hodnotách'],
            expectedImprovement: 'Udržení current balance kvality'
        });
    }
    
    // Seřaď podle priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
    
    return recommendations;
}

/**
 * Generuje multi-session doporučení
 * @param {Object} aggregatedData - Multi-session data
 * @param {number} sessionCount - Počet sessions
 * @returns {Array} Multi-session doporučení
 */
function generateMultiSessionRecommendations(aggregatedData, sessionCount) {
    const recommendations = [];
    
    // Konzistence analýza
    const comparison = aggregatedData.comparison || {};
    
    if (comparison.metrics && comparison.metrics.ttk) {
        const variance = comparison.metrics.ttk.variance;
        
        if (variance > 0.5) {
            recommendations.push({
                priority: 'medium',
                category: 'balance',
                title: 'Vysoký rozptyl TTK mezi sessions',
                recommendation: `TTK variance je ${variance.toFixed(2)} - možná inconsistent balance. Zkontrolujte spawn tables a enemy stats.`,
                evidence: [`TTK variance: ${variance.toFixed(2)}`],
                expectedImprovement: 'Konzistentnější player experience napříč sessions'
            });
        }
    }
    
    // Session-to-session progression
    if (aggregatedData.ttk && aggregatedData.ttk.bySession) {
        const sessions = aggregatedData.ttk.bySession;
        const firstSession = sessions[0];
        const lastSession = sessions[sessions.length - 1];
        
        if (sessions.length >= 3) {
            const improvement = (firstSession.median - lastSession.median) / firstSession.median;
            
            if (improvement < 0.1) {
                recommendations.push({
                    priority: 'medium',
                    category: 'progression',
                    title: 'Slabé skill progression mezi sessions',
                    recommendation: 'Hráč nevykazuje zlepšení TTK. Zvažte better tutorials nebo clearer feedback.',
                    evidence: [`TTK zlepšení: ${(improvement * 100).toFixed(1)}%`],
                    expectedImprovement: 'Lepší learning curve, player satisfaction'
                });
            }
        }
    }
    
    // Multi-session engagement patterns
    const sessionDurations = aggregatedData.comparison.sessions.map(s => s.duration);
    if (sessionDurations.length === 0) {
        return crossSessionInsights; // Skip if no session data
    }
    const avgDuration = sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length;
    const durationTrend = sessionDurations[sessionDurations.length - 1] - sessionDurations[0];
    
    if (durationTrend < -300 && sessionCount >= 3) { // Klesající o 5+ minut
        recommendations.push({
            priority: 'high',
            category: 'progression',
            title: 'Klesající session délky - možná stagnace obsahu',
            recommendation: 'Délka sessions klesá. Přidejte nový content, achievements, nebo long-term goals.',
            evidence: [`Délka trend: ${Math.round(durationTrend / 60)}min pokles`],
            expectedImprovement: 'Udržení long-term engagement'
        });
    }
    
    // Pokud máme málo doporučení, přidej obecná multi-session insights
    if (recommendations.length === 0) {
        recommendations.push({
            priority: 'low',
            category: 'progression',
            title: 'Multi-session data vypadají stabilně',
            recommendation: `${sessionCount} sessions ukazuje konzistentní gameplay. Pokračujte v current balance approach.`,
            evidence: ['Nízký rozptyl v klíčových metrikách'],
            expectedImprovement: 'Udržení current kvality gameplay'
        });
    }
    
    return recommendations;
}

/**
 * Vypočítá celkové metriky
 * @param {Object} analysis - Analýza dat
 * @returns {Object} Metriky
 */
function calculateMetrics(analysis) {
    const scores = [
        analysis.ttkAnalysis.score,
        analysis.spawnsAnalysis.score,
        analysis.lootAnalysis.score,
        analysis.dpsAnalysis.score,
        analysis.progressionAnalysis.score,
        analysis.overallAnalysis.score
    ];
    
    const balanceScore = Math.round(
        (analysis.ttkAnalysis.score * 0.3 +
         analysis.spawnsAnalysis.score * 0.25 +
         analysis.lootAnalysis.score * 0.2 +
         analysis.dpsAnalysis.score * 0.25)
    );
    
    const difficultyScore = Math.round(
        (analysis.ttkAnalysis.score * 0.4 +
         analysis.spawnsAnalysis.score * 0.3 +
         analysis.dpsAnalysis.score * 0.3)
    );
    
    const engagementScore = Math.round(
        (analysis.progressionAnalysis.score * 0.4 +
         analysis.lootAnalysis.score * 0.3 +
         analysis.overallAnalysis.score * 0.3)
    );
    
    return {
        balanceScore: Math.max(0, Math.min(100, balanceScore)),
        difficultyScore: Math.max(0, Math.min(100, difficultyScore)),
        engagementScore: Math.max(0, Math.min(100, engagementScore))
    };
}