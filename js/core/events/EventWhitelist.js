/**
 * EventBus Whitelist
 * 
 * Only high-level events for analytics, UI, and debug.
 * NO hot-path combat events (damage, projectiles, collisions).
 */

export const EventWhitelist = {
  // Analytics & Telemetry Events
  ANALYTICS: {
    PLAYER_DIED: 'player.died',
    BOSS_DEFEATED: 'boss.defeated',
    BOSS_PHASE_CHANGED: 'boss.phaseChanged',
    RUN_STARTED: 'run.started',
    RUN_COMPLETED: 'run.completed',
    LOOT_ROLLED: 'loot.rolled',
    POWERUP_APPLIED: 'powerup.apply',
    LEVEL_COMPLETED: 'level.completed',
    WAVE_COMPLETED: 'wave.completed'
  },

  // UI/UX Events
  UI: {
    TOAST: 'ui.toast',
    TUTORIAL_HINT: 'ui.tutorial.hint',
    ACHIEVEMENT_UNLOCKED: 'ui.achievement.unlocked',
    READY_FIGHT: 'ui.ready_fight',
    MENU_CONFIRM: 'ui.menu.confirm',
    MODAL_OPENED: 'ui.modal.opened',
    MODAL_CLOSED: 'ui.modal.closed',
    ESCAPE: 'ui.escape',
    MENU_ESCAPE: 'menu.escape'
  },

  // Game Lifecycle Events
  LIFECYCLE: {
    SCENE_PAUSED: 'scene.paused',
    SCENE_RESUMED: 'scene.resumed',
    SETTINGS_CHANGED: 'settings.changed',
    PROFILE_SWITCHED: 'profile.switched',
    GAME_OVER: 'game.over',
    GAME_RESTART: 'game.restart'
  },

  // Debug Events (development only)
  DEBUG: {
    HEALTHCHECK: 'debug.healthcheck',
    SNAPSHOT: 'debug.snapshot',
    BALANCE_PROBE: 'debug.balanceProbe',
    PERFORMANCE_REPORT: 'debug.performance.report',
    MEMORY_LEAK_CHECK: 'debug.memory.check',
    OVERLAY_TOGGLE: 'debug.overlay.toggle',
    ENEMY_SPAWN: 'debug.enemy.spawn',
    BOSS_SPAWN: 'debug.boss.spawn',
    VFX_TEST: 'debug.vfx.test',
    SFX_SOUNDBOARD: 'debug.sfx.soundboard',
    MISSING_ASSETS_TOGGLE: 'debug.missing-assets.toggle'
  },

  // Special pickups (rare, not hot-path)
  SPECIAL: {
    METOTREXAT_PICKUP: 'drop.metotrexat.pickup',
    RARE_LOOT_FOUND: 'loot.rare.found',
    SECRET_UNLOCKED: 'secret.unlocked'
  }
};

/**
 * Event payload schemas for validation
 */
export const EventSchemas = {
  'player.died': {
    hp: 'number',
    level: 'number',
    timestamp: 'number'
  },
  'boss.defeated': {
    bossId: 'string',
    playerHp: 'number',
    duration: 'number'
  },
  'powerup.apply': {
    type: 'string',
    level: 'number',
    source: 'string'
  },
  'ui.toast': {
    message: 'string',
    type: 'string', // 'info', 'success', 'warning', 'error'
    duration: 'number'
  }
};

/**
 * Check if an event is whitelisted
 */
export function isEventAllowed(eventName) {
  const allEvents = [
    ...Object.values(EventWhitelist.ANALYTICS),
    ...Object.values(EventWhitelist.UI),
    ...Object.values(EventWhitelist.LIFECYCLE),
    ...Object.values(EventWhitelist.DEBUG),
    ...Object.values(EventWhitelist.SPECIAL)
  ];
  return allEvents.includes(eventName);
}

/**
 * Validate event payload against schema
 */
export function validateEventPayload(eventName, payload) {
  const schema = EventSchemas[eventName];
  if (!schema) return true; // No schema defined, allow any payload
  
  for (const [key, type] of Object.entries(schema)) {
    if (typeof payload[key] !== type) {
      console.warn(`[EventBus] Invalid payload for ${eventName}: ${key} should be ${type}`);
      return false;
    }
  }
  return true;
}