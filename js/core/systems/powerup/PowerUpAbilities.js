import { DebugLogger } from '../../debug/DebugLogger.js';
import { getSession } from '../../debug/SessionLog.js';
import { lvl, getActiveEnemies, damageEnemiesInRadius } from '../../utils/CombatUtils.js';
import { ChainLightningAbility } from './abilities/ChainLightningAbility.js';
import { DamageZoneAbilities } from './abilities/DamageZoneAbilities.js';
import { ShieldRegeneration } from './abilities/ShieldRegeneration.js';
import { OrbitalAbility } from './abilities/OrbitalAbility.js';
import { ChemoPoolAbility } from './abilities/ChemoPoolAbility.js';
import { BoomerangAbility } from './abilities/BoomerangAbility.js';
import { RicochetAbility } from './abilities/RicochetAbility.js';

/**
 * PowerUpAbilities - Handles special abilities from power-ups
 * Thin Composer: delegates to extracted ability modules.
 */
export class PowerUpAbilities {
    constructor(scene, powerUpSystem) {
        this.scene = scene;
        this.powerUpSystem = powerUpSystem;

        // Active abilities that need per-frame updates
        this.activeAbilities = new Map();
        // Centralized ability state — enables hasAbility() / getAbilityConfig()
        this._abilityConfigs = new Map();

        // Extracted ability modules
        this._chainLightning = new ChainLightningAbility(scene, powerUpSystem);
        this._damageZones = new DamageZoneAbilities(scene, powerUpSystem);
        this._shieldRegen = new ShieldRegeneration(scene, powerUpSystem);
        this._orbital = new OrbitalAbility(scene);
        this._chemoPool = new ChemoPoolAbility(scene);
        this._boomerang = new BoomerangAbility(scene);
        this._ricochet = new RicochetAbility(scene);
    }

