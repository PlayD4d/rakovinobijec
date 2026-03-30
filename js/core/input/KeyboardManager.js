import { DebugLogger } from '../debug/DebugLogger.js';

/**
 * KeyboardManager - Centralized keyboard input management
 *
 * PR7 compatible system for managing keyboard shortcuts with:
 * - Automatic cleanup
 * - Context-based organization
 * - EventBus integration
 * - No removeKey errors
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
     * Register a keyboard shortcut
     * @param {string} keyCode - key code (e.g. 'ESC', 'F3', 'SPACE')
     * @param {string} eventName - event name for EventBus
     * @param {string} context - context for grouping (e.g. 'game', 'debug', 'ui')
     * @param {Object} payload - optional payload for event
     */
    register(keyCode, eventName, context = 'global', payload = {}) {
        const id = `${context}:${keyCode}`;

        // If already registered, unregister first
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
     * Register a keyboard shortcut with a direct callback
     * @param {string} keyCode - key code
     * @param {Function} callback - function to call
     * @param {string} context - context
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
     * Unregister a specific keyboard shortcut
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
     * Clean up all keys from a given context
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
     * Register a modal keyboard handler (temporary)
     * @param {string} modalId - unique modal ID
     * @param {string} keyCode - key code
     * @param {Function} callback - function to call
     */
    registerModal(modalId, keyCode, callback) {
        const context = `modal:${modalId}`;
        this.registerDirect(keyCode, callback, context);
    }
    
    /**
     * Register a text input handler for a modal
     * @param {string} modalId - unique modal ID
     * @param {Function} onKeyDown - callback for all keys
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
     * Clean up all keys for a modal
     * @param {string} modalId
     */
    cleanupModal(modalId) {
        this.cleanupContext(`modal:${modalId}`);
    }
    
    /**
     * Complete cleanup of all handlers
     */
    destroy() {
        const count = this.handlers.size;

        // Check input system existence before cleanup
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
     * Get list of registered keys for debugging
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
     * Set up standard game keys
     */
    setupGameKeys() {
        // Game keys - movement is handled directly in GameScene update loop
        // Only utility keys go through EventBus
        this.register('R', 'game:restart', 'game');

        DebugLogger.info('input', '[KeyboardManager] Game keys registered');
    }
    
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
     * Set up UI keys
     */
    setupUIKeys() {
        this.register('ESC', 'ui:escape', 'ui');
        
        DebugLogger.info('input', '[KeyboardManager] UI keys registered - ESC mapped to ui:escape event');
        DebugLogger.info('input', '[KeyboardManager] Active handlers:', this.handlers.size);
    }
}