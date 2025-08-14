// Jednoduchý registr bossů – mapa název → blueprint

export const BossRegistry = (() => {
  /** @type {Map<string, any>} */
  const map = new Map();

  return {
    register(blueprint) {
      if (!blueprint || !blueprint.id) {
        console.warn('[BossRegistry] Neplatný blueprint (chybí id)');
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


