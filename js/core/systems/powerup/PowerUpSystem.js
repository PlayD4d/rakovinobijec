import { getSession } from '../../debug/SessionLog.js';

/**
 * PowerUpSystem - Main orchestrator for power-up system
 * PR7 Compliant - 100% data-driven via blueprints
 * 
 * This is the main entry point - delegates to specialized modules
 */

import { PowerUpModifiers } from './PowerUpModifiers.js';
import { DebugLogger } from '../../debug/DebugLogger.js';
import { PowerUpAbilities } from './PowerUpAbilities.js';
import { PowerUpEffects } from './PowerUpEffects.js';
import { PowerUpOptionGenerator } from './PowerUpOptionGenerator.js';

export class PowerUpSystem {
    constructor(scene) {
        this.scene = scene;
        
        // PR7: Required systems validation
        if (!scene.configResolver) throw new Error('[PowerUpSystem] Missing ConfigResolver');
        if (!scene.blueprintLoader) throw new Error('[PowerUpSystem] Missing BlueprintLoader');
        // Modifiers are handled directly without external engine
        
        // Dual inventory: weapons (active abilities) + passives (stat modifiers)
        this.appliedPowerUps = new Map(); // ALL applied items (powerUpId -> { blueprint, level, modifiers, abilities })
        this.maxWeaponSlots = scene.configResolver.get('powerups.maxWeaponSlots', { defaultValue: 6 }) || 6;
        this.maxPassiveSlots = scene.configResolver.get('powerups.maxPassiveSlots', { defaultValue: 6 }) || 6;
        // Legacy compat
        this.maxSlots = this.maxWeaponSlots;
        
        // Initialize sub-modules
        this.modifiers = new PowerUpModifiers(scene, this);
        this.abilities = new PowerUpAbilities(scene, this);
        this.effects = new PowerUpEffects(scene, this);
        
        // Option generator for level-up selection
        this.optionGenerator = new PowerUpOptionGenerator(scene, this);

        // VFX Manager reference (optional)
        this.vfxManager = null;

        DebugLogger.info('powerup', '[PowerUpSystem] Initialized with modular architecture');
    }
    
    /**
     * Set VFX Manager for visual effects
     */
    setVFXManager(vfxManager) {
        this.vfxManager = vfxManager;
        this.effects.setVFXManager(vfxManager);
    }
    
    /**
     * Apply a power-up from blueprint
     * @param {string} powerUpId - Blueprint ID (e.g., "powerup.damage_boost")
     * @param {number} level - Power-up level to apply
     */
    applyPowerUp(powerUpId, level = 1) {
        DebugLogger.info('powerup', `[PowerUpSystem] 🎯 APPLYING POWERUP: ${powerUpId} at level ${level}`);
        
        const blueprint = this.scene.blueprintLoader.get(powerUpId);
        if (!blueprint) {
            DebugLogger.error('powerup', `[PowerUpSystem] ❌ Blueprint not found: ${powerUpId}`);
            return false;
        }
        
        // Validate blueprint structure
        if (!this._validateBlueprint(blueprint)) {
            DebugLogger.error('powerup', `[PowerUpSystem] ❌ Invalid blueprint structure: ${powerUpId}`);
            return false;
        }
        
        const currentData = this.appliedPowerUps.get(powerUpId) || { level: 0, modifiers: [], abilities: [] };
        const levelDelta = level - currentData.level;
        
        DebugLogger.info('powerup', `[PowerUpSystem] 📊 Level progression: ${currentData.level} → ${level} (delta: ${levelDelta})`);
        
        if (levelDelta <= 0) {
            DebugLogger.warn('powerup', `[PowerUpSystem] ⚠️ Power-up ${powerUpId} already at level ${currentData.level}`);
            return false;
        }
        
        DebugLogger.info('powerup', `[PowerUpSystem] Applying ${powerUpId} from level ${currentData.level} to ${level}`);
        
        // Process through modules - pass current level for 'base' type calculations
        const modifiers = this.modifiers.processModifiers(blueprint, levelDelta, currentData.level);
        const abilities = this.abilities.processAbilities(blueprint, level);
        
        DebugLogger.info('powerup', `[PowerUpSystem] 📋 Generated ${modifiers.length} modifiers and ${abilities.length} abilities`);
        if (modifiers.length > 0) {
            DebugLogger.info('powerup', '[PowerUpSystem] Modifiers:', modifiers.map(m => `${m.path}:${m.type}:${m.value}`));
        }
        if (abilities.length > 0) {
            DebugLogger.info('powerup', '[PowerUpSystem] Abilities:', abilities.map(a => `${a.type}:level${a.level}`));
        }
        
        // Apply to player
        this._applyToPlayer(modifiers, abilities, level, powerUpId);
        
        // Update tracking (replace modifiers, not accumulate)
        this.appliedPowerUps.set(powerUpId, {
            blueprint,
            level,
            modifiers,
            abilities
        });
        
        DebugLogger.info('powerup', `[PowerUpSystem] ✅ Successfully applied ${powerUpId} level ${level}`);
        getSession()?.powerup(powerUpId, level, 'applied');
        
        // Play effects
        this.effects.playApplyEffects(blueprint, this.scene.player);
        
        // Update stats
        if (this.scene.gameStats) {
            this.scene.gameStats.powerUpsCollected = (this.scene.gameStats.powerUpsCollected || 0) + 1;
        }
        
        return true;
    }
    
