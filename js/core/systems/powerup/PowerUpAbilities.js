import { DebugLogger } from '../../debug/DebugLogger.js';

/**
 * PowerUpAbilities - Handles special abilities from power-ups
 * PR7 Compliant - All abilities driven by blueprint configuration
 */

export class PowerUpAbilities {
    constructor(scene, powerUpSystem) {
        this.scene = scene;
        this.powerUpSystem = powerUpSystem;
        
        // Active abilities that need per-frame updates
        this.activeAbilities = new Map(); // abilityType -> { config, updateFn }
    }
    
    /**
     * Process abilities from blueprint
     */
    processAbilities(blueprint, level) {
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
                // PR7: Use baseShieldHP from ability config, multiply by level
                const baseHP = ability.baseShieldHP || 50;
                config.shieldHP = baseHP * level;  // 50, 100, 150, 200, 250
                config.rechargeTime = ability.rechargeTimePerLevel?.[level - 1] || 10000;
                DebugLogger.info('powerup', `[PowerUpAbilities] Shield config: HP=${config.shieldHP}, recharge=${config.rechargeTime}ms`);
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
                
            case 'chemo_aura':
                config.cloudDuration = ability.chemoCloudDuration || 6000;
                config.cloudDamage = ability.chemoCloudDamage || 4;
                config.cloudRadius = ability.chemoCloudRadius || 35;
                config.enableExplosions = ability.enableExplosions || false;
                break;
                
            case 'piercing':
                config.maxPierces = ability.maxPierces?.[level - 1] || 1;
                config.damageReduction = ability.damageReduction || 0.1;
                break;
                
            default:
                DebugLogger.warn('powerup', `[PowerUpAbilities] Unknown ability type: ${ability.type}`);
                return [];
        }
        
        abilities.push(config);
        DebugLogger.info('powerup', `[PowerUpAbilities] Ability: ${config.type} level ${config.level}`, config);
        
