import { DebugLogger } from '../../debug/DebugLogger.js';
import { getSession } from '../../debug/SessionLog.js';
import { ChainLightningAbility } from './abilities/ChainLightningAbility.js';
import { DamageZoneAbilities } from './abilities/DamageZoneAbilities.js';
import { ShieldRegeneration } from './abilities/ShieldRegeneration.js';

/**
 * PowerUpAbilities - Handles special abilities from power-ups
 * PR7 Compliant - All abilities driven by blueprint configuration
 *
 * Thin Composer: delegates to extracted ability modules:
 *  - ChainLightningAbility (chain lightning attack + timers)
 *  - DamageZoneAbilities   (chemo cloud + aura damage zones)
 *  - ShieldRegeneration    (shield HP regen + damage absorption)
 */

export class PowerUpAbilities {
    constructor(scene, powerUpSystem) {
        this.scene = scene;
        this.powerUpSystem = powerUpSystem;

        // Active abilities that need per-frame updates
        this.activeAbilities = new Map(); // abilityType -> { config, updateFn }

        // Centralized ability state — replaces scattered player flags
        this._abilityConfigs = new Map(); // abilityType -> config

        // Extracted ability modules
        this._chainLightning = new ChainLightningAbility(scene, powerUpSystem);
        this._damageZones = new DamageZoneAbilities(scene, powerUpSystem);
        this._shieldRegen = new ShieldRegeneration(scene, powerUpSystem);
    }

    /**
     * Process abilities from blueprint
     */
    processAbilities(blueprint, level) {
        if (!blueprint.ability?.type) return [];

        const ability = blueprint.ability;
        const abilities = [];

        // Create ability configuration based on type and level
        const config = {
            type: ability.type,
            level: level,
            enabled: true
        };

        // Extract level-based values
        switch (ability.type) {
            case 'radiotherapy':
                config.beamCount = ability.beamsPerLevel?.[level - 1] || 1;
                config.range = ability.rangePerLevel?.[level - 1] || 80;
                config.damage = ability.damagePerLevel?.[level - 1] || 5;
                config.rotationSpeed = ability.rotationSpeedPerLevel?.[level - 1] || ability.rotationSpeed || 2;
                config.beamWidth = ability.beamWidthPerLevel?.[level - 1] || ability.beamWidth || 0.45;
                config.tickRate = ability.tickRate || 0.1;
                config.beamColor = ability.beamColor || 0x00ff00;
                config.beamAlpha = ability.beamAlpha || 0.7;
                break;

            case 'flamethrower':
                config.damage = ability.damagePerLevel?.[level - 1] || 10;
                config.intervalMs = ability.intervalMsPerLevel?.[level - 1] || 800;
                config.pierceCount = ability.pierceCountPerLevel?.[level - 1] || 2;
                config.speed = ability.speedPerLevel?.[level - 1] || 220;
                break;

            case 'shield':
                config.shieldHP = (ability.baseShieldHP || 50) * level;
                config.rechargeTime = ability.rechargeTimePerLevel?.[level - 1] || 10000;
                DebugLogger.info('powerup', `[PowerUpAbilities] Shield config: HP=${config.shieldHP}, recharge=${config.rechargeTime}ms`);
                break;

            case 'chain_lightning':
                // Damage scales: baseDamage + damagePerLevel * level
                config.damage = (ability.baseDamage || 15) + (ability.damagePerLevel || 10) * level;
                config.range = ability.baseRange || 200;
                config.jumpRange = ability.jumpRange || 80;
                config.jumps = level;
                config.interval = ability.interval || 2000;
                break;

            case 'aura':
                config.damage = ability.baseDamagePerTick || 2;
                config.radius = ability.baseRadius || 100;
                config.radiusPerLevel = ability.radiusPerLevel || 10;
                config.tickRate = ability.tickRate || 0.1;
                break;

            case 'chemo_aura':
                // Chemo reservoir = explosive projectiles only (cloud removed → use immune_aura instead)
                config.enableExplosions = ability.enableExplosions || false;
                break;

            case 'immune_aura':
                config.damage = (ability.damagePerLevel || [5])[level - 1] || 5;
                config.radius = (ability.radiusPerLevel || [60])[level - 1] || 60;
                config.knockback = (ability.knockbackPerLevel || [100])[level - 1] || 100;
                config.slowFactor = ability.slowFactor || 0.10;
                config.tickRate = ability.tickRate || 0.5;
                break;

            case 'homing_shot':
                config.speedBonus = (ability.speedBonusPerLevel || [20])[level - 1] || 20;
                config.rangeBonus = (ability.rangeBonusPerLevel || [50])[level - 1] || 50;
                break;

            case 'piercing':
                config.maxPierces = ability.maxPierces?.[level - 1] || 1;
                config.damageReduction = ability.damageReduction || 0.1;
                break;

            default:
                DebugLogger.warn('powerup', `[PowerUpAbilities] Unknown ability type: ${ability.type}`);
                return [];
        }

        abilities.push(config);
        DebugLogger.info('powerup', `[PowerUpAbilities] Ability: ${config.type} level ${config.level}`, config);

        return abilities;
    }

