/**
 * ContextDashboard — Routes type-specific visualizations to the right panel.
 *
 * Instead of showing a primitive shape preview, the right panel now displays
 * relevant dashboards per blueprint type:
 *   - Spawn: SpawnTimeline + LootVisualizer + BalanceDashboard
 *   - Boss: BossPhaseEditor + BalanceDashboard
 *   - Powerup: PowerupGraph + BalanceDashboard
 *   - Enemy/Elite/Unique: BalanceDashboard + VFX Preview
 *   - Other: BalanceDashboard only
 */
export class ContextDashboard {
    constructor(editor) {
        this.editor = editor;
        this.container = document.getElementById('context-dashboard');
        this.currentType = null;

        editor.on('blueprint:loaded', (data) => this.update(data.blueprint));
        editor.on('blueprint:changed', (data) => this.update(data.blueprint));
    }

    update(bp) {
        if (!bp || !this.container) return;
        const type = this._detectType(bp);
        if (type === this.currentType && this.container.childElementCount > 0) return;
        this.currentType = type;
        this.container.replaceChildren();

        const m = this.editor.modules;

        // Route visualizations based on type
        switch (type) {
            case 'spawn':
                this._appendModule(m.spawnTimeline, bp);
                this._appendModule(m.lootVisualizer, bp);
                this._appendModule(m.balanceDashboard, bp);
                break;
            case 'boss':
                this._appendModule(m.bossPhaseEditor, bp);
                this._appendModule(m.balanceDashboard, bp);
                this._appendVfxPreview(m.vfxPreview, bp);
                break;
            case 'powerup':
                this._appendModule(m.powerupGraph, bp);
                this._appendModule(m.balanceDashboard, bp);
                this._appendVfxPreview(m.vfxPreview, bp);
                break;
            case 'enemy':
            case 'elite':
            case 'unique':
            case 'miniboss':
                this._appendModule(m.balanceDashboard, bp);
                this._appendVfxPreview(m.vfxPreview, bp);
                break;
            default:
                this._appendModule(m.balanceDashboard, bp);
                break;
        }
    }

    _appendModule(mod, bp) {
        if (!mod?.container) return;
        // Move module container into the dashboard
        this.container.appendChild(mod.container);
    }

    _appendVfxPreview(vfxMod, bp) {
        if (!vfxMod) return;
        const entries = vfxMod.constructor.extractVfxEntries
            ? vfxMod.constructor.extractVfxEntries(bp)
            : [];
        if (entries.length === 0) return;
        const panel = vfxMod.createPreviewPanel(entries);
        if (panel) this.container.appendChild(panel);
    }

    _detectType(bp) {
        if (bp.enemyWaves || bp.bossTriggers) return 'spawn';
        if (bp.type === 'boss' || bp.id?.startsWith('boss.')) return 'boss';
        if (bp.type === 'powerup' || bp.id?.startsWith('powerup.')) return 'powerup';
        if (bp.id?.startsWith('elite.')) return 'elite';
        if (bp.id?.startsWith('unique.')) return 'unique';
        if (bp.id?.startsWith('miniboss.')) return 'miniboss';
        if (bp.type === 'enemy' || bp.id?.startsWith('enemy.')) return 'enemy';
        return bp.type || 'unknown';
    }
}
