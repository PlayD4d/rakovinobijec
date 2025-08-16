/**
 * SettingsManager - Centrální správce uživatelských nastavení
 * 
 * PR7 kompatibilní - sjednocuje systémové a uživatelské konfigurace
 * Systémové výchozí hodnoty z managers_config.json5 přes ConfigResolver
 * Uživatelské preference v localStorage
 * 
 * Priorita načítání: localStorage > managers_config > hardcoded fallback
 */

export class SettingsManager {
    constructor() {
        // Singleton pattern
        if (SettingsManager.instance) {
            return SettingsManager.instance;
        }
        
        this.settings = {};
        this.listeners = new Map(); // Pro notifikace změn
        this.initialized = false;
        
        SettingsManager.instance = this;
    }
    
    /**
     * Inicializuje SettingsManager s výchozími hodnotami z ConfigResolver
     * @param {ConfigResolver} configResolver - Instance ConfigResolver
     */
    initialize(configResolver) {
        if (this.initialized) return;
        
        // Načtení výchozích hodnot z managers_config.json5
        const defaults = this.loadDefaultsFromConfig(configResolver);
        
        // Načtení uložených uživatelských preferencí
        const saved = this.loadFromLocalStorage();
        
        // Sloučení: uživatelské hodnoty mají prioritu
        this.settings = { ...defaults, ...saved };
        
        this.initialized = true;
        console.log('[SettingsManager] Inicializováno s nastavením:', this.settings);
    }
    
    /**
     * Načte výchozí hodnoty z ConfigResolver (managers_config.json5)
     * @private
     */
    loadDefaultsFromConfig(configResolver) {
        const CR = configResolver || window.ConfigResolver;
        
        return {
            // ===== OVLÁDÁNÍ =====
            controls: {
                joystickEnabled: CR?.get('mobile.joystick.enabled', { defaultValue: true }) ?? true,
                joystickPosition: CR?.get('mobile.joystick.position', { defaultValue: 'left' }) ?? 'left',
                joystickSensitivity: CR?.get('mobile.joystick.sensitivity', { defaultValue: 0.5 }) ?? 0.5,
                deadzone: CR?.get('mobile.joystick.deadzone', { defaultValue: 0.15 }) ?? 0.15,
            },
            
            // ===== ZVUK =====
            audio: {
                masterVolume: CR?.get('audio.masterVolume', { defaultValue: 1.0 }) ?? 1.0,
                musicEnabled: CR?.get('audio.musicEnabled', { defaultValue: true }) ?? true,
                musicVolume: CR?.get('audio.musicVolume', { defaultValue: 0.35 }) ?? 0.35,
                soundsEnabled: CR?.get('audio.soundsEnabled', { defaultValue: true }) ?? true,
                soundsVolume: CR?.get('audio.sfxVolume', { defaultValue: 0.7 }) ?? 0.7,
            },
            
            // ===== ZOBRAZENÍ =====
            display: {
                fullscreen: false, // Vždy false na začátku
                graphicsQuality: CR?.get('graphics.quality', { defaultValue: 'high' }) ?? 'high',
                uiScale: CR?.get('ui.scale', { defaultValue: 'medium' }) ?? 'medium',
                showFPS: CR?.get('debug.showFPS', { defaultValue: false }) ?? false,
                particleQuality: CR?.get('graphics.particleQuality', { defaultValue: 'high' }) ?? 'high',
            },
            
            // ===== GAMEPLAY =====
            gameplay: {
                autoPause: CR?.get('gameplay.autoPause', { defaultValue: true }) ?? true,
                vibration: CR?.get('gameplay.vibration', { defaultValue: true }) ?? true,
                difficulty: CR?.get('gameplay.difficulty', { defaultValue: 'normal' }) ?? 'normal',
                autoSave: CR?.get('gameplay.autoSave', { defaultValue: true }) ?? true,
            },
            
            // ===== DATA & PRIVACY =====
            data: {
                allowAnalytics: CR?.get('analytics.enabled', { defaultValue: true }) ?? true,
                syncHighScore: CR?.get('highscore.syncEnabled', { defaultValue: true }) ?? true,
            }
        };
    }
    
