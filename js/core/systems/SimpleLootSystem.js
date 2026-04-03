/**
 * SimpleLootSystem - Phaser-native loot pooling system
 * Pickup via physics.add.overlap (setupCollisions.js). XP magnet in update().
 */
import { DebugLogger } from '../debug/DebugLogger.js';
import { getSession } from '../debug/SessionLog.js';
import { generateLootTextures } from './loot/LootTextureGenerator.js';
import { ChestHandler } from './loot/ChestHandler.js';

const POOL_MAX_SIZE = 200;
const PICKUP_RADIUS_SQ = 625; // 25²
const CAP_CHECK_INTERVAL = 2000; // ms
const FIELD_CAP = 150; // XP orbs on field before superorb kicks in
const MIN_SPACING_SQ = 225; // 15²

export class SimpleLootSystem {
    constructor(scene) {
        this.scene = scene;
        this.blueprintLoader = scene.blueprintLoader;

        const lootDepth = scene.DEPTH_LAYERS?.LOOT ?? 500;
        this._depthXP = lootDepth;
        this._depthItems = lootDepth + 100;

        this.lootGroup = scene.physics.add.group({ maxSize: POOL_MAX_SIZE });
        this.recentDrops = [];
        this._dropCleanupTime = 5000;
        this._lastCapCheck = 0;
        this._posBuffer = { x: 0, y: 0 };

        // Superorb — accumulates XP when field is over cap (VS red gem mechanic)
        this._superorb = null; // Active superorb sprite reference
        this._superorbXP = 0; // Accumulated XP waiting inside superorb

        generateLootTextures(this.scene);
    }

    // ==================== Drop Creation ====================

    /**
     * Create or recycle a loot drop at position.
     * Uses Phaser Group.get() for native pool reuse — no new sprite allocation when pool has inactive members.
     */
    createDrop(x, y, dropId, options = {}) {
        const blueprint = this.blueprintLoader?.get(dropId);
        if (!blueprint) {
            DebugLogger.warn('loot', `Blueprint not found: ${dropId}`);
            return null;
        }

        const dropType = blueprint.effect?.type || blueprint.category || blueprint.mechanics?.effectType || 'xp';
        const textureKey = blueprint.sprite || 'placeholder';

        // Find non-overlapping position (copy immediately — _posBuffer is shared/mutable)
        const pos = this._findPosition(x, y, dropType);
        const spawnX = pos.x;
        const spawnY = pos.y;

        // Phaser-native pool: get() returns first inactive member or creates new if pool allows
        const drop = this.lootGroup.get(spawnX, spawnY, textureKey);
        if (!drop) {
            // Pool exhausted (maxSize reached) — skip silently
            return null;
        }

        // Configure the sprite (works for both new and recycled)
        drop.setActive(true).setVisible(true);
        drop.enableBody(true, spawnX, spawnY, true, true);

        drop.setTexture(textureKey);

        // Visual depth separation: XP = background (dim, small), items = mid-layer
        if (dropType === 'xp') {
            const xpScale = (blueprint.graphics?.scale || 1.0) * 0.7;
            drop.setScale(xpScale);
            drop.setAlpha(0.5);
            drop.setDepth(this._depthXP);
        } else {
            drop.setScale(blueprint.graphics?.scale || 1.0);
            drop.setAlpha(0.85);
            drop.setDepth(this._depthItems);
        }

        // Stamp loot data on sprite (reset pool-recycled state)
        drop.dropId = dropId;
        drop.blueprint = blueprint;
        drop.dropType = dropType;
        drop.value = blueprint.effect?.value || blueprint.stats?.value || 1;
        drop._magnetPull = false; // Reset magnet flag from previous pool life

        // Physics body config — persists across recycles but texture/size may change
        if (drop.body) {
            drop.body.setCollideWorldBounds(false);
            drop.body.setDrag(50);
            drop.body.setBounce(0.1);
            drop.body.setVelocity(0, 0);
        }

        // Track position for item overlap prevention
        this.recentDrops.push({ x: spawnX, y: spawnY, time: this.scene.time?.now || 0 });

        // Spawn VFX
        if (blueprint.vfx?.spawn && this.scene.vfxSystem) {
            this.scene.vfxSystem.play(blueprint.vfx.spawn, spawnX, spawnY);
        }

        // Gentle scale pulse tween — items only (XP orbs stay static for visual calm)
        if (dropType !== 'xp' && this.scene.tweens) {
            const itemScale = blueprint.graphics?.scale || 1.0;
            this.scene.tweens.add({
                targets: drop,
                scaleX: itemScale * 1.15,
                scaleY: itemScale * 1.15,
                duration: 600,
                yoyo: true,
                repeat: 2,
                ease: 'Sine.easeInOut'
            });
        }

        return drop;
    }

