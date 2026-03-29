#!/usr/bin/env node
/**
 * Balance Simulator — Headless Monte Carlo game simulation
 *
 * Reads actual blueprints and spawn tables, simulates combat mathematically.
 * Runs hundreds of games in seconds to evaluate balance.
 *
 * Usage:
 *   node scripts/balance-sim.mjs                    # 100 runs, all levels
 *   node scripts/balance-sim.mjs --runs 500         # 500 runs
 *   node scripts/balance-sim.mjs --level 3          # Only level 3
 *   node scripts/balance-sim.mjs --build shield,radiotherapy,multi_shot  # Force build
 *   node scripts/balance-sim.mjs --verbose          # Show individual run details
 */

import { readFileSync, readdirSync } from 'fs';
import JSON5 from 'json5';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const BP = (path) => JSON5.parse(readFileSync(resolve(ROOT, 'data/blueprints', path), 'utf-8'));

// ============================================================
// LOAD BLUEPRINTS
// ============================================================
function loadBlueprints() {
  const enemies = {};
  const bosses = {};
  const powerups = {};
  const spawnTables = {};

  // Enemies
  for (const f of readdirSync(resolve(ROOT, 'data/blueprints/enemy'))) {
    if (!f.endsWith('.json5')) continue;
    const bp = BP('enemy/' + f);
    enemies[bp.id] = bp;
  }
  // Elites
  for (const f of readdirSync(resolve(ROOT, 'data/blueprints/elite'))) {
    if (!f.endsWith('.json5')) continue;
    const bp = BP('elite/' + f);
    enemies[bp.id] = bp;
  }
  // Bosses
  for (const f of readdirSync(resolve(ROOT, 'data/blueprints/boss'))) {
    if (!f.endsWith('.json5')) continue;
    const bp = BP('boss/' + f);
    bosses[bp.id] = bp;
  }
  // Powerups
  for (const f of readdirSync(resolve(ROOT, 'data/blueprints/powerup'))) {
    if (!f.endsWith('.json5')) continue;
    const bp = BP('powerup/' + f);
    powerups[bp.id] = bp;
  }
  // Spawn tables
  for (const f of readdirSync(resolve(ROOT, 'data/blueprints/spawn'))) {
    if (!f.endsWith('.json5')) continue;
    const bp = BP('spawn/' + f);
    const key = `spawnTable.level${bp.level}`;
    spawnTables[key] = bp;
  }

  // Player
  const player = BP('player/player.json5');

  return { enemies, bosses, powerups, spawnTables, player };
}

// ============================================================
// SIMULATION ENGINE
// ============================================================
const DT = 200; // Simulation tick (ms) — 5 ticks/sec

class SimPlayer {
  constructor(playerBp, config) {
    this.hp = playerBp.stats?.hp || 100;
    this.maxHp = this.hp;
    this.speed = playerBp.stats?.speed || 135;
    this.baseDamage = playerBp.mechanics?.projectile?.stats?.damage || 10;
    this.attackInterval = playerBp.mechanics?.attack?.intervalMs || 1000;
    this.projectileCount = 1;
    this.damageBonus = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = config?.baseXpToNext || 8;
    this.xpScaling = config?.xpScaling || 1.18;

    // Shield
    this.shieldHP = 0;
    this.maxShieldHP = 0;
    this.shieldRechargeTime = 0;
    this.shieldRechargeAt = Infinity;
    this.shieldLevel = 0;

    // Abilities
    this.abilities = new Map(); // id → { level, config }

    // Stats tracking
    this.totalDamageDealt = 0;
    this.totalDamageTaken = 0;
    this.totalHealed = 0;
    this.totalShieldAbsorbed = 0;
    this.kills = 0;
    this.powerupsPicked = 0;
    this.lowestHP = this.hp;
  }

  getDPS() {
    const dmgPerShot = this.baseDamage + this.damageBonus;
    const shotsPerSec = 1000 / this.attackInterval;
    return dmgPerShot * this.projectileCount * shotsPerSec;
  }

  getAbilityDPS() {
    let dps = 0;
    for (const [id, ab] of this.abilities) {
      dps += ab.dps || 0;
    }
    return dps;
  }

