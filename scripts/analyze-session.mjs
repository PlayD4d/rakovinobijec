#!/usr/bin/env node
/**
 * Session Analysis Engine — Comprehensive game balance report
 *
 * Uses gt (game time, pause-aware) for all timing. Falls back to t (wall-clock) for old sessions.
 *
 * Usage:
 *   node scripts/analyze-session.mjs                       # Latest session
 *   node scripts/analyze-session.mjs data/sessions/X.json  # Specific file
 *   node scripts/analyze-session.mjs --all                 # All sessions summary
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
const mmss = (sec) => Math.floor(sec / 60) + ':' + (Math.floor(sec) % 60).toString().padStart(2, '0');
const bar = (v, max, width = 25) => '█'.repeat(Math.max(0, Math.min(Math.round(v / Math.max(max, 1) * width), width)));

/** Get game time in seconds. Prefers gt (pause-aware), falls back to t/1000 (wall-clock). */
function gt(ev) {
  if (ev.gt != null) return ev.gt;
  if (ev.t != null) return Math.round(ev.t / 1000);
  return 0;
}

/** Max game time across all events */
function maxGt(events) {
  return events.reduce((m, ev) => Math.max(m, gt(ev)), 0);
}

function loadSession(file) {
  const d = JSON.parse(readFileSync(file, 'utf-8'));
  const e = d.events || [];
  return { ...d, events: e, maxGt: maxGt(e), maxT: e.reduce((m, ev) => Math.max(m, ev.t || 0), 0), file };
}

/** Load powerup blueprints to resolve slot types dynamically */
function loadSlotMap() {
  const map = {};
  const dir = resolve(ROOT, 'data/blueprints/powerup');
  if (!existsSync(dir)) return map;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json5'))) {
    try {
      // Simple parse — json5 files have unquoted keys, strip comments
      const raw = readFileSync(resolve(dir, f), 'utf-8');
      const idMatch = raw.match(/id:\s*['"]([^'"]+)['"]/);
      const slotMatch = raw.match(/slot:\s*['"]([^'"]+)['"]/);
      if (idMatch) {
        const short = idMatch[1].replace('powerup.', '');
        map[short] = slotMatch ? slotMatch[1] : 'weapon';
      }
    } catch (_) {}
  }
  return map;
}

const SLOT_MAP = loadSlotMap();
function getSlot(puId) {
  const short = puId.replace('powerup.', '');
  return SLOT_MAP[short] || 'weapon';
}

// ============================================================
// ANALYSIS SECTIONS
// ============================================================

function analyzeOverview(s) {
  const { events: e, meta } = s;
  const wallSec = Math.round(s.maxT / 1000);
  const gameSec = s.maxGt;
  const pauseSec = wallSec - gameSec;
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  SESSION ANALYSIS REPORT');
  console.log('║  ID: ' + (s.id || 'unknown') + '  |  Result: ' + (meta?.result || '?'));
  console.log('║  Game time: ' + mmss(gameSec) + ' (' + gameSec + 's)  |  Wall: ' + mmss(wallSec) + '  |  Paused: ' + pauseSec + 's');
  console.log('║  Events: ' + e.length + '  |  Version: ' + (meta?.version || 'unknown'));
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
}

function analyzeLevelProgression(s) {
  const lvlUps = s.events.filter(ev => ev.cat === 'xp' && ev.act === 'level_up');
  if (lvlUps.length === 0) return;

  console.log('\n═══ LEVEL PROGRESSION ═══');
  let prevGt = 0;
  const deltas = [];
  lvlUps.forEach(ev => {
    const g = gt(ev);
    const delta = g - prevGt;
    deltas.push(delta);
    console.log('  L' + ev.newLevel.toString().padStart(2) + ' @ ' + g.toString().padStart(4) + 's  (+' + delta.toString().padStart(3) + 's)  xpToNext=' + (ev.xpToNext || '?').toString().padStart(4) + '  ' + bar(delta, 60, 20));
    prevGt = g;
  });
  const last = lvlUps[lvlUps.length - 1];
  console.log('  ── Final: L' + last.newLevel + ' | Avg: ' + fmt(gt(last) / lvlUps.length) + 's/lvl | Fastest: ' + fmt(Math.min(...deltas)) + 's | Slowest: ' + fmt(Math.max(...deltas)) + 's');
}

