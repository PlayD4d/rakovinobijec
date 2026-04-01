import { DebugLogger } from '../../../debug/DebugLogger.js';
import { getSession } from '../../../debug/SessionLog.js';
import { registerDynamicOverlap } from '../../../../handlers/setupCollisions.js';

/**
 * DamageZoneAbilities - Handles chemo cloud and aura damage zones
 * Extracted from PowerUpAbilities for file size compliance (< 500 LOC)
 *
 * Both abilities share a similar pattern: invisible physics overlap zones
 * that follow the player and deal periodic damage to overlapping enemies.
 */
export class DamageZoneAbilities {
    constructor(scene, powerUpSystem) {
        this.scene = scene;
        this.powerUpSystem = powerUpSystem;

        // Aura state
        this._auraZone = null;
        this._auraOverlap = null;
        this._auraHitTimes = null;
        this._auraRadius = null;
    }

    // ──────────────────────────────────────────────
    //  Aura
    // ──────────────────────────────────────────────

    /**
     * Update aura damage using Phaser overlap zone (broadphase)
     */
    updateAura(player, delta, auraConfig) {
        const radius = auraConfig.computedRadius;
        const damage = auraConfig.computedDamage;

        // Recreate zone if radius changed (level-up)
        if (this._auraZone && this._auraRadius !== radius) {
            this.destroyAuraZone();
        }

        // Lazy-create physics zone on first call
        if (!this._auraZone && this.scene.physics) {
            this._auraRadius = radius;
            const enemiesGroup = this.scene.enemiesGroup || this.scene.enemies;
            if (enemiesGroup) {
                const ad = radius * 2;
                this._auraZone = this.scene.add.zone(player.x, player.y, ad, ad);
                this.scene.physics.add.existing(this._auraZone, false);
                this._auraZone.body.setCircle(radius);
                this._auraZone.body.setOffset(-radius + ad / 2, -radius + ad / 2);

                this._auraHitTimes = new WeakMap();
                this._auraOverlap = registerDynamicOverlap(
                    this.scene, this._auraZone, enemiesGroup,
                    (zone, enemy) => {
                        if (!enemy?.active || typeof enemy.takeDamage !== 'function') return;
                        const now = this.scene.time?.now || 0;
                        const lastHit = this._auraHitTimes.get(enemy) || 0;
                        if (now - lastHit < 100) return;
                        enemy.takeDamage({ amount: damage * 0.1, source: 'aura' });
                        this._auraHitTimes.set(enemy, now);
                    }
                );
            }
        }

        if (this._auraZone?.body) {
            this._auraZone.setPosition(player.x, player.y);
        }
    }

    /**
     * Clean up aura physics zone
     */
    destroyAuraZone() {
        if (this._auraOverlap) {
            this.scene?.physics?.world?.removeCollider(this._auraOverlap);
            this._auraOverlap = null;
        }
        if (this._auraZone) {
            if (this._auraZone.active) this._auraZone.destroy();
            this._auraZone = null;
        }
        this._auraRadius = null;
    }

    // ──────────────────────────────────────────────
    //  Immune Aura (Garlic-style: constant damage + knockback)
    // ──────────────────────────────────────────────

    /**
     * Start immune aura — constant damage zone with knockback
     */
    startImmuneAura(player, config) {
        this.destroyImmuneAura();

        const enemiesGroup = this.scene.enemiesGroup;
        if (!enemiesGroup || !this.scene.physics) return;

        this._immuneConfig = config;
        const radius = config.radius || 60;
        const d = radius * 2;

        // Invisible physics zone
        this._immuneZone = this.scene.add.zone(player.x, player.y, d, d);
        this.scene.physics.add.existing(this._immuneZone, false);
        this._immuneZone.body.setCircle(radius);
        this._immuneZone.body.setOffset(-radius + d / 2, -radius + d / 2);
        this._immuneZone.body.setImmovable(true);
        this._immuneZone.body.moves = false;
        this._immuneZone.setDepth(-1);

        this._immuneHitTimes = new WeakMap();
        this._immuneSlowState = new WeakMap(); // Track slow per-enemy: { origSpeed, timer }
        const tickMs = (config.tickRate || 0.5) * 1000;
        const slowFactor = config.slowFactor || 0.10;
        const slowDurationMs = tickMs * 2;

        // Overlap callback — shared for enemies and bosses
        const onOverlap = (zone, enemy) => {
            if (!enemy?.active || typeof enemy.takeDamage !== 'function') return;
            const now = this.scene.time?.now || 0;
            const lastHit = this._immuneHitTimes.get(enemy) || 0;
            if (now - lastHit < tickMs) return;

            enemy.takeDamage({ amount: config.damage, source: 'immune_aura' });
            this._immuneHitTimes.set(enemy, now);

            // Apply slow — tracked in WeakMap, no enemy mutation
            if (enemy.speed > 0 && enemy.body) {
                let slow = this._immuneSlowState.get(enemy);
                if (!slow) {
                    slow = { origSpeed: enemy.speed, timer: null };
                    this._immuneSlowState.set(enemy, slow);
                }
                enemy.speed = slow.origSpeed * (1 - slowFactor);

                if (slow.timer) slow.timer.destroy();
                slow.timer = this.scene.time.delayedCall(slowDurationMs, () => {
                    if (enemy?.active && slow.origSpeed) {
                        enemy.speed = slow.origSpeed;
                    }
                    this._immuneSlowState.delete(enemy);
                });
            }

            // Knockback — push enemy away from player
            if (enemy.body && config.knockback > 0) {
                const dx = enemy.x - player.x;
                const dy = enemy.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                enemy.body.setVelocity((dx / dist) * config.knockback, (dy / dist) * config.knockback);
            }

            if (Math.random() < 0.05) {
                getSession()?.log('combat', 'immune_aura_hit', { enemyId: enemy.blueprintId, damage: config.damage });
            }
        };

        // Register overlap with enemies
        this._immuneOverlap = registerDynamicOverlap(
            this.scene, this._immuneZone, enemiesGroup, onOverlap
        );

        // Register overlap with bosses (separate physics group)
        const bossGroup = this.scene.bossGroup;
        if (bossGroup) {
            this._immuneBossOverlap = registerDynamicOverlap(
                this.scene, this._immuneZone, bossGroup, onOverlap
            );
        }

        // VFX aura ring
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.attachEffect(player, 'immune_aura', {
                radius, color: 0x44ff44, alpha: 0.15
            });
        }
    }

    /**
     * Update immune aura position (follows player)
     */
    updateImmuneAura(player) {
        if (this._immuneZone?.body && player?.active) {
            this._immuneZone.setPosition(player.x, player.y);
        }
    }

    destroyImmuneAura() {
        if (this._immuneOverlap) {
            this.scene?.physics?.world?.removeCollider(this._immuneOverlap);
            this._immuneOverlap = null;
        }
        if (this._immuneBossOverlap) {
            this.scene?.physics?.world?.removeCollider(this._immuneBossOverlap);
            this._immuneBossOverlap = null;
        }
        if (this._immuneZone) {
            if (this._immuneZone.active) this._immuneZone.destroy();
            this._immuneZone = null;
        }
        this._immuneHitTimes = null;
        this._immuneSlowState = null;
        this._immuneConfig = null;
    }

    /**
     * Cleanup all damage zone resources
     */
    destroy() {
        this.destroyAuraZone();
        this.destroyImmuneAura();
        this.scene = null;
        this.powerUpSystem = null;
    }
}
