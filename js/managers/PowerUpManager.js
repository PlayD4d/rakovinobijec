import { createFontConfig, PRESET_STYLES } from '../fontConfig.js';

export class PowerUpManager {
    constructor(scene) {
        this.scene = scene;
        
        this.powerUps = [
            {
                id: 'flamethrower',
                name: '🔥 Radioterapie',
                description: 'Ozáření škodlivých buněk',
                type: 'weapon',
                level: 0,
                maxLevel: 5
            },
            {
                id: 'explosiveBullets',
                name: '⚡ Protonové dělo',
                description: 'Projektily rozloží škodlivé buňky',
                type: 'upgrade',
                level: 0,
                maxLevel: 5
            },
            {
                id: 'xpMagnet',
                name: '🧲 XP Magnet',
                description: 'Zvýší dosah přitahování XP',
                type: 'passive',
                level: 0,
                maxLevel: 10
            },
            {
                id: 'lightningChain',
                name: '⚡ Imunoterapie',
                description: 'Aktivuje imunitní systém proti buňkám',
                type: 'weapon',
                level: 0,
                maxLevel: 5
            },
            {
                id: 'piercingArrows',
                name: '🧪 Cisplatina',
                description: 'Projektily procházejí rakovinnými buňkami',
                type: 'upgrade',
                level: 0,
                maxLevel: 5
            },
            {
                id: 'shield',
                name: '🛡️ Imunitní štít',
                description: 'Blokuje útoky škodlivých buněk',
                type: 'defensive',
                level: 0,
                maxLevel: 5
            },
            {
                id: 'speedBoots',
                name: '🧬 Metabolický urychlovač',
                description: 'Zvyšuje Mardovu rychlost pohybu',
                type: 'passive',
                level: 0,
                maxLevel: 10,
                value: 0.1
            },
            {
                id: 'aura',
                name: '💊 Chemoterapie',
                description: 'Léčiva poškozují buňky v okolí',
                type: 'passive',
                level: 0,
                maxLevel: 10,
                value: 15 // Zvýšeno z 5 na 15
            },
            {
                id: 'attackSpeed',
                name: '🔄 Rychlá střelba',
                description: 'Zkracuje interval mezi útoky',
                type: 'passive',
                level: 0,
                maxLevel: 10,
                value: 0.1
            },
            {
                id: 'projectileRange',
                name: '📏 Delší dosah',
                description: 'Prodlužuje dosah všech útoků',
                type: 'passive',
                level: 0,
                maxLevel: 5
            },
            {
                id: 'damageBoost',
                name: '⚔️ Zvýšené poškození',
                description: 'Zvyšuje poškození všech útoků',
                type: 'passive',
                level: 0,
                maxLevel: 10,
                value: 5
            },
            {
                id: 'maxHp',
                name: '❤️ Více života',
                description: 'Zvyšuje maximální HP',
                type: 'passive',
                level: 0,
                maxLevel: 10,
                value: 20
            },
            {
                id: 'projectileCount',
                name: '➕ Více projektilů',
                description: 'Přidává další projektily',
                type: 'passive',
                level: 0,
                maxLevel: 5,
                value: 1
            }
        ];
        
        this.selectionUI = null;
        this.onSelectionComplete = null;
    }
    
    showPowerUpSelection(callback) {
        this.onSelectionComplete = callback;
        
        // Získat 3 náhodné dostupné power-upy
        const available = this.powerUps.filter(p => p.level < p.maxLevel);
        const selected = [];
        
        for (let i = 0; i < 3 && available.length > 0; i++) {
            const index = Math.floor(Math.random() * available.length);
            selected.push(available[index]);
            available.splice(index, 1);
        }
        
        // Vytvořit UI
        this.createSelectionUI(selected);
    }
    
