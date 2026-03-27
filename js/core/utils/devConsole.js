// Jednoduchá developerská konzole: window.DEV.spawnBoss(index|name)
// Bez UI, pouze JS API pro rychlé testování
import { GameConfig } from '../../config.js';
import { DebugLogger } from '../debug/DebugLogger.js';

export function installDevConsole(scene) {
  try {
    if (typeof window === 'undefined') return;
    if (!window.DEV) window.DEV = {};
    
    // PR7: Helper for safe system access
    const getSystem = (path) => {
      const parts = path.split('.');
      let current = scene;
      for (const part of parts) {
        current = current?.[part];
        if (!current) return null;
      }
      return current;
    };
    
    // ===== DEBUG TOGGLES =====
    // Global debug flags
    if (!window.DEBUG_FLAGS) {
      window.DEBUG_FLAGS = {
        sfx: false,
        vfx: false,
        spawn: false,
        projectiles: false,
        ai: false,
        damage: false,
        loot: false,
        xp: false
      };
    }
    
    /**
     * Toggle debug logging for specific subsystems
     * Example: DEV.toggleDebug('sfx') or DEV.toggleDebug('all')
     */
    window.DEV.toggleDebug = (system = null) => {
      if (!system) {
        console.log('📊 Debug flags:', window.DEBUG_FLAGS);
        console.log('Usage: DEV.toggleDebug("sfx|vfx|spawn|projectiles|ai|damage|loot|xp|all")');
        return;
      }
      
      if (system === 'all') {
        const newState = !Object.values(window.DEBUG_FLAGS).some(v => v);
        Object.keys(window.DEBUG_FLAGS).forEach(key => {
          window.DEBUG_FLAGS[key] = newState;
        });
        console.log(`🔧 All debug flags: ${newState ? 'ON' : 'OFF'}`);
        return;
      }
      
      if (system in window.DEBUG_FLAGS) {
        window.DEBUG_FLAGS[system] = !window.DEBUG_FLAGS[system];
        console.log(`🔧 Debug ${system}: ${window.DEBUG_FLAGS[system] ? 'ON' : 'OFF'}`);
      } else {
        console.warn(`Unknown debug system: ${system}`);
        console.log('Available: sfx, vfx, spawn, projectiles, ai, damage, loot, xp, all');
      }
    };
    
    /**
     * Mute all debug logs
     */
    window.DEV.muteDebug = () => {
      Object.keys(window.DEBUG_FLAGS).forEach(key => {
        window.DEBUG_FLAGS[key] = false;
      });
      console.log('🔇 All debug logs muted');
    };
    
    // LEGACY: Keep for backward compatibility
    window.DEV.spawnBossLegacy = (arg) => {
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
        console.warn('[DEV] spawnBossLegacy failed:', e?.message);
      }
    };
    window.DEV.listBosses = () => {
      try {
        // PR7: Use BlueprintLoader instead of GameConfig
        const blueprintLoader = scene.blueprintLoader || window.BlueprintLoaderModule?.BlueprintLoader;
        if (!blueprintLoader) {
          console.warn('[DEV] BlueprintLoader not available, falling back to legacy');
          const bosses = GameConfig?.bosses || [];
          bosses.forEach((b, i) => console.log(`${i}: ${b.name} (legacy)`));
          return bosses.map((b, i) => ({ index: i, name: b.name, legacy: true }));
        }
        
        // Get all boss blueprints
        const bossBlueprints = blueprintLoader.getAllOfType?.('boss') || [];
        bossBlueprints.forEach((boss, i) => {
          const displayName = boss.display?.name || boss.meta?.displayName || boss.id;
          console.log(`${i}: ${boss.id} (${displayName})`);
        });
        
        return bossBlueprints.map((boss, i) => ({ 
          index: i, 
          id: boss.id, 
          name: boss.display?.name || boss.meta?.displayName || boss.id,
          blueprint: true
        }));
      } catch (e) {
        console.error('[DEV] listBosses failed:', e);
        return [];
      }
    };

    // PR7: God mode through proper Player API
    window.DEV.setGodMode = (enabled = true) => {
      try {
        const p = scene.player;
        if (!p) { console.warn('[DEV] Player not ready'); return; }
        
        // PR7: Use proper player property instead of direct manipulation
        if (enabled) {
          if (!p._origCanTakeDamage) p._origCanTakeDamage = p.canTakeDamage?.bind(p);
          if (p.canTakeDamage) p.canTakeDamage = () => false;
          p.invincible = true; // This property is expected by the Player class
          console.log('🛡️ DEV God Mode: ON');
        } else {
          if (p._origCanTakeDamage && p.canTakeDamage) p.canTakeDamage = p._origCanTakeDamage;
          p.invincible = false;
          console.log('🛡️ DEV God Mode: OFF');
        }
      } catch (e) { 
        console.warn('[DEV] setGodMode failed:', e?.message); 
      }
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
    
    // === DEBUG SYSTEM CONTROLS ===
    window.DEV.debug = {
      // Enable a debug category
      enable: (category) => DebugLogger.enable(category),
      
      // Disable a debug category
      disable: (category) => DebugLogger.disable(category),
      
      // Set log level
      setLevel: (level) => DebugLogger.setLevel(level),
      
      // Apply a preset
      preset: (name) => DebugLogger.preset(name),
      
      // Show active categories
      showActive: () => DebugLogger.showActive(),
      
      // List all categories with status
      list: () => DebugLogger.list(),
      
      // Silence all except errors
      silence: () => DebugLogger.silence(),
      
      // Enable verbose mode
      verbose: () => DebugLogger.enableVerbose(),
      
      // Reset to config defaults
      reset: () => DebugLogger.reset(),
      
      // Quick toggles
      combat: () => DebugLogger.preset('combat'),
      ai: () => DebugLogger.preset('ai'),
      perf: () => DebugLogger.preset('perf'),
      ui: () => DebugLogger.preset('ui'),
      game: () => DebugLogger.preset('game'),
      fx: () => DebugLogger.preset('fx'),
      all: () => DebugLogger.preset('all'),
      none: () => DebugLogger.preset('none')
    };

    // PR7: Test enemy projectiles through modern ProjectileSystem
    window.DEV.testEnemyBullet = () => {
      console.log('[DEV] Testing enemy bullet...');
      if (scene.projectileSystem && scene.player) {
        // Fire enemy bullet towards player from random position
        const playerX = scene.player.x;
        const playerY = scene.player.y;
        const startX = playerX + 200 + (Math.random() - 0.5) * 100;
        const startY = playerY + (Math.random() - 0.5) * 100;
        
        // PR7: Use modern ProjectileSystem API
        const projectileData = {
          x: startX,
          y: startY,
          projectileBlueprintId: 'projectile.enemy_basic', // Use blueprint ID
          damage: 5,
          speed: 400,
          range: 1000,
          angleRad: Math.atan2(playerY - startY, playerX - startX),
          owner: null // Enemy projectile
        };
        
        const success = scene.projectileSystem.createEnemyProjectile(projectileData);
        console.log('[DEV] Enemy bullet fired:', !!success);
      } else {
        console.warn('[DEV] ProjectileSystem or player not available');
      }
    };
    
    // PR7: Test homing projectiles through modern system
    window.DEV.testHomingBullet = () => {
      console.log('[DEV] Testing homing enemy bullet...');
      if (scene.projectileSystem && scene.player) {
        const playerX = scene.player.x;
        const playerY = scene.player.y;
        const startX = playerX + 300;
        const startY = playerY;
        
        // PR7: Use blueprint-based homing projectile
        const projectileData = {
          x: startX,
          y: startY,
          projectileBlueprintId: 'projectile.enemy_homing', // Blueprint with homing
          damage: 8,
          speed: 300,
          range: 1200,
          angleRad: Math.atan2(playerY - startY, playerX - startX),
          owner: null,
          homing: true // Enable homing behavior
        };
        
        const success = scene.projectileSystem.createEnemyProjectile(projectileData);
        console.log('[DEV] Homing bullet fired:', !!success);
      } else {
        console.warn('[DEV] ProjectileSystem or player not available');
      }
    };
    
    // PR7: Collision monitoring through modern systems
    window.DEV.startCollisionMonitoring = () => {
      if (window.DEV._collisionMonitorInterval) {
        clearInterval(window.DEV._collisionMonitorInterval);
      }
      
      console.log('[DEV] Starting collision monitoring (every 1 second)...');
      window.DEV._collisionMonitorInterval = setInterval(() => {
        try {
          // PR7: Use modern system APIs
          const projectileStats = scene.projectileSystem?.getActiveCount?.() || { player: 0, enemy: 0 };
          const enemiesActive = scene.enemyManager?.getActiveCount?.() || 0;
          const playerHp = scene.player?.hp || 0;
          const playerMaxHp = scene.player?.maxHp || 0;
          
          console.log(`[MONITOR] Player bullets: ${projectileStats.player || 0}, Enemy bullets: ${projectileStats.enemy || 0}, Enemies: ${enemiesActive}, Player HP: ${playerHp}/${playerMaxHp}`);
        } catch (e) {
          console.warn('[MONITOR] Failed to collect stats:', e.message);
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
    
    // PR7: Test explosion through VFX system and damage calculation
    window.DEV.testExplosion = (radius = 100) => {
      console.log('[DEV] Testing explosion...');
      if (scene.player) {
        const playerX = scene.player.x;
        const playerY = scene.player.y;
        
        // PR7: Use VFX system for visual effect
        if (scene.vfxSystem || scene.newVFXSystem) {
          const vfxSystem = scene.newVFXSystem || scene.vfxSystem;
          vfxSystem.play('vfx.explosion.large', playerX, playerY);
        }
        
        // Calculate area damage to nearby enemies
        let enemiesHit = 0;
        if (scene.enemyManager?.getActiveEnemies) {
          const enemies = scene.enemyManager.getActiveEnemies();
          enemies.forEach(enemy => {
            const distance = Phaser.Math.Distance.Between(playerX, playerY, enemy.x, enemy.y);
            if (distance <= radius) {
              enemy.takeDamage({ amount: 50, type: 'explosion', source: 'dev_test' });
              enemiesHit++;
            }
          });
        }
        
        console.log(`✅ Explosion at player position: ${enemiesHit} enemies hit, radius: ${radius}px`);
      } else {
        console.warn('[DEV] Player not available');
      }
    };
    
    // PR7: Enable explosive bullets through modifier system
    window.DEV.enableExplosive = (radius = 50, damage = 25) => {
      try {
        if (!scene.player) {
          console.warn('[DEV] Player not available');
          return;
        }
        
        // PR7: Use modifier system instead of direct baseStats manipulation
        const modifier = {
          id: 'dev_explosive',
          path: 'explosionRadius',
          type: 'add',
          value: radius
        };
        const damageModifier = {
          id: 'dev_explosive_damage',
          path: 'explosionDamage', 
          type: 'add',
          value: damage
        };
        
        scene.player.addModifier(modifier);
        scene.player.addModifier(damageModifier);
        console.log(`✅ Explosive bullets enabled, radius: ${radius}, damage: ${damage}`);
      } catch (e) {
        console.error('[DEV] enableExplosive failed:', e);
      }
    };
    
    // PR7: Enable piercing bullets through modifier system
    window.DEV.enablePiercing = (pierceCount = 3) => {
      try {
        if (!scene.player) {
          console.warn('[DEV] Player not available');
          return;
        }
        
        // PR7: Use modifier system instead of direct baseStats manipulation
        const modifier = {
          id: 'dev_piercing',
          path: 'projectilePiercing',
          type: 'add',
          value: pierceCount
        };
        
        scene.player.addModifier(modifier);
        console.log(`✅ Piercing bullets enabled, pierce count: ${pierceCount}`);
      } catch (e) {
        console.error('[DEV] enablePiercing failed:', e);
      }
    };
    
    // PR7: Performance stress test through modern ProjectileSystem
    window.DEV.stressTestBullets = (count = 100) => {
      console.log(`[DEV] Firing ${count} bullets for performance test...`);
      if (scene.projectileSystem && scene.player) {
        const startTime = performance.now();
        let fired = 0;
        
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          
          // PR7: Use modern ProjectileSystem with blueprint
          const projectileData = {
            x: scene.player.x,
            y: scene.player.y,
            projectileBlueprintId: 'projectile.player_basic',
            damage: 10,
            speed: 400,
            range: 800,
            angleRad: angle,
            owner: scene.player
          };
          
          const success = scene.projectileSystem.createPlayerProjectile(projectileData);
          if (success) fired++;
        }
        
        const endTime = performance.now();
        const activeCount = scene.projectileSystem.getActiveCount?.() || {};
        console.log(`[DEV] Performance test: ${fired}/${count} bullets fired in ${(endTime - startTime).toFixed(2)}ms`);
        console.log(`[DEV] Active projectiles: ${activeCount.player || 0} player, ${activeCount.enemy || 0} enemy`);
      } else {
        console.warn('[DEV] ProjectileSystem or player not available');
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

    // ===== NEW SPAWN COMMANDS FOR ANY ENTITY =====
    
    /**
     * Spawn any enemy by blueprint ID
     * Example: DEV.spawnEnemy('enemy.necrotic_cell')
     */
    window.DEV.spawnEnemy = (blueprintId, x, y) => {
      try {
        if (!blueprintId) {
          console.log('Usage: DEV.spawnEnemy(blueprintId, [x], [y])');
          console.log('Example: DEV.spawnEnemy("enemy.necrotic_cell")');
          return;
        }
        
        // Add prefix if missing
        if (!blueprintId.includes('.')) {
          blueprintId = `enemy.${blueprintId}`;
        }
        
        // Get position (center if not specified)
        const posX = x || scene.cameras.main.width / 2;
        const posY = y || scene.cameras.main.height / 2;
        
        // Use EnemyManager if available
        if (scene.enemyManager) {
          const enemy = scene.enemyManager.spawnEnemy(blueprintId, { x: posX, y: posY });
          console.log(`✅ Spawned enemy: ${blueprintId} at (${posX}, ${posY})`);
          return enemy;
        } else if (scene.createEnemyFromBlueprint) {
          const enemy = scene.createEnemyFromBlueprint(blueprintId, { x: posX, y: posY });
          console.log(`✅ Spawned enemy: ${blueprintId} at (${posX}, ${posY})`);
          return enemy;
        } else {
          console.warn('Enemy spawning not available');
        }
      } catch (e) {
        console.error('[DEV] spawnEnemy failed:', e);
      }
    };
    
    /**
     * Spawn any boss by blueprint ID
     * Example: DEV.spawnBoss('boss.karcinogenni_kral')
     */
    window.DEV.spawnBoss = (blueprintId, x, y) => {
      try {
        // If numeric, use old index-based method
        if (typeof blueprintId === 'number') {
          const bosses = GameConfig?.bosses || [];
          const index = blueprintId;
          if (index >= 0 && index < bosses.length) {
            console.log('[DEV] Spawning boss at index:', index);
            scene.enemyManager?.spawnBoss(index);
            return;
          }
        }
        
        // Blueprint ID based spawn
        if (!blueprintId) {
          console.log('Usage: DEV.spawnBoss(blueprintId, [x], [y])');
          console.log('Example: DEV.spawnBoss("boss.karcinogenni_kral")');
          return;
        }
        
        // Add prefix if missing
        if (typeof blueprintId === 'string' && !blueprintId.includes('.')) {
          blueprintId = `boss.${blueprintId}`;
        }
        
        // Get position (center if not specified)
        const posX = x || scene.cameras.main.width / 2;
        const posY = y || scene.cameras.main.height / 2 - 100;
        
        // Use EnemyManager for bosses too
        if (scene.enemyManager) {
          const boss = scene.enemyManager.spawnBoss(blueprintId, { 
            x: posX, 
            y: posY
          });
          console.log(`✅ Spawned boss: ${blueprintId} at (${posX}, ${posY})`);
          return boss;
        } else if (scene.createEnemyFromBlueprint) {
          const boss = scene.createEnemyFromBlueprint(blueprintId, { 
            x: posX, 
            y: posY,
            boss: true 
          });
          console.log(`✅ Spawned boss: ${blueprintId} at (${posX}, ${posY})`);
          return boss;
        } else {
          console.warn('Boss spawning not available');
        }
      } catch (e) {
        console.error('[DEV] spawnBoss failed:', e);
      }
    };
    
    /**
     * Spawn powerup/drop
     * Example: DEV.spawnDrop('powerup.damage_boost')
     */
    window.DEV.spawnDrop = (blueprintId, x, y) => {
      try {
        if (!blueprintId) {
          console.log('Usage: DEV.spawnDrop(blueprintId, [x], [y])');
          console.log('Example: DEV.spawnDrop("powerup.damage_boost")');
          console.log('Example: DEV.spawnDrop("drop.xp_small")');
          return;
        }
        
        // Get position (center if not specified)
        const posX = x || scene.cameras.main.width / 2;
        const posY = y || scene.cameras.main.height / 2;
        
        // Use lootManager if available
        if (scene.lootManager && scene.lootManager.spawnDrop) {
          scene.lootManager.spawnDrop(blueprintId, posX, posY);
          console.log(`✅ Spawned drop: ${blueprintId} at (${posX}, ${posY})`);
        } else {
          console.warn('LootManager not available');
        }
      } catch (e) {
        console.error('[DEV] spawnDrop failed:', e);
      }
    };
    
    /**
     * Spawn multiple enemies in a wave
     * Example: DEV.spawnWave(5) or DEV.spawnWave(5, 'enemy.necrotic_cell')
     */
    window.DEV.spawnWave = (count = 5, blueprintId = 'enemy.necrotic_cell') => {
      try {
        const centerX = scene.cameras.main.width / 2;
        const centerY = scene.cameras.main.height / 2;
        
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const radius = 100;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          
          window.DEV.spawnEnemy(blueprintId, x, y);
        }
        
        console.log(`✅ Spawned wave of ${count} ${blueprintId}`);
      } catch (e) {
        console.error('[DEV] spawnWave failed:', e);
      }
    };
    
    /**
     * Give player XP
     * Example: DEV.giveXP(1000)
     */
    window.DEV.giveXP = (amount) => {
      try {
        if (scene.gainXP) {
          scene.gainXP(amount);
          console.log(`✅ Added ${amount} XP`);
        }
      } catch (e) {
        console.error('[DEV] giveXP failed:', e);
      }
    };
    
    /**
     * Pause the game
     * Example: DEV.pause()
     */
    window.DEV.pause = () => {
      try {
        const gameScene = scene.scene.get('GameScene');
        const uiScene = scene.scene.get('GameUIScene');
        if (uiScene) {
          scene.game.events.emit('game-pause-request');
          console.log('✅ Game paused');
        }
      } catch (e) {
        console.error('[DEV] pause failed:', e);
      }
    };
    
    /**
     * Resume the game
     * Example: DEV.resume()
     */
    window.DEV.resume = () => {
      try {
        const uiScene = scene.scene.get('GameUIScene');
        if (uiScene?.pauseUI) {
          uiScene.pauseUI.hide();
          console.log('✅ Game resumed');
        }
      } catch (e) {
        console.error('[DEV] resume failed:', e);
      }
    };
    
    /**
     * Select power-up by index
     * Example: DEV.selectPowerUp(0)
     */
    window.DEV.selectPowerUp = (index = 0) => {
      try {
        const uiScene = scene.scene.get('GameUIScene');
        if (uiScene?.powerUpUI) {
          const options = uiScene.powerUpUI.currentOptions;
          if (options && options[index]) {
            uiScene.handlePowerUpSelection(options[index]);
            console.log(`✅ Selected power-up: ${options[index].id}`);
          }
        }
      } catch (e) {
        console.error('[DEV] selectPowerUp failed:', e);
      }
    };
    
    /**
     * Trigger victory
     * Example: DEV.victory()
     */
    window.DEV.victory = () => {
      try {
        if (scene.transitionManager) {
          scene.transitionManager.showVictory();
          console.log('✅ Victory triggered');
        }
      } catch (e) {
        console.error('[DEV] victory failed:', e);
      }
    };
    
    /**
     * Trigger game over
     * Example: DEV.gameOver()
     */
    window.DEV.gameOver = () => {
      try {
        if (scene.transitionManager) {
          scene.transitionManager.gameOver();
          console.log('✅ Game over triggered');
        }
      } catch (e) {
        console.error('[DEV] gameOver failed:', e);
      }
    };
    
    /**
     * Go to main menu
     * Example: DEV.gotoMainMenu()
     */
    window.DEV.gotoMainMenu = () => {
      try {
        scene.scene.stop('GameScene');
        scene.scene.stop('GameUIScene');
        scene.scene.start('MainMenu');
        console.log('✅ Returned to main menu');
      } catch (e) {
        console.error('[DEV] gotoMainMenu failed:', e);
      }
    };
    
    /**
     * Start game
     * Example: DEV.startGame()
     */
    window.DEV.startGame = () => {
      try {
        const mainMenu = scene.scene.get('MainMenu');
        if (mainMenu) {
          mainMenu.scene.stop();
          mainMenu.scene.start('GameScene');
          mainMenu.scene.launch('GameUIScene');
          console.log('✅ Game started');
        }
      } catch (e) {
        console.error('[DEV] startGame failed:', e);
      }
    };
    
    /**
     * Force level transition
     * Example: DEV.forceLevelTransition()
     */
    window.DEV.forceLevelTransition = () => {
      try {
        if (scene.transitionManager) {
          scene.transitionManager.transitionToNextLevel();
          console.log('✅ Level transition triggered');
        }
      } catch (e) {
        console.error('[DEV] forceLevelTransition failed:', e);
      }
    };
    
    /**
     * Kill all enemies instantly
     * Example: DEV.killAll()
     */
    window.DEV.killAll = () => {
      try {
        if (scene.enemyManager) {
          scene.enemyManager.killAll();
          console.log('✅ All enemies killed');
        }
      } catch (e) {
        console.error('[DEV] killAll failed:', e);
      }
    };
    
    /**
     * PR7: Set player health through proper API
     * Example: DEV.setHealth(100)
     */
    window.DEV.setHealth = (hp) => {
      try {
        if (!scene.player) {
          console.warn('[DEV] Player not available');
          return;
        }
        
        // PR7: Use heal method instead of direct hp manipulation
        const currentHp = scene.player.hp;
        const targetHp = Math.max(0, hp);
        
        if (targetHp > currentHp) {
          scene.player.heal(targetHp - currentHp);
        } else if (targetHp < currentHp) {
          // For reducing health, we still need direct access
          scene.player.hp = targetHp;
          // Update HUD through proper method
          if (scene.unifiedHUD?.setPlayerHealth) {
            scene.unifiedHUD.setPlayerHealth(targetHp, scene.player.maxHp);
          }
        }
        
        console.log(`✅ Player health set to ${scene.player.hp}`);
      } catch (e) {
        console.error('[DEV] setHealth failed:', e);
      }
    };
    
    /**
     * PR7: Set player max health with proper validation
     * Example: DEV.setMaxHealth(200)
     */
    window.DEV.setMaxHealth = (maxHp) => {
      try {
        if (!scene.player) {
          console.warn('[DEV] Player not available');
          return;
        }
        
        const newMaxHp = Math.max(1, maxHp); // Ensure minimum 1 HP
        scene.player.maxHp = newMaxHp;
        scene.player.hp = Math.min(scene.player.hp, newMaxHp);
        
        // Update HUD through proper method
        if (scene.unifiedHUD?.setPlayerHealth) {
          scene.unifiedHUD.setPlayerHealth(scene.player.hp, newMaxHp);
        }
        
        console.log(`✅ Player max health set to ${newMaxHp} (current: ${scene.player.hp})`);
      } catch (e) {
        console.error('[DEV] setMaxHealth failed:', e);
      }
    };
    
    /**
     * PR7: Toggle god mode (alias for setGodMode)
     * Example: DEV.godMode()
     */
    window.DEV.godMode = () => {
      try {
        if (!scene.player) {
          console.warn('[DEV] Player not available');
          return;
        }
        
        // PR7: Use the properly implemented setGodMode method
        const currentState = scene.player.invincible || false;
        window.DEV.setGodMode(!currentState);
      } catch (e) {
        console.error('[DEV] godMode failed:', e);
      }
    };
    
    
    /**
     * Clear all enemies (without death effects)
     * Example: DEV.clearEnemies()
     */
    window.DEV.clearEnemies = () => {
      try {
        if (scene.enemies) {
          scene.enemies.clear(true, true);
          console.log(`✅ Cleared all enemies`);
        }
      } catch (e) {
        console.error('[DEV] clearEnemies failed:', e);
      }
    };
    
    /**
     * Clear all projectiles
     * Example: DEV.clearProjectiles()
     */
    window.DEV.clearProjectiles = () => {
      try {
        if (scene.projectileSystem) {
          scene.projectileSystem.clearAll();
          console.log(`✅ Cleared all projectiles`);
        }
      } catch (e) {
        console.error('[DEV] clearProjectiles failed:', e);
      }
    };
    
    /**
     * PR7: Validate XP progression for a spawn table
     * Example: DEV.validateXP('spawnTable.level1')
     */
    window.DEV.validateXP = (spawnTableId) => {
      try {
        console.log(`\n📊 XP Validation for ${spawnTableId}`);
        console.log('='.repeat(60));
        
        // Get spawn table
        const table = scene.blueprintLoader?.getSpawnTable(spawnTableId);
        if (!table) {
          console.error(`❌ Spawn table not found: ${spawnTableId}`);
          return;
        }
        
        const xpPlan = table.meta?.extensions?.xpPlan;
        if (!xpPlan) {
          console.warn('⚠️ No xpPlan found in spawn table meta.extensions');
          return;
        }
        
        // Get progression config
        const CR = window.ConfigResolver;
        const progressionXp = CR.get('progression.xp');
        if (!progressionXp) {
          console.error('❌ No progression.xp config found');
          return;
        }
        
        // Helper to get enemy XP
        const getEnemyXp = (enemyId) => {
          if (xpPlan.enemyXpOverrides?.[enemyId]) {
            return xpPlan.enemyXpOverrides[enemyId];
          }
          const blueprint = scene.blueprintLoader?.get(enemyId);
          if (blueprint?.stats?.xp) {
            return blueprint.stats.xp;
          }
          if (progressionXp.enemyXp?.[enemyId]) {
            return progressionXp.enemyXp[enemyId];
          }
          if (enemyId.startsWith('elite.')) return 20;
          if (enemyId.startsWith('unique.')) return 35;
          return 3;
        };
        
        // Simulate XP per minute
        const results = [];
        const targets = xpPlan.targetXpPerMinute;
        const pity = xpPlan.pity;
        
        console.log(`\n📋 Target budget: ${xpPlan.budgetTotal} XP total`);
        console.log(`🎯 Boss: ${xpPlan.boss.id} (${xpPlan.boss.xp} XP, cap ${xpPlan.boss.capLevelsGranted} levels)`);
        if (pity?.enabled) {
          console.log(`🛡️ Pity: Min ${pity.minXpPerMinute} XP/min for first ${pity.untilMinute} minutes`);
        }
        
        console.log('\n' + '─'.repeat(60));
        console.log('| Min | Target | Actual | Delta | % Diff | Status |');
        console.log('|-----|--------|--------|-------|--------|--------|');
        
        let totalXp = 0;
        
        // Process each minute
        for (let minute = 0; minute < targets.length; minute++) {
          const startMs = minute * 60000;
          const endMs = (minute + 1) * 60000;
          
          // Get target with pity
          let target = targets[minute] || targets[targets.length - 1];
          if (pity?.enabled && minute < (pity.untilMinute || 4)) {
            target = Math.max(target, pity.minXpPerMinute || 60);
          }
          
          // Calculate actual XP from waves
          let actualXp = 0;
          table.enemyWaves?.forEach(wave => {
            if (wave.startAt < endMs && wave.endAt > startMs) {
              const enemyXp = getEnemyXp(wave.enemyId);
              const avgCount = (wave.countRange[0] + wave.countRange[1]) / 2;
              const spawnsPerMinute = 60000 / wave.interval;
              const waveXp = enemyXp * avgCount * spawnsPerMinute * (wave.weight / 100);
              actualXp += waveXp;
            }
          });
          
          // Add elite/unique contributions (estimated)
          table.eliteWindows?.forEach(elite => {
            if (elite.startAt < endMs && elite.endAt > startMs) {
              const eliteXp = getEnemyXp(elite.enemyId);
              const avgCount = (elite.countRange[0] + elite.countRange[1]) / 2;
              const spawnsPerMinute = 60000 / (elite.cooldown || 15000);
              const eliteContrib = eliteXp * avgCount * spawnsPerMinute * (elite.weight / 100);
              actualXp += eliteContrib * 0.3; // Elite spawn probability adjustment
            }
          });
          
          totalXp += actualXp;
          
          const delta = actualXp - target;
          const percentDiff = ((actualXp - target) / target * 100).toFixed(1);
          const status = Math.abs(delta) <= target * 0.1 ? '✅' : 
                         Math.abs(delta) <= target * 0.2 ? '⚠️' : '❌';
          
          console.log(`| ${minute.toString().padEnd(3)} | ${target.toString().padEnd(6)} | ${Math.round(actualXp).toString().padEnd(6)} | ${delta.toFixed(0).padEnd(5)} | ${percentDiff.padStart(6)}% | ${status.padEnd(6)} |`);
          
          results.push({
            minute,
            target,
            actual: actualXp,
            delta,
            percentDiff: parseFloat(percentDiff),
            status
          });
        }
        
        console.log('─'.repeat(60));
        
        // Summary
        const avgDiff = results.reduce((sum, r) => sum + Math.abs(r.percentDiff), 0) / results.length;
        const withinTolerance = results.filter(r => Math.abs(r.percentDiff) <= 10).length;
        const warnings = results.filter(r => Math.abs(r.percentDiff) > 10 && Math.abs(r.percentDiff) <= 20).length;
        const errors = results.filter(r => Math.abs(r.percentDiff) > 20).length;
        
        console.log('\n📈 Summary:');
        console.log(`  Total XP accumulated: ${Math.round(totalXp)}`);
        console.log(`  Budget target: ${xpPlan.budgetTotal}`);
        console.log(`  Average deviation: ${avgDiff.toFixed(1)}%`);
        console.log(`  ✅ Within tolerance (±10%): ${withinTolerance}/${results.length}`);
        console.log(`  ⚠️ Warnings (±10-20%): ${warnings}/${results.length}`);
        console.log(`  ❌ Errors (>±20%): ${errors}/${results.length}`);
        
        if (avgDiff <= 10) {
          console.log('\n✅ XP progression is well-tuned!');
        } else if (avgDiff <= 20) {
          console.log('\n⚠️ XP progression needs minor adjustments');
        } else {
          console.log('\n❌ XP progression needs significant retuning');
        }
        
        // Boss XP validation
        if (xpPlan.boss) {
          const bossXp = xpPlan.boss.xp;
          const capLevels = xpPlan.boss.capLevelsGranted || 1.5;
          const baseReq = progressionXp.baseRequirement || 10;
          const scaling = progressionXp.scalingMultiplier || 1.5;
          const maxAllowed = baseReq * Math.pow(scaling, capLevels);
          const clamped = Math.min(bossXp, maxAllowed);
          
          console.log('\n🐉 Boss XP Validation:');
          console.log(`  Boss: ${xpPlan.boss.id}`);
          console.log(`  Configured XP: ${bossXp}`);
          console.log(`  Max allowed (${capLevels} levels): ${Math.round(maxAllowed)}`);
          console.log(`  Final XP: ${Math.round(clamped)} ${clamped < bossXp ? '(clamped)' : '✅'}`);
        }
        
        console.log('\n' + '='.repeat(60));
        
      } catch (e) {
        console.error('[DEV] validateXP failed:', e);
      }
    };
    
    // PR7: Updated help messages with modern API references
    console.log('🎮 ===== DEV CONSOLE (PR7 Compatible) =====');
    console.log('✅ Blueprint-driven spawn: DEV.spawnEnemy("enemy.necrotic_cell"), DEV.spawnBoss("boss.karcinogenni_kral")');
    console.log('✅ Legacy support: DEV.spawnBossLegacy(5), DEV.listBosses() - shows both blueprint & legacy');
    console.log('✅ Player management: DEV.setHealth(100), DEV.godMode(), DEV.setGodMode(true)');
    console.log('✅ Modern power-ups: DEV.enableExplosive(50, 25), DEV.enablePiercing(3) - via modifier system');
    console.log('✅ System management: DEV.killAll(), DEV.clearProjectiles(), DEV.giveXP(1000)');
    console.log('✅ XP progression: DEV.validateXP("spawnTable.level1") - PR7 validation system');
    console.log('✅ Performance tests: DEV.stressTestBullets(100), DEV.testExplosion(100)');
    console.log('✅ Debug system: DEV.debug.list(), DEV.debug.preset("combat"), DEV.debug.enable("ai")');
    console.log('✅ Game flow: DEV.victory(), DEV.gameOver(), DEV.pause(), DEV.resume()');
    console.log('✅ Monitoring: DEV.startCollisionMonitoring(), __phase5Debug.performance.report()');
    console.log('🔧 Type DEV.[method]() for individual commands or __phase5Debug.vfx.test() for VFX testing');
    
    // PR7: Validate critical systems are available
    const criticalSystems = [
      'enemyManager', 'projectileSystem', 'player'
    ];
    
    const missingSystem = criticalSystems.find(sys => !scene[sys]);
    if (missingSystem) {
      console.warn(`⚠️ Critical system missing: ${missingSystem} - some DEV commands may fail`);
    } else {
      console.log('✅ All critical systems detected - DEV console fully operational');
    }
    
  } catch (error) { 
    console.error('❌ DevConsole installation failed:', error);
  }
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

        // PR7: Performance monitoring with modern systems
        performance: {
            report: () => {
                const scene = getCurrentScene();
                if (!scene) return console.warn('No active scene');
                
                const report = {
                    fps: scene.game.loop.actualFps,
                    enemies: {
                        active: scene.enemyManager?.getActiveCount?.() || 0,
                        total: scene.enemyManager?.enemies?.children?.size || 0
                    },
                    projectiles: scene.projectileSystem?.getActiveCount?.() || 'N/A',
                    vfx: scene.newVFXSystem?.getDebugStats?.() || 'N/A',
                    loot: scene.simpleLootSystem?.getActiveCount?.() || 0,
                    player: {
                        hp: scene.player?.hp || 0,
                        maxHp: scene.player?.maxHp || 0,
                        modifiers: scene.player?.activeModifiers?.length || 0
                    }
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


