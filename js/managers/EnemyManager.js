/**
 * EnemyManager - Centralized enemy and boss management
 * PR7 compliant - handles all enemy spawning and lifecycle
 */

import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';

export class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.blueprintLoader = scene.blueprintLoader;
        
        // Create groups if not exists
        if (!scene.enemiesGroup) {
            scene.enemiesGroup = scene.physics.add.group();
            scene.enemies = scene.enemiesGroup; // Alias
        }
        if (!scene.bossGroup) {
            scene.bossGroup = scene.physics.add.group();
        }
    }
    
    /**
     * Spawn an enemy or boss from blueprint
     */
    spawnEnemy(blueprintId, options = {}) {
        const blueprint = this.blueprintLoader?.get(blueprintId);
        
        if (!blueprint) {
            console.error(`[EnemyManager] Blueprint not found: ${blueprintId}`);
            return null;
        }
        
        // Determine spawn position
        const x = options.x || Phaser.Math.Between(50, this.scene.scale.width - 50);
        const y = options.y || Phaser.Math.Between(50, this.scene.scale.height - 50);
        
        // Get visual properties
        const visuals = blueprint.visuals || {};
        const color = visuals.tint || this.getColorFromBlueprint(blueprint);
        const size = blueprint.stats?.size || visuals.size?.w || (blueprint.type === 'boss' ? 60 : 20);
        const textureKey = visuals.textureKey || blueprintId;
        
        let entity;
        
        if (blueprint.type === 'boss') {
            entity = this.createBoss(blueprint, x, y, textureKey, color, size, options);
        } else {
            entity = this.createRegularEnemy(blueprint, blueprintId, x, y, textureKey, color, size, options);
        }
        
        // Analytics
        if (this.scene.analyticsManager) {
            this.scene.analyticsManager.trackEnemySpawn(blueprintId);
        }
        
        return entity;
    }
    
    /**
     * Create a boss entity
     */
    createBoss(blueprint, x, y, textureKey, color, size, options) {
        const bossConfig = {
            ...blueprint.stats,
            ...blueprint.mechanics,
            texture: textureKey,
            color: color,
            sfx: blueprint.sfx,
            vfx: blueprint.vfx
        };
        
        const boss = new Boss(this.scene, x, y, blueprint, options);
        this.scene.bossGroup.add(boss);
        this.scene.enemies.add(boss); // For collision detection
        this.scene.currentBoss = boss;
        
        // Set depth
        boss.setDepth(this.scene.DEPTH_LAYERS?.BOSSES || 1100);
        
        // Ensure texture
        boss.setTexture(textureKey);
        boss.setDisplaySize(size, size);
        
        // Show boss health bar
        if (this.scene.unifiedHUD?.showBoss) {
            const bossName = blueprint.display?.devNameFallback || boss.bossName || blueprint.id;
            this.scene.unifiedHUD.showBoss(bossName, boss.hp, boss.maxHp);
        }
        
        return boss;
    }
    
    /**
     * Create a regular enemy entity
     */
    createRegularEnemy(blueprint, blueprintId, x, y, textureKey, color, size, options) {
        const enemyConfig = {
            ...blueprint.stats,
            ...blueprint.mechanics,
            texture: textureKey,
            color: color,
            sfx: blueprint.sfx,
            vfx: blueprint.vfx,
            ai: blueprint.ai,
            drops: blueprint.drops,
            isElite: options.elite || blueprint.type === 'elite',
            isUnique: blueprint.type === 'unique',
            isMiniboss: blueprint.type === 'miniboss'
        };
        
        const enemy = new Enemy(this.scene, x, y, blueprintId, enemyConfig);
        
        // Ensure texture
        if (!enemy.texture || enemy.texture.key !== textureKey) {
            enemy.setTexture(textureKey);
        }
        
        // Visual indicators
        if (blueprint.type === 'unique') {
            enemy.setTint(0xFF00FF); // Purple for unique
        } else if (blueprint.type === 'miniboss') {
            enemy.setTint(0xFF8800); // Orange for miniboss
        }
        
        this.scene.enemiesGroup.add(enemy);
        
        // Set depth
        enemy.setDepth(this.scene.DEPTH_LAYERS?.ENEMIES || 1000);
        
        return enemy;
    }
    
    /**
     * Get color from blueprint
     */
    getColorFromBlueprint(blueprint) {
        if (blueprint.visuals?.tint) return blueprint.visuals.tint;
        if (blueprint.graphics?.color) return blueprint.graphics.color;
        if (blueprint.display?.tint) return blueprint.display.tint;
        
        // Default colors by type
        const typeColors = {
            'boss': 0xFF0000,
            'elite': 0xFFD700,
            'unique': 0xFF00FF,
            'miniboss': 0xFF8800,
            'enemy': 0x00FF00
        };
        
        return typeColors[blueprint.type] || 0x00FF00;
    }
    
    /**
     * Spawn a boss (convenience method)
     */
    spawnBoss(bossId, options = {}) {
        return this.spawnEnemy(bossId, { ...options, type: 'boss' });
    }
    
    /**
     * Clear all enemies
     */
    clearAll() {
        this.scene.enemiesGroup?.clear?.(true, true);
        this.scene.bossGroup?.clear?.(true, true);
        this.scene.currentBoss = null;
    }
    
    /**
     * Kill all enemies (for special effects)
     */
    killAll() {
        const enemies = [
            ...(this.scene.enemiesGroup?.getChildren() || []),
            ...(this.scene.bossGroup?.getChildren() || [])
        ];
        
        enemies.forEach(enemy => {
            if (enemy?.active && enemy?.takeDamage) {
                enemy.takeDamage(99999);
            }
        });
    }
    
    /**
     * Get count of active enemies
     */
    getActiveCount() {
        const enemies = this.scene.enemiesGroup?.countActive?.(true) || 0;
        const bosses = this.scene.bossGroup?.countActive?.(true) || 0;
        return enemies + bosses;
    }
    
    /**
     * Clear all projectiles (delegates to ProjectileSystem)
     */
    clearAllProjectiles() {
        if (this.scene.projectileSystem?.clearAll) {
            this.scene.projectileSystem.clearAll();
        }
    }
    
    /**
     * Get detailed stats for debugging
     */
    getStats() {
        return {
            enemies: this.scene.enemiesGroup?.countActive?.(true) || 0,
            enemiesTotal: this.scene.enemiesGroup?.getLength?.() || 0,
            bosses: this.scene.bossGroup?.countActive?.(true) || 0,
            bossesTotal: this.scene.bossGroup?.getLength?.() || 0,
            total: this.getActiveCount(),
            currentBoss: this.scene.currentBoss ? {
                id: this.scene.currentBoss.blueprintId || 'unknown',
                hp: this.scene.currentBoss.hp,
                maxHp: this.scene.currentBoss.maxHp
            } : null
        };
    }
    
    /**
     * Shutdown
     */
    shutdown() {
        this.clearAll();
        this.clearAllProjectiles();
    }
}

export default EnemyManager;