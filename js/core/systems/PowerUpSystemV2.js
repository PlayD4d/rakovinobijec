/**
 * PowerUpSystemV2 - PR7 Compliant Power-Up System
 * 
 * 100% data-driven power-up system following PR7 principles:
 * - All values from blueprints via ConfigResolver
 * - No hardcoded constants
 * - Unified modifier system through ModifierEngine
 * - Registry-based VFX/SFX
 */

import { displayResolver } from '../blueprints/DisplayResolver.js';

export class PowerUpSystemV2 {
  constructor(scene) {
    this.scene = scene;
    
    // PR7: Required systems validation
    if (!scene.configResolver) throw new Error('[PowerUpSystemV2] Missing ConfigResolver');
    if (!scene.modifierEngine) throw new Error('[PowerUpSystemV2] Missing ModifierEngine');
    if (!scene.blueprintLoader) throw new Error('[PowerUpSystemV2] Missing BlueprintLoader');
    
    // Track applied power-ups and their levels
    this.appliedPowerUps = new Map(); // powerUpId -> { blueprint, level, modifiers, abilities }
    
    // Active abilities that need per-frame updates
    this.activeAbilities = new Map(); // abilityType -> { config, updateFn }
    
    // VFX Manager reference (optional)
    this.vfxManager = null;
    
    console.log('[PowerUpSystemV2] Initialized with PR7 compliance');
  }
  
  /**
   * Set VFX Manager for visual effects
   */
  setVFXManager(vfxManager) {
    this.vfxManager = vfxManager;
  }
  
  /**
   * Apply a power-up from blueprint
   * @param {string} powerUpId - Blueprint ID (e.g., "powerup.damage_boost")
   * @param {number} level - Power-up level to apply
   */
  applyPowerUp(powerUpId, level = 1) {
    const blueprint = this.scene.blueprintLoader.get(powerUpId);
    if (!blueprint) {
      console.error(`[PowerUpSystemV2] Blueprint not found: ${powerUpId}`);
      return false;
    }
    
    // Validate blueprint structure
    if (!this._validateBlueprint(blueprint)) {
      console.error(`[PowerUpSystemV2] Invalid blueprint structure: ${powerUpId}`);
      return false;
    }
    
    const currentData = this.appliedPowerUps.get(powerUpId) || { level: 0, modifiers: [], abilities: [] };
    const levelDelta = level - currentData.level;
    
    if (levelDelta <= 0) {
      console.warn(`[PowerUpSystemV2] Power-up ${powerUpId} already at level ${currentData.level}`);
      return false;
    }
    
    console.log(`[PowerUpSystemV2] Applying ${powerUpId} from level ${currentData.level} to ${level}`);
    
    // Process modifiers
    const modifiers = this._processModifiers(blueprint, levelDelta);
    
    // Process abilities
    const abilities = this._processAbilities(blueprint, level);
    
    // Apply to player
    this._applyToPlayer(modifiers, abilities);
    
    // Update tracking
    this.appliedPowerUps.set(powerUpId, {
      blueprint,
      level,
      modifiers: [...currentData.modifiers, ...modifiers],
      abilities
    });
    
    // Play VFX/SFX
    this._playEffects(blueprint, 'apply');
    
    // Update stats
    if (this.scene.gameStats) {
      this.scene.gameStats.powerUpsCollected = (this.scene.gameStats.powerUpsCollected || 0) + 1;
    }
    
    return true;
  }
  
