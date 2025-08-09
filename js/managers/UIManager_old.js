import { createFontConfig, PRESET_STYLES } from '../fontConfig.js';

export class UIManager {
    constructor(scene) {
        this.scene = scene;
        
        // HP Bar
        this.hpBar = scene.add.graphics();
        this.hpBarBg = scene.add.graphics();
        
        // XP Bar
        this.xpBar = scene.add.graphics();
        this.xpBarBg = scene.add.graphics();
        
        // Texty - rozložené do rohů
        // Levý horní roh - Level a HP bar
        this.levelText = scene.add.text(20, 20, 'Level: 1', 
            PRESET_STYLES.uiText()
        );
        
        // Pravý horní roh - Score a Time
        const rightX = scene.cameras.main.width - 20;
        this.scoreText = scene.add.text(rightX, 20, 'Skóre: 0',
            PRESET_STYLES.uiText()
        ).setOrigin(1, 0); // Right aligned
        
        this.timeText = scene.add.text(rightX, 40, 'Čas: 0:00',
            PRESET_STYLES.uiText()
        ).setOrigin(1, 0);
        
        // Levý dolní roh - Enemies killed
        this.enemiesText = scene.add.text(20, scene.cameras.main.height - 40, 'Zničeno buněk: 0',
            PRESET_STYLES.uiText()
        );
        
        // Game Over UI
        this.gameOverContainer = null;
    }
    
    update() {
        const player = this.scene.player;
        const stats = this.scene.gameStats;
        
        // Update HP Bar
        this.drawHPBar(player.hp, player.maxHp);
        
        // Update XP Bar
        this.drawXPBar(stats.xp, stats.xpToNext);
        
        // Update texty
        this.levelText.setText(`Level: ${stats.level}`);
        this.scoreText.setText(`Skóre: ${stats.score}`);
        this.enemiesText.setText(`Zničeno buněk: ${stats.enemiesKilled}`);
        
        // Formátování času
        const minutes = Math.floor(stats.time / 60);
        const seconds = stats.time % 60;
        this.timeText.setText(`Čas: ${minutes}:${seconds.toString().padStart(2, '0')}`);
    }
    
    drawHPBar(hp, maxHp) {
        const x = 20;
        const y = 45;  // Pod level textem
        const width = 250;
        const height = 18;
        
        this.hpBarBg.clear();
        this.hpBar.clear();
        
        // Pozadí
        this.hpBarBg.fillStyle(0x000000, 0.5);
        this.hpBarBg.fillRect(x, y, width, height);
        this.hpBarBg.strokeRect(x, y, width, height);
        
        // HP
        const hpPercent = hp / maxHp;
        const hpColor = hpPercent > 0.5 ? 0x00ff00 : hpPercent > 0.25 ? 0xffff00 : 0xff0000;
        this.hpBar.fillStyle(hpColor, 1);
        this.hpBar.fillRect(x, y, width * hpPercent, height);
        
        // Text
        const hpText = this.scene.add.text(
            x + width / 2, y + height / 2,
            `${Math.ceil(hp)}/${maxHp}`,
            createFontConfig('tiny', 'white', { stroke: true })
        ).setOrigin(0.5);
        
        // Smazat starý text
        if (this.hpText) this.hpText.destroy();
        this.hpText = hpText;
    }
    
    drawXPBar(xp, xpToNext) {
        const x = 20;
        const y = 70;  // Pod HP barem
        const width = 250;
        const height = 12;
        
        this.xpBarBg.clear();
        this.xpBar.clear();
        
        // Pozadí
        this.xpBarBg.fillStyle(0x000000, 0.5);
        this.xpBarBg.fillRect(x, y, width, height);
        this.xpBarBg.strokeRect(x, y, width, height);
        
        // XP
        const xpPercent = xp / xpToNext;
        this.xpBar.fillStyle(0x00ddff, 1);
        this.xpBar.fillRect(x, y, width * xpPercent, height);
        
        // Text
        const xpText = this.scene.add.text(
            x + width / 2, y + height / 2,
            `${xp}/${xpToNext}`,
            createFontConfig('tiny', 'white', { stroke: true })
        ).setOrigin(0.5);
        
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
        
        // Pozadí
        const bg = this.scene.add.rectangle(0, 0, 600, 400, 0x000000, 0.9);
        bg.setStrokeStyle(4, 0xff0000);
        
        // Game Over text
        const gameOverText = this.scene.add.text(0, -150, 'GAME OVER',
            PRESET_STYLES.gameOver()
        ).setOrigin(0.5);
        
        // Statistiky
        const statsText = this.scene.add.text(0, -50, 
            `Dosažený level: ${stats.level}\n` +
            `Celkové skóre: ${stats.score}\n` +
            `Zničeno buněk: ${stats.enemiesKilled}\n` +
            `Poraženo bossů: ${stats.bossesDefeated}\n` +
            `Čas přežití: ${Math.floor(stats.time / 60)}:${(stats.time % 60).toString().padStart(2, '0')}`,
            PRESET_STYLES.dialogText()
        ).setOrigin(0.5);
        
        // Restart button
        const restartBtn = this.scene.add.rectangle(-120, 120, 200, 50, 0x00ff00);
        restartBtn.setStrokeStyle(2, 0x000000);
        restartBtn.setInteractive();
        
        const restartText = this.scene.add.text(-120, 120, 'Hrát znovu',
            createFontConfig('normal', 'black')
        ).setOrigin(0.5);
        
        // Menu button
        const menuBtn = this.scene.add.rectangle(120, 120, 200, 50, 0x0088ff);
        menuBtn.setStrokeStyle(2, 0x000000);
        menuBtn.setInteractive();
        
        const menuText = this.scene.add.text(120, 120, 'Hlavní menu',
            createFontConfig('normal', 'black')
        ).setOrigin(0.5);
        
        // Button hover effects
        restartBtn.on('pointerover', () => {
            restartBtn.setFillStyle(0x00dd00);
        });
        
        restartBtn.on('pointerout', () => {
            restartBtn.setFillStyle(0x00ff00);
        });
        
        menuBtn.on('pointerover', () => {
            menuBtn.setFillStyle(0x0066dd);
        });
        
        menuBtn.on('pointerout', () => {
            menuBtn.setFillStyle(0x0088ff);
        });
        
        const restartGame = () => {
            // Zrušit všechny paused stavy před restartem
            this.scene.isPaused = false;
            this.scene.isGameOver = false;
            
            // Zastavit všechnu hudbu
            if (this.scene.audioManager) {
                this.scene.audioManager.stopAll();
            }
            
            // Restart scene
            this.scene.scene.restart();
        };
        
        const returnToMenu = () => {
            // Zastavit všechnu hudbu před návratem do menu
            if (this.scene.audioManager) {
                this.scene.audioManager.stopAll();
            }
            
            // Zastavit všechnu hudbu i z game scene
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
        const keysInfo = this.scene.add.text(0, 150, 'R - Hrát znovu | M - Hlavní menu',
            createFontConfig('small', 'gray', { stroke: true })
        ).setOrigin(0.5);
        
        // Motivační text pro Mardu
        const motivationText = this.scene.add.text(0, 180, 'Nezadávej se! Bojovník se nevzdává! 💪',
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
        this.scoreText.x = rightX;
        this.timeText.x = rightX;
        
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