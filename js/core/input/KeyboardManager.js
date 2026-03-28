import { DebugLogger } from '../debug/DebugLogger.js';

/**
 * KeyboardManager - Centralizovaný management keyboard inputů
 *
 * PR7 kompatibilní systém pro správu klávesových zkratek s:
 * - Automatickým cleanup
 * - Kontext-based organizací
 * - EventBus integrací
 * - Žádné removeKey errors
 */

export class KeyboardManager {
    constructor(scene, eventBus) {
        this.scene = scene;
        this.eventBus = eventBus;
        
        /** @type {Map<string, {key: Phaser.Input.Keyboard.Key, handler: Function}>} */
        this.handlers = new Map();
        
        DebugLogger.info('input', '[KeyboardManager] Initialized');
    }
    
    /**
     * Zaregistrovat klávesovou zkratku
     * @param {string} keyCode - kód klávesy (např. 'ESC', 'F3', 'SPACE')
     * @param {string} eventName - název eventu pro EventBus
     * @param {string} context - kontext pro groupování (např. 'game', 'debug', 'ui')
     * @param {Object} payload - volitelný payload pro event
     */
    register(keyCode, eventName, context = 'global', payload = {}) {
        const id = `${context}:${keyCode}`;
        
        // Pokud už je registrovaný, nejdřív ho odregistruj
        if (this.handlers.has(id)) {
            this.unregister(keyCode, context);
        }
        
        try {
            const key = this.scene.input.keyboard.addKey(keyCode);
            const handler = () => {
                if (this.eventBus) {
                    this.eventBus.emit(eventName, payload);
                }
            };
            
            key.on('down', handler);
            this.handlers.set(id, { key, handler });
            
            DebugLogger.info('input', `[KeyboardManager] Registered ${keyCode} -> ${eventName} (${context})`);
        } catch (error) {
            console.warn(`[KeyboardManager] Failed to register ${keyCode}:`, error);
        }
    }
    
    /**
     * Zaregistrovat klávesovou zkratku s přímým callback
     * @param {string} keyCode - kód klávesy
     * @param {Function} callback - funkce k zavolání
     * @param {string} context - kontext
     */
    registerDirect(keyCode, callback, context = 'global') {
        const id = `${context}:${keyCode}`;
        
        if (this.handlers.has(id)) {
            this.unregister(keyCode, context);
        }
        
        try {
            const key = this.scene.input.keyboard.addKey(keyCode);
            const handler = () => callback();
            
            key.on('down', handler);
            this.handlers.set(id, { key, handler });
            
            DebugLogger.info('input', `[KeyboardManager] Registered direct ${keyCode} (${context})`);
        } catch (error) {
            console.warn(`[KeyboardManager] Failed to register direct ${keyCode}:`, error);
        }
    }
    
    /**
     * Odregistrovat specifickou klávesovou zkratku
     * @param {string} keyCode 
     * @param {string} context 
     */
    unregister(keyCode, context = 'global') {
        const id = `${context}:${keyCode}`;
        const entry = this.handlers.get(id);
        
        if (entry) {
            try {
                entry.key.off('down', entry.handler);
                this.handlers.delete(id);
                DebugLogger.info('input', `[KeyboardManager] Unregistered ${keyCode} (${context})`);
            } catch (error) {
                console.warn(`[KeyboardManager] Failed to unregister ${keyCode}:`, error);
            }
        }
    }
    
    /**
     * Vyčistit všechny klávesy z daného kontextu
     * @param {string} context 
     */
    cleanupContext(context) {
        const toRemove = [];
        
        for (const [id, entry] of this.handlers) {
            if (id.startsWith(context + ':')) {
                try {
                    entry.key.off('down', entry.handler);
                    toRemove.push(id);
                } catch (error) {
                    console.warn(`[KeyboardManager] Failed to cleanup ${id}:`, error);
                }
            }
        }
        
        toRemove.forEach(id => this.handlers.delete(id));
        
        if (toRemove.length > 0) {
            DebugLogger.info('input', `[KeyboardManager] Cleaned up ${toRemove.length} keys from context '${context}'`);
        }
    }
    
