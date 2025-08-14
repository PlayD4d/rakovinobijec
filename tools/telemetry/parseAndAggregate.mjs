/**
 * ParseAndAggregate - Parser a agregátor pro telemetrické eventy
 * 
 * Zpracovává raw eventy z TelemetryLogger a vytváří agregované metriky
 * pro generování reportů a grafů.
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 */

/**
 * Mapování typů nepřátel pro konzistenci
 */
const ENEMY_TYPE_MAP = {
    'enemy': 'Běžný nepřítel',
    'elite': 'Elite nepřítel', 
    'miniboss': 'Mini-boss',
    'boss': 'Boss',
    'unique': 'Unique nepřítel'
};

/**
 * Mapování rarity loot pro konzistenci
 */
const LOOT_RARITY_MAP = {
    'common': 'Běžný',
    'uncommon': 'Neobvyklý',
    'rare': 'Vzácný',
    'epic': 'Epický',
    'legendary': 'Legendární'
};

/**
 * Cílové TTK hodnoty pro traffic lights
 */
const TARGET_TTK = {
    1: 2.5, // Level 1 cíl: 2.5s
    2: 2.0, // Level 2 cíl: 2.0s 
    3: 1.5  // Level 3 cíl: 1.5s
};

/**
 * Agreguje a analyzuje telemetrické eventy
 * @param {Object[]} events - Pole eventů z TelemetryLogger
 * @param {Object} options - Možnosti pro agregaci
 * @returns {Object} Agregovaná data pro reporty
 */
export function parseAndAggregate(events, options = {}) {
    const opts = {
        rollingWindow: 60,
        verbose: false,
        ...options
    };
    
    const startTime = Date.now();
    
    if (opts.verbose) {
        console.log(`🔧 Parsování ${events.length} eventů...`);
    }
    
    // Inicializace výstupní struktury
    const result = {
        summary: createSummary(events),
        ttk: createTTKAnalysis(events, opts),
        spawns: createSpawnsAnalysis(events, opts),
        loot: createLootAnalysis(events, opts),
        dps: createDPSAnalysis(events, opts),
        progression: createProgressionAnalysis(events, opts),
        ngplus: createNGPlusAnalysis(events, opts),
        timeline: createTimelineAnalysis(events, opts),
        insights: createInsightsData(events, opts),
        metadata: {
            totalEvents: events.length,
            parseTime: 0, // bude nastaven na konci
            rollingWindow: opts.rollingWindow,
            generatedAt: new Date().toISOString()
        }
    };
    
    result.metadata.parseTime = Date.now() - startTime;
    
    if (opts.verbose) {
        console.log(`✅ Parsování dokončeno za ${result.metadata.parseTime}ms`);
    }
    
    return result;
}

/**
 * Vytvoří základní souhrn session
 * @param {Object[]} events - Eventy
 * @returns {Object} Souhrn session
 */
