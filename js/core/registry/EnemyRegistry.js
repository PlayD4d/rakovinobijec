// Jednoduchý registr nepřátel – mapa název → blueprint

import { BlueprintValidator } from '../validation/BlueprintValidator.js';

export const EnemyRegistry = (() => {
  /** @type {Map<string, any>} */
  const map = new Map();

  return {
    register(blueprint) {
      if (!blueprint || !blueprint.id) {
        console.warn('[EnemyRegistry] Neplatný blueprint (chybí id)');
        return;
      }
      
      // Validace blueprintu
      try {
        BlueprintValidator.validate(blueprint, 'enemy');
        map.set(String(blueprint.id), blueprint);
        console.log(`[EnemyRegistry] Registered enemy blueprint: ${blueprint.id}`);
      } catch (error) {
        console.error(`[EnemyRegistry] Blueprint validation failed for ${blueprint.id}:`, error.message);
        // V dev módu chyba (localStorage flag), v produkci jen warning
        const devMode = window.localStorage?.getItem('strictValidation') === 'true';
        if (devMode) {
          throw error;
        }
      }
    },
    get(name) {
      return map.get(String(name)) || null;
    },
    list() {
      return [...map.keys()];
    }
  };
})();