    /**
     * Update active abilities
     */
    update(time, delta) {
        this.abilities.update(time, delta);
    }
    
    /**
     * Power-up selection is handled by GameUIScene via the 'game-levelup' event.
     * This method is kept as a no-op for backward compatibility.
     */
    async showPowerUpSelection(callback) {
        // Power-up selection UI is handled by GameUIScene (LiteUI PowerUpUI).
        // If called directly, just invoke the callback to avoid blocking.
        DebugLogger.warn('powerup', '[PowerUpSystem] showPowerUpSelection is deprecated - selection handled by GameUIScene');
        callback?.();
    }
    
    /**
     * Get current level of a power-up
     */
    getPowerUpLevel(powerUpId) {
        return this.appliedPowerUps.get(powerUpId)?.level || 0;
    }
    
    /**
     * Get all active power-ups (both weapons + passives)
     */
    getActivePowerUps() {
        const active = [];
        for (const [id, data] of this.appliedPowerUps) {
            active.push({
                id: id,
                level: data.level,
                name: data.blueprint.display?.devNameFallback || id,
                slot: data.blueprint.mechanics?.slot || 'weapon'
            });
        }
        return active;
    }

    /** Get items filtered by slot type */
    getActiveWeapons() {
        return this.getActivePowerUps().filter(p => p.slot === 'weapon');
    }

    getActivePassives() {
        return this.getActivePowerUps().filter(p => p.slot === 'passive');
    }

    /** Count items by slot */
    getWeaponCount() {
        let count = 0;
        for (const [, data] of this.appliedPowerUps) {
            if ((data.blueprint.mechanics?.slot || 'weapon') === 'weapon') count++;
        }
        return count;
    }

    getPassiveCount() {
        let count = 0;
        for (const [, data] of this.appliedPowerUps) {
            if (data.blueprint.mechanics?.slot === 'passive') count++;
        }
        return count;
    }

    /** Check if a specific slot type is full */
    isSlotFull(slotType) {
        if (slotType === 'passive') return this.getPassiveCount() >= this.maxPassiveSlots;
        return this.getWeaponCount() >= this.maxWeaponSlots;
    }
    
    /**
     * Generate power-up options for level-up selection
     * Public method for GameScene to call
     */
    generatePowerUpOptions() {
        const options = this._generatePowerUpOptions();
        
        // Convert to UI format - extract emoji from blueprint name
        return options.map(opt => {
            // Extract emoji from name if present (data-driven from blueprints)
            const name = opt.name || opt.id.replace('powerup.', '').replace(/_/g, ' ');
            const emojiMatch = name.match(/^([^\s]+)\s/); // Match first non-space chars
            const emoji = emojiMatch && emojiMatch[1].match(/[\u{1F300}-\u{1FAD6}]/u) ? emojiMatch[1] : '⭐';
            
            return {
                id: opt.id,
                name: name,
                description: opt.description || '',
                stats: opt.stats || '',
                rarity: opt.rarity || 'common',
                icon: emoji,
                level: opt.level || 0,
                maxLevel: opt.maxLevel || 5,
                slot: opt.slot || 'weapon'
            };
        });
    }
    
    // ==================== Ability Query API ====================

    /**
     * Check if an ability type is currently active.
     * Centralizes power-up state — callers don't need to read player flags.
     * @param {string} abilityType - e.g. 'chemo_explosion', 'piercing', 'shield', 'radiotherapy'
     * @returns {boolean}
     */
    hasAbility(abilityType) {
        return this.abilities?.hasAbility(abilityType) || false;
    }

