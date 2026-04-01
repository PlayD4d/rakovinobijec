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

            case 'passive_regen':
                config.hpPerTick = (ability.hpPerTickPerLevel || [1,2,3,4,5])[level - 1] || 1;
                config.tickMs = (ability.tickMsPerLevel || [3000,3000,2500,2000,1500])[level - 1] || 3000;
                break;

            case 'synaptic_pulse':
                config.damage = (ability.damagePerLevel || [8,12,16,22,30])[level - 1] || 8;
                config.radius = (ability.radiusPerLevel || [80,90,100,110,120])[level - 1] || 80;
                config.interval = (ability.intervalPerLevel || [2500,2200,2000,1800,1500])[level - 1] || 2500;
                break;

            case 'orbital_antibodies':
                config.count = (ability.countPerLevel || [2,3,3,4,5])[level - 1] || 2;
                config.damage = (ability.damagePerLevel || [8,10,14,18,22])[level - 1] || 8;
                config.orbitRadius = (ability.radiusPerLevel || [50,55,60,65,70])[level - 1] || 50;
                config.speed = (ability.speedPerLevel || [2,2.2,2.5,2.8,3])[level - 1] || 2;
                break;

            case 'chemo_pool':
                config.damage = (ability.damagePerLevel || [5,8,12,16,20])[level - 1] || 5;
                config.poolRadius = (ability.radiusPerLevel || [40,50,55,60,70])[level - 1] || 40;
                config.duration = (ability.durationPerLevel || [3000,3500,4000,4500,5000])[level - 1] || 3000;
                config.interval = (ability.intervalPerLevel || [4000,3500,3000,2500,2000])[level - 1] || 4000;
                break;

            case 'antibody_boomerang':
                config.damage = (ability.damagePerLevel || [12,16,20,25,32])[level - 1] || 12;
                config.speed = (ability.speedPerLevel || [200,210,220,230,240])[level - 1] || 200;
                config.range = (ability.rangePerLevel || [150,170,190,200,220])[level - 1] || 150;
                config.count = (ability.countPerLevel || [1,1,1,2,2])[level - 1] || 1;
                config.interval = ability.interval || 2000;
                break;

            case 'ricochet_cell':
                config.damage = (ability.damagePerLevel || [10,14,18,22,28])[level - 1] || 10;
                config.speed = (ability.speedPerLevel || [180,190,200,210,220])[level - 1] || 180;
                config.bounces = (ability.bouncesPerLevel || [3,4,5,5,6])[level - 1] || 3;
                config.count = (ability.countPerLevel || [1,1,1,2,2])[level - 1] || 1;
                config.interval = ability.interval || 2500;
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
                // Oxidative Burst — slow-moving AoE flame cloud toward random enemy
                // Deals area damage to all enemies along the path (not projectile-based)
                const burstDamage = config.damage || 10;
                const burstInterval = config.intervalMs || 800;
                const burstRange = config.speed || 220; // reuse as range
                const burstRadius = 40; // AoE hit radius

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
                        const eg = this.scene.enemiesGroup?.getChildren() || [];
                        const bg = this.scene.bossGroup?.getChildren() || [];
                        const active = [];
                        for (let i = 0; i < eg.length; i++) { if (eg[i]?.active) active.push(eg[i]); }
                        for (let i = 0; i < bg.length; i++) { if (bg[i]?.active) active.push(bg[i]); }
                        if (active.length === 0) return;
                        const target = active[Math.floor(Math.random() * active.length)];

                        // Direction toward target
                        const dx = target.x - p.x;
                        const dy = target.y - p.y;
                        const dist = Math.hypot(dx, dy) || 1;
                        const nx = dx / dist;
                        const ny = dy / dist;

                        // Deal AoE damage to all enemies in a line from player toward target
                        const hitRange = Math.min(burstRange, dist + 50);
                        const rSq = burstRadius * burstRadius;
                        const allEnemies = [...eg, ...bg];
                        for (let i = 0; i < allEnemies.length; i++) {
                            const e = allEnemies[i];
                            if (!e?.active || typeof e.takeDamage !== 'function') continue;
                            // Project enemy onto the fire line
                            const ex = e.x - p.x;
                            const ey = e.y - p.y;
                            const proj = ex * nx + ey * ny; // distance along line
                            if (proj < 0 || proj > hitRange) continue;
                            // Perpendicular distance from line
                            const perpSq = (ex * ex + ey * ey) - proj * proj;
                            if (perpSq <= rSq) {
                                e.takeDamage(burstDamage);
                            }
                        }

                        // VFX: orange explosion effect along the line
                        if (this.scene.vfxSystem?.playExplosionEffect) {
                            const vfxDist = Math.min(hitRange * 0.6, 120);
                            this.scene.vfxSystem.playExplosionEffect(
                                p.x + nx * vfxDist, p.y + ny * vfxDist,
                                { color: 0xff6600, radius: burstRadius, duration: 250 }
                            );
                        }
                    }
                });

                DebugLogger.info('powerup', `[PowerUpAbilities] Oxidative Burst: ${burstDamage}dmg AoE, ${burstRadius}px radius, ${burstInterval}ms`);
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
                        p.heal(hpPerTick, { silent: true });
                    }
                });
                DebugLogger.info('powerup', `[PowerUpAbilities] Passive regen: +${hpPerTick} HP every ${tickMs}ms`);
                break;
            }

            case 'synaptic_pulse': {
                // Periodic AoE damage pulse from player position
                if (this._synapticTimer) { this._synapticTimer.remove(); this._synapticTimer = null; }
                const pulseDmg = config.damage;
                const pulseRadius = config.radius;

                this._synapticTimer = this.scene.time.addEvent({
                    delay: config.interval,
                    loop: true,
                    callback: () => {
                        const p = this.scene?.player;
                        if (!p?.active) return;
                        const rSq = pulseRadius * pulseRadius;
                        const eg = this.scene.enemiesGroup?.getChildren() || [];
                        const bg = this.scene.bossGroup?.getChildren() || [];
                        for (const list of [eg, bg]) {
                            for (let i = list.length - 1; i >= 0; i--) {
                                const e = list[i];
                                if (!e?.active || typeof e.takeDamage !== 'function') continue;
                                const dx = e.x - p.x, dy = e.y - p.y;
                                if (dx * dx + dy * dy <= rSq) e.takeDamage(pulseDmg);
                            }
                        }
                        // VFX: expanding ring
                        if (this.scene.vfxSystem?.playExplosionEffect) {
                            this.scene.vfxSystem.playExplosionEffect(p.x, p.y, {
                                color: 0x8844ff, radius: pulseRadius, duration: 300
                            });
                        }
                    }
                });
                DebugLogger.info('powerup', `[PowerUpAbilities] Synaptic Pulse: ${pulseDmg}dmg, ${pulseRadius}px, ${config.interval}ms`);
                break;
            }

            case 'orbital_antibodies': {
                // Projectiles orbit around player — smooth per-frame position, throttled hit detection
                if (this._orbitalTimer) { this._orbitalTimer.remove(); this._orbitalTimer = null; }
                const orbCount = config.count;
                const orbDmg = config.damage;
                const orbRadius = config.orbitRadius;
                const orbSpeed = config.speed; // rad/s

                // Bake texture once
                const orbTexKey = '_orbital_ab';
                if (!this.scene.textures.exists(orbTexKey)) {
                    const gf = this.scene.graphicsFactory;
                    if (gf) {
                        const g = gf.create();
                        g.clear();
                        g.fillStyle(0x00ccff, 1);
                        g.fillCircle(6, 6, 6);
                        g.generateTexture(orbTexKey, 12, 12);
                        gf.release(g);
                    }
                }

                // Create sprites
                if (this._orbitalSprites) this._orbitalSprites.forEach(s => s.destroy());
                this._orbitalSprites = [];
                for (let i = 0; i < orbCount; i++) {
                    const s = this.scene.add.sprite(player.x, player.y, orbTexKey);
                    s.setDepth((this.scene.DEPTH_LAYERS?.PROJECTILES || 3000) + 1);
                    s.setOrigin(0.5);
                    this._orbitalSprites.push(s);
                }

                // Store config for per-frame update
                this._orbitalConfig = { count: orbCount, damage: orbDmg, radius: orbRadius, speed: orbSpeed, angle: 0 };
                this._orbitalHitTimes = new WeakMap();
                this._orbitalLastHitCheck = 0;

                // Register per-frame position update via activeAbilities
                this.activeAbilities.set('orbital_antibodies', {
                    config,
                    updateFn: (time, delta) => {
                        const p = this.scene?.player;
                        if (!p?.active || !this._orbitalConfig) return;
                        const cfg = this._orbitalConfig;

                        // Smooth angle update per frame
                        cfg.angle += cfg.speed * (delta / 1000);

                        // Update sprite positions every frame (smooth orbit)
                        for (let i = 0; i < this._orbitalSprites.length; i++) {
                            const spr = this._orbitalSprites[i];
                            if (!spr?.scene) continue;
                            const a = cfg.angle + (i / cfg.count) * Math.PI * 2;
                            spr.setPosition(
                                p.x + Math.cos(a) * cfg.radius,
                                p.y + Math.sin(a) * cfg.radius
                            );
                        }

                        // Hit detection throttled at 10Hz
                        if (time - this._orbitalLastHitCheck < 100) return;
                        this._orbitalLastHitCheck = time;

                        const hitRSq = 18 * 18;
                        for (let i = 0; i < this._orbitalSprites.length; i++) {
                            const spr = this._orbitalSprites[i];
                            if (!spr?.scene) continue;
                            const ox = spr.x, oy = spr.y;
                            const eg = this.scene.enemiesGroup?.getChildren() || [];
                            const bg = this.scene.bossGroup?.getChildren() || [];
                            for (const list of [eg, bg]) {
                                for (let j = list.length - 1; j >= 0; j--) {
                                    const e = list[j];
                                    if (!e?.active || typeof e.takeDamage !== 'function') continue;
                                    const dx = e.x - ox, dy = e.y - oy;
                                    if (dx * dx + dy * dy <= hitRSq) {
                                        const lastHit = this._orbitalHitTimes.get(e) || 0;
                                        if (time - lastHit < 500) continue;
                                        this._orbitalHitTimes.set(e, time);
                                        e.takeDamage(cfg.damage);
                                    }
                                }
                            }
                        }
                    }
                });

                DebugLogger.info('powerup', `[PowerUpAbilities] Orbital Antibodies: ${orbCount}x ${orbDmg}dmg, r=${orbRadius}px`);
                break;
            }

            case 'chemo_pool': {
                // Periodic damage zone on ground at player position
                if (this._chemoPoolTimer) { this._chemoPoolTimer.remove(); this._chemoPoolTimer = null; }
                const poolDmg = config.damage;
                const poolRadius = config.poolRadius;
                const poolDuration = config.duration;

                this._chemoPoolTimer = this.scene.time.addEvent({
                    delay: config.interval,
                    loop: true,
                    callback: () => {
                        const p = this.scene?.player;
                        if (!p?.active) return;
                        const px = p.x, py = p.y;
                        const rSq = poolRadius * poolRadius;

                        // VFX: green pool on ground
                        const texKey = `_cpool_${poolRadius}`;
                        if (!this.scene.textures.exists(texKey)) {
                            const gf = this.scene.graphicsFactory;
                            if (gf) {
                                const g = gf.create();
                                g.clear();
                                g.fillStyle(0x22aa66, 0.15);
                                g.fillCircle(poolRadius, poolRadius, poolRadius);
                                g.lineStyle(1, 0x22aa66, 0.3);
                                g.strokeCircle(poolRadius, poolRadius, poolRadius);
                                g.generateTexture(texKey, poolRadius * 2, poolRadius * 2);
                                gf.release(g);
                            }
                        }

                        const poolSprite = this.scene.add.sprite(px, py, texKey);
                        poolSprite.setOrigin(0.5).setAlpha(0);
                        poolSprite.setDepth((this.scene.DEPTH_LAYERS?.LOOT || 500) + 50);

                        // Fade in
                        this.scene.tweens.add({
                            targets: poolSprite, alpha: 0.8, duration: 300
                        });

                        // Damage tick every 500ms
                        const tickTimer = this.scene.time.addEvent({
                            delay: 500,
                            repeat: Math.floor(poolDuration / 500) - 1,
                            callback: () => {
                                const eg = this.scene.enemiesGroup?.getChildren() || [];
                                const bg = this.scene.bossGroup?.getChildren() || [];
                                for (const list of [eg, bg]) {
                                    for (let i = list.length - 1; i >= 0; i--) {
                                        const e = list[i];
                                        if (!e?.active || typeof e.takeDamage !== 'function') continue;
                                        const dx = e.x - px, dy = e.y - py;
                                        if (dx * dx + dy * dy <= rSq) e.takeDamage(poolDmg);
                                    }
                                }
                            }
                        });

                        // Expire: fade out + destroy
                        this.scene.time.delayedCall(poolDuration, () => {
                            tickTimer.remove();
                            this.scene.tweens.add({
                                targets: poolSprite, alpha: 0, duration: 400,
                                onComplete: () => poolSprite.destroy()
                            });
                        });
                    }
                });
                DebugLogger.info('powerup', `[PowerUpAbilities] Chemo Pool: ${poolDmg}dmg, r=${poolRadius}px, ${poolDuration}ms, every ${config.interval}ms`);
                break;
            }

            case 'antibody_boomerang': {
                // Boomerang projectile — flies toward nearest enemy, returns to player
                if (this._boomerangTimer) { this._boomerangTimer.remove(); this._boomerangTimer = null; }
                const boomDmg = config.damage;
                const boomSpeed = config.speed;
                const boomRange = config.range;
                const boomCount = config.count;

                // Bake texture
                const boomTexKey = '_antibody_boom';
                if (!this.scene.textures.exists(boomTexKey)) {
                    const gf = this.scene.graphicsFactory;
                    if (gf) {
                        const g = gf.create();
                        g.clear();
                        g.fillStyle(0xffcc00, 1);
                        g.fillCircle(5, 5, 5);
                        g.lineStyle(1, 0xffffff, 0.6);
                        g.strokeCircle(5, 5, 5);
                        g.generateTexture(boomTexKey, 10, 10);
                        gf.release(g);
                    }
                }

                this._boomerangTimer = this.scene.time.addEvent({
                    delay: config.interval,
                    loop: true,
                    callback: () => {
                        const p = this.scene?.player;
                        if (!p?.active) return;

                        // Find target
                        const target = this.scene.findNearestEnemy?.();
                        if (!target?.active) return;

                        for (let n = 0; n < boomCount; n++) {
                            const dx = target.x - p.x;
                            const dy = target.y - p.y;
                            const dist = Math.hypot(dx, dy) || 1;
                            const nx = dx / dist;
                            const ny = dy / dist;
                            // Slight spread for multi-boomerangs
                            const spread = boomCount > 1 ? (n - (boomCount - 1) / 2) * 0.2 : 0;
                            const angle = Math.atan2(ny, nx) + spread;

                            const spr = this.scene.add.sprite(p.x, p.y, boomTexKey);
                            spr.setDepth((this.scene.DEPTH_LAYERS?.PROJECTILES || 3000) + 2);
                            spr.setOrigin(0.5);

                            // Phase 1: fly out
                            const flyDist = Math.min(boomRange, dist + 30);
                            const destX = p.x + Math.cos(angle) * flyDist;
                            const destY = p.y + Math.sin(angle) * flyDist;
                            const flyTime = (flyDist / boomSpeed) * 1000;

                            const hitEnemies = new Set();

                            // Hit check at 10Hz during flight
                            const hitTimer = this.scene.time.addEvent({
                                delay: 100, loop: true,
                                callback: () => {
                                    if (!spr?.scene) { hitTimer.remove(); return; }
                                    const eg = this.scene.enemiesGroup?.getChildren() || [];
                                    const bg = this.scene.bossGroup?.getChildren() || [];
                                    for (const list of [eg, bg]) {
                                        for (let i = list.length - 1; i >= 0; i--) {
                                            const e = list[i];
                                            if (!e?.active || hitEnemies.has(e)) continue;
                                            const ex = e.x - spr.x, ey = e.y - spr.y;
                                            if (ex * ex + ey * ey <= 400) { // 20px hit radius
                                                hitEnemies.add(e);
                                                e.takeDamage(boomDmg);
                                            }
                                        }
                                    }
                                }
                            });

                            // Fly out
                            this.scene.tweens.add({
                                targets: spr, x: destX, y: destY,
                                duration: flyTime, ease: 'Sine.easeOut',
                                onComplete: () => {
                                    // Phase 2: return — clear hit set so enemies get hit again
                                    hitEnemies.clear();
                                    this.scene.tweens.add({
                                        targets: spr, x: p.x, y: p.y,
                                        duration: flyTime * 0.8, ease: 'Sine.easeIn',
                                        onComplete: () => {
                                            hitTimer.remove();
                                            spr.destroy();
                                        }
                                    });
                                }
                            });
                        }
                    }
                });
                DebugLogger.info('powerup', `[PowerUpAbilities] Antibody Boomerang: ${boomCount}x ${boomDmg}dmg, range=${boomRange}px`);
                break;
            }

            case 'ricochet_cell': {
                // Bouncing projectile — ricochets off screen edges
                if (this._ricochetTimer) { this._ricochetTimer.remove(); this._ricochetTimer = null; }
                const ricDmg = config.damage;
                const ricSpeed = config.speed;
                const ricBounces = config.bounces;
                const ricCount = config.count;

                // Bake texture
                const ricTexKey = '_ricochet_cell';
                if (!this.scene.textures.exists(ricTexKey)) {
                    const gf = this.scene.graphicsFactory;
                    if (gf) {
                        const g = gf.create();
                        g.clear();
                        g.fillStyle(0x44ddff, 1);
                        g.fillCircle(4, 4, 4);
                        g.generateTexture(ricTexKey, 8, 8);
                        gf.release(g);
                    }
                }

                this._ricochetTimer = this.scene.time.addEvent({
                    delay: config.interval,
                    loop: true,
                    callback: () => {
                        const p = this.scene?.player;
                        if (!p?.active) return;

                        for (let n = 0; n < ricCount; n++) {
                            // Random direction
                            const angle = Math.random() * Math.PI * 2;

                            const spr = this.scene.physics.add.sprite(p.x, p.y, ricTexKey);
                            spr.setDepth((this.scene.DEPTH_LAYERS?.PROJECTILES || 3000) + 2);
                            spr.setOrigin(0.5);
                            spr.body.setVelocity(Math.cos(angle) * ricSpeed, Math.sin(angle) * ricSpeed);
                            spr.body.setCollideWorldBounds(true);
                            spr.body.setBounce(1, 1);
                            spr.body.onWorldBounds = true;
                            spr.body.setAllowGravity(false);

                            let bouncesLeft = ricBounces;
                            const hitCooldowns = new WeakMap();

                            // Listen for world bounds bounce
                            this.scene.physics.world.on('worldbounds', (body) => {
                                if (body.gameObject !== spr) return;
                                bouncesLeft--;
                                if (bouncesLeft <= 0) {
                                    spr.destroy();
                                }
                            });

                            // Hit check at 10Hz
                            const hitTimer = this.scene.time.addEvent({
                                delay: 100, loop: true,
                                callback: () => {
                                    if (!spr?.scene || !spr.active) { hitTimer.remove(); return; }
                                    const now = this.scene.time?.now || 0;
                                    const eg = this.scene.enemiesGroup?.getChildren() || [];
                                    const bg = this.scene.bossGroup?.getChildren() || [];
                                    for (const list of [eg, bg]) {
                                        for (let i = list.length - 1; i >= 0; i--) {
                                            const e = list[i];
                                            if (!e?.active || typeof e.takeDamage !== 'function') continue;
                                            const ex = e.x - spr.x, ey = e.y - spr.y;
                                            if (ex * ex + ey * ey <= 256) { // 16px hit radius
                                                const lastHit = hitCooldowns.get(e) || 0;
                                                if (now - lastHit < 300) continue;
                                                hitCooldowns.set(e, now);
                                                e.takeDamage(ricDmg);
                                            }
                                        }
                                    }
                                }
                            });

                            // Safety: kill after 8 seconds max
                            this.scene.time.delayedCall(8000, () => {
                                hitTimer.remove();
                                if (spr?.scene) spr.destroy();
                            });
                        }
                    }
                });
                DebugLogger.info('powerup', `[PowerUpAbilities] Ricochet Cell: ${ricCount}x ${ricDmg}dmg, ${ricBounces} bounces`);
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

        // Orbital antibodies sprites follow player — position is set in the orbital timer callback

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
        if (this._synapticTimer) { this._synapticTimer.remove(); this._synapticTimer = null; }
        if (this._orbitalSprites) { this._orbitalSprites.forEach(s => s?.destroy()); this._orbitalSprites = null; }
        this._orbitalConfig = null;
        if (this._chemoPoolTimer) { this._chemoPoolTimer.remove(); this._chemoPoolTimer = null; }
        if (this._boomerangTimer) { this._boomerangTimer.remove(); this._boomerangTimer = null; }
        if (this._ricochetTimer) { this._ricochetTimer.remove(); this._ricochetTimer = null; }
        this.activeAbilities.clear();
        this._abilityConfigs.clear();
        this.scene = null;
        this.powerUpSystem = null;
    }
}