    // ==================== Enemy Death Drops ====================

    /**
     * Handle enemy death — roll spawn table lootTables + per-enemy blueprint drops.
     * XP orbs are handled separately by EnemyManager.onEnemyDeath → createXPOrbs.
     */
    handleEnemyDeath(enemy) {
        const enemyId = enemy.blueprintId || enemy.blueprint?.id || enemy.type;

        // Determine enemy category
        let category = 'normal';
        const bpType = enemy.blueprint?.type;
        if (bpType === 'boss') category = 'boss';
        else if (enemy.isElite || bpType === 'elite') category = 'elite';
        else if (enemy.isUnique || bpType === 'unique') category = 'elite';

        // Roll spawn table lootTable drops (max 1 special drop per normal kill)
        const lootTables = this.scene.spawnDirector?.currentTable?.lootTables;
        if (lootTables?.[category]) {
            const maxDrops = category === 'boss' ? 5 : category === 'elite' ? 2 : 1;
            let dropped = 0;
            for (const [itemId, chance] of Object.entries(lootTables[category])) {
                if (!this.blueprintLoader?.get(itemId)) continue;
                if (dropped >= maxDrops) break;
                if (Math.random() * 100 >= chance) continue;

                this.createDrop(enemy.x, enemy.y, itemId);
                getSession()?.log('loot', 'table_drop', { category, itemId, enemy: enemyId });
                dropped++;
            }
        }

        // Roll per-enemy blueprint drops
        if (enemy.blueprint?.drops?.length > 0) {
            for (const drop of enemy.blueprint.drops) {
                if (Math.random() < drop.chance) {
                    this.createDrop(enemy.x, enemy.y, drop.itemId);
                }
            }
        }
    }

    // ==================== Pickup ====================

    /**
     * Handle player collecting loot.
     * Called by physics.add.overlap (setupCollisions.js) when player overlaps loot sprite.
     */
    handlePickup(player, loot) {
        if (!loot.active || !player.active) return;

        const blueprint = loot.blueprint;
        const effectType = blueprint.effect?.type || loot.dropType;

        switch (effectType) {
            case 'xp': {
                const xpValue = loot.value || blueprint?.effect?.value || 1;
                this.scene.addXP?.(xpValue);
                // If this was the superorb, reset state so normal drops resume
                if (loot.dropId === '_superorb') this._onSuperorbPickup();
                break;
            }
            case 'health':
            case 'heal': {
                let healAmount = blueprint.effect?.value || blueprint.stats?.healAmount || 20;
                if (healAmount === 'full') healAmount = (player.maxHp || 100) - (player.hp || 0);
                player.heal?.(healAmount);
                break;
            }
            case 'instant_kill_all':
                this.scene.killAllEnemies?.();
                break;
            case 'vacuum_xp': {
                // Magnet pickup — vacuum ALL XP gems on field toward player
                // Gradual pull: tag items for magnet attraction in update loop
                const children = this.lootGroup?.getChildren();
                let xpCount = 0;
                if (children) {
                    for (const item of children) {
                        if (!item?.active || item.dropType !== 'xp') continue;
                        item._magnetPull = true; // Tag for gradual pull in update()
                        xpCount++;
                    }
                }
                this.scene.flashCamera?.();
                getSession()?.log('loot', 'magnet_used', { xpOnField: xpCount });
                break;
            }
            case 'buff': {
                const stat = blueprint.effect?.stat;
                const value = blueprint.effect?.value || 1.5;
                const duration = blueprint.effect?.duration || 10000;
                if (stat && player.addModifier) {
                    const modId = `buff_${stat}_${Date.now()}`;
                    player.addModifier({
                        id: modId,
                        path: stat === 'attackSpeed' ? 'attackIntervalMs' : stat,
                        type: 'mul',
                        value: stat === 'attackSpeed' ? -(1 - 1 / value) : value - 1
                    });
                    this.scene.time?.delayedCall(duration, () => player.removeModifierById?.(modId));
                }
                break;
            }
            case 'permanent_stat': {
                // Permanent stat boost — stackable, never expires
                const stat = blueprint.effect?.stat;
                const value = blueprint.effect?.value || 1;
                const modType = blueprint.effect?.modType || 'add';
                if (stat && player.addModifier) {
                    player.addModifier({
                        id: `perm_${stat}_${Date.now()}`,
                        path: stat,
                        type: modType,
                        value: value
                    });
                    getSession()?.log('loot', 'permanent_stat', { stat, value, modType });
                }
                break;
            }
            case 'chest': {
                if (!this._chestHandler) this._chestHandler = new ChestHandler(this.scene);
                this._chestHandler.open(player, blueprint, loot);
                break;
            }
            default:
                DebugLogger.warn('loot', `[Pickup] Unhandled effect type: ${effectType} for ${loot.dropId}`);
        }

        // VFX/SFX
        if (blueprint.vfx?.pickup && this.scene.vfxSystem) {
            this.scene.vfxSystem.play(blueprint.vfx.pickup, loot.x, loot.y);
        }
        if (blueprint.sfx?.pickup && this.scene.audioSystem) {
            this.scene.audioSystem.play(blueprint.sfx.pickup);
        }

        // Return to pool — Phaser native pattern
        this._returnToPool(loot);
    }

