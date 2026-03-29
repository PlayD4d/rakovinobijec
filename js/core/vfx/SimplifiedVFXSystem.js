/**
 * SimplifiedVFXSystem - Direct VFX system without registry
 * PR7 Compliant - 100% data-driven from blueprints
 * 
 * Accepts VFX configurations directly from blueprints
 * Uses VFXPresets for common effects
 */

import { VFXPresets } from './VFXPresets.js';
import { RadiotherapyEffect } from './effects/RadiotherapyEffect.js';
import { FlamethrowerEffect } from './effects/FlamethrowerEffect.js';
import { ShieldEffect } from './effects/ShieldEffect.js';
import { DebugLogger } from '../debug/DebugLogger.js';

export class SimplifiedVFXSystem {
    static _uidCounter = 0; // Unique ID counter for effect key generation

    constructor(scene) {
        this.scene = scene;
        
        // Particle emitters pool
        this.emitterPool = [];
        this.activeEmitters = new Map();
        
        // Power-up effects
        this.powerUpEffects = new Map();
        
        // Performance settings
        this.maxEmitters = 24;
        this.maxParticles = 1000;
        this._emitterCounter = 0;

        // Active telegraph sprites — tracked for cleanup on boss death / level transition
        this._activeTelegraphs = [];

        this.initialized = false;
    }
    
    /**
     * Initialize the VFX system
     */
    initialize() {
        if (this.initialized) return;
        
        // Create basic particle textures if needed
        this._createBasicTextures();
        
        // NOTE: No self-registered shutdown listener — GameScene.shutdown() calls us explicitly
        // Self-registration causes double-shutdown race with the explicit loop

        this.initialized = true;
        DebugLogger.info('vfx', '[SimplifiedVFXSystem] Initialized');
    }
    
    /**
     * Play a VFX effect
     * @param {string|object} config - Effect config or preset name
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {object} options - Additional options
     */
    play(config, x, y, options = {}) {
        // Enhanced debug for VFX troubleshooting
        DebugLogger.verbose('vfx', '[VFX] play() called:', {
            config: typeof config === 'string' ? config : Object.keys(config || {}),
            position: { x, y },
            initialized: this.initialized,
            sceneActive: !!this.scene?.sys?.isActive(),
            options
        });
        
        if (!this.initialized || !this.scene || !this.scene.sys?.isActive()) {
            DebugLogger.warn('vfx', '[VFX] Cannot play effect - system not ready');
            return null;
        }
        
        // Handle string references (presets or legacy IDs)
        if (typeof config === 'string') {
            // Check if it's a preset
            if (config.includes('.')) {
                // Extract preset name without first segment (zero-alloc: indexOf+slice instead of split/join)
                const dotIdx = config.indexOf('.');
                const presetName = config.slice(dotIdx + 1);
                const presetConfig = VFXPresets.getPreset(presetName, options.color);
                if (presetConfig) {
                    config = presetConfig;
                } else {
                    // Legacy fallback - try to extract type from ID
                    config = this._getLegacyFallback(config);
                }
            } else {
                // Direct preset name
                config = VFXPresets.getPreset(config, options.color);
            }
        }
        
        // If no config resolved, skip silently — no fallback sparks for unknown IDs
        if (!config) {
            return null;
        }
        
        // Handle different effect types
        if (config.type === 'particles' || config.particles) {
            return this._playParticles(config.particles || config.config || config, x, y, options);
        } else if (config.type === 'flash') {
            return this._playFlash(config.config || config, options);
        }
        
        return null;
    }
    
    /**
     * Play particle effect
     */
    _playParticles(config, x, y, options = {}) {
        // Check if scene is still active
        if (!this.scene || !this.scene.sys?.isActive()) return null;

        // Enforce maxEmitters — recycle oldest if at limit
        if (this.activeEmitters.size >= this.maxEmitters) {
            const oldestId = this.activeEmitters.keys().next().value;
            this._returnEmitterToPool(oldestId);
        }

        // Get or create emitter
        let emitter = this._getEmitterFromPool();
        const quantity = config.quantity || 10;

        if (!emitter) {
            // Create at origin — position set below via setPosition
            emitter = this.scene.add.particles(0, 0, 'particle', config);
        } else {
            // Reuse from pool — reset state for clean reuse
            if (emitter.follow) emitter.follow = null;
            emitter.setConfig(config);
            emitter.setVisible(true);
            emitter.setActive(true);
        }

        // Set position ONCE, then explode WITHOUT x,y to avoid double-offset
        emitter.setPosition(x, y);
        emitter.explode(quantity);

        // Track active emitter
        const emitterId = `em_${this._emitterCounter++}`;
        this.activeEmitters.set(emitterId, emitter);

        // Use Phaser's native 'complete' event for cleanup (fires when last particle dies)
        // No untracked timers — event is owned by the emitter and cleaned up with it
        emitter.once('complete', () => {
            this._returnEmitterToPool(emitterId);
        });

        return emitter;
    }
    