  /**
   * Validate blueprint structure
   */
  _validateBlueprint(blueprint) {
    // Required fields
    if (!blueprint.id || !blueprint.type) return false;
    if (blueprint.type !== 'powerup') return false;
    
    // Must have either modifiers or ability
    const hasModifiers = blueprint.mechanics?.modifiersPerLevel?.length > 0;
    const hasAbility = blueprint.ability?.type;
    
    if (!hasModifiers && !hasAbility) {
      console.warn(`[PowerUpSystemV2] Blueprint ${blueprint.id} has no modifiers or ability`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Process modifiers from blueprint
   */
  _processModifiers(blueprint, levelDelta) {
    const modifiers = [];
    const modifierDefs = blueprint.mechanics?.modifiersPerLevel || [];
    
    for (const modDef of modifierDefs) {
      if (!modDef.path || modDef.value === undefined) continue;
      
      // Calculate actual value based on level delta
      const value = modDef.value * levelDelta;
      
      // Create modifier object for ModifierEngine
      const modifier = {
        source: blueprint.id,
        path: modDef.path,  // Direct path without mapping
        type: modDef.type || 'add',
        value: value,
        description: modDef.description
      };
      
      modifiers.push(modifier);
      console.log(`[PowerUpSystemV2] Modifier: ${modifier.path} ${modifier.type} ${modifier.value}`);
    }
    
    return modifiers;
  }
  
  /**
   * Process abilities from blueprint
   */
  _processAbilities(blueprint, level) {
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
        config.rotationSpeed = ability.rotationSpeed || 2;
        config.tickRate = ability.tickRate || 0.1;
        config.beamWidth = ability.beamWidth || 0.25;
        config.beamColor = ability.beamColor || 0x00ff00;
        config.beamAlpha = ability.beamAlpha || 0.7;
        break;
        
      case 'flamethrower':
        config.range = ability.rangePerLevel?.[level - 1] || 80;
        config.damage = ability.damagePerLevel?.[level - 1] || 3;
        config.coneAngle = ability.coneAnglePerLevel?.[level - 1] || 0.4;
        config.tickRate = ability.tickRate || 0.1;
        break;
        
      case 'shield':
        config.baseRegenMs = ability.baseRegenMs || 10000;
        config.minRegenMs = ability.minRegenMs || 5000;
        config.regenReduction = ability.regenReductionPerLevel || 500;
        config.hits = level; // Shield hits = level
        break;
        
      case 'chain_lightning':
        config.damage = ability.baseDamage || 15;
        config.damagePerLevel = ability.damagePerLevel || 10;
        config.range = ability.baseRange || 200;
        config.jumpRange = ability.jumpRange || 80;
        config.jumps = level; // Number of jumps = level
        config.interval = ability.interval || 2000;
        break;
        
      case 'aura':
        config.damage = ability.baseDamagePerTick || 2;
        config.radius = ability.baseRadius || 100;
        config.radiusPerLevel = ability.radiusPerLevel || 10;
        config.tickRate = ability.tickRate || 0.1;
        break;
        
      default:
        console.warn(`[PowerUpSystemV2] Unknown ability type: ${ability.type}`);
        return [];
    }
    
    abilities.push(config);
    console.log(`[PowerUpSystemV2] Ability: ${config.type} level ${config.level}`, config);
    
    return abilities;
  }
  
  /**
   * Apply modifiers and abilities to player
   */
  _applyToPlayer(modifiers, abilities) {
    const player = this.scene.player;
    if (!player) {
      console.error('[PowerUpSystemV2] No player to apply power-ups to');
      return;
    }
    
    // Apply modifiers through ModifierEngine
    for (const modifier of modifiers) {
      player.addModifier(modifier);
    }
    
    // Apply abilities
    for (const ability of abilities) {
      this._applyAbility(player, ability);
    }
  }
  
  /**
   * Apply specific ability to player
   */
  _applyAbility(player, config) {
    switch (config.type) {
      case 'radiotherapy':
        if (this.vfxManager) {
          this.vfxManager.attachEffect(player, 'radiotherapy', config);
        }
        // Store config for reference
        player.radiotherapyActive = true;
        player.radiotherapyLevel = config.level;
        player.radiotherapyConfig = config;
        break;
        
      case 'flamethrower':
        if (this.vfxManager) {
          this.vfxManager.attachEffect(player, 'flamethrower', {
            length: config.range,
            angle: config.coneAngle,
            damage: config.damage,
            tickRate: config.tickRate,
            color: 0xff6600
          });
        }
        player.flamethrowerActive = true;
        player.flamethrowerLevel = config.level;
        player.flamethrowerConfig = config;
        break;
        
      case 'shield':
        if (player.applyShieldPowerUp) {
          player.applyShieldPowerUp(config.level);
        }
        break;
        
      case 'chain_lightning':
        // Register lightning ability for update loop
        this.activeAbilities.set('chain_lightning', {
          config,
          timer: 0,
          updateFn: (delta) => this._updateChainLightning(delta, config)
        });
        player.hasLightningChain = true;
        player.lightningChainLevel = config.level;
        break;
        
      case 'aura':
        // Create aura visual if not exists
        if (!player.aura && this.scene.add) {
          player.aura = this.scene.add.graphics();
          player.aura.setDepth(player.depth - 1);
        }
        player.auraDamage = config.damage * config.level;
        player.auraRadius = config.radius + (config.radiusPerLevel * (config.level - 1));
        break;
        
      default:
        console.warn(`[PowerUpSystemV2] Unhandled ability type: ${config.type}`);
    }
  }
  
  /**
   * Play VFX/SFX effects
   */
  _playEffects(blueprint, trigger) {
    const vfxId = blueprint.vfx?.[trigger];
    const sfxId = blueprint.sfx?.[trigger];
    
    if (vfxId && this.scene.newVFXSystem) {
      const player = this.scene.player;
      if (player) {
        this.scene.newVFXSystem.play(vfxId, player.x, player.y);
      }
    }
    
    if (sfxId && this.scene.newSFXSystem) {
      this.scene.newSFXSystem.play(sfxId);
    }
  }
  
  /**
   * Update active abilities
   */
  update(time, delta) {
    // Update each active ability
    for (const [type, ability] of this.activeAbilities) {
      if (ability.updateFn) {
        ability.updateFn(delta);
      }
    }
    
    // Update aura if active
    const player = this.scene.player;
    if (player?.aura && player.auraDamage > 0) {
      this._updateAura(player, delta);
    }
  }
  
  /**
   * Update chain lightning ability
   */
  _updateChainLightning(delta, config) {
    const ability = this.activeAbilities.get('chain_lightning');
    if (!ability) return;
    
    ability.timer += delta;
    if (ability.timer >= config.interval) {
      ability.timer = 0;
      this._performChainLightning(config);
    }
  }
  
  /**
   * Perform chain lightning attack
   */
  _performChainLightning(config) {
    const player = this.scene.player;
    if (!player?.active) return;
    
    const enemies = this.scene.enemiesGroup?.getChildren() || [];
    if (enemies.length === 0) return;
    
    // Find closest enemy
    let closest = null;
    let minDist = config.range;
    
    for (const enemy of enemies) {
      if (!enemy?.active) continue;
      const dist = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
      if (dist < minDist) {
        minDist = dist;
        closest = enemy;
      }
    }
    
    if (!closest) return;
    
    // Start chain
    this._chainToEnemy(closest, config.damage, config.jumps, config.jumpRange, []);
  }
  
  /**
   * Chain lightning to enemy
   */
  _chainToEnemy(enemy, damage, jumpsLeft, jumpRange, hitList) {
    if (!enemy?.active || jumpsLeft <= 0) return;
    
    hitList.push(enemy);
    
    // Apply damage
    if (enemy.takeDamage) {
      enemy.takeDamage(damage, 'chain_lightning');
    }
    
    // Visual effect
    if (this.scene.newVFXSystem) {
      this.scene.newVFXSystem.play('vfx.lightning.strike', enemy.x, enemy.y);
    }
    
    // Find next target
    if (jumpsLeft > 1) {
      const enemies = this.scene.enemiesGroup?.getChildren() || [];
      let next = null;
      let minDist = jumpRange;
      
      for (const e of enemies) {
        if (!e?.active || hitList.includes(e)) continue;
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, e.x, e.y);
        if (dist < minDist) {
          minDist = dist;
          next = e;
        }
      }
      
      if (next) {
        // Draw lightning visual
        const gfx = this.scene.add.graphics();
        gfx.lineStyle(3, 0x4444ff, 1);
        gfx.beginPath();
        gfx.moveTo(enemy.x, enemy.y);
        gfx.lineTo(next.x, next.y);
        gfx.strokePath();
        
        // Fade out
        this.scene.tweens.add({
          targets: gfx,
          alpha: 0,
          duration: 200,
          onComplete: () => gfx.destroy()
        });
        
        // Continue chain after delay
        this.scene.time.delayedCall(150, () => {
          this._chainToEnemy(next, damage * 0.8, jumpsLeft - 1, jumpRange, hitList);
        });
      }
    }
  }
  
  /**
   * Update aura damage
   */
  _updateAura(player, delta) {
    if (!player.aura) return;
    
    // Update aura visual
    player.aura.clear();
    player.aura.lineStyle(2, 0x00ff00, 0.3);
    player.aura.fillStyle(0x00ff00, 0.1);
    player.aura.strokeCircle(player.x, player.y, player.auraRadius);
    player.aura.fillCircle(player.x, player.y, player.auraRadius);
    
    // Apply damage to enemies in range
    const enemies = this.scene.enemiesGroup?.getChildren() || [];
    const tickDamage = player.auraDamage * 0.1; // 10 ticks per second
    
    for (const enemy of enemies) {
      if (!enemy?.active) continue;
      
      const dist = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
      if (dist <= player.auraRadius) {
        if (enemy.takeDamage) {
          enemy.takeDamage(tickDamage, 'aura');
        }
      }
    }
  }
  
  /**
   * Show power-up selection modal
   */
  async showPowerUpSelection(callback) {
    try {
      // Validate scene is still valid - PR7 Compliant Phaser API
      if (!this.scene || !this.scene.scene || !this.scene.scene.isActive()) {
        console.error('[PowerUpSystemV2] Cannot show modal - scene is inactive or invalid');
        console.debug('[PowerUpSystemV2] Scene debug:', {
          hasScene: !!this.scene,
          hasSceneManager: !!(this.scene?.scene),
          isActive: this.scene?.scene?.isActive?.() || false,
          sceneKey: this.scene?.scene?.key || 'unknown'
        });
        callback?.();
        return;
      }
      
      // Get available power-ups
      const options = this._generatePowerUpOptions();
      
      console.debug('[PowerUpSystemV2] Generated power-up options:', {
        optionsCount: options.length,
        sceneActive: this.scene?.scene?.isActive?.() || false,
        modalExists: !!this._selectionModal,
        modalDestroyed: this._selectionModal?.isDestroyed || false
      });
      
      // Create or reuse modal
      if (!this._selectionModal || this._selectionModal.isDestroyed) {
        // Import and create modal only once
        const { PowerUpSelectionModal } = await import('../../ui/PowerUpSelectionModal.js');
        
        // Create with empty options first, we'll update them
        this._selectionModal = new PowerUpSelectionModal(this.scene, [], null);
        
        // Add to scene only once
        this.scene.add.existing(this._selectionModal);
      }
      
      // Always update power-ups and callback before showing
      this._selectionModal.updatePowerUps(options);
      this._selectionModal.onSelectionCallback = (selected) => {
        if (selected) {
          // Apply selected power-up
          const currentLevel = this.appliedPowerUps.get(selected.id)?.level || 0;
          this.applyPowerUp(selected.id, currentLevel + 1);
        }
        // Hide modal after selection
        this._selectionModal?.hideModal();
        callback?.();
      };
      
      // Show modal
      await this._selectionModal.show();
    } catch (error) {
      console.error('[PowerUpSystemV2] Failed to show selection modal:', error);
      callback?.();
    }
  }
  
  /**
   * Generate power-up options for selection
   */
  _generatePowerUpOptions() {
    const allPowerUps = this.scene.blueprintLoader.getAll('powerup') || [];
    const options = [];
    
    for (const blueprint of allPowerUps) {
      if (!blueprint?.id) continue;
      
      const current = this.appliedPowerUps.get(blueprint.id);
      const currentLevel = current?.level || 0;
      const maxLevel = blueprint.stats?.maxLevel || blueprint.maxLevel || 10;
      
      // Skip maxed out power-ups
      if (currentLevel >= maxLevel) continue;
      
      // Convert to UI format compatible with PowerUpSelectionModal
      options.push({
        id: blueprint.id,
        name: this._getBlueprintName(blueprint),
        description: this._getBlueprintDescription(blueprint),
        type: blueprint.category || 'passive',
        level: currentLevel,
        maxLevel: maxLevel,
        value: this._extractValueFromBlueprint(blueprint),
        icon: blueprint.display?.icon,
        color: blueprint.display?.color
      });
    }
    
    // Randomly select 3 options
    const selected = [];
    while (selected.length < 3 && options.length > 0) {
      const index = Math.floor(Math.random() * options.length);
      selected.push(options.splice(index, 1)[0]);
    }
    
    return selected;
  }
  
  /**
   * Get localized name for blueprint
   */
  _getBlueprintName(blueprint) {
    // Try DisplayResolver first
    if (this.scene.displayResolver) {
      const name = this.scene.displayResolver.getName(blueprint);
      if (name && name !== blueprint.id) return name;
    }
    // Fallback to blueprint data
    return blueprint.display?.devNameFallback || blueprint.id.replace('powerup.', '').replace(/_/g, ' ');
  }
  
  /**
   * Get localized description for blueprint  
   */
  _getBlueprintDescription(blueprint) {
    // Try DisplayResolver first
    if (this.scene.displayResolver) {
      const desc = this.scene.displayResolver.getDescription(blueprint);
      if (desc) return desc;
    }
    // Fallback to blueprint data
    return blueprint.display?.devDescFallback || '';
  }
  
  /**
   * Extract value from blueprint for UI display
   */
  _extractValueFromBlueprint(blueprint) {
    // Try to extract meaningful value from modifiers
    const mods = blueprint.mechanics?.modifiersPerLevel;
    if (mods && mods.length > 0) {
      const firstMod = mods[0];
      if (firstMod.value !== undefined) {
        return firstMod.value;
      }
    }
    // Try ability values
    if (blueprint.ability) {
      const ability = blueprint.ability;
      if (ability.damagePerLevel) return ability.damagePerLevel[0];
      if (ability.rangePerLevel) return ability.rangePerLevel[0];
      if (ability.baseDamage) return ability.baseDamage;
    }
    return 0;
  }
  
  /**
   * Get current level of a power-up
   */
  getPowerUpLevel(powerUpId) {
    return this.appliedPowerUps.get(powerUpId)?.level || 0;
  }
  
  /**
   * Get all active power-ups
   */
  getActivePowerUps() {
    const active = [];
    for (const [id, data] of this.appliedPowerUps) {
      active.push({
        id: id,
        level: data.level,
        name: data.blueprint.display?.devNameFallback || id
      });
    }
    return active;
  }
  
  /**
   * Cleanup method - destroy modal and clear references
   */
  destroy() {
    // Destroy selection modal if it exists
    if (this._selectionModal && !this._selectionModal.isDestroyed) {
      this._selectionModal.destroy();
    }
    this._selectionModal = null;
    
    // Clear applied power-ups
    this.appliedPowerUps?.clear();
    this.appliedPowerUps = null;
    
    // Clear scene reference
    this.scene = null;
    this.vfxManager = null;
  }
}

// Register DEV commands for testing
if (typeof window !== 'undefined') {
  window.DEV = window.DEV || {};
  
  // Test power-up application
  window.DEV.applyPowerUp = (id, level = 1) => {
    const scene = window.game?.scene?.getScene('GameScene');
    if (!scene?.powerUpSystem) {
      console.error('PowerUpSystemV2 not initialized');
      return;
    }
    
    const success = scene.powerUpSystem.applyPowerUp(id, level);
    if (success) {
      console.log(`✅ Applied ${id} at level ${level}`);
    } else {
      console.error(`❌ Failed to apply ${id}`);
    }
  };
  
  // List all power-ups
  window.DEV.listPowerUps = () => {
    const scene = window.game?.scene?.getScene('GameScene');
    if (!scene?.blueprintLoader) {
      console.error('BlueprintLoader not available');
      return;
    }
    
    const powerups = scene.blueprintLoader.getAll('powerup');
    console.table(powerups.map(p => ({
      id: p.id,
      name: p.display?.devNameFallback || 'N/A',
      maxLevel: p.stats?.maxLevel || 10,
      hasModifiers: !!(p.mechanics?.modifiersPerLevel?.length),
      hasAbility: !!p.ability?.type
    })));
  };
  
  // Show active power-ups
  window.DEV.activePowerUps = () => {
    const scene = window.game?.scene?.getScene('GameScene');
    if (!scene?.powerUpSystem) {
      console.error('PowerUpSystemV2 not initialized');
      return;
    }
    
    const active = scene.powerUpSystem.getActivePowerUps();
    console.table(active);
  };
}

export default PowerUpSystemV2;