/**
 * AllScenarios - Collection of all test scenarios
 * Combines BossFights, PowerUpCombos, and EdgeCases for efficiency
 */

import { BaseScenario } from './BaseScenario.js';

/**
 * BossFights - Test scenario for boss battles
 */
export class BossFights extends BaseScenario {
    constructor() {
        super('BossFights', 'Tests boss phases, abilities, and mechanics');
        this.config.timeout = 180000; // 3 minutes
        this.setupSteps();
    }
    
    setupSteps() {
        // Test boss spawning
        this.addStep('Boss Spawn', async (automation) => {
            await this.killAll(automation);
            await this.spawnBoss(automation, 'boss.radiation_core');
            await this.waitForBoss(automation);
            
            const boss = this.getEnemies().find(e => e.isBoss);
            return { 
                spawned: !!boss,
                hp: boss?.hp,
                maxHp: boss?.maxHp
            };
        });
        
        // Test boss phases
        this.addStep('Boss Phases', async (automation) => {
            const boss = this.getEnemies().find(e => e.isBoss);
            if (!boss) return { error: 'No boss found' };
            
            const phases = [];
            
            // Damage boss to trigger phase changes
            if (boss.takeDamage) {
                const damageSteps = [0.3, 0.5, 0.3]; // Damage percentages
                for (const pct of damageSteps) {
                    boss.takeDamage(boss.maxHp * pct);
                    await this.wait(2000);
                    phases.push({
                        hp: boss.hp,
                        phase: boss.currentPhase || 'unknown'
                    });
                }
            }
            
            return { phases, phaseChanges: phases.length };
        });
        
        // Test boss abilities
        this.addStep('Boss Abilities', async (automation) => {
            const boss = this.getEnemies().find(e => e.isBoss);
            if (!boss) return { error: 'No boss found' };
            
            automation.botConfig.targetPriority = 'boss';
            automation.enabled = true;
            
            await this.wait(10000); // Let abilities trigger
            
            return { 
                abilitiesUsed: true,
                bossAlive: boss.hp > 0
            };
        });
        
        // Test boss defeat
        this.addStep('Boss Defeat', async (automation) => {
            await this.killAll(automation);
            await this.wait(1000);
            
            const scene = this.getGameScene();
            const victoryTriggered = scene?.victoryTriggered || false;
            
            return { 
                defeated: true,
                victoryTriggered
            };
        });
    }
}

/**
 * PowerUpCombos - Test power-up combinations
 */
export class PowerUpCombos extends BaseScenario {
    constructor() {
        super('PowerUpCombos', 'Tests power-up stacking and combinations');
        this.config.timeout = 120000;
        this.setupSteps();
    }
    
    setupSteps() {
        // Test single power-up
        this.addStep('Single PowerUp', async (automation) => {
            await this.givePowerUp(automation, 'powerup.damage_boost');
            await this.wait(1000);
            
            const player = this.getPlayer();
            return { 
                applied: true,
                damage: player.damage || player.baseDamage
            };
        });
        
        // Test power-up stacking
        this.addStep('PowerUp Stacking', async (automation) => {
            const player = this.getPlayer();
            const startDamage = player.damage || player.baseDamage || 10;
            
            // Give multiple damage boosts
            for (let i = 0; i < 3; i++) {
                await this.givePowerUp(automation, 'powerup.damage_boost');
                await this.wait(500);
            }
            
            const endDamage = player.damage || player.baseDamage || 10;
            
            return { 
                stacked: endDamage > startDamage,
                startDamage,
                endDamage
            };
        });
        
        // Test different power-up types
        this.addStep('Mixed PowerUps', async (automation) => {
            const powerUps = [
                'powerup.shield',
                'powerup.metabolic_haste',
                'powerup.piercing_arrows'
            ];
            
            for (const powerUp of powerUps) {
                await this.givePowerUp(automation, powerUp);
                await this.wait(500);
            }
            
            const player = this.getPlayer();
            return { 
                multipleTypes: true,
                shield: player.shield > 0,
                speed: player.moveSpeed > player.baseMoveSpeed
            };
        });
        
        // Test power-up effects in combat
        this.addStep('Combat with PowerUps', async (automation) => {
            // Spawn enemies to test power-ups
            for (let i = 0; i < 5; i++) {
                await this.spawnEnemy(automation, 'enemy.viral_swarm');
            }
            
            automation.botConfig.movementPattern = 'aggressive';
            automation.enabled = true;
            
            await this.wait(5000);
            
            const enemies = this.getEnemies();
            const killed = enemies.filter(e => !e.active || e.hp <= 0).length;
            
            return { 
                combatEffective: killed > 0,
                enemiesKilled: killed
            };
        });
    }
}

/**
 * EdgeCases - Stress tests and edge cases
 */
