/**
 * VFXPreview.js - Canvas-based VFX particle preview for Blueprint Editor
 * Pure Canvas 2D implementation — no Phaser dependency.
 *
 * Provides:
 *   - Static preset catalog extracted from ParticlePresets.js
 *   - Simple 2D particle simulation (spawn, move, fade, shrink)
 *   - VFX picker dropdown grouped by category
 *   - Standalone preview panel for blueprint VFX fields
 */

// ============================================================
// Static preset catalog (mirrors js/core/vfx/ParticlePresets.js)
// Fields: q=quantity, sp=[min,max] speed, sc=[start,end] scale,
//         life=lifespan(ms), color=default hex, gY/gX=gravity,
//         alpha=[start,end], angle=full 360
// ============================================================
const PRESETS = {
    'hit.small':              { q: 8,  sp: [50,150],   sc: [0.3,0],   life: 200,  color: 0xFFFFFF },
    'hit.medium':             { q: 12, sp: [80,200],   sc: [0.4,0],   life: 300,  color: 0xFFFFFF },
    'hit.large':              { q: 20, sp: [100,300],  sc: [0.6,0],   life: 400,  color: 0xFFFFFF },
    'enemy.hit':              { q: 10, sp: [60,160],   sc: [0.35,0],  life: 250,  color: 0xFF4444 },
    'enemy.shoot':            { q: 3,  sp: [20,50],    sc: [0.3,0],   life: 100,  color: 0xFF4444 },
    'muzzle':                 { q: 5,  sp: [20,60],    sc: [0.4,0],   life: 100,  color: 0xFFFFAA },
    'explosion.small':        { q: 15, sp: [80,180],   sc: [0.4,0],   life: 300,  color: 0xFF6600, angle: true },
    'explosion.medium':       { q: 25, sp: [100,250],  sc: [0.6,0],   life: 400,  color: 0xFF6600, angle: true },
    'explosion.large':        { q: 40, sp: [150,350],  sc: [0.8,0],   life: 500,  color: 0xFF6600, angle: true },
    'death.small':            { q: 10, sp: [60,150],   sc: [0.3,0],   life: 250,  color: 0xFF2222, angle: true, alpha: [1,0] },
    'death.medium':           { q: 20, sp: [100,200],  sc: [0.5,0],   life: 350,  color: 0xFF2222, angle: true, alpha: [1,0] },
    'death.large':            { q: 30, sp: [150,300],  sc: [0.7,0],   life: 450,  color: 0xFF2222, angle: true, alpha: [1,0] },
    'boss.spawn':             { q: 50, sp: [100,300],  sc: [1.2,0],   life: 800,  color: 0xFF0000, angle: true },
    'boss.death':             { q: 40, sp: [150,400],  sc: [1.5,0],   life: 800,  color: 0xFFFF00, angle: true, gY: 50 },
    'boss.phase':             { q: 35, sp: [50,200],   sc: [1.0,0],   life: 600,  color: 0xFF00FF, alpha: [1,0] },
    'boss.special':           { q: 30, sp: [100,250],  sc: [0.8,0],   life: 500,  color: 0xFF8800 },
    'boss.victory':           { q: 30, sp: [150,350],  sc: [0.8,0],   life: 1000, color: 0xFFD700, angle: true, gY: 150 },
    'boss.overload.charge':   { q: 12, sp: [50,150],   sc: [0.1,0.8], life: 2000, color: 0xFF00FF, alpha: [0.3,1.0], gY: -100 },
    'boss.overload.explosion':{ q: 30, sp: [200,500],  sc: [1.5,0],   life: 800,  color: 0xFFFF00, angle: true },
    'boss.radiation.storm':   { q: 20, sp: [100,300],  sc: [0.6,0.1], life: 1500, color: 0x00FF00, alpha: [0.7,0], gX: 50, gY: 50 },
    'boss.radiation.pulse':   { q: 20, sp: [150,300],  sc: [0.1,1.2], life: 600,  color: 0xCCFF00, alpha: [0.8,0] },
    'shield.hit':             { q: 15, sp: [100,200],  sc: [0.8,0],   life: 300,  color: 0x00FFFF, angle: true },
    'shield.break':           { q: 25, sp: [150,300],  sc: [0.6,0],   life: 400,  color: 0x00FFFF, angle: true },
    'shield.activate':        { q: 15, sp: [20,60],    sc: [0.5,0.8], life: 600,  color: 0x00FFFF, alpha: [0.8,0] },
    'powerup':                { q: 20, sp: [50,150],   sc: [0.5,0],   life: 500,  color: 0xFFFF00, gY: -30 },
    'powerup.epic':           { q: 40, sp: [100,250],  sc: [0.8,0],   life: 700,  color: 0xFF00FF, gY: -50, angle: true },
    'pickup':                 { q: 8,  sp: [30,80],    sc: [0.3,0],   life: 300,  color: 0x00FF88, gY: -50 },
    'levelup':                { q: 50, sp: [100,300],  sc: [0.8,0],   life: 800,  color: 0xFFD700, gY: -80, angle: true },
    'heal':                   { q: 15, sp: [40,100],   sc: [0.5,0],   life: 500,  color: 0x00FF88, gY: -60, alpha: [0.8,0] },
    'aura':                   { q: 2,  sp: [20,50],    sc: [0.3,0],   life: 800,  color: 0x8800FF, alpha: [0.6,0], gY: -20 },
    'trail':                  { q: 1,  sp: [20,20],    sc: [0.3,0],   life: 200,  color: 0xFFFFFF, alpha: [0.8,0] },
    'spawn':                  { q: 12, sp: [50,120],   sc: [0,0.3],   life: 400,  color: 0x8844AA, alpha: [0,1] },
    'telegraph':              { q: 3,  sp: [0,0],      sc: [1.5,0.5], life: 500,  color: 0xFF0000, alpha: [0.8,0.2] },
    'effect':                 { q: 10, sp: [50,150],   sc: [0.4,0],   life: 300,  color: 0xFFFFFF },
    'special':                { q: 30, sp: [100,250],  sc: [0.8,0],   life: 500,  color: 0xFFD700, gY: -50 },
    'victory':                { q: 40, sp: [200,400],  sc: [1.0,0],   life: 1200, color: 0xFFD700, angle: true, gY: 200 },
};

