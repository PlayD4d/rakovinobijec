/**
 * Evasion behavior — cell dodges while approaching.
 * Inspired by immune evasion: cancer cells that avoid the immune system.
 *
 * Supports enrage: when HP drops below threshold, speed and dodge frequency increase.
 * Pure function, no Phaser API.
 */
export function evasion(cap, cfg, dt, mem, setState) {
    const player = cap.getPlayer();
    if (!player?.active) return;

    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distSq = dx * dx + dy * dy;

    let speed = cfg.speed || 85;
    let dodgeInterval = cfg.dodgeInterval || 800;
    const dodgeDuration = cfg.dodgeDuration || 250;
    let dodgeSpeedMul = cfg.dodgeSpeedMul || 2.5;

    // Enrage: below HP threshold → faster, more aggressive dodging
    const enrageThreshold = cfg.enrageThreshold || 0;
    if (enrageThreshold > 0 && cap.getHpRatio && cap.getHpRatio() <= enrageThreshold) {
        const enrageSpeedMul = cfg.enrageSpeedMul || 1.5;
        speed *= enrageSpeedMul;
        dodgeInterval *= 0.5; // Dodge twice as often
        dodgeSpeedMul *= 1.3;

        // Visual indicator — tint red on first enrage
        if (!mem.evasion?.enraged) {
            cap.setTint?.(0xFF4444);
        }
        if (mem.evasion) mem.evasion.enraged = true;
    }

    if (!mem.evasion) {
        mem.evasion = { lastDodge: cap.now, dodging: false, dodgeDir: 1, dodgeStart: 0, enraged: false };
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
            const perpX = -toPlayerY * s.dodgeDir;
            const perpY = toPlayerX * s.dodgeDir;
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
        s.dodgeDir = Math.random() > 0.5 ? 1 : -1;
        return;
    }

    // Normal approach
    cap.setVelocity(toPlayerX * speed, toPlayerY * speed);
}
