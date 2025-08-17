/**
 * DisposableRegistry - Unified resource cleanup management
 * PR7 compliant - single registry for all disposable resources
 */
export class DisposableRegistry {
    constructor() {
        this._items = [];
    }
    
    /**
     * Add items to be disposed later
     */
    add(...items) {
        for (const item of items) {
            if (item) this._items.push(item);
        }
        return items[0]; // Return first item for chaining
    }
    
    /**
     * Track tweens (noop - Phaser manages tweens)
     */
    trackTween(scene, targets) {
        // Tweens are managed by Phaser engine
        scene?.tweens?.killTweensOf?.(targets);
        return this;
    }
    
    /**
     * Track timer with auto-disposal
     */
    trackTimer(scene, delay, callback, ...args) {
        if (!scene?.time) return null;
        
        const timer = scene.time.delayedCall(delay, callback, args);
        this.add(timer);
        return timer;
    }
    
    /**
     * Track particle emitter
     */
    trackEmitter(emitter) {
        if (emitter) {
            this.add(emitter);
        }
        return emitter;
    }
    
    /**
     * Track event listener with auto-removal
     */
    trackListener(target, event, fn, context) {
        if (!target || !event || !fn) return null;
        
        // Add listener
        if (target.on) {
            target.on(event, fn, context);
        } else if (target.addEventListener) {
            target.addEventListener(event, fn);
        }
        
        // Create disposable wrapper
        const disposable = {
            shutdown: () => {
                if (target.off) {
                    target.off(event, fn, context);
                } else if (target.removeEventListener) {
                    target.removeEventListener(event, fn);
                }
            }
        };
        
        this.add(disposable);
        return fn;
    }
    
    /**
     * Get statistics about tracked items
     */
    getStats() {
        const types = {};
        
        for (const item of this._items) {
            const typeName = item?.constructor?.name || 
                           (item?.shutdown ? 'CustomDisposable' : 'Unknown');
            types[typeName] = (types[typeName] || 0) + 1;
        }
        
        return {
            totalItems: this._items.length,
            types,
            memoryEstimate: this._items.length * 100 // Rough estimate in bytes
        };
    }
    
    /**
     * Dispose all registered items
     */
    disposeAll() {
        console.log(`[DisposableRegistry] Disposing ${this._items.length} items...`);
        
        let disposed = 0;
        let errors = 0;
        
        for (const item of this._items) {
            try {
                // Standard disposal interfaces
                if (item?.removeAllListeners) item.removeAllListeners();
                if (item?.shutdown) item.shutdown();
                if (item?.destroy) item.destroy(true);
                // For Phaser TimerEvents
                if (item?.remove) item.remove(false);
                disposed++;
            } catch (e) {
                console.warn('[DisposableRegistry] dispose error:', e);
                errors++;
            }
        }
        
        console.log(`[DisposableRegistry] Disposed ${disposed} items, ${errors} errors`);
        this._items.length = 0;
    }
}

export default DisposableRegistry;