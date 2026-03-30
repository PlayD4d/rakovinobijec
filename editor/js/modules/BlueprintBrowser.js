/**
 * BlueprintBrowser.js - File tree browser for blueprints
 * Displays hierarchical list of all available blueprints
 */

export class BlueprintBrowser {
    constructor(editor) {
        this.editor = editor;
        this.blueprints = [];
        this.selectedPath = null;
        this.expandedFolders = new Set(['config', 'enemy', 'boss', 'powerup']); // Default expanded
        
        this.init();
    }
    
    init() {
        // Get DOM elements
        this.treeContainer = document.getElementById('blueprint-tree');
        this.searchInput = document.getElementById('search-blueprints');
        this.filterSelect = document.getElementById('filter-type');
        
        // Setup event handlers
        this.searchInput.addEventListener('input', () => this.handleSearch());
        this.filterSelect.addEventListener('change', () => this.handleFilter());
        
        // Listen to editor events
        this.editor.on('blueprints:loaded', (blueprints) => {
            this.blueprints = blueprints;
            this.render();
        });
        
        this.editor.on('blueprint:loaded', (data) => {
            this.selectedPath = data.filePath;
            this.render();
        });
    }
    
    /**
     * Render the blueprint tree
     */
    render() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const filterType = this.filterSelect.value;
        
        // Filter blueprints
        let filtered = this.blueprints;
        
        if (filterType) {
            filtered = filtered.filter(bp => bp.type === filterType);
        }
        
        if (searchTerm) {
            filtered = filtered.filter(bp => 
                bp.id.toLowerCase().includes(searchTerm) ||
                bp.name.toLowerCase().includes(searchTerm)
            );
        }
        
        // Group by type
        const grouped = this.groupByType(filtered);
        
        // Clear container
        this.treeContainer.innerHTML = '';
        
        if (Object.keys(grouped).length === 0) {
            this.treeContainer.innerHTML = '<div class="tree-placeholder">No blueprints found</div>';
            return;
        }
        
