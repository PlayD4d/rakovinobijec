#!/usr/bin/env node
/**
 * Balance Simulator v2 — Headless Monte Carlo game simulation
 *
 * Shares data layer with game: reads actual blueprints, uses same modifier math,
 * same XP progression formula, same powerup stats. Only physics/rendering is modeled.
 *
 * Usage:
 *   node scripts/balance-sim.mjs                    # 100 runs
 *   node scripts/balance-sim.mjs --runs 500         # 500 runs
 *   node scripts/balance-sim.mjs --verbose          # Show individual run details
 *   node scripts/balance-sim.mjs --build shield,multi_shot,damage_boost
 */

import { readFileSync, readdirSync } from 'fs';
import JSON5 from 'json5';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const BP = (path) => JSON5.parse(readFileSync(resolve(ROOT, 'data/blueprints', path), 'utf-8'));

// ============================================================
// SHARED MATH — identical to game code
// ============================================================

/** Same as PlayerStats.applyModifiers */
function applyModifiers(baseValue, statName, modifiers) {
  let value = baseValue || 0;
  for (const mod of modifiers) {
    if (mod.path !== statName) continue;
    if (mod.type === 'add') value += mod.value;
    else if (mod.type === 'multiply') value *= mod.value;
    else if (mod.type === 'mul') value *= (1 + mod.value);
    else if (mod.type === 'base' || mod.type === 'set') value = mod.value;
  }
  return value;
}

/** Same as ProgressionSystem.getXPToNextLevel */
function getXPToNextLevel(level, config = {}) {
  const baseReq = config.baseRequirement || 8;
  const multiplier = config.scalingMultiplier || 1.18;
  const softcapStart = config.softcapStart || 21;
  const postSlope = config.postSlope || 0.5;
  let effExp = level - 1;
  if (level >= softcapStart) {
    effExp = (softcapStart - 1) + postSlope * (level - softcapStart);
  }
  return Math.floor(baseReq * Math.pow(multiplier, effExp));
}

/** Same as CombatUtils.lvl */
function lvl(arr, level, fallback) {
  return (Array.isArray(arr) ? arr[level - 1] : undefined) ?? fallback;
}

/** Same as PowerUpSystem._processModifiers */
function processModifiers(blueprint, targetLevel) {
  const mods = [];
  for (const modDef of blueprint.mechanics?.modifiersPerLevel || []) {
    if (!modDef.path || modDef.value === undefined) continue;
    const value = modDef.type === 'set' ? modDef.value : modDef.value * targetLevel;
    mods.push({ source: blueprint.id, path: modDef.path, type: modDef.type || 'add', value });
  }
  return mods;
}

// ============================================================
// LOAD BLUEPRINTS
// ============================================================
function loadBlueprints() {
  const enemies = {}, bosses = {}, powerups = {}, spawnTables = {};

  const loadDir = (dir, target) => {
    for (const f of readdirSync(resolve(ROOT, 'data/blueprints', dir))) {
      if (!f.endsWith('.json5')) continue;
      const bp = BP(dir + '/' + f);
      target[bp.id] = bp;
    }
  };

  loadDir('enemy', enemies);
  loadDir('elite', enemies);
  loadDir('unique', enemies);
  loadDir('boss', bosses);
  loadDir('powerup', powerups);

  for (const f of readdirSync(resolve(ROOT, 'data/blueprints/spawn'))) {
    if (!f.endsWith('.json5')) continue;
    const bp = BP('spawn/' + f);
    spawnTables[`spawnTable.level${bp.level}`] = bp;
  }

  const player = BP('player/player.json5');
  return { enemies, bosses, powerups, spawnTables, player };
}

// ============================================================
// SIMULATION ENGINE
// ============================================================
const DT = 200; // 5 ticks/sec

