/**
 * BossAbilities - Systém pro boss schopnosti a ability execution
 * 
 * Spravuje všechny boss schopnosti, jejich cooldowny a execution logiku.
 * Odděluje ability logic od core boss třídy podle PR7 principů.
 */
import { DebugLogger } from '../../core/debug/DebugLogger.js';

export class BossAbilities {
    constructor(bossCore) {
        this.boss = bossCore;
        this.scene = bossCore.scene;
        
        // Ability configuration from blueprint
        this.abilities = bossCore.abilities || {};
        // Use the same cooldowns Map as BossCore for consistency
        this.abilityCooldowns = bossCore.abilityCooldowns || new Map();
        this.activeAbilities = new Set();
        
        // Execution state
        this.isExecutingAbility = false;
        this.executionQueue = [];

        // Track delayedCall timers for cleanup on boss death
        this._pendingTimers = [];
        
        // Ability handlers registry
        this.abilityHandlers = new Map();
        this.registerDefaultAbilities();
        
        DebugLogger.info('boss', `[BossAbilities] Initialized with abilities:`, Object.keys(this.abilities));
    }
    
    /**
     * Registruje výchozí boss schopnosti
     */
    registerDefaultAbilities() {
        this.abilityHandlers.set('basic_attack', this.executeBasicAttack.bind(this));
        this.abilityHandlers.set('projectile_burst', this.executeProjectileBurst.bind(this));
        this.abilityHandlers.set('minion_spawn', this.executeMinionSpawn.bind(this));
        this.abilityHandlers.set('teleport_strike', this.executeTeleportStrike.bind(this));
        this.abilityHandlers.set('dash_attack', this.executeDashAttack.bind(this));
        this.abilityHandlers.set('area_damage', this.executeAreaDamage.bind(this));
        this.abilityHandlers.set('healing', this.executeHealing.bind(this));
        this.abilityHandlers.set('shield', this.executeShield.bind(this));
        this.abilityHandlers.set('rage_mode', this.executeRageMode.bind(this));
        this.abilityHandlers.set('toxic_cloud', this.executeToxicCloud.bind(this));
        
        // Boss-specific abilities (from logs)
        this.abilityHandlers.set('radiation_pulse', this.executeRadiationPulse.bind(this));
        this.abilityHandlers.set('toxic_pools', this.executeToxicPools.bind(this));
        this.abilityHandlers.set('beam_sweep', this.executeBeamSweep.bind(this));
        this.abilityHandlers.set('summon_irradiated', this.executeSummonIrradiated.bind(this));
        this.abilityHandlers.set('radiation_storm', this.executeRadiationStorm.bind(this));
        this.abilityHandlers.set('rapid_beams', this.executeRapidBeams.bind(this));
        this.abilityHandlers.set('massive_summon', this.executeMassiveSummon.bind(this));
        this.abilityHandlers.set('core_overload', this.executeCoreOverload.bind(this));

        // Karcinogenní Král + Onkogen abilities (map to projectile burst variants)
        this.abilityHandlers.set('shoot_fan', this.executeProjectileBurst.bind(this));
        this.abilityHandlers.set('shoot_circle', this.executeProjectileBurst.bind(this));
        this.abilityHandlers.set('tracking_burst', this.executeProjectileBurst.bind(this));

        // Onkogen Prime abilities
        this.abilityHandlers.set('shoot_fans', this.executeProjectileBurst.bind(this));
        this.abilityHandlers.set('circle_burst', this.executeProjectileBurst.bind(this));
        this.abilityHandlers.set('laser_sweep', this.executeBeamSweep.bind(this));
        this.abilityHandlers.set('rapid_spawns', this.executeMassiveSummon.bind(this));
        this.abilityHandlers.set('enrage_mode', this.executeRageMode.bind(this));
        this.abilityHandlers.set('summon_minions', this.executeMinionSpawn.bind(this));
    }
    
    /**
     * Update method - zpracovává ability queue a cooldowny
     */
    update(time, delta) {
        // Process execution queue
        if (!this.isExecutingAbility && this.executionQueue.length > 0) {
            const nextAbility = this.executionQueue.shift();
            this.executeAbilityInternal(nextAbility.id, nextAbility.params);
        }
        
        // Update cooldowns - cleanup expired ones
        for (const [abilityId, cooldownEnd] of this.abilityCooldowns.entries()) {
            if (time >= cooldownEnd) {
                this.abilityCooldowns.delete(abilityId);
            }
        }
    }
    
