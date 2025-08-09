// Dynamická velikost s minimálními rozměry
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

// Výpočet skutečné velikosti
const calculateGameSize = () => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Rezerva pro padding, rámečky a texty
    // 100px pro horní texty, 80px pro dolní text, plus trochu prostoru
    const availableWidth = Math.floor(screenWidth - 60);
    const availableHeight = Math.floor(screenHeight - 200);
    
    // Použít MENŠÍ z dostupné nebo minimální velikosti
    // Takže se vždy vejde na obrazovku
    const gameWidth = Math.min(Math.max(MIN_WIDTH, availableWidth), availableWidth);
    const gameHeight = Math.min(Math.max(MIN_HEIGHT, availableHeight), availableHeight);
    
    console.log(`Game size: ${gameWidth}x${gameHeight} (screen: ${screenWidth}x${screenHeight})`);
    return { width: gameWidth, height: gameHeight };
};

const gameSize = calculateGameSize();

export const GameConfig = {
    width: gameSize.width,
    height: gameSize.height,
    backgroundColor: 0x111111,
    
    player: {
        baseHP: 100,
        baseSpeed: 1.125, // sníženo o 25% z 1.5
        baseProjectiles: 4,
        projectileSpeed: 150, // sníženo ještě více pro lepší kontrolu
        projectileDamage: 10,
        projectileInterval: 1000, // ms
        size: 30, // Zvětšeno z 20 na 30 (1.5x)
        color: 0x4444ff
    },
    
    enemies: {
        red: {
            hp: 6,              // Sníženo pro snadnější začátek
            speed: 0.8,         // Zpomaleno z 1.5 - pomalejší začátek
            size: 12,           // Menší velikost
            color: 0xff0000,
            xp: 1,
            damage: 6           // Snížen damage
        },
        orange: {
            hp: 25,             // Sníženo z 35
            speed: 0.4,         // Zpomaleno z 0.6
            size: 20,           // Větší velikost pro tumor
            color: 0xff8800,
            xp: 2,              // Více XP za těžšího nepřítele
            damage: 10          // Snížen damage
        },
        green: {
            hp: 45,             // Sníženo z 60
            speed: 0.3,         // Zpomaleno z 0.5
            size: 25,
            color: 0x00ff00,
            xp: 3,              // Více XP za nejtěžšího
            damage: 15          // Snížen damage
        },
        purple: {
            hp: 20,             // Sníženo z 25 - support role
            speed: 0.5,         // Zpomaleno z 0.8
            size: 16,           // Menší než tumor
            color: 0x8800ff,
            xp: 2,
            damage: 4,          // Snížen damage - není attacker
            isSupport: true,    // Nová vlastnost
            buffRadius: 80,     // Dosah buff efektu
            buffMultiplier: 1.2 // Sníženo z 1.3 na 1.2
        },
        brown: {
            hp: 30,             // Sníženo z 40
            speed: 0.3,         // Zpomaleno z 0.4
            size: 22,           // Větší než základní
            color: 0x8B4513,    // Hnědá barva (saddle brown)
            xp: 3,
            damage: 5,          // Snížen damage
            canShoot: true,     // Střílí projektily
            shootInterval: 4000, // Zpomaleno z 3500 na 4000
            projectileType: 'homing', // Vráceno na 'homing' s nepřesností
            projectileDamage: 6 // Sníženo z 8 na 6
        }
    },
    
    bosses: [
        {
            name: "💀 Malignitní Buňka",
            hp: 160, // zvýšeno pro delší fight (~2x)
            color: 0x8b0000,
            size: 40,
            speed: 0.8,
            damage: 15,
            attackType: 'linear',
            attackInterval: 3500,
            xp: 25,
            specialAttack: 'divide' // Specializovaný útok: rozdělení
        },
        {
            name: "🦠 Metastáza",
            hp: 220, // zvýšeno
            color: 0xdc143c,
            size: 45,
            speed: 0.9,
            damage: 25,
            attackType: 'circle',
            attackInterval: 2500,
            xp: 35,
            specialAttack: 'spread' // Specializovaný útok: rozšíření
        },
        {
            name: "⚡ Onkogen",
            hp: 300, // zvýšeno
            color: 0xb22222,
            size: 50,
            speed: 0.8,
            damage: 30,
            attackType: 'tracking',
            attackInterval: 2000,
            xp: 45,
            specialAttack: 'mutate' // Specializovaný útok: mutace
        },
        {
            name: "👑 Karcinogenní Král",
            hp: 270, // beze změny HP, nerf v mechanice
            color: 0x8b008b,
            size: 60,
            speed: 0.7,
            damage: 40, // -20% DMG (z 50)
            attackType: 'multi',
            attackInterval: 1500,
            xp: 100,
            specialAttack: 'corruption' // Specializovaný útok: korupce
        },
        {
            name: "🧬 Genová Mutace",
            hp: 405, // +50% z 270
            color: 0x00ff80,
            size: 65,
            speed: 0.6,
            damage: 65,
            attackType: 'tracking',
            attackInterval: 1300,
            xp: 150,
            specialAttack: 'genetic' // DNA manipulace
        },
        {
            name: "☢️ Radiační Záření", 
            hp: 608, // +50% z 405
            color: 0xffff00,
            size: 70,
            speed: 0.5,
            damage: 80,
            attackType: 'circle',
            attackInterval: 1200,
            xp: 200,
            specialAttack: 'radiation' // Radioaktivní pole
        },
        {
            name: "🔬 Chemorezistence",
            hp: 912, // +50% z 608
            color: 0xff8c00,
            size: 75,
            speed: 0.4,
            damage: 100,
            attackType: 'linear',
            attackInterval: 1000,
            xp: 300,
            specialAttack: 'immunity' // Imunitní k léčbě
        },
        {
            name: "💀 Finální Nádor",
            hp: 1368, // +50% z 912 - skutečný finální boss!
            color: 0x000000,
            size: 80,
            speed: 0.3,
            damage: 150,
            attackType: 'multi',
            attackInterval: 800,
            xp: 500,
            specialAttack: 'apocalypse' // Apokalyptický útok
        }
    ],
    
    xp: {
        baseRequirement: 10,
        multiplier: 1.25, // Sníženo z 1.5 na 1.25 pro plynulejší progresi
        orbSize: 8,
        orbColor: 0x00ddff,
        magnetRange: 50
    },
    
    health: {
        orbSize: 10,
        orbColor: 0xff0000,
        dropChance: 0.075, // Sníženo o 25% z 0.1
        healAmount: 0.1 // 10% of max HP
    },
    
    spawn: {
        initialInterval: 3000, // Pomalejší začátek (bylo 2000)
        minInterval: 600,      // Sníženo z 800 na 600 pro rychlejší spawn ve vyšších levelech
        intervalDecrease: 50,
        maxEnemies: 50,        // Zvýšeno z 30 na 50 pro vyšší levely
        bossLevelInterval: 5
    }
};