class SimPlayer {
  constructor(playerBp) {
    // Base stats from blueprint — same fields as Player.baseStats
    this.baseStats = {
      hp: playerBp.stats?.hp || 100,
      moveSpeed: playerBp.stats?.speed || 135,
      attackIntervalMs: playerBp.mechanics?.attack?.intervalMs || 2000,
      projectileDamage: playerBp.mechanics?.projectile?.stats?.damage || 15,
      projectileCount: playerBp.mechanics?.projectile?.count || 4,
      projectileSpeed: playerBp.mechanics?.projectile?.stats?.speed || 200,
      projectileRange: playerBp.mechanics?.projectile?.stats?.range || 175,
      critChance: playerBp.mechanics?.attack?.critChance || 0.05,
      critMult: playerBp.mechanics?.attack?.critMultiplier || 2,
      damageReduction: 0,
      dodgeChance: 0,
      xpMagnetRadius: 50,
      areaMultiplier: 1,
      durationMultiplier: 1,
    };

    this.hp = this.baseStats.hp;
    this.maxHp = this.baseStats.hp;
    this.activeModifiers = []; // Same as player.activeModifiers
    this.level = 1;
    this.xp = 0;
    this.xpToNext = getXPToNextLevel(1);

    // Shield
    this.shieldHP = 0;
    this.maxShieldHP = 0;
    this.shieldRechargeTime = 0;
    this.shieldRechargeAt = Infinity;

    // Equipped powerups
    this.equipped = new Map(); // id → level

    // Ability DPS tracking
    this.abilityDPS = new Map(); // id → dps number

    // Stats tracking
    this.kills = 0;
    this.totalDmgDealt = 0;
    this.totalDmgTaken = 0;
    this.totalHealed = 0;
    this.totalShieldAbs = 0;
    this.lowestHP = this.hp;
    this.powerupsPicked = 0;
    this._iFramesLeft = 0;
  }

  /** Recalculate stats with modifiers — same as PlayerStats.getAll() */
  _stats() {
    const stats = {};
    for (const key of Object.keys(this.baseStats)) {
      stats[key] = applyModifiers(this.baseStats[key], key, this.activeModifiers);
    }
    // Enforce minimum attack interval (same as PlayerStats)
    if (stats.attackIntervalMs < 200) stats.attackIntervalMs = 200;
    return stats;
  }

  getDPS(stats) {
    if (!stats) stats = this._stats();
    const dmg = stats.projectileDamage;
    const avgDmg = dmg * (1 + stats.critChance * (stats.critMult - 1)); // Expected damage with crits
    const shotsPerSec = 1000 / stats.attackIntervalMs;
    // Calibrated from real session: ~40% of directional projectiles hit
    // With homing: ~80% hit rate (targeted but can miss moving enemies)
    const hasHoming = this.equipped.has('powerup.homing_shot');
    const hitRate = hasHoming ? 0.7 : 0.35;
    return avgDmg * stats.projectileCount * shotsPerSec * hitRate;
  }

  getAbilityDPS() {
    let total = 0;
    for (const dps of this.abilityDPS.values()) total += dps;
    return total;
  }

  getTotalDPS(stats) { return this.getDPS(stats) + this.getAbilityDPS(); }

  addXP(amount) {
    this.xp += amount;
    if (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = getXPToNextLevel(this.level);
      return true;
    }
    return false;
  }

  takeDamage(amount, time) {
    // Dodge check
    const stats = this._stats();
    if (stats.dodgeChance > 0 && Math.random() < stats.dodgeChance) return;

    // iFrames check
    if (this._iFramesLeft > 0) return;

    // Damage reduction
    if (stats.damageReduction > 0) amount = Math.max(1, amount - stats.damageReduction);

    // Shield
    if (this.shieldHP > 0) {
      const absorbed = Math.min(amount, this.shieldHP);
      this.shieldHP -= absorbed;
      this.totalShieldAbs += absorbed;
      amount -= absorbed;
      if (this.shieldHP <= 0) this.shieldRechargeAt = time + this.shieldRechargeTime;
    }

    if (amount > 0) {
      this.hp -= amount;
      this.totalDmgTaken += amount;
      this.lowestHP = Math.min(this.lowestHP, this.hp);
      this._iFramesLeft = 1000; // 1s iFrames
    }
  }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.totalHealed += this.hp - before;
  }
}

class SimEnemy {
  constructor(bp, diffMul) {
    this.id = bp.id;
    this.hp = Math.ceil((bp.stats?.hp || bp.stats?.maxHp || 30) * (diffMul?.hp || 1));
    this.damage = Math.ceil((bp.stats?.damage || bp.stats?.contactDamage || 10) * (diffMul?.damage || 1));
    this.speed = (bp.stats?.speed || bp.stats?.moveSpeed || 80) * (diffMul?.speed || 1);
    this.xp = bp.stats?.xp || bp.loot?.xp || 3;
    this.isBoss = bp.type === 'boss';
    this.alive = true;
  }
}

