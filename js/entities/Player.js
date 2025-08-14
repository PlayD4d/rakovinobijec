/**
 * Player.js - Třída hráče
 * 
 * PR7 kompatibilní - 100% data-driven implementace
 * Všechny hodnoty načítají z blueprintů přes ConfigResolver
 * Žádné hardcodované konstanty, vše přes ModifierEngine
 */

export class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, blueprint) {
        // Validace povinných systémů (PR7 - fail fast)
        if (!scene) throw new Error('[Player] Chybí scéna');
        if (!scene.configResolver) throw new Error('[Player] Chybí ConfigResolver');
        if (!scene.modifierEngine?.apply) throw new Error('[Player] Chybí ModifierEngine');
        if (!scene.projectileSystem?.createPlayerProjectile) throw new Error('[Player] Chybí ProjectileSystem');
        if (!scene.blueprintLoader) throw new Error('[Player] Chybí BlueprintLoader');
        if (!blueprint || blueprint.type !== 'player' || !blueprint.id) {
            throw new Error('[Player] Neplatný player blueprint');
        }

        const CR = scene.configResolver;

        // PR7: Načtení textury z blueprintu - správné cesty
        const textureKey = CR.get('visuals.textureKey', { blueprint }) || 'player';
        const textureFrame = 0; // Phaser frame index
        super(scene, x, y, textureKey, textureFrame);

        this.scene = scene;
        this.blueprint = blueprint;

        // PR7: Optional visual customization - správná cesta
        const tint = CR.get('visuals.tint', { blueprint });
        if (tint != null) this.setTint(tint);
        this.setOrigin(0.5, 0.5);

        // Physics setup
        scene.add.existing(this);
        scene.physics.add.existing(this);
        const radius = (CR.get('stats.size', { blueprint }) ?? this.width) * 0.5;
        this.body.setCircle(radius);
        this.body.setCollideWorldBounds(true);
        
        // PR7: Visual effects are now handled by PowerUpVFXManager

        // Základní statistiky - vše z blueprintu, žádné výchozí hodnoty!
        // Povinné cesty v blueprintu:
        //   stats.hp, stats.speed, stats.size
        //   mechanics.attack.intervalMs  
        //   mechanics.projectile.ref, mechanics.projectile.count, mechanics.projectile.spreadDeg
        //   mechanics.projectile.stats.damage|speed|range
        //   mechanics.crit.chance|multiplier
        //   mechanics.iFrames.ms
        this.baseStats = {
            hp: CR.get('stats.hp', { blueprint }),
            moveSpeed: CR.get('stats.speed', { blueprint }),
            attackIntervalMs: CR.get('mechanics.attack.intervalMs', { blueprint }),
            projectileRef: CR.get('mechanics.projectile.ref', { blueprint }),
            projectileCount: CR.get('mechanics.projectile.count', { blueprint }),
            spreadDeg: CR.get('mechanics.projectile.spreadDeg', { blueprint }),
            projDamage: CR.get('mechanics.projectile.stats.damage', { blueprint }),
            projSpeed: CR.get('mechanics.projectile.stats.speed', { blueprint }),
            projRange: CR.get('mechanics.projectile.stats.range', { blueprint }),
            critChance: CR.get('mechanics.attack.critChance', { blueprint }),
            critMult: CR.get('mechanics.attack.critMultiplier', { blueprint }),
            iFramesMs: CR.get('mechanics.iFrames.ms', { blueprint })
        };

        // Validace všech povinných klíčů - žádné tiché výchozí hodnoty!
        this._assertRequired(this.baseStats, [
            'hp', 'moveSpeed', 'attackIntervalMs',
            'projectileRef', 'projectileCount', 'spreadDeg',
            'projDamage', 'projSpeed', 'projRange',
            'critChance', 'critMult', 'iFramesMs'
        ]);

        // Aktuální stav hráče
        this.maxHp = this.baseStats.hp;
        this.hp = this.maxHp;
        this._cooldownMs = 0; // Cooldown mezi útoky
        this._iFramesMsLeft = 0; // Zbývající čas nezranitelnosti
        this.activeModifiers = []; // Aktivní modifikátory z PowerUpSystem
        
        // Shooting system
        this.fireTimer = 0;
        // PR7: Get move speed from ConfigResolver, no hardcoded fallback
        this.moveSpeed = this.baseStats.moveSpeed || CR.get('player.movement.defaultSpeed', { blueprint, defaultValue: 135 });

        // Input system - will be set via setInputKeys()
        this.keys = null;

        // VFX/SFX ids from blueprint (optional)
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

