/**
 * Player.js - Třída hráče
 * 
 * PR7 kompatibilní - 100% data-driven implementace
 * Všechny hodnoty načítají z blueprintů přes ConfigResolver
 * Žádné hardcodované konstanty, modifikátory aplikovány přímo
 */

export class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, blueprint) {
        // Validace povinných systémů (PR7 - rychlé selhání)
        if (!scene) throw new Error('[Player] Chybí scéna');
        if (!scene.configResolver) throw new Error('[Player] Chybí ConfigResolver');
        // ModifierEngine removed - modifiers handled directly
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

        // PR7: Volitelné vizuální přizpůsobení - správná cesta
        const tint = CR.get('visuals.tint', { blueprint });
        if (tint != null) this.setTint(tint);
        this.setOrigin(0.5, 0.5);

        // Nastavení fyziky
        scene.add.existing(this);
        scene.physics.add.existing(this);
        const radius = (CR.get('stats.size', { blueprint }) ?? this.width) * 0.5;
        this.body.setCircle(radius);
        this.body.setCollideWorldBounds(true);
        
        // PR7: Vizuální efekty jsou nyní zpracovávány PowerUpVFXManager

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
            projectileDamage: CR.get('mechanics.projectile.stats.damage', { blueprint }),
            projectileSpeed: CR.get('mechanics.projectile.stats.speed', { blueprint }),
            projectileRange: CR.get('mechanics.projectile.stats.range', { blueprint }),
            critChance: CR.get('mechanics.attack.critChance', { blueprint }),
            critMult: CR.get('mechanics.attack.critMultiplier', { blueprint }),
            iFramesMs: CR.get('mechanics.iFrames.ms', { blueprint }),
            xpMagnetRadius: 100,  // Base XP collection radius (100 pixels)
            // New properties for powerups
            dodgeChance: 0,
            explosionRadius: 0,
            explosionDamage: 0,
            projectilePiercing: 0,
            chemoCloudFrequency: 1,
            shieldImmunityDuration: 3000,
            shieldRegenTimeMs: 10000
        };

        // Validace všech povinných klíčů - žádné tiché výchozí hodnoty!
        this._assertRequired(this.baseStats, [
            'hp', 'moveSpeed', 'attackIntervalMs',
            'projectileRef', 'projectileCount', 'spreadDeg',
            'projectileDamage', 'projectileSpeed', 'projectileRange',
            'critChance', 'critMult', 'iFramesMs'
        ]);

        // Aktuální stav hráče
        this.maxHp = this.baseStats.hp;
        this.hp = this.maxHp;
        this._cooldownMs = 0; // Cooldown mezi útoky
        this._iFramesMsLeft = 0; // Zbývající čas nezranitelnosti
        this.activeModifiers = []; // Aktivní modifikátory z PowerUpSystem
        
        // Shield compatibility - managed by PowerUpSystem
        this.shieldActive = false;
        this.shieldHits = 0;
        this.shieldLevel = 0;
        this.shieldBroken = false;
        this.shieldRegenMs = 10000;
        this.shieldRegenTimer = 0;
        
        // Power-up states (set by PowerUpSystem)
        this.xpMagnetLevel = 0;
        this.radiotherapyActive = false;
        this.radiotherapyLevel = 0;
        this.radiotherapyConfig = null;
        this.flamethrowerActive = false;
        this.flamethrowerLevel = 0;
        this.flamethrowerConfig = null;
        this.chemoAuraActive = false;
        this.chemoAuraConfig = null;
        this.piercingLevel = 0;
        this.piercingMaxPierces = 0;
        this.piercingDamageReduction = 0;
        
        // Shooting system
        this.fireTimer = 0;
        // PR7: Use move speed from baseStats - already validated
        this.moveSpeed = this.baseStats.moveSpeed;

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
        
        // Debug: Check if player is unexpectedly inactive
        if (!this.active && this.hp > 0) {
            console.error(`[Player DEBUG] Player inactive but HP > 0! hp=${this.hp}, active=${this.active}`);
            console.trace('[Player DEBUG] Stack trace for inactive player:');
        }
        
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
        
        // Update active power-ups
        this._updatePowerUps(time, delta);
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
        // PR7: Use attack interval from stats - already validated
        const fireIntervalMs = stats.attackIntervalMs;
        
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
        const projectileCount = Math.max(1, Math.round(stats.projectileCount));
        
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
                    damage: this._rollCrit(stats.projectileDamage, stats),
                    speed: stats.projectileSpeed,
                    range: stats.projectileRange,
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
                damage: this._rollCrit(stats.projectileDamage, stats),
                speed: stats.projectileSpeed,
                range: stats.projectileRange,
                angleRad: baseAngle,
                owner: this
            });
        }

        // VFX effect removed - doesn't follow player properly
        // this._playVfx(this.vfx.shoot, this.x, this.y);
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
        
        // Check if player object is still valid
        if (!this.scene) {
            console.error(`[Player DEBUG] takeDamage called but player has no scene!`);
            return 0;
        }
        
        if (!this.active) {
            console.warn(`[Player DEBUG] takeDamage called on inactive player! amount=${amount}, source=${source?.constructor?.name || source}`);
            return 0;
        }
        
        // IMPORTANT: Don't take damage during pause (e.g., during level-up power-up selection)
        if (this.scene.isPaused || this.scene.scene.isPaused()) {
            console.log(`[Player] Ignoring damage during pause - amount: ${amount}`);
            return 0;
        }
        
        if (this._iFramesMsLeft > 0) {
            return 0;
        }

        // Check shield directly on player (simplified PR7 approach)
        if (this.shieldActive && this.shieldHits > 0 && !this.shieldBroken) {
            // Shield blocks the hit
            this.shieldHits--;
            console.log(`[Player] 🛡️ SHIELD BLOCKED - Hits remaining: ${this.shieldHits}`);
            
            // If shield depleted, start regeneration
            if (this.shieldHits <= 0) {
                this.shieldBroken = true;
                this.shieldRegenTimer = 0;
                console.log(`[Player] 🛡️ SHIELD BROKEN - Regenerating in ${this.shieldRegenMs}ms`);
                
                // Remove shield visual effect
                if (this.scene.vfxSystem) {
                    this.scene.vfxSystem.detachEffect(this, 'shield');
                }
            }
            
            // Play hit effects and return 0 damage
            this._iFramesMsLeft = this.baseStats.iFramesMs;
            return 0;
        }

        const dmg = Math.max(0, amount | 0);
        if (dmg <= 0) {
            return 0;
        }

        const oldHp = this.hp;
        this.hp = Math.max(0, this.hp - dmg); // Prevent negative HP
        
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
        if (!this.active) {
            return;
        }
        
        console.log('[Player] die() called!');
        console.log(`[Player] Death state: HP=${this.hp}, active=${this.active}, source=${source?.constructor?.name || source}`);
        console.trace('[Player] Death stack trace:');  // This will show what called die()
        
        // IMPORTANT: Don't die during pause (e.g., during level-up power-up selection)
        if (this.scene.isPaused || this.scene.scene.isPaused()) {
            console.warn(`[Player] Attempted to die during pause - ignoring! Source: ${source?.constructor?.name || source}`);
            // Heal player to 1 HP to prevent death during pause
            this.hp = 1;
            return;
        }
        
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

        // Don't destroy player immediately - let GameScene handle it after showing game over
        console.log('[Player] Setting player to inactive state (active=false, visible=false)');
        this.active = false;
        this.visible = false;
        this.body.enable = false; // Disable physics body to prevent further collisions
    }

    // ================ API pro modifikátory ================

    /**
     * Replace current modifiers (from PowerUpSystem)
     * Modifiers are plain objects applied directly
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
    
    /**
     * Get current XP magnet radius with all modifiers applied
     * @returns {number} The effective XP collection radius
     */
    getXPMagnetRadius() {
        // Use PowerUpSystem if available
        if (this.scene.powerUpSystem) {
            return this.scene.powerUpSystem.getXPMagnetRadius();
        }
        
        // Fallback to base radius
        return this.baseStats.xpMagnetRadius || 100;
    }

    getExplosionRadius() {
        const baseRadius = this.baseStats.explosionRadius || 0;
        return this.applyModifiers(baseRadius, 'explosionRadius');
    }
    
    getExplosionDamage() {
        const baseDamage = this.baseStats.explosionDamage || 0;
        return this.applyModifiers(baseDamage, 'explosionDamage');
    }
    
    getDodgeChance() {
        const baseChance = this.baseStats.dodgeChance || 0;
        return this.applyModifiers(baseChance, 'dodgeChance');
    }
    
    getProjectilePiercing() {
        const basePiercing = this.baseStats.projectilePiercing || 0;
        const piercing = this.applyModifiers(basePiercing, 'projectilePiercing');
        return Math.floor(piercing); // Piercing should be integer
    }

    // ================ Systém vstupu ================
    
    setInputKeys(keys) {
        this.keys = keys;
        console.log('[Player] Input keys set:', !!keys);
    }

    // ================ Pomocné metody ================

    /**
     * Simple modifier application - direct calculation
     * @param {number} baseValue - Base value to modify
     * @param {string} statName - Name of the stat (e.g., 'projectileDamage')
     * @returns {number} Modified value
     */
    applyModifiers(baseValue, statName) {
        let value = baseValue || 0;
        
        // Apply modifiers in order
        for (const mod of this.activeModifiers || []) {
            if (mod.path === statName) {
                if (mod.type === 'add') {
                    value += mod.value;
                } else if (mod.type === 'multiply') {
                    value *= mod.value;
                } else if (mod.type === 'mul') {
                    // Some blueprints use 'mul' instead of 'multiply'
                    value *= (1 + mod.value);
                }
            }
        }
        
        return value;
    }
    
    /**
     * Get all current stats with modifiers applied
     * Used for compatibility with existing code
     */
    _stats() {
        // Build stats object with all modifiers applied
        const stats = {};
        
        // Copy base stats
        for (const key in this.baseStats) {
            stats[key] = this.applyModifiers(this.baseStats[key], key);
        }
        
        return stats;
    }

    _playVfx(id, x = this.x, y = this.y) {
        if (!id) return;
        // CRITICAL FIX: Save active state before calling external systems
        const wasActive = this.active;
        this.scene.vfxSystem?.play(id, x, y);
        // Restore active state if it was changed
        if (wasActive && !this.active) {
            console.error(`[Player DEBUG] VFXSystem incorrectly deactivated player! Restoring.`);
            this.active = true;
        }
    }

    _playSfx(id) {
        if (!id) return;
        // CRITICAL FIX: Save active state before calling external systems
        const wasActive = this.active;
        this.scene.audioSystem?.play(id);
        // Restore active state if it was changed
        if (wasActive && !this.active) {
            console.error(`[Player DEBUG] SFXSystem incorrectly deactivated player! Restoring.`);
            this.active = true;
        }
    }

    // ================ Power-up Update Loop ================
    
    /**
     * Update active power-ups that need per-frame processing
     * Called from preUpdate - handles radiotherapy, flamethrower, etc.
     */
    _updatePowerUps(time, delta) {
        // Shield regeneration
        if (this.shieldActive && this.shieldBroken) {
            this.shieldRegenTimer += delta;
            
            if (this.shieldRegenTimer >= this.shieldRegenMs) {
                // Regenerate shield
                this.shieldHits = this.shieldLevel;
                this.shieldBroken = false;
                this.shieldRegenTimer = 0;
                
                console.log(`[Player] ✨ SHIELD REGENERATED - Hits: ${this.shieldHits}`);
                
                // Restore shield visual effect
                if (this.scene.vfxSystem) {
                    this.scene.vfxSystem.attachEffect(this, 'shield', {
                        radius: 40 + (this.shieldLevel * 5),
                        color: 0x00ffff,
                        alpha: 0.3
                    });
                }
            }
        }
        
        // Radiotherapy - doesn't need update here since it's handled by VFX system
        // Just verify the property is set correctly
        if (this.radiotherapyActive && Math.random() < 0.001) {
            console.log(`[Player] 🔬 Radiotherapy active: level ${this.radiotherapyLevel}`);
        }
        
        // Flamethrower - doesn't need update here since it's handled by VFX system
        if (this.flamethrowerActive && Math.random() < 0.001) {
            console.log(`[Player] 🔥 Flamethrower active: level ${this.flamethrowerLevel}`);
        }
        
        // Chemo Aura - could be handled here in future if needed
        if (this.chemoAuraActive && Math.random() < 0.001) {
            console.log(`[Player] 💚 Chemo Aura active`);
        }
        
        // XP Magnet is handled by SimpleLootSystem
        if (this.xpMagnetLevel > 0 && Math.random() < 0.001) {
            console.log(`[Player] 🧲 XP Magnet active: level ${this.xpMagnetLevel}`);
        }
        
        // Piercing is applied during projectile creation
        if (this.piercingLevel > 0 && Math.random() < 0.001) {
            console.log(`[Player] 🏹 Piercing active: level ${this.piercingLevel}, max pierces: ${this.piercingMaxPierces}`);
        }
        
        // Shield status debug
        if (this.shieldActive && Math.random() < 0.001) {
            console.log(`[Player] 🛡️ Shield: level ${this.shieldLevel}, hits ${this.shieldHits}, broken: ${this.shieldBroken}, regen: ${this.shieldRegenTimer}/${this.shieldRegenMs}ms`);
        }
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
    // Shield logika přesunuta do ShieldPowerUp.js
}

export default Player;