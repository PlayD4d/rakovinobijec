/**
 * chase.js - Chase behavior for enemies
 *
 * Default behavior: always move toward player (Vampire Survivors style).
 * No loseRange by default — enemies chase forever unless explicitly configured.
 */

export function chase(cap, cfg, dt, mem, setState) {
    const speed = cfg?.speed || cap.speed || 100;
    const attackRange = cfg?.attackRange || 160;

    // Get player
    const player = cap.scene?.player;
    if (!player?.active) return;

    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const distSq = dx * dx + dy * dy;

    // If close enough to attack and enemy can shoot, switch to shoot state
    if (cfg?.attackRange && distSq <= attackRange * attackRange) {
        cap.setVelocity(0, 0);
        setState('shoot', { stickyMs: 300 });
        return;
    }

    // Move toward player
    const dist = Math.sqrt(distSq);
    if (dist > 1) {
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;
        cap.setVelocity(vx, vy);
        cap.faceTo(player.x, player.y);
    }
}

export default chase;
