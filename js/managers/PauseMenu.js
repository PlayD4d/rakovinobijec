import { createFontConfig, PRESET_STYLES, FONT_COLORS } from '../fontConfig.js';
import { GameConfig } from '../config.js';

export class PauseMenu {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.container = null;
        this.currentSubmenu = null;
        
        // Menu options
        this.menuItems = [
            { text: 'Pokračovat', action: 'resume' },
            { text: 'Zvuk', action: 'audio' },
            { text: 'Nepřátelé', action: 'enemies' },
            { text: 'Ukončit hru', action: 'quit' }
        ];
        
        this.selectedIndex = 0;
    }
    
    create() {
        // ESC key handler
        this.escKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.escKey.on('down', () => {
            if (this.currentSubmenu) {
                this.closeSubmenu();
            } else {
                this.toggle();
            }
        });
        
        // Arrow keys for navigation
        this.upKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.downKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.enterKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        
        this.upKey.on('down', () => {
            if (this.isVisible && !this.currentSubmenu) {
                this.navigateUp();
            }
        });
        
        this.downKey.on('down', () => {
            if (this.isVisible && !this.currentSubmenu) {
                this.navigateDown();
            }
        });
        
        this.enterKey.on('down', () => {
            if (this.isVisible && !this.currentSubmenu) {
                this.selectItem();
            }
        });
    }
    
    show() {
        if (this.isVisible) return;
        
        this.isVisible = true;
        this.scene.isPaused = true;
        this.scene.physics.pause();
        
        // Pozadí
        const bg = this.scene.add.rectangle(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            0x000000,
            0.7
        );
        
        // Menu panel
        const panelWidth = 300;
        const panelHeight = 400;
        const panelX = this.scene.cameras.main.width / 2;
        const panelY = this.scene.cameras.main.height / 2;
        
        const panel = this.scene.add.rectangle(
            panelX, panelY,
            panelWidth, panelHeight,
            0x222222, 1
        );
        panel.setStrokeStyle(2, 0xffffff);
        
        // Titulek
        const title = this.scene.add.text(
            panelX, panelY - panelHeight/2 + 40,
            'PAUZA',
            PRESET_STYLES.paused()
        ).setOrigin(0.5);
        
        // Menu položky
        this.menuTexts = [];
        const startY = panelY - 60;
        const itemSpacing = 50;
        
        this.menuItems.forEach((item, index) => {
            const y = startY + (index * itemSpacing);
            const text = this.scene.add.text(
                panelX, y,
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
        
        // Container pro snadné mazání
        this.container = this.scene.add.container(0, 0, [bg, panel, title, ...this.menuTexts]);
        
        this.updateSelection();
    }
    
    hide() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        this.scene.isPaused = false;
        this.scene.physics.resume();
        
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        
        if (this.currentSubmenu) {
            this.closeSubmenu();
        }
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    navigateUp() {
        this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
        this.updateSelection();
        this.scene.audioManager.playSound('pickup'); // Použít jako navigation sound
    }
    
    navigateDown() {
        this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
        this.updateSelection();
        this.scene.audioManager.playSound('pickup');
    }
    
    updateSelection() {
        this.menuTexts.forEach((text, index) => {
            if (index === this.selectedIndex) {
                text.setStyle({ fill: FONT_COLORS.white });
                text.setScale(1.1);
            } else {
                text.setStyle({ fill: FONT_COLORS.gray });
                text.setScale(1);
            }
        });
    }
    
    selectItem() {
        const selectedItem = this.menuItems[this.selectedIndex];
        this.scene.audioManager.playSound('powerup');
        
        switch (selectedItem.action) {
            case 'resume':
                this.hide();
                break;
            case 'audio':
                this.showAudioMenu();
                break;
            case 'enemies':
                this.showEnemiesMenu();
                break;
            case 'quit':
                this.quitGame();
                break;
        }
    }
    
    showAudioMenu() {
        this.currentSubmenu = 'audio';
        
        // Skrýt hlavní menu
        this.container.setVisible(false);
        
        // Vytvořit audio menu
        this.createAudioSubmenu();
    }
    
    showEnemiesMenu() {
        this.currentSubmenu = 'enemies';
        
        // Skrýt hlavní menu
        this.container.setVisible(false);
        
        // Vytvořit enemies menu
        this.createEnemiesSubmenu();
    }
    
    createAudioSubmenu() {
        const panelWidth = 500;
        const panelHeight = 400;
        const panelX = this.scene.cameras.main.width / 2;
        const panelY = this.scene.cameras.main.height / 2;
        
        const bg = this.scene.add.rectangle(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            0x000000,
            0.7
        );
        
        const panel = this.scene.add.rectangle(
            panelX, panelY,
            panelWidth, panelHeight,
            0x222222, 1
        );
        panel.setStrokeStyle(2, 0xffffff);
        
        const title = this.scene.add.text(
            panelX, panelY - panelHeight/2 + 30,
            'NASTAVENÍ ZVUKU',
            PRESET_STYLES.dialogTitle()
        ).setOrigin(0.5);
        
        // Music section
        const musicSectionY = panelY - 80;
        
        // Music toggle button - hezčí design
        const musicStatus = this.scene.audioManager.currentMusic && this.scene.audioManager.currentMusic.isPlaying ? 'ZAPNUTA' : 'VYPNUTA';
        const musicColor = musicStatus === 'ZAPNUTA' ? 'green' : 'red';
        
        const musicLabel = this.scene.add.text(
            panelX, musicSectionY - 20,
            'HUDBA',
            PRESET_STYLES.buttonText()
        ).setOrigin(0.5);
        
        this.musicText = this.scene.add.text(
            panelX, musicSectionY + 5,
            `🎵 ${musicStatus}`,
            createFontConfig('small', musicColor, { stroke: true })
        ).setOrigin(0.5);
        
        this.musicText.setInteractive();
        this.musicText.on('pointerdown', () => {
            this.toggleMusic();
        });
        
        this.musicText.on('pointerover', () => {
            this.musicText.setScale(1.1);
        });
        
        this.musicText.on('pointerout', () => {
            this.musicText.setScale(1.0);
        });
        
        // Music volume - lepší layout
        const musicVolY = musicSectionY + 40;
        
        const musicVolLabel = this.scene.add.text(
            panelX, musicVolY,
            'Hlasitost hudby',
            PRESET_STYLES.description()
        ).setOrigin(0.5);
        
        this.musicMinusBtn = this.scene.add.text(
            panelX - 80, musicVolY + 25,
            '🔉',
            createFontConfig('normal', 'lightGray')
        ).setOrigin(0.5);
        
        this.musicVolText = this.scene.add.text(
            panelX, musicVolY + 25,
            `${Math.round(this.scene.audioManager.musicVolume * 100)}%`,
            createFontConfig('normal', 'yellow', { stroke: true })
        ).setOrigin(0.5);
        
        this.musicPlusBtn = this.scene.add.text(
            panelX + 80, musicVolY + 25,
            '🔊',
            createFontConfig('normal', 'lightGray')
        ).setOrigin(0.5);
        
        // SFX section - lepší layout
        const sfxSectionY = panelY + 20;
        
        const sfxLabel = this.scene.add.text(
            panelX, sfxSectionY,
            'Hlasitost efektů',
            PRESET_STYLES.description()
        ).setOrigin(0.5);
        
        this.sfxMinusBtn = this.scene.add.text(
            panelX - 80, sfxSectionY + 25,
            '🔈',
            createFontConfig('normal', 'lightGray')
        ).setOrigin(0.5);
        
        this.sfxVolText = this.scene.add.text(
            panelX, sfxSectionY + 25,
            `${Math.round(this.scene.audioManager.sfxVolume * 100)}%`,
            createFontConfig('normal', 'yellow', { stroke: true })
        ).setOrigin(0.5);
        
        this.sfxPlusBtn = this.scene.add.text(
            panelX + 80, sfxSectionY + 25,
            '🔉',
            createFontConfig('normal', 'lightGray')
        ).setOrigin(0.5);
        
        // Setup volume controls
        this.setupVolumeButton(this.musicMinusBtn, -0.1, 'music');
        this.setupVolumeButton(this.musicPlusBtn, 0.1, 'music');
        this.setupVolumeButton(this.sfxMinusBtn, -0.1, 'sfx');
        this.setupVolumeButton(this.sfxPlusBtn, 0.1, 'sfx');
        
        const backText = this.scene.add.text(
            panelX, panelY + panelHeight/2 - 30,
            'ESC - ZPĚT',
            PRESET_STYLES.controls()
        ).setOrigin(0.5);
        
        this.submenuContainer = this.scene.add.container(0, 0, [
            bg, panel, title, 
            musicLabel, this.musicText,
            musicVolLabel, this.musicMinusBtn, this.musicVolText, this.musicPlusBtn,
            sfxLabel, this.sfxMinusBtn, this.sfxVolText, this.sfxPlusBtn,
            backText
        ]);
    }
    
    setupVolumeButton(button, change, type) {
        button.setInteractive();
        
        button.on('pointerdown', () => {
            if (type === 'music') {
                const newVolume = Math.max(0, Math.min(1, this.scene.audioManager.musicVolume + change));
                this.scene.audioManager.setMusicVolume(newVolume);
                this.musicVolText.setText(`${Math.round(newVolume * 100)}%`);
            } else {
                const newVolume = Math.max(0, Math.min(1, this.scene.audioManager.sfxVolume + change));
                this.scene.audioManager.setSFXVolume(newVolume);
                this.sfxVolText.setText(`${Math.round(newVolume * 100)}%`);
                // Test sound
                this.scene.audioManager.playSound('pickup');
            }
            this.scene.audioManager.playSound('pickup');
        });
        
        button.on('pointerover', () => {
            button.setStyle({ fill: FONT_COLORS.white });
        });
        
        button.on('pointerout', () => {
            button.setStyle({ fill: FONT_COLORS.lightGray });
        });
    }
    
    createEnemiesSubmenu() {
        const panelWidth = 700;
        const panelHeight = 580;
        const panelX = this.scene.cameras.main.width / 2;
        const panelY = this.scene.cameras.main.height / 2;
        
        const bg = this.scene.add.rectangle(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            0x000000,
            0.7
        );
        
        const panel = this.scene.add.rectangle(
            panelX, panelY,
            panelWidth, panelHeight,
            0x222222, 1
        );
        panel.setStrokeStyle(2, 0xffffff);
        
        const title = this.scene.add.text(
            panelX, panelY - panelHeight/2 + 30,
            'NEPŘÁTELÉ',
            PRESET_STYLES.dialogTitle()
        ).setOrigin(0.5);
        
        // Enemy descriptions - používám GameConfig pro konzistentní data
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
            const circle = this.scene.add.circle(panelX - 250, y, 18, config.color);
            circle.setStrokeStyle(2, 0xffffff);
            
            // Enemy name - větší font s více paddingem
            const nameText = this.scene.add.text(
                panelX - 180, y - 25,
                enemyNames[type],
                PRESET_STYLES.buttonText()
            );
            
            // Description - kratší a čitelnější
            const descText = this.scene.add.text(
                panelX - 180, y - 2,
                enemyDescs[type],
                PRESET_STYLES.description()
            );
            
            // Stats - lepší formátování s emojis
            const statsText = this.scene.add.text(
                panelX - 180, y + 20,
                `❤️ ${config.hp}   ⚔️ ${config.damage}   💨 ${config.speed}`,
                createFontConfig('tiny', 'yellow')
            );
            
            elements.push(circle, nameText, descText, statsText);
        });
        
        const backText = this.scene.add.text(
            panelX, panelY + panelHeight/2 - 30,
            'ESC - ZPĚT',
            PRESET_STYLES.controls()
        ).setOrigin(0.5);
        
        elements.push(backText);
        
        this.submenuContainer = this.scene.add.container(0, 0, elements);
    }
    
    toggleMusic() {
        if (this.scene.audioManager.currentMusic && this.scene.audioManager.currentMusic.isPlaying) {
            this.scene.audioManager.stopCurrentMusic();
        } else {
            this.scene.audioManager.playLevelMusic();
        }
        
        // Aktualizovat text a barvu
        if (this.musicText) {
            const isPlaying = this.scene.audioManager.currentMusic && this.scene.audioManager.currentMusic.isPlaying;
            const status = isPlaying ? 'ZAPNUTA' : 'VYPNUTA';
            const color = isPlaying ? 'green' : 'red';
            
            this.musicText.setText(`🎵 ${status}`);
            this.musicText.setStyle(createFontConfig('small', color, { stroke: true }));
        }
    }
    
    closeSubmenu() {
        if (this.submenuContainer) {
            this.submenuContainer.destroy();
            this.submenuContainer = null;
        }
        
        this.currentSubmenu = null;
        
        // Zobrazit hlavní menu
        if (this.container) {
            this.container.setVisible(true);
        }
    }
    
    quitGame() {
        // Zastavit všechnu hudbu před návratem do menu
        if (this.scene.audioManager) {
            this.scene.audioManager.stopAll();
        }
        
        // Zastavit všechnu hudbu i z game scene
        this.scene.sound.stopAll();
        
        // Přejít zpět na hlavní menu
        this.hide();
        this.scene.scene.start('MainMenu');
    }
    
    destroy() {
        if (this.container) {
            this.container.destroy();
        }
        if (this.submenuContainer) {
            this.submenuContainer.destroy();
        }
    }
}