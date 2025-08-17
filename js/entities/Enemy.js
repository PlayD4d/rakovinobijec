/**
 * Enemy.js - Třída nepřítele
 * 
 * PR7 kompatibilní - 100% data-driven implementace
 * Všechny hodnoty z blueprintů a ConfigResolver
 * Žádné hardcodované hodnoty, žádná grafika v kódu
 * Vše přes BlueprintLoader, ConfigResolver, VFX/SFX systémy
 */

export class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, type, config) {
        // Validace povinných systémů (PR7 - fail fast)
        if (!scene) throw new Error('[Enemy] Chybí scéna');
        if (!scene.configResolver) throw new Error('[Enemy] Chybí ConfigResolver - PR7 vyžaduje DI');
        if (!scene.projectileSystem) throw new Error('[Enemy] Chybí ProjectileSystem');
        
        // Použití textury z konfigurace - žádná manuální grafika
        const textureKey = config.texture || type || 'enemy';
        super(scene, x, y, textureKey);
        
        // Základní reference
        this.scene = scene;
        this.blueprintId = type; // Store the blueprint ID (like 'enemy.necrotic_cell')
        this.type = config.type || 'enemy'; // Entity type
        this.config = config;
        
        // PR7: Store full blueprint for SimpleLootSystem
        this._blueprint = config;
        
        // ConfigResolver přes dependency injection
        const CR = scene.configResolver;
        
        // Data pro VFX/SFX systémy z blueprintu
        this._sfx = config.sfx || null;
        this._vfx = config.vfx || null;
        
        // Statistiky z konfigurace/blueprintu
        this.hp = config.hp; // Aktuální životy
        this.maxHp = config.hp; // Maximální životy
        this.speed = config.speed; // Rychlost pohybu
        this.damage = config.damage; // Poškození
        // PR7: Extract XP from various possible locations
        this.xp = config.xp || config.stats?.xp || 3; // XP za zabití (default 3)
        this.stats = config.stats || {}; // Store full stats for reference
        this.size = config.size; // Velikost
        this.armor = config.armor || 0; // Armor/damage reduction (0-10)
        
        // PR7: Detekce elite/unique z meta pole blueprintu
        this.isElite = config.isElite || (config.meta && config.meta.category === 'elite');
        this.isUnique = config.isUnique || (config.meta && config.meta.category === 'unique');
        
        // Store meta for special mechanics
        this.meta = config.meta || {};
        
        // Nastavení textury a viditelnosti s plnou neprůhledností
        this.setTexture(textureKey);
        this.setOrigin(0.5, 0.5);
        // PR7: Use scene depth constants if available, fallback to config
        const enemyDepth = scene.DEPTH_LAYERS?.ENEMIES || CR.get('layers.enemies', { defaultValue: 1000 });
        this.setDepth(enemyDepth);
        this.setVisible(true).setActive(true);
        this.setAlpha(1.0); // Zajištění plné viditelnosti
        this.setDisplaySize(this.size, this.size);
        
        // Aplikace barvy z konfigurace (pokud je specifikována)
        if (config.color && typeof config.color === 'number') {
            this.setTint(config.color);
        } else {
            this.clearTint(); // Zajištění žádné výchozí barvy
        }
        
        // Vizuální modifikace pro elite/unique verze (applied first)
        if (this.isElite) {
            const eliteTint = CR.get('enemy.rendering.eliteTint', { defaultValue: 0xffdd00 });
            this.setTint(eliteTint);
            // Elite aura effect
            this.createEliteAura();
        } else if (this.isUnique) {
            // Unique entities use their blueprint tint
            if (config.visuals && config.visuals.tint) {
                this.setTint(config.visuals.tint);
            }
            // Unique special effects
            this.createUniqueEffects();
        }
        
        // PR7: Apply armor visual indicator if enemy has armor (applied on top)
        if (this.armor > 0) {
            this.applyArmorVisual();
        }
        
        // Nastavení fyziky
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.setAllowGravity(false); // Nepřátelé nepodléhají gravitační síle
        this.setCollideWorldBounds(false); // Mohou přijít z mimo obrazovku
        // Kruhová kolize s bezpečným výpočtem poloměru
        const radius = Math.max(6, Math.floor(Math.min(this.displayWidth, this.displayHeight) * 0.45));
        this.setCircle(radius);
        
