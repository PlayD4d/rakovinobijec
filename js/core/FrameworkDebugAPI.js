/**
 * Framework Debug API - Runtime healthcheck and scenario information
 * 
 * Provides diagnostic tools for verifying that new systems are properly
 * integrated and functioning during runtime.
 */

export class FrameworkDebugAPI {
    constructor(gameScene) {
        this.gameScene = gameScene;
        this.metrics = {
            vfxCalls: 0,
            sfxCalls: 0,
            spawnedFromSpawnTables: 0,
            spawnedFromLegacy: 0,
            lootDropsFromTables: 0,
            legacyLootDrops: 0,
            systemInitTime: Date.now()
        };
        
        // Hook into systems to track usage
        this.setupMetricsHooks();
        
        // Expose to global debug console
        this.exposeGlobalAPI();
    }

    setupMetricsHooks() {
        // Hook VFX system if available
        if (this.gameScene.vfxSystem) {
            const originalPlay = this.gameScene.vfxSystem.play.bind(this.gameScene.vfxSystem);
            this.gameScene.vfxSystem.play = (...args) => {
                this.metrics.vfxCalls++;
                return originalPlay(...args);
            };
        }

        // Hook SFX system if available  
        if (this.gameScene.sfxSystem) {
            const originalPlay = this.gameScene.sfxSystem.play.bind(this.gameScene.sfxSystem);
            this.gameScene.sfxSystem.play = (...args) => {
                this.metrics.sfxCalls++;
                return originalPlay(...args);
            };
        }

        // Hook spawn director if available
        if (this.gameScene.spawnDirector) {
            const originalSpawn = this.gameScene.spawnDirector.spawnEnemy?.bind(this.gameScene.spawnDirector);
            if (originalSpawn) {
                this.gameScene.spawnDirector.spawnEnemy = (...args) => {
                    this.metrics.spawnedFromSpawnTables++;
                    return originalSpawn(...args);
                };
            }
        }

        // No legacy enemy manager - all spawning through SpawnDirector

        // Hook loot manager if available (PR7: no stack inspection — too expensive for hot path)
        if (this.gameScene.lootManager) {
            const originalDrop = this.gameScene.lootManager.dropLoot?.bind(this.gameScene.lootManager);
            if (originalDrop) {
                this.gameScene.lootManager.dropLoot = (...args) => {
                    this.metrics.lootDropsFromTables++;
                    return originalDrop(...args);
                };
            }
        }
    }

    /**
     * Returns comprehensive system health information
     */
    healthcheck() {
        const uptime = Date.now() - this.metrics.systemInitTime;
        
        return {
            timestamp: new Date().toISOString(),
            uptime: Math.round(uptime / 1000), // seconds
            
            systems: {
                vfx: {
                    ready: !!this.gameScene.vfxSystem,
                    initialized: !!this.gameScene.vfxSystem?.initialized,
                    activeEmitters: this.getActiveVFXCount()
                },
                sfx: {
                    ready: !!this.gameScene.sfxSystem,
                    initialized: !!this.gameScene.sfxSystem?.initialized,
                    activeVoices: this.getActiveSFXCount()
                },
                loot: {
                    ready: !!this.gameScene.lootManager,
                    tablesLoaded: this.getLootTablesCount(),
                    pitySystemActive: !!this.gameScene.pitySystem
                },
                spawnDirector: {
                    ready: !!this.gameScene.spawnDirector,
                    currentLevel: this.gameScene.spawnDirector?.currentLevel || null,
                    tablesLoaded: this.getSpawnTablesCount()
                },
                settingsManager: {
                    ready: !!this.gameScene.settingsManager,
                    configResolved: !!this.gameScene.configResolver
                },
                // Modifiers applied directly in Player
            },
            
            usage: {
                vfxCalls: this.metrics.vfxCalls,
                sfxCalls: this.metrics.sfxCalls,
                spawnedFromSpawnTables: this.metrics.spawnedFromSpawnTables,
                spawnedFromLegacy: this.metrics.spawnedFromLegacy,
                lootDropsFromTables: this.metrics.lootDropsFromTables,
                legacyLootDrops: this.metrics.legacyLootDrops
            },
            
            blueprintRefs: {
                uniqueVFXUsed: this.getUniqueVFXUsed(),
                uniqueSFXUsed: this.getUniqueSFXUsed(),
                entitiesSpawned: this.getUniqueEntitiesSpawned()
            },
            
            validation: {
                modernSystemsActive: this.metrics.spawnedFromSpawnTables > 0 && this.metrics.vfxCalls > 0,
                legacySystemsInactive: this.metrics.spawnedFromLegacy === 0,
                allSystemsReady: this.areAllSystemsReady(),
                recommendations: this.getRecommendations()
            }
        };
    }

