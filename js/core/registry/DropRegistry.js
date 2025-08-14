// DropRegistry – registr unikátních dropů (ESM blueprinty)
// Umožňuje datově řídit speciální looty (např. metotrexát)

import { BlueprintValidator } from '../validation/BlueprintValidator.js';

export const DropRegistry = (() => {
  /** @type {Map<string, any>} */
  const map = new Map();

  return {
    register(blueprint) {
      if (!blueprint || !blueprint.id) {
        console.warn('[DropRegistry] Neplatný blueprint (chybí id)');
        return;
      }
      
      // Validace blueprintu
      try {
        BlueprintValidator.validate(blueprint, 'drop');
        map.set(String(blueprint.id), blueprint);
        console.log(`[DropRegistry] Registered drop blueprint: ${blueprint.id}`);
      } catch (error) {
        console.error(`[DropRegistry] Blueprint validation failed for ${blueprint.id}:`, error.message);
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
      return [...map.values()];
    }
  };
})();


