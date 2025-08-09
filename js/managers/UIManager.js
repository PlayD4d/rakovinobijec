import { createFontConfig, PRESET_STYLES, FONT_COLORS } from '../fontConfig.js';

export class UIManager {
    constructor(scene) {
        this.scene = scene;
        
        // HP Bar
        this.hpBar = null;
        this.hpText = null;
        
        // XP Bar
        this.xpBar = null;
        this.xpText = null;
        
        // Stats texty
        this.levelText = null;
        this.scoreText = null;
        this.timeText = null;
        this.enemiesText = null;
        
        // Game Over UI
        this.gameOverContainer = null;
    }
    
    create() {
        // Vytvořit UI prvky
        
        // HP Bar - vlevo nahoře
        const hpBarBg = this.scene.add.rectangle(120, 40, 200, 25, 0x333333);
        hpBarBg.setStrokeStyle(2, 0xffffff);
        
        // HP bar začíná vlevo s origin (0, 0.5)
        this.hpBar = this.scene.add.rectangle(22, 40, 196, 21, 0x00ff00);
        this.hpBar.setOrigin(0, 0.5);  // Levý okraj jako kotva
        
        // HP label a text uprostřed baru
        this.scene.add.text(20, 25, 'HP:', 
            createFontConfig('tiny', 'white', { stroke: true })
        );
        this.hpText = this.scene.add.text(120, 40, '100/100', 
            createFontConfig('small', 'white', { stroke: true, strokeThickness: 2 })
        ).setOrigin(0.5, 0.5);
        
        // XP Bar - vlevo nahoře pod HP
        const xpBarBg = this.scene.add.rectangle(120, 75, 200, 25, 0x333333);
        xpBarBg.setStrokeStyle(2, 0xffffff);
        
        // XP bar začíná vlevo s origin (0, 0.5)
        this.xpBar = this.scene.add.rectangle(22, 75, 0, 21, 0x00aaff);
        this.xpBar.setOrigin(0, 0.5);  // Levý okraj jako kotva
        
        // XP label a text uprostřed baru
        this.scene.add.text(20, 60, 'XP:', 
            createFontConfig('tiny', 'white', { stroke: true })
        );
        this.xpText = this.scene.add.text(120, 75, '0/100', 
            createFontConfig('small', 'white', { stroke: true, strokeThickness: 2 })
        ).setOrigin(0.5, 0.5);
        
        // Statistiky - pravý horní roh (posunuto níž kvůli větším barům)
        this.levelText = this.scene.add.text(this.scene.cameras.main.width - 20, 25, 'Level: 1', 
            PRESET_STYLES.uiText()
        ).setOrigin(1, 0);
        
        this.scoreText = this.scene.add.text(this.scene.cameras.main.width - 20, 50, 'Skóre: 0',
            PRESET_STYLES.uiText()
        ).setOrigin(1, 0);
        
        this.timeText = this.scene.add.text(this.scene.cameras.main.width - 20, this.scene.cameras.main.height - 40, 'Čas: 0:00',
            PRESET_STYLES.uiText()
        ).setOrigin(1, 1);
        
        // Počet zabitých nepřátel - levý dolní roh
        this.enemiesText = this.scene.add.text(20, this.scene.cameras.main.height - 40, 'Zničeno buněk: 0',
            PRESET_STYLES.uiText()
        );
        
        // Game Over UI
        this.gameOverContainer = null;
    }
    
    update() {
        const player = this.scene.player;
        const stats = this.scene.gameStats;
        
        if (!player) return;
        
        // Aktualizace HP baru
        const hpPercentage = Math.max(0, player.hp / player.maxHp);
        this.hpBar.width = 196 * hpPercentage;
        // Pozice x se nemění, jen šířka (origin je levý okraj)
        
        // Změna barvy podle HP
        if (hpPercentage > 0.6) {
            this.hpBar.setFillStyle(0x00ff00);
        } else if (hpPercentage > 0.3) {
            this.hpBar.setFillStyle(0xffaa00);
        } else {
            this.hpBar.setFillStyle(0xff0000);
        }
        
        this.hpText.setText(`${Math.ceil(player.hp)}/${player.maxHp}`);
        
        // Aktualizace statistik
        this.levelText.setText(`Level: ${stats.level}`);
        this.scoreText.setText(`Skóre: ${stats.score}`);
        this.timeText.setText(`Čas: ${Math.floor(stats.time / 60)}:${(stats.time % 60).toString().padStart(2, '0')}`);
        this.enemiesText.setText(`Zničeno buněk: ${stats.enemiesKilled}`);
    }
    
