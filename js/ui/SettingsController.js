/**
 * SettingsController - Logic and state management for settings
 * Handles validation, persistence, and application of settings
 */

import { settingsManager } from './SettingsManager.js';

export class SettingsController {
    constructor(scene) {
        this.scene = scene;
        
        // State
        this.currentTab = 'display';
        this.isDirty = false;
        this.pendingChanges = new Map();
        
        // Tab definitions
        this.tabs = [
            { key: 'display', label: 'Zobrazení', icon: '🖥️' },
            { key: 'audio', label: 'Zvuk', icon: '🔊' },
            { key: 'controls', label: 'Ovládání', icon: '🎮' },
            { key: 'gameplay', label: 'Hratelnost', icon: '⚔️' },
            { key: 'about', label: 'O hře', icon: 'ℹ️' }
        ];
        
        // Settings structure
        this.settingsStructure = {
            display: [
                { key: 'fullscreen', type: 'checkbox', label: 'Celá obrazovka' },
                { key: 'showFPS', type: 'checkbox', label: 'Zobrazit FPS' },
                { key: 'graphicsQuality', type: 'select', label: 'Kvalita grafiky', 
                  options: ['low', 'medium', 'high', 'ultra'] },
                { key: 'showDamageNumbers', type: 'checkbox', label: 'Zobrazit čísla poškození' },
                { key: 'screenShake', type: 'checkbox', label: 'Třesení obrazovky' },
                { key: 'showMinimapAlways', type: 'checkbox', label: 'Zobrazit minimapu' }
            ],
            audio: [
                { key: 'masterVolume', type: 'slider', label: 'Hlavní hlasitost', min: 0, max: 100, step: 1 },
                { key: 'musicEnabled', type: 'checkbox', label: 'Hudba' },
                { key: 'musicVolume', type: 'slider', label: 'Hlasitost hudby', min: 0, max: 100, step: 1 },
                { key: 'soundsEnabled', type: 'checkbox', label: 'Zvukové efekty' },
                { key: 'soundsVolume', type: 'slider', label: 'Hlasitost efektů', min: 0, max: 100, step: 1 }
            ],
            controls: [
                { key: 'joystickEnabled', type: 'checkbox', label: 'Virtuální joystick' },
                { key: 'joystickPosition', type: 'radio', label: 'Pozice joysticku',
                  options: ['left', 'right'] },
                { key: 'joystickSensitivity', type: 'slider', label: 'Citlivost joysticku', 
                  min: 0.5, max: 2.0, step: 0.1 },
                { key: 'keyboardShortcuts', type: 'info', label: 'Klávesové zkratky' }
            ],
            gameplay: [
                { key: 'autoPickupXP', type: 'checkbox', label: 'Automatický sběr XP' },
                { key: 'autoPickupHealth', type: 'checkbox', label: 'Automatický sběr zdraví' },
                { key: 'pauseOnLevelUp', type: 'checkbox', label: 'Pauza při level up' },
                { key: 'showTutorialHints', type: 'checkbox', label: 'Zobrazit tipy' },
                { key: 'confirmQuit', type: 'checkbox', label: 'Potvrzení ukončení' },
                { key: 'targetPriority', type: 'select', label: 'Priorita cílení',
                  options: ['nearest', 'weakest', 'strongest', 'boss'] }
            ]
        };
    }
    
    /**
     * Get current value of a setting
     */
    getSetting(key) {
        // Check pending changes first
        if (this.pendingChanges.has(key)) {
            return this.pendingChanges.get(key);
        }
        return settingsManager.getSetting(key);
    }
    
    /**
     * Update a setting value
     */
    setSetting(key, value) {
        const oldValue = this.getSetting(key);
        
        if (oldValue !== value) {
            this.pendingChanges.set(key, value);
            this.isDirty = true;
            
            // Apply immediately for some settings
            if (this.shouldApplyImmediately(key)) {
                this.applySettingImmediately(key, value);
            }
        }
    }
    
    /**
     * Check if setting should be applied immediately
     */
    shouldApplyImmediately(key) {
        const immediateSettings = [
            'masterVolume', 'musicVolume', 'soundsVolume',
            'musicEnabled', 'soundsEnabled',
            'showFPS', 'screenShake'
        ];
        return immediateSettings.includes(key);
    }
    
    /**
     * Apply setting immediately without saving
     */
    applySettingImmediately(key, value) {
        settingsManager.applySetting(key, value);
        
        // Emit event for UI update
        if (this.scene?.events) {
            this.scene.events.emit('settings:changed', { key, value });
        }
    }
    
    /**
     * Save all pending changes
     */
    saveChanges() {
        if (!this.isDirty) return;
        
        // Apply all pending changes
        for (const [key, value] of this.pendingChanges) {
            settingsManager.setSetting(key, value);
        }
        
        // Save to localStorage
        settingsManager.save();
        
        // Clear pending
        this.pendingChanges.clear();
        this.isDirty = false;
        
        console.log('[SettingsController] Settings saved');
    }
    
    /**
     * Discard pending changes
     */
    discardChanges() {
        if (!this.isDirty) return;
        
        // Revert immediate settings
        for (const [key, value] of this.pendingChanges) {
            if (this.shouldApplyImmediately(key)) {
                const originalValue = settingsManager.getSetting(key);
                this.applySettingImmediately(key, originalValue);
            }
        }
        
        this.pendingChanges.clear();
        this.isDirty = false;
        
        console.log('[SettingsController] Changes discarded');
    }
    
    /**
     * Change active tab
     */
    setActiveTab(tabKey) {
        if (this.tabs.find(t => t.key === tabKey)) {
            this.currentTab = tabKey;
            return true;
        }
        return false;
    }
    
    /**
     * Get settings for current tab
     */
    getCurrentTabSettings() {
        return this.settingsStructure[this.currentTab] || [];
    }
    
    /**
     * Reset settings to defaults
     */
    resetToDefaults() {
        settingsManager.resetToDefaults();
        this.pendingChanges.clear();
        this.isDirty = false;
        
        // Emit event for UI update
        if (this.scene?.events) {
            this.scene.events.emit('settings:reset');
        }
    }
    
    /**
     * Get keyboard shortcuts info
     */
    getKeyboardShortcuts() {
        return [
            { key: 'WASD / šipky', action: 'Pohyb' },
            { key: 'ESC', action: 'Pauza' },
            { key: 'M', action: 'Ztlumit zvuk' },
            { key: 'F', action: 'Celá obrazovka' },
            { key: 'Tab', action: 'Zobrazit skóre' },
            { key: 'Space', action: 'Použít schopnost' }
        ];
    }
    
    /**
     * Get about info
     */
    getAboutInfo() {
        return {
            version: '0.4.1',
            author: 'Tým Rakovinobijec',
            description: 'Arkádová top-down střílečka',
            website: 'https://github.com/Rakovinobijec',
            engine: 'Phaser 3.85.2'
        };
    }
    
    /**
     * Export settings
     */
    exportSettings() {
        return settingsManager.exportSettings();
    }
    
    /**
     * Import settings
     */
    importSettings(data) {
        try {
            settingsManager.importSettings(data);
            this.pendingChanges.clear();
            this.isDirty = false;
            
            if (this.scene?.events) {
                this.scene.events.emit('settings:imported');
            }
            
            return true;
        } catch (error) {
            console.error('[SettingsController] Import failed:', error);
            return false;
        }
    }
}