// ============================================================
// POWERUP APPLICATION — reads from actual blueprints
// ============================================================
function applyPowerup(sim, pupId, powerups) {
  const bp = powerups[pupId];
  if (!bp) return null;

  const oldLevel = sim.equipped.get(pupId) || 0;
  const newLevel = oldLevel + 1;
  sim.equipped.set(pupId, newLevel);

  // 1. Apply modifiers (same as PowerUpSystem._processModifiers + applyToPlayer)
  sim.activeModifiers = sim.activeModifiers.filter(m => m.source !== pupId);
  const newMods = processModifiers(bp, newLevel);
  sim.activeModifiers.push(...newMods);

  // 2. Sync maxHp if changed
  const stats = sim._stats();
  if (stats.hp !== sim.maxHp) {
    const delta = stats.hp - sim.maxHp;
    sim.maxHp = stats.hp;
    if (delta > 0) sim.hp = Math.min(sim.hp + delta, sim.maxHp);
  }

  // 3. Ability DPS calculation from blueprint ability data
  const a = bp.ability;
  if (a) {
    let dps = 0;
    switch (a.type) {
      case 'radiotherapy': {
        const dmg = lvl(a.damagePerLevel, newLevel, 5);
        const beams = lvl(a.beamsPerLevel, newLevel, 1);
        const tickRate = a.tickRate || 0.1;
        dps = dmg * beams / tickRate * 0.5; // ~50% enemies in beam arc
        break;
      }
      case 'flamethrower': {
        const dmg = lvl(a.damagePerLevel, newLevel, 10);
        const interval = lvl(a.intervalMsPerLevel, newLevel, 800);
        dps = dmg / (interval / 1000) * 0.5; // AoE hits ~50% of nearby
        break;
      }
      case 'chain_lightning': {
        const dmg = (a.baseDamage || 15) + (a.damagePerLevel || 10) * newLevel;
        const jumps = newLevel + 1;
        const interval = (a.interval || 2000) / 1000;
        dps = dmg * jumps * 0.8 / interval; // 0.8 falloff per jump avg
        break;
      }
      case 'immune_aura': {
        const dmg = lvl(a.damagePerLevel, newLevel, 5);
        const tickRate = a.tickRate || 0.5;
        dps = dmg / tickRate * 0.3; // Hits ~30% of nearby enemies
        break;
      }
      case 'orbital_antibodies': {
        const count = lvl(a.countPerLevel, newLevel, 2);
        const dmg = lvl(a.damagePerLevel, newLevel, 8);
        dps = count * dmg * 2; // ~2 hits/sec per orbital (10Hz check, ~20% hit)
        break;
      }
      case 'chemo_pool': {
        const dmg = lvl(a.damagePerLevel, newLevel, 5);
        const poolCount = lvl(a.countPerLevel, newLevel, 1);
        const duration = lvl(a.durationPerLevel, newLevel, 3000) / 1000;
        const interval = lvl(a.intervalPerLevel, newLevel, 4000) / 1000;
        dps = dmg * poolCount * (duration / interval) * 0.4; // Tick 2/s, 40% coverage
        break;
      }
      case 'antibody_boomerang': {
        const dmg = lvl(a.damagePerLevel, newLevel, 12);
        const count = lvl(a.countPerLevel, newLevel, 1);
        const interval = (a.interval || 2000) / 1000;
        dps = dmg * count * 2 / interval; // Hits ~2 enemies per flight (out+return)
        break;
      }
      case 'ricochet_cell': {
        const dmg = lvl(a.damagePerLevel, newLevel, 10);
        const count = lvl(a.countPerLevel, newLevel, 1);
        const bounces = lvl(a.bouncesPerLevel, newLevel, 3);
        const interval = (a.interval || 2500) / 1000;
        dps = dmg * count * bounces * 0.3 / interval; // 30% hit chance per bounce
        break;
      }
      case 'synaptic_pulse': {
        const dmg = lvl(a.damagePerLevel, newLevel, 8);
        const interval = lvl(a.intervalPerLevel, newLevel, 2500) / 1000;
        dps = dmg / interval * 0.5; // Hits ~50% of nearby enemies
        break;
      }
      case 'passive_regen': {
        // Not DPS — heals player
        const hpPerTick = lvl(a.hpPerTickPerLevel, newLevel, 1);
        const tickMs = lvl(a.tickMsPerLevel, newLevel, 3000);
        sim._regenPerSec = hpPerTick / (tickMs / 1000);
        break;
      }
      case 'shield': {
        sim.maxShieldHP = (a.baseShieldHP || 50) * newLevel;
        sim.shieldHP = sim.maxShieldHP;
        sim.shieldRechargeTime = lvl(a.rechargeTimePerLevel, newLevel, 10000);
        break;
      }
      // homing_shot, piercing, chemo_aura: affect weapon DPS indirectly (via modifiers or hitRate)
    }
    sim.abilityDPS.set(pupId, dps);
  }

  return { id: pupId, level: newLevel };
}

