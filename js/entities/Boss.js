/**
 * Boss.js - Třída bosse
 * 
 * PR7 kompatibilní - 100% data-driven implementace
 * Podpora fází a schopností z blueprintů
 * Žádné hardcodované útoky, vše přes ConfigResolver
 */

import { Enemy } from './Enemy.js';

export class Boss extends Enemy {
    constructor(scene, x, y, blueprint, opts = {}) {
        // Validace povinných systémů (PR7 - fail fast)
        if (!scene) throw new Error('[Boss] Chybí scéna');
        if (!scene.configResolver) throw new Error('[Boss] Chybí ConfigResolver');
        if (!scene.projectileSystem?.createEnemyProjectile) throw new Error('[Boss] Chybí ProjectileSystem');
        if (!scene.spawnDirector) throw new Error('[Boss] Chybí SpawnDirector');
        if (!blueprint || blueprint.type !== 'boss' || !blueprint.id) {
            throw new Error('[Boss] Neplatný boss blueprint');
        }
        
        // Příprava konfigurace pro konstruktor Enemy
        const enemyConfig = {
            ...blueprint.stats,
            texture: blueprint.id, // Použití ID jako klíč textury (GameScene ji vygeneruje)
            color: blueprint.display?.color ? parseInt(blueprint.display.color.replace('#', '0x')) : 0xFF0000,
            size: blueprint.stats?.size || 60,
            sfx: blueprint.sfx,
            vfx: blueprint.vfx,
            ...blueprint.mechanics
        };
        
        // Inicializace jako Enemy (Boss dědí z Enemy)
        super(scene, x, y, blueprint.id, enemyConfig);
        
        // ConfigResolver přes dependency injection
        const CR = scene.configResolver;
        
        // Specifické vlastnosti bosse
        this.blueprint = blueprint;
        this.bossName = blueprint.name || blueprint.id;
        
        // Konfigurace pohybu - PR7: přímo z blueprintu
        this.movementType = blueprint.mechanics?.phases?.[0]?.movePattern || 'seek_player';
        this.moveSpeed = blueprint.stats?.speed || 30;
        
        // Systém fází bosse
        this._phases = this._resolvePhases(CR, blueprint); // Načtení fází z blueprintu
        this._phaseIndex = 0; // Aktuální fáze
        this._currentPhase = this._phases[0]; // Začínáme první fází
        this._applyPhase(this._currentPhase);
        
        // Stav schopností za běhu
        this._abilityState = this._initAbilityRuntimeState(this._currentPhase);
        
        // Boss-specific VFX/SFX
        this.vfx = {
            ...this.vfx, // Inherit from Enemy
            phase: blueprint.vfx?.phase1 || 'vfx.boss.phase',
            enter: blueprint.vfx?.spawn || 'vfx.boss.enter'
        };
        this.sfx = {
            ...this.sfx, // Inherit from Enemy
            phase: blueprint.sfx?.phase1 || 'sfx.boss.phase',
            enter: blueprint.sfx?.spawn || 'sfx.boss.enter'
        };
        
        // Boss entrance
        this.entrance();
        
        // Analytics
        if (scene.analyticsManager) {
            scene.analyticsManager.trackBossEncounter(this.bossName, opts.level || 1, scene.player?.hp || 0);
        }
        
        // Debug hook
        scene.frameworkDebug?.onBossSpawn?.(this);
    }
    
    entrance() {
        // Play entrance effects
        this.playVFX('enter');
        this.playSFX('enter');
        
        // Simple fade-in (no tweens for visuals)
        this.alpha = 0;
        this.scene.time.delayedCall(50, () => {
            this.alpha = 1;
        });
        
        // Camera shake for drama
        this.scene.cameras.main.shake(1000, 0.01);
        
        // Switch to boss music
        if (this.scene.audioManager) {
            this.scene.audioManager.playBossMusic();
        }
        
        // Show boss health bar
        if (this.scene.unifiedHUD) {
            const displayName = this.blueprint.display?.devNameFallback || this.bossName || 'Boss';
            console.log('[Boss] Showing health bar for:', displayName, 'HP:', this.hp, '/', this.maxHp);
            this.scene.unifiedHUD.showBoss(displayName, this.hp, this.maxHp);
        } else {
            console.warn('[Boss] No unifiedHUD available!');
        }
    }
    
    /**
     * Aktualizace bosse každý frame
     * Přidává správu fází a schopností navíc k Enemy update
     */
    update(time, delta) {
        if (!this._loggedFirstUpdate) {
            console.log('[Boss] First update call, active:', this.active, 'body:', !!this.body);
            this._loggedFirstUpdate = true;
        }
        
        if (this.scene.isPaused) {
            this.body.setVelocity(0, 0);
            return;
        }
        
        // Pohyb bosse
        this._updateMovement(delta);
        
        // Aktivace schopností
        this._tickAbilities(delta);
        
        // Kontrola přechodu mezi fázemi
        this._checkPhaseTransition();
    }
    
