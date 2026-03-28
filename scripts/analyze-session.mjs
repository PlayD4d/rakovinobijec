#!/usr/bin/env node
/**
 * Session Log Analyzer — Parses exported session JSON and prints diagnostics.
 *
 * Usage: node scripts/analyze-session.mjs <session.json>
 *        node scripts/analyze-session.mjs <session.json> --timeline
 *        node scripts/analyze-session.mjs <session.json> --spawns
 *        node scripts/analyze-session.mjs <session.json> --combat
 *        node scripts/analyze-session.mjs <session.json> --xp
 *        node scripts/analyze-session.mjs <session.json> --full
 */

import { readFileSync } from 'fs';

const file = process.argv[2];
if (!file) { console.log('Usage: node scripts/analyze-session.mjs <session.json> [--timeline|--spawns|--combat|--xp|--full]'); process.exit(1); }

const flags = new Set(process.argv.slice(3));
const showAll = flags.has('--full') || flags.size === 0;

const data = JSON.parse(readFileSync(file, 'utf-8'));
const events = data.events || [];
const meta = data.meta || {};

const fmt = (ms) => `${(ms/1000).toFixed(1)}s`;
const pad = (s, n) => String(s).padEnd(n);

// ============================================================
// OVERVIEW
// ============================================================
console.log('╔══════════════════════════════════════════════════════╗');
console.log(`║  Session: ${data.id || 'unknown'}`.padEnd(55) + '║');
console.log(`║  Duration: ${fmt(events.length ? events[events.length-1].t : 0)}  Status: ${meta.status || meta.result || '?'}`.padEnd(55) + '║');
console.log('╠══════════════════════════════════════════════════════╣');

const cats = {};
for (const e of events) {
    const key = `${e.cat}:${e.act}`;
    cats[key] = (cats[key] || 0) + 1;
}
console.log('║  Event counts:'.padEnd(55) + '║');
for (const [k, v] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
    console.log(`║    ${pad(k, 35)} ${String(v).padStart(5)}    ║`);
}
console.log('╚══════════════════════════════════════════════════════╝');

// ============================================================
// SPAWN ANALYSIS
// ============================================================
if (showAll || flags.has('--spawns')) {
    console.log('\n━━━ SPAWN ANALYSIS ━━━');

    const spawnTicks = events.filter(e => e.cat === 'spawn' && e.act === 'wave_tick');
    const waveSpawns = events.filter(e => e.cat === 'spawn' && e.act === 'wave_spawned');
    const eliteSpawns = events.filter(e => e.cat === 'spawn' && e.act === 'elite_spawned');
    const bossSpawns = events.filter(e => e.cat === 'spawn' && e.act === 'boss_spawn');
    const skips = events.filter(e => e.cat === 'spawn' && e.act?.startsWith('wave_skip'));
    const allSpawns = events.filter(e => e.cat === 'spawn' && e.act === 'enemy');

    console.log(`  Wave ticks logged: ${spawnTicks.length}`);
    console.log(`  Wave spawns: ${waveSpawns.length}`);
    console.log(`  Elite spawns: ${eliteSpawns.length}`);
    console.log(`  Boss spawns: ${bossSpawns.length}`);
    console.log(`  Skip events: ${skips.length}`);
    console.log(`  Total enemy spawns (session): ${allSpawns.length}`);

    if (spawnTicks.length > 0) {
        console.log('\n  Wave tick timeline (every 5s):');
        for (const tick of spawnTicks) {
            const gt = tick.gameTime ?? tick.t;
            console.log(`    [${fmt(tick.t)}] gameTime=${gt}s enemies=${tick.enemyCount}/${tick.maxEnemies} waves=${tick.waveCount}`);
        }
    }

    // Spawn gaps
    if (allSpawns.length > 1) {
        console.log('\n  Spawn gaps (>10s):');
        for (let i = 1; i < allSpawns.length; i++) {
            const gap = (allSpawns[i].t - allSpawns[i-1].t) / 1000;
            if (gap > 10) {
                console.log(`    ${fmt(allSpawns[i-1].t)} → ${fmt(allSpawns[i].t)} = ${gap.toFixed(0)}s gap`);
            }
        }
    }

    // Skip reasons
    if (skips.length > 0) {
        const skipReasons = {};
        for (const s of skips) { skipReasons[s.act] = (skipReasons[s.act] || 0) + 1; }
        console.log('\n  Skip reasons:', skipReasons);
    }
}