  getTotalDPS() { return this.getDPS() + this.getAbilityDPS(); }

  addXP(amount) {
    this.xp += amount;
    let leveledUp = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = Math.ceil(this.xpToNext * this.xpScaling);
      leveledUp = true;
    }
    return leveledUp;
  }

  takeDamage(amount) {
    // Shield first
    if (this.shieldHP > 0) {
      const absorbed = Math.min(amount, this.shieldHP);
      this.shieldHP -= absorbed;
      this.totalShieldAbsorbed += absorbed;
      amount -= absorbed;
      if (this.shieldHP <= 0) {
        this.shieldRechargeAt = Infinity; // Will be set by sim tick
      }
    }
    if (amount > 0) {
      this.hp -= amount;
      this.totalDamageTaken += amount;
      this.lowestHP = Math.min(this.lowestHP, this.hp);
    }
  }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.totalHealed += this.hp - before;
  }
}

class SimEnemy {
  constructor(bp, difficultyMul) {
    this.id = bp.id;
    this.hp = Math.ceil((bp.stats?.hp || bp.stats?.maxHp || 30) * (difficultyMul?.hp || 1));
    this.damage = Math.ceil((bp.stats?.damage || bp.stats?.contactDamage || 10) * (difficultyMul?.damage || 1));
    this.speed = (bp.stats?.speed || bp.stats?.moveSpeed || 80) * (difficultyMul?.speed || 1);
    this.xp = bp.stats?.xp || bp.loot?.xp || 3;
    this.isBoss = bp.type === 'boss';
    this.alive = true;
  }
}