// ============================================================
// POWERUP PICKING AI — simulates adaptive player choices
// ============================================================
function pickPowerup(sim, powerups, forceBuild) {
  const pool = Object.keys(powerups);
  const MAX_WEAPON_SLOTS = 6;
  const MAX_PASSIVE_SLOTS = 6;

  const weaponCount = [...sim.equipped.keys()].filter(id => powerups[id]?.mechanics?.slot === 'weapon').length;
  const passiveCount = [...sim.equipped.keys()].filter(id => powerups[id]?.mechanics?.slot === 'passive').length;

  const available = pool.filter(id => {
    const bp = powerups[id];
    const maxLvl = bp.stats?.maxLevel || 5;
    const current = sim.equipped.get(id) || 0;
    if (current >= maxLvl) return false;
    const slot = bp.mechanics?.slot || 'weapon';
    if (current === 0) {
      if (slot === 'weapon' && weaponCount >= MAX_WEAPON_SLOTS) return false;
      if (slot === 'passive' && passiveCount >= MAX_PASSIVE_SLOTS) return false;
    }
    return true;
  });

  if (available.length === 0) {
    // Overflow boost
    sim.baseStats.projectileDamage += 5;
    return { id: 'overflow.damage', level: 99 };
  }

  // Force build?
  if (forceBuild) {
    const pref = available.filter(id => forceBuild.some(f => id.includes(f)));
    if (pref.length > 0) return applyPowerup(sim, pref[Math.floor(Math.random() * pref.length)], powerups);
  }

  // Random 3 choices, pick by priority
  const choices = [];
  const avail = [...available];
  for (let i = 0; i < 3 && avail.length > 0; i++) {
    const idx = Math.floor(Math.random() * avail.length);
    choices.push(avail.splice(idx, 1)[0]);
  }

  const priority = (id) => {
    const bp = powerups[id];
    const current = sim.equipped.get(id) || 0;
    const isUpgrade = current > 0 ? 3 : 0;
    const hpPct = sim.hp / sim.maxHp;
    const isEarly = sim.level < 10;

    if (hpPct < 0.4 && id.includes('shield') && current < 3) return 15;
    if (id.includes('shield') && current < 3) return 9 + isUpgrade;
    if (id.includes('damage_boost')) return (isEarly ? 10 : 7) + isUpgrade;
    if (id.includes('multi_shot')) return (isEarly ? 9 : 7) + isUpgrade;
    if (id.includes('cooldown_reduction')) return 7 + isUpgrade;
    if (id.includes('orbital')) return 7 + isUpgrade;
    if (id.includes('homing')) return (isEarly ? 8 : 6) + isUpgrade;
    if (id.includes('ion_therapy')) return 6 + isUpgrade;
    if (id.includes('immune_aura')) return 6 + isUpgrade;
    if (id.includes('piercing')) return 5 + isUpgrade;
    if (id.includes('ricochet')) return 5 + isUpgrade;
    if (id.includes('crit')) return 5 + isUpgrade;
    if (id.includes('metabolic')) return 5 + isUpgrade; // Move speed matters with base 90
    if (id.includes('max_hp')) return 4 + isUpgrade;
    if (id.includes('regenerative')) return 4 + isUpgrade;
    if (id.includes('xp_magnet')) return isEarly ? 6 : 1;
    return 2 + isUpgrade;
  };

  choices.sort((a, b) => priority(b) - priority(a));
  return applyPowerup(sim, choices[0], powerups);
}

