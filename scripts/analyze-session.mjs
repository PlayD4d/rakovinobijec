#!/usr/bin/env node
/**
 * Session Analysis Engine — Comprehensive game balance report
 *
 * Usage:
 *   node scripts/analyze-session.mjs                     # Latest session
 *   node scripts/analyze-session.mjs data/sessions/X.json  # Specific file
 *   node scripts/analyze-session.mjs --all               # All sessions summary
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const SESSIONS_DIR = resolve(ROOT, 'data/sessions');

// ============================================================
// HELPERS
// ============================================================
const fmt = (v) => v == null ? '-' : Number(v).toFixed(0);
const fmtF = (v, d = 1) => v == null ? '-' : Number(v).toFixed(d);
const pct = (v) => (v * 100).toFixed(1) + '%';
const timeStr = (ms) => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + (s % 60).toString().padStart(2, '0'); };
const bar = (v, max, width = 25) => '█'.repeat(Math.min(Math.round(v / Math.max(max, 1) * width), width));

function loadSession(file) {
  const d = JSON.parse(readFileSync(file, 'utf-8'));
  const e = d.events || [];
  const maxT = e.reduce((m, ev) => Math.max(m, ev.t || 0), 0);
  return { ...d, events: e, maxT, file };
}

// ============================================================
// ANALYSIS SECTIONS
// ============================================================

function analyzeOverview(s) {
  const { events: e, meta, maxT, id } = s;
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  SESSION ANALYSIS REPORT');
  console.log('║  ID: ' + (id || 'unknown') + '  |  Result: ' + (meta?.result || '?'));
  console.log('║  Duration: ' + timeStr(maxT) + ' (' + fmt(maxT / 1000) + 's)  |  Events: ' + e.length);
  console.log('║  Version: ' + (meta?.version || 'unknown'));
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
}

function analyzeLevelProgression(s) {
  const { events: e } = s;
  const lvlUps = e.filter(ev => ev.cat === 'xp' && ev.act === 'level_up');
  if (lvlUps.length === 0) return;

  console.log('\n═══ LEVEL PROGRESSION ═══');
  let prevT = 0;
  const times = [];
  lvlUps.forEach(ev => {
    const t = Math.round(ev.t / 1000);
    const delta = t - prevT;
    times.push(delta);
    console.log('  L' + ev.newLevel.toString().padStart(2) + ' @ ' + t.toString().padStart(4) + 's  (+' + delta.toString().padStart(3) + 's)  xpToNext=' + (ev.xpToNext || '?').toString().padStart(4) + '  ' + bar(delta, 60, 20));
    prevT = t;
  });
  console.log('  ── Final: L' + lvlUps[lvlUps.length - 1].newLevel + ' | Avg: ' + fmt(prevT / lvlUps.length) + 's/lvl | Fastest: ' + fmt(Math.min(...times)) + 's | Slowest: ' + fmt(Math.max(...times)) + 's');
}

function analyzePlayerPowerCurve(s) {
  const snaps = s.events.filter(ev => ev.cat === 'balance' && ev.act === 'player_snapshot');
  if (snaps.length === 0) { console.log('\n═══ PLAYER POWER CURVE ═══\n  ⚠ No balance snapshots (pre-v0.9.40 session?)'); return; }

  console.log('\n═══ PLAYER POWER CURVE ═══');
  console.log('  Time   Lvl   HP/Max    DMG  AtkMs  Spd  Crit  Proj  DmgRed  Kills');
  console.log('  ────   ───   ──────    ───  ─────  ───  ────  ────  ──────  ─────');
  // Show every 3rd snapshot to save space, plus first and last
  const show = snaps.filter((s, i) => i === 0 || i === snaps.length - 1 || i % 3 === 0);
  show.forEach(sn => {
    console.log('  ' + (sn.time || 0).toString().padStart(4) + 's  L' + (sn.level || 1).toString().padStart(2) + '   ' +
      (sn.hp || 0).toString().padStart(3) + '/' + (sn.maxHp || 100).toString().padEnd(3) + '   ' +
      (sn.dmg || 15).toString().padStart(3) + '  ' + (sn.atkMs || 2000).toString().padStart(5) + '  ' +
      (sn.moveSpd || 90).toString().padStart(3) + '  ' + ((sn.critChance || 5) + '%').padStart(4) + '  ' +
      (sn.projCount || 4).toString().padStart(4) + '  ' +
      (sn.dmgReduction || 0).toString().padStart(6) + '  ' +
      (sn.kills || 0).toString().padStart(5));
  });

  const first = snaps[0], last = snaps[snaps.length - 1];
  console.log('  ── Growth: DMG ' + first.dmg + '→' + last.dmg + ' | AtkMs ' + first.atkMs + '→' + last.atkMs +
    ' | Speed ' + first.moveSpd + '→' + last.moveSpd + ' | Crit ' + first.critChance + '→' + last.critChance + '%');
}

function analyzeKillAttribution(s) {
  const kills = s.events.filter(ev => ev.cat === 'kill' && ev.act === 'enemy_died');
  if (kills.length === 0) return;

  console.log('\n═══ KILL ATTRIBUTION ═══');
  const src = {};
  kills.forEach(k => { src[k.killer || 'unknown'] = (src[k.killer || 'unknown'] || 0) + 1; });
  const total = kills.length;
  Object.entries(src).sort((a, b) => b[1] - a[1]).forEach(([source, count]) => {
    const p = Math.round(count / total * 100);
    console.log('  ' + source.padEnd(22) + count.toString().padStart(5) + ' (' + p.toString().padStart(2) + '%)  ' + bar(count, total));
  });
  console.log('  ── Total: ' + total + ' kills');
}

function analyzeEnemySpawns(s) {
  const spawns = s.events.filter(ev => ev.cat === 'spawn' && (ev.act === 'enemy' || ev.act === 'boss'));
  if (spawns.length === 0) return;

  console.log('\n═══ ENEMY SPAWNS ═══');
  const types = {};
  spawns.forEach(ev => {
    const id = ev.id || '?';
    if (!types[id]) types[id] = { count: 0, hp: ev.hp, dmg: ev.dmg, speed: ev.speed, xp: ev.xp };
    types[id].count++;
    if (ev.hp) { types[id].hp = ev.hp; types[id].dmg = ev.dmg; types[id].speed = ev.speed; types[id].xp = ev.xp; }
  });
  console.log('  Type                         Spawns   HP   DMG  Speed   XP');
  Object.entries(types).sort((a, b) => b[1].count - a[1].count).forEach(([id, d]) => {
    console.log('  ' + id.padEnd(30) + d.count.toString().padStart(5) + '  ' +
      (d.hp || '?').toString().padStart(4) + '  ' + (d.dmg || '?').toString().padStart(4) + '  ' +
      (d.speed || '?').toString().padStart(5) + '  ' + (d.xp || '?').toString().padStart(4));
  });
}

function analyzeActivityTimeline(s) {
  const { events: e, maxT } = s;
  const kills = e.filter(ev => ev.cat === 'kill');
  const dmgTaken = e.filter(ev => ev.cat === 'player' && ev.act === 'take_damage');
  const perfs = e.filter(ev => ev.cat === 'perf' && ev.act === 'snapshot');

  console.log('\n═══ ACTIVITY TIMELINE (per minute) ═══');
  console.log('  Min  Kills  Enemies  DmgTaken  FPS  KillBar');
  for (let t = 0; t < maxT; t += 60000) {
    const k = kills.filter(ev => ev.t >= t && ev.t < t + 60000).length;
    const p = perfs.find(ev => ev.t >= t + 25000 && ev.t < t + 60000) || perfs.find(ev => ev.t >= t && ev.t < t + 60000);
    const dm = dmgTaken.filter(ev => ev.t >= t && ev.t < t + 60000).reduce((s, ev) => s + (ev.finalAmount || ev.rawAmount || 0), 0);
    console.log('  ' + Math.round(t / 60000).toString().padStart(3) + '  ' +
      k.toString().padStart(5) + '  ' + (p?.enemies || 0).toString().padStart(7) + '  ' +
      dm.toString().padStart(8) + '  ' + (p?.fps || 0).toString().padStart(3) + '  ' + bar(k, 200, 20));
  }
}

function analyzeSurvivability(s) {
  const { events: e, maxT } = s;
  const dmgTaken = e.filter(ev => ev.cat === 'player' && ev.act === 'take_damage');
  const heals = e.filter(ev => ev.cat === 'player' && ev.act === 'heal');
  const shieldAbs = e.filter(ev => ev.cat === 'shield' && (ev.act === 'absorbed' || ev.act === 'contact_absorbed' || ev.act === 'bullet_intercepted'));
  const totalDmg = dmgTaken.reduce((s, ev) => s + (ev.finalAmount || ev.rawAmount || 0), 0);
  const totalHeal = heals.reduce((s, ev) => s + (ev.amount || 0), 0);
  const totalShield = shieldAbs.reduce((s, ev) => s + (ev.absorbed || ev.damage || 0), 0);

  console.log('\n═══ SURVIVABILITY ═══');
  console.log('  Damage taken:     ' + fmt(totalDmg) + '  (' + fmtF(dmgTaken.length / (maxT / 1000), 3) + ' hits/s)');
  console.log('  Healed:           ' + fmt(totalHeal));
  console.log('  Shield absorbed:  ' + fmt(totalShield));
  console.log('  Shield efficiency:' + (totalShield + totalDmg > 0 ? ' ' + pct(totalShield / (totalShield + totalDmg)) : ' N/A'));
  console.log('  Net HP balance:   ' + (totalHeal - totalDmg > 0 ? '+' : '') + fmt(totalHeal - totalDmg));

  // Damage sources
  const sources = {};
  dmgTaken.forEach(ev => { const src = ev.source || 'unknown'; sources[src] = (sources[src] || 0) + (ev.finalAmount || ev.rawAmount || 0); });
  if (Object.keys(sources).length > 0) {
    console.log('  Damage by source:');
    Object.entries(sources).sort((a, b) => b[1] - a[1]).forEach(([src, dmg]) => {
      console.log('    ' + src.padEnd(25) + fmt(dmg).padStart(5) + ' DMG');
    });
  }
}

function analyzePowerupPicks(s) {
  const picks = s.events.filter(ev => ev.cat === 'powerup' && ev.act === 'applied');
  const offered = s.events.filter(ev => ev.cat === 'powerup' && ev.act === 'options_offered');
  if (picks.length === 0) return;

  console.log('\n═══ POWERUP PICKS ═══');
  picks.forEach(ev => {
    const t = Math.round(ev.t / 1000);
    const off = offered.find(o => Math.abs(o.t - ev.t) < 10000);
    console.log('  ' + t.toString().padStart(5) + 's  ' + (ev.id || '?').padEnd(32) + 'L' + (ev.level || 1) +
      (off ? '  from: ' + off.options : ''));
  });

  // Final build summary
  const build = {};
  picks.forEach(p => { const id = (p.id || '?').replace('powerup.', ''); build[id] = Math.max(build[id] || 0, p.level || 1); });
  const weapons = [], passives = [];
  const wpnTypes = ['shield', 'radiotherapy', 'orbital_antibodies', 'chemo_pool', 'antibody_boomerang',
    'ricochet_cell', 'synaptic_pulse', 'ion_therapy', 'immune_aura', 'oxidative_burst',
    'chemo_reservoir', 'homing_shot', 'piercing_arrows'];
  Object.entries(build).forEach(([id, lvl]) => {
    (wpnTypes.some(w => id.includes(w)) ? weapons : passives).push(id + ':' + lvl);
  });
  console.log('  ── FINAL BUILD:');
  console.log('     Weapons:  ' + (weapons.join(', ') || 'none'));
  console.log('     Passives: ' + (passives.join(', ') || 'none'));
}

function analyzeBossFights(s) {
  const { events: e } = s;
  const bossSpawns = e.filter(ev => ev.cat === 'boss' && ev.act === 'spawn');
  const bossDeaths = e.filter(ev => ev.cat === 'boss' && ev.act === 'death');
  const bossDmg = e.filter(ev => ev.cat === 'boss' && ev.act === 'damage_taken');
  const phases = e.filter(ev => ev.cat === 'boss' && ev.act === 'phase_transition');
  if (bossSpawns.length === 0) return;

  console.log('\n═══ BOSS FIGHTS ═══');
  bossSpawns.forEach(sp => {
    const id = sp.bossId;
    const death = bossDeaths.find(d => d.bossId === id);
    const dmgs = bossDmg.filter(d => d.bossId === id);
    const totalD = dmgs.reduce((s, d) => s + (d.amount || 0), 0);
    const maxHp = dmgs[0]?.maxHp || '?';
    const spT = Math.round(sp.t / 1000);
    const fight = death ? fmt(Math.round(death.t / 1000) - spT) + 's' : 'alive';
    const dps = death ? fmt(totalD / ((death.t - sp.t) / 1000)) : '?';
    const ph = phases.filter(p => p.bossId === id);
    const phStr = ph.length > 0 ? '  phases: ' + ph.map(p => p.fromPhase + '→' + p.toPhase).join(',') : '';

    // Player stats at time of fight
    const snap = s.events.find(ev => ev.cat === 'balance' && ev.act === 'player_snapshot' && ev.t >= sp.t && ev.t <= sp.t + 30000);
    const lvl = snap ? ' (L' + snap.level + ' DMG=' + snap.dmg + ')' : '';

    console.log('  ' + id.padEnd(28) + 'fight=' + fight.padStart(5) + '  HP=' + maxHp.toString().padStart(5) + '  DPS=' + dps.toString().padStart(4) + lvl + phStr);
  });
}

function analyzeLootDrops(s) {
  const loot = s.events.filter(ev => ev.cat === 'loot');
  const permStats = s.events.filter(ev => ev.cat === 'loot' && ev.act === 'permanent_stat');
  if (loot.length === 0 && permStats.length === 0) return;

  console.log('\n═══ LOOT DROPS ═══');
  const byType = {};
  loot.forEach(ev => { const key = ev.act + (ev.itemId ? ':' + ev.itemId : ''); byType[key] = (byType[key] || 0) + 1; });
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
    console.log('  ' + key.padEnd(35) + count.toString().padStart(3));
  });
  if (permStats.length > 0) {
    console.log('  ── Permanent stat pickups:');
    permStats.forEach(ev => {
      console.log('    ' + Math.round(ev.t / 1000).toString().padStart(5) + 's  ' + ev.stat + ' ' + (ev.modType === 'mul' ? '+' + (ev.value * 100) + '%' : '+' + ev.value));
    });
  }
}

function analyzePerformance(s) {
  const perfs = s.events.filter(ev => ev.cat === 'perf' && ev.act === 'snapshot');
  if (perfs.length === 0) return;

  const fps = perfs.map(ev => ev.fps).filter(Boolean);
  const enemies = perfs.map(ev => ev.enemies || 0);
  const loot = perfs.map(ev => ev.loot || 0);
  const proj = perfs.map(ev => ev.projectiles || 0);

  console.log('\n═══ PERFORMANCE ═══');
  console.log('  FPS:         avg=' + fmt(fps.reduce((a, b) => a + b, 0) / fps.length) + '  min=' + fmt(Math.min(...fps)) + '  max=' + fmt(Math.max(...fps)));
  console.log('  Enemies:     peak=' + fmt(Math.max(...enemies)) + '  avg=' + fmt(enemies.reduce((a, b) => a + b, 0) / enemies.length));
  console.log('  Loot:        peak=' + fmt(Math.max(...loot)));
  console.log('  Projectiles: peak=' + fmt(Math.max(...proj)));

  const heap = perfs.map(ev => ev.heapMB).filter(Boolean);
  if (heap.length > 0) console.log('  Memory:      peak=' + fmt(Math.max(...heap)) + 'MB  avg=' + fmt(heap.reduce((a, b) => a + b, 0) / heap.length) + 'MB');

  // Dead zones (≤2 enemies for ≥10s)
  let deadStart = null, deadZones = [];
  perfs.forEach(ev => {
    if ((ev.enemies || 0) <= 2) { if (!deadStart) deadStart = ev.t; }
    else { if (deadStart) { const dur = (ev.t - deadStart) / 1000; if (dur >= 10) deadZones.push({ start: fmt(deadStart / 1000), dur: fmt(dur) }); deadStart = null; } }
  });
  if (deadZones.length > 0) {
    console.log('  Dead zones (≤2 enemies ≥10s):');
    deadZones.forEach(z => console.log('    ' + z.start + 's for ' + z.dur + 's'));
  }
}

function analyzeDeadZones(s) {
  const perfs = s.events.filter(ev => ev.cat === 'perf' && ev.act === 'snapshot');
  if (perfs.length === 0) return;

  console.log('\n═══ ENEMY DENSITY TIMELINE ═══');
  // 30s buckets
  for (let t = 0; t < s.maxT; t += 30000) {
    const p = perfs.find(ev => ev.t >= t && ev.t < t + 30000);
    if (!p) continue;
    const enemies = p.enemies || 0;
    console.log('  ' + fmt(t / 1000).padStart(5) + 's: ' + enemies.toString().padStart(3) + ' enemies  ' + bar(enemies, 80, 30));
  }
}

// ============================================================
// MAIN
// ============================================================
const args = process.argv.slice(2);

let files = [];
if (args.includes('--all')) {
  files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json')).map(f => resolve(SESSIONS_DIR, f));
} else if (args[0] && !args[0].startsWith('--')) {
  files = [resolve(args[0])];
} else {
  // Latest session
  const all = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json')).sort();
  if (all.length === 0) { console.log('No sessions found in ' + SESSIONS_DIR); process.exit(1); }
  files = [resolve(SESSIONS_DIR, all[all.length - 1])];
}

for (const file of files) {
  if (!existsSync(file)) { console.log('File not found: ' + file); continue; }
  const session = loadSession(file);
  if (session.events.length < 10) continue; // Skip tiny sessions

  analyzeOverview(session);
  analyzeLevelProgression(session);
  analyzePlayerPowerCurve(session);
  analyzeKillAttribution(session);
  analyzeEnemySpawns(session);
  analyzeActivityTimeline(session);
  analyzeSurvivability(session);
  analyzePowerupPicks(session);
  analyzeBossFights(session);
  analyzeLootDrops(session);
  analyzePerformance(session);
  analyzeDeadZones(session);

  console.log('\n' + '═'.repeat(70) + '\n');
}
