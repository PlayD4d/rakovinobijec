import { GameConfig } from '../config.js';

export class Player {
    constructor(scene, x, y) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        
        // Statistiky
        this.maxHp = GameConfig.player.baseHP;
        this.hp = this.maxHp;
        this.speed = GameConfig.player.baseSpeed;
        this.projectileCount = GameConfig.player.baseProjectiles;
        this.projectileDamage = GameConfig.player.projectileDamage;
        this.shootInterval = GameConfig.player.projectileInterval;
        
        // Power-up bonusy
        this.speedBonus = 0;
        this.damageBonus = 0;
        this.projectileBonus = 0;
        this.shootIntervalReduction = 0;
        
        // Vytvořit jako graphics objekt
        this.sprite = scene.add.graphics();
        this.drawPlayer();
        this.sprite.x = x;
        this.sprite.y = y;
        
        // Přidat fyziku
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setCollideWorldBounds(true);
        this.sprite.body.setSize(GameConfig.player.size, GameConfig.player.size);
        this.sprite.body.setOffset(-GameConfig.player.size / 2, -GameConfig.player.size / 2);
        
        // Zakázat rotaci
        this.sprite.body.setAllowRotation(false);
        
        // Invincibility po zásahu
        this.invincible = false;
        this.invincibleTime = 1000; // ms
        
        // Aura a další efekty
        this.aura = null;
        this.auraDamage = 0;
        this.auraRadius = 0;
        
        // Radioterapie - laserové paprsky
        this.hasRadiotherapy = false;
        this.radiotherapyLevel = 0;
        this.radiotherapyTimer = 0;
        
        // Výbušné střely
        this.hasExplosiveBullets = false;
        this.explosiveBulletsLevel = 0;
        
        // Imunoterapie - retězový blesk
        this.hasLightningChain = false;
        this.lightningChainLevel = 0;
        this.lightningChainTimer = 0;
        
        // Cisplatina - průrazné projektily
        this.hasPiercingArrows = false;
        this.piercingArrowsLevel = 0;
        
        // Delší dosah - univerzální range bonus
        this.rangeBonus = 0;
        
