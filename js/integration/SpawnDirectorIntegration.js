/**
 * SpawnDirector Integration for GameScene
 * PR7-compliant spawning using blueprints
 */

import Boss from '../entities/Boss.js';
import { Enemy } from '../entities/Enemy.js';

export class SpawnDirectorIntegration {
    constructor(scene) {
        this.scene = scene;
        
        // Ensure required systems exist
        if (!scene.blueprintLoader) {
            throw new Error('[SpawnDirectorIntegration] Missing blueprintLoader');
        }
        if (!scene.spawnDirector) {
            throw new Error('[SpawnDirectorIntegration] Missing spawnDirector');
        }
        
        // Groups for entity management
        this.enemiesGroup = scene.physics.add.group();
        this.bossGroup = scene.physics.add.group();
        
        // Expose groups to scene for other systems
        scene.enemiesGroup = this.enemiesGroup;
        scene.bossGroup = this.bossGroup;
        
        // Register spawn handlers with SpawnDirector
        this.registerHandlers();
    }
    
    registerHandlers() {
        const spawnDirector = this.scene.spawnDirector;
        
        // Register enemy spawn handler
        spawnDirector.registerSpawnHandler('enemy', (blueprintId, x, y, opts) => {
            return this.spawnEnemyFromBlueprint(blueprintId, x, y, opts);
        });
        
        // Register boss spawn handler
        spawnDirector.registerSpawnHandler('boss', (blueprintId, x, y, opts) => {
            return this.spawnBossFromBlueprint(blueprintId, x, y, opts);
        });
    }
    
    /**
     * Spawn enemy from blueprint
     * @param {string} blueprintId - Enemy blueprint ID
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} opts - Additional options
     */
    spawnEnemyFromBlueprint(blueprintId, x, y, opts = {}) {
        const blueprint = this.scene.blueprintLoader.get(blueprintId);
        
        if (!blueprint || blueprint.type !== 'enemy') {
            console.error(`[SpawnDirector] Invalid enemy blueprint: ${blueprintId}`);
            return null;
        }
        
        // Create enemy instance
        const enemy = new Enemy(this.scene, x, y, blueprintId, blueprint);
        
        // Add to group
        this.enemiesGroup.add(enemy);
        
        // Set up collisions
        this.scene.physics.add.overlap(
            enemy,
            this.scene.player,
            (enemy, player) => {
                // Contact damage
                if (player.canTakeDamage?.()) {
                    player.takeDamage(enemy.damage || enemy.contactDamage);
                }
            }
        );
        
        // Analytics
        if (this.scene.analyticsManager) {
            this.scene.analyticsManager.trackEnemySpawn(blueprintId);
        }
        
        return enemy;
    }
    
    /**
     * Spawn boss from blueprint
     * @param {string} blueprintId - Boss blueprint ID
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} opts - Additional options (level, etc.)
     */
    spawnBossFromBlueprint(blueprintId, x, y, opts = {}) {
        const blueprint = this.scene.blueprintLoader.get(blueprintId);
        
        if (!blueprint || blueprint.type !== 'boss') {
            console.error(`[SpawnDirector] Invalid boss blueprint: ${blueprintId}`);
            return null;
        }
        
        // Only one boss at a time
        if (this.bossGroup.getChildren().length > 0) {
            console.warn('[SpawnDirector] Boss already active');
            return null;
        }
        
        // Create boss instance
        const boss = new Boss(this.scene, x, y, blueprint, opts);
        
        // Add to group
        this.bossGroup.add(boss);
        
        // Set up collisions
        this.scene.physics.add.overlap(
            boss,
            this.scene.player,
            (boss, player) => {
                // Contact damage
                if (player.canTakeDamage?.()) {
                    player.takeDamage(boss.damage || boss.contactDamage);
                }
            }
        );
        
        // Show boss health bar
        if (this.scene.unifiedHUD?.showBossHealth) {
            this.scene.unifiedHUD.showBossHealth(boss.bossName, boss.hp, boss.maxHp);
        }
        
        // Analytics
        if (this.scene.analyticsManager) {
            this.scene.analyticsManager.trackBossSpawn(blueprintId);
        }
        
        return boss;
    }
    
    /**
     * Update all entities
     */
    update(time, delta) {
        // Update all enemies
        this.enemiesGroup.getChildren().forEach(enemy => {
            if (enemy.active && enemy.update) {
                enemy.update(time, delta);
            }
        });
        
        // Update all bosses
        this.bossGroup.getChildren().forEach(boss => {
            if (boss.active && boss.update) {
                boss.update(time, delta);
            }
        });
    }
    
    /**
     * Clean up
     */
    destroy() {
        this.enemiesGroup.clear(true, true);
        this.bossGroup.clear(true, true);
    }
}

// Usage in GameScene:
/*
// In create():
this.spawnIntegration = new SpawnDirectorIntegration(this);

// To spawn:
this.spawnDirector.spawn('enemy.basic', x, y);
this.spawnDirector.spawn('boss.malignant_cell', centerX, centerY, { level: 1 });

// In update():
this.spawnIntegration.update(time, delta);
*/