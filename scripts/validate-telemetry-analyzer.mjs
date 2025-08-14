#!/usr/bin/env node
/**
 * Validační script pro Telemetry Analyzer
 * 
 * Validuje všechny komponenty analyzeru a vytvoří ukázkový report.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Vytvoří mock telemetrický log pro testování
 */
async function createMockTelemetryLog() {
    const sessionId = `session_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}_test`;
    const startTime = Date.now();
    
    // Simulované eventy pro 30-minutovou session
    const events = [];
    
    // SessionStart
    events.push({
        type: 'SessionStart',
        gameTime: 0,
        timestamp: startTime,
        sessionId,
        ngPlusLevel: 1,
        gameVersion: '0.2.0'
    });
    
    // Simuluj 30 minut gameplay
    let gameTime = 0;
    let entityCounter = 1;
    let playerLevel = 1;
    let playerXP = 0;
    let playerHP = 100;
    
    for (let minute = 0; minute < 30; minute++) {
        gameTime = minute * 60;
        
        // Spawny (postupně se zvyšující intenzita)
        const spawnsThisMinute = Math.min(5 + minute * 2, 25);
        for (let spawn = 0; spawn < spawnsThisMinute; spawn++) {
            const entityId = `entity_${entityCounter++}`;
            let entityType = 'enemy';
            
            // Distribuce typů
            const rand = Math.random();
            if (rand < 0.05) entityType = 'boss';
            else if (rand < 0.15) entityType = 'miniboss';
            else if (rand < 0.25) entityType = 'unique';
            else if (rand < 0.40) entityType = 'elite';
            
            const spawnTime = gameTime + (spawn / spawnsThisMinute) * 60;
            const trackingId = `${entityId}_${Math.floor(spawnTime)}_${Math.random().toString(36).substr(2, 4)}`;
            
            events.push({
                type: 'SpawnEvent',
                gameTime: spawnTime,
                timestamp: startTime + spawnTime * 1000,
                sessionId,
                entityType,
                entityId,
                trackingId,
                position: { x: Math.random() * 800, y: Math.random() * 600 },
                spawnCount: entityCounter
            });
            
            // Kill po 1-5 sekundách
            const ttk = Math.random() * 4 + 0.5; // 0.5-4.5s TTK
            const killTime = spawnTime + ttk;
            
            if (killTime < (minute + 1) * 60) {
                events.push({
                    type: 'TTKEvent',
                    gameTime: killTime,
                    timestamp: startTime + killTime * 1000,
                    sessionId,
                    trackingId,
                    entityType,
                    entityId,
                    timeToKill: ttk,
                    spawnTime: spawnTime,
                    killTime: killTime,
                    killCount: entityCounter,
                    playerLevel
                });
                
                // Loot drop (70% chance)
                if (Math.random() < 0.7) {
                    let quality = 'common';
                    const qualityRand = Math.random();
                    if (qualityRand < 0.02) quality = 'legendary';
                    else if (qualityRand < 0.10) quality = 'epic';
                    else if (qualityRand < 0.25) quality = 'rare';
                    else if (qualityRand < 0.50) quality = 'uncommon';
                    
                    const dropType = Math.random() < 0.6 ? 'XP' : 
                                   Math.random() < 0.3 ? 'health' : 'mutator';
                    
                    events.push({
                        type: 'LootDropEvent',
                        gameTime: killTime + 0.1,
                        timestamp: startTime + (killTime + 0.1) * 1000,
                        sessionId,
                        dropType,
                        quality,
                        sourceType: entityType,
                        sourceId: entityId,
                        position: { x: Math.random() * 800, y: Math.random() * 600 }
                    });
                }
            }
        }
        
        // DPS stats každých 30s
        if (minute % 1 === 0) {
            const playerDPS = 80 + minute * 5 + Math.random() * 20;
            const incomingDPS = 15 + minute * 2 + Math.random() * 10;
            
            events.push({
                type: 'DamageStatsEvent',
                gameTime: gameTime,
                timestamp: startTime + gameTime * 1000,
                sessionId,
                playerDPS: Math.round(playerDPS * 10) / 10,
                incomingDPS: Math.round(incomingDPS * 10) / 10,
                totalDamageDealt: playerDPS * 60,
                totalDamageTaken: incomingDPS * 60,
                interval: 60
            });
        }
        
        // Player progress
        if (minute > 0 && minute % 3 === 0) {
            playerLevel++;
            playerXP += 500 + Math.random() * 300;
            
            events.push({
                type: 'PlayerProgressEvent',
                gameTime: gameTime,
                timestamp: startTime + gameTime * 1000,
                sessionId,
                playerXP: Math.round(playerXP),
                playerLevel,
                playerHP: playerHP,
                playerMaxHP: 100,
                activePowerups: [
                    { id: 'damage_boost', level: Math.ceil(minute / 10), timeRemaining: 30 },
                    { id: 'piercing_arrows', level: 1, timeRemaining: null }
                ],
                totalEnemiesKilled: entityCounter - 1,
                currentStage: Math.ceil(minute / 10)
            });
        }
    }
    
    // SessionSummary
    events.push({
        type: 'SessionSummaryEvent',
        gameTime: 1800, // 30 minut
        timestamp: startTime + 1800 * 1000,
        sessionId,
        reason: 'game_over',
        sessionDuration: 1800,
        reachedStage: 3,
        ngPlusLevel: 1,
        totalEnemiesKilled: entityCounter - 1,
        killsByType: {
            enemy: Math.floor(entityCounter * 0.5),
            elite: Math.floor(entityCounter * 0.25),
            miniboss: Math.floor(entityCounter * 0.15),
            boss: Math.floor(entityCounter * 0.05),
            unique: Math.floor(entityCounter * 0.05)
        },
        spawnsByType: {
            enemy: Math.floor(entityCounter * 0.5),
            elite: Math.floor(entityCounter * 0.25),
            miniboss: Math.floor(entityCounter * 0.15),
            boss: Math.floor(entityCounter * 0.05),
            unique: Math.floor(entityCounter * 0.05)
        },
        lootByRarity: {
            common: 200,
            uncommon: 80,
            rare: 25,
            epic: 8,
            legendary: 2
        },
        averageTTK: {
            enemy: 2.1,
            elite: 2.8,
            miniboss: 4.2,
            boss: 8.5,
            unique: 3.5
        },
        finalPlayerLevel: playerLevel,
        finalPlayerXP: Math.round(playerXP),
        totalDamageDealt: 180000,
        totalDamageTaken: 45000
    });
    
    // Seřaď eventy podle času
    events.sort((a, b) => a.gameTime - b.gameTime);
    
    const logData = {
        sessionId,
        events,
        flushTime: Date.now()
    };
    
    // Uložit test log
    await mkdir(join(projectRoot, 'logs'), { recursive: true });
    const logPath = join(projectRoot, 'logs', `${sessionId}.json`);
    await writeFile(logPath, JSON.stringify(logData, null, 2));
    
    console.log(`✅ Mock telemetry log vytvořen: ${logPath}`);
    console.log(`📊 Eventy: ${events.length}, Délka: ${Math.round(1800 / 60)}min, Entity: ${entityCounter - 1}`);
    
    return logPath;
}

