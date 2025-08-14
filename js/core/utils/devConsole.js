// Jednoduchá developerská konzole: window.DEV.spawnBoss(index|name)
// Bez UI, pouze JS API pro rychlé testování
import { GameConfig } from '../../config.js';

export function installDevConsole(scene) {
  try {
    if (typeof window === 'undefined') return;
    if (!window.DEV) window.DEV = {};
    window.DEV.spawnBoss = (arg) => {
      try {
        const bosses = GameConfig?.bosses || [];
        let index = -1;
        if (typeof arg === 'number') index = arg;
        else if (typeof arg === 'string') {
          const q = String(arg).toLowerCase();
          index = bosses.findIndex(b => String(b.name || '').toLowerCase().includes(q));
        }
        if (index < 0) index = 0;
        console.log('[DEV] Spawning boss at index:', index);
        scene.enemyManager.spawnBoss(index);
      } catch (e) {
        console.warn('[DEV] spawnBoss failed:', e?.message);
      }
    };
    window.DEV.listBosses = () => {
      const bosses = GameConfig?.bosses || [];
      bosses.forEach((b, i) => console.log(`${i}: ${b.name}`));
      return bosses.map((b, i) => ({ index: i, name: b.name }));
    };

    // God mode (nesmrtelnost)
    window.DEV.setGodMode = (enabled = true) => {
      try {
        const p = scene.player;
        if (!p) { console.warn('[DEV] Player not ready'); return; }
        if (enabled) {
          if (!p._origCanTakeDamage) p._origCanTakeDamage = p.canTakeDamage.bind(p);
          p.canTakeDamage = () => false;
          p.invincible = true;
          console.log('🛡️ DEV God Mode: ON');
        } else {
          if (p._origCanTakeDamage) p.canTakeDamage = p._origCanTakeDamage;
          p.invincible = false;
          console.log('🛡️ DEV God Mode: OFF');
        }
      } catch (e) { console.warn('[DEV] setGodMode failed:', e?.message); }
    };

    // Rychlý level-up (vyvolá výběr power-upu)
    // Upozornění: Každý level-up otevře výběrové menu; potvrď a zavři, než zavoláš další.
    window.DEV.levelUp = (steps = 1) => {
      try {
        const sceneRef = (typeof window.gameScene !== 'undefined' && window.gameScene) ? window.gameScene : scene; // fallback na aktuální scénu
        const count = Math.max(1, Math.floor(steps));
        for (let i = 0; i < count; i++) {
          if (sceneRef && typeof sceneRef.levelUp === 'function') {
            sceneRef.levelUp();
          }
        }
      } catch (e) { console.warn('[DEV] levelUp failed:', e?.message); }
    };

    // Přidá XP (přírůstek), automaticky vyvolá level-up, pokud překročí hranici
    window.DEV.addXP = (amount = 1) => {
      try {
        const sceneRef = (typeof window.gameScene !== 'undefined' && window.gameScene) ? window.gameScene : scene;
        const a = Math.floor(Number(amount) || 0);
        if (a <= 0) return;
        sceneRef.gainXP(a);
        console.log(`[DEV] Added XP: +${a} (now ${sceneRef.gameStats.xp}/${sceneRef.gameStats.xpToNext})`);
      } catch (e) { console.warn('[DEV] addXP failed:', e?.message); }
    };

    // Nastaví cílový level (postupně vyvolá level-up tolikrát, kolikrát je třeba)
    window.DEV.setLevel = (targetLevel = 1) => {
      try {
        const sceneRef = (typeof window.gameScene !== 'undefined' && window.gameScene) ? window.gameScene : scene;
        const lvl = Math.max(1, Math.floor(targetLevel));
        while (sceneRef.gameStats.level < lvl) {
          sceneRef.levelUp();
        }
        console.log(`[DEV] Level set to ${sceneRef.gameStats.level}`);
      } catch (e) { console.warn('[DEV] setLevel failed:', e?.message); }
    };

    // Zapnout/vypnout performance profiler
    window.DEV.togglePerf = () => {
      try {
        const current = localStorage.getItem('perfProfiler') === 'true';
        localStorage.setItem('perfProfiler', (!current).toString());
        console.log(`[DEV] Performance Profiler ${!current ? 'ENABLED' : 'DISABLED'} - reload to see effect`);
        return !current;
      } catch (e) { console.warn('[DEV] togglePerf failed:', e?.message); }
    };

    // Zapnout/vypnout hot reload
    window.DEV.toggleHotReload = () => {
      try {
        const current = localStorage.getItem('hotReload') === 'true';
        localStorage.setItem('hotReload', (!current).toString());
        console.log(`[DEV] Hot Reload ${!current ? 'ENABLED' : 'DISABLED'} - reload to see effect`);
        return !current;
      } catch (e) { console.warn('[DEV] toggleHotReload failed:', e?.message); }
    };

    // Test enemy projectiles
    window.DEV.testEnemyBullet = () => {
      console.log('[DEV] Testing enemy bullet...');
      if (scene.coreProjectileSystem && scene.player) {
        // Fire enemy bullet towards player from random position
        const playerX = scene.player.x;
        const playerY = scene.player.y;
        const startX = playerX + 200 + (Math.random() - 0.5) * 100;
        const startY = playerY + (Math.random() - 0.5) * 100;
        const dirX = playerX - startX;
        const dirY = playerY - startY;
        
        const success = scene.coreProjectileSystem.fireEnemy(
          startX, startY, dirX, dirY, 
          100, 400, 5, 'TRACKING', 'dev:test', 0xff0000
        );
        console.log('[DEV] Enemy bullet fired:', success);
      } else {
        console.warn('[DEV] ProjectileSystem or player not available');
      }
    };
    
    window.DEV.testHomingBullet = () => {
      console.log('[DEV] Testing homing enemy bullet...');
      if (scene.coreProjectileSystem && scene.player) {
        const playerX = scene.player.x;
        const playerY = scene.player.y;
        const startX = playerX + 300;
        const startY = playerY;
        const dirX = playerX - startX;
        const dirY = playerY - startY;
        
        const success = scene.coreProjectileSystem.fireEnemy(
          startX, startY, dirX, dirY, 
          80, 600, 8, 'AGGRESSIVE', 'dev:homing', 0xff4444
        );
        console.log('[DEV] Homing bullet fired:', success);
      } else {
        console.warn('[DEV] ProjectileSystem or player not available');
      }
    };
    
    // Testovací monitoring pro ověření kolizí
    window.DEV.startCollisionMonitoring = () => {
      if (window.DEV._collisionMonitorInterval) {
        clearInterval(window.DEV._collisionMonitorInterval);
      }
      
      console.log('[DEV] Starting collision monitoring (every 1 second)...');
      window.DEV._collisionMonitorInterval = setInterval(() => {
        if (scene.coreProjectileSystem && scene.enemyManager) {
          const playerActive = scene.coreProjectileSystem.playerBullets?.countActive() || 0;
          const enemyActive = scene.coreProjectileSystem.enemyBullets?.countActive() || 0; 
          const enemiesActive = scene.enemyManager.enemies?.countActive() || 0;
          const playerHp = scene.player?.hp || 0;
          
          console.log(`[MONITOR] Player bullets: ${playerActive}, Enemy bullets: ${enemyActive}, Enemies: ${enemiesActive}, Player HP: ${playerHp}`);
        }
      }, 1000);
    };
    
    window.DEV.stopCollisionMonitoring = () => {
      if (window.DEV._collisionMonitorInterval) {
        clearInterval(window.DEV._collisionMonitorInterval);
        window.DEV._collisionMonitorInterval = null;
        console.log('[DEV] Collision monitoring stopped.');
      }
    };
    
    // Test explosion system
    window.DEV.testExplosion = (radius = 100) => {
      console.log('[DEV] Testing explosion...');
      if (scene.coreProjectileSystem && scene.player) {
        const playerX = scene.player.x;
        const playerY = scene.player.y;
        const enemiesHit = scene.coreProjectileSystem.createExplosion(
          playerX, playerY, 50, radius, 3
        );
        console.log(`[DEV] Explosion at player position: ${enemiesHit} enemies hit, radius: ${radius}px`);
      } else {
        console.warn('[DEV] ProjectileSystem not available');
      }
    };
    
    // Enable explosive bullets for testing
    window.DEV.enableExplosive = (level = 3) => {
      if (scene.player) {
        scene.player.hasExplosiveBullets = true;
        scene.player.explosiveBulletsLevel = level;
        console.log(`[DEV] Explosive bullets enabled, level: ${level}`);
      }
    };
    
    // Enable piercing bullets for testing
    window.DEV.enablePiercing = (level = 3) => {
      if (scene.player) {
        scene.player.hasPiercingArrows = true;
        scene.player.piercingArrowsLevel = level;
        console.log(`[DEV] Piercing arrows enabled, level: ${level}`);
      }
    };
    
    // Performance stress test - fires many bullets
    window.DEV.stressTestBullets = (count = 100) => {
      console.log(`[DEV] Firing ${count} bullets for performance test...`);
      if (scene.coreProjectileSystem && scene.player) {
        const startTime = performance.now();
        let fired = 0;
        
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const dirX = Math.cos(angle);
          const dirY = Math.sin(angle);
          
          const success = scene.coreProjectileSystem.firePlayer(
            scene.player.x, scene.player.y, dirX, dirY, 1.0, 1.0, 1.0, 0xffffff
          );
          if (success) fired++;
        }
        
        const endTime = performance.now();
        const stats = scene.coreProjectileSystem.getStats();
        console.log(`[DEV] Performance test: ${fired}/${count} bullets fired in ${(endTime - startTime).toFixed(2)}ms`);
        console.log(`[DEV] Pool stats: ${stats.player.active} active, ${stats.player.pooled} pooled`);
      }
    };
    
    // High-speed tunneling test
    window.DEV.tunnelingTest = () => {
      console.log('[DEV] Testing high-speed bullet tunneling...');
      if (scene.coreProjectileSystem && scene.player && scene.enemyManager) {
        // Fire very fast bullets at close enemies - use consistent API
        const enemies = scene.enemyManager.enemies.getChildren().filter(e => e.active).slice(0, 5);
        if (enemies.length === 0) {
          console.log('[DEV] No enemies found for tunneling test');
          return;
        }
        
        let hits = 0;
        let fired = 0;
        
        enemies.forEach(enemy => {
          const dirX = enemy.x - scene.player.x;
          const dirY = enemy.y - scene.player.y;
          
          // Fire at 5x normal speed to test tunneling
          const success = scene.coreProjectileSystem.firePlayer(
            scene.player.x, scene.player.y, dirX, dirY, 5.0, 1.0, 1.0, 0xff00ff
          );
          if (success) fired++;
        });
        
        setTimeout(() => {
          console.log(`[DEV] Tunneling test: ${fired} high-speed bullets fired at ${enemies.length} enemies`);
        }, 100);
      }
    };
    
    // Test different homing blueprint types
    window.DEV.testHomingBlueprints = () => {
      console.log('[DEV] Testing all homing blueprint types...');
      if (scene.coreProjectileSystem && scene.player) {
        const blueprintTypes = ['DEFAULT', 'TRACKING', 'AGGRESSIVE', 'LAZY'];
        const playerX = scene.player.x;
        const playerY = scene.player.y;
        
        blueprintTypes.forEach((blueprint, index) => {
          const angle = (index / blueprintTypes.length) * Math.PI * 2;
          const startX = playerX + Math.cos(angle) * 200;
          const startY = playerY + Math.sin(angle) * 200;
          const dirX = playerX - startX;
          const dirY = playerY - startY;
          
          const success = scene.coreProjectileSystem.fireEnemy(
            startX, startY, dirX, dirY, 
            120, 500, 6, blueprint, `dev:${blueprint.toLowerCase()}`, 
            0xff0000 + (index * 0x003300) // Different colors
          );
          
          console.log(`[DEV] ${blueprint} homing bullet fired:`, success);
        });
      } else {
        console.warn('[DEV] ProjectileSystem or player not available');
      }
    };

    console.log('✅ DEV console installed. Try: DEV.listBosses(), DEV.spawnBoss(5), DEV.togglePerf(), DEV.setGodMode(true)');
    console.log('✅ Enemy bullet tests: DEV.testEnemyBullet(), DEV.testHomingBullet()');
    console.log('✅ Homing blueprints: DEV.testHomingBlueprints() - tests all 4 types');
    console.log('✅ Collision monitoring: DEV.startCollisionMonitoring(), DEV.stopCollisionMonitoring()');
    console.log('✅ Power-up tests: DEV.enableExplosive(3), DEV.enablePiercing(3), DEV.testExplosion(100)');
    console.log('✅ Performance: DEV.stressTestBullets(500), DEV.tunnelingTest()');
    
  } catch (_) { /* no-op */ }
}