    /**
     * Apply abilities to player
     */
    applyToPlayer(player, abilities) {
        for (const ability of abilities) {
            this._applyAbility(player, ability);
        }
    }

    /**
     * Apply specific ability to player
     */
    _applyAbility(player, config) {
        getSession()?.log('powerup', 'ability_applied', { abilityType: config.type, level: config.level });
        const vfxManager = this.powerUpSystem.vfxManager;

        // Track centrally — enables hasAbility() / getAbilityConfig() queries
        this._abilityConfigs.set(config.type, config);

        switch (config.type) {
            case 'radiotherapy':
                DebugLogger.info('powerup', `[PowerUpAbilities] Applying radiotherapy config:`, config);
                if (vfxManager) {
                    vfxManager.attachEffect(player, 'radiotherapy', config);
                } else {
                    DebugLogger.warn('powerup', '[PowerUpAbilities] Radiotherapy: vfxManager not available');
                }
                break;

            case 'flamethrower': {
                // Oxidative Burst (Fire Wand style) — arc of fire projectiles at random enemy
                const burstDamage = config.damage || 10;
                const burstInterval = config.intervalMs || 800;
                const burstCount = config.pierceCount || 2; // reuse as projectile count in arc
                const burstSpeed = config.speed || 250;
                const arcSpread = 0.35; // ~20° total arc

                // Remove old timer on upgrade
                if (this._oxidativeBurstTimer) {
                    this._oxidativeBurstTimer.remove();
                    this._oxidativeBurstTimer = null;
                }

                this._oxidativeBurstTimer = this.scene.time.addEvent({
                    delay: burstInterval,
                    loop: true,
                    callback: () => {
                        const p = this.scene?.player;
                        if (!p?.active) return;
                        const enemies = this.scene.enemiesGroup?.getChildren();
                        if (!enemies?.length) return;
                        const active = [];
                        for (let i = 0; i < enemies.length; i++) {
                            if (enemies[i]?.active) active.push(enemies[i]);
                        }
                        if (active.length === 0) return;
                        const target = active[Math.floor(Math.random() * active.length)];

                        const baseAngle = Math.atan2(target.y - p.y, target.x - p.x);
                        const ps = this.scene.projectileSystem;
                        if (!ps) return;

                        // Fire arc of fireballs centered on target direction
                        for (let i = 0; i < burstCount; i++) {
                            const offset = burstCount > 1
                                ? (i - (burstCount - 1) / 2) * (arcSpread / Math.max(1, burstCount - 1))
                                : 0;
                            const angle = baseAngle + offset;
                            ps.firePlayer(p.x, p.y, Math.cos(angle), Math.sin(angle), {
                                speedMul: burstSpeed / (ps.config.speed || 200),
                                rangeMul: 1.5,
                                damageMul: burstDamage / (ps.config.damage || 10),
                                tint: 0xff6600,
                                projectileId: 'projectile.player_basic'
                            });
                        }
                    }
                });

                DebugLogger.info('powerup', `[PowerUpAbilities] Oxidative Burst: ${burstCount}x ${burstDamage}dmg arc, ${burstInterval}ms`);
                break;
            }

            case 'shield':
                player.shieldActive = true;
                player.shieldLevel = config.level;
                // Preserve remaining shield HP ratio on level-up (don't restore full)
                const oldMax = player.maxShieldHP || 0;
                const hpRatio = oldMax > 0 ? Math.min(1, player.shieldHP / oldMax) : 1;
                player.maxShieldHP = config.shieldHP;
                player.shieldHP = Math.round(config.shieldHP * hpRatio);
                player.shieldRechargeTime = config.rechargeTime;
                // Only reset recharge state if shield has HP; if depleted, keep/restart recharge
                if (player.shieldHP > 0) {
                    player.shieldRecharging = false;
                    player.shieldRechargeAt = 0;
                } else if (!player.shieldRecharging) {
                    player.shieldRecharging = true;
                    player.shieldRechargeAt = (this.scene?.time?.now || 0) + config.rechargeTime;
                }

                DebugLogger.info('powerup', `[PowerUpAbilities] SHIELD ACTIVATED - Level: ${config.level}, HP: ${config.shieldHP}, Recharge: ${config.rechargeTime}ms`);

                // Create/update shield physics hitbox for bullet interception
                if (this._shieldRegen) {
                    this._shieldRegen.destroyShieldHitbox(player);
                    this._shieldRegen.createShieldHitbox(player);
                }

                if (vfxManager) {
                    DebugLogger.info('powerup', `[PowerUpAbilities] Attaching shield VFX to player`);
                    vfxManager.attachEffect(player, 'shield', {
                        radius: 28,
                        color: 0x00ccff,
                        alpha: 0.3
                    });
                } else if (this.scene.vfxSystem) {
                    DebugLogger.info('powerup', `[PowerUpAbilities] Using vfxSystem for shield effect`);
                    this.scene.vfxSystem.play('vfx.shield.active', player.x, player.y);
                } else {
                    DebugLogger.warn('powerup', `[PowerUpAbilities] No VFX system available for shield effect`);
                }
                break;

            case 'xp_magnet':
                DebugLogger.info('powerup', `[PowerUpAbilities] XP magnet handled via modifiers (level ${config.level})`);
                break;

            case 'chain_lightning':
                this.activeAbilities.set('chain_lightning', {
                    config,
                    nextTriggerAt: 0,
                    updateFn: (time, delta) => {
                        const ability = this.activeAbilities.get('chain_lightning');
                        this._chainLightning.update(time, delta, config, ability);
                    }
                });
                break;

            case 'aura': {
                const computedRadius = config.radius + (config.radiusPerLevel * (config.level - 1));
                // Play/update aura VFX on every level (not just first activation)
                if (this.scene.vfxSystem) {
                    this.scene.vfxSystem.play('vfx.aura.damage', player.x, player.y, {
                        radius: computedRadius,
                        color: 0x00ff00,
                        alpha: 0.1,
                        persistent: true
                    });
                }
                // Store computed values for DamageZoneAbilities
                config.computedDamage = config.damage * config.level;
                config.computedRadius = computedRadius;
                break;
            }

            case 'chemo_aura':
                // Explosive projectiles enabled via config.enableExplosions (processed by onBulletHit)
                DebugLogger.info('powerup', `[PowerUpAbilities] Chemo reservoir — explosive projectiles enabled`);
                break;

            case 'immune_aura':
                this._damageZones.startImmuneAura(player, config);
                DebugLogger.info('powerup', `[PowerUpAbilities] Immune Aura activated — dmg=${config.damage}, radius=${config.radius}, knockback=${config.knockback}`);
                break;

            case 'homing_shot':
                player.homingLevel = config.level;
                player.homingSpeedBonus = (config.speedBonusPerLevel || 20) * config.level;
                player.homingRangeBonus = (config.rangeBonusPerLevel || 50) * config.level;
                DebugLogger.info('powerup', `[PowerUpAbilities] Homing shot level ${config.level} — speed+${player.homingSpeedBonus}, range+${player.homingRangeBonus}`);
                break;

            case 'piercing':
                player.piercingLevel = config.level;
                player.piercingMaxPierces = config.maxPierces;
                player.piercingDamageReduction = config.damageReduction;
                DebugLogger.info('powerup', `[PowerUpAbilities] Activated piercing: ${config.maxPierces} pierces, ${(config.damageReduction * 100)}% damage reduction`);
                break;

            case 'passive_regen': {
                // HP regeneration — timer ticks based on level scaling
                const hpPerTick = config.hpPerTick || [1, 2, 3, 4, 5][config.level - 1] || 1;
                const tickMs = config.tickMs || [3000, 3000, 2500, 2000, 1500][config.level - 1] || 3000;

                // Remove old regen timer if upgrading
                if (this._regenTimer) { this._regenTimer.remove(); this._regenTimer = null; }

                this._regenTimer = this.scene.time.addEvent({
                    delay: tickMs,
                    loop: true,
                    callback: () => {
                        const p = this.scene?.player;
                        if (!p?.active || p.hp >= p.maxHp) return;
                        p.heal(hpPerTick);
                    }
                });
                DebugLogger.info('powerup', `[PowerUpAbilities] Passive regen: +${hpPerTick} HP every ${tickMs}ms`);
                break;
            }

            case 'slow_aura': {
                // Store config for per-frame enemy slow application in update()
                const slowRadius = (config.radius || 80) + ((config.radiusPerLevel || 15) * (config.level - 1));
                const slowPercent = (config.slowPercent || 10) + ((config.slowPercentPerLevel || 5) * (config.level - 1));
                this._slowAuraConfig = { radius: slowRadius, slowFactor: 1 - (slowPercent / 100) };
                DebugLogger.info('powerup', `[PowerUpAbilities] Slow aura: ${slowPercent}% in ${slowRadius}px radius`);
                break;
            }

            default:
                DebugLogger.warn('powerup', `[PowerUpAbilities] Unhandled ability type: ${config.type}`);
        }
    }