// Grouped categories for the picker dropdown
const CATEGORIES = [
    { label: 'Hit Effects',     keys: ['hit.small', 'hit.medium', 'hit.large', 'enemy.hit', 'enemy.shoot', 'muzzle'] },
    { label: 'Explosions',      keys: ['explosion.small', 'explosion.medium', 'explosion.large'] },
    { label: 'Death Effects',   keys: ['death.small', 'death.medium', 'death.large'] },
    { label: 'Boss / Special',  keys: ['boss.spawn', 'boss.death', 'boss.phase', 'boss.special', 'boss.victory',
                                       'boss.overload.charge', 'boss.overload.explosion',
                                       'boss.radiation.storm', 'boss.radiation.pulse'] },
    { label: 'Shield',          keys: ['shield.hit', 'shield.break', 'shield.activate'] },
    { label: 'Power-ups',       keys: ['powerup', 'powerup.epic', 'pickup', 'levelup', 'heal'] },
    { label: 'Utility',         keys: ['aura', 'trail', 'spawn', 'telegraph', 'effect', 'special', 'victory'] },
];

// ============================================================
// Helpers
// ============================================================
function hexToRgb(hex) {
    return {
        r: (hex >> 16) & 0xFF,
        g: (hex >> 8) & 0xFF,
        b: hex & 0xFF,
    };
}

