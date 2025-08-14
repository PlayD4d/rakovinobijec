// Jednoduchý registr power‑upů – mapa název → blueprint

export const PowerUpRegistry = (() => {
  /** @type {Map<string, any>} */
  const map = new Map();

  return {
    register(blueprint) {
      if (!blueprint || !blueprint.id) {
        console.warn('[PowerUpRegistry] Neplatný blueprint (chybí id)');
        return;
      }
      map.set(String(blueprint.id), blueprint);
    },
    get(name) {
      return map.get(String(name)) || null;
    },
    list() {
      return [...map.keys()];
    }
  };
})();


