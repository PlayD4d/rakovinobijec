/**
 * ParticlePresets - All particle effect configurations in one data-driven lookup.
 *
 * Replaces VFXPresets + 4 preset module files (~725 LOC) with a single flat table.
 * Each entry defines particle burst parameters. `getPreset(name, color?)` returns
 * a Phaser-ready config object with optional color override.
 *
 * Naming convention: 'category.effect' (e.g. 'hit.small', 'boss.spawn', 'shield.break')
 */

// ============================================================
// Preset data table — allocated once at module load, zero per-call cost
// ============================================================
// Fields: q=quantity, sp=speed[min,max], sc=scale[start,end], life=lifespan(ms),
//         color=default tint, gY=gravityY, gX=gravityX, freq=frequency(ms),
//         alpha=[start,end], rot=[min,max], blend='ADD'|null, angle=[min,max]
const P = {
    // --- Combat: hits ---
    'hit.small':        { q: 8,  sp: [50,150],   sc: [0.3,0],  life: 200, color: 0xFFFFFF },
    'hit.medium':       { q: 12, sp: [80,200],   sc: [0.4,0],  life: 300, color: 0xFFFFFF },
    'hit.large':        { q: 20, sp: [100,300],  sc: [0.6,0],  life: 400, color: 0xFFFFFF },
    'enemy.hit':        { q: 10, sp: [60,160],   sc: [0.35,0], life: 250, color: 0xFF4444 },
    'enemy.shoot':      { q: 3,  sp: [20,50],    sc: [0.3,0],  life: 100, color: 0xFF4444 },
    'muzzle':           { q: 5,  sp: [20,60],    sc: [0.4,0],  life: 100, color: 0xFFFFAA },

    // --- Combat: explosions ---
    'explosion.small':  { q: 15, sp: [80,180],   sc: [0.4,0],  life: 300, color: 0xFF6600, angle: true },
    'explosion.medium': { q: 25, sp: [100,250],  sc: [0.6,0],  life: 400, color: 0xFF6600, angle: true },
    'explosion.large':  { q: 40, sp: [150,350],  sc: [0.8,0],  life: 500, color: 0xFF6600, angle: true },

    // --- Combat: death ---
    'death.small':      { q: 10, sp: [60,150],   sc: [0.3,0],  life: 250, color: 0xFF2222, angle: true, alpha: [1,0] },
    'death.medium':     { q: 20, sp: [100,200],  sc: [0.5,0],  life: 350, color: 0xFF2222, angle: true, alpha: [1,0] },
    'death.large':      { q: 30, sp: [150,300],  sc: [0.7,0],  life: 450, color: 0xFF2222, angle: true, alpha: [1,0] },

    // --- Boss ---
    'boss.spawn':       { q: 50, sp: [100,300],  sc: [1.2,0],  life: 800, color: 0xFF0000, angle: true },
    'boss.death':       { q: 40, sp: [150,400],  sc: [1.5,0],  life: 800, color: 0xFFFF00, angle: true, gY: 50 },
    'boss.phase':       { q: 35, sp: [50,200],   sc: [1.0,0],  life: 600, color: 0xFF00FF, alpha: [1,0] },
    'boss.special':     { q: 30, sp: [100,250],  sc: [0.8,0],  life: 500, color: 0xFF8800 },
    'boss.beam.warning':{ q: 5,  sp: [0,0],      sc: [2.0,0.5],life: 1000,color: 0xFF0000, alpha: [0.2,0.8], freq: 100 },
    'boss.overload.charge':    { q: 12, sp: [50,150],  sc: [0.1,0.8],life: 2000,color: 0xFF00FF, alpha: [0.3,1.0], gY: -100, freq: 80 },
    'boss.overload.explosion': { q: 30, sp: [200,500], sc: [1.5,0],  life: 800, color: 0xFFFF00, angle: true },
    'boss.radiation.storm':    { q: 20, sp: [100,300], sc: [0.6,0.1],life: 1500,color: 0x00FF00, alpha: [0.7,0], freq: 100, rot: [0,360], gX: 50, gY: 50 },
    'boss.radiation.pulse':    { q: 20, sp: [150,300], sc: [0.1,1.2],life: 600, color: 0xCCFF00, alpha: [0.8,0], freq: 100 },
    'boss.victory':     { q: 30, sp: [150,350],  sc: [0.8,0],  life: 1000,color: 0xFFD700, angle: true, gY: 150, freq: 80 },

    // --- Shield / Power-ups ---
    'shield.hit':       { q: 15, sp: [100,200],  sc: [0.8,0],  life: 300, color: 0x00FFFF, angle: true },
    'shield.break':     { q: 25, sp: [150,300],  sc: [0.6,0],  life: 400, color: 0x00FFFF, angle: true },
    'shield.activate':  { q: 15, sp: [20,60],    sc: [0.5,0.8],life: 600, color: 0x00FFFF, alpha: [0.8,0] },
    'powerup':          { q: 20, sp: [50,150],   sc: [0.5,0],  life: 500, color: 0xFFFF00, gY: -30 },
    'powerup.epic':     { q: 40, sp: [100,250],  sc: [0.8,0],  life: 700, color: 0xFF00FF, gY: -50, angle: true },
    'pickup':           { q: 8,  sp: [30,80],    sc: [0.3,0],  life: 300, color: 0x00FF88, gY: -50 },
    'levelup':          { q: 50, sp: [100,300],  sc: [0.8,0],  life: 800, color: 0xFFD700, gY: -80, angle: true },
    'heal':             { q: 15, sp: [40,100],   sc: [0.5,0],  life: 500, color: 0x00FF88, gY: -60, alpha: [0.8,0] },

    // --- Utility ---
    'aura':             { q: 2,  sp: [20,50],    sc: [0.3,0],  life: 800, color: 0x8800FF, alpha: [0.6,0], gY: -20, freq: 100 },
    'trail':            { q: 1,  sp: [20,20],    sc: [0.3,0],  life: 200, color: 0xFFFFFF, alpha: [0.8,0], freq: 50, follow: true },
    'spawn':            { q: 12, sp: [50,120],   sc: [0,0.3],  life: 400, color: 0x8844AA, alpha: [0,1] },
    'telegraph':        { q: 3,  sp: [0,0],      sc: [1.5,0.5],life: 500, color: 0xFF0000, alpha: [0.8,0.2] },
    'effect':           { q: 10, sp: [50,150],   sc: [0.4,0],  life: 300, color: 0xFFFFFF },
    'special':          { q: 30, sp: [100,250],  sc: [0.8,0],  life: 500, color: 0xFFD700, gY: -50 },
    'victory':          { q: 40, sp: [200,400],  sc: [1.0,0],  life: 1200,color: 0xFFD700, angle: true, gY: 200, freq: 50, multiColor: [0xFFD700, 0xFF69B4, 0x00CED1, 0xFFFF00] },
};

