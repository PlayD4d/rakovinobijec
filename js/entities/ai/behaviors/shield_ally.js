/**
 * Shield Ally behavior — support cell that orbits near other enemies and grants them damage reduction.
 * Inspired by tumor microenvironment: stromal cells that protect cancer cells from immune attack.
 *
 * Seeks nearest non-shielded enemy, orbits it, and shows a persistent shield aura.
 * Pure function, no Phaser API.
 */
export function shield_ally(cap, cfg, dt, mem, setState) {
    const pos = cap.getPos();
    const speed = cfg.speed || 70;
    const orbitRadius = cfg.orbitRadius || 50;
    const orbitSpeed = cfg.orbitSpeed || 2.0;
    const buffInterval = cfg.buffInterval || 2000;
    const buffRange = cfg.buffRange || 80;

    if (!mem.shieldAlly) {
        mem.shieldAlly = { angle: Math.random() * Math.PI * 2, lastBuff: 0, lastAura: 0, targetX: 0, targetY: 0, hasTarget: false };
    }
    const s = mem.shieldAlly;

    const scene = cap.scene;
    if (!scene?.enemiesGroup) return;

    // Periodic target search (not every frame)
    if (!s.hasTarget || cap.now - s.lastSearch > 2000) {
        s.lastSearch = cap.now;
        const enemies = scene.enemiesGroup.getChildren();
        let bestDist = Infinity;
        s.hasTarget = false;

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e.active || e === scene.player) continue;
            if (e.blueprintId === 'enemy.shielding_helper') continue;
            const edx = e.x - pos.x;
            const edy = e.y - pos.y;
            const edSq = edx * edx + edy * edy;
            if (edSq < bestDist) {
                bestDist = edSq;
                s.targetX = e.x;
                s.targetY = e.y;
                s.hasTarget = true;
            }
        }
    }

    if (!s.hasTarget) {
        const sdx = cap.spawnX - pos.x;
        const sdy = cap.spawnY - pos.y;
        const sd = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
        cap.setVelocity((sdx / sd) * speed * 0.5, (sdy / sd) * speed * 0.5);
        return;
    }

    // Orbit around target ally
    s.angle += orbitSpeed * dt;
    const goalX = s.targetX + Math.cos(s.angle) * orbitRadius;
    const goalY = s.targetY + Math.sin(s.angle) * orbitRadius;
    const gdx = goalX - pos.x;
    const gdy = goalY - pos.y;
    const gd = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
    cap.setVelocity((gdx / gd) * speed, (gdy / gd) * speed);

    // Persistent shield aura — redraw every 1.5s so it's always visible
    if (cap.now - s.lastAura >= 1500) {
        s.lastAura = cap.now;
        cap.playTelegraph(pos.x, pos.y, {
            radius: buffRange, color: 0x00FFCC, duration: 1600, fillAlpha: 0.06, pulses: 1
        });
    }

    // Shield buff pulse — stronger flash + VFX on buff tick
    if (cap.now - s.lastBuff >= buffInterval) {
        s.lastBuff = cap.now;
        cap.playTelegraph(pos.x, pos.y, {
            radius: buffRange * 0.6, color: 0x00FFFF, duration: 400, fillAlpha: 0.15, pulses: 1
        });
        // Telegraph circle is sufficient — no spawnVfx/playSfx spam
    }
}
