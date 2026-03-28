/**
 * DevTestCommands - Projectile and combat testing DEV commands
 */

export function registerTestCommands(DEV, getScene) {

    DEV.testEnemyBullet = () => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            if (!scene.projectileSystem || !scene.player) {
                console.warn('[DEV] ProjectileSystem or player not available');
                return;
            }

            const px = scene.player.x;
            const py = scene.player.y;
            const startX = px + 200 + (Math.random() - 0.5) * 100;
            const startY = py + (Math.random() - 0.5) * 100;

            const result = scene.projectileSystem.createEnemyProjectile({
                x: startX,
                y: startY,
                projectileBlueprintId: 'projectile.enemy_basic',
                damage: 5,
                speed: 400,
                range: 1000,
                angleRad: Math.atan2(py - startY, px - startX),
                owner: null
            });
            console.log('Enemy bullet fired:', !!result);
        } catch (e) { console.error('[DEV] testEnemyBullet failed:', e); }
    };

    DEV.testHomingBullet = () => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            if (!scene.projectileSystem || !scene.player) {
                console.warn('[DEV] ProjectileSystem or player not available');
                return;
            }

            const px = scene.player.x;
            const py = scene.player.y;
            const startX = px + 300;
            const startY = py;

            const result = scene.projectileSystem.createEnemyProjectile({
                x: startX,
                y: startY,
                projectileBlueprintId: 'projectile.enemy_homing',
                damage: 8,
                speed: 300,
                range: 1200,
                angleRad: Math.atan2(py - startY, px - startX),
                owner: null,
                homing: true
            });
            console.log('Homing bullet fired:', !!result);
        } catch (e) { console.error('[DEV] testHomingBullet failed:', e); }
    };

    DEV.stressTestBullets = (count = 100) => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            if (!scene.projectileSystem || !scene.player) {
                console.warn('[DEV] ProjectileSystem or player not available');
                return;
            }

            const startTime = performance.now();
            let fired = 0;

            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const result = scene.projectileSystem.createPlayerProjectile({
                    x: scene.player.x,
                    y: scene.player.y,
                    projectileBlueprintId: 'projectile.player_basic',
                    damage: 10,
                    speed: 400,
                    range: 800,
                    angleRad: angle,
                    owner: scene.player
                });
                if (result) fired++;
            }

            const elapsed = (performance.now() - startTime).toFixed(2);
            const stats = scene.projectileSystem.getStats?.() || {};
            console.log(`Stress test: ${fired}/${count} bullets in ${elapsed}ms`);
            console.log('Active projectiles:', stats);
        } catch (e) { console.error('[DEV] stressTestBullets failed:', e); }
    };

    DEV.testExplosion = (radius = 100) => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            if (!scene.player) { console.warn('[DEV] Player not available'); return; }

            const px = scene.player.x;
            const py = scene.player.y;

            // Play VFX
            if (scene.vfxSystem) {
                scene.vfxSystem.play('vfx.explosion.large', px, py);
            }

            // Area damage to nearby enemies
            let enemiesHit = 0;
            if (scene.enemyManager?.getActiveEnemies) {
                const enemies = scene.enemyManager.getActiveEnemies();
                enemies.forEach(enemy => {
                    const dist = Phaser.Math.Distance.Between(px, py, enemy.x, enemy.y);
                    if (dist <= radius) {
                        enemy.takeDamage({ amount: 50, type: 'explosion', source: 'dev_test' });
                        enemiesHit++;
                    }
                });
            }
            console.log(`Explosion at player pos: ${enemiesHit} enemies hit, radius: ${radius}px`);
        } catch (e) { console.error('[DEV] testExplosion failed:', e); }
    };
}
