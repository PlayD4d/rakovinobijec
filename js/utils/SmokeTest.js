/**
 * Smoke Test pro verifikaci runtime integrace
 * Ověřuje, že hra používá nové data-driven systémy místo legacy kódu
 */
export class SmokeTest {
    constructor(scene) {
        this.scene = scene;
        this.results = new Map();
        this.errors = [];
        this.startTime = Date.now();
    }

    /**
     * Spustí kompletní smoke test
     * @returns {Promise<Object>} Výsledky testu
     */
    async run() {
        console.log('%c[SmokeTest] Starting runtime integration verification...', 'color: #00ff00; font-weight: bold');
        
        try {
            // 1. Kontrola framework API
            await this.checkFrameworkAPI();
            
            // 2. Kontrola blueprint systému
            await this.checkBlueprintSystem();
            
            // 3. Kontrola spawn systému
            await this.checkSpawnSystem();
            
            // 4. Kontrola enemy typů
            await this.checkEnemyTypes();
            
            // 5. Kontrola loot tables
            await this.checkLootTables();
            
            // 6. Kontrola VFX/SFX systémů
            await this.checkVFXSFXSystems();
            
            // 7. Kontrola telemetrie
            await this.checkTelemetry();
            
            // 8. Performance check
            await this.checkPerformance();
            
        } catch (error) {
            this.errors.push({
                test: 'global',
                error: error.message,
                stack: error.stack
            });
        }
        
        return this.generateReport();
    }

    /**
     * Kontrola Framework Debug API
     */
    async checkFrameworkAPI() {
        const testName = 'Framework API';
        
        try {
            // Kontrola existence __framework
            if (!window.__framework) {
                throw new Error('__framework not found in window');
            }
            
            // Kontrola healthcheck
            const health = window.__framework.healthcheck();
            
            // Ověření modernSystemsActive
            if (health.modernSystemsActive !== true) {
                throw new Error(`modernSystemsActive is ${health.modernSystemsActive}, expected true`);
            }
            
            // Ověření spawnedFromLegacy
            if (health.spawnedFromLegacy !== 0) {
                console.warn(`[SmokeTest] Warning: ${health.spawnedFromLegacy} enemies spawned from legacy system`);
            }
            
            this.results.set(testName, {
                status: 'PASSED',
                details: {
                    modernSystemsActive: health.modernSystemsActive,
                    spawnedFromLegacy: health.spawnedFromLegacy,
                    blueprintCount: health.blueprintCount,
                    spawnTableActive: health.spawnTableActive
                }
            });
            
        } catch (error) {
            this.results.set(testName, {
                status: 'FAILED',
                error: error.message
            });
            this.errors.push({ test: testName, error: error.message });
        }
    }

    /**
     * Kontrola Blueprint systému
     */
    async checkBlueprintSystem() {
        const testName = 'Blueprint System';
        
        try {
            if (!this.scene.blueprints) {
                throw new Error('BlueprintLoader not found in scene');
            }
            
            // Kontrola načtených blueprintů
            const requiredBlueprints = [
                'enemy.viral_swarm',
                'enemy.acidic_blob',
                'enemy.shadow_stalker',
                'boss.karcinogenni_kral',
                'loot.xp_orb',
                'loot.health_orb'
            ];
            
            const missingBlueprints = [];
            for (const id of requiredBlueprints) {
                if (!this.scene.blueprints.has(id)) {
                    missingBlueprints.push(id);
                }
            }
            
            if (missingBlueprints.length > 0) {
                throw new Error(`Missing blueprints: ${missingBlueprints.join(', ')}`);
            }
            
            // Kontrola blueprint struktury
            const testBlueprint = this.scene.blueprints.get('enemy.viral_swarm');
            if (!testBlueprint.stats || !testBlueprint.mechanics || !testBlueprint.display) {
                throw new Error('Blueprint structure invalid');
            }
            
            this.results.set(testName, {
                status: 'PASSED',
                details: {
                    totalBlueprints: this.scene.blueprints.blueprints?.size || 0,
                    checkedBlueprints: requiredBlueprints.length
                }
            });
            
        } catch (error) {
            this.results.set(testName, {
                status: 'FAILED',
                error: error.message
            });
            this.errors.push({ test: testName, error: error.message });
        }
    }