    /**
     * Auto-collect a loot item (used during level transition)
     */
    collectItem(loot) {
        if (!loot?.active) return;
        const player = this.scene?.player;
        if (player) this.handlePickup(player, loot);
    }

    // ==================== Update (magnet only) ====================

    /**
     * Per-frame update — XP magnet attraction only.
     * Pickup detection is handled natively by physics.add.overlap (setupCollisions.js).
     */
    update(time, delta) {
        if (!this.scene.player?.active) return;

        if (!this.lootGroup?.children) return;
        const children = this.lootGroup.getChildren();
        if (children.length === 0) return;

        // Periodic cap check + position cleanup
        if (time - this._lastCapCheck >= CAP_CHECK_INTERVAL) {
            this._lastCapCheck = time;
            this._cleanupOldPositions();
        }

        // Magnet attraction (passive XP magnet powerup + active magnet pickup)
        const player = this.scene.player;
        const magnetRadius = player._stats?.()?.xpMagnetRadius || player.baseStats?.xpMagnetRadius || 0;
        const magnetRadiusSq = magnetRadius > 0 ? magnetRadius * magnetRadius : 0;

        for (let i = children.length - 1; i >= 0; i--) {
            const loot = children[i];
            if (!loot.active || loot.dropType !== 'xp' || !loot.body) continue;

            const dx = player.x - loot.x;
            const dy = player.y - loot.y;
            const distSq = dx * dx + dy * dy;

            // Magnet pickup pull — gradual acceleration (beautiful vacuum effect)
            if (loot._magnetPull) {
                // Out-of-bounds cleanup — prevent ghost orbs from persisting indefinitely
                const wb = this.scene.physics?.world?.bounds;
                if (wb && (loot.x < wb.x - 200 || loot.x > wb.right + 200 ||
                           loot.y < wb.y - 200 || loot.y > wb.bottom + 200)) {
                    this._returnToPool(loot);
                    continue;
                }
                if (distSq > 1) {
                    // Accelerate toward player: starts slow, gets faster as orb approaches
                    const distance = Math.sqrt(distSq);
                    const accel = 150 + (400 * Math.max(0, 1 - distance / 500)); // 150-550 px/s
                    loot.body.setVelocity((dx / distance) * accel, (dy / distance) * accel);
                }
                continue; // Skip normal magnet — vacuum overrides
            }

            // Passive magnet powerup pull (proximity-based)
            if (magnetRadiusSq > 0 && distSq < magnetRadiusSq && distSq > 1) {
                const distance = Math.sqrt(distSq);
                const force = 0.3 + 0.7 * (1 - distance / magnetRadius);
                loot.body.setVelocity((dx / distance) * 300 * force, (dy / distance) * 300 * force);
            } else if (magnetRadiusSq > 0 && distSq >= magnetRadiusSq && loot.body.velocity.x !== 0) {
                loot.body.setVelocity(0, 0);
            }
        }
    }

    // ==================== Superorb (VS red gem mechanic) ====================