// ============================================================
// COMBAT ANALYSIS
// ============================================================
if (showAll || flags.has('--combat')) {
    console.log('\n━━━ COMBAT ANALYSIS ━━━');

    const dmgToPlayer = events.filter(e => e.cat === 'dmg' && e.tgt === 'player');
    const dmgFromPlayer = events.filter(e => e.cat === 'dmg' && e.src === 'player');
    const playerDmg = events.filter(e => e.cat === 'player' && e.act === 'damage_taken');
    const kills = events.filter(e => e.cat === 'kill');
    const collisions = events.filter(e => e.cat === 'collision');

    console.log(`  Damage dealt by player: ${dmgFromPlayer.length} hits, ${dmgFromPlayer.reduce((s,e) => s + (e.amt||0), 0)} total`);
    console.log(`  Damage taken by player: ${dmgToPlayer.length} hits, ${dmgToPlayer.reduce((s,e) => s + (e.amt||0), 0)} total`);
    console.log(`  Player damage events: ${playerDmg.length}`);
    console.log(`  Collision events: ${collisions.length}`);
    console.log(`  Total kills: ${kills.length}`);

    // Kill distribution
    const killTypes = {};
    for (const k of kills) { killTypes[k.target || '?'] = (killTypes[k.target || '?'] || 0) + 1; }
    console.log('  Kill distribution:', killTypes);

    // Player damage timeline
    if (dmgToPlayer.length > 0 || playerDmg.length > 0) {
        console.log('\n  Player damage timeline:');
        const allPdmg = [...dmgToPlayer, ...playerDmg].sort((a,b) => a.t - b.t);
        for (const e of allPdmg.slice(0, 20)) {
            console.log(`    [${fmt(e.t)}] ${e.src || e.source || '?'} → ${e.amt || e.finalAmount || '?'} dmg (HP: ${e.newHP ?? '?'})`);
        }
    }

    // Boss fight
    const bossDmg = events.filter(e => e.cat === 'dmg' && (e.tgt || '').includes('boss'));
    if (bossDmg.length > 0) {
        const totalBossDmg = bossDmg.reduce((s,e) => s + (e.amt||0), 0);
        const duration = (bossDmg[bossDmg.length-1].t - bossDmg[0].t) / 1000;
        console.log(`\n  Boss fight: ${totalBossDmg} damage over ${duration.toFixed(1)}s (DPS: ${(totalBossDmg/Math.max(duration,0.1)).toFixed(1)})`);
    }
}

// ============================================================
// XP / PROGRESSION
// ============================================================
if (showAll || flags.has('--xp')) {
    console.log('\n━━━ XP & PROGRESSION ━━━');

    const xpEvents = events.filter(e => e.cat === 'xp');
    const levelUps = events.filter(e => e.act === 'level_up');
    const powerups = events.filter(e => e.cat === 'powerup');
    const lootPickups = events.filter(e => e.cat === 'loot' && e.act === 'pickup');
    const lootCreated = events.filter(e => e.cat === 'loot' && e.act === 'drop_created');

    console.log(`  XP events: ${xpEvents.length}`);
    console.log(`  Loot created: ${lootCreated.length}`);
    console.log(`  Loot picked up: ${lootPickups.length}`);
    console.log(`  Level ups: ${levelUps.length}`);
    console.log(`  Powerups applied: ${powerups.length}`);

    // XP flow
    if (xpEvents.length > 0) {
        console.log('\n  XP flow:');
        for (const e of xpEvents.slice(0, 20)) {
            if (e.act === 'add') {
                console.log(`    [${fmt(e.t)}] +${e.raw ?? '?'}→${e.scaled ?? '?'} XP (total: ${e.totalXP ?? '?'}/${e.xpToNext ?? '?'})${e.willLevelUp ? ' ★LEVELUP' : ''}`);
            } else if (e.act === 'level_up') {
                console.log(`    [${fmt(e.t)}] ★ LEVEL ${e.newLevel} (next: ${e.xpToNext}, excess: ${e.excessXP})`);
            } else if (e.act === 'deferred') {
                console.log(`    [${fmt(e.t)}] ⏸ deferred ${e.deferredAmount} XP (pending: ${e.pendingTotal})`);
            }
        }
    }

    // Level up timeline
    if (levelUps.length > 0) {
        console.log('\n  Level up timeline:');
        for (let i = 0; i < levelUps.length; i++) {
            const e = levelUps[i];
            const dt = i > 0 ? ((e.t - levelUps[i-1].t)/1000).toFixed(1) : '-';
            console.log(`    [${fmt(e.t)}] → Level ${e.level} (delta: ${dt}s)`);
        }
    }

    // Powerup timeline
    if (powerups.length > 0) {
        console.log('\n  Powerups:');
        for (const e of powerups) {
            console.log(`    [${fmt(e.t)}] ${e.id} level=${e.level}`);
        }
    }

    // Loot pickup distribution
    if (lootPickups.length > 0) {
        const pickupTypes = {};
        for (const p of lootPickups) { pickupTypes[p.dropType || '?'] = (pickupTypes[p.dropType || '?'] || 0) + 1; }
        console.log('\n  Pickup distribution:', pickupTypes);
    }
}

// ============================================================
// FULL TIMELINE
// ============================================================
if (flags.has('--timeline') || flags.has('--full')) {
    console.log('\n━━━ FULL TIMELINE ━━━');
    for (const e of events) {
        const extra = Object.entries(e).filter(([k]) => !['t','cat','act'].includes(k)).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(' ');
        console.log(`  [${fmt(e.t)}] ${pad(e.cat,12)} ${pad(e.act,22)} ${extra}`);
    }
}

console.log(`\n✅ Analysis complete — ${events.length} events processed`);
