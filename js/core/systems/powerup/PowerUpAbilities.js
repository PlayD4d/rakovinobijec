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
                config.rotationSpeed = ability.rotationSpeed || 2;
                config.tickRate = ability.tickRate || 0.1;
                config.beamWidth = ability.beamWidth || 0.25;
                config.beamColor = ability.beamColor || 0x00ff00;
                config.beamAlpha = ability.beamAlpha || 0.7;
                break;

            case 'flamethrower':
                config.range = ability.rangePerLevel?.[level - 1] || 80;
                config.damage = ability.damagePerLevel?.[level - 1] || 3;
                config.coneAngle = ability.coneAnglePerLevel?.[level - 1] || 0.4;
                config.tickRate = ability.tickRate || 0.1;
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
                // Keys must match what DamageZoneAbilities.startChemoCloud reads
                config.chemoCloudDuration = ability.chemoCloudDuration || 6000;
                config.chemoCloudDamage = ability.chemoCloudDamage || 4;
                config.chemoCloudRadius = ability.chemoCloudRadius || 35;
                config.enableExplosions = ability.enableExplosions || false;
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
                }
                break;

            case 'flamethrower':
                if (vfxManager) {
                    vfxManager.attachEffect(player, 'flamethrower', {
                        length: config.range,
                        angle: config.coneAngle,
                        damage: config.damage,
                        tickRate: config.tickRate,
                        color: 0xff6600
                    });
                }
                break;

            case 'shield':
                player.shieldActive = true;
                player.shieldLevel = config.level;
                player.shieldHP = config.shieldHP;
                player.maxShieldHP = config.shieldHP;
                player.shieldRechargeTime = config.rechargeTime;
                player.shieldRecharging = false;
                player.shieldRechargeAt = 0;

                DebugLogger.info('powerup', `[PowerUpAbilities] SHIELD ACTIVATED - Level: ${config.level}, HP: ${config.shieldHP}, Recharge: ${config.rechargeTime}ms`);

                // Create/update shield physics hitbox for bullet interception
                if (this._shieldRegen) {
                    this._shieldRegen.destroyShieldHitbox(player);
                    this._shieldRegen.createShieldHitbox(player);
                }

                if (vfxManager) {
                    DebugLogger.info('powerup', `[PowerUpAbilities] Attaching shield VFX to player`);
                    vfxManager.attachEffect(player, 'shield', {
                        radius: 40 + (config.level * 5),
                        color: 0x00ffff,
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

            case 'aura':
                if (this.scene.vfxSystem && !this._abilityConfigs.has('aura')) {
                    this.scene.vfxSystem.play('vfx.aura.damage', player.x, player.y, {
                        radius: config.radius + (config.radiusPerLevel * (config.level - 1)),
                        color: 0x00ff00,
                        alpha: 0.1,
                        persistent: true
                    });
                }
                // Store computed values in config for DamageZoneAbilities to read
                config.computedDamage = config.damage * config.level;
                config.computedRadius = config.radius + (config.radiusPerLevel * (config.level - 1));
                break;

            case 'chemo_aura':
                this._damageZones.startChemoCloud(player, config);
                DebugLogger.info('powerup', `[PowerUpAbilities] Activated chemo aura — cloud damage ${config.chemoCloudDamage}, radius ${config.chemoCloudRadius}`);
                break;

            case 'piercing':
                player.piercingLevel = config.level;
                player.piercingMaxPierces = config.maxPierces;
                player.piercingDamageReduction = config.damageReduction;
                DebugLogger.info('powerup', `[PowerUpAbilities] Activated piercing: ${config.maxPierces} pierces, ${(config.damageReduction * 100)}% damage reduction`);
                break;

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

        // Delegate chemo cloud position update
        if (this._abilityConfigs.has('chemo_aura')) {
            this._damageZones.updateChemoCloud(player);
        }

        // Delegate shield regeneration
        this._shieldRegen.update(player, time);
    }

    /**
     * Process damage through shield system (PR7: Moved from Player.js)
     * @param {object} player - Player object
     * @param {number} amount - Damage amount
     * @param {number} time - Current game time
     * @returns {number} Remaining damage after shield absorption
     */
    processDamageWithShield(player, amount, time) {
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
        this.activeAbilities.clear();
        this._abilityConfigs.clear();
        this.scene = null;
        this.powerUpSystem = null;
    }
}
