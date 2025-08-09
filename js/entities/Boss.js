import { Enemy } from './Enemy.js';
import { createFontConfig } from '../fontConfig.js';

export class Boss extends Enemy {
    constructor(scene, x, y, bossConfig, level) {
        // Zvýšení HP, damage i XP podle levelu
        const scaledConfig = {
            ...bossConfig,
            hp: bossConfig.hp * Math.pow(1.2, level),
            damage: bossConfig.damage * Math.pow(1.1, level),
            xp: Math.floor(bossConfig.xp * Math.pow(1.3, level)) // XP roste o 30% za level
        };
        
        super(scene, x, y, 'boss', scaledConfig);
        
        // Překreslit boss jako větší kruh
        this.redrawBoss();
        
        this.bossName = bossConfig.name;
        this.attackType = bossConfig.attackType;
        this.specialAttack = bossConfig.specialAttack;
        this.attackInterval = bossConfig.attackInterval;
        this.lastAttack = 0;
        this.specialAttackTimer = 0;
        
        // Boss UI
        this.createBossUI();
        
        // Vstupní animace
        this.entrance();
    }
    
    redrawBoss() {
        // Vytvořit novou grafiku pro bosse
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(this.config.color, 1);
        graphics.fillCircle(this.size / 2, this.size / 2, this.size / 2);
        
        // Přidat výrazný obrys
        graphics.lineStyle(3, 0xffffff, 0.8);
        graphics.strokeCircle(this.size / 2, this.size / 2, this.size / 2);
        
        // Vytvoření textury
        const textureName = `boss_${Date.now()}`;
        graphics.generateTexture(textureName, this.size, this.size);
        this.setTexture(textureName);
        graphics.destroy();
    }
    
    createBossUI() {
        // Boss jméno
        this.nameText = this.scene.add.text(
            this.scene.cameras.main.width / 2,
            50,
            this.bossName,
            createFontConfig('medium', 'red', { stroke: true, strokeThickness: 4 })
        ).setOrigin(0.5);
        
        // Boss HP bar
        this.bossHPBar = this.scene.add.graphics();
        this.bossHPBarBg = this.scene.add.graphics();
        
        this.updateBossHPBar();
    }
    
    entrance() {
        // Přehrát boss enter zvuk
        this.scene.audioManager.playSound('bossEnter');
        
        // Fade in boss - bez rušivého textu na středu obrazovky
        this.alpha = 0;
        this.scene.tweens.add({
            targets: this,
            alpha: 1,
            duration: 2000
        });
        
        // Malý shake efekt pro dramatičnost
        this.scene.cameras.main.shake(1000, 0.01);
        
        // Přepnutí hudby
        this.scene.audioManager.playBossMusic();
    }
    
    update(time, delta) {
        super.update(time, delta);
        
        // Speciální útoky
        if (time - this.lastAttack > this.attackInterval) {
            this.performBasicAttack();
            this.lastAttack = time;
        }
        
        // Speciální útoky se spouštějí méně často
        if (time - this.specialAttackTimer > this.attackInterval * 3) {
            this.performSpecialAttack();
            this.specialAttackTimer = time;
        }
        
        this.updateBossHPBar();
    }
    
    takeDamage(amount) {
        // Chemorezistence je imunitní
        if (this.isImmune) {
            return;
        }
        
        // Normální poškození
        super.takeDamage(amount);
    }
    
    performBasicAttack() {
        const player = this.scene.player;
        
        switch (this.attackType) {
            case 'linear':
                this.linearAttack(player);
                break;
            case 'circle':
                this.circleAttack();
                break;
            case 'tracking':
                this.trackingAttack(player);
                break;
            case 'multi':
                this.multiAttack(player);
                break;
        }
    }
    
    performSpecialAttack() {
        const player = this.scene.player;
        
        switch (this.specialAttack) {
            case 'divide':
                this.divideAttack();
                break;
            case 'spread':
                this.spreadAttack();
                break;
            case 'mutate':
                this.mutateAttack();
                break;
            case 'corruption':
                this.corruptionAttack(player);
                break;
            case 'genetic':
                this.geneticAttack(player);
                break;
            case 'radiation':
                this.radiationAttack();
                break;
            case 'immunity':
                this.immunityAttack(player);
                break;
            case 'apocalypse':
                this.apocalypseAttack(player);
                break;
        }
    }
    
