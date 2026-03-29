/**
 * Shield Ally behavior — support cell that orbits near other enemies and grants them damage reduction.
 * Inspired by tumor microenvironment: stromal cells that protect cancer cells from immune attack.
 *
 * Seeks nearest non-shielded enemy, orbits it, and periodically applies a shield buff.
 * Pure function, no Phaser API.
 */
export function shield_ally(cap, cfg, dt, mem, setState) {
    const pos = cap.getPos();
    const speed = cfg.speed || 70;
    const orbitRadius = cfg.orbitRadius || 50;
    const orbitSpeed = cfg.orbitSpeed || 2.0; // rad/s
    const buffInterval = cfg.buffInterval || 3000; // ms
    const buffRange = cfg.buffRange || 80;

    if (!mem.shieldAlly) {
        mem.shieldAlly = { angle: Math.random() * Math.PI * 2, lastBuff: 0, targetX: 0, targetY: 0, hasTarget: false };
    }
    const s = mem.shieldAlly;

    // Find nearest ally to protect (using scene.enemiesGroup)
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
            if (!e.active || e === cap.scene?.player) continue;
            // Don't target self or other shield allies
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
        // No allies — flee toward spawn point
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

    // Periodic shield pulse — visual aura circle showing buff range
    if (cap.now - s.lastBuff >= buffInterval) {
        s.lastBuff = cap.now;
        cap.playTelegraph(pos.x, pos.y, {
            radius: buffRange, color: 0x00FFCC, duration: 600, fillAlpha: 0.08, pulses: 1
        });
    }
}
