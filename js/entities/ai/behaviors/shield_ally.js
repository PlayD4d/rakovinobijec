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

    // Find nearest ally to orbit — search from PLAYER position (where combat happens)
    const player = cap.getPlayer();
    if (!s.hasTarget || cap.now - s.lastSearch > 1500) {
        s.lastSearch = cap.now;
        const searchX = player?.x || pos.x;
        const searchY = player?.y || pos.y;
        const nearby = cap.getEnemiesNearby(searchX, searchY, 300);
        let bestDist = Infinity;
        s.hasTarget = false;

        for (let i = 0; i < nearby.length; i++) {
            const e = nearby[i];
            // Don't target self or other shield allies
            if (e.blueprintId === 'enemy.shielding_helper' || e.blueprintId === 'enemy.support_bacteria') continue;
            const edx = e.x - searchX;
            const edy = e.y - searchY;
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
        // No allies near player — move toward player area to find allies
        if (player?.active) {
            const pdx = player.x - pos.x;
            const pdy = player.y - pos.y;
            const pd = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
            cap.setVelocity((pdx / pd) * speed, (pdy / pd) * speed);
        }
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

    // Shield buff pulse — brief flash on buff tick only (not persistent aura)
    if (cap.now - s.lastBuff >= buffInterval) {
        s.lastBuff = cap.now;
        cap.playTelegraph(pos.x, pos.y, {
            radius: buffRange * 0.5, color: 0x00FFCC, duration: 300, fillAlpha: 0.1
        });
    }
}