    /**
     * Returns current scenario/level information
     */
    scenarioInfo() {
        const spawnDirector = this.gameScene.spawnDirector;
        const currentLevel = this.gameScene.currentLevel || 1;
        
        return {
            timestamp: new Date().toISOString(),
            scenario: {
                id: spawnDirector?.currentScenario?.id || `level${currentLevel}`,
                stage: this.gameScene.stage || 1,
                currentWave: spawnDirector?.currentWave || 0,
                timeElapsed: Math.round((Date.now() - (this.gameScene.startTime || Date.now())) / 1000),
                dataSource: spawnDirector ? 'spawn_table' : 'legacy'
            },
            
            progress: {
                enemiesKilled: this.gameScene.enemiesKilled || 0,
                eliteSpawns: this.getEliteSpawnCount(),
                uniqueSpawns: this.getUniqueSpawnCount(),
                bossesDefeated: this.gameScene.bossesDefeated || 0
            },
            
            waves: {
                totalWaves: spawnDirector?.totalWaves || 0,
                completedWaves: spawnDirector?.completedWaves || 0,
                activeEnemies: this.getActiveEnemyCount(),
                spawnRate: this.getCurrentSpawnRate()
            },
            
            loot: {
                dropsThisSession: this.metrics.lootDropsFromTables + this.metrics.legacyLootDrops,
                powerupsCollected: this.gameScene.powerupsCollected || 0,
                xpGained: this.gameScene.player?.xp || 0
            }
        };
    }

    // Helper methods for system state detection
    getActiveVFXCount() {
        if (!this.gameScene.vfxSystem?.emitters) return 0;
        return this.gameScene.vfxSystem.emitters.filter(e => e.active).length;
    }

    getActiveSFXCount() {
        if (!this.gameScene.sound) return 0;
        return Object.values(this.gameScene.sound.sounds).filter(s => s.isPlaying).length;
    }

    getLootTablesCount() {
        return this.gameScene.lootManager?.tables?.size || 0;
    }

    getSpawnTablesCount() {
        return this.gameScene.spawnDirector?.tables?.size || 0;
    }

    getActiveModifiersCount() {
        return this.gameScene.player?.activeModifiers?.length || 0;
    }

    getUniqueVFXUsed() {
        // Would need to track unique VFX IDs used
        return this.gameScene.vfxSystem?.usedEffects?.size || 0;
    }

    getUniqueSFXUsed() {
        // Would need to track unique SFX IDs used
        return this.gameScene.sfxSystem?.usedSounds?.size || 0;
    }

    getUniqueEntitiesSpawned() {
        // Would need to track unique entity IDs spawned
        return this.gameScene.spawnDirector?.spawnedTypes?.size || 0;
    }

    getEliteSpawnCount() {
        return this.gameScene.spawnDirector?.eliteSpawnCount || 0;
    }

    getUniqueSpawnCount() {
        return this.gameScene.spawnDirector?.uniqueSpawnCount || 0;
    }

    getActiveEnemyCount() {
        return this.gameScene.enemies?.children?.entries?.length || 0;
    }