    /**
     * Načte uložené preference z localStorage
     * @private
     */
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('gameSettings');
            if (saved) {
                const parsed = JSON.parse(saved);
                console.log('[SettingsManager] Načteno z localStorage:', parsed);
                return this.flattenSettings(parsed);
            }
        } catch (error) {
            console.warn('[SettingsManager] Chyba při načítání z localStorage:', error);
        }
        return {};
    }
    
    /**
     * Uloží aktuální nastavení do localStorage
     */
    saveToLocalStorage() {
        try {
            const structured = this.structureSettings(this.settings);
            localStorage.setItem('gameSettings', JSON.stringify(structured));
            console.log('[SettingsManager] Uloženo do localStorage');
        } catch (error) {
            console.error('[SettingsManager] Chyba při ukládání:', error);
        }
    }
    
    /**
     * Převede vnořenou strukturu na plochou (pro interní použití)
     * @private
     */
    flattenSettings(structured) {
        const flat = {};
        for (const [category, values] of Object.entries(structured)) {
            if (typeof values === 'object' && values !== null) {
                for (const [key, value] of Object.entries(values)) {
                    flat[`${category}.${key}`] = value;
                }
            } else {
                flat[category] = values;
            }
        }
        return flat;
    }
    
    /**
     * Převede plochou strukturu na vnořenou (pro localStorage)
     * @private
     */
    structureSettings(flat) {
        const structured = {};
        for (const [key, value] of Object.entries(flat)) {
            if (key.includes('.')) {
                const [category, setting] = key.split('.');
                if (!structured[category]) {
                    structured[category] = {};
                }
                structured[category][setting] = value;
            } else {
                structured[key] = value;
            }
        }
        return structured;
    }
    
    /**
     * Získá hodnotu nastavení
     * @param {string} key - Klíč nastavení (např. 'audio.musicVolume')
     * @param {*} defaultValue - Záložní hodnota
     */
    get(key, defaultValue = undefined) {
        return this.settings[key] ?? defaultValue;
    }
    
    /**
     * Nastaví hodnotu
     * @param {string} key - Klíč nastavení
     * @param {*} value - Nová hodnota
     * @param {boolean} save - Automaticky uložit do localStorage
     */
    set(key, value, save = true) {
        const oldValue = this.settings[key];
        this.settings[key] = value;
        
        // Notifikace posluchačů
        this.notifyListeners(key, value, oldValue);
        
        // Uložení do localStorage
        if (save) {
            this.saveToLocalStorage();
        }
    }
    
    /**
     * Nastaví více hodnot najednou
     * @param {object} updates - Objekt s aktualizacemi
     * @param {boolean} save - Automaticky uložit
     */
    setMultiple(updates, save = true) {
        for (const [key, value] of Object.entries(updates)) {
            this.set(key, value, false);
        }
        
        if (save) {
            this.saveToLocalStorage();
        }
    }
    
    /**
     * Registruje posluchače změn
     * @param {string} key - Klíč nastavení nebo '*' pro všechny
     * @param {function} callback - Funkce volaná při změně
     */
    addListener(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);
    }
    
    /**
     * Odregistruje posluchače
     */
    removeListener(key, callback) {
        if (this.listeners.has(key)) {
            this.listeners.get(key).delete(callback);
        }
    }
    
    /**
     * Notifikuje posluchače o změně
     * @private
     */
    notifyListeners(key, newValue, oldValue) {
        // Specifičtí posluchači
        if (this.listeners.has(key)) {
            for (const callback of this.listeners.get(key)) {
                callback(newValue, oldValue, key);
            }
        }
        
        // Globální posluchači
        if (this.listeners.has('*')) {
            for (const callback of this.listeners.get('*')) {
                callback(newValue, oldValue, key);
            }
        }
    }
    
    /**
     * Aplikuje nastavení na managery
     * Voláno po změně nastavení v UI
     */
    applyToManagers(scene) {
        // SFXSystem - modern audio system
        if (scene.sfxSystem) {
            // Apply all volume categories properly
            scene.sfxSystem.setVolume('master', this.get('audio.masterVolume', 1.0));
            scene.sfxSystem.setVolume('music', this.get('audio.musicVolume', 0.35));
            scene.sfxSystem.setVolume('sfx', this.get('audio.soundsVolume', 0.7));
            
            // Enable/disable sounds
            const soundsEnabled = this.get('audio.soundsEnabled', true);
            const musicEnabled = this.get('audio.musicEnabled', true);
            
            if (!soundsEnabled) {
                scene.sfxSystem.setVolume('sfx', 0);
            }
            if (!musicEnabled) {
                scene.sfxSystem.setVolume('music', 0);
            }
        }
        
        // MobileControlsManager
        if (scene.mobileControls) {
            const enabled = this.get('controls.joystickEnabled', true);
            const position = this.get('controls.joystickPosition', 'left');
            
            if (enabled) {
                scene.mobileControls.enable();
                scene.mobileControls.setSide(position);
            } else {
                scene.mobileControls.disable();
            }
        }
        
        // AnalyticsManager
        if (scene.analyticsManager) {
            scene.analyticsManager.setEnabled(
                this.get('data.allowAnalytics', true)
            );
        }
        
        // Graphics settings
        this.applyGraphicsSettings(scene);
        
        console.log('[SettingsManager] Nastavení aplikováno na managery');
    }
    
    /**
     * Aplikuje grafická nastavení
     * @private
     */
    applyGraphicsSettings(scene) {
        const quality = this.get('display.graphicsQuality', 'high');
        const showFPS = this.get('display.showFPS', false);
        
        // Particle quality
        if (scene.vfxSystem) {
            const particleMultiplier = {
                'low': 0.3,
                'medium': 0.6,
                'high': 1.0
            }[quality] || 1.0;
            
            scene.vfxSystem.setQualityMultiplier(particleMultiplier);
        }
        
        // FPS counter
        if (scene.debugOverlay) {
            scene.debugOverlay.setVisible(showFPS);
        }
    }
    
    /**
     * Reset na výchozí hodnoty
     */
    reset() {
        const CR = window.ConfigResolver;
        this.settings = this.loadDefaultsFromConfig(CR);
        this.saveToLocalStorage();
        console.log('[SettingsManager] Reset na výchozí hodnoty');
    }
    
    /**
     * Export nastavení jako JSON
     */
    export() {
        return JSON.stringify(this.structureSettings(this.settings), null, 2);
    }
    
    /**
     * Import nastavení z JSON
     */
    import(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            const flattened = this.flattenSettings(parsed);
            this.setMultiple(flattened);
            console.log('[SettingsManager] Nastavení importováno');
            return true;
        } catch (error) {
            console.error('[SettingsManager] Chyba při importu:', error);
            return false;
        }
    }
}

// Singleton export
export const settingsManager = new SettingsManager();