function simulateRun(data, options = {}) {
  const { enemies, bosses, powerups, spawnTables, player: playerBp } = data;
  const maxTime = options.maxTime || 30 * 60 * 1000; // 30 min default
  const forceBuild = options.forceBuild || null;
  const startLevel = options.startLevel || 1;
  const maxGameLevel = options.maxGameLevel || 7;

  const sim = new SimPlayer(playerBp);
  const result = {
    survivalTime: 0,
    result: 'timeout',
    kills: 0,
    maxPlayerLevel: 1,
    maxGameLevel: startLevel,
    powerups: [],
    dpsTimeline: [],
    hpTimeline: [],
    bossKills: [],
    levelTimes: [],
  };

  let time = 0;
  let gameLevel = startLevel;
  let activeEnemies = [];
  let bossSpawned = false;
  let levelStartTime = 0;
  let levelKills = 0;

  // Available powerup pool
  const pupPool = Object.keys(powerups);

  while (time < maxTime && sim.hp > 0) {
    const table = spawnTables[`spawnTable.level${gameLevel}`];
    if (!table) break;

    const diff = table.difficulty || {};
    const prog = diff.progressiveScaling || {};
    const elapsedSec = (time - levelStartTime) / 1000;
    const hpMul = (diff.enemyHpMultiplier || 1) + (prog.hpGrowth || 0) * elapsedSec;
    const dmgMul = (diff.enemyDamageMultiplier || 1) + (prog.damageGrowth || 0) * elapsedSec;
    const spdMul = diff.enemySpeedMultiplier || 1;
    const diffMul = { hp: hpMul, damage: dmgMul, speed: spdMul };

    // --- SPAWN ENEMIES ---
    if (table.enemyWaves && activeEnemies.length < 50) {
      const relTime = time - levelStartTime;
      for (const wave of table.enemyWaves) {
        if (relTime < (wave.startAt || 0) || relTime > (wave.endAt || 999999)) continue;
        if (Math.random() * 100 >= (wave.weight || 50)) continue;
        const bp = enemies[wave.enemyId];
        if (!bp) continue;
        const count = wave.countRange ? randRange(wave.countRange) : 1;
        for (let i = 0; i < count && activeEnemies.length < 50; i++) {
          activeEnemies.push(new SimEnemy(bp, diffMul));
        }
      }
    }

    // --- BOSS TRIGGER ---
    if (!bossSpawned && table.bossTriggers) {
      const relTime = time - levelStartTime;
      for (const trigger of table.bossTriggers) {
        let met = false;
        if (trigger.condition === 'time' && relTime >= trigger.value) met = true;
        if (trigger.condition === 'kills' && levelKills >= trigger.value) met = true;
        if (met) {
          const bossBp = bosses[trigger.bossId];
          if (bossBp) {
            activeEnemies.push(new SimEnemy(bossBp, diffMul));
            bossSpawned = true;
          }
          break;
        }
      }
    }

    // --- PLAYER DEALS DAMAGE ---
    const playerDPS = sim.getTotalDPS();
    const dmgThisTick = playerDPS * (DT / 1000);
    let dmgRemaining = dmgThisTick;

    for (let i = activeEnemies.length - 1; i >= 0 && dmgRemaining > 0; i--) {
      const enemy = activeEnemies[i];
      if (!enemy || !enemy.alive) continue;
      const dmgToEnemy = Math.min(dmgRemaining, enemy.hp);
      enemy.hp -= dmgToEnemy;
      dmgRemaining -= dmgToEnemy;
      sim.totalDamageDealt += dmgToEnemy;

      if (enemy.hp <= 0) {
        enemy.alive = false;
        sim.kills++;
        levelKills++;

        // XP
        const leveledUp = sim.addXP(enemy.xp);
        if (leveledUp) {
          // Pick powerup
          const picked = pickPowerup(sim, powerups, pupPool, forceBuild);
          if (picked) {
            result.powerups.push({ time, id: picked.id, level: picked.level });
            sim.powerupsPicked++;
          }
          sim.heal(20); // Level-up heal
        }

        // Boss kill → level transition
        if (enemy.isBoss) {
          result.bossKills.push({ time, bossId: enemy.id, gameLevel });
          result.levelTimes.push({ level: gameLevel, duration: time - levelStartTime, kills: levelKills });

          gameLevel++;
          if (gameLevel > maxGameLevel) {
            result.result = 'victory';
            result.survivalTime = time;
            break;
          }
          levelStartTime = time;
          levelKills = 0;
          bossSpawned = false;
          activeEnemies = []; // Clear for new level
        }

      }
    }
    // Remove dead enemies after damage loop
    activeEnemies = activeEnemies.filter(e => e.alive);

    if (result.result === 'victory') break;

    // --- ENEMIES DEAL DAMAGE ---
    // Enemy damage model: only a fraction of enemies are close enough to hit
    // Real game data shows ~0.3 contact hits/sec and ~0.02 bullet hits/sec at peak density
    const aliveCount = activeEnemies.filter(e => e.alive && !e.isBoss).length;
    // Contact damage: ~1 hit every 3-5 seconds from crowd, scales with density
    const contactsPerSec = Math.min(2.0, aliveCount * 0.015);
    if (Math.random() < contactsPerSec * (DT / 1000) && aliveCount > 0) {
      const hitter = activeEnemies.find(e => e.alive && !e.isBoss);
      if (hitter) sim.takeDamage(hitter.damage);
    }
    // Shooter damage: ~3.6% accuracy from session data
    const shooters = activeEnemies.filter(e => e.alive && e.id?.includes('shooter'));
    for (const s of shooters) {
      if (Math.random() < 0.036 * 0.5 * (DT / 1000)) { // 0.5 shots/sec per shooter × 3.6% accuracy
        sim.takeDamage(s.damage);
      }
    }
    // Boss damage: periodic attacks
    for (const enemy of activeEnemies) {
      if (!enemy.alive || !enemy.isBoss) continue;
      if (Math.random() < 0.3 * (DT / 1000)) { // Boss attacks ~every 3s
        sim.takeDamage(enemy.damage);
      }
    }

    // --- SHIELD REGEN ---
    if (sim.shieldLevel > 0 && sim.shieldHP <= 0 && time >= sim.shieldRechargeAt) {
      sim.shieldHP = sim.maxShieldHP;
    }
    if (sim.shieldLevel > 0 && sim.shieldHP <= 0 && sim.shieldRechargeAt === Infinity) {
      sim.shieldRechargeAt = time + sim.shieldRechargeTime;
    }

    // --- HEAL DROPS (simplified: 0.8% per kill → ~1 heal per 125 kills) ---
    // Already handled via level-up heal above

    // --- TIMELINE SNAPSHOTS (every 30s) ---
    if (time % 30000 < DT) {
      result.dpsTimeline.push({ time, dps: sim.getTotalDPS(), weaponDps: sim.getDPS(), abilityDps: sim.getAbilityDPS() });
      result.hpTimeline.push({ time, hp: sim.hp, shield: sim.shieldHP, enemies: activeEnemies.length });
    }

    time += DT;
  }

  if (sim.hp <= 0) {
    result.result = 'death';
  }

  result.survivalTime = time;
  result.kills = sim.kills;
  result.maxPlayerLevel = sim.level;
  result.maxGameLevel = gameLevel;
  result.finalStats = {
    hp: sim.hp,
    totalDamageDealt: Math.round(sim.totalDamageDealt),
    totalDamageTaken: Math.round(sim.totalDamageTaken),
    totalHealed: Math.round(sim.totalHealed),
    totalShieldAbsorbed: Math.round(sim.totalShieldAbsorbed),
    finalDPS: Math.round(sim.getTotalDPS()),
    weaponDPS: Math.round(sim.getDPS()),
    abilityDPS: Math.round(sim.getAbilityDPS()),
    lowestHP: sim.lowestHP,
    powerupsPicked: sim.powerupsPicked,
    shieldEfficiency: (sim.totalShieldAbsorbed + sim.totalDamageTaken) > 0
      ? sim.totalShieldAbsorbed / (sim.totalShieldAbsorbed + sim.totalDamageTaken) : 0,
  };

  return result;
}

