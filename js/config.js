// Dynamická velikost s minimálními rozměry
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

// Výpočet skutečné velikosti (responsivní pro mobil)
export const calculateGameSize = () => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    const isFullscreen = !!document.fullscreenElement;
    
    let gameWidth, gameHeight;
    
    if (isFullscreen) {
        // Ve fullscreen použít celou obrazovku
        gameWidth = screenWidth;
        gameHeight = screenHeight;
    } else {
        // V normálním režimu nechat místo pro UI elementy
        const headerHeight = 60; // přibližná výška header + spacing
        const footerHeight = 30; // přibližná výška footer + spacing
        const horizontalPadding = isMobile ? 20 : 40;
        
        gameWidth = Math.max(320, screenWidth - horizontalPadding);
        gameHeight = Math.max(240, screenHeight - headerHeight - footerHeight);
    }
    
    console.log(`Game size: ${gameWidth}x${gameHeight} (screen: ${screenWidth}x${screenHeight}, fullscreen: ${isFullscreen})`);
    return { width: gameWidth, height: gameHeight };
};

const gameSize = calculateGameSize();

export const GameConfig = {
    width: gameSize.width,
    height: gameSize.height,
    backgroundColor: 0x111111,
    
    // Debug settings
    debug: {
        spawnLogging: false      // Disable spawn position logging
    },
    
    // Layer depths
    layers: {
        enemies: 20,            // Enemy sprite depth
        projectiles: 30,        // Projectile depth
        loot: 15,              // Loot drop depth
        ui: 100                // UI elements depth
    },
    
    // Feature flags
    features: {
        lootTablesEnabled: true,  // Enable loot system
        telemetryLogger: false,   // Disable telemetry
        debugOverlay: false      // Debug overlay starts hidden
    },
    
    // Collision radiuses - centralizované konstanty  
    collision: {
        projectile: 15,          // Projectile ↔ Enemy
        lootPickup: 15,         // LootSystem pickup radius
        lootOverlap: 20,        // Physics.overlap radius  
        playerEnemy: 25,        // Player ↔ Enemy contact damage
        explosion: 50           // Base explosion radius
    },
    
    player: {
        baseHP: 100,
        baseSpeed: 1.125, // sníženo o 25% z 1.5
        baseProjectiles: 4,
        projectileSpeed: 150, // sníženo ještě více pro lepší kontrolu
        projectileDamage: 10,
        projectileRange: 600,  // Default range in pixels
        muzzleOffset: 24,      // Offset from player center for projectile spawn
        projectileInterval: 1000, // ms
        size: 30, // Zvětšeno z 20 na 30 (1.5x)
        color: 0x4444ff,
        
        // PR3: Rendering constants
        rendering: {
            borderWidth: 2,
            borderAlpha: 0.8,
            alphaFrequency: 0.02,  // Frequency for alpha animation during invincibility
            speedMultiplier: 100   // Multiplier for movement speed
        }
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
            damage: 30, // -25% od předchozí hodnoty 40 (původně 50)
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
            damage: 49, // -25%
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
            damage: 60, // -25%
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
            damage: 75, // -25%
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
            damage: 113, // -25%
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
        dropChance: 0.08, // Sníženo o 20% z 0.1
        healAmount: 0.15 // 15% of max HP
    },
    
    // Speciální dropy (konfigurovatelné)
    specialDrops: {
        metotrexat: {
            dropChance: 0.03,         // 3% šance z jakéhokoliv NPC
            orbSizeMultiplier: 1.1,   // násobek oproti XP základu
            orbColor: 0xffffaa,       // světle žlutá
            flashDuration: 300,       // ms bílý záblesk kamery
            affectBosses: true        // zasáhnout i bossy
        }
    },
    
    spawn: {
        initialInterval: 3000, // Pomalejší začátek (bylo 2000)
        minInterval: 600,      // Sníženo z 800 na 600 pro rychlejší spawn ve vyšších levelech
        intervalDecrease: 50,
        maxEnemies: 50,        // Zvýšeno z 30 na 50 pro vyšší levely
        bossLevelInterval: 5
    },

    // === NOVÉ SEKCE PRO ConfigResolver/ModifierEngine ===
    
    // Globální performance limity
    limits: {
        maxEmitters: 24,
        maxProjectiles: 100,
        maxEnemies: 50,
        maxTrails: 10,
        maxVoices: 16,          // Max současných zvuků
        maxParticles: 1000      // Max částic v systému
    },

    // Scaling formule pro progresivní obtížnost
    scaling: {
        boss: {
            hp: { base: 1.0, perLevel: 0.2 },       // +20% HP per level
            damage: { base: 1.0, perLevel: 0.1 },   // +10% damage per level
            xp: { base: 1.0, perLevel: 0.3 }        // +30% XP reward per level
        },
        elite: {
            chance: { base: 0.05, perLevel: 0.01 }, // 5% + 1% per level
            statMultiplier: 1.4,                    // 40% stat boost
            xpMultiplier: 1.6                       // 60% více XP
        },
        xp: {
            perLevel: 0.2,                          // 20% více XP per level
            requirement: { base: 10, multiplier: 1.25 }
        }
    },

    // Ability konstanty a timery
    abilities: {
        radiotherapy: {
            baseInterval: 1000,     // 1 sekunda base cooldown
            intervalPerLevel: -100, // -100ms per level
            minInterval: 300,       // Minimálně 300ms
            baseRange: 200,         // Base dosah paprsků
            rangePerLevel: 50       // +50px per level
        },
        lightning: {
            baseInterval: 2000,     // 2 sekundy base cooldown
            intervalPerLevel: -200, // -200ms per level
            minInterval: 800,       // Minimálně 800ms
            baseRange: 200,         // Base dosah chain lightning
            baseDamage: 15,         // Base damage per jump
            damagePerLevel: 10,     // +10 damage per level
            jumpRange: 80,          // Base dosah mezi jumpy
            jumpRangePerLevel: 20,  // +20px jump range per level
            damageReduction: 0.8    // 80% damage retained per jump (20% reduction)
        },
        aura: {
            tickRate: 0.05,         // Damage per tick jako % z total
            baseRadius: 50,         // Základní radius v px
            radiusGrowth: 1.15,     // Growth per level (15%)
            baseDamagePerTick: 15   // Base damage per tick
        },
        shield: {
            baseHP: 50,             // HP na level 1
            hpPerLevel: 25,         // +25 HP per level
            baseRegenTime: 10000,   // 10s regenerace na level 1
            regenTimePerLevel: -1000, // -1s per level
            minRegenTime: 6000      // Minimálně 6s
        },
        boss: {
            linearAttack: {
                projectileSpeed: 250,     // Boss linear attack speed
                spreadAngle: 0.2          // Spread angle between projectiles
            },
            circleAttack: {
                projectileCount: 12,      // Number of projectiles in circle
                projectileSpeed: 200      // Circle attack projectile speed
            },
            divideAttack: {
                damageMultiplier: 0.5     // Damage multiplier for child explosions
            },
            spreadAttack: {
                damageMultiplier: 0.6     // Damage multiplier for infection spread
            },
            corruptionAttack: {
                damageMultiplier: 0.35    // Corruption wave damage multiplier
            },
            geneticAttack: {
                damageMultiplier: 0.3     // Genetic helix damage multiplier
            },
            radiationAttack: {
                damageMultiplier: 0.2     // Radiation field damage multiplier
            }
        }
    },

    // Weapon effects a damage multiplikátory
    weapons: {
        explosive: {
            baseRadius: 30,         // Základní explosion radius
            radiusPerLevel: 10,     // +10px per level
            damageMultiplier: 0.8,  // 80% base damage
            maxRadius: 120          // Cap na radius
        },
        piercing: {
            damageReduction: 0.9,   // 90% damage po průchodu (10% loss)
            maxPierces: 8           // Max počet průchodů
        },
        homing: {
            turnRate: 2.0,          // Rychlost otáčení (radiany/s)
            detectionRange: 150,    // Dosah detekce cílů
            maxLifetime: 5000       // Max lifetime (ms)
        }
    },

    // Power-up default values a progression
    powerups: {
        damage: {
            baseIncrease: 5,        // +5 damage per level
            maxLevel: 10,           // Max level
            stackable: true         // Lze stackovat více levelů
        },
        speed: {
            baseIncrease: 0.15,     // +15% speed per level
            maxLevel: 8,
            maxSpeedBonus: 2.0      // Max 200% speed bonus
        },
        projectiles: {
            baseIncrease: 2,        // +2 projektily per level (od 4 základních)
            maxLevel: 5,
            maxProjectiles: 14      // Max 14 projektilů
        },
        attackSpeed: {
            baseReduction: -0.15,   // -15% cooldown per level
            maxLevel: 6,
            minInterval: 200        // Min 200ms mezi výstřely
        },
        range: {
            baseIncrease: 0.2,      // +20% range per level
            maxLevel: 5,
            maxRangeBonus: 1.5      // Max 150% bonus
        }
    },

    // Validation rules pro blueprinty
    validation: {
        required: {
            powerup: ['id', 'type', 'maxLevel', 'display.devNameFallback'],
            enemy: ['id', 'type', 'stats.hp', 'stats.damage', 'stats.xp'],
            boss: ['id', 'type', 'stats.hp', 'stats.damage'],
            projectile: ['id', 'type', 'stats.damage', 'stats.speed']
        },
        limits: {
            'stats.hp': { min: 1, max: 10000 },
            'stats.damage': { min: 0, max: 1000 },
            'stats.speed': { min: 0, max: 20 },
            'maxLevel': { min: 1, max: 15 }
        }
        // PR7: Feature flags removed - PR7 is the only way, no conditional paths
    },
    
    // Loot System Configuration
    loot: {
        // Global settings
        globalPity: {
            enabled: true,
            maxStreakNoDrop: 20,        // Po 20 kills bez dropu garantuj něco
            guaranteedDrop: 'drop.xp_small'
        },
        
        // Anti-flood limits
        limits: {
            maxDropsPerMinute: 50,       // Globální limit dropů za minutu
            maxSameDropStreak: 5,        // Max stejných dropů za sebou
            cooldownBetweenRare: 8000,   // 8s mezi vzácnými dropy
            powerupCooldown: 20000,      // 20s mezi power-upy z běžných nepřátel
            metotrexatCooldown: 30000    // 30s mezi metotrexaty
        },
        
        // Luck system
        luck: {
            basePlayerLuck: 1.0,         // Základní player luck
            luckPerLevel: 0.05,          // +5% luck za level
            maxLuck: 2.0,                // Maximum luck multiplier
            eliteLuckBonus: 0.2,         // +20% luck z elite kills
            bossLuckBonus: 0.5           // +50% luck z boss kills
        },
        
        // Rarity weights - výchozí váhy pro rarity tiers
        rarityWeights: {
            common: 1.0,
            uncommon: 0.3,
            rare: 0.1,
            epic: 0.03,
            legendary: 0.01,
            mythic: 0.003
        },
        
        // Quality scaling
        quality: {
            baseQuality: 1.0,            // Základní kvalita dropů
            qualityPerLevel: 0.02,       // +2% quality za level
            eliteQualityBonus: 0.3,      // +30% quality z elit
            bossQualityBonus: 0.8,       // +80% quality z bossů
            survivalQualityBonus: 0.5    // +50% quality po dlouhém přežití
        },
        
        // Default pity settings pro tabulky
        defaultPity: {
            enabled: true,
            maxNoDropCommon: 8,          // Pro běžné nepřátele
            maxNoDropElite: 3,           // Pro elity
            maxNoDropBoss: 1             // Pro bosse (vždy dropnou něco)
        },
        
        // Telemetrie settings
        telemetry: {
            enabled: true,
            trackHitRates: true,         // Sledovat hit rates jednotlivých entries
            trackPityActivations: true,  // Sledovat aktivace pity systému
            trackQualityDistribution: true, // Sledovat rozložení rarity dropů
            logRareDrops: true,          // Logovat vzácné dropy do konzole
            logPityActivations: false    // Nelogovat běžné pity aktivace
        },
        
        // Debug settings
        debug: {
            enabled: false,              // Debug režim
            logAllRolls: false,          // Logovat všechny roll pokusy
            logPoolConditions: false,    // Logovat pool condition checks
            showDropProbabilities: false // Zobrazit pravděpodobnosti v UI
        }
    }
};