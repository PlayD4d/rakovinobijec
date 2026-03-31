import { DebugLogger } from '../../core/debug/DebugLogger.js';
import { getSession } from '../../core/debug/SessionLog.js';

/**
 * EnemyCore.js - Core enemy functionality with Phaser integration
 * 
 * Handles all Phaser API calls, physics, damage, VFX/SFX
 * Provides capability interface for behaviors
 */

export class EnemyCore extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, blueprint, spawnOpts) {
        // Validate required systems
        if (!scene) throw new Error('[EnemyCore] Missing scene');
        if (!scene.configResolver) throw new Error('[EnemyCore] Missing ConfigResolver - PR7 requires DI');
        
        // Use texture from blueprint, spawnOpts, or fallback
        const textureKey = blueprint.texture || spawnOpts?.texture || blueprint.type || 'enemy';
        const x = spawnOpts?.x || 0;
        const y = spawnOpts?.y || 0;
        
        super(scene, x, y, textureKey);
        
        // Basic references
        this.scene = scene;
        this.blueprintId = blueprint.id;
        this.type = blueprint.type || 'enemy';
        this.blueprint = blueprint;
        
        // ConfigResolver via DI
        const CR = scene.configResolver;
        
        // VFX/SFX data from blueprint
        this._vfx = blueprint.vfx || {};
        this._sfx = blueprint.sfx || {};
        
        // Stats from blueprint
        this.hp = blueprint.stats?.hp || blueprint.hp || 50;
        this.maxHp = this.hp;
        this.speed = blueprint.stats?.speed || blueprint.speed || 100;
        this.damage = blueprint.stats?.damage || blueprint.damage || 10;
        this.armor = blueprint.stats?.armor || blueprint.armor || 0;
        this.xp = blueprint.stats?.xp || blueprint.xp || 3;
        this.size = blueprint.stats?.size || blueprint.size || 16;
        
        // Elite/Unique detection
        this.isElite = blueprint.isElite || blueprint.meta?.category === 'elite';
        this.isUnique = blueprint.isUnique || blueprint.meta?.category === 'unique';
        
        // AI state
        this.aiState = blueprint.ai?.initialState || 'idle';
        
        // Setup Phaser sprite (texture already set by super() constructor)
        this.setOrigin(0.5, 0.5);
        this.setDisplaySize(this.size, this.size);
        
        // Depth
        this.setDepth(scene.DEPTH_LAYERS?.ENEMIES || 1000);
        
        // Visibility
        this.setVisible(true).setActive(true);
        this.setAlpha(1.0);
        
        // Apply tint — blueprint-specified tint takes priority over tier defaults
        const bpTint = blueprint.graphics?.tint ?? blueprint.visuals?.tint ?? blueprint.color;
        if (bpTint && typeof bpTint === 'number') {
            this.setTint(bpTint);
        } else if (this.isElite) {
            this.setTint(0xffdd00); // Elite gold fallback
        }
        
        // Add to display list only — physics body created by group.add() in EnemyManager
        scene.add.existing(this);

        // Per-enemy timer tracking for cleanup on death
        this._trackedTimers = [];

        // Store spawn position for patrol behavior
        this.spawnX = x;
        this.spawnY = y;

        // Reusable position buffer — avoids allocating {x,y} every getPos() call
        this._posBuffer = { x: 0, y: 0 };