function createSummary(events) {
    const sessionStart = getSessionStart(events);
    const sessionEnd = getSessionEnd(events);
    const sessionSummaryEvent = events.find(e => e.type === 'SessionSummaryEvent');
    
    const summary = {
        sessionId: events[0]?.sessionId || 'unknown',
        sessionDuration: sessionEnd ? Math.round((sessionEnd.timestamp - sessionStart.timestamp) / 1000) : 0,
        totalEvents: events.length,
        totalKills: 0,
        totalSpawns: 0,
        totalLoot: 0,
        reachedStage: 1,
        finalLevel: 1,
        finalXP: 0,
        ngPlusLevel: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        completionReason: 'unknown'
    };
    
    // Použij SessionSummaryEvent pokud existuje
    if (sessionSummaryEvent) {
        Object.assign(summary, {
            totalKills: sessionSummaryEvent.totalEnemiesKilled || 0,
            reachedStage: sessionSummaryEvent.reachedStage || 1,
            finalLevel: sessionSummaryEvent.finalPlayerLevel || 1,
            finalXP: sessionSummaryEvent.finalPlayerXP || 0,
            ngPlusLevel: sessionSummaryEvent.ngPlusLevel || 0,
            totalDamageDealt: sessionSummaryEvent.totalDamageDealt || 0,
            totalDamageTaken: sessionSummaryEvent.totalDamageTaken || 0,
            completionReason: sessionSummaryEvent.reason || 'unknown'
        });
        
        if (sessionSummaryEvent.killsByType) {
            summary.killsByType = sessionSummaryEvent.killsByType;
        }
        
        if (sessionSummaryEvent.spawnsByType) {
            summary.spawnsByType = sessionSummaryEvent.spawnsByType;
        }
        
        if (sessionSummaryEvent.lootByRarity) {
            summary.lootByRarity = sessionSummaryEvent.lootByRarity;
        }
    } else {
        // Fallback: počítej z jednotlivých eventů
        const spawnEvents = events.filter(e => e.type === 'SpawnEvent');
        const killEvents = events.filter(e => e.type === 'TTKEvent');
        const lootEvents = events.filter(e => e.type === 'LootDropEvent');
        
        summary.totalSpawns = spawnEvents.length;
        summary.totalKills = killEvents.length;
        summary.totalLoot = lootEvents.length;
        
        // Posledí progress event pro finální stav
        const progressEvents = events.filter(e => e.type === 'PlayerProgressEvent').sort((a, b) => b.gameTime - a.gameTime);
        if (progressEvents.length > 0) {
            const lastProgress = progressEvents[0];
            summary.finalLevel = lastProgress.playerLevel || 1;
            summary.finalXP = lastProgress.playerXP || 0;
        }
    }
    
    return summary;
}

/**
 * Vytvoří analýzu TTK (Time To Kill)
 * @param {Object[]} events - Eventy
 * @param {Object} opts - Možnosti
 * @returns {Object} TTK analýza
 */
function createTTKAnalysis(events, opts) {
    const ttkEvents = events.filter(e => e.type === 'TTKEvent');
    
    if (ttkEvents.length === 0) {
        return {
            samples: [],
            total: 0,
            median: 0,
            mean: 0,
            p90: 0,
            p95: 0,
            min: 0,
            max: 0,
            byType: {},
            distribution: [],
            timeline: [],
            targetComparison: {}
        };
    }
    
    // Základní TTK data
    const ttkValues = ttkEvents.map(e => e.timeToKill).filter(ttk => ttk > 0);
    ttkValues.sort((a, b) => a - b);
    
    const analysis = {
        samples: ttkValues,
        total: ttkValues.length,
        median: calculatePercentile(ttkValues, 50),
        mean: ttkValues.reduce((a, b) => a + b, 0) / ttkValues.length,
        p90: calculatePercentile(ttkValues, 90),
        p95: calculatePercentile(ttkValues, 95),
        min: Math.min(...ttkValues),
        max: Math.max(...ttkValues),
        byType: {},
        distribution: createTTKDistribution(ttkValues),
        timeline: createTTKTimeline(ttkEvents, opts.rollingWindow),
        targetComparison: {}
    };
    
    // TTK podle typu nepřítele
    const typeGroups = groupBy(ttkEvents, 'entityType');
    Object.keys(typeGroups).forEach(type => {
        const typeTTKs = typeGroups[type].map(e => e.timeToKill).filter(ttk => ttk > 0);
        if (typeTTKs.length > 0) {
            typeTTKs.sort((a, b) => a - b);
            analysis.byType[type] = {
                samples: typeTTKs,
                count: typeTTKs.length,
                median: calculatePercentile(typeTTKs, 50),
                mean: typeTTKs.reduce((a, b) => a + b, 0) / typeTTKs.length,
                p90: calculatePercentile(typeTTKs, 90),
                min: Math.min(...typeTTKs),
                max: Math.max(...typeTTKs)
            };
        }
    });
    
    // Porovnání s cílovými TTK podle úrovně
    analysis.targetComparison = compareTTKToTargets(ttkEvents);
    
    return analysis;
}

/**
 * Vytvoří analýzu spawnů
 * @param {Object[]} events - Eventy
 * @param {Object} opts - Možnosti
 * @returns {Object} Spawns analýza
 */