    createSelectionUI(powerUps) {
        // Pozadí
        const bg = this.scene.add.rectangle(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            0x000000,
            0.8
        );
        
        // PAUSED indicator
        const pausedText = this.scene.add.text(
            this.scene.cameras.main.width / 2,
            40,
            'PAUSED',
            PRESET_STYLES.paused()
        ).setOrigin(0.5);
        
        // Titulek
        const title = this.scene.add.text(
            this.scene.cameras.main.width / 2,
            80,
            'Level Up! Vyber vylepšení:',
            PRESET_STYLES.levelUp()
        ).setOrigin(0.5);
        
        // Karty power-upů - větší a lepší layout
        const cards = [];
        const cardWidth = 280;
        const cardHeight = 320;
        const spacing = 40;
        const startX = (this.scene.cameras.main.width - (3 * cardWidth + 2 * spacing)) / 2;
        
        powerUps.forEach((powerUp, index) => {
            const x = startX + index * (cardWidth + spacing) + cardWidth / 2;
            const y = this.scene.cameras.main.height / 2 + 20;
            
            // Karta pozadí - hezčí design
            const card = this.scene.add.rectangle(x, y, cardWidth, cardHeight, 0x2a2a2a);
            card.setStrokeStyle(3, this.getPowerUpColor(powerUp.type));
            card.setInteractive();
            
            // Icon/Emoji z názvu
            const icon = this.scene.add.text(x, y - 120, this.getIcon(powerUp.name),
                createFontConfig('huge', 'white')
            ).setOrigin(0.5);
            
            // Název bez emoji - zachovat diakritiku, s wordwrapem
            const cleanName = powerUp.name.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
            const name = this.scene.add.text(x, y - 70, cleanName, {
                ...PRESET_STYLES.buttonText(),
                wordWrap: { width: cardWidth - 20 },
                align: 'center',
                lineSpacing: 4
            }).setOrigin(0.5);
            
            // Level progress
            const levelText = this.scene.add.text(
                x, y - 45,
                `Level ${powerUp.level + 1}/${powerUp.maxLevel}`,
                createFontConfig('tiny', 'yellow', { stroke: true })
            ).setOrigin(0.5);
            
            // Progress bar
            const progressBg = this.scene.add.rectangle(x, y - 25, 200, 6, 0x444444);
            const progressFill = this.scene.add.rectangle(
                x - 100 + (200 * (powerUp.level + 1) / powerUp.maxLevel) / 2, 
                y - 25, 
                200 * (powerUp.level + 1) / powerUp.maxLevel, 
                6, 
                0x00ff00
            );
            
            // Popis - wordwrap pro dlouhé texty, více prostoru
            const desc = this.scene.add.text(x, y + 15, powerUp.description, {
                ...createFontConfig('tiny', 'lightGray'),
                wordWrap: { width: cardWidth - 40 },
                align: 'center',
                lineSpacing: 2
            }).setOrigin(0.5);
            
            // Detailed info o tom co vylepšení dělá, více prostoru
            const detailInfo = this.getDetailedInfo(powerUp);
            const details = this.scene.add.text(x, y + 55, detailInfo, {
                ...createFontConfig('tiny', 'cyan', { stroke: true }),
                wordWrap: { width: cardWidth - 40 },
                align: 'center',
                lineSpacing: 2
            }).setOrigin(0.5);
            
            // Current stats - zobrazit vždy pokud má level > 0, více prostoru
            if (powerUp.level > 0) {
                const currentValue = this.getCurrentValue(powerUp);
                const statsText = this.scene.add.text(x, y + 90, `Aktuálně: ${currentValue}`, 
                    createFontConfig('tiny', 'orange')
                ).setOrigin(0.5);
                cards.push(statsText);
            }
            
            // Hover efekt - lepší animace
            card.on('pointerover', () => {
                card.setFillStyle(0x444444);
                card.setStrokeStyle(4, this.getPowerUpColor(powerUp.type));
                this.scene.tweens.add({
                    targets: [card, icon, name, levelText, progressBg, progressFill, desc, details],
                    scaleX: 1.08,
                    scaleY: 1.08,
                    duration: 150,
                    ease: 'Back.easeOut'
                });
            });
            
            card.on('pointerout', () => {
                card.setFillStyle(0x2a2a2a);
                card.setStrokeStyle(3, this.getPowerUpColor(powerUp.type));
                this.scene.tweens.add({
                    targets: [card, icon, name, levelText, progressBg, progressFill, desc, details],
                    scaleX: 1,
                    scaleY: 1,
                    duration: 150,
                    ease: 'Back.easeIn'
                });
            });
            
            // Kliknutí
            card.on('pointerdown', () => {
                this.selectPowerUp(powerUp);
                this.destroySelectionUI([bg, pausedText, title, instruction, ...cards]);
            });
            
            cards.push(card, icon, name, levelText, progressBg, progressFill, desc, details);
        });
        
        // Instrukce
        const instruction = this.scene.add.text(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height - 50,
            'Klikni na kartu pro výběr vylepšení',
            PRESET_STYLES.controls()
        ).setOrigin(0.5);
        
        this.selectionUI = [bg, pausedText, title, instruction, ...cards];
    }
    