    updateXP(xp, xpToNext) {
        // XP Bar
        const xpPercentage = Math.min(1, Math.max(0, xp / xpToNext));
        this.xpBar.width = 196 * xpPercentage;
        // Pozice x se nemění, jen šířka (origin je levý okraj)
        
        // XP text uprostřed baru
        const xpText = this.scene.add.text(
            120, 75,
            `${xp}/${xpToNext}`,
            createFontConfig('small', 'white', { stroke: true, strokeThickness: 2 })
        ).setOrigin(0.5, 0.5);
        
        // Smazat starý text
        if (this.xpText) this.xpText.destroy();
        this.xpText = xpText;
    }
    
    showGameOver() {
        const stats = this.scene.gameStats;
        
        // Přehrát game over zvuk po krátkém zpoždění (až se ukáže okno)
        this.scene.time.delayedCall(500, () => {
            if (this.scene.audioManager) {
                this.scene.audioManager.playSound('gameOver');
            }
        });
        
        // Container
        this.gameOverContainer = this.scene.add.container(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2
        );
        
        // Zvětšené pozadí
        const bg = this.scene.add.rectangle(0, 0, 800, 550, 0x000000, 0.95);
        bg.setStrokeStyle(4, 0xff0000);
        
        // Game Over text - větší a výraznější
        const gameOverText = this.scene.add.text(0, -200, 'GAME OVER',
            createFontConfig('huge', 'red', { stroke: true, strokeThickness: 6 })
        ).setOrigin(0.5);
        
        // Titulky sekcí
        const statsTitle = this.scene.add.text(0, -120, 'VÝSLEDKY',
            createFontConfig('large', 'yellow', { stroke: true })
        ).setOrigin(0.5);
        
        // Statistiky - čistý layout ve dvou řádcích
        // Horní řádek: Level a Skóre
        const levelText = this.scene.add.text(-120, -80, `Level: ${stats.level}`,
            createFontConfig('normal', 'white', { stroke: true })
        ).setOrigin(0.5, 0.5);
        
        const scoreText = this.scene.add.text(120, -80, `Skóre: ${stats.score}`,
            createFontConfig('normal', 'white', { stroke: true })
        ).setOrigin(0.5, 0.5);
        
        // Střední řádek: Čas (samostatně)
        const timeText = this.scene.add.text(0, -50, 
            `Čas přežití: ${Math.floor(stats.time / 60)}:${(stats.time % 60).toString().padStart(2, '0')}`,
            createFontConfig('normal', 'lightGray', { stroke: true })
        ).setOrigin(0.5, 0.5);
        
        // Spodní řádek: Buněk a Bossů
        const enemiesText = this.scene.add.text(-120, -20, `Buněk: ${stats.enemiesKilled}`,
            createFontConfig('normal', 'cyan', { stroke: true })
        ).setOrigin(0.5, 0.5);
        
        const bossesText = this.scene.add.text(120, -20, `Bossů: ${stats.bossesDefeated}`,
            createFontConfig('normal', 'orange', { stroke: true })
        ).setOrigin(0.5, 0.5);
        
        // Tlačítka - větší a lépe rozložená (posunuto níž)
        const restartBtn = this.scene.add.rectangle(-140, 100, 240, 60, 0x00aa00);
        restartBtn.setStrokeStyle(3, 0x00ff00);
        restartBtn.setInteractive();
        
        const restartText = this.scene.add.text(-140, 100, '🔄 Hrát znovu',
            createFontConfig('normal', 'white', { stroke: true })
        ).setOrigin(0.5);
        
        // Menu button
        const menuBtn = this.scene.add.rectangle(140, 100, 240, 60, 0x0066aa);
        menuBtn.setStrokeStyle(3, 0x0088ff);
        menuBtn.setInteractive();
        
        const menuText = this.scene.add.text(140, 100, '🏠 Hlavní menu',
            createFontConfig('normal', 'white', { stroke: true })
        ).setOrigin(0.5);
        
        // Button hover effects - lepší animace
        restartBtn.on('pointerover', () => {
            restartBtn.setFillStyle(0x00ff00);
            restartText.setScale(1.1);
        });
        
        restartBtn.on('pointerout', () => {
            restartBtn.setFillStyle(0x00aa00);
            restartText.setScale(1.0);
        });
        
        menuBtn.on('pointerover', () => {
            menuBtn.setFillStyle(0x0088ff);
            menuText.setScale(1.1);
        });
        
        menuBtn.on('pointerout', () => {
            menuBtn.setFillStyle(0x0066aa);
            menuText.setScale(1.0);
        });
        
        const restartGame = () => {
            // Zastavit všechnu hudbu
            if (this.scene.audioManager) {
                this.scene.audioManager.stopAll();
            }
            this.scene.sound.stopAll();
            
            // Restart scény
            this.scene.scene.restart();
        };
        
        const returnToMenu = () => {
            // Zastavit všechnu hudbu
            if (this.scene.audioManager) {
                this.scene.audioManager.stopAll();
            }
            this.scene.sound.stopAll();
            
            // Návrat do hlavního menu
            this.scene.scene.start('MainMenu');
        };
        
        restartBtn.on('pointerdown', restartGame);
        menuBtn.on('pointerdown', returnToMenu);
        
        // Klávesnicové ovládání - R pro restart, M pro menu
        this.restartKey = this.scene.input.keyboard.addKey('R');
        this.menuKey = this.scene.input.keyboard.addKey('M');
        
        this.restartKey.once('down', restartGame);
        this.menuKey.once('down', returnToMenu);
        
        // Instrukce - lépe umístěné
        const keysInfo = this.scene.add.text(0, 170, 'R - Hrát znovu | M - Hlavní menu',
            createFontConfig('small', 'gray', { stroke: true })
        ).setOrigin(0.5);
        
        // Motivační text pro Mardu
        const motivationText = this.scene.add.text(0, 200, 'Zkus to znovu. Bojovník se nevzdává!',
            createFontConfig('small', 'yellow')
        ).setOrigin(0.5);
        
        // Přidat vše do containeru
        this.gameOverContainer.add([
            bg, gameOverText, statsTitle,
            levelText, scoreText, enemiesText, bossesText, timeText,
            restartBtn, restartText, menuBtn, menuText, 
            keysInfo, motivationText
        ]);
        
        // Animace - postupné objevování
        this.gameOverContainer.setAlpha(0);
        this.gameOverContainer.setScale(0.8);
        
        this.scene.tweens.add({
            targets: this.gameOverContainer,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 600,
            ease: 'Back.easeOut'
        });
        
        // Blikání motivačního textu
        this.scene.tweens.add({
            targets: motivationText,
            alpha: 0.3,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
    
    handleResize() {
        console.log('UIManager handling resize');
        
        // Aktualizovat pozice po resize
        const rightX = this.scene.cameras.main.width - 20;
        
        // Pravé texty
        if (this.levelText) this.levelText.x = rightX;
        if (this.scoreText) this.scoreText.x = rightX;
        
        // Čas v pravém dolním rohu
        if (this.timeText) {
            this.timeText.x = rightX;
            this.timeText.y = this.scene.cameras.main.height - 40;
        }
        
        // Dolní text
        this.enemiesText.y = this.scene.cameras.main.height - 40;
        
        // Game over container
        if (this.gameOverContainer && this.gameOverContainer.active) {
            const newX = this.scene.cameras.main.width / 2;
            const newY = this.scene.cameras.main.height / 2;
            this.gameOverContainer.x = newX;
            this.gameOverContainer.y = newY;
        }
    }
}