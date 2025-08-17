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
                console.warn(`[PowerUpAbilities] Unknown ability type: ${ability.type}`);
                return [];
        }
        
        abilities.push(config);
        console.log(`[PowerUpAbilities] Ability: ${config.type} level ${config.level}`, config);
        
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
                console.log(`[PowerUpAbilities] 🔬 Applying radiotherapy config:`, config);
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
                // Set shield directly on player
                player.shieldActive = true;
                player.shieldLevel = config.level;
                player.shieldHits = config.hits;
                player.shieldRegenMs = Math.max(config.minRegenMs, 
                    config.baseRegenMs - (config.regenReduction * (config.level - 1)));
                player.shieldBroken = false;
                player.shieldRegenTimer = 0;
                
                console.log(`[PowerUpAbilities] ✅ SHIELD ACTIVATED - Level: ${config.level}, Hits: ${config.hits}, Regen: ${player.shieldRegenMs}ms`);
                
                // Create shield visual effect
                if (vfxManager) {
                    vfxManager.attachEffect(player, 'shield', {
                        radius: 40 + (config.level * 5),
                        color: 0x00ffff,
                        alpha: 0.3
                    });
                }
                break;
                
            case 'xp_magnet':
                // XP magnet uses modifier system only
                console.log(`[PowerUpAbilities] XP magnet handled via modifiers (level ${config.level})`);
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
                
            case 'chemo_aura':
                // Enable chemo aura on player
                player.chemoAuraActive = true;
                player.chemoAuraConfig = config;
                console.log(`[PowerUpAbilities] Activated chemo aura with config:`, config);
                break;
                
            case 'piercing':
                // Set piercing properties on player
                player.piercingLevel = config.level;
                player.piercingMaxPierces = config.maxPierces;
                player.piercingDamageReduction = config.damageReduction;
                console.log(`[PowerUpAbilities] Activated piercing: ${config.maxPierces} pierces, ${(config.damageReduction * 100)}% damage reduction`);
                break;
                
            default:
                console.warn(`[PowerUpAbilities] Unhandled ability type: ${config.type}`);
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
     * Cleanup
     */
    destroy() {
        this.activeAbilities.clear();
        this.scene = null;
        this.powerUpSystem = null;
    }
}