    selectPowerUp(powerUp) {
        powerUp.level++;
        
        // Aplikovat na hráče
        const player = this.scene.player;
        
        switch (powerUp.id) {
            case 'flamethrower':
                player.applyPowerUp({ type: 'flamethrower', level: powerUp.level });
                break;
            case 'explosiveBullets':
                player.applyPowerUp({ type: 'explosiveBullets', level: powerUp.level });
                break;
            case 'speedBoots':
                player.applyPowerUp({ type: 'speed', value: powerUp.value });
                break;
            case 'damageBoost':
                player.applyPowerUp({ type: 'damage', value: powerUp.value });
                break;
            case 'projectileCount':
                player.applyPowerUp({ type: 'projectiles', value: powerUp.value });
                break;
            case 'attackSpeed':
                player.applyPowerUp({ type: 'attackSpeed', value: powerUp.value });
                break;
            case 'maxHp':
                player.applyPowerUp({ type: 'maxHp', value: powerUp.value });
                break;
            case 'aura':
                player.applyPowerUp({ type: 'aura', value: powerUp.value });
                break;
            case 'xpMagnet':
                this.scene.lootManager.increaseMagnetLevel();
                break;
            case 'shield':
                player.applyPowerUp({ type: 'shield', level: powerUp.level });
                break;
            case 'lightningChain':
                player.applyPowerUp({ type: 'lightningChain', level: powerUp.level });
                break;
            case 'piercingArrows':
                player.applyPowerUp({ type: 'piercingArrows', level: powerUp.level });
                break;
            case 'projectileRange':
                player.applyPowerUp({ type: 'projectileRange', level: powerUp.level });
                break;
        }
        
        // Každých 3 level-up přepnout hudbu
        if (this.scene.gameStats.level % 3 === 0) {
            this.scene.audioManager.switchLevelMusic();
        }
        
        if (this.onSelectionComplete) {
            this.onSelectionComplete();
        }
    }
    
    destroySelectionUI(elements) {
        elements.forEach(element => element.destroy());
        this.selectionUI = null;
    }
    
    // Pomocné funkce pro nový design
    getPowerUpColor(type) {
        switch (type) {
            case 'weapon': return 0xff4444;
            case 'upgrade': return 0x44ff44;
            case 'passive': return 0x4444ff;
            case 'ability': return 0xffff44;
            case 'defensive': return 0xff44ff;
            default: return 0xffffff;
        }
    }
    
