/**
 * CentralEventBus - Centralized event management system
 * Provides namespaced events and type-safe communication
 */

import { UI_EVENTS } from '../../ui/UIEventContract.js';

export class CentralEventBus {
    constructor() {
        this.eventEmitter = new Phaser.Events.EventEmitter();
        this.listeners = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 100;
        
        // Event namespaces
        this.namespaces = {
            GAME: 'game',
            UI: 'ui', 
            AUDIO: 'audio',
            VFX: 'vfx',
            LOOT: 'loot',
            POWERUP: 'powerup',
            PLAYER: 'player',
            ENEMY: 'enemy'
        };
        
        console.log('[CentralEventBus] Initialized with namespaces:', this.namespaces);
    }
    
    /**
     * Emit namespaced event
     */
    emit(eventName, data = null) {
        const timestamp = Date.now();
        
        // Validate event format
        if (!this.isValidEventName(eventName)) {
            console.warn(`[CentralEventBus] Invalid event name: ${eventName}`);
            return;
        }
        
        // Log event
        this.logEvent(eventName, data, timestamp);
        
        // Emit event
        this.eventEmitter.emit(eventName, {
            name: eventName,
            data: data,
            timestamp: timestamp
        });
        
        // Also emit to wildcard listeners for namespace
        const namespace = this.getNamespace(eventName);
        if (namespace) {
            this.eventEmitter.emit(`${namespace}:*`, {
                name: eventName,
                data: data,
                timestamp: timestamp
            });
        }
        
        console.debug(`[CentralEventBus] Emitted: ${eventName}`, data);
    }
    
    /**
     * Listen to specific event
     */
    on(eventName, callback, context = null) {
        const wrappedCallback = (event) => {
            try {
                if (context) {
                    callback.call(context, event.data, event);
                } else {
                    callback(event.data, event);
                }
            } catch (error) {
                console.error(`[CentralEventBus] Error in event handler for ${eventName}:`, error);
            }
        };
        
        this.eventEmitter.on(eventName, wrappedCallback);
        
        // Track listeners for cleanup
        if (!this.listeners.has(context)) {
            this.listeners.set(context, []);
        }
        this.listeners.get(context).push({
            eventName: eventName,
            callback: wrappedCallback
        });
        
        console.debug(`[CentralEventBus] Registered listener for: ${eventName}`);
    }
    
    /**
     * Listen to event once
     */
    once(eventName, callback, context = null) {
        const wrappedCallback = (event) => {
            try {
                if (context) {
                    callback.call(context, event.data, event);
                } else {
                    callback(event.data, event);
                }
            } catch (error) {
                console.error(`[CentralEventBus] Error in once handler for ${eventName}:`, error);
            }
        };
        
        this.eventEmitter.once(eventName, wrappedCallback);
        console.debug(`[CentralEventBus] Registered once listener for: ${eventName}`);
    }
    
    /**
     * Remove listener
     */
    off(eventName, callback, context = null) {
        this.eventEmitter.off(eventName, callback);
        
        // Remove from tracking
        if (this.listeners.has(context)) {
            const contextListeners = this.listeners.get(context);
            const index = contextListeners.findIndex(l => 
                l.eventName === eventName && l.callback === callback
            );
            if (index !== -1) {
                contextListeners.splice(index, 1);
            }
        }
        
        console.debug(`[CentralEventBus] Removed listener for: ${eventName}`);
    }
    
    /**
     * Remove all listeners for context
     */
    removeAllListeners(context) {
        if (!this.listeners.has(context)) return;
        
        const contextListeners = this.listeners.get(context);
        contextListeners.forEach(listener => {
            this.eventEmitter.off(listener.eventName, listener.callback);
        });
        
        this.listeners.delete(context);
        console.debug(`[CentralEventBus] Removed all listeners for context:`, context?.constructor?.name || 'unknown');
    }
    
    /**
     * Convenience methods for UI events
     */
    emitUI(eventType, data = null) {
        this.emit(`ui:${eventType}`, data);
    }
    
    onUI(eventType, callback, context = null) {
        this.on(`ui:${eventType}`, callback, context);
    }
    
    /**
     * Convenience methods for game events  
     */
    emitGame(eventType, data = null) {
        this.emit(`game:${eventType}`, data);
    }
    
    onGame(eventType, callback, context = null) {
        this.on(`game:${eventType}`, callback, context);
    }
    
    /**
     * Convenience methods for powerup events
     */
    emitPowerUp(eventType, data = null) {
        this.emit(`powerup:${eventType}`, data);
    }
    
    onPowerUp(eventType, callback, context = null) {
        this.on(`powerup:${eventType}`, callback, context);
    }
    
    /**
     * Listen to all events in namespace
     */
    onNamespace(namespace, callback, context = null) {
        this.on(`${namespace}:*`, callback, context);
    }
    
    /**
     * Validate event name format
     */
    isValidEventName(eventName) {
        // Should be namespace:event format
        if (!eventName || typeof eventName !== 'string') return false;
        
        const parts = eventName.split(':');
        if (parts.length < 2) return false;
        
        const namespace = parts[0];
        return Object.values(this.namespaces).includes(namespace);
    }
    
    /**
     * Get namespace from event name
     */
    getNamespace(eventName) {
        const parts = eventName.split(':');
        return parts.length > 0 ? parts[0] : null;
    }
    
    /**
     * Log event for debugging
     */
    logEvent(eventName, data, timestamp) {
        this.eventHistory.push({
            name: eventName,
            data: data,
            timestamp: timestamp
        });
        
        // Trim history
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }
    
    /**
     * Get recent event history
     */
    getEventHistory(count = 10) {
        return this.eventHistory.slice(-count);
    }
    
    /**
     * Get event statistics
     */
    getStats() {
        const eventCounts = {};
        this.eventHistory.forEach(event => {
            eventCounts[event.name] = (eventCounts[event.name] || 0) + 1;
        });
        
        return {
            totalEvents: this.eventHistory.length,
            activeListeners: this.listeners.size,
            eventCounts: eventCounts,
            namespaces: Object.keys(this.namespaces).length
        };
    }
    
    /**
     * Clear all listeners
     */
    destroy() {
        this.eventEmitter.removeAllListeners();
        this.listeners.clear();
        this.eventHistory = [];
        console.log('[CentralEventBus] Destroyed');
    }
}

// Global instance
export const centralEventBus = new CentralEventBus();

// Export UI events for convenience
export { UI_EVENTS };

export default centralEventBus;