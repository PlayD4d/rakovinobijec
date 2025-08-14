/**
 * ChartGenerator - Generování PNG grafů z telemetrických dat
 * 
 * Používá Chart.js s canvas backend pro vytváření grafů v headless režimu.
 * Všechny grafy jsou optimalizované pro Markdown/HTML reporty.
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import { createRequire } from 'module';
import { writeFile } from 'fs/promises';
import { join } from 'path';

// Dynamický import pro Chart.js a canvas
const require = createRequire(import.meta.url);

/**
 * Generuje všechny požadované grafy pro telemetrický report
 * @param {Object} aggregatedData - Agregovaná telemetrická data
 * @param {string} outputDir - Výstupní složka pro grafy
 * @param {Object} options - Možnosti generování
 * @returns {Promise<Object>} Cesty k vygenerovaným grafům
 */
export async function generateCharts(aggregatedData, outputDir, options = {}) {
    const opts = {
        isAggregate: false,
        width: 800,
        height: 600,
        ...options
    };
    
    console.log('📊 Generuji grafy...');
    
    try {
        // Import Chart.js dependencies
        const Chart = await importChartJS();
        
        const chartPaths = {};
        
        // TTK grafy
        if (aggregatedData.ttk && aggregatedData.ttk.samples.length > 0) {
            chartPaths.ttkHistogram = await generateTTKHistogram(
                Chart, aggregatedData.ttk, outputDir, opts
            );
            
            chartPaths.ttkBoxplot = await generateTTKBoxplot(
                Chart, aggregatedData.ttk, outputDir, opts
            );
            
            if (aggregatedData.ttk.timeline.length > 0) {
                chartPaths.ttkTimeline = await generateTTKTimeline(
                    Chart, aggregatedData.ttk, outputDir, opts
                );
            }
        }
        
        // Spawns grafy
        if (aggregatedData.spawns && aggregatedData.spawns.total > 0) {
            chartPaths.spawnsTimeline = await generateSpawnsTimeline(
                Chart, aggregatedData.spawns, outputDir, opts
            );
        }
        
        // Loot grafy
        if (aggregatedData.loot && aggregatedData.loot.total > 0) {
            chartPaths.lootDistribution = await generateLootDistribution(
                Chart, aggregatedData.loot, outputDir, opts
            );
            
            if (aggregatedData.loot.timeline.length > 0) {
                chartPaths.lootTimeline = await generateLootTimeline(
                    Chart, aggregatedData.loot, outputDir, opts
                );
            }
        }
        
        // DPS grafy
        if (aggregatedData.dps && aggregatedData.dps.samples.length > 0) {
            chartPaths.dpsTimeline = await generateDPSTimeline(
                Chart, aggregatedData.dps, outputDir, opts
            );
        }
        
        // Progression grafy
        if (aggregatedData.progression && aggregatedData.progression.xpTimeline.length > 0) {
            chartPaths.progressionTimeline = await generateProgressionTimeline(
                Chart, aggregatedData.progression, outputDir, opts
            );
        }
        
        // NG+ grafy
        if (aggregatedData.ngplus && aggregatedData.ngplus.levels.length > 1) {
            chartPaths.ngplusComparison = await generateNGPlusComparison(
                Chart, aggregatedData.ngplus, outputDir, opts
            );
        }
        
        // Agregované grafy
        if (opts.isAggregate) {
            if (aggregatedData.ttk && aggregatedData.ttk.bySession) {
                chartPaths.aggregateTTKComparison = await generateAggregateTTKComparison(
                    Chart, aggregatedData.ttk, outputDir, opts
                );
            }
        }
        
        console.log(`✅ Vygenerováno ${Object.keys(chartPaths).length} grafů`);
        
        return chartPaths;
        
    } catch (error) {
        console.error('❌ Chyba při generování grafů:', error.message);
        
        // Fallback: vrať prázdný objekt, reporty budou fungovat bez grafů
        console.warn('⚠️ Grafy nebudou k dispozici - reporty budou obsahovat pouze tabulky');
        return {};
    }
}

