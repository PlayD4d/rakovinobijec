#!/usr/bin/env node
/**
 * Telemetry Analytics System — SQLite-backed game session analysis
 *
 * Usage:
 *   node scripts/telemetry-db.mjs import <session.json> [session2.json ...]
 *   node scripts/telemetry-db.mjs summary [sessionId]          # Latest or specific session
 *   node scripts/telemetry-db.mjs balance [sessionId]           # Deep balance analysis
 *   node scripts/telemetry-db.mjs compare <id1> <id2>           # Cross-session diff
 *   node scripts/telemetry-db.mjs trends [--last N]             # Metrics over time
 *   node scripts/telemetry-db.mjs tuning                        # Tuning recommendations
 *   node scripts/telemetry-db.mjs list                          # List all sessions
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const DB_PATH = resolve(import.meta.dirname, '..', 'data', 'telemetry.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================================
// SCHEMA
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    version TEXT,
    duration_ms INTEGER,
    result TEXT,
    started_at TEXT,
    imported_at TEXT DEFAULT (datetime('now')),
    event_count INTEGER,
    max_level INTEGER,
    max_player_level INTEGER,
    final_score INTEGER
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    t INTEGER NOT NULL,
    cat TEXT NOT NULL,
    act TEXT NOT NULL,
    data TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_cat_act ON events(session_id, cat, act);

  CREATE TABLE IF NOT EXISTS metrics (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    value REAL,
    detail TEXT,
    PRIMARY KEY (session_id, metric)
  );

  CREATE TABLE IF NOT EXISTS level_metrics (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,
    boss_id TEXT,
    duration_ms INTEGER,
    kills INTEGER,
    damage_dealt REAL,
    damage_taken REAL,
    healed REAL,
    xp_gained REAL,
    powerups_picked INTEGER,
    boss_fight_duration_ms INTEGER,
    boss_dps REAL,
    PRIMARY KEY (session_id, level)
  );

  CREATE TABLE IF NOT EXISTS powerup_picks (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    t INTEGER,
    powerup_id TEXT NOT NULL,
    level INTEGER
  );

  CREATE TABLE IF NOT EXISTS enemy_stats (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    enemy_id TEXT NOT NULL,
    spawned INTEGER DEFAULT 0,
    killed INTEGER DEFAULT 0,
    PRIMARY KEY (session_id, enemy_id)
  );

  CREATE TABLE IF NOT EXISTS perf_snapshots (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    t INTEGER NOT NULL,
    fps INTEGER,
    frame_ms INTEGER,
    enemies INTEGER,
    enemies_active INTEGER,
    projectiles INTEGER,
    loot INTEGER,
    heap_mb REAL
  );
`);

// ============================================================
// IMPORT
// ============================================================
function importSession(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const sid = data.id;
  const events = data.events || [];
  const meta = data.meta || {};

  if (db.prepare('SELECT id FROM sessions WHERE id = ?').get(sid)) {
    console.log(`Session ${sid} already imported, skipping.`);
    return sid;
  }

  const duration = events.length > 0 ? events[events.length - 1].t : 0;
  const levelUps = events.filter(e => e.cat === 'xp' && e.act === 'level_up');
  const transitions = events.filter(e => e.cat === 'game' && e.act === 'level_transition');
  const victory = events.find(e => e.act === 'victory_start');
  const maxPlayerLevel = levelUps.length > 0 ? Math.max(...levelUps.map(e => e.newLevel || 0)) : 1;
  const maxLevel = transitions.length > 0 ? Math.max(...transitions.map(e => e.to || 1)) : (victory?.level || 1);
  const result = meta.result || (victory ? 'victory' : meta.status || 'unknown');

  db.prepare(`INSERT INTO sessions (id, version, duration_ms, result, started_at, event_count, max_level, max_player_level, final_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(sid, meta.version, duration, result, meta.startedAt, events.length, maxLevel, maxPlayerLevel, victory?.score || 0);

  const insertEvent = db.prepare('INSERT INTO events (session_id, t, cat, act, data) VALUES (?, ?, ?, ?, ?)');
  db.transaction(() => {
    for (const e of events) {
      const { t, cat, act, ...rest } = e;
      insertEvent.run(sid, t, cat, act, Object.keys(rest).length > 0 ? JSON.stringify(rest) : null);
    }
  })();

  computeMetrics(sid, events);
  console.log(`Imported ${sid}: ${events.length} events, ${(duration/1000).toFixed(0)}s, result=${result}, gameLevel=${maxLevel}, playerLevel=${maxPlayerLevel}`);
  return sid;
}

// ============================================================
// METRICS
// ============================================================
function computeMetrics(sid, events) {
  const m = {};
  const duration = events.length > 0 ? events[events.length - 1].t - events[0].t : 0;
  const durationMin = duration / 60000;
  const insertMetric = db.prepare('INSERT OR REPLACE INTO metrics (session_id, metric, value, detail) VALUES (?, ?, ?, ?)');

  // Helper: sum values from events that may be aggregated (count + totalDmg/totalXP)
  const sumField = (evts, field) => evts.reduce((s, e) => s + (e[field] || e.totalDmg || 0), 0);
  const countEvents = (evts) => evts.reduce((s, e) => s + (e.count || 1), 0);

  // --- Combat ---
  const kills = events.filter(e => e.cat === 'kill');
  const playerHits = events.filter(e => e.cat === 'combat' && (e.act === 'player_hit_enemy' || e.act === 'player_hit_boss'));
  const playerDmg = events.filter(e => e.cat === 'player' && e.act === 'take_damage');
  const heals = events.filter(e => e.cat === 'player' && e.act === 'heal');
  const shieldAbs = events.filter(e => e.cat === 'shield' && e.act === 'absorbed');
  const contactDmg = events.filter(e => e.cat === 'collision' && e.act === 'contact_damage');
  const bulletHits = events.filter(e => e.cat === 'combat' && e.act === 'enemy_bullet_hit_player');

  // Support both old format (individual events) and new (aggregated with count/totalDmg)
  const totalDealt = playerHits.reduce((s, e) => s + (e.damage || e.totalDmg || 0), 0);
  const totalTaken = playerDmg.reduce((s, e) => s + (e.finalAmount || 0), 0);
  const totalHealed = heals.reduce((s, e) => s + (e.amount || 0), 0);
  const totalShield = shieldAbs.reduce((s, e) => s + (e.absorbed || 0), 0);
  const totalIncoming = totalTaken + totalShield;

  m['combat.kills'] = kills.length;
  m['combat.kills_per_min'] = durationMin > 0 ? kills.length / durationMin : 0;
  m['combat.damage_dealt'] = totalDealt;
  m['combat.dps'] = duration > 0 ? totalDealt / (duration / 1000) : 0;
  m['combat.damage_taken'] = totalTaken;
  m['combat.healed'] = totalHealed;
  m['combat.shield_absorbed'] = totalShield;
  m['combat.shield_efficiency'] = totalIncoming > 0 ? totalShield / totalIncoming : 0;
  m['combat.lowest_hp'] = playerDmg.length > 0 ? Math.min(...playerDmg.map(e => e.newHP).filter(v => v != null)) : 100;
  m['combat.contact_hits'] = contactDmg.length;
  m['combat.bullet_hits'] = bulletHits.length;

  // Shield detail
  m['shield.breaks'] = events.filter(e => e.cat === 'shield' && e.act === 'broken').length;
  m['shield.regens'] = events.filter(e => e.cat === 'shield' && e.act === 'regenerated').length;

  // --- Progression ---
  const levelUps = events.filter(e => e.cat === 'xp' && e.act === 'level_up');
  const xpAdds = events.filter(e => e.cat === 'xp' && e.act === 'add');
  const totalXP = xpAdds.reduce((s, e) => s + (e.scaled || e.raw || e.totalXP || 0), 0);
  m['progression.total_xp'] = totalXP;
  m['progression.xp_per_min'] = durationMin > 0 ? totalXP / durationMin : 0;
  m['progression.level_ups'] = levelUps.length;
  m['progression.max_level'] = levelUps.length > 0 ? Math.max(...levelUps.map(e => e.newLevel || 0)) : 1;
  if (levelUps.length > 1) {
    const deltas = [];
    for (let i = 1; i < levelUps.length; i++) deltas.push((levelUps[i].t - levelUps[i - 1].t) / 1000);
    m['progression.avg_level_time_s'] = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    m['progression.fastest_level_s'] = Math.min(...deltas);
    m['progression.slowest_level_s'] = Math.max(...deltas);
  }

  // --- Powerups ---
  const powerups = events.filter(e => e.cat === 'powerup' && e.act === 'applied');
  m['powerups.total'] = powerups.length;
  const pupCounts = {};
  for (const p of powerups) { pupCounts[p.id || '?'] = (pupCounts[p.id || '?'] || 0) + 1; }
  m['powerups.unique_types'] = Object.keys(pupCounts).length;
  insertMetric.run(sid, 'powerups.distribution', powerups.length, JSON.stringify(pupCounts));

  const insertPup = db.prepare('INSERT INTO powerup_picks (session_id, t, powerup_id, level) VALUES (?, ?, ?, ?)');
  for (const p of powerups) insertPup.run(sid, p.t, p.id || '?', p.level || 0);

  // --- Abilities (radiotherapy, chain lightning, flamethrower, chemo hits) ---
  // Support aggregated events (count field) from SessionLog v0.6.0+
  const radioHits = countEvents(events.filter(e => e.act === 'radiotherapy_hit'));
  const chainHits = countEvents(events.filter(e => e.act === 'chain_lightning_hit'));
  const flameHits = countEvents(events.filter(e => e.act === 'flamethrower_hit'));
  const chemoHits = countEvents(events.filter(e => e.act === 'chemo_cloud_hit'));
  m['abilities.radiotherapy_hits'] = radioHits;
  m['abilities.chain_lightning_hits'] = chainHits;
  m['abilities.flamethrower_hits'] = flameHits;
  m['abilities.chemo_cloud_hits'] = chemoHits;
  m['abilities.total_ability_hits'] = radioHits + chainHits + flameHits + chemoHits;
  m['abilities.ability_dps'] = duration > 0 ? (radioHits + chainHits + flameHits + chemoHits) / (duration / 1000) : 0;

  // --- Spawning ---
  const spawns = events.filter(e => e.cat === 'spawn' && e.act === 'enemy');
  m['spawn.total'] = spawns.length;
  m['spawn.per_min'] = durationMin > 0 ? spawns.length / durationMin : 0;
  m['spawn.elites'] = events.filter(e => e.cat === 'spawn' && e.act === 'elite_spawned').length;
  m['spawn.uniques'] = events.filter(e => e.cat === 'spawn' && e.act === 'unique_spawned').length;

  // Per-enemy stats
  const killsByType = {}, spawnsByType = {};
  for (const k of kills) killsByType[k.target || '?'] = (killsByType[k.target || '?'] || 0) + 1;
  for (const s of spawns) spawnsByType[s.id || '?'] = (spawnsByType[s.id || '?'] || 0) + 1;
  const insertEnemy = db.prepare('INSERT OR REPLACE INTO enemy_stats (session_id, enemy_id, spawned, killed) VALUES (?, ?, ?, ?)');
  const allIds = new Set([...Object.keys(killsByType), ...Object.keys(spawnsByType)]);
  for (const eid of allIds) insertEnemy.run(sid, eid, spawnsByType[eid] || 0, killsByType[eid] || 0);

  // --- Boss fights ---
  const bossSpawns = events.filter(e => e.cat === 'boss' && e.act === 'spawn');
  const bossDeaths = events.filter(e => e.cat === 'boss' && e.act === 'death');
  const bossDmg = events.filter(e => e.cat === 'boss' && e.act === 'damage_taken');
  m['boss.fights'] = bossSpawns.length;
  m['boss.kills'] = bossDeaths.length;

  const bossDetails = [];
  for (const sp of bossSpawns) {
    const death = bossDeaths.find(d => d.bossId === sp.bossId && d.t > sp.t);
    if (death) {
      const fightMs = death.t - sp.t;
      const hits = bossDmg.filter(d => d.bossId === sp.bossId && d.t >= sp.t && d.t <= death.t);
      const dmg = hits.reduce((s, e) => s + (e.amount || 0), 0);
      bossDetails.push({ bossId: sp.bossId, fightMs, dmg, dps: fightMs > 0 ? dmg / (fightMs / 1000) : 0, hits: hits.length });
    }
  }
  insertMetric.run(sid, 'boss.fights_detail', bossDetails.length, JSON.stringify(bossDetails));

  // --- Loot ---
  const tableDrops = events.filter(e => e.cat === 'loot' && e.act === 'table_drop');
  const merges = events.filter(e => e.act === 'xp_merged');
  const trims = events.filter(e => e.act === 'field_cap_trim');
  m['loot.special_drops'] = tableDrops.length;
  m['loot.special_per_min'] = durationMin > 0 ? tableDrops.length / durationMin : 0;
  m['loot.xp_merges'] = merges.reduce((s, e) => s + (e.merged || 0), 0);
  m['loot.field_cap_trims'] = trims.length;
  const lootBreak = {};
  for (const d of tableDrops) lootBreak[d.itemRef || '?'] = (lootBreak[d.itemRef || '?'] || 0) + 1;
  insertMetric.run(sid, 'loot.breakdown', tableDrops.length, JSON.stringify(lootBreak));

  // --- Enemy shooting ---
  const enemyShots = events.filter(e => e.cat === 'combat' && e.act === 'enemy_shoot');
  m['enemy.shots'] = enemyShots.length;
  m['enemy.accuracy'] = enemyShots.length > 0 ? bulletHits.length / enemyShots.length : 0;

  // --- Performance ---
  const perfSnaps = events.filter(e => e.cat === 'perf' && e.act === 'snapshot');
  if (perfSnaps.length > 0) {
    const fps = perfSnaps.map(e => e.fps).filter(v => v > 0).sort((a, b) => a - b);
    m['perf.fps_avg'] = fps.length > 0 ? fps.reduce((a, b) => a + b, 0) / fps.length : 0;
    m['perf.fps_min'] = fps.length > 0 ? fps[0] : 0;
    m['perf.fps_p5'] = fps.length > 0 ? fps[Math.max(0, Math.ceil(fps.length * 0.05) - 1)] : 0;
    m['perf.enemies_peak'] = Math.max(0, ...perfSnaps.map(e => e.enemies || 0));
    m['perf.projectiles_peak'] = Math.max(0, ...perfSnaps.map(e => e.projectiles || 0));
    m['perf.loot_peak'] = Math.max(0, ...perfSnaps.map(e => e.loot || 0));

    const insertPerf = db.prepare('INSERT INTO perf_snapshots (session_id, t, fps, frame_ms, enemies, enemies_active, projectiles, loot, heap_mb) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const s of perfSnaps) insertPerf.run(sid, s.t, s.fps, s.frameMs, s.enemies, s.enemiesActive, s.projectiles, s.loot, s.heapMB || null);
  }

  // --- Level metrics ---
  const gameTrans = events.filter(e => e.cat === 'game' && e.act === 'level_transition');
  const insertLevel = db.prepare(`INSERT OR REPLACE INTO level_metrics
    (session_id, level, boss_id, duration_ms, kills, xp_gained, powerups_picked, boss_fight_duration_ms, boss_dps)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let prevT = events.length > 0 ? events[0].t : 0;
  let curLevel = 1;
  for (const tr of gameTrans) {
    const lvlKills = kills.filter(k => k.t >= prevT && k.t < tr.t).length;
    const lvlXP = xpAdds.filter(x => x.t >= prevT && x.t < tr.t).reduce((s, e) => s + (e.scaled || 0), 0);
    const lvlPups = powerups.filter(p => p.t >= prevT && p.t < tr.t).length;
    const boss = bossDetails.find(b => bossSpawns.find(s => s.bossId === b.bossId && s.t >= prevT && s.t < tr.t));
    insertLevel.run(sid, curLevel, boss?.bossId || null, tr.t - prevT, lvlKills, lvlXP, lvlPups, boss?.fightMs || null, boss?.dps || null);
    prevT = tr.t;
    curLevel = tr.to || curLevel + 1;
  }

  // Store all numeric metrics
  for (const [key, val] of Object.entries(m)) {
    if (typeof val === 'number' && isFinite(val)) insertMetric.run(sid, key, val, null);
  }
}

// ============================================================
// REPORTS
// ============================================================
function getLatestId() {
  return db.prepare('SELECT id FROM sessions ORDER BY imported_at DESC LIMIT 1').get()?.id;
}

function getMetrics(sid) {
  const rows = db.prepare('SELECT metric, value, detail FROM metrics WHERE session_id = ?').all(sid);
  const m = {}, d = {};
  for (const r of rows) { m[r.metric] = r.value; if (r.detail) d[r.metric] = JSON.parse(r.detail); }
  return { m, d };
}

function fmt(v, dec = 0) { return v == null || !isFinite(v) ? '-' : Number(v).toFixed(dec); }
function pct(v) { return v == null || !isFinite(v) ? '-' : (v * 100).toFixed(1) + '%'; }

function printSummary(sid) {
  sid = sid || getLatestId();
  if (!sid) { console.log('No sessions. Import first.'); return; }
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
  if (!s) { console.log(`Session ${sid} not found.`); return; }
  const { m, d } = getMetrics(sid);

  console.log('\n' + '='.repeat(70));
  console.log(`SESSION: ${sid}  |  v${s.version}  |  ${fmt(s.duration_ms/1000)}s  |  ${s.result}`);
  console.log(`Player Level: ${s.max_player_level}  |  Game Level: ${s.max_level}  |  Score: ${s.final_score}`);
  console.log('='.repeat(70));

  console.log('\n--- COMBAT ---');
  console.log(`  Kills: ${fmt(m['combat.kills'])} (${fmt(m['combat.kills_per_min'],1)}/min)  |  DPS: ${fmt(m['combat.dps'],1)}`);
  console.log(`  Damage dealt: ${fmt(m['combat.damage_dealt'])}  |  Taken: ${fmt(m['combat.damage_taken'])}  |  Healed: ${fmt(m['combat.healed'])}  |  Shield: ${fmt(m['combat.shield_absorbed'])}`);
  console.log(`  Shield eff: ${pct(m['combat.shield_efficiency'])}  |  Lowest HP: ${fmt(m['combat.lowest_hp'])}  |  Contact: ${fmt(m['combat.contact_hits'])}  |  Bullet: ${fmt(m['combat.bullet_hits'])}`);

  console.log('\n--- ABILITIES ---');
  console.log(`  Radiotherapy: ${fmt(m['abilities.radiotherapy_hits'])} hits  |  Chain Lightning: ${fmt(m['abilities.chain_lightning_hits'])}  |  Flamethrower: ${fmt(m['abilities.flamethrower_hits'])}  |  Chemo: ${fmt(m['abilities.chemo_cloud_hits'])}`);

  console.log('\n--- PROGRESSION ---');
  console.log(`  XP: ${fmt(m['progression.total_xp'])} (${fmt(m['progression.xp_per_min'],1)}/min)  |  Level-ups: ${fmt(m['progression.level_ups'])}  |  Avg: ${fmt(m['progression.avg_level_time_s'],1)}s`);

  console.log('\n--- POWERUPS ---');
  if (d['powerups.distribution']) {
    for (const [id, n] of Object.entries(d['powerups.distribution']).sort((a, b) => b[1] - a[1])) console.log(`    ${id}: ${n}x`);
  }

  console.log('\n--- BOSS FIGHTS ---');
  if (d['boss.fights_detail']) {
    for (const b of d['boss.fights_detail']) console.log(`  ${b.bossId}: ${(b.fightMs/1000).toFixed(1)}s, ${b.hits} hits, ${fmt(b.dmg)} dmg, ${fmt(b.dps,0)} DPS`);
  }

  console.log('\n--- LOOT ---');
  console.log(`  Special: ${fmt(m['loot.special_drops'])} (${fmt(m['loot.special_per_min'],1)}/min)  |  XP merges: ${fmt(m['loot.xp_merges'])}  |  Trims: ${fmt(m['loot.field_cap_trims'])}`);

  console.log('\n--- PERFORMANCE ---');
  console.log(`  FPS: avg=${fmt(m['perf.fps_avg'],0)} min=${fmt(m['perf.fps_min'],0)} p5=${fmt(m['perf.fps_p5'],0)}  |  Peaks: enemies=${fmt(m['perf.enemies_peak'])} proj=${fmt(m['perf.projectiles_peak'])} loot=${fmt(m['perf.loot_peak'])}`);
}

function printBalance(sid) {
  sid = sid || getLatestId();
  if (!sid) { console.log('No sessions.'); return; }
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
  const { m, d } = getMetrics(sid);
  const enemies = db.prepare('SELECT * FROM enemy_stats WHERE session_id = ? ORDER BY killed DESC').all(sid);
  const levels = db.prepare('SELECT * FROM level_metrics WHERE session_id = ? ORDER BY level').all(sid);

  console.log('\n' + '='.repeat(70));
  console.log(`BALANCE REPORT: ${sid}  |  ${fmt(s.duration_ms/1000)}s  |  ${s.result}`);
  console.log('='.repeat(70));

  // Difficulty flags
  console.log('\n--- DIFFICULTY FLAGS ---');
  const flags = [];
  const hp = m['combat.lowest_hp'] ?? 100;
  if (hp > 70) flags.push(`TOO EASY: HP never below ${fmt(hp)} — increase enemy damage or nerf shield`);
  else if (hp > 50) flags.push(`SLIGHTLY EASY: Lowest HP ${fmt(hp)}`);
  else if (hp < 15) flags.push(`VERY HARD: Nearly died (HP ${fmt(hp)})`);
  if ((m['combat.shield_efficiency'] || 0) > 0.85) flags.push(`SHIELD OP: ${pct(m['combat.shield_efficiency'])} absorption`);
  if ((m['combat.kills_per_min'] || 0) > 300) flags.push(`HIGH KILL RATE: ${fmt(m['combat.kills_per_min'],0)}/min — enemies too weak?`);
  if ((m['loot.special_per_min'] || 0) > 15) flags.push(`LOOT FLOOD: ${fmt(m['loot.special_per_min'],1)} special/min`);
  if ((m['enemy.accuracy'] || 0) < 0.03 && (m['enemy.shots'] || 0) > 100) flags.push(`ENEMY AIM: ${pct(m['enemy.accuracy'])} accuracy — projectiles too slow?`);
  if (flags.length === 0) flags.push('BALANCED: No major flags');
  for (const f of flags) console.log(`  ${f}`);

  // Enemy breakdown
  console.log('\n--- ENEMIES ---');
  console.log('  ' + 'Type'.padEnd(30) + 'Spawn'.padStart(7) + 'Kill'.padStart(7) + 'Rate'.padStart(7));
  for (const e of enemies.slice(0, 15)) {
    const rate = e.spawned > 0 ? ((e.killed / e.spawned) * 100).toFixed(0) + '%' : '-';
    console.log('  ' + e.enemy_id.padEnd(30) + String(e.spawned).padStart(7) + String(e.killed).padStart(7) + rate.padStart(7));
  }

  // Levels
  if (levels.length > 0) {
    console.log('\n--- LEVELS ---');
    console.log('  ' + 'Lvl'.padEnd(5) + 'Boss'.padEnd(25) + 'Time'.padStart(7) + 'Kills'.padStart(7) + 'XP'.padStart(7) + 'Pups'.padStart(5) + 'BossT'.padStart(7) + 'DPS'.padStart(7));
    for (const l of levels) {
      console.log('  ' + String(l.level).padEnd(5) + (l.boss_id || '-').padEnd(25)
        + (fmt(l.duration_ms / 1000) + 's').padStart(7) + String(l.kills || 0).padStart(7) + fmt(l.xp_gained).padStart(7)
        + String(l.powerups_picked || 0).padStart(5) + (l.boss_fight_duration_ms ? fmt(l.boss_fight_duration_ms / 1000) + 's' : '-').padStart(7)
        + (l.boss_dps ? fmt(l.boss_dps, 0) : '-').padStart(7));
    }
  }

  // Tuning suggestions
  console.log('\n--- SUGGESTIONS ---');
  if (hp > 70) console.log('  -> Increase enemyDamageMultiplier or reduce shield HP');
  if ((m['combat.shield_efficiency'] || 0) > 0.85) console.log('  -> Increase shieldRechargeTime or reduce baseShieldHP');
  if ((m['combat.kills_per_min'] || 0) > 300) console.log('  -> Increase enemyHpMultiplier or hpGrowth in spawn tables');
  if ((m['loot.special_per_min'] || 0) > 15) console.log('  -> Reduce normal loot table drop chances');
  if ((m['enemy.accuracy'] || 0) < 0.03 && (m['enemy.shots'] || 0) > 100) console.log('  -> Increase enemy projectile speed in blueprints');
  const abilTotal = m['abilities.total_ability_hits'] || 0;
  const projHits = playerHitsCount(sid);
  if (abilTotal > projHits * 2) console.log('  -> Abilities deal more hits than projectiles — may overshadow base weapon');
}

function playerHitsCount(sid) {
  const row = db.prepare("SELECT COUNT(*) as c FROM events WHERE session_id = ? AND cat = 'combat' AND act = 'player_hit_enemy'").get(sid);
  return row?.c || 0;
}

function printTrends(n) {
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY imported_at DESC LIMIT ?').all(n);
  if (sessions.length === 0) { console.log('No sessions.'); return; }

  console.log('\n' + '='.repeat(100));
  console.log('TRENDS (last ' + sessions.length + ')');
  console.log('='.repeat(100));
  console.log('  ' + 'Session'.padEnd(16) + 'Ver'.padEnd(8) + 'Dur'.padStart(6) + 'Result'.padStart(10) + 'PLvl'.padStart(5) + 'GLvl'.padStart(5)
    + 'K/min'.padStart(7) + 'DPS'.padStart(7) + 'LowHP'.padStart(6) + 'Shield'.padStart(8) + 'Loot/m'.padStart(7) + 'FPS_min'.padStart(8));

  for (const s of sessions.reverse()) {
    const { m } = getMetrics(s.id);
    console.log('  ' + s.id.padEnd(16) + (s.version || '?').padEnd(8) + (fmt(s.duration_ms / 1000) + 's').padStart(6)
      + (s.result || '?').padStart(10) + String(s.max_player_level || '?').padStart(5) + String(s.max_level || '?').padStart(5)
      + fmt(m['combat.kills_per_min'], 0).padStart(7) + fmt(m['combat.dps'], 0).padStart(7) + fmt(m['combat.lowest_hp'], 0).padStart(6)
      + pct(m['combat.shield_efficiency']).padStart(8) + fmt(m['loot.special_per_min'], 1).padStart(7) + fmt(m['perf.fps_min'], 0).padStart(8));
  }

  // Powerup popularity
  const pups = db.prepare(`SELECT powerup_id, COUNT(*) as c FROM powerup_picks
    WHERE session_id IN (SELECT id FROM sessions ORDER BY imported_at DESC LIMIT ?) GROUP BY powerup_id ORDER BY c DESC`).all(n);
  if (pups.length > 0) {
    console.log('\n--- POWERUP POPULARITY ---');
    for (const p of pups) console.log(`  ${p.powerup_id}: ${p.c} picks`);
  }
}

function compareSessions(id1, id2) {
  const { m: m1 } = getMetrics(id1);
  const { m: m2 } = getMetrics(id2);
  if (!Object.keys(m1).length) { console.log(`Session ${id1} not found.`); return; }
  if (!Object.keys(m2).length) { console.log(`Session ${id2} not found.`); return; }

  console.log('\n' + '='.repeat(70));
  console.log(`COMPARE: ${id1} vs ${id2}`);
  console.log('='.repeat(70));
  console.log('  ' + 'Metric'.padEnd(35) + id1.slice(0, 12).padStart(12) + id2.slice(0, 12).padStart(12) + 'Delta'.padStart(10));
  const keys = [...new Set([...Object.keys(m1), ...Object.keys(m2)])].sort();
  for (const k of keys) {
    const v1 = m1[k] ?? 0, v2 = m2[k] ?? 0, d = v2 - v1;
    console.log('  ' + k.padEnd(35) + fmt(v1, 1).padStart(12) + fmt(v2, 1).padStart(12) + ((d > 0 ? '+' : '') + fmt(d, 1)).padStart(10));
  }
}

function listAll() {
  const rows = db.prepare('SELECT id, version, duration_ms, result, max_player_level, max_level, event_count, imported_at FROM sessions ORDER BY imported_at DESC').all();
  if (!rows.length) { console.log('No sessions.'); return; }
  console.log('\n' + 'ID'.padEnd(16) + 'Ver'.padEnd(9) + 'Dur'.padStart(8) + 'Result'.padStart(10) + 'PLvl'.padStart(6) + 'GLvl'.padStart(6) + 'Events'.padStart(8) + '  Imported');
  for (const s of rows) {
    console.log(s.id.padEnd(16) + (s.version || '?').padEnd(9) + (fmt(s.duration_ms / 1000) + 's').padStart(8) + (s.result || '?').padStart(10)
      + String(s.max_player_level || '?').padStart(6) + String(s.max_level || '?').padStart(6) + String(s.event_count).padStart(8) + '  ' + (s.imported_at || ''));
  }
}

// ============================================================
// DETAILS — Deep breakdown for game design tuning
// ============================================================
function printDetails(sid) {
  sid = sid || getLatestId();
  if (!sid) { console.log('No sessions.'); return; }
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
  const events = db.prepare('SELECT t, cat, act, data FROM events WHERE session_id = ?').all(sid);
  const parsed = events.map(e => ({ t: e.t, cat: e.cat, act: e.act, ...(e.data ? JSON.parse(e.data) : {}) }));
  const dur = s.duration_ms / 1000;
  const durMin = dur / 60;

  console.log('\n' + '='.repeat(80));
  console.log(`DETAILED ANALYSIS: ${sid}  |  ${fmt(dur)}s  |  ${s.result}  |  Player Lvl ${s.max_player_level}`);
  console.log('='.repeat(80));

  // ---- PLAYER WEAPON DPS ----
  console.log('\n--- PLAYER WEAPON & ABILITIES DPS ---');
  const playerHits = parsed.filter(e => e.cat === 'combat' && e.act === 'player_hit_enemy');
  const bossHits = parsed.filter(e => e.cat === 'combat' && e.act === 'player_hit_boss');
  const radioHits = parsed.filter(e => e.act === 'radiotherapy_hit');
  const chainHits = parsed.filter(e => e.act === 'chain_lightning_hit');
  const flameHits = parsed.filter(e => e.act === 'flamethrower_hit');
  const chemoHits = parsed.filter(e => e.act === 'chemo_cloud_hit');

  const weaponDmg = [...playerHits, ...bossHits].reduce((s, e) => s + (e.damage || e.totalDmg || 0), 0);
  const radioDmg = radioHits.reduce((s, e) => s + (e.damage || e.totalDmg || 0), 0);
  const chainDmg = chainHits.reduce((s, e) => s + (e.damage || e.totalDmg || 0), 0);
  const flameDmg = flameHits.reduce((s, e) => s + (e.damage || e.totalDmg || 0), 0);
  const chemoDmg = chemoHits.reduce((s, e) => s + (e.damage || e.totalDmg || 0), 0);
  const totalPlayerDmg = weaponDmg + radioDmg + chainDmg + flameDmg + chemoDmg;

  const weaponHitCount = [...playerHits, ...bossHits].reduce((s, e) => s + (e.count || 1), 0);
  const radioCount = radioHits.reduce((s, e) => s + (e.count || 1), 0);
  const chainCount = chainHits.reduce((s, e) => s + (e.count || 1), 0);
  const flameCount = flameHits.reduce((s, e) => s + (e.count || 1), 0);
  const chemoCount = chemoHits.reduce((s, e) => s + (e.count || 1), 0);

  const sources = [
    { name: 'Projectiles (weapon)', hits: weaponHitCount, dmg: weaponDmg },
    { name: 'Radiotherapy', hits: radioCount, dmg: radioDmg },
    { name: 'Chain Lightning', hits: chainCount, dmg: chainDmg },
    { name: 'Flamethrower', hits: flameCount, dmg: flameDmg },
    { name: 'Chemo Cloud', hits: chemoCount, dmg: chemoDmg },
  ];
  console.log('  ' + 'Source'.padEnd(25) + 'Hits'.padStart(8) + 'Damage'.padStart(10) + 'DPS'.padStart(8) + 'Avg/Hit'.padStart(9) + 'Share'.padStart(8));
  for (const src of sources) {
    if (src.hits === 0) continue;
    const share = totalPlayerDmg > 0 ? (src.dmg / totalPlayerDmg * 100) : 0;
    console.log('  ' + src.name.padEnd(25) + fmt(src.hits).padStart(8) + fmt(src.dmg).padStart(10)
      + fmt(dur > 0 ? src.dmg / dur : 0, 1).padStart(8) + fmt(src.hits > 0 ? src.dmg / src.hits : 0, 1).padStart(9)
      + (fmt(share, 1) + '%').padStart(8));
  }
  console.log('  ' + '─'.repeat(68));
  console.log('  ' + 'TOTAL'.padEnd(25) + fmt(weaponHitCount + radioCount + chainCount + flameCount + chemoCount).padStart(8)
    + fmt(totalPlayerDmg).padStart(10) + fmt(dur > 0 ? totalPlayerDmg / dur : 0, 1).padStart(8));

  // ---- ENEMY DAMAGE TO PLAYER ----
  console.log('\n--- ENEMY DAMAGE TO PLAYER ---');
  const contactDmg = parsed.filter(e => e.cat === 'collision' && e.act === 'contact_damage');
  const bulletHitPlayer = parsed.filter(e => e.cat === 'combat' && e.act === 'enemy_bullet_hit_player');
  const shieldAbs = parsed.filter(e => e.cat === 'shield' && e.act === 'absorbed');
  const playerTakeDmg = parsed.filter(e => e.cat === 'player' && e.act === 'take_damage');

  const contactTotal = contactDmg.reduce((s, e) => s + (e.damage || 0), 0);
  const bulletTotal = bulletHitPlayer.reduce((s, e) => s + (e.damage || 0), 0);
  const shieldTotal = shieldAbs.reduce((s, e) => s + (e.absorbed || 0), 0);
  const hpDmgTotal = playerTakeDmg.reduce((s, e) => s + (e.finalAmount || 0), 0);

  console.log(`  Contact damage: ${contactDmg.length} hits, ${fmt(contactTotal)} raw dmg`);
  console.log(`  Bullet damage:  ${bulletHitPlayer.length} hits, ${fmt(bulletTotal)} raw dmg`);
  console.log(`  Shield absorbed: ${fmt(shieldTotal)} (${shieldAbs.length} absorptions)`);
  console.log(`  HP damage taken: ${fmt(hpDmgTotal)}`);
  console.log(`  Shield efficiency: ${pct(shieldTotal / Math.max(shieldTotal + hpDmgTotal, 1))}`);

  // Enemy damage by type (from contact_damage events)
  const dmgByEnemy = {};
  for (const e of contactDmg) {
    const eid = e.enemyId || '?';
    if (!dmgByEnemy[eid]) dmgByEnemy[eid] = { hits: 0, dmg: 0 };
    dmgByEnemy[eid].hits++;
    dmgByEnemy[eid].dmg += e.damage || 0;
  }
  if (Object.keys(dmgByEnemy).length > 0) {
    console.log('\n  Contact damage by enemy type:');
    for (const [eid, d] of Object.entries(dmgByEnemy).sort((a, b) => b[1].dmg - a[1].dmg)) {
      console.log('    ' + eid.padEnd(30) + fmt(d.hits).padStart(5) + ' hits  ' + fmt(d.dmg).padStart(6) + ' dmg');
    }
  }

  // ---- ENEMY SHOOTING ----
  console.log('\n--- ENEMY SHOOTING ---');
  const enemyShots = parsed.filter(e => e.cat === 'combat' && e.act === 'enemy_shoot');
  const shooterTypes = {};
  for (const e of enemyShots) {
    const eid = e.enemyId || '?';
    shooterTypes[eid] = (shooterTypes[eid] || 0) + 1;
  }
  console.log(`  Total shots: ${enemyShots.length} (${fmt(enemyShots.length / durMin, 1)}/min)`);
  console.log(`  Hit player: ${bulletHitPlayer.length} (${pct(bulletHitPlayer.length / Math.max(enemyShots.length, 1))} accuracy)`);
  console.log('\n  Shots by enemy type:');
  for (const [eid, count] of Object.entries(shooterTypes).sort((a, b) => b[1] - a[1])) {
    console.log('    ' + eid.padEnd(30) + fmt(count).padStart(6) + ' shots');
  }

  // ---- SPAWN RATES PER LEVEL ----
  console.log('\n--- SPAWN RATES BY LEVEL ---');
  const transitions = parsed.filter(e => e.cat === 'game' && e.act === 'level_transition');
  const spawns = parsed.filter(e => e.cat === 'spawn' && e.act === 'enemy');
  let boundaries = [{ t: parsed[0]?.t || 0, level: 1 }];
  for (const tr of transitions) boundaries.push({ t: tr.t, level: tr.to || boundaries.length + 1 });
  boundaries.push({ t: s.duration_ms, level: -1 });

  console.log('  ' + 'Level'.padEnd(7) + 'Duration'.padStart(9) + 'Spawns'.padStart(8) + 'Spawn/m'.padStart(9)
    + 'Kills'.padStart(7) + 'Kill/m'.padStart(8) + 'K/D%'.padStart(7));
  const kills = parsed.filter(e => e.cat === 'kill');
  for (let i = 0; i < boundaries.length - 1; i++) {
    const from = boundaries[i].t, to = boundaries[i + 1].t;
    const lvl = boundaries[i].level;
    const lvlDur = (to - from) / 1000;
    const lvlDurMin = lvlDur / 60;
    const lvlSpawns = spawns.filter(e => e.t >= from && e.t < to).length;
    const lvlKills = kills.filter(e => e.t >= from && e.t < to).length;
    const killRate = lvlSpawns > 0 ? (lvlKills / lvlSpawns * 100) : 0;
    console.log('  ' + String(lvl).padEnd(7) + (fmt(lvlDur) + 's').padStart(9) + fmt(lvlSpawns).padStart(8)
      + fmt(lvlDurMin > 0 ? lvlSpawns / lvlDurMin : 0, 1).padStart(9)
      + fmt(lvlKills).padStart(7) + fmt(lvlDurMin > 0 ? lvlKills / lvlDurMin : 0, 1).padStart(8)
      + (fmt(killRate, 0) + '%').padStart(7));
  }

  // ---- POWERUP TIMELINE ----
  console.log('\n--- POWERUP PICK TIMELINE ---');
  const pups = parsed.filter(e => e.cat === 'powerup' && e.act === 'applied');
  const pupSummary = {};
  for (const p of pups) {
    const id = p.id || '?';
    if (!pupSummary[id]) pupSummary[id] = { picks: 0, maxLevel: 0, firstPick: p.t };
    pupSummary[id].picks++;
    pupSummary[id].maxLevel = Math.max(pupSummary[id].maxLevel, p.level || 0);
  }
  console.log('  ' + 'Powerup'.padEnd(30) + 'Picks'.padStart(6) + 'MaxLvl'.padStart(7) + 'First@'.padStart(8));
  for (const [id, info] of Object.entries(pupSummary).sort((a, b) => b[1].picks - a[1].picks)) {
    console.log('  ' + id.padEnd(30) + fmt(info.picks).padStart(6) + fmt(info.maxLevel).padStart(7)
      + (fmt(info.firstPick / 1000) + 's').padStart(8));
  }

  // ---- XP PROGRESSION CURVE ----
  console.log('\n--- XP PROGRESSION ---');
  const levelUps = parsed.filter(e => e.cat === 'xp' && e.act === 'level_up');
  if (levelUps.length > 0) {
    // Show level-up cadence in 5-level chunks
    console.log('  ' + 'Levels'.padEnd(12) + 'Time range'.padStart(16) + 'Avg/level'.padStart(11));
    for (let i = 0; i < levelUps.length; i += 5) {
      const chunk = levelUps.slice(i, i + 5);
      const first = chunk[0], last = chunk[chunk.length - 1];
      const startLvl = first.newLevel || (i + 2);
      const endLvl = last.newLevel || (i + chunk.length + 1);
      const chunkDur = (last.t - first.t) / 1000;
      const avg = chunk.length > 1 ? chunkDur / (chunk.length - 1) : 0;
      console.log('  ' + `${startLvl}-${endLvl}`.padEnd(12)
        + `${fmt(first.t / 1000)}s - ${fmt(last.t / 1000)}s`.padStart(16)
        + (fmt(avg, 1) + 's').padStart(11));
    }
  }

  // ---- BOSS FIGHT DETAILS ----
  console.log('\n--- BOSS FIGHTS ---');
  const bossSpawns = parsed.filter(e => e.cat === 'boss' && e.act === 'spawn');
  const bossDeaths = parsed.filter(e => e.cat === 'boss' && e.act === 'death');
  const bossDmgEvents = parsed.filter(e => e.cat === 'boss' && e.act === 'damage_taken');
  const bossAbilities = parsed.filter(e => e.cat === 'boss' && e.act === 'ability_used');
  const bossPhases = parsed.filter(e => e.cat === 'boss' && e.act === 'phase_transition');

  for (const sp of bossSpawns) {
    const death = bossDeaths.find(d => d.bossId === sp.bossId && d.t > sp.t);
    const fightEnd = death ? death.t : s.duration_ms;
    const fightDur = (fightEnd - sp.t) / 1000;
    const hits = bossDmgEvents.filter(e => e.bossId === sp.bossId && e.t >= sp.t && e.t <= fightEnd);
    const dmg = hits.reduce((s, e) => s + (e.amount || 0), 0);
    const abilities = bossAbilities.filter(e => e.bossId === sp.bossId && e.t >= sp.t && e.t <= fightEnd);
    const phases = bossPhases.filter(e => e.bossId === sp.bossId && e.t >= sp.t && e.t <= fightEnd);

    console.log(`\n  ${sp.bossId} (${fmt(sp.t / 1000)}s - ${fmt(fightEnd / 1000)}s) ${death ? 'KILLED' : 'SURVIVED'}`);
    console.log(`    Duration: ${fmt(fightDur)}s | Hits: ${hits.length} | Damage: ${fmt(dmg)} | DPS: ${fmt(fightDur > 0 ? dmg / fightDur : 0, 1)}`);
    console.log(`    Abilities used: ${abilities.length} | Phase transitions: ${phases.length}`);

    // Ability breakdown
    const abilTypes = {};
    for (const a of abilities) { abilTypes[a.abilityId || '?'] = (abilTypes[a.abilityId || '?'] || 0) + 1; }
    if (Object.keys(abilTypes).length > 0) {
      console.log('    Ability usage: ' + Object.entries(abilTypes).map(([k, v]) => `${k}(${v})`).join(', '));
    }
  }

  // ---- LOOT DROPS ----
  console.log('\n--- LOOT DROPS ---');
  const tableDrops = parsed.filter(e => e.cat === 'loot' && e.act === 'table_drop');
  const lootItems = {};
  for (const d of tableDrops) {
    const ref = d.itemRef || '?';
    lootItems[ref] = (lootItems[ref] || 0) + 1;
  }
  console.log(`  Total special drops: ${tableDrops.length} (${fmt(tableDrops.length / durMin, 1)}/min)`);
  console.log('  ' + 'Item'.padEnd(30) + 'Count'.padStart(6) + '/min'.padStart(7));
  for (const [item, count] of Object.entries(lootItems).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + item.padEnd(30) + fmt(count).padStart(6) + fmt(count / durMin, 2).padStart(7));
  }

  // ---- PERFORMANCE ----
  console.log('\n--- PERFORMANCE ---');
  const perfSnaps = parsed.filter(e => e.cat === 'perf' && e.act === 'snapshot');
  if (perfSnaps.length > 0) {
    const fpsArr = perfSnaps.map(e => e.fps).filter(v => v > 0).sort((a, b) => a - b);
    const enemyArr = perfSnaps.map(e => e.enemies || 0);
    const projArr = perfSnaps.map(e => e.projectiles || 0);
    const lootArr = perfSnaps.map(e => e.loot || 0);
    console.log(`  FPS:  avg=${fmt(fpsArr.reduce((a, b) => a + b, 0) / fpsArr.length, 0)}  min=${fpsArr[0]}  p5=${fpsArr[Math.max(0, Math.ceil(fpsArr.length * 0.05) - 1)]}`);
    console.log(`  Enemies:  avg=${fmt(enemyArr.reduce((a, b) => a + b, 0) / enemyArr.length, 0)}  peak=${Math.max(...enemyArr)}`);
    console.log(`  Projectiles:  avg=${fmt(projArr.reduce((a, b) => a + b, 0) / projArr.length, 0)}  peak=${Math.max(...projArr)}`);
    console.log(`  Loot on field:  avg=${fmt(lootArr.reduce((a, b) => a + b, 0) / lootArr.length, 0)}  peak=${Math.max(...lootArr)}`);

    // FPS dips
    const dips = perfSnaps.filter(e => e.fps < 55);
    if (dips.length > 0) {
      console.log(`\n  FPS dips (<55): ${dips.length} snapshots`);
      for (const d of dips.slice(0, 5)) {
        console.log(`    [${fmt(d.t / 1000)}s] ${d.fps} FPS | enemies=${d.enemies} proj=${d.projectiles} loot=${d.loot}`);
      }
    }
  }
}

// ============================================================
// PRUNE — keep only N most recent sessions, cascade-delete the rest
// ============================================================
function pruneSessions(keep = 10) {
  const total = db.prepare('SELECT COUNT(*) as c FROM sessions').get().c;
  if (total <= keep) {
    console.log(`DB has ${total} sessions (limit ${keep}) — nothing to prune.`);
    return;
  }
  // Find IDs to delete (oldest first, skip the N newest)
  const toDelete = db.prepare(
    'SELECT id FROM sessions ORDER BY imported_at DESC LIMIT -1 OFFSET ?'
  ).all(keep);
  const deleteStmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  const tx = db.transaction(() => {
    for (const row of toDelete) deleteStmt.run(row.id);
  });
  tx();
  console.log(`🗑️  Pruned ${toDelete.length} old sessions (kept ${keep} newest, DB had ${total}).`);
}

// ============================================================
// CLI
// ============================================================
const [,, cmd, ...args] = process.argv;
switch (cmd) {
  case 'import':
    if (!args.length) { console.log('Usage: telemetry-db.mjs import <file.json> [...]'); break; }
    for (const f of args) { if (existsSync(f)) { try { importSession(f); } catch (e) { console.error('Error:', e.message); } } else console.log('Not found:', f); }
    break;
  case 'summary': printSummary(args[0]); break;
  case 'balance': printBalance(args[0]); break;
  case 'compare': args.length >= 2 ? compareSessions(args[0], args[1]) : console.log('Usage: compare <id1> <id2>'); break;
  case 'trends': printTrends(args.includes('--last') ? parseInt(args[args.indexOf('--last') + 1]) || 10 : 10); break;
  case 'tuning': printBalance(); break;
  case 'details': printDetails(args[0]); break;
  case 'list': listAll(); break;
  case 'prune': pruneSessions(parseInt(args[0]) || 10); break;
  default: console.log(`Telemetry DB — Usage: import|summary|balance|compare|trends|details|list|prune [N]\nDB: ${DB_PATH}`);
}
db.close();
