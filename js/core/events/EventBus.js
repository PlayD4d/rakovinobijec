// Lightweight EventBus for high-level events only
// NO hot-path combat events - use direct system calls instead

import { isEventAllowed, validateEventPayload } from './EventWhitelist.js';

export class EventBus {
  constructor(options = {}) {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
    this.enforceWhitelist = options.enforceWhitelist !== false;
    this.debug = options.debug || false;
  }

  // Subscribe to event
  on(eventName, handler) {
    if (this.enforceWhitelist && !isEventAllowed(eventName)) {
      console.warn(`[EventBus] Event '${eventName}' not whitelisted. Use direct system calls for combat events.`);
      return () => {}; // No-op unsubscriber
    }
    
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(handler);
    return () => this.off(eventName, handler);
  }

  // Unsubscribe from event
  off(eventName, handler) {
    const set = this.listeners.get(eventName);
    if (set) {
      set.delete(handler);
      if (set.size === 0) this.listeners.delete(eventName);
    }
  }

  // Emit event with validated payload
  emit(eventName, payload = {}) {
    if (this.enforceWhitelist && !isEventAllowed(eventName)) {
      console.warn(`[EventBus] Blocked non-whitelisted event: ${eventName}`);
      return;
    }
    
    if (!validateEventPayload(eventName, payload)) {
      console.warn(`[EventBus] Invalid payload for ${eventName}`);
      return;
    }
    
    if (this.debug) {
      console.log(`[EventBus] ${eventName}`, payload);
    }
    
    const set = this.listeners.get(eventName);
    if (!set || set.size === 0) return;
    
    // Safe iteration
    [...set].forEach((fn) => {
      try { fn(payload); } catch (e) { console.warn(`[EventBus] Handler error for ${eventName}:`, e.message); }
    });
  }
}


