/**
 * BossPhaseEditor.js - Visual editor for boss phase mechanics
 * Shows HP bar with phase segments, ability cards, and transition flow.
 * Activates when a boss blueprint is loaded.
 */

export class BossPhaseEditor {
    constructor(editor) {
        this.editor = editor;
        this.currentBlueprint = null;
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.draggingIdx = -1;
        this.phases = [];
        this.abilities = {};

        this.COLORS = [
            '#4CAF50', '#2196F3', '#FF5722', '#9C27B0',
            '#FF9800', '#00BCD4', '#E91E63', '#8BC34A'
        ];

        this.init();
    }

    init() {
        this.createContainer();
        this.setupListeners();
    }

    createContainer() {
        this.container = document.getElementById('boss-phase-editor');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'boss-phase-editor';
            this.container.className = 'boss-phase-editor';
            this.container.style.display = 'none';

            const previewPanel = document.getElementById('panel-preview');
            if (previewPanel) {
                const panelContent = previewPanel.querySelector('.panel-content');
                if (panelContent) {
                    panelContent.appendChild(this.container);
                }
            }
        }
    }

    setupListeners() {
        this.editor.on('blueprint:loaded', (data) => this.onBlueprintLoaded(data));
        this.editor.on('blueprint:changed', (data) => this.onBlueprintChanged(data));
        this.editor.on('blueprint:created', (data) => this.onBlueprintLoaded(data));
    }

    onBlueprintLoaded(data) {
        this.currentBlueprint = data.blueprint;
        if (this.isBoss()) {
            this.show();
            this.render();
        } else {
            this.hide();
        }
    }

    onBlueprintChanged(data) {
        this.currentBlueprint = data.blueprint;
        if (this.isBoss()) {
            this.render();
        }
    }

    isBoss() {
        return this.currentBlueprint?.type === 'boss' &&
               this.currentBlueprint?.mechanics?.phases;
    }

    show() { this.container.style.display = 'block'; }
    hide() { this.container.style.display = 'none'; }

    /** Extract normalized phases (handles thresholdPct and threshold keys) */
    extractPhases() {
        const rawPhases = this.currentBlueprint.mechanics.phases || [];
        return rawPhases.map((p, i) => {
            const threshold = p.thresholdPct ?? p.threshold ?? (1 - i * 0.33);
            return {
                label: p.id || p.fsmState || ('Phase ' + (i + 1)),
                threshold,
                abilities: p.abilities || [],
                speedMultiplier: p.movementSpeed ?? p.speedMultiplier ?? 1,
                movePattern: p.movePattern || p.fsmState || '-',
                passiveAuras: p.passiveAuras || [],
                description: p.description || '',
                raw: p
            };
        });
    }

    render() {
        if (!this.isBoss()) return;
        this.draggingIdx = -1;

        this.phases = this.extractPhases();
        this.abilities = this.currentBlueprint.mechanics.abilities || {};

        const bp = this.currentBlueprint;
        const hp = bp.stats?.hp || bp.stats?.maxHp || 1000;
        const name = bp.display?.devNameFallback || bp.id || 'Boss';

        // Clear
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }

        // Title
        const title = this._el('h3', 'bpe-title', 'Phase Editor: ' + name);
        this.container.appendChild(title);

        this.renderHPBar(hp);
        this.renderTransitionFlow();
        this.renderPhaseCards();
        this.renderAbilityReference();
        this.renderResistances();
    }

    // ---- Helpers ----

    _el(tag, cls, text) {
        const el = document.createElement(tag);
        if (cls) el.className = cls;
        if (text) el.textContent = text;
        return el;
    }

    _span(cls, text) { return this._el('span', cls, text); }

    // ---- HP Bar with draggable dividers ----

    renderHPBar(hp) {
        const wrapper = this._el('div', 'bpe-hpbar-wrapper');
        wrapper.appendChild(this._el('div', 'bpe-section-label', 'HP: ' + hp));

        const canvasWrap = this._el('div', 'bpe-canvas-wrap');
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'bpe-hpbar-canvas';
        this.canvas.width = 480;
        this.canvas.height = 72;
        this.ctx = this.canvas.getContext('2d');

        canvasWrap.appendChild(this.canvas);
        wrapper.appendChild(canvasWrap);
        this.container.appendChild(wrapper);

        this.drawHPBar();
        this.setupDragHandlers();
    }

    drawHPBar() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const barY = 28;
        const barH = 28;

        ctx.clearRect(0, 0, w, this.canvas.height);

        const sorted = [...this.phases].sort((a, b) => b.threshold - a.threshold);

        // Draw segments
        for (let i = 0; i < sorted.length; i++) {
            const phase = sorted[i];
            const nextThreshold = (i + 1 < sorted.length) ? sorted[i + 1].threshold : 0;
            const x1 = (1 - phase.threshold) * w;
            const x2 = (1 - nextThreshold) * w;

            ctx.fillStyle = this.COLORS[i % this.COLORS.length];
            ctx.globalAlpha = 0.7;
            ctx.fillRect(x1, barY, x2 - x1, barH);
            ctx.globalAlpha = 1;

            // Phase label above
            ctx.fillStyle = '#e0e0e0';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(phase.label, (x1 + x2) / 2, barY - 6);

            // HP % below
            ctx.fillStyle = '#888';
            ctx.font = '10px sans-serif';
            const pctLabel = Math.round(nextThreshold * 100) + '%-' + Math.round(phase.threshold * 100) + '%';
            ctx.fillText(pctLabel, (x1 + x2) / 2, barY + barH + 14);
        }

        // Divider lines (skip threshold=1)
        for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].threshold >= 1) continue;
            const x = (1 - sorted[i].threshold) * w;

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(x, barY - 2);
            ctx.lineTo(x, barY + barH + 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Handle circle
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x, barY + barH / 2, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Border
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, barY, w, barH);

        // Edge labels
        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('100% HP', 2, barY + barH + 14);
        ctx.textAlign = 'right';
        ctx.fillText('0% HP', w - 2, barY + barH + 14);
    }

    setupDragHandlers() {
        const sorted = [...this.phases].sort((a, b) => b.threshold - a.threshold);
        const draggable = sorted.filter(p => p.threshold < 1);

        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            const my = (e.clientY - rect.top) * (this.canvas.height / rect.height);

            for (let i = 0; i < draggable.length; i++) {
                const x = (1 - draggable[i].threshold) * this.canvas.width;
                if (Math.abs(mx - x) < 10 && Math.abs(my - 42) < 20) {
                    this.draggingIdx = this.phases.indexOf(draggable[i]);
                    break;
                }
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.draggingIdx < 0) return;
            const rect = this.canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            let newThreshold = 1 - (mx / this.canvas.width);
            newThreshold = Math.max(0.01, Math.min(0.99, newThreshold));
            this.phases[this.draggingIdx].threshold = Math.round(newThreshold * 100) / 100;
            this.drawHPBar();
        });

        const stopDrag = () => {
            if (this.draggingIdx >= 0) {
                this.commitThresholdChange(this.draggingIdx);
                this.draggingIdx = -1;
            }
        };
        this.canvas.addEventListener('mouseup', stopDrag);
        this.canvas.addEventListener('mouseleave', stopDrag);
    }

    commitThresholdChange(idx) {
        const rawPhase = this.currentBlueprint.mechanics.phases[idx];
        if (!rawPhase) return;
        const newVal = this.phases[idx].threshold;
        const key = rawPhase.thresholdPct !== undefined ? 'thresholdPct' : 'threshold';
        this.editor.onPropertyChange('mechanics.phases[' + idx + '].' + key, newVal);
    }

    // ---- Phase transition flow ----

    renderTransitionFlow() {
        const flow = this._el('div', 'bpe-transition-flow');
        const sorted = [...this.phases].sort((a, b) => b.threshold - a.threshold);

        sorted.forEach((phase, i) => {
            const node = this._el('div', 'bpe-flow-node');
            node.style.borderColor = this.COLORS[i % this.COLORS.length];
            node.appendChild(this._el('div', 'bpe-flow-name', phase.label));
            node.appendChild(this._el('div', 'bpe-flow-pct', Math.round(phase.threshold * 100) + '% HP'));
            flow.appendChild(node);

            if (i < sorted.length - 1) {
                flow.appendChild(this._el('div', 'bpe-flow-arrow', '\u2192'));
            }
        });
        this.container.appendChild(flow);
    }

    // ---- Phase detail cards ----

    renderPhaseCards() {
        const section = this._el('div', 'bpe-phase-cards');
        const sorted = [...this.phases].sort((a, b) => b.threshold - a.threshold);

        sorted.forEach((phase, i) => {
            const card = this._el('div', 'bpe-phase-card');
            card.style.borderLeftColor = this.COLORS[i % this.COLORS.length];

            // Header
            const header = this._el('div', 'bpe-card-header');
            header.appendChild(this._span('bpe-card-title', phase.label));
            header.appendChild(this._span('bpe-card-threshold', Math.round(phase.threshold * 100) + '% HP'));
            card.appendChild(header);

            // Abilities
            if (phase.abilities.length > 0) {
                const abList = this._el('div', 'bpe-card-section');
                abList.appendChild(this._el('div', 'bpe-card-label', 'Abilities'));
                phase.abilities.forEach(abName => {
                    const ab = this.abilities[abName];
                    const abEl = this._el('div', 'bpe-ability-tag');
                    abEl.appendChild(this._createIconElement(ab));
                    abEl.appendChild(document.createTextNode(' ' + abName));
                    if (ab?.cooldown || ab?.interval) {
                        const cd = ab.cooldown || ab.interval;
                        abEl.appendChild(this._span('bpe-cooldown', ' ' + (cd / 1000).toFixed(1) + 's'));
                    }
                    abList.appendChild(abEl);
                });
                card.appendChild(abList);
            }

            // Speed
            const speedRow = this._el('div', 'bpe-card-section');
            speedRow.appendChild(this._el('div', 'bpe-card-label', 'Speed'));
            speedRow.appendChild(this._el('div', 'bpe-card-value', phase.speedMultiplier + 'x'));
            card.appendChild(speedRow);

            // Move pattern
            const moveRow = this._el('div', 'bpe-card-section');
            moveRow.appendChild(this._el('div', 'bpe-card-label', 'Move'));
            moveRow.appendChild(this._el('div', 'bpe-card-value', phase.movePattern));
            card.appendChild(moveRow);

            // Passive auras
            if (phase.passiveAuras.length > 0) {
                const auraRow = this._el('div', 'bpe-card-section');
                auraRow.appendChild(this._el('div', 'bpe-card-label', 'Auras'));
                phase.passiveAuras.forEach(aura => {
                    const text = (aura.type || 'aura') + ' (r:' + (aura.radius || '?') + ', dmg:' + (aura.damage || 0) + ')';
                    auraRow.appendChild(this._el('div', 'bpe-aura-tag', text));
                });
                card.appendChild(auraRow);
            }

            // Description
            if (phase.description) {
                card.appendChild(this._el('div', 'bpe-card-desc', phase.description));
            }

            section.appendChild(card);
        });
        this.container.appendChild(section);
    }

    // ---- Ability reference ----

    renderAbilityReference() {
        const keys = Object.keys(this.abilities);
        if (keys.length === 0) return;

        const section = this._el('div', 'bpe-ability-ref');
        section.appendChild(this._el('div', 'bpe-section-label', 'Abilities'));

        const grid = this._el('div', 'bpe-ability-grid');

        keys.forEach(name => {
            const ab = this.abilities[name];
            const card = this._el('div', 'bpe-ability-card');
            card.style.borderColor = this._dangerColor(ab);

            // Header row
            const hdr = this._el('div', 'bpe-ab-header');
            hdr.appendChild(this._createIconElement(ab));
            hdr.appendChild(this._span('bpe-ab-name', name));
            card.appendChild(hdr);

            // Stats
            const statsEl = this._el('div', 'bpe-ab-stats');
            this._buildAbilityStats(ab).forEach(s => statsEl.appendChild(s));
            card.appendChild(statsEl);

            grid.appendChild(card);
        });

        section.appendChild(grid);
        this.container.appendChild(section);
    }

    _buildAbilityStats(ab) {
        if (!ab) return [this._span('bpe-stat-na', 'N/A')];
        const out = [];
        if (ab.damage !== undefined) out.push(this._span('bpe-stat-dmg', 'DMG:' + ab.damage));
        if (ab.radius !== undefined) out.push(this._span('bpe-stat-radius', 'R:' + ab.radius));
        if (ab.cooldown !== undefined || ab.interval !== undefined) {
            out.push(this._span('bpe-stat-cd', 'CD:' + ((ab.cooldown || ab.interval) / 1000).toFixed(1) + 's'));
        }
        const cnt = ab.count || ab.projectileCount || ab.beamCount;
        if (cnt !== undefined) out.push(this._span('bpe-stat-count', 'x' + cnt));
        if (ab.chargeTime !== undefined) out.push(this._span('bpe-stat-charge', 'Charge:' + (ab.chargeTime / 1000).toFixed(1) + 's'));
        if (ab.range !== undefined) out.push(this._span('bpe-stat-range', 'Range:' + ab.range));
        if (ab.spreadAngle !== undefined) out.push(this._span('bpe-stat-spread', ab.spreadAngle + 'deg'));
        if (ab.enemyTypes) out.push(this._span('bpe-stat-summon', 'Summons:' + ab.enemyTypes.length));
        return out;
    }

    _dangerColor(ab) {
        if (!ab) return '#555';
        const dmg = ab.damage || 0;
        if (dmg >= 20) return '#f44336';
        if (dmg >= 10) return '#ff9800';
        if (dmg >= 1) return '#FFC107';
        if (ab.enemyTypes || ab.count) return '#ff9800';
        return '#4CAF50';
    }

    _createIconElement(ab) {
        const wrapper = this._el('span', 'bpe-icon-wrap');
        if (!ab) {
            wrapper.appendChild(this._el('span', 'bpe-icon-dot'));
            return wrapper;
        }

        const hasSummon = ab.enemyTypes || ab.type === 'spawn' || ab.type === 'summon';
        const hasBeam = ab.beamCount || ab.sweepSpeed;
        const hasArea = ab.radius && ab.stormDuration;
        const hasProjectile = ab.projectileCount || ab.spreadAngle;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'bpe-icon');
        svg.setAttribute('viewBox', '0 0 16 16');

        if (hasSummon) {
            svg.appendChild(this._svgLine(8, 3, 8, 13, 2));
            svg.appendChild(this._svgLine(3, 8, 13, 8, 2));
        } else if (hasArea) {
            const c1 = this._svgCircle(8, 8, 6, false);
            const c2 = this._svgCircle(8, 8, 2, true);
            svg.appendChild(c1);
            svg.appendChild(c2);
        } else if (hasBeam) {
            svg.appendChild(this._svgLine(8, 8, 2, 2, 1.5));
            svg.appendChild(this._svgLine(8, 8, 14, 2, 1.5));
            svg.appendChild(this._svgLine(8, 8, 8, 14, 1.5));
        } else if (hasProjectile) {
            const pts = [[3,1],[13,1],[1,8],[15,8],[3,15],[13,15]];
            pts.forEach(([px, py]) => svg.appendChild(this._svgLine(8, 8, px, py, 1.2)));
        } else {
            svg.appendChild(this._svgCircle(8, 8, 3, true));
        }

        wrapper.appendChild(svg);
        return wrapper;
    }

    _svgLine(x1, y1, x2, y2, sw) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', 'currentColor');
        line.setAttribute('stroke-width', sw);
        return line;
    }

    _svgCircle(cx, cy, r, filled) {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', cx);
        c.setAttribute('cy', cy);
        c.setAttribute('r', r);
        if (filled) {
            c.setAttribute('fill', 'currentColor');
        } else {
            c.setAttribute('fill', 'none');
            c.setAttribute('stroke', 'currentColor');
            c.setAttribute('stroke-width', '1.5');
        }
        return c;
    }

    // ---- Resistances ----

    renderResistances() {
        const res = this.currentBlueprint.mechanics?.resistances;
        if (!res || Object.keys(res).length === 0) return;

        const section = this._el('div', 'bpe-resistances');
        section.appendChild(this._el('div', 'bpe-section-label', 'Resistances'));

        const grid = this._el('div', 'bpe-res-grid');

        for (const [type, mult] of Object.entries(res)) {
            const tag = this._el('div', 'bpe-res-tag');
            const label = mult >= 1 ? 'Immune' : mult <= 0.3 ? 'Resist' : 'Weak';
            const color = mult >= 1 ? '#f44336' : mult <= 0.3 ? '#4CAF50' : '#ff9800';
            const typeSpan = this._span('', type);
            typeSpan.style.color = color;
            tag.appendChild(typeSpan);
            tag.appendChild(document.createTextNode(': x' + mult + ' '));
            tag.appendChild(this._span('bpe-res-label', '(' + label + ')'));
            grid.appendChild(tag);
        }

        section.appendChild(grid);
        this.container.appendChild(section);
    }
}

export default BossPhaseEditor;