    /**
     * Zaregistrovat modální klávesový handler (temporary)
     * @param {string} modalId - unikátní ID modalu
     * @param {string} keyCode - kód klávesy
     * @param {Function} callback - funkce k zavolání
     */
    registerModal(modalId, keyCode, callback) {
        const context = `modal:${modalId}`;
        this.registerDirect(keyCode, callback, context);
    }
    
    /**
     * Zaregistrovat text input handler pro modal
     * @param {string} modalId - unikátní ID modalu  
     * @param {Function} onKeyDown - callback pro všechny klávesy
     */
    registerTextInput(modalId, onKeyDown) {
        const context = `modal:${modalId}`;
        const id = `${context}:textinput`;
        
        if (this.handlers.has(id)) {
            this.cleanupModal(modalId);
        }
        
        try {
            // Use generic keydown listener for text input
            const handler = (event) => onKeyDown(event);
            this.scene.input.keyboard.on('keydown', handler);
            
            // Store reference for cleanup
            this.handlers.set(id, { 
                key: { off: () => this.scene.input.keyboard.off('keydown', handler) }, 
                handler 
            });
            
            DebugLogger.info('input', `[KeyboardManager] Registered text input for modal ${modalId}`);
        } catch (error) {
            console.warn(`[KeyboardManager] Failed to register text input for ${modalId}:`, error);
        }
    }
    
    /**
     * Vyčistit všechny klávesy pro modal
     * @param {string} modalId 
     */
    cleanupModal(modalId) {
        this.cleanupContext(`modal:${modalId}`);
    }
    
    /**
     * Kompletní cleanup všech handlerů
     */
    destroy() {
        const count = this.handlers.size;
        
        // Kontrola existence input systému před cleanup
        if (!this.scene || !this.scene.input || !this.scene.input.keyboard) {
            console.warn('[KeyboardManager] Scene or input already destroyed, clearing handlers');
            this.handlers.clear();
            this.scene = null;
            this.eventBus = null;
            return;
        }
        
        for (const [id, entry] of this.handlers) {
            try {
                if (entry?.key) {
                    if (typeof entry.key.off === 'function') {
                        entry.key.off('down', entry.handler);
                    }
                    // Remove key from Phaser's InputPlugin to prevent stale removeKey crash
                    if (this.scene.input?.keyboard?.removeKey) {
                        this.scene.input.keyboard.removeKey(entry.key, true);
                    }
                }
            } catch (_) {}
        }
        
        this.handlers.clear();
        this.scene = null;
        this.eventBus = null;
        
        DebugLogger.info('input', `[KeyboardManager] Destroyed - cleaned up ${count} handlers`);
    }
    
    /**
     * Získat seznam registrovaných kláves pro debugging
     */
    getRegisteredKeys() {
        const keys = {};
        for (const [id] of this.handlers) {
            const [context, keyCode] = id.split(':');
            if (!keys[context]) keys[context] = [];
            keys[context].push(keyCode);
        }
        return keys;
    }
    
    /**
     * Nastavit standardní herní klávesy
     */
    setupGameKeys() {
        // Herní klávesy - movement je zpracován přímo v GameScene update loop
        // Pouze utility klávesy půjdou přes EventBus
        this.register('R', 'game:restart', 'game');

        DebugLogger.info('input', '[KeyboardManager] Game keys registered');
    }
    
    /**
     * Nastavit debug klávesy
     */
    /**
     * Register debug keys with direct callbacks (bypass CentralEventBus)
     * @param {Object} handlers - Map of key→callback: { F3: () => {}, F9: () => {} }
     */
    setupDebugKeys(handlers = {}) {
        for (const [keyCode, callback] of Object.entries(handlers)) {
            try {
                const key = this.scene.input.keyboard.addKey(keyCode);
                key.on('down', callback);
                this.handlers.set(`debug:${keyCode}`, { key, handler: callback });
            } catch (e) {
                console.warn(`[KeyboardManager] Failed to register debug key ${keyCode}:`, e);
            }
        }
        DebugLogger.info('input', '[KeyboardManager] Debug keys registered:', Object.keys(handlers).join(', '));
    }
    
    /**
     * Nastavit UI klávesy
     */
    setupUIKeys() {
        this.register('ESC', 'ui:escape', 'ui');
        
        DebugLogger.info('input', '[KeyboardManager] UI keys registered - ESC mapped to ui:escape event');
        DebugLogger.info('input', '[KeyboardManager] Active handlers:', this.handlers.size);
    }
}