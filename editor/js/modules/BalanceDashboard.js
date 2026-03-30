/**
 * BalanceDashboard.js - Balance metrics panel for Blueprint Editor
 * Shows DPS/TTK calculations, spawn intensity, and balance warnings
 * for any loaded blueprint type.
 *
 * All data comes from trusted local blueprint JSON5 files.
 * This is a local developer tool, not a web-facing application.
 */

export class BalanceDashboard {
    constructor(editor) {
        this.editor = editor;
        this.currentBlueprint = null;
        this.mainConfig = null;
        this.playerConfig = null;
        this.container = null;
        this.canvas = null;
        this.ctx = null;

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

        await this.loadConfigs();
        this._configsReady = true;
        if (this._pendingUpdate && this.currentBlueprint) {
            this._pendingUpdate = false;
            this.update();
        }
    }

    // ----------------------------------------------------------------
    // DOM construction (safe — all content is from local config files)
    // ----------------------------------------------------------------

    createDOM() {
        const previewContent = document.querySelector('#panel-preview .panel-content');
        if (!previewContent) return;

        this.container = document.createElement('div');
        this.container.id = 'balance-dashboard';
        this.container.className = 'balance-dashboard';

        // Build header
        const header = document.createElement('div');
        header.className = 'balance-header';

        const title = document.createElement('h3');
        title.textContent = 'Balance Dashboard';
        header.appendChild(title);

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'btn-toggle-balance';
        toggleBtn.className = 'btn-balance-toggle';
        toggleBtn.title = 'Toggle';
        toggleBtn.textContent = '\u25BC';
        header.appendChild(toggleBtn);

        this.container.appendChild(header);

        // Build body
        const body = document.createElement('div');
        body.className = 'balance-body';

        const metrics = document.createElement('div');
        metrics.className = 'balance-metrics';
        metrics.id = 'balance-metrics';
        const placeholder = document.createElement('div');
        placeholder.className = 'balance-placeholder';
        placeholder.textContent = 'Load a blueprint to see balance metrics';
        metrics.appendChild(placeholder);
        body.appendChild(metrics);

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'balance-chart';
        this.canvas.width = 320;
        this.canvas.height = 120;
        this.canvas.style.display = 'none';
        body.appendChild(this.canvas);

        const warnings = document.createElement('div');
        warnings.className = 'balance-warnings';
        warnings.id = 'balance-warnings';
        body.appendChild(warnings);

        const simSection = document.createElement('div');
        simSection.className = 'balance-sim-placeholder';
        simSection.id = 'balance-sim-section';

        const simBtn = document.createElement('button');
        simBtn.className = 'btn-sim-placeholder';
        simBtn.disabled = true;
        simBtn.textContent = 'Run Quick Sim (50 runs)';
        simSection.appendChild(simBtn);

        const simNote = document.createElement('span');
        simNote.className = 'sim-note';
        simNote.textContent = '(Requires editor server with sim endpoint)';
        simSection.appendChild(simNote);

        body.appendChild(simSection);
        this.container.appendChild(body);

        previewContent.appendChild(this.container);

        this.ctx = this.canvas.getContext('2d');

        // Toggle collapse
        toggleBtn.addEventListener('click', () => {
            const collapsed = body.style.display === 'none';
            body.style.display = collapsed ? 'block' : 'none';
            toggleBtn.textContent = collapsed ? '\u25BC' : '\u25B6';
        });
    }

    async loadConfigs() {
        try {
            const resp = await fetch('../data/config/main_config.json5');
            if (resp.ok) {
                const text = await resp.text();
                this.mainConfig = typeof JSON5 !== 'undefined'
                    ? JSON5.parse(text)
                    : JSON.parse(text);
            }
        } catch (e) {
            console.warn('BalanceDashboard: Failed to load main_config.json5', e);
        }

        try {
            const resp = await fetch('../data/blueprints/player/player.json5');
            if (resp.ok) {
                const text = await resp.text();
                this.playerConfig = typeof JSON5 !== 'undefined'
                    ? JSON5.parse(text)
                    : JSON.parse(text);
            }
        } catch (e) {
            console.warn('BalanceDashboard: Failed to load player.json5', e);
        }
    }

