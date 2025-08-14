/**
 * DetailsPanel komponenta využívající DisplayResolver
 * FÁZE 3: UI komponenta pro detailní panely
 */
import { displayResolver } from '../core/blueprints/DisplayResolver.js';

export class DetailsPanel {
  constructor(containerId) {
    this.container = typeof containerId === 'string' 
      ? document.getElementById(containerId)
      : containerId;
    
    if (!this.container) {
      console.warn('DetailsPanel: Container not found');
      return;
    }

    this.currentEntityId = null;
    this._createPanelStructure();
  }

  /**
   * Zobrazí detail panel pro entitu
   * @param {string} entityId - ID blueprintu
   * @param {object} runtimeEntity - runtime data (volitelné)
   * @param {string} lang - jazyk (volitelné)
   */
  show(entityId, runtimeEntity = null, lang = 'cs') {
    if (!entityId || !this.container) return;

    const panelData = displayResolver.createDetailsPanel(entityId, runtimeEntity, lang);
    if (!panelData) return;

    this._renderPanel(panelData);
    this.container.style.display = 'block';
    this.currentEntityId = entityId;
  }

  /**
   * Skryje detail panel
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
    this.currentEntityId = null;
  }

  /**
   * Aktualizuje panel s novými daty
   */
  refresh(runtimeEntity = null, lang = 'cs') {
    if (this.currentEntityId) {
      this.show(this.currentEntityId, runtimeEntity, lang);
    }
  }

  /**
   * Vytvoří základní strukturu panelu
   */
  _createPanelStructure() {
    if (!this.container) return;

    this.container.className = 'details-panel';
    this.container.style.cssText = `
      display: none;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 16px;
      border-radius: 8px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      max-width: 400px;
      font-family: Arial, sans-serif;
      line-height: 1.4;
    `;

    // CSS styly
    if (!document.getElementById('details-panel-styles')) {
      const style = document.createElement('style');
      style.id = 'details-panel-styles';
      style.textContent = `
        .details-panel .header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.3);
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .details-panel .title {
          font-size: 18px;
          font-weight: bold;
          margin: 0 0 4px 0;
        }
        .details-panel .subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          margin: 0;
        }
        .details-panel .rarity {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 12px;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .details-panel .body {
          margin: 12px 0;
        }
        .details-panel .short-desc {
          font-weight: bold;
          margin-bottom: 8px;
          color: #fff;
        }
        .details-panel .long-desc {
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 12px;
        }
        .details-panel .stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin: 12px 0;
        }
        .details-panel .stat {
          display: flex;
          justify-content: space-between;
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .details-panel .stat-label {
          color: rgba(255, 255, 255, 0.8);
        }
        .details-panel .stat-value {
          font-weight: bold;
          color: #fff;
        }
        .details-panel .footer {
          border-top: 1px solid rgba(255, 255, 255, 0.3);
          padding-top: 8px;
          margin-top: 12px;
        }
        .details-panel .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .details-panel .tag {
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.9);
        }
        
        /* Rarity colors */
        .rarity-common { background: #999; }
        .rarity-rare { background: #3498db; }
        .rarity-epic { background: #9b59b6; }
        .rarity-legendary { background: #f39c12; }
        .rarity-boss { background: #e74c3c; }
        .rarity-special { background: #1abc9c; }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Renderuje panel s daty
   */
  _renderPanel(panelData) {
    if (!this.container) return;

    const html = `
      <div class="header">
        <h3 class="title">${panelData.header.title}</h3>
        <p class="subtitle">${panelData.header.subtitle}</p>
        <span class="rarity rarity-${panelData.header.rarity || 'common'}">
          ${panelData.header.rarity || 'common'}
        </span>
      </div>
      
      <div class="body">
        ${panelData.body.shortDesc ? `<div class="short-desc">${panelData.body.shortDesc}</div>` : ''}
        ${panelData.body.longDesc ? `<div class="long-desc">${panelData.body.longDesc}</div>` : ''}
        
        ${panelData.body.stats && panelData.body.stats.length > 0 ? `
          <div class="stats">
            ${panelData.body.stats.map(stat => `
              <div class="stat">
                <span class="stat-label">${stat.label}:</span>
                <span class="stat-value">${stat.formattedValue}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      
      <div class="footer">
        <div class="tags">
          ${panelData.footer.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.container.setAttribute('aria-label', panelData.ariaLabel);
  }
}

export default DetailsPanel;