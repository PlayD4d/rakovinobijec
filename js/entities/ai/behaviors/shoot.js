/**
 * shoot.js - Combat behavior (runs in combat layer, parallel to movement)
 *
 * Handles: aiming at player, cooldown, burst shooting
 * Does NOT handle: movement (that's the movement layer's job)
 */

export function shoot(cap, cfg, dt, mem, setState) {
    const player = cap.scene?.player;
    if (!player?.active) return;

    const pos = cap.getPos();
    const dx = player.x - pos.x;
    const dy = player.y - pos.y;

    // Face player
    cap.faceTo(player.x, player.y);

    // Shoot with cooldown
    const now = cap.now || cap.scene?.time?.now || Date.now();
    const cooldown = cfg?.cooldown || 3000;

    if (now - (mem.lastShotAt || -Infinity) >= cooldown) {
        const angle = Math.atan2(dy, dx);
        const burstCount = cfg?.burstCount || 1;
        const burstDelay = cfg?.burstDelay || 100;

        for (let i = 0; i < burstCount; i++) {
            cap.schedule(() => {
                cap.shoot('straight', {
                    angle,
                    speed: cfg?.speed || 200,
                    damage: cfg?.damage || cap.damage
                });
            }, i * burstDelay);
        }

        mem.lastShotAt = now;
    }
}

export default shoot;
