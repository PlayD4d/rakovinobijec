import { GameConfig } from '../config.js';
import { createFontConfig, waitForFont, PRESET_STYLES } from '../fontConfig.js';
import { HighScoreManager } from '../managers/HighScoreManager.js';
import { GlobalHighScoreManager } from '../managers/GlobalHighScoreManager.js';

export class MainMenu extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenu' });
        
        this.menuItems = [
            { text: 'Začít hru', action: 'start' },
            { text: 'TOP 10', action: 'highscores' },
            { text: 'Zvuk', action: 'audio' },
            { text: 'Nepřátelé', action: 'enemies' }
        ];
        
        this.selectedIndex = 0;
        this.currentSubmenu = null;
    }
    
    preload() {
        // Načíst stejné audio soubory jako v GameScene
        this.load.audio('levelMusic1', 'music/level_1.mp3');
        this.load.audio('levelMusic2', 'music/level_2.mp3');
        this.load.audio('levelMusic3', 'music/level_3.mp3');
        this.load.audio('bossMusic', 'music/boss.mp3');
        this.load.audio('hit', 'sound/hit.mp3');
        this.load.audio('intro', 'sound/intro.mp3');
        this.load.audio('levelup', 'sound/levelup.mp3');
        this.load.audio('pickup', 'sound/pickup.mp3');
        this.load.audio('playerDeath', 'sound/player_death.mp3');
        this.load.audio('powerup', 'sound/powerup.mp3');
        this.load.audio('readyFight', 'sound/ready_fight.mp3');
        this.load.audio('bossEnter', 'sound/boss_enter.mp3');
        this.load.audio('gameOver', 'sound/game_over.mp3');
    }
    
    async create() {
        // Počkat na načtení fontu
        await waitForFont();
        
        // Inicializace high score managerů
        this.highScoreManager = new HighScoreManager();
        this.globalHighScoreManager = new GlobalHighScoreManager();
        this.globalHighScoreManager.setLocalFallback(this.highScoreManager);
        
        // Pozadí
        this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            this.cameras.main.width,
            this.cameras.main.height,
            0x001122
        );
        
        // Titulek hry
        this.add.text(
            this.cameras.main.width / 2,
            80,
            'RAKOVINOBIJEC',
            PRESET_STYLES.gameTitle()
        ).setOrigin(0.5);
        
        // Podtitulek
        this.add.text(
            this.cameras.main.width / 2,
            140,
            'Pro Mardu - bojovníka proti rakovině',
            PRESET_STYLES.subtitle()
        ).setOrigin(0.5);
        
        // Motivační text
        this.add.text(
            this.cameras.main.width / 2,
            170,
            'Pomoz rytíři Mardovi porazit škodlivé buňky!',
            createFontConfig('small', 'cyan')
        ).setOrigin(0.5);
        
        
        // Herní info
        this.add.text(
            this.cameras.main.width / 2,
            200,
            'WASD / šipky | ESC pauza',
            PRESET_STYLES.controls()
        ).setOrigin(0.5);
        
        // Verze vlevo dole
        this.add.text(
            20,
            this.cameras.main.height - 20,
            'verze: 0.1.1',
            PRESET_STYLES.controls()
        ).setOrigin(0, 0.5);
        
        // E-mail vpravo dole
        this.add.text(
            this.cameras.main.width - 20,
            this.cameras.main.height - 20,
            'playd4d.me@gmail.com',
            PRESET_STYLES.controls()
        ).setOrigin(1, 0.5);
        
        // Copyright na spodku
        this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height - 30,
            '© PlayD4d + Claude - 2025',
            PRESET_STYLES.controls()
        ).setOrigin(0.5);
        
        // Menu položky
        this.menuTexts = [];
        const startY = 260;
        const itemSpacing = 50;
        
        this.menuItems.forEach((item, index) => {
            const y = startY + (index * itemSpacing);
            const text = this.add.text(
                this.cameras.main.width / 2, y,
                item.text,
                PRESET_STYLES.menuItem()
            ).setOrigin(0.5);
            
            // Clickable
            text.setInteractive();
            text.on('pointerdown', () => {
                this.selectedIndex = index;
                this.selectItem();
            });
            
            text.on('pointerover', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });
            
            this.menuTexts.push(text);
        });
        
        // Ovládání klávesnicí
        this.setupKeyboard();
        
        this.updateSelection();
        
        // Přehrát intro zvuk po načtení menu
        this.tryPlayIntro();
    }
    
    setupKeyboard() {
        this.upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.downKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        
        this.upKey.on('down', () => {
            if (!this.currentSubmenu) {
                this.navigateUp();
            }
        });
        
        this.downKey.on('down', () => {
            if (!this.currentSubmenu) {
                this.navigateDown();
            }
        });
        
        this.enterKey.on('down', () => {
            if (!this.currentSubmenu) {
                this.selectItem();
            }
        });
        
        this.escKey.on('down', () => {
            if (this.currentSubmenu) {
                this.closeSubmenu();
            }
        });
    }
    
    navigateUp() {
        this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
        this.updateSelection();
        this.sound.play('pickup');
    }
    
    navigateDown() {
        this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
        this.updateSelection();
        this.sound.play('pickup');
    }
    
    updateSelection() {
        this.menuTexts.forEach((text, index) => {
            if (index === this.selectedIndex) {
                text.setStyle(PRESET_STYLES.menuItemSelected());
                text.setScale(1.1);
            } else {
                text.setStyle(PRESET_STYLES.menuItem());
                text.setScale(1);
            }
        });
    }
    
    selectItem() {
        const selectedItem = this.menuItems[this.selectedIndex];
        this.sound.play('powerup');
        
        switch (selectedItem.action) {
            case 'start':
                this.startGame();
                break;
            case 'highscores':
                this.showHighScores();
                break;
            case 'audio':
                this.showAudioMenu();
                break;
            case 'enemies':
                this.showEnemiesMenu();
                break;
        }
    }
    
    startGame() {
        this.scene.start('GameScene');
    }
    
    showAudioMenu() {
        this.currentSubmenu = 'audio';
        this.createAudioSubmenu();
    }
    
    showEnemiesMenu() {
        this.currentSubmenu = 'enemies';
        this.createEnemiesSubmenu();
    }
    
    createAudioSubmenu() {
        const panelWidth = 400;
        const panelHeight = 250;
        const panelX = this.cameras.main.width / 2;
        const panelY = this.cameras.main.height / 2;
        
        const bg = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000,
            0.7
        );
        
        const panel = this.add.rectangle(
            panelX, panelY,
            panelWidth, panelHeight,
            0x222222, 1
        );
        panel.setStrokeStyle(2, 0xffffff);
        
        const title = this.add.text(
            panelX, panelY - panelHeight/2 + 30,
            'NASTAVENÍ ZVUKU',
            PRESET_STYLES.dialogTitle()
        ).setOrigin(0.5);
        
        const infoText = this.add.text(
            panelX, panelY,
            'Zvukové nastavení\nbude dostupné\npo spuštění hry',
            PRESET_STYLES.description()
        ).setOrigin(0.5);
        
        const backText = this.add.text(
            panelX, panelY + panelHeight/2 - 40,
            'ESC - ZPĚT',
            PRESET_STYLES.controls()
        ).setOrigin(0.5);
        
        this.submenuElements = [bg, panel, title, infoText, backText];
    }
    
    createEnemiesSubmenu() {
        const panelWidth = 700;
        const panelHeight = 580;
        const panelX = this.cameras.main.width / 2;
        const panelY = this.cameras.main.height / 2;
        
        const bg = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000,
            0.7
        );
        
        const panel = this.add.rectangle(
            panelX, panelY,
            panelWidth, panelHeight,
            0x222222, 1
        );
        panel.setStrokeStyle(2, 0xffffff);
        
        const title = this.add.text(
            panelX, panelY - panelHeight/2 + 30,
            'NEPŘÁTELÉ',
            PRESET_STYLES.dialogTitle()
        ).setOrigin(0.5);
        
        // Enemy descriptions - tématické názvy související s rakovinou
        const enemyTypes = ['red', 'orange', 'green', 'purple', 'brown'];
        const enemyNames = {
            red: 'Mutantní buňka',
            orange: 'Tumor', 
            green: 'Metastáza',
            purple: 'Onkogen',
            brown: 'Nekrotická tkáň'
        };
        
        const enemyDescs = {
            red: 'Rychlá, slabá buňka - rychle se množí',
            orange: 'Odolný pomalý tumor - vysoké HP',
            green: 'Agresivní metastáza - hodně damage',
            purple: 'Onkogen - posiluje ostatní nepřátele',
            brown: 'Pomalá, střílí homing toxiny'
        };
        
        const elements = [bg, panel, title];
        
        enemyTypes.forEach((type, index) => {
            const config = GameConfig.enemies[type];
            const startY = panelY - 140;
            const itemSpacing = 80;
            const y = startY + (index * itemSpacing);
            
            // Enemy circle - větší a více vlevo
            const circle = this.add.circle(panelX - 250, y, 18, config.color);
            circle.setStrokeStyle(2, 0xffffff);
            
            // Enemy name - větší font s více paddingem
            const nameText = this.add.text(
                panelX - 180, y - 25,
                enemyNames[type],
                PRESET_STYLES.buttonText()
            );
            
            // Description - kratší a čitelnější
            const descText = this.add.text(
                panelX - 180, y - 2,
                enemyDescs[type],
                PRESET_STYLES.description()
            );
            
            // Stats - lepší formátování
            const statsText = this.add.text(
                panelX - 180, y + 20,
                `❤️ ${config.hp}   ⚔️ ${config.damage}   💨 ${config.speed}`,
                createFontConfig('tiny', 'yellow')
            );
            
            elements.push(circle, nameText, descText, statsText);
        });
        
        const backText = this.add.text(
            panelX, panelY + panelHeight/2 - 30,
            'ESC - ZPĚT',
            PRESET_STYLES.controls()
        ).setOrigin(0.5);
        
        elements.push(backText);
        
        this.submenuElements = elements;
    }
    
    tryPlayIntro() {
        // Zkontroluj cache a přehraj intro zvuk
        if (this.cache.audio.has('intro')) {
            this.sound.play('intro', { volume: 0.7 });
        }
    }
    
    closeSubmenu() {
        if (this.submenuElements) {
            this.submenuElements.forEach(element => {
                element.destroy();
            });
            this.submenuElements = null;
        }
        
        this.currentSubmenu = null;
    }
    
    async showHighScores() {
        this.currentSubmenu = 'highscores';
        
        const elements = [];
        
        // Pozadí - interaktivní blokování menu
        const bg = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000,
            0.95
        ).setInteractive();
        elements.push(bg);
        
        // Arkádový styl rámeček - širší pro globální text
        const frame = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            680,
            500,
            0x000033
        ).setStrokeStyle(3, 0x00ffff);
        elements.push(frame);
        
        // Titulek s connection status
        const connectionStatus = this.globalHighScoreManager.getConnectionStatus();
        const titleText = connectionStatus.online ? '🌐 GLOBÁLNÍ HIGH SCORES' : '📱 LOKÁLNÍ HIGH SCORES';
        const title = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 - 200,
            titleText,
            { 
                ...PRESET_STYLES.dialogTitle(),
                color: connectionStatus.online ? '#00ff00' : '#ffff00',
                fontSize: '28px'
            }
        ).setOrigin(0.5);
        elements.push(title);
        
        // Loading indicator
        const loadingText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            '⏳ Načítám high scores...',
            PRESET_STYLES.description()
        ).setOrigin(0.5);
        elements.push(loadingText);
        
        // Získat globální high scores
        try {
            const highScores = await this.globalHighScoreManager.getHighScores();
            console.log('Global high scores loaded:', highScores);
            
            // Odstranit loading text
            loadingText.destroy();
            elements.splice(elements.indexOf(loadingText), 1);
        
            // Vykreslení tabulky - jednoduchý arkádový formát
            const startY = this.cameras.main.height / 2 - 130;
            const lineHeight = 30;
            
            // Vykreslit 10 řádků
            for (let i = 0; i < 10; i++) {
                // Přidat extra mezeru po 3. místě pro vizuální oddělení
                const extraSpacing = i >= 3 ? 15 : 0;
                const y = startY + (i * lineHeight) + extraSpacing;
                const rank = (i + 1).toString().padStart(2, '0');
                const entry = highScores[i] || { name: 'PRÁZDNÉ', score: 0 };
                
                // Barva podle pozice - pořadí je důležité!
                let color = '#ffffff';
                if (i === 0) color = '#ffdd00'; // Zlatá
                else if (i === 1) color = '#c0c0c0'; // Stříbrná
                else if (i === 2) color = '#cd7f32'; // Bronzová
                else if (i >= 3) color = '#aaaaaa'; // Zešedlá barva pro pozice 4-10
                
                // Pozice - posunuto pro širší okno
                const rankText = this.add.text(
                    this.cameras.main.width / 2 - 290,
                    y,
                    `${rank}.`,
                    { ...PRESET_STYLES.buttonText(), color: color }
                ).setOrigin(0, 0.5);
                elements.push(rankText);
                
                // Jméno - posunuto pro širší okno
                const nameText = this.add.text(
                    this.cameras.main.width / 2 - 220,
                    y,
                    entry.name,
                    { ...PRESET_STYLES.buttonText(), color: color }
                ).setOrigin(0, 0.5);
                elements.push(nameText);
                
                // Skóre (zarovnané doprava) - posunuto pro širší okno
                const scoreText = this.add.text(
                    this.cameras.main.width / 2 + 280,
                    y,
                    entry.score.toString().padStart(8, '0'),
                    { ...PRESET_STYLES.buttonText(), color: color }
                ).setOrigin(1, 0.5);
                elements.push(scoreText);
            }
            
        } catch (error) {
            // Error handling - fallback na lokální scores
            loadingText.setText('❌ Chyba načítání - lokální scores');
            console.error('Failed to load global scores:', error);
        }
        
        // Connection status info
        const statusText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 180,
            connectionStatus.online ? '🌐 Online • Globální žebříček' : '📡 Offline • Lokální žebříček',
            { 
                ...PRESET_STYLES.controls(),
                color: connectionStatus.online ? '#00ff88' : '#ffaa00',
                fontSize: '14px'
            }
        ).setOrigin(0.5);
        elements.push(statusText);
        
        // Instrukce
        const backText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 220,
            'ESC - ZPĚT DO MENU',
            { 
                ...PRESET_STYLES.controls(),
                color: '#00ff00',
                fontSize: '16px'
            }
        ).setOrigin(0.5);
        elements.push(backText);
        
        this.submenuElements = elements;
    }
}