/**
 * chase.js - Chase behavior (Vampire Survivors style)
 * Always moves toward player. Never stops, never switches state.
 * Shooting is handled independently by EnemyCore, not by state machine.
 */
export function chase(cap, cfg, dt, mem, setState) {
    const speed = cfg?.speed || cap.speed || 100;

    const player = cap.scene?.player;
    if (!player?.active) return;

    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
        cap.setVelocity((dx / dist) * speed, (dy / dist) * speed);
        cap.faceTo(player.x, player.y);
    }
}

