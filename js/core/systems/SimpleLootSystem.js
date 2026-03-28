/**
 * SimpleLootSystem - Jednoduchý, efektivní loot systém
 * PR7 compliant - vše řízeno blueprinty
 * 
 * Nahrazuje: LootSystem, LootBootstrap, LootDropManager, LootSystemIntegration
 */

import { DebugLogger } from '../debug/DebugLogger.js';
import { generateLootTextures } from './loot/LootTextureGenerator.js';

export class SimpleLootSystem {
    constructor(scene) {
        // PR7: PowerUpSystem integration for magnet effects
        // Note: PowerUpSystem is optional as loot can work without power-ups
        
        this.scene = scene;
        const CC = scene.COLLISION_CATEGORIES;
        this.lootGroup = scene.physics.add.group({
            collisionCategory: CC?.LOOT || 0x0010,
            collidesWith: CC?.PLAYER || 0x0001
        });
        this.blueprintLoader = scene.blueprintLoader;
        
        // Depth layers for different drop types
        this.DEPTH_LAYERS = {
            XP_ORBS: 500,      // XP orbs at bottom
            ITEM_DROPS: 600    // Items above XP orbs
        };
        
        // Track recent drop positions to prevent overlap
        this.recentDrops = [];
        this.dropCleanupTime = 5000; // Clear old positions after 5 seconds
        this.minSpacing = 15; // Minimum pixels between drops
        
        // PR7: No hardcoded values - everything from PowerUpManager
        
        // Generate item textures on initialization
        generateLootTextures(this.scene);

        // PR7: SimpleLootSystem initialized
    }
    
    /**
     * Create a drop at position
     */
    createDrop(x, y, dropId, options = {}) {
        // Use dropId as-is - blueprints already use correct format (item.health_small, item.xp_small)
        
        // Get blueprint - use get() method instead of getBlueprint()
        const blueprint = this.blueprintLoader?.get(dropId);
        if (!blueprint) {
            DebugLogger.warn('loot', `Blueprint not found: ${dropId}`);
            return null;
        }
        
        // Determine drop type from blueprint
        const dropType = blueprint.effect?.type || blueprint.category || blueprint.mechanics?.effectType || 'xp';
        
        // Adjust position to prevent overlap with existing drops
        const adjustedPos = this.findNonOverlappingPosition(x, y, dropType);
        
        // Create drop sprite
        const drop = this.scene.physics.add.sprite(adjustedPos.x, adjustedPos.y, blueprint.sprite || 'placeholder');
        // PR7: Use scale from blueprint graphics configuration, no hardcoded values
        const scale = blueprint.graphics?.scale || 1.0;
        drop.setScale(scale);
        drop.dropId = dropId;
        drop.blueprint = blueprint;
        drop.dropType = dropType;
        drop.value = blueprint.effect?.value || blueprint.stats?.value || 1;
        
        // Set depth based on drop type - items always above XP orbs
        if (dropType === 'xp') {
            drop.setDepth(this.DEPTH_LAYERS.XP_ORBS);
        } else {
            drop.setDepth(this.DEPTH_LAYERS.ITEM_DROPS);
        }
        
        // Track this drop position
        this.recentDrops.push({
            x: adjustedPos.x,
            y: adjustedPos.y,
            time: this.scene?.time?.now || 0
        });
        
        // Clean up old positions
        this.cleanupOldPositions();
        
        // Add to group
        this.lootGroup.add(drop);
        
        // Ensure physics body is properly configured
        if (drop.body) {
            drop.body.setCollideWorldBounds(false); // Allow XP orbs to be pulled through walls
            drop.body.setDrag(50); // Small drag to make movement smoother
            drop.body.setBounce(0.1); // Small bounce on collision
            
            // DEBUG: Verify physics body exists
            if (Math.random() < 0.01) {
                DebugLogger.verbose('loot', ` ✅ Created ${dropType} drop with physics body:`, {
                    hasBody: !!drop.body,
                    bodyEnabled: drop.body?.enabled,
                    position: `(${Math.round(drop.x)}, ${Math.round(drop.y)})`,
                    dropId: dropId
                });
            }
        } else {
            DebugLogger.error('loot', `❌ Drop created without physics body!`, dropId);
        }
        
        // Visual effects
        if (blueprint.vfx?.spawn && this.scene.vfxSystem) {
            this.scene.vfxSystem.play(blueprint.vfx.spawn, x, y);
        }
        
        // Gentle scale pulse (no position tweens — those conflict with physics body)
        if (this.scene?.tweens) {
            this.scene.tweens.add({
                targets: drop,
                scaleX: 1.15,
                scaleY: 1.15,
                duration: 600,
                yoyo: true,
                repeat: 2,
                ease: 'Sine.easeInOut'
            });
        }
        
        return drop;
    }
    
