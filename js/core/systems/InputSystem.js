/**
 * InputSystem - PR7 kompatibilní wrapper pro Phaser input API
 * Centralizuje všechny input operace a odstraňuje přímé Phaser API volání
 */

export class InputSystem {
    constructor(scene) {
        this.scene = scene;
        this.pointers = new Map();
        this.listeners = new Map();
        this.initialized = false;
    }
    
    /**
     * Inicializace systému
     */
    initialize() {
        if (this.initialized) return;
        
        // Základní nastavení z ConfigResolver
        const CR = window.ConfigResolver;
        this.config = {
            maxPointers: CR?.get('input.maxPointers', { defaultValue: 2 }) || 2,
            dragThreshold: CR?.get('input.dragThreshold', { defaultValue: 10 }) || 10,
            doubleTapDelay: CR?.get('input.doubleTapDelay', { defaultValue: 300 }) || 300
        };
        
        this.initialized = true;
        console.log('[InputSystem] Inicializován');
    }
    
    /**
     * Přidá pointer do systému
     * @param {number} count - Počet pointerů k přidání
     */
    addPointers(count = 1) {
        const input = this.scene.input;
        for (let i = 0; i < count; i++) {
            if (input.pointersTotal < this.config.maxPointers) {
                input.addPointer(1);
            }
        }
    }
    
    /**
     * Registruje event listener
     * @param {string} event - Název eventu
     * @param {function} callback - Callback funkce
     * @param {object} context - Kontext pro callback
     */
    on(event, callback, context) {
        const input = this.scene.input;
        const boundCallback = context ? callback.bind(context) : callback;
        
        // Uložit pro pozdější cleanup
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add({ callback: boundCallback, original: callback, context });
        
        input.on(event, boundCallback);
    }
    
    /**
     * Odregistruje event listener
     * @param {string} event - Název eventu
     * @param {function} callback - Callback funkce
     * @param {object} context - Kontext
     */
    off(event, callback, context) {
        const input = this.scene.input;
        const listeners = this.listeners.get(event);
        
        if (!listeners) return;
        
        // Najít správný listener
        for (const listener of listeners) {
            if (listener.original === callback && listener.context === context) {
                input.off(event, listener.callback);
                listeners.delete(listener);
                break;
            }
        }
    }
    
    /**
     * Získá počet aktivních pointerů
     */
    getPointersTotal() {
        return this.scene.input.pointersTotal;
    }
    
    /**
     * Získá aktivní pointer podle indexu
     * @param {number} index - Index pointeru
     */
    getPointer(index = 0) {
        return this.scene.input.pointer[index];
    }
    
    /**
     * Nastaví kurzor
     * @param {string} cursor - CSS cursor hodnota
     */
    setCursor(cursor) {
        this.scene.input.setDefaultCursor(cursor);
    }
    
    /**
     * Cleanup při shutdown
     */
    shutdown() {
        // Odregistrovat všechny listenery
        for (const [event, listeners] of this.listeners) {
            for (const listener of listeners) {
                this.scene.input.off(event, listener.callback);
            }
        }
        this.listeners.clear();
        this.pointers.clear();
        
        console.log('[InputSystem] Shutdown');
    }
    
    /**
     * Destrukce systému
     */
    destroy() {
        this.shutdown();
        this.initialized = false;
    }
}

// Singleton pro globální přístup
let inputSystemInstance = null;

export function getInputSystem(scene) {
    if (!inputSystemInstance) {
        inputSystemInstance = new InputSystem(scene);
        inputSystemInstance.initialize();
    }
    return inputSystemInstance;
}

export default InputSystem;