function createSpawnsAnalysis(events, opts) {
    const spawnEvents = events.filter(e => e.type === 'SpawnEvent');
    const sessionDuration = getSessionDuration(events);
    
    const analysis = {
        total: spawnEvents.length,
        rate: sessionDuration > 0 ? (spawnEvents.length * 60) / sessionDuration : 0,
        byType: {},
        timeline: [],
        intervals: [],
        bossSpawns: [],
        uniqueSpawns: []
    };
    
    // Spawns podle typu
    const typeGroups = groupBy(spawnEvents, 'entityType');
    Object.keys(typeGroups).forEach(type => {
        analysis.byType[type] = typeGroups[type].length;
    });
    
    // Timeline spawnů (spawns/min po minutách)
    analysis.timeline = createSpawnsTimeline(spawnEvents);
    
    // Spawns v intervalech (pro detekci intenzity)
    analysis.intervals = createSpawnsIntervals(spawnEvents, 60); // 1-minutové intervaly
    
    // Speciální nepřátelé
    analysis.bossSpawns = spawnEvents
        .filter(e => e.entityType === 'boss' || e.entityType === 'miniboss')
        .map(e => ({
            gameTime: e.gameTime,
            entityType: e.entityType,
            entityId: e.entityId
        }));
        
    analysis.uniqueSpawns = spawnEvents
        .filter(e => e.entityType === 'unique')
        .map(e => ({
            gameTime: e.gameTime,
            entityId: e.entityId
        }));
    
    return analysis;
}

/**
 * Vytvoří analýzu loot
 * @param {Object[]} events - Eventy
 * @param {Object} opts - Možnosti
 * @returns {Object} Loot analýza
 */
function createLootAnalysis(events, opts) {
    const lootEvents = events.filter(e => e.type === 'LootDropEvent');
    const sessionDuration = getSessionDuration(events);
    
    const analysis = {
        total: lootEvents.length,
        rate: sessionDuration > 0 ? (lootEvents.length * 60) / sessionDuration : 0,
        byRarity: {},
        bySource: {},
        byType: {},
        timeline: [],
        pityAnalysis: {
            activations: 0,
            avgKillsBetween: 0,
            triggers: []
        }
    };
    
    // Loot podle rarity
    const rarityGroups = groupBy(lootEvents, 'quality');
    Object.keys(rarityGroups).forEach(rarity => {
        analysis.byRarity[rarity] = rarityGroups[rarity].length;
    });
    
    // Loot podle zdroje
    const sourceGroups = groupBy(lootEvents, 'sourceType');
    Object.keys(sourceGroups).forEach(source => {
        analysis.bySource[source] = sourceGroups[source].length;
    });
    
    // Loot podle typu
    const typeGroups = groupBy(lootEvents, 'dropType');
    Object.keys(typeGroups).forEach(type => {
        analysis.byType[type] = typeGroups[type].length;
    });
    
    // Timeline loot (loot/min po minutách)
    analysis.timeline = createLootTimeline(lootEvents);
    
    // Pity systém analýza (pokud lze detekovat)
    analysis.pityAnalysis = analyzePitySystem(events);
    
    return analysis;
}

/**
 * Vytvoří analýzu DPS
 * @param {Object[]} events - Eventy
 * @param {Object} opts - Možnosti
 * @returns {Object} DPS analýza
 */