function cssHexToInt(cssHex) {
    return parseInt(cssHex.replace('#', ''), 16);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function rand(min, max) {
    return min + Math.random() * (max - min);
}

// ============================================================
// Particle simulation (pure Canvas 2D)
// ============================================================
class ParticleSimulation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.animId = null;
        this.lastTime = 0;
        this.maxLifespan = 0;
        this.elapsed = 0;
    }

    play(presetKey, colorOverride) {
        this.stop();
        const preset = PRESETS[presetKey];
        if (!preset) return;

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const color = colorOverride != null ? colorOverride : preset.color;
        const rgb = hexToRgb(color);
        const alphaStart = preset.alpha ? preset.alpha[0] : 1;
        const alphaEnd = preset.alpha ? preset.alpha[1] : 0;

        this.particles = [];
        this.maxLifespan = preset.life;
        this.elapsed = 0;

        for (let i = 0; i < preset.q; i++) {
            const angle = preset.angle ? rand(0, Math.PI * 2) : rand(-Math.PI * 0.4, Math.PI * 0.4) - Math.PI / 2;
            const speed = rand(preset.sp[0], preset.sp[1]);
            this.particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: preset.life,
                maxLife: preset.life,
                scStart: preset.sc[0],
                scEnd: preset.sc[1],
                alphaStart,
                alphaEnd,
                r: rgb.r,
                g: rgb.g,
                b: rgb.b,
                gx: preset.gX || 0,
                gy: preset.gY || 0,
            });
        }

        this.lastTime = performance.now();
        this._tick = this._tick.bind(this);
        this.animId = requestAnimationFrame(this._tick);
    }

    _tick(now) {
        const dt = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;
        this.elapsed += dt * 1000;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear with dark bg
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#0a0c14';
        ctx.fillRect(0, 0, w, h);

        // Draw particles with additive blending
        ctx.globalCompositeOperation = 'lighter';

        let alive = 0;
        for (const p of this.particles) {
            if (p.life <= 0) continue;
            alive++;

            p.life -= dt * 1000;
            p.vx += p.gx * dt;
            p.vy += p.gy * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            const t = 1 - Math.max(0, p.life / p.maxLife);
            const scale = lerp(p.scStart, p.scEnd, t);
            const alpha = lerp(p.alphaStart, p.alphaEnd, t);
            const radius = Math.max(0.5, scale * 6);

            if (alpha <= 0) continue;

            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha.toFixed(2)})`;
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';

        if (alive > 0 && this.elapsed < this.maxLifespan + 200) {
            this.animId = requestAnimationFrame(this._tick);
        } else {
            this.animId = null;
        }
    }

    stop() {
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
        this.particles = [];
    }

    drawIdle() {
        const ctx = this.ctx;
        ctx.fillStyle = '#0a0c14';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = '#565e72';
        ctx.font = '11px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Select preset & play', this.canvas.width / 2, this.canvas.height / 2);
    }

    destroy() {
        this.stop();
    }
}

// ============================================================
// VFXPreview module
// ============================================================
export class VFXPreview {
    constructor(editor) {
        this.editor = editor;
        this.simulations = new Map();
    }

    // ----------------------------------------------------------
    // VFX Picker (inline in event audio table row)
    // Returns a DOM fragment with <select> + preview button
    // ----------------------------------------------------------
    createVFXPicker(currentValue, onChange) {
        const wrapper = document.createElement('div');
        wrapper.className = 'vfx-picker';

        // Dropdown
        const select = document.createElement('select');
        select.className = 'vfx-picker-select';

        // Empty option
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '-- none --';
        select.appendChild(emptyOpt);

        for (const cat of CATEGORIES) {
            const group = document.createElement('optgroup');
            group.label = cat.label;
            for (const key of cat.keys) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = key;
                if (key === currentValue || 'vfx.' + key === currentValue) {
                    opt.selected = true;
                }
                group.appendChild(opt);
            }
            select.appendChild(group);
        }

        // If current value exists but is not in categories, still show it
        if (currentValue && !select.value) {
            const opt = document.createElement('option');
            opt.value = currentValue;
            opt.textContent = currentValue + ' (custom)';
            opt.selected = true;
            select.insertBefore(opt, select.firstChild.nextSibling);
        }

        select.addEventListener('change', () => {
            onChange(select.value);
        });
        wrapper.appendChild(select);

        // Preview button
        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'vfx-picker-preview-btn';
        previewBtn.textContent = '\u25B7';
        previewBtn.title = 'Preview VFX';
        previewBtn.addEventListener('click', () => {
            this._showPopoverPreview(previewBtn, select.value, null);
        });
        wrapper.appendChild(previewBtn);

        return wrapper;
    }

    // ----------------------------------------------------------
    // Popover canvas preview (shown near trigger element)
    // ----------------------------------------------------------
    _showPopoverPreview(anchor, presetKey, colorOverride) {
        if (!presetKey || !PRESETS[presetKey]) return;

        // Remove any existing popover
        this._removePopover();

        const popover = document.createElement('div');
        popover.className = 'vfx-popover';

        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 150;
        canvas.className = 'vfx-popover-canvas';
        popover.appendChild(canvas);

        // Replay button row
        const controls = document.createElement('div');
        controls.className = 'vfx-popover-controls';

        const replayBtn = document.createElement('button');
        replayBtn.type = 'button';
        replayBtn.className = 'vfx-popover-replay';
        replayBtn.textContent = 'Replay';
        controls.appendChild(replayBtn);

        const label = document.createElement('span');
        label.className = 'vfx-popover-label';
        label.textContent = presetKey;
        controls.appendChild(label);

        popover.appendChild(controls);
        document.body.appendChild(popover);

        // Position near anchor
        const rect = anchor.getBoundingClientRect();
        popover.style.left = (rect.left - 210) + 'px';
        popover.style.top = rect.top + 'px';
        // Clamp to viewport
        const pRect = popover.getBoundingClientRect();
        if (pRect.left < 4) popover.style.left = (rect.right + 4) + 'px';
        if (pRect.bottom > window.innerHeight) {
            popover.style.top = (window.innerHeight - pRect.height - 4) + 'px';
        }

        const sim = new ParticleSimulation(canvas);
        sim.play(presetKey, colorOverride);
        this._popover = { el: popover, sim };

        replayBtn.addEventListener('click', () => {
            sim.play(presetKey, colorOverride);
        });

        // Close on click outside
        const closeHandler = (e) => {
            if (!popover.contains(e.target) && e.target !== anchor) {
                this._removePopover();
                document.removeEventListener('pointerdown', closeHandler, true);
            }
        };
        setTimeout(() => {
            document.addEventListener('pointerdown', closeHandler, true);
        }, 0);
        this._popoverCloseHandler = closeHandler;
    }

    _removePopover() {
        if (this._popover) {
            this._popover.sim.destroy();
            this._popover.el.remove();
            this._popover = null;
        }
        if (this._popoverCloseHandler) {
            document.removeEventListener('pointerdown', this._popoverCloseHandler, true);
            this._popoverCloseHandler = null;
        }
    }

    // ----------------------------------------------------------
    // Standalone preview panel (for right-side panel)
    // ----------------------------------------------------------
    createPreviewPanel(blueprintVfxEntries) {
        // blueprintVfxEntries: array of { event, presetKey } from current blueprint
        const panel = document.createElement('div');
        panel.className = 'vfx-preview-panel';

        const header = document.createElement('div');
        header.className = 'vfx-preview-panel-header';

        const title = document.createElement('span');
        title.textContent = 'VFX Preview';
        header.appendChild(title);

        const playAllBtn = document.createElement('button');
        playAllBtn.type = 'button';
        playAllBtn.className = 'vfx-preview-play-all';
        playAllBtn.textContent = 'Play All';
        header.appendChild(playAllBtn);

        panel.appendChild(header);

        // Canvas
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 150;
        canvas.className = 'vfx-preview-canvas';
        panel.appendChild(canvas);

        const sim = new ParticleSimulation(canvas);
        sim.drawIdle();

        // Dropdown of blueprint VFX entries
        const selectRow = document.createElement('div');
        selectRow.className = 'vfx-preview-select-row';

        const select = document.createElement('select');
        select.className = 'vfx-preview-select';
        if (!blueprintVfxEntries || blueprintVfxEntries.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = 'No VFX in blueprint';
            opt.disabled = true;
            select.appendChild(opt);
        } else {
            for (const entry of blueprintVfxEntries) {
                const opt = document.createElement('option');
                opt.value = entry.presetKey;
                opt.textContent = entry.event + ': ' + entry.presetKey;
                select.appendChild(opt);
            }
        }
        selectRow.appendChild(select);

        // Color override
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'vfx-preview-color';
        colorInput.value = '#ffffff';
        colorInput.title = 'Color override';
        selectRow.appendChild(colorInput);

        // Play single
        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'vfx-preview-play-btn';
        playBtn.textContent = '\u25B6';
        playBtn.title = 'Play selected';
        playBtn.addEventListener('click', () => {
            const key = select.value;
            if (!key) return;
            const colorHex = colorInput.value;
            const useColor = colorHex !== '#ffffff' ? cssHexToInt(colorHex) : null;
            sim.play(key, useColor);
        });
        selectRow.appendChild(playBtn);

        panel.appendChild(selectRow);

        // Play all handler
        playAllBtn.addEventListener('click', () => {
            if (!blueprintVfxEntries || blueprintVfxEntries.length === 0) return;
            let idx = 0;
            const playNext = () => {
                if (idx >= blueprintVfxEntries.length) return;
                const entry = blueprintVfxEntries[idx];
                select.value = entry.presetKey;
                sim.play(entry.presetKey, null);
                idx++;
                if (idx < blueprintVfxEntries.length) {
                    setTimeout(playNext, 600);
                }
            };
            playNext();
        });

        // Store sim reference for cleanup
        panel._vfxSim = sim;
        return panel;
    }

    // ----------------------------------------------------------
    // Extract VFX entries from a blueprint object
    // ----------------------------------------------------------
    static extractVfxEntries(blueprint) {
        const entries = [];
        if (!blueprint) return entries;
        const vfx = blueprint.vfx;
        if (vfx && typeof vfx === 'object') {
            for (const [event, presetKey] of Object.entries(vfx)) {
                if (typeof presetKey === 'string') {
                    // Strip vfx. prefix if present to match preset keys
                    const key = presetKey.replace(/^vfx\./, '');
                    entries.push({ event, presetKey: PRESETS[key] ? key : presetKey });
                }
            }
        }
        return entries;
    }

    // ----------------------------------------------------------
    // Check if a preset key is known
    // ----------------------------------------------------------
    static hasPreset(key) {
        const clean = key.replace(/^vfx\./, '');
        return clean in PRESETS;
    }

    destroy() {
        this._removePopover();
        for (const sim of this.simulations.values()) {
            sim.destroy();
        }
        this.simulations.clear();
    }
}
