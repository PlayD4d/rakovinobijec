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
    const fuseTime = cfg.fuseTime || 6000; // ms — auto-detonate after this
    const warningTime = cfg.warningTime || 1500; // ms — visual warning before fuse

    if (!mem.explode) {
        mem.explode = { spawnTime: cap.now, warned: false };
    }
    const s = mem.explode;
    const alive = cap.now - s.spawnTime;

    // Warning flash near end of fuse
    if (!s.warned && alive >= fuseTime - warningTime) {
        s.warned = true;
        cap.spawnVfx('hit'); // Telegraph detonation
    }

    // Auto-detonate on fuse timer
    if (alive >= fuseTime) {
        cap.spawnVfx('death');
        cap.playSfx('death');
        cap.setVelocity(0, 0);
        // Damage dealt via contactDamage on overlap — just kill self
        return;
    }

    // Detonate on proximity
    if (distSq < detonateRangeSq) {
        cap.spawnVfx('death');
        cap.playSfx('death');
        cap.setVelocity(0, 0);
        return;
    }

    // Chase toward player — accelerate as fuse burns
    const urgency = 1.0 + 0.5 * (alive / fuseTime); // 1.0→1.5× speed
    const dist = Math.sqrt(distSq) || 1;
    cap.setVelocity((dx / dist) * speed * urgency, (dy / dist) * speed * urgency);
}