    /**
     * Process abilities from blueprint — extract level-indexed config values
     */
    processAbilities(blueprint, level) {
        if (!blueprint.ability?.type) return [];

        const a = blueprint.ability;
        const config = { type: a.type, level, enabled: true };

        switch (a.type) {
            case 'radiotherapy':
                config.beamCount = lvl(a.beamsPerLevel, level, 1);
                config.range = lvl(a.rangePerLevel, level, 80);
                config.damage = lvl(a.damagePerLevel, level, 5);
                config.rotationSpeed = lvl(a.rotationSpeedPerLevel, level, a.rotationSpeed || 2);
                config.beamWidth = lvl(a.beamWidthPerLevel, level, a.beamWidth || 0.45);
                config.tickRate = a.tickRate || 0.1;
                config.beamColor = a.beamColor || 0x00ff00;
                config.beamAlpha = a.beamAlpha || 0.7;
                // Forward visual shape fields to RadiotherapyEffect
                if (a.innerRadius) config.innerRadius = a.innerRadius;
                if (a.innerWidthRatio) config.innerWidthRatio = a.innerWidthRatio;
                if (a.outerWidthRatio) config.outerWidthRatio = a.outerWidthRatio;
                if (a.glowWidthRatio) config.glowWidthRatio = a.glowWidthRatio;
                if (a.strokeWidth) config.strokeWidth = a.strokeWidth;
                if (a.fillAlpha) config.fillAlpha = a.fillAlpha;
                break;
            case 'flamethrower':
                config.damage = lvl(a.damagePerLevel, level, 10);
                config.intervalMs = lvl(a.intervalMsPerLevel, level, 800);
                config.speed = lvl(a.speedPerLevel, level, 220);
                config.radius = lvl(a.radiusPerLevel, level, 40); // AoE hit radius (area_boost scales this)
                break;
            case 'shield':
                config.shieldHP = (a.baseShieldHP || 50) * level;
                config.rechargeTime = lvl(a.rechargeTimePerLevel, level, 10000);
                break;
            case 'chain_lightning':
                config.damage = (a.baseDamage || 15) + (a.damagePerLevel || 10) * level;
                config.range = a.baseRange || 200;
                config.jumpRange = a.jumpRange || 80;
                config.jumps = level + 1; // L1 = 2 jumps (hit + 1 chain), L5 = 6
                config.interval = a.interval || 2000;
                break;
            case 'aura':
                config.damage = a.baseDamagePerTick || 2;
                config.radius = a.baseRadius || 100;
                config.radiusPerLevel = a.radiusPerLevel || 10;
                config.tickRate = a.tickRate || 0.1;
                break;
            case 'chemo_aura':
                config.enableExplosions = a.enableExplosions || false;
                break;
            case 'immune_aura':
                config.damage = lvl(a.damagePerLevel, level, 5);
                config.radius = lvl(a.radiusPerLevel, level, 60);
                config.knockback = lvl(a.knockbackPerLevel, level, 100);
                config.slowFactor = a.slowFactor || 0.10;
                config.tickRate = a.tickRate || 0.5;
                break;
            case 'homing_shot':
                config.speedBonus = lvl(a.speedBonusPerLevel, level, 20);
                config.rangeBonus = lvl(a.rangeBonusPerLevel, level, 50);
                break;
            case 'piercing':
                config.maxPierces = lvl(a.maxPierces, level, 1);
                config.damageReduction = a.damageReduction || 0.1;
                break;
            case 'passive_regen':
                config.hpPerTick = lvl(a.hpPerTickPerLevel, level, 1);
                config.tickMs = lvl(a.tickMsPerLevel, level, 3000);
                break;
            case 'synaptic_pulse':
                config.damage = lvl(a.damagePerLevel, level, 8);
                config.radius = lvl(a.radiusPerLevel, level, 80);
                config.interval = lvl(a.intervalPerLevel, level, 2500);
                break;
            case 'orbital_antibodies':
                config.count = lvl(a.countPerLevel, level, 2);
                config.damage = lvl(a.damagePerLevel, level, 8);
                config.orbitRadius = lvl(a.radiusPerLevel, level, 50);
                config.speed = lvl(a.speedPerLevel, level, 2);
                break;
            case 'chemo_pool':
                config.damage = lvl(a.damagePerLevel, level, 5);
                config.poolRadius = lvl(a.radiusPerLevel, level, 35);
                config.duration = lvl(a.durationPerLevel, level, 3000);
                config.interval = lvl(a.intervalPerLevel, level, 4000);
                config.poolCount = lvl(a.countPerLevel, level, 1);
                config.orbitRadius = lvl(a.orbitRadiusPerLevel, level, 100);
                break;
            case 'antibody_boomerang':
                config.damage = lvl(a.damagePerLevel, level, 12);
                config.speed = lvl(a.speedPerLevel, level, 200);
                config.range = lvl(a.rangePerLevel, level, 150);
                config.count = lvl(a.countPerLevel, level, 1);
                config.interval = a.interval || 2000;
                break;
            case 'ricochet_cell':
                config.damage = lvl(a.damagePerLevel, level, 10);
                config.speed = lvl(a.speedPerLevel, level, 180);
                config.bounces = lvl(a.bouncesPerLevel, level, 3);
                config.count = lvl(a.countPerLevel, level, 1);
                config.interval = a.interval || 2500;
                break;
            default:
                DebugLogger.warn('powerup', `[PowerUpAbilities] Unknown ability type: ${a.type}`);
                return [];
        }

        // Apply passive multipliers (area_boost, duration_boost)
        const stats = this.scene?.player?._stats?.();
        if (stats) {
            const areaMul = stats.areaMultiplier || 1;
            if (areaMul !== 1) {
                for (const k of ['radius', 'poolRadius', 'orbitRadius', 'range', 'jumpRange']) {
                    if (config[k]) config[k] = Math.round(config[k] * areaMul);
                }
            }
            const durMul = stats.durationMultiplier || 1;
            if (durMul !== 1) {
                // Duration: pools/effects last longer
                if (config.duration) config.duration = Math.round(config.duration * durMul);
                // Intervals: abilities fire faster (inverse scaling — shorter interval)
                if (config.interval) config.interval = Math.round(config.interval / durMul);
                if (config.intervalMs) config.intervalMs = Math.round(config.intervalMs / durMul);
                // Shield: recharge faster
                if (config.rechargeTime) config.rechargeTime = Math.round(config.rechargeTime / durMul);
            }
        }

        DebugLogger.info('powerup', `[PowerUpAbilities] Ability: ${config.type} level ${level}`, config);
        return [config];
    }

    applyToPlayer(player, abilities) {
        for (const ability of abilities) this._applyAbility(player, ability);
    }

