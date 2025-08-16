/**
 * SettingsModal - Unified nastavení pro hlavní menu i pause menu
 * 
 * PR7 kompatibilní - používá SettingsManager pro centrální správu nastavení
 * Výchozí hodnoty z managers_config.json5, uživatelské preference v localStorage
 * Používá tab navigaci pro organizaci nastavení do kategorií
 */
import { BaseUIComponent } from './BaseUIComponent.js';
import { UI_THEME, UIThemeUtils } from './UITheme.js';
import { RESPONSIVE } from './UiConstants.js';
import { settingsManager } from './SettingsManager.js';

export class SettingsModal extends BaseUIComponent {
    constructor(scene, onCloseCallback = null) {
        // Validate scene before using it
        const width = scene?.scale?.width || 800;
        const height = scene?.scale?.height || 600;
        
        super(scene, 0, 0, {
            width: width,
            height: height,
            theme: 'modal',
            responsive: true
        });
        
        this.onCloseCallback = onCloseCallback;
        this.modalContainer = null;
        
        // Tab system
        this.tabs = [
            { id: 'controls', label: 'Ovládání', icon: '🎮' },
            { id: 'audio', label: 'Zvuk', icon: '🔊' },
            { id: 'display', label: 'Display', icon: '🖥️' },
            { id: 'gameplay', label: 'Gameplay', icon: '⚡' },
            { id: 'data', label: 'Data', icon: '💾' }
        ];
        this.activeTab = 'controls';
        this.tabButtons = [];
        this.tabContent = null;
        
        // Settings values (defaults)
        this.settings = {
            // Controls
            joystickEnabled: true,
            joystickPosition: 'left', // 'left' | 'right'  
            joystickSensitivity: 0.5,
            
            // Audio
            masterVolume: 1.0,
            musicEnabled: true,
            musicVolume: 0.8,
            soundsEnabled: true,
            soundsVolume: 0.9,
            
            // Display
            fullscreen: false,
            graphicsQuality: 'high', // 'low' | 'medium' | 'high'
            uiScale: 'medium', // 'small' | 'medium' | 'large'
            showFPS: false,
            
            // Gameplay
            autoPause: true,
            vibration: true,
            
            // Data - jen akce, ne hodnoty
        };
        
        this.setDepth(UI_THEME.depth.modal);
        this.loadSettings();
        this.createModal();
    }
    
    getComponentDepth() {
        return UI_THEME.depth.modal;
    }
    
    /**
     * Načte nastavení přes SettingsManager
     */
    loadSettings() {
        // Load settings from SettingsManager singleton
        const allSettings = settingsManager.getAll();
        
        // Map from SettingsManager structure to local format
        this.settings = {
            joystickEnabled: settingsManager.get('controls.joystickEnabled'),
            joystickPosition: settingsManager.get('controls.joystickPosition'),
            joystickSensitivity: settingsManager.get('controls.joystickSensitivity'),
            
            masterVolume: settingsManager.get('audio.masterVolume'),
            musicEnabled: settingsManager.get('audio.musicEnabled'),
            musicVolume: settingsManager.get('audio.musicVolume'),
            soundsEnabled: settingsManager.get('audio.soundsEnabled'),
            soundsVolume: settingsManager.get('audio.soundsVolume'),
            
            fullscreen: settingsManager.get('display.fullscreen'),
            graphicsQuality: settingsManager.get('display.graphicsQuality'),
            uiScale: settingsManager.get('display.uiScale'),
            showFPS: settingsManager.get('display.showFPS'),
            
            autoPause: settingsManager.get('gameplay.autoPause'),
            vibration: settingsManager.get('gameplay.vibration')
        };
    }
    
    /**
     * Uloží nastavení přes SettingsManager
     */
    saveSettings() {
        // Save through SettingsManager
        settingsManager.set('controls.joystickEnabled', this.settings.joystickEnabled);
        settingsManager.set('controls.joystickPosition', this.settings.joystickPosition);
        settingsManager.set('controls.joystickSensitivity', this.settings.joystickSensitivity);
        
        settingsManager.set('audio.masterVolume', this.settings.masterVolume);
        settingsManager.set('audio.musicEnabled', this.settings.musicEnabled);
        settingsManager.set('audio.musicVolume', this.settings.musicVolume);
        settingsManager.set('audio.soundsEnabled', this.settings.soundsEnabled);
        settingsManager.set('audio.soundsVolume', this.settings.soundsVolume);
        
        settingsManager.set('display.fullscreen', this.settings.fullscreen);
        settingsManager.set('display.graphicsQuality', this.settings.graphicsQuality);
        settingsManager.set('display.uiScale', this.settings.uiScale);
        settingsManager.set('display.showFPS', this.settings.showFPS);
        
        settingsManager.set('gameplay.autoPause', this.settings.autoPause);
        settingsManager.set('gameplay.vibration', this.settings.vibration);
        
        // Save to localStorage through SettingsManager
        settingsManager.saveToLocalStorage();
        console.log('Settings saved through SettingsManager');
    }
    
