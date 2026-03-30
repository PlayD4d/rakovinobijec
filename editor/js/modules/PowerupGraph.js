/**
 * PowerupGraph.js - Power-up Scaling Graph for Blueprint Editor
 * Renders modifier-per-level line charts, DPS impact bars, a stack simulator,
 * and a comparison panel when a powerup blueprint is selected.
 *
 * All data comes from trusted local blueprint JSON5 files.
 * This is a local developer tool, not a web-facing application.
 */

export class PowerupGraph {
    constructor(editor) {
        this.editor = editor;
        this.currentBlueprint = null;
        this.playerConfig = null;
        this.container = null;
        this.lineCanvas = null;
        this.lineCtx = null;
        this.barCanvas = null;
        this.barCtx = null;
        this.allPowerups = [];
        this.simSlots = [];

        this.PATH_COLORS = {
            projectileDamage: '#f44336',
            damage: '#f44336',
            attackIntervalMs: '#FF9800',
            attackSpeed: '#FF9800',
            moveSpeed: '#2196F3',
            speed: '#2196F3',
            shield: '#00BCD4',
            shieldHP: '#00BCD4',
            projectileCount: '#9C27B0',
            count: '#9C27B0',
            dodgeChance: '#E91E63',
            critChance: '#FFEB3B',
            default: '#8BC34A',
        };

        this.init();
    }

    async init() {
        this.createDOM();
        this._configsReady = false;

        this.editor.on('blueprint:loaded', (data) => {
            this.currentBlueprint = data.blueprint;
            if (this._configsReady) this.update();
            else this._pendingUpdate = true;
        });
        this.editor.on('blueprint:changed', (data) => {
            this.currentBlueprint = data.blueprint;
            if (this._configsReady) this.update();
        });
        this.editor.on('blueprint:created', (data) => {
            this.currentBlueprint = data.blueprint;
            if (this._configsReady) this.update();
        });
        this.editor.on('blueprints:loaded', (list) => {
            this.allPowerups = (list || []).filter(b =>
                (b.type === 'powerup') || (b.id && b.id.startsWith('powerup.'))
            );
        });

        await this.loadPlayerConfig();
        this._configsReady = true;
        if (this._pendingUpdate && this.currentBlueprint) {
            this._pendingUpdate = false;
            this.update();
        }
    }

    // ----------------------------------------------------------------
    // Player config
    // ----------------------------------------------------------------

    async loadPlayerConfig() {
        try {
            const resp = await fetch('../data/blueprints/player/player.json5');
            if (resp.ok) {
                const text = await resp.text();
                this.playerConfig = typeof JSON5 !== 'undefined'
                    ? JSON5.parse(text) : JSON.parse(text);
            }
        } catch (e) {
            console.warn('PowerupGraph: Failed to load player.json5', e);
        }
    }

    getPlayerDPS() {
        const p = this.playerConfig;
        if (!p) return 30;
        const damage = p.mechanics?.projectile?.stats?.damage
            || p.mechanics?.attack?.damageBase || 15;
        const interval = p.mechanics?.attack?.intervalMs
            || p.mechanics?.projectile?.intervalMs || 1000;
        const count = p.mechanics?.projectile?.count || 4;
        const hitRate = 0.3;
        return Math.max(damage * count * (1000 / interval) * hitRate, 0.1);
    }

    getPlayerDamage() {
        const p = this.playerConfig;
        if (!p) return 15;
        const val = p.mechanics?.projectile?.stats?.damage
            ?? p.mechanics?.attack?.damageBase ?? 15;
        return Math.max(val, 1);
    }

    // ----------------------------------------------------------------
    // DOM construction (safe — createElement/textContent only)
    // ----------------------------------------------------------------

