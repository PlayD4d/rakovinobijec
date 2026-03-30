/**
 * LootVisualizer.js - Donut charts and drop rate analysis for loot tables
 * Renders per-tier donut charts, drop rate calculator, tier comparison, and warnings.
 */
export class LootVisualizer {
    constructor(editor) {
        this.editor = editor;
        this.currentBlueprint = null;
        this.container = null;
        this.visible = false;
        this.hoveredSegment = null;
        this.tooltip = null;
        this.DONUT_RADIUS = 64;
        this.DONUT_INNER = 36;
        this.TIER_ORDER = ['normal', 'elite', 'boss'];
        this.createDOM();
        this.bindEditorEvents();
    }

    // --- Color mapping by drop type ---

    dropColor(dropId) {
        if (dropId.includes('xp.small')) return '#44bbcc';
        if (dropId.includes('xp.medium')) return '#22ddee';
        if (dropId.includes('xp.large')) return '#00ffff';
        if (dropId.includes('xp')) return '#33ccdd';
        if (dropId.includes('leukocyte') || dropId.includes('protein_cache')) return '#ff6688';
        if (dropId.includes('metotrexat')) return '#ffd700';
        if (dropId.includes('magnet')) return '#bb77ff';
        if (dropId.includes('adrenal')) return '#ff9944';
        return '#888899';
    }

    dropCategory(dropId) {
        if (dropId.includes('xp')) return 'XP';
        if (dropId.includes('leukocyte') || dropId.includes('protein_cache')) return 'Health';
        if (dropId.includes('metotrexat')) return 'Special';
        if (dropId.includes('magnet')) return 'Magnet';
        if (dropId.includes('adrenal')) return 'Utility';
        return 'Other';
    }

    // --- DOM setup ---

    createDOM() {
        this.container = document.createElement('div');
        this.container.id = 'loot-visualizer-container';
        this.container.style.display = 'none';

        this.header = document.createElement('div');
        this.header.className = 'loot-viz-header';
        this.container.appendChild(this.header);

        this.chartsRow = document.createElement('div');
        this.chartsRow.className = 'loot-viz-charts-row';
        this.container.appendChild(this.chartsRow);

        this.comparisonBox = document.createElement('div');
        this.comparisonBox.className = 'loot-viz-comparison';
        this.container.appendChild(this.comparisonBox);

        this.tableBox = document.createElement('div');
        this.tableBox.className = 'loot-viz-table-wrap';
        this.container.appendChild(this.tableBox);

        this.warningsBox = document.createElement('div');
        this.warningsBox.className = 'loot-viz-warnings';
        this.container.appendChild(this.warningsBox);

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'loot-viz-tooltip';
        this.tooltip.style.display = 'none';
        this.container.appendChild(this.tooltip);

        const panelContent = document.querySelector('#panel-preview .panel-content');
        if (panelContent) panelContent.appendChild(this.container);
    }

    bindEditorEvents() {
        const handler = (data) => { this.currentBlueprint = data.blueprint; this.evaluate(); };
        this.editor.on('blueprint:loaded', handler);
        this.editor.on('blueprint:changed', handler);
        this.editor.on('blueprint:created', handler);
    }

    evaluate() {
        const bp = this.currentBlueprint;
        const hasLoot = bp && bp.lootTables && typeof bp.lootTables === 'object';
        hasLoot ? this.show() : this.hide();
    }

    show() {
        this.visible = true;
        this.container.style.display = 'block';
        this.render();
    }

    hide() {
        this.visible = false;
        this.container.style.display = 'none';
    }

    // --- Main render ---

    render() {
        if (!this.currentBlueprint || !this.visible) return;
        const lt = this.currentBlueprint.lootTables;
        if (!lt) return;

        this.renderHeader();
        this.renderDonutCharts(lt);
        this.renderComparison(lt);
        this.renderDropTable(lt);
        this.renderWarnings(lt);
    }

    renderHeader() {
        this.header.textContent = '';
        const strong = document.createElement('strong');
        strong.textContent = 'Loot Tables';
        this.header.appendChild(strong);
        const tierCount = Object.keys(this.currentBlueprint.lootTables).length;
        const badge = document.createElement('span');
        badge.className = 'st-badge';
        badge.textContent = tierCount + ' tiers';
        this.header.appendChild(document.createTextNode(' '));
        this.header.appendChild(badge);
    }

    // --- Donut charts ---