    /**
     * Vytvoří celý modal
     */
    createModal() {
        // Validate scene before using it
        if (!this.scene || !this.scene.scale) {
            console.error('[SettingsModal] Cannot create modal - invalid scene reference');
            return;
        }
        
        const { width, height } = this.scene.scale.gameSize;
        
        // Modal overlay - interaktivní pro blokování kliknutí
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(UI_THEME.colors.background.overlay, 0.9);
        overlay.fillRect(0, 0, width, height);
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        
        // Use new depth system
        const overlayDepth = this.scene.DEPTH_LAYERS?.UI_MODAL || 20000;
        overlay.setDepth(overlayDepth - 1);
        this.add(overlay);
        
        // Add overlay to UI layer if it exists
        if (this.scene.uiLayer) {
            this.scene.uiLayer.add(overlay);
        }
        
        // Modal size - větší pro nastavení
        const modalSize = {
            width: Math.min(width * 0.9, this.isMobileDevice ? 400 : 700),
            height: Math.min(height * 0.85, this.isMobileDevice ? 500 : 600)
        };
        
        // Main container
        this.modalContainer = this.scene.rexUI.add.sizer({
            x: width / 2,
            y: height / 2,
            width: modalSize.width,
            height: modalSize.height,
            orientation: 'vertical',
            space: { item: UI_THEME.spacing.m }
        });
        
        // Background
        const background = this.scene.rexUI.add.roundRectangle(
            0, 0, modalSize.width, modalSize.height,
            UI_THEME.borderRadius.large,
            UI_THEME.colors.background.modal
        ).setStrokeStyle(
            UI_THEME.borderWidth.thick,
            UI_THEME.colors.borders.active
        );
        
        this.modalContainer.addBackground(background);
        
        // Set proper depth and add to UI layer
        const modalDepth = this.scene.DEPTH_LAYERS?.UI_MODAL || 20000;
        this.modalContainer.setDepth(modalDepth);
        if (this.scene.uiLayer) {
            this.scene.uiLayer.add(this.modalContainer);
        }
        
        // Header
        this.createHeader();
        
        // Tab navigation
        this.createTabNavigation();
        
        // Tab content area
        this.createTabContent();
        
        // Footer with buttons
        this.createFooter();
        
        // Layout modal
        this.modalContainer.layout();
        
        // Add to scene
        this.add([overlay, this.modalContainer]);
        
        // Initial tab content
        this.switchTab('controls');
        
        // Fade in animation
        this.modalContainer.alpha = 0;
        this.scene.tweens.add({
            targets: this.modalContainer,
            alpha: 1,
            duration: 300
        });
    }
    
    /**
     * Vytvoří header s titulkem
     */
    createHeader() {
        const titleText = this.scene.add.text(0, 0, 'Nastavení',
            UIThemeUtils.createFontConfig('title', 'primary', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        this.modalContainer.add(titleText, {
            proportion: 0,
            align: 'center',
            padding: { top: UI_THEME.spacing.l }
        });
    }
    
    /**
     * Vytvoří tab navigaci
     */
    createTabNavigation() {
        const tabsContainer = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.s }
        });
        
        // Vytvořit tab buttons
        this.tabs.forEach(tab => {
            const button = this.createTabButton(tab);
            tabsContainer.add(button, { proportion: 1, align: 'center' });
            this.tabButtons.push({ ...tab, button });
        });
        