// ============================================================
// POWERUP PICKING (simulates player choices)
// ============================================================
function pickPowerup(sim, powerups, pool, forceBuild) {
  // Offer 3 random choices, pick the "best" one
  const choices = [];
  const available = pool.filter(id => {
    const bp = powerups[id];
    const maxLvl = bp.stats?.maxLevel || 5;
    const current = sim.abilities.get(id);
    return !current || current.level < maxLvl;
  });

  if (available.length === 0) return null;

  // If forced build, prefer those
  if (forceBuild) {
    const preferred = available.filter(id => forceBuild.some(f => id.includes(f)));
    if (preferred.length > 0) {
      const pick = preferred[Math.floor(Math.random() * preferred.length)];
      return applyPowerup(sim, pick, powerups);
    }
  }

  // Random 3 choices, pick highest priority
  for (let i = 0; i < 3 && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    choices.push(available[idx]);
    available.splice(idx, 1);
  }

  // Priority: damage abilities > utility > defense
  const priority = (id) => {
    if (id.includes('damage_boost')) return 10;
    if (id.includes('multi_shot')) return 9;
    if (id.includes('chain_lightning')) return 8;
    if (id.includes('radiotherapy')) return 7;
    if (id.includes('flamethrower')) return 6;
    if (id.includes('piercing')) return 5;
    if (id.includes('chemo')) return 4;
    if (id.includes('metabolic')) return 3;
    if (id.includes('shield')) return 2;
    if (id.includes('xp_magnet')) return 1;
    return 0;
  };

  choices.sort((a, b) => priority(b) - priority(a));
  return applyPowerup(sim, choices[0], powerups);
}