    /**
     * Play flash effect
     */
    _playFlash(config, options = {}) {
        const camera = this.scene.cameras.main;
        const duration = config.duration || 100;
        const alpha = config.alpha || 0.8;
        const color = config.color || 0xFFFFFF;
        
        camera.flash(duration, 
            (color >> 16) & 0xFF, // R
            (color >> 8) & 0xFF,  // G
            color & 0xFF,         // B
            alpha
        );
        
        return { type: 'flash', duration };
    }
    
    /**
     * Attach power-up effect to entity
     */
    attachEffect(entity, effectType, config = {}) {
        if (!entity || !effectType) return;
        
        if (!entity._vfxUid) entity._vfxUid = ++SimplifiedVFXSystem._uidCounter;
        const effectKey = `${entity._vfxUid}_${effectType}`;
        
        // Check if already active
        if (this.powerUpEffects.has(effectKey)) {
            const existingEffect = this.powerUpEffects.get(effectKey);
            
            // If effect has updateConfig method, update it instead of creating new one
            if (existingEffect && existingEffect.updateConfig) {
                existingEffect.updateConfig(config);
                DebugLogger.debug('vfx', `[VFX] Updated existing ${effectType} effect configuration`);
                return existingEffect;
            }
            
            // Otherwise detach old effect and create new one
            this.detachEffect(entity, effectType);
        }
        
        // Create effect based on type
        let effect = null;
        
        switch (effectType) {
            case 'shield':
                effect = new ShieldEffect(this.scene, effectType, config);
                effect.attach(entity);
                break;
                
            case 'radiotherapy':
                effect = new RadiotherapyEffect(this.scene, effectType, config);
                effect.attach(entity);
                break;
                
            case 'flamethrower':
                effect = new FlamethrowerEffect(this.scene, effectType, config);
                effect.attach(entity);
                break;
                
            default:
                // Generic particle effect that follows entity
                const particleConfig = config.particles || VFXPresets.aura(config.color);
                effect = this._createFollowingEffect(entity, particleConfig);
                break;
        }
        
        if (effect) {
            this.powerUpEffects.set(effectKey, effect);
        }
        
        return effect;
    }
    
    /**
     * Detach power-up effect from entity
     */
    detachEffect(entity, effectType) {
        if (!entity._vfxUid) return; // No effects were ever attached
        const effectKey = `${entity._vfxUid}_${effectType}`;
        
        const effect = this.powerUpEffects.get(effectKey);
        if (effect) {
            if (effect.stop) {
                effect.stop();
            } else if (effect.destroy) {
                effect.destroy();
            }
            this.powerUpEffects.delete(effectKey);
        }
    }
    
    /**
     * Detach ALL effects for a specific entity
     * Used when entity is destroyed to clean up all attached VFX
     */
    detachAllEffectsForEntity(entity) {
        if (!entity) return 0;

        // Use _vfxUid to match keys — same prefix used by attachEffect/detachEffect
        const uid = entity._vfxUid;
        if (!uid) return 0; // No effects were ever attached

        let removedCount = 0;

        // Find and remove all effects for this entity
        const keysToRemove = [];
        for (const [key, effect] of this.powerUpEffects) {
            if (key.startsWith(`${uid}_`)) {
                // Stop/destroy the effect
                if (effect) {
                    if (effect.stop) {
                        effect.stop();
                    } else if (effect.destroy) {
                        effect.destroy();
                    }
                }
                keysToRemove.push(key);
                removedCount++;
            }
        }

        // Remove from map
        for (const key of keysToRemove) this.powerUpEffects.delete(key);

        if (removedCount > 0) {
            DebugLogger.debug('vfx', `[VFX] Cleaned up ${removedCount} effects for entity uid=${uid}`);
        }

        return removedCount;
    }
    