    getIcon(name) {
        // Extrahuj emoji z názvu
        const emojiMatch = name.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu);
        return emojiMatch ? emojiMatch[0] : '⭐';
    }
    
    getDetailedInfo(powerUp) {
        switch (powerUp.id) {
            case 'flamethrower':
                return `${powerUp.level + 1} laserový paprsek\nCílí na nejbližší nepřátele`;
            case 'explosiveBullets':
                return `Exploze ${30 + (powerUp.level + 1) * 10}px poloměr\nPoškodí okolní nepřátele při dopadu`;
            case 'xpMagnet':
                return `+${(powerUp.level + 1) * 20}px dosah\nAutomaticky sbírá XP`;
            case 'lightningChain':
                return `Imunoterapie mezi ${2 + powerUp.level} buňkami\nActivuje imunitní odezvu`;
            case 'piercingArrows':
                return `Projde ${powerUp.level + 1} buňkami\n-10% poškození za každý průchod`;
            case 'shield':
                const shieldHP = 50 + powerUp.level * 25; // 75, 100, 125, 150, 175
                const regenTime = Math.max(6, 10 - powerUp.level); // 9s, 8s, 7s, 6s, 6s
                return `${shieldHP} HP štít, regenerace ${regenTime}s\nAbsorbuje veškeré poškození`;
            case 'speedBoots':
                return `+${((powerUp.level + 1) * powerUp.value * 100).toFixed(0)}% rychlost pohybu\nZrychluje Mardův metabolismus`;
            case 'aura':
                return `${powerUp.value * (powerUp.level + 1)} poškození/s léky\n50px poloměr účinku`;
            case 'attackSpeed':
                return `-${((powerUp.level + 1) * powerUp.value * 100).toFixed(0)}% interval útoků\nRychlejší střelba`;
            case 'projectileRange':
                return `+${(powerUp.level + 1) * 10}% dosah všech útoků\nProjektily, lasery, blesky`;
            case 'damageBoost':
                return `+${powerUp.value * (powerUp.level + 1)} poškození\nVšechny útoky silnější`;
            case 'maxHp':
                return `+${powerUp.value * (powerUp.level + 1)} maximální HP\nVíce životů`;
            case 'projectileCount':
                return `+${powerUp.value * (powerUp.level + 1)} projektil(ů)\nVíce střel najednou`;
            default:
                return 'Vylepší tvé schopnosti';
        }
    }
    
    getCurrentValue(powerUp) {
        try {
            switch (powerUp.id) {
                case 'speedBoots':
                    const speedValue = powerUp.value || 0.1;
                    return `+${(powerUp.level * speedValue * 100).toFixed(0)}%`;
                case 'aura':
                    const auraValue = powerUp.value || 5;
                    return `${powerUp.level * auraValue}/s`;
                case 'attackSpeed':
                    const attackValue = powerUp.value || 0.1;
                    return `-${(powerUp.level * attackValue * 100).toFixed(0)}%`;
                case 'damageBoost':
                    const damageValue = powerUp.value || 5;
                    return `+${powerUp.level * damageValue}`;
                case 'maxHp':
                    const hpValue = powerUp.value || 20;
                    return `+${powerUp.level * hpValue} HP`;
                case 'projectileCount':
                    const projValue = powerUp.value || 1;
                    return `+${powerUp.level * projValue} střel`;
                case 'flamethrower':
                    return `${powerUp.level} lasery`;
                case 'explosiveBullets':
                    const explosionRadius = 30 + powerUp.level * 10;
                    return `${explosionRadius}px`;
                case 'xpMagnet':
                    const magnetRange = powerUp.level * 20;
                    return `+${magnetRange}px`;
                case 'lightningChain':
                    return `${1 + powerUp.level} cílů`;
                case 'piercingArrows':
                    return `+${powerUp.level} průchodů`;
                case 'shield':
                    const currentShieldHP = 50 + powerUp.level * 25;
                    return `${currentShieldHP} HP`;
                case 'projectileRange':
                    return `+${powerUp.level * 10}%`;
                default:
                    return `Level ${powerUp.level}`;
            }
        } catch (e) {
            console.log('getCurrentValue error:', e);
            return `Level ${powerUp.level}`;
        }
    }
}