/**
 * Explode behavior — cell rushes at player and self-destructs on contact or timer.
 * Inspired by apoptosis (programmed cell death) weaponized against the player.
 *
 * Approaches at moderate speed, detonates when close or after maxLifetime.
 * Pure function, no Phaser API.
 */
export function explode(cap, cfg, dt, mem, setState) {
    const player = cap.getPlayer();
    if (!player?.active) return;

    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distSq = dx * dx + dy * dy;

    const speed = cfg.speed || 100;
    const detonateRange = cfg.detonateRange || 30;
    const detonateRangeSq = detonateRange * detonateRange;
    const fuseTime = cfg.fuseTime || 6000;
    const warningTime = cfg.warningTime || 1500;

    if (!mem.explode) {
        mem.explode = { spawnTime: cap.now, warned: false, detonated: false };
    }
    const s = mem.explode;

    // Once detonated, stop all processing — prevents infinite explosion loop
    if (s.detonated) return;

    const alive = cap.now - s.spawnTime;

    // Warning telegraph near end of fuse
    if (!s.warned && alive >= fuseTime - warningTime) {
        s.warned = true;
        cap.playTelegraph(pos.x, pos.y, {
            radius: detonateRange * 2, color: 0xFF2200, duration: warningTime, fillAlpha: 0.15
        });
    }

    // Auto-detonate on fuse timer
    if (alive >= fuseTime) {
        s.detonated = true;
        cap.playExplosion(pos.x, pos.y, { color: 0xFF6600, radius: detonateRange * 2.5 });
        cap.playSfx('death');
        cap.setVelocity(0, 0);
        return;
    }

    // Detonate on proximity
    if (distSq < detonateRangeSq) {
        s.detonated = true;
        cap.playExplosion(pos.x, pos.y, { color: 0xFF6600, radius: detonateRange * 2.5 });
        cap.playSfx('death');
        cap.setVelocity(0, 0);
        return;
    }

    // Chase toward player — accelerate as fuse burns
    const urgency = 1.0 + 0.5 * (alive / fuseTime);
    const dist = Math.sqrt(distSq) || 1;
    cap.setVelocity((dx / dist) * speed * urgency, (dy / dist) * speed * urgency);
}
