/**
 * PowerUpVFXManager - PR7 compliant visual effects manager for power-ups
 * Manages all power-up visual effects through a centralized system
 * No direct Phaser API calls from gameplay entities
 */

export class PowerUpVFXManager {
    constructor(scene) {
        this.scene = scene;
        this.activeEffects = new Map(); // entity -> Set of effect instances
        this.effectPool = new Map();    // effect type -> array of inactive instances
        
        // PR7: Effect configurations from ConfigResolver
        this.CR = scene.configResolver || window.ConfigResolver;
        
        // Register effect types
        this.effectTypes = {
            'shield': () => import('./effects/ShieldEffect.js').then(m => m.ShieldEffect),
            'flamethrower': () => import('./effects/FlamethrowerEffect.js').then(m => m.FlamethrowerEffect),
            'radiotherapy': () => import('./effects/RadiotherapyEffect.js').then(m => m.RadiotherapyEffect),
            'chemoAura': () => import('./effects/ChemoAuraEffect.js').then(m => m.ChemoAuraEffect)
        };
        
        this.initialized = false;
    }
    
    /**
     * Initialize the manager
     */
    async initialize() {
        if (this.initialized) return;
        
        // Preload effect classes if needed
        // This is async to support dynamic imports
        
        this.initialized = true;
        console.log('[PowerUpVFXManager] Initialized');
    }
    
    /**
     * Attach an effect to an entity
     * @param {Phaser.GameObjects.Sprite} entity - The entity to attach to
     * @param {string} effectType - Type of effect ('shield', 'flamethrower', etc.)
     * @param {object} config - Effect configuration from blueprint
     */
    async attachEffect(entity, effectType, config = {}) {
        if (!entity || !effectType) return null;
        
        // Get or create effect set for this entity
        if (!this.activeEffects.has(entity)) {
            this.activeEffects.set(entity, new Set());
        }
        
        // Check if effect already active
        const entityEffects = this.activeEffects.get(entity);
        for (const effect of entityEffects) {
            if (effect.type === effectType) {
                console.log(`[PowerUpVFXManager] Effect '${effectType}' already active on entity, updating config`);
                // Update existing effect configuration
                if (effect.updateConfig) {
                    effect.updateConfig(config);
                }
                return effect;
            }
        }
        
        // Get effect instance from pool or create new
        const effect = await this._getOrCreateEffect(effectType, config);
        if (!effect) {
            console.warn(`[PowerUpVFXManager] Failed to create effect '${effectType}'`);
            return null;
        }
        
        // Attach to entity
        effect.attach(entity);
        entityEffects.add(effect);
        
        console.log(`[PowerUpVFXManager] Attached '${effectType}' effect to entity`);
        return effect;
    }
    
    /**
     * Detach an effect from an entity
     * @param {Phaser.GameObjects.Sprite} entity - The entity to detach from
     * @param {string} effectType - Type of effect to remove
     */
    detachEffect(entity, effectType) {
        const entityEffects = this.activeEffects.get(entity);
        if (!entityEffects) return;
        
        for (const effect of entityEffects) {
            if (effect.type === effectType) {
                effect.detach();
                entityEffects.delete(effect);
                this._returnToPool(effect);
                
                console.log(`[PowerUpVFXManager] Detached '${effectType}' effect from entity`);
                break;
            }
        }
        
        // Clean up empty sets
        if (entityEffects.size === 0) {
            this.activeEffects.delete(entity);
        }
    }
    
    /**
     * Get a specific effect attached to an entity
     * @param {Phaser.GameObjects.Sprite} entity - The entity to check
     * @param {string} effectType - Type of effect to find
     * @returns {Object|null} The effect instance or null if not found
     */
    getEffect(entity, effectType) {
        const entityEffects = this.activeEffects.get(entity);
        if (!entityEffects) return null;
        
        for (const effect of entityEffects) {
            if (effect.type === effectType) {
                return effect;
            }
        }
        
        return null;
    }
    
    /**
     * Detach all effects from an entity
     * @param {Phaser.GameObjects.Sprite} entity
     */
    detachAllEffects(entity) {
        const entityEffects = this.activeEffects.get(entity);
        if (!entityEffects) return;
        
        for (const effect of entityEffects) {
            effect.detach();
            this._returnToPool(effect);
        }
        
        this.activeEffects.delete(entity);
        console.log(`[PowerUpVFXManager] Detached all effects from entity`);
    }
    
    /**
     * Update all active effects
     * @param {number} time - Game time
     * @param {number} delta - Delta time
     */
    update(time, delta) {
        for (const [entity, effects] of this.activeEffects) {
            // CRITICAL FIX: Only check for truly dead entities (hp <= 0)
            // Don't detach effects just because entity is temporarily inactive
            if (!entity.active && entity.hp !== undefined && entity.hp <= 0) {
                // Entity is truly dead (hp <= 0), detach all effects
                this.detachAllEffects(entity);
                continue;
            }
            
            // Update each effect
            for (const effect of effects) {
                effect.update(time, delta);
            }
        }
    }
    
    /**
     * Get or create an effect instance
     * @private
     */
    async _getOrCreateEffect(effectType, config) {
        // Check pool first
        const pool = this.effectPool.get(effectType) || [];
        if (pool.length > 0) {
            const effect = pool.pop();
            effect.reset(config);
            return effect;
        }
        
        // Create new instance
        const EffectClass = await this._loadEffectClass(effectType);
        if (!EffectClass) return null;
        
        const effect = new EffectClass(this.scene, effectType, config);
        return effect;
    }
    
    /**
     * Load effect class dynamically
     * @private
     */
    async _loadEffectClass(effectType) {
        const loader = this.effectTypes[effectType];
        if (!loader) {
            console.warn(`[PowerUpVFXManager] Unknown effect type: '${effectType}'`);
            return null;
        }
        
        try {
            return await loader();
        } catch (error) {
            console.error(`[PowerUpVFXManager] Failed to load effect class for '${effectType}':`, error);
            return null;
        }
    }
    
    /**
     * Return effect to pool
     * @private
     */
    _returnToPool(effect) {
        if (!this.effectPool.has(effect.type)) {
            this.effectPool.set(effect.type, []);
        }
        this.effectPool.get(effect.type).push(effect);
    }
    
    /**
     * Destroy the manager and all effects
     */
    destroy() {
        // Detach all active effects
        for (const entity of this.activeEffects.keys()) {
            this.detachAllEffects(entity);
        }
        
        // Clear pools
        for (const pool of this.effectPool.values()) {
            for (const effect of pool) {
                effect.destroy();
            }
        }
        
        this.activeEffects.clear();
        this.effectPool.clear();
        
        console.log('[PowerUpVFXManager] Destroyed');
    }
}