    _applyAbility(player, config) {
        getSession()?.log('powerup', 'ability_applied', { abilityType: config.type, level: config.level });
        this._abilityConfigs.set(config.type, config);
        const vfxManager = this.powerUpSystem.vfxManager;

        switch (config.type) {
            case 'radiotherapy':
                if (vfxManager) vfxManager.attachEffect(player, 'radiotherapy', config);
                break;

            case 'flamethrower':
                this._startOxidativeBurst(config);
                break;

            case 'shield':
                this._applyShield(player, config, vfxManager);
                break;

            case 'xp_magnet':
                break; // Handled entirely via modifiers

            case 'chain_lightning':
                this.activeAbilities.set('chain_lightning', {
                    config, nextTriggerAt: 0,
                    updateFn: (time, delta) => {
                        this._chainLightning.update(time, delta, config, this.activeAbilities.get('chain_lightning'));
                    }
                });
                break;

            case 'aura': {
                const computedRadius = config.radius + (config.radiusPerLevel * (config.level - 1));
                if (this.scene.vfxSystem) {
                    this.scene.vfxSystem.play('vfx.aura.damage', player.x, player.y, {
                        radius: computedRadius, color: 0x00ff00, alpha: 0.1, persistent: true
                    });
                }
                config.computedDamage = config.damage * config.level;
                config.computedRadius = computedRadius;
                break;
            }

            case 'chemo_aura':
                break; // Explosive projectiles — processed by onBulletHit

            case 'immune_aura':
                this._damageZones.startImmuneAura(player, config);
                break;

            case 'homing_shot':
            case 'piercing':
                // Config stored in _abilityConfigs (line 164) — read via getAbilityConfig()
                break;

            case 'passive_regen':
                this._startPassiveRegen(config);
                break;

            case 'synaptic_pulse':
                this._startSynapticPulse(config);
                break;

            case 'orbital_antibodies':
                this._orbital.activate(player, config);
                this.activeAbilities.set('orbital_antibodies', {
                    config,
                    updateFn: (time, delta) => this._orbital.update(time, delta)
                });
                break;

            case 'chemo_pool':
                this._chemoPool.activate(config);
                break;

            case 'antibody_boomerang':
                this._boomerang.activate(config);
                break;

            case 'ricochet_cell':
                this._ricochet.activate(config);
                break;

            default:
                DebugLogger.warn('powerup', `[PowerUpAbilities] Unhandled ability type: ${config.type}`);
        }
    }

    // ==================== Inline Ability Helpers ====================

    _startOxidativeBurst(config) {
        if (this._oxidativeBurstTimer) { this._oxidativeBurstTimer.remove(); this._oxidativeBurstTimer = null; }
        const dmg = config.damage || 10;
        const interval = config.intervalMs || 800;
        const range = config.speed || 220;
        const radius = config.radius || 40;

        this._oxidativeBurstTimer = this.scene.time.addEvent({
            delay: interval, loop: true,
            callback: () => {
                const p = this.scene?.player;
                if (!p?.active) return;
                const active = getActiveEnemies(this.scene);
                if (active.length === 0) return;
                const target = active[Math.floor(Math.random() * active.length)];

                const dx = target.x - p.x, dy = target.y - p.y;
                const dist = Math.hypot(dx, dy) || 1;
                const nx = dx / dist, ny = dy / dist;
                const hitRange = Math.min(range, dist + 50);
                const rSq = radius * radius;

                for (const e of active) {
                    const ex = e.x - p.x, ey = e.y - p.y;
                    const proj = ex * nx + ey * ny;
                    if (proj < 0 || proj > hitRange) continue;
                    if ((ex * ex + ey * ey) - proj * proj <= rSq) e.takeDamage({ amount: dmg, source: 'oxidative_burst' });
                }

                if (this.scene.vfxSystem?.playExplosionEffect) {
                    const vfxDist = Math.min(hitRange * 0.6, 120);
                    this.scene.vfxSystem.playExplosionEffect(
                        p.x + nx * vfxDist, p.y + ny * vfxDist,
                        { color: 0xff6600, radius, duration: 250 }
                    );
                }
            }
        });
    }

