/**
 * shoot.js - Combat behavior (runs in combat layer, parallel to movement)
 *
 * Handles: aiming at player, cooldown, burst shooting
 * Does NOT handle: movement (that's the movement layer's job)
 */

export function shoot(cap, cfg, dt, mem, setState) {
    const player = cap.getPlayer();
    if (!player?.active) return;

    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;

    // Face player
    cap.faceTo(player.x, player.y);

    // Shoot with cooldown
    // Use game time; avoid Date.now() fallback which is incompatible in scale
    const now = cap.now || 1;
    const cooldown = cfg?.cooldown || 3000;

    // Initialize lastShotAt to current time on first call (prevents instant shot on spawn)
    if (mem.lastShotAt == null) mem.lastShotAt = now;

    if (now - mem.lastShotAt >= cooldown) {
        const angle = Math.atan2(dy, dx);
        const burstCount = cfg?.burstCount || 1;
        const burstDelay = cfg?.burstDelay || 100;
        const chargeTime = cfg?.chargeTime || 200;

        for (let i = 0; i < burstCount; i++) {
            cap.schedule(() => {
                // Fresh angle at fire time (player moves during charge)
                const p = cap.getPlayer();
                if (!p?.active) return;
                const freshPos = cap.getPos();
                const freshAngle = Math.atan2(p.y - freshPos.y, p.x - freshPos.x);
                cap.shoot('straight', {
                    angle: freshAngle,
                    speed: cfg?.speed || 200,
                    damage: cfg?.damage || cap.damage
                });
            }, chargeTime + i * burstDelay);
        }

        mem.lastShotAt = now;
    }
}