        // Render each group
        for (const [type, items] of Object.entries(grouped)) {
            const folder = this.createFolder(type, items);
            this.treeContainer.appendChild(folder);
        }
    }
    
    /**
     * Group blueprints by type
     */
    groupByType(blueprints) {
        const grouped = {};
        
        for (const bp of blueprints) {
            if (!grouped[bp.type]) {
                grouped[bp.type] = [];
            }
            grouped[bp.type].push(bp);
        }
        
        // Sort each group
        for (const items of Object.values(grouped)) {
            items.sort((a, b) => a.id.localeCompare(b.id));
        }
        
        return grouped;
    }
    
    /**
     * Create a folder element
     */
    createFolder(type, items) {
        const folder = document.createElement('div');
        folder.className = 'tree-folder';
        
        // Folder header
        const header = document.createElement('div');
        header.className = 'tree-item';
        header.innerHTML = `
            <span class="tree-item-icon">${this.expandedFolders.has(type) ? '▼' : '▶'}</span>
            <span class="tree-folder-name">${this.formatTypeName(type)}</span>
            <span class="tree-folder-count">(${items.length})</span>
        `;
        
        header.addEventListener('click', () => {
            if (this.expandedFolders.has(type)) {
                this.expandedFolders.delete(type);
            } else {
                this.expandedFolders.add(type);
            }
            this.render();
        });
        
        folder.appendChild(header);
        
        // Folder contents
        if (this.expandedFolders.has(type)) {
            const children = document.createElement('div');
            children.className = 'tree-children';
            
            for (const item of items) {
                const itemElement = this.createItem(item);
                children.appendChild(itemElement);
            }
            
            folder.appendChild(children);
        }
        
        return folder;
    }
    
    /**
     * Create an item element
     */
    createItem(blueprint) {
        const item = document.createElement('div');
        item.className = 'tree-item';
        
        if (blueprint.path === this.selectedPath) {
            item.classList.add('selected');
        }
        
        // Icon based on type
        const icon = this.getIcon(blueprint.type);
        
        item.innerHTML = `
            <span class="tree-item-icon">${icon}</span>
            <span class="tree-item-name">${blueprint.name}</span>
        `;
        
        // Add tooltip with full ID
        item.title = blueprint.id;
        
        // Click handler
        item.addEventListener('click', () => {
            this.selectBlueprint(blueprint);
        });
        
        // Right-click context menu
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, blueprint);
        });
        
        return item;
    }
    
    /**
     * Select a blueprint
     */
    selectBlueprint(blueprint) {
        this.selectedPath = blueprint.path;
        this.editor.loadBlueprint(blueprint.path);
    }
    
    /**
     * Show context menu
     */
    showContextMenu(event, blueprint) {
        // Remove any existing context menu
        const existing = document.querySelector('.context-menu');
        if (existing) existing.remove();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.position = 'fixed';
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
        menu.style.zIndex = '1001';
        menu.style.background = 'var(--bg-panel)';
        menu.style.border = '1px solid var(--border-color)';
        menu.style.borderRadius = '4px';
        menu.style.padding = '4px 0';
        menu.style.minWidth = '150px';
        menu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        
        const actions = [
            { label: 'Open', action: () => this.selectBlueprint(blueprint) },
            { label: 'Duplicate', action: () => this.duplicateBlueprint(blueprint) },
            { label: 'Delete', action: () => this.deleteBlueprint(blueprint) },
            { label: 'Copy ID', action: () => this.copyToClipboard(blueprint.id) },
            { label: 'Copy Path', action: () => this.copyToClipboard(blueprint.path) }
        ];
        
        for (const item of actions) {
            const menuItem = document.createElement('div');
            menuItem.style.padding = '6px 12px';
            menuItem.style.cursor = 'pointer';
            menuItem.style.fontSize = '13px';
            menuItem.textContent = item.label;
            
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.background = 'var(--bg-hover)';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = 'transparent';
            });
            
            menuItem.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            
            menu.appendChild(menuItem);
        }
        
        document.body.appendChild(menu);
        
        // Remove menu when clicking elsewhere
        const removeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', removeMenu);
        }, 0);
    }
    
    /**
     * Duplicate a blueprint
     */
    async duplicateBlueprint(blueprint) {
        const newId = await this.editor.prompt(
            `Enter new ID for duplicate:`,
            'Duplicate Blueprint',
            null
        );
        
        if (!newId) return;
        
        try {
            // Load original
            const original = await this.editor.dataManager.loadBlueprint(blueprint.path);
            
            // Create copy with new ID
            const copy = { ...original, id: newId };
            
            // Save as new file
            const newPath = blueprint.path.replace(blueprint.id.replace('.', '_'), newId.replace('.', '_'));
            await this.editor.dataManager.saveBlueprint(newPath, copy);
            
            // Reload blueprint list
            await this.editor.loadBlueprintList();
            
            this.editor.updateStatus(`Duplicated ${blueprint.id} as ${newId}`, 'success');
            
        } catch (error) {
            this.editor.showError(`Failed to duplicate: ${error.message}`);
        }
    }
    
    /**
     * Delete a blueprint
     */
    async deleteBlueprint(blueprint) {
        const confirmed = await this.editor.confirm(
            `Are you sure you want to delete ${blueprint.id}?<br><br>This cannot be undone.`
        );
        
        if (!confirmed) return;
        
        // In browser environment, we can't actually delete files
        // Would need server endpoint for this
        this.editor.showError('Delete not implemented in browser environment');
    }
    
    /**
     * Copy text to clipboard
     */
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.editor.updateStatus('Copied to clipboard', 'success');
        }).catch(err => {
            this.editor.showError('Failed to copy to clipboard');
        });
    }
    
    /**
     * Handle search input
     */
    handleSearch() {
        // Debounce search
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.render();
        }, 300);
    }
    
    /**
     * Handle filter change
     */
    handleFilter() {
        this.render();
    }
    
    /**
     * Get icon for blueprint type
     */
    getIcon(type) {
        const icons = {
            config: '⚙️',
            enemy: '👾',
            boss: '🐉',
            elite: '⭐',
            unique: '💎',
            powerup: '💊',
            projectile: '🔸',
            loot: '📦',
            drop: '💧',
            spawn: '🌊',
            player: '👤',
            system: '🔧',
            item: '📦'
        };
        
        return icons[type] || '📄';
    }
    
    /**
     * Format type name for display
     */
    formatTypeName(type) {
        const names = {
            config: 'Config Files',
            enemy: 'Enemies',
            boss: 'Bosses',
            elite: 'Elites',
            unique: 'Uniques',
            powerup: 'Power-ups',
            projectile: 'Projectiles',
            loot: 'Loot Tables',
            drop: 'Drops',
            spawn: 'Spawn Tables',
            player: 'Player',
            system: 'System',
            item: 'Items'
        };
        
        return names[type] || type;
    }
}

export default BlueprintBrowser;