        return abilities;
    }
    
    /**
     * Apply abilities to player
     */
    applyToPlayer(player, abilities) {
        for (const ability of abilities) {
            this._applyAbility(player, ability);
        }
    }
    
    /**
     * Apply specific ability to player
     */
    _applyAbility(player, config) {
        const vfxManager = this.powerUpSystem.vfxManager;
        
        switch (config.type) {
            case 'radiotherapy':
                DebugLogger.info('powerup', `[PowerUpAbilities] 🔬 Applying radiotherapy config:`, config);
                if (vfxManager) {
                    vfxManager.attachEffect(player, 'radiotherapy', config);
                }
                player.radiotherapyActive = true;
                player.radiotherapyLevel = config.level;
                player.radiotherapyConfig = config;
                break;
                
            case 'flamethrower':
                if (vfxManager) {
                    vfxManager.attachEffect(player, 'flamethrower', {
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
                // Set shield HP-based system on player
                player.shieldActive = true;
                player.shieldLevel = config.level;
                player.shieldHP = config.shieldHP;
                player.maxShieldHP = config.shieldHP;
                player.shieldRechargeTime = config.rechargeTime;
                player.shieldRecharging = false;
                player.shieldRechargeAt = 0;
                
                DebugLogger.info('powerup', `[PowerUpAbilities] ✅ SHIELD ACTIVATED - Level: ${config.level}, HP: ${config.shieldHP}, Recharge: ${config.rechargeTime}ms`);
                
                // Create shield visual effect
                if (vfxManager) {
                    DebugLogger.info('powerup', `[PowerUpAbilities] Attaching shield VFX to player`);
                    vfxManager.attachEffect(player, 'shield', {
                        radius: 40 + (config.level * 5),
                        color: 0x00ffff,
                        alpha: 0.3
                    });
                } else if (this.scene.vfxSystem) {
                    // Fallback to direct VFX system call
                    DebugLogger.info('powerup', `[PowerUpAbilities] Using vfxSystem for shield effect`);
                    this.scene.vfxSystem.play('vfx.shield.active', player.x, player.y);
                } else {
                    DebugLogger.warn('powerup', `[PowerUpAbilities] No VFX system available for shield effect`);
                }
                break;
                
            case 'xp_magnet':
                // XP magnet uses modifier system only
                DebugLogger.info('powerup', `[PowerUpAbilities] XP magnet handled via modifiers (level ${config.level})`);
                break;
                
            case 'chain_lightning':
                // Register lightning ability for update loop
                this.activeAbilities.set('chain_lightning', {
                    config,
                    nextTriggerAt: 0,
                    updateFn: (time, delta) => this._updateChainLightning(time, delta, config)
                });
                player.hasLightningChain = true;
                player.lightningChainLevel = config.level;
                break;
                
            case 'aura':
                // PR7: Create aura visual through VFXSystem
                if (this.scene.vfxSystem && !player.aura) {
                    this.scene.vfxSystem.play('vfx.aura.damage', player.x, player.y, {
                        radius: config.radius + (config.radiusPerLevel * (config.level - 1)),
                        color: 0x00ff00,
                        alpha: 0.1,
                        persistent: true
                    });
                    player.aura = true; // Mark as created
                }
                player.auraDamage = config.damage * config.level;
                player.auraRadius = config.radius + (config.radiusPerLevel * (config.level - 1));
                break;
                
            case 'chemo_aura':
                // Enable chemo aura on player
                player.chemoAuraActive = true;
                player.chemoAuraConfig = config;
                DebugLogger.info('powerup', `[PowerUpAbilities] Activated chemo aura with config:`, config);
                break;
                
            case 'piercing':
                // Set piercing properties on player
                player.piercingLevel = config.level;
                player.piercingMaxPierces = config.maxPierces;
                player.piercingDamageReduction = config.damageReduction;
                DebugLogger.info('powerup', `[PowerUpAbilities] Activated piercing: ${config.maxPierces} pierces, ${(config.damageReduction * 100)}% damage reduction`);
                break;
                
            default:
                DebugLogger.warn('powerup', `[PowerUpAbilities] Unhandled ability type: ${config.type}`);
        }
    }
    
    /**
     * Update active abilities
     */
    update(time, delta) {
        // Update each active ability with absolute time
        for (const [type, ability] of this.activeAbilities) {
            if (ability.updateFn) {
                ability.updateFn(time, delta);
            }
        }
        
        // Update aura if active
        const player = this.scene.player;
        if (player?.aura && player.auraDamage > 0) {
            this._updateAura(player, delta);
        }
        
        // Update shield regeneration (moved from Player to PowerUpSystem)
        this._updateShieldRegeneration(player, time);
    }
    
    /**
     * Update chain lightning ability
     */
    _updateChainLightning(time, delta, config) {
        const ability = this.activeAbilities.get('chain_lightning');
        if (!ability) return;
        
        // Use absolute time instead of delta accumulation
        if (!ability.nextTriggerAt) {
            ability.nextTriggerAt = time + config.interval;
        }
        
        // Process with catch-up protection
        let triggers = 0;
        while (time >= ability.nextTriggerAt && triggers < 2) {
            this._performChainLightning(config);
            ability.nextTriggerAt += config.interval;
            triggers++;
        }
        
        if (triggers > 1) {
            DebugLogger.info('powerup', `[PowerUpAbilities] Chain lightning catch-up: ${triggers} triggers`);
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
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('vfx.lightning.strike', enemy.x, enemy.y);
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
                // PR7: Delegate lightning visual to VFXSystem instead of direct tweens
                if (this.scene.vfxSystem) {
                    this.scene.vfxSystem.play('vfx.lightning.chain.bolt', enemy.x, enemy.y, {
                        targetX: next.x,
                        targetY: next.y,
                        color: 0x4444ff,
                        width: 3,
                        duration: 200
                    });
                }
                
                // Continue chain after delay
                this.scene.time.delayedCall(150, () => {
                    this._chainToEnemy(next, damage * 0.8, jumpsLeft - 1, jumpRange, hitList);
                });
            }
        }
    }
    
    /**
     * Update aura damage (PR7: Visual handled by VFXSystem)
     */
    _updateAura(player, delta) {
        if (!player.aura) return;
        
        // Apply damage to enemies in range (logic only)
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
     * Update shield regeneration (moved from Player to PowerUpSystem for proper architecture)
     */
    _updateShieldRegeneration(player, time) {
        if (!player || !player.shieldActive) return;
        
        // Shield auto-regeneration logic
        if (player.shieldHP < player.maxShieldHP) {
            // Start recharge if not already recharging
            if (!player.shieldRecharging) {
                player.shieldRecharging = true;
                player.shieldRechargeAt = time + player.shieldRechargeTime;
                DebugLogger.info('powerup', `[PowerUpAbilities] Shield recharge started - will regenerate in ${player.shieldRechargeTime}ms`);
            }
            
            // Check if recharge time has elapsed
            if (time >= player.shieldRechargeAt) {
                player.shieldHP = player.maxShieldHP;
                player.shieldRecharging = false;
                player.shieldRechargeAt = 0;
                
                DebugLogger.info('powerup', `[PowerUpAbilities] ✨ SHIELD REGENERATED - HP: ${player.shieldHP}/${player.maxShieldHP}`);
                
                // Restore shield VFX
                const vfxManager = this.powerUpSystem?.vfxManager;
                if (vfxManager) {
                    vfxManager.attachEffect(player, 'shield', {
                        radius: 40 + (player.shieldLevel * 5),
                        color: 0x00ffff,
                        alpha: 0.3
                    });
                }
            }
        }
    }
    
    /**
     * Process damage through shield system (PR7: Moved from Player.js)
     * @param {Player} player - Player object
     * @param {number} amount - Damage amount
     * @param {number} time - Current game time
     * @returns {number} Remaining damage after shield absorption
     */
    processDamageWithShield(player, amount, time) {
        if (!player.shieldActive || player.shieldHP <= 0) {
            return amount; // No shield, return full damage
        }
        
        const absorbed = Math.min(amount, player.shieldHP);
        player.shieldHP -= absorbed;
        const remainingDamage = amount - absorbed;
        
        DebugLogger.info('powerup', `[PowerUpAbilities] 🛡️ SHIELD ABSORBED ${absorbed} damage - Shield HP: ${player.shieldHP}/${player.maxShieldHP}`);
        
        // If shield depleted, start recharge timer
        if (player.shieldHP <= 0) {
            player.shieldHP = 0;
            player.shieldRecharging = true;
            player.shieldRechargeAt = time + player.shieldRechargeTime;
            DebugLogger.info('powerup', `[PowerUpAbilities] 🛡️ SHIELD DEPLETED - Recharging in ${player.shieldRechargeTime}ms`);
            
            // Remove shield visual effect
            const vfxManager = this.powerUpSystem?.vfxManager;
            if (vfxManager) {
                vfxManager.detachEffect(player, 'shield');
            }
        }
        
        return remainingDamage;
    }
    
    /**
     * Reset timers after pause/resume
     * Called by PowerUpSystem when game resumes
     */
    resetTimersAfterPause() {
        const now = this.scene.time?.now || 0;
        const player = this.scene.player;
        
        if (!player) return;
        
        // Reset shield regeneration timer if shield was recharging
        if (player.shieldActive && player.shieldRecharging && player.shieldRechargeAt > 0) {
            // Calculate remaining recharge time before pause
            const remainingTime = Math.max(0, player.shieldRechargeTime);
            player.shieldRechargeAt = now + remainingTime;
            
            DebugLogger.info('powerup', `[PowerUpAbilities] Shield recharge timer reset - new recharge at: ${player.shieldRechargeAt}`);
        }
        
        // Reset chain lightning timers
        const lightningAbility = this.activeAbilities.get('chain_lightning');
        if (lightningAbility) {
            lightningAbility.nextTriggerAt = now + (lightningAbility.config?.interval || 2000);
            DebugLogger.info('powerup', '[PowerUpAbilities] Chain lightning timer reset');
        }
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.activeAbilities.clear();
        this.scene = null;
        this.powerUpSystem = null;
    }
}