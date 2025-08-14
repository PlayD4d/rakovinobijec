/**
 * ValueChip komponenta s auto-formátováním
 * FÁZE 3: Malá UI komponenta pro zobrazení hodnot
 */
import { displayResolver } from '../core/blueprints/DisplayResolver.js';

export class ValueChip {
  constructor(containerElement) {
    this.container = containerElement;
    this._ensureStyles();
  }

  /**
   * Vytvoří a zobrazí ValueChip
   * @param {string} labelKey - klíč pro label (bude hledán v ui.*)
   * @param {any} value - hodnota k zobrazení
   * @param {string} formatType - typ formátování (volitelné)
   * @param {string} lang - jazyk (volitelné)
   */
  render(labelKey, value, formatType = null, lang = 'cs') {
    if (!this.container) return;

    const chipData = displayResolver.createValueChip(labelKey, value, formatType, lang);
    
    const chipElement = document.createElement('div');
    chipElement.className = `value-chip ${chipData.className}`;
    chipElement.innerHTML = `
      <span class="value-chip-label">${chipData.label}</span>
      <span class="value-chip-value">${chipData.value}</span>
    `;
    
    chipElement.setAttribute('data-raw-value', chipData.rawValue);
    chipElement.setAttribute('title', `${chipData.label}: ${chipData.value}`);

    this.container.appendChild(chipElement);
    return chipElement;
  }

  /**
   * Vytvoří více chipů najednou
   */
  renderMultiple(chipConfigs, lang = 'cs') {
    if (!this.container) return [];

    return chipConfigs.map(config => {
      const { labelKey, value, formatType } = config;
      return this.render(labelKey, value, formatType, lang);
    });
  }

  /**
   * Vyčistí všechny chipy
   */
  clear() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Zajistí CSS styly pro ValueChip
   */
  _ensureStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('value-chip-styles')) return;

    const style = document.createElement('style');
    style.id = 'value-chip-styles';
    style.textContent = `
      .value-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        line-height: 1;
        margin: 2px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
      }
      
      .value-chip-label {
        color: rgba(255, 255, 255, 0.8);
      }
      
      .value-chip-value {
        font-weight: bold;
        color: white;
      }
      
      .value-chip-HP .value-chip-value { color: #e74c3c; }
      .value-chip-damage .value-chip-value { color: #f39c12; }
      .value-chip-speed .value-chip-value { color: #3498db; }
      .value-chip-range .value-chip-value { color: #9b59b6; }
      .value-chip-percent .value-chip-value { color: #2ecc71; }
      .value-chip-mult .value-chip-value { color: #1abc9c; }
      .value-chip-dps .value-chip-value { color: #e67e22; }
      .value-chip-default .value-chip-value { color: white; }
    `;
    
    document.head.appendChild(style);
  }
}

/**
 * Utility funkce pro rychlé vytvoření chipů
 */
export function createValueChip(containerId, labelKey, value, formatType = null, lang = 'cs') {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const chip = new ValueChip(container);
  return chip.render(labelKey, value, formatType, lang);
}

export default ValueChip;