    getCurrentSpawnRate() {
        return this.gameScene.spawnDirector?.currentSpawnRate || 0;
    }

    areAllSystemsReady() {
        const systems = [
            'vfxSystem', 'sfxSystem', 'lootManager', 
            'spawnDirector', 'settingsManager'
        ];
        
        return systems.every(system => !!this.gameScene[system]);
    }

    getRecommendations() {
        const recommendations = [];
        
        if (this.metrics.spawnedFromLegacy > 0) {
            recommendations.push('Legacy spawn system still in use - check SpawnDirector integration');
        }
        
        if (this.metrics.vfxCalls === 0 && this.metrics.systemInitTime < Date.now() - 30000) {
            recommendations.push('No VFX calls detected after 30s - verify VFXSystem integration');
        }
        
        if (this.metrics.sfxCalls === 0 && this.metrics.systemInitTime < Date.now() - 30000) {
            recommendations.push('No SFX calls detected after 30s - verify SFXSystem integration');
        }
        
        if (this.metrics.lootDropsFromTables === 0 && this.metrics.legacyLootDrops > 0) {
            recommendations.push('Using legacy loot system - verify LootTable integration');
        }
        
        return recommendations;
    }
    
    /**
     * Called when player shoots
     */
    onPlayerShoot() {
        this.metrics.playerShots = (this.metrics.playerShots || 0) + 1;
    }
    
    /**
     * Called when enemy spawns
     */
    onEnemySpawned(source = 'unknown') {
        if (source === 'legacy') {
            this.metrics.spawnedFromLegacy++;
        } else if (source === 'blueprint') {
            this.metrics.spawnedFromSpawnTables++;
        }
    }

