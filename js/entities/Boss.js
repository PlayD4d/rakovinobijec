/**
 * Boss.js - Třída bosse
 * 
 * PR7 kompatibilní - 100% data-driven implementace
 * Podpora fází a schopností z blueprintů
 * Žádné hardcodované útoky, vše přes ConfigResolver
 */

import { Enemy } from './Enemy.js';
import { BossAbilitiesV2 } from './BossAbilitiesV2.js';

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
        // PR7: Don't override stats values - they should come directly from blueprint
        const enemyConfig = {
            ...blueprint.stats,  // This includes hp, damage, speed, size, armor, xp
            ...blueprint.mechanics,  // Additional mechanics
            texture: blueprint.id, // Použití ID jako klíč textury (GameScene ji vygeneruje)
            color: blueprint.display?.color ? parseInt(blueprint.display.color.replace('#', '0x')) : 0xFF0000,
            // Don't override size - it's already in stats via spread operator
            sfx: blueprint.sfx,
            vfx: blueprint.vfx
        };
        
        // Inicializace jako Enemy (Boss dědí z Enemy)
        super(scene, x, y, blueprint.id, enemyConfig);
        
        // PR7: Set boss depth slightly above regular enemies
        const bossDepth = scene.DEPTH_LAYERS?.ENEMIES || 1000;
        this.setDepth(bossDepth + 100); // Boss slightly above regular enemies
        
        // ConfigResolver přes dependency injection
        const CR = scene.configResolver;
        
        // Specifické vlastnosti bosse
        this.blueprint = blueprint;
        this.bossName = blueprint.name || blueprint.id;
        
        // Konfigurace pohybu - PR7: přímo z blueprintu
        this.movementType = blueprint.mechanics?.phases?.[0]?.movePattern || 'seek_player';
        this.moveSpeed = blueprint.stats?.speed || 30;
        
        // Store blueprint VFX/SFX for phase-specific mapping - MUST be before _applyPhase
        this.blueprintVFX = blueprint.vfx || {};
        this.blueprintSFX = blueprint.sfx || {};
        
        // Systém fází bosse
        this._phases = this._resolvePhases(CR, blueprint); // Načtení fází z blueprintu
        this._phaseIndex = 0; // Aktuální fáze
        this._currentPhase = this._phases[0]; // Začínáme první fází
        this._isTransitioning = false; // Flag pro fázový přechod
        this._applyPhase(this._currentPhase);
        
        // Stav schopností za běhu
        this._abilityState = this._initAbilityRuntimeState(this._currentPhase);
        
        // Initialize anti-infinite-loop flags
        this._updatingNow = false;
        this._tickingAbilities = false;
        this._checkingPhase = false;
        this._executingAbility = false;
        this._dying = false;
        
        // Boss-specific VFX/SFX - inherit from Enemy and add boss-specific mappings
        this.vfx = {
            ...this._vfx, // Inherit from Enemy blueprint VFX
            phase: blueprint.vfx?.phase1 || 'vfx.boss.phase',
            enter: blueprint.vfx?.spawn || 'vfx.boss.enter'
        };
        this.sfx = {
            ...this._sfx, // Inherit from Enemy blueprint SFX
            phase: blueprint.sfx?.phase1 || 'sfx.boss.phase',
            enter: blueprint.sfx?.spawn || 'sfx.boss.enter'
        };
        
        // Initialize passive auras
        this._initializePassiveAuras();
        
        // Boss entrance
        this.entrance();
        
        // Stop normal enemy spawning during boss fight
        if (scene.spawnDirector) {
            scene.spawnDirector.pauseNormalSpawns = true;
            console.log('[Boss] Normal enemy spawning paused for boss fight');
        }
        
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
        
        // Safety check
        if (!this.active || !this.body) {
            return;
        }
        
        if (this.scene.isPaused) {
            this.body.setVelocity(0, 0);
            return;
        }
        
        // Prevent rapid recursive calls
        if (this._updatingNow) {
            console.warn('[Boss] Preventing recursive update call');
            return;
        }
        this._updatingNow = true;
        
        // Skip all updates during phase transition
        if (this._isTransitioning) {
            // Stop movement during transition
            this.body.setVelocity(0, 0);
            this._updatingNow = false;
            return;
        }
        
        // Stop all actions if player is dead
        const player = this.scene.player;
        if (!player || !player.active || player.hp <= 0) {
            this.body.setVelocity(0, 0);
            this._updatingNow = false;
            return;
        }
        
        try {
            // Pohyb bosse
            this._updateMovement(delta);
            
            // Update passive auras
            this._updatePassiveAuras(time, delta);
            
            // Aktivace schopností
            this._tickAbilities(delta);
            
            // Kontrola přechodu mezi fázemi
            this._checkPhaseTransition();
        } catch (error) {
            console.error('[Boss] Error in update:', error);
        } finally {
            this._updatingNow = false;
        }
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
    
    // Initialize passive auras
    _initializePassiveAuras() {
        const auras = this.blueprint.mechanics?.passiveAuras;
        if (!auras || !Array.isArray(auras)) return;
        
        this._passiveAuras = [];
        
        for (const auraConfig of auras) {
            if (auraConfig.type === 'radiation_field') {
                this._passiveAuras.push({
                    type: 'radiation_field',
                    radius: auraConfig.radius || 120,
                    damage: auraConfig.damage || 2,
                    tickInterval: auraConfig.tickInterval || 1000,
                    slowEffect: auraConfig.slowEffect || 0.15,
                    lastTick: 0,
                    visual: null
                });
                
                // Create aura visual
                if (this.scene.graphicsFactory) {
                    const auraVisual = this.scene.graphicsFactory.create();
                    auraVisual.setDepth(this.depth - 1);
                    this._passiveAuras[this._passiveAuras.length - 1].visual = auraVisual;
                }
            }
        }
        
        console.log('[Boss] Initialized passive auras:', this._passiveAuras.length);
    }
    
    // Update passive auras
    _updatePassiveAuras(time, delta) {
        if (!this._passiveAuras || this._passiveAuras.length === 0) return;
        
        for (const aura of this._passiveAuras) {
            if (aura.type === 'radiation_field') {
                // Update visual
                if (aura.visual && aura.visual.active) {
                    aura.visual.clear();
                    aura.visual.fillStyle(0x4CAF50, 0.15);
                    aura.visual.lineStyle(2, 0x4CAF50, 0.3);
                    aura.visual.fillCircle(this.x, this.y, aura.radius);
                    aura.visual.strokeCircle(this.x, this.y, aura.radius);
                    
                    // Add pulsing effect
                    const pulse = Math.sin(time * 0.002) * 10;
                    aura.visual.strokeCircle(this.x, this.y, aura.radius + pulse);
                }
                
                // Check if player is in aura
                const player = this.scene.player;
                if (player && player.active) {
                    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                    
                    if (dist <= aura.radius) {
                        // Apply slow effect
                        if (!player._radiationSlowed) {
                            player._radiationSlowed = true;
                            player._originalMoveSpeed = player.moveSpeed;
                            const newSpeed = player._originalSpeed * (1 - aura.slowEffect);
                            player.moveSpeed = newSpeed;
                            player.moveSpeed = newSpeed;
                            console.log('[Boss] Player slowed by radiation field:', aura.slowEffect);
                        }
                        
                        // Apply damage on tick
                        if (time - aura.lastTick > aura.tickInterval) {
                            player.takeDamage(aura.damage, { source: this, type: 'radiation_aura' });
                            aura.lastTick = time;
                        }
                    } else {
                        // Remove slow when out of range
                        if (player._radiationSlowed) {
                            player._radiationSlowed = false;
                            player.moveSpeed = player._originalSpeed;
                            player.moveSpeed = player._originalMoveSpeed;
                            console.log('[Boss] Player speed restored');
                        }
                    }
                }
            }
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
        console.log(`[Boss] Applying phase: ${phase?.id}, active: ${this.active}, body: ${!!this.body}`);
        
        // Safety check - don't reset phase if undefined
        if (!phase) {
            console.error('[Boss] Invalid phase object!');
            return;
        }
        
        this._currentPhase = phase;
        
        // Update phase-specific VFX/SFX mappings
        const phaseNumber = this._phaseIndex + 1; // Convert 0-based index to 1-based
        const phaseVFXKey = `phase${phaseNumber}`;
        const phaseSFXKey = `phase${phaseNumber}`;
        
        // Update VFX mapping for current phase
        if (this.blueprintVFX && this.blueprintVFX[phaseVFXKey]) {
            // Ensure objects exist before assigning
            if (!this.vfx) this.vfx = {};
            if (!this._vfx) this._vfx = {};
            
            this.vfx.phase = this.blueprintVFX[phaseVFXKey];
            this._vfx.phase = this.blueprintVFX[phaseVFXKey]; // Also update Enemy's VFX mapping
            console.log(`[Boss] Updated VFX mapping for phase ${phaseNumber}: ${this.vfx.phase}`);
        }
        
        // Update SFX mapping for current phase
        if (this.blueprintSFX && this.blueprintSFX[phaseSFXKey]) {
            // Ensure objects exist before assigning
            if (!this.sfx) this.sfx = {};
            if (!this._sfx) this._sfx = {};
            
            this.sfx.phase = this.blueprintSFX[phaseSFXKey];
            this._sfx.phase = this.blueprintSFX[phaseSFXKey]; // Also update Enemy's SFX mapping
            console.log(`[Boss] Updated SFX mapping for phase ${phaseNumber}: ${this.sfx.phase}`);
        }
        
        // Initialize ability state safely
        try {
            const oldAbilityState = this._abilityState || [];
            this._abilityState = this._initAbilityRuntimeState(phase);
            
            // Preserve existing timers or set reasonable delays to prevent ability spam
            for (const newAbility of this._abilityState) {
                const oldAbility = oldAbilityState.find(old => old.id === newAbility.id);
                if (oldAbility && oldAbility.timer > 0) {
                    // Keep existing timer if it's still counting down
                    newAbility.timer = oldAbility.timer;
                } else {
                    // Set a reasonable initial delay to prevent immediate execution
                    newAbility.timer = Math.max(newAbility.cooldownMs * 0.3, 1000); // 30% of cooldown or 1 second
                }
            }
        } catch (e) {
            console.error('[Boss] Failed to init ability state:', e);
            this._abilityState = [];
        }
        
        // Phase change effects - now using correct phase-specific VFX
        this.playVFX('phase');
        this.playSFX('phase');
        
        // Notify HUD
        if (this.scene.unifiedHUD?.setBossPhase) {
            this.scene.unifiedHUD.setBossPhase(phase.id);
        }
        
        // Debug
        this.scene.frameworkDebug?.onBossPhase?.(this, phase.id);
        
        console.log(`[Boss] Phase applied successfully, abilities: ${this._abilityState?.length || 0}`);
    }
    
    _checkPhaseTransition() {
        // Prevent spam checking
        if (this._checkingPhase || this._isTransitioning) {
            return;
        }
        this._checkingPhase = true;
        
        try {
            const hpPct = this.hp / this.maxHp;
            const nextIndex = this._phaseIndex + 1;
            
            if (nextIndex < this._phases.length) {
                const nextPhase = this._phases[nextIndex];
                if (hpPct <= nextPhase.thresholdPct) {
                    console.log(`[Boss] Phase transition: ${this._phaseIndex} -> ${nextIndex}, HP: ${this.hp}/${this.maxHp} (${(hpPct*100).toFixed(1)}%), nextPhase.thresholdPct: ${nextPhase.thresholdPct}`);
                    
                    // Prevent multiple transitions
                    this._isTransitioning = true;
                    this._phaseIndex = nextIndex;
                    
                    try {
                        this._applyPhase(nextPhase);
                    } catch (e) {
                        console.error('[Boss] Error during phase transition:', e);
                    } finally {
                        // Allow next transition after a delay
                        this.scene.time.delayedCall(200, () => {
                            this._isTransitioning = false;
                        });
                    }
                }
            }
        } finally {
            this._checkingPhase = false;
        }
    }
    
    _initAbilityRuntimeState(phase) {
        const state = [];
        
        // Safety check - ensure abilities exist
        if (!phase || !Array.isArray(phase.abilities)) {
            console.warn('[Boss] Phase has no abilities array:', phase);
            return state;
        }
        
        // Limit iterations to prevent infinite loops
        const maxAbilities = Math.min(phase.abilities.length, 10);
        
        for (let i = 0; i < maxAbilities; i++) {
            const abilityId = phase.abilities[i];
            if (!abilityId || typeof abilityId !== 'string') {
                console.warn(`[Boss] Invalid ability at index ${i}: must be string ID, got:`, abilityId);
                continue;
            }
            
            // PR7: Only string IDs allowed - look up ability data from blueprint
            const abilityData = this.blueprint.mechanics?.abilities?.[abilityId];
            if (!abilityData) {
                console.warn(`[Boss] Ability '${abilityId}' not found in blueprint mechanics.abilities`);
                continue;
            }
            
            // Map ability ID to type - common patterns
            let type = 'linear_shot'; // default
            if (abilityId.includes('circle')) type = 'circle_shot';
            else if (abilityId.includes('tracking')) type = 'tracking_shot';
            else if (abilityId.includes('spawn') || abilityId.includes('summon') || abilityId.includes('pools')) type = 'spawn_minions';
            else if (abilityId.includes('pulse') || abilityId.includes('storm')) type = 'pulse';
            else if (abilityId.includes('dash')) type = 'dash';
            else if (abilityId.includes('multi')) type = 'multi_shot';
            else if (abilityId.includes('beam') || abilityId.includes('fan')) type = 'linear_shot';
            
            const cooldownMs = Math.max(
                abilityData.cooldown || 
                abilityData.interval || 
                (type === 'pulse' ? 5000 : type === 'spawn_minions' ? 8000 : 3000), // Type-based defaults
                1000 // Minimum 1 second
            );
            
            state.push({
                id: abilityId,
                type: type,
                params: abilityData,
                vfxId: this.blueprint.vfx?.[abilityId],
                sfxId: this.blueprint.sfx?.[abilityId],
                cooldownMs: cooldownMs,
                // Start with a random delay between 1-3 seconds to prevent all abilities firing at once
                timer: abilityData.initialDelay || (1000 + Math.random() * 2000),
                _executing: false,
                _lastExecution: 0
            });
        }
        return state;
    }
    
    // Ability execution
    _tickAbilities(dt) {
        if (!this._abilityState || this._abilityState.length === 0) {
            return;
        }
        
        // Stop abilities if player is dead
        const player = this.scene.player;
        if (!player || !player.active || player.hp <= 0) {
            return;
        }
        
        // Prevent ability spam
        if (this._tickingAbilities) {
            console.warn('[Boss] Preventing recursive _tickAbilities call');
            return;
        }
        this._tickingAbilities = true;
        
        try {
            // Safety limit on number of abilities to prevent infinite loops
            const maxAbilities = Math.min(this._abilityState.length, 10);
            
            for (let i = 0; i < maxAbilities; i++) {
                const ability = this._abilityState[i];
                if (!ability) continue;
                
                // Safety check - limit dt to prevent runaway timers
                const safeDt = Math.min(dt, 100); // Max 100ms per frame
                const oldTimer = ability.timer;
                // Only decrement timer if it's positive (countdown)
                if (ability.timer > 0) {
                    ability.timer -= safeDt;
                }
                
                // Check if timer expired
                if (ability.timer <= 0 && !ability._executing) {
                    console.log(`[Boss] Executing ability: ${ability.id} (type: ${ability.type}, cooldown: ${ability.cooldownMs}ms, dt: ${dt}ms, safeDt: ${safeDt}ms, oldTimer: ${oldTimer.toFixed(1)}ms)`);
                    
                    // Additional safety check - prevent same ability from executing too frequently
                    const now = Date.now();
                    const lastExecution = ability._lastExecution || 0;
                    if (now - lastExecution < 1000) { // Minimum 1 second between executions
                        console.warn(`[Boss] Ability ${ability.id} executed too recently (${now - lastExecution}ms ago), skipping`);
                        ability.timer = Math.max(ability.cooldownMs || 2000, 1000); // Reset timer
                        ability._executing = false;
                        continue;
                    }
                    
                    // Mark as executing to prevent re-entry
                    ability._executing = true;
                    ability._lastExecution = now;
                    
                    // Execute the ability
                    this._executeAbility(ability);
                    
                    // Reset timer to cooldown value - ensure minimum 1 second
                    ability.timer = Math.max(ability.cooldownMs || 2000, 1000);
                    ability._executing = false;
                    
                    console.log(`[Boss] Ability ${ability.id} timer reset to: ${ability.timer}ms`);
                }
            }
        } catch (error) {
            console.error('[Boss] Error in _tickAbilities:', error);
        } finally {
            this._tickingAbilities = false;
        }
    }
    
    _executeAbility(ability) {
        // Prevent recursive ability execution
        if (this._executingAbility) {
            console.warn('[Boss] Preventing recursive ability execution');
            return;
        }
        this._executingAbility = true;
        
        try {
            // Get ability params from blueprint
            const abilityData = this.blueprint.mechanics?.abilities?.[ability.id] || {};
            const params = { ...abilityData, ...ability.params };
            
            // Play ability effects
            if (ability.vfxId) {
                this.scene.vfxSystem?.play(ability.vfxId, this.x, this.y);
            }
            if (ability.sfxId) {
                this.scene.audioSystem?.play(ability.sfxId);
            }
            
            // Execute based on specific ability ID first, then fall back to type
            switch (ability.id) {
                // Radiation Core specific abilities
                case 'radiation_pulse':
                    BossAbilitiesV2.executeRadiationPulse(this, params);
                    break;
                case 'beam_sweep':
                    BossAbilitiesV2.executeBeamSweep(this, params);
                    break;
                case 'rapid_beams':
                    BossAbilitiesV2.executeRapidBeams(this, params);
                    break;
                case 'radiation_storm':
                    BossAbilitiesV2.executeRadiationStorm(this, params);
                    break;
                case 'core_overload':
                    BossAbilitiesV2.executeCoreOverload(this, params);
                    break;
                    
                // Generic abilities by type
                case 'toxic_pools':
                case 'summon_irradiated':
                case 'massive_summon':
                    this._executeSpawnMinions(params);
                    break;
                    
                default:
                    // Fall back to type-based execution
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
                        case 'enrage':
                            this._executeEnrage(params);
                            break;
                        case 'multi_shot':
                            this._executeMultiShot(params);
                            break;
                        case 'tracking_shot':
                            this._executeTrackingShot(params);
                            break;
                        default:
                            console.warn(`[Boss] Unknown ability: ${ability.id} (type: ${ability.type})`);
                    }
            }
            
            // Analytics
            if (this.scene.analyticsManager) {
                this.scene.analyticsManager.incrementBossSpecialAttacksUsed();
            }
            
            // Debug
            this.scene.frameworkDebug?.onBossAbility?.(this, ability.id);
        } catch (error) {
            console.error('[Boss] Error executing ability:', error);
        } finally {
            this._executingAbility = false;
        }
    }
    
    _executeLinearShot(params) {
        const player = this.scene.player;
        if (!player?.active) return;
        
        const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const spread = ((params.inaccuracyDeg || 0) * Math.PI) / 180;
        const burst = Math.max(1, params.burst || 1);
        
        const fireOnce = () => {
            const jitter = (Math.random() - 0.5) * spread;
            const angle = baseAngle + jitter;
            const speed = params.speed || 250;
            
            // Calculate velocity components
            const velocity = {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed
            };
            
            // Use the old format that ProjectileSystem expects
            this.scene.projectileSystem.createEnemyProjectile(
                this.x,
                this.y,
                velocity,
                params.damage || this.damage,
                0xff0000,  // Red color for boss projectiles
                false,     // No tracking
                'boss'     // Source type
            );
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
        const speed = params.speed || 200;
        const damage = params.damage || this.damage;
        
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const velocity = {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed
            };
            
            // Use the old format that ProjectileSystem expects
            this.scene.projectileSystem.createEnemyProjectile(
                this.x,
                this.y,
                velocity,
                damage,
                0xff0000,  // Red color for boss projectiles
                false,     // No tracking
                'boss'     // Source type
            );
        }
    }
    
    _executeTrackingShot(params) {
        const player = this.scene.player;
        if (!player?.active) return;
        
        const count = params.count || 3;
        const speed = params.speed || 220;
        const damage = params.damage || this.damage;
        
        for (let i = 0; i < count; i++) {
            this.scene.time.delayedCall(i * 500, () => {
                if (!this.active || !player.active) return;
                
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                const inaccuracy = (Math.random() - 0.5) * 0.35;
                const finalAngle = angle + inaccuracy;
                
                const velocity = {
                    x: Math.cos(finalAngle) * speed,
                    y: Math.sin(finalAngle) * speed
                };
                
                // Use the old format that ProjectileSystem expects
                // Note: tracking is simplified since current ProjectileSystem doesn't support advanced homing
                this.scene.projectileSystem.createEnemyProjectile(
                    this.x,
                    this.y,
                    velocity,
                    damage,
                    0xff0000,  // Red color for boss projectiles
                    true,      // Enable tracking
                    'boss'     // Source type
                );
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
        if (!player?.active) {
            console.warn('[Boss] _executePulse: No active player found!');
            return;
        }
        
        const radius = params.radius || 150;
        const damage = params.damage || this.damage;
        
        console.log(`[Boss] _executePulse: radius=${radius}, damage=${damage}, player pos=(${player.x.toFixed(1)}, ${player.y.toFixed(1)}), boss pos=(${this.x.toFixed(1)}, ${this.y.toFixed(1)}), player hp=${player.hp}/${player.maxHp}`);
        
        // VFX for pulse
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('boss.pulse', {
                x: this.x,
                y: this.y,
                radius: radius
            });
        }
        
        // Check player distance
        const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        console.log(`[Boss] _executePulse: distance=${distance.toFixed(1)}, in range=${distance <= radius}, canTakeDamage=${!!player.canTakeDamage?.()}`);
        
        if (distance <= radius && player.canTakeDamage?.()) {
            console.log(`[Boss] _executePulse: Applying ${damage} damage to player (current HP: ${player.hp})`);
            const result = player.takeDamage(damage, { source: this, type: 'pulse' });
            console.log(`[Boss] _executePulse: Damage result:`, result, `new player HP: ${player.hp}`);
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
            
            try {
                this.scene.spawnDirector.spawnImmediate(enemyType, x, y);
            } catch (error) {
                console.error(`[Boss] Error spawning minion ${i+1}:`, error);
            }
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
        
        // VFX for dash
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('vfx.boss.dash.onkogen', this.x, this.y);
        }
        
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
    
    _executeEnrage(params) {
        const duration = params.duration || 10000;
        const speedMultiplier = params.speedMultiplier || 1.5;
        const damageMultiplier = params.damageMultiplier || 1.3;
        const attackSpeedMultiplier = params.attackSpeedMultiplier || 1.5;
        
        // Already enraged - don't stack
        if (this._enraged) return;
        
        this._enraged = true;
        
        // Store original values
        const originalSpeed = this.moveSpeed;
        const originalDamage = this.damage;
        const originalColor = this.tint;
        
        // Apply enrage bonuses
        this.moveSpeed *= speedMultiplier;
        this.damage *= damageMultiplier;
        
        // Reduce ability cooldowns
        if (this._abilityState) {
            for (const ability of this._abilityState) {
                ability.cooldownMs = Math.floor(ability.cooldownMs / attackSpeedMultiplier);
            }
        }
        
        // Visual effect - red tint and aura
        this.setTint(0xFF0000);
        
        // VFX for enrage
        if (this.scene.vfxSystem) {
            const auraEffect = this.scene.vfxSystem.play('vfx.boss.enrage.aura', this.x, this.y, {
                follow: this,
                duration: duration
            });
            this._enrageAura = auraEffect;
        }
        
        // SFX from blueprint
        if (this.scene.audioSystem) {
            const enrageSFX = this.blueprintSFX?.enrage || this.sfx?.phase;
            if (enrageSFX) {
                this.scene.audioSystem.play(enrageSFX);
            } else {
                console.warn('[Boss] Missing enrage sound in boss blueprint');
            }
        }
        
        // End enrage after duration
        this.scene.time.delayedCall(duration, () => {
            if (!this.active) return;
            
            this._enraged = false;
            
            // Restore original values
            this.moveSpeed = originalSpeed;
            this.damage = originalDamage;
            this.setTint(originalColor);
            
            // Restore ability cooldowns
            if (this._abilityState) {
                for (const ability of this._abilityState) {
                    ability.cooldownMs = Math.floor(ability.cooldownMs * attackSpeedMultiplier);
                }
            }
            
            // Stop aura effect
            if (this._enrageAura && this._enrageAura.stop) {
                this._enrageAura.stop();
                this._enrageAura = null;
            }
        });
    }
    
    // Override Enemy's takeDamage
    takeDamage(amount, source) {
        // Safety check - don't process damage if boss is already dead or scene is invalid
        if (!this.active || !this.scene || this.hp <= 0) {
            return false;
        }
        
        const result = super.takeDamage(amount, source);
        
        // Update boss health bar in HUD
        if (this.scene && this.scene.unifiedHUD && this.scene.unifiedHUD.setBossHealth && this.active) {
            try {
                this.scene.unifiedHUD.setBossHealth(this.hp, this.maxHp);
            } catch (error) {
                console.warn('[Boss] Failed to update health bar:', error.message);
            }
        }
        
        return result;
    }
    
    // Override Enemy's die
    die(source) {
        if (!this.active || !this.scene) return;
        
        // Prevent multiple death calls
        if (this._dying) return;
        this._dying = true;
        
        console.log('[Boss] Die sequence started');
        
        // Death effects
        this.playVFX('death');
        this.playSFX('death');
        
        // Boss-specific death event
        try {
            if (this.scene.events) {
                this.scene.events.emit('boss:die', {
                    boss: this,
                    source: source
                });
            }
        } catch (error) {
            console.warn('[Boss] Failed to emit boss:die event:', error.message);
        }
        
        // Resume normal enemy spawning after boss death
        if (this.scene.spawnDirector) {
            this.scene.spawnDirector.pauseNormalSpawns = false;
            console.log('[Boss] Normal enemy spawning resumed after boss death');
        }
        
        // Clean up passive auras
        if (this._passiveAuras) {
            for (const aura of this._passiveAuras) {
                if (aura.visual) {
                    aura.visual.destroy();
                }
            }
            
            // Restore player speed if slowed
            const player = this.scene.player;
            if (player && player._radiationSlowed) {
                player._radiationSlowed = false;
                player.moveSpeed = player._originalSpeed;
                player.speed = player._originalSpeed;
                console.log('[Boss] Player speed restored after boss death');
            }
        }
        
        // Analytics
        try {
            if (this.scene.analyticsManager && this.scene.player) {
                this.scene.analyticsManager.trackBossDefeat(this.scene.player.hp);
            }
        } catch (error) {
            console.warn('[Boss] Failed to track boss defeat:', error.message);
        }
        
        // Switch music back to level music
        try {
            if (this.scene.bossMusic) {
                this.scene.bossMusic.stop();
            }
            
            if (this.scene.sound && this.scene.cache.audio.has('levelMusic1')) {
                this.scene.backgroundMusic = this.scene.sound.add('levelMusic1', {
                    loop: true,
                    volume: 0.3
                });
                this.scene.backgroundMusic.play();
                console.log('🎵 Returned to level music after boss defeat');
            }
        } catch (error) {
            console.debug('[Music] Failed to switch back to level music:', error.message);
        }
        
        // Victory effect through VFX system
        try {
            if (this.scene.vfxSystem) {
                this.scene.vfxSystem.play('boss.victory', this.x, this.y);
            }
        } catch (error) {
            console.warn('[Boss] Failed to play victory VFX:', error.message);
        }
        
        // Hide boss health bar
        try {
            if (this.scene && this.scene.unifiedHUD && this.scene.unifiedHUD.hideBoss) {
                this.scene.unifiedHUD.hideBoss();
            }
        } catch (error) {
            console.warn('[Boss] Failed to hide boss health bar:', error.message);
        }
        
        // Clean up any active graphics from abilities
        try {
            if (this.scene && this.scene.graphicsFactory) {
                // Force cleanup of any remaining graphics
                this.scene.children.list.forEach(child => {
                    if (child && child.type === 'Graphics' && child.active) {
                        this.scene.graphicsFactory.release(child);
                    }
                });
            }
        } catch (error) {
            console.warn('[Boss] Failed to cleanup graphics:', error.message);
        }
        
        console.log('[Boss] Die sequence completed, calling super.destroy()');
        
        // Switch back to game music when boss dies
        if (this.scene.audioSystem) {
            this.scene.audioSystem.switchMusicCategory('game', {
                fadeOut: 500,
                fadeIn: 1000
            });
            console.log('[Boss] Switched back to game music');
        }
        
        try {
            super.destroy();
        } catch (error) {
            console.error('[Boss] Failed to destroy boss:', error.message);
        }
    }
}

// Export for GameScene integration
export default Boss;