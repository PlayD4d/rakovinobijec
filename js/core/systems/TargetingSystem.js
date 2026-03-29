import { DebugLogger } from '../debug/DebugLogger.js';

/**
 * TargetingSystem - Handles enemy targeting logic
 * PR7 Compliant - Extracted from Player.js for proper separation of concerns
 */
export class TargetingSystem {
    constructor(scene) {
        this.scene = scene;
        
        // PR7: Configuration from ConfigResolver instead of hardcoded values
        const CR = scene.configResolver;
        this.maxRange = CR?.get('player.targeting.maxRange', { defaultValue: 600 }) || 600;
        this.maxRangeSquared = this.maxRange * this.maxRange;
    }
    
    /**
     * Find nearest enemy for auto-targeting (optimized)
     * @param {Player} player - Player object
     * @returns {Enemy|null} Nearest enemy or null
     */
    findNearestEnemy(player) {
        if (!player) return null;
        
        let nearestEnemy = null;
        let nearestDistance = Infinity;
        
        // Early exit optimization
        const playerX = player.x;
        const playerY = player.y;
        
        // Check regular enemies (optimized iteration) - with null guards
        if (this.scene?.enemiesGroup?.getChildren) {
            try {
                const enemies = this.scene.enemiesGroup.getChildren();
                for (let i = 0; i < enemies.length; i++) {
                    const enemy = enemies[i];
                    if (!enemy?.active || enemy.hp <= 0) continue;
                    
                    // Use squared distance for performance (no sqrt)
                    const dx = enemy.x - playerX;
                    const dy = enemy.y - playerY;
                    const distanceSquared = dx * dx + dy * dy;
                    
                    // Early rejection if too far
                    if (distanceSquared > this.maxRangeSquared) continue;
                    
                    if (distanceSquared < nearestDistance) {
                        nearestDistance = distanceSquared;
                        nearestEnemy = enemy;
                    }
                }
            } catch (error) {
                DebugLogger.warn('targeting', '[TargetingSystem] Error in enemy targeting:', error.message);
            }
        }
        
        // Check bosses (they have priority) - with null guards
        if (this.scene?.bossGroup?.getChildren) {
            try {
                const bosses = this.scene.bossGroup.getChildren();
                for (let i = 0; i < bosses.length; i++) {
                    const boss = bosses[i];
                    if (!boss?.active || boss.hp <= 0) continue;
                    
                    // Use squared distance for performance
                    const dx = boss.x - playerX;
                    const dy = boss.y - playerY;
                    const distanceSquared = dx * dx + dy * dy;
                    
                    // Early rejection if too far
                    if (distanceSquared > this.maxRangeSquared) continue;
                    
                    // Bosses get priority - use 0.5x distance for comparison
                    const adjustedDistance = distanceSquared * 0.5;
                    
                    if (adjustedDistance < nearestDistance) {
                        nearestDistance = adjustedDistance;
                        nearestEnemy = boss;
                    }
                }
            } catch (error) {
                DebugLogger.warn('targeting', '[TargetingSystem] Error in boss targeting:', error.message);
            }
        }
        
        // Return enemy if found (already range-checked)
        return nearestEnemy;
    }
    
    // findTarget() removed — was a legacy duplicate of findNearestEnemy without range/HP/boss checks

    /**
     * Update configuration from blueprints (Phase 4)
     */
    updateConfig(config) {
        this.maxRange = config.maxRange || 600;
        this.maxRangeSquared = this.maxRange * this.maxRange;
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.scene = null;
    }
}

