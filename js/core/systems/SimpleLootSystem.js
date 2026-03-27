/**
 * SimpleLootSystem - Jednoduchý, efektivní loot systém
 * PR7 compliant - vše řízeno blueprinty
 * 
 * Nahrazuje: LootSystem, LootBootstrap, LootDropManager, LootSystemIntegration
 */

import { DebugLogger } from '../debug/DebugLogger.js';

export class SimpleLootSystem {
    constructor(scene) {
        // PR7: PowerUpSystem integration for magnet effects
        // Note: PowerUpSystem is optional as loot can work without power-ups
        
        this.scene = scene;
        this.lootGroup = scene.physics.add.group();
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
        this.generateItemTextures();
        
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
            time: Date.now()
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
        
        // Remove loot
        loot.destroy();
    }
    
    /**
     * Update loop - handle XP magnet effect
     */
    update(time, delta) {
        if (!this.scene.player?.active) return;
        
        const player = this.scene.player;
        
        // Read magnet radius from player stats pipeline (single source of truth)
        const magnetRadius = player._stats?.()?.xpMagnetRadius || player.baseStats?.xpMagnetRadius || 0;
        if (magnetRadius <= 0) return;
        
        // Apply magnet effect to XP orbs
        const children = this.lootGroup?.getChildren();
        if (children && Array.isArray(children)) {
            children.forEach(loot => {
                if (!loot?.active || loot.dropType !== 'xp') return;
            
            // Verify physics body exists
            if (!loot.body) {
                if (Math.random() < 0.01) {
                    DebugLogger.error('loot', `❌ XP orb missing physics body:`, loot.dropId);
                }
                return;
            }
            
            const dx = player.x - loot.x;
            const dy = player.y - loot.y;
            const distSq = dx * dx + dy * dy;
            const radiusSq = magnetRadius * magnetRadius;

            if (distSq < radiusSq && distSq > 1) {
                // Only compute sqrt when inside range (most orbs are outside)
                const distance = Math.sqrt(distSq);
                const normalizedDistance = distance / magnetRadius;
                const force = 0.3 + (0.7 * (1 - normalizedDistance));
                const speed = 300 * force;
                loot.body.setVelocity((dx / distance) * speed, (dy / distance) * speed);
            } else if (distSq >= radiusSq) {
                loot.body.setVelocity(0, 0);
            }
        });
        }
    }
    
    /**
     * Kill all enemies (for Metotrexat effect)
     */
    killAllEnemies() {
        const enemies = this.scene.enemiesGroup?.getChildren() || [];
        enemies.forEach(enemy => {
            if (enemy.active && enemy.takeDamage) {
                enemy.takeDamage(99999);
            }
        });
        
        // Flash effect
        this.scene.cameras.main.flash(300, 255, 255, 0);
    }
    
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
                
