/**
 * DevSpawnCommands - Enemy/boss spawn and management DEV commands
 */

export function registerSpawnCommands(DEV, getScene) {

    DEV.spawnEnemy = (blueprintId, x, y) => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }

            if (!blueprintId) {
                console.log('Usage: DEV.spawnEnemy("enemy.necrotic_cell", x?, y?)');
                return;
            }
            if (!blueprintId.includes('.')) blueprintId = `enemy.${blueprintId}`;

            const posX = x ?? scene.cameras.main.width / 2;
            const posY = y ?? scene.cameras.main.height / 2;

            if (!scene.enemyManager) { console.warn('[DEV] enemyManager not available'); return; }
            const enemy = scene.enemyManager.spawnEnemy(blueprintId, { x: posX, y: posY });
            console.log(`Spawned enemy: ${blueprintId} at (${posX}, ${posY})`);
            return enemy;
        } catch (e) { console.error('[DEV] spawnEnemy failed:', e); }
    };

    DEV.spawnBoss = (blueprintId, x, y) => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }

            if (!blueprintId) {
                console.log('Usage: DEV.spawnBoss("boss.karcinogenni_kral", x?, y?)');
                return;
            }
            if (typeof blueprintId === 'string' && !blueprintId.includes('.')) {
                blueprintId = `boss.${blueprintId}`;
            }

            const posX = x ?? scene.cameras.main.width / 2;
            const posY = y ?? scene.cameras.main.height / 2 - 100;

            if (!scene.enemyManager) { console.warn('[DEV] enemyManager not available'); return; }
            const boss = scene.enemyManager.spawnBoss(blueprintId, { x: posX, y: posY });
            console.log(`Spawned boss: ${blueprintId} at (${posX}, ${posY})`);
            return boss;
        } catch (e) { console.error('[DEV] spawnBoss failed:', e); }
    };

    DEV.spawnWave = (count = 5, blueprintId = 'enemy.necrotic_cell') => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }

            const centerX = scene.cameras.main.width / 2;
            const centerY = scene.cameras.main.height / 2;
            const radius = 100;

            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const ex = centerX + Math.cos(angle) * radius;
                const ey = centerY + Math.sin(angle) * radius;
                DEV.spawnEnemy(blueprintId, ex, ey);
            }
            console.log(`Spawned wave of ${count} ${blueprintId}`);
        } catch (e) { console.error('[DEV] spawnWave failed:', e); }
    };

    DEV.killAll = () => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }
            if (!scene.enemyManager) { console.warn('[DEV] enemyManager not available'); return; }
            scene.enemyManager.killAll({ includeBosses: true });
            console.log('All enemies + bosses killed');
        } catch (e) { console.error('[DEV] killAll failed:', e); }
    };

    DEV.clearEnemies = () => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }

            // Try clearAll first, then fallback to group clear
            if (scene.enemyManager?.clearAll) {
                scene.enemyManager.clearAll();
            } else if (scene.enemiesGroup) {
                scene.enemiesGroup.clear(true, true);
            }
            console.log('Cleared all enemies');
        } catch (e) { console.error('[DEV] clearEnemies failed:', e); }
    };

    DEV.listEnemies = () => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }

            const loader = scene.blueprintLoader;
            if (!loader) { console.warn('[DEV] BlueprintLoader not available'); return []; }

            const enemies = loader.getAllOfType?.('enemy') || [];
            enemies.forEach((bp, i) => {
                const name = bp.display?.name || bp.meta?.displayName || bp.id;
                console.log(`  ${i}: ${bp.id} (${name})`);
            });
            console.log(`Total: ${enemies.length} enemy blueprints`);
            return enemies.map(bp => bp.id);
        } catch (e) { console.error('[DEV] listEnemies failed:', e); return []; }
    };

    DEV.listBosses = () => {
        try {
            const scene = getScene();
            if (!scene) { console.warn('[DEV] No active scene'); return; }

            const loader = scene.blueprintLoader;
            if (!loader) { console.warn('[DEV] BlueprintLoader not available'); return []; }

            const bosses = loader.getAllOfType?.('boss') || [];
            bosses.forEach((bp, i) => {
                const name = bp.display?.name || bp.meta?.displayName || bp.id;
                console.log(`  ${i}: ${bp.id} (${name})`);
            });
            console.log(`Total: ${bosses.length} boss blueprints`);
            return bosses.map(bp => bp.id);
        } catch (e) { console.error('[DEV] listBosses failed:', e); return []; }
    };
}