    /**
     * Create a particle effect that follows an entity
     */
    _createFollowingEffect(entity, config) {
        const emitter = this.scene.add.particles(entity.x, entity.y, 'particle', {
            ...config.config || config,
            follow: entity
        });
        
        return {
            emitter,
            stop: () => {
                emitter.stop();
                if (this.scene && this.scene.time) {  // Check if scene and time exist
                    this.scene.time.delayedCall(1000, () => {
                        if (emitter && emitter.active) {
                            emitter.destroy();
                        }
                    });
                } else if (emitter && emitter.active) {
                    // If no time system, destroy immediately
                    emitter.destroy();
                }
            },
            destroy: () => { if (emitter?.active) emitter.destroy(); }
        };
    }
    
    /**
     * Get legacy fallback config based on effect ID pattern
     */
    _getLegacyFallback(effectId) {
        // Map common legacy IDs to presets
        if (effectId.includes('hit')) {
            if (effectId.includes('heavy') || effectId.includes('hard')) {
                return VFXPresets.mediumHit();
            }
            return VFXPresets.smallHit();
        }
        if (effectId.includes('explosion')) {
            if (effectId.includes('large')) return VFXPresets.explosion('large');
            if (effectId.includes('small')) return VFXPresets.explosion('small');
            return VFXPresets.explosion('medium');
        }
        if (effectId.includes('death')) {
            if (effectId.includes('boss')) return VFXPresets.deathBurst('large');
            if (effectId.includes('small')) return VFXPresets.deathBurst('small');
            return VFXPresets.deathBurst('medium');
        }
        if (effectId.includes('spawn')) {
            return VFXPresets.spawn();
        }
        if (effectId.includes('trail')) {
            return VFXPresets.trail();
        }
        if (effectId.includes('pickup')) {
            return VFXPresets.pickup();
        }
        if (effectId.includes('shield')) {
            return VFXPresets.shieldHit();
        }
        if (effectId.includes('muzzle')) {
            return VFXPresets.muzzleFlash();
        }
        
        // Default fallback
        return VFXPresets.smallHit();
    }
    
    /**
     * Get emitter from pool
     */
    _getEmitterFromPool() {
        if (this.emitterPool.length > 0) {
            return this.emitterPool.pop();
        }
        return null;
    }
    
    /**
     * Return emitter to pool
     */
    _returnEmitterToPool(emitterId) {
        const emitter = this.activeEmitters.get(emitterId);
        if (emitter) {
            // Kill particles but keep emitter reusable — stop(true) can leave emitter in broken state
            emitter.killAll();
            emitter.emitting = false;
            emitter.removeAllListeners('complete');
            this.activeEmitters.delete(emitterId);

            // Guard: don't pool a destroyed emitter (Phaser sets scene=null on destroy)
            if (!emitter.active || !emitter.scene) return;

            if (this.emitterPool.length < 10) {
                this.emitterPool.push(emitter);
            } else {
                emitter.destroy();
            }
        }
    }
    
    /**
     * Create basic particle textures
     */
    _createBasicTextures() {
        // Check if texture already exists
        if (this.scene.textures.exists('particle')) return;

        // PR7: Use GraphicsFactory when available, fallback to direct create
        const gf = this.scene.graphicsFactory;
        const graphics = gf ? gf.create() : this.scene.add.graphics();
        graphics.fillStyle(0xFFFFFF);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('particle', 8, 8);
        if (gf) { gf.release(graphics); } else { graphics.destroy(); }
    }
    
    /**
     * Update loop
     */
    update(time, delta) {
        // Update power-up effects
        for (const effect of this.powerUpEffects.values()) {
            if (effect && effect.update) {
                effect.update(time, delta);
            }
        }
    }
    
    /**
     * Stop all active effects without destroying the system (for level transitions)
     */
    stopAllEffects() {
        // Stop AND destroy transient particle emitters (explosions, hits, etc.)
        for (const [id, emitter] of this.activeEmitters) {
            if (!emitter.active || !emitter.scene) continue;
            emitter.stop(true); // true = kill all particles immediately
            emitter.destroy();
        }
        this.activeEmitters.clear();

        // Clear pool — emitters from previous session may be stale
        for (const emitter of this.emitterPool) {
            if (emitter.active && emitter.scene) emitter.destroy();
        }
        this.emitterPool.length = 0;

        // Clear active telegraph sprites (boss ability warnings, etc.)
        this.clearTelegraphs();

        // Preserve persistent power-up effects (radiotherapy, flamethrower, shield)
        // They survive level transitions — player keeps their power-ups
    }