    // ----------------------------------------------------------------
    // Player stat helpers
    // ----------------------------------------------------------------

    getPlayerDPS() {
        const p = this.playerConfig;
        const mc = this.mainConfig;
        if (!p) return 30; // fallback

        const damage = p.mechanics?.projectile?.stats?.damage
            || p.mechanics?.attack?.damageBase
            || mc?.playerConfig?.projectile?.baseDamage || 15;
        const interval = p.mechanics?.attack?.intervalMs
            || mc?.playerConfig?.projectile?.baseInterval || 1000;
        const count = p.mechanics?.projectile?.count || 4;
        // 4-directional base: ~30% hit rate (from balance-sim.mjs)
        const hitRate = 0.3;
        return Math.max(damage * count * (1000 / interval) * hitRate, 0.1);
    }

    getPlayerHP() {
        return this.playerConfig?.stats?.hp
            || this.mainConfig?.mechanics?.health?.base || 100;
    }

    // ----------------------------------------------------------------
    // Router
    // ----------------------------------------------------------------

    update() {
        const bp = this.currentBlueprint;
        if (!bp) return;

        const metricsEl = this.container.querySelector('#balance-metrics');
        const warningsEl = this.container.querySelector('#balance-warnings');
        this.canvas.style.display = 'none';
        warningsEl.textContent = '';

        const type = this.detectType(bp);

        switch (type) {
            case 'spawn':
                this.renderSpawnMetrics(bp, metricsEl, warningsEl);
                break;
            case 'enemy':
            case 'elite':
            case 'unique':
                this.renderEnemyMetrics(bp, metricsEl, warningsEl);
                break;
            case 'boss':
                this.renderBossMetrics(bp, metricsEl, warningsEl);
                break;
            case 'powerup':
                this.renderPowerupMetrics(bp, metricsEl, warningsEl);
                break;
            default:
                this._clearAndSetPlaceholder(metricsEl, `No balance view for type "${type}"`);
        }
    }

    detectType(bp) {
        if (bp.enemyWaves || bp.bossTriggers) return 'spawn';
        if (bp.type && bp.type !== 'enemy') return bp.type;
        const id = bp.id || '';
        if (id.startsWith('boss.')) return 'boss';
        if (id.startsWith('elite.')) return 'elite';
        if (id.startsWith('unique.')) return 'unique';
        if (id.startsWith('enemy.')) return 'enemy';
        if (id.startsWith('powerup.')) return 'powerup';
        return bp.type || 'unknown';
    }

    // ================================================================
    // DOM helpers — safe element creation from trusted local data
    // ================================================================

    _clearAndSetPlaceholder(el, text) {
        el.textContent = '';
        const div = document.createElement('div');
        div.className = 'balance-placeholder';
        div.textContent = text;
        el.appendChild(div);
    }

    _createMetricCard(value, label, accent) {
        const card = document.createElement('div');
        card.className = 'balance-metric-card' + (accent ? ' accent' : '');
        const valEl = document.createElement('div');
        valEl.className = 'metric-value';
        valEl.textContent = value;
        const labEl = document.createElement('div');
        labEl.className = 'metric-label';
        labEl.textContent = label;
        card.appendChild(valEl);
        card.appendChild(labEl);
        return card;
    }

    _createMetricRow(label, value, badgeType) {
        const row = document.createElement('div');
        row.className = 'balance-metric-row';
        const text = document.createTextNode(label + ' ');
        row.appendChild(text);
        const strong = document.createElement('strong');
        strong.textContent = value;
        row.appendChild(strong);
        if (badgeType) {
            const badge = document.createElement('span');
            badge.className = badgeType === 'warn' ? 'badge-warn' : 'badge-ok';
            badge.textContent = badgeType === 'warn' ? ' Exceeds player DPS' : ' OK';
            row.appendChild(badge);
        }
        return row;
    }

