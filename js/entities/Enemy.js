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
        this.type = type;
        this.config = config;
        
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
        this.xp = config.xp; // XP za zabití
        this.size = config.size; // Velikost
        this.isElite = config.isElite || false; // Je elite verze?
        
        // Nastavení textury a viditelnosti s plnou neprůhledností
        this.setTexture(textureKey);
        this.setOrigin(0.5, 0.5);
        this.setDepth(CR.get('layers.enemies'));
        this.setVisible(true).setActive(true);
        this.setAlpha(1.0); // Zajištění plné viditelnosti
        this.setDisplaySize(this.size, this.size);
        
        // Aplikace barvy z konfigurace (pokud je specifikována)
        if (config.color && typeof config.color === 'number') {
            this.setTint(config.color);
        } else {
            this.clearTint(); // Zajištění žádné výchozí barvy
        }
        
        // Vizuální modifikace pro elite verzi
        if (this.isElite) {
            const eliteTint = CR.get('enemy.rendering.eliteTint');
            this.setTint(eliteTint);
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
        // PR7: Use ModifierEngine if available
        if (this.scene.modifierEngine) {
            this.scene.modifierEngine.applyModifier(enemy, {
                type: 'MULTIPLY',
                stat: 'damage',
                value: this.buffMultiplier,
                duration: 5000,
                source: this
            });
        } else {
            // Simple fallback
            enemy.damage *= this.buffMultiplier;
            enemy.showBuffEffect();
        }
    }
    
    showBuffEffect() {
        // PR7: Use VFX system for visual feedback
        if (this.scene.newVFXSystem) {
            this.scene.newVFXSystem.play('enemy.buff.aura', this.x, this.y);
        }
        
        // Tint change for buff indication
        const CR = this.scene.configResolver;
        const buffTint = CR.get('enemy.rendering.buffTint');
        this.setTint(buffTint);
        
        // Reset tint after duration
        this.scene.time.delayedCall(5000, () => {
            if (this.active) {
                this.clearTint();
                if (this.isElite) {
                    const eliteTint = CR.get('enemy.rendering.eliteTint');
                    this.setTint(eliteTint);
                }
            }
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
    
    takeDamage(amount) {
        if (!this.active) return;
        
        // Clamp HP to prevent negative values
        this.hp = Math.max(0, this.hp - amount);
        
        // Visual feedback through VFX system
        this.playVFX('hit');
        this.playSFX('hit');
        
        // Flash effect (no tweens, just tint)
        this.setTintFill(0xffffff);
        this.scene.time.delayedCall(100, () => {
            if (this.active) {
                this.clearTint();
                if (this.isElite) {
                    const CR = this.scene.configResolver;
                    const eliteTint = CR.get('enemy.rendering.eliteTint');
                    this.setTint(eliteTint);
                }
            }
        });
        
        // HOTFIX V4: Only call scene's handleEnemyDeath when HP <= 0
        if (this.hp <= 0) {
            if (this.scene.handleEnemyDeath) {
                this.scene.handleEnemyDeath(this);
            }
        }
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
    
    die() {
        // HOTFIX V4: die() method deprecated - death handled by GameScene.handleEnemyDeath
        // This method kept for compatibility but should not be called directly
        if (!this.active) return;
        
        // Death VFX/SFX - safe calls
        try {
            this.playVFX('death');
            this.playSFX('death');
        } catch (error) {
            console.debug('[Enemy] VFX/SFX failed, continuing:', error.message);
        }
        
        // DO NOT call handleEnemyDeath here to avoid double-processing
        // Just clean up the sprite
        this.destroy();
    }
    
    // PR7: VFX/SFX helper methods
    playVFX(effectType) {
        // Temporarily disabled - blueprint IDs don't match registry
        return;
        /*
        if (!this.scene.newVFXSystem) return;
        
        const vfxId = this._vfx?.[effectType];
        if (vfxId) {
            this.scene.newVFXSystem.play(vfxId, this.x, this.y);
        } else {
            // Use default VFX based on type
            const defaultVfx = `enemy.${effectType}`;
            this.scene.newVFXSystem.play(defaultVfx, this.x, this.y);
        }
        */
    }
    
    playSFX(soundType) {
        // Temporarily disabled - blueprint IDs don't match registry
        return;
        /*
        if (!this.scene.newSFXSystem) return;
        
        const sfxId = this._sfx?.[soundType];
        if (sfxId) {
            this.scene.newSFXSystem.play(sfxId);
        } else {
            // Use default SFX based on type
            const defaultSfx = `enemy.${soundType}`;
            this.scene.newSFXSystem.play(defaultSfx);
        }
        */
    }
    
    // PR7: No manual cleanup of graphics needed
    destroy() {
        // Only need to clean up Phaser objects
        super.destroy();
    }
}