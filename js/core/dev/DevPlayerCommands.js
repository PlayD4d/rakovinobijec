/**
 * DevPlayerCommands - Player manipulation DEV commands
 */

export function registerPlayerCommands(DEV, getScene) {

    DEV.setHealth = (hp) => {
        try {
            const scene = getScene();
            if (!scene?.player) { console.warn('[DEV] Player not available'); return; }

            const p = scene.player;
            const targetHp = Math.max(0, hp);

            if (targetHp > p.hp) {
                p.heal(targetHp - p.hp);
            } else if (targetHp < p.hp) {
                p.hp = targetHp;
                const hud = scene.scene?.get('GameUIScene')?.hud;
                if (hud?.setPlayerHealth) hud.setPlayerHealth(targetHp, p.maxHp);
            }
            console.log(`Player health set to ${p.hp}`);
        } catch (e) { console.error('[DEV] setHealth failed:', e); }
    };

    DEV.setMaxHealth = (maxHp) => {
        try {
            const scene = getScene();
            if (!scene?.player) { console.warn('[DEV] Player not available'); return; }

            const p = scene.player;
            const newMax = Math.max(1, maxHp);
            p.maxHp = newMax;
            p.hp = Math.min(p.hp, newMax);

            const hud = scene.scene?.get('GameUIScene')?.hud;
            if (hud?.setPlayerHealth) hud.setPlayerHealth(p.hp, newMax);
            console.log(`Player max health set to ${newMax} (current: ${p.hp})`);
        } catch (e) { console.error('[DEV] setMaxHealth failed:', e); }
    };

    DEV.godMode = () => {
        try {
            const scene = getScene();
            if (!scene?.player) { console.warn('[DEV] Player not available'); return; }

            const p = scene.player;
            const currentState = p.invincible || false;

            if (!currentState) {
                if (!p._origCanTakeDamage && p.canTakeDamage) {
                    p._origCanTakeDamage = p.canTakeDamage.bind(p);
                }
                if (p.canTakeDamage) p.canTakeDamage = () => false;
                p.invincible = true;
                console.log('God Mode: ON');
            } else {
                if (p._origCanTakeDamage && p.canTakeDamage) {
                    p.canTakeDamage = p._origCanTakeDamage;
                }
                p.invincible = false;
                console.log('God Mode: OFF');
            }
        } catch (e) { console.error('[DEV] godMode failed:', e); }
    };

    DEV.levelUp = (steps = 1) => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }

            const count = Math.max(1, Math.floor(steps));
            for (let i = 0; i < count; i++) {
                if (typeof scene.levelUp === 'function') {
                    scene.levelUp();
                }
            }
            console.log(`Triggered ${count} level-up(s)`);
        } catch (e) { console.error('[DEV] levelUp failed:', e); }
    };

    DEV.addXP = (amount) => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }

            const a = Math.floor(Number(amount) || 0);
            if (a <= 0) { console.warn('[DEV] Amount must be positive'); return; }

            if (typeof scene.addXP === 'function') {
                scene.addXP(a);
            } else {
                console.warn('[DEV] scene.addXP not available');
                return;
            }
            console.log(`Added XP: +${a} (now ${scene.gameStats?.xp ?? '?'}/${scene.gameStats?.xpToNext ?? '?'})`);
        } catch (e) { console.error('[DEV] addXP failed:', e); }
    };

    DEV.setLevel = (targetLevel = 1) => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }

            const lvl = Math.max(1, Math.floor(targetLevel));
            while ((scene.gameStats?.level || 1) < lvl) {
                scene.levelUp();
            }
            console.log(`Level set to ${scene.gameStats?.level}`);
        } catch (e) { console.error('[DEV] setLevel failed:', e); }
    };

    DEV.givePowerUp = (id, level = 1) => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            if (!scene.powerUpSystem) { console.warn('[DEV] PowerUpSystem not available'); return; }

            const success = scene.powerUpSystem.applyPowerUp(id, level);
            console.log(success ? `Applied power-up: ${id} (level ${level})` : `Failed to apply: ${id}`);
        } catch (e) { console.error('[DEV] givePowerUp failed:', e); }
    };

    DEV.enableExplosive = (radius = 50, damage = 25) => {
        try {
            const scene = getScene();
            if (!scene?.player) { console.warn('[DEV] Player not available'); return; }

            scene.player.addModifier({
                id: 'dev_explosive', path: 'explosionRadius', type: 'add', value: radius
            });
            scene.player.addModifier({
                id: 'dev_explosive_damage', path: 'explosionDamage', type: 'add', value: damage
            });
            console.log(`Explosive bullets enabled, radius: ${radius}, damage: ${damage}`);
        } catch (e) { console.error('[DEV] enableExplosive failed:', e); }
    };

    DEV.enablePiercing = (count = 3) => {
        try {
            const scene = getScene();
            if (!scene?.player) { console.warn('[DEV] Player not available'); return; }

            scene.player.addModifier({
                id: 'dev_piercing', path: 'projectilePiercing', type: 'add', value: count
            });
            console.log(`Piercing bullets enabled, pierce count: ${count}`);
        } catch (e) { console.error('[DEV] enablePiercing failed:', e); }
    };
}