    /**
     * Pokusí se vykonat schopnost
     */
    executeAbility(abilityId, params = {}) {
        if (!this.abilities[abilityId]) {
            DebugLogger.warn('boss', `[BossAbilities] Unknown ability: ${abilityId}`);
            return false;
        }
        
        if (!this.boss.isAbilityReady(abilityId)) {
            DebugLogger.info('boss', `[BossAbilities] Ability ${abilityId} on cooldown`);
            return false;
        }
        
        // Add to queue if currently executing
        if (this.isExecutingAbility) {
            this.executionQueue.push({ id: abilityId, params });
            return true;
        }
        
        return this.executeAbilityInternal(abilityId, params);
    }
    
    /**
     * Interní execution schopnosti
     */
    executeAbilityInternal(abilityId, params) {
        const abilityData = this.abilities[abilityId];
        const handler = this.abilityHandlers.get(abilityId);
        
        if (!handler) {
            DebugLogger.warn('boss', `[BossAbilities] No handler for ability: ${abilityId} — applying default cooldown`);
            // Set cooldown even for unknown abilities to prevent infinite retry
            this.boss?.setAbilityCooldown?.(abilityId, 5000);
            return false;
        }
        
        DebugLogger.info('boss', `[BossAbilities] Executing ability: ${abilityId}`);
        
        this.isExecutingAbility = true;
        this.activeAbilities.add(abilityId);
        
        // Set cooldown
        const cooldown = abilityData.cooldown || 3000;
        this.boss.setAbilityCooldown(abilityId, cooldown);
        
        // Execute ability
        try {
            const result = handler(abilityData, params);
            
            // Handle async abilities
            if (result && typeof result.then === 'function') {
                result.finally(() => {
                    this.onAbilityCompleted(abilityId);
                });
            } else {
                // Sync ability - complete immediately
                this._schedule(100, () => {
                    this.onAbilityCompleted(abilityId);
                });
            }
            
            return true;
        } catch (error) {
            DebugLogger.error('boss', `[BossAbilities] Error executing ${abilityId}:`, error);
            this.onAbilityCompleted(abilityId);
            return false;
        }
    }
    
    /**
     * Callback po dokončení schopnosti
     */
    onAbilityCompleted(abilityId) {
        this.isExecutingAbility = false;
        this.activeAbilities.delete(abilityId);
        DebugLogger.info('boss', `[BossAbilities] Ability ${abilityId} completed`);
    }
    
    // ===============================
    // ABILITY HANDLERS
    // ===============================
    
    /**
     * Základní útok
     */
    executeBasicAttack(abilityData, params) {
        const target = this.scene.player;
        if (!target) return false;
        
        const damage = abilityData.damage || 20;
        const pattern = abilityData.pattern || 'single_shot';
        
        this.boss.shoot(pattern, { 
            damage,
            target,
            projectileId: abilityData.projectileId || 'projectile.boss_basic'
        });
        
        // Attack VFX/SFX
        this.boss.spawnVfx('vfx.boss.attack.basic', this.boss.x, this.boss.y);
        this.boss.playSfx('sfx.boss.attack');
        
        return true;
    }
    
    /**
     * Projektilový burst
     */
    executeProjectileBurst(abilityData, params) {
        const count = abilityData.count || 8;
        const damage = abilityData.damage || 15;
        const spread = abilityData.spreadAngle || 360;
        
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * spread * (Math.PI / 180);

            this._schedule(i * 100, () => {
                this.boss.shoot('directional', {
                    damage,
                    angle,
                    projectileId: abilityData.projectileId || 'projectile.boss_burst'
                });
            });
        }
        
        this.boss.spawnVfx('vfx.boss.burst.charge', this.boss.x, this.boss.y);
        this.boss.playSfx('sfx.boss.burst');
        