    _createWarningItem(text) {
        const div = document.createElement('div');
        div.className = 'balance-warning-item';
        div.textContent = '\u26A0 ' + text;
        return div;
    }

    _createOkItem() {
        const div = document.createElement('div');
        div.className = 'balance-ok-item';
        div.textContent = '\u2705 Balanced';
        return div;
    }

    // ================================================================
    // 1. SPAWN TABLE METRICS
    // ================================================================

    renderSpawnMetrics(bp, metricsEl, warningsEl) {
        const diff = bp.difficulty || {};
        const prog = diff.progressiveScaling || {};
        const waves = bp.enemyWaves || [];
        const playerDPS = this.getPlayerDPS();

        // Sample spawn intensity at 10s intervals up to 120s
        const maxT = 120;
        const step = 10;
        const timeline = [];
        const warnings = [];

        for (let t = 0; t <= maxT; t += step) {
            const tMs = t * 1000;
            const hpMul = (diff.enemyHpMultiplier || 1) + (prog.hpGrowth || 0) * t;
            const dmgMul = (diff.enemyDamageMultiplier || 1) + (prog.damageGrowth || 0) * t;

            let spawnPerSec = 0;
            let avgHp = 0;
            let avgDmg = 0;
            let waveCount = 0;

            for (const wave of waves) {
                if (tMs < (wave.startAt || 0) || tMs > (wave.endAt || 999999)) continue;
                const interval = (wave.interval || 3000) / 1000;
                const weight = (wave.weight || 50) / 100;
                const count = wave.countRange
                    ? (wave.countRange[0] + wave.countRange[1]) / 2
                    : 1;
                spawnPerSec += (count * weight) / interval;

                const enemyHp = this.getEnemyHpById(wave.enemyId) || 30;
                const enemyDmg = this.getEnemyDmgById(wave.enemyId) || 10;
                avgHp += enemyHp;
                avgDmg += enemyDmg;
                waveCount++;
            }

            if (waveCount > 0) {
                avgHp = (avgHp / waveCount) * hpMul;
                avgDmg = (avgDmg / waveCount) * dmgMul;
            }

            const totalHpPerSec = spawnPerSec * avgHp;
            const ttk = avgHp > 0 ? avgHp / playerDPS : 0;
            // ~1.5% of spawned enemies deal contact damage per second (empirical from balance-sim runs)
            const incomingDps = spawnPerSec * avgDmg * 0.015;

            timeline.push({ t, spawnPerSec, totalHpPerSec, ttk, incomingDps, hpMul });

            if (ttk > 5 && spawnPerSec > 0) {
                warnings.push('TTK exceeds 5s at ' + t + 's (' + ttk.toFixed(1) + 's)');
            }
        }

        // Find peaks
        const peakSpawn = timeline.reduce((mx, p) => p.spawnPerSec > mx.spawnPerSec ? p : mx, timeline[0]);
        const peakTTK = timeline.reduce((mx, p) => p.ttk > mx.ttk ? p : mx, timeline[0]);
        const playerHP = this.getPlayerHP();
        const peakIncoming = timeline.reduce((mx, p) => p.incomingDps > mx.incomingDps ? p : mx, timeline[0]);
        const survivalEst = peakIncoming.incomingDps > 0
            ? playerHP / peakIncoming.incomingDps
            : Infinity;

        // Build DOM
        metricsEl.textContent = '';

        const grid = document.createElement('div');
        grid.className = 'balance-metric-grid';
        grid.appendChild(this._createMetricCard(playerDPS.toFixed(1), 'Player DPS'));
        grid.appendChild(this._createMetricCard(peakSpawn.spawnPerSec.toFixed(1) + '/s', 'Peak spawn rate'));
        grid.appendChild(this._createMetricCard(peakTTK.ttk.toFixed(1) + 's', 'Peak TTK'));
        grid.appendChild(this._createMetricCard(
            survivalEst < 9999 ? survivalEst.toFixed(0) + 's' : 'Safe',
            'Est. survival'
        ));
        metricsEl.appendChild(grid);

        const details = document.createElement('div');
        details.className = 'balance-detail-section';
        const dpsNeeded = peakSpawn.totalHpPerSec;
        details.appendChild(this._createMetricRow(
            'DPS needed at peak:',
            dpsNeeded.toFixed(1),
            dpsNeeded > playerDPS ? 'warn' : 'ok'
        ));

        const hpMulAt90 = (diff.enemyHpMultiplier || 1) + (prog.hpGrowth || 0) * 90;
        details.appendChild(this._createMetricRow('HP multiplier at 90s:', hpMulAt90.toFixed(2) + 'x'));

        // Boss triggers
        for (const trigger of (bp.bossTriggers || [])) {
            const when = trigger.condition === 'time'
                ? (trigger.value / 1000).toFixed(0) + 's'
                : trigger.value + ' kills';
            details.appendChild(this._createMetricRow('Boss: ' + trigger.bossId, 'at ' + when));
        }

        metricsEl.appendChild(details);

        // Draw chart
        this.drawSpawnChart(timeline);

        // Warnings
        this.renderWarnings(warningsEl, warnings);
    }