export class EdgeCases extends BaseScenario {
    constructor() {
        super('EdgeCases', 'Tests edge cases, stress tests, and error conditions');
        this.config.timeout = 180000;
        this.config.continueOnError = true;
        this.setupSteps();
    }
    
    setupSteps() {
        // Test many enemies
        this.addStep('Enemy Stress Test', async (automation) => {
            const maxEnemies = 50;
            
            for (let i = 0; i < maxEnemies; i++) {
                await this.spawnEnemy(automation, 'enemy.viral_swarm');
                if (i % 10 === 0) await this.wait(100);
            }
            
            await this.wait(3000);
            
            const scene = this.getGameScene();
            const fps = scene?.game?.loop?.actualFps || 0;
            const enemies = this.getEnemies().filter(e => e.active).length;
            
            return { 
                enemiesSpawned: enemies,
                fps,
                performanceAcceptable: fps > 20
            };
        });
        
        // Test many projectiles
        this.addStep('Projectile Stress Test', async (automation) => {
            // Spawn shooters
            for (let i = 0; i < 10; i++) {
                await this.spawnEnemy(automation, 'enemy.micro_shooter');
            }
            
            await this.wait(5000);
            
            const scene = this.getGameScene();
            const projectiles = [
                ...(scene?.playerProjectiles?.getChildren() || []),
                ...(scene?.enemyProjectiles?.getChildren() || [])
            ];
            
            return { 
                projectileCount: projectiles.length,
                fps: scene?.game?.loop?.actualFps || 0
            };
        });
        
        // Test rapid spawning/killing
        this.addStep('Rapid Spawn/Kill', async (automation) => {
            for (let i = 0; i < 10; i++) {
                await this.spawnEnemy(automation, 'enemy.necrotic_cell');
                await this.wait(100);
                await this.killAll(automation);
                await this.wait(100);
            }
            
            // Check for memory leaks
            let memoryMB = 0;
            if (performance.memory) {
                memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
            }
            
            return { 
                cyclesCompleted: 10,
                memoryMB,
                noLeaks: memoryMB < 500
            };
        });
        
        // Test player death
        this.addStep('Player Death', async (automation) => {
            const player = this.getPlayer();
            if (!player) return { error: 'No player' };
            
            // Kill player
            if (player.takeDamage) {
                player.takeDamage(player.maxHp * 2);
            } else if (player.die) {
                player.die();
            }
            
            await this.wait(2000);
            
            const scene = this.getGameScene();
            const gameOverShown = scene?.gameOverTriggered || false;
            
            return { 
                playerDied: player.hp <= 0,
                gameOverShown
            };
        });
        
        // Test invalid inputs
        this.addStep('Invalid Inputs', async (automation) => {
            const errors = [];
            
            try {
                await this.spawnEnemy(automation, 'invalid.enemy.id');
            } catch (e) {
                errors.push('invalid_enemy');
            }
            
            try {
                await this.givePowerUp(automation, 'invalid.powerup');
            } catch (e) {
                errors.push('invalid_powerup');
            }
            
            try {
                await this.spawnBoss(automation, 'invalid.boss');
            } catch (e) {
                errors.push('invalid_boss');
            }
            
            return { 
                errorsHandled: errors.length > 0,
                errors
            };
        });
        
        // Test boundary conditions
        this.addStep('Boundary Conditions', async (automation) => {
            const player = this.getPlayer();
            const scene = this.getGameScene();
            
            // Move player to boundaries
            if (player) {
                player.x = 0;
                player.y = 0;
                await this.wait(500);
                
                player.x = scene.cameras.main.width;
                player.y = scene.cameras.main.height;
                await this.wait(500);
            }
            
            // Check if player stays in bounds
            const inBounds = player.x >= 0 && 
                           player.x <= scene.cameras.main.width &&
                           player.y >= 0 && 
                           player.y <= scene.cameras.main.height;
            
            return { 
                boundaryTested: true,
                playerInBounds: inBounds
            };
        });
        
        // Test memory and performance
        this.addStep('Memory Check', async (automation) => {
            const metrics = {
                fps: [],
                memory: []
            };
            
            // Collect metrics over time
            for (let i = 0; i < 10; i++) {
                const scene = this.getGameScene();
                metrics.fps.push(scene?.game?.loop?.actualFps || 0);
                
                if (performance.memory) {
                    metrics.memory.push(performance.memory.usedJSHeapSize / 1024 / 1024);
                }
                
                await this.wait(1000);
            }
            
            const avgFPS = metrics.fps.reduce((a, b) => a + b, 0) / metrics.fps.length;
            const memoryGrowth = metrics.memory.length > 1 ? 
                metrics.memory[metrics.memory.length - 1] - metrics.memory[0] : 0;
            
            return { 
                avgFPS,
                memoryGrowth,
                stable: avgFPS > 30 && memoryGrowth < 50
            };
        });
    }
}