/**
 * Importuje Chart.js s fallback řešením
 * @returns {Promise<Object>} Chart.js instance
 */
async function importChartJS() {
    try {
        // Pokus o import chart.js s canvas
        const { default: Chart, registerables } = await import('chart.js');
        const { default: ChartJSNodeCanvas } = await import('chartjs-node-canvas');
        
        Chart.register(...registerables);
        
        return {
            Chart,
            ChartJSNodeCanvas,
            available: true
        };
    } catch (error) {
        console.warn('⚠️ Chart.js není k dispozici, používám fallback generátor');
        
        // Fallback: vrať mock implementaci
        return {
            Chart: null,
            ChartJSNodeCanvas: null,
            available: false
        };
    }
}

/**
 * Generuje TTK histogram (bin 0.5s)
 * @param {Object} Chart - Chart.js instance
 * @param {Object} ttkData - TTK data
 * @param {string} outputDir - Výstupní složka
 * @param {Object} opts - Možnosti
 * @returns {Promise<string>} Název souboru
 */
async function generateTTKHistogram(Chart, ttkData, outputDir, opts) {
    if (!Chart.available) {
        return await generateFallbackChart('ttk_histogram.png', outputDir, 
            'TTK Histogram', 'Histogram rozložení Time-To-Kill');
    }
    
    const { ChartJSNodeCanvas } = Chart;
    const canvasRenderService = new ChartJSNodeCanvas({ 
        width: opts.width, 
        height: opts.height 
    });
    
    // Připrav data pro histogram
    const distribution = ttkData.distribution || [];
    const labels = distribution.map(bin => `${bin.min.toFixed(1)}-${bin.max.toFixed(1)}s`);
    const data = distribution.map(bin => bin.count);
    
    const configuration = {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Počet zabití',
                data,
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'TTK Histogram - Rozložení Time-To-Kill'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Počet zabití'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time-To-Kill (sekundy)'
                    }
                }
            }
        }
    };
    
    const buffer = await canvasRenderService.renderToBuffer(configuration);
    const filename = 'ttk_histogram.png';
    await writeFile(join(outputDir, filename), buffer);
    
    return filename;
}

/**
 * Generuje TTK boxplot podle typu nepřítele
 * @param {Object} Chart - Chart.js instance
 * @param {Object} ttkData - TTK data
 * @param {string} outputDir - Výstupní složka
 * @param {Object} opts - Možnosti
 * @returns {Promise<string>} Název souboru
 */
async function generateTTKBoxplot(Chart, ttkData, outputDir, opts) {
    if (!Chart.available) {
        return await generateFallbackChart('ttk_boxplot.png', outputDir,
            'TTK Boxplot', 'TTK podle typu nepřítele');
    }
    
    // Pro Chart.js použijeme aproximaci boxplotu pomocí bar chartu
    // V produkční verzi by se použil specializovaný boxplot plugin
    
    const { ChartJSNodeCanvas } = Chart;
    const canvasRenderService = new ChartJSNodeCanvas({ 
        width: opts.width, 
        height: opts.height 
    });
    
    const byType = ttkData.byType || {};
    const labels = Object.keys(byType).map(type => getEnemyTypeLabel(type));
    const medianData = Object.values(byType).map(typeData => typeData.median);
    const p90Data = Object.values(byType).map(typeData => typeData.p90);
    
    const configuration = {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Medián TTK',
                    data: medianData,
                    backgroundColor: 'rgba(54, 162, 235, 0.8)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                },
                {
                    label: '90. percentil',
                    data: p90Data,
                    backgroundColor: 'rgba(255, 99, 132, 0.8)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'TTK podle typu nepřítele'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Time-To-Kill (sekundy)'
                    }
                }
            }
        }
    };
    
    const buffer = await canvasRenderService.renderToBuffer(configuration);
    const filename = 'ttk_boxplot.png';
    await writeFile(join(outputDir, filename), buffer);
    
    return filename;
}

/**
 * Generuje TTK timeline s rolling average
 * @param {Object} Chart - Chart.js instance
 * @param {Object} ttkData - TTK data
 * @param {string} outputDir - Výstupní složka
 * @param {Object} opts - Možnosti
 * @returns {Promise<string>} Název souboru
 */