    _applyShield(player, config, vfxManager) {
        player.shieldActive = true;
        player.shieldLevel = config.level;
        const oldMax = player.maxShieldHP || 0;
        const hpRatio = oldMax > 0 ? Math.min(1, player.shieldHP / oldMax) : 1;
        player.maxShieldHP = config.shieldHP;
        player.shieldHP = Math.round(config.shieldHP * hpRatio);
        player.shieldRechargeTime = config.rechargeTime;
        if (player.shieldHP > 0) {
            player.shieldRecharging = false;
            player.shieldRechargeAt = 0;
        } else if (!player.shieldRecharging) {
            player.shieldRecharging = true;
            player.shieldRechargeAt = (this.scene?.time?.now || 0) + config.rechargeTime;
        }

        if (this._shieldRegen) {
            this._shieldRegen.destroyShieldHitbox(player);
            this._shieldRegen.createShieldHitbox(player);
        }

        if (vfxManager) {
            vfxManager.attachEffect(player, 'shield', { radius: 28, color: 0x00ccff, alpha: 0.3 });
        } else if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('vfx.shield.active', player.x, player.y);
        }
    }

    _startPassiveRegen(config) {
        if (this._regenTimer) { this._regenTimer.remove(); this._regenTimer = null; }
        this._regenTimer = this.scene.time.addEvent({
            delay: config.tickMs, loop: true,
            callback: () => {
                const p = this.scene?.player;
                if (!p?.active || p.hp >= p.maxHp) return;
                p.heal(config.hpPerTick, { silent: true });
            }
        });
    }

    _startSynapticPulse(config) {
        if (this._synapticTimer) { this._synapticTimer.remove(); this._synapticTimer = null; }
        const rSq = config.radius * config.radius;
        this._synapticTimer = this.scene.time.addEvent({
            delay: config.interval, loop: true,
            callback: () => {
                const p = this.scene?.player;
                if (!p?.active) return;
                damageEnemiesInRadius(this.scene, p.x, p.y, rSq, config.damage, 'synaptic_pulse');
                if (this.scene.vfxSystem?.playExplosionEffect) {
                    this.scene.vfxSystem.playExplosionEffect(p.x, p.y, {
                        color: 0x8844ff, radius: config.radius, duration: 300
                    });
                }
            }
        });
    }

    // ==================== Per-frame Update ====================

    update(time, delta) {
        for (const [, ability] of this.activeAbilities) {
            if (ability.updateFn) ability.updateFn(time, delta);
        }

        const player = this.scene.player;
        const auraConfig = this._abilityConfigs.get('aura');
        if (auraConfig?.computedDamage > 0) this._damageZones.updateAura(player, delta, auraConfig);

        if (this._abilityConfigs.has('immune_aura')) this._damageZones.updateImmuneAura(player);

        this._shieldRegen.update(player, time);
    }

    // ==================== Shield / Damage ====================

    processDamageWithShield(player, amount, time) {
        const dr = player._stats?.().damageReduction || 0;
        if (dr > 0) amount = Math.max(1, amount - dr);
        return this._shieldRegen.processDamageWithShield(player, amount, time);
    }

    resetTimersAfterPause() {
        const now = this.scene.time?.now || 0;
        const player = this.scene.player;
        if (!player) return;
        this._shieldRegen.resetTimersAfterPause(now, player);
        this._chainLightning.resetTimersAfterPause(now, this.activeAbilities.get('chain_lightning'));
    }

    // ==================== Query API ====================

    hasAbility(type) { return this._abilityConfigs.has(type); }
    getAbilityConfig(type) { return this._abilityConfigs.get(type) || null; }

    onBulletHit(scene, bullet, damage) {
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
    }

    // ==================== Cleanup ====================

    destroy() {
        this._damageZones.destroy();
        this._chainLightning.destroy();
        this._shieldRegen.destroy();
        this._orbital.destroy();
        this._chemoPool.destroy();
        this._boomerang.destroy();
        this._ricochet.destroy();
        if (this._regenTimer) { this._regenTimer.remove(); this._regenTimer = null; }
        if (this._oxidativeBurstTimer) { this._oxidativeBurstTimer.remove(); this._oxidativeBurstTimer = null; }
        if (this._synapticTimer) { this._synapticTimer.remove(); this._synapticTimer = null; }
        this.activeAbilities.clear();
        this._abilityConfigs.clear();
        this.scene = null;
        this.powerUpSystem = null;
    }
}