    /**
     * Update active abilities
     */
    update(time, delta) {
        // Update each active ability with absolute time
        for (const [type, ability] of this.activeAbilities) {
            if (ability.updateFn) {
                ability.updateFn(time, delta);
            }
        }

        const player = this.scene.player;

        // Delegate aura update
        const auraConfig = this._abilityConfigs.get('aura');
        if (auraConfig && auraConfig.computedDamage > 0) {
            this._damageZones.updateAura(player, delta, auraConfig);
        }

        // Immune aura update (Garlic-style constant damage)
        const auraImmuneConfig = this._abilityConfigs.get('immune_aura');
        if (auraImmuneConfig) {
            this._damageZones.updateImmuneAura(player);
        }

        // Slow aura — reduce nearby enemy speed at 4Hz (not per-frame)
        if (this._slowAuraConfig && player?.active) {
            if (!this._lastSlowTick || time - this._lastSlowTick >= 250) {
                this._lastSlowTick = time;
                this._applySlowAura(player);
            }
        }

        // Delegate shield regeneration
        this._shieldRegen.update(player, time);
    }

    /**
     * Apply slow aura to nearby enemies
     */
    _applySlowAura(player) {
        const cfg = this._slowAuraConfig;
        if (!cfg) return;
        const enemies = this.scene.enemiesGroup?.getChildren();
        if (!enemies) return;
        const rSq = cfg.radius * cfg.radius;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            if (!e?.active || !e.body) continue;
            const dx = e.x - player.x;
            const dy = e.y - player.y;
            if (dx * dx + dy * dy <= rSq) {
                // Reduce velocity by slow factor (applied per frame — resets naturally when enemy exits radius)
                e.body.velocity.x *= cfg.slowFactor;
                e.body.velocity.y *= cfg.slowFactor;
            }
        }
    }

    /**
     * Process damage through shield system (PR7: Moved from Player.js)
     * @param {object} player - Player object
     * @param {number} amount - Damage amount
     * @param {number} time - Current game time
     * @returns {number} Remaining damage after shield absorption
     */
    processDamageWithShield(player, amount, time) {
        // Cytoprotection: flat damage reduction from modifier
        const dr = player.damageReduction || 0;
        if (dr > 0) {
            amount = Math.max(1, amount - dr);
        }
        return this._shieldRegen.processDamageWithShield(player, amount, time);
    }

    /**
     * Reset timers after pause/resume
     * Called by PowerUpSystem when game resumes
     */
    resetTimersAfterPause() {
        const now = this.scene.time?.now || 0;
        const player = this.scene.player;

        if (!player) return;

        // Delegate shield timer reset
        this._shieldRegen.resetTimersAfterPause(now, player);

        // Delegate chain lightning timer reset
        const lightningAbility = this.activeAbilities.get('chain_lightning');
        this._chainLightning.resetTimersAfterPause(now, lightningAbility);
    }

    // ==================== Centralized Query API ====================

    /** Check if an ability type is currently active */
    hasAbility(type) {
        return this._abilityConfigs.has(type);
    }

    /** Get config for an active ability */
    getAbilityConfig(type) {
        return this._abilityConfigs.get(type) || null;
    }

    /**
     * Handle on-hit effects from active power-ups (called by collision handlers).
     * Centralizes all bullet-hit-triggered power-up logic.
     */
    onBulletHit(scene, bullet, damage) {
        // Chemo reservoir: explosion on bullet hit
        const chemoConfig = this._abilityConfigs.get('chemo_aura');
        if (chemoConfig?.enableExplosions) {
            const player = scene.player;
            const explosionRadius = player?.getExplosionRadius ? player.getExplosionRadius() : 35;
            let explosionDamage = player?.getExplosionDamage ? player.getExplosionDamage() : damage * 0.5;
            explosionDamage = Number(explosionDamage) || (damage * 0.5);
            if (scene.projectileSystem?.createExplosion) {
                scene.projectileSystem.createExplosion(bullet.x, bullet.y, explosionDamage, explosionRadius, 1);
            }
        }
        // Future on-hit power-ups can be added here (poison, lifesteal, etc.)
    }

    /**
     * Cleanup
     */
    destroy() {
        this._damageZones.destroy();
        this._chainLightning.destroy();
        this._shieldRegen.destroy();
        if (this._regenTimer) { this._regenTimer.remove(); this._regenTimer = null; }
        if (this._oxidativeBurstTimer) { this._oxidativeBurstTimer.remove(); this._oxidativeBurstTimer = null; }
        this._slowAuraConfig = null;
        this.activeAbilities.clear();
        this._abilityConfigs.clear();
        this.scene = null;
        this.powerUpSystem = null;
    }
}