async function generateTTKTimeline(Chart, ttkData, outputDir, opts) {
    if (!Chart.available) {
        return await generateFallbackChart('ttk_timeline.png', outputDir,
            'TTK Timeline', 'Vývoj TTK v čase');
    }
    
    const { ChartJSNodeCanvas } = Chart;
    const canvasRenderService = new ChartJSNodeCanvas({ 
        width: opts.width, 
        height: opts.height 
    });
    
    const timeline = ttkData.timeline || [];
    const labels = timeline.map(point => formatTimeLabel(point.gameTime));
    const avgData = timeline.map(point => point.avgTTK);
    const medianData = timeline.map(point => point.medianTTK);
    
    const configuration = {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Průměrný TTK',
                    data: avgData,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Medián TTK',
                    data: medianData,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'TTK Timeline - Vývoj v čase'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Time-To-Kill (sekundy)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Herní čas'
                    }
                }
            }
        }
    };
    
    const buffer = await canvasRenderService.renderToBuffer(configuration);
    const filename = 'ttk_timeline.png';
    await writeFile(join(outputDir, filename), buffer);
    
    return filename;
}

/**
 * Generuje spawns timeline (stacked podle kategorie)
 * @param {Object} Chart - Chart.js instance
 * @param {Object} spawnsData - Spawns data
 * @param {string} outputDir - Výstupní složka
 * @param {Object} opts - Možnosti
 * @returns {Promise<string>} Název souboru
 */
async function generateSpawnsTimeline(Chart, spawnsData, outputDir, opts) {
    if (!Chart.available) {
        return await generateFallbackChart('spawns_timeline.png', outputDir,
            'Spawns Timeline', 'Spawns/min po intervalech');
    }
    
    const { ChartJSNodeCanvas } = Chart;
    const canvasRenderService = new ChartJSNodeCanvas({ 
        width: opts.width, 
        height: opts.height 
    });
    
    const timeline = spawnsData.timeline || [];
    const labels = timeline.map(point => `${point.minute}m`);
    
    // Připrav datasets pro každý typ nepřítele
    const entityTypes = ['enemy', 'elite', 'miniboss', 'boss', 'unique'];
    const colors = [
        'rgba(54, 162, 235, 0.8)',   // enemy - modrá
        'rgba(255, 206, 86, 0.8)',   // elite - žlutá
        'rgba(75, 192, 192, 0.8)',   // miniboss - zelená
        'rgba(255, 99, 132, 0.8)',   // boss - červená
        'rgba(153, 102, 255, 0.8)'   // unique - fialová
    ];
    
    const datasets = entityTypes.map((type, index) => ({
        label: getEnemyTypeLabel(type),
        data: timeline.map(point => point.byType[type] || 0),
        backgroundColor: colors[index],
        borderColor: colors[index].replace('0.8', '1'),
        borderWidth: 1
    }));
    
    const configuration = {
        type: 'bar',
        data: {
            labels,
            datasets
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Spawns Timeline - Spawns/min podle typu'
                }
            },
            scales: {
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Herní čas (minuty)'
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Spawns za minutu'
                    }
                }
            }
        }
    };
    
    const buffer = await canvasRenderService.renderToBuffer(configuration);
    const filename = 'spawns_timeline.png';
    await writeFile(join(outputDir, filename), buffer);
    
    return filename;
}

/**
 * Generuje loot distribuci (pie chart)
 * @param {Object} Chart - Chart.js instance
 * @param {Object} lootData - Loot data
 * @param {string} outputDir - Výstupní složka
 * @param {Object} opts - Možnosti
 * @returns {Promise<string>} Název souboru
 */
