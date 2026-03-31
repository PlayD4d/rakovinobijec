/**
 * Explode behavior — chase player, detonate on proximity.
 *
 * Flow: spawn → chase player → reach detonateRange → brief telegraph → explode (area damage) → die.
 * Player must dodge at the last moment to avoid explosion damage.
 * Pure function, no Phaser API.
 */
export function explode(cap, cfg, dt, mem) {
    const player = cap.getPlayer();
    if (!player?.active) return;

    if (!mem.explode) {
        mem.explode = { detonating: false, detonated: false };
    }
    const s = mem.explode;
    if (s.detonated) return;

    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distSq = dx * dx + dy * dy;

    const speed = cfg.speed || 100;
    const detonateRange = cfg.detonateRange || 35;
    const telegraphMs = cfg.telegraphMs || 400;
    const explosionDamage = cfg.explosionDamage || cfg.damage || 12;
    const explosionRadius = cfg.explosionRadius || detonateRange * 2.5;

    // Phase 1: Chase player
    if (!s.detonating) {
        if (distSq <= detonateRange * detonateRange) {
            // In range — start detonation sequence
            s.detonating = true;
            cap.setVelocity(0, 0);

            // Explode after brief windup
            cap.schedule(() => {
                if (s.detonated) return;
                s.detonated = true;
                const p = cap.getPos();
                cap.playExplosion(p.x, p.y, { color: 0x88CC00, radius: explosionRadius });
                cap.playSfx('death');

                // Damage player if still in explosion radius
                const px = player.x - p.x;
                const py = player.y - p.y;
                if (player.active && px * px + py * py <= explosionRadius * explosionRadius) {
                    cap.damagePlayer(explosionDamage, 'acidic_explosion');
                }

                cap.die();
            }, telegraphMs);
        } else {
            // Chase — constant speed toward player
            const dist = Math.sqrt(distSq) || 1;
            cap.setVelocity((dx / dist) * speed, (dy / dist) * speed);
        }
        return;
    }

    // Phase 2: Detonating — stay still, wait for scheduled explosion
    cap.setVelocity(0, 0);
}