function applyPowerup(sim, pupId, powerups) {
  const bp = powerups[pupId];
  if (!bp) return null;

  const existing = sim.abilities.get(pupId);
  const level = existing ? existing.level + 1 : 1;
  const ab = bp.ability || {};

  // Apply effects based on type
  if (pupId.includes('damage_boost')) {
    sim.damageBonus += 3;
  } else if (pupId.includes('multi_shot')) {
    sim.projectileCount += 1;
  } else if (pupId.includes('shield')) {
    sim.shieldLevel = level;
    sim.maxShieldHP = (ab.baseShieldHP || 15) * level;
    sim.shieldHP = sim.maxShieldHP;
    sim.shieldRechargeTime = (ab.rechargeTimePerLevel || [18000])[level - 1] || 18000;
  } else if (pupId.includes('radiotherapy')) {
    const dmg = (ab.damagePerLevel || [12])[level - 1] || 12;
    const beams = (ab.beamsPerLevel || [1])[level - 1] || 1;
    const tickRate = ab.tickRate || 0.1;
    sim.abilities.set(pupId, { level, dps: dmg * beams / tickRate });
    return { id: pupId, level };
  } else if (pupId.includes('flamethrower')) {
    const dmg = (ab.damagePerLevel || [10])[level - 1] || 10;
    sim.abilities.set(pupId, { level, dps: dmg / (ab.tickRate || 0.1) * 0.4 }); // ~40% uptime
    return { id: pupId, level };
  } else if (pupId.includes('chain_lightning')) {
    const dmg = (ab.baseDamage || 25) + (ab.damagePerLevel || 20) * level;
    const interval = (ab.interval || 1500) / 1000;
    sim.abilities.set(pupId, { level, dps: dmg * level / interval }); // chains = level count
    return { id: pupId, level };
  } else if (pupId.includes('chemo')) {
    const dmg = ab.chemoCloudDamage || 12;
    sim.abilities.set(pupId, { level, dps: dmg * 0.5 }); // ~50% uptime
    return { id: pupId, level };
  } else if (pupId.includes('metabolic')) {
    sim.attackInterval = Math.max(200, sim.attackInterval * 0.92); // 8% faster
  } else if (pupId.includes('piercing')) {
    // Piercing effectively increases DPS by ~20% per level
    sim.damageBonus += 2;
  }

  sim.abilities.set(pupId, { level, dps: sim.abilities.get(pupId)?.dps || 0 });
  return { id: pupId, level };
}