        // Cooldowns
        this.lastShootTime = 0;
        this._flashTimer = null;
    }
    
    // ========= CAPABILITY METHODS =========
    
    /**
     * Get current position
     * @returns {{x: number, y: number}}
     */
    getPos() {
        this._posBuffer.x = this.x;
        this._posBuffer.y = this.y;
        return this._posBuffer;
    }
    
    /**
     * Set velocity
     * @param {number} vx - X velocity
     * @param {number} vy - Y velocity
     */
    setVelocity(vx, vy) {
        if (this.body) {
            this.body.setVelocity(vx, vy);
        }
    }
    
    /**
     * Face towards position
     * @param {number} x - Target X
     * @param {number} y - Target Y
     */
    faceTo(x, y) {
        this.rotation = Math.atan2(y - this.y, x - this.x);
    }
    
    /**
     * Check if player is in range
     * @param {number} range - Detection range
     * @returns {boolean}
     */
    inRangeOfPlayer(range) {
        const player = this.scene.player;
        if (!player || !player.active) return false;

        const dx = this.x - player.x;
        const dy = this.y - player.y;
        return (dx * dx + dy * dy) <= range * range;
    }
    
    /**
     * Shoot projectile with normalized velocity
     * @param {string} patternId - Projectile pattern ID
     * @param {Object} opts - Additional options
     */
    shoot(patternId, opts = {}) {
        if (!this.scene.projectileSystem) return;
        
        const player = this.scene.player;
        if (!player || !this.active) return;
        
        // Check cooldown (use scene time only — Date.now is incompatible with pause)
        const now = this.scene.time?.now || 0;
        if (!now) return;
        const cooldown = opts.cooldown ?? 500;
        if (now - this.lastShootTime < cooldown) return;

        this.lastShootTime = now;
        
        // Calculate normalized direction to player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const len = Math.hypot(dx, dy) || 1; // Zero-distance guard
        const dirX = dx / len;
        const dirY = dy / len;
        
        // Get speed from blueprint/pattern/opts
        const speed = opts.speed ?? 
                      this.blueprint?.combat?.bulletSpeed ?? 
                      220;
        
        // Get damage from blueprint with proper fallback
        const damage = opts.damage ?? 
                      this.damage ?? 
                      this.blueprint?.stats?.damage ?? 
                      this.blueprint?.combat?.bulletDamage ?? 
                      8; // Fallback damage value
        
        // Create projectile with normalized velocity
        this.scene.projectileSystem.createEnemyProjectile({
            x: this.x,
            y: this.y,
            velocity: { x: dirX * speed, y: dirY * speed }, // Normalized!
            pattern: patternId,
            damage: damage,
            owner: this,
            ...opts
        });

        // Session log: enemy shoot event
        getSession()?.log('combat', 'enemy_shoot', { enemyId: this.blueprintId, pattern: patternId, damage, speed });

        // Play shoot SFX
        this.playSfx('shoot');
    }
    
    /**
     * Play sound effect
     * @param {string} id - SFX type (hit, death, shoot)
     * @param {Object} opts - Additional options
     */
    playSfx(id, opts = {}) {
        if (!this.scene.audioSystem) return;
        
        // Get SFX from blueprint or use placeholder
        const sfxPath = this._sfx[id];
        if (sfxPath) {
            this.scene.audioSystem.play(sfxPath, opts);
        } else if (this.scene.audioSystem.playPlaceholder) {
            // Use placeholder if available
            this.scene.audioSystem.playPlaceholder(`sfx.placeholder.${id}`, opts);
        }
    }
    
    /**
     * Spawn visual effect
     * @param {string} id - VFX type (spawn, hit, death)
     * @param {{x: number, y: number}} at - Position
     * @param {Object} opts - Additional options
     */
    spawnVfx(id, at, opts = {}) {
        const vfxSystem = this.scene.vfxSystem;
        if (!vfxSystem) return;

        // Accept both {x,y} object and (x, y) number arguments
        let pos;
        if (typeof at === 'number') {
            pos = { x: at, y: opts };
            opts = {};
        } else {
            pos = at || this.getPos();
        }

        const vfxId = this._vfx[id] || id;
        if (vfxId) {
            vfxSystem.play(vfxId, pos.x, pos.y, opts);
        }
    }
    
    /**
     * Schedule delayed action
     * @param {Function} fn - Function to execute
     * @param {number} ms - Delay in milliseconds
     * @returns {any} Timer reference
     */
    schedule(fn, ms) {
        const timer = this.scene.time.delayedCall(ms, fn);
        this._trackedTimers.push(timer);
        return timer;
    }
    
    /**
     * Set AI state
     * @param {string} state - New state
     */
    setState(state) {
        this.aiState = state;
    }
    
    /**
     * Get current AI state
     * @returns {string}
     */
    getState() {
        return this.aiState || 'idle';
    }
    
    /**
     * Check if alive
     * @returns {boolean}
     */
    isAlive() {
        return this.active && this.hp > 0;
    }
    
    // ========= COMBAT PIPELINE =========
    
    /**
     * Take damage
     * @param {{amount: number, source: any, type: string}} hit - Damage info
     */
    takeDamage(hit) {
        if (!this.active) return 0;
        if (this._invulnerable) return 0;

        const isObj = hit != null && typeof hit === 'object';
        let amount = isObj ? (hit.amount ?? 0) : (hit ?? 0);
        const source = isObj ? hit.source : null;

        // Apply armor reduction
        if (this.armor > 0) {
            amount = Math.max(1, amount - this.armor);
        }

        // Apply damage
        this.hp -= amount;
        getSession()?.damage(source || 'player', this.blueprintId || this.blueprint?.id, amount, 'hit');

        // Floating damage number
        this._showDamageNumber(amount);

        // VFX/SFX (skip hit VFX when dying — death VFX handles it)
        if (this.hp > 0) {
            this.spawnVfx('hit');
        }
        // Throttle hit SFX — max 1 per 150ms per enemy to prevent sound spam
        const now = this.scene?.time?.now || 0;
        if (now - (this._lastHitSfx || 0) >= 150) {
            this._lastHitSfx = now;
            this.playSfx('hit');
        }
        this.flashEffect();

        // Check death
        if (this.hp <= 0) {
            this.die(source);
        }

        return amount;
    }
    
    /**
     * Handle death
     * @param {any} killer - What killed this enemy
     */
    die(killer) {
        if (!this.active) return;

        // Deactivate immediately to prevent double-die and further collision
        this.setActive(false);
        this.setVisible(false);
        if (this.body) this.body.setEnable(false);

        // Process death (XP, loot, stats, VFX, SFX) — all in one place
        if (this.scene?.handleEnemyDeath) {
            this.scene.handleEnemyDeath(this);
        }

        // Immediately clean up timers and behaviors (no 10s zombie window)
        this.cleanup();
    }
    
    /**
     * Flash effect when hit
     */
    flashEffect() {
        // Always show flash — restart timer if already running (don't skip)
        const originalTint = this._originalTint ?? this.tintTopLeft;
        if (!this._flashTimer) {
            this._originalTint = this.tintTopLeft;
        }
        this.setTint(0xffffff);

        // Cancel previous timer and start fresh (allows rapid re-triggering)
        if (this._flashTimer) {
            this._flashTimer.destroy();
        }

        if (this.scene?.time) {
            this._flashTimer = this.scene.time.delayedCall(80, () => {
                this._flashTimer = null;
                this._originalTint = null;
                if (this.active) this.setTint(originalTint || 0xffffff);
            });
        } else {
            this.setTint(originalTint);
        }
    }
    
    /**
     * Show floating damage number above enemy
     */
    _showDamageNumber(amount) {
        if (!this.scene?.add || amount <= 0) return;
        // Throttle — max 1 number per 100ms per enemy
        const now = this.scene.time?.now || 0;
        if (now - (this._lastDmgNum || 0) < 100) return;
        this._lastDmgNum = now;

        const jitterX = (Math.random() - 0.5) * 20;
        const txt = this.scene.add.text(this.x + jitterX, this.y - 15, `${Math.floor(amount)}`, {
            fontFamily: 'Public Pixel, monospace',
            fontSize: amount >= 20 ? '14px' : '11px',
            color: amount >= 20 ? '#ffaa00' : '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(this.scene.DEPTH_LAYERS?.VFX || 4000).setScrollFactor(0);

        // Drift up and fade out
        this.scene.tweens.add({
            targets: txt, y: txt.y - 30, alpha: 0,
            duration: 600, ease: 'Power2',
            onComplete: () => txt.destroy()
        });
    }

    
    /**
     * Clean up
     */
    cleanup() {
        // Kill any external tweens targeting this sprite (VFX, loot animations, etc.)
        if (this.scene?.tweens) {
            this.scene.tweens.killTweensOf(this);
        }

        // Cancel flash timer
        if (this._flashTimer) {
            try { this._flashTimer.destroy?.(); } catch (_) {}
            this._flashTimer = null;
        }

        // Cancel aura slow timer (set externally by DamageZoneAbilities)
        if (this._auraSlowTimer) {
            try { this._auraSlowTimer.destroy?.(); } catch (_) {}
            this._auraSlowTimer = null;
            this._auraSlowOrigSpeed = null;
        }

        // Cancel all tracked timers
        if (this._trackedTimers) {
            for (let i = 0; i < this._trackedTimers.length; i++) {
                try { this._trackedTimers[i].destroy?.(); } catch (_) {}
            }
            this._trackedTimers.length = 0;
        }

        // NOTE: Do NOT call destroy() here - causes infinite recursion!
    }

    /**
     * Clean up all attached VFX effects (called by EnemyManager on death)
     */
    cleanupAllVFX() {
        if (this.scene?.vfxSystem?.detachAllEffectsForEntity) {
            this.scene.vfxSystem.detachAllEffectsForEntity(this);
        }
    }
    
    destroy() {
        this.cleanup();
        super.destroy();
    }
}

