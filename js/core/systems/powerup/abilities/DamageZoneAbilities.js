import { DebugLogger } from '../../../debug/DebugLogger.js';

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
        this._chemoOverlap = this.scene.physics.add.overlap(
            this._chemoZone,
            enemiesGroup,
            (zone, enemy) => {
                const now = this.scene.time?.now || 0;
                if (!enemy?.active || typeof enemy.takeDamage !== 'function') return;
                const lastHit = this._chemoHitTimes.get(enemy) || 0;
                if (now - lastHit < 500) return; // 2 ticks/sec per enemy
                enemy.takeDamage(damage, 'chemo_cloud');
                this._chemoHitTimes.set(enemy, now);
            }
        );

        // Store for cleanup and position update
        this._chemoPlayer = player;
    }

    /**
     * Destroy chemo cloud physics zone and overlap
     */
    destroyChemoCloud() {
        if (this._chemoOverlap) {
            this.scene.physics?.world?.removeCollider(this._chemoOverlap);
            this._chemoOverlap = null;
        }
        if (this._chemoZone) {
            this._chemoZone.destroy();
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
    updateAura(player, delta) {
        if (!player.aura) {
            this.destroyAuraZone();
            return;
        }

        // Recreate zone if radius changed (level-up)
        if (this._auraZone && this._auraRadius !== player.auraRadius) {
            this.destroyAuraZone();
        }

        // Lazy-create physics zone on first call
        if (!this._auraZone && this.scene.physics) {
            this._auraRadius = player.auraRadius;
            const enemiesGroup = this.scene.enemiesGroup || this.scene.enemies;
            if (enemiesGroup) {
                const ad = player.auraRadius * 2;
                this._auraZone = this.scene.add.zone(player.x, player.y, ad, ad);
                this.scene.physics.add.existing(this._auraZone, false);
                this._auraZone.body.setCircle(player.auraRadius);
                this._auraZone.body.setOffset(-player.auraRadius + ad / 2, -player.auraRadius + ad / 2);

                // Throttle aura damage per-enemy (same pattern as chemo cloud)
                this._auraHitTimes = new WeakMap();
                this._auraOverlap = this.scene.physics.add.overlap(
                    this._auraZone,
                    enemiesGroup,
                    (zone, enemy) => {
                        if (!enemy?.active || typeof enemy.takeDamage !== 'function') return;
                        const now = this.scene.time?.now || 0;
                        const lastHit = this._auraHitTimes.get(enemy) || 0;
                        if (now - lastHit < 100) return; // ~10 ticks/sec per enemy
                        const currentDmg = (player.auraDamage || 0) * 0.1;
                        enemy.takeDamage(currentDmg, 'aura');
                        this._auraHitTimes.set(enemy, now);
                    }
                );
            }
        }

        // Follow player
        if (this._auraZone?.body) {
            this._auraZone.setPosition(player.x, player.y);
        }
    }

    /**
     * Clean up aura physics zone
     */
    destroyAuraZone() {
        if (this._auraOverlap) {
            this.scene.physics?.world?.removeCollider(this._auraOverlap);
            this._auraOverlap = null;
        }
        if (this._auraZone) {
            this._auraZone.destroy();
            this._auraZone = null;
        }
        this._auraRadius = null;
    }

    /**
     * Cleanup all damage zone resources
     */
    destroy() {
        this.destroyAuraZone();
        this.destroyChemoCloud();
        this.scene = null;
        this.powerUpSystem = null;
    }
}
