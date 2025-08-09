import { GameConfig } from '../config.js';
import { createFontConfig, waitForFont, PRESET_STYLES } from '../fontConfig.js';
import { HighScoreManager } from '../managers/HighScoreManager.js';
import { GlobalHighScoreManager } from '../managers/GlobalHighScoreManager.js';
import { loadGameVersion, getCachedVersion } from '../utils/version.js';

export class MainMenu extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenu' });
        
        this.menuItems = [
            { text: 'Začít hru', action: 'start' },
            { text: 'TOP 10', action: 'highscores' },
            { text: 'Zvuk', action: 'audio' },
            { text: 'Nepřátelé', action: 'enemies' },
            { text: 'Nastavení', action: 'settings' }
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
        
        // Pozadí (full screen rect, responsivní)
        const bg = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x001122).setOrigin(0);
        
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
        
        // Verze vlevo dole (dynamicky)
        const versionText = this.add.text(
            20,
            this.cameras.main.height - 20,
            `verze: ${getCachedVersion()}`,
            PRESET_STYLES.controls()
        ).setOrigin(0, 0.5);
        // Asynchronně načíst skutečnou verzi z package.json a aktualizovat
        loadGameVersion().then((ver) => {
            if (versionText && versionText.setText) {
                versionText.setText(`verze: ${ver}`);
            }
        }).catch(() => {/* no-op */});
        
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
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
        const startY = isMobile ? 240 : 260;
        const itemSpacing = isMobile ? 56 : 50;
        
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

        // Responzivní resize handler pro menu
        this.scale.on('resize', (gameSize) => {
            bg.setSize(gameSize.width, gameSize.height);
            // Přepočet pozic titulů a položek
            // Zjednodušeně: jen centrovat do nových rozměrů
            // (texty používají kamery, takže se drží středu)
        });
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
            case 'settings':
                this.showSettingsMenu();
                break;
        }
    }

    showSettingsMenu() {
        this.currentSubmenu = 'settings';
        const elements = [];
        const panelWidth = 520;
        const panelHeight = 360;
        const panelX = this.cameras.main.width / 2;
        const panelY = this.cameras.main.height / 2;

        const bg = this.add.rectangle(panelX, panelY, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7);
        elements.push(bg);
        const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x222222, 1).setStrokeStyle(2, 0xffffff);
        elements.push(panel);
        const title = this.add.text(panelX, panelY - panelHeight/2 + 30, 'NASTAVENÍ', PRESET_STYLES.dialogTitle()).setOrigin(0.5);
        elements.push(title);

        const mobileEnabled = localStorage.getItem('mobileControlsEnabled') === 'true';
        const side = localStorage.getItem('mobileControlsSide') || 'left';

        const mobileLabel = this.add.text(panelX - 180, panelY - 60, 'Ovládání na mobilu', PRESET_STYLES.buttonText());
        elements.push(mobileLabel);
        const toggleText = this.add.text(panelX + 120, panelY - 60, mobileEnabled ? 'ZAP' : 'VYP', PRESET_STYLES.buttonText()).setInteractive();
        toggleText.on('pointerdown', () => {
            const newVal = !(localStorage.getItem('mobileControlsEnabled') === 'true');
            localStorage.setItem('mobileControlsEnabled', String(newVal));
            toggleText.setText(newVal ? 'ZAP' : 'VYP');
        });
        elements.push(toggleText);

        const sideLabel = this.add.text(panelX - 180, panelY, 'Strana joysticku', PRESET_STYLES.buttonText());
        elements.push(sideLabel);
        const sideLeft = this.add.text(panelX + 60, panelY, 'LEVÁ', PRESET_STYLES.buttonText()).setInteractive();
        const sideRight = this.add.text(panelX + 160, panelY, 'PRAVÁ', PRESET_STYLES.buttonText()).setInteractive();
        const updateSideUI = () => {
            const s = localStorage.getItem('mobileControlsSide') || 'left';
            sideLeft.setColor(s === 'left' ? '#00ff00' : '#ffffff');
            sideRight.setColor(s === 'right' ? '#00ff00' : '#ffffff');
        };
        sideLeft.on('pointerdown', () => { localStorage.setItem('mobileControlsSide', 'left'); updateSideUI(); });
        sideRight.on('pointerdown', () => { localStorage.setItem('mobileControlsSide', 'right'); updateSideUI(); });
        elements.push(sideLeft, sideRight);
        updateSideUI();

        const fsLabel = this.add.text(panelX - 180, panelY + 60, 'Fullscreen', PRESET_STYLES.buttonText());
        elements.push(fsLabel);
        const fsBtn = this.add.text(panelX + 120, panelY + 60, 'PŘEPNOUT', PRESET_STYLES.buttonText()).setInteractive();
        fsBtn.on('pointerdown', async () => {
            try {
                if (!document.fullscreenElement) {
                    await document.documentElement.requestFullscreen();
                } else {
                    await document.exitFullscreen();
                }
            } catch (e) { console.warn('Fullscreen toggle failed', e); }
        });
        elements.push(fsBtn);

        const backText = this.add.text(panelX, panelY + panelHeight/2 - 40, 'ESC - ZPĚT', PRESET_STYLES.controls()).setOrigin(0.5);
        elements.push(backText);
        this.submenuElements = elements;
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
                let crownIcon = '';
                if (i === 0) {
                    color = '#ffdd00'; // Zlatá
                    crownIcon = '👑';
                } else if (i === 1) {
                    color = '#c0c0c0'; // Stříbrná
                    crownIcon = '🥈';
                } else if (i === 2) {
                    color = '#cd7f32'; // Bronzová
                    crownIcon = '🥉';
                } else if (i >= 3) {
                    color = '#aaaaaa'; // Zešedlá barva pro pozice 4-10
                }
                
                // Pozice s korunkou pro top 3 - posunuto pro širší okno
                const rankText = this.add.text(
                    this.cameras.main.width / 2 - 290,
                    y,
                    `${crownIcon}${rank}.`,
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
        let statusMessage = '📡 Offline • Lokální žebříček';
        let statusColor = '#ffaa00';
        
        if (connectionStatus.online && connectionStatus.supabaseAvailable) {
            statusMessage = '🌐 Online • Globální žebříček (Supabase)';
            statusColor = '#00ff88';
        } else if (connectionStatus.online) {
            statusMessage = '🌐 Online • Mock žebříček (Supabase not loaded)';
            statusColor = '#ffff00';
        }
        
        const statusText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 180,
            statusMessage,
            { 
                ...PRESET_STYLES.controls(),
                color: statusColor,
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