    /**
     * Get config for an active ability.
     * @param {string} abilityType
     * @returns {object|null}
     */
    getAbilityConfig(abilityType) {
        return this.abilities?.getAbilityConfig(abilityType) || null;
    }

    /**
     * Called by collision handlers when a player bullet hits a target.
     * PowerUpSystem decides what on-hit effects to apply (chemo explosion, future effects).
     * @param {Phaser.Scene} scene
     * @param {object} bullet - The projectile
     * @param {number} damage - Base damage dealt
     */
    onBulletHit(scene, bullet, damage) {
        this.abilities?.onBulletHit(scene, bullet, damage);
    }
    
    /**
     * Process damage through power-up systems (PR7: Delegate to PowerUpAbilities)
     * @param {Player} player - Player object
     * @param {number} amount - Damage amount  
     * @param {number} time - Current game time
     * @returns {number} Remaining damage after power-up processing
     */
    processDamage(player, amount, time) {
        if (!this.abilities?.processDamageWithShield) {
            return amount; // No shield system, return full damage
        }
        
        return this.abilities.processDamageWithShield(player, amount, time);
    }
    
    /**
     * Reset timers after pause/resume (PR7: Delegate to PowerUpAbilities)
     * Called when scene resumes from pause
     */
    resetTimersAfterPause() {
        // Delegate to PowerUpAbilities module (proper PR7 architecture)
        if (this.abilities?.resetTimersAfterPause) {
            this.abilities.resetTimersAfterPause();
        }
        
        DebugLogger.info('powerup', '[PowerUpSystem] Delegated timer reset to PowerUpAbilities');
    }
    
    /**
     * Cleanup method
     */
    destroy() {
        // Cleanup modules
        this.abilities.destroy();
        this.effects.destroy();
        this.modifiers.destroy();
        
        // Clear data
        this.appliedPowerUps?.clear();
        this.appliedPowerUps = null;
        
        // Clear references
        this.scene = null;
        this.vfxManager = null;
    }
    
    // === PRIVATE METHODS ===
    
    _validateBlueprint(blueprint) {
        if (!blueprint.id || !blueprint.type) return false;
        if (blueprint.type !== 'powerup') return false;
        
        const hasModifiers = blueprint.mechanics?.modifiersPerLevel?.length > 0;
        const hasAbility = blueprint.ability?.type;
        
        if (!hasModifiers && !hasAbility) {
            DebugLogger.warn('powerup', `[PowerUpSystem] Blueprint ${blueprint.id} has no modifiers or ability`);
            return false;
        }
        
        return true;
    }
    
    _applyToPlayer(modifiers, abilities, level, powerUpId) {
        const player = this.scene.player;
        if (!player) {
            DebugLogger.error('powerup', '[PowerUpSystem] No player to apply power-ups to');
            return;
        }
        
        DebugLogger.info('powerup', `[PowerUpSystem] 🎮 Applying to player:`);
        DebugLogger.info('powerup', `  - Modifiers: ${modifiers.length}`);
        DebugLogger.info('powerup', `  - Abilities: ${abilities.length}`);
        DebugLogger.info('powerup', `  - PowerUp ID: ${powerUpId}`);
        
        // Apply modifiers
        this.modifiers.applyToPlayer(player, modifiers, level, powerUpId);
        
        // Apply abilities
        this.abilities.applyToPlayer(player, abilities);
        
        // Force stats recalculation via dirty flag
        player._statsDirty = true;

        // Sync maxHp if hp modifier changed it (passive: max_hp)
        const newMaxHp = player._stats().hp;
        if (newMaxHp && newMaxHp !== player.maxHp) {
            const delta = newMaxHp - player.maxHp;
            player.maxHp = newMaxHp;
            if (delta > 0) player.hp = Math.min(player.hp + delta, player.maxHp);
            // Update HUD HP bar immediately
            const hud = this.scene.scene?.get('GameUIScene')?.hud;
            if (hud?.setPlayerHealth) hud.setPlayerHealth(player.hp, player.maxHp);
        }

        DebugLogger.info('powerup', `[PowerUpSystem] 📊 Player stats after application:`);
        DebugLogger.info('powerup', `  - Active modifiers: ${player.activeModifiers?.length || 0}`);
        if (player.activeModifiers?.length > 0) {
            DebugLogger.info('powerup', `  - Modifier details:`, player.activeModifiers.map(m => `${m.path}:${m.type}:${m.value}`));
        }
    }
    
    _generatePowerUpOptions() {
        return this.optionGenerator.generatePowerUpOptions();
    }
    
}