    /**
     * Handle enemy death - create drops from blueprint
     */
    handleEnemyDeath(enemy) {
        DebugLogger.debug('loot', '🎯 handleEnemyDeath called for:', enemy.blueprintId || enemy.type);
        DebugLogger.verbose('loot', '   Blueprint exists:', !!enemy.blueprint);
        DebugLogger.verbose('loot', '   Blueprint ID:', enemy.blueprint?.id);
        DebugLogger.verbose('loot', '   Has drops array:', !!enemy.blueprint?.drops);
        DebugLogger.verbose('loot', '   Drops array length:', enemy.blueprint?.drops?.length);
        DebugLogger.verbose('loot', '   Drops content:', enemy.blueprint?.drops);
        
        // PR7: Drops pouze z blueprintů - žádné loot tables
        if (!enemy.blueprint?.drops || enemy.blueprint.drops.length === 0) {
            DebugLogger.debug('loot', '❌ No drops defined for enemy:', enemy.blueprint?.id || enemy.blueprintId);
            // No drops defined - this is fine for enemies that only drop XP
            return;
        }
        
        // Zpracovat drops z blueprintu
        DebugLogger.debug('loot', `✅ Processing ${enemy.blueprint.drops.length} drops`);
        for (const drop of enemy.blueprint.drops) {
            const roll = Math.random();
            DebugLogger.verbose('loot', `🎲 Drop roll for ${drop.itemId}: chance=${drop.chance}, roll=${roll.toFixed(3)}, will drop=${roll < drop.chance}`);
            
            if (roll < drop.chance) {
                // Use itemId as-is - blueprints already use correct format
                DebugLogger.debug('loot', '💎 Creating drop:', drop.itemId);
                const dropObject = this.createDrop(enemy.x, enemy.y, drop.itemId);
                DebugLogger.debug('loot', '💎 Drop created:', !!dropObject);
            }
        }
    }
    
    /**
     * Handle player collecting loot
     */
    handlePickup(player, loot) {
        if (!loot.active) return;
        DebugLogger.info('loot', `[LootPickup] Picking up ${loot.dropId} type=${loot.dropType} value=${loot.value}`);
        
        const blueprint = loot.blueprint;
        const dropType = loot.dropType;
        
        // Apply effect based on type
        switch(dropType) {
            case 'xp':
                // Use value from blueprint effect if available
                const xpValue = blueprint.effect?.value || loot.value || 1;
                if (this.scene.addXP) {
                    this.scene.addXP(xpValue);
                } else if (player.addXP) {
                    player.addXP(xpValue);
                }
                break;
                
            case 'health':
                const healAmount = blueprint.stats?.healAmount || 20;
                player.heal?.(healAmount);
                break;
                
            case 'special':
                // Special effects like Metotrexat
                if (blueprint.mechanics?.effect === 'instant_kill_all') {
                    this.killAllEnemies();
                }
                break;
        }
        
        // Play pickup VFX/SFX
        if (blueprint.vfx?.pickup && this.scene.vfxSystem) {
            this.scene.vfxSystem.play(blueprint.vfx.pickup, loot.x, loot.y);
        }
        
        if (blueprint.sfx?.pickup && this.scene.audioSystem) {
            this.scene.audioSystem.play(blueprint.sfx.pickup);
        }
        
        // Kill any active tweens before destroying to prevent orphaned tween updates
        if (this.scene?.tweens) {
            this.scene.tweens.killTweensOf(loot);
        }
        loot.destroy();
    }
    
    /**
     * Auto-collect a loot item (used during level transition)
     */
    collectItem(loot) {
        if (!loot?.active) return;
        const player = this.scene?.player;
        if (player) {
            this.handlePickup(player, loot);
        }
    }

