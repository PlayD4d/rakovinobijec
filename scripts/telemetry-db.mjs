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

  // --- Combat ---
  const kills = events.filter(e => e.cat === 'kill');
  const playerHits = events.filter(e => e.cat === 'combat' && (e.act === 'player_hit_enemy' || e.act === 'player_hit_boss'));
  const playerDmg = events.filter(e => e.cat === 'player' && e.act === 'take_damage');
  const heals = events.filter(e => e.cat === 'player' && e.act === 'heal');
  const shieldAbs = events.filter(e => e.cat === 'shield' && e.act === 'absorbed');
  const contactDmg = events.filter(e => e.cat === 'collision' && e.act === 'contact_damage');
  const bulletHits = events.filter(e => e.cat === 'combat' && e.act === 'enemy_bullet_hit_player');

  const totalDealt = playerHits.reduce((s, e) => s + (e.damage || 0), 0);
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
  const totalXP = xpAdds.reduce((s, e) => s + (e.scaled || e.raw || 0), 0);
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
  const radioHits = events.filter(e => e.act === 'radiotherapy_hit').length;
  const chainHits = events.filter(e => e.act === 'chain_lightning_hit').length;
  const flameHits = events.filter(e => e.act === 'flamethrower_hit').length;
  const chemoHits = events.filter(e => e.act === 'chemo_cloud_hit').length;
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
  case 'list': listAll(); break;
  default: console.log(`Telemetry DB — Usage: import|summary|balance|compare|trends|tuning|list\nDB: ${DB_PATH}`);
}
db.close();