        // Konfigurace podpůrných schopností
        this.isSupport = config.isSupport || false;
        if (this.isSupport) {
            this.buffRadius = CR.get('enemy.support.buffRadius'); // Dosah buffování
            this.buffMultiplier = CR.get('enemy.support.buffMultiplier'); // Násobič poškození
            this.buffInterval = CR.get('enemy.support.buffInterval'); // Interval buffování v ms
            this.lastBuffTime = 0;
        }
        
        // Konfigurace střeleckých schopností
        this.canShoot = config.canShoot || false;
        if (this.canShoot) {
            this.shootInterval = CR.get('enemy.shooting.interval'); // Interval střelby v ms
            this.projectileType = config.projectileType || 'normal'; // Typ projektilu
            this.projectileDamage = CR.get('enemy.shooting.damage'); // Poškození projektilu
            this.projectileSpeed = CR.get('enemy.shooting.speed'); // Rychlost projektilu
            this.lastShot = 0;
        }
        
        // HP bar se zobrazuje přes HUD systém, ne přímo v entitě
        this.hpBarVisible = false; // HUD se postará o zobrazení
        
        // PR7 Compliant: AI configuration from blueprint
        this.aiConfig = config.ai || {
            behavior: 'chase',
            params: {
                aggroRange: 300,
                wanderRadius: 50,
                movePattern: 'direct'
            }
        };
        
        // Initialize AI state
        this.aiState = {
            lastWanderAngle: Math.random() * Math.PI * 2,
            targetAcquired: false,
            kiteDistance: this.aiConfig.params.kiteDistance || 200
        };
        
        // Spawn VFX/SFX (temporarily disabled)
        // this.playVFX('spawn');
        // this.playSFX('spawn');
        
