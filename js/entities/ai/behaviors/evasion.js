/**
 * Evasion behavior — cell dodges player projectiles while approaching.
 * Inspired by immune evasion: cancer cells that avoid the immune system's attacks.
 *
 * Approaches player but periodically sidesteps in a random direction,
 * making it harder to hit with projectiles.
 * Pure function, no Phaser API.
 */
export function evasion(cap, cfg, dt, mem, setState) {
    const player = cap.getPlayer();
    if (!player?.active) return;

    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distSq = dx * dx + dy * dy;

    const speed = cfg.speed || 85;
    const dodgeInterval = cfg.dodgeInterval || 800; // ms between dodges
    const dodgeDuration = cfg.dodgeDuration || 250; // ms of dodge movement
    const dodgeSpeedMul = cfg.dodgeSpeedMul || 2.5;

    if (!mem.evasion) {
        mem.evasion = { lastDodge: cap.now, dodging: false, dodgeDir: 1, dodgeStart: 0 };
    }
    const s = mem.evasion;

    const dist = Math.sqrt(distSq) || 1;
    const toPlayerX = dx / dist;
    const toPlayerY = dy / dist;

    // During dodge — move perpendicular to player direction
    if (s.dodging) {
        const elapsed = cap.now - s.dodgeStart;
        if (elapsed >= dodgeDuration) {
            s.dodging = false;
        } else {
            // Perpendicular vector (rotated 90°)
            const perpX = -toPlayerY * s.dodgeDir;
            const perpY = toPlayerX * s.dodgeDir;
            // Mix: mostly dodge + slight approach
            const mx = perpX * 0.8 + toPlayerX * 0.2;
            const my = perpY * 0.8 + toPlayerY * 0.2;
            cap.setVelocity(mx * speed * dodgeSpeedMul, my * speed * dodgeSpeedMul);
            return;
        }
    }

    // Check if time to dodge
    if (cap.now - s.lastDodge >= dodgeInterval) {
        s.lastDodge = cap.now;
        s.dodging = true;
        s.dodgeStart = cap.now;
        s.dodgeDir = Math.random() > 0.5 ? 1 : -1; // Random side
        return;
    }

    // Normal approach
    cap.setVelocity(toPlayerX * speed, toPlayerY * speed);
}