function createDPSAnalysis(events, opts) {
    const dpsEvents = events.filter(e => e.type === 'DamageStatsEvent');
    
    const analysis = {
        samples: dpsEvents,
        avgPlayerDPS: 0,
        maxPlayerDPS: 0,
        avgIncomingDPS: 0,
        maxIncomingDPS: 0,
        timeline: [],
        correlation: {
            dpsVsTTK: 0,
            dpsVsSpawns: 0
        }
    };
    
    if (dpsEvents.length === 0) {
        return analysis;
    }
    
    // Základní DPS statistiky
    const playerDPSValues = dpsEvents.map(e => e.playerDPS || 0);
    const incomingDPSValues = dpsEvents.map(e => e.incomingDPS || 0);
    
    analysis.avgPlayerDPS = playerDPSValues.reduce((a, b) => a + b, 0) / playerDPSValues.length;
    analysis.maxPlayerDPS = Math.max(...playerDPSValues);
    analysis.avgIncomingDPS = incomingDPSValues.reduce((a, b) => a + b, 0) / incomingDPSValues.length;
    analysis.maxIncomingDPS = Math.max(...incomingDPSValues);
    
    // Timeline DPS (30s sampling podle požadavků)
    analysis.timeline = createDPSTimeline(dpsEvents);
    
    // Korelace (bude vypočtena v insights pokud jsou dostupná data)
    analysis.correlation = calculateDPSCorrelations(events);
    
    return analysis;
}

/**
 * Vytvoří analýzu progrese hráče
 * @param {Object[]} events - Eventy
 * @param {Object} opts - Možnosti
 * @returns {Object} Progression analýza
 */
function createProgressionAnalysis(events, opts) {
    const progressEvents = events.filter(e => e.type === 'PlayerProgressEvent');
    
    const analysis = {
        xpTimeline: [],
        levelTimeline: [],
        activePowerups: [],
        milestones: []
    };
    
    if (progressEvents.length === 0) {
        return analysis;
    }
    
    // XP a level timeline
    analysis.xpTimeline = progressEvents.map(e => ({
        gameTime: e.gameTime,
        xp: e.playerXP || 0,
        level: e.playerLevel || 1
    }));
    
    analysis.levelTimeline = progressEvents
        .filter((e, i, arr) => i === 0 || e.playerLevel !== arr[i-1].playerLevel)
        .map(e => ({
            gameTime: e.gameTime,
            level: e.playerLevel || 1,
            xp: e.playerXP || 0
        }));
    
    // Aktivní power-upy v čase
    const allPowerups = [];
    progressEvents.forEach(e => {
        if (e.activePowerups && Array.isArray(e.activePowerups)) {
            e.activePowerups.forEach(powerup => {
                allPowerups.push({
                    gameTime: e.gameTime,
                    id: powerup.id,
                    level: powerup.level || 1,
                    timeRemaining: powerup.timeRemaining
                });
            });
        }
    });
    
    analysis.activePowerups = allPowerups;
    
    // Milníky (level změny, důležité power-upy)
    analysis.milestones = createProgressionMilestones(progressEvents);
    
    return analysis;
}

/**
 * Vytvoří analýzu NG+ systému
 * @param {Object[]} events - Eventy
 * @param {Object} opts - Možnosti
 * @returns {Object} NG+ analýza
 */
function createNGPlusAnalysis(events, opts) {
    const ngLevels = [...new Set(events.map(e => e.ngPlusLevel || 0))].sort();
    
    const analysis = {
        levels: ngLevels,
        segmentation: {}
    };
    
    // Segmentace metrik podle NG+ úrovně
    ngLevels.forEach(ngLevel => {
        const ngEvents = events.filter(e => (e.ngPlusLevel || 0) === ngLevel);
        
        analysis.segmentation[`ng${ngLevel}`] = {
            ngLevel,
            totalEvents: ngEvents.length,
            duration: getSessionDuration(ngEvents),
            ttk: createTTKAnalysis(ngEvents, opts),
            spawns: createSpawnsAnalysis(ngEvents, opts),
            loot: createLootAnalysis(ngEvents, opts)
        };
    });
    
    return analysis;
}

/**
 * Vytvoří analýzu timeline (klíčové momenty)
 * @param {Object[]} events - Eventy
 * @param {Object} opts - Možnosti
 * @returns {Object} Timeline analýza
 */