    _updateMovement(dt) {
        const player = this.scene.player;
        if (!player?.active) {
            this.body.setVelocity(0, 0);
            return;
        }
        
        switch (this.movementType) {
            case 'seek_player': {
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                const len = Math.hypot(dx, dy) || 1;
                const vx = (dx / len) * this.moveSpeed;
                const vy = (dy / len) * this.moveSpeed;
                this.body.setVelocity(vx, vy);
                this.rotation = Math.atan2(vy, vx);
                break;
            }
            case 'pattern': {
                // Delegate to pattern system if available
                this.body.setVelocity(0, 0);
                break;
            }
            case 'stationary':
            default:
                this.body.setVelocity(0, 0);
                break;
        }
    }
    
    // Phase management
    _resolvePhases(CR, blueprint) {
        const phases = CR.get('mechanics.phases', { blueprint });
        if (!Array.isArray(phases) || phases.length === 0) {
            // Default single phase if none specified
            return [{
                id: 'default',
                thresholdPct: 0,
                abilities: CR.get('mechanics.abilities', { blueprint }) || []
            }];
        }
        
        // Normalize phases
        return phases.map((p, i) => ({
            id: p.id || `phase_${i}`,
            thresholdPct: p.thresholdPct || 0,
            abilities: p.abilities || []
        }));
    }
    
    _applyPhase(phase) {
        this._currentPhase = phase;
        this._abilityState = this._initAbilityRuntimeState(phase);
        
        // Phase change effects
        this.playVFX('phase');
        this.playSFX('phase');
        
        // Notify HUD
        if (this.scene.unifiedHUD?.setBossPhase) {
            this.scene.unifiedHUD.setBossPhase(phase.id);
        }
        
        // Debug
        this.scene.frameworkDebug?.onBossPhase?.(this, phase.id);
    }
    
    _checkPhaseTransition() {
        const hpPct = this.hp / this.maxHp;
        const nextIndex = this._phaseIndex + 1;
        
        if (nextIndex < this._phases.length) {
            const nextPhase = this._phases[nextIndex];
            if (hpPct <= nextPhase.thresholdPct) {
                this._phaseIndex = nextIndex;
                this._applyPhase(nextPhase);
            }
        }
    }
    
    _initAbilityRuntimeState(phase) {
        const state = [];
        for (let i = 0; i < phase.abilities.length; i++) {
            const ability = phase.abilities[i];
            state.push({
                id: ability.id || `ability_${i}`,
                type: ability.type,
                params: ability.params || {},
                vfxId: ability.vfxId,
                sfxId: ability.sfxId,
                cooldownMs: ability.cooldownMs || 2000,
                timer: ability.initialDelayMs || 0
            });
        }
        return state;
    }
    
    // Ability execution
    _tickAbilities(dt) {
        if (!this._abilityState || this._abilityState.length === 0) return;
        
        for (let i = 0; i < this._abilityState.length; i++) {
            const ability = this._abilityState[i];
            ability.timer -= dt;
            
            if (ability.timer <= 0) {
                this._executeAbility(ability);
                ability.timer = ability.cooldownMs;
            }
        }
    }
    
    _executeAbility(ability) {
        // Get ability params from blueprint
        const abilityData = this.blueprint.mechanics?.abilities?.[ability.id] || {};
        const params = { ...abilityData, ...ability.params };
        
        // Play ability effects
        if (ability.vfxId) {
            this.scene.newVFXSystem?.play(ability.vfxId, this.x, this.y);
        }
        if (ability.sfxId) {
            this.scene.newSFXSystem?.play(ability.sfxId);
        }
        
        // Execute based on type
        switch (ability.type) {
            case 'linear_shot':
                this._executeLinearShot(params);
                break;
            case 'circle_shot':
                this._executeCircleShot(params);
                break;
            case 'pulse':
                this._executePulse(params);
                break;
            case 'spawn_minions':
                this._executeSpawnMinions(params);
                break;
            case 'dash':
                this._executeDash(params);
                break;
            case 'multi_shot':
                this._executeMultiShot(params);
                break;
            case 'tracking_shot':
                this._executeTrackingShot(params);
                break;
            default:
                console.warn(`[Boss] Unknown ability type: ${ability.type}`);
        }
        
        // Analytics
        if (this.scene.analyticsManager) {
            this.scene.analyticsManager.incrementBossSpecialAttacksUsed();
        }
        
        // Debug
        this.scene.frameworkDebug?.onBossAbility?.(this, ability.id);
    }
    
    _executeLinearShot(params) {
        const player = this.scene.player;
        if (!player?.active) return;
        
        const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const spread = ((params.inaccuracyDeg || 0) * Math.PI) / 180;
        const burst = Math.max(1, params.burst || 1);
        
        const fireOnce = () => {
            const jitter = (Math.random() - 0.5) * spread;
            this.scene.projectileSystem.createEnemyProjectile({
                x: this.x,
                y: this.y,
                projectileBlueprintId: params.projectileRef,
                damage: params.damage || this.damage,
                speed: params.speed || 250,
                range: params.range || 500,
                angleRad: baseAngle + jitter,
                owner: this
            });
        };
        
        if (burst === 1) {
            fireOnce();
        } else {
            // Burst fire
            for (let i = 0; i < burst; i++) {
                this.scene.time.delayedCall(i * (params.burstIntervalMs || 100), fireOnce);
            }
        }
    }
    