async function generateLootDistribution(Chart, lootData, outputDir, opts) {
    if (!Chart.available) {
        return await generateFallbackChart('loot_distribution.png', outputDir,
            'Loot Distribution', 'Distribuce loot podle rarity');
    }
    
    const { ChartJSNodeCanvas } = Chart;
    const canvasRenderService = new ChartJSNodeCanvas({ 
        width: opts.width, 
        height: opts.height 
    });
    
    const byRarity = lootData.byRarity || {};
    const labels = Object.keys(byRarity).map(rarity => getLootRarityLabel(rarity));
    const data = Object.values(byRarity);
    const colors = [
        'rgba(200, 200, 200, 0.8)', // common - šedá
        'rgba(76, 175, 80, 0.8)',   // uncommon - zelená
        'rgba(33, 150, 243, 0.8)',  // rare - modrá
        'rgba(156, 39, 176, 0.8)',  // epic - fialová
        'rgba(255, 152, 0, 0.8)'    // legendary - oranžová
    ];
    
    const configuration = {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: colors.slice(0, labels.length).map(c => c.replace('0.8', '1')),
                borderWidth: 2
            }]
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribuce loot podle rarity'
                },
                legend: {
                    position: 'right'
                }
            }
        }
    };
    
    const buffer = await canvasRenderService.renderToBuffer(configuration);
    const filename = 'loot_distribution.png';
    await writeFile(join(outputDir, filename), buffer);
    
    return filename;
}

/**
 * Generuje loot timeline
 * @param {Object} Chart - Chart.js instance
 * @param {Object} lootData - Loot data
 * @param {string} outputDir - Výstupní složka
 * @param {Object} opts - Možnosti
 * @returns {Promise<string>} Název souboru
 */
async function generateLootTimeline(Chart, lootData, outputDir, opts) {
    if (!Chart.available) {
        return await generateFallbackChart('loot_timeline.png', outputDir,
            'Loot Timeline', 'Loot/min v čase');
    }
    
    const { ChartJSNodeCanvas } = Chart;
    const canvasRenderService = new ChartJSNodeCanvas({ 
        width: opts.width, 
        height: opts.height 
    });
    
    const timeline = lootData.timeline || [];
    const labels = timeline.map(point => `${point.minute}m`);
    const data = timeline.map(point => point.rate);
    
    const configuration = {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Loot/min',
                data,
                borderColor: 'rgba(255, 206, 86, 1)',
                backgroundColor: 'rgba(255, 206, 86, 0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Loot Timeline - Loot/min v čase'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Loot za minutu'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Herní čas (minuty)'
                    }
                }
            }
        }
    };
    
    const buffer = await canvasRenderService.renderToBuffer(configuration);
    const filename = 'loot_timeline.png';
    await writeFile(join(outputDir, filename), buffer);
    
    return filename;
}

/**
 * Generuje DPS timeline (30s sampling)
 * @param {Object} Chart - Chart.js instance
 * @param {Object} dpsData - DPS data
 * @param {string} outputDir - Výstupní složka
 * @param {Object} opts - Možnosti
 * @returns {Promise<string>} Název souboru
 */
async function generateDPSTimeline(Chart, dpsData, outputDir, opts) {
    if (!Chart.available) {
        return await generateFallbackChart('dps_timeline.png', outputDir,
            'DPS Timeline', 'Player vs Incoming DPS');
    }
    
    const { ChartJSNodeCanvas } = Chart;
    const canvasRenderService = new ChartJSNodeCanvas({ 
        width: opts.width, 
        height: opts.height 
    });
    
    const timeline = dpsData.timeline || [];
    const labels = timeline.map(point => formatTimeLabel(point.gameTime));
    const playerDPS = timeline.map(point => point.playerDPS);
    const incomingDPS = timeline.map(point => point.incomingDPS);
    
    const configuration = {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Player DPS',
                    data: playerDPS,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Incoming DPS',
                    data: incomingDPS,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'DPS Timeline - Player vs Incoming'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'DPS (damage/second)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Herní čas'
                    }
                }
            }
        }
    };
    
    const buffer = await canvasRenderService.renderToBuffer(configuration);
    const filename = 'dps_timeline.png';
    await writeFile(join(outputDir, filename), buffer);
    
    return filename;
}