    renderDonutCharts(lt) {
        this.chartsRow.textContent = '';
        for (const tier of this.TIER_ORDER) {
            if (!lt[tier]) continue;
            const wrap = document.createElement('div');
            wrap.className = 'loot-viz-chart-cell';

            const label = document.createElement('div');
            label.className = 'loot-viz-tier-label';
            label.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);
            wrap.appendChild(label);

            const canvas = document.createElement('canvas');
            canvas.width = this.DONUT_RADIUS * 2 + 16;
            canvas.height = this.DONUT_RADIUS * 2 + 16;
            canvas.className = 'loot-viz-donut';
            wrap.appendChild(canvas);

            this.drawDonut(canvas, lt[tier], tier);
            this.chartsRow.appendChild(wrap);
        }
    }

    drawDonut(canvas, tierData, tierName) {
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const R = this.DONUT_RADIUS;
        const r = this.DONUT_INNER;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const entries = Object.entries(tierData);
        const total = entries.reduce((s, e) => s + e[1], 0);
        if (total === 0) {
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
            ctx.fill();
            return;
        }

        let angle = -Math.PI / 2;
        const segments = [];
        for (const [dropId, weight] of entries) {
            const sweep = (weight / total) * Math.PI * 2;
            const color = this.dropColor(dropId);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
            ctx.arc(cx, cy, R, angle, angle + sweep);
            ctx.arc(cx, cy, r, angle + sweep, angle, true);
            ctx.closePath();
            ctx.fill();

            segments.push({ dropId, weight, pct: (weight / total * 100), startAngle: angle, endAngle: angle + sweep });
            angle += sweep;
        }

        // Center hole
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
        ctx.fill();

        // Center text
        ctx.fillStyle = '#8888bb';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(entries.length + ' drops', cx, cy);

        // Hover handler
        const self = this;
        const moveHandler = (e) => {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left - cx;
            const my = e.clientY - rect.top - cy;
            const dist = Math.sqrt(mx * mx + my * my);
            if (dist < r || dist > R) {
                self.tooltip.style.display = 'none';
                return;
            }
            let a = Math.atan2(my, mx);
            if (a < -Math.PI / 2) a += Math.PI * 2;
            for (const seg of segments) {
                let start = seg.startAngle;
                let end = seg.endAngle;
                if (start < -Math.PI / 2) { start += Math.PI * 2; end += Math.PI * 2; }
                if (a >= start && a < end) {
                    self.showSegmentTooltip(seg, tierName, e.clientX, e.clientY);
                    return;
                }
            }
            self.tooltip.style.display = 'none';
        };
        canvas.addEventListener('mousemove', moveHandler);
        canvas.addEventListener('mouseleave', () => { self.tooltip.style.display = 'none'; });
    }

    showSegmentTooltip(seg, tierName, clientX, clientY) {
        this.tooltip.textContent = '';
        const title = document.createElement('strong');
        title.textContent = seg.dropId;
        this.tooltip.appendChild(title);
        this.tooltip.appendChild(document.createElement('br'));
        const info = document.createElement('span');
        info.textContent = tierName + ' tier  |  weight: ' + seg.weight + '  |  ' + seg.pct.toFixed(1) + '%';
        this.tooltip.appendChild(info);
        this.tooltip.style.display = 'block';
        const cr = this.container.getBoundingClientRect();
        let left = clientX - cr.left + 14;
        let top = clientY - cr.top - 10;
        if (left + 220 > this.container.clientWidth) left = clientX - cr.left - 230;
        this.tooltip.style.left = left + 'px';
        this.tooltip.style.top = top + 'px';
    }

    // --- Tier comparison ---

    renderComparison(lt) {
        this.comparisonBox.textContent = '';
        const title = document.createElement('strong');
        title.textContent = 'Tier Comparison';
        this.comparisonBox.appendChild(title);

        for (const tier of this.TIER_ORDER) {
            if (!lt[tier]) continue;
            const entries = Object.entries(lt[tier]);
            const total = entries.reduce((s, e) => s + e[1], 0);
            if (total === 0) continue;

            const groups = {};
            for (const [id, w] of entries) {
                const cat = this.dropCategory(id);
                groups[cat] = (groups[cat] || 0) + w;
            }

            const row = document.createElement('div');
            row.className = 'loot-viz-comparison-row';
            const label = document.createElement('span');
            label.className = 'loot-viz-comp-tier';
            label.textContent = tier.charAt(0).toUpperCase() + tier.slice(1) + ':';
            row.appendChild(label);

            const parts = Object.entries(groups)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, w]) => cat + ' ' + (w / total * 100).toFixed(1) + '%');
            const detail = document.createElement('span');
            detail.textContent = parts.join(', ');
            row.appendChild(detail);
            this.comparisonBox.appendChild(row);
        }
    }

    // --- Drop rate table ---

    renderDropTable(lt) {
        this.tableBox.textContent = '';
        const bp = this.currentBlueprint;
        const spawnRate = this.estimateSpawnRate(bp);
        const durationSec = (bp.meta?.estimatedDuration || 120000) / 1000;
        const estKillsPerMin = spawnRate * 60;
        const estTotalKills = spawnRate * durationSec;

        for (const tier of this.TIER_ORDER) {
            if (!lt[tier]) continue;
            const entries = Object.entries(lt[tier]);
            const total = entries.reduce((s, e) => s + e[1], 0);

            const section = document.createElement('div');
            section.className = 'loot-viz-table-section';

            const heading = document.createElement('div');
            heading.className = 'loot-viz-table-heading';
            heading.textContent = tier.charAt(0).toUpperCase() + tier.slice(1) + ' Drops';
            section.appendChild(heading);

            const table = document.createElement('table');
            table.className = 'loot-viz-table';
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            for (const h of ['Drop', 'Weight', 'Prob/kill', 'Drops/min', 'Drops/level']) {
                const th = document.createElement('th');
                th.textContent = h;
                headerRow.appendChild(th);
            }
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            const sorted = entries.slice().sort((a, b) => b[1] - a[1]);
            for (const [dropId, weight] of sorted) {
                const prob = total > 0 ? weight / total : 0;
                const perMin = prob * estKillsPerMin;
                const perLevel = prob * estTotalKills;
                const tr = document.createElement('tr');

                const tdName = document.createElement('td');
                const dot = document.createElement('span');
                dot.className = 'loot-viz-color-dot';
                dot.style.backgroundColor = this.dropColor(dropId);
                tdName.appendChild(dot);
                tdName.appendChild(document.createTextNode(dropId.replace('drop.', '')));
                tr.appendChild(tdName);

                const tdWeight = document.createElement('td');
                tdWeight.textContent = weight;
                tr.appendChild(tdWeight);

                const tdProb = document.createElement('td');
                tdProb.textContent = (prob * 100).toFixed(2) + '%';
                tr.appendChild(tdProb);

                const tdPerMin = document.createElement('td');
                tdPerMin.textContent = tier === 'boss' ? '-' : perMin.toFixed(1);
                tr.appendChild(tdPerMin);

                const tdPerLevel = document.createElement('td');
                tdPerLevel.textContent = tier === 'boss' ? (prob * 100).toFixed(0) + '%' : perLevel.toFixed(1);
                tr.appendChild(tdPerLevel);

                tbody.appendChild(tr);
            }
            table.appendChild(tbody);
            section.appendChild(table);
            this.tableBox.appendChild(section);
        }
    }

    estimateSpawnRate(bp) {
        const waves = bp.enemyWaves || [];
        let sum = 0;
        for (const w of waves) {
            const avg = Array.isArray(w.countRange) ? (w.countRange[0] + w.countRange[1]) / 2 : 1;
            const interval = (w.interval || 3000) / 1000;
            sum += (avg * (w.weight || 50) / 100) / interval;
        }
        return sum || 1;
    }

    // --- Warnings ---

    renderWarnings(lt) {
        this.warningsBox.textContent = '';
        const warnings = [];

        for (const tier of this.TIER_ORDER) {
            if (!lt[tier]) {
                const severity = tier === 'normal' ? 'error' : 'warn';
                warnings.push({ level: severity, msg: 'Tier "' + tier + '" is missing from loot tables.' });
                continue;
            }
            const entries = Object.entries(lt[tier]);
            const total = entries.reduce((s, e) => s + e[1], 0);
            if (total === 0) {
                warnings.push({ level: 'error', msg: 'Tier "' + tier + '" has 0 total weight (no drops).' });
                continue;
            }
            if (entries.length === 0) {
                warnings.push({ level: 'error', msg: 'Tier "' + tier + '" has no drop entries.' });
                continue;
            }

            // Check healing
            let healWeight = 0;
            for (const [id, w] of entries) {
                if (id.includes('leukocyte') || id.includes('protein_cache')) healWeight += w;
            }
            const healPct = healWeight / total * 100;
            if (tier === 'normal' && healPct < 0.1) {
                warnings.push({ level: 'warn', msg: 'Normal tier healing is only ' + healPct.toFixed(3) + '% (may be too rare for survival).' });
            }
        }

        if (warnings.length === 0) {
            const ok = document.createElement('div');
            ok.className = 'loot-viz-ok';
            ok.textContent = 'No issues found.';
            this.warningsBox.appendChild(ok);
            return;
        }

        for (const w of warnings) {
            const row = document.createElement('div');
            row.className = 'loot-viz-warning loot-viz-warning--' + w.level;
            const icon = document.createElement('span');
            icon.className = 'loot-viz-warning-icon';
            icon.textContent = w.level === 'error' ? '!' : '?';
            row.appendChild(icon);
            const msg = document.createElement('span');
            msg.textContent = w.msg;
            row.appendChild(msg);
            this.warningsBox.appendChild(row);
        }
    }

    destroy() {
        if (this.container?.parentElement) this.container.remove();
    }
}

export default LootVisualizer;