    _executeCircleShot(params) {
        const count = Math.max(1, params.projectileCount || 12);
        
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            this.scene.projectileSystem.createEnemyProjectile({
                x: this.x,
                y: this.y,
                projectileBlueprintId: params.projectileRef,
                damage: params.damage || this.damage,
                speed: params.speed || 200,
                range: params.range || 400,
                angleRad: angle,
                owner: this
            });
        }
    }
    
    _executeTrackingShot(params) {
        const player = this.scene.player;
        if (!player?.active) return;
        
        const count = params.count || 3;
        for (let i = 0; i < count; i++) {
            this.scene.time.delayedCall(i * 500, () => {
                if (!this.active || !player.active) return;
                
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                const inaccuracy = (Math.random() - 0.5) * 0.35;
                
                this.scene.projectileSystem.createEnemyProjectile({
                    x: this.x,
                    y: this.y,
                    projectileBlueprintId: params.projectileRef,
                    damage: params.damage || this.damage,
                    speed: params.speed || 220,
                    range: params.range || 600,
                    angleRad: angle + inaccuracy,
                    owner: this,
                    homing: {
                        turnRateDeg: params.turnRateDeg || 180,
                        target: player
                    }
                });
            });
        }
    }
    
    _executeMultiShot(params) {
        // Combination attack
        this._executeLinearShot(params.linear || {});
        this.scene.time.delayedCall(500, () => {
            if (this.active) {
                this._executeCircleShot(params.circle || {});
            }
        });
    }
    
    _executePulse(params) {
        // Radial AoE damage
        const player = this.scene.player;
        if (!player?.active) return;
        
        const radius = params.radius || 150;
        const damage = params.damage || this.damage;
        
        // VFX for pulse
        if (this.scene.newVFXSystem) {
            this.scene.newVFXSystem.play('boss.pulse', {
                x: this.x,
                y: this.y,
                radius: radius
            });
        }
        
        // Check player distance
        const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (distance <= radius && player.canTakeDamage?.()) {
            player.takeDamage(damage, { source: this, type: 'pulse' });
        }
    }
    
    _executeSpawnMinions(params) {
        if (!this.scene.spawnDirector) {
            console.warn('[Boss] SpawnDirector not available');
            return;
        }
        
        const count = Math.max(1, params.count || params.poolCount || 3);
        const spreadRadius = params.spreadRadius || params.spawnRadius || 100;
        const enemyTypes = params.enemyTypes || ['enemy.necrotic_cell'];
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * spreadRadius;
            const x = this.x + Math.cos(angle) * r;
            const y = this.y + Math.sin(angle) * r;
            
            // Pick random enemy type from list
            const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            this.scene.spawnDirector.spawnImmediate(enemyType, x, y);
        }
    }
    
    _executeDash(params) {
        // This is the ONLY tween allowed (for movement, not visuals)
        const player = this.scene.player;
        if (!player?.active) return;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = dx / len;
        const ny = dy / len;
        const distance = params.distance || 200;
        const duration = params.durationMs || 500;
        
        // Temporarily boost speed for dash
        const oldSpeed = this.moveSpeed;
        this.moveSpeed = 0; // Disable normal movement during dash
        
        this.scene.tweens.add({
            targets: this,
            x: this.x + nx * distance,
            y: this.y + ny * distance,
            duration: duration,
            onComplete: () => {
                this.moveSpeed = oldSpeed;
                this.scene.frameworkDebug?.onBossDash?.(this);
            }
        });
    }
    
    // Override Enemy's takeDamage
    takeDamage(amount, source) {
        const result = super.takeDamage(amount, source);
        
        // Update boss health bar in HUD
        if (this.scene.unifiedHUD?.setBossHealth) {
            this.scene.unifiedHUD.setBossHealth(this.hp, this.maxHp);
        }
        
        return result;
    }
    
    // Override Enemy's die
    die(source) {
        if (!this.active) return;
        
        // Death effects
        this.playVFX('death');
        this.playSFX('death');
        
        // Boss-specific death event
        this.scene.events.emit('boss:die', {
            boss: this,
            source: source
        });
        
        // Analytics
        if (this.scene.analyticsManager && this.scene.player) {
            this.scene.analyticsManager.trackBossDefeat(this.scene.player.hp);
        }
        
        // Switch music back
        if (this.scene.audioManager) {
            this.scene.audioManager.playLevelMusic();
        }
        
        // Victory effect through VFX system
        if (this.scene.newVFXSystem) {
            this.scene.newVFXSystem.play('boss.victory', this.x, this.y);
        }
        
        // Hide boss health bar
        if (this.scene.unifiedHUD?.hideBossHealth) {
            this.scene.unifiedHUD.hideBossHealth();
        }
        
        super.destroy();
    }
}

// Export for GameScene integration
export default Boss;