                // If still overlapping after attempts, use spiral pattern
                if (attempt === 9) {
                    const angle = (attempt / 10) * Math.PI * 2;
                    finalX = x + Math.cos(angle) * (this.minSpacing + 5);
                    finalY = y + Math.sin(angle) * (this.minSpacing + 5);
                }
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
        const now = this.scene?.time?.now || Date.now();
        this.recentDrops = this.recentDrops.filter(drop =>
            now - drop.time < this.dropCleanupTime
        );
    }
    
    /**
     * Clear all drops
     */
    clearAll() {
        this.lootGroup.clear(true, true);
        this.recentDrops = [];
    }
    
    /**
     * Shutdown - clean up all tweens on loot objects
     */
    /**
     * Generate item textures programmatically
     * Moved from GameScene to follow PR7 principles
     */
    generateItemTextures() {
        const textures = this.scene.textures;
        const graphicsFactory = this.scene.graphicsFactory;
        
        if (!graphicsFactory) {
            DebugLogger.warn('loot', 'GraphicsFactory not available, skipping texture generation');
            return;
        }
        
        // XP Orb - Small (cyan, 12px)
        if (!textures.exists('item_xp_small')) {
            const graphics = graphicsFactory.create();
            const size = 12;
            graphics.fillStyle(0x00E8FC, 1.0);
            graphics.fillCircle(size/2, size/2, size/2);
            graphics.fillStyle(0xFFFFFF, 1);
            graphics.fillCircle(size/2, size/2, 2);
            graphics.generateTexture('item_xp_small', size, size);
            graphicsFactory.release(graphics);
        }
        
        // XP Orb - Medium (blue, 16px)
        if (!textures.exists('item_xp_medium')) {
            const graphics = graphicsFactory.create();
            const size = 16;
            graphics.fillStyle(0x0080FF, 1.0);
            graphics.fillCircle(size/2, size/2, size/2);
            graphics.fillStyle(0xFFFFFF, 1);
            graphics.fillCircle(size/2, size/2, 3);
            graphics.generateTexture('item_xp_medium', size, size);
            graphicsFactory.release(graphics);
        }
        
        // XP Orb - Large (dark blue, 20px)
        if (!textures.exists('item_xp_large')) {
            const graphics = graphicsFactory.create();
            const size = 20;
            graphics.fillStyle(0x0040CC, 1.0);
            graphics.fillCircle(size/2, size/2, size/2);
            graphics.fillStyle(0xFFFFFF, 1);
            graphics.fillCircle(size/2, size/2, 4);
            graphics.generateTexture('item_xp_large', size, size);
            graphicsFactory.release(graphics);
        }
        
        // Health Small (red circle with cross, 16px)
        if (!textures.exists('item_health_small')) {
            const graphics = graphicsFactory.create();
            const size = 16;
            graphics.fillStyle(0xFF0000, 1);
            graphics.fillCircle(size/2, size/2, size/2);
            graphics.fillStyle(0xFFFFFF, 1);
            graphics.fillRect(size/2 - 1, size/4, 2, size/2);
            graphics.fillRect(size/4, size/2 - 1, size/2, 2);
            graphics.generateTexture('item_health_small', size, size);
            graphicsFactory.release(graphics);
        }
        
        // Heal Orb (larger red circle, 20px)
        if (!textures.exists('item_heal_orb')) {
            const graphics = graphicsFactory.create();
            const size = 20;
            graphics.fillStyle(0xFF3333, 1);
            graphics.fillCircle(size/2, size/2, size/2);
            graphics.fillStyle(0xFF0000, 0.8);
            graphics.fillCircle(size/2, size/2, size/2 - 2);
            graphics.fillStyle(0xFFFFFF, 1);
            graphics.fillRect(size/2 - 2, size/4, 4, size/2);
            graphics.fillRect(size/4, size/2 - 2, size/2, 4);
            graphics.generateTexture('item_heal_orb', size, size);
            graphicsFactory.release(graphics);
        }
        
        // Protein Cache (green capsule, 18px)
        if (!textures.exists('item_protein_cache')) {
            const graphics = graphicsFactory.create();
            const size = 18;
            graphics.fillStyle(0x00FF00, 1);
            graphics.fillRoundedRect(size/4, 0, size/2, size, 4);
            graphics.fillStyle(0xFFFFFF, 1);
            graphics.fillCircle(size/2, size/2, 3);
            graphics.generateTexture('item_protein_cache', size, size);
            graphicsFactory.release(graphics);
        }
        
        // Metotrexat (purple circle, 18px)
        if (!textures.exists('item_metotrexat')) {
            const graphics = graphicsFactory.create();
            const size = 18;
            graphics.fillStyle(0x9C27B0, 1);
            graphics.fillCircle(size/2, size/2, size/2);
            graphics.fillStyle(0xE91E63, 0.5);
            graphics.fillCircle(size/2, size/2, size/2 - 2);
            graphics.fillStyle(0xFFFFFF, 1);
            graphics.fillCircle(size/2, size/2, 4);
            graphics.generateTexture('item_metotrexat', size, size);
            graphicsFactory.release(graphics);
        }
        
        // Metotrexat orb variant 
        if (!textures.exists('metotrexat_orb')) {
            const graphics = graphicsFactory.create();
            graphics.fillStyle(0xff00ff, 1);
            graphics.fillCircle(8, 8, 8);
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(8, 8, 3);
            graphics.generateTexture('metotrexat_orb', 16, 16);
            graphicsFactory.release(graphics);
        }
        
        DebugLogger.info('loot', 'Item textures generated');
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
        if (!item || !item.active || !target) return null;
        
        // If time is paused, immediately move to target
        if (this.scene.time?.paused) {
            item.x = target.x;
            item.y = target.y;
            if (onComplete) onComplete();
            return null;
        }
        
        // Normal tween animation
        return this.scene.tweens.add({
            targets: item,
            x: target.x,
            y: target.y,
            duration: 800,
            ease: 'Power2',
            onComplete: () => {
                if (onComplete) onComplete();
            }
        });
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