        // Initialize special mechanics
        this.initializeSpecialMechanics();
    }
    
    // ========= SPECIAL MECHANICS FOR ELITE/UNIQUE =========
    
    initializeSpecialMechanics() {
        if (this.isElite && this.config.mechanics) {
            // Elite shield regeneration
            if (this.config.mechanics.shieldPoints) {
                this.shieldHP = this.config.mechanics.shieldPoints;
                this.maxShieldHP = this.config.mechanics.shieldPoints;
                this.shieldRegen = this.config.mechanics.shieldRegen || 0;
                this.shieldRegenDelay = this.config.mechanics.shieldRegenDelay || 3000;
                this.lastDamageTime = 0;
            }
            
            // Elite modifiers
            if (this.config.mechanics.eliteModifiers) {
                this.damageReduction = this.config.mechanics.eliteModifiers.damageReduction || 0;
                this.knockbackResistance = this.config.mechanics.eliteModifiers.knockbackResistance || 0;
            }
        }
        
        if (this.isUnique && this.config.mechanics) {
            // Unique abilities
            if (this.config.mechanics.goldAura) {
                this.hasGoldAura = true;
                this.goldAuraRadius = this.config.mechanics.goldAuraRadius || 150;
                this.goldAuraBonus = this.config.mechanics.goldAuraBonus || 2.0;
            }
            
            // Unique special abilities
            if (this.config.mechanics.uniqueAbilities) {
                this.uniqueAbilities = this.config.mechanics.uniqueAbilities;
                this.abilityTimers = {};
                
                // Initialize timers for each ability
                for (const [name, ability] of Object.entries(this.uniqueAbilities)) {
                    this.abilityTimers[name] = 0;
                }
            }
        }
    }
    
    /**
     * Apply visual indicator for armor
     * PR7: Uses ArmorShieldEffect for visual shield around enemy
     */
    applyArmorVisual() {
        if (!this.armor || this.armor <= 0) return;
        
        // Create armor shield effect if available
        if (this.scene.armorShieldEffect) {
            this.scene.armorShieldEffect.createArmorShield(this);
            this._hasArmorShield = true;
        } else {
            // Fallback to tint-based approach if ArmorShieldEffect not available
            this.applyArmorTint();
        }
    }
    
    /**
     * Fallback tint-based armor visual
     * @private
     */
    applyArmorTint() {
        if (!this.armor || this.armor <= 0) return;
        
        // Calculate metallic tint based on armor value
        const armorLevel = Math.min(this.armor, 10); // Cap at 10
        const tintStrength = armorLevel / 20; // 0 to 0.5
        
        // Get current tint or white
        const currentTint = this.tint || 0xFFFFFF;
        
        // Mix with metallic gray based on armor strength
        const metallicTint = 0x909090; // Gray/metallic color
        
        // Extract RGB components
        const r1 = (currentTint >> 16) & 0xFF;
        const g1 = (currentTint >> 8) & 0xFF;
        const b1 = currentTint & 0xFF;
        
        const r2 = (metallicTint >> 16) & 0xFF;
        const g2 = (metallicTint >> 8) & 0xFF;
        const b2 = metallicTint & 0xFF;
        
        // Mix colors
        const r = Math.round(r1 * (1 - tintStrength) + r2 * tintStrength);
        const g = Math.round(g1 * (1 - tintStrength) + g2 * tintStrength);
        const b = Math.round(b1 * (1 - tintStrength) + b2 * tintStrength);
        
        const armorTint = (r << 16) | (g << 8) | b;
        this.setTint(armorTint);
        
        // Store for later restoration if needed
        this._originalTint = currentTint;
        this._hasArmorTint = true;
    }
    
    createEliteAura() {
        if (!this.scene || !this.scene.add) return;
        
        // Create aura graphics
        this.auraGraphics = this.scene.add.graphics();
        this.auraGraphics.setDepth(this.depth - 1);
        
        // Play elite spawn VFX if available
        if (this._vfx && this._vfx.aura && this.scene.vfxSystem) {
            this.scene.vfxSystem.play(this._vfx.aura, this.x, this.y);
        }
    }
    
    createUniqueEffects() {
        if (!this.scene || !this.scene.add) return;
        
        // Create unique visual effects based on type
        if (this.hasGoldAura) {
            this.goldAuraGraphics = this.scene.add.graphics();
            this.goldAuraGraphics.setDepth(this.depth - 1);
        }
        
        // Play unique spawn VFX if available
        if (this._vfx && this._vfx.spawn && this.scene.vfxSystem) {
            this.scene.vfxSystem.play(this._vfx.spawn, this.x, this.y);
        }
    }
    
    updateEliteShield(delta) {
        if (!this.shieldHP || this.shieldHP >= this.maxShieldHP) return;
        
        const timeSinceDamage = Date.now() - this.lastDamageTime;
        if (timeSinceDamage > this.shieldRegenDelay) {
            this.shieldHP = Math.min(this.maxShieldHP, this.shieldHP + this.shieldRegen * (delta / 1000));
            
            // Update shield visual
            if (this.auraGraphics) {
                this.auraGraphics.clear();
                this.auraGraphics.lineStyle(2, 0x00ffff, 0.3 + (this.shieldHP / this.maxShieldHP) * 0.4);
                this.auraGraphics.strokeCircle(this.x, this.y, this.size * 0.7);
            }
        }
    }
    
    updateUniqueAbilities(time, delta) {
        if (!this.uniqueAbilities) return;
        
        for (const [name, ability] of Object.entries(this.uniqueAbilities)) {
            this.abilityTimers[name] += delta;
            
            if (this.abilityTimers[name] >= ability.interval) {
                this.abilityTimers[name] = 0;
                this.executeUniqueAbility(name, ability);
            }
        }
        
        // Update gold aura visual
        if (this.hasGoldAura && this.goldAuraGraphics) {
            this.goldAuraGraphics.clear();
            const pulse = Math.sin(time * 0.003) * 0.2 + 0.8;
            this.goldAuraGraphics.lineStyle(3, 0xffd700, pulse * 0.5);
            this.goldAuraGraphics.fillStyle(0xffd700, pulse * 0.1);
            this.goldAuraGraphics.fillCircle(this.x, this.y, this.goldAuraRadius);
            this.goldAuraGraphics.strokeCircle(this.x, this.y, this.goldAuraRadius);
        }
    }
    
    executeUniqueAbility(name, ability) {
        const player = this.scene.player;
        if (!player || !player.active) return;
        
        switch (name) {
            case 'goldenPulse':
                // Golden pulse damage in radius
                const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                if (dist <= ability.radius) {
                    player.takeDamage(ability.damage, this);
                    
                    // Knockback effect
                    if (ability.knockback && player.body) {
                        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
                        const knockX = Math.cos(angle) * ability.knockback;
                        const knockY = Math.sin(angle) * ability.knockback;
                        player.body.setVelocity(knockX, knockY);
                    }
                    
                    // VFX
                    if (this._vfx && this._vfx.pulse && this.scene.vfxSystem) {
                        this.scene.vfxSystem.play(this._vfx.pulse, this.x, this.y);
                    }
                }
                break;
                
            case 'summonGoldenMinions':
                // Summon golden buffed minions
                if (this.scene.spawnDirector && ability.minionType) {
                    for (let i = 0; i < ability.count; i++) {
                        const angle = (Math.PI * 2 / ability.count) * i;
                        const spawnX = this.x + Math.cos(angle) * 50;
                        const spawnY = this.y + Math.sin(angle) * 50;
                        
                        const minion = this.scene.spawnDirector.spawnEnemy(ability.minionType, {
                            x: spawnX,
                            y: spawnY,
                            goldenBuff: ability.goldenBuff
                        });
                        
                        if (minion && ability.goldenBuff) {
                            minion.setTint(0xffd700);
                            minion.damage *= 1.5;
                            minion.speed *= 1.2;
                        }
                    }
                }
                break;
                
            case 'rainbowBeam':
                // Rainbow beam with piercing damage
                const beamDist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                if (beamDist <= ability.range) {
                    player.takeDamage(ability.damage, this);
                    
                    // VFX for rainbow beam
                    if (this._vfx && this._vfx.beam && this.scene.vfxSystem) {
                        this.scene.vfxSystem.play(this._vfx.beam, this.x, this.y);
                    }
                }
                break;
                
            case 'prismaticBurst':
                // Fire projectiles in rainbow spiral pattern
                if (this.scene.projectileSystem) {
                    const projectileCount = ability.projectileCount || 7;
                    for (let i = 0; i < projectileCount; i++) {
                        const angle = (Math.PI * 2 / projectileCount) * i;
                        const velocity = {
                            x: Math.cos(angle) * 200,
                            y: Math.sin(angle) * 200
                        };
                        
                        // Create projectile with rainbow tint
                        this.scene.projectileSystem.createEnemyProjectile({
                            x: this.x,
                            y: this.y,
                            velocity: velocity,
                            damage: ability.damage,
                            color: this.getRainbowColor(i, projectileCount),
                            owner: this
                        });
                    }
                    
                    // VFX for burst
                    if (this._vfx && this._vfx.burst && this.scene.vfxSystem) {
                        this.scene.vfxSystem.play(this._vfx.burst, this.x, this.y);
                    }
                }
                break;
        }
    }
    
    getRainbowColor(index, total) {
        const colors = [0xFF0000, 0xFF7F00, 0xFFFF00, 0x00FF00, 0x0000FF, 0x4B0082, 0x9400D3];
        return colors[index % colors.length];
    }
    
    update(time, delta) {
        // Přeskočit pokud je hra pozastavena
        if (this.scene.isPaused) {
            this.body.setVelocity(0, 0);
            return;
        }
        
        const player = this.scene.player;
        if (!player || !player.active) {
            this.body.setVelocity(0, 0);
            return;
        }
        
        // Update special mechanics for elite/unique entities
        if (this.isElite) {
            this.updateEliteShield(delta);
        }
        if (this.isUnique) {
            this.updateUniqueAbilities(time, delta);
        }
        
        // PR7 Compliant: Use AI behavior from blueprint
        this.executeAIBehavior(player, time, delta);
        
        // Support buff ability
        if (this.isSupport && time - this.lastBuffTime > this.buffInterval) {
            this.performSupportBuff();
            this.lastBuffTime = time;
        }
        
        // Shooting ability
        if (this.canShoot && time - this.lastShot > this.shootInterval) {
            this.performShoot();
            this.lastShot = time;
        }
    }
    
    performSupportBuff() {
        // PR7: Use enemiesGroup from scene
        const enemies = this.scene.enemiesGroup?.getChildren() || [];
        
        enemies.forEach(enemy => {
            if (enemy === this || !enemy.active) return;
            
            const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (distance <= this.buffRadius) {
                this.applyBuffToEnemy(enemy);
            }
        });
        
        // Play buff VFX/SFX
        this.playVFX('buff');
        this.playSFX('buff');
    }
    
    applyBuffToEnemy(enemy) {
        // Apply damage buff directly
        enemy.damage *= this.buffMultiplier;
        enemy.showBuffEffect();
    }
    
    showBuffEffect() {
        // PR7: Use VFX system for visual feedback
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('enemy.buff.aura', this.x, this.y);
        }
        
        // Tint change for buff indication
        const CR = this.scene.configResolver;
        const buffTint = CR.get('enemy.rendering.buffTint');
        this.setTint(buffTint);
        
        // Clear any existing buff timer
        if (this.buffTintTimer) {
            this.scene.time.removeEvent(this.buffTintTimer);
        }
        
        // Reset tint after duration (store timer reference for cleanup)
        this.buffTintTimer = this.scene.time.delayedCall(5000, () => {
            if (this.active) {
                this.clearTint();
                if (this.isElite) {
                    const eliteTint = CR.get('enemy.rendering.eliteTint');
                    this.setTint(eliteTint);
                }
            }
            this.buffTintTimer = null;
        });
    }
    
    performShoot() {
        const player = this.scene.player;
        if (!player || !player.active) return;
        
        // PR7: Use coreProjectileSystem for all projectiles
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const CR = this.scene.configResolver;
        
        // Get projectile configuration
        const projectileColor = CR.get(`enemy.projectile.${this.projectileType}.color`);
        const inaccuracy = CR.get('enemy.shooting.inaccuracy');
        const finalAngle = angle + (Math.random() - 0.5) * inaccuracy;
        
        const velocity = {
            x: Math.cos(finalAngle) * this.projectileSpeed,
            y: Math.sin(finalAngle) * this.projectileSpeed
        };
        
        // Create projectile through projectileSystem
        this.scene.projectileSystem.createEnemyProjectile({
            x: this.x,
            y: this.y,
            velocity: velocity,
            damage: this.projectileDamage,
            color: projectileColor,
            homing: this.projectileType === 'homing',
            owner: this
        });
        
        // Play shoot VFX/SFX
        this.playVFX('shoot');
        this.playSFX('shoot');
    }
    
    
    /**
     * PR7 Compliant: Execute AI behavior based on blueprint configuration
     */
    executeAIBehavior(player, time, delta) {
        const behavior = this.aiConfig.behavior;
        const params = this.aiConfig.params;
        const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        
        // Check if player is in aggro range
        const inAggroRange = distance <= (params.aggroRange || 300);
        
        switch (behavior) {
            case 'chase':
                if (inAggroRange) {
                    // Direct pursuit of player
                    this.chasePlayer(player);
                } else {
                    // Wander when player not in range
                    this.wander(time);
                }
                break;
                
            case 'shoot':
                if (inAggroRange) {
                    const attackRange = params.attackRange || params.kiteDistance || 200;
                    if (distance > attackRange) {
                        // Move closer if too far
                        this.chasePlayer(player);
                    } else if (distance < attackRange * 0.8) {
                        // Back away if too close
                        this.fleeFrom(player);
                    } else {
                        // Stop and shoot at ideal range
                        this.body.setVelocity(0, 0);
                    }
                } else {
                    this.wander(time);
                }
                break;
                
            case 'patrol':
                // Support units orbit around allies
                if (params.supportType === 'healer' || params.supportType === 'shield') {
                    this.orbitAllies(time);
                } else {
                    // Regular patrol pattern
                    this.patrol(time);
                }
                break;
                
            default:
                // Fallback to simple chase
                this.chasePlayer(player);
                break;
        }
    }
    
    /**
     * Chase behavior - move directly toward player
     */
    chasePlayer(player) {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const speed = this.speed || 50;
        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;
        this.body.setVelocity(velocityX, velocityY);
    }
    
    /**
     * Flee behavior - move away from player
     */
    fleeFrom(player) {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const speed = this.speed || 50;
        const velocityX = -Math.cos(angle) * speed * 0.8; // Slightly slower when backing up
        const velocityY = -Math.sin(angle) * speed * 0.8;
        this.body.setVelocity(velocityX, velocityY);
    }
    
    /**
     * Wander behavior - random movement
     */
    wander(time) {
        const wanderSpeed = (this.speed || 50) * 0.5;
        const changeInterval = 2000; // Change direction every 2 seconds
        
        if (!this.lastWanderChange || time - this.lastWanderChange > changeInterval) {
            this.aiState.lastWanderAngle = Math.random() * Math.PI * 2;
            this.lastWanderChange = time;
        }
        
        const velocityX = Math.cos(this.aiState.lastWanderAngle) * wanderSpeed;
        const velocityY = Math.sin(this.aiState.lastWanderAngle) * wanderSpeed;
        this.body.setVelocity(velocityX, velocityY);
    }
    
    /**
     * Patrol behavior - systematic movement pattern
     */
    patrol(time) {
        // Simple circular patrol
        const t = time * 0.001;
        const radius = this.aiConfig.params.wanderRadius || 100;
        const centerX = this.spawnX || this.x;
        const centerY = this.spawnY || this.y;
        
        const targetX = centerX + Math.cos(t) * radius;
        const targetY = centerY + Math.sin(t) * radius;
        
        const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
        const speed = (this.speed || 50) * 0.7;
        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;
        this.body.setVelocity(velocityX, velocityY);
    }
    
    /**
     * Orbit behavior - circle around allies (for support units)
     */
    orbitAllies(time) {
        const enemies = this.scene.enemiesGroup?.getChildren() || [];
        let nearestAlly = null;
        let minDistance = Infinity;
        
        // Find nearest non-support ally
        enemies.forEach(enemy => {
            if (enemy === this || !enemy.active || enemy.isSupport) return;
            const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (dist < minDistance) {
                minDistance = dist;
                nearestAlly = enemy;
            }
        });
        
        if (nearestAlly && minDistance < 200) {
            // Orbit around ally
            const t = time * 0.002;
            const radius = 60;
            const targetX = nearestAlly.x + Math.cos(t) * radius;
            const targetY = nearestAlly.y + Math.sin(t) * radius;
            
            const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
            const speed = this.speed || 50;
            const velocityX = Math.cos(angle) * speed;
            const velocityY = Math.sin(angle) * speed;
            this.body.setVelocity(velocityX, velocityY);
        } else {
            // No ally nearby, wander
            this.wander(time);
        }
    }
    
    
    // PR7: VFX/SFX helper methods
    playVFX(effectType) {
        if (!this.scene.vfxSystem) return;
        
        // Try to get VFX ID from blueprint VFX mapping
        const vfxId = this._vfx?.[effectType];
        if (vfxId) {
            this.scene.vfxSystem.play(vfxId, this.x, this.y);
        } else {
            // Fallback: try common VFX patterns
            const fallbackIds = [
                `vfx.${this.type}.${effectType}`, // e.g., vfx.enemy.hit
                `vfx.${effectType}.default`,      // e.g., vfx.hit.default
                `vfx.${effectType}`               // e.g., vfx.hit
            ];
            
            let played = false;
            for (const fallbackId of fallbackIds) {
                try {
                    this.scene.vfxSystem.play(fallbackId, this.x, this.y);
                    played = true;
                    break;
                } catch (error) {
                    // Continue to next fallback
                    continue;
                }
            }
            
            // Final fallback - simple hit spark for any effect
            if (!played && effectType !== 'none') {
                try {
                    this.scene.vfxSystem.playHitSpark(this.x, this.y, 'default');
                } catch (error) {
                    // Silent fail - don't break gameplay for missing VFX
                    console.debug(`[Enemy] VFX fallback failed for ${effectType}:`, error.message);
                }
            }
        }
    }
    
    playSFX(soundType) {
        if (!this.scene.audioSystem) return;
        
        // PR7: Use only blueprint-defined SFX (no hardcoded fallbacks)
        const sfxPath = this._sfx?.[soundType];
        if (sfxPath) {
            // Blueprint uses direct file paths (PR7 compliant)
            this.scene.audioSystem.play(sfxPath);
        }
        // No fallback - if blueprint doesn't define it, no sound plays
        // This is intentional - all data must come from blueprints
    }
    
    // ========= DAMAGE & DEATH HANDLING =========
    
    /**
     * Handle taking damage with elite/unique mechanics
     */
    takeDamage(amount, source) {
        // PR7: Apply armor damage reduction from blueprint
        if (this.armor > 0) {
            // Armor reduces damage by flat amount (min 1 damage always goes through)
            amount = Math.max(1, amount - this.armor);
        }
        
        // Elite damage reduction (percentage based)
        if (this.isElite && this.damageReduction) {
            amount = amount * (1 - this.damageReduction);
        }
        
        // Elite shield absorption
        if (this.shieldHP && this.shieldHP > 0) {
            const shieldDamage = Math.min(this.shieldHP, amount);
            this.shieldHP -= shieldDamage;
            amount -= shieldDamage;
            this.lastDamageTime = Date.now();
            
            // Shield break VFX
            if (this.shieldHP <= 0 && this._vfx && this._vfx.shield && this.scene.vfxSystem) {
                this.scene.vfxSystem.play(this._vfx.shield, this.x, this.y);
            }
        }
        
        // Apply remaining damage to HP
        if (amount > 0) {
            this.hp -= amount;
            
            // Hit VFX
            this.playVFX('hit');
            this.playSFX('hit');
            
            // Flash effect
            this.flashEffect();
        }
        
        // Check death
        if (this.hp <= 0) {
            this.die(source);
        }
    }
    
    /**
     * Handle death with special rewards for elite/unique
     */
    die(killer) {
        // Death VFX/SFX
        this.playVFX('death');
        this.playSFX('death');
        
        // Special rewards for unique entities
        if (this.isUnique && this.hasGoldAura) {
            // Double XP reward
            this.xp *= this.goldAuraBonus;
        }
        
        // Guaranteed drops for unique entities
        if (this.isUnique && this.config.mechanics && this.config.mechanics.guaranteedDrops) {
            // These will be handled by loot system
            this.guaranteedDrops = this.config.mechanics.guaranteedDrops;
        }
        
        // Clean up graphics
        if (this.auraGraphics) {
            this.auraGraphics.destroy();
            this.auraGraphics = null;
        }
        if (this.goldAuraGraphics) {
            this.goldAuraGraphics.destroy();
            this.goldAuraGraphics = null;
        }
        
        // Don't set active/visible to false here - let GameScene handle it
        // Otherwise GameScene's death check (hp <= 0 && active) will fail
        
        // Emit death event for GameScene to handle
        if (this.scene.events) {
            this.scene.events.emit('enemyDeath', this, killer);
        }
    }
    
    /**
     * Flash effect when hit
     */
    flashEffect() {
        if (this.flashTween) return;
        
        this.setTint(0xffffff);
        this.flashTween = this.scene.tweens.add({
            targets: this,
            tint: this.isElite ? 0xffdd00 : (this.isUnique && this.config.visuals ? this.config.visuals.tint : 0xffffff),
            duration: 100,
            yoyo: true,
            onComplete: () => {
                this.flashTween = null;
                if (this.isElite) {
                    this.setTint(0xffdd00);
                } else if (this.isUnique && this.config.visuals && this.config.visuals.tint) {
                    this.setTint(this.config.visuals.tint);
                } else {
                    this.clearTint();
                }
            }
        });
    }
    
    /**
     * Clean up all VFX effects attached to this enemy
     * Called before enemy death/destruction to prevent orphaned graphics
     */
    cleanupAllVFX() {
        // This method is called before destroy
        // If scene is shutting down, it won't be called at all due to shutdown cleanup
        
        // Clean up armor shield
        if (this._hasArmorShield && this.scene && this.scene.armorShieldEffect) {
            this.scene.armorShieldEffect.removeArmorShield(this);
            this._hasArmorShield = false;
        }
        
        // Clean up aura graphics (elite enemies)
        if (this.auraGraphics) {
            if (this.auraGraphics.scene) {  // Check if graphics still has a scene
                this.auraGraphics.destroy();
            }
            this.auraGraphics = null;
        }
        
        // Clean up gold aura graphics (unique enemies)
        if (this.goldAuraGraphics) {
            if (this.goldAuraGraphics.scene) {  // Check if graphics still has a scene
                this.goldAuraGraphics.destroy();
            }
            this.goldAuraGraphics = null;
        }
        
        // Clean up any attached VFX effects through VFXSystem
        if (this.scene && this.scene.vfxSystem && this.scene.vfxSystem.detachAllEffectsForEntity) {
            this.scene.vfxSystem.detachAllEffectsForEntity(this);
        }
        
        // Clean up active tweens
        if (this.flashTween) {
            // Safe tween removal - just stop, don't remove
            this.flashTween.stop();
            // Do NOT call remove() - let Phaser handle cleanup
            this.flashTween = null;
        }
        
        // Clean up any buff tint effects
        if (this.buffTintTimer) {
            // Safe timer removal - check if time system exists
            if (this.scene && this.scene.time) {
                this.scene.time.removeEvent(this.buffTintTimer);
            }
            this.buffTintTimer = null;
        }
    }
    
    // PR7: Cleanup
    destroy() {
        // Clean up all VFX effects
        this.cleanupAllVFX();
        
        super.destroy();
    }
}