// ============================================================
// MAIN SIMULATION LOOP
// ============================================================
function simulateRun(data, options = {}) {
  const { enemies, bosses, powerups, spawnTables, player: playerBp } = data;
  const maxTime = options.maxTime || 25 * 60 * 1000;
  const forceBuild = options.forceBuild || null;

  const sim = new SimPlayer(playerBp);
  const result = {
    survivalTime: 0, result: 'timeout', kills: 0,
    maxPlayerLevel: 1, maxGameLevel: 1,
    powerups: [], bossKills: [], levelTimes: [],
    dpsTimeline: [], hpTimeline: [],
  };

  let time = 0, gameLevel = 1, activeEnemies = [];
  let bossSpawned = false, levelStartTime = 0, levelKills = 0;
  let waveTimers = []; // Track next spawn time per wave

  function resetWaveTimers(table) {
    waveTimers = (table.enemyWaves || []).map(wave => ({
      wave,
      nextSpawnAt: levelStartTime + (wave.startAt || 0),
    }));
  }
  resetWaveTimers(spawnTables['spawnTable.level1'] || {});

  while (time < maxTime && sim.hp > 0) {
    const table = spawnTables[`spawnTable.level${gameLevel}`];
    if (!table) break;

    const diff = table.difficulty || {};
    const prog = diff.progressiveScaling || {};
    const elapsedSec = (time - levelStartTime) / 1000;
    const diffMul = {
      hp: (diff.enemyHpMultiplier || 1) + (prog.hpGrowth || 0) * elapsedSec,
      damage: (diff.enemyDamageMultiplier || 1) + (prog.damageGrowth || 0) * elapsedSec,
      speed: diff.enemySpeedMultiplier || 1,
    };

    // --- SPAWN (interval-based, matching real SpawnWaveProcessor) ---
    const maxOnScreen = table.maxEnemiesOnScreen || 50;
    const relTime = time - levelStartTime;
    for (const wt of waveTimers) {
      const wave = wt.wave;
      if (relTime < (wave.startAt || 0) || relTime > (wave.endAt || 999999)) continue;
      if (time < wt.nextSpawnAt) continue;
      if (activeEnemies.length >= maxOnScreen) continue;

      // Weight check — probability that this wave fires on its interval
      if (Math.random() * 100 >= (wave.weight || 50)) {
        wt.nextSpawnAt = time + (wave.interval || 3000); // Skip but advance timer
        continue;
      }

      const bp = enemies[wave.enemyId] || bosses[wave.enemyId];
      if (bp) {
        const count = wave.countRange ? randRange(wave.countRange) : 1;
        for (let i = 0; i < count && activeEnemies.length < maxOnScreen; i++) {
          activeEnemies.push(new SimEnemy(bp, diffMul));
        }
      }
      wt.nextSpawnAt = time + (wave.interval || 3000);
    }

    // --- ELITE/UNIQUE SPAWNS (cooldown-based, same as SpawnWaveProcessor) ---
    if (table.eliteWindows) {
      for (const elite of table.eliteWindows) {
        if (relTime < (elite.startAt || 0) || relTime > (elite.endAt || 999999)) continue;
        if (!elite._nextSpawn || time >= elite._nextSpawn) {
          if (Math.random() * 100 < (elite.weight || 30) && activeEnemies.length < maxOnScreen) {
            const bp = enemies[elite.enemyId];
            if (bp) {
              const count = elite.countRange ? randRange(elite.countRange) : 1;
              for (let i = 0; i < count; i++) activeEnemies.push(new SimEnemy(bp, diffMul));
            }
          }
          elite._nextSpawn = time + (elite.cooldown || 15000);
        }
      }
    }
    if (table.uniqueSpawns) {
      for (const unique of table.uniqueSpawns) {
        if (unique._spawned) continue;
        if (relTime >= (unique.spawnAt || unique.startAt || 60000)) {
          if (Math.random() * 100 < (unique.weight || 50)) {
            const bp = enemies[unique.enemyId];
            if (bp) activeEnemies.push(new SimEnemy(bp, diffMul));
            unique._spawned = true;
          }
        }
      }
    }

    // --- BOSS TRIGGER ---
    if (!bossSpawned && table.bossTriggers) {
      for (const trigger of table.bossTriggers) {
        let met = false;
        const relTime = time - levelStartTime;
        if (trigger.condition === 'time' && relTime >= trigger.value) met = true;
        if (trigger.condition === 'kills' && levelKills >= trigger.value) met = true;
        if (met) {
          const bossBp = bosses[trigger.bossId];
          if (bossBp) { activeEnemies.push(new SimEnemy(bossBp, diffMul)); bossSpawned = true; }
          break;
        }
      }
    }

    // --- PLAYER DEALS DAMAGE ---
    const stats = sim._stats();
    const weaponDPS = sim.getDPS(stats);
    const abilityDPS = sim.getAbilityDPS();

    // Boss focus: player fires in all directions, but ~60% of weapon DPS hits boss
    // when boss is present (homing always targets boss, directional partially hits)
    // Ability DPS mostly hits normal enemies (AoE around player, not focused)
    const boss = activeEnemies.find(e => e.alive && e.isBoss);
    let weaponDmgRemaining = weaponDPS * (DT / 1000);
    let abilityDmgRemaining = abilityDPS * (DT / 1000);

    // Weapon: 60% focused on boss when present (4-dir + homing prioritize boss)
    if (boss && weaponDmgRemaining > 0) {
      const bossFocus = weaponDmgRemaining * 0.6;
      const dmg = Math.min(bossFocus, boss.hp);
      boss.hp -= dmg;
      weaponDmgRemaining -= dmg;
      sim.totalDmgDealt += dmg;
    }
    // Some ability DPS also hits boss (~20% — AoE splash, orbitals near player)
    if (boss && abilityDmgRemaining > 0 && boss.hp > 0) {
      const abilityBoss = abilityDmgRemaining * 0.2;
      const dmg = Math.min(abilityBoss, boss.hp);
      boss.hp -= dmg;
      abilityDmgRemaining -= dmg;
      sim.totalDmgDealt += dmg;
    }

    // Check if boss died from weapon focus
    if (boss && boss.hp <= 0) {
      boss.alive = false;
      sim.kills++; levelKills++;
      if (sim.addXP(boss.xp)) {
        const picked = pickPowerup(sim, powerups, forceBuild);
        if (picked) { result.powerups.push({ time, ...picked }); sim.powerupsPicked++; }
        sim.heal(20);
      }
      result.bossKills.push({ time, bossId: boss.id, gameLevel });
      result.levelTimes.push({ level: gameLevel, duration: time - levelStartTime, kills: levelKills });
      gameLevel++;
      if (gameLevel > 7) { result.result = 'victory'; }
      else {
        levelStartTime = time; levelKills = 0; bossSpawned = false;
        activeEnemies = activeEnemies.filter(e => e.alive && e.isBoss);
        const nextTable = spawnTables[`spawnTable.level${gameLevel}`];
        if (nextTable) {
          resetWaveTimers(nextTable);
          if (nextTable.eliteWindows) nextTable.eliteWindows.forEach(e => e._nextSpawn = 0);
          if (nextTable.uniqueSpawns) nextTable.uniqueSpawns.forEach(u => u._spawned = false);
        }
      }
    }
    if (result.result === 'victory') { result.survivalTime = time; break; }

    // Remaining weapon + ability damage: distribute across non-boss enemies (lowest HP first)
    let dmgRemaining = weaponDmgRemaining + abilityDmgRemaining;
    activeEnemies.sort((a, b) => a.hp - b.hp);
    for (let i = 0; i < activeEnemies.length && dmgRemaining > 0; i++) {
      const enemy = activeEnemies[i];
      if (!enemy.alive || enemy.isBoss) continue; // Skip boss (already handled)
      const dmg = Math.min(dmgRemaining, enemy.hp);
      enemy.hp -= dmg;
      dmgRemaining -= dmg;
      sim.totalDmgDealt += dmg;

      if (enemy.hp <= 0) {
        enemy.alive = false;
        sim.kills++; levelKills++;

        if (sim.addXP(enemy.xp)) {
          const picked = pickPowerup(sim, powerups, forceBuild);
          if (picked) { result.powerups.push({ time, ...picked }); sim.powerupsPicked++; }
          sim.heal(20);
        }

        // Boss kills handled in weapon focus section above
      }
    }
    activeEnemies = activeEnemies.filter(e => e.alive);
    if (result.result === 'victory') { result.survivalTime = time; break; }

    // --- ENEMIES DEAL DAMAGE ---
    // Calibrated from real session s_mngfqse4: 0.062 hits/sec avg, ~0.01 hits/sec/enemy
    // Player dodges most attacks via movement — only ~1% of enemy presence converts to hits
    const aliveNormal = activeEnemies.filter(e => e.alive && !e.isBoss);
    const contactRate = Math.min(1.5, aliveNormal.length * 0.01); // caps at 1.5 hits/sec
    if (Math.random() < contactRate * (DT / 1000) && aliveNormal.length > 0) {
      const hitter = aliveNormal[Math.floor(Math.random() * aliveNormal.length)];
      sim.takeDamage(hitter.damage, time);
    }
    // Boss periodic attacks
    for (const e of activeEnemies) {
      if (!e.alive || !e.isBoss) continue;
      if (Math.random() < 0.25 * (DT / 1000)) sim.takeDamage(e.damage, time);
    }

    // --- SHIELD REGEN ---
    if (sim.maxShieldHP > 0 && sim.shieldHP <= 0 && time >= sim.shieldRechargeAt) {
      sim.shieldHP = sim.maxShieldHP;
    }

    // --- PASSIVE REGEN ---
    if (sim._regenPerSec > 0 && sim.hp < sim.maxHp) {
      sim.heal(sim._regenPerSec * (DT / 1000));
    }

    // --- IFRAMES COUNTDOWN ---
    if (sim._iFramesLeft > 0) sim._iFramesLeft -= DT;

    // --- LOOT DROPS (calibrated from real rates) ---
    if (sim.hp < sim.maxHp && Math.random() < 0.003 * (DT / 1000) * Math.max(1, sim.kills / 50)) {
      sim.heal(10); // Health small
    }

    // --- TIMELINE ---
    if (time % 30000 < DT) {
      const s = sim._stats();
      result.dpsTimeline.push({
        time: Math.round(time / 1000), level: sim.level,
        weaponDps: Math.round(sim.getDPS(s)), abilityDps: Math.round(sim.getAbilityDPS()),
        totalDps: Math.round(sim.getTotalDPS(s)),
      });
      result.hpTimeline.push({
        time: Math.round(time / 1000),
        hp: Math.round(sim.hp), maxHp: sim.maxHp, shield: Math.round(sim.shieldHP),
        enemies: activeEnemies.length,
      });
    }

    time += DT;
  }

  if (sim.hp <= 0) result.result = 'death';
  result.survivalTime = time;
  result.kills = sim.kills;
  result.maxPlayerLevel = sim.level;
  result.maxGameLevel = gameLevel;
  result.finalStats = {
    hp: Math.round(sim.hp), maxHp: sim.maxHp,
    totalDmgDealt: Math.round(sim.totalDmgDealt),
    totalDmgTaken: Math.round(sim.totalDmgTaken),
    totalHealed: Math.round(sim.totalHealed),
    totalShieldAbs: Math.round(sim.totalShieldAbs),
    finalDPS: Math.round(sim.getTotalDPS()),
    weaponDPS: Math.round(sim.getDPS()),
    abilityDPS: Math.round(sim.getAbilityDPS()),
    lowestHP: Math.round(sim.lowestHP),
    shieldEff: sim.totalShieldAbs / Math.max(1, sim.totalShieldAbs + sim.totalDmgTaken),
    equipped: [...sim.equipped.entries()].map(([id, lvl]) => `${id.replace('powerup.', '')}:${lvl}`).join(', '),
  };

  return result;
}