    createDOM() {
        const previewContent = document.querySelector('#panel-preview .panel-content');
        if (!previewContent) return;

        this.container = document.createElement('div');
        this.container.id = 'powerup-graph';
        this.container.className = 'pug-container';
        this.container.style.display = 'none';

        // Header
        const header = document.createElement('div');
        header.className = 'pug-header';
        const title = document.createElement('h3');
        title.textContent = 'Power-up Scaling Graph';
        header.appendChild(title);

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn-balance-toggle';
        toggleBtn.textContent = '\u25BC';
        header.appendChild(toggleBtn);
        this.container.appendChild(header);

        // Body
        this.body = document.createElement('div');
        this.body.className = 'pug-body';

        // Section 1: Line chart
        const lineSection = document.createElement('div');
        lineSection.className = 'pug-section';
        const lineLabel = document.createElement('div');
        lineLabel.className = 'pug-section-label';
        lineLabel.textContent = 'Modifier Value per Level';
        lineSection.appendChild(lineLabel);

        this.legendEl = document.createElement('div');
        this.legendEl.className = 'pug-legend';
        lineSection.appendChild(this.legendEl);

        const lineWrap = document.createElement('div');
        lineWrap.className = 'pug-canvas-wrap';
        this.lineCanvas = document.createElement('canvas');
        this.lineCanvas.width = 480;
        this.lineCanvas.height = 180;
        this.lineCanvas.className = 'pug-canvas';
        lineWrap.appendChild(this.lineCanvas);
        lineSection.appendChild(lineWrap);
        this.body.appendChild(lineSection);
        this.lineCtx = this.lineCanvas.getContext('2d');

        // Section 2: DPS impact bars
        const barSection = document.createElement('div');
        barSection.className = 'pug-section';
        const barLabel = document.createElement('div');
        barLabel.className = 'pug-section-label';
        barLabel.textContent = 'DPS Impact per Level';
        barSection.appendChild(barLabel);

        const barWrap = document.createElement('div');
        barWrap.className = 'pug-canvas-wrap';
        this.barCanvas = document.createElement('canvas');
        this.barCanvas.width = 480;
        this.barCanvas.height = 120;
        this.barCanvas.className = 'pug-canvas';
        barWrap.appendChild(this.barCanvas);
        barSection.appendChild(barWrap);
        this.body.appendChild(barSection);
        this.barCtx = this.barCanvas.getContext('2d');

        // Section 3: Stack simulator
        this.simSection = document.createElement('div');
        this.simSection.className = 'pug-section pug-sim-section';
        const simLabel = document.createElement('div');
        simLabel.className = 'pug-section-label';
        simLabel.textContent = 'Stack Simulator';
        this.simSection.appendChild(simLabel);

        this.simControls = document.createElement('div');
        this.simControls.className = 'pug-sim-controls';
        this.simSection.appendChild(this.simControls);

        this.simResults = document.createElement('div');
        this.simResults.className = 'pug-sim-results';
        this.simSection.appendChild(this.simResults);
        this.body.appendChild(this.simSection);

        // Section 4: Comparison
        this.compSection = document.createElement('div');
        this.compSection.className = 'pug-section pug-comp-section';
        const compLabel = document.createElement('div');
        compLabel.className = 'pug-section-label';
        compLabel.textContent = 'This Power-up vs Average (at Level 1)';
        this.compSection.appendChild(compLabel);

        this.compBar = document.createElement('div');
        this.compBar.className = 'pug-comp-bar-container';
        this.compSection.appendChild(this.compBar);
        this.body.appendChild(this.compSection);

        this.container.appendChild(this.body);
        previewContent.appendChild(this.container);

        // Toggle
        toggleBtn.addEventListener('click', () => {
            const collapsed = this.body.style.display === 'none';
            this.body.style.display = collapsed ? 'block' : 'none';
            toggleBtn.textContent = collapsed ? '\u25BC' : '\u25B6';
        });
    }

    // ----------------------------------------------------------------
    // Router
    // ----------------------------------------------------------------

    update() {
        const bp = this.currentBlueprint;
        if (!bp) { this.container.style.display = 'none'; return; }

        const isPowerup = bp.type === 'powerup'
            || (bp.id && bp.id.startsWith('powerup.'));
        if (!isPowerup) { this.container.style.display = 'none'; return; }

        this.container.style.display = 'block';

        const maxLevel = bp.stats?.maxLevel || 5;
        const modifiers = bp.mechanics?.modifiersPerLevel || [];

        this.drawLineChart(modifiers, maxLevel);
        this.drawDPSBars(modifiers, maxLevel);
        this.buildSimulator(bp);
        this.buildComparison(bp);
    }