/**
 * Generuje progression timeline
 * @param {Object} Chart - Chart.js instance
 * @param {Object} progressionData - Progression data
 * @param {string} outputDir - Výstupní složka
 * @param {Object} opts - Možnosti
 * @returns {Promise<string>} Název souboru
 */
async function generateProgressionTimeline(Chart, progressionData, outputDir, opts) {
    if (!Chart.available) {
        return await generateFallbackChart('progression_timeline.png', outputDir,
            'Progression Timeline', 'XP a Level progrese');
    }
    
    const { ChartJSNodeCanvas } = Chart;
    const canvasRenderService = new ChartJSNodeCanvas({ 
        width: opts.width, 
        height: opts.height 
    });
    
    const timeline = progressionData.xpTimeline || [];
    const labels = timeline.map(point => formatTimeLabel(point.gameTime));
    const xpData = timeline.map(point => point.xp);
    const levelData = timeline.map(point => point.level * 1000); // škálováno pro vizualizaci
    
    const configuration = {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'XP',
                    data: xpData,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Level (×1000)',
                    data: levelData,
                    borderColor: 'rgba(255, 206, 86, 1)',
                    backgroundColor: 'rgba(255, 206, 86, 0.2)',
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Player Progression - XP a Level'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'XP'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Level'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                },
                x: {
                    title: {
                        display: true,
                        text: 'Herní čas'
                    }
                }
            }
        }
    };
    
    const buffer = await canvasRenderService.renderToBuffer(configuration);
    const filename = 'progression_timeline.png';
    await writeFile(join(outputDir, filename), buffer);
    
    return filename;
}

/**
 * Generuje NG+ srovnání
 * @param {Object} Chart - Chart.js instance
 * @param {Object} ngplusData - NG+ data
 * @param {string} outputDir - Výstupní složka
 * @param {Object} opts - Možnosti
 * @returns {Promise<string>} Název souboru
 */
async function generateNGPlusComparison(Chart, ngplusData, outputDir, opts) {
    if (!Chart.available) {
        return await generateFallbackChart('ngplus_comparison.png', outputDir,
            'NG+ Comparison', 'Srovnání NG+ úrovní');
    }
    
    const { ChartJSNodeCanvas } = Chart;
    const canvasRenderService = new ChartJSNodeCanvas({ 
        width: opts.width, 
        height: opts.height 
    });
    
    const segmentation = ngplusData.segmentation || {};
    const labels = Object.keys(segmentation).map(key => 
        key.replace('ng', 'NG+').replace('NG+0', 'NG+0')
    );
    
    const ttkData = Object.values(segmentation).map(ng => ng.ttk?.median || 0);
    const spawnsData = Object.values(segmentation).map(ng => ng.spawns?.rate || 0);
    const lootData = Object.values(segmentation).map(ng => ng.loot?.rate || 0);
    
    const configuration = {
        type: 'radar',
        data: {
            labels: ['TTK (s)', 'Spawns/min', 'Loot/min', 'Doba (min)', 'Eventy'],
            datasets: labels.map((label, index) => {
                const ng = Object.values(segmentation)[index];
                return {
                    label,
                    data: [
                        ng.ttk?.median || 0,
                        ng.spawns?.rate || 0,
                        ng.loot?.rate || 0,
                        (ng.duration || 0) / 60,
                        (ng.totalEvents || 0) / 100
                    ],
                    borderColor: `hsla(${index * 60}, 70%, 50%, 1)`,
                    backgroundColor: `hsla(${index * 60}, 70%, 50%, 0.2)`,
                    pointBackgroundColor: `hsla(${index * 60}, 70%, 50%, 1)`,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: `hsla(${index * 60}, 70%, 50%, 1)`
                };
            })
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'NG+ Comparison - Metriky podle úrovně'
                }
            },
            elements: {
                line: {
                    borderWidth: 3
                }
            }
        }
    };
    
    const buffer = await canvasRenderService.renderToBuffer(configuration);
    const filename = 'ngplus_comparison.png';
    await writeFile(join(outputDir, filename), buffer);
    
    return filename;
}