// ============================================================
// REPORTING
// ============================================================
function runSimulations(data, options = {}) {
  const numRuns = options.runs || 100;
  const results = [];
  const t0 = Date.now();
  for (let i = 0; i < numRuns; i++) results.push(simulateRun(data, options));
  const elapsed = Date.now() - t0;

  const victories = results.filter(r => r.result === 'victory');
  const deaths = results.filter(r => r.result === 'death');
  const arr = (fn) => results.map(fn).sort((a, b) => a - b);

  console.log('\n' + '═'.repeat(80));
  console.log(`  BALANCE SIMULATION v2 — ${numRuns} runs in ${elapsed}ms`);
  console.log('═'.repeat(80));

  console.log('\n  OUTCOMES');
  console.log(`    Victory: ${victories.length}/${numRuns} (${pct(victories.length/numRuns)})`);
  console.log(`    Death:   ${deaths.length}/${numRuns} (${pct(deaths.length/numRuns)})`);

  const times = arr(r => r.survivalTime / 1000);
  const kills = arr(r => r.kills);
  const levels = arr(r => r.maxPlayerLevel);

  console.log('\n  SURVIVAL');
  console.log(`    Time:   median=${f(med(times))}s  p25=${f(p25(times))}s  p75=${f(p75(times))}s`);
  console.log(`    Kills:  median=${f(med(kills))}  p25=${f(p25(kills))}  p75=${f(p75(kills))}`);
  console.log(`    Level:  median=${f(med(levels))}  min=${f(levels[0])}  max=${f(levels.at(-1))}`);

  const lowHP = arr(r => r.finalStats.lowestHP);
  const shieldEff = arr(r => r.finalStats.shieldEff);
  const dps = arr(r => r.finalStats.finalDPS);

  console.log('\n  DIFFICULTY');
  console.log(`    Lowest HP:  median=${f(med(lowHP))}  p10=${f(pc(lowHP,10))}  p90=${f(pc(lowHP,90))}`);
  console.log(`    Shield eff: ${pct(med(shieldEff))}`);
  console.log(`    Final DPS:  median=${f(med(dps))}  p25=${f(p25(dps))}  p75=${f(p75(dps))}`);

  // DPS breakdown from median run
  const medIdx = Math.floor(results.length / 2);
  const medRun = [...results].sort((a, b) => a.survivalTime - b.survivalTime)[medIdx];
  console.log('\n  DPS BREAKDOWN (median run)');
  console.log(`    Weapon: ${medRun.finalStats.weaponDPS}  Abilities: ${medRun.finalStats.abilityDPS}  Total: ${medRun.finalStats.finalDPS}`);
  console.log(`    Build: ${medRun.finalStats.equipped}`);

  // Boss kill rates
  const bossRates = {};
  for (const r of results) for (const bk of r.bossKills) bossRates[bk.bossId] = (bossRates[bk.bossId] || 0) + 1;
  if (Object.keys(bossRates).length > 0) {
    console.log('\n  BOSS KILL RATES');
    for (const [id, count] of Object.entries(bossRates).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${id.padEnd(30)} ${count}/${numRuns} (${pct(count/numRuns)})`);
    }
  }

  // Powerup popularity
  const pupTotal = {};
  for (const r of results) for (const p of r.powerups) pupTotal[p.id] = (pupTotal[p.id] || 0) + 1;
  console.log('\n  POWERUP PICKS');
  for (const [id, count] of Object.entries(pupTotal).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`    ${id.padEnd(35)} ${(count/numRuns).toFixed(1)}/run`);
  }

  // Level timing (victories)
  if (victories.length > 0) {
    console.log('\n  LEVEL TIMING (victories)');
    const ltAgg = {};
    for (const r of victories) for (const lt of r.levelTimes) {
      if (!ltAgg[lt.level]) ltAgg[lt.level] = [];
      ltAgg[lt.level].push(lt.duration / 1000);
    }
    for (const [lvl, t] of Object.entries(ltAgg).sort((a, b) => a[0] - b[0])) {
      t.sort((a, b) => a - b);
      console.log(`    Stage ${lvl}: median=${f(med(t))}s  p25=${f(p25(t))}s  p75=${f(p75(t))}s  kills=${f(med(results.flatMap(r => r.levelTimes.filter(l => l.level == lvl).map(l => l.kills))))}`);
    }
  }

  // DPS timeline from median run
  if (options.verbose) {
    console.log('\n  DPS TIMELINE (median run)');
    for (const snap of medRun.dpsTimeline) {
      const bar = '█'.repeat(Math.min(Math.round(snap.totalDps / 5), 40));
      console.log(`    ${f(snap.time).padStart(5)}s L${f(snap.level).padStart(2)}  wpn=${f(snap.weaponDps).padStart(4)}  abi=${f(snap.abilityDps).padStart(4)}  total=${f(snap.totalDps).padStart(5)}  ${bar}`);
    }
  }
}

function f(v) { return v == null ? '-' : Number(v).toFixed(0); }
function pct(v) { return (v * 100).toFixed(1) + '%'; }
function med(a) { return a.length ? a[Math.floor(a.length / 2)] : 0; }
function p25(a) { return a.length ? a[Math.floor(a.length * 0.25)] : 0; }
function p75(a) { return a.length ? a[Math.floor(a.length * 0.75)] : 0; }
function pc(a, p) { return a.length ? a[Math.max(0, Math.ceil(a.length * p / 100) - 1)] : 0; }
function randRange([min, max]) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ============================================================
// CLI
// ============================================================
const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

const data = loadBlueprints();
console.log(`Loaded: ${Object.keys(data.enemies).length} enemies, ${Object.keys(data.bosses).length} bosses, ${Object.keys(data.powerups).length} powerups, ${Object.keys(data.spawnTables).length} spawn tables`);

runSimulations(data, {
  runs: parseInt(getArg('--runs')) || 200,
  maxTime: (parseInt(getArg('--time')) || 25) * 60 * 1000,
  forceBuild: getArg('--build')?.split(',') || null,
  verbose: args.includes('--verbose'),
});
