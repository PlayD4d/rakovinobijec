/**
 * Tooltip komponenta využívající DisplayResolver
 * FÁZE 3: UI komponenta pro tooltips
 */
import { displayResolver } from '../core/blueprints/DisplayResolver.js';

export class Tooltip {
  constructor() {
    this.currentTooltip = null;
    this.tooltipElement = null;
    this._createTooltipElement();
  }

  /**
   * Zobrazí tooltip pro entitu
   * @param {string} entityId - ID blueprintu
   * @param {object} runtimeEntity - runtime data (volitelné)
   * @param {string} lang - jazyk (volitelné)
   * @param {object} position - pozice { x, y }
   */
  show(entityId, runtimeEntity = null, lang = 'cs', position = { x: 0, y: 0 }) {
    if (!entityId) return;

    const tooltipData = displayResolver.createTooltip(entityId, runtimeEntity, lang);
    if (!tooltipData) return;

    this.tooltipElement.innerHTML = tooltipData.content;
    this.tooltipElement.className = `tooltip ${tooltipData.className}`;
    this.tooltipElement.setAttribute('aria-label', tooltipData.ariaLabel);
    this.tooltipElement.setAttribute('data-entity-id', tooltipData.entityId);

    // Pozice
    this.tooltipElement.style.left = `${position.x + 10}px`;
    this.tooltipElement.style.top = `${position.y - 10}px`;
    this.tooltipElement.style.display = 'block';
    this.tooltipElement.style.opacity = '1';

    this.currentTooltip = entityId;
  }

  /**
   * Skryje tooltip
   */
  hide() {
    if (this.tooltipElement) {
      this.tooltipElement.style.display = 'none';
      this.tooltipElement.style.opacity = '0';
    }
    this.currentTooltip = null;
  }

  /**
   * Aktualizuje pozici tooltipu
   */
  updatePosition(position) {
    if (this.tooltipElement && this.currentTooltip) {
      this.tooltipElement.style.left = `${position.x + 10}px`;
      this.tooltipElement.style.top = `${position.y - 10}px`;
    }
  }

  /**
   * Vytvoří DOM element pro tooltip
   */
  _createTooltipElement() {
    if (typeof document === 'undefined') return; // Server-side guard

    this.tooltipElement = document.createElement('div');
    this.tooltipElement.id = 'game-tooltip';
    this.tooltipElement.style.cssText = `
      position: absolute;
      display: none;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 14px;
      line-height: 1.4;
      max-width: 300px;
      z-index: 10000;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    `;

    // CSS pro rarity
    const style = document.createElement('style');
    style.textContent = `
      .tooltip-common { border-color: #999; }
      .tooltip-rare { border-color: #3498db; background: rgba(52, 152, 219, 0.1); }
      .tooltip-epic { border-color: #9b59b6; background: rgba(155, 89, 182, 0.1); }
      .tooltip-legendary { border-color: #f39c12; background: rgba(243, 156, 18, 0.1); }
      .tooltip-boss { border-color: #e74c3c; background: rgba(231, 76, 60, 0.1); }
      .tooltip-special { border-color: #1abc9c; background: rgba(26, 188, 156, 0.1); }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.tooltipElement);
  }

  /**
   * Zničí tooltip
   */
  destroy() {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }
    this.currentTooltip = null;
  }
}

// Singleton instance
export const tooltip = new Tooltip();
export default tooltip;