    /**
     * Check if XP field is over cap. If so, route new XP into superorb.
     * @returns {boolean} true if field is full (caller should use addToSuperorb instead of createDrop)
     */
    isFieldFull() {
        return this.lootGroup?.children ? this.lootGroup.countActive() >= FIELD_CAP : false;
    }

    /**
     * Add XP to the superorb. Creates it if it doesn't exist.
     * Superorb follows the player at a short distance and pulses to attract attention.
     */
    addToSuperorb(x, y, xpValue) {
        this._superorbXP += xpValue;

        if (!this._superorb || !this._superorb.active) {
            // Create superorb near the kill position
            this._superorb = this.createDrop(x, y, 'item.xp_diamond');
            if (this._superorb) {
                this._superorb.setTexture('item_xp_super');
                this._superorb.setScale(1.5);
                this._superorb.setAlpha(0.9);
                this._superorb.dropId = '_superorb';
                this._superorb.dropType = 'xp';
                this._superorb.value = this._superorbXP;
                // Pulse tween to attract attention
                if (this.scene?.tweens) {
                    this.scene.tweens.add({
                        targets: this._superorb,
                        scaleX: 1.8, scaleY: 1.8,
                        duration: 500, yoyo: true, repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            }
        }

        // Update value on existing superorb
        if (this._superorb?.active) {
            this._superorb.value = this._superorbXP;
        }
    }

    /**
     * Called when superorb is picked up — reset state so normal drops resume.
     */
    _onSuperorbPickup() {
        this._superorb = null;
        this._superorbXP = 0;
    }

    // ==================== Pool Helpers ====================

    /** Return a loot sprite to the Phaser pool — kill tweens, disable body, hide */
    _returnToPool(loot) {
        if (!loot.active) return;
        if (this.scene?.tweens) this.scene.tweens.killTweensOf(loot);
        loot.disableBody(true, true); // Phaser native: deactivate + hide, stays in group for reuse
    }

    // ==================== Position Helpers ====================

    /** Find a non-overlapping position. Items use spacing check, XP uses random scatter. */
    _findPosition(x, y, dropType) {
        const buf = this._posBuffer;
        if (dropType === 'xp') {
            buf.x = x + (Math.random() - 0.5) * 30;
            buf.y = y + (Math.random() - 0.5) * 30;
            return buf;
        }
        // Items: try to avoid overlap with recent drops (increasing radius per attempt)
        for (let attempt = 0; attempt < 8; attempt++) {
            const spread = 20 + attempt * 5;
            buf.x = x + (Math.random() - 0.5) * spread;
            buf.y = y + (Math.random() - 0.5) * spread;
            let overlaps = false;
            for (let i = 0; i < this.recentDrops.length; i++) {
                const d = this.recentDrops[i];
                const dx = buf.x - d.x, dy = buf.y - d.y;
                if (dx * dx + dy * dy < MIN_SPACING_SQ) { overlaps = true; break; }
            }
            if (!overlaps) return buf;
        }
        return buf;
    }

    /** In-place cleanup of old position records */
    _cleanupOldPositions() {
        const now = this.scene.time?.now || 0;
        if (!now) return;
        let write = 0;
        for (let read = 0; read < this.recentDrops.length; read++) {
            if (now - this.recentDrops[read].time < this._dropCleanupTime) {
                this.recentDrops[write++] = this.recentDrops[read];
            }
        }
        this.recentDrops.length = write;
    }

    // ==================== Lifecycle ====================

    /** Clear all drops and return pool to empty state */
    clearAll() {
        try {
            if (this.lootGroup?.children?.entries && this.scene?.tweens) {
                const children = this.lootGroup.getChildren();
                for (let i = 0; i < children.length; i++) {
                    this.scene.tweens.killTweensOf(children[i]);
                }
            }
            this.lootGroup?.clear?.(true, true);
        } catch (_) {
            // Group may already be destroyed during scene shutdown
        }
        if (this.recentDrops) this.recentDrops.length = 0;
        this._superorb = null;
        this._superorbXP = 0;
        this._chestHandler = null;
    }

    /** Get number of active loot items on the field */
    getActiveCount() {
        return this.lootGroup?.children ? this.lootGroup.countActive() : 0;
    }

    /** Shutdown — alias for clearAll (single cleanup path) */
    shutdown() {
        this.clearAll();
    }
}