/**
 * Testuje telemetry analyzer s mock daty
 */
async function testTelemetryAnalyzer(logPath) {
    console.log('\n🧪 Testuji Telemetry Analyzer...');
    
    try {
        const { TelemetryAnalyzer } = await import('./analyze-telemetry.mjs');
        
        const analyzer = new TelemetryAnalyzer({
            outputDir: 'build/reports',
            generateHtml: true,
            verbose: true
        });
        
        console.log('📊 Spouštím analýzu...');
        const result = await analyzer.analyzeSession(logPath);
        
        console.log(`✅ Analýza úspěšná!`);
        console.log(`📁 Report: ${result.outputPath}`);
        
        // Zkontroluj, zda byly vytvořeny potřebné soubory
        const expectedFiles = ['report.md', 'summary.json'];
        
        for (const file of expectedFiles) {
            try {
                const { stat } = await import('fs/promises');
                await stat(join(result.outputPath, file));
                console.log(`  ✅ ${file}`);
            } catch (error) {
                console.log(`  ❌ ${file} - chybí`);
            }
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Test analyzeru selhal:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        throw error;
    }
}

/**
 * Hlavní validační funkce
 */
async function runValidation() {
    console.log('🔍 Validace Telemetry Analyzer System\n');
    
    try {
        // 1. Vytvoř mock data
        console.log('1️⃣ Vytvářím mock telemetry log...');
        const logPath = await createMockTelemetryLog();
        
        // 2. Testuj analyzer
        console.log('\n2️⃣ Testuji analyzer...');
        const result = await testTelemetryAnalyzer(logPath);
        
        // 3. Shrnutí
        console.log('\n📋 Validace dokončena!');
        console.log('✅ Mock telemetry log vytvořen');
        console.log('✅ Analyzer funguje správně');
        console.log(`✅ Report vygenerován v: ${result.outputPath}`);
        
        console.log('\n🚀 Pro testování použijte:');
        console.log(`npm run analyze:session -- "${logPath}"`);
        console.log(`npm run analyze:latest`);
        console.log(`npm run analyze:verbose`);
        
    } catch (error) {
        console.error('\n❌ Validace selhala:', error.message);
        process.exit(1);
    }
}

// Spustit validaci
if (import.meta.url === `file://${process.argv[1]}`) {
    runValidation();
}

export { createMockTelemetryLog, testTelemetryAnalyzer };