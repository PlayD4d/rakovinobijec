import { GameConfig } from '../config.js';

export class LootManager {
    constructor(scene) {
        this.scene = scene;
        this.loot = scene.physics.add.group();
        
        this.magnetRange = GameConfig.xp.magnetRange;
        this.magnetLevel = 0;
    }
    
    dropLoot(x, y, enemy) {
        // Kontrola že enemy má xp hodnotu
        if (!enemy || !enemy.xp) return;
        
        // XP orbs - optimalizované podle hodnoty
        this.createOptimalXPOrbs(x, y, enemy.xp);
        
        // Health orb šance - progresivně se snižuje s levelem
        const currentDropChance = this.calculateHealthDropChance();
        if (Math.random() < currentDropChance) {
            this.createHealthOrb(x, y);
        }
    }
    
    calculateHealthDropChance() {
        const baseDropChance = GameConfig.health.dropChance; // 0.075 (7.5%)
        const playerLevel = this.scene.gameStats.level;
        
        // Každých 5 levelů snížit o 10% (90% ze současné hodnoty)
        const reductionSteps = Math.floor(playerLevel / 5);
        let currentChance = baseDropChance;
        
        for (let i = 0; i < reductionSteps; i++) {
            currentChance *= 0.9; // Snížit o 10%
        }
        
        // Minimální šance 1% (0.01)
        return Math.max(0.01, currentChance);
    }
    
    createOptimalXPOrbs(x, y, totalXP) {
        // Definice tříd XP orbů (od největších k nejmenším)
        const xpTiers = [
            { value: 50, color: 0xffff00, size: 1.4 }, // Zlatý - 50 XP
            { value: 25, color: 0xff8800, size: 1.2 }, // Oranžový - 25 XP
            { value: 10, color: 0x00ff88, size: 1.0 }, // Zelenkavý - 10 XP
            { value: 5, color: 0x00ffff, size: 0.8 },  // Cyan - 5 XP
            { value: 1, color: 0x4444ff, size: 0.7 }   // Modrý - 1 XP
        ];
        
        let remainingXP = totalXP;
        const orbs = [];
        
        // Rozdělit XP do optimálních orbů
        for (const tier of xpTiers) {
            while (remainingXP >= tier.value) {
                orbs.push(tier);
                remainingXP -= tier.value;
            }
        }
        
        // Vytvořit orby na pozici
        orbs.forEach((orbData, index) => {
            const offsetX = (Math.random() - 0.5) * Math.min(40, orbs.length * 8);
            const offsetY = (Math.random() - 0.5) * Math.min(40, orbs.length * 8);
            
            this.createXPOrb(
                x + offsetX,
                y + offsetY,
                orbData.value,
                orbData.color,
                orbData.size
            );
        });
    }
    
    createXPOrb(x, y, value = 1, color = null, sizeMultiplier = 1) {
        const sprite = this.scene.physics.add.sprite(x, y, null);
        
        const graphics = this.scene.add.graphics();
        const baseSize = GameConfig.xp.orbSize * 0.7;
        const hexSize = baseSize * sizeMultiplier;
        
        // Použít buď zadanou barvu nebo defaultní
        const orbColor = color || GameConfig.xp.orbColor;
        
        // Nakreslí hexagon
        graphics.fillStyle(orbColor, 1);
        graphics.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const px = hexSize + Math.cos(angle) * hexSize;
            const py = hexSize + Math.sin(angle) * hexSize;
            if (i === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.closePath();
        graphics.fill();
        
        // Přidat outline pro lepší vizuál
        if (value > 1) {
            graphics.lineStyle(2, 0xffffff, 0.6);
            graphics.strokePath();
        }
        
        const textureName = 'xpHex_' + Date.now() + '_' + Math.random();
        graphics.generateTexture(textureName, hexSize * 2, hexSize * 2);
        sprite.setTexture(textureName);
        graphics.destroy();
        
        sprite.type = 'xp';
        sprite.value = value;
        
        // Floating animace
        this.scene.tweens.add({
            targets: sprite,
            y: y - 10,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.loot.add(sprite);
        
        return sprite;
    }
    
    createHealthOrb(x, y) {
        const sprite = this.scene.physics.add.sprite(x, y, null);
        
        const graphics = this.scene.add.graphics();
        const size = GameConfig.health.orbSize;
        
        // Červený kruh
        graphics.fillStyle(GameConfig.health.orbColor, 1);
        graphics.fillCircle(size, size, size);
        
        // Bílý křížek uprostřed
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(size - size * 0.6, size - 2, size * 1.2, 4);
        graphics.fillRect(size - 2, size - size * 0.6, 4, size * 1.2);
        
        const textureName = 'healthOrb_' + Date.now() + '_' + Math.random();
        graphics.generateTexture(textureName, size * 2, size * 2);
        sprite.setTexture(textureName);
        graphics.destroy();
        
        sprite.type = 'health';
        sprite.value = GameConfig.health.healAmount;
        
        // Pulsing animace
        this.scene.tweens.add({
            targets: sprite,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.loot.add(sprite);
        
        return sprite;
    }
    
    update(time, delta) {
        // Nekud hra není pozastavená
        if (this.scene.isPaused) {
            return;
        }
        
        // Magnet efekt - funguje jako vysavač
        const player = this.scene.player;
        const actualMagnetRange = this.magnetRange + (this.magnetLevel * 30); // Zvýšen range bonus
        
        this.loot.children.entries.forEach(orb => {
            if (orb.active && orb.type === 'xp' && orb.body) {
                const distance = Phaser.Math.Distance.Between(
                    orb.x, orb.y,
                    player.x, player.y
                );
                
                if (distance < actualMagnetRange && distance > 15) {
                    // Vypočítat směr k hráči (normalizovaný vektor)
                    const dx = player.x - orb.x;
                    const dy = player.y - orb.y;
                    const dirX = dx / distance;
                    const dirY = dy / distance;
                    
                    // Exponenciální síla vysavače (silnější čím blíže)
                    const magnetStrength = Math.pow(1 - (distance / actualMagnetRange), 2);
                    const baseSpeed = 150;
                    const speed = baseSpeed + (magnetStrength * 500);
                    
                    // Aplikovat rychlost přímo ve směru k hráči
                    orb.body.setVelocity(dirX * speed, dirY * speed);
                    
                    // Vizuální efekt - rotace
                    orb.rotation += 0.15;
                    
                } else if (distance <= 15) {
                    // Velmi blízko - okamžitě přesunout k hráči (auto-pickup)
                    orb.body.setVelocity(0, 0);
                    orb.x = player.x;
                    orb.y = player.y;
                } else {
                    // Mimo dosah magnetu - zastavit pohyb
                    orb.body.setVelocity(0, 0);
                }
            }
        });
    }
    
    increaseMagnetLevel() {
        this.magnetLevel++;
    }
    
    clearAll() {
        this.loot.clear(true, true);
    }
}