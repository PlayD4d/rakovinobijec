// Dynamic sizing with minimum dimensions
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

// Calculate actual size (responsive for mobile)
export const calculateGameSize = () => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    const isFullscreen = !!document.fullscreenElement;
    
    let gameWidth, gameHeight;
    
    if (isFullscreen) {
        // In fullscreen use the entire screen
        gameWidth = screenWidth;
        gameHeight = screenHeight;
    } else {
        // In normal mode leave room for UI elements
        const headerHeight = 60; // approximate header height + spacing
        const footerHeight = 30; // approximate footer height + spacing
        const horizontalPadding = isMobile ? 20 : 40;
        
        gameWidth = Math.max(320, screenWidth - horizontalPadding);
        gameHeight = Math.max(240, screenHeight - headerHeight - footerHeight);
    }
    
    // Game size logging moved to DebugLogger (no bare console.log in production)
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
    
    // Layer depths — must match GameScene.DEPTH_LAYERS
    layers: {
        enemies: 1000,          // Enemy sprite depth
        projectiles: 2000,      // Projectile depth
        loot: 100,              // Loot drop depth
        ui: 4000                // UI elements depth
    },
    
    // Feature flags
    features: {
        lootTablesEnabled: true,  // Enable loot system
        telemetryLogger: false,   // Disable telemetry
        debugOverlay: false      // Debug overlay starts hidden
    },
    
    // Collision radiuses - centralized constants
    collision: {
        projectile: 15,          // Projectile ↔ Enemy
        lootPickup: 15,         // LootSystem pickup radius
        lootOverlap: 20,        // Physics.overlap radius  
        playerEnemy: 25,        // Player ↔ Enemy contact damage
        explosion: 50           // Base explosion radius
    },
    
    player: {
        baseHP: 100,
        baseSpeed: 1.125, // reduced by 25% from 1.5
        baseProjectiles: 4,
        projectileSpeed: 150, // reduced further for better control
        projectileDamage: 10,
        projectileRange: 600,  // Default range in pixels
        muzzleOffset: 24,      // Offset from player center for projectile spawn
        projectileInterval: 1000, // ms
        size: 30, // Increased from 20 to 30 (1.5x)
        color: 0x4444ff,
        
        // PR3: Rendering constants
        rendering: {
            borderWidth: 2,
            borderAlpha: 0.8,
            alphaFrequency: 0.02,  // Frequency for alpha animation during invincibility
            speedMultiplier: 100   // Multiplier for movement speed
        }
    },
    
    // NOTE: Enemy and boss stats are defined in /data/blueprints/ (PR7 data-driven architecture)

    xp: {
        baseRequirement: 10,
        multiplier: 1.25, // Reduced from 1.5 to 1.25 for smoother progression
        orbSize: 8,
        orbColor: 0x00ddff,
        magnetRange: 50
    },
    
    health: {
        orbSize: 10,
        orbColor: 0xff0000,
        dropChance: 0.08, // Reduced by 20% from 0.1
        healAmount: 0.15 // 15% of max HP
    },
    
    // Special drops (configurable)
    specialDrops: {
        metotrexat: {
            dropChance: 0.03,         // 3% chance from any NPC
            orbSizeMultiplier: 1.1,   // multiplier relative to XP base
            orbColor: 0xffffaa,       // light yellow
            flashDuration: 300,       // ms white camera flash
            affectBosses: true        // also affects bosses
        }
    },
    
    spawn: {
        initialInterval: 3000, // Slower start (was 2000)
        minInterval: 600,      // Reduced from 800 to 600 for faster spawns in higher levels
        intervalDecrease: 50,
        maxEnemies: 50,        // Increased from 30 to 50 for higher levels
        bossLevelInterval: 5
    },

    // === NEW SECTIONS FOR ConfigResolver ===

    // Global performance limits
    limits: {
        maxEmitters: 24,
        maxProjectiles: 100,
        maxEnemies: 50,
        maxTrails: 10,
        maxVoices: 16,          // Max simultaneous sounds
        maxParticles: 1000      // Max particles in system
    },

    // Scaling formulas for progressive difficulty
    scaling: {
        boss: {
            hp: { base: 1.0, perLevel: 0.2 },       // +20% HP per level
            damage: { base: 1.0, perLevel: 0.1 },   // +10% damage per level
            xp: { base: 1.0, perLevel: 0.3 }        // +30% XP reward per level
        },
        elite: {
            chance: { base: 0.05, perLevel: 0.01 }, // 5% + 1% per level
            statMultiplier: 1.4,                    // 40% stat boost
            xpMultiplier: 1.6                       // 60% more XP
        },
        xp: {
            perLevel: 0.2,                          // 20% more XP per level
            requirement: { base: 10, multiplier: 1.25 }
        }
    },

    // Ability constants and timers
    abilities: {
        radiotherapy: {
            baseInterval: 1000,     // 1 second base cooldown
            intervalPerLevel: -100, // -100ms per level
            minInterval: 300,       // Minimum 300ms
            baseRange: 200,         // Base beam range
            rangePerLevel: 50       // +50px per level
        },
        lightning: {
            baseInterval: 2000,     // 2 seconds base cooldown
            intervalPerLevel: -200, // -200ms per level
            minInterval: 800,       // Minimum 800ms
            baseRange: 200,         // Base chain lightning range
            baseDamage: 15,         // Base damage per jump
            damagePerLevel: 10,     // +10 damage per level
            jumpRange: 80,          // Base range between jumps
            jumpRangePerLevel: 20,  // +20px jump range per level
            damageReduction: 0.8    // 80% damage retained per jump (20% reduction)
        },
        aura: {
            tickRate: 0.05,         // Damage per tick as % of total
            baseRadius: 50,         // Base radius in px
            radiusGrowth: 1.15,     // Growth per level (15%)
            baseDamagePerTick: 15   // Base damage per tick
        },
        shield: {
            baseHP: 50,             // HP at level 1
            hpPerLevel: 25,         // +25 HP per level
            baseRegenTime: 10000,   // 10s regen at level 1
            regenTimePerLevel: -1000, // -1s per level
            minRegenTime: 6000      // Minimum 6s
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

    // Weapon effects and damage multipliers
    weapons: {
        explosive: {
            baseRadius: 30,         // Base explosion radius
            radiusPerLevel: 10,     // +10px per level
            damageMultiplier: 0.8,  // 80% base damage
            maxRadius: 120          // Cap on radius
        },
        piercing: {
            damageReduction: 0.9,   // 90% damage after piercing (10% loss)
            maxPierces: 8           // Max number of pierces
        },
        homing: {
            turnRate: 2.0,          // Turn speed (radians/s)
            detectionRange: 150,    // Target detection range
            maxLifetime: 5000       // Max lifetime (ms)
        }
    },

    // Power-up default values and progression
    powerups: {
        damage: {
            baseIncrease: 5,        // +5 damage per level
            maxLevel: 10,           // Max level
            stackable: true         // Can stack multiple levels
        },
        speed: {
            baseIncrease: 0.15,     // +15% speed per level
            maxLevel: 8,
            maxSpeedBonus: 2.0      // Max 200% speed bonus
        },
        projectiles: {
            baseIncrease: 2,        // +2 projectiles per level (from 4 base)
            maxLevel: 5,
            maxProjectiles: 14      // Max 14 projectiles
        },
        attackSpeed: {
            baseReduction: -0.15,   // -15% cooldown per level
            maxLevel: 6,
            minInterval: 200        // Min 200ms between shots
        },
        range: {
            baseIncrease: 0.2,      // +20% range per level
            maxLevel: 5,
            maxRangeBonus: 1.5      // Max 150% bonus
        }
    },

    // Validation rules for blueprints
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
            maxStreakNoDrop: 20,        // After 20 kills with no drop, guarantee something
            guaranteedDrop: 'drop.xp_small'
        },
        
        // Anti-flood limits
        limits: {
            maxDropsPerMinute: 50,       // Global drop limit per minute
            maxSameDropStreak: 5,        // Max same drops in a row
            cooldownBetweenRare: 8000,   // 8s between rare drops
            powerupCooldown: 20000,      // 20s between power-ups from regular enemies
            metotrexatCooldown: 30000    // 30s between metotrexats
        },
        
        // Luck system
        luck: {
            basePlayerLuck: 1.0,         // Base player luck
            luckPerLevel: 0.05,          // +5% luck per level
            maxLuck: 2.0,                // Maximum luck multiplier
            eliteLuckBonus: 0.2,         // +20% luck from elite kills
            bossLuckBonus: 0.5           // +50% luck from boss kills
        },
        
        // Rarity weights - default weights for rarity tiers
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
            baseQuality: 1.0,            // Base drop quality
            qualityPerLevel: 0.02,       // +2% quality per level
            eliteQualityBonus: 0.3,      // +30% quality from elites
            bossQualityBonus: 0.8,       // +80% quality from bosses
            survivalQualityBonus: 0.5    // +50% quality after long survival
        },
        
        // Default pity settings for tables
        defaultPity: {
            enabled: true,
            maxNoDropCommon: 8,          // For regular enemies
            maxNoDropElite: 3,           // For elites
            maxNoDropBoss: 1             // For bosses (always drop something)
        },
        
        // Telemetry settings
        telemetry: {
            enabled: true,
            trackHitRates: true,         // Track hit rates of individual entries
            trackPityActivations: true,  // Track pity system activations
            trackQualityDistribution: true, // Track rarity drop distribution
            logRareDrops: true,          // Log rare drops to console
            logPityActivations: false    // Don't log common pity activations
        },
        
        // Debug settings
        debug: {
            enabled: false,              // Debug mode
            logAllRolls: false,          // Log all roll attempts
            logPoolConditions: false,    // Log pool condition checks
            showDropProbabilities: false // Show probabilities in UI
        }
    }
};