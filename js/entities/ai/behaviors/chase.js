/**
 * chase.js - Chase behavior for enemies
 *
 * Default: always move toward player (Vampire Survivors style).
 * Only switches to 'shoot' if the enemy has canShoot capability AND is in attackRange.
 * Contact-only enemies chase forever.
 */

export function chase(cap, cfg, dt, mem, setState) {
    const speed = cfg?.speed || cap.speed || 100;

    const player = cap.scene?.player;
    if (!player?.active) return;

    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distSq = dx * dx + dy * dy;

    // Switch to shoot ONLY if enemy can shoot and is in range
    const canShoot = cfg?.canShoot === true;
    if (canShoot && cfg?.attackRange) {
        if (distSq <= cfg.attackRange * cfg.attackRange) {
            cap.setVelocity(0, 0);
            setState('shoot', { stickyMs: 300 });
            return;
        }
    }

    // Move toward player — always
    const dist = Math.sqrt(distSq);
    if (dist > 1) {
        cap.setVelocity((dx / dist) * speed, (dy / dist) * speed);
        cap.faceTo(player.x, player.y);
    }
}

export default chase;
