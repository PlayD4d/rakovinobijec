/**
 * DisplayResolver - Zjednodušený systém pro i18n texty a základní template substitution
 * Odstraněn template engine, cache systém a telemetrie - PR7 simplification
 */
export class DisplayResolver {
  constructor() {
    this.i18nData = new Map(); // locale -> translation data
    this.currentLocale = 'cs';
  }

  /**
   * Načte i18n data pro lokalizaci
   */
  loadI18n(locale, data) {
    this.i18nData.set(locale, data);
  }

  /**
   * Nastaví aktuální lokalizaci
   */
  setLocale(locale) {
    this.currentLocale = locale;
  }

  /**
   * Hlavní API: Vyřeší všechny display data pro entitu
   * @param {string} entityId - ID blueprintu
   * @param {string} lang - jazyk ('cs'|'en')  
   * @param {object} runtimeEntity - runtime data po aplikaci modifierů
   * @returns {object} Kompletní display objekt
   */
  resolveAll(entityId, lang = this.currentLocale, runtimeEntity = null) {
    const blueprint = this._getBlueprint(entityId);
    if (!blueprint) {
      return this._createErrorResult(entityId);
    }
    
    const entity = runtimeEntity || blueprint;
    
    return {
      id: entityId,
      name: this.t(blueprint.display?.key, lang) || blueprint.display?.devNameFallback || entityId,
      desc: this.t(blueprint.display?.descKey, lang) || blueprint.display?.devDescFallback || '',
      short: this._simpleTemplateSubstitute(blueprint.display?.templates?.short || '', entity),
      long: this._simpleTemplateSubstitute(blueprint.display?.templates?.long || '', entity),
      icon: blueprint.display?.icon,
      color: blueprint.display?.color,
      rarity: blueprint.display?.rarity,
      category: blueprint.display?.category,
      tags: blueprint.display?.tags || [],
      sortOrder: blueprint.display?.sortOrder || 999,
      srText: this.t(blueprint.display?.srKey, lang) || null
    };
  }

  /**
   * i18n překlad s podporou proměnných
   * @param {string} key - i18n klíč
   * @param {string} lang - jazyk  
   * @param {object} vars - proměnné pro substitution
   */
  t(key, lang = this.currentLocale, vars = {}) {
    if (!key) return null;
    
    const data = this.i18nData.get(lang);
    if (!data) return null;
    
    let text = this._getNestedValue(data, key);
    if (!text) return null;
    
    // Jednoduchá substitution proměnných {{var}}
    if (vars && Object.keys(vars).length > 0) {
      text = text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return vars[varName] !== undefined ? vars[varName] : match;
      });
    }
    
    return text;
  }

  /**
   * Jednoduchá template substitution - pouze {{path}} bez formátovačů
   */
  _simpleTemplateSubstitute(template, entity) {
    if (!template || typeof template !== 'string') return '';
    
    return template.replace(/\{\{([\w.]+)\}\}/g, (match, path) => {
      const value = this._getNestedValue(entity, path);
      return value !== null && value !== undefined ? value : '?';
    });
  }

  /**
   * Vytvoří Tooltip komponentu data
   */
  createTooltip(entityId, runtimeEntity = null, lang = this.currentLocale) {
    const display = this.resolveAll(entityId, lang, runtimeEntity);
    
    let content = `<strong>${display.name}</strong>`;
    
    if (display.short) {
      content += `<br/>${display.short}`;
    }
    
    if (display.desc) {
      content += `<br/><em>${display.desc}</em>`;
    }
    
    return {
      content,
      ariaLabel: display.srText || display.name,
      className: `tooltip-${display.rarity}`,
      entityId: entityId
    };
  }

  /**
   * ValueChip komponenta s auto-formátováním
   */
  createValueChip(labelKey, value, formatType = null, lang = this.currentLocale) {
    const label = this.t(`ui.${labelKey}`, lang) || labelKey;
    let formattedValue = value;
    
    // Základní formátování
    if (formatType === 'HP') formattedValue = `${Math.round(value)} HP`;
    else if (formatType === 'percent') formattedValue = `${Math.round(value * 100)}%`;
    else if (formatType === 'ms') formattedValue = `${Math.round(value)} ms`;
    
    return {
      label,
      value: formattedValue,
      rawValue: value,
      className: `value-chip-${formatType || 'default'}`
    };
  }

  // === PRIVATE METODY ===

  /**
   * Získá blueprint z BlueprintLoader
   */
  _getBlueprint(entityId) {
    // Integrace s BlueprintLoader (současný systém)
    if (typeof window !== 'undefined' && window.blueprintLoader) {
      return window.blueprintLoader.get(entityId);
    }
    
    // Pro případ testů nebo když není dostupný window
    return null;
  }

  /**
   * Získá vnořenou hodnotu z objektu (např. 'stats.hp')
   */
  _getNestedValue(obj, path) {
    if (!path || !obj) return null;
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return null;
      if (typeof current !== 'object') return null;
      current = current[part];
    }
    
    return current;
  }

  /**
   * Vytvoří error result pro chybějící blueprint
   */
  _createErrorResult(entityId) {
    return {
      id: entityId,
      name: `[Missing: ${entityId}]`,
      desc: 'Blueprint not found',
      short: `Missing blueprint: ${entityId}`,
      long: `Blueprint ${entityId} was not found in registry`,
      icon: null,
      color: '#FF0000',
      rarity: 'common',
      category: 'unknown',
      tags: ['error'],
      sortOrder: 999,
      srText: `Missing blueprint ${entityId}`
    };
  }
}

// Singleton instance
export const displayResolver = new DisplayResolver();
export default displayResolver;