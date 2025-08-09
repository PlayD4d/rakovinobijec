import { GameConfig } from '../config.js';
import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';

export class EnemyManager {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        
        this.enemies = scene.physics.add.group();
        this.currentBoss = null;
        
        this.spawnTimer = 0;
        this.spawnInterval = GameConfig.spawn.initialInterval;
        this.defeatedBosses = []; // Seznam poražených bossů pro náhodný spawn
        
        // Progresivní odemykání nepřátel podle úrovně
        this.allEnemyTypes = ['red', 'orange', 'green', 'purple', 'brown'];
        this.enemyTypes = ['red']; // Začínáme jen s červenými
        
        // Začít spawn timer
        this.startSpawning();
    }
    
    // Najde bezpečnou pozici pro spawn bosse s ohledem na vzdálenost od hráče
    getSafeBossSpawnPosition(safetyRadius = 220) {
        const camera = this.scene.cameras.main;
        const width = camera.width;
        const height = camera.height;
        const playerX = this.scene.player?.x ?? width / 2;
        const playerY = this.scene.player?.y ?? height / 2;
        
        // Kandidátní pozice na okrajích obrazovky (mírně dovnitř kvůli viditelnosti)
        const margin = 50;
        const candidates = [
            { x: width / 2, y: margin },                 // Top center
            { x: width - margin, y: height / 2 },        // Right center
            { x: width / 2, y: height - margin },        // Bottom center
            { x: margin, y: height / 2 },                // Left center
            { x: margin, y: margin },                    // Top-left
            { x: width - margin, y: margin },            // Top-right
            { x: width - margin, y: height - margin },  // Bottom-right
            { x: margin, y: height - margin }           // Bottom-left
        ];
        
        const distanceToPlayer = (p) => {
            const dx = p.x - playerX;
            const dy = p.y - playerY;
            return Math.hypot(dx, dy);
        };
        
        // Preferuj pozice s dostatečnou vzdáleností
        const safe = candidates.filter(p => distanceToPlayer(p) >= safetyRadius);
        if (safe.length > 0) {
            // Vyber náhodně z bezpečných pozic (přirozenější spawn)
            return safe[Math.floor(Math.random() * safe.length)];
        }
        
        // Fallback: vyber obecně nejvzdálenější z kandidátů
        return candidates.reduce((best, p) => distanceToPlayer(p) > distanceToPlayer(best) ? p : best, candidates[0]);
    }
    
    updateAvailableEnemyTypes() {
        const playerLevel = this.scene.gameStats.level;
        
        // Progresivní odemykání nepřátel
        if (playerLevel >= 1) this.enemyTypes = ['red'];
        if (playerLevel >= 2) this.enemyTypes = ['red', 'orange'];
        if (playerLevel >= 4) this.enemyTypes = ['red', 'orange', 'green'];
        if (playerLevel >= 6) this.enemyTypes = ['red', 'orange', 'green', 'purple'];
        if (playerLevel >= 8) this.enemyTypes = ['red', 'orange', 'green', 'purple', 'brown'];
    }
    
    startSpawning() {
        this.spawnEvent = this.scene.time.addEvent({
            delay: this.spawnInterval,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });
    }
    
    update(time, delta) {
        // Nekud hra není pozastavená
        if (this.scene.isPaused) {
            return;
        }
        
        // Aktualizovat dostupné typy nepřátel podle úrovně
        this.updateAvailableEnemyTypes();
        
        // Update všech nepřátel
        this.enemies.children.entries.forEach(enemy => {
            if (enemy.active) {
                enemy.update(time, delta);
            }
        });
        
        // Postupné zrychlování spawnu (pomalejší progrese)
        if (this.spawnInterval > GameConfig.spawn.minInterval) {
            this.spawnInterval -= delta * 0.005; // Zpomaleno z 0.01 na 0.005
            this.spawnEvent.delay = this.spawnInterval;
        }
    }
    
    spawnEnemy() {
        // Nekud hra není pozastavená
        if (this.scene.isPaused) {
            return;
        }
        
        // 0.01% šance na spawn náhodného poraženého bosse
        if (this.defeatedBosses.length > 0 && Math.random() < 0.0001) {
            this.spawnRandomDefeatedBoss();
            return;
        }
        
        // Dynamické maximum nepřátel podle levelu (base + 2 za level)
        const playerLevel = this.scene.gameStats.level;
        const dynamicMaxEnemies = Math.min(GameConfig.spawn.maxEnemies, 20 + (playerLevel * 2));
        
        if (this.enemies.children.entries.length >= dynamicMaxEnemies) {
            return;
        }
        
        // Náhodný typ nepřítele
        const type = this.enemyTypes[Math.floor(Math.random() * this.enemyTypes.length)];
        const baseConfig = GameConfig.enemies[type];
        
        // Progresivní zvyšování obtížnosti s úrovněmi
        const difficultyMultiplier = 1 + (playerLevel - 1) * 0.1; // +10% za úroveň
        
        // Šance na elitního nepřítele (5% + 1% za každý level)
        const eliteChance = 0.05 + (playerLevel - 1) * 0.01;
        const isElite = Math.random() < eliteChance && playerLevel >= 3; // Elitní až od levelu 3
        
        const eliteMultiplier = isElite ? 1.4 : 1; // Sníženo z 2 na 1.4
        
        const config = {
            ...baseConfig,
            speed: baseConfig.speed * difficultyMultiplier,
            hp: Math.floor(baseConfig.hp * difficultyMultiplier * eliteMultiplier),
            damage: Math.floor(baseConfig.damage * difficultyMultiplier * eliteMultiplier),
            // XP roste s levelem hráče (každý level +20% XP)
            // Elitní nepřátelé dávají 3x více XP
            xp: Math.floor(baseConfig.xp * (1 + (playerLevel - 1) * 0.2) * (isElite ? 3 : 1)),
            size: baseConfig.size * (isElite ? 1.3 : 1), // Elitní jsou větší
            isElite: isElite
        };
        
        // Debug - zkontrolovat jestli config existuje
        if (!config) {
            console.error(`Enemy config not found for type: ${type}`);
            console.log('Available enemy types:', Object.keys(GameConfig.enemies));
            return;
        }
        
        // Náhodná pozice na okraji obrazovky
        const side = Math.floor(Math.random() * 4);
        let x, y;
        
        switch (side) {
            case 0: // Nahoře
                x = Math.random() * this.scene.cameras.main.width;
                y = -50;
                break;
            case 1: // Vpravo
                x = this.scene.cameras.main.width + 50;
                y = Math.random() * this.scene.cameras.main.height;
                break;
            case 2: // Dole
                x = Math.random() * this.scene.cameras.main.width;
                y = this.scene.cameras.main.height + 50;
                break;
            case 3: // Vlevo
                x = -50;
                y = Math.random() * this.scene.cameras.main.height;
                break;
        }
        
        const enemy = new Enemy(this.scene, x, y, type, config);
        this.enemies.add(enemy);
    }
    
    spawnBoss(bossIndex) {
        if (this.currentBoss && this.currentBoss.active) {
            return; // Už je boss
        }
        
        const bossConfigs = GameConfig.bosses;
        if (bossIndex >= bossConfigs.length) {
            bossIndex = bossConfigs.length - 1; // Použít posledního bosse
        }
        
        const bossConfig = bossConfigs[bossIndex];
        
        // Najít bezpečnou pozici vzhledem k hráči
        const safePos = this.getSafeBossSpawnPosition(240);
        const x = safePos.x;
        const y = safePos.y;
        
        this.currentBoss = new Boss(this.scene, x, y, bossConfig, bossIndex);
        this.enemies.add(this.currentBoss);
        
        // Dočasně zastavit spawn normálních nepřátel
        this.spawnEvent.paused = true;
    }
    
    markBossAsDefeated(bossIndex) {
        // Přidat bosse do seznamu poražených (pokud už tam není)
        if (!this.defeatedBosses.includes(bossIndex)) {
            this.defeatedBosses.push(bossIndex);
            console.log(`Boss ${bossIndex} marked as defeated. Total defeated: ${this.defeatedBosses.length}`);
        }
    }
    
    spawnRandomDefeatedBoss() {
        if (this.defeatedBosses.length === 0) return;
        
        // Vybrat náhodného poraženého bosse
        const randomIndex = Math.floor(Math.random() * this.defeatedBosses.length);
        const bossIndex = this.defeatedBosses[randomIndex];
        
        console.log(`Spawning random defeated boss: ${bossIndex}`);

        // Bezpečná pozice vzhledem k hráči
        const safePos = this.getSafeBossSpawnPosition(240);
        const x = safePos.x;
        const y = safePos.y;
        
        // Spawnovat bosse s trochu sníženým HP (80% původního)
        const bossConfigs = GameConfig.bosses;
        const bossConfig = { ...bossConfigs[bossIndex] };
        bossConfig.hp *= 0.8; // Náhodní bossové jsou o něco slabší
        
        const level = Math.floor(this.scene.gameStats.level / GameConfig.spawn.bossLevelInterval);
        const boss = this.scene.physics.add.existing(new Boss(this.scene, x, y, bossConfig, level));
        
        this.enemies.add(boss);
        return boss;
    }
    
    removeEnemy(enemy) {
        // Pokud byl boss poražen, obnovit spawn
        if (enemy === this.currentBoss) {
            this.currentBoss = null;
            this.spawnEvent.paused = false;
            this.scene.gameStats.bossesDefeated++;
            // Přidat jméno bosse do seznamu poražených
            if (enemy.bossName) {
                this.scene.gameStats.bossesDefeatedList.push(enemy.bossName);
            }
        }
        
        // Odstranit z groupy před destroy
        this.enemies.remove(enemy);
        
        // Bezpečné destroy
        if (enemy && enemy.destroy && typeof enemy.destroy === 'function') {
            enemy.destroy();
        }
    }
    
    clearAll() {
        this.enemies.clear(true, true);
        this.currentBoss = null;
    }
}