        this.modalContainer.add(tabsContainer, {
            proportion: 0,
            align: 'center',
            padding: { top: UI_THEME.spacing.m }
        });
    }
    
    /**
     * Vytvoří jednotlivé tab tlačítko
     */
    createTabButton(tab) {
        const buttonHeight = this.isMobileDevice ? 35 : 40;
        
        const button = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.s }
        });
        
        // Background
        const background = this.scene.rexUI.add.roundRectangle(
            0, 0, 0, buttonHeight,
            UI_THEME.borderRadius.normal,
            UI_THEME.colors.background.card
        ).setStrokeStyle(
            UI_THEME.borderWidth.normal,
            UI_THEME.colors.borders.default
        );
        
        button.addBackground(background);
        
        // Icon
        if (!this.isMobileDevice) {
            const icon = this.scene.add.text(0, 0, tab.icon, {
                fontSize: '16px',
                color: UIThemeUtils.colorToHex(UI_THEME.colors.text.secondary)
            }).setOrigin(0.5);
            button.add(icon, { proportion: 0, align: 'center' });
        }
        
        // Label
        const label = this.scene.add.text(0, 0, tab.label,
            UIThemeUtils.createFontConfig('small', 'secondary', {
                isMobile: this.isMobileDevice
            })
        ).setOrigin(0.5);
        
        button.add(label, { proportion: 0, align: 'center', padding: { left: 8, right: 8, top: 4, bottom: 4 } });
        
        // Store references
        button.background = background;
        button.label = label;
        button.icon = !this.isMobileDevice ? button.list[0] : null; // Bezpečné pro mobile
        
        // Interactivity
        button.setInteractive()
            .on('pointerover', () => this.onTabHover(tab, button))
            .on('pointerout', () => this.onTabOut(tab, button))
            .on('pointerdown', () => this.switchTab(tab.id));
        
        return button;
    }
    
    /**
     * Tab hover effects
     */
    onTabHover(tab, button) {
        if (this.activeTab !== tab.id) {
            button.background.setFillStyle(UI_THEME.colors.background.panel);
        }
    }
    
    onTabOut(tab, button) {
        if (this.activeTab !== tab.id) {
            button.background.setFillStyle(UI_THEME.colors.background.card);
        }
    }
    
    /**
     * Vytvoří obsah area pro taby
     */
    createTabContent() {
        this.tabContent = this.scene.rexUI.add.sizer({
            orientation: 'vertical',
            space: { item: UI_THEME.spacing.m }
        });
        
        this.modalContainer.add(this.tabContent, {
            proportion: 1,
            align: 'center',
            padding: { top: UI_THEME.spacing.m, bottom: UI_THEME.spacing.m }
        });
    }
    
    /**
     * Switche na zadaný tab
     */
    switchTab(tabId) {
        this.activeTab = tabId;
        
        // Update tab buttons appearance
        this.updateTabButtons();
        
        // Clear current content
        this.tabContent.clear(true);
        
        // Load new content based on tab
        switch (tabId) {
            case 'controls':
                this.createControlsTab();
                break;
            case 'audio':
                this.createAudioTab();
                break;
            case 'display':
                this.createDisplayTab();
                break;
            case 'gameplay':
                this.createGameplayTab();
                break;
            case 'data':
                this.createDataTab();
                break;
        }
        
        // Re-layout
        this.tabContent.layout();
    }
    
    /**
     * Update tab buttons visual state
     */
    updateTabButtons() {
        this.tabButtons.forEach(({ id, button }) => {
            const isActive = id === this.activeTab;
            
            if (isActive) {
                button.background.setFillStyle(UI_THEME.colors.background.panel);
                button.background.setStrokeStyle(
                    UI_THEME.borderWidth.thick,
                    UI_THEME.colors.borders.active
                );
                button.label.setColor(UIThemeUtils.colorToHex(UI_THEME.colors.text.accent));
                if (button.icon && button.icon.setColor) {
                    button.icon.setColor(UIThemeUtils.colorToHex(UI_THEME.colors.primary));
                }
            } else {
                button.background.setFillStyle(UI_THEME.colors.background.card);
                button.background.setStrokeStyle(
                    UI_THEME.borderWidth.normal,
                    UI_THEME.colors.borders.default
                );
                button.label.setColor(UIThemeUtils.colorToHex(UI_THEME.colors.text.secondary));
                if (button.icon && button.icon.setColor) {
                    button.icon.setColor(UIThemeUtils.colorToHex(UI_THEME.colors.text.secondary));
                }
            }
        });
    }
    
    /**
     * Ovládání tab
     */
    createControlsTab() {
        // Mobile joystick section (pouze pro mobile nebo všechno?)
        this.createSettingsSection('Mobilní joystick', [
            this.createJoystickEnabledSetting(),
            this.createJoystickPositionSetting(),
            this.createJoystickSensitivitySetting()
        ]);
        
        // Keyboard shortcuts section
        this.createSettingsSection('Klávesové zkratky', [
            this.createKeyboardShortcutsList()
        ]);
    }
    
    /**
     * Vytvoří sekci s nastavením
     */
    createSettingsSection(title, settings) {
        // Section title
        const titleText = this.scene.add.text(0, 0, title,
            UIThemeUtils.createFontConfig('normal', 'accent', {
                stroke: true,
                isMobile: this.isMobileDevice
            })
        ).setOrigin(0, 0.5);
        
        this.tabContent.add(titleText, {
            proportion: 0,
            align: 'left',
            padding: { top: UI_THEME.spacing.m, left: UI_THEME.spacing.m }
        });
        
        // Settings items
        settings.forEach(setting => {
            if (setting) {
                this.tabContent.add(setting, {
                    proportion: 0,
                    align: 'center',
                    padding: { top: UI_THEME.spacing.s }
                });
            }
        });
    }
    
    /**
     * Joystick zapnuto/vypnuto
     */
    createJoystickEnabledSetting() {
        return this.createCheckboxSetting(
            '🎮', 
            'Mobilní joystick',
            'joystickEnabled',
            'Zobrazit virtuální joystick na mobilních zařízeních'
        );
    }
    
    /**
     * Pozice joysticku (levá/pravá)
     */
    createJoystickPositionSetting() {
        const container = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.m }
        });
        
        // Label with icon
        const labelContainer = this.createSettingLabel('📍', 'Pozice joysticku');
        container.add(labelContainer, { proportion: 0, align: 'center' });
        
        // Radio buttons for position - použít správný RexUI buttons s radio módem
        const positionButtons = this.scene.rexUI.add.buttons({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.s },
            buttons: [
                this.createRadioButtonWithName('Vlevo', 'left'),
                this.createRadioButtonWithName('Vpravo', 'right')
            ],
            type: 'radio',
            setValueCallback: (button, value) => {
                // Update button visual state
                button.getElement('background').setFillStyle(
                    value ? UI_THEME.colors.background.panel : UI_THEME.colors.background.card
                ).setStrokeStyle(
                    UI_THEME.borderWidth.normal,
                    value ? UI_THEME.colors.borders.active : UI_THEME.colors.borders.default
                );
                
                button.getElement('text').setColor(
                    UIThemeUtils.colorToHex(value ? UI_THEME.colors.accent : UI_THEME.colors.primary)
                );
            }
        });
        
        // Set initial selection
        positionButtons.setSelectedButtonName(this.settings.joystickPosition);
        
        // Event handling
        positionButtons.on('button.statechange', (button, index, value) => {
            if (value) { // Only handle when button becomes selected
                this.settings.joystickPosition = index === 0 ? 'left' : 'right';
                console.log('Joystick position:', this.settings.joystickPosition);
            }
        });
        
        container.add(positionButtons, { proportion: 0, align: 'center' });
        
        return container;
    }
    
    /**
     * Citlivost joysticku
     */
    createJoystickSensitivitySetting() {
        return this.createSliderSetting(
            '🎯',
            'Citlivost joysticku', 
            'joystickSensitivity',
            0, 1, 0.1, // min, max, step
            (value) => `${Math.round(value * 100)}%`
        );
    }
    
    /**
     * Klávesové zkratky (read-only)
     */
    createKeyboardShortcutsList() {
        const container = this.scene.rexUI.add.sizer({
            orientation: 'vertical',
            space: { item: UI_THEME.spacing.xs }
        });
        
        const shortcuts = [
            { key: 'WASD / Šipky', desc: 'Pohyb' },
            { key: 'ESC', desc: 'Pauza / Menu' },
            { key: 'R', desc: 'Restart hry' },
            { key: 'ENTER', desc: 'Potvrzení' }
        ];
        
        shortcuts.forEach(shortcut => {
            const row = this.scene.rexUI.add.sizer({
                orientation: 'horizontal',
                space: { item: UI_THEME.spacing.m }
            });
            
            // Key
            const keyText = this.scene.add.text(0, 0, shortcut.key,
                UIThemeUtils.createFontConfig('small', 'warning', {
                    stroke: true,
                    isMobile: this.isMobileDevice
                })
            ).setOrigin(0, 0.5);
            
            // Description
            const descText = this.scene.add.text(0, 0, shortcut.desc,
                UIThemeUtils.createFontConfig('small', 'secondary', {
                    isMobile: this.isMobileDevice
                })
            ).setOrigin(0, 0.5);
            
            row.add(keyText, { proportion: 0, align: 'left', padding: { left: UI_THEME.spacing.l } });
            row.add(descText, { proportion: 1, align: 'left' });
            
            container.add(row, { proportion: 0, align: 'left' });
        });
        
        return container;
    }
    
    /**
     * Vytvoří checkbox setting
     */
    createCheckboxSetting(icon, label, settingKey, tooltip = null) {
        const container = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.m }
        });
        
        // Label with icon
        const labelContainer = this.createSettingLabel(icon, label);
        container.add(labelContainer, { proportion: 1, align: 'center' });
        
        // Checkbox - použít správný RexUI checkbox
        const checkboxSize = 20;
        const checkbox = this.scene.add.rexCheckbox(0, 0, checkboxSize, checkboxSize, {
            color: UI_THEME.colors.borders.default,
            checkedColor: UIThemeUtils.colorToHex(UI_THEME.colors.success),
            boxFillAlpha: 0,
            checkerStyle: 1, // Path style
            animationDuration: 100,
            checked: this.settings[settingKey]
        });
        
        // Event handling
        checkbox.on('valuechange', () => {
            this.settings[settingKey] = checkbox.checked;
            console.log(`${settingKey}:`, this.settings[settingKey]);
        });
        
        container.add(checkbox, { proportion: 0, align: 'center' });
        
        return container;
    }
    
    /**
     * Vytvoří slider setting  
     */
    createSliderSetting(icon, label, settingKey, min, max, step, formatValue) {
        const container = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.m }
        });
        
        // Label with icon
        const labelContainer = this.createSettingLabel(icon, label);
        container.add(labelContainer, { proportion: 0, align: 'center' });
        
        // Value display - vytvořit PŘED sliderem
        const valueText = this.scene.add.text(0, 0, formatValue(this.settings[settingKey]),
            UIThemeUtils.createFontConfig('small', 'accent', {
                isMobile: this.isMobileDevice
            })
        ).setOrigin(0.5);
        
        // Slider
        const sliderWidth = this.isMobileDevice ? 120 : 150;
        const slider = this.scene.rexUI.add.slider({
            width: sliderWidth,
            height: 20,
            
            track: this.scene.rexUI.add.roundRectangle(
                0, 0, sliderWidth, 8, 4,
                UI_THEME.colors.background.hud
            ).setStrokeStyle(1, UI_THEME.colors.borders.default),
            
            thumb: this.scene.add.circle(
                0, 0, 12,
                UI_THEME.colors.primary
            ).setStrokeStyle(2, UI_THEME.colors.borders.active),
            
            valuechangeCallback: (value) => {
                this.settings[settingKey] = value;
                valueText.setText(formatValue(value));
            },
            
            value: this.settings[settingKey],
            gap: step
        });
        
        container.add(slider, { proportion: 0, align: 'center' });
        
        container.add(valueText, { proportion: 0, align: 'center' });
        
        return container;
    }
    
    /**
     * Vytvoří radio button
     */
    createRadioButton(text) {
        const button = this.scene.rexUI.add.label({
            background: this.scene.rexUI.add.roundRectangle(
                0, 0, 0, 30,
                UI_THEME.borderRadius.normal,
                UI_THEME.colors.background.card
            ).setStrokeStyle(
                UI_THEME.borderWidth.normal,
                UI_THEME.colors.borders.default
            ),
            
            text: this.scene.add.text(0, 0, text,
                UIThemeUtils.createFontConfig('small', 'primary', {
                    isMobile: this.isMobileDevice
                })
            ),
            
            space: { left: 8, right: 8, top: 4, bottom: 4 }
        });
        
        // Make interactive
        button.setInteractive();
        
        return button;
    }
    
    /**
     * Vytvoří radio button s názvem
     */
    createRadioButtonWithName(text, name) {
        const button = this.createRadioButton(text);
        button.name = name;
        return button;
    }
    
    /**
     * Vytvoří label s ikonou pro setting
     */
    createSettingLabel(icon, text) {
        const container = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.s }
        });
        
        // Icon
        const iconText = this.scene.add.text(0, 0, icon, {
            fontSize: this.isMobileDevice ? '16px' : '18px'
        }).setOrigin(0.5);
        
        // Label text
        const labelText = this.scene.add.text(0, 0, text,
            UIThemeUtils.createFontConfig('normal', 'primary', {
                isMobile: this.isMobileDevice
            })
        ).setOrigin(0, 0.5);
        
        container.add(iconText, { proportion: 0, align: 'center' });
        container.add(labelText, { proportion: 0, align: 'center' });
        
        return container;
    }
    
    /**
     * Audio tab
     */
    createAudioTab() {
        // Master volume section
        this.createSettingsSection('Celková hlasitost', [
            this.createMasterVolumeSetting()
        ]);
        
        // Music section  
        this.createSettingsSection('Hudba', [
            this.createMusicEnabledSetting(),
            this.createMusicVolumeSetting()
        ]);
        
        // Sound effects section
        this.createSettingsSection('Zvukové efekty', [
            this.createSoundsEnabledSetting(),
            this.createSoundsVolumeSetting()
        ]);
    }
    
    /**
     * Master volume slider
     */
    createMasterVolumeSetting() {
        return this.createSliderSetting(
            '🔊',
            'Celková hlasitost',
            'masterVolume',
            0, 1, 0.05, // min, max, step
            (value) => `${Math.round(value * 100)}%`
        );
    }
    
    /**
     * Music enabled checkbox
     */
    createMusicEnabledSetting() {
        return this.createCheckboxSetting(
            '🎵', 
            'Hudba',
            'musicEnabled',
            'Zapnout/vypnout hudbu v pozadí'
        );
    }
    
    /**
     * Music volume slider
     */
    createMusicVolumeSetting() {
        return this.createSliderSetting(
            '🎼',
            'Hlasitost hudby',
            'musicVolume',
            0, 1, 0.05,
            (value) => `${Math.round(value * 100)}%`
        );
    }
    
    /**
     * Sound effects enabled checkbox
     */
    createSoundsEnabledSetting() {
        return this.createCheckboxSetting(
            '🔔', 
            'Zvukové efekty',
            'soundsEnabled',
            'Zapnout/vypnout zvukové efekty'
        );
    }
    
    /**
     * Sound effects volume slider
     */
    createSoundsVolumeSetting() {
        return this.createSliderSetting(
            '🔉',
            'Hlasitost efektů',
            'soundsVolume',
            0, 1, 0.05,
            (value) => `${Math.round(value * 100)}%`
        );
    }
    
    /**
     * Display tab
     */
    createDisplayTab() {
        // Screen section
        this.createSettingsSection('Obrazovka', [
            this.createFullscreenSetting(),
            this.createShowFPSSetting()
        ]);
        
        // Quality section
        this.createSettingsSection('Kvalita grafiky', [
            this.createGraphicsQualitySetting()
        ]);
        
        // UI section
        this.createSettingsSection('Uživatelské rozhraní', [
            this.createUIScaleSetting()
        ]);
    }
    
    /**
     * Fullscreen checkbox
     */
    createFullscreenSetting() {
        return this.createCheckboxSetting(
            '📺',
            'Celá obrazovka',
            'fullscreen',
            'Spustit hru v režimu celé obrazovky'
        );
    }
    
    /**
     * Show FPS checkbox
     */
    createShowFPSSetting() {
        return this.createCheckboxSetting(
            '📊',
            'Zobrazit FPS',
            'showFPS',
            'Zobrazit snímky za sekundu v rohu obrazovky'
        );
    }
    
    /**
     * Graphics quality radio buttons
     */
    createGraphicsQualitySetting() {
        const container = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.m }
        });
        
        // Label with icon
        const labelContainer = this.createSettingLabel('🎨', 'Kvalita grafiky');
        container.add(labelContainer, { proportion: 0, align: 'center' });
        
        // Radio buttons for quality
        const qualityButtons = this.scene.rexUI.add.buttons({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.s },
            buttons: [
                this.createRadioButtonWithName('Nízká', 'low'),
                this.createRadioButtonWithName('Střední', 'medium'),
                this.createRadioButtonWithName('Vysoká', 'high')
            ],
            type: 'radio',
            setValueCallback: (button, value) => {
                // Update button visual state
                button.getElement('background').setFillStyle(
                    value ? UI_THEME.colors.background.panel : UI_THEME.colors.background.card
                ).setStrokeStyle(
                    UI_THEME.borderWidth.normal,
                    value ? UI_THEME.colors.borders.active : UI_THEME.colors.borders.default
                );
                
                button.getElement('text').setColor(
                    UIThemeUtils.colorToHex(value ? UI_THEME.colors.accent : UI_THEME.colors.primary)
                );
            }
        });
        
        // Set initial selection
        qualityButtons.setSelectedButtonName(this.settings.graphicsQuality);
        
        // Event handling
        qualityButtons.on('button.statechange', (button, index, value) => {
            if (value) { // Only handle when button becomes selected
                const qualities = ['low', 'medium', 'high'];
                this.settings.graphicsQuality = qualities[index];
                console.log('Graphics quality:', this.settings.graphicsQuality);
            }
        });
        
        container.add(qualityButtons, { proportion: 0, align: 'center' });
        
        return container;
    }
    
    /**
     * UI Scale radio buttons
     */
    createUIScaleSetting() {
        const container = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.m }
        });
        
        // Label with icon
        const labelContainer = this.createSettingLabel('🔍', 'Velikost UI');
        container.add(labelContainer, { proportion: 0, align: 'center' });
        
        // Radio buttons for UI scale
        const scaleButtons = this.scene.rexUI.add.buttons({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.s },
            buttons: [
                this.createRadioButtonWithName('Malé', 'small'),
                this.createRadioButtonWithName('Střední', 'medium'),
                this.createRadioButtonWithName('Velké', 'large')
            ],
            type: 'radio',
            setValueCallback: (button, value) => {
                // Update button visual state
                button.getElement('background').setFillStyle(
                    value ? UI_THEME.colors.background.panel : UI_THEME.colors.background.card
                ).setStrokeStyle(
                    UI_THEME.borderWidth.normal,
                    value ? UI_THEME.colors.borders.active : UI_THEME.colors.borders.default
                );
                
                button.getElement('text').setColor(
                    UIThemeUtils.colorToHex(value ? UI_THEME.colors.accent : UI_THEME.colors.primary)
                );
            }
        });
        
        // Set initial selection
        scaleButtons.setSelectedButtonName(this.settings.uiScale);
        
        // Event handling
        scaleButtons.on('button.statechange', (button, index, value) => {
            if (value) { // Only handle when button becomes selected
                const scales = ['small', 'medium', 'large'];
                this.settings.uiScale = scales[index];
                console.log('UI Scale:', this.settings.uiScale);
            }
        });
        
        container.add(scaleButtons, { proportion: 0, align: 'center' });
        
        return container;
    }
    
    /**
     * Gameplay tab
     */
    createGameplayTab() {
        // Game behavior section
        this.createSettingsSection('Chování hry', [
            this.createAutoPauseSetting(),
            this.createVibrationSetting()
        ]);
    }
    
    /**
     * Auto-pause setting
     */
    createAutoPauseSetting() {
        return this.createCheckboxSetting(
            '⏸️',
            'Auto-pause při alt+tab',
            'autoPause',
            'Automaticky pozastavit hru při přepnutí do jiné aplikace'
        );
    }
    
    /**
     * Vibration setting
     */
    createVibrationSetting() {
        return this.createCheckboxSetting(
            '📳',
            'Vibrace',
            'vibration',
            'Zapnout vibrace na podporovaných zařízeních'
        );
    }
    
    /**
     * Data tab
     */
    createDataTab() {
        // Local data section
        this.createSettingsSection('Lokální data', [
            this.createResetHighScoresButton()
        ]);
        
        // Settings section
        this.createSettingsSection('Nastavení', [
            this.createResetToDefaultsButton()
        ]);
    }
    
    /**
     * Reset high scores button
     */
    createResetHighScoresButton() {
        const container = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.m }
        });
        
        // Label with icon
        const labelContainer = this.createSettingLabel('🏆', 'Lokální rekordní skóre');
        container.add(labelContainer, { proportion: 1, align: 'center' });
        
        // Reset button
        const resetButton = this.createActionButton('Resetovat', () => {
            this.confirmResetHighScores();
        });
        
        container.add(resetButton, { proportion: 0, align: 'center' });
        
        return container;
    }
    
    /**
     * Reset to defaults button
     */
    createResetToDefaultsButton() {
        const container = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.m }
        });
        
        // Label with icon
        const labelContainer = this.createSettingLabel('🔄', 'Všechna nastavení');
        container.add(labelContainer, { proportion: 1, align: 'center' });
        
        // Reset button
        const resetButton = this.createActionButton('Výchozí', () => {
            this.confirmResetToDefaults();
        });
        
        container.add(resetButton, { proportion: 0, align: 'center' });
        
        return container;
    }
    
    /**
     * Vytvoří action button
     */
    createActionButton(text, onClickCallback) {
        const buttonWidth = this.isMobileDevice ? 80 : 90;
        const buttonHeight = this.isMobileDevice ? 30 : 35;
        
        const button = this.scene.rexUI.add.sizer({
            width: buttonWidth,
            height: buttonHeight,
            orientation: 'horizontal'
        });
        
        // Background
        const background = this.scene.rexUI.add.roundRectangle(
            0, 0, buttonWidth, buttonHeight,
            UI_THEME.borderRadius.normal,
            UI_THEME.colors.background.card
        ).setStrokeStyle(
            UI_THEME.borderWidth.normal,
            UI_THEME.colors.borders.default
        );
        
        button.addBackground(background);
        
        // Text
        const buttonText = this.scene.add.text(0, 0, text,
            UIThemeUtils.createFontConfig('small', 'primary', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        button.add(buttonText, { proportion: 1, align: 'center' });
        
        // Interactivity
        button.setInteractive()
            .on('pointerover', () => {
                background.setFillStyle(UI_THEME.colors.background.panel);
                background.setStrokeStyle(UI_THEME.borderWidth.thick, UI_THEME.colors.borders.active);
            })
            .on('pointerout', () => {
                background.setFillStyle(UI_THEME.colors.background.card);
                background.setStrokeStyle(UI_THEME.borderWidth.normal, UI_THEME.colors.borders.default);
            })
            .on('pointerdown', onClickCallback);
        
        return button;
    }
    
    /**
     * Potvrzovací dialog pro reset high scores
     */
    confirmResetHighScores() {
        // TODO: Implementovat confirmation dialog
        console.log('Reset local high scores - need confirmation dialog');
    }
    
    /**
     * Potvrzovací dialog pro reset všech nastavení
     */
    confirmResetToDefaults() {
        // TODO: Implementovat confirmation dialog  
        console.log('Reset all settings to defaults - need confirmation dialog');
    }
    
    /**
     * Vytvoří footer s tlačítky
     */
    createFooter() {
        const buttonsContainer = this.scene.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: UI_THEME.spacing.m }
        });
        
        // Apply button
        const applyButton = this.createFooterButton('Použít', () => this.applySettings());
        buttonsContainer.add(applyButton, { proportion: 0, align: 'center' });
        
        // Cancel button
        const cancelButton = this.createFooterButton('Zrušit', () => this.closeModal());
        buttonsContainer.add(cancelButton, { proportion: 0, align: 'center' });
        
        this.modalContainer.add(buttonsContainer, {
            proportion: 0,
            align: 'center',
            padding: { bottom: UI_THEME.spacing.l }
        });
    }
    
    /**
     * Vytvoří footer tlačítko
     */
    createFooterButton(text, onClickCallback) {
        const buttonWidth = this.isMobileDevice ? 80 : 100;
        const buttonHeight = this.isMobileDevice ? 35 : 40;
        
        const button = this.scene.rexUI.add.sizer({
            width: buttonWidth,
            height: buttonHeight,
            orientation: 'horizontal'
        });
        
        // Background
        const background = this.scene.rexUI.add.roundRectangle(
            0, 0, buttonWidth, buttonHeight,
            UI_THEME.borderRadius.normal,
            UI_THEME.colors.background.card
        ).setStrokeStyle(
            UI_THEME.borderWidth.normal,
            UI_THEME.colors.borders.default
        );
        
        button.addBackground(background);
        
        // Text
        const buttonText = this.scene.add.text(0, 0, text,
            UIThemeUtils.createFontConfig('normal', 'primary', { 
                stroke: true,
                isMobile: this.isMobileDevice 
            })
        ).setOrigin(0.5);
        
        button.add(buttonText, { proportion: 1, align: 'center' });
        
        // Interactivity
        button.setInteractive()
            .on('pointerover', () => {
                background.setFillStyle(UI_THEME.colors.background.panel);
                background.setStrokeStyle(UI_THEME.borderWidth.thick, UI_THEME.colors.borders.active);
            })
            .on('pointerout', () => {
                background.setFillStyle(UI_THEME.colors.background.card);
                background.setStrokeStyle(UI_THEME.borderWidth.normal, UI_THEME.colors.borders.default);
            })
            .on('pointerdown', onClickCallback);
        
        return button;
    }
    
    /**
     * Aplikuje a uloží nastavení
     */
    applySettings() {
        this.saveSettings();
        
        // Apply settings to game
        this.applyToGame();
        
        this.closeModal();
    }
    
    /**
     * Aplikuje nastavení do hry přes SettingsManager
     * PR7 kompatibilní - managery mají applyUserSettings() metody
     */
    applyToGame() {
        // Uložit nastavení do SettingsManager
        const updates = {
            // Ovládání
            'controls.joystickEnabled': this.settings.joystickEnabled,
            'controls.joystickPosition': this.settings.joystickPosition,
            'controls.joystickSensitivity': this.settings.joystickSensitivity,
            
            // Zvuk
            'audio.masterVolume': this.settings.masterVolume,
            'audio.musicEnabled': this.settings.musicEnabled,
            'audio.musicVolume': this.settings.musicVolume,
            'audio.soundsEnabled': this.settings.soundsEnabled,
            'audio.soundsVolume': this.settings.soundsVolume,
            
            // Zobrazení
            'display.fullscreen': this.settings.fullscreen,
            'display.graphicsQuality': this.settings.graphicsQuality,
            'display.uiScale': this.settings.uiScale,
            'display.showFPS': this.settings.showFPS,
            
            // Gameplay
            'gameplay.autoPause': this.settings.autoPause,
            'gameplay.vibration': this.settings.vibration
        };
        
        settingsManager.setMultiple(updates);
        
        // Aplikovat na managery
        settingsManager.applyToManagers(this.scene);
        
        console.log('[SettingsModal] Nastavení aplikována do hry');
    }
    
    /**
     * Zobrazí modal
     */
    show() {
        // Re-create modal if it was destroyed
        if (!this.modalContainer) {
            this.createModal();
        }
        
        // Show components
        this.setVisible(true);
        
        if (this.modalContainer) {
            this.modalContainer.setVisible(true);
            this.modalContainer.setAlpha(0);
            
            // Fade in animation
            this.scene.tweens.add({
                targets: this.modalContainer,
                alpha: 1,
                duration: 300
            });
        }
        
        // Show overlay
        const overlay = this.list ? this.list[0] : null;
        if (overlay) {
            overlay.setVisible(true);
            overlay.setAlpha(1);
        }
    }
    
    /**
     * Zavře modal
     */
    closeModal() {
        this.scene.tweens.add({
            targets: this.modalContainer,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                // Hide components instead of destroying
                if (this.modalContainer) {
                    this.modalContainer.setVisible(false);
                    this.modalContainer.setAlpha(1); // Reset alpha for next show
                }
                
                // Hide overlay
                const overlay = this.list ? this.list[0] : null;
                if (overlay) {
                    overlay.setVisible(false);
                    overlay.setAlpha(1);
                }
                
                // Hide this component
                this.setVisible(false);
                
                if (this.onCloseCallback) {
                    this.onCloseCallback();
                }
                
                // Don't destroy - keep for reuse
                // this.destroy();
            }
        });
    }
    
    /**
     * Resize handler
     */
    onResize(gameSize, baseSize, displaySize) {
        super.onResize(gameSize, baseSize, displaySize);
        
        if (this.modalContainer) {
            this.modalContainer.x = gameSize.width / 2;
            this.modalContainer.y = gameSize.height / 2;
        }
    }
    
    /**
     * Cleanup
     */
    onCleanup() {
        this.onCloseCallback = null;
        this.tabButtons = [];
        this.tabContent = null;
        
        if (this.modalContainer) {
            this.modalContainer.destroy();
            this.modalContainer = null;
        }
    }
}

export default SettingsModal;