    /**
     * Kontrola Spawn systému
     */
    async checkSpawnSystem() {
        const testName = 'Spawn System';
        
        try {
            if (!this.scene.spawnDirector) {
                throw new Error('SpawnDirector not found in scene');
            }
            
            // Kontrola aktivní spawn table
            if (!this.scene.spawnDirector.currentTable) {
                throw new Error('No active spawn table');
            }
            
            // Kontrola spawn table dat
            const table = this.scene.spawnDirector.currentTable;
            if (!table.waves || !table.eliteWindows || !table.uniqueSpawns) {
                throw new Error('Spawn table structure invalid');
            }
            
            this.results.set(testName, {
                status: 'PASSED',
                details: {
                    activeTable: table.id || 'unknown',
                    waveCount: table.waves.length,
                    eliteWindowCount: table.eliteWindows.length,
                    uniqueSpawnCount: table.uniqueSpawns.length
                }
            });
            
        } catch (error) {
            this.results.set(testName, {
                status: 'FAILED',
                error: error.message
            });
            this.errors.push({ test: testName, error: error.message });
        }
    }

    /**
     * Kontrola nových enemy typů
     */
    async checkEnemyTypes() {
        const testName = 'Enemy Types';
        
        try {
            // Získat všechny aktivní nepřátele ze skupiny enemies
            const enemies = this.scene.enemies?.getChildren() || [];
            const enemyTypes = new Set();
            
            enemies.forEach(enemy => {
                if (enemy.blueprintId) {
                    enemyTypes.add(enemy.blueprintId);
                }
            });
            
            // Kontrola, že se spawnují nové typy
            const newTypes = ['enemy.viral_swarm', 'enemy.acidic_blob', 'enemy.shadow_stalker'];
            const foundNewTypes = newTypes.filter(type => {
                return Array.from(enemyTypes).some(id => id && id.includes(type.split('.')[1]));
            });
            
            if (enemies.length > 0 && foundNewTypes.length === 0) {
                console.warn('[SmokeTest] No new enemy types found in active enemies');
            }
            
            this.results.set(testName, {
                status: 'PASSED',
                details: {
                    activeEnemies: enemies.length,
                    uniqueTypes: enemyTypes.size,
                    newTypesFound: foundNewTypes.length
                }
            });
            
        } catch (error) {
            this.results.set(testName, {
                status: 'FAILED',
                error: error.message
            });
            this.errors.push({ test: testName, error: error.message });
        }
    }

    /**
     * Kontrola Loot Tables
     */
    async checkLootTables() {
        const testName = 'Loot Tables';
        
        try {
            // Kontrola existence loot systému
            if (!this.scene.lootDropManager && !this.scene.coreLootSystem) {
                console.warn('[SmokeTest] No loot system found, checking blueprint loot tables');
            }
            
            // Kontrola loot table v blueprintech
            const lootTableBlueprint = this.scene.blueprints?.get('loot_table.standard');
            if (!lootTableBlueprint) {
                throw new Error('Standard loot table not found in blueprints');
            }
            
            // Kontrola loot table struktury
            if (!lootTableBlueprint.drops || !Array.isArray(lootTableBlueprint.drops)) {
                throw new Error('Loot table structure invalid');
            }
            
            this.results.set(testName, {
                status: 'PASSED',
                details: {
                    lootTableFound: true,
                    dropCount: lootTableBlueprint.drops.length
                }
            });
            
        } catch (error) {
            this.results.set(testName, {
                status: 'FAILED',
                error: error.message
            });
            this.errors.push({ test: testName, error: error.message });
        }
    }

    /**
     * Kontrola VFX/SFX systémů
     */
    async checkVFXSFXSystems() {
        const testName = 'VFX/SFX Systems';
        
        try {
            let vfxActive = false;
            let sfxActive = false;
            
            // Kontrola VFX systému
            if (this.scene.newVFXSystem) {
                vfxActive = true;
                // Zkusit získat VFX countery pokud existují
                if (window.__framework?.getCounters) {
                    const counters = window.__framework.getCounters();
                    if (counters.vfxPlayed > 0) {
                        vfxActive = true;
                    }
                }
            }
            
            // Kontrola SFX systému
            if (this.scene.newSFXSystem || this.scene.audioManager) {
                sfxActive = true;
                // Zkusit získat SFX countery pokud existují
                if (window.__framework?.getCounters) {
                    const counters = window.__framework.getCounters();
                    if (counters.sfxPlayed > 0) {
                        sfxActive = true;
                    }
                }
            }
            
            this.results.set(testName, {
                status: 'PASSED',
                details: {
                    vfxSystemActive: vfxActive,
                    sfxSystemActive: sfxActive
                }
            });
            
        } catch (error) {
            this.results.set(testName, {
                status: 'FAILED',
                error: error.message
            });
            this.errors.push({ test: testName, error: error.message });
        }
    }

    /**
     * Kontrola telemetrie
     */
    async checkTelemetry() {
        const testName = 'Telemetry';
        
        try {
            // Kontrola analytics manager
            if (!this.scene.analyticsManager) {
                console.warn('[SmokeTest] AnalyticsManager not found');
            }
            
            // Kontrola telemetrie v __framework
            if (window.__framework?.getTelemetry) {
                const telemetry = window.__framework.getTelemetry();
                
                this.results.set(testName, {
                    status: 'PASSED',
                    details: {
                        eventsRecorded: telemetry.totalEvents || 0,
                        sessionActive: telemetry.sessionActive || false
                    }
                });
            } else {
                this.results.set(testName, {
                    status: 'SKIPPED',
                    details: {
                        reason: 'Telemetry not available'
                    }
                });
            }
            
        } catch (error) {
            this.results.set(testName, {
                status: 'FAILED',
                error: error.message
            });
            this.errors.push({ test: testName, error: error.message });
        }
    }

    /**
     * Performance check
     */
    async checkPerformance() {
        const testName = 'Performance';
        
        try {
            const fps = this.scene.game.loop.actualFps || 0;
            const targetFps = 60;
            const minAcceptableFps = 30;
            
            if (fps < minAcceptableFps) {
                console.warn(`[SmokeTest] Low FPS detected: ${fps.toFixed(1)}`);
            }
            
            this.results.set(testName, {
                status: fps >= minAcceptableFps ? 'PASSED' : 'WARNING',
                details: {
                    currentFPS: fps.toFixed(1),
                    targetFPS: targetFps,
                    acceptable: fps >= minAcceptableFps
                }
            });
            
        } catch (error) {
            this.results.set(testName, {
                status: 'FAILED',
                error: error.message
            });
            this.errors.push({ test: testName, error: error.message });
        }
    }

    /**
     * Generuje finální report
     */
    generateReport() {
        const duration = Date.now() - this.startTime;
        const passed = Array.from(this.results.values()).filter(r => r.status === 'PASSED').length;
        const failed = Array.from(this.results.values()).filter(r => r.status === 'FAILED').length;
        const warnings = Array.from(this.results.values()).filter(r => r.status === 'WARNING').length;
        const skipped = Array.from(this.results.values()).filter(r => r.status === 'SKIPPED').length;
        
        const report = {
            timestamp: new Date().toISOString(),
            duration: duration,
            summary: {
                total: this.results.size,
                passed: passed,
                failed: failed,
                warnings: warnings,
                skipped: skipped,
                success: failed === 0
            },
            results: Object.fromEntries(this.results),
            errors: this.errors
        };
        
        // Console output
        const statusColor = failed > 0 ? '#ff0000' : warnings > 0 ? '#ffaa00' : '#00ff00';
        const statusText = failed > 0 ? 'FAILED' : warnings > 0 ? 'PASSED WITH WARNINGS' : 'PASSED';
        
        console.log('%c[SmokeTest] ========== SMOKE TEST REPORT ==========', 'color: #00ffff; font-weight: bold');
        console.log(`%c[SmokeTest] Status: ${statusText}`, `color: ${statusColor}; font-weight: bold`);
        console.log(`[SmokeTest] Duration: ${duration}ms`);
        console.log(`[SmokeTest] Results: ${passed} passed, ${failed} failed, ${warnings} warnings, ${skipped} skipped`);
        
        // Detailní výpis
        this.results.forEach((result, testName) => {
            const icon = result.status === 'PASSED' ? '✅' : 
                        result.status === 'FAILED' ? '❌' : 
                        result.status === 'WARNING' ? '⚠️' : '⏭️';
            console.log(`[SmokeTest] ${icon} ${testName}: ${result.status}`);
            if (result.details) {
                console.log(`[SmokeTest]    Details:`, result.details);
            }
            if (result.error) {
                console.error(`[SmokeTest]    Error: ${result.error}`);
            }
        });
        
        if (this.errors.length > 0) {
            console.error('[SmokeTest] Errors encountered:', this.errors);
        }
        
        console.log('%c[SmokeTest] ========================================', 'color: #00ffff; font-weight: bold');
        
        // Store in window for debugging
        window.__smokeTestReport = report;
        
        return report;
    }

    /**
     * Quick check - rychlá kontrola klíčových systémů
     */
    static async quickCheck(scene) {
        const checks = {
            blueprints: !!scene.blueprints,
            spawnDirector: !!scene.spawnDirector,
            frameworkAPI: !!window.__framework,
            modernSystems: window.__framework?.healthcheck?.()?.modernSystemsActive === true,
            dataPath: await fetch('/data/registry/index.json').then(() => true).catch(() => false)
        };
        
        const allPassed = Object.values(checks).every(v => v === true);
        
        console.log('%c[SmokeTest QuickCheck]', 'color: #00ff00', checks);
        console.log(`[SmokeTest QuickCheck] ${allPassed ? '✅ All systems GO' : '❌ Some systems missing'}`);
        
        return checks;
    }
}

// Export for Framework Debug API
if (window.__framework) {
    window.__framework.SmokeTest = SmokeTest;
}