/**
 * Generuje agregované TTK srovnání
 * @param {Object} Chart - Chart.js instance
 * @param {Object} ttkData - TTK data
 * @param {string} outputDir - Výstupní složka
 * @param {Object} opts - Možnosti
 * @returns {Promise<string>} Název souboru
 */
async function generateAggregateTTKComparison(Chart, ttkData, outputDir, opts) {
    if (!Chart.available) {
        return await generateFallbackChart('aggregate_ttk_comparison.png', outputDir,
            'Aggregate TTK Comparison', 'Srovnání TTK napříč sessions');
    }
    
    const { ChartJSNodeCanvas } = Chart;
    const canvasRenderService = new ChartJSNodeCanvas({ 
        width: opts.width, 
        height: opts.height 
    });
    
    const bySession = ttkData.bySession || [];
    const labels = bySession.map(session => session.sessionId.slice(-8));
    const medianData = bySession.map(session => session.median);
    const sampleData = bySession.map(session => session.samples);
    
    const configuration = {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Medián TTK (s)',
                    data: medianData,
                    backgroundColor: 'rgba(54, 162, 235, 0.8)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Vzorky / 100',
                    data: sampleData.map(s => s / 100),
                    backgroundColor: 'rgba(255, 206, 86, 0.8)',
                    borderColor: 'rgba(255, 206, 86, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'TTK Srovnání Across Sessions'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'TTK (sekundy)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Vzorky (×100)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    };
    
    const buffer = await canvasRenderService.renderToBuffer(configuration);
    const filename = 'aggregate_ttk_comparison.png';
    await writeFile(join(outputDir, filename), buffer);
    
    return filename;
}

/**
 * Generuje fallback graf (placeholder)
 * @param {string} filename - Název souboru
 * @param {string} outputDir - Výstupní složka
 * @param {string} title - Titulek grafu
 * @param {string} description - Popis grafu
 * @returns {Promise<string>} Název souboru
 */
async function generateFallbackChart(filename, outputDir, title, description) {
    // Vytvoř jednoduchý SVG placeholder
    const svgContent = `
<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f8f9fa"/>
    <rect x="50" y="50" width="700" height="500" fill="white" stroke="#dee2e6" stroke-width="2"/>
    <text x="400" y="150" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#495057">${title}</text>
    <text x="400" y="200" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#6c757d">${description}</text>
    <text x="400" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#868e96">
        Graf není k dispozici - Chart.js dependency chybí
    </text>
    <text x="400" y="330" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#adb5bd">
        Pro zobrazení grafů nainstalujte: npm install chart.js chartjs-node-canvas
    </text>
</svg>
    `.trim();
    
    // Uloží jako SVG (můžeme později převést na PNG)
    const svgFilename = filename.replace('.png', '.svg');
    await writeFile(join(outputDir, svgFilename), svgContent, 'utf8');
    
    return svgFilename;
}

// === HELPER FUNKCE ===

/**
 * Formátuje herní čas na label
 * @param {number} gameTimeSeconds - Herní čas v sekundách
 * @returns {string} Formátovaný label
 */
function formatTimeLabel(gameTimeSeconds) {
    const minutes = Math.floor(gameTimeSeconds / 60);
    const seconds = Math.floor(gameTimeSeconds % 60);
    
    if (minutes === 0) {
        return `${seconds}s`;
    }
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Získá label pro typ nepřítele
 * @param {string} type - Typ nepřítele
 * @returns {string} Label
 */
function getEnemyTypeLabel(type) {
    const labels = {
        'enemy': 'Běžný',
        'elite': 'Elite',
        'miniboss': 'Mini-boss',
        'boss': 'Boss',
        'unique': 'Unique'
    };
    
    return labels[type] || type;
}

/**
 * Získá label pro raritu loot
 * @param {string} rarity - Rarita
 * @returns {string} Label
 */
function getLootRarityLabel(rarity) {
    const labels = {
        'common': 'Běžný',
        'uncommon': 'Neobvyklý',
        'rare': 'Vzácný',
        'epic': 'Epický',
        'legendary': 'Legendární'
    };
    
    return labels[rarity] || rarity;
}