    drawSpawnChart(timeline) {
        if (!timeline.length) return;
        this.canvas.style.display = 'block';
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, W, H);

        const maxSpawn = Math.max(...timeline.map(p => p.spawnPerSec), 0.1);
        const maxTTK = Math.max(...timeline.map(p => p.ttk), 0.1);
        const pad = { top: 12, bottom: 20, left: 8, right: 8 };
        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;
        const barW = chartW / timeline.length - 2;

        // Bars: spawn rate, color-coded by TTK
        for (let i = 0; i < timeline.length; i++) {
            const p = timeline[i];
            const x = pad.left + i * (chartW / timeline.length);
            const barH = (p.spawnPerSec / maxSpawn) * chartH;
            const y = pad.top + chartH - barH;
            const ttkRatio = Math.min(p.ttk / 5, 1);
            const r = Math.floor(ttkRatio * 255);
            const g = Math.floor((1 - ttkRatio) * 200);
            ctx.fillStyle = 'rgb(' + r + ',' + g + ',60)';
            ctx.fillRect(x + 1, y, barW, barH);
        }

        // TTK line overlay
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        for (let i = 0; i < timeline.length; i++) {
            const p = timeline[i];
            const x = pad.left + i * (chartW / timeline.length) + barW / 2;
            const y = pad.top + chartH - (p.ttk / maxTTK) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Axis labels
        ctx.fillStyle = '#888';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < timeline.length; i += 2) {
            const x = pad.left + i * (chartW / timeline.length) + barW / 2;
            ctx.fillText(timeline[i].t + 's', x, H - 4);
        }

