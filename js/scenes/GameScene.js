import { GameConfig } from '../config.js';
import { Player } from '../entities/Player.js';
import { EnemyManager } from '../managers/EnemyManager.js';
import { ProjectileManager } from '../managers/ProjectileManager.js';
import { UIManager } from '../managers/UIManager.js';
import { LootManager } from '../managers/LootManager.js';
import { PowerUpManager } from '../managers/PowerUpManager.js';
import { MobileControlsManager } from '../managers/MobileControlsManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { PauseMenu } from '../managers/PauseMenu.js';
import { HighScoreManager } from '../managers/HighScoreManager.js';
import { GlobalHighScoreManager } from '../managers/GlobalHighScoreManager.js';
import { AnalyticsManager } from '../managers/AnalyticsManager.js';
import { SupabaseClient } from '../utils/supabaseClient.js';
import { createFontConfig, waitForFont, PRESET_STYLES } from '../fontConfig.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        
        this.player = null;
        this.enemyManager = null;
        this.projectileManager = null;
        this.uiManager = null;
        this.lootManager = null;
        this.powerUpManager = null;
        this.audioManager = null;
        this.pauseMenu = null;
        this.analyticsManager = null;
        this.mobileControls = null;
        
        this.gameStats = {
            level: 1,
            xp: 0,
            xpToNext: GameConfig.xp.baseRequirement,
            score: 0,
            enemiesKilled: 0,
            time: 0,
            bossesDefeated: 0,
            bossesDefeatedList: [], // Array jmen poražených bossů
            totalDamageDealt: 0,
            totalDamageTaken: 0, 
            xpCollected: 0,
            healthPickups: 0,
            powerUpsCollected: 0
        };
        
        // Tracking příčiny smrti
        this.lastDeathCause = { type: 'unknown', damage: 0 };
        this.lastHpBeforeDeath = null;
        
        this.isPaused = false;
        this.isGameOver = false;
        this.lastShoot = 0;
    }
    
    preload() {
        console.log('Preloading audio files...');
        
        // Načtení hudby - více level tracků
        this.load.audio('levelMusic1', 'music/level_1.mp3');
        this.load.audio('levelMusic2', 'music/level_2.mp3');
        this.load.audio('levelMusic3', 'music/level_3.mp3');
        this.load.audio('bossMusic', 'music/boss.mp3');
        
        // Načtení zvuků
        this.load.audio('hit', 'sound/hit.mp3');
        this.load.audio('intro', 'sound/intro.mp3');
        this.load.audio('levelup', 'sound/levelup.mp3');
        this.load.audio('pickup', 'sound/pickup.mp3');
        this.load.audio('playerDeath', 'sound/player_death.mp3');
        this.load.audio('powerup', 'sound/powerup.mp3');
        this.load.audio('readyFight', 'sound/ready_fight.mp3');
        this.load.audio('bossEnter', 'sound/boss_enter.mp3');
        this.load.audio('gameOver', 'sound/game_over.mp3');
        
        // Debug loading - více detailní
        this.load.on('filecomplete', (key, type, data) => {
            console.log(`✓ Audio loaded: ${key} (${type})`);
        });
        
        this.load.on('loaderror', (file) => {
            console.error(`✗ Failed to load: ${file.key} from ${file.url}`);
        });
        
        this.load.on('complete', () => {
            console.log('All audio files loading complete');
            // Otestuj dostupnost audio klíčů
            const audioKeys = ['levelMusic1', 'levelMusic2', 'levelMusic3', 'bossMusic', 'hit', 'intro', 'levelup', 'pickup', 'playerDeath', 'powerup', 'readyFight', 'bossEnter', 'gameOver'];
            audioKeys.forEach(key => {
                const audioExists = this.cache.audio.has(key);
                console.log(`Audio cache ${key}: ${audioExists ? '✓' : '✗'}`);
            });
        });
    }
    
    async create() {
        // Font načítání se udělá synchronně - font je už načtený z MainMenu
        
        // Reset stavů pro restart
        this.isPaused = false;
        this.isGameOver = false;
        this.lastShoot = 0;
        
        // Reset game stats
        this.gameStats = {
            level: 1,
            xp: 0,
            xpToNext: GameConfig.xp.baseRequirement,
            score: 0,
            enemiesKilled: 0,
            time: 0,
            bossesDefeated: 0,
            // Analytics tracking
            totalDamageDealt: 0,
            totalDamageTaken: 0,
            xpCollected: 0,
            healthPickups: 0,
            powerUpsCollected: 0,
            bossesDefeatedList: []
        };
        
        // Ujistit se že physics běží
        this.physics.resume();
        
        // Inicializace manažerů
        this.audioManager = new AudioManager(this);
        this.projectileManager = new ProjectileManager(this);
        this.lootManager = new LootManager(this);
        this.powerUpManager = new PowerUpManager(this);
        this.pauseMenu = new PauseMenu(this);
        
        // Vytvoření hráče na středu aktuální obrazovky
        this.player = new Player(
            this, 
            this.cameras.main.width / 2, 
            this.cameras.main.height / 2
        );
        
        // Inicializace nepřátel
        this.enemyManager = new EnemyManager(this, this.player);
        
        // Inicializace high score managerů
        this.highScoreManager = new HighScoreManager();
        this.globalHighScoreManager = new GlobalHighScoreManager();
        this.globalHighScoreManager.setLocalFallback(this.highScoreManager);
        
        // Inicializace analytics se sdílenou Supabase instancí
        this.analyticsManager = new AnalyticsManager(
            SupabaseClient.getInstance(),
            { allowAnalytics: true } // TODO: Load from settings
        );
        
        // UI
        this.uiManager = new UIManager(this);
        this.uiManager.create();
        
        // Ovládání
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Inicializace pause menu
        this.pauseMenu.create();
        
        // Mobile controls init (optional per settings)
        try {
            const mobileEnabled = localStorage.getItem('mobileControlsEnabled') === 'true';
            const side = localStorage.getItem('mobileControlsSide') || 'left';
            if (mobileEnabled) {
                this.mobileControls = new MobileControlsManager(this, { side });
                this.mobileControls.enable();
            }
        } catch (_) { /* no-op */ }

        // Dočasně přeskočit READY/FIGHT sekvenci pro debug
        // this.startReadyFightSequence();
        await this.startGame();
        
        // Resize event handling
        this.scale.on('resize', this.handleResize, this);
        
        // Časovač pro statistiky
        this.time.addEvent({
            delay: 1000,
            callback: this.updateTime,
            callbackScope: this,
            loop: true
        });
        
        // Automatická střelba bude v update cyklu
    }
    
    startReadyFightSequence() {
        // Pozastavit hru během sekvence
        this.isPaused = true;
        
        // Přehrát ready_fight zvuk
        this.audioManager.playSound('readyFight');
        
        // READY text
        const readyText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            'READY',
            createFontConfig('huge', 'white', { stroke: true, strokeThickness: 8 })
        ).setOrigin(0.5);
        readyText.setAlpha(0);
        
        // READY animace - fade in
        this.tweens.add({
            targets: readyText,
            alpha: 1,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            ease: 'Power2'
        });
        
        // Po 1.5 sekundách fade out READY a ukázat FIGHT
        this.time.delayedCall(1500, () => {
            // Fade out READY
            this.tweens.add({
                targets: readyText,
                alpha: 0,
                duration: 300,
                onComplete: () => readyText.destroy()
            });
            
            // FIGHT text
            const fightText = this.add.text(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2,
                'FIGHT',
                createFontConfig('huge', 'red', { stroke: true, strokeThickness: 8 })
            ).setOrigin(0.5);
            fightText.setAlpha(0);
            
            // FIGHT animace
            this.tweens.add({
                targets: fightText,
                alpha: 1,
                scaleX: 1.3,
                scaleY: 1.3,
                duration: 400,
                ease: 'Back.easeOut'
            });
            
            // Po 1 sekundě fade out FIGHT a spustit hru
            this.time.delayedCall(1000, () => {
                this.tweens.add({
                    targets: fightText,
                    alpha: 0,
                    duration: 400,
                    onComplete: async () => {
                        fightText.destroy();
                        await this.startGame();
                    }
                });
            });
        });
    }
    
    async startGame() {
        // Spustit hru
        this.isPaused = false;
        
        // Spustit analytics session
        // Pokusit se získat jméno z localStorage nebo high scores
        const lastPlayerName = localStorage.getItem('lastPlayerName') || 
                               this.highScoreManager.getLastPlayerName() ||
                               null;
        
        await this.analyticsManager.startSession(lastPlayerName);
        
        // Motivační zpráva pro Mardu
        const motivationText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height - 50,
            'Jdi na to, Mardo! Poraz všechny škodlivé buňky! 💪',
            createFontConfig('small', 'cyan', { stroke: true })
        ).setOrigin(0.5);
        motivationText.setBackgroundColor('#000000');
        motivationText.setPadding(15, 8);
        
        // Automaticky skryj zprávu po 4 sekundách
        this.time.delayedCall(4000, () => {
            if (motivationText.active) {
                this.tweens.add({
                    targets: motivationText,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => motivationText.destroy()
                });
            }
        });
        
        // Spustit hudbu
        this.audioManager.playLevelMusic();
        
        // Aktualizovat počáteční XP UI
        this.uiManager.updateXP(this.gameStats.xp, this.gameStats.xpToNext);
    }
    
    update(time, delta) {
        if (this.isGameOver || this.isPaused) return;
        
        // Performance tracking - track low FPS issues
        if (this.analyticsManager && delta > 33) { // Více než 33ms = pod 30 FPS
            this.analyticsManager.trackPerformanceIssue('low_fps', {
                delta: delta,
                fps: Math.round(1000 / delta),
                level: this.gameStats.level,
                enemies: this.enemyManager?.enemies?.children?.entries?.length || 0
            });
        }
        
        try {
            // Automatická střelba
            if (time - this.lastShoot > 1000) { // 1 sekunda
                this.playerShoot();
                this.lastShoot = time;
            }
            
            // Update hráče
            this.player.update(this.cursors, this.wasd, time, delta);
            
            // Update manažerů
            this.enemyManager.update(time, delta);
            this.projectileManager.update(time, delta);
            this.lootManager.update(time, delta);
            
            // Kontrola kolizí
            this.checkCollisions();
            
            // Update UI
            this.uiManager.update();
            
        } catch (error) {
            // Track game update errors
            if (this.analyticsManager) {
                this.analyticsManager.trackPerformanceIssue('error', {
                    error: error.message,
                    stack: error.stack,
                    level: this.gameStats.level
                });
            }
            console.error('Game update error:', error);
        }
    }
    
    playerShoot() {
        if (this.isGameOver || this.isPaused) return;
        
        // Normální projektily - použít aktuální player stats
        const projectileCount = this.player.projectileCount;
        const projectileSpeed = GameConfig.player.projectileSpeed + (this.player.speedBonus * 50); // Speed bonus ovlivní i projektily
        const angleStep = (Math.PI * 2) / projectileCount;
        
        for (let i = 0; i < projectileCount; i++) {
            const angle = angleStep * i;
            const velocity = {
                x: Math.cos(angle) * projectileSpeed,
                y: Math.sin(angle) * projectileSpeed
            };
            
            this.projectileManager.createPlayerProjectile(
                this.player.x,
                this.player.y,
                velocity,
                this.player.projectileDamage
            );
        }
        
    }
    
    // Univerzální tracking uděleného poškození (centrální místo)
    recordDamageDealt(amount, enemyOrType) {
        const numericAmount = Number(amount);
        if (!isFinite(numericAmount) || numericAmount <= 0) {
            return;
        }
        
        // Akumulace do session statistik
        this.gameStats.totalDamageDealt += numericAmount;
        
        // Určení typu nepřítele pro analytics
        let enemyType = 'unknown';
        if (typeof enemyOrType === 'string') {
            enemyType = enemyOrType;
        } else if (enemyOrType) {
            const baseType = enemyOrType.type || 'unknown';
            enemyType = enemyOrType.isElite ? `elite:${baseType}` : baseType;
        }
        
        // Pokud cíl je boss, akumulovat boss damage
        if (enemyOrType && enemyOrType.bossName && this.analyticsManager && typeof this.analyticsManager.recordBossDamageDealt === 'function') {
            this.analyticsManager.recordBossDamageDealt(numericAmount);
        }
        
        // Odeslat do analytics (pokud je dostupný)
        if (this.analyticsManager && typeof this.analyticsManager.trackDamageDealt === 'function') {
            this.analyticsManager.trackDamageDealt(numericAmount, enemyType);
        }
    }
    
    checkCollisions() {
        // Manuální kolize projektilů s nepřáteli
        this.projectileManager.playerProjectiles.children.entries.forEach(projectile => {
            if (!projectile.active) return;
            
            // POUZE viditelné projektily mohou způsobit damage
            if (!projectile.visible) return;
            
            this.enemyManager.enemies.children.entries.forEach(enemy => {
                if (!enemy.active) return;
                
                const distance = Phaser.Math.Distance.Between(
                    projectile.x, projectile.y, enemy.x, enemy.y
                );
                
                if (distance < 15) { // collision radius
                    this.handleProjectileEnemyCollision(projectile, enemy);
                }
            });
        });
        
        // Manuální kolize enemy projektilů s hráčem
        this.projectileManager.enemyProjectiles.children.entries.forEach(projectile => {
            if (!projectile.active) return;
            
            const distance = Phaser.Math.Distance.Between(
                projectile.x, projectile.y, this.player.x, this.player.y
            );
            
            if (distance < 15) { // collision radius
                this.handleEnemyProjectilePlayerCollision(this.player.sprite, projectile);
            }
        });
        
        // Kolize hráče s nepřáteli
        this.physics.overlap(
            this.player.sprite,
            this.enemyManager.enemies,
            this.handlePlayerEnemyCollision,
            null,
            this
        );
        
        // Kolize hráče s lootem
        this.physics.overlap(
            this.player.sprite,
            this.lootManager.loot,
            this.handlePlayerLootCollision,
            null,
            this
        );
    }
    
    handleProjectileEnemyCollision(projectile, enemy) {
        // Ujistit se že to není loot
        if (enemy.type === 'xp' || enemy.type === 'health') {
            return;
        }
        
        // Ujistit se že enemy má takeDamage metodu
        if (!enemy.takeDamage || typeof enemy.takeDamage !== 'function') {
            return;
        }
        
        // Kontrola jestli už byl tento nepřítel zasažen tímto projektilem
        if (!projectile.hitEnemies) {
            projectile.hitEnemies = [];
        }
        
        if (projectile.hitEnemies.includes(enemy)) {
            return; // Už jsme tohoto nepřítele zasáhli
        }
        
        // Přidat nepřítele do seznamu zasažených
        projectile.hitEnemies.push(enemy);
        projectile.hitCount = (projectile.hitCount || 0) + 1;
        
        // VŽDY aplikovat normální damage nejdříve
        enemy.takeDamage(projectile.damage);
        
        // Analytics - univerzální tracking damage
        this.recordDamageDealt(projectile.damage, enemy);
        
        // Exploze navíc při prvním zásahu (pokud máme explozivní projektily)
        if (this.player.hasExplosiveBullets && projectile.hitCount === 1) {
            const explosionRadius = 30 + (this.player.explosiveBulletsLevel * 10);
            this.projectileManager.createExplosion(
                projectile.x, 
                projectile.y, 
                projectile.damage * 0.8, 
                explosionRadius,
                this.player.explosiveBulletsLevel
            );
        }
        
        // Kontrola jestli má projektil pokračovat dál (cisplatina)
        let shouldDestroy = true;
        
        if (this.player.hasPiercingArrows && this.player.piercingArrowsLevel > 0) {
            const maxHits = 1 + this.player.piercingArrowsLevel; // Level 1 = 2 průchody, Level 5 = 6 průchodů
            
            if (projectile.hitCount < maxHits) {
                // Projektil může pokračovat, snížit poškození o 10%
                projectile.damage = projectile.damage * 0.9;
                shouldDestroy = false;
            }
        }
        
        if (shouldDestroy) {
            projectile.destroy();
        }
        
        if (enemy.hp <= 0) {
            this.handleEnemyDeath(enemy);
        }
    }
    
    handlePlayerEnemyCollision(playerSprite, enemy) {
        if (this.player.canTakeDamage()) {
            const prevHp = this.player.hp;
            this.player.takeDamage(enemy.damage);
            // Encounter: damage taken from boss
            if (enemy.bossName && this.analyticsManager && this.analyticsManager.recordBossDamageTaken) {
                this.analyticsManager.recordBossDamageTaken(enemy.damage);
            }
            
        // Analytics - track damage taken
        this.gameStats.totalDamageTaken += enemy.damage;
        let enemyType = enemy.isElite ? `elite:${enemy.type}` : enemy.type;
            if (enemy.bossName) {
                enemyType = `boss:${enemy.bossName}`;
            }
            this.analyticsManager.trackDamageTaken(enemy.damage, enemyType, this.gameStats.level);
            
            this.audioManager.playSound('hit');
            
            if (this.player.hp <= 0) {
                // Zaznamenat příčinu smrti
                this.lastDeathCause = { type: enemyType, damage: enemy.damage };
                this.lastHpBeforeDeath = prevHp;
                
                // Non-blocking call to gameOver - don't await in physics callback
                this.gameOver().catch(error => {
                    console.error('❌ Failed to handle game over:', error);
                });
            }
        }
    }
    
    handlePlayerLootCollision(playerSprite, loot) {
        if (loot.type === 'xp') {
            this.gainXP(loot.value);
            this.audioManager.playSound('pickup');
        } else if (loot.type === 'health') {
            this.player.heal(GameConfig.health.healAmount * this.player.maxHp);
            this.gameStats.healthPickups++;
            this.audioManager.playSound('heal');
        }
        
        loot.destroy();
    }
    
    handleEnemyProjectilePlayerCollision(playerSprite, projectile) {
        if (this.player.canTakeDamage()) {
            const prevHp = this.player.hp;
            this.player.takeDamage(projectile.damage);
            // Akumulovat a logovat damage z projektilů
            this.gameStats.totalDamageTaken += projectile.damage;
            try {
                const srcType = typeof projectile.sourceType === 'string' ? projectile.sourceType : 'projectile';
                if (this.analyticsManager && this.analyticsManager.trackDamageTaken) {
                    this.analyticsManager.trackDamageTaken(projectile.damage, srcType, this.gameStats.level);
                }
            } catch (_) { /* no-op */ }
            if (this.analyticsManager && this.analyticsManager.recordBossDamageTaken && typeof projectile.sourceType === 'string' && projectile.sourceType.startsWith('boss:')) {
                this.analyticsManager.recordBossDamageTaken(projectile.damage);
            }
            this.audioManager.playSound('hit');
            
            // Zaznamenat potenciální příčinu smrti
            if (this.player.hp <= 0) {
                const src = projectile.sourceType || 'projectile';
                this.lastDeathCause = { type: src, damage: projectile.damage };
                this.lastHpBeforeDeath = prevHp;
                
                // Non-blocking call to gameOver - don't await in physics callback
                this.gameOver().catch(error => {
                    console.error('❌ Failed to handle game over:', error);
                });
            }
            
            projectile.destroy();
        }
    }
    
    handleEnemyDeath(enemy) {
        // Zabránit dvojitému počítání smrti
        if (enemy.isDead) {
            return;
        }
        enemy.isDead = true;
        
        this.gameStats.enemiesKilled++;
        this.gameStats.score += enemy.xp * 10;
        
        // Analytics - track enemy kill (per-kill přírůstek)
        const enemyType = enemy.isElite ? `elite:${enemy.type}` : enemy.type;
        this.analyticsManager.trackEnemyKill(enemyType, this.gameStats.level, enemy.maxHp - enemy.hp);
        
        // Zvuk smrti nepřítele
        this.audioManager.playSound('enemyDeath');
        
        // Drop lootu
        this.lootManager.dropLoot(enemy.x, enemy.y, enemy);
        
        // Extra XP bonus pro bosse (double drop, ale pomocí optimalizovaného systému)
        if (enemy.bossName) { // Pokud je to boss
            // Zapsat poraženého bosse do session statistik
            this.gameStats.bossesDefeated = (this.gameStats.bossesDefeated || 0) + 1;
            if (!Array.isArray(this.gameStats.bossesDefeatedList)) {
                this.gameStats.bossesDefeatedList = [];
            }
            this.gameStats.bossesDefeatedList.push(enemy.bossName);
            this.lootManager.createOptimalXPOrbs(enemy.x, enemy.y, enemy.xp);
        }
        
        // Odstranění nepřítele
        this.enemyManager.removeEnemy(enemy);
    }
    
    gainXP(amount) {
        this.gameStats.xp += amount;
        this.gameStats.xpCollected += amount;
        
        // Kontrola level up
        while (this.gameStats.xp >= this.gameStats.xpToNext) {
            this.gameStats.xp -= this.gameStats.xpToNext;
            this.levelUp();
        }
        
        // Aktualizovat UI
        this.uiManager.updateXP(this.gameStats.xp, this.gameStats.xpToNext);
    }
    
    levelUp() {
        this.gameStats.level++;
        this.gameStats.xpToNext = Math.floor(
            GameConfig.xp.baseRequirement * Math.pow(GameConfig.xp.multiplier, this.gameStats.level - 1)
        );
        
        this.audioManager.playSound('levelup');
        
        // Aktualizovat XP UI po level upu
        this.uiManager.updateXP(this.gameStats.xp, this.gameStats.xpToNext);
        
        // Zobrazit výběr power-upů
        this.isPaused = true;
        
        // Pozastavit physics (optional - už je blokovaný update)
        this.physics.pause();
        
        this.powerUpManager.showPowerUpSelection(() => {
            this.isPaused = false;
            
            // Obnovit physics
            this.physics.resume();
            
            // Kontrola boss spawnu - každých 5 levelů
            if (this.gameStats.level % GameConfig.spawn.bossLevelInterval === 0) {
                this.enemyManager.spawnBoss(Math.floor(this.gameStats.level / GameConfig.spawn.bossLevelInterval) - 1);
            }
        });
    }
    
    updateTime() {
        this.gameStats.time++;
    }
    
    getActivePowerUps() {
        // Vrátí seznam aktivních power-upů
        const activePowerUps = [];
        
        if (this.player.hasShield) activePowerUps.push('shield');
        if (this.player.hasExplosiveBullets) activePowerUps.push('explosive');
        if (this.player.hasPiercingArrows) activePowerUps.push('piercing');
        if (this.player.hasLightningChain) activePowerUps.push('lightning');
        if (this.player.hasRadiotherapy) activePowerUps.push('radiotherapy');
        if (this.player.hasChemotherapy) activePowerUps.push('chemotherapy');
        if (this.player.hasProtonBeam) activePowerUps.push('proton_beam');
        if (this.player.hasImmunotherapy) activePowerUps.push('immunotherapy');
        if (this.player.hasCisplatin) activePowerUps.push('cisplatin');
        if (this.player.hasMetabolicBooster) activePowerUps.push('metabolic_booster');
        
        return activePowerUps;
    }
    
    async gameOver() {
        // Prevent multiple game over calls
        if (this.isGameOver) {
            console.log('🎮 Game Over already in progress - ignoring duplicate call');
            return;
        }
        
        console.log('🎮 Game Over triggered - starting cleanup...');
        
        this.isGameOver = true;
        this.isPaused = true;
        
        // Zastavit physics
        this.physics.pause();
        
        // Zastavit všechny managery
        if (this.enemyManager && this.enemyManager.spawnEvent) {
            this.enemyManager.spawnEvent.paused = true;
        }
        
        // Zastavit audio a označit, že už není dostupný
        this.audioManager.stopAll();
        // Necháme audioManager dostupný pro boss cleanup
        
        // Analytics - pokud probíhá encounter s bossem, uložit jako neúspěšný
        try {
            if (this.analyticsManager && this.analyticsManager.currentBossEncounter) {
                if (typeof this.analyticsManager.abortBossEncounter === 'function') {
                    this.analyticsManager.abortBossEncounter(0);
                }
            }
        } catch (e) { /* no-op */ }
        
        // Analytics - track player death se skutečnou příčinou
        this.analyticsManager.trackPlayerDeath(
            this.lastDeathCause, // Skutečná příčina smrti
            { x: this.player.x, y: this.player.y },
            this.gameStats,
            {
                playerHP: this.lastHpBeforeDeath ?? this.player.hp,
                playerMaxHP: this.player.maxHp,
                activePowerUps: this.getActivePowerUps(),
                enemiesOnScreen: this.enemyManager ? this.enemyManager.enemies.children.entries.length : 0,
                projectilesOnScreen: this.projectileManager ? this.projectileManager.enemyProjectiles.children.entries.length : 0,
                wasBossFight: !!(this.analyticsManager && this.analyticsManager.currentBossEncounter)
            }
        );
        
        // Pokusit se ihned odeslat události před ukončením session
        try {
            if (this.analyticsManager && typeof this.analyticsManager.flushEvents === 'function') {
                await this.analyticsManager.flushEvents();
            }
        } catch (e) { /* ignore */ }
        
        // End analytics session - AWAIT to ensure it completes!
        try {
            await this.analyticsManager.endSession(this.gameStats);
            console.log('✅ Analytics session ended successfully');
        } catch (error) {
            console.error('❌ Failed to end analytics session:', error);
        }
        
        // Přehrát zvuk smrti
        if (this.sound.get('playerDeath')) {
            this.sound.play('playerDeath');
        }
        
        // Zkontrolovat, zda je skóre v TOP10 (globálně)
        if (await this.globalHighScoreManager.isHighScore(this.gameStats.score)) {
            this.showHighScoreDialog();
        } else {
            this.uiManager.showGameOver();
        }
    }
    
    handleResize(gameSize, baseSize, displaySize) {
        console.log(`Game scene resized to: ${gameSize.width}x${gameSize.height}`);
        
        // Update kamery
        this.cameras.main.setSize(gameSize.width, gameSize.height);
        // Reposition mobile controls
        try {
            if (this.mobileControls && this.mobileControls.isEnabled()) {
                this.mobileControls.onResize();
            }
        } catch (_) { /* no-op */ }
        
        // Pokud je hra pozastavená, aktualizuj UI pozice
        if (this.pauseMenu && this.pauseMenu.isVisible) {
            // Znovu zobrazit pause menu s novými rozměry
            this.pauseMenu.hide();
            this.pauseMenu.show();
        }
        
        // Aktualizovat UI managera
        if (this.uiManager) {
            this.uiManager.handleResize();
        }
    }
    
    showHighScoreDialog() {
        // Pozadí
        const bg = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000,
            0.8
        );
        
        // Gratuluji text
        const congratsText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 - 120,
            '🎉 GRATULUJEME! 🎉\nZískali jste místo v TOP 10!',
            { ...PRESET_STYLES.dialogTitle(), align: 'center' }
        ).setOrigin(0.5);
        
        // Zobrazit skóre info
        const scoreInfo = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 - 50,
            `Skóre: ${this.gameStats.score}\nÚroveň: ${this.gameStats.level}\nNepřátel: ${this.gameStats.enemiesKilled}\nBosové: ${this.gameStats.bossesDefeated}`,
            { ...PRESET_STYLES.buttonText(), align: 'center' }
        ).setOrigin(0.5);
        
        // Input pro jméno
        const namePrompt = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 40,
            'Zadejte své jméno (max 8 znaků):',
            PRESET_STYLES.buttonText()
        ).setOrigin(0.5);
        
        // Input box
        const inputBox = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 80,
            300,
            40,
            0x333333
        ).setStrokeStyle(2, 0xffffff);
        
        // Input text
        let playerName = '';
        const inputText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 80,
            '_',
            PRESET_STYLES.buttonText()
        ).setOrigin(0.5);
        
        // Instrukce
        const instructions = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 140,
            'Píšte na klávesnici, ENTER pro potvrzení',
            PRESET_STYLES.controls()
        ).setOrigin(0.5);
        
        // Keyboard input handler (guard proti dvojímu odeslání)
        let hasSubmitted = false;
        const onKeyDown = async (event) => {
            if (event.key === 'Enter') {
                if (hasSubmitted) return; // prevence dvojího submitu
                hasSubmitted = true;
                // Okamžitě odregistrovat handler, aby se Enter nezopakovalo
                this.input.keyboard.off('keydown', onKeyDown);
                const finalPlayerName = playerName || 'Anonym';
                
                // Uložit jméno pro příští session
                localStorage.setItem('lastPlayerName', finalPlayerName);
                
                // Centralizovaný submit (lokální + vzdálený + návrat pozice)
                const { position, remoteSaved } = await this.globalHighScoreManager.submitScore(
                    finalPlayerName,
                    this.gameStats.score,
                    this.gameStats.level,
                    this.gameStats.enemiesKilled,
                    this.gameStats.time,
                    this.gameStats.bossesDefeated
                );
                console.log('🏁 HighScore submitted', {
                    name: finalPlayerName,
                    score: this.gameStats.score,
                    level: this.gameStats.level,
                    position,
                    remoteSaved
                });
                
                // Odstranit UI
                bg.destroy();
                congratsText.destroy();
                scoreInfo.destroy();
                namePrompt.destroy();
                inputBox.destroy();
                inputText.destroy();
                instructions.destroy();
                
                // Zobrazit game over s pozicí
                this.showHighScoreResult(position);
                
            } else if (event.key === 'Backspace') {
                if (playerName.length > 0) {
                    playerName = playerName.slice(0, -1);
                    inputText.setText(playerName + '_');
                }
            } else if (event.key.length === 1 && playerName.length < 8) {
                // Přidat znak (pouze písmena, číslice a základní znaky)
                if (/[a-zA-Z0-9čďěščřžýáíéúů]/i.test(event.key)) {
                    playerName += event.key;
                    inputText.setText(playerName + '_');
                }
            }
        };
        this.input.keyboard.on('keydown', onKeyDown);
        
        this.highScoreDialogElements = [bg, congratsText, scoreInfo, namePrompt, inputBox, inputText, instructions];
    }
    
    showHighScoreResult(position) {
        // Zobrazit výsledek
        const resultText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 - 50,
            `🏆 Umístili jste se na ${position}. místě! 🏆\n\nSkóre: ${this.gameStats.score}`,
            { ...PRESET_STYLES.dialogTitle(), align: 'center' }
        ).setOrigin(0.5);
        
        const backText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 50,
            'R - Restart | ESC - Menu',
            PRESET_STYLES.controls()
        ).setOrigin(0.5);
        
        // Game over UI
        this.uiManager.showGameOver();
    }
}