    // ----------------------------------------------------------------
    // 1. Line chart: cumulative modifier value per level
    // ----------------------------------------------------------------

    drawLineChart(modifiers, maxLevel) {
        const ctx = this.lineCtx;
        const W = this.lineCanvas.width;
        const H = this.lineCanvas.height;
        const pad = { top: 16, bottom: 28, left: 48, right: 16 };

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#12122a';
        ctx.fillRect(0, 0, W, H);

        if (modifiers.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No modifiersPerLevel defined', W / 2, H / 2);
            this.legendEl.textContent = '';
            return;
        }

        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;

        // Compute cumulative values per modifier per level
        const series = modifiers.map(mod => {
            const points = [];
            for (let lvl = 1; lvl <= maxLevel; lvl++) {
                points.push({ lvl, val: mod.value * lvl });
            }
            return { path: mod.path || 'unknown', type: mod.type, points };
        });

        // Find global min/max for Y axis
        let yMin = 0;
        let yMax = 0;
        for (const s of series) {
            for (const p of s.points) {
                if (p.val < yMin) yMin = p.val;
                if (p.val > yMax) yMax = p.val;
            }
        }
        // Ensure some range
        if (yMax === yMin) { yMax = yMin + 1; }
        const yRange = yMax - yMin;
        const yPad = yRange * 0.1;
        yMin -= yPad;
        yMax += yPad;

        // Grid lines
        ctx.strokeStyle = '#2a2a4e';
        ctx.lineWidth = 0.5;
        // Vertical: one per level
        for (let lvl = 1; lvl <= maxLevel; lvl++) {
            const x = pad.left + ((lvl - 1) / (maxLevel - 1 || 1)) * chartW;
            ctx.beginPath();
            ctx.moveTo(x, pad.top);
            ctx.lineTo(x, pad.top + chartH);
            ctx.stroke();
        }
        // Horizontal: 5 lines
        const hLines = 5;
        for (let i = 0; i <= hLines; i++) {
            const y = pad.top + (i / hLines) * chartH;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + chartW, y);
            ctx.stroke();
        }

        // Axes labels
        ctx.fillStyle = '#888';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        for (let lvl = 1; lvl <= maxLevel; lvl++) {
            const x = pad.left + ((lvl - 1) / (maxLevel - 1 || 1)) * chartW;
            ctx.fillText('Lv' + lvl, x, H - 8);
        }
        ctx.textAlign = 'right';
        for (let i = 0; i <= hLines; i++) {
            const y = pad.top + (i / hLines) * chartH;
            const val = yMax - (i / hLines) * (yMax - yMin);
            ctx.fillText(this._fmtNum(val), pad.left - 4, y + 3);
        }

