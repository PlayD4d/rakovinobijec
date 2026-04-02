import { DebugLogger } from '../core/debug/DebugLogger.js';
import { PlayerAttackController } from './player/PlayerAttackController.js';
import { PlayerCombat } from './player/PlayerCombat.js';
import { PlayerStats } from './player/PlayerStats.js';

/**
 * Player.js - Thin Composer (PR7)
 *
 * Delegates to: PlayerCombat, PlayerStats, PlayerAttackController
 * Owns: Constructor, lifecycle, movement, VFX/SFX helpers
 */

export class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, blueprint) {
        // Validate required systems
        if (!scene) throw new Error('[Player] Missing scene');
        if (!scene.configResolver) throw new Error('[Player] Missing ConfigResolver');
        if (!scene.projectileSystem?.createPlayerProjectile) throw new Error('[Player] Missing ProjectileSystem');
        if (!scene.blueprintLoader) throw new Error('[Player] Missing BlueprintLoader');
        if (!blueprint || blueprint.type !== 'player' || !blueprint.id) {
            throw new Error('[Player] Invalid player blueprint');
        }

        const CR = scene.configResolver;
        const textureKey = CR.get('visuals.textureKey', { blueprint }) || 'player';
        super(scene, x, y, textureKey, 0);

        this.scene = scene;
        this.blueprint = blueprint;

        // Visual setup
        const tint = CR.get('visuals.tint', { blueprint });
        if (tint != null) this.setTint(tint);
        this.setOrigin(0.5, 0.5);

        // Physics setup
        scene.add.existing(this);
        scene.physics.add.existing(this);
        const radius = (CR.get('stats.size', { blueprint }) ?? this.width) * 0.5;
        this.body.setCircle(radius);
        this.body.setCollideWorldBounds(true);
        // Arcade Physics: overlap is managed by setupCollisions, not by per-body categories

        // Base stats from blueprint
        this.baseStats = {
            hp: CR.get('stats.hp', { blueprint }),
            moveSpeed: CR.get('stats.speed', { blueprint }),
            attackIntervalMs: CR.get('mechanics.attack.intervalMs', { blueprint }),
            projectileRef: CR.get('mechanics.projectile.ref', { blueprint }),
            projectileCount: CR.get('mechanics.projectile.count', { blueprint }),
            spreadDeg: CR.get('mechanics.projectile.spreadDeg', { blueprint }),
            projectileDamage: CR.get('mechanics.projectile.stats.damage', { blueprint }),
            projectileSpeed: CR.get('mechanics.projectile.stats.speed', { blueprint }),
            projectileRange: CR.get('mechanics.projectile.stats.range', { blueprint }),
            critChance: CR.get('mechanics.attack.critChance', { blueprint }),
            critMult: CR.get('mechanics.attack.critMultiplier', { blueprint }),
            iFramesMs: CR.get('mechanics.iFrames.ms', { blueprint }),
            xpMagnetRadius: CR.get('mechanics.progression.xpMagnetRange', { blueprint }) || 50,
            damageReduction: 0, dodgeChance: 0, explosionRadius: 0, explosionDamage: 0,
            projectilePiercing: 0, chemoCloudFrequency: 1,
            shieldImmunityDuration: 3000, shieldRegenTimeMs: 10000,
            // Passive item stats (multiplicative identity = 1.0, additive identity = 0)
            areaMultiplier: 1, durationMultiplier: 1, xpMultiplier: 1
        };

        this._assertRequired(this.baseStats, [
            'hp', 'moveSpeed', 'attackIntervalMs',
            'projectileRef', 'projectileCount', 'spreadDeg',
            'projectileDamage', 'projectileSpeed', 'projectileRange',
            'critChance', 'critMult', 'iFramesMs'
        ]);

        // Player state
        this.maxHp = this.baseStats.hp;
        this.hp = this.maxHp;
        this._iFramesMsLeft = 0;
        this._isDead = false;
        this.activeModifiers = [];
        this._statsDirty = true;

        // Shield state (managed by PowerUpSystem)
        this.shieldActive = false;
        this.shieldHP = 0;
        this.maxShieldHP = 0;
        this.shieldLevel = 0;
        this.shieldBroken = false;
        this.shieldRegenMs = 10000;
        this.shieldRecharging = false;
        this.shieldRechargeAt = 0;
        this.shieldRechargeTime = 10000;
        this._shieldBrokenAt = -Infinity;

        // Timing
        this._nextAttackAt = 0;
        this._lastAttackTime = 0;
        this.moveSpeed = this.baseStats.moveSpeed;
        this.keys = null;