    linearAttack(player) {
        // Střelba v linii směrem k hráči
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        for (let i = -2; i <= 2; i++) {
            const spreadAngle = angle + (i * 0.2);
            const velocity = {
                x: Math.cos(spreadAngle) * 250,
                y: Math.sin(spreadAngle) * 250
            };
            
            // Kontrola existence scény a projektile manageru
            if (this.scene && this.scene.projectileManager && this.active) {
                this.scene.projectileManager.createEnemyProjectile(
                    this.x,
                    this.y,
                    velocity,
                    this.damage,
                    0xff0000
                );
            }
        }
    }
    
    circleAttack() {
        // Střelba do všech směrů
        const projectiles = 12;
        for (let i = 0; i < projectiles; i++) {
            const angle = (Math.PI * 2 / projectiles) * i;
            const velocity = {
                x: Math.cos(angle) * 200,
                y: Math.sin(angle) * 200
            };
            
            // Kontrola existence scény a projektile manageru
            if (this.scene && this.scene.projectileManager && this.active) {
                this.scene.projectileManager.createEnemyProjectile(
                    this.x,
                    this.y,
                    velocity,
                    this.damage,
                    0xff0000
                );
            }
        }
    }
    
    trackingAttack(player) {
        // Navádění projektilu
        for (let i = 0; i < 3; i++) {
            this.scene.time.delayedCall(i * 500, () => {
                // Kontrola existence scény a projektile manageru
                if (!this.scene || !this.scene.projectileManager || !this.active) {
                    return;
                }
                
                const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
                const velocity = {
                    x: Math.cos(angle) * 300,
                    y: Math.sin(angle) * 300
                };
                
                this.scene.projectileManager.createEnemyProjectile(
                    this.x,
                    this.y,
                    velocity,
                    this.damage,
                    0xff00ff,
                    true // tracking
                );
            });
        }
    }
    