function analyzePlayerPowerCurve(s) {
  const snaps = s.events.filter(ev => ev.cat === 'balance' && ev.act === 'player_snapshot');
  if (snaps.length === 0) { console.log('\n═══ PLAYER POWER CURVE ═══\n  (no snapshots)'); return; }

  console.log('\n═══ PLAYER POWER CURVE ═══');
  console.log('  Time   Lvl   HP/Max    DMG  AtkMs  Spd  Crit  Proj  DmgRed  Kills');
  console.log('  ────   ───   ──────    ───  ─────  ───  ────  ────  ──────  ─────');
  const show = snaps.filter((_, i) => i === 0 || i === snaps.length - 1 || i % 3 === 0);
  show.forEach(sn => {
    const g = gt(sn);
    console.log('  ' + g.toString().padStart(4) + 's  L' + (sn.level || 1).toString().padStart(2) + '   ' +
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
    const id = ev.id || ev.bossId || '?';
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
  const kills = s.events.filter(ev => ev.cat === 'kill');
  const dmgTaken = s.events.filter(ev => ev.cat === 'player' && ev.act === 'take_damage');
  const perfs = s.events.filter(ev => ev.cat === 'perf' && ev.act === 'snapshot');

  console.log('\n═══ ACTIVITY TIMELINE (per minute of game time) ═══');
  console.log('  Min  Kills  Enemies  DmgTaken  FPS  KillBar');
  const endSec = s.maxGt;
  for (let sec = 0; sec < endSec; sec += 60) {
    const secEnd = sec + 60;
    const k = kills.filter(ev => gt(ev) >= sec && gt(ev) < secEnd).length;
    const p = perfs.find(ev => gt(ev) >= sec && gt(ev) < secEnd);
    const dm = dmgTaken.filter(ev => gt(ev) >= sec && gt(ev) < secEnd).reduce((s, ev) => s + (ev.finalAmount || ev.rawAmount || ev.amount || 0), 0);
    console.log('  ' + Math.round(sec / 60).toString().padStart(3) + '  ' +
      k.toString().padStart(5) + '  ' + (p?.enemies || p?.enemiesActive || 0).toString().padStart(7) + '  ' +
      dm.toString().padStart(8) + '  ' + (p?.fps || 0).toString().padStart(3) + '  ' + bar(k, 200, 20));
  }
}

function analyzeSurvivability(s) {
  const dmgTaken = s.events.filter(ev => ev.cat === 'player' && ev.act === 'take_damage');
  const heals = s.events.filter(ev => ev.cat === 'player' && ev.act === 'heal');
  const shieldAbs = s.events.filter(ev => ev.cat === 'shield' && (ev.act === 'absorbed' || ev.act === 'contact_absorbed' || ev.act === 'bullet_intercepted'));
  const totalDmg = dmgTaken.reduce((s, ev) => s + (ev.finalAmount || ev.rawAmount || ev.amount || 0), 0);
  const totalHeal = heals.reduce((s, ev) => s + (ev.amount || 0), 0);
  const totalShield = shieldAbs.reduce((s, ev) => s + (ev.absorbed || ev.damage || 0), 0);
  const gameSec = s.maxGt || 1;

  console.log('\n═══ SURVIVABILITY ═══');
  console.log('  Damage taken:     ' + fmt(totalDmg) + '  (' + fmtF(dmgTaken.length / gameSec, 3) + ' hits/s)');
  console.log('  Healed:           ' + fmt(totalHeal));
  console.log('  Shield absorbed:  ' + fmt(totalShield));
  console.log('  Shield efficiency:' + (totalShield + totalDmg > 0 ? ' ' + pct(totalShield / (totalShield + totalDmg)) : ' N/A'));
  console.log('  Net HP balance:   ' + (totalHeal - totalDmg > 0 ? '+' : '') + fmt(totalHeal - totalDmg));

  const sources = {};
  dmgTaken.forEach(ev => { const src = ev.source || 'unknown'; sources[src] = (sources[src] || 0) + (ev.finalAmount || ev.rawAmount || ev.amount || 0); });
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
    const g = gt(ev);
    const off = offered.find(o => Math.abs(o.t - ev.t) < 15000);
    console.log('  ' + g.toString().padStart(5) + 's  ' + (ev.id || '?').padEnd(32) + 'L' + (ev.level || 1) +
      (off ? '  from: ' + off.options : ''));
  });

  // Final build — resolve slots from blueprints
  const build = {};
  picks.forEach(p => { const id = (p.id || '?').replace('powerup.', ''); build[id] = Math.max(build[id] || 0, p.level || 1); });
  const weapons = [], passives = [];
  Object.entries(build).forEach(([id, lvl]) => {
    (getSlot(id) === 'passive' ? passives : weapons).push(id + ':' + lvl);
  });
  console.log('  ── FINAL BUILD:');
  console.log('     Weapons (' + weapons.length + '):  ' + (weapons.join(', ') || 'none'));
  console.log('     Passives (' + passives.length + '): ' + (passives.join(', ') || 'none'));
}

function analyzeUIEvents(s) {
  const ui = s.events.filter(ev => ev.cat === 'ui');
  if (ui.length === 0) return;

  console.log('\n═══ UI EVENTS ═══');
  const counts = {};
  ui.forEach(ev => { counts[ev.act] = (counts[ev.act] || 0) + 1; });
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([act, count]) => {
    console.log('  ' + act.padEnd(25) + count.toString().padStart(3));
  });

  // Pause durations
  const pauses = ui.filter(ev => ev.act === 'pause_show');
  const resumes = ui.filter(ev => ev.act === 'pause_resume');
  if (pauses.length > 0) {
    console.log('  ── Pause sessions: ' + pauses.length);
    pauses.forEach((p, i) => {
      const r = resumes[i];
      if (r) {
        const dur = fmtF((r.t - p.t) / 1000);
        console.log('    ' + gt(p) + 's → paused ' + dur + 's');
      }
    });
  }

  // Powerup selection timing
  const shows = ui.filter(ev => ev.act === 'powerup_show');
  const clicks = ui.filter(ev => ev.act === 'powerup_card_clicked');
  if (shows.length > 0 && clicks.length > 0) {
    const times = shows.map((sh, i) => {
      const cl = clicks[i];
      return cl ? (cl.t - sh.t) / 1000 : null;
    }).filter(Boolean);
    if (times.length > 0) {
      console.log('  ── Powerup decision time: avg=' + fmtF(times.reduce((a, b) => a + b, 0) / times.length) +
        's  min=' + fmtF(Math.min(...times)) + 's  max=' + fmtF(Math.max(...times)) + 's');
    }
  }

  // Errors
  const errors = ui.filter(ev => ev.act === 'powerup_apply_error');
  if (errors.length > 0) {
    console.log('  ── ERRORS:');
    errors.forEach(ev => console.log('    gt=' + gt(ev) + 's  ' + ev.id + ': ' + ev.error));
  }
}