// Framework Debug Console - Phase 5
if (typeof window !== 'undefined') {
    window.__phase5Debug = {
        // VFX System debugging
        vfx: {
            stats: () => {
                const scene = getCurrentScene();
                if (!scene?.newVFXSystem) return console.warn('VFX System not available');
                const stats = scene.newVFXSystem.getDebugStats();
                console.log('📊 VFX System Stats:', stats);
                return stats;
            },
            
            test: (effectId = 'vfx.explosion.small', x = 400, y = 300) => {
                const scene = getCurrentScene();
                if (!scene?.newVFXSystem) return console.warn('VFX System not available');
                scene.newVFXSystem.play(effectId, x, y);
                console.log(`🎆 Played VFX: ${effectId} at (${x}, ${y})`);
            },
            
            performance: (mode) => {
                const scene = getCurrentScene();
                if (!scene?.newVFXSystem) return console.warn('VFX System not available');
                scene.newVFXSystem.setPerformanceMode(mode);
                console.log(`⚡ VFX Performance mode: ${mode}`);
            }
        },

        // SFX System debugging
        sfx: {
            stats: () => {
                const scene = getCurrentScene();
                if (!scene?.newSFXSystem) return console.warn('SFX System not available');
                const stats = scene.newSFXSystem.getDebugStats?.() || 'Stats not available';
                console.log('🔊 SFX System Stats:', stats);
                return stats;
            },
            
            test: (soundId = 'sfx.explosion.small') => {
                const scene = getCurrentScene();
                if (!scene?.newSFXSystem) return console.warn('SFX System not available');
                scene.newSFXSystem.play(soundId);
                console.log(`🔊 Played SFX: ${soundId}`);
            }
        },

        // Performance monitoring
        performance: {
            report: () => {
                const scene = getCurrentScene();
                if (!scene) return console.warn('No active scene');
                
                const report = {
                    fps: scene.game.loop.actualFps,
                    enemies: {
                        active: scene.enemyManager?.enemies?.countActive?.() || 0,
                        total: scene.enemyManager?.enemies?.children?.size || 0
                    },
                    projectiles: scene.coreProjectileSystem?.getStats?.() || 'N/A',
                    vfx: scene.newVFXSystem?.getDebugStats?.() || 'N/A',
                    loot: scene.coreLootSystem?.loot?.countActive?.() || 0
                };
                
                console.log('⚡ Performance Report:', report);
                return report;
            },

            compare: () => {
                console.log('📊 Framework vs Legacy Performance Comparison');
                // TODO: Implement performance comparison between framework and legacy
                console.log('Feature not yet implemented');
            }
        },

        // Blueprint validation
        blueprints: {
            validate: () => {
                const ConfigResolver = window.ConfigResolver;
                if (!ConfigResolver) return console.warn('ConfigResolver not available');
                
                const report = ConfigResolver.getTelemetryReport();
                console.log('🔍 Blueprint Validation Report:', report);
                
                if (report.missingPaths.size > 0) {
                    console.warn('Missing blueprint values:', Array.from(report.missingPaths.keys()));
                }
                
                return report;
            },

            test: (blueprintId) => {
                console.log(`🧪 Testing blueprint: ${blueprintId}`);
                // TODO: Implement specific blueprint testing
                console.log('Feature not yet implemented');
            }
        },

        // ConfigResolver debugging
        config: {
            validate: () => {
                const ConfigResolver = window.ConfigResolver;
                if (!ConfigResolver) return console.warn('ConfigResolver not available');
                
                const paths = [
                    'enemy.projectile.inaccuracyRange',
                    'enemy.support.buffInterval', 
                    'boss.rendering.outlineWidth',
                    'player.projectile.baseDamage'
                ];
                
                console.log('🔧 ConfigResolver Validation:');
                paths.forEach(path => {
                    const value = ConfigResolver.get(path);
                    console.log(`  ${path}: ${value}`);
                });
            },

            get: (path, options) => {
                const ConfigResolver = window.ConfigResolver;
                if (!ConfigResolver) return console.warn('ConfigResolver not available');
                
                const value = ConfigResolver.get(path, options);
                console.log(`🔧 ConfigResolver.get('${path}'):`, value);
                return value;
            }
        },

        // Modifier engine debugging
        modifiers: {
            debug: () => {
                const scene = getCurrentScene();
                const player = scene?.player;
                if (!player?.activeModifiers) return console.warn('Player modifiers not available');
                
                console.log('⚙️ Active Modifiers:', player.activeModifiers);
                return player.activeModifiers;
            }
        }
    };

    // Helper function to get current scene
    function getCurrentScene() {
        if (typeof game !== 'undefined' && game.scene) {
            return game.scene.getScene('GameScene') || game.scene.getScene('MainMenu');
        }
        return null;
    }
}