// ============================================================
// Alias map — maps legacy/convenience names to canonical preset keys
// ============================================================
const ALIASES = {
    'small': 'hit.small', 'medium': 'hit.medium',
    'hit': 'enemy.hit', 'shoot': 'enemy.shoot',
    'flash': null, // special type, handled separately
    // Boss aliases
    'boss.attack.basic': 'enemy.shoot', 'boss.burst.charge': 'boss.overload.charge',
    'boss.spawn.minions': 'boss.spawn', 'boss.area.explosion': 'explosion.large',
    'boss.heal': 'heal', 'boss.shield.activate': 'shield.activate',
    'boss.rage.activate': 'boss.special', 'boss.phase.transition': 'boss.phase',
    'boss.aura.radiation': 'aura', 'boss.aura.healing_disrupt': 'aura',
    'boss.dash.impact': 'explosion.medium', 'boss.teleport.out': 'boss.special',
    'boss.teleport.in': 'boss.spawn',
    // PowerUp/combat aliases
    'radiation.warning': 'telegraph', 'aura.damage': 'aura',
    'powerup.levelup.text': 'powerup', 'powerup.epic.timeslow': 'powerup.epic',
    'lightning.chain.bolt': 'hit.small', 'lightning.strike': 'hit.small',
    'hit.spark.small': 'hit.small', 'hit.spark': 'hit.small', 'hit.radiation': 'hit.small',
    'shield.block': 'shield.hit', 'shield.active': 'shield.activate',
    'explosion.toxic': 'explosion.medium',
    'hit.radiation': 'hit.small',
    'player.death': 'death.large', 'enemy.celebration_death': 'death.medium',
    'level.complete': 'victory',
};

// ============================================================
// Public API
// ============================================================

/**
 * Get a particle preset config ready for Phaser particle emitter.
 * @param {string} name - Preset name (e.g. 'hit.small', 'boss.spawn')
 * @param {number|null} colorOverride - Optional color override
 * @returns {{ type: string, config: object }|null} Phaser-ready config or null
 */
export function getPreset(name, colorOverride) {
    // Resolve alias
    const key = ALIASES[name] ?? name;
    if (key === null) return _flashPreset(); // Special 'flash' type

    const p = P[key];
    if (!p) return null;

    const color = colorOverride ?? p.color;

    const config = {
        quantity: p.q,
        speed: p.sp[0] === p.sp[1] ? p.sp[0] : { min: p.sp[0], max: p.sp[1] },
        scale: { start: p.sc[0], end: p.sc[1] },
        lifespan: p.life,
        tint: p.multiColor || color,
        blendMode: 'ADD',
    };

    // Optional fields — only add if defined (avoids polluting config with undefined)
    if (p.angle)  config.angle = { min: 0, max: 360 };
    if (p.alpha)  config.alpha = { start: p.alpha[0], end: p.alpha[1] };
    if (p.gY)     config.gravityY = p.gY;
    if (p.gX)     config.gravityX = p.gX;
    if (p.freq)   config.frequency = p.freq;
    if (p.rot)    config.rotate = { min: p.rot[0], max: p.rot[1] };
    if (p.follow) config.follow = true;

    return { type: 'particles', config };
}

// Flash is a special non-particle effect type
function _flashPreset() {
    return { type: 'flash', config: { alpha: 0.8, duration: 100, color: 0xFFFFFF } };
}