// ============================================================
// REPORTING
// ============================================================
function runSimulations(data, options = {}) {
  const numRuns = options.runs || 100;
  const results = [];
  const t0 = Date.now();

  for (let i = 0; i < numRuns; i++) {
    results.push(simulateRun(data, options));
  }

  const elapsed = Date.now() - t0;

  // Aggregate
  const victories = results.filter(r => r.result === 'victory');
  const deaths = results.filter(r => r.result === 'death');
  const survivalTimes = results.map(r => r.survivalTime / 1000).sort((a, b) => a - b);
  const killCounts = results.map(r => r.kills).sort((a, b) => a - b);
  const playerLevels = results.map(r => r.maxPlayerLevel).sort((a, b) => a - b);
  const gameLevels = results.map(r => r.maxGameLevel).sort((a, b) => a - b);
  const lowestHPs = results.map(r => r.finalStats.lowestHP).sort((a, b) => a - b);
  const shieldEffs = results.map(r => r.finalStats.shieldEfficiency).sort((a, b) => a - b);
  const finalDPS = results.map(r => r.finalStats.finalDPS).sort((a, b) => a - b);

  console.log('\n' + '='.repeat(80));
  console.log(`BALANCE SIMULATION — ${numRuns} runs in ${elapsed}ms (${(elapsed/numRuns).toFixed(1)}ms/run)`);
  console.log('='.repeat(80));

  console.log('\n--- OUTCOMES ---');
  console.log(`  Victory: ${victories.length} (${(victories.length / numRuns * 100).toFixed(1)}%)`);
  console.log(`  Death:   ${deaths.length} (${(deaths.length / numRuns * 100).toFixed(1)}%)`);
  console.log(`  Timeout: ${results.filter(r => r.result === 'timeout').length}`);

  console.log('\n--- SURVIVAL ---');
  console.log(`  Time:  median=${fmt(median(survivalTimes))}s  p25=${fmt(pctl(survivalTimes, 25))}s  p75=${fmt(pctl(survivalTimes, 75))}s`);
  console.log(`  Kills: median=${fmt(median(killCounts))}  p25=${fmt(pctl(killCounts, 25))}  p75=${fmt(pctl(killCounts, 75))}`);
  console.log(`  Player level: median=${fmt(median(playerLevels))}  max=${fmt(Math.max(...playerLevels))}`);
  console.log(`  Game level:   median=${fmt(median(gameLevels))}  max=${fmt(Math.max(...gameLevels))}`);

  console.log('\n--- DIFFICULTY ---');
  console.log(`  Lowest HP: median=${fmt(median(lowestHPs))}  p10=${fmt(pctl(lowestHPs, 10))}  p90=${fmt(pctl(lowestHPs, 90))}`);
  console.log(`  Shield eff: median=${pct2(median(shieldEffs))}  p10=${pct2(pctl(shieldEffs, 10))}  p90=${pct2(pctl(shieldEffs, 90))}`);
  console.log(`  Final DPS: median=${fmt(median(finalDPS))}  p25=${fmt(pctl(finalDPS, 25))}  p75=${fmt(pctl(finalDPS, 75))}`);

  // DPS breakdown from last run
  const last = results[results.length - 1];
  const fs = last.finalStats;
  console.log(`\n--- DPS BREAKDOWN (sample run) ---`);
  console.log(`  Weapon: ${fs.weaponDPS}  Abilities: ${fs.abilityDPS}  Total: ${fs.finalDPS}`);
  console.log(`  Ability share: ${pct2(fs.abilityDPS / Math.max(fs.finalDPS, 1))}`);

  // Boss kill stats
  const bossKillCounts = {};
  for (const r of results) {
    for (const bk of r.bossKills) {
      bossKillCounts[bk.bossId] = (bossKillCounts[bk.bossId] || 0) + 1;
    }
  }
  if (Object.keys(bossKillCounts).length > 0) {
    console.log('\n--- BOSS KILL RATES ---');
    for (const [id, count] of Object.entries(bossKillCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${id}: ${count}/${numRuns} (${(count / numRuns * 100).toFixed(0)}%)`);
    }
  }

  // Powerup popularity
  const pupCounts = {};
  for (const r of results) {
    for (const p of r.powerups) {
      pupCounts[p.id] = (pupCounts[p.id] || 0) + 1;
    }
  }
  console.log('\n--- POWERUP PICKS (total across runs) ---');
  for (const [id, count] of Object.entries(pupCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id}: ${count} (${(count / numRuns).toFixed(1)}/run)`);
  }

  // Level timing (from victories)
  if (victories.length > 0) {
    console.log('\n--- LEVEL TIMING (victories only) ---');
    const levelTimesAgg = {};
    for (const r of victories) {
      for (const lt of r.levelTimes) {
        if (!levelTimesAgg[lt.level]) levelTimesAgg[lt.level] = [];
        levelTimesAgg[lt.level].push(lt.duration / 1000);
      }
    }
    for (const [lvl, times] of Object.entries(levelTimesAgg).sort((a, b) => a[0] - b[0])) {
      times.sort((a, b) => a - b);
      console.log(`  Level ${lvl}: median=${fmt(median(times))}s  p25=${fmt(pctl(times, 25))}s  p75=${fmt(pctl(times, 75))}s`);
    }
  }

  if (options.verbose && results.length <= 10) {
    console.log('\n--- INDIVIDUAL RUNS ---');
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      console.log(`  Run ${i + 1}: ${r.result} at ${fmt(r.survivalTime / 1000)}s, ${r.kills} kills, level ${r.maxPlayerLevel}, gameLevel ${r.maxGameLevel}, lowestHP=${r.finalStats.lowestHP}`);
    }
  }
}

// ============================================================
// HELPERS
// ============================================================
function randRange([min, max]) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function median(arr) { return arr.length > 0 ? arr[Math.floor(arr.length / 2)] : 0; }
function pctl(arr, p) { return arr.length > 0 ? arr[Math.max(0, Math.ceil(arr.length * p / 100) - 1)] : 0; }
function fmt(v) { return v == null ? '-' : Number(v).toFixed(0); }
function pct2(v) { return v == null ? '-' : (v * 100).toFixed(1) + '%'; }

// ============================================================
// CLI
// ============================================================
const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const hasFlag = (name) => args.includes(name);

const data = loadBlueprints();
console.log(`Loaded: ${Object.keys(data.enemies).length} enemies, ${Object.keys(data.bosses).length} bosses, ${Object.keys(data.powerups).length} powerups, ${Object.keys(data.spawnTables).length} spawn tables`);

const options = {
  runs: parseInt(getArg('--runs')) || 100,
  maxTime: (parseInt(getArg('--time')) || 30) * 60 * 1000,
  startLevel: parseInt(getArg('--level')) || 1,
  maxGameLevel: parseInt(getArg('--maxlevel')) || 7,
  forceBuild: getArg('--build')?.split(',') || null,
  verbose: hasFlag('--verbose'),
};

runSimulations(data, options);
