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
        
        // Use texture from blueprint or fallback
        const textureKey = blueprint.texture || blueprint.type || 'enemy';
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
        const enemyDepth = scene.DEPTH_LAYERS?.ENEMIES || CR.get('layers.enemies', { defaultValue: 1000 });
        this.setDepth(enemyDepth);
        
        // Visibility
        this.setVisible(true).setActive(true);
        this.setAlpha(1.0);
        
        // Apply tint
        if (blueprint.color && typeof blueprint.color === 'number') {
            this.setTint(blueprint.color);
        } else if (this.isElite) {
            const eliteTint = CR.get('enemy.rendering.eliteTint', { defaultValue: 0xffdd00 });
            this.setTint(eliteTint);
        } else if (this.isUnique && blueprint.visuals?.tint) {
            this.setTint(blueprint.visuals.tint);
        }
        
        // Physics setup
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.setAllowGravity(false);
        this.body.setCollideWorldBounds(false);
        
        // Circular collision
        const radius = Math.max(6, Math.floor(Math.min(this.displayWidth, this.displayHeight) * 0.45));
        this.setCircle(radius);
        
        // Initialize disposables for timers
        if (scene.disposableRegistry) {
            this.disposables = scene.disposableRegistry.create(this);
        }
        
        // Store spawn position for patrol behavior
        this.spawnX = x;
        this.spawnY = y;

        // Reusable position buffer — avoids allocating {x,y} every getPos() call
        this._posBuffer = { x: 0, y: 0 };
        
        // Cooldowns
        this.lastShootTime = 0;
        this.flashTween = null;
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
        const cooldown = opts.cooldown || 500;
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
        
        // Track for cleanup if disposables available
        if (this.disposables?.trackTimer) {
            this.disposables.trackTimer(timer);
        }
        
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

        // VFX/SFX
        this.spawnVfx('hit');
        this.playSfx('hit');
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
    }
    
    /**
     * Flash effect when hit
     */
    flashEffect() {
        if (this.flashTween) return;

        const originalTint = this.tintTopLeft;
        this.setTint(0xffffff);

        // Use scene.time for pause-aware flash reset (no tween needed for simple tint toggle)
        if (this.scene?.time) {
            this.flashTween = this.scene.time.delayedCall(100, () => {
                this.flashTween = null;
                if (this.active) this.setTint(originalTint || 0xffffff);
            });
        } else {
            this.setTint(originalTint);
        }
    }
    
    // update(dt) removed — empty stub was called every frame from Enemy/Boss for no effect
    
    /**
     * Clean up
     */
    cleanup() {
        // Cancel tweens
        if (this.flashTween) {
            if (this.flashTween.destroy) this.flashTween.destroy();
            else if (this.flashTween.remove) this.flashTween.remove();
            this.flashTween = null;
        }
        
        // Dispose timers
        if (this.disposables) {
            this.disposables.disposeAll();
        }
        
        // NOTE: Do NOT call destroy() here - causes infinite recursion!
    }
    
    destroy() {
        this.cleanup();
        super.destroy();
    }
}

export default EnemyCore;