    /**
     * Expose debug API to global console
     */
    exposeGlobalAPI() {
        if (typeof window !== 'undefined') {
            window.__framework = window.__framework || {};
            window.__framework.healthcheck = () => this.healthcheck();
            window.__framework.scenario = {
                info: () => this.scenarioInfo()
            };
            
            // Add missing assets tracking
            window.DEV = window.DEV || {};
            window.DEV.dumpMissing = () => this.dumpMissingAssets();
            window.DEV.clearMissing = () => this.clearMissingAssets();
            window.DEV.copyMissing = (type) => this.copyMissingAssets(type);
            
            // Add convenience methods
            window.__framework.systems = {
                vfx: this.gameScene.vfxSystem,
                sfx: this.gameScene.sfxSystem,
                loot: this.gameScene.lootManager,
                spawn: this.gameScene.spawnDirector
            };
            
            // Add smoke test runner
            window.__framework.smokeTest = async () => {
                try {
                    const { SmokeTest } = await import('../utils/SmokeTest.js');
                    const test = new SmokeTest(this.gameScene);
                    return await test.run();
                } catch (error) {
                    console.error('[SmokeTest] Failed to run:', error);
                    return { error: error.message };
                }
            };
            
            // Quick check method
            window.__framework.quickCheck = async () => {
                try {
                    const { SmokeTest } = await import('../utils/SmokeTest.js');
                    return await SmokeTest.quickCheck(this.gameScene);
                } catch (error) {
                    console.error('[SmokeTest] Quick check failed:', error);
                    return { error: error.message };
                }
            };
            
            // =======================
            // NEW TESTING HOOKS
            // =======================
            
            // Automated testing framework integration
            window.__framework.testing = {
                // Initialize automated testing
                init: async () => {
                    try {
                        const { GameplayAutomation } = await import('./testing/GameplayAutomation.js');
                        const { ErrorDetector } = await import('./testing/ErrorDetector.js');
                        
                        this.automation = new GameplayAutomation(this.gameScene);
                        this.errorDetector = new ErrorDetector();
                        
                        // Hook automation to scene update
                        const originalUpdate = this.gameScene.update;
                        this.gameScene.update = function(time, delta) {
                            if (originalUpdate) originalUpdate.call(this, time, delta);
                            if (this.automation?.enabled) {
                                this.automation.update(time, delta);
                            }
                        }.bind(this.gameScene);
                        
                        console.log('✅ Automated testing initialized');
                        return { success: true };
                    } catch (error) {
                        console.error('❌ Failed to initialize testing:', error);
                        return { success: false, error: error.message };
                    }
                },
                
                // Start automated bot
                startBot: (config = {}) => {
                    if (!this.automation) {
                        console.error('Testing not initialized. Run __framework.testing.init() first');
                        return false;
                    }
                    
                    Object.assign(this.automation.botConfig, config);
                    this.automation.enabled = true;
                    console.log('🤖 Bot started with config:', this.automation.botConfig);
                    return true;
                },
                
                // Stop automated bot
                stopBot: () => {
                    if (this.automation) {
                        this.automation.enabled = false;
                        console.log('🛑 Bot stopped');
                    }
                },
                
                // Get automation report
                getReport: () => {
                    if (!this.automation) return null;
                    return this.automation.generateReport();
                },
                
                // Run specific scenario
                runScenario: async (scenarioName) => {
                    try {
                        const scenarios = {
                            CoreGameplay: () => import('./testing/scenarios/CoreGameplay.js'),
                            EnemyBehaviors: () => import('./testing/scenarios/EnemyBehaviors.js'),
                            BossFights: () => import('./testing/scenarios/AllScenarios.js').then(m => ({ BossFights: m.BossFights })),
                            PowerUpCombos: () => import('./testing/scenarios/AllScenarios.js').then(m => ({ PowerUpCombos: m.PowerUpCombos })),
                            EdgeCases: () => import('./testing/scenarios/AllScenarios.js').then(m => ({ EdgeCases: m.EdgeCases }))
                        };
                        
                        if (!scenarios[scenarioName]) {
                            console.error(`Unknown scenario: ${scenarioName}`);
                            console.log('Available scenarios:', Object.keys(scenarios));
                            return null;
                        }
                        
                        // Initialize automation if needed
                        if (!this.automation) {
                            await window.__framework.testing.init();
                        }
                        
                        // Load and run scenario
                        const module = await scenarios[scenarioName]();
                        const ScenarioClass = module[scenarioName] || module.default;
                        const scenario = new ScenarioClass();
                        
                        console.log(`🎮 Running scenario: ${scenarioName}`);
                        const result = await scenario.execute(this.automation);
                        
                        console.log(`✅ Scenario complete. Status: ${result.scenario.status}`);
                        return result;
                        
                    } catch (error) {
                        console.error(`Failed to run scenario ${scenarioName}:`, error);
                        return { error: error.message };
                    }
                },
                
                // Get error detector report
                getErrors: () => {
                    if (!this.errorDetector) return null;
                    return this.errorDetector.getReport();
                },
                
                // Clear error detector
                clearErrors: () => {
                    if (this.errorDetector) {
                        this.errorDetector.clear();
                        console.log('🧹 Error detector cleared');
                    }
                }
            };
            
            // Enhanced DEV commands for testing
            window.DEV.test = {
                // Quick test commands
                bot: (pattern = 'aggressive') => {
                    window.__framework.testing.startBot({ movementPattern: pattern });
                },
                stop: () => {
                    window.__framework.testing.stopBot();
                },
                report: () => {
                    const report = window.__framework.testing.getReport();
                    console.table(report?.metrics);
                    return report;
                },
                
                // Run scenarios
                core: () => window.__framework.testing.runScenario('CoreGameplay'),
                enemy: () => window.__framework.testing.runScenario('EnemyBehaviors'),
                boss: () => window.__framework.testing.runScenario('BossFights'),
                powerup: () => window.__framework.testing.runScenario('PowerUpCombos'),
                stress: () => window.__framework.testing.runScenario('EdgeCases'),
                
                // Run all scenarios
                all: async () => {
                    const scenarios = ['CoreGameplay', 'EnemyBehaviors', 'BossFights', 'PowerUpCombos', 'EdgeCases'];
                    const results = [];
                    
                    for (const scenario of scenarios) {
                        console.log(`\n🔄 Running ${scenario}...`);
                        const result = await window.__framework.testing.runScenario(scenario);
                        results.push(result);
                        
                        // Reset between scenarios
                        if (window.DEV.killAll) window.DEV.killAll();
                        await new Promise(r => setTimeout(r, 2000));
                    }
                    
                    // Summary
                    console.log('\n📊 Test Summary:');
                    results.forEach(r => {
                        console.log(`  ${r.scenario.name}: ${r.scenario.status}`);
                    });
                    
                    return results;
                }
            };
            
            // Get counters for telemetry
            window.__framework.getCounters = () => {
                return {
                    vfxPlayed: this.metrics.vfxCalls,
                    sfxPlayed: this.metrics.sfxCalls,
                    enemiesFromBlueprints: this.metrics.spawnedFromSpawnTables,
                    enemiesFromLegacy: this.metrics.spawnedFromLegacy,
                    lootFromTables: this.metrics.lootDropsFromTables,
                    lootFromLegacy: this.metrics.legacyLootDrops
                };
            };
            
            // Get telemetry data
            window.__framework.getTelemetry = () => {
                return {
                    totalEvents: this.gameScene.telemetryLogger?.eventCount || 0,
                    sessionActive: true,
                    startTime: this.metrics.systemInitTime
                };
            };
            
            console.log('🔧 Framework Debug API exposed to window.__framework');
            console.log('   - Use __framework.healthcheck() to check system status');
            console.log('   - Use __framework.smokeTest() to run full smoke test');
            console.log('   - Use __framework.quickCheck() for quick verification');
            console.log('🤖 Automated Testing API exposed to window.__framework.testing');
            console.log('   - Use __framework.testing.init() to initialize');
            console.log('   - Use DEV.test.bot() to start bot player');
            console.log('   - Use DEV.test.core() to run core gameplay tests');
            console.log('   - Use DEV.test.all() to run all test scenarios');
        }
    }

