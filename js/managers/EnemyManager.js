import { getSession } from '../core/debug/SessionLog.js';

/**
 * EnemyManager - Centralized enemy and boss management
 * PR7 compliant - handles all enemy spawning and lifecycle
 */

import { Enemy } from '../entities/Enemy.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
import { Boss } from '../entities/Boss.js';

/**
 * @typedef {import('../entities/Enemy.js').Enemy} Enemy
 */

export class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.blueprintLoader = scene.blueprintLoader;
        
        // Groups should be created by SystemsInitializer before EnemyManager is constructed
        // Defensive guard: create if missing (backward compat)
        if (!scene.enemiesGroup) {
            scene.enemiesGroup = scene.physics.add.group({ runChildUpdate: false });
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
            DebugLogger.error('enemy', `[EnemyManager] Blueprint not found: ${blueprintId}`);
            return null;
        }
        
        // Determine spawn position
        const scale = this.scene.getScaleManager ? this.scene.getScaleManager() : this.scene.scale;
        const x = options.x || (50 + Math.random() * (scale.width - 100));
        const y = options.y || (50 + Math.random() * (scale.height - 100));
        
        // Get visual properties
        const visuals = blueprint.visuals || {};
        const color = visuals.tint || blueprint.graphics?.tint || this.getColorFromBlueprint(blueprint);
        const size = blueprint.stats?.size || visuals.size?.w || (blueprint.type === 'boss' ? 60 : 20);
        const textureKey = visuals.textureKey || blueprintId;
        
        // Generate texture if it doesn't exist
        if (!this.scene.textures.exists(textureKey) && this.scene.graphicsFactory) {
            this.scene.graphicsFactory.generateEnemyTexture(textureKey, color, size, blueprint);
        }
        
        let entity;
        
        if (blueprint.type === 'boss') {
            entity = this.createBoss(blueprint, x, y, textureKey, color, size, options);
        } else {
            entity = this.createRegularEnemy(blueprint, blueprintId, x, y, textureKey, color, size, options);
        }
        
        // Session log + analytics
        getSession()?.spawn(blueprint.type || 'enemy', blueprintId, entity?.x || x, entity?.y || y);
        if (this.scene.analyticsManager) {
            this.scene.analyticsManager.trackEnemySpawn(blueprintId);
        }
        
        return entity;
    }
    
    /**
     * Create a boss entity
     */
    createBoss(blueprint, x, y, textureKey, color, size, options) {
        // Generate boss texture if needed (with gold border)
        if (!this.scene.textures.exists(textureKey) && this.scene.graphicsFactory) {
            this.scene.graphicsFactory.generateEnemyTexture(textureKey, color, size, blueprint);
        }

        const boss = new Boss(this.scene, x, y, blueprint, options);
        this.scene.bossGroup.add(boss);
        this.scene.currentBoss = boss;
        this.scene.bossActive = true;

        // Re-apply physics config after group.add() (same as regular enemies)
        if (boss.body) {
            boss.body.setCollideWorldBounds(false);
            boss.body.setAllowGravity(false);
            const radius = Math.max(8, Math.floor(size * 0.45));
            boss.setCircle(radius);
        }

        // Set depth
        boss.setDepth(this.scene.DEPTH_LAYERS?.BOSSES || 1100);

        // Ensure texture
        boss.setTexture(textureKey);
        boss.setDisplaySize(size, size);
        
        // Notify UI to show boss health bar (event-based scene communication)
        if (this.scene.events) {
            const bossName = blueprint.display?.devNameFallback || boss.bossName || blueprint.id;
            this.scene.events.emit('boss:show-hp', { name: bossName, hp: boss.hp, maxHp: boss.maxHp });
        }
        
        DebugLogger.info('spawn', `[EnemyManager] Boss spawned: ${blueprint.id} at (${Math.round(x)},${Math.round(y)}) HP=${boss.hp}`);
        
        return boss;
    }
    
    /**
     * Create a regular enemy entity
     */
    createRegularEnemy(blueprint, blueprintId, x, y, textureKey, color, size, options) {
        // Prepare blueprint with all necessary data
        const enhancedBlueprint = {
            ...blueprint,
            id: blueprintId,
            texture: textureKey,
            color: color,
            isElite: options.elite || blueprint.type === 'elite',
            isUnique: blueprint.type === 'unique',
            isMiniboss: blueprint.type === 'miniboss'
        };
        
        // Create enemy with new constructor signature
        const enemy = new Enemy(this.scene, enhancedBlueprint, { x, y });
        
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

        // Re-apply physics config after group.add() — Phaser resets body on add
        if (enemy.body) {
            enemy.body.setCollideWorldBounds(false);
            enemy.body.setAllowGravity(false);
            const radius = Math.max(6, Math.floor(Math.min(enemy.displayWidth, enemy.displayHeight) * 0.45));
            enemy.setCircle(radius);
        }

        // Set depth
        enemy.setDepth(this.scene.DEPTH_LAYERS?.ENEMIES || 1000);
        
        DebugLogger.verbose('spawn', `[EnemyManager] Spawned ${blueprintId} at (${Math.round(x)},${Math.round(y)})`);
        
        return enemy;
    }
    
    /**
     * Get color from blueprint
     */
    getColorFromBlueprint(blueprint) {
        if (blueprint.visuals?.tint) return blueprint.visuals.tint;
        if (blueprint.graphics?.tint) return blueprint.graphics.tint;
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
        this.scene.bossActive = false;
    }
    
    /**
     * Kill all enemies (for special effects)
     */
    killAll({ includeBosses = false } = {}) {
        const enemies = [
            ...(this.scene.enemiesGroup?.getChildren() || [])
        ];

        // Bosses are immune to instant-kill effects (metotrexat) by default
        // Only include bosses when explicitly requested (e.g. DEV.killAll)
        if (includeBosses) {
            enemies.push(...(this.scene.bossGroup?.getChildren() || []));
        } else {
            // Deal 25% max HP damage to bosses instead of instant kill
            const bosses = this.scene.bossGroup?.getChildren() || [];
            for (const boss of bosses) {
                if (boss?.active && boss?.takeDamage) {
                    const bossMaxHp = boss.maxHp || boss.bp?.stats?.maxHp || 1000;
                    const chunkDmg = Math.ceil(bossMaxHp * 0.25);
                    boss.takeDamage(chunkDmg);
                    getSession()?.log('boss', 'metotrexat_chunk', { bossId: boss.blueprintId, damage: chunkDmg, remainingHP: boss.hp });
                }
            }
        }

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
     * Handle enemy death - loot, XP, stats, VFX/SFX, deactivation
     * Extracted from GameScene.handleEnemyDeath for thin-scene compliance
     * @param {Enemy} enemy
     */
    onEnemyDeath(enemy) {
        if (!enemy) return;
        if (enemy._deathProcessed) return;
        enemy._deathProcessed = true;

        const scene = this.scene;

        // Session log
        getSession()?.kill('player', enemy.blueprintId || enemy.blueprint?.id, enemy.xp, {
            hp: enemy.maxHp, pos: `${Math.round(enemy.x)},${Math.round(enemy.y)}`
        });

        // Clean up ALL VFX effects immediately before any other cleanup
        if (typeof enemy.cleanupAllVFX === 'function') {
            enemy.cleanupAllVFX();
        }

        const isBoss = enemy instanceof Boss;

        try {
            // Play death VFX/SFX (Boss handles its own in Boss.die() — skip here)
            if (!isBoss) {
                if (scene.vfxSystem && enemy._vfx?.death) {
                    scene.vfxSystem.play(enemy._vfx.death, enemy.x, enemy.y);
                }
                if (scene.audioSystem && enemy._sfx?.death) {
                    scene.audioSystem.play(enemy._sfx.death);
                }
            }

            // Create XP orbs based on enemy XP value
            if (enemy.xp && enemy.xp > 0 && scene.createXPOrbs) {
                scene.createXPOrbs(enemy.x, enemy.y, enemy.xp);
            }

            // Handle drops using SimpleLootSystem (for consumables only, not XP)
            if (scene.lootSystem) {
                try {
                    scene.lootSystem.handleEnemyDeath(enemy);
                } catch (error) {
                    DebugLogger.info('loot', '[Loot] Failed to handle enemy death:', error.message);
                }
            }

            // Update statistics
            scene.gameStats.kills = (scene.gameStats.kills || 0) + 1;
            scene.gameStats.enemiesKilled++;
            scene.gameStats.score += enemy.xp * 10;

            // Safe analytics with proper checks
            const enemy_type = enemy.blueprintId || enemy.type || 'unknown';
            if (scene.analyticsManager && typeof scene.analyticsManager.trackEvent === 'function') {
                scene.analyticsManager.trackEvent('enemy_killed', {
                    enemy_type,
                    level: scene.gameStats?.level ?? 1
                });
            }

            // Handle boss death
            if (enemy instanceof Boss) {
                scene.gameStats.bossesDefeated++;
                scene.currentBoss = null;
                scene.bossActive = false;
            }

        } catch (error) {
            DebugLogger.warn('game', '[EnemyManager] enemy death handling failed:', error);
        }

        // Deactivate (don't destroy — Boss.die() still runs after this returns)
        if (enemy.active) {
            enemy.setActive(false);
            enemy.setVisible(false);
            if (enemy.body) enemy.body.setEnable(false);
        }
    }

    /**
     * Shutdown
     */
    shutdown() {
        this.clearAll();
        this.clearAllProjectiles();
    }
}