    /**
     * Update loop - handle XP magnet effect
     */
    update(time, delta) {
        if (!this.scene.player?.active) return;

        const player = this.scene.player;
        const children = this.lootGroup?.getChildren();
        if (!children || children.length === 0) return;

        // Distance-based pickup for ALL loot (overlap fallback)
        const pickupRadiusSq = 25 * 25;
        for (let i = children.length - 1; i >= 0; i--) {
            const loot = children[i];
            if (!loot?.active) continue;
            const dx = player.x - loot.x;
            const dy = player.y - loot.y;
            if (dx * dx + dy * dy < pickupRadiusSq) {
                this.handlePickup(player, loot);
            }
        }

        // XP magnet attraction
        const magnetRadius = player._stats?.()?.xpMagnetRadius || player.baseStats?.xpMagnetRadius || 0;
        if (magnetRadius <= 0) return;
        
        // Apply magnet attraction to XP orbs (pickup handled above)
        const radiusSq = magnetRadius * magnetRadius;
        for (let i = 0, len = children.length; i < len; i++) {
            const loot = children[i];
            if (!loot?.active || loot.dropType !== 'xp') continue;
            if (!loot.body) continue;

            const dx = player.x - loot.x;
            const dy = player.y - loot.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < radiusSq && distSq > 1) {
                const distance = Math.sqrt(distSq);
                const normalizedDistance = distance / magnetRadius;
                const force = 0.3 + (0.7 * (1 - normalizedDistance));
                const speed = 300 * force;
                loot.body.setVelocity((dx / distance) * speed, (dy / distance) * speed);
            } else if (distSq >= radiusSq) {
                loot.body.setVelocity(0, 0);
            }
        }
    }
    
    // killAllEnemies removed — use EnemyManager.killAll() (single responsibility)
    
    /**
     * Find a non-overlapping position for a new drop
     */
    findNonOverlappingPosition(x, y, dropType) {
        // For XP orbs, use larger random spread
        // For items, use smaller spread and check for overlap
        const isItem = dropType !== 'xp';
        const maxOffset = isItem ? 20 : 30; // Items have smaller spread
        
        // Start with original position
        let finalX = x;
        let finalY = y;
        
        // Only check overlap for items (not XP orbs)
        if (isItem) {
            // Try up to 10 times to find non-overlapping position
            for (let attempt = 0; attempt < 10; attempt++) {
                const offsetX = (Math.random() - 0.5) * maxOffset;
                const offsetY = (Math.random() - 0.5) * maxOffset;
                const testX = x + offsetX;
                const testY = y + offsetY;
                
                // Check if this position overlaps with recent drops
                let overlaps = false;
                const minSpacingSq = this.minSpacing * this.minSpacing;
                for (const drop of this.recentDrops) {
                    const dx = testX - drop.x;
                    const dy = testY - drop.y;
                    if (dx * dx + dy * dy < minSpacingSq) {
                        overlaps = true;
                        break;
                    }
                }
                
                if (!overlaps) {
                    finalX = testX;
                    finalY = testY;
                    break;
                }
                
                // Spiral fallback: each attempt tries a different angle around the origin
                const angle = (attempt / 10) * Math.PI * 2;
                finalX = x + Math.cos(angle) * (this.minSpacing + 5);
                finalY = y + Math.sin(angle) * (this.minSpacing + 5);
            }
        } else {
            // XP orbs can have random positions
            finalX = x + (Math.random() - 0.5) * maxOffset;
            finalY = y + (Math.random() - 0.5) * maxOffset;
        }
        
        return { x: finalX, y: finalY };
    }
    
    /**
     * Clean up old position records
     */
    cleanupOldPositions() {
        const now = this.scene?.time?.now || 0;
        if (!now) return; // Scene time unavailable — skip cleanup
        this.recentDrops = this.recentDrops.filter(drop =>
            now - drop.time < this.dropCleanupTime
        );
    }
    
    /**
     * Clear all drops
     */
    clearAll() {
        // Kill tweens on all loot items before destroying to prevent orphaned tween updates
        if (this.scene?.tweens) {
            const children = this.lootGroup.getChildren();
            for (const loot of children) {
                this.scene.tweens.killTweensOf(loot);
            }
        }
        this.lootGroup.clear(true, true);
        this.recentDrops = [];
    }
    
    /**
     * Animate pickup item with pulsing effect
     * Used for special items like metotrexat
     */
    animatePickup(item) {
        if (!this.scene.tweens || !item || !item.active) return null;
        
        return this.scene.tweens.add({
            targets: item,
            scale: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }
    
    /**
     * Animate item attraction to target (XP magnet effect)
     * Handles pause fallback - immediately moves item if time is paused
     */
    animateAttraction(item, target, onComplete) {
        if (!item?.active || !target || !item.body) {
            if (onComplete) onComplete();
            return null;
        }

        // Use physics velocity instead of tweening x/y (tweens conflict with Arcade Physics)
        const speed = 400;
        this.scene.physics.moveTo(item, target.x, target.y, speed);

        // Store callback — will be resolved when item overlaps player (via handlePickup)
        item._attractionCallback = onComplete;
        return null;
    }
    
    shutdown() {
        // Stop all tweens on loot objects
        if (this.scene && this.scene.tweens && this.lootGroup) {
            const children = this.lootGroup.getChildren();
            if (children && Array.isArray(children)) {
                children.forEach(loot => {
                    if (loot && this.scene && this.scene.tweens) {
                        this.scene.tweens.killTweensOf(loot);
                    }
                });
            }
        }
        
        // Clear the group
        if (this.lootGroup && this.lootGroup.clear) {
            this.lootGroup.clear(true, true);
        }
        
        // Clear recent drops
        if (this.recentDrops) {
            this.recentDrops = [];
        }
    }
}