    /**
     * Reset metrics (useful for testing)
     */
    resetMetrics() {
        this.metrics = {
            vfxCalls: 0,
            sfxCalls: 0,
            spawnedFromSpawnTables: 0,
            spawnedFromLegacy: 0,
            lootDropsFromTables: 0,
            legacyLootDrops: 0,
            systemInitTime: Date.now()
        };
    }
    
    /**
     * Generate diagnostic report for CI/testing
     */
    generateDiagnosticReport() {
        const health = this.healthcheck();
        const scenario = this.scenarioInfo();
        
        return {
            timestamp: new Date().toISOString(),
            status: health.validation.allSystemsReady ? 'PASS' : 'FAIL',
            healthcheck: health,
            scenario: scenario,
            
            // CI/CD validation flags
            validation: {
                vfxSystemActive: health.systems.vfx.ready && health.usage.vfxCalls > 0,
                sfxSystemActive: health.systems.sfx.ready && health.usage.sfxCalls > 0,
                spawnTablesUsed: health.usage.spawnedFromSpawnTables > 0,
                legacySpawnsInactive: health.usage.spawnedFromLegacy === 0,
                lootTablesUsed: health.usage.lootDropsFromTables > 0,
                modernSystemsOnly: health.validation.modernSystemsActive && health.validation.legacySystemsInactive
            }
        };
    }
    
