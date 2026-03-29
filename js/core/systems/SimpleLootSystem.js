/**
 * SimpleLootSystem - Jednoduchý, efektivní loot systém
 * PR7 compliant - vše řízeno blueprinty
 * 
 * Nahrazuje: LootSystem, LootBootstrap, LootDropManager, LootSystemIntegration
 */

import { DebugLogger } from '../debug/DebugLogger.js';
import { getSession } from '../debug/SessionLog.js';
import { generateLootTextures } from './loot/LootTextureGenerator.js';

export class SimpleLootSystem {
    constructor(scene) {
        // PR7: PowerUpSystem integration for magnet effects
        // Note: PowerUpSystem is optional as loot can work without power-ups
        
        this.scene = scene;
        // Arcade Physics: overlap is registered in setupCollisions, no broadphase categories needed
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
        
        getSession()?.log('loot', 'drop_created', { dropId, dropType, value: drop.value, x: Math.round(adjustedPos.x), y: Math.round(adjustedPos.y) });

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
     * Handle enemy death - create drops from spawn table lootTables + per-enemy blueprint drops
     *
     * Flow:
     * 1. Determine enemy category (boss/elite/unique/normal)
     * 2. Roll spawn table lootTable for that category → create drops
     * 3. Roll per-enemy blueprint.drops (bonus/unique drops) → create bonus drops
     * 4. XP orbs are handled separately by EnemyManager.onEnemyDeath
     */
    handleEnemyDeath(enemy) {
        const enemyId = enemy.blueprintId || enemy.blueprint?.id || enemy.type;
        DebugLogger.debug('loot', '🎯 handleEnemyDeath called for:', enemyId);

        // --- Step 1: Determine enemy category ---
        let category = 'normal';
        const bpType = enemy.blueprint?.type;
        if (bpType === 'boss') {
            category = 'boss';
        } else if (enemy.isElite || bpType === 'elite') {
            category = 'elite';
        } else if (enemy.isUnique || bpType === 'unique') {
            category = 'elite'; // unique uses elite loot table
        }

        // --- Step 2: Roll spawn table lootTable drops ---
        const spawnDirector = this.scene.spawnDirector;
        const lootTables = spawnDirector?.currentTable?.lootTables;

        if (lootTables && lootTables[category]) {
            const table = lootTables[category];
            DebugLogger.debug('loot', `📋 Rolling lootTable [${category}] with ${Object.keys(table).length} entries`);

            for (const [itemRef, chance] of Object.entries(table)) {
                // Skip XP — handled separately by EnemyManager.onEnemyDeath → createXPOrbs
                if (itemRef.startsWith('drop.xp')) continue;

                // Chances in lootTables are percentages (0-100)
                if (Math.random() * 100 >= chance) continue;

                const itemId = this._resolveItemId(itemRef);
                if (!itemId) {
                    DebugLogger.verbose('loot', `⚠️ Unresolved lootTable ref: ${itemRef}`);
                    continue;
                }

                DebugLogger.debug('loot', `💎 LootTable drop: ${itemRef} → ${itemId}`);
                this.createDrop(enemy.x, enemy.y, itemId);
                getSession()?.log('loot', 'table_drop', { category, itemRef, itemId, enemy: enemyId });
            }
        } else {
            DebugLogger.verbose('loot', `No lootTable found for category [${category}]`);
        }

        // --- Step 3: Roll per-enemy blueprint drops (bonus drops) ---
        if (enemy.blueprint?.drops?.length > 0) {
            DebugLogger.debug('loot', `🎁 Rolling ${enemy.blueprint.drops.length} per-enemy blueprint drops`);
            for (const drop of enemy.blueprint.drops) {
                // Blueprint drop chances are fractions (0-1)
                const roll = Math.random();
                DebugLogger.verbose('loot', `🎲 Drop roll for ${drop.itemId}: chance=${drop.chance}, roll=${roll.toFixed(3)}, will drop=${roll < drop.chance}`);

                if (roll < drop.chance) {
                    DebugLogger.debug('loot', '💎 Blueprint drop:', drop.itemId);
                    this.createDrop(enemy.x, enemy.y, drop.itemId);
                    getSession()?.log('loot', 'blueprint_drop', { itemId: drop.itemId, enemy: enemyId });
                }
            }
        }
    }

    /**
     * Resolve a lootTable item reference to an actual blueprint ID.
     * Handles legacy 'drop.*' format → 'item.*' mapping.
     * @param {string} ref - Item reference from lootTable (e.g. 'drop.xp.small', 'item.health_small', 'powerup.damage_boost')
     * @returns {string|null} Resolved blueprint ID or null if not found
     */
    _resolveItemId(ref) {
        // Direct match — already a valid blueprint ID
        if (this.blueprintLoader?.get(ref)) return ref;

        // Map legacy spawn table drop.* IDs to actual item blueprint IDs
        const LEGACY_MAP = {
            'drop.xp.small': 'item.xp_small',
            'drop.xp.medium': 'item.xp_medium',
            'drop.xp.large': 'item.xp_large',
            'drop.leukocyte_pack': 'item.health_small',
            'drop.protein_cache': 'item.protein_cache',
            'drop.metotrexat': 'item.metotrexat',
            'drop.adrenal_surge': 'item.energy_cell',
        };

        const mapped = LEGACY_MAP[ref];
        if (mapped && this.blueprintLoader?.get(mapped)) return mapped;

        // Try converting drop.X to item.X as a generic fallback
        if (ref.startsWith('drop.')) {
            const itemId = 'item.' + ref.replace('drop.', '').replace(/\./g, '_');
            if (this.blueprintLoader?.get(itemId)) return itemId;
        }

        return null; // Unknown item — powerup refs or missing blueprints
    }
    
    /**
     * Handle player collecting loot
     */
    handlePickup(player, loot) {
        if (!loot.active) return;
        DebugLogger.info('loot', `[LootPickup] Picking up ${loot.dropId} type=${loot.dropType} value=${loot.value}`);
        getSession()?.log('loot', 'pickup', { dropId: loot.dropId, dropType: loot.dropType, value: loot.value });

        const blueprint = loot.blueprint;
        const dropType = loot.dropType;
        
        // Apply effect based on blueprint effect.type (primary) or dropType (fallback)
        const effectType = blueprint.effect?.type || dropType;

        switch(effectType) {
            case 'xp': {
                const xpValue = blueprint.effect?.value || loot.value || 1;
                if (this.scene.addXP) {
                    this.scene.addXP(xpValue);
                }
                break;
            }

            case 'health':
            case 'heal': {
                let healAmount = blueprint.effect?.value || blueprint.stats?.healAmount || 20;
                // 'full' = heal to max HP
                if (healAmount === 'full') healAmount = (player.maxHp || 100) - (player.hp || 0);
                player.heal?.(healAmount);
                break;
            }

            case 'instant_kill_all': {
                // Metotrexat — kill all enemies on screen
                if (this.scene.enemyManager) {
                    this.scene.enemyManager.killAll();
                }
                this.scene.flashCamera?.();
                getSession()?.log('loot', 'metotrexat_used', {});
                break;
            }

            case 'buff': {
                // Temporary stat buff (e.g. energy_cell = 1.5× attack speed for 10s)
                const stat = blueprint.effect?.stat;
                const value = blueprint.effect?.value || 1.5;
                const duration = blueprint.effect?.duration || 10000;
                if (stat && player.addModifier) {
                    const modId = `buff_${stat}_${Date.now()}`;
                    player.addModifier({ id: modId, path: stat === 'attackSpeed' ? 'attackIntervalMs' : stat, type: 'mul', value: stat === 'attackSpeed' ? -(1 - 1/value) : value - 1 });
                    // Auto-remove after duration
                    if (this.scene.time) {
                        this.scene.time.delayedCall(duration, () => {
                            player.removeModifierById?.(modId);
                        });
                    }
                    getSession()?.log('loot', 'buff_applied', { stat, value, duration });
                }
                break;
            }

            case 'research': {
                // Research points — add to score
                const points = blueprint.effect?.value || 1;
                if (this.scene.gameStats) {
                    this.scene.gameStats.score += points * 100;
                }
                getSession()?.log('loot', 'research_collected', { points });
                break;
            }

            default:
                DebugLogger.warn('loot', `[Pickup] Unhandled effect type: ${effectType} for ${loot.dropId}`);
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

        // Periodic XP orb merging + field cap enforcement (every 2s)
        if (!this._lastMergeCheck || time - this._lastMergeCheck >= 2000) {
            this._lastMergeCheck = time;
            this._mergeNearbyXPOrbs();
            this._enforceFieldCap();
        }

        // Single-pass: pickup check + magnet attraction
        const pickupRadiusSq = 625; // 25²
        const magnetRadius = player._stats?.()?.xpMagnetRadius || player.baseStats?.xpMagnetRadius || 0;
        const hasMagnet = magnetRadius > 0;
        const magnetRadiusSq = magnetRadius * magnetRadius;

        for (let i = children.length - 1; i >= 0; i--) {
            const loot = children[i];
            if (!loot?.active) continue;

            const dx = player.x - loot.x;
            const dy = player.y - loot.y;
            const distSq = dx * dx + dy * dy;

            // Pickup check (all loot types)
            if (distSq < pickupRadiusSq) {
                this.handlePickup(player, loot);
                continue;
            }

            // Magnet attraction (XP orbs only)
            if (hasMagnet && loot.dropType === 'xp' && loot.body) {
                if (distSq < magnetRadiusSq && distSq > 1) {
                    const distance = Math.sqrt(distSq);
                    const force = 0.3 + (0.7 * (1 - distance / magnetRadius));
                    const speed = 300 * force;
                    loot.body.setVelocity((dx / distance) * speed, (dy / distance) * speed);
                } else if (distSq >= magnetRadiusSq && loot.body.velocity.x !== 0) {
                    loot.body.setVelocity(0, 0);
                }
            }
        }
    }

    /**
     * Merge nearby XP orbs into higher tiers (Vampire Survivors style)
     * small (1 XP) × 5 → medium (5 XP), medium × 2 → large (10 XP)
     */
    _mergeNearbyXPOrbs() {
        const children = this.lootGroup?.getChildren();
        if (!children || children.length < 10) return; // Only merge when many orbs exist

        const mergeRadiusSq = 30 * 30; // 30px radius for merge detection
        const smalls = [];
        const mediums = [];

        for (const loot of children) {
            if (!loot?.active || loot.dropType !== 'xp') continue;
            if (loot.dropId === 'item.xp_small') smalls.push(loot);
            else if (loot.dropId === 'item.xp_medium') mediums.push(loot);
        }

        // Merge 5 nearby smalls → 1 medium
        let merged = 0;
        for (let i = 0; i < smalls.length && merged < 10; i++) {
            const anchor = smalls[i];
            if (!anchor.active) continue;
            const cluster = [anchor];
            for (let j = i + 1; j < smalls.length && cluster.length < 5; j++) {
                const other = smalls[j];
                if (!other.active) continue;
                const dx = anchor.x - other.x;
                const dy = anchor.y - other.y;
                if (dx * dx + dy * dy < mergeRadiusSq) {
                    cluster.push(other);
                }
            }
            if (cluster.length >= 5) {
                // Destroy 5 smalls, create 1 medium at anchor position
                for (const orb of cluster) orb.destroy();
                this.createDrop(anchor.x, anchor.y, 'item.xp_medium');
                merged++;
            }
        }

        // Merge 2 nearby mediums → 1 large
        for (let i = 0; i < mediums.length && merged < 15; i++) {
            const anchor = mediums[i];
            if (!anchor.active) continue;
            for (let j = i + 1; j < mediums.length; j++) {
                const other = mediums[j];
                if (!other.active) continue;
                const dx = anchor.x - other.x;
                const dy = anchor.y - other.y;
                if (dx * dx + dy * dy < mergeRadiusSq) {
                    anchor.destroy();
                    other.destroy();
                    this.createDrop(anchor.x, anchor.y, 'item.xp_large');
                    merged++;
                    break;
                }
            }
        }

        if (merged > 0) {
            getSession()?.log('loot', 'xp_merged', { merged, remaining: this.lootGroup.children.size });
        }
    }

    /**
     * Enforce max loot items on field — destroy oldest XP orbs if over cap
     */
    _enforceFieldCap() {
        const maxDrops = this.scene.configResolver?.get('performance.maxDrops', { defaultValue: 150 }) || 150;
        const children = this.lootGroup?.getChildren();
        if (!children || children.length <= maxDrops) return;

        // Remove oldest XP orbs first (lowest value items)
        const excess = children.length - maxDrops;
        let removed = 0;
        for (let i = 0; i < children.length && removed < excess; i++) {
            const loot = children[i];
            if (loot?.active && loot.dropType === 'xp' && loot.dropId === 'item.xp_small') {
                loot.destroy();
                removed++;
            }
        }
        if (removed > 0) {
            getSession()?.log('loot', 'field_cap_trim', { removed, remaining: this.lootGroup.children.size, maxDrops });
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
        if (!now) return;
        // In-place removal — no array allocation
        let write = 0;
        for (let read = 0; read < this.recentDrops.length; read++) {
            if (now - this.recentDrops[read].time < this.dropCleanupTime) {
                this.recentDrops[write++] = this.recentDrops[read];
            }
        }
        this.recentDrops.length = write;
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