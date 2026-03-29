/**
 * SimpleLootSystem - Phaser-native loot pooling system
 * PR7 compliant - vše řízeno blueprinty
 *
 * Uses Phaser Group pooling: get() reuses inactive sprites, disableBody() returns to pool.
 * Pickup detection via physics.add.overlap (registered in setupCollisions.js).
 * XP magnet attraction in update() (no Phaser native equivalent).
 */

import { DebugLogger } from '../debug/DebugLogger.js';
import { getSession } from '../debug/SessionLog.js';
import { generateLootTextures } from './loot/LootTextureGenerator.js';

const POOL_MAX_SIZE = 120;
const DEPTH_XP = 500;
const DEPTH_ITEMS = 600;
const PICKUP_RADIUS_SQ = 625; // 25²
const MERGE_RADIUS_SQ = 3600; // 60² — wider merge radius to catch scattered orbs
const MERGE_INTERVAL = 1500; // ms — merge more frequently
const FIELD_CAP = 80; // Max active loot on field — prevents visual clutter
const MIN_SPACING_SQ = 225; // 15²

export class SimpleLootSystem {
    constructor(scene) {
        this.scene = scene;
        this.blueprintLoader = scene.blueprintLoader;

        // Phaser physics group with maxSize — native pool: get() reuses inactive, disableBody() returns
        this.lootGroup = scene.physics.add.group({ maxSize: POOL_MAX_SIZE });

        // Position overlap prevention for item drops
        this.recentDrops = [];
        this._dropCleanupTime = 5000;

        // Merge/cap timing
        this._lastMergeCheck = 0;

        // Pre-allocated position buffer for findNonOverlappingPosition
        this._posBuffer = { x: 0, y: 0 };

        // Generate item textures on initialization
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

        // Find non-overlapping position
        const pos = this._findPosition(x, y, dropType);

        // Phaser-native pool: get() returns first inactive member or creates new if pool allows
        const drop = this.lootGroup.get(pos.x, pos.y, textureKey);
        if (!drop) {
            // Pool exhausted (maxSize reached) — skip silently
            return null;
        }

        // Configure the sprite (works for both new and recycled)
        drop.setActive(true).setVisible(true);
        drop.enableBody(true, pos.x, pos.y, true, true);

        const scale = blueprint.graphics?.scale || 1.0;
        drop.setScale(scale);
        drop.setTexture(textureKey);
        drop.setDepth(dropType === 'xp' ? DEPTH_XP : DEPTH_ITEMS);

        // Stamp loot data on sprite
        drop.dropId = dropId;
        drop.blueprint = blueprint;
        drop.dropType = dropType;
        drop.value = blueprint.effect?.value || blueprint.stats?.value || 1;

        // Physics body config — persists across recycles but texture/size may change
        if (drop.body) {
            drop.body.setCollideWorldBounds(false);
            drop.body.setDrag(50);
            drop.body.setBounce(0.1);
            drop.body.setVelocity(0, 0);
        }

        // Track position for item overlap prevention
        this.recentDrops.push({ x: pos.x, y: pos.y, time: this.scene.time?.now || 0 });
        this._cleanupOldPositions();

        // Spawn VFX
        if (blueprint.vfx?.spawn && this.scene.vfxSystem) {
            this.scene.vfxSystem.play(blueprint.vfx.spawn, pos.x, pos.y);
        }

        // Gentle scale pulse tween
        if (this.scene.tweens) {
            this.scene.tweens.add({
                targets: drop,
                scaleX: scale * 1.15,
                scaleY: scale * 1.15,
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

        // Roll spawn table lootTable drops
        const lootTables = this.scene.spawnDirector?.currentTable?.lootTables;
        if (lootTables?.[category]) {
            for (const [itemRef, chance] of Object.entries(lootTables[category])) {
                if (itemRef.startsWith('drop.xp')) continue; // XP handled separately
                if (Math.random() * 100 >= chance) continue;

                const itemId = this._resolveItemId(itemRef);
                if (!itemId) continue;

                this.createDrop(enemy.x, enemy.y, itemId);
                getSession()?.log('loot', 'table_drop', { category, itemRef, itemId, enemy: enemyId });
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
        if (!loot.active) return;

        const blueprint = loot.blueprint;
        const effectType = blueprint.effect?.type || loot.dropType;

        switch (effectType) {
            case 'xp': {
                const xpValue = blueprint.effect?.value || loot.value || 1;
                this.scene.addXP?.(xpValue);
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
                this.scene.enemyManager?.killAll();
                this.scene.flashCamera?.();
                break;
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
            case 'research': {
                const points = blueprint.effect?.value || 1;
                if (this.scene.gameStats) this.scene.gameStats.score += points * 100;
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

        const children = this.lootGroup.getChildren();
        if (children.length === 0) return;

        // Periodic merge + cap enforcement (every 2s)
        if (time - this._lastMergeCheck >= MERGE_INTERVAL) {
            this._lastMergeCheck = time;
            this._mergeNearbyXPOrbs(children);
            this._enforceFieldCap(children);
        }

        // Magnet attraction — no Phaser native equivalent
        const player = this.scene.player;
        const magnetRadius = player._stats?.()?.xpMagnetRadius || player.baseStats?.xpMagnetRadius || 0;
        if (magnetRadius <= 0) return;

        const magnetRadiusSq = magnetRadius * magnetRadius;
        for (let i = children.length - 1; i >= 0; i--) {
            const loot = children[i];
            if (!loot.active || loot.dropType !== 'xp' || !loot.body) continue;

            const dx = player.x - loot.x;
            const dy = player.y - loot.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < magnetRadiusSq && distSq > 1) {
                const distance = Math.sqrt(distSq);
                const force = 0.3 + 0.7 * (1 - distance / magnetRadius);
                const speed = 300 * force;
                loot.body.setVelocity((dx / distance) * speed, (dy / distance) * speed);
            } else if (distSq >= magnetRadiusSq && loot.body.velocity.x !== 0) {
                loot.body.setVelocity(0, 0);
            }
        }
    }

    // ==================== Merge & Cap ====================

    /** Merge nearby XP orbs: 3 small → 1 medium, 2 medium → 1 large */
    _mergeNearbyXPOrbs(children) {
        const activeCount = this.lootGroup.countActive();
        if (activeCount < 8) return;

        const smalls = [];
        const mediums = [];
        for (let i = 0; i < children.length; i++) {
            const loot = children[i];
            if (!loot.active || loot.dropType !== 'xp') continue;
            if (loot.dropId === 'item.xp_small') smalls.push(loot);
            else if (loot.dropId === 'item.xp_medium') mediums.push(loot);
        }

        let merged = 0;
        // Scale merge limit with clutter — more aggressive when field is full
        const maxMerges = activeCount > FIELD_CAP * 0.7 ? 20 : 10;

        // 3 smalls → 1 medium (was 5 — faster consolidation)
        for (let i = 0; i < smalls.length && merged < maxMerges; i++) {
            const anchor = smalls[i];
            if (!anchor.active) continue;
            const cluster = [anchor];
            for (let j = i + 1; j < smalls.length && cluster.length < 3; j++) {
                const other = smalls[j];
                if (!other.active) continue;
                const dx = anchor.x - other.x;
                const dy = anchor.y - other.y;
                if (dx * dx + dy * dy < MERGE_RADIUS_SQ) cluster.push(other);
            }
            if (cluster.length >= 3) {
                const cx = anchor.x, cy = anchor.y;
                for (let k = 0; k < cluster.length; k++) this._returnToPool(cluster[k]);
                this.createDrop(cx, cy, 'item.xp_medium');
                merged++;
            }
        }

        // 2 mediums → 1 large
        for (let i = 0; i < mediums.length && merged < maxMerges + 5; i++) {
            const anchor = mediums[i];
            if (!anchor.active) continue;
            for (let j = i + 1; j < mediums.length; j++) {
                const other = mediums[j];
                if (!other.active) continue;
                const dx = anchor.x - other.x;
                const dy = anchor.y - other.y;
                if (dx * dx + dy * dy < MERGE_RADIUS_SQ) {
                    const cx = anchor.x, cy = anchor.y;
                    this._returnToPool(anchor);
                    this._returnToPool(other);
                    this.createDrop(cx, cy, 'item.xp_large');
                    merged++;
                    break;
                }
            }
        }

        if (merged > 0) {
            getSession()?.log('loot', 'xp_merged', { merged, remaining: this.lootGroup.countActive() });
        }
    }

    /** Remove oldest XP orbs if over field cap — smalls first, then mediums */
    _enforceFieldCap(children) {
        const activeCount = this.lootGroup.countActive();
        if (activeCount <= FIELD_CAP) return;

        let excess = activeCount - FIELD_CAP;

        // Pass 1: remove smalls (lowest value)
        for (let i = 0; i < children.length && excess > 0; i++) {
            const loot = children[i];
            if (loot.active && loot.dropId === 'item.xp_small') {
                this._returnToPool(loot);
                excess--;
            }
        }
        // Pass 2: remove mediums if still over cap
        for (let i = 0; i < children.length && excess > 0; i++) {
            const loot = children[i];
            if (loot.active && loot.dropId === 'item.xp_medium') {
                this._returnToPool(loot);
                excess--;
            }
        }

        if (activeCount - this.lootGroup.countActive() > 0) {
            getSession()?.log('loot', 'field_cap_trim', { removed: activeCount - this.lootGroup.countActive(), remaining: this.lootGroup.countActive() });
        }
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

        if (dropType !== 'xp') {
            // Items: try to avoid overlap with recent drops
            for (let attempt = 0; attempt < 10; attempt++) {
                buf.x = x + (Math.random() - 0.5) * 20;
                buf.y = y + (Math.random() - 0.5) * 20;
                let overlaps = false;
                for (let i = 0; i < this.recentDrops.length; i++) {
                    const d = this.recentDrops[i];
                    const dx = buf.x - d.x, dy = buf.y - d.y;
                    if (dx * dx + dy * dy < MIN_SPACING_SQ) { overlaps = true; break; }
                }
                if (!overlaps) return buf;
                // Spiral fallback
                const angle = (attempt / 10) * Math.PI * 2;
                buf.x = x + Math.cos(angle) * 20;
                buf.y = y + Math.sin(angle) * 20;
            }
        } else {
            buf.x = x + (Math.random() - 0.5) * 30;
            buf.y = y + (Math.random() - 0.5) * 30;
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

    // ==================== Item ID Resolution ====================

    /** Resolve legacy 'drop.*' refs to 'item.*' blueprint IDs */
    _resolveItemId(ref) {
        if (this.blueprintLoader?.get(ref)) return ref;

        const LEGACY_MAP = {
            'drop.leukocyte_pack': 'item.health_small',
            'drop.protein_cache': 'item.protein_cache',
            'drop.metotrexat': 'item.metotrexat',
            'drop.adrenal_surge': 'item.energy_cell',
        };
        const mapped = LEGACY_MAP[ref];
        if (mapped && this.blueprintLoader?.get(mapped)) return mapped;

        if (ref.startsWith('drop.')) {
            const itemId = 'item.' + ref.replace('drop.', '').replace(/\./g, '_');
            if (this.blueprintLoader?.get(itemId)) return itemId;
        }
        return null;
    }

    // ==================== Lifecycle ====================

    /** Clear all drops and return pool to empty state */
    clearAll() {
        if (this.scene?.tweens) {
            const children = this.lootGroup.getChildren();
            for (let i = 0; i < children.length; i++) {
                this.scene.tweens.killTweensOf(children[i]);
            }
        }
        this.lootGroup.clear(true, true);
        this.recentDrops.length = 0;
    }

    /** Shutdown — alias for clearAll (single cleanup path) */
    shutdown() {
        this.clearAll();
    }
}