    // HOTFIX V3: Enemy visibility diagnostics
    enemyVisibilityCheck() {
        const enemies = this.gameScene.enemies?.children?.entries || [];
        const diagnostics = {
            totalEnemies: enemies.length,
            visibleEnemies: 0,
            textureIssues: [],
            positionIssues: [],
            activeEnemies: 0
        };
        
        enemies.forEach((enemy, index) => {
            if (!enemy.active) return;
            diagnostics.activeEnemies++;
            
            // Check texture
            if (!enemy.texture || enemy.texture.key === '__MISSING') {
                diagnostics.textureIssues.push({
                    index,
                    blueprintId: enemy.blueprintId,
                    textureKey: enemy.texture?.key,
                    position: { x: Math.floor(enemy.x), y: Math.floor(enemy.y) }
                });
            }
            
            // Check if enemy is within reasonable bounds
            const camera = this.gameScene.cameras.main;
            const margin = 200; // Expanded margin for off-screen enemies moving in
            if (enemy.x >= camera.scrollX - margin && 
                enemy.x <= camera.scrollX + camera.width + margin &&
                enemy.y >= camera.scrollY - margin && 
                enemy.y <= camera.scrollY + camera.height + margin) {
                diagnostics.visibleEnemies++;
            } else {
                diagnostics.positionIssues.push({
                    index,
                    blueprintId: enemy.blueprintId,
                    position: { x: Math.floor(enemy.x), y: Math.floor(enemy.y) },
                    camera: {
                        x: Math.floor(camera.scrollX),
                        y: Math.floor(camera.scrollY),
                        w: camera.width,
                        h: camera.height
                    }
                });
            }
        });
        
        return diagnostics;
    }
    
    // HOTFIX V3: Texture availability check
    textureRegistryCheck() {
        const textureManager = this.gameScene.textures;
        const requiredTextures = ['player', 'enemy.necrotic', 'enemy.swarm'];
        const diagnostics = {
            totalTextures: textureManager.list.size,
            requiredTexturesFound: 0,
            missingTextures: [],
            availableTextures: []
        };
        
        requiredTextures.forEach(textureKey => {
            if (textureManager.exists(textureKey)) {
                diagnostics.requiredTexturesFound++;
            } else {
                diagnostics.missingTextures.push(textureKey);
            }
        });
        
        // List all available textures for debugging
        textureManager.list.forEach((texture, key) => {
            diagnostics.availableTextures.push(key);
        });
        
        return diagnostics;
    }
    
    // HOTFIX V3: Spawn system diagnostics
    spawnSystemCheck() {
        const spawnDirector = this.gameScene.spawnDirector;
        const diagnostics = {
            spawnDirectorActive: !!spawnDirector,
            currentScenario: spawnDirector?.scenarioId || null,
            gameTime: spawnDirector ? Math.floor(spawnDirector.gameTime / 1000) : 0,
            spawnStats: spawnDirector?.stats || {},
            recentSpawns: this.getRecentSpawnActivity()
        };
        
        if (spawnDirector) {
            diagnostics.spawnTableLoaded = !!spawnDirector.currentTable;
            diagnostics.running = spawnDirector.running;
            diagnostics.activeWaves = spawnDirector.activeWaves?.length || 0;
        }
        
        return diagnostics;
    }
    
    getRecentSpawnActivity() {
        // Simple activity tracking - would need proper event history for full implementation
        const enemies = this.gameScene.enemies?.children?.entries || [];
        const blueprintCounts = {};
        
        enemies.forEach(enemy => {
            if (enemy.active && enemy.blueprintId) {
                blueprintCounts[enemy.blueprintId] = (blueprintCounts[enemy.blueprintId] || 0) + 1;
            }
        });
        
        return blueprintCounts;
    }
    
    // HOTFIX V3: Complete diagnostic report
    hotfixV3Report() {
        return {
            timestamp: new Date().toISOString(),
            enemyVisibility: this.enemyVisibilityCheck(),
            textureRegistry: this.textureRegistryCheck(),
            spawnSystem: this.spawnSystemCheck(),
            summary: {
                enemiesSpawned: this.metrics.spawnedFromSpawnTables,
                enemiesVisible: this.enemyVisibilityCheck().visibleEnemies,
                texturesAvailable: this.textureRegistryCheck().requiredTexturesFound,
                systemsOperational: this.areAllSystemsReady()
            }
        };
    }
    
    // ==========================================
    // Missing Assets Tracking Methods
    // ==========================================
    