    /** Destroy all active telegraph sprites — called on boss death, level transition, shutdown */
    clearTelegraphs() {
        for (let i = this._activeTelegraphs.length - 1; i >= 0; i--) {
            const s = this._activeTelegraphs[i];
            if (s?.scene) {
                this.scene.tweens.killTweensOf(s);
                s.destroy();
            }
        }
        this._activeTelegraphs.length = 0;
    }

    /**
     * Shutdown the system
     */
    shutdown() {
        // Stop all effects — guard against already-destroyed emitters
        for (const [id, emitter] of this.activeEmitters) {
            if (!emitter.active || !emitter.scene) continue;
            emitter.stop(true);
            emitter.destroy();
        }
        this.activeEmitters.clear();
        
        // Clear power-up effects
        for (const effect of this.powerUpEffects.values()) {
            if (effect.destroy) effect.destroy();
        }
        this.powerUpEffects.clear();
        
        // Clear pool
        for (const emitter of this.emitterPool) {
            emitter.destroy();
        }
        this.emitterPool = [];
    }
    
    /**
     * Destroy the system
     */
    destroy() {
        this.shutdown();
        this.scene = null;
    }
    
    // Compatibility aliases
    playHitSpark(x, y, type = 'default') {
        const color = type === 'heavy' ? 0xFFDD00 : 0xFFFFFF;
        return this.play(VFXPresets.smallHit(color), x, y);
    }
    
    playExplosion(x, y, size = 'medium') {
        return this.play(VFXPresets.explosion(size), x, y);
    }
    
    playDeathBurst(x, y, color = 0xFF2222) {
        return this.play(VFXPresets.deathBurst('medium', color), x, y);
    }