function createTimelineAnalysis(events, opts) {
    const timeline = [];
    
    // Boss spawny
    events
        .filter(e => e.type === 'SpawnEvent' && (e.entityType === 'boss' || e.entityType === 'miniboss'))
        .forEach(e => {
            timeline.push({
                gameTime: e.gameTime,
                type: 'boss_spawn',
                entityType: e.entityType,
                entityId: e.entityId,
                description: `${ENEMY_TYPE_MAP[e.entityType] || e.entityType}: ${e.entityId}`
            });
        });
    
    // Level upy
    const progressEvents = events.filter(e => e.type === 'PlayerProgressEvent');
    for (let i = 1; i < progressEvents.length; i++) {
        const current = progressEvents[i];
        const previous = progressEvents[i-1];
        
        if (current.playerLevel > previous.playerLevel) {
            timeline.push({
                gameTime: current.gameTime,
                type: 'level_up',
                level: current.playerLevel,
                description: `Level up: ${current.playerLevel}`
            });
        }
    }
    
    // Seřazení podle času
    timeline.sort((a, b) => a.gameTime - b.gameTime);
    
    return timeline;
}

/**
 * Připravuje data pro insights generátor
 * @param {Object[]} events - Eventy
 * @param {Object} opts - Možnosti
 * @returns {Object} Data pro insights
 */
function createInsightsData(events, opts) {
    return {
        totalEvents: events.length,
        eventTypes: countByField(events, 'type'),
        timeSpread: {
            start: Math.min(...events.map(e => e.gameTime)),
            end: Math.max(...events.map(e => e.gameTime)),
            duration: getSessionDuration(events)
        }
    };
}

// === HELPER FUNKCE ===

/**
 * Najde začátek session
 * @param {Object[]} events - Eventy
 * @returns {Object} První event
 */
function getSessionStart(events) {
    if (events.length === 0) {
        return { gameTime: 0, timestamp: Date.now(), sessionId: 'unknown' };
    }
    return events.find(e => e.type === 'SessionStart') || 
           events.reduce((earliest, current) => 
               current.gameTime < earliest.gameTime ? current : earliest
           );
}

/**
 * Najde konec session
 * @param {Object[]} events - Eventy
 * @returns {Object} Poslední event
 */
function getSessionEnd(events) {
    if (events.length === 0) {
        return { gameTime: 1800, timestamp: Date.now(), sessionId: 'unknown' };
    }
    return events.find(e => e.type === 'SessionSummaryEvent') ||
           events.reduce((latest, current) => 
               current.gameTime > latest.gameTime ? current : latest
           );
}

/**
 * Vypočítá délku session v sekundách
 * @param {Object[]} events - Eventy
 * @returns {number} Délka v sekundách
 */
function getSessionDuration(events) {
    if (events.length === 0) return 0;
    
    const times = events.map(e => e.gameTime).filter(t => typeof t === 'number');
    if (times.length === 0) return 0;
    
    return Math.max(...times) - Math.min(...times);
}

/**
 * Seskupí objekty podle hodnoty pole
 * @param {Object[]} array - Pole objektů
 * @param {string} key - Klíč pro seskupení
 * @returns {Object} Seskupené objekty
 */
function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const value = item[key];
        if (!groups[value]) {
            groups[value] = [];
        }
        groups[value].push(item);
        return groups;
    }, {});
}

/**
 * Spočítá výskyty podle pole
 * @param {Object[]} array - Pole objektů
 * @param {string} field - Pole ke sčítání
 * @returns {Object} Počty výskytů
 */
function countByField(array, field) {
    return array.reduce((counts, item) => {
        const value = item[field];
        counts[value] = (counts[value] || 0) + 1;
        return counts;
    }, {});
}

/**
 * Vypočítá percentil z seřazeného pole
 * @param {number[]} sortedArray - Seřazené pole čísel
 * @param {number} percentile - Percentil (0-100)
 * @returns {number} Hodnota percentilu
 */
function calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
        return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

/**
 * Vytvoří distribuci TTK do binů
 * @param {number[]} ttkValues - TTK hodnoty
 * @returns {Object[]} Histogram data
 */
