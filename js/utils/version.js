export const DEFAULT_GAME_VERSION = '0.1.3';

export function getGameVersion() {
  if (typeof window !== 'undefined' && window.__GAME_VERSION__) {
    return window.__GAME_VERSION__;
  }
  return DEFAULT_GAME_VERSION;
}

export async function loadGameVersion() {
  try {
    if (typeof window !== 'undefined' && window.__GAME_VERSION__) return window.__GAME_VERSION__;
    const resp = await fetch('package.json', { cache: 'no-store' });
    if (!resp.ok) throw new Error('Failed to fetch package.json');
    const pkg = await resp.json();
    const ver = String(pkg.version || DEFAULT_GAME_VERSION);
    if (typeof window !== 'undefined') {
      window.__GAME_VERSION__ = ver;
    }
    return ver;
  } catch (_) {
    // Fallback
    if (typeof window !== 'undefined' && !window.__GAME_VERSION__) {
      window.__GAME_VERSION__ = DEFAULT_GAME_VERSION;
    }
    return DEFAULT_GAME_VERSION;
  }
}

export function getCachedVersion() {
  return (typeof window !== 'undefined' && window.__GAME_VERSION__) ? window.__GAME_VERSION__ : DEFAULT_GAME_VERSION;
}


