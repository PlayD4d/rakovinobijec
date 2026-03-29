/**
 * Swarm behavior — cells coordinate movement with nearby allies, creating pack-like attacks.
 * Inspired by metastasis clusters: cancer cells that migrate together are more dangerous.
 *
 * Chases player but adjusts velocity based on nearby swarm members to create
 * cohesive group movement with flanking tendency.
 * Pure function, no Phaser API.
 */
export function swarm(cap, cfg, dt, mem, setState) {
    const player = cap.getPlayer();
    if (!player?.active) return;

    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distSq = dx * dx + dy * dy;

    const speed = cfg.speed || 90;
    const separationDist = cfg.separationDist || 25;
    const separationDistSq = separationDist * separationDist;
    const cohesionWeight = cfg.cohesionWeight || 0.15;
    const flankAngle = cfg.flankAngle || 0.4; // radians offset for flanking

    if (!mem.swarm) {
        // Each swarm member gets a unique flanking side (random ±)
        mem.swarm = { flankSign: Math.random() > 0.5 ? 1 : -1, lastNeighborCheck: 0, sepX: 0, sepY: 0 };
    }
    const s = mem.swarm;

    // Chase direction
    const dist = Math.sqrt(distSq) || 1;
    let vx = (dx / dist);
    let vy = (dy / dist);

    // Apply flanking offset — rotate chase vector slightly to approach from the side
    const angle = Math.atan2(vy, vx) + flankAngle * s.flankSign;
    vx = Math.cos(angle);
    vy = Math.sin(angle);

    // Periodic neighbor separation check (not every frame — every 200ms)
    if (cap.now - s.lastNeighborCheck > 200) {
        s.lastNeighborCheck = cap.now;
        s.sepX = 0;
        s.sepY = 0;

        const scene = cap.scene;
        if (scene?.enemiesGroup) {
            const enemies = scene.enemiesGroup.getChildren();
            let count = 0;
            for (let i = 0; i < enemies.length && count < 8; i++) {
                const e = enemies[i];
                if (!e.active || e.x === pos.x && e.y === pos.y) continue;
                const edx = pos.x - e.x;
                const edy = pos.y - e.y;
                const edSq = edx * edx + edy * edy;
                if (edSq < separationDistSq && edSq > 1) {
                    const ed = Math.sqrt(edSq);
                    s.sepX += (edx / ed);
                    s.sepY += (edy / ed);
                    count++;
                }
            }
        }
    }

    // Combine chase + separation
    vx = vx + s.sepX * cohesionWeight;
    vy = vy + s.sepY * cohesionWeight;

    // Normalize and apply speed
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    cap.setVelocity((vx / len) * speed, (vy / len) * speed);
}
