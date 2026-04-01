/**
 * CentralEventBus - Cross-scene event communication
 *
 * Thin wrapper over Phaser.Events.EventEmitter that adds context-based
 * listener tracking for safe bulk removal on scene shutdown.
 *
 * Usage:
 *   centralEventBus.on('game:levelup', handler, this);
 *   centralEventBus.emit('game:levelup', data);
 *   centralEventBus.removeAllListeners(this);  // in shutdown
 */
class CentralEventBus {
    constructor() {
        this._emitter = new Phaser.Events.EventEmitter();
        /** @type {Map<object, Array<{event: string, fn: function}>>} */
        this._tracked = new Map();
    }

    /**
     * Emit an event with data. Data is passed directly to listeners (no wrapping).
     */
    emit(eventName, data) {
        this._emitter.emit(eventName, data);
    }

    /**
     * Register a persistent listener. Context is used for bulk removal.
     */
    on(eventName, callback, context = null) {
        const key = context || this;
        this._emitter.on(eventName, callback, context);
        if (!this._tracked.has(key)) this._tracked.set(key, []);
        this._tracked.get(key).push({ event: eventName, fn: callback });
    }

    /**
     * Register a one-time listener.
     */
    once(eventName, callback, context = null) {
        const key = context || this;
        // Wrap to auto-remove from tracking after fire
        const wrapped = (data) => {
            this._removeTracked(key, eventName, wrapped);
            callback.call(context, data);
        };
        this._emitter.once(eventName, wrapped, context);
        if (!this._tracked.has(key)) this._tracked.set(key, []);
        this._tracked.get(key).push({ event: eventName, fn: wrapped });
    }

    /**
     * Remove a specific listener.
     */
    off(eventName, callback, context = null) {
        const key = context || this;
        this._emitter.off(eventName, callback, context);
        this._removeTracked(key, eventName, callback);
    }

    /**
     * Remove ALL listeners registered with the given context.
     * Call this in scene shutdown to prevent listener accumulation.
     */
    removeAllListeners(context) {
        if (!context || !this._tracked.has(context)) return;
        const entries = this._tracked.get(context);
        for (const { event, fn } of entries) {
            this._emitter.off(event, fn, context);
        }
        this._tracked.delete(context);
    }

    /**
     * Remove a single entry from tracking (internal helper).
     */
    _removeTracked(key, eventName, fn) {
        const entries = this._tracked.get(key);
        if (!entries) return;
        const idx = entries.findIndex(e => e.event === eventName && e.fn === fn);
        if (idx >= 0) entries.splice(idx, 1);
        if (entries.length === 0) this._tracked.delete(key);
    }

    /**
     * Destroy — remove everything.
     */
    destroy() {
        this._emitter.removeAllListeners();
        this._tracked.clear();
    }
}

export const centralEventBus = new CentralEventBus();
