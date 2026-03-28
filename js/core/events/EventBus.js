// Lightweight EventBus for high-level events only
// NO hot-path combat events - use direct system calls instead

import { isEventAllowed, validateEventPayload } from './EventWhitelist.js';
import { DebugLogger } from '../debug/DebugLogger.js';

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
      DebugLogger.warn('events', `[EventBus] Event '${eventName}' not whitelisted. Use direct system calls for combat events.`);
      return () => {}; // No-op unsubscriber
    }
    
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(handler);
    return () => this.off(eventName, handler);
  }

  // Subscribe once — auto-removes after first fire
  once(eventName, handler) {
    const wrapped = (...args) => {
      this.off(eventName, wrapped);
      handler(...args);
    };
    return this.on(eventName, wrapped);
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
      DebugLogger.warn('events', `[EventBus] Blocked non-whitelisted event: ${eventName}`);
      return;
    }
    
    if (!validateEventPayload(eventName, payload)) {
      DebugLogger.warn('events', `[EventBus] Invalid payload for ${eventName}`);
      return;
    }
    
    if (this.debug) {
      DebugLogger.info('events', `[EventBus] ${eventName}`, payload);
    }
    
    const set = this.listeners.get(eventName);
    if (!set || set.size === 0) return;
    
    // Safe iteration
    [...set].forEach((fn) => {
      try { fn(payload); } catch (e) { DebugLogger.warn('events', `[EventBus] Handler error for ${eventName}:`, e.message); }
    });
  }
}


