/**
 * idle.js - Idle behavior for enemies
 *
 * Default: immediately transition to chase (Vampire Survivors style).
 * Enemies should always be moving toward the player.
 */

export function idle(cap, cfg, dt, mem, setState) {
    // Vampire Survivors style: always chase the player
    // No detect range — if player exists, go chase
    const player = cap.scene?.player;
    if (player?.active) {
        setState('chase');
        return;
    }

    // No player — just stand still
    cap.setVelocity(0, 0);
}

export default idle;