function createTTKDistribution(ttkValues) {
    const binSize = 0.5; // 0.5s biny podle požadavků
    const maxTTK = Math.max(...ttkValues);
    const binCount = Math.ceil(maxTTK / binSize);
    
    const bins = Array(binCount).fill(0).map((_, i) => ({
        min: i * binSize,
        max: (i + 1) * binSize,
        count: 0,
        percentage: 0
    }));
    
    ttkValues.forEach(ttk => {
        const binIndex = Math.min(Math.floor(ttk / binSize), bins.length - 1);
        bins[binIndex].count++;
    });
    
    // Vypočítej procenta
    bins.forEach(bin => {
        bin.percentage = (bin.count / ttkValues.length) * 100;
    });
    
    return bins;
}

/**
 * Vytvoří timeline TTK s rolling average
 * @param {Object[]} ttkEvents - TTK eventy
 * @param {number} windowSize - Velikost okna v sekundách
 * @returns {Object[]} Timeline data
 */
function createTTKTimeline(ttkEvents, windowSize) {
    if (ttkEvents.length === 0) return [];
    
    const timeline = [];
    const sortedEvents = ttkEvents.sort((a, b) => a.gameTime - b.gameTime);
    
    // Vytvoř timeline body každých 10 sekund
    const startTime = sortedEvents[0].gameTime;
    const endTime = sortedEvents[sortedEvents.length - 1].gameTime;
    const stepSize = 10; // 10s kroky
    
    for (let time = startTime; time <= endTime; time += stepSize) {
        const windowStart = time - windowSize / 2;
        const windowEnd = time + windowSize / 2;
        
        const windowEvents = sortedEvents.filter(e => 
            e.gameTime >= windowStart && e.gameTime <= windowEnd
        );
        
        if (windowEvents.length > 0) {
            const windowTTKs = windowEvents.map(e => e.timeToKill);
            timeline.push({
                gameTime: time,
                avgTTK: windowTTKs.reduce((a, b) => a + b, 0) / windowTTKs.length,
                sampleCount: windowTTKs.length,
                medianTTK: calculatePercentile([...windowTTKs].sort((a, b) => a - b), 50)
            });
        }
    }
    
    return timeline;
}

/**
 * Porovná TTK s cílovými hodnotami podle levelu
 * @param {Object[]} ttkEvents - TTK eventy
 * @returns {Object} Porovnání s cíli
 */
function compareTTKToTargets(ttkEvents) {
    const comparison = {};
    
    // Seskup podle player level (pokud je dostupný)
    const levelGroups = groupBy(ttkEvents, 'playerLevel');
    
    Object.keys(TARGET_TTK).forEach(level => {
        const levelInt = parseInt(level);
        const target = TARGET_TTK[levelInt];
        const levelEvents = levelGroups[levelInt] || [];
        
        if (levelEvents.length > 0) {
            const levelTTKs = levelEvents.map(e => e.timeToKill);
            const median = calculatePercentile([...levelTTKs].sort((a, b) => a - b), 50);
            const mean = levelTTKs.reduce((a, b) => a + b, 0) / levelTTKs.length;
            
            comparison[`level${levelInt}`] = {
                target,
                median,
                mean,
                samples: levelTTKs.length,
                status: median <= target ? 'good' : (median <= target * 1.2 ? 'warning' : 'bad'),
                deviation: ((median - target) / target) * 100
            };
        }
    });
    
    return comparison;
}

/**
 * Vytvoří timeline spawnů (spawns/min)
 * @param {Object[]} spawnEvents - Spawn eventy
 * @returns {Object[]} Timeline data
 */
function createSpawnsTimeline(spawnEvents) {
    if (spawnEvents.length === 0) return [];
    
    const timeline = [];
    const sortedEvents = spawnEvents.sort((a, b) => a.gameTime - b.gameTime);
    const startTime = sortedEvents[0].gameTime;
    const endTime = sortedEvents[sortedEvents.length - 1].gameTime;
    
    // 1-minutové intervaly
    for (let minute = 0; minute <= Math.ceil((endTime - startTime) / 60); minute++) {
        const intervalStart = startTime + minute * 60;
        const intervalEnd = intervalStart + 60;
        
        const intervalEvents = sortedEvents.filter(e => 
            e.gameTime >= intervalStart && e.gameTime < intervalEnd
        );
        
        const byType = groupBy(intervalEvents, 'entityType');
        
        timeline.push({
            minute,
            gameTime: intervalStart,
            total: intervalEvents.length,
            rate: intervalEvents.length, // již spawns/min
            byType: Object.keys(byType).reduce((acc, type) => {
                acc[type] = byType[type].length;
                return acc;
            }, {})
        });
    }
    
    return timeline;
}

