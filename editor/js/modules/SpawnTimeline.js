/**
 * SpawnTimeline.js - Visual timeline for spawn table blueprints
 * Renders wave bars, intensity curve, XP budget overlay, and boss triggers.
 */
export class SpawnTimeline {
    constructor(editor) {
        this.editor = editor;
        this.currentBlueprint = null;
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.tooltip = null;
        this.visible = false;
        this.PADDING = { top: 32, right: 24, bottom: 48, left: 56 };
        this.BAR_HEIGHT = 18;
        this.BAR_GAP = 4;
        this.INTENSITY_HEIGHT = 80;
        this.hoveredWave = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this._observing = false;
        this.createDOM();
        this.bindEditorEvents();
    }

    createDOM() {
        this.container = document.createElement('div');
        this.container.id = 'spawn-timeline-container';
        this.container.style.display = 'none';
        this.header = document.createElement('div');
        this.header.className = 'spawn-timeline-header';
        this.container.appendChild(this.header);
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'spawn-timeline-canvas';
        this.canvas.width = 720;
        this.canvas.height = 400;
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.difficultyBox = document.createElement('div');
        this.difficultyBox.className = 'spawn-timeline-difficulty';
        this.container.appendChild(this.difficultyBox);
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'spawn-timeline-tooltip';
        this.tooltip.style.display = 'none';
        this.container.appendChild(this.tooltip);
        const panelContent = document.querySelector('#panel-preview .panel-content');
        if (panelContent) panelContent.appendChild(this.container);
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.onMouseLeave());
        this.canvas.addEventListener('click', () => this.onClick());
        this._resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    }

    bindEditorEvents() {
        const handler = (data) => { this.currentBlueprint = data.blueprint; this.evaluate(); };
        this.editor.on('blueprint:loaded', handler);
        this.editor.on('blueprint:changed', handler);
        this.editor.on('blueprint:created', handler);
    }

    evaluate() {
        const bp = this.currentBlueprint;
        const isSpawn = bp && ((bp.id && bp.id.includes('spawn_table')) ||
            bp.type === 'spawn' || Array.isArray(bp.enemyWaves));
        isSpawn ? this.show() : this.hide();
    }

    show() {
        this.visible = true;
        this.container.style.display = 'block';
        if (this.container.parentElement && !this._observing) {
            this._resizeObserver.observe(this.container.parentElement);
            this._observing = true;
        }
        this.resizeCanvas();
        this.render();
    }

    hide() { this.visible = false; this.container.style.display = 'none'; }

    resizeCanvas() {
        if (!this.container.parentElement) return;
        const width = this.container.parentElement.clientWidth - 16;
        if (width > 100) { this.canvas.width = width; if (this.visible) this.render(); }
    }

    render() {
        if (!this.currentBlueprint || !this.visible) return;
        const bp = this.currentBlueprint;
        const ctx = this.ctx;
        const W = this.canvas.width;
        const waves = bp.enemyWaves || [];
        const bosses = bp.bossTriggers || [];
        const duration = this.getDuration(bp);
        const allLanes = this.buildLanes(waves, bp.eliteWindows || [], bp.uniqueSpawns || []);
        const barsH = allLanes.length * (this.BAR_HEIGHT + this.BAR_GAP);
        this.canvas.height = Math.max(this.PADDING.top + barsH + 16 + this.INTENSITY_HEIGHT + this.PADDING.bottom, 200);
        const H = this.canvas.height;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, W, H);
        this._layout = { allLanes, duration, W, H, barsH };
        this.drawTimeAxis(ctx, W, H, duration);
        this.drawWaveBars(ctx, allLanes, duration, W);
        this.drawBossTriggers(ctx, bosses, duration, W, H);
        const intY = this.PADDING.top + barsH + 16;
        this.drawIntensityCurve(ctx, waves, duration, W, intY, this.INTENSITY_HEIGHT);
        this.drawXpOverlay(ctx, bp, duration, W, intY, this.INTENSITY_HEIGHT);
        this.renderHeader(bp);
        this.renderDifficultyBox(bp);
    }

    getDuration(bp) {
        let d = bp.meta?.estimatedDuration || 120000;
        for (const e of [...(bp.enemyWaves || []), ...(bp.eliteWindows || []), ...(bp.uniqueSpawns || [])]) {
            if (e.endAt && e.endAt < 600000) d = Math.max(d, e.endAt);
        }
        for (const b of (bp.bossTriggers || [])) {
            if (b.condition === 'time') d = Math.max(d, b.value + (b.spawnDelay || 0));
        }
        return d;
    }

    buildLanes(waves, elites, uniques) {
        const lanes = [];
        waves.forEach((w, i) => lanes.push({ ...w, category: 'enemy', index: i, arrayKey: 'enemyWaves' }));
        elites.forEach((w, i) => lanes.push({ ...w, category: 'elite', index: i, arrayKey: 'eliteWindows' }));
        uniques.forEach((w, i) => lanes.push({ ...w, category: 'unique', index: i, arrayKey: 'uniqueSpawns' }));
        return lanes;
    }

    timeToX(t, duration, W) {
        return this.PADDING.left + (t / duration) * (W - this.PADDING.left - this.PADDING.right);
    }

    drawTimeAxis(ctx, W, H, duration) {
        ctx.strokeStyle = '#2a2a4e'; ctx.lineWidth = 1;
        ctx.fillStyle = '#8888bb'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        for (let t = 0; t <= duration; t += 30000) {
            const x = this.timeToX(t, duration, W);
            ctx.beginPath(); ctx.moveTo(x, this.PADDING.top - 10); ctx.lineTo(x, H - this.PADDING.bottom); ctx.stroke();
            ctx.fillText((t / 1000) + 's', x, H - this.PADDING.bottom + 14);
        }
    }

    drawWaveBars(ctx, lanes, duration, W) {
        const COLORS = { elite: '#9c27b0', unique: '#ffd700' };
        lanes.forEach((lane, i) => {
            const y = this.PADDING.top + i * (this.BAR_HEIGHT + this.BAR_GAP);
            const x1 = this.timeToX(lane.startAt || 0, duration, W);
            const x2 = this.timeToX(Math.min(lane.endAt || duration, duration), duration, W);
            const w = Math.max(x2 - x1, 4);
            const color = lane.category === 'enemy' ? this.enemyWeightColor(lane.weight || 50)
                : (COLORS[lane.category] || '#888');
            const avgC = Array.isArray(lane.countRange) ? (lane.countRange[0] + lane.countRange[1]) / 2 : 1;
            const inten = (avgC * (lane.weight || 50) / 100) / ((lane.interval || lane.cooldown || 3000) / 1000);
            const isHov = this.hoveredWave && this.hoveredWave.arrayKey === lane.arrayKey && this.hoveredWave.index === lane.index;
            ctx.globalAlpha = isHov ? 1.0 : Math.min(0.4 + inten * 0.15, 1.0);
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.roundRect(x1, y, w, this.BAR_HEIGHT, 3); ctx.fill();
            if (isHov) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); }
            ctx.globalAlpha = 1.0;
            const label = (lane.enemyId || '').split('.').pop() || '?';
            ctx.fillStyle = '#e0e0ff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            if (w > 40) ctx.fillText(this.truncate(label, w - 8), x1 + 4, y + this.BAR_HEIGHT / 2);
            lane._rect = { x: x1, y, w, h: this.BAR_HEIGHT };
        });
    }

    drawBossTriggers(ctx, bosses, duration, W, H) {
        for (const boss of bosses) {
            const x = boss.condition === 'time' ? this.timeToX(boss.value, duration, W)
                : this.timeToX(duration * 0.75, duration, W);
            ctx.strokeStyle = '#ff2222'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
            ctx.beginPath(); ctx.moveTo(x, this.PADDING.top - 10); ctx.lineTo(x, H - this.PADDING.bottom); ctx.stroke();
            ctx.setLineDash([]);
            const label = (boss.bossId || '').split('.').pop() || 'BOSS';
            ctx.fillStyle = '#ff4444'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('BOSS: ' + label, x, this.PADDING.top - 16);
            if (boss.condition === 'kills') {
                ctx.fillStyle = '#ff8888'; ctx.font = '9px sans-serif';
                ctx.fillText(boss.value + ' kills', x, this.PADDING.top - 4);
            }
        }
    }

    drawIntensityCurve(ctx, waves, duration, W, topY, height) {
        ctx.fillStyle = '#12122a';
        ctx.fillRect(this.PADDING.left, topY, W - this.PADDING.left - this.PADDING.right, height);
        ctx.fillStyle = '#8888bb'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText('enemies/s', this.PADDING.left - 4, topY + 10);
        const samples = []; let maxI = 0;
        for (let t = 0; t <= duration; t += 2000) {
            let sum = 0;
            for (const w of waves) {
                if (t >= (w.startAt || 0) && t <= (w.endAt || duration)) {
                    const avg = Array.isArray(w.countRange) ? (w.countRange[0] + w.countRange[1]) / 2 : 1;
                    sum += (avg * (w.weight || 50) / 100) / ((w.interval || 3000) / 1000);
                }
            }
            samples.push({ t, v: sum });
            if (sum > maxI) maxI = sum;
        }
        if (maxI === 0) return;
        // Filled area
        ctx.beginPath();
        ctx.moveTo(this.timeToX(0, duration, W), topY + height);
        for (const s of samples) ctx.lineTo(this.timeToX(s.t, duration, W), topY + height - (s.v / maxI) * (height - 8));
        ctx.lineTo(this.timeToX(duration, duration, W), topY + height);
        ctx.closePath(); ctx.fillStyle = 'rgba(255, 100, 60, 0.15)'; ctx.fill();
        // Line
        ctx.beginPath();
        samples.forEach((s, i) => {
            const px = this.timeToX(s.t, duration, W), py = topY + height - (s.v / maxI) * (height - 8);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.strokeStyle = '#ff6644'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#ff8866'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(maxI.toFixed(1), this.PADDING.left - 4, topY + height - 2);
    }

    drawXpOverlay(ctx, bp, duration, W, topY, height) {
        const xpPlan = bp.meta?.extensions?.xpPlan;
        if (!xpPlan || !Array.isArray(xpPlan.targetXpPerMinute)) return;
        const targets = xpPlan.targetXpPerMinute;
        let maxXp = Math.max(...targets) || 1;
        ctx.setLineDash([4, 4]); ctx.strokeStyle = '#44ddff'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i < targets.length; i++) {
            const y = topY + height - (targets[i] / maxXp) * (height - 8);
            const x1 = this.timeToX(i * 60000, duration, W);
            const x2 = this.timeToX(Math.min((i + 1) * 60000, duration), duration, W);
            i === 0 ? ctx.moveTo(x1, y) : ctx.lineTo(x1, y);
            ctx.lineTo(x2, y);
        }
        ctx.stroke(); ctx.setLineDash([]);
        if (xpPlan.budgetTotal) {
            ctx.fillStyle = '#44ddff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
            ctx.fillText('XP budget: ' + xpPlan.budgetTotal, this.PADDING.left + 4, topY + 12);
        }
    }

    enemyWeightColor(weight) {
        const t = Math.min(weight, 100) / 100;
        return 'rgb(' + Math.round(180 + t * 75) + ',' + Math.round(120 - t * 100) + ',' + Math.round(40 - t * 30) + ')';
    }

    renderHeader(bp) {
        const name = bp.meta?.displayName || bp.display?.name || bp.id || 'Spawn Table';
        const duration = this.getDuration(bp);
        this.header.textContent = '';
        const strong = document.createElement('strong');
        strong.textContent = name;
        this.header.appendChild(strong);
        this.header.appendChild(document.createTextNode(' '));
        const badges = [
            { text: (bp.enemyWaves || []).length + ' waves', cls: 'st-badge st-badge-enemy' },
            { text: (bp.eliteWindows || []).length + ' elites', cls: 'st-badge st-badge-elite' },
            { text: (bp.bossTriggers || []).length + ' bosses', cls: 'st-badge st-badge-boss' },
            { text: (duration / 1000).toFixed(0) + 's', cls: 'st-badge' }
        ];
        for (const b of badges) {
            const span = document.createElement('span');
            span.className = b.cls; span.textContent = b.text;
            this.header.appendChild(span);
            this.header.appendChild(document.createTextNode(' '));
        }
    }

    renderDifficultyBox(bp) {
        const d = bp.difficulty;
        this.difficultyBox.textContent = '';
        if (!d) return;
        const title = document.createElement('strong');
        title.textContent = 'Difficulty';
        this.difficultyBox.appendChild(title);
        const parts = [];
        if (d.enemyHpMultiplier != null) parts.push('HP x' + d.enemyHpMultiplier);
        if (d.enemyDamageMultiplier != null) parts.push('DMG x' + d.enemyDamageMultiplier);
        if (d.enemySpeedMultiplier != null) parts.push('SPD x' + d.enemySpeedMultiplier);
        if (d.spawnRateMultiplier != null) parts.push('Spawn x' + d.spawnRateMultiplier);
        if (d.targetTTK != null) parts.push('TTK ' + d.targetTTK + 'ms');
        if (d.progressiveScaling) {
            parts.push('Scale: HP+' + ((d.progressiveScaling.hpGrowth || 0) * 100).toFixed(2) + '%/s');
        }
        this.difficultyBox.appendChild(document.createElement('br'));
        const info = document.createElement('span');
        info.textContent = parts.join(' | ');
        this.difficultyBox.appendChild(info);
    }

    // --- Interaction ---

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
        if (!this._layout) return;
        let found = null;
        for (const lane of this._layout.allLanes) {
            if (!lane._rect) continue;
            const r = lane._rect;
            if (this.mouseX >= r.x && this.mouseX <= r.x + r.w && this.mouseY >= r.y && this.mouseY <= r.y + r.h) {
                found = lane; break;
            }
        }
        if (found !== this.hoveredWave) { this.hoveredWave = found; this.render(); }
        found ? this.showTooltip(found, e.clientX, e.clientY) : (this.tooltip.style.display = 'none');
    }

    onMouseLeave() {
        if (this.hoveredWave) { this.hoveredWave = null; this.render(); }
        this.tooltip.style.display = 'none';
    }

    onClick() {
        if (!this.hoveredWave) return;
        const lane = this.hoveredWave;
        const path = lane.arrayKey + '[' + lane.index + ']';
        this.editor.emit('timeline:focus-field', path);
        for (const sel of ['[data-path="' + path + '"]', '[data-path="' + lane.arrayKey + '.' + lane.index + '"]']) {
            const el = document.querySelector(sel);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.outline = '2px solid #4CAF50';
                setTimeout(() => { el.style.outline = ''; }, 2000);
                break;
            }
        }
    }

    showTooltip(lane, clientX, clientY) {
        const avgC = Array.isArray(lane.countRange) ? (lane.countRange[0] + lane.countRange[1]) / 2 : 1;
        const inten = (avgC * (lane.weight || 50) / 100) / ((lane.interval || 3000) / 1000);
        const cntStr = Array.isArray(lane.countRange) ? lane.countRange[0] + '-' + lane.countRange[1] : '?';
        this.tooltip.textContent = '';
        const t = document.createElement('strong'); t.textContent = lane.enemyId || '?'; this.tooltip.appendChild(t);
        const lines = [
            ['Category', lane.category], ['Weight', String(lane.weight || '?')],
            ['Count', cntStr], ['Interval', (lane.interval || lane.cooldown || '?') + 'ms'],
            ['Time', ((lane.startAt || 0) / 1000).toFixed(0) + 's - ' + ((lane.endAt || 0) / 1000).toFixed(0) + 's'],
            ['Intensity', inten.toFixed(2) + ' enemies/s']
        ];
        if (lane.conditions) lines.push(['Conditions', JSON.stringify(lane.conditions)]);
        for (const [lbl, val] of lines) {
            this.tooltip.appendChild(document.createElement('br'));
            const s = document.createElement('span'); s.className = 'st-tip-label'; s.textContent = lbl + ':';
            this.tooltip.appendChild(s); this.tooltip.appendChild(document.createTextNode(' ' + val));
        }
        this.tooltip.style.display = 'block';
        const cr = this.container.getBoundingClientRect();
        let left = clientX - cr.left + 12, top = clientY - cr.top - 10;
        if (left + 220 > this.container.clientWidth) left = clientX - cr.left - 230;
        if (top < 0) top = clientY - cr.top + 20;
        this.tooltip.style.left = left + 'px'; this.tooltip.style.top = top + 'px';
    }

    destroy() {
        if (this._resizeObserver) { this._resizeObserver.disconnect(); this._observing = false; }
        if (this.container?.parentElement) this.container.remove();
    }

    truncate(str, maxWidth) {
        const mc = Math.floor(maxWidth / 6);
        return str.length <= mc ? str : str.substring(0, mc - 1) + '\u2026';
    }
}

export default SpawnTimeline;
