/**
 * EntityAutocomplete - Adds autocomplete + validation to entity ID reference fields
 *
 * Detects input fields that reference entity IDs (enemyId, bossId, projectileId, etc.)
 * and provides dropdown autocomplete, real-time validation, and quick-jump navigation.
 */

const TYPE_ICONS = {
    enemy: '👾', boss: '🐉', elite: '⭐', unique: '💎', miniboss: '🔱',
    powerup: '💊', projectile: '🔸', item: '📦', spawn: '🌊', spawnTable: '🌊',
    system: '⚙️', player: '🎮'
};

const REF_FIELD_PATTERNS = [
    /Id$/i, /^enemyId$/, /^bossId$/, /^projectileId$/, /^itemId$/,
    /^lootTableId$/, /^blueprintId$/, /^ref$/
];

export class EntityAutocomplete {
    constructor(editor) {
        this.editor = editor;
        this.entityIds = [];
        this.dropdown = null;
        this.activeInput = null;
        this._debounceTimer = null;
        this.init();
    }

    init() {
        this._buildDropdown();
        this._loadEntityIds();

        // Re-scan when property form changes
        this._observer = new MutationObserver(() => this._scanFields());
        const form = document.getElementById('property-form');
        if (form) this._observer.observe(form, { childList: true, subtree: true });

        this.editor.on('blueprint:loaded', () => {
            this._loadEntityIds();
            setTimeout(() => this._scanFields(), 100);
        });
    }

    _buildDropdown() {
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'ea-dropdown';
        this.dropdown.style.display = 'none';
        document.body.appendChild(this.dropdown);
    }

    _loadEntityIds() {
        const dm = this.editor.dataManager;
        if (!dm?.blueprintList) return;
        this.entityIds = dm.blueprintList.map(b => ({
            id: b.id,
            type: this._extractType(b.id),
            path: b.path
        }));
    }

    _extractType(id) {
        if (!id) return 'unknown';
        const dot = id.indexOf('.');
        return dot > 0 ? id.substring(0, dot) : 'unknown';
    }

    _isRefField(input) {
        const name = input.name || input.dataset.path || '';
        if (REF_FIELD_PATTERNS.some(p => p.test(name))) return true;
        const val = input.value || '';
        return /^[a-z]+\.[a-z_]+$/i.test(val) && val.includes('.');
    }

    _scanFields() {
        const form = document.getElementById('property-form');
        if (!form) return;
        const inputs = form.querySelectorAll('input[type="text"]');
        for (const input of inputs) {
            if (input.dataset.eaBound) continue;
            if (!this._isRefField(input)) continue;
            input.dataset.eaBound = '1';
            this._bindInput(input);
            this._validate(input);
        }
    }

    _bindInput(input) {
        input.addEventListener('input', () => {
            clearTimeout(this._debounceTimer);
            this._showDropdown(input, input.value);
            this._debounceTimer = setTimeout(() => this._validate(input), 300);
        });
        input.addEventListener('focus', () => {
            if (input.value) this._showDropdown(input, input.value);
        });
        input.addEventListener('blur', () => {
            setTimeout(() => this._hideDropdown(), 150);
        });
        input.addEventListener('keydown', (e) => this._handleKey(e, input));

        // Add quick-jump button
        const jumpBtn = document.createElement('button');
        jumpBtn.className = 'ea-jump-btn';
        jumpBtn.textContent = '→';
        jumpBtn.title = 'Open this blueprint';
        jumpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = input.value?.trim();
            if (id && this.entityIds.some(e => e.id === id)) {
                const entry = this.editor.dataManager.blueprintList.find(b => b.id === id);
                if (entry) this.editor.loadBlueprint(entry.path);
            }
        });
        input.parentElement?.appendChild(jumpBtn);
    }

    _validate(input) {
        const val = input.value?.trim();
        if (!val) {
            input.classList.remove('ea-valid', 'ea-invalid');
            return;
        }
        const exists = this.entityIds.some(e => e.id === val);
        input.classList.toggle('ea-valid', exists);
        input.classList.toggle('ea-invalid', !exists);
        input.title = exists ? '' : `ID "${val}" not found in registry`;
    }

    _showDropdown(input, query) {
        if (!query || this.entityIds.length === 0) {
            this._hideDropdown();
            return;
        }
        const q = query.toLowerCase();
        const matches = this.entityIds
            .filter(e => e.id.toLowerCase().includes(q))
            .slice(0, 10);

        if (matches.length === 0) {
            this._hideDropdown();
            return;
        }

        this.activeInput = input;
        this.dropdown.textContent = '';
        this._selectedIdx = -1;

        for (let i = 0; i < matches.length; i++) {
            const m = matches[i];
            const item = document.createElement('div');
            item.className = 'ea-item';
            item.dataset.index = i;

            const icon = document.createElement('span');
            icon.className = 'ea-icon';
            icon.textContent = TYPE_ICONS[m.type] || '📄';

            const label = document.createElement('span');
            label.className = 'ea-label';
            label.textContent = m.id;

            item.appendChild(icon);
            item.appendChild(label);
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this._selectItem(input, m.id);
            });
            this.dropdown.appendChild(item);
        }

        // Position below input
        const rect = input.getBoundingClientRect();
        this.dropdown.style.left = rect.left + 'px';
        this.dropdown.style.top = (rect.bottom + 2) + 'px';
        this.dropdown.style.width = Math.max(rect.width, 250) + 'px';
        this.dropdown.style.display = 'block';
    }

    _hideDropdown() {
        this.dropdown.style.display = 'none';
        this.activeInput = null;
        this._selectedIdx = -1;
    }

    _selectItem(input, id) {
        input.value = id;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        this._validate(input);
        this._hideDropdown();
    }

    _handleKey(e, input) {
        if (this.dropdown.style.display === 'none') return;
        const items = this.dropdown.querySelectorAll('.ea-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._selectedIdx = Math.min(this._selectedIdx + 1, items.length - 1);
            this._highlightItem(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._selectedIdx = Math.max(this._selectedIdx - 1, 0);
            this._highlightItem(items);
        } else if (e.key === 'Enter' && this._selectedIdx >= 0) {
            e.preventDefault();
            const label = items[this._selectedIdx]?.querySelector('.ea-label');
            if (label) this._selectItem(input, label.textContent);
        } else if (e.key === 'Escape') {
            this._hideDropdown();
        }
    }

    _highlightItem(items) {
        items.forEach((it, i) => {
            it.classList.toggle('ea-selected', i === this._selectedIdx);
        });
    }

    destroy() {
        if (this._observer) this._observer.disconnect();
        if (this.dropdown?.parentElement) this.dropdown.remove();
        clearTimeout(this._debounceTimer);
    }
}