function analyzeBossFights(s) {
  const bossSpawns = s.events.filter(ev => ev.cat === 'boss' && ev.act === 'spawn');
  const bossDeaths = s.events.filter(ev => ev.cat === 'boss' && ev.act === 'death');
  const bossDmg = s.events.filter(ev => ev.cat === 'boss' && ev.act === 'damage_taken');
  const phases = s.events.filter(ev => ev.cat === 'boss' && ev.act === 'phase_transition');
  if (bossSpawns.length === 0) return;

  console.log('\n═══ BOSS FIGHTS ═══');
  bossSpawns.forEach(sp => {
    const id = sp.bossId;
    const death = bossDeaths.find(d => d.bossId === id);
    const dmgs = bossDmg.filter(d => d.bossId === id);
    const totalD = dmgs.reduce((s, d) => s + (d.amount || 0), 0);
    const maxHp = dmgs[0]?.maxHp || '?';
    const spawnGt = gt(sp);
    const fight = death ? fmt(gt(death) - spawnGt) + 's' : 'alive';
    const dps = death ? fmt(totalD / Math.max(gt(death) - spawnGt, 1)) : '?';
    const ph = phases.filter(p => p.bossId === id);
    const phStr = ph.length > 0 ? '  phases: ' + ph.map(p => p.fromPhase + '→' + p.toPhase).join(',') : '';

    const snap = s.events.find(ev => ev.cat === 'balance' && ev.act === 'player_snapshot' && gt(ev) >= spawnGt - 5 && gt(ev) <= spawnGt + 15);
    const lvl = snap ? ' (L' + snap.level + ' DMG=' + snap.dmg + ')' : '';

    console.log('  ' + id.padEnd(28) + 'fight=' + fight.padStart(5) + '  HP=' + maxHp.toString().padStart(5) + '  DPS=' + dps.toString().padStart(4) + lvl + phStr);
  });
}

