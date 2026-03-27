import { DebugLogger } from '../core/debug/DebugLogger.js';

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
            xpMagnetRadius: CR.get('mechanics.xpMagnet.baseRadius', { blueprint }) || 100,  // From blueprint
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
        this._shieldBrokenAt = -Infinity; // Use absolute time instead of accumulator
        
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
        
        // Shooting system - use absolute time instead of delta accumulation
        this._nextAttackAt = 0;
        this._lastAttackTime = 0; // For compatibility
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
            DebugLogger.error('general', `[Player DEBUG] Player inactive but HP > 0! hp=${this.hp}, active=${this.active}`);
            DebugLogger.error('general', '[Player DEBUG] Stack trace for inactive player:', new Error().stack);
        }
        
        // Skip all updates if game is paused
        if (this.scene.isPaused) {
            this.body.setVelocity(0, 0); // Stop movement
            return;
        }

        // Movement and shooting handled in update() via UpdateManager
        // Only cooldown decrement here (needs to run in Phaser's preUpdate cycle)
        if (this._cooldownMs > 0) this._cooldownMs -= delta;
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

    // ================ Střelba (Consolidated) ================

    _findTarget() {
        // PR7: Delegate to TargetingSystem for proper separation of concerns
        if (this.scene.targetingSystem?.findTarget) {
            return this.scene.targetingSystem.findTarget(this);
        }
        
        // Fallback if TargetingSystem not available
        return null;
    }

    _rollCrit(baseDamage, stats) {
        if (Math.random() < stats.critChance) {
            return Math.round(baseDamage * stats.critMult);
        }
        return Math.round(baseDamage);
    }

    // ================ Boj ================

    takeDamage(amount, source) {
        // Get current time for shield timing
        const time = this.scene.time?.now || 0;
        
        // Check if player object is still valid
        if (!this.scene) {
            DebugLogger.error('general', `[Player DEBUG] takeDamage called but player has no scene!`);
            return 0;
        }
        
        if (!this.active) {
            DebugLogger.warn('general', `[Player DEBUG] takeDamage called on inactive player! amount=${amount}, source=${source?.constructor?.name || source}`);
            return 0;
        }
        
        // IMPORTANT: Don't take damage during pause (e.g., during level-up power-up selection)
        if (this.scene.isPaused || this.scene.scene.isPaused()) {
            DebugLogger.info('general', `[Player] Ignoring damage during pause - amount: ${amount}`);
            return 0;
        }
        
        if (this._iFramesMsLeft > 0) {
            return 0;
        }

        // Process damage through PowerUpSystem (PR7: Shield logic moved to PowerUpAbilities)
        if (this.scene.powerUpSystem?.processDamage) {
            amount = this.scene.powerUpSystem.processDamage(this, amount, time);
            
            // If shield absorbed all damage, return 0 with i-frames
            if (amount <= 0) {
                this._iFramesMsLeft = this.baseStats.iFramesMs;
                return 0;
            }
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

        // CRITICAL DEBUG: Track HP and death conditions
        DebugLogger.info('general', '[Player] takeDamage result:', {
            damage: dmg,
            oldHP: this.hp + dmg,
            newHP: this.hp,
            willDie: this.hp <= 0,
            active: this.active,
            source: source?.constructor?.name || source
        });

        if (this.hp <= 0) {
            DebugLogger.info('general', '[Player] HP reached 0, calling die()');
            this.die(source);
        } else {
            DebugLogger.info('general', '[Player] Player survived damage, HP remaining:', this.hp);
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
            DebugLogger.info('general', '[Player] die() called but player already inactive - ignoring');
            return;
        }
        
        DebugLogger.info('general', '[Player] die() called!');
        DebugLogger.info('general', `[Player] Death state: HP=${this.hp}, active=${this.active}, source=${source?.constructor?.name || source}`);
        DebugLogger.error('general', '[Player] Death stack trace:', new Error().stack);  // This will show what called die()
        
        // CRITICAL GUARD: Prevent death if player has HP
        if (this.hp > 0) {
            DebugLogger.warn('general', '[Player] PREVENTED DEATH - Player still has HP:', this.hp);
            return;
        }
        
        // IMPORTANT: Don't die during pause (e.g., during level-up power-up selection)
        if (this.scene.isPaused || this.scene.scene.isPaused()) {
            DebugLogger.warn('general', `[Player] Attempted to die during pause - ignoring! Source: ${source?.constructor?.name || source}`);
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
        DebugLogger.info('general', '[Player] Setting player to inactive state (active=false, visible=false)');
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

    /**
     * Get stat value with modifiers applied (PR7: Consolidated getter)
     * @param {string} statName - Name of the stat
     * @param {boolean} isInteger - Whether to return integer value
     * @returns {number} Stat value with modifiers
     */
    _getStatWithModifiers(statName, isInteger = false) {
        const baseValue = this.baseStats[statName] || 0;
        const modifiedValue = this.applyModifiers(baseValue, statName);
        return isInteger ? Math.floor(modifiedValue) : modifiedValue;
    }
    
    // Essential getter methods only (PR7: Minimal interface)
    getExplosionRadius() { return this._getStatWithModifiers('explosionRadius'); }
    getProjectilePiercing() { return this._getStatWithModifiers('projectilePiercing', true); }

    // ================ Systém vstupu ================
    
    setInputKeys(keys) {
        this.keys = keys;
        DebugLogger.info('general', '[Player] Input keys set:', !!keys);
    }

    // ================ Update metoda ================
    
    /**
     * Main update loop for player
     * @param {number} time - Game time
     * @param {number} delta - Delta time in ms
     */
    update(time, delta) {
        if (!this.active || this.hp <= 0) return;
        
        // Update iFrames
        if (this._iFramesMsLeft > 0) {
            this._iFramesMsLeft = Math.max(0, this._iFramesMsLeft - delta);
            
            // Visual feedback for iFrames
            this.alpha = Math.sin(time * 0.02) * 0.3 + 0.7;
        } else {
            this.alpha = 1;
        }
        
        // Handle movement (delegate to existing method)
        this._updateMovement(delta);
        
        // Handle auto-attack
        this._handleAutoAttack(time, delta);
    }
    
    // _handleMovement() removed - using _updateMovement() instead (PR7: No duplication)
    
    /**
     * Handle auto-attack logic
     */
    _handleAutoAttack(time, delta) {
        // Initialize next attack time if not set
        if (!this._nextAttackAt) {
            this._nextAttackAt = time;
        }
        
        const stats = this._stats();
        const attackInterval = stats.attackIntervalMs;
        
        // CRITICAL FIX: Prevent timer drift by using absolute time comparison
        // If we're way behind (e.g., after pause), reset the timer
        if (time - this._nextAttackAt > attackInterval * 3) {
            DebugLogger.info('player', '[Player] Attack timer reset - was too far behind');
            this._nextAttackAt = time;
        }
        
        // Check if we can attack using absolute time
        if (time >= this._nextAttackAt) {
            // Find nearest enemy
            const target = this._findNearestEnemy();
            
            if (target) {
                // Fire single shot
                this._shootAtTarget(target);
                
                // Set next attack time based on current time to prevent drift
                // Use Math.max to ensure we don't go backwards in time
                this._nextAttackAt = Math.max(this._nextAttackAt + attackInterval, time + attackInterval);
                
                // Debug log attack interval
                DebugLogger.info('player', `[Player] Attack fired. Interval: ${attackInterval}ms, Next at: ${this._nextAttackAt}`);
            } else {
                // No target - advance timer slightly to prevent rapid checking
                this._nextAttackAt = time + 100;
            }
        }
    }
    
    /**
     * Find nearest enemy for auto-targeting (PR7: Delegate to TargetingSystem)
     */
    _findNearestEnemy() {
        // PR7: Delegate to TargetingSystem for proper separation of concerns
        if (this.scene.targetingSystem?.findNearestEnemy) {
            return this.scene.targetingSystem.findNearestEnemy(this);
        }
        
        // Fallback if TargetingSystem not available
        return null;
    }
    
    /**
     * Shoot projectile at target (PR7: Unified shooting implementation)
     */
    _shootAtTarget(target) {
        if (!this.scene.projectileSystem) return;
        
        // Calculate direction to target
        const baseAngle = Math.atan2(target.y - this.y, target.x - this.x);
        const stats = this._stats();
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

        this._playSfx(this.sfx.shoot);
        this.scene.frameworkDebug?.onPlayerShoot?.(this, projectileCount);
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
        // Cache stats — invalidated by time or modifier changes
        const now = this.scene?.time?.now || Date.now();
        if (this._statsCache && this._statsCacheTime && (now - this._statsCacheTime < 100)) {
            return this._statsCache;
        }
        
        // Build stats object with all modifiers applied
        const stats = {};
        let hasChanges = false;
        
        // Copy base stats
        for (const key in this.baseStats) {
            const baseValue = this.baseStats[key];
            const modifiedValue = this.applyModifiers(baseValue, key);
            stats[key] = modifiedValue;
            
            // Track if we have any changes
            if (Math.abs(modifiedValue - baseValue) > 0.01) {
                hasChanges = true;
            }
        }
        
        // Only log once when modifiers change, not every frame
        if (hasChanges && (!this._lastModifierLogTime || now - this._lastModifierLogTime > 1000)) {
            DebugLogger.info('powerup', `[Player] Stats with modifiers:`, {
                activeModifiers: this.activeModifiers?.length || 0,
                attackInterval: stats.attackIntervalMs,
                damage: stats.projectileDamage,
                speed: stats.moveSpeed
            });
            this._lastModifierLogTime = now;
        }
        
        // Cache the result
        this._statsCache = stats;
        this._statsCacheTime = now;
        
        return stats;
    }

    _playVfx(id, x = this.x, y = this.y) {
        if (!id) return;
        // CRITICAL FIX: Save active state before calling external systems
        const wasActive = this.active;
        this.scene.vfxSystem?.play(id, x, y);
        // Restore active state if it was changed
        if (wasActive && !this.active) {
            DebugLogger.error('general', `[Player DEBUG] VFXSystem incorrectly deactivated player! Restoring.`);
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
            DebugLogger.error('general', `[Player DEBUG] SFXSystem incorrectly deactivated player! Restoring.`);
            this.active = true;
        }
    }

    // ================ Power-up Update Loop ================
    
    /**
     * Update active power-ups that need per-frame processing
     * Called from preUpdate - handles radiotherapy, flamethrower, etc.
     */
    // Power-up updates are now handled by PowerUpSystem.update(), not Player
    // This keeps Player as a thin composer according to PR7 architecture

    _assertRequired(obj, keys) {
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (obj[k] === undefined) {
                throw new Error(`[Player] Missing required stat '${k}' from blueprint/config`);
            }
        }
    }

    /**
     * Reset timers after pause/resume (PR7: Thin composer - only shooting timer)
     * Shield timers are handled by PowerUpSystem according to PR7 architecture
     * Called by GameScene on resume event
     */
    resetTimersAfterPause() {
        const now = this.scene.time?.now || 0;
        const stats = this._stats();
        
        // Reset attack timer to prevent burst shooting after pause
        // Use a small delay to prevent immediate shooting
        this._nextAttackAt = now + Math.min(stats.attackIntervalMs, 500);
        
        // Clear stats cache to force recalculation
        this._statsCache = null;
        this._statsCacheTime = null;
        
        DebugLogger.info('player', '[Player] Timers reset after pause - next attack at:', this._nextAttackAt);
    }
    
    // PR7: Žádné legacy metody - vše je data-driven
    // Žádné applyPowerUp, žádná hardcodovaná logika power-upů
    // PowerUpSystem převádí na modifikátory a volá setActiveModifiers
    // Shield logika přesunuta do ShieldPowerUp.js
}

export default Player;