    burstAttack() {
        // Rychlá salva
        for (let i = 0; i < 5; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                // Kontrola existence scény a projektile manageru
                if (!this.scene || !this.scene.projectileManager || !this.active) {
                    return;
                }
                
                const randomAngle = Math.random() * Math.PI * 2;
                const velocity = {
                    x: Math.cos(randomAngle) * 350,
                    y: Math.sin(randomAngle) * 350
                };
                
                this.scene.projectileManager.createEnemyProjectile(
                    this.x,
                    this.y,
                    velocity,
                    this.damage,
                    0xffff00
                );
            });
        }
    }
    
    chaosAttack(player) {
        // Kombinace všech útoků
        const attacks = ['linear', 'circle', 'tracking', 'burst'];
        const randomAttack = attacks[Math.floor(Math.random() * attacks.length)];
        
        switch (randomAttack) {
            case 'linear':
                this.linearAttack(player);
                break;
            case 'circle':
                this.circleAttack();
                break;
            case 'tracking':
                this.trackingAttack(player);
                break;
            case 'burst':
                this.burstAttack();
                break;
        }
    }
    
    multiAttack(player) {
        // Kombinovaný útok - linear + circle současně
        this.linearAttack(player);
        
        // Malé zpoždění pro circle
        this.scene.time.delayedCall(500, () => {
            if (this.active) {
                this.circleAttack();
            }
        });
    }
    
    // === SPECIÁLNÍ ÚTOKY ===
    
    divideAttack() {
        // 💀 Malignitní Buňka - vytvoří malé "dceřiné buňky"
        for (let i = 0; i < 3; i++) {
            const angle = (Math.PI * 2 / 3) * i;
            const distance = 50;
            const childX = this.x + Math.cos(angle) * distance;
            const childY = this.y + Math.sin(angle) * distance;
            
            // Vytvořit dočasného malého nepřítele
            const childCell = this.scene.add.circle(childX, childY, 10, 0x800000);
            
            // Animace k hráči
            this.scene.tweens.add({
                targets: childCell,
                x: this.scene.player.x,
                y: this.scene.player.y,
                duration: 2000,
                onComplete: () => {
                    // Exploze při dopadu
                    if (this.scene.projectileManager) {
                        this.scene.projectileManager.createExplosion(
                            childCell.x, childCell.y, this.damage * 0.5, 30, 1
                        );
                    }
                    childCell.destroy();
                }
            });
        }
    }
    
    spreadAttack() {
        // 🦠 Metastáza - vytvoří "nákazu" která se šíří
        const spreadCount = 8;
        for (let i = 0; i < spreadCount; i++) {
            const angle = (Math.PI * 2 / spreadCount) * i;
            const distance = 80;
            
            this.scene.time.delayedCall(i * 200, () => {
                if (!this.active) return;
                
                const spreadX = this.x + Math.cos(angle) * distance;
                const spreadY = this.y + Math.sin(angle) * distance;
                
                // Vytvořit šířící se "nákazu"
                const infection = this.scene.add.circle(spreadX, spreadY, 15, 0xff4444);
                infection.setAlpha(0.7);
                
                // Pulsing effect
                this.scene.tweens.add({
                    targets: infection,
                    scaleX: 1.5,
                    scaleY: 1.5,
                    duration: 1000,
                    yoyo: true,
                    repeat: 2,
                    onComplete: () => infection.destroy()
                });
                
                // Damage check
                this.scene.time.delayedCall(1000, () => {
                    // Kontrola jestli boss a scene ještě existují
                    if (!this.active || !this.scene || !this.scene.player) return;
                    
                    const playerDistance = Phaser.Math.Distance.Between(
                        infection.x, infection.y, 
                        this.scene.player.x, this.scene.player.y
                    );
                    
                    if (playerDistance < 25 && this.scene.player.canTakeDamage()) {
                        this.scene.player.takeDamage(this.damage * 0.6);
                    }
                });
            });
        }
    }
    
    mutateAttack() {
        // ⚡ Onkogen - změní vlastnosti dalších nepřátel
        const nearbyEnemies = this.scene.enemyManager.enemies.children.entries.filter(enemy => {
            if (enemy === this || !enemy.active) return false;
            
            const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            return distance < 150;
        });
        
        nearbyEnemies.forEach(enemy => {
            // Vizuální efekt mutace
            const mutationEffect = this.scene.add.circle(enemy.x, enemy.y, enemy.size + 10, 0x00ff00);
            mutationEffect.setAlpha(0.5);
            
            this.scene.tweens.add({
                targets: mutationEffect,
                scaleX: 2,
                scaleY: 2,
                alpha: 0,
                duration: 800,
                onComplete: () => mutationEffect.destroy()
            });
            
            // Dočasné zvýšení rychlosti a damage
            const originalSpeed = enemy.speed;
            const originalDamage = enemy.damage;
            
            enemy.speed *= 1.5;
            enemy.damage *= 1.3;
            enemy.setTint(0x00ff00); // Zelené zabarvení
            
            // Vrátit zpět po 5 sekundách
            this.scene.time.delayedCall(5000, () => {
                if (enemy.active) {
                    enemy.speed = originalSpeed;
                    enemy.damage = originalDamage;
                    enemy.clearTint();
                }
            });
        });
    }
    
    corruptionAttack(player) {
        // 👑 Kancerogenní Král - kombinovaný devastující útok
        // 1. Temná vlna korupce
        for (let radius = 50; radius <= 200; radius += 50) {
            this.scene.time.delayedCall((radius - 50) * 100, () => {
                if (!this.active) return;
                
                const corruption = this.scene.add.graphics();
                corruption.lineStyle(8, 0x8b008b, 0.8);
                corruption.strokeCircle(this.x, this.y, radius);
                
                this.scene.tweens.add({
                    targets: corruption,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => corruption.destroy()
                });
                
                // Damage check
                const playerDistance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                if (Math.abs(playerDistance - radius) < 20 && player.canTakeDamage()) {
                    player.takeDamage(this.damage * 0.4);
                }
            });
        }
        
        // 2. Následný tracking útok
        this.scene.time.delayedCall(2000, () => {
            if (this.active) {
                this.trackingAttack(player);
            }
        });
    }
    
    geneticAttack(player) {
        // 🧬 Genová Mutace - přepisuje DNA okolí
        const dnaHelixes = 6;
        for (let i = 0; i < dnaHelixes; i++) {
            const angle = (Math.PI * 2 / dnaHelixes) * i;
            
            this.scene.time.delayedCall(i * 300, () => {
                if (!this.active) return;
                
                // Vytvoří DNA helix efekt
                const helixLength = 150;
                const segments = 10;
                
                for (let j = 0; j < segments; j++) {
                    const progress = j / segments;
                    const helixAngle = angle + (progress * Math.PI * 4); // 2 otočky
                    const radius = 20 + (progress * 30);
                    
                    const x = this.x + Math.cos(helixAngle) * radius;
                    const y = this.y + Math.sin(helixAngle) * radius;
                    
                    const segment = this.scene.add.circle(x, y, 5, 0x00ff80);
                    segment.setAlpha(0.8);
                    
                    // Poškození při kontaktu s hráčem
                    const playerDistance = Phaser.Math.Distance.Between(x, y, player.x, player.y);
                    if (playerDistance < 25 && player.canTakeDamage()) {
                        player.takeDamage(this.damage * 0.3);
                    }
                    
                    this.scene.tweens.add({
                        targets: segment,
                        alpha: 0,
                        duration: 2000,
                        onComplete: () => segment.destroy()
                    });
                }
            });
        }
    }
    
    radiationAttack() {
        // ☢️ Radiační Záření - vytváří radioaktivní pole
        const radiationZones = 5;
        
        for (let i = 0; i < radiationZones; i++) {
            this.scene.time.delayedCall(i * 400, () => {
                if (!this.active) return;
                
                const randomX = Phaser.Math.Between(50, this.scene.cameras.main.width - 50);
                const randomY = Phaser.Math.Between(100, this.scene.cameras.main.height - 50);
                
                // Vytvořit radioaktivní pole
                const radiation = this.scene.add.graphics();
                radiation.fillStyle(0xffff00, 0.3);
                radiation.fillCircle(randomX, randomY, 60);
                
                // Pulsing efekt
                this.scene.tweens.add({
                    targets: radiation,
                    scaleX: 1.2,
                    scaleY: 1.2,
                    duration: 800,
                    yoyo: true,
                    repeat: -1
                });
                
                // Kontinuální poškozování v poli
                const damageInterval = this.scene.time.addEvent({
                    delay: 500,
                    callback: () => {
                        // Kontrola jestli boss a scene ještě existují
                        if (!this.active || !this.scene || !this.scene.player) return;
                        
                        const playerDistance = Phaser.Math.Distance.Between(
                            randomX, randomY, this.scene.player.x, this.scene.player.y
                        );
                        
                        if (playerDistance < 60 && this.scene.player.canTakeDamage()) {
                            this.scene.player.takeDamage(this.damage * 0.2);
                        }
                    },
                    repeat: 10
                });
                
                // Zničit po 6 sekundách
                this.scene.time.delayedCall(6000, () => {
                    damageInterval.destroy();
                    radiation.destroy();
                });
            });
        }
    }
    
    immunityAttack(player) {
        // 🔬 Chemorezistence - stane se dočasně imunitní vůči útokům
        // Vytvoří ochranné pole
        const shield = this.scene.add.graphics();
        shield.lineStyle(5, 0xff8c00, 0.8);
        shield.strokeCircle(this.x, this.y, this.size + 15);
        
        // Rotující efekt
        this.scene.tweens.add({
            targets: shield,
            rotation: Math.PI * 2,
            duration: 1000,
            repeat: 4,
            onComplete: () => shield.destroy()
        });
        
        // Dočasná imunita
        this.isImmune = true;
        this.setTint(0xff8c00);
        
        // Během imunity střílí více projektilů
        for (let i = 0; i < 8; i++) {
            this.scene.time.delayedCall(i * 600, () => {
                if (!this.active) return;
                
                const angle = (Math.PI * 2 / 8) * i;
                const velocity = {
                    x: Math.cos(angle) * 300,
                    y: Math.sin(angle) * 300
                };
                
                this.scene.projectileManager.createEnemyProjectile(
                    this.x, this.y, velocity, this.damage * 0.7, 0xff8c00
                );
            });
        }
        
        // Zrušit imunitu po 5 sekundách
        this.scene.time.delayedCall(5000, () => {
            if (this.active) {
                this.isImmune = false;
                this.clearTint();
            }
        });
    }
    
    apocalypseAttack(player) {
        // 💀 Finální Nádor - apokalyptický útok kombinující všechny předchozí
        // 1. Rozdělí se (jako divideAttack)
        this.divideAttack();
        
        // 2. Po 1 sekundě radiační pole
        this.scene.time.delayedCall(1000, () => {
            if (this.active) this.radiationAttack();
        });
        
        // 3. Po 2 sekundách genetická mutace
        this.scene.time.delayedCall(2000, () => {
            if (this.active) this.geneticAttack(player);
        });
        
        // 4. Po 3 sekundách korupce
        this.scene.time.delayedCall(3000, () => {
            if (this.active) this.corruptionAttack(player);
        });
        
        // 5. Finální exploze
        this.scene.time.delayedCall(5000, () => {
            if (!this.active) return;
            
            // Obří černá exploze
            const apocalypse = this.scene.add.graphics();
            apocalypse.fillStyle(0x000000, 0.8);
            apocalypse.fillCircle(this.x, this.y, 200);
            
            this.scene.tweens.add({
                targets: apocalypse,
                scaleX: 2,
                scaleY: 2,
                alpha: 0,
                duration: 2000,
                onComplete: () => apocalypse.destroy()
            });
            
            // Masivní poškození v oblasti
            const playerDistance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
            if (playerDistance < 200 && player.canTakeDamage()) {
                const damageMultiplier = 1 - (playerDistance / 200);
                player.takeDamage(this.damage * damageMultiplier);
            }
        });
    }
    
    updateBossHPBar() {
        const barWidth = 400;
        const barHeight = 20;
        const barX = (this.scene.cameras.main.width - barWidth) / 2;
        const barY = 80;
        
        this.bossHPBarBg.clear();
        this.bossHPBar.clear();
        
        // Pozadí
        this.bossHPBarBg.fillStyle(0x000000, 0.8);
        this.bossHPBarBg.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
        
        // HP
        const hpPercent = this.hp / this.maxHp;
        this.bossHPBar.fillStyle(0xff0000, 1);
        this.bossHPBar.fillRect(barX, barY, barWidth * hpPercent, barHeight);
    }
    
    destroy() {
        console.log('Boss destroy called', this.bossName);
        
        // Označit jako neaktivní aby delayed callbacky se ukončily
        this.active = false;
        
        // Přepnutí hudby zpět (bezpečně)
        if (this.scene && this.scene.audioManager && this.scene.audioManager.playLevelMusic) {
            this.scene.audioManager.playLevelMusic();
        } else {
            console.warn('AudioManager not available during boss destroy');
        }
        
        // Odstranění UI (bezpečně)
        if (this.nameText && this.nameText.destroy) {
            this.nameText.destroy();
        }
        if (this.bossHPBar && this.bossHPBar.destroy) {
            this.bossHPBar.destroy();
        }
        if (this.bossHPBarBg && this.bossHPBarBg.destroy) {
            this.bossHPBarBg.destroy();
        }
        
        // Victory efekt (bezpečně)
        if (this.scene && this.scene.add && this.scene.tweens) {
            for (let i = 0; i < 20; i++) {
                const angle = (Math.PI * 2 / 20) * i;
                const particle = this.scene.add.graphics();
                particle.fillStyle(0xffff00, 1);
                particle.fillCircle(0, 0, 5);
                particle.x = this.x;
                particle.y = this.y;
                
                this.scene.tweens.add({
                    targets: particle,
                    x: this.x + Math.cos(angle) * 100,
                    y: this.y + Math.sin(angle) * 100,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => {
                        if (particle && particle.destroy) {
                            particle.destroy();
                        }
                    }
                });
            }
        }
        
        super.destroy();
    }
}