        // Legend
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(pad.left, 2, 8, 8);
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'left';
        ctx.fillText('Spawn/s', pad.left + 12, 9);

        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(pad.left + 80, 6);
        ctx.lineTo(pad.left + 96, 6);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#aaa';
        ctx.fillText('TTK', pad.left + 100, 9);
    }

    // ================================================================
    // 2. ENEMY METRICS
    // ================================================================

    renderEnemyMetrics(bp, metricsEl, warningsEl) {
        const hp = bp.stats?.hp || bp.stats?.maxHp || 30;
        const damage = bp.stats?.damage || bp.stats?.contactDamage || bp.mechanics?.contactDamage || 10;
        const xp = bp.stats?.xp || bp.loot?.xp || 3;
        const armor = bp.stats?.armor || 0;
        const speed = bp.stats?.speed || bp.stats?.moveSpeed || 80;
        const playerDPS = this.getPlayerDPS();
        const playerHP = this.getPlayerHP();

        const effectiveHp = hp + armor * 2;
        const ttk = effectiveHp / playerDPS;
        const hitsToKillPlayer = Math.ceil(playerHP / damage);

        const avgEnemyHp = 25;
        const avgEnemyDmg = 10;
        const hardnessRatio = (effectiveHp / avgEnemyHp + damage / avgEnemyDmg) / 2;

        const warnings = [];
        if (ttk > 5) warnings.push('TTK is high (' + ttk.toFixed(1) + 's) -- may feel spongy');
        if (ttk < 0.3) warnings.push('TTK is very low (' + ttk.toFixed(1) + 's) -- dies instantly');
        if (hitsToKillPlayer < 3) warnings.push('Kills player in ' + hitsToKillPlayer + ' hits -- very deadly');
        if (xp < 1) warnings.push('XP reward is 0 -- player gets nothing');

        metricsEl.textContent = '';

        const grid = document.createElement('div');
        grid.className = 'balance-metric-grid';
        grid.appendChild(this._createMetricCard(ttk.toFixed(1) + 's', 'Time to kill'));
        grid.appendChild(this._createMetricCard(String(hitsToKillPlayer), 'Hits to kill player'));
        grid.appendChild(this._createMetricCard(String(xp), 'XP reward'));
        grid.appendChild(this._createMetricCard(hardnessRatio.toFixed(1) + 'x', 'vs avg L1 enemy'));
        metricsEl.appendChild(grid);

        const details = document.createElement('div');
        details.className = 'balance-detail-section';
        details.appendChild(this._createMetricRow('Effective HP:', effectiveHp + ' (' + hp + ' HP + ' + armor + ' armor)'));
        details.appendChild(this._createMetricRow('Contact damage:', String(damage)));
        details.appendChild(this._createMetricRow('Speed:', String(speed)));
        details.appendChild(this._createMetricRow('Player DPS:', playerDPS.toFixed(1)));
        metricsEl.appendChild(details);

        this.renderWarnings(warningsEl, warnings);
    }

    // ================================================================
    // 3. BOSS METRICS
    // ================================================================

    renderBossMetrics(bp, metricsEl, warningsEl) {
        const hp = bp.stats?.hp || bp.stats?.maxHp || 1000;
        const damage = bp.stats?.damage || 20;
        const armor = bp.stats?.armor || 0;
        const playerDPS = this.getPlayerDPS();

        const effectiveHp = hp + armor * 5;
        const fightDuration = effectiveHp / playerDPS;

        const phases = bp.mechanics?.phases || [];
        const warnings = [];
        if (fightDuration > 120) warnings.push('Fight lasts ' + fightDuration.toFixed(0) + 's -- may be tedious');
        if (fightDuration < 15) warnings.push('Fight lasts only ' + fightDuration.toFixed(0) + 's -- too easy?');

        metricsEl.textContent = '';

        const grid = document.createElement('div');
        grid.className = 'balance-metric-grid';
        grid.appendChild(this._createMetricCard(fightDuration.toFixed(0) + 's', 'Fight duration', true));
        grid.appendChild(this._createMetricCard(String(hp), 'Total HP'));
        grid.appendChild(this._createMetricCard(String(phases.length), 'Phases'));
        grid.appendChild(this._createMetricCard(String(damage), 'Damage'));
        metricsEl.appendChild(grid);

        const details = document.createElement('div');
        details.className = 'balance-detail-section';

        const titleRow = document.createElement('div');
        titleRow.className = 'balance-section-title';
        titleRow.textContent = 'Phase Timeline (base player DPS: ' + playerDPS.toFixed(1) + ')';
        details.appendChild(titleRow);

        let cumulativeTime = 0;
        for (let i = 0; i < phases.length; i++) {
            const phase = phases[i];
            const threshold = phase.thresholdPct || phase.hpThreshold || (1 - i * 0.3);
            const nextThreshold = phases[i + 1]?.thresholdPct || phases[i + 1]?.hpThreshold || 0;
            const phaseHp = (threshold - nextThreshold) * hp;
            const phaseDuration = phaseHp / playerDPS;
            cumulativeTime += phaseDuration;
            const abilities = (phase.abilities || []).join(', ');

            const row = document.createElement('div');
            row.className = 'balance-metric-row phase-row';
            row.textContent = 'Phase ' + (i + 1) + ' (' + (threshold * 100).toFixed(0) + '%): '
                + phaseDuration.toFixed(0) + 's (at ~' + cumulativeTime.toFixed(0) + 's) -- ' + (abilities || 'none');
            details.appendChild(row);
        }

        metricsEl.appendChild(details);

        this.drawBossTimeline(phases, hp, playerDPS);
        this.renderWarnings(warningsEl, warnings);
    }

    drawBossTimeline(phases, totalHp, playerDPS) {
        if (!phases.length) return;
        this.canvas.style.display = 'block';
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, W, H);

        const totalDuration = totalHp / playerDPS;
        const pad = { left: 8, right: 8, top: 20, bottom: 16 };
        const barH = 24;
        const barY = pad.top + 10;
        const barW = W - pad.left - pad.right;

        const colors = ['#4CAF50', '#FF9800', '#f44336', '#9C27B0', '#2196F3'];
        let xOffset = pad.left;

        for (let i = 0; i < phases.length; i++) {
            const threshold = phases[i].thresholdPct || phases[i].hpThreshold || (1 - i * 0.3);
            const nextThreshold = phases[i + 1]?.thresholdPct || phases[i + 1]?.hpThreshold || 0;
            const phaseHpPct = threshold - nextThreshold;
            const segW = phaseHpPct * barW;

            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(xOffset, barY, segW, barH);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            if (segW > 30) {
                ctx.fillText('P' + (i + 1), xOffset + segW / 2, barY + barH / 2 + 4);
            }

            const phaseDuration = (phaseHpPct * totalHp) / playerDPS;
            ctx.fillStyle = '#aaa';
            ctx.font = '9px sans-serif';
            if (segW > 20) {
                ctx.fillText(phaseDuration.toFixed(0) + 's', xOffset + segW / 2, barY + barH + 12);
            }

            xOffset += segW;
        }

        ctx.fillStyle = '#ccc';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Total: ' + totalDuration.toFixed(0) + 's', pad.left, pad.top);
        ctx.textAlign = 'right';
        ctx.fillText(totalHp + ' HP', W - pad.right, pad.top);
    }

    // ================================================================
    // 4. POWERUP METRICS
    // ================================================================

    renderPowerupMetrics(bp, metricsEl, warningsEl) {
        const maxLevel = bp.stats?.maxLevel || 5;
        const modifiers = bp.mechanics?.modifiersPerLevel || [];
        const playerDPS = this.getPlayerDPS();
        const playerDamage = this.playerConfig?.mechanics?.projectile?.stats?.damage || 15;

        const levelImpacts = [];

        for (let lvl = 1; lvl <= maxLevel; lvl++) {
            let dpsChange = 0;
            let description = '';

            for (const mod of modifiers) {
                const val = (mod.value || 0) * lvl;
                const path = mod.path || mod.stat || '';

                if (path.includes('Damage') || path.includes('damage')) {
                    if (mod.type === 'add') {
                        dpsChange = (val / playerDamage) * playerDPS;
                        description = '+' + val + ' damage';
                    } else if (mod.type === 'multiply') {
                        dpsChange = playerDPS * (val - 1);
                        description = 'x' + val + ' damage';
                    }
                } else if (path.includes('attackSpeed') || path.includes('interval') || path.includes('Interval')) {
                    dpsChange = playerDPS * 0.08;
                    description = 'faster attack';
                } else if (path.includes('projectile') || path.includes('count') || path.includes('Count')) {
                    dpsChange = playerDPS * 0.25;
                    description = '+projectile';
                } else if (path.includes('shield') || path.includes('Shield')) {
                    dpsChange = 0;
                    description = '+' + val + ' shield';
                } else {
                    description = mod.type + ' ' + val + ' to ' + path;
                }
            }

            levelImpacts.push({ level: lvl, dpsChange, description });
        }

        const totalDpsAdd = levelImpacts.reduce((s, l) => s + l.dpsChange, 0);
        const pctAtLv1 = levelImpacts[0]?.dpsChange
            ? ((levelImpacts[0].dpsChange / playerDPS) * 100).toFixed(0)
            : '0';
        const pctAtMax = totalDpsAdd
            ? ((totalDpsAdd / playerDPS) * 100).toFixed(0)
            : '0';

        const warnings = [];
        if (totalDpsAdd === 0 && !modifiers.some(m =>
            (m.path || '').includes('shield') || (m.path || '').includes('Shield'))) {
            warnings.push('No detectable DPS impact -- utility/defensive powerup');
        }
        if (Math.abs(parseInt(pctAtMax)) > 200) {
            warnings.push('Extreme DPS impact at max level: +' + pctAtMax + '%');
        }

        metricsEl.textContent = '';

        const grid = document.createElement('div');
        grid.className = 'balance-metric-grid';
        grid.appendChild(this._createMetricCard('+' + pctAtLv1 + '%', 'DPS at Lv1'));
        grid.appendChild(this._createMetricCard('+' + pctAtMax + '%', 'DPS at max', true));
        grid.appendChild(this._createMetricCard(String(maxLevel), 'Max level'));
        grid.appendChild(this._createMetricCard(String(modifiers.length), 'Modifiers'));
        metricsEl.appendChild(grid);

        const details = document.createElement('div');
        details.className = 'balance-detail-section';

        const titleRow = document.createElement('div');
        titleRow.className = 'balance-section-title';
        titleRow.textContent = 'Per-level breakdown (base DPS: ' + playerDPS.toFixed(1) + ')';
        details.appendChild(titleRow);

        for (const l of levelImpacts) {
            const pct = ((l.dpsChange / playerDPS) * 100).toFixed(0);
            const row = document.createElement('div');
            row.className = 'balance-metric-row';
            row.textContent = 'Lv' + l.level + ': +' + l.dpsChange.toFixed(1) + ' DPS (' + pct + '%) -- ' + l.description;
            details.appendChild(row);
        }

        metricsEl.appendChild(details);
        this.renderWarnings(warningsEl, warnings);
    }

    // ================================================================
    // Helpers
    // ================================================================

    renderWarnings(el, warnings) {
        el.textContent = '';
        if (warnings.length > 0) {
            for (const w of warnings) {
                el.appendChild(this._createWarningItem(w));
            }
        } else {
            el.appendChild(this._createOkItem());
        }
    }

    /** Rough lookup for enemy HP by ID from known defaults */
    getEnemyHpById(enemyId) {
        const known = {
            'enemy.necrotic_cell': 20,
            'enemy.viral_swarm': 15,
            'enemy.aberrant_cell': 25,
            'enemy.micro_shooter': 12,
            'enemy.acidic_blob': 30,
            'enemy.metastasis_runner': 18,
            'enemy.fungal_parasite': 22,
            'enemy.support_bacteria': 15,
            'enemy.shielding_helper': 20,
            'enemy.viral_swarm_alpha': 40,
            'elite.tank_cell': 100,
            'elite.speed_virus': 50,
            'elite.artillery_fungus': 60,
        };
        return known[enemyId] || 30;
    }

    getEnemyDmgById(enemyId) {
        const known = {
            'enemy.necrotic_cell': 12,
            'enemy.viral_swarm': 8,
            'enemy.aberrant_cell': 10,
            'enemy.micro_shooter': 6,
            'enemy.acidic_blob': 15,
            'enemy.metastasis_runner': 8,
            'enemy.fungal_parasite': 10,
            'enemy.support_bacteria': 5,
            'enemy.shielding_helper': 6,
            'enemy.viral_swarm_alpha': 15,
            'elite.tank_cell': 20,
            'elite.speed_virus': 12,
            'elite.artillery_fungus': 18,
        };
        return known[enemyId] || 10;
    }
}