    /**
     * Multi-layer explosion effect — particle burst + expanding shockwave ring + impact flash.
     * Uses Phaser Graphics for the ring (generateTexture would be wasteful for one-shot).
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {object} opts - { color, radius, duration }
     */
    playExplosionEffect(x, y, opts = {}) {
        if (!this.scene?.sys?.isActive()) return;

        const color = opts.color || 0xFF6600;
        const radius = opts.radius || 60;
        const duration = opts.duration || 400;

        // Layer 1: Particle burst (Phaser native)
        this.play(VFXPresets.explosion('medium', color), x, y);

        // Layer 2: Expanding shockwave ring (Graphics + tween)
        const gf = this.scene.graphicsFactory;
        const ring = gf ? gf.create() : this.scene.add.graphics();
        // Reset pooled Graphics state — alpha/scale may be 0 from previous tween
        ring.clear();
        ring.setAlpha(1);
        ring.setScale(1);
        ring.setPosition(x, y);
        ring.setDepth(this.scene.DEPTH_LAYERS?.VFX || 3000);

        // Draw initial ring (small, will be scaled up by tween)
        ring.lineStyle(3, color, 0.8);
        ring.strokeCircle(0, 0, 5);
        ring.fillStyle(color, 0.15);
        ring.fillCircle(0, 0, 5);

        // Expand ring outward with fading alpha
        this.scene.tweens.add({
            targets: ring,
            scaleX: radius / 5,
            scaleY: radius / 5,
            alpha: 0,
            duration: duration,
            ease: 'Power2',
            onComplete: () => {
                if (gf) gf.release(ring); else ring.destroy();
            }
        });

        // Layer 3: Brief center flash
        const flash = gf ? gf.create() : this.scene.add.graphics();
        flash.clear();
        flash.setAlpha(1);
        flash.setScale(1);
        flash.setPosition(x, y);
        flash.setDepth((this.scene.DEPTH_LAYERS?.VFX || 3000) + 1);
        flash.fillStyle(0xFFFFFF, 0.9);
        flash.fillCircle(0, 0, radius * 0.3);

        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: duration * 0.4,
            ease: 'Power3',
            onComplete: () => {
                if (gf) gf.release(flash); else flash.destroy();
            }
        });
    }

    /**
     * Play a telegraph warning — circle that shows danger area before ability fires.
     * Phaser best practice: generateTexture once, then use lightweight Sprite + tween.
     * No per-call Graphics rendering — texture is cached and shared.
     *
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {object} opts - { radius, color, duration, fillAlpha }
     */
    playTelegraph(x, y, opts = {}) {
        if (!this.scene?.sys?.isActive()) return null;

        // Limit concurrent telegraphs to prevent visual overload
        if (this._activeTelegraphs.length >= 8) return null;

        const color = opts.color || 0xFF0000;
        const radius = opts.radius || 80;
        const duration = opts.duration || 1000;
        const fillAlpha = opts.fillAlpha || 0.12;

        // Generate telegraph circle texture once per color (cached by Phaser texture manager)
        const texKey = `_telegraph_${color.toString(16)}`;
        if (!this.scene.textures.exists(texKey)) {
            const size = 128; // Base texture size — scaled to match radius via sprite scale
            const gf = this.scene.graphicsFactory;
            const g = gf ? gf.create() : this.scene.add.graphics();
            g.clear();
            // Filled circle
            g.fillStyle(color, 0.25);
            g.fillCircle(size / 2, size / 2, size / 2 - 2);
            // Stroke border
            g.lineStyle(2, color, 0.8);
            g.strokeCircle(size / 2, size / 2, size / 2 - 2);
            g.generateTexture(texKey, size, size);
            if (gf) gf.release(g); else g.destroy();
        }

        // Lightweight sprite with pre-generated texture — much cheaper than Graphics per call
        const scale = (radius * 2) / 128;
        const sprite = this.scene.add.sprite(x, y, texKey);
        sprite.setOrigin(0.5, 0.5);
        sprite.setScale(scale);
        sprite.setAlpha(fillAlpha > 0.2 ? 0.8 : 0.6);
        sprite.setDepth(this.scene.DEPTH_LAYERS?.VFX || 3000);

        // Track for cleanup (boss death, level transition)
        this._activeTelegraphs.push(sprite);

        // Single tween: scale pulse + fade out, then destroy + untrack
        this.scene.tweens.add({
            targets: sprite,
            scaleX: scale * 1.05,
            scaleY: scale * 1.05,
            alpha: 0,
            duration: duration,
            ease: 'Sine.easeOut',
            onComplete: () => {
                const idx = this._activeTelegraphs.indexOf(sprite);
                if (idx !== -1) this._activeTelegraphs.splice(idx, 1);
                sprite.destroy();
            }
        });

        return sprite;
    }

    /**
     * Draw a lightning bolt between two points — jagged line with glow + fade.
     * Uses Phaser Graphics for the bolt geometry + tween for fade-out.
     *
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {object} opts - { color, width, duration, segments }
     */
    playLightningBolt(x1, y1, x2, y2, opts = {}) {
        if (!this.scene?.sys?.isActive()) return;

        const color = opts.color || 0x4488FF;
        const width = opts.width || 3;
        const duration = opts.duration || 200;
        const segments = opts.segments || 6;

        const gf = this.scene.graphicsFactory;
        const g = gf ? gf.create() : this.scene.add.graphics();
        g.clear();
        g.setAlpha(1);
        g.setScale(1);
        g.setPosition(0, 0);
        g.setDepth((this.scene.DEPTH_LAYERS?.VFX || 3000) + 1);

        // Build jagged bolt path with random offsets
        const dx = x2 - x1;
        const dy = y2 - y1;
        const perpX = -dy;
        const perpY = dx;
        const len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
        const normPX = perpX / len;
        const normPY = perpY / len;

        // Glow layer (wider, lower alpha)
        g.lineStyle(width + 4, color, 0.3);
        g.beginPath();
        g.moveTo(x1, y1);
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const jitter = (Math.random() - 0.5) * 20;
            g.lineTo(x1 + dx * t + normPX * jitter, y1 + dy * t + normPY * jitter);
        }
        g.lineTo(x2, y2);
        g.strokePath();

        // Core bolt (thinner, full alpha, white-ish)
        g.lineStyle(width, 0xFFFFFF, 0.9);
        g.beginPath();
        g.moveTo(x1, y1);
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const jitter = (Math.random() - 0.5) * 12;
            g.lineTo(x1 + dx * t + normPX * jitter, y1 + dy * t + normPY * jitter);
        }
        g.lineTo(x2, y2);
        g.strokePath();

        // Impact spark at target
        this.play(VFXPresets.smallHit(color, 6), x2, y2);

        // Fade out and cleanup
        this.scene.tweens.add({
            targets: g,
            alpha: 0,
            duration: duration,
            ease: 'Power2',
            onComplete: () => {
                if (gf) gf.release(g); else g.destroy();
            }
        });
    }
}