        // VFX/SFX from blueprint
        this.vfx = {
            spawn: CR.get('vfx.spawn', { blueprint }),
            hit: CR.get('vfx.hit', { blueprint }),
            death: CR.get('vfx.death', { blueprint }),
            shoot: CR.get('vfx.shoot', { blueprint }),
            heal: CR.get('vfx.heal', { blueprint })
        };
        this.sfx = {
            spawn: CR.get('sfx.spawn', { blueprint }),
            hit: CR.get('sfx.hit', { blueprint }),
            death: CR.get('sfx.death', { blueprint }),
            shoot: CR.get('sfx.shoot', { blueprint }),
            heal: CR.get('sfx.heal', { blueprint })
        };

        // Sub-systems (Thin Composer)
        this.combat = new PlayerCombat(this);
        this.statsSystem = new PlayerStats(this);
        this.attackController = new PlayerAttackController(this);

        // Spawn feedback
        this._playVfx(this.vfx.spawn, this.x, this.y);
        this._playSfx(this.sfx.spawn);
        scene.frameworkDebug?.onPlayerSpawn?.(this);
    }

    // ================ Lifecycle ================

    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        if (!this.active && this.hp > 0 && !this._isDead) {
            DebugLogger.error('general', `[Player] Inactive with HP > 0 — reactivating`);
            this.setActive(true);
            this.setVisible(true);
            if (this.body) this.body.enable = true;
        }
        if (this.scene.isPaused) {
            this.body.setVelocity(0, 0);
            return;
        }
    }

    update(time, delta) {
        if (!this.active || this.hp <= 0) return;
        if (this._iFramesMsLeft > 0) {
            this._iFramesMsLeft = Math.max(0, this._iFramesMsLeft - delta);
            this.alpha = Math.sin(time * 0.02) * 0.3 + 0.7;
        } else {
            this.alpha = 1;
        }
        this._updateMovement(delta);
        this.attackController.update(time, delta);
    }

    // ================ Movement ================

    _updateMovement(dt) {
        if (!this.keys) return;
        const speed = this._stats().moveSpeed;
        const vx = (this.keys.left.isDown || this.keys.left2.isDown) ? -1 :
                   (this.keys.right.isDown || this.keys.right2.isDown) ? 1 : 0;
        const vy = (this.keys.up.isDown || this.keys.up2.isDown) ? -1 :
                   (this.keys.down.isDown || this.keys.down2.isDown) ? 1 : 0;
        this.body.setVelocity(vx * speed, vy * speed);
        if (vx !== 0 || vy !== 0) this.rotation = Math.atan2(vy, vx);
    }

    // ================ Combat (delegates to PlayerCombat) ================

    takeDamage(amount, source) { return this.combat.takeDamage(amount, source); }
    canTakeDamage() { return this.combat.canTakeDamage(); }
    heal(amount, opts) { return this.combat.heal(amount, opts); }
    die(source) { this.combat.die(source); }

    // ================ Stats (delegates to PlayerStats) ================

    _stats() { return this.statsSystem.getAll(); }
    applyModifiers(baseValue, statName) { return this.statsSystem.applyModifiers(baseValue, statName); }
    setActiveModifiers(modArray) { this.statsSystem.setAll(modArray); }
    addModifier(mod) { this.statsSystem.add(mod); }
    removeModifierById(id) { return this.statsSystem.removeById(id); }
    clearModifiers() { this.statsSystem.clearAll(); }
    getXPMagnetRadius() {
        return this.statsSystem.get('xpMagnetRadius') || this.baseStats.xpMagnetRadius || 100;
    }
    getExplosionRadius() { return this.statsSystem.get('explosionRadius'); }
    getExplosionDamage() { return this.statsSystem.get('explosionDamage'); }
    getProjectilePiercing() { return this.statsSystem.get('projectilePiercing', true); }

    // ================ Input ================

    setInputKeys(keys) {
        this.keys = keys;
        DebugLogger.info('general', '[Player] Input keys set:', !!keys);
    }

    // ================ Helpers ================

    _playVfx(id, x = this.x, y = this.y) {
        if (!id) return;
        this.scene.vfxSystem?.play(id, x, y);
    }

    _playSfx(id) {
        if (!id) return;
        this.scene.audioSystem?.play(id);
    }

    _assertRequired(obj, keys) {
        for (let i = 0; i < keys.length; i++) {
            if (obj[keys[i]] === undefined) {
                throw new Error(`[Player] Missing required stat '${keys[i]}' from blueprint/config`);
            }
        }
    }

    resetTimersAfterPause() {
        const now = this.scene.time?.now || 0;
        const stats = this._stats();
        this._nextAttackAt = now + Math.min(stats.attackIntervalMs, 500);
        this._statsDirty = true;
    }
}

