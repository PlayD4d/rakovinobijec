/**
 * Charge behavior — cancer cell rushes at player with burst speed, then pauses to recover.
 * Inspired by metastasis: aggressive burst movement to "invade" new territory.
 *
 * States: approach → windup → dash → recover → approach
 * Pure function, no Phaser API.
 */
export function charge(cap, cfg, dt, mem, setState) {
    const player = cap.getPlayer();
    if (!player?.active) return;

    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distSq = dx * dx + dy * dy;

    // Defaults
    const speed = cfg.speed || 80;
    const dashSpeed = cfg.dashSpeed || 350;
    const dashDuration = cfg.dashDuration || 400; // ms
    const recoverDuration = cfg.recoverDuration || 1200; // ms
    const windupDuration = cfg.windupDuration || 500; // ms
    const triggerRange = cfg.triggerRange || 200;
    const triggerRangeSq = triggerRange * triggerRange;

    // Initialize
    if (!mem.charge) {
        mem.charge = { phase: 'approach', phaseStart: cap.now ?? 0, dashDx: 0, dashDy: 0 };
    }
    const s = mem.charge;
    const elapsed = cap.now - s.phaseStart;

    switch (s.phase) {
        case 'approach':
            // Move toward player at normal speed
            if (distSq > 1) {
                const dist = Math.sqrt(distSq);
                cap.setVelocity((dx / dist) * speed, (dy / dist) * speed);
            }
            // Trigger charge when in range
            if (distSq < triggerRangeSq) {
                s.phase = 'windup';
                s.phaseStart = cap.now;
                cap.setVelocity(0, 0);
            }
            break;

        case 'windup':
            // Stand still, "gathering energy"
            cap.setVelocity(0, 0);
            if (elapsed >= windupDuration) {
                // Lock dash direction toward player's current position
                const dist = Math.sqrt(distSq) || 1;
                s.dashDx = (dx / dist) * dashSpeed;
                s.dashDy = (dy / dist) * dashSpeed;
                s.phase = 'dash';
                s.phaseStart = cap.now;
                // No SFX here — telegraph circle is sufficient warning
            }
            break;

        case 'dash':
            // Rush in locked direction at high speed
            cap.setVelocity(s.dashDx, s.dashDy);
            if (elapsed >= dashDuration) {
                s.phase = 'recover';
                s.phaseStart = cap.now;
                cap.setVelocity(0, 0);
            }
            break;

        case 'recover':
            // Exhausted — slow drift, vulnerable
            cap.setVelocity(0, 0);
            if (elapsed >= recoverDuration) {
                s.phase = 'approach';
                s.phaseStart = cap.now;
            }
            break;
    }
}
