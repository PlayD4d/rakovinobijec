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

        // Chemo cloud state
        this._chemoZone = null;
        this._chemoOverlap = null;
        this._chemoHitTimes = null;
        this._chemoPlayer = null;

        // Aura state
        this._auraZone = null;
        this._auraOverlap = null;
        this._auraHitTimes = null;
        this._auraRadius = null;
    }

    // ──────────────────────────────────────────────
    //  Chemo Cloud
    // ──────────────────────────────────────────────

    /**
     * Start chemo cloud periodic damage zone around player
     */
    startChemoCloud(player, config) {
        // Clean up old cloud if exists
        this.destroyChemoCloud();

        const enemiesGroup = this.scene.enemiesGroup || this.scene.enemies;
        if (!enemiesGroup || !this.scene.physics) return;

        const radius = config.chemoCloudRadius || 35;
        const damage = config.chemoCloudDamage || 4;

        // Invisible physics zone for broadphase
        const d = radius * 2;
        this._chemoZone = this.scene.add.zone(player.x, player.y, d, d);
        this.scene.physics.add.existing(this._chemoZone, false);
        this._chemoZone.body.setCircle(radius);
        this._chemoZone.body.setOffset(-radius + d / 2, -radius + d / 2);

        // Overlap — applies damage per-enemy, throttled to 2 ticks/sec per enemy
        this._chemoHitTimes = new WeakMap();
        this._chemoOverlap = registerDynamicOverlap(
            this.scene, this._chemoZone, enemiesGroup,
            (zone, enemy) => {
                const now = this.scene.time?.now || 0;
                if (!enemy?.active || typeof enemy.takeDamage !== 'function') {
                    if (enemy) this._chemoHitTimes.delete(enemy);
                    return;
                }
                const lastHit = this._chemoHitTimes.get(enemy) || 0;
                if (now - lastHit < 500) return; // 2 ticks/sec per enemy
                if (Math.random() < 0.1) getSession()?.log('combat', 'chemo_cloud_hit', { enemyId: enemy.blueprintId, damage });
                enemy.takeDamage({ amount: damage, source: 'chemo_cloud' });
                this._chemoHitTimes.set(enemy, now);
            }
        );

        // Store for cleanup and position update
        // Also overlap with bosses
        const bossGroup = this.scene.bossGroup;
        if (bossGroup) {
            this._chemoBossOverlap = registerDynamicOverlap(
                this.scene, this._chemoZone, bossGroup,
                (zone, enemy) => {
                    const now = this.scene.time?.now || 0;
                    if (!enemy?.active || typeof enemy.takeDamage !== 'function') return;
                    const lastHit = this._chemoHitTimes.get(enemy) || 0;
                    if (now - lastHit < 500) return;
                    this._chemoHitTimes.set(enemy, now);
                    enemy.takeDamage(config.chemoCloudDamage || 8);
                }
            );
        }

        this._chemoPlayer = player;
    }

    /**
     * Destroy chemo cloud physics zone and overlap
     */
    destroyChemoCloud() {
        if (this._chemoBossOverlap) {
            this.scene?.physics?.world?.removeCollider(this._chemoBossOverlap);
            this._chemoBossOverlap = null;
        }
        if (this._chemoOverlap) {
            this.scene?.physics?.world?.removeCollider(this._chemoOverlap);
            this._chemoOverlap = null;
        }
        if (this._chemoZone) {
            if (this._chemoZone.active) this._chemoZone.destroy();
            this._chemoZone = null;
        }
        this._chemoPlayer = null;
    }

    /**
     * Update chemo cloud position to follow player (called each frame)
     */
    updateChemoCloud(player) {
        if (this._chemoZone?.body && player?.active) {
            this._chemoZone.setPosition(player.x, player.y);
        }
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
        const tickMs = (config.tickRate || 0.5) * 1000;

        // Slow config: 10% slow per application, stacks tracked per enemy, auto-recovers
        const slowFactor = config.slowFactor || 0.10;
        const slowDurationMs = tickMs * 2; // Slow lasts 2 tick intervals — fades if enemy leaves aura

        // Overlap callback — shared for enemies and bosses
        const onOverlap = (zone, enemy) => {
            if (!enemy?.active || typeof enemy.takeDamage !== 'function') return;
            const now = this.scene.time?.now || 0;
            const lastHit = this._immuneHitTimes.get(enemy) || 0;
            if (now - lastHit < tickMs) return;

            enemy.takeDamage({ amount: config.damage, source: 'immune_aura' });
            this._immuneHitTimes.set(enemy, now);

            // Apply slow — store original speed on first application, restore on timeout
            if (enemy.speed > 0 && enemy.body) {
                if (!enemy._auraSlowOrigSpeed) {
                    enemy._auraSlowOrigSpeed = enemy.speed;
                }
                enemy.speed = enemy._auraSlowOrigSpeed * (1 - slowFactor);

                // Clear previous recovery timer, set new one
                if (enemy._auraSlowTimer) enemy._auraSlowTimer.destroy();
                enemy._auraSlowTimer = this.scene.time.delayedCall(slowDurationMs, () => {
                    if (enemy?.active && enemy._auraSlowOrigSpeed) {
                        enemy.speed = enemy._auraSlowOrigSpeed;
                        enemy._auraSlowOrigSpeed = null;
                        enemy._auraSlowTimer = null;
                    }
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
        this._immuneConfig = null;
    }

    /**
     * Cleanup all damage zone resources
     */
    destroy() {
        this.destroyAuraZone();
        this.destroyChemoCloud();
        this.destroyImmuneAura();
        this.scene = null;
        this.powerUpSystem = null;
    }
}