        // Draw lines + dots
        for (const s of series) {
            const color = this._colorForPath(s.path);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < s.points.length; i++) {
                const p = s.points[i];
                const x = pad.left + ((p.lvl - 1) / (maxLevel - 1 || 1)) * chartW;
                const y = pad.top + ((yMax - p.val) / (yMax - yMin)) * chartH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Dots
            ctx.fillStyle = color;
            for (const p of s.points) {
                const x = pad.left + ((p.lvl - 1) / (maxLevel - 1 || 1)) * chartW;
                const y = pad.top + ((yMax - p.val) / (yMax - yMin)) * chartH;
                ctx.beginPath();
                ctx.arc(x, y, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Legend
        this.legendEl.textContent = '';
        for (const s of series) {
            const item = document.createElement('span');
            item.className = 'pug-legend-item';
            const swatch = document.createElement('span');
            swatch.className = 'pug-legend-swatch';
            swatch.style.background = this._colorForPath(s.path);
            item.appendChild(swatch);
            const label = document.createElement('span');
            label.textContent = s.path + ' (' + s.type + ')';
            item.appendChild(label);
            this.legendEl.appendChild(item);
        }
    }

    // ----------------------------------------------------------------
    // 2. DPS impact bar chart
    // ----------------------------------------------------------------

    drawDPSBars(modifiers, maxLevel) {
        const ctx = this.barCtx;
        const W = this.barCanvas.width;
        const H = this.barCanvas.height;
        const pad = { top: 12, bottom: 20, left: 48, right: 16 };

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#12122a';
        ctx.fillRect(0, 0, W, H);

        const playerDPS = this.getPlayerDPS();
        const playerDamage = this.getPlayerDamage();

        // Calculate DPS change at each level
        const impacts = [];
        for (let lvl = 1; lvl <= maxLevel; lvl++) {
            let dps = 0;
            for (const mod of modifiers) {
                const val = mod.value * lvl;
                const path = mod.path || '';
                if (path.includes('Damage') || path.includes('damage')) {
                    dps += (mod.type === 'add')
                        ? (val / playerDamage) * playerDPS
                        : playerDPS * Math.abs(val);
                } else if (path.includes('Interval') || path.includes('attackSpeed') || path.includes('interval')) {
                    dps += playerDPS * Math.abs(val);
                } else if (path.includes('Count') || path.includes('count') || path.includes('projectile')) {
                    dps += playerDPS * 0.25 * lvl;
                }
            }
            impacts.push(dps);
        }

        if (impacts.every(v => v === 0)) {
            ctx.fillStyle = '#666';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No measurable DPS impact (defensive/utility)', W / 2, H / 2);
            return;
        }

        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;
        const maxDPS = Math.max(...impacts, 0.1);
        const barWidth = chartW / maxLevel - 4;

        for (let i = 0; i < impacts.length; i++) {
            const dps = impacts[i];
            const barH = (dps / maxDPS) * chartH;
            const x = pad.left + i * (chartW / maxLevel) + 2;
            const y = pad.top + chartH - barH;

            // Color gradient green -> red
            const ratio = Math.min(dps / maxDPS, 1);
            const r = Math.floor(60 + ratio * 195);
            const g = Math.floor(200 - ratio * 150);
            ctx.fillStyle = 'rgb(' + r + ',' + g + ',60)';
            ctx.fillRect(x, y, barWidth, barH);

            // Value label above bar
            ctx.fillStyle = '#ccc';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('+' + dps.toFixed(1), x + barWidth / 2, y - 3);
        }

        // X axis labels
        ctx.fillStyle = '#888';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < maxLevel; i++) {
            const x = pad.left + i * (chartW / maxLevel) + 2 + barWidth / 2;
            ctx.fillText('Lv' + (i + 1), x, H - 4);
        }

        // Y axis
        ctx.textAlign = 'right';
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
            const val = (i / steps) * maxDPS;
            const y = pad.top + chartH - (i / steps) * chartH;
            ctx.fillStyle = '#555';
            ctx.fillText('+' + val.toFixed(0), pad.left - 4, y + 3);
            ctx.strokeStyle = '#1e1e3e';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + chartW, y);
            ctx.stroke();
        }
    }

    // ----------------------------------------------------------------
    // 3. Stack simulator
    // ----------------------------------------------------------------

    buildSimulator(currentBp) {
        this.simControls.textContent = '';
        this.simResults.textContent = '';
        this.simSlots = [];

        // Current powerup is always the first slot
        const currentId = currentBp.id || 'powerup.unknown';
        const currentMax = currentBp.stats?.maxLevel || 5;

        this._addSimSlot(currentId, currentMax, true);

        // Add button for more slots (up to 3 total)
        const addBtn = document.createElement('button');
        addBtn.className = 'pug-sim-add-btn';
        addBtn.textContent = '+ Add Power-up';
        addBtn.addEventListener('click', () => {
            if (this.simSlots.length >= 3) return;
            this._showSimDropdown(addBtn);
        });
        this.simControls.appendChild(addBtn);

        this._updateSimResults();
    }

    _addSimSlot(id, maxLevel, locked) {
        const slot = document.createElement('div');
        slot.className = 'pug-sim-slot';

        const labelRow = document.createElement('div');
        labelRow.className = 'pug-sim-slot-header';

        const nameEl = document.createElement('span');
        nameEl.className = 'pug-sim-slot-name';
        nameEl.textContent = id;
        labelRow.appendChild(nameEl);

        if (!locked) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'pug-sim-remove-btn';
            removeBtn.textContent = '\u00D7';
            removeBtn.addEventListener('click', () => {
                const idx = this.simSlots.findIndex(s => s.el === slot);
                if (idx >= 0) this.simSlots.splice(idx, 1);
                slot.parentNode.removeChild(slot);
                this._updateSimResults();
            });
            labelRow.appendChild(removeBtn);
        }
        slot.appendChild(labelRow);

        // Slider row
        const sliderRow = document.createElement('div');
        sliderRow.className = 'pug-sim-slider-row';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = String(maxLevel);
        slider.value = '1';
        slider.className = 'pug-sim-slider';

        const valDisplay = document.createElement('span');
        valDisplay.className = 'pug-sim-slider-val';
        valDisplay.textContent = 'Lv1';

        slider.addEventListener('input', () => {
            valDisplay.textContent = 'Lv' + slider.value;
            const entry = this.simSlots.find(s => s.el === slot);
            if (entry) entry.level = parseInt(slider.value);
            this._updateSimResults();
        });

        sliderRow.appendChild(slider);
        sliderRow.appendChild(valDisplay);
        slot.appendChild(sliderRow);

        // Insert before add button
        const addBtn = this.simControls.querySelector('.pug-sim-add-btn');
        if (addBtn) {
            this.simControls.insertBefore(slot, addBtn);
        } else {
            this.simControls.appendChild(slot);
        }

        this.simSlots.push({ id, maxLevel, level: 1, el: slot });
    }

    _showSimDropdown(anchorBtn) {
        // Remove existing dropdown if any
        const existing = this.simControls.querySelector('.pug-sim-dropdown');
        if (existing) existing.parentNode.removeChild(existing);

        const dropdown = document.createElement('div');
        dropdown.className = 'pug-sim-dropdown';

        const currentId = this.currentBlueprint?.id;
        const alreadySelected = new Set(this.simSlots.map(s => s.id));

        // Gather powerup data from loaded blueprints via cache
        const powerupIds = this._getAvailablePowerupIds().filter(id => !alreadySelected.has(id));

        if (powerupIds.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'pug-sim-dropdown-empty';
            empty.textContent = 'No more power-ups available';
            dropdown.appendChild(empty);
        } else {
            for (const pid of powerupIds) {
                const item = document.createElement('div');
                item.className = 'pug-sim-dropdown-item';
                item.textContent = pid;
                item.addEventListener('click', () => {
                    dropdown.parentNode.removeChild(dropdown);
                    this._loadAndAddSimSlot(pid);
                });
                dropdown.appendChild(item);
            }
        }

        anchorBtn.parentNode.insertBefore(dropdown, anchorBtn.nextSibling);

        // Close on outside click
        const closeHandler = (e) => {
            if (!dropdown.contains(e.target) && e.target !== anchorBtn) {
                if (dropdown.parentNode) dropdown.parentNode.removeChild(dropdown);
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    _getAvailablePowerupIds() {
        // Try to get from allPowerups list (populated by blueprints:loaded)
        if (this.allPowerups.length > 0) {
            return this.allPowerups.map(b => b.id || b.path || '').filter(Boolean);
        }
        // Fallback: try dataManager cache
        if (this.editor.dataManager?.blueprintCache) {
            const ids = [];
            for (const [key, bp] of this.editor.dataManager.blueprintCache) {
                if (bp.type === 'powerup' || (bp.id && bp.id.startsWith('powerup.'))) {
                    ids.push(bp.id || key);
                }
            }
            return ids;
        }
        return [];
    }

    async _loadAndAddSimSlot(id) {
        // Try cache first
        let bp = null;
        if (this.editor.dataManager?.blueprintCache) {
            bp = this.editor.dataManager.blueprintCache.get(id);
        }
        if (!bp) {
            // Try to load via fetch
            const guessPath = '../data/blueprints/powerup/' + id.replace(/\./g, '_') + '.json5';
            try {
                const resp = await fetch(guessPath);
                if (resp.ok) {
                    const text = await resp.text();
                    bp = typeof JSON5 !== 'undefined' ? JSON5.parse(text) : JSON.parse(text);
                    // Cache it
                    if (this.editor.dataManager?.blueprintCache) {
                        this.editor.dataManager.blueprintCache.set(id, bp);
                    }
                }
            } catch (e) {
                console.warn('PowerupGraph: Could not load', id, e);
            }
        }

        const maxLevel = bp?.stats?.maxLevel || 5;
        this._addSimSlot(id, maxLevel, false);
        this._updateSimResults();
    }

    _updateSimResults() {
        this.simResults.textContent = '';

        let totalDPS = 0;
        let totalHPBonus = 0;
        let totalSpeedBonus = 0;

        const playerDPS = this.getPlayerDPS();
        const playerDamage = this.getPlayerDamage();

        for (const slot of this.simSlots) {
            const bp = this._getBlueprintForId(slot.id);
            if (!bp) continue;
            const mods = bp.mechanics?.modifiersPerLevel || [];
            const lvl = slot.level;

            for (const mod of mods) {
                const val = mod.value * lvl;
                const path = mod.path || '';

                if (path.includes('Damage') || path.includes('damage')) {
                    totalDPS += (mod.type === 'add')
                        ? (val / playerDamage) * playerDPS
                        : playerDPS * Math.abs(val);
                } else if (path.includes('Interval') || path.includes('attackSpeed') || path.includes('interval')) {
                    totalDPS += playerDPS * Math.abs(val);
                } else if (path.includes('Count') || path.includes('count') || path.includes('projectile')) {
                    totalDPS += playerDPS * 0.25 * lvl;
                } else if (path.includes('shield') || path.includes('Shield') || path.includes('hp') || path.includes('HP')) {
                    totalHPBonus += Math.abs(val);
                } else if (path.includes('Speed') || path.includes('speed') || path.includes('move')) {
                    totalSpeedBonus += val * 100;
                }
            }

            // Check ability-based contributions
            if (bp.ability) {
                if (bp.ability.baseShieldHP) {
                    totalHPBonus += bp.ability.baseShieldHP * lvl;
                }
                if (bp.ability.baseDamage && bp.ability.damagePerLevel) {
                    const abilityDmg = bp.ability.baseDamage + bp.ability.damagePerLevel * (lvl - 1);
                    const interval = (bp.ability.interval || 1500) / 1000;
                    totalDPS += abilityDmg / interval;
                }
            }
        }

        // Build result cards
        const grid = document.createElement('div');
        grid.className = 'pug-sim-result-grid';

        grid.appendChild(this._resultCard(
            '+' + totalDPS.toFixed(1),
            'Total DPS',
            '(+' + ((totalDPS / playerDPS) * 100).toFixed(0) + '%)'
        ));
        grid.appendChild(this._resultCard(
            '+' + totalHPBonus.toFixed(0),
            'HP/Shield',
            ''
        ));
        grid.appendChild(this._resultCard(
            (totalSpeedBonus >= 0 ? '+' : '') + totalSpeedBonus.toFixed(0) + '%',
            'Speed',
            ''
        ));

        this.simResults.appendChild(grid);
    }

    _getBlueprintForId(id) {
        if (this.currentBlueprint?.id === id) return this.currentBlueprint;
        if (this.editor.dataManager?.blueprintCache) {
            return this.editor.dataManager.blueprintCache.get(id) || null;
        }
        return null;
    }

    _resultCard(value, label, sub) {
        const card = document.createElement('div');
        card.className = 'pug-sim-result-card';
        const valEl = document.createElement('div');
        valEl.className = 'pug-sim-result-value';
        valEl.textContent = value;
        card.appendChild(valEl);
        const labEl = document.createElement('div');
        labEl.className = 'pug-sim-result-label';
        labEl.textContent = label;
        card.appendChild(labEl);
        if (sub) {
            const subEl = document.createElement('div');
            subEl.className = 'pug-sim-result-sub';
            subEl.textContent = sub;
            card.appendChild(subEl);
        }
        return card;
    }

    // ----------------------------------------------------------------
    // 4. Comparison mode
    // ----------------------------------------------------------------

    buildComparison(currentBp) {
        this.compBar.textContent = '';

        const playerDPS = this.getPlayerDPS();
        const playerDamage = this.getPlayerDamage();
        const modifiers = currentBp.mechanics?.modifiersPerLevel || [];

        // DPS impact of current at level 1
        const currentDPS = this._calcDPSImpact(modifiers, 1, currentBp, playerDPS, playerDamage);

        // Calculate average DPS impact across all known powerups
        let totalAvg = 0;
        let avgCount = 0;
        const allIds = this._getAvailablePowerupIds();
        for (const pid of allIds) {
            const bp = this._getBlueprintForId(pid);
            if (!bp || bp.id === currentBp.id) continue;
            const mods = bp.mechanics?.modifiersPerLevel || [];
            const dps = this._calcDPSImpact(mods, 1, bp, playerDPS, playerDamage);
            totalAvg += dps;
            avgCount++;
        }

        const avgDPS = avgCount > 0 ? totalAvg / avgCount : 0;

        if (avgDPS === 0 && currentDPS === 0) {
            const note = document.createElement('div');
            note.className = 'pug-comp-note';
            note.textContent = 'No DPS data available for comparison (load more powerups to enable)';
            this.compBar.appendChild(note);
            return;
        }

        const maxVal = Math.max(currentDPS, avgDPS, 0.1);

        // Current bar
        this.compBar.appendChild(this._compBarRow(
            'This', currentDPS, maxVal, '#4CAF50'));
        // Average bar
        this.compBar.appendChild(this._compBarRow(
            'Avg', avgDPS, maxVal, '#666'));
    }

    _compBarRow(label, value, max, color) {
        const row = document.createElement('div');
        row.className = 'pug-comp-row';

        const labelEl = document.createElement('span');
        labelEl.className = 'pug-comp-label';
        labelEl.textContent = label;
        row.appendChild(labelEl);

        const barOuter = document.createElement('div');
        barOuter.className = 'pug-comp-bar-outer';

        const barInner = document.createElement('div');
        barInner.className = 'pug-comp-bar-inner';
        const pct = max > 0 ? (value / max) * 100 : 0;
        barInner.style.width = pct + '%';
        barInner.style.background = color;
        barOuter.appendChild(barInner);
        row.appendChild(barOuter);

        const valEl = document.createElement('span');
        valEl.className = 'pug-comp-value';
        valEl.textContent = '+' + value.toFixed(1) + ' DPS';
        row.appendChild(valEl);

        return row;
    }

    _calcDPSImpact(modifiers, level, bp, playerDPS, playerDamage) {
        let dps = 0;
        for (const mod of modifiers) {
            const val = mod.value * level;
            const path = mod.path || '';
            if (path.includes('Damage') || path.includes('damage')) {
                dps += (mod.type === 'add')
                    ? (val / playerDamage) * playerDPS
                    : playerDPS * Math.abs(val);
            } else if (path.includes('Interval') || path.includes('attackSpeed') || path.includes('interval')) {
                dps += playerDPS * Math.abs(val);
            } else if (path.includes('Count') || path.includes('count') || path.includes('projectile')) {
                dps += playerDPS * 0.25 * level;
            }
        }
        // Ability-based DPS
        if (bp?.ability?.baseDamage) {
            const abilityDmg = bp.ability.baseDamage + (bp.ability.damagePerLevel || 0) * (level - 1);
            const interval = (bp.ability.interval || 1500) / 1000;
            dps += abilityDmg / interval;
        }
        return dps;
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    _colorForPath(path) {
        for (const [key, color] of Object.entries(this.PATH_COLORS)) {
            if (key === 'default') continue;
            if (path.toLowerCase().includes(key.toLowerCase())) return color;
        }
        return this.PATH_COLORS.default;
    }

    _fmtNum(val) {
        if (Math.abs(val) >= 100) return val.toFixed(0);
        if (Math.abs(val) >= 1) return val.toFixed(1);
        return val.toFixed(2);
    }
}

export default PowerupGraph;