        return true;
    }
    
    /**
     * Spawn minionů
     */
    executeMinionSpawn(abilityData, params) {
        const count = abilityData.count || 3;
        const enemyType = abilityData.enemyType || 'enemy.viral_swarm';
        const spawnRadius = abilityData.spawnRadius || 100;
        
        this.boss.spawnMinions(count, enemyType, { radius: spawnRadius });
        
        this.boss.spawnVfx('vfx.boss.spawn.minions', this.boss.x, this.boss.y);
        this.boss.playSfx('sfx.boss.summon');
        
        return true;
    }
    
    /**
     * Teleport strike
     */
    executeTeleportStrike(abilityData, params) {
        const target = this.scene.player;
        if (!target) return false;
        
        const damage = abilityData.damage || 30;
        
        // Deleguje na BossMovement systém
        if (this.boss.movement) {
            this.boss.movement.executeTeleportStrike(target, damage);
        }
        
        this.boss.playSfx('sfx.boss.teleport');
        
        return true;
    }
    
    /**
     * Dash útok
     */
    executeDashAttack(abilityData, params) {
        const target = this.scene.player;
        if (!target) return false;
        
        const damage = abilityData.damage || 25;
        const dashDistance = abilityData.distance || 200;
        
        // Vypočítej směr k hráči
        const angle = Math.atan2(target.y - this.boss.y, target.x - this.boss.x);
        const direction = { x: Math.cos(angle), y: Math.sin(angle) };
        
        // Deleguje na BossMovement systém
        if (this.boss.movement) {
            this.boss.movement.executeDash(direction, dashDistance);
        }
        
        this.boss.playSfx('sfx.boss.dash');
        
        return true;
    }
    
    /**
     * Area damage
     */
    executeAreaDamage(abilityData, params) {
        const radius = abilityData.radius || 150;
        const damage = abilityData.damage || 20;
        const center = params.center || { x: this.boss.x, y: this.boss.y };
        
        // Create damage area - deleguje na ProjectileSystem nebo VFXSystem
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.createDamageArea(center.x, center.y, radius, damage);
        }
        
        this.boss.spawnVfx('vfx.boss.area.explosion', center.x, center.y);
        this.boss.playSfx('sfx.boss.explosion');
        
        return true;
    }
    
    /**
     * Healing schopnost
     */
    executeHealing(abilityData, params) {
        const healAmount = abilityData.healAmount || 50;
        const maxHealRatio = abilityData.maxHealRatio || 0.8; // Max 80% HP
        
        const maxAllowedHp = this.boss.maxHp * maxHealRatio;
        const actualHeal = Math.min(healAmount, maxAllowedHp - this.boss.hp);
        
        if (actualHeal > 0) {
            this.boss.hp += actualHeal;
            
            this.boss.spawnVfx('vfx.boss.heal', this.boss.x, this.boss.y);
            this.boss.playSfx('sfx.boss.heal');
            
            DebugLogger.info('boss', `[BossAbilities] Boss healed for ${actualHeal} HP`);
        }
        
        return true;
    }
    
    /**
     * Shield schopnost
     */
    executeShield(abilityData, params) {
        const shieldAmount = abilityData.shieldAmount || 30;
        const duration = abilityData.duration || 5000;
        
        // Temporary damage reduction via flag
        this.boss._shielded = true;

        this._schedule(duration, () => {
            if (this.boss) this.boss._shielded = false;
        });
        
        this.boss.spawnVfx('vfx.boss.shield.activate', this.boss.x, this.boss.y);
        this.boss.playSfx('sfx.boss.shield');
        
        return true;
    }
    
    /**
     * Rage mode
     */
    executeRageMode(abilityData, params) {
        const speedMultiplier = abilityData.speedMultiplier || 1.5;
        const damageMultiplier = abilityData.damageMultiplier || 1.3;
        const duration = abilityData.duration || 8000;
        
        // Store original values
        const originalSpeed = this.boss.moveSpeed;
        const originalDamage = this.boss.damageMultiplier || 1.0;
        
        // Apply rage bonuses
        this.boss.moveSpeed *= speedMultiplier;
        this.boss.damageMultiplier = originalDamage * damageMultiplier;
        this.boss.setTint(0xFF4444); // Red tint for rage
        
        // Restore after duration (tracked for cleanup)
        this._schedule(duration, () => {
            if (this.boss) {
                this.boss.moveSpeed = originalSpeed;
                this.boss.damageMultiplier = originalDamage;
                this.boss.clearTint();
            }
        });
        
        this.boss.spawnVfx('vfx.boss.rage.activate', this.boss.x, this.boss.y);
        this.boss.playSfx('sfx.boss.rage');
        
        return true;
    }
    
    /**
     * Toxic cloud
     */
    executeToxicCloud(abilityData, params) {
        const cloudCount = abilityData.cloudCount || 3;
        const cloudRadius = abilityData.cloudRadius || 80;
        const damage = abilityData.damage || 5;
        const duration = abilityData.duration || 8000;
        
        for (let i = 0; i < cloudCount; i++) {
            const angle = (i / cloudCount) * Math.PI * 2;
            const distance = 120;
            const cloudX = this.boss.x + Math.cos(angle) * distance;
            const cloudY = this.boss.y + Math.sin(angle) * distance;
            
            // Create toxic cloud - deleguje na VFXSystem
            if (this.scene.vfxSystem) {
                this.scene.vfxSystem.createToxicCloud(cloudX, cloudY, cloudRadius, damage, duration);
            }
        }
        
        this.boss.playSfx('sfx.boss.toxic');
        
        return true;
    }
    
    /**
     * Registruje vlastní ability handler
     */
    registerAbility(abilityId, handler) {
        this.abilityHandlers.set(abilityId, handler);
        DebugLogger.info('boss', `[BossAbilities] Registered custom ability: ${abilityId}`);
    }
    
    /**
     * Získá seznam aktivních schopností
     */
    getActiveAbilities() {
        return Array.from(this.activeAbilities);
    }
    
    /**
     * Zastaví všechny aktivní schopnosti
     */
    stopAllAbilities() {
        this.isExecutingAbility = false;
        this.executionQueue = [];
        this.activeAbilities.clear();
        
        DebugLogger.info('boss', '[BossAbilities] All abilities stopped');
    }
    
    // === BOSS-SPECIFIC ABILITY IMPLEMENTATIONS ===
    
    /**
     * Radiation Pulse - expanding radioactive wave
     */
    executeRadiationPulse(abilityData, params) {
        DebugLogger.info('boss', '[BossAbilities] Executing radiation pulse');
        
        // Visual warning before damage
        if (this.scene.vfxSystem) {
            // Warning circle that expands
            this.scene.vfxSystem.play('boss.radiation.warning', this.boss.x, this.boss.y);
            
            // Actual pulse after warning
            this._schedule(500, () => {
                if (this.scene?.vfxSystem) {
                    this.scene.vfxSystem.play('boss.radiation.pulse', this.boss.x, this.boss.y);
                }
            });
        }
        
        // Play audio — single call, no || fallback (|| plays both when first succeeds)
        if (this.scene.audioSystem) {
            this.scene.audioSystem.play('sound/boss_radiation.mp3');
        }
        
        // Damage nearby player AFTER WARNING DELAY
        const pulseRange = abilityData.range || abilityData.radius || 140;
        const pulseDamage = abilityData.damage || 5;
        this._schedule(500, () => {
            const player = this.scene?.player;
            if (player && player.active && this.boss) {
                const dx = this.boss.x - player.x;
                const dy = this.boss.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= pulseRange) {
                    DebugLogger.info('boss', `[BossAbilities] Radiation pulse hit player for ${pulseDamage} damage at distance ${distance}`);
                    if (player.takeDamage) {
                        player.takeDamage(pulseDamage, 'radiation');
                    }
                }
            }
        });
        
        return true;
    }
    
    /**
     * Toxic Pools - create damaging pools on ground
     */
    executeToxicPools(abilityData, params) {
        DebugLogger.info('boss', '[BossAbilities] Executing toxic pools');
        
        // Play audio — single call
        if (this.scene.audioSystem) {
            this.scene.audioSystem.play('sound/toxic_pools.mp3');
        }
        
        // Create multiple toxic pools around boss
        const poolCount = abilityData.poolCount || 3;
        const poolRadius = abilityData.poolRadius || 80;
        
        for (let i = 0; i < poolCount; i++) {
            const angle = (i / poolCount) * Math.PI * 2;
            const distance = 100 + Math.random() * 150;
            const poolX = this.boss.x + Math.cos(angle) * distance;
            const poolY = this.boss.y + Math.sin(angle) * distance;
            
            if (this.scene.vfxSystem) {
                this.scene.vfxSystem.play('boss.special', poolX, poolY);
            }
        }
        
        // Removed duplicate audio play (was playing toxic_pools.mp3 twice)

        return true;
    }
    
    /**
     * Beam Sweep - rotating laser beam
     */
    executeBeamSweep(abilityData, params) {
        DebugLogger.info('boss', '[BossAbilities] Executing beam sweep');
        const player = this.scene.player;
        if (!player?.active) return false;

        // VFX warning
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('boss.beam.warning', this.boss.x, this.boss.y);
        }

        // Deal damage to player if in range
        const dx = player.x - this.boss.x;
        const dy = player.y - this.boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const range = abilityData.range || 300;
        const damage = abilityData.damage || 10;

        if (dist <= range && player.canTakeDamage?.()) {
            this._schedule(abilityData.chargeTime || 1000, () => {
                if (player?.active) {
                    player.takeDamage(damage, this.boss);
                }
            });
        }

        return true;
    }
    
    /**
     * Summon Irradiated - spawn irradiated enemies
     */
    executeSummonIrradiated(abilityData, params) {
        DebugLogger.info('boss', '[BossAbilities] Executing summon irradiated');
        
        if (this.scene.enemyManager) {
            const count = abilityData.count || 3;
            for (let i = 0; i < count; i++) {
                // Spawn enemy at random position around boss
                const angle = Math.random() * Math.PI * 2;
                const distance = 100 + Math.random() * 100;
                const spawnX = this.boss.x + Math.cos(angle) * distance;
                const spawnY = this.boss.y + Math.sin(angle) * distance;
                
                this.scene.enemyManager.spawnEnemy('enemy.viral_swarm', { x: spawnX, y: spawnY });
            }
        }
        
        return true;
    }
    
    /**
     * Radiation Storm - area denial
     */
    executeRadiationStorm(abilityData, params) {
        DebugLogger.info('boss', '[BossAbilities] Executing radiation storm');
        const player = this.scene.player;

        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('boss.radiation.storm', this.boss.x, this.boss.y);
        }

        // DoT damage in radius over duration
        const damage = abilityData.damage || 3;
        const radius = abilityData.radius || 250;
        const ticks = Math.floor((abilityData.stormDuration || 3000) / (abilityData.tickInterval || 500));

        for (let i = 0; i < ticks; i++) {
            this._schedule(i * (abilityData.tickInterval || 500), () => {
                if (!player?.active) return;
                const dx = player.x - this.boss.x;
                const dy = player.y - this.boss.y;
                if (dx * dx + dy * dy <= radius * radius) {
                    player.takeDamage(damage, this.boss);
                }
            });
        }

        return true;
    }
    
    /**
     * Rapid Beams - multiple quick beams
     */
    executeRapidBeams(abilityData, params) {
        DebugLogger.info('boss', '[BossAbilities] Executing rapid beams');
        const player = this.scene.player;

        const beamCount = abilityData.beamCount || 5;
        const damage = abilityData.damage || 8;
        const range = abilityData.range || 350;

        for (let i = 0; i < beamCount; i++) {
            this._schedule(i * (abilityData.fireRate ? abilityData.fireRate * 1000 : 300), () => {
                if (!player?.active) return;
                if (this.scene?.vfxSystem) {
                    this.scene.vfxSystem.play('boss.beam.warning', this.boss.x, this.boss.y);
                }
                // Damage if in range
                const dx = player.x - this.boss.x;
                const dy = player.y - this.boss.y;
                if (dx * dx + dy * dy <= range * range) {
                    player.takeDamage(damage, this.boss);
                }
            });
        }

        return true;
    }
    
    /**
     * Massive Summon - spawn many enemies
     */
    executeMassiveSummon(abilityData, params) {
        DebugLogger.info('boss', '[BossAbilities] Executing massive summon');
        
        if (this.scene.enemyManager) {
            const count = abilityData.count || 8;
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const distance = 150;
                const spawnX = this.boss.x + Math.cos(angle) * distance;
                const spawnY = this.boss.y + Math.sin(angle) * distance;
                
                this.scene.enemyManager.spawnEnemy('enemy.viral_swarm', { x: spawnX, y: spawnY });
            }
        }
        
        return true;
    }
    
    /**
     * Core Overload - devastating final attack
     */
    executeCoreOverload(abilityData, params) {
        DebugLogger.info('boss', '[BossAbilities] Executing core overload');
        
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('boss.overload.explosion', this.boss.x, this.boss.y);
        }
        
        if (this.scene.audioSystem) {
            this.scene.audioSystem.play('sound/core_overload.mp3');
        }
        
        // Massive damage to player
        const player = this.scene.player;
        if (player && player.takeDamage) {
            const damage = abilityData.damage || 50;
            player.takeDamage(damage, 'overload');
        }
        
        return true;
    }

    /**
     * Schedule a delayedCall with automatic tracking for cleanup
     */
    _schedule(delay, callback) {
        if (!this.scene?.time) return null;
        const timer = this.scene.time.delayedCall(delay, () => {
            // Remove from pending list
            const idx = this._pendingTimers.indexOf(timer);
            if (idx !== -1) this._pendingTimers.splice(idx, 1);
            // Only execute if boss is still alive
            if (this.boss?.active && this.scene) {
                callback();
            }
        });
        this._pendingTimers.push(timer);
        return timer;
    }

    /**
     * Cleanup při odstranění bosse
     */
    cleanup() {
        // Cancel all pending timers
        if (this._pendingTimers) {
            for (const timer of this._pendingTimers) {
                if (timer && timer.destroy) timer.destroy();
            }
            this._pendingTimers = [];
        }

        this.stopAllAbilities();
        this.abilityHandlers.clear();
        this.abilityCooldowns.clear();
        this.boss = null;
        this.scene = null;

        DebugLogger.info('boss', '[BossAbilities] Cleanup completed');
    }
}