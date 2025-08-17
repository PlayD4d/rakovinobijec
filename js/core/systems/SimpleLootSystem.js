/**
 * SimpleLootSystem - Jednoduchý, efektivní loot systém
 * PR7 compliant - vše řízeno blueprinty
 * 
 * Nahrazuje: LootSystem, LootBootstrap, LootDropManager, LootSystemIntegration
 */

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
            console.warn(`[SimpleLootSystem] Blueprint not found: ${dropId}`);
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
                console.log(`[SimpleLootSystem] ✅ Created ${dropType} drop with physics body:`, {
                    hasBody: !!drop.body,
                    bodyEnabled: drop.body?.enabled,
                    position: `(${Math.round(drop.x)}, ${Math.round(drop.y)})`,
                    dropId: dropId
                });
            }
        } else {
            console.error(`[SimpleLootSystem] ❌ Drop created without physics body!`, dropId);
        }
        
        // Visual effects
        if (blueprint.vfx?.spawn && this.scene.vfxSystem) {
            this.scene.vfxSystem.play(blueprint.vfx.spawn, x, y);
        }
        
        // Add gentle floating animation (don't interfere with magnet physics)
        if (this.scene && this.scene.tweens) {
            this.scene.tweens.add({
                targets: drop,
                y: y - 5, // Smaller float distance to avoid physics conflicts
                duration: 2000, // Slower animation
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
        
        return drop;
    }
    
    /**
     * Handle enemy death - create drops from blueprint
     */
    handleEnemyDeath(enemy) {
        // PR7: Drops pouze z blueprintů - žádné loot tables
        if (!enemy._blueprint?.drops) {
            // No drops defined - this is fine for enemies that only drop XP
            return;
        }
        
        // Zpracovat drops z blueprintu
        for (const drop of enemy._blueprint.drops) {
            const roll = Math.random();
            if (roll < drop.chance) {
                // Use itemId as-is - blueprints already use correct format
                this.createDrop(enemy.x, enemy.y, drop.itemId);
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
        
        // PR7: Direct player stats - no PowerUpManager intermediary
        const magnetLevel = player.xpMagnetLevel || 0;
        if (magnetLevel <= 0) return; // No magnet active
        
        // Calculate effective radius: base * (1.25 ^ level)
        const baseRadius = 100;
        const magnetRadius = baseRadius * Math.pow(1.25, magnetLevel);
        
        // Apply magnet effect to XP orbs
        this.lootGroup.getChildren().forEach(loot => {
            if (!loot.active || loot.dropType !== 'xp') return;
            
            // Verify physics body exists
            if (!loot.body) {
                if (Math.random() < 0.01) {
                    console.error(`[SimpleLootSystem] ❌ XP orb missing physics body:`, loot.dropId);
                }
                return;
            }
            
            const dx = player.x - loot.x;
            const dy = player.y - loot.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < magnetRadius && distance > 0) {
                // Calculate attraction force (stronger when closer)
                const normalizedDistance = distance / magnetRadius;
                const force = 0.3 + (0.7 * (1 - normalizedDistance));
                
                // Apply velocity directly (isolinear movement)
                const speed = 300 * force; // Increased speed for better responsiveness
                const vx = (dx / distance) * speed;
                const vy = (dy / distance) * speed;
                
                // Set velocity directly to physics body
                loot.body.setVelocity(vx, vy);
                
                // DEBUG: Enhanced logging for physics debugging
                if (Math.random() < 0.005) { // Slightly more frequent logging
                    console.log(`[SimpleLootSystem] 🧲 XP Attraction (Enhanced):`, {
                        magnetLevel,
                        magnetRadius: Math.round(magnetRadius),
                        distance: Math.round(distance),
                        force: force.toFixed(2),
                        velocity: `(${Math.round(vx)}, ${Math.round(vy)})`,
                        orbPos: `(${Math.round(loot.x)}, ${Math.round(loot.y)})`,
                        playerPos: `(${Math.round(player.x)}, ${Math.round(player.y)})`,
                        bodyEnabled: loot.body.enabled,
                        currentVelocity: `(${Math.round(loot.body.velocity.x)}, ${Math.round(loot.body.velocity.y)})`
                    });
                }
            } else if (distance >= magnetRadius) {
                // Stop movement if outside magnet range
                loot.body.setVelocity(0, 0);
            }
        });
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
                for (const drop of this.recentDrops) {
                    const dist = Math.sqrt(
                        Math.pow(testX - drop.x, 2) + 
                        Math.pow(testY - drop.y, 2)
                    );
                    if (dist < this.minSpacing) {
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
        const now = Date.now();
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
    shutdown() {
        // Stop all tweens on loot objects
        if (this.scene && this.scene.tweens && this.lootGroup) {
            this.lootGroup.getChildren().forEach(loot => {
                if (loot) {
                    this.scene.tweens.killTweensOf(loot);
                }
            });
        }
        
        // Clear the group
        if (this.lootGroup) {
            this.lootGroup.clear(true, true);
        }
        
        // Clear recent drops
        this.recentDrops = [];
    }
}