        // Imunitní štít
        this.shield = {
            level: 0,
            maxHP: 0,
            currentHP: 0,
            regenTime: 10000, // ms
            regenTimer: 0,
            isRegenerating: false,
            visual: null
        };
    }
    
    drawPlayer() {
        this.sprite.clear();
        
        // Modrý čtverec
        this.sprite.fillStyle(GameConfig.player.color, 1);
        this.sprite.fillRect(
            -GameConfig.player.size / 2,
            -GameConfig.player.size / 2,
            GameConfig.player.size,
            GameConfig.player.size
        );
        
        // Bílý křížek uprostřed (Marda je rytíř)
        this.sprite.fillStyle(0xffffff, 1);
        this.sprite.fillRect(-2, -GameConfig.player.size / 3, 4, GameConfig.player.size * 2/3);
        this.sprite.fillRect(-GameConfig.player.size / 3, -2, GameConfig.player.size * 2/3, 4);
        
        // Černý obrys pro lepší viditelnost
        this.sprite.lineStyle(2, 0x000000, 0.8);
        this.sprite.strokeRect(
            -GameConfig.player.size / 2,
            -GameConfig.player.size / 2,
            GameConfig.player.size,
            GameConfig.player.size
        );
    }
    
    update(cursors, wasd, time, delta) {
        // Kontrola pause stavu ze scény
        if (this.scene.isPaused) {
            return; // Nepohybovat se když je hra pozastavená
        }
        
        // Reset velocity
        this.sprite.body.setVelocity(0);
        
        // Pohyb
        const actualSpeed = (this.speed + this.speedBonus) * 100;
        
        if (cursors.left.isDown || wasd.A.isDown) {
            this.sprite.body.setVelocityX(-actualSpeed);
        } else if (cursors.right.isDown || wasd.D.isDown) {
            this.sprite.body.setVelocityX(actualSpeed);
        }
        
        if (cursors.up.isDown || wasd.W.isDown) {
            this.sprite.body.setVelocityY(-actualSpeed);
        } else if (cursors.down.isDown || wasd.S.isDown) {
            this.sprite.body.setVelocityY(actualSpeed);
        }
        
        // Normalizace diagonálního pohybu
        if (this.sprite.body.velocity.x !== 0 && this.sprite.body.velocity.y !== 0) {
            this.sprite.body.velocity.normalize().scale(actualSpeed);
        }
        
        // Update pozice
        this.x = this.sprite.x;
        this.y = this.sprite.y;
        
        // Update invincibility
        if (this.invincible) {
            this.sprite.alpha = Math.sin(this.scene.time.now * 0.02) * 0.5 + 0.5;
        } else {
            this.sprite.alpha = 1;
        }
        
        // Update aura damage
        if (this.aura && this.auraDamage > 0) {
            this.checkAuraDamage();
        }
        
        // Update radioterapie
        if (this.hasRadiotherapy && this.radiotherapyLevel > 0) {
            this.updateRadiotherapy(time, delta);
        }
        
        // Update imunoterapie - retězový blesk
        if (this.hasLightningChain && this.lightningChainLevel > 0) {
            this.updateLightningChain(time, delta);
        }
        
        // Update štít
        if (this.shield.level > 0) {
            this.updateShield(time, delta);
            // Vždy aktualizovat pozici štítu
            if (this.shield.visual) {
                this.shield.visual.x = this.x;
                this.shield.visual.y = this.y;
            }
        }
    }
    
    takeDamage(amount) {
        if (this.invincible) return;
        
        let remainingDamage = amount;
        
        // Štít absorbuje damage pokud je aktivní
        if (this.shield.level > 0 && this.shield.currentHP > 0) {
            const shieldAbsorbed = Math.min(this.shield.currentHP, remainingDamage);
            this.shield.currentHP -= shieldAbsorbed;
            remainingDamage -= shieldAbsorbed;
            
            // Aktualizovat vizuál štítu
            this.updateShieldVisual();
            
            // Pokud je štít vyčerpaný, spustit regeneraci
            if (this.shield.currentHP <= 0) {
                this.shield.isRegenerating = true;
                this.shield.regenTimer = 0;
                this.createShield(); // Překreslit jako "nabíjející se"
            }
        }
        
        // Zbytek damage na hráče
        if (remainingDamage > 0) {
            this.hp -= remainingDamage;
            this.hp = Math.max(0, this.hp);
        } else {
            // Štít všechen damage vstřebal, žádné invincibility frames
            return;
        }
        
        // Invincibility frames
        this.invincible = true;
        this.scene.time.delayedCall(this.invincibleTime, () => {
            this.invincible = false;
        });
        
        // Flash efekt - překreslíme v červené barvě
        this.sprite.clear();
        this.sprite.fillStyle(0xff0000, 1);
        this.sprite.fillRect(
            -GameConfig.player.size / 2,
            -GameConfig.player.size / 2,
            GameConfig.player.size,
            GameConfig.player.size
        );
        
        // Vrátit normální barvu po chvilce
        this.scene.time.delayedCall(200, () => {
            this.drawPlayer();
        });
    }
    
    heal(amount) {
        this.hp += amount;
        this.hp = Math.min(this.hp, this.maxHp);
        
        // Heal efekt - překreslíme v zelené barvě
        this.sprite.clear();
        this.sprite.fillStyle(0x00ff00, 1);
        this.sprite.fillRect(
            -GameConfig.player.size / 2,
            -GameConfig.player.size / 2,
            GameConfig.player.size,
            GameConfig.player.size
        );
        
        // Vrátit normální barvu po chvilce
        this.scene.time.delayedCall(200, () => {
            this.drawPlayer();
        });
    }
    
    canTakeDamage() {
        return !this.invincible;
    }
    
    applyPowerUp(powerUp) {
        switch (powerUp.type) {
            case 'flamethrower':
                this.hasRadiotherapy = true;
                this.radiotherapyLevel = powerUp.level;
                break;
            case 'explosiveBullets':
                this.hasExplosiveBullets = true;
                this.explosiveBulletsLevel = powerUp.level;
                break;
            case 'lightningChain':
                this.hasLightningChain = true;
                this.lightningChainLevel = powerUp.level;
                break;
            case 'piercingArrows':
                this.hasPiercingArrows = true;
                this.piercingArrowsLevel = powerUp.level;
                break;
            case 'projectileRange':
                this.rangeBonus = powerUp.level * 0.1; // 10% za level
                break;
            case 'speed':
                this.speedBonus += powerUp.value;
                break;
            case 'damage':
                this.damageBonus += powerUp.value;
                this.projectileDamage = GameConfig.player.projectileDamage + this.damageBonus;
                break;
            case 'projectiles':
                this.projectileBonus += powerUp.value;
                this.projectileCount = GameConfig.player.baseProjectiles + this.projectileBonus;
                break;
            case 'attackSpeed':
                this.shootIntervalReduction += powerUp.value;
                this.shootInterval = GameConfig.player.projectileInterval * (1 - this.shootIntervalReduction);
                break;
            case 'maxHp':
                this.maxHp += powerUp.value;
                this.hp += powerUp.value; // Také přidáme aktuální HP
                break;
            case 'aura':
                this.auraDamage += powerUp.value;
                // Růst poloměru o 15% za level (začíná na 50px)
                const baseRadius = 50;
                this.auraRadius = baseRadius * Math.pow(1.15, this.getAuraLevel());
                this.createAura();
                break;
            case 'shield':
                this.shield.level = powerUp.level;
                this.shield.maxHP = 50 + (powerUp.level - 1) * 25; // 50, 75, 100, 125, 150
                this.shield.regenTime = Math.max(6000, 10000 - (powerUp.level - 1) * 1000); // 10s, 9s, 8s, 7s, 6s
                
                // Pokud je štít poprvé aktivovaný, naplnit ho
                if (this.shield.currentHP === 0) {
                    this.shield.currentHP = this.shield.maxHP;
                }
                
                this.createShield();
                break;
        }
    }
    
    getAuraLevel() {
        // Spočítat level podle damage (každých 15 damage = 1 level)
        return Math.floor(this.auraDamage / 15);
    }
    
    createAura() {
        if (!this.aura) {
            this.aura = this.scene.add.graphics();
            this.aura.fillStyle(0x8800ff, 0.3);
            this.aura.fillCircle(0, 0, this.auraRadius);
        } else {
            this.aura.clear();
            this.aura.fillStyle(0x8800ff, 0.3);
            this.aura.fillCircle(0, 0, this.auraRadius);
        }
    }
    
    checkAuraDamage() {
        if (!this.aura || this.auraDamage <= 0) return;
        
        // Update aura pozice
        this.aura.x = this.x;
        this.aura.y = this.y;
        
        // Damage nepřátelům v auře
        this.scene.enemyManager.enemies.children.entries.forEach(enemy => {
            const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (distance <= this.auraRadius) {
                const auraTickDamage = this.auraDamage * 0.05; // Sníženo z 0.1 na 0.05 (50% původní hodnoty)
                // Univerzální tracking damage
                this.scene.recordDamageDealt(auraTickDamage, enemy);
                enemy.takeDamage(auraTickDamage);
                
                // Zkontrolovat jestli nepřítel zemřel
                if (enemy.hp <= 0) {
                    this.scene.handleEnemyDeath(enemy);
                }
            }
        });
    }
    
    updateRadiotherapy(time, delta) {
        // Vypočítat interval mezi výstřely (rychlejší s vyšším levelem)
        const baseInterval = 1000; // 1 sekunda
        const intervalReduction = (this.radiotherapyLevel - 1) * 100; // -100ms za level
        const shootInterval = Math.max(300, baseInterval - intervalReduction); // Minimálně 300ms
        
        this.radiotherapyTimer += delta;
        
        if (this.radiotherapyTimer >= shootInterval) {
            this.fireRadiotherapy();
            this.radiotherapyTimer = 0;
        }
    }
    
    fireRadiotherapy() {
        // Počet paprsků = level
        const rayCount = this.radiotherapyLevel;
        
        // Dosah paprsků
        const baseRange = 200;
        const levelRangeBonus = (this.radiotherapyLevel - 1) * 50;
        const universalRangeBonus = baseRange * this.rangeBonus; // Delší dosah power-up
        const rayRange = baseRange + levelRangeBonus + universalRangeBonus;
        
        // Najít nejbližší nepřátele v dosahu
        const enemies = this.scene.enemyManager.enemies.children.entries.filter(enemy => {
            if (!enemy.active) return false;
            
            const distance = Phaser.Math.Distance.Between(
                this.x, this.y,
                enemy.x, enemy.y
            );
            
            return distance <= rayRange;
        });
        
        if (enemies.length === 0) return;
        
        // Seřadit podle vzdálenosti (nejbližší první)
        enemies.sort((a, b) => {
            const distA = Phaser.Math.Distance.Between(this.x, this.y, a.x, a.y);
            const distB = Phaser.Math.Distance.Between(this.x, this.y, b.x, b.y);
            return distA - distB;
        });
        
        // Vystřelit paprsky na nejbližší nepřátele
        const targetsToHit = Math.min(rayCount, enemies.length);
        
        for (let i = 0; i < targetsToHit; i++) {
            const target = enemies[i];
            this.createRadiotherapyRay(target);
        }
    }
    
    createRadiotherapyRay(target) {
        // Vypočítat počáteční pozici na okraji Mardova těla
        const playerRadius = GameConfig.player.size / 2; // 15px pro velikost 30
        const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
        const startX = this.x + Math.cos(angle) * (playerRadius + 5); // +5px buffer
        const startY = this.y + Math.sin(angle) * (playerRadius + 5);
        
        // Vytvořit vizuální paprsek
        const ray = this.scene.add.graphics();
        
        // Červený laser paprsek
        ray.lineStyle(3, 0xff0000, 0.8);
        ray.beginPath();
        ray.moveTo(startX, startY);
        ray.lineTo(target.x, target.y);
        ray.strokePath();
        
        // Částicový efekt na začátku
        const startParticles = this.scene.add.particles(startX, startY, {
            key: null,
            quantity: 3,
            speed: { min: 50, max: 100 },
            lifespan: 200,
            scale: { start: 0.3, end: 0 },
            tint: 0xff0000
        });
        
        // Částicový efekt na konci
        const endParticles = this.scene.add.particles(target.x, target.y, {
            key: null,
            quantity: 8,
            speed: { min: 80, max: 150 },
            lifespan: 300,
            scale: { start: 0.5, end: 0 },
            tint: 0xff4444
        });
        
        // Poškození nepřítele
        const damage = this.projectileDamage + this.damageBonus;
        // Univerzální tracking damage
        this.scene.recordDamageDealt(damage, target);
        target.takeDamage(damage);
        
        // Zkontrolovat jestli nepřítel zemřel
        if (target.hp <= 0) {
            this.scene.handleEnemyDeath(target);
        }
        
        // Zvukový efekt (pokud existuje)
        if (this.scene.sound && this.scene.sound.get('hit')) {
            this.scene.sound.play('hit', { volume: 0.3 });
        }
        
        // Odstranit vizuální efekty po krátké době
        this.scene.time.delayedCall(150, () => {
            ray.destroy();
            startParticles.destroy();
            endParticles.destroy();
        });
    }
    
    updateLightningChain(time, delta) {
        // Vypočítat interval mezi blesky (rychlejší s vyšším levelem)
        const baseInterval = 2000; // 2 sekundy
        const intervalReduction = (this.lightningChainLevel - 1) * 200; // -200ms za level
        const shootInterval = Math.max(800, baseInterval - intervalReduction); // Minimálně 800ms
        
        this.lightningChainTimer += delta;
        
        if (this.lightningChainTimer >= shootInterval) {
            this.fireLightningChain();
            this.lightningChainTimer = 0;
        }
    }
    
    fireLightningChain() {
        const enemies = this.scene.enemyManager.enemies.children.entries.filter(e => e.active);
        if (enemies.length === 0) return;
        
        // Najít nejbližšího nepřítele jako počáteční cíl
        let closestEnemy = null;
        let closestDistance = Infinity;
        
        enemies.forEach(enemy => {
            const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestEnemy = enemy;
            }
        });
        
        const baseRange = 200;
        const maxRange = baseRange * (1 + this.rangeBonus); // Delší dosah power-up
        if (!closestEnemy || closestDistance > maxRange) return;
        
        // Parametry blesku podle levelu
        const baseDamage = 15 + (this.lightningChainLevel * 10); // 15 + 10 za level
        const maxJumps = 1 + this.lightningChainLevel; // 2 na level 1, 3 na level 2, atd.
        const baseJumpRange = 80 + (this.lightningChainLevel * 20);
        const jumpRange = baseJumpRange * (1 + this.rangeBonus); // Delší dosah power-up
        
        // Spustit retězový blesk
        this.createLightningChain(closestEnemy, baseDamage, maxJumps, jumpRange, []);
    }
    
    createLightningChain(startEnemy, damage, jumpsLeft, jumpRange, hitEnemies) {
        if (!startEnemy || !startEnemy.active || jumpsLeft <= 0) return;
        
        // Přidat aktuálního nepřítele do seznamu zasažených
        hitEnemies.push(startEnemy);
        
        // Poškození nepřítele
        if (startEnemy.takeDamage && typeof startEnemy.takeDamage === 'function') {
            // Univerzální tracking damage
            this.scene.recordDamageDealt(damage, startEnemy);
            startEnemy.takeDamage(damage);
            
            if (startEnemy.hp <= 0) {
                this.scene.handleEnemyDeath(startEnemy);
            }
        }
        
        // Vizuální blesk z předchozí pozice (nebo hráče pro první blesk)
        let fromX, fromY;
        
        if (hitEnemies.length === 1) {
            // První blesk - začít z okraje Mardova těla
            const playerRadius = GameConfig.player.size / 2; // 15px pro velikost 30
            const angle = Phaser.Math.Angle.Between(this.x, this.y, startEnemy.x, startEnemy.y);
            fromX = this.x + Math.cos(angle) * (playerRadius + 5); // +5px buffer
            fromY = this.y + Math.sin(angle) * (playerRadius + 5);
        } else {
            // Následující blesky - z předchozího nepřítele
            fromX = hitEnemies[hitEnemies.length - 2].x;
            fromY = hitEnemies[hitEnemies.length - 2].y;
        }
        
        this.createLightningVisual(fromX, fromY, startEnemy.x, startEnemy.y);
        
        // Najít další nepřítele pro přeskok
        if (jumpsLeft > 1) {
            const enemies = this.scene.enemyManager.enemies.children.entries.filter(e => 
                e.active && !hitEnemies.includes(e)
            );
            
            let nextEnemy = null;
            let closestDistance = Infinity;
            
            enemies.forEach(enemy => {
                const distance = Phaser.Math.Distance.Between(startEnemy.x, startEnemy.y, enemy.x, enemy.y);
                if (distance <= jumpRange && distance < closestDistance) {
                    closestDistance = distance;
                    nextEnemy = enemy;
                }
            });
            
            if (nextEnemy) {
                // Malé zpoždění pro vizuální efekt
                this.scene.time.delayedCall(150, () => {
                    this.createLightningChain(nextEnemy, damage * 0.8, jumpsLeft - 1, jumpRange, hitEnemies);
                });
            }
        }
    }
    
    createLightningVisual(fromX, fromY, toX, toY) {
        const lightning = this.scene.add.graphics();
        
        // Modrý blesk s bílým jádrem
        lightning.lineStyle(4, 0x4444ff, 1);
        lightning.beginPath();
        lightning.moveTo(fromX, fromY);
        lightning.lineTo(toX, toY);
        lightning.strokePath();
        
        lightning.lineStyle(2, 0xffffff, 1);
        lightning.beginPath();
        lightning.moveTo(fromX, fromY);
        lightning.lineTo(toX, toY);
        lightning.strokePath();
        
        // Blesk zmizí po krátké době
        this.scene.tweens.add({
            targets: lightning,
            alpha: 0,
            duration: 200,
            onComplete: () => lightning.destroy()
        });
        
        // Zvukový efekt (pokud existuje)
        if (this.scene.sound.get('hit')) {
            this.scene.sound.play('hit', { volume: 0.3, rate: 1.5 });
        }
    }
    
    updateShield(time, delta) {
        if (this.shield.isRegenerating) {
            this.shield.regenTimer += delta;
            
            // Regenerace dokončena
            if (this.shield.regenTimer >= this.shield.regenTime) {
                this.shield.currentHP = this.shield.maxHP;
                this.shield.isRegenerating = false;
                this.shield.regenTimer = 0;
                this.createShield(); // Překreslit jako aktivní
            } else {
                // Update regenerace vizuálu
                this.updateShieldVisual();
            }
        }
    }
    
    createShield() {
        if (!this.shield.visual) {
            this.shield.visual = this.scene.add.graphics();
        }
        
        this.updateShieldVisual();
    }
    
    updateShieldVisual() {
        if (!this.shield.visual) return;
        
        // Vždy aktualizovat pozici štítu na pozici hráče
        this.shield.visual.x = this.x;
        this.shield.visual.y = this.y;
        
        this.shield.visual.clear();
        
        const shieldRadius = (GameConfig.player.size / 2) + 10; // 10px přesah
        
        if (this.shield.isRegenerating) {
            // Nabíjející se štít - žlutý arc který se postupně naplňuje
            const progress = this.shield.regenTimer / this.shield.regenTime;
            const angle = Math.PI * 2 * progress;
            
            this.shield.visual.lineStyle(4, 0xffaa00, 0.8); // Oranžovo-žlutá
            this.shield.visual.beginPath();
            this.shield.visual.arc(0, 0, shieldRadius, -Math.PI / 2, -Math.PI / 2 + angle);
            this.shield.visual.strokePath();
            
        } else if (this.shield.currentHP > 0) {
            // Aktivní štít - modrý kruh, opacity podle HP
            const hpPercent = this.shield.currentHP / this.shield.maxHP;
            const alpha = 0.3 + (hpPercent * 0.5); // 0.3 - 0.8 alpha
            const color = hpPercent > 0.5 ? 0x0088ff : 0xff8800; // Modrá -> oranžová při nízkém HP
            
            this.shield.visual.fillStyle(color, alpha);
            this.shield.visual.lineStyle(3, color, 0.9);
            this.shield.visual.fillCircle(0, 0, shieldRadius);
            this.shield.visual.strokeCircle(0, 0, shieldRadius);
        }
    }
    
    destroy() {
        this.sprite.destroy();
        if (this.aura) this.aura.destroy();
        if (this.shield.visual) this.shield.visual.destroy();
    }
}