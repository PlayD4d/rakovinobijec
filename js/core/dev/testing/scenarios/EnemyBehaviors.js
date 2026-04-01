/**
 * EnemyBehaviors - Test scenario for enemy AI behaviors
 * 
 * Tests all enemy behavior patterns and AI states
 */

import { BaseScenario } from './BaseScenario.js';

export class EnemyBehaviors extends BaseScenario {
    constructor() {
        super('EnemyBehaviors', 'Tests enemy AI behaviors and state transitions');
        
        this.config = {
            ...this.config,
            timeout: 90000,
            continueOnError: true
        };
        
        this.setupSteps();
    }
    
    setupSteps() {
        // Test idle behavior
        this.addStep(
            'Idle Behavior',
            async (automation) => {
                await this.killAll(automation);
                await this.spawnEnemy(automation, 'enemy.necrotic_cell');
                
                // Observe idle behavior
                const enemy = this.getEnemies()[0];
                const startPos = { x: enemy.x, y: enemy.y };
                
                await this.wait(3000);
                
                const endPos = { x: enemy.x, y: enemy.y };
                const moved = Math.sqrt(
                    Math.pow(endPos.x - startPos.x, 2) + 
                    Math.pow(endPos.y - startPos.y, 2)
                ) > 10;
                
                return { behavior: 'idle', moved };
            }
        );
        
        // Test chase behavior
        this.addStep(
            'Chase Behavior',
            async (automation) => {
                await this.killAll(automation);
                await this.spawnEnemy(automation, 'enemy.viral_swarm');
                
                const enemy = this.getEnemies()[0];
                const player = this.getPlayer();
                
                // Move player close to enemy
                automation.botConfig.movementPattern = 'aggressive';
                automation.enabled = true;
                
                await this.wait(3000);
                
                const distance = Math.sqrt(
                    Math.pow(enemy.x - player.x, 2) + 
                    Math.pow(enemy.y - player.y, 2)
                );
                
                return { 
                    behavior: 'chase', 
                    chasing: distance < 200,
                    distance 
                };
            }
        );
        
        // Test flee behavior  
        this.addStep(
            'Flee Behavior',
            async (automation) => {
                await this.killAll(automation);
                await this.spawnEnemy(automation, 'enemy.support_bacteria');
                
                const enemy = this.getEnemies()[0];
                
                // Damage enemy to trigger flee
                if (enemy && enemy.takeDamage) {
                    enemy.takeDamage(enemy.maxHp * 0.8);
                }
                
                const startDist = this.getDistance(enemy, this.getPlayer());
                await this.wait(2000);
                const endDist = this.getDistance(enemy, this.getPlayer());
                
                return {
                    behavior: 'flee',
                    fleeing: endDist > startDist
                };
            }
        );
        
        // Test orbit behavior
        this.addStep(
            'Orbit Behavior',
            async (automation) => {
                await this.killAll(automation);
                await this.spawnEnemy(automation, 'enemy.fungal_parasite');
                
                // Track enemy positions over time
                const positions = [];
                const enemy = this.getEnemies()[0];
                
                for (let i = 0; i < 10; i++) {
                    positions.push({ x: enemy.x, y: enemy.y });
                    await this.wait(300);
                }
                
                // Check for circular movement
                const orbiting = this.checkOrbitPattern(positions);
                
                return { behavior: 'orbit', orbiting };
            }
        );
        
        // Test patrol behavior
        this.addStep(
            'Patrol Behavior',
            async (automation) => {
                await this.killAll(automation);
                await this.spawnEnemy(automation, 'enemy.metastasis_runner');
                
                const enemy = this.getEnemies()[0];
                const positions = [];
                
                for (let i = 0; i < 10; i++) {
                    positions.push({ x: enemy.x, y: enemy.y });
                    await this.wait(500);
                }
                
                const patrolling = this.checkPatrolPattern(positions);
                
                return { behavior: 'patrol', patrolling };
            }
        );
        
        // Test shoot behavior
        this.addStep(
            'Shoot Behavior',
            async (automation) => {
                await this.killAll(automation);
                await this.spawnEnemy(automation, 'enemy.micro_shooter');
                
                const scene = this.getGameScene();
                const initialProjectiles = scene?.enemyProjectiles?.getChildren().length || 0;
                
                await this.wait(3000);
                
                const finalProjectiles = scene?.enemyProjectiles?.getChildren().length || 0;
                const projectilesFired = finalProjectiles > initialProjectiles;
                
                return { 
                    behavior: 'shoot', 
                    shooting: projectilesFired,
                    projectileCount: finalProjectiles
                };
            }
        );
        
        // Test state transitions
        this.addStep(
            'State Transitions',
            async (automation) => {
                await this.killAll(automation);
                await this.spawnEnemy(automation, 'enemy.viral_swarm');
                
                const enemy = this.getEnemies()[0];
                const states = [];
                
                // Track state changes
                for (let i = 0; i < 10; i++) {
                    if (enemy.behaviors?.state) {
                        states.push(enemy.behaviors.state);
                    }
                    await this.wait(1000);
                }
                
                const uniqueStates = [...new Set(states)];
                
                return {
                    stateTransitions: uniqueStates.length > 1,
                    states: uniqueStates
                };
            }
        );
        
        // Test group behavior
        this.addStep(
            'Group Behavior',
            async (automation) => {
                await this.killAll(automation);
                
                // Spawn multiple enemies
                for (let i = 0; i < 5; i++) {
                    await this.spawnEnemy(automation, 'enemy.viral_swarm');
                }
                
                await this.wait(3000);
                
                // Check if enemies coordinate
                const enemies = this.getEnemies();
                const formations = this.checkFormation(enemies);
                
                return {
                    groupSize: enemies.length,
                    formation: formations
                };
            }
        );
    }
    
    // Helper methods
    getDistance(obj1, obj2) {
        if (!obj1 || !obj2) return Infinity;
        return Math.sqrt(
            Math.pow(obj1.x - obj2.x, 2) + 
            Math.pow(obj1.y - obj2.y, 2)
        );
    }
    
    checkOrbitPattern(positions) {
        if (positions.length < 3) return false;
        
        // Simple check: positions should form a rough circle
        const center = this.getPlayer();
        if (!center) return false;
        
        const distances = positions.map(pos => this.getDistance(pos, center));
        const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDist, 2), 0) / distances.length;
        
        // Low variance means circular pattern
        return variance < avgDist * 0.2;
    }
    
    checkPatrolPattern(positions) {
        if (positions.length < 2) return false;
        
        // Check for back-and-forth movement
        let directionChanges = 0;
        for (let i = 2; i < positions.length; i++) {
            const dir1 = positions[i].x - positions[i-1].x;
            const dir2 = positions[i-1].x - positions[i-2].x;
            if (Math.sign(dir1) !== Math.sign(dir2)) {
                directionChanges++;
            }
        }
        
        return directionChanges >= 2;
    }
    
    checkFormation(enemies) {
        if (enemies.length < 3) return 'none';
        
        // Check if enemies maintain relative positions
        const distances = [];
        for (let i = 0; i < enemies.length - 1; i++) {
            for (let j = i + 1; j < enemies.length; j++) {
                distances.push(this.getDistance(enemies[i], enemies[j]));
            }
        }
        
        const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        
        if (avgDist < 100) return 'clustered';
        if (avgDist > 300) return 'spread';
        return 'normal';
    }
}