/**
 * Vytvoří intervaly spawnů pro analýzu intenzity
 * @param {Object[]} spawnEvents - Spawn eventy
 * @param {number} intervalSize - Velikost intervalu v sekundách
 * @returns {Object[]} Interval data
 */
function createSpawnsIntervals(spawnEvents, intervalSize) {
    if (spawnEvents.length === 0) return [];
    
    const intervals = [];
    const sortedEvents = spawnEvents.sort((a, b) => a.gameTime - b.gameTime);
    const startTime = sortedEvents[0].gameTime;
    const endTime = sortedEvents[sortedEvents.length - 1].gameTime;
    
    for (let time = startTime; time < endTime; time += intervalSize) {
        const intervalEvents = sortedEvents.filter(e => 
            e.gameTime >= time && e.gameTime < time + intervalSize
        );
        
        intervals.push({
            startTime: time,
            endTime: time + intervalSize,
            count: intervalEvents.length,
            rate: (intervalEvents.length * 60) / intervalSize, // spawns/min
            intensity: intervalEvents.length > 10 ? 'high' : 
                      intervalEvents.length > 5 ? 'medium' : 'low'
        });
    }
    
    return intervals;
}

/**
 * Vytvoří timeline loot (loot/min)
 * @param {Object[]} lootEvents - Loot eventy
 * @returns {Object[]} Timeline data
 */
function createLootTimeline(lootEvents) {
    if (lootEvents.length === 0) return [];
    
    const timeline = [];
    const sortedEvents = lootEvents.sort((a, b) => a.gameTime - b.gameTime);
    const startTime = sortedEvents[0].gameTime;
    const endTime = sortedEvents[sortedEvents.length - 1].gameTime;
    
    // 1-minutové intervaly
    for (let minute = 0; minute <= Math.ceil((endTime - startTime) / 60); minute++) {
        const intervalStart = startTime + minute * 60;
        const intervalEnd = intervalStart + 60;
        
        const intervalEvents = sortedEvents.filter(e => 
            e.gameTime >= intervalStart && e.gameTime < intervalEnd
        );
        
        const byRarity = groupBy(intervalEvents, 'quality');
        const bySource = groupBy(intervalEvents, 'sourceType');
        
        timeline.push({
            minute,
            gameTime: intervalStart,
            total: intervalEvents.length,
            rate: intervalEvents.length, // loot/min
            byRarity: Object.keys(byRarity).reduce((acc, rarity) => {
                acc[rarity] = byRarity[rarity].length;
                return acc;
            }, {}),
            bySource: Object.keys(bySource).reduce((acc, source) => {
                acc[source] = bySource[source].length;
                return acc;
            }, {})
        });
    }
    
    return timeline;
}

/**
 * Analyzuje pity systém (pokud lze detekovat)
 * @param {Object[]} events - Všechny eventy
 * @returns {Object} Pity analýza
 */