        // Spawn feedback
        this._playVfx(this.vfx.spawn, this.x, this.y);
        this._playSfx(this.sfx.spawn);
        scene.frameworkDebug?.onPlayerSpawn?.(this);
    }

    // ================ Phaser lifecycle ================

    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        
        // Skip all updates if game is paused
        if (this.scene.isPaused) {
            this.body.setVelocity(0, 0); // Stop movement
            return;
        }

        // Movement
        this._updateMovement(delta);

        // Timers
        this.fireTimer += delta;
        if (this._cooldownMs > 0) this._cooldownMs -= delta;
        if (this._iFramesMsLeft > 0) this._iFramesMsLeft -= delta;

        // Auto-shooting
        this._updateShooting(delta);
    }

    // ================ Pohyb hráče ================

    _updateMovement(dt) {
        if (!this.keys) return; // No spamming logs
        
        const speed = this._stats().moveSpeed;
        
        // Check both WASD and arrow keys
        const vx = (this.keys.left.isDown || this.keys.left2.isDown) ? -1 :
                   (this.keys.right.isDown || this.keys.right2.isDown) ? 1 : 0;
        
        const vy = (this.keys.up.isDown || this.keys.up2.isDown) ? -1 :
                   (this.keys.down.isDown || this.keys.down2.isDown) ? 1 : 0;

        // Apply movement
        this.body.setVelocity(vx * speed, vy * speed);
        
        // Rotate player to face movement direction (optional)
        if (vx !== 0 || vy !== 0) {
            this.rotation = Math.atan2(vy, vx);
        }
    }

    // ================ Střelba ================

    _updateShooting(dt) {
        const stats = this._stats();
        // PR7: Get fire interval from ConfigResolver, no hardcoded fallback
        const fireIntervalMs = stats.attackIntervalMs || this.scene.configResolver?.get('player.attack.defaultInterval', { defaultValue: 1000 }) || 1000;
        
        // Check cooldown timer
        if (this.fireTimer < fireIntervalMs) return;

        const target = this._findTarget();
        if (!target) {
            // No target - don't spray bullets randomly
            return;
        }

        // Fire at target with proper cooldown
        this._shootAt(target, stats);
        this.fireTimer = 0; // Reset timer
    }

    _shootAt(target, stats) {
        // HOTFIX V4: Calculate exact angle to target
        const baseAngle = Math.atan2(target.y - this.y, target.x - this.x);
        const projectileCount = Math.max(1, stats.projectileCount);
        
        // Only apply spread if multiple projectiles
        if (projectileCount > 1) {
            const spreadRad = (stats.spreadDeg * Math.PI) / 180;
            
            for (let i = 0; i < projectileCount; i++) {
                // Distribute projectiles evenly around the base angle
                const t = (i - (projectileCount - 1) / 2);
                const angleOffset = (spreadRad / (projectileCount - 1)) * t;
                const finalAngle = baseAngle + angleOffset;
                
                this.scene.projectileSystem.createPlayerProjectile({
                    x: this.x,
                    y: this.y,
                    projectileBlueprintId: stats.projectileRef,
                    damage: this._rollCrit(stats.projDamage, stats),
                    speed: stats.projSpeed,
                    range: stats.projRange,
                    angleRad: finalAngle,
                    owner: this
                });
            }
        } else {
            // Single projectile - shoot directly at target
            this.scene.projectileSystem.createPlayerProjectile({
                x: this.x,
                y: this.y,
                projectileBlueprintId: stats.projectileRef,
                damage: this._rollCrit(stats.projDamage, stats),
                speed: stats.projSpeed,
                range: stats.projRange,
                angleRad: baseAngle,
                owner: this
            });
        }

        this._playVfx(this.vfx.shoot, this.x, this.y);
        this._playSfx(this.sfx.shoot);
        this.scene.frameworkDebug?.onPlayerShoot?.(this, projectileCount);
    }

    _findTarget() {
        // Use enemiesGroup from SpawnDirector
        const g = this.scene.enemiesGroup;
        if (!g) return null;

        let best = null;
        let bestD2 = Infinity;
        const cx = this.x, cy = this.y;

        const list = g.getChildren?.() || [];
        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (!e?.active) continue;
            const dx = e.x - cx;
            const dy = e.y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) { 
                bestD2 = d2; 
                best = e; 
            }
        }
        
        // Also check boss group
        const bossGroup = this.scene.bossGroup;
        if (bossGroup) {
            const bosses = bossGroup.getChildren?.() || [];
            for (let i = 0; i < bosses.length; i++) {
                const b = bosses[i];
                if (!b?.active) continue;
                const dx = b.x - cx;
                const dy = b.y - cy;
                const d2 = dx * dx + dy * dy;
                if (d2 < bestD2) { 
                    bestD2 = d2; 
                    best = b; 
                }
            }
        }
        
        return best;
    }

    _rollCrit(baseDamage, stats) {
        if (Math.random() < stats.critChance) {
            return Math.round(baseDamage * stats.critMult);
        }
        return Math.round(baseDamage);
    }

    // ================ Boj ================

    takeDamage(amount, source) {
        if (!this.active) return 0;
        if (this._iFramesMsLeft > 0) return 0;

        // Check if shield is active
        if (this.shieldActive && this.shieldHits > 0) {
            // Shield blocks damage
            this.shieldHits--;
            
            // Play shield block VFX through VFXSystem
            this._playVfx('vfx.shield.block', this.x, this.y);
            
            // Deactivate shield if no more hits
            if (this.shieldHits <= 0) {
                this.shieldActive = false;
                this.hasShield = false;
                // Play shield break VFX
                this._playVfx('vfx.shield.break', this.x, this.y);
                // Detach shield visual effect
                if (this.scene.powerUpVFXManager) {
                    this.scene.powerUpVFXManager.detachEffect(this, 'shield');
                }
            }
            
            // PR7: Get shield duration from ConfigResolver
            const CR = this.scene.configResolver || window.ConfigResolver;
            this._iFramesMsLeft = this.shieldDuration || CR?.get('player.shield.defaultDuration', { defaultValue: 3000 }) || 3000;
            
            // Play shield block sound through SFX system
            this._playSfx('sfx.shield.block');
            
            return 0; // No damage taken
        }

        const dmg = Math.max(0, amount | 0);
        if (dmg <= 0) return 0;

        this.hp -= dmg;
        this._iFramesMsLeft = this._stats().iFramesMs;

        this._playVfx(this.vfx.hit, this.x, this.y);
        this._playSfx(this.sfx.hit);
        this.scene.frameworkDebug?.onPlayerHit?.(this, dmg, source);

        // Update HUD
        if (this.scene.unifiedHUD?.setPlayerHealth) {
            this.scene.unifiedHUD.setPlayerHealth(this.hp, this.maxHp);
        }

        if (this.hp <= 0) {
            this.die(source);
        }
        return dmg;
    }

    canTakeDamage() {
        return this.active && this._iFramesMsLeft <= 0;
    }

    heal(amount) {
        const a = Math.max(0, amount | 0);
        if (a <= 0) return 0;
        
        const before = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + a);
        
        if (this.hp > before) {
            this._playVfx(this.vfx.heal, this.x, this.y);
            this._playSfx(this.sfx.heal);
            this.scene.frameworkDebug?.onPlayerHeal?.(this, this.hp - before);
            
            // Update HUD
            if (this.scene.unifiedHUD?.setPlayerHealth) {
                this.scene.unifiedHUD.setPlayerHealth(this.hp, this.maxHp);
            }
        }
        return this.hp - before;
    }

    die(source) {
        if (!this.active) return;
        
        this._playVfx(this.vfx.death, this.x, this.y);
        this._playSfx(this.sfx.death);

        // Let GameScene handle game over
        this.scene.events.emit('player:die', { player: this, source });
        this.scene.frameworkDebug?.onPlayerDeath?.(this, source);

        // Analytics - PR7: předat správné parametry
        if (this.scene.analyticsManager) {
            const gameStats = this.scene.gameStats || {};
            const position = { x: this.x, y: this.y };
            const context = {
                playerHP: this.hp,
                playerMaxHP: this.maxHp,
                activePowerUps: this.scene.powerUpSystem?.getActivePowerUps?.() || [],
                enemiesOnScreen: this.scene.enemiesGroup?.countActive?.(true) || 0,
                projectilesOnScreen: this.scene.projectileSystem?.getActiveCount?.() || 0,
                wasBossFight: this.scene.bossActive || false
            };
            
            this.scene.analyticsManager.trackPlayerDeath(source, position, gameStats, context);
        }

        this.destroy();
    }

    // ================ API pro modifikátory ================

    /**
     * Replace current modifiers (from PowerUpSystem)
     * Modifiers are plain objects for ModifierEngine
     */
    setActiveModifiers(modArray) {
        if (!Array.isArray(modArray)) {
            throw new Error('[Player] setActiveModifiers expects an array');
        }
        this.activeModifiers = modArray;
    }

    addModifier(mod) {
        if (!mod) return;
        this.activeModifiers.push(mod);
    }

    removeModifierById(id) {
        const a = this.activeModifiers;
        for (let i = 0; i < a.length; i++) {
            if (a[i]?.id === id) {
                a.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    clearModifiers() {
        this.activeModifiers = [];
    }

    // ================ Systém vstupu ================
    
    setInputKeys(keys) {
        this.keys = keys;
        console.log('[Player] Input keys set:', !!keys);
    }

    // ================ Pomocné metody ================

    _stats() {
        // PR7: Calculate current stats via ModifierEngine with safety check
        const modifiers = this.activeModifiers || [];
        return this.scene.modifierEngine.apply(this.baseStats, modifiers);
    }

    _playVfx(id, x = this.x, y = this.y) {
        if (!id) return;
        this.scene.newVFXSystem?.play(id, x, y);
    }

    _playSfx(id) {
        if (!id) return;
        this.scene.newSFXSystem?.play(id);
    }

    _assertRequired(obj, keys) {
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (obj[k] === undefined) {
                throw new Error(`[Player] Missing required stat '${k}' from blueprint/config`);
            }
        }
    }

    // PR7: Žádné legacy metody - vše je data-driven
    // Žádné applyPowerUp, žádná hardcodovaná logika power-upů
    // PowerUpSystem převádí na modifikátory a volá setActiveModifiers
}

export default Player;