function analyzeLootDrops(s) {
  const loot = s.events.filter(ev => ev.cat === 'loot');
  const permStats = loot.filter(ev => ev.act === 'permanent_stat');
  if (loot.length === 0) return;

  console.log('\n═══ LOOT DROPS ═══');
  const byType = {};
  loot.forEach(ev => { const key = ev.act + (ev.itemId ? ':' + ev.itemId : ''); byType[key] = (byType[key] || 0) + 1; });
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
    console.log('  ' + key.padEnd(35) + count.toString().padStart(3));
  });
  if (permStats.length > 0) {
    console.log('  ── Permanent stat pickups:');
    permStats.forEach(ev => {
      console.log('    ' + gt(ev).toString().padStart(5) + 's  ' + ev.stat + ' ' + (ev.modType === 'mul' ? '+' + (ev.value * 100) + '%' : '+' + ev.value));
    });
  }
}

function analyzePerformance(s) {
  const perfs = s.events.filter(ev => ev.cat === 'perf' && ev.act === 'snapshot');
  if (perfs.length === 0) return;

  const fps = perfs.map(ev => ev.fps).filter(Boolean);
  const enemies = perfs.map(ev => ev.enemies || ev.enemiesActive || 0);
  const loot = perfs.map(ev => ev.loot || 0);
  const proj = perfs.map(ev => ev.projectiles || 0);

  console.log('\n═══ PERFORMANCE ═══');
  console.log('  FPS:         avg=' + fmt(fps.reduce((a, b) => a + b, 0) / fps.length) + '  min=' + fmt(Math.min(...fps)) + '  max=' + fmt(Math.max(...fps)));
  console.log('  Enemies:     peak=' + fmt(Math.max(...enemies)) + '  avg=' + fmt(enemies.reduce((a, b) => a + b, 0) / enemies.length));
  console.log('  Loot:        peak=' + fmt(Math.max(...loot)));
  console.log('  Projectiles: peak=' + fmt(Math.max(...proj)));

  const heap = perfs.map(ev => ev.heapMB).filter(Boolean);
  if (heap.length > 0) console.log('  Memory:      peak=' + fmt(Math.max(...heap)) + 'MB  avg=' + fmt(heap.reduce((a, b) => a + b, 0) / heap.length) + 'MB');

  // Dead zones (≤2 enemies for ≥10s of game time)
  let deadStart = null, deadZones = [];
  perfs.forEach(ev => {
    const g = gt(ev);
    if ((ev.enemies || ev.enemiesActive || 0) <= 2) { if (deadStart == null) deadStart = g; }
    else { if (deadStart != null) { const dur = g - deadStart; if (dur >= 10) deadZones.push({ start: deadStart, dur }); deadStart = null; } }
  });
  if (deadZones.length > 0) {
    console.log('  Dead zones (≤2 enemies ≥10s):');
    deadZones.forEach(z => console.log('    ' + z.start + 's for ' + z.dur + 's'));
  }
}

function analyzeEnemyDensity(s) {
  const perfs = s.events.filter(ev => ev.cat === 'perf' && ev.act === 'snapshot');
  if (perfs.length === 0) return;

  console.log('\n═══ ENEMY DENSITY TIMELINE ═══');
  const endSec = s.maxGt;
  for (let sec = 0; sec < endSec; sec += 30) {
    const p = perfs.find(ev => gt(ev) >= sec && gt(ev) < sec + 30);
    if (!p) continue;
    const enemies = p.enemies || p.enemiesActive || 0;
    console.log('  ' + sec.toString().padStart(5) + 's: ' + enemies.toString().padStart(3) + ' enemies  ' + bar(enemies, 80, 30));
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
  const all = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json')).sort();
  if (all.length === 0) { console.log('No sessions found in ' + SESSIONS_DIR); process.exit(1); }
  files = [resolve(SESSIONS_DIR, all[all.length - 1])];
}

for (const file of files) {
  if (!existsSync(file)) { console.log('File not found: ' + file); continue; }
  const session = loadSession(file);
  if (session.events.length < 10) continue;

  analyzeOverview(session);
  analyzeLevelProgression(session);
  analyzePlayerPowerCurve(session);
  analyzeKillAttribution(session);
  analyzeEnemySpawns(session);
  analyzeActivityTimeline(session);
  analyzeSurvivability(session);
  analyzePowerupPicks(session);
  analyzeUIEvents(session);
  analyzeBossFights(session);
  analyzeLootDrops(session);
  analyzePerformance(session);
  analyzeEnemyDensity(session);

  console.log('\n' + '═'.repeat(70) + '\n');
}