function analyzePitySystem(events) {
    // Toto je zjednodušená implementace
    // V reálné situaci bychom hledali patterny v loot dropech
    
    const analysis = {
        activations: 0,
        avgKillsBetween: 0,
        triggers: [],
        detectionConfidence: 'low'
    };
    
    const killEvents = events.filter(e => e.type === 'TTKEvent');
    const lootEvents = events.filter(e => e.type === 'LootDropEvent');
    
    if (killEvents.length === 0 || lootEvents.length === 0) {
        return analysis;
    }
    
    // Jednoduchá heuristika: hledej dlouhé periody bez loot následované dropu
    const sortedKills = killEvents.sort((a, b) => a.gameTime - b.gameTime);
    const sortedLoot = lootEvents.sort((a, b) => a.gameTime - b.gameTime);
    
    let killsSinceLastLoot = 0;
    let lastLootTime = 0;
    const possibleTriggers = [];
    
    sortedKills.forEach(kill => {
        const nearbyLoot = sortedLoot.filter(loot => 
            loot.gameTime > kill.gameTime && 
            loot.gameTime <= kill.gameTime + 2 // 2s okno po killu
        );
        
        if (nearbyLoot.length > 0) {
            if (killsSinceLastLoot >= 10) { // Možný pity trigger
                possibleTriggers.push({
                    gameTime: kill.gameTime,
                    killsSinceLastLoot,
                    lootDropped: nearbyLoot.map(l => ({
                        type: l.dropType,
                        quality: l.quality
                    }))
                });
            }
            killsSinceLastLoot = 0;
            lastLootTime = kill.gameTime;
        } else {
            killsSinceLastLoot++;
        }
    });
    
    analysis.activations = possibleTriggers.length;
    analysis.triggers = possibleTriggers;
    
    if (possibleTriggers.length > 0) {
        analysis.avgKillsBetween = possibleTriggers.reduce((sum, t) => 
            sum + t.killsSinceLastLoot, 0) / possibleTriggers.length;
        analysis.detectionConfidence = possibleTriggers.length >= 3 ? 'medium' : 'low';
    }
    
    return analysis;
}

/**
 * Vytvoří timeline DPS (30s sampling)
 * @param {Object[]} dpsEvents - DPS eventy
 * @returns {Object[]} Timeline data
 */
function createDPSTimeline(dpsEvents) {
    // DPS eventy už jsou vzorkované, jen je seřadíme a formátujeme
    return dpsEvents
        .sort((a, b) => a.gameTime - b.gameTime)
        .map(e => ({
            gameTime: e.gameTime,
            playerDPS: e.playerDPS || 0,
            incomingDPS: e.incomingDPS || 0,
            totalDamageDealt: e.totalDamageDealt || 0,
            totalDamageTaken: e.totalDamageTaken || 0
        }));
}

/**
 * Vypočítá korelace DPS s ostatními metrikami
 * @param {Object[]} events - Všechny eventy
 * @returns {Object} Korelační data
 */
function calculateDPSCorrelations(events) {
    // Zjednodušená implementace korelací
    // V reálné situaci bychom použili Pearsonův korelační koeficient
    
    return {
        dpsVsTTK: 0, // Zatím neimplementováno
        dpsVsSpawns: 0, // Zatím neimplementováno
        note: 'Korelační analýza bude implementována v další verzi'
    };
}

/**
 * Vytvoří milníky progrese
 * @param {Object[]} progressEvents - Progress eventy
 * @returns {Object[]} Milníky
 */
function createProgressionMilestones(progressEvents) {
    const milestones = [];
    
    // Level milníky
    for (let i = 1; i < progressEvents.length; i++) {
        const current = progressEvents[i];
        const previous = progressEvents[i-1];
        
        if (current.playerLevel > previous.playerLevel) {
            milestones.push({
                gameTime: current.gameTime,
                type: 'level_up',
                level: current.playerLevel,
                description: `Dosažen level ${current.playerLevel}`
            });
        }
    }
    
    // Power-up milníky (první výskyt důležitých power-upů)
    const importantPowerups = ['damage_boost', 'flamethrower', 'piercing_arrows', 'shield'];
    const seenPowerups = new Set();
    
    progressEvents.forEach(event => {
        if (event.activePowerups && Array.isArray(event.activePowerups)) {
            event.activePowerups.forEach(powerup => {
                if (importantPowerups.includes(powerup.id) && !seenPowerups.has(powerup.id)) {
                    seenPowerups.add(powerup.id);
                    milestones.push({
                        gameTime: event.gameTime,
                        type: 'powerup_acquired',
                        powerupId: powerup.id,
                        level: powerup.level || 1,
                        description: `Získán power-up: ${powerup.id} (level ${powerup.level || 1})`
                    });
                }
            });
        }
    });
    
    return milestones.sort((a, b) => a.gameTime - b.gameTime);
}