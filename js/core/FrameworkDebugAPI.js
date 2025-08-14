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

        // Hook loot manager if available
        if (this.gameScene.lootManager) {
            const originalDrop = this.gameScene.lootManager.dropLoot?.bind(this.gameScene.lootManager);
            if (originalDrop) {
                this.gameScene.lootManager.dropLoot = (...args) => {
                    // Check if using loot tables vs legacy
                    const stack = new Error().stack;
                    if (stack.includes('LootTable') || stack.includes('lootTable')) {
                        this.metrics.lootDropsFromTables++;
                    } else {
                        this.metrics.legacyLootDrops++;
                    }
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
                modifierEngine: {
                    ready: !!this.gameScene.modifierEngine,
                    activeModifiers: this.getActiveModifiersCount()
                }
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
        return this.gameScene.modifierEngine?.activeModifiers?.length || 0;
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
            'spawnDirector', 'settingsManager', 'modifierEngine'
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
}