    /**
     * Dump all missing assets to console
     */
    dumpMissingAssets() {
        if (!window.__missingAssets) {
            console.log('[DEV] No missing assets tracked yet');
            return;
        }
        
        const sfxMissing = Array.from(window.__missingAssets.sfx || []);
        const vfxMissing = Array.from(window.__missingAssets.vfx || []);
        
        console.group('🔍 Missing Assets Report');
        console.log(`Timestamp: ${new Date().toISOString()}`);
        
        if (sfxMissing.length > 0) {
            console.group(`🔊 Missing SFX (${sfxMissing.length})`);
            sfxMissing.forEach(id => console.log(`  - ${id}`));
            console.groupEnd();
        } else {
            console.log('✅ No missing SFX');
        }
        
        if (vfxMissing.length > 0) {
            console.group(`✨ Missing VFX (${vfxMissing.length})`);
            vfxMissing.forEach(id => console.log(`  - ${id}`));
            console.groupEnd();
        } else {
            console.log('✅ No missing VFX');
        }
        
        console.log('\n📋 Use DEV.copyMissing("sfx") or DEV.copyMissing("vfx") to copy IDs to clipboard');
        console.log('🗑️ Use DEV.clearMissing() to reset tracking');
        console.groupEnd();
        
        return {
            sfx: sfxMissing,
            vfx: vfxMissing,
            total: sfxMissing.length + vfxMissing.length
        };
    }
    
    /**
     * Clear all missing asset tracking
     */
    clearMissingAssets() {
        if (window.__missingAssets) {
            window.__missingAssets.sfx.clear();
            window.__missingAssets.vfx.clear();
            console.log('[DEV] Missing assets tracking cleared');
        }
    }
    
    /**
     * Copy missing assets to clipboard
     * @param {string} type - 'sfx' or 'vfx' or 'all'
     */
    copyMissingAssets(type = 'all') {
        if (!window.__missingAssets) {
            console.log('[DEV] No missing assets to copy');
            return;
        }
        
        let toCopy = '';
        
        if (type === 'sfx' || type === 'all') {
            const sfxMissing = Array.from(window.__missingAssets.sfx || []);
            if (sfxMissing.length > 0) {
                toCopy += '// Missing SFX\n';
                sfxMissing.forEach(id => {
                    toCopy += `this.register('${id}', {\n`;
                    toCopy += `  key: 'placeholder_beep',\n`;
                    toCopy += `  volume: 0.5,\n`;
                    toCopy += `  description: 'TODO: Add proper sound',\n`;
                    toCopy += `  category: 'sfx'\n`;
                    toCopy += `});\n\n`;
                });
            }
        }
        
        if (type === 'vfx' || type === 'all') {
            const vfxMissing = Array.from(window.__missingAssets.vfx || []);
            if (vfxMissing.length > 0) {
                toCopy += '// Missing VFX\n';
                vfxMissing.forEach(id => {
                    toCopy += `this.register('${id}', {\n`;
                    toCopy += `  type: 'particles',\n`;
                    toCopy += `  texture: 'vfx_dot',\n`;
                    toCopy += `  description: 'TODO: Add proper effect',\n`;
                    toCopy += `  config: {\n`;
                    toCopy += `    scale: { start: 0.3, end: 0 },\n`;
                    toCopy += `    speed: { min: 50, max: 100 },\n`;
                    toCopy += `    lifespan: 200,\n`;
                    toCopy += `    quantity: 5\n`;
                    toCopy += `  }\n`;
                    toCopy += `});\n\n`;
                });
            }
        }
        
        if (toCopy) {
            navigator.clipboard.writeText(toCopy).then(() => {
                console.log(`[DEV] Copied ${type} registration code to clipboard`);
            }).catch(err => {
                console.error('[DEV] Failed to copy to clipboard:', err);
                console.log('Registration code:\n', toCopy);
            });
        } else {
            console.log(`[DEV] No missing ${type} assets to copy`);
        }
    }
}