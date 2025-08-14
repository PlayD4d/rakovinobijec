/**
 * DisplayResolver - Pokročilý systém pro i18n texty a template rendering
 * FÁZE 3: Rozšířeno o pokročilé formátovače, cache a runtime hodnoty
 */
export class DisplayResolver {
  constructor() {
    this.i18nData = new Map(); // locale -> translation data
    this.currentLocale = 'cs';
    this.formatters = new Map(); // type -> formatter function
    
    // Cache pro resolved display data - (entityId, locale, entityVersion) -> resolved data
    this.displayCache = new Map();
    this.templateCache = new Map(); // template -> parsed template object
    
    // Telemetrie (dev-only)
    this.telemetry = {
      placeholderResolutionCount: 0,
      unresolvedKeys: new Set(),
      templateUsage: new Map(),
      enabled: false // Lze zapnout manuálně pro debugging
    };
    
    // Registrace základních formátovačů
    this._registerDefaultFormatters();
  }

  /**
   * Načte i18n data pro lokalizaci
   */
  loadI18n(locale, data) {
    this.i18nData.set(locale, data);
    this._clearCacheForLocale(locale);
  }

  /**
   * Nastaví aktuální lokalizaci
   */
  setLocale(locale) {
    if (this.currentLocale !== locale) {
      this.currentLocale = locale;
      this._clearCacheForLocale(locale);
    }
  }

  /**
   * Hlavní API: Vyřeší všechny display data pro entitu
   * @param {string} entityId - ID blueprintu
   * @param {string} lang - jazyk ('cs'|'en')  
   * @param {object} runtimeEntity - runtime data po aplikaci modifierů
   * @returns {object} Kompletní display objekt
   */
  resolveAll(entityId, lang = this.currentLocale, runtimeEntity = null) {
    const cacheKey = `${entityId}:${lang}:${this._getEntityVersion(runtimeEntity)}`;
    
    if (this.displayCache.has(cacheKey)) {
      return this.displayCache.get(cacheKey);
    }
    
    const blueprint = this._getBlueprint(entityId);
    if (!blueprint) {
      return this._createErrorResult(entityId);
    }
    
    const entity = runtimeEntity || blueprint;
    const previousLocale = this.currentLocale;
    this.setLocale(lang);
    
    try {
      const result = {
        id: entityId,
        name: this.t(blueprint.display?.key, lang) || blueprint.display?.devNameFallback || entityId,
        desc: this.t(blueprint.display?.descKey, lang) || blueprint.display?.devDescFallback || '',
        short: this.renderTemplate(blueprint.display?.templates?.short || '', entity, lang),
        long: this.renderTemplate(blueprint.display?.templates?.long || '', entity, lang),
        icon: blueprint.display?.icon,
        color: blueprint.display?.color,
        rarity: blueprint.display?.rarity,
        category: blueprint.display?.category,
        tags: blueprint.display?.tags || [],
        sortOrder: blueprint.display?.sortOrder || 999,
        srText: this.t(blueprint.display?.srKey, lang) || null
      };
      
      this.displayCache.set(cacheKey, result);
      return result;
      
    } finally {
      this.setLocale(previousLocale);
    }
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
    
    // Substitution proměnných {{var}}
    if (vars && Object.keys(vars).length > 0) {
      text = text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return vars[varName] !== undefined ? vars[varName] : match;
      });
    }
    
    return text;
  }

  /**
   * Renderuje template s pokročilými placeholdery a formátovači
   * Podporuje: {{path}}, {{path|formatter}}, {{?path}} (optional)
   */
  renderTemplate(template, entity, lang = this.currentLocale) {
    if (!template || typeof template !== 'string') return '';
    
    // Telemetrie
    if (this.telemetry.enabled) {
      const count = this.telemetry.templateUsage.get(template) || 0;
      this.telemetry.templateUsage.set(template, count + 1);
    }
    
    // Cache parsed template
    let parsedTemplate = this.templateCache.get(template);
    if (!parsedTemplate) {
      parsedTemplate = this._parseTemplate(template);
      this.templateCache.set(template, parsedTemplate);
    }
    
    return parsedTemplate.render(entity, this, lang);
  }

  /**
   * Registruje custom formátovač
   */
  registerFormatter(name, formatter) {
    this.formatters.set(name, formatter);
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
   * Vytvoří DetailsPanel komponentu data
   */
  createDetailsPanel(entityId, runtimeEntity = null, lang = this.currentLocale) {
    const display = this.resolveAll(entityId, lang, runtimeEntity);
    const blueprint = this._getBlueprint(entityId);
    const entity = runtimeEntity || blueprint;
    
    return {
      header: {
        title: display.name,
        subtitle: display.desc,
        icon: display.icon,
        rarity: display.rarity,
        category: display.category
      },
      body: {
        shortDesc: display.short,
        longDesc: display.long,
        stats: this._extractFormattedStats(entity, blueprint, lang)
      },
      footer: {
        tags: display.tags,
        entityId: entityId
      },
      ariaLabel: display.srText || display.name
    };
  }

  /**
   * ValueChip komponenta s auto-formátováním
   */
  createValueChip(labelKey, value, formatType = null, lang = this.currentLocale) {
    const label = this.t(`ui.${labelKey}`, lang) || labelKey;
    let formattedValue = value;
    
    if (formatType && this.formatters.has(formatType)) {
      formattedValue = this.formatters.get(formatType)(value);
    } else {
      // Auto-detekce formátu podle labelKey
      const autoFormat = this._detectFormatType(labelKey);
      if (autoFormat && this.formatters.has(autoFormat)) {
        formattedValue = this.formatters.get(autoFormat)(value);
      }
    }
    
    return {
      label,
      value: formattedValue,
      rawValue: value,
      className: `value-chip-${formatType || 'default'}`
    };
  }

  /**
   * Dev telemetrie výpis
   */
  getDevTelemetry() {
    if (!this.telemetry.enabled) return null;
    
    return {
      totalPlaceholders: this.telemetry.placeholderResolutionCount,
      unresolvedKeys: Array.from(this.telemetry.unresolvedKeys),
      topTemplates: Array.from(this.telemetry.templateUsage.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
      cacheSize: this.displayCache.size
    };
  }

  // === PRIVATE METODY ===

  /**
   * Získá blueprint z registru
   */
  _getBlueprint(entityId) {
    // Integrace s BlueprintRegistry
    if (typeof window !== 'undefined' && window.blueprintRegistry) {
      return window.blueprintRegistry.get(entityId);
    }
    
    // Fallback pro server/test prostředí
    try {
      const { blueprintRegistry } = require('./BlueprintRegistry.js');
      return blueprintRegistry.get(entityId);
    } catch (e) {
      return null;
    }
  }

  /**
   * Vypočítá verzi entity pro cache invalidation
   */
  _getEntityVersion(entity) {
    if (!entity) return 'static';
    // Jednoduchý hash pro cache busting při změně entity
    return JSON.stringify(entity).length.toString(36);
  }

  /**
   * Parsuje template do objektu s render() metodou
   */
  _parseTemplate(template) {
    const placeholders = [];
    const regex = /\{\{(\??)([\w.]+)(\|(\w+))?\}\}/g;
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      placeholders.push({
        full: match[0],
        optional: match[1] === '?',
        path: match[2],
        formatter: match[4] || null
      });
    }
    
    return {
      template,
      placeholders,
      render: (entity, resolver, lang) => {
        let result = template;
        
        for (const ph of placeholders) {
          const value = resolver._getNestedValue(entity, ph.path);
          
          if (value === null || value === undefined) {
            if (ph.optional) {
              // Odstraní celý placeholder včetně okolního textu
              result = result.replace(ph.full, '');
              continue;
            } else {
              // Telemetrie pro nevyřešené klíče
              if (resolver.telemetry.enabled) {
                resolver.telemetry.unresolvedKeys.add(ph.path);
              }
              // Nechat placeholder nebo nahradit fallbackem
              result = result.replace(ph.full, '?');
              continue;
            }
          }
          
          let formattedValue = value;
          if (ph.formatter && resolver.formatters.has(ph.formatter)) {
            formattedValue = resolver.formatters.get(ph.formatter)(value);
          }
          
          result = result.replace(ph.full, formattedValue);
          
          if (resolver.telemetry.enabled) {
            resolver.telemetry.placeholderResolutionCount++;
          }
        }
        
        // Vyčistit duplicitní mezery
        return result.replace(/\s+/g, ' ').trim();
      }
    };
  }

  /**
   * Registruje výchozí formátovače
   */
  _registerDefaultFormatters() {
    // Základní formátovače
    this.registerFormatter('percent', (v) => `${Math.round(v * 100)}%`);
    this.registerFormatter('ms', (v) => `${Math.round(v)} ms`);
    this.registerFormatter('px', (v) => `${Math.round(v)} px`);
    this.registerFormatter('HP', (v) => `${Math.round(v)} HP`);
    this.registerFormatter('mult', (v) => `×${(+v).toFixed(2)}`);
    
    // Pokročilé formátovače
    this.registerFormatter('dps', (v) => `${Math.round(v)} DPS`);
    this.registerFormatter('range', (v) => `${Math.round(v)} px`);
    this.registerFormatter('crit', (v) => `${Math.round(v * 100)}%`);
    this.registerFormatter('speed', (v) => `${Math.round(v * 100) / 100}`);
    this.registerFormatter('damage', (v) => `${Math.round(v)}`);
    this.registerFormatter('time', (v) => `${(v / 1000).toFixed(1)}s`);
    
    // Utility formátovače
    this.registerFormatter('round', (v) => `${Math.round(v)}`);
    this.registerFormatter('round2', (v) => `${(+v).toFixed(2)}`);
    this.registerFormatter('int', (v) => `${Math.floor(v)}`);
  }

  /**
   * Auto-detekce formátu podle názvu klíče
   */
  _detectFormatType(key) {
    const keyLower = key.toLowerCase();
    
    if (keyLower.includes('hp') || keyLower.includes('health')) return 'HP';
    if (keyLower.includes('percent') || keyLower.includes('chance')) return 'percent';
    if (keyLower.includes('speed')) return 'speed';
    if (keyLower.includes('damage') || keyLower.includes('dmg')) return 'damage';
    if (keyLower.includes('range') || keyLower.includes('radius')) return 'range';
    if (keyLower.includes('time') || keyLower.includes('duration')) return 'ms';
    if (keyLower.includes('mult') || keyLower.includes('multiplier')) return 'mult';
    if (keyLower.includes('dps')) return 'dps';
    
    return null;
  }

  /**
   * Extrahuje a formátuje statistiky entity
   */
  _extractFormattedStats(entity, blueprint, lang) {
    const stats = [];
    
    if (!entity?.stats) return stats;
    
    // Podle typu blueprintu zobrazit relevantní statistiky
    switch (blueprint?.type) {
      case 'player':
        if (entity.stats.maxHp) stats.push({ label: this.t('ui.health', lang) || 'Health', value: entity.stats.maxHp, format: 'HP' });
        if (entity.stats.speed) stats.push({ label: this.t('ui.speed', lang) || 'Speed', value: entity.stats.speed, format: 'speed' });
        if (entity.stats.projectileDamage) stats.push({ label: this.t('ui.damage', lang) || 'Damage', value: entity.stats.projectileDamage, format: 'damage' });
        break;
        
      case 'enemy':
      case 'boss':
        if (entity.stats.hp) stats.push({ label: this.t('ui.health', lang) || 'Health', value: entity.stats.hp, format: 'HP' });
        if (entity.stats.damage) stats.push({ label: this.t('ui.damage', lang) || 'Damage', value: entity.stats.damage, format: 'damage' });
        if (entity.stats.speed) stats.push({ label: this.t('ui.speed', lang) || 'Speed', value: entity.stats.speed, format: 'speed' });
        if (entity.stats.xp) stats.push({ label: this.t('ui.xp', lang) || 'XP', value: entity.stats.xp, format: 'round' });
        break;
        
      case 'projectile':
        if (entity.stats.damage) stats.push({ label: this.t('ui.damage', lang) || 'Damage', value: entity.stats.damage, format: 'damage' });
        if (entity.stats.speed) stats.push({ label: this.t('ui.speed', lang) || 'Speed', value: entity.stats.speed, format: 'px' });
        if (entity.stats.range) stats.push({ label: this.t('ui.range', lang) || 'Range', value: entity.stats.range, format: 'range' });
        break;
        
      case 'powerup':
        if (entity.maxLevel) stats.push({ label: this.t('ui.maxLevel', lang) || 'Max Level', value: entity.maxLevel, format: 'int' });
        break;
        
      case 'drop':
        if (entity.stats.value) stats.push({ label: this.t('ui.value', lang) || 'Value', value: entity.stats.value, format: 'round' });
        break;
    }
    
    // Formátování statistik
    return stats.map(stat => {
      const formatter = this.formatters.get(stat.format);
      return {
        label: stat.label,
        value: stat.value,
        formattedValue: formatter ? formatter(stat.value) : stat.value,
        format: stat.format
      };
    });
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
   * Vyčistí cache pro daný jazyk
   */
  _clearCacheForLocale(locale) {
    const keysToDelete = [];
    for (const [key] of this.displayCache) {
      if (key.includes(`:${locale}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.displayCache.delete(key));
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