export class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, type, config) {
        super(scene, x, y, null);
        
        this.scene = scene;
        this.type = type;
        this.config = config;
        
        // Statistiky
        this.hp = config.hp;
        this.maxHp = config.hp;
        this.speed = config.speed;
        this.damage = config.damage;
        this.xp = config.xp;
        this.size = config.size;
        this.isElite = config.isElite || false;
        
        // Grafika
        this.graphics = scene.add.graphics();
        this.drawEnemy();
        
        // Fyzika
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setCollideWorldBounds(true);
        this.body.setSize(this.size, this.size);
        
        // Support ability (pro purple Onkogen)
        this.isSupport = config.isSupport || false;
        this.buffRadius = config.buffRadius || 0;
        this.buffMultiplier = config.buffMultiplier || 1;
        this.lastBuffTime = 0;
        this.buffInterval = 1000; // Buff každou sekundu
        
        // Shooting ability (pro brown Nekrotická tkáň)
        this.canShoot = config.canShoot || false;
        this.shootInterval = config.shootInterval || 2000;
        this.projectileType = config.projectileType || 'normal';
        this.projectileDamage = config.projectileDamage || this.damage;
        this.lastShot = 0;
        
        // HP bar
        this.hpBar = scene.add.graphics();
        this.updateHPBar();
    }
    
    drawEnemy() {
        this.graphics.clear();
        this.graphics.fillStyle(this.config.color, 1);
        this.graphics.fillCircle(this.size / 2, this.size / 2, this.size / 2);
        
        // Přidat obrys pro lepší viditelnost
        this.graphics.lineStyle(2, 0x000000, 0.5);
        this.graphics.strokeCircle(this.size / 2, this.size / 2, this.size / 2);
        
        // Elitní nepřátelé mají zlatý obrys
        if (this.isElite) {
            this.graphics.lineStyle(3, 0xffdd00, 1);
            this.graphics.strokeCircle(this.size / 2, this.size / 2, this.size / 2);
            // Vnitřní záře
            this.graphics.lineStyle(1, 0xffff99, 0.5);
            this.graphics.strokeCircle(this.size / 2, this.size / 2, this.size / 2 - 3);
        }
        
        // Vytvoření textury
        const textureName = `enemy_${this.type}_${Date.now()}`;
        this.graphics.generateTexture(textureName, this.size, this.size);
        this.setTexture(textureName);
        this.graphics.destroy();
    }
    
    update(time, delta) {
        // Nekud hra není pozastavená
        if (this.scene.isPaused) {
            this.body.setVelocity(0, 0);
            return;
        }
        
        // Pohyb směrem k hráči
        const player = this.scene.player;
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        
        const velocityX = Math.cos(angle) * this.speed * 100;
        const velocityY = Math.sin(angle) * this.speed * 100;
        
        this.body.setVelocity(velocityX, velocityY);
        
        // Support buff (pro Onkogen)
        if (this.isSupport && time - this.lastBuffTime > this.buffInterval) {
            this.buffNearbyEnemies();
            this.lastBuffTime = time;
        }
        
        // Střelba (pro Nekrotickou tkáň)
        if (this.canShoot && time - this.lastShot > this.shootInterval) {
            this.shoot(angle);
            this.lastShot = time;
        }
        
        // Update HP bar pozice
        this.updateHPBar();
    }
    
    shoot(angle) {
        // Přidat nepřesnost pro nekrotickou tkáň (až ±0.3 radiánu = ~17 stupňů)
        const inaccuracy = (Math.random() - 0.5) * 0.6; // -0.3 až +0.3 radiánu
        const adjustedAngle = angle + inaccuracy;
        
        // Zpomalit střely o 50% (z 200 na 100)
        const projectileSpeed = 100;
        
        const velocity = {
            x: Math.cos(adjustedAngle) * projectileSpeed,
            y: Math.sin(adjustedAngle) * projectileSpeed
        };
        
        const isHoming = this.projectileType === 'homing';
        
        // Hnědé projektily pro nekrotickou tkáň
        const projectileColor = this.config.color === 0x8B4513 ? 0x8B4513 : 0xff0000;
        
        this.scene.projectileManager.createEnemyProjectile(
            this.x,
            this.y,
            velocity,
            this.projectileDamage,
            projectileColor,
            isHoming
        );
    }
    
    buffNearbyEnemies() {
        // Najít všechny nepřátele v dosahu
        this.scene.enemyManager.enemies.children.entries.forEach(enemy => {
            if (enemy === this || !enemy.active) return;
            
            const distance = Phaser.Math.Distance.Between(
                this.x, this.y, enemy.x, enemy.y
            );
            
            if (distance <= this.buffRadius) {
                // Aplikovat buff - dočasně zvýšit rychlost a damage
                this.applyBuffToEnemy(enemy);
            }
        });
        
        // Vizuální efekt buff aury
        this.showBuffEffect();
    }
    
    applyBuffToEnemy(enemy) {
        // Zvýšit rychlost a damage na krátkou dobu
        const originalSpeed = enemy.speed;
        const originalDamage = enemy.damage;
        
        enemy.speed = originalSpeed * this.buffMultiplier;
        enemy.damage = Math.floor(originalDamage * this.buffMultiplier);
        
        // Vizuální indikátor buffu
        enemy.setTint(0xffaa00); // Zlatý tint pro buffed nepřátele
        
        // Buff trvá 2 sekundy
        this.scene.time.delayedCall(2000, () => {
            if (enemy && enemy.active) {
                enemy.speed = originalSpeed;
                enemy.damage = originalDamage;
                enemy.clearTint();
            }
        });
    }
    
    showBuffEffect() {
        // Kruhový efekt kolem Onkogenu
        const buffCircle = this.scene.add.circle(this.x, this.y, this.buffRadius, 0x8800ff, 0.1);
        buffCircle.setStrokeStyle(2, 0x8800ff, 0.5);
        
        // Fade out efekt
        this.scene.tweens.add({
            targets: buffCircle,
            alpha: 0,
            duration: 500,
            onComplete: () => buffCircle.destroy()
        });
    }
    
    takeDamage(amount) {
        this.hp -= amount;
        this.hp = Math.max(0, this.hp);
        
        // Flash efekt
        this.setTint(0xffffff);
        this.scene.time.delayedCall(100, () => {
            this.clearTint();
        });
        
        this.updateHPBar();
        
        // Neoznačujeme jako mrtvého zde - to udělá handleEnemyDeath()
        // když se zavolá z GameScene.js
    }
    
    updateHPBar() {
        this.hpBar.clear();
        
        if (this.hp < this.maxHp) {
            const barWidth = this.size;
            const barHeight = 4;
            const barY = -this.size / 2 - 10;
            
            // Pozadí
            this.hpBar.fillStyle(0x000000, 0.5);
            this.hpBar.fillRect(this.x - barWidth / 2, this.y + barY, barWidth, barHeight);
            
            // HP
            const hpPercent = this.hp / this.maxHp;
            this.hpBar.fillStyle(0xff0000, 1);
            this.hpBar.fillRect(this.x - barWidth / 2, this.y + barY, barWidth * hpPercent, barHeight);
        }
    }
    
    destroy() {
        this.hpBar.destroy();
        super.destroy();
    }
}