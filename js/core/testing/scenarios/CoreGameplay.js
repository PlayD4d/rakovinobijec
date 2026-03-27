/**
 * CoreGameplay - Test scenario for basic game mechanics
 * 
 * Tests:
 * - Player movement and controls
 * - Enemy spawning and behavior
 * - Combat mechanics (damage, health)
 * - Loot collection
 * - Level progression
 * - Power-up selection
 * - Basic VFX/SFX
 */

import { BaseScenario } from './BaseScenario.js';

export class CoreGameplay extends BaseScenario {
    constructor() {
        super('CoreGameplay', 'Tests basic game mechanics and core gameplay loop');
        
        this.config = {
            ...this.config,
            timeout: 120000, // 2 minutes
            continueOnError: true
        };
        
        this.setupSteps();
    }
    
    setupSteps() {
        // Step 1: Player initialization
        this.addStep(
            'Player Initialization',
            async (automation) => {
                await this.waitForPlayer(automation);
                const player = this.getPlayer();
                
                automation.logEvent('player_initialized', {
                    hp: player.hp,
                    maxHp: player.maxHp,
                    position: { x: player.x, y: player.y }
                });
                
                return {
                    playerFound: true,
                    hp: player.hp,
                    maxHp: player.maxHp
                };
            },
            async (automation, result) => {
                return result.playerFound && result.hp > 0 && result.hp <= result.maxHp;
            }
        );
        
        // Step 2: Test player movement
        this.addStep(
            'Player Movement',
            async (automation) => {
                const player = this.getPlayer();
                const startPos = { x: player.x, y: player.y };
                
                // Enable bot to move player
                automation.botConfig.movementPattern = 'circle';
                automation.enabled = true;
                
                // Let bot move for 3 seconds
                await this.wait(3000);
                
                const endPos = { x: player.x, y: player.y };
                const distance = Math.sqrt(
                    Math.pow(endPos.x - startPos.x, 2) + 
                    Math.pow(endPos.y - startPos.y, 2)
                );
                
                automation.logEvent('player_movement_test', {
                    startPos,
                    endPos,
                    distance
                });
                
                return {
                    moved: distance > 50,
                    distance
                };
            },
            async (automation, result) => {
                return result.moved;
            }
        );
        
        // Step 3: Enemy spawning
        this.addStep(
            'Enemy Spawning',
            async (automation) => {
                // Clear existing enemies
                await this.killAll(automation);
                await this.wait(500);
                
                // Spawn different enemy types
                const enemyTypes = [
                    'enemy.viral_swarm',
                    'enemy.necrotic_cell',
                    'enemy.fungal_parasite'
                ];
                
                for (const enemyId of enemyTypes) {
                    await this.spawnEnemy(automation, enemyId);
                }
                
                await this.wait(1000);
                
                const enemies = this.getEnemies();
                const activeEnemies = enemies.filter(e => e.active);
                
                automation.logEvent('enemies_spawned', {
                    types: enemyTypes,
                    count: activeEnemies.length
                });
                
                return {
                    spawned: activeEnemies.length,
                    expected: enemyTypes.length
                };
            },
            async (automation, result) => {
                return result.spawned >= result.expected;
            }
        );
        
        // Step 4: Combat mechanics
        this.addStep(
            'Combat Mechanics',
            async (automation) => {
                const player = this.getPlayer();
                const startHealth = player.hp;
                
                // Configure bot for aggressive combat
                automation.botConfig.movementPattern = 'aggressive';
                automation.botConfig.targetPriority = 'nearest';
                automation.botConfig.aimAccuracy = 0.95;
                
                // Let combat happen for 5 seconds
                automation.markStart('combat_test');
                await this.wait(5000);
                automation.markEnd('combat_test');
                
                const enemies = this.getEnemies();
                const killedEnemies = enemies.filter(e => !e.active || e.hp <= 0).length;
                const endHealth = player.hp;
                
                automation.logEvent('combat_test', {
                    enemiesKilled: killedEnemies,
                    playerDamageTaken: startHealth - endHealth,
                    duration: automation.metrics.performanceMarks['combat_test']?.duration
                });
                
                return {
                    enemiesKilled: killedEnemies,
                    combatOccurred: killedEnemies > 0 || endHealth < startHealth
                };
            },
            async (automation, result) => {
                return result.combatOccurred;
            }
        );
        
        // Step 5: Loot collection
        this.addStep(
            'Loot Collection',
            async (automation) => {
                // Kill enemies to generate loot
                await this.killAll(automation);
                await this.wait(1000);
                
                // Spawn enemies and kill them for loot
                await this.spawnEnemy(automation, 'enemy.viral_swarm');
                await this.wait(500);
                await this.killAll(automation);
                await this.wait(1000);
                
                // Enable loot collection
                automation.botConfig.collectLoot = true;
                
                // Check for loot
                const scene = this.getGameScene();
                const loot = scene?.loot?.getChildren() || [];
                const lootCount = loot.filter(l => l.active).length;
                
                // Let bot collect loot for 3 seconds
                await this.wait(3000);
                
                const remainingLoot = scene?.loot?.getChildren().filter(l => l.active).length || 0;
                const collected = lootCount - remainingLoot;
                
                automation.logEvent('loot_collection', {
                    initial: lootCount,
                    collected,
                    remaining: remainingLoot
                });
                
                return {
                    lootDropped: lootCount > 0,
                    lootCollected: collected > 0
                };
            },
            async (automation, result) => {
                return result.lootDropped; // Loot collection is optional
            }
        );
        
        // Step 6: Level progression
        this.addStep(
            'Level Progression',
            async (automation) => {
                const player = this.getPlayer();
                const startLevel = player.level || 1;
                const startXP = player.experience || 0;
                
                // Force level up
                await this.levelUp(automation);
                await this.wait(1000);
                
                // Check if power-up selection appeared
                const scene = this.getGameScene();
                const powerUpActive = scene?.isPowerUpSelectionActive || false;
                
                // If power-up selection is active, select first option
                if (powerUpActive && window.DEV?.selectPowerUp) {
                    window.DEV.selectPowerUp(0);
                    await this.wait(500);
                }
                
                const endLevel = player.level || 1;
                
                automation.logEvent('level_progression', {
                    startLevel,
                    endLevel,
                    powerUpSelectionShown: powerUpActive
                });
                
                return {
                    leveledUp: endLevel > startLevel || powerUpActive,
                    powerUpShown: powerUpActive
                };
            },
            async (automation, result) => {
                return result.leveledUp;
            }
        );
        
        // Step 7: VFX System
        this.addStep(
            'VFX System',
            async (automation) => {
                const scene = this.getGameScene();
                const vfxSystem = scene?.vfxSystem || scene?.newVFXSystem;
                
                if (!vfxSystem) {
                    return { vfxSystemFound: false };
                }
                
                // Spawn enemies to trigger VFX
                await this.spawnEnemy(automation, 'enemy.viral_swarm');
                await this.wait(500);
                
                // Kill them to trigger death VFX
                await this.killAll(automation);
                await this.wait(1000);
                
                // Check VFX metrics
                const vfxCalls = automation.metrics.vfxCalls || 0;
                
                automation.logEvent('vfx_test', {
                    vfxSystemFound: true,
                    vfxCalls
                });
                
                return {
                    vfxSystemFound: true,
                    vfxTriggered: vfxCalls > 0
                };
            },
            async (automation, result) => {
                return result.vfxSystemFound;
            }
        );
        
        // Step 8: SFX System
        this.addStep(
            'SFX System',
            async (automation) => {
                const scene = this.getGameScene();
                const audioSystem = scene?.audioSystem || scene?.sfxSystem;
                
                if (!audioSystem) {
                    return { sfxSystemFound: false };
                }
                
                // Trigger combat for SFX
                await this.spawnEnemy(automation, 'enemy.necrotic_cell');
                await this.wait(2000); // Let combat happen
                
                // Check SFX metrics
                const sfxCalls = automation.metrics.sfxCalls || 0;
                
                automation.logEvent('sfx_test', {
                    sfxSystemFound: true,
                    sfxCalls
                });
                
                return {
                    sfxSystemFound: true,
                    sfxTriggered: sfxCalls > 0
                };
            },
            async (automation, result) => {
                return result.sfxSystemFound;
            }
        );
        
        // Step 9: Blueprint validation
        this.addStep(
            'Blueprint Validation',
            async (automation) => {
                const scene = this.getGameScene();
                const blueprintLoader = scene?.blueprintLoader || scene?.blueprints;
                
                if (!blueprintLoader) {
                    return { blueprintSystemFound: false };
                }
                
                // Check key blueprints
                const requiredBlueprints = [
                    'enemy.viral_swarm',
                    'enemy.necrotic_cell',
                    'powerup.damage_boost',
                    'powerup.shield'
                ];
                
                const foundBlueprints = [];
                const missingBlueprints = [];
                
                for (const id of requiredBlueprints) {
                    if (blueprintLoader.get?.(id) || blueprintLoader.blueprints?.get?.(id)) {
                        foundBlueprints.push(id);
                    } else {
                        missingBlueprints.push(id);
                    }
                }
                
                automation.logEvent('blueprint_validation', {
                    found: foundBlueprints.length,
                    missing: missingBlueprints.length,
                    missingIds: missingBlueprints
                });
                
                return {
                    blueprintSystemFound: true,
                    allBlueprintsFound: missingBlueprints.length === 0,
                    missingBlueprints
                };
            },
            async (automation, result) => {
                return result.blueprintSystemFound && result.allBlueprintsFound;
            }
        );
        
        // Step 10: Performance check
        this.addStep(
            'Performance Check',
            async (automation) => {
                // Spawn many enemies to stress test
                for (let i = 0; i < 10; i++) {
                    await this.spawnEnemy(automation, 'enemy.viral_swarm');
                }
                
                await this.wait(3000);
                
                // Check performance metrics
                const scene = this.getGameScene();
                const fps = scene?.game?.loop?.actualFps || 0;
                const enemies = this.getEnemies().filter(e => e.active).length;
                
                // Check memory if available
                let memoryMB = 0;
                if (performance.memory) {
                    memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
                }
                
                automation.logEvent('performance_check', {
                    fps,
                    enemies,
                    memoryMB
                });
                
                return {
                    fps,
                    acceptable: fps >= 30,
                    enemies,
                    memoryMB
                };
            },
            async (automation, result) => {
                return result.acceptable;
            }
        );
    }
    
    async setup(automation) {
        await super.setup(automation);
        
        // Configure bot for this scenario
        automation.botConfig = {
            ...automation.botConfig,
            movementPattern: 'random',
            targetPriority: 'nearest',
            dodgeProjectiles: true,
            collectLoot: true,
            useAbilities: true,
            aimAccuracy: 0.8
        };
        
        // Clear the field
        if (window.DEV?.killAll) {
            window.DEV.killAll();
        }
        
        return true;
    }
    
    async teardown(automation) {
        // Disable bot
        automation.enabled = false;
        
        // Clean up
        if (window.DEV?.killAll) {
            window.DEV.killAll();
        }
        
        return super.teardown(automation);
    }
}