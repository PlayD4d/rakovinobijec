export class ProjectileManager {
    constructor(scene) {
        this.scene = scene;
        
        this.playerProjectiles = scene.physics.add.group();
        this.enemyProjectiles = scene.physics.add.group();
        
        this.projectileLifetime = 1500; // ms - kratší dosah
    }
    
    createPlayerProjectile(x, y, velocity, damage, color = 0xffffff) { // Bílé projektily
        // Vytvořit jednoduchý kruh
        const projectile = this.scene.add.circle(x, y, 5, color);
        
        // Manuální pohyb vlastnosti
        projectile.velocityX = velocity.x;
        projectile.velocityY = velocity.y;
        projectile.damage = damage;
        projectile.originalDamage = damage; // Uložit původní poškození pro průrazné střely
        projectile.startTime = this.scene.time.now;
        projectile.playerX = x; // Uložit původní pozici hráče pro kontrolu vzdálenosti
        projectile.playerY = y;
        projectile.hitCount = 0; // Počítač průchodů pro cisplatinu
        
        // Zpočátku neviditelný - zobrazí se až když opustí hráčovo tělo
        projectile.setVisible(false);
        
        // Přidat do skupiny
        this.playerProjectiles.add(projectile);
        
        // Auto-destroy po určité době
        this.scene.time.delayedCall(this.projectileLifetime, () => {
            if (projectile.active) {
                projectile.destroy();
            }
        });
        
        return projectile;
    }
    
    
    createExplosion(x, y, damage, radius, level) {
        // Vizuální explozi
        const explosion = this.scene.add.circle(x, y, radius, 0xff8800, 0.8);
        
        // Animace exploze
        this.scene.tweens.add({
            targets: explosion,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => explosion.destroy()
        });
        
        // Damage všem nepřátelům v oblasti
        this.scene.enemyManager.enemies.children.entries.forEach(enemy => {
            if (enemy.active) {
                const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
                if (distance <= radius) {
                    // Vzdálenější nepřátelé dostanou méně damage
                    const damageMultiplier = 1 - (distance / radius);
                    const actualDamage = damage * damageMultiplier * (1 + level * 0.2);
                    
                    // Univerzální tracking damage
                    this.scene.recordDamageDealt(actualDamage, enemy);
                    
                    if (enemy.takeDamage && typeof enemy.takeDamage === 'function') {
                        enemy.takeDamage(actualDamage);
                        
                        if (enemy.hp <= 0) {
                            this.scene.handleEnemyDeath(enemy);
                        }
                    }
                }
            }
        });
    }
    
    createEnemyProjectile(x, y, velocity, damage, color = 0xff0000, tracking = false) { // Červené projektily
        // Vytvořit jednoduchý kruh
        const projectile = this.scene.add.circle(x, y, 4, color);
        
        // Manuální pohyb vlastnosti
        projectile.velocityX = velocity.x;
        projectile.velocityY = velocity.y;
        projectile.damage = damage;
        projectile.tracking = tracking;
        projectile.startTime = this.scene.time.now;
        
        // Přidat do skupiny
        this.enemyProjectiles.add(projectile);
        
        // Auto-destroy po určité době
        this.scene.time.delayedCall(this.projectileLifetime, () => {
            if (projectile.active) {
                projectile.destroy();
            }
        });
        
        return projectile;
    }
    
    update(time, delta) {
        // Nekud hra není pozastavená
        if (this.scene.isPaused) {
            return;
        }
        
        const deltaSeconds = delta / 1000;
        
        // Update player projektilů - manuální pohyb
        this.playerProjectiles.children.entries.forEach(projectile => {
            if (projectile.active) {
                projectile.x += projectile.velocityX * deltaSeconds;
                projectile.y += projectile.velocityY * deltaSeconds;
                
                // Kontrola vzdálenosti od původní pozice hráče pro zobrazení
                if (!projectile.visible && projectile.playerX !== undefined && projectile.playerY !== undefined) {
                    const distanceFromSpawn = Phaser.Math.Distance.Between(
                        projectile.x, projectile.y, 
                        projectile.playerX, projectile.playerY
                    );
                    
                    // Zobrazit když se vzdálí o více než polovina velikosti hráče (15px)
                    if (distanceFromSpawn > 20) { // Trochu víc než polovina velikosti hráče (30px/2 = 15px)
                        projectile.setVisible(true);
                    }
                }
                
                // Delší dosah s power-upy
                const speedBonus = this.scene.player.speedBonus * 200;
                const rangeBonus = this.projectileLifetime * this.scene.player.rangeBonus; // Delší dosah power-up
                const actualLifetime = this.projectileLifetime + speedBonus + rangeBonus;
                
                // Destroy po určité době nebo mimo obrazovku
                if (time - projectile.startTime > actualLifetime || 
                    projectile.x < -50 || projectile.x > this.scene.cameras.main.width + 50 ||
                    projectile.y < -50 || projectile.y > this.scene.cameras.main.height + 50) {
                    projectile.destroy();
                }
            }
        });
        
        // Update enemy projektilů
        this.enemyProjectiles.children.entries.forEach(projectile => {
            if (projectile.active) {
                if (projectile.tracking) {
                    // Tracking projektily
                    const player = this.scene.player;
                    let angle = Phaser.Math.Angle.Between(
                        projectile.x, projectile.y,
                        player.x, player.y
                    );
                    
                    // Přidat nepřesnost pro homing projektily (nekrotická tkáň)
                    const inaccuracy = (Math.random() - 0.5) * 0.4; // ±0.2 radiánu
                    angle += inaccuracy;
                    
                    // Snížená rychlost pro homing projektily
                    const speed = 100; // Sníženo z 250 na 100
                    projectile.velocityX = Math.cos(angle) * speed;
                    projectile.velocityY = Math.sin(angle) * speed;
                }
                
                // Pohyb
                projectile.x += projectile.velocityX * deltaSeconds;
                projectile.y += projectile.velocityY * deltaSeconds;
                
                // Destroy po určité době nebo mimo obrazovku
                if (time - projectile.startTime > this.projectileLifetime || 
                    projectile.x < -50 || projectile.x > this.scene.cameras.main.width + 50 ||
                    projectile.y < -50 || projectile.y > this.scene.cameras.main.height + 50) {
                    projectile.destroy();
                }
            }
        });
    }
    
    removeOutOfBoundsProjectiles(group) {
        group.children.entries.forEach(projectile => {
            if (projectile.x < -50 || projectile.x > this.scene.cameras.main.width + 50 ||
                projectile.y < -50 || projectile.y > this.scene.cameras.main.height + 50) {
                projectile.destroy();
            }
        });
    }
    
    clearAll() {
        this.playerProjectiles.clear(true, true);
        this.enemyProjectiles.clear(true, true);
    }
}