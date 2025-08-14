// SpawnSystem – jednotné řízení spawnu nepřátel (Fáze 10)
// - PR7: Čte konfiguraci z ConfigResolver, ne GameConfig
// - Používá EnemyRegistry pro blueprint overrides (parita s EnemyManager)
// - Aplikuje DifficultyScaling na hp/damage/speed

// PR7: GameConfig removed - use ConfigResolver only
// import { GameConfig } from '../../config.js';
import { Enemy } from '../../entities/Enemy.js';
import { EnemyRegistry } from '../registry/EnemyRegistry.js';
import { DifficultyScalingSystem } from './DifficultyScalingSystem.js';

export class SpawnSystem {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.scaling = new DifficultyScalingSystem(scene);
    this.timerAcc = 0;
    // PR7: Get spawn interval from ConfigResolver
    const CR = scene.configResolver || window.ConfigResolver;
    this.spawnInterval = CR ? CR.get('spawn.initialInterval', { defaultValue: 2000 }) : 2000;
  }

  update(time, delta) {
    if (this.scene.isPaused) return;
    
    this.timerAcc += delta;
    
    // Debug: Log spawn timing every 5 seconds
    if (Math.floor(time / 5000) !== Math.floor((time - delta) / 5000)) {
      console.log('[SpawnSystem] Timer:', Math.round(this.timerAcc), '/', Math.round(this.spawnInterval), 'ms. Next spawn in:', Math.round(this.spawnInterval - this.timerAcc), 'ms');
    }
    
    if (this.timerAcc >= this.spawnInterval) {
      console.log('[SpawnSystem] Attempting spawn...');
      this.timerAcc = 0;
      this.spawnOne();
    }
    // PR7: Get minimum spawn interval from ConfigResolver
    const CR = this.scene.configResolver || window.ConfigResolver;
    const minInterval = CR ? CR.get('spawn.minInterval', { defaultValue: 500 }) : 500;
    // Postupné zrychlování spawnu
    if (this.spawnInterval > minInterval) {
      this.spawnInterval -= delta * 0.005; // držíme shodně s EnemyManager
    }
  }

  spawnOne() {
    const s = this.scene;
    const em = s.enemyManager;
    if (!em) {
      console.log('[SpawnSystem] No enemyManager found');
      return;
    }
    // Dynamické maximum
    const playerLevel = s.gameStats?.level || 1;
    // PR7: Get max enemies from ConfigResolver
    const CR = this.scene.configResolver || window.ConfigResolver;
    const maxEnemiesLimit = CR ? CR.get('spawn.maxEnemies', { defaultValue: 50 }) : 50;
    const dynamicMaxEnemies = Math.min(maxEnemiesLimit, 20 + (playerLevel * 2));
    const currentEnemyCount = em.enemies.countActive() || 0;
    
    console.log('[SpawnSystem] Level:', playerLevel, 'Enemies:', currentEnemyCount, '/', dynamicMaxEnemies);
    
    if (currentEnemyCount >= dynamicMaxEnemies) {
      console.log('[SpawnSystem] Max enemies reached, skipping spawn');
      return;
    }

    // Aktualizovat dostupné typy a vybrat jeden
    try { em.updateAvailableEnemyTypes(); } catch (_) {}
    const type = em.enemyTypes[Math.floor(Math.random() * em.enemyTypes.length)];
    // PR7: Get enemy config from BlueprintLoader or ConfigResolver
    const baseConfig = this.scene.blueprintLoader?.get(`enemy.${type}`) || null;
    if (!baseConfig) return;

    // Škálování obtížnosti
    const mult = this.scaling.getMultipliers(playerLevel);
    const eliteChance = 0.05 + (playerLevel - 1) * 0.01;
    const isElite = Math.random() < eliteChance && playerLevel >= 3;
    const eliteMultiplier = isElite ? 1.4 : 1;

    let config = {
      ...baseConfig,
      speed: baseConfig.speed * mult.spd,
      hp: Math.floor(baseConfig.hp * mult.hp * eliteMultiplier),
      damage: Math.floor(baseConfig.damage * mult.dmg * eliteMultiplier),
      xp: Math.floor(baseConfig.xp * (1 + (playerLevel - 1) * 0.2) * (isElite ? 3 : 1)),
      size: baseConfig.size * (isElite ? 1.3 : 1),
      isElite
    };

    // Blueprint override (parita s EnemyManager)
    try {
      // Použít data z blueprintů
      if (true) {
        const map = { red: 'basic_cell', orange: 'orange_tumor', green: 'green_heavy', purple: 'purple_support', brown: 'brown_shooter' };
        const bpName = map[type] || type;
        const bp = EnemyRegistry.get(bpName);
        if (bp?.components) {
          const c = bp.components;
          const size = c.Transform?.size ?? config.size;
          const speed = (c.Kinematics?.speed ?? config.speed) * mult.spd;
          const hp = Math.floor((c.Health?.maxHp ?? config.hp) * mult.hp * eliteMultiplier);
          const damage = Math.floor((c.Combat?.contactDamage ?? config.damage) * mult.dmg * eliteMultiplier);
          const xp = Math.floor((c.LootDrop?.xp ?? config.xp) * (1 + (playerLevel - 1) * 0.2) * (isElite ? 3 : 1));
          config = { ...config, size, speed, hp, damage, xp };
        }
      }
    } catch (_) {}

    // Náhodná pozice na okraji obrazovky
    const side = Math.floor(Math.random() * 4);
    let x, y;
    switch (side) {
      case 0: x = Math.random() * s.cameras.main.width; y = -50; break; // top
      case 1: x = s.cameras.main.width + 50; y = Math.random() * s.cameras.main.height; break; // right
      case 2: x = Math.random() * s.cameras.main.width; y = s.cameras.main.height + 50; break; // bottom
      case 3: x = -50; y = Math.random() * s.cameras.main.height; break; // left
    }

    const enemy = new Enemy(s, x, y, type, config);
    em.enemies.add(enemy);
    
    console.log('[SpawnSystem] Enemy spawned:', type, 'at', x, y, 'total enemies now:', em.enemies.countActive() || 0);

    // Analytics: spawn event
    try {
      s.analyticsManager?.trackEnemySpawn?.(enemy.isElite ? `elite:${type}` : type, playerLevel);
    } catch (_) {}
  }
}


