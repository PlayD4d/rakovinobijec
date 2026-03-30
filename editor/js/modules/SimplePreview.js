/**
 * SimplePreview.js - Visual preview of blueprints
 * Shows sprite, stats, and JSON representation
 */

export class SimplePreview {
    constructor(editor) {
        this.editor = editor;
        this.currentBlueprint = null;
        this.canvas = document.getElementById('entity-preview');
        this.ctx = this.canvas.getContext('2d');
        this.currentMode = 'visual';
        
        this.init();
    }
    
    init() {
        // Get DOM elements
        this.visualSection = document.getElementById('preview-visual');
        this.statsSection = document.getElementById('preview-stats-container');
        this.jsonSection = document.getElementById('preview-json');
        this.modeSelect = document.getElementById('preview-mode');
        
        // Setup event handlers
        this.modeSelect.addEventListener('change', (e) => {
            this.setMode(e.target.value);
        });
        
        document.getElementById('btn-refresh-preview').addEventListener('click', () => {
            this.render();
        });
        
        // Listen to editor events
        this.editor.on('blueprint:loaded', (data) => {
            this.currentBlueprint = data.blueprint;
            this.render();
        });
        
        this.editor.on('blueprint:changed', (data) => {
            this.currentBlueprint = data.blueprint;
            this.render();
        });
        
        this.editor.on('blueprint:created', (data) => {
            this.currentBlueprint = data.blueprint;
            this.render();
        });
        
        this.editor.on('preview:mode-change', (mode) => {
            this.setMode(mode);
        });
    }
    
    /**
     * Set preview mode
     */
    setMode(mode) {
        this.currentMode = mode;
        
        // Hide all sections
        this.visualSection.style.display = 'none';
        this.statsSection.style.display = 'none';
        this.jsonSection.style.display = 'none';
        
        // Show selected section
        switch (mode) {
            case 'visual':
                this.visualSection.style.display = 'block';
                break;
            case 'stats':
                this.statsSection.style.display = 'block';
                break;
            case 'json':
                this.jsonSection.style.display = 'block';
                break;
        }
        
        this.render();
    }
    
    /**
     * Render preview based on current mode
     */
    render() {
        if (!this.currentBlueprint) {
            this.clearPreview();
            return;
        }
        
        switch (this.currentMode) {
            case 'visual':
                this.renderVisual();
                break;
            case 'stats':
                this.renderStats();
                break;
            case 'json':
                this.renderJSON();
                break;
        }
    }
    
    /**
     * Render visual preview
     */
    renderVisual() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background grid
        this.drawGrid();
        
        // Draw entity representation
        this.drawEntity();
        
        // Update info
        this.updateInfo();
    }
    
    /**
     * Draw background grid
     */
    drawGrid() {
        const gridSize = 20;
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 0.5;
        
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    /**
     * Draw entity representation
     */
    drawEntity() {
        const bp = this.currentBlueprint;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Get visual properties
        let size = 20;
        let color = '#4CAF50';
        let shape = 'circle';
        
        // Extract size
        if (bp.stats?.size) {
            size = Math.min(bp.stats.size * 2, 80); // Scale for visibility
        } else if (bp.physics?.size) {
            size = Math.min(bp.physics.size * 2, 80);
        }
        
        // Extract color
        if (bp.graphics?.tint) {
            color = this.numberToHex(bp.graphics.tint);
        } else if (bp.visuals?.tint) {
            color = this.numberToHex(bp.visuals.tint);
        } else if (bp.display?.color) {
            color = this.numberToHex(bp.display.color);
        }
        
        // Determine shape based on type
        switch (bp.type) {
            case 'boss':
                shape = 'star';
                size *= 1.5;
                break;
            case 'elite':
                shape = 'diamond';
                size *= 1.2;
                break;
            case 'unique':
                shape = 'star';
                size *= 1.1;
                break;
            case 'powerup':
                shape = 'hexagon';
                break;
            case 'projectile':
                shape = 'triangle';
                size *= 0.8;
                break;
            case 'drop':
                shape = 'diamond';
                size *= 0.6;
                break;
            case 'player':
                shape = 'star';
                size *= 1.3;
                break;
            case 'enemy':
            default:
                shape = 'circle';
                break;
        }
        
        // Draw shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.drawShape(centerX + 2, centerY + 2, size, shape);
        
        // Draw main shape
        this.ctx.fillStyle = color;
        this.drawShape(centerX, centerY, size, shape);
        
        // Draw border - ensure color is valid before lightening
        const borderColor = this.lightenColor(color || '#4CAF50');
        this.ctx.strokeStyle = borderColor;
        this.ctx.lineWidth = 2;
        this.drawShape(centerX, centerY, size, shape, true);
        
        // Draw type indicator
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const typeIcon = this.getTypeIcon(bp.type);
        this.ctx.fillText(typeIcon, centerX, centerY);
        
        // Draw special effects
        if (bp.type === 'boss' || bp.type === 'elite') {
            // Draw aura
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1;
            this.ctx.globalAlpha = 0.3;
            this.drawShape(centerX, centerY, size * 1.3, 'circle', true);
            this.ctx.globalAlpha = 0.2;
            this.drawShape(centerX, centerY, size * 1.5, 'circle', true);
            this.ctx.globalAlpha = 1;
        }
    }
    
    /**
     * Draw a shape
     */
    drawShape(x, y, size, shape, strokeOnly = false) {
        this.ctx.beginPath();
        
        switch (shape) {
            case 'circle':
                this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
                break;
                
            case 'diamond':
                this.ctx.moveTo(x, y - size / 2);
                this.ctx.lineTo(x + size / 2, y);
                this.ctx.lineTo(x, y + size / 2);
                this.ctx.lineTo(x - size / 2, y);
                this.ctx.closePath();
                break;
                
            case 'star':
                const spikes = 5;
                const outerRadius = size / 2;
                const innerRadius = size / 4;
                for (let i = 0; i < spikes * 2; i++) {
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    const angle = (i * Math.PI) / spikes;
                    const px = x + Math.cos(angle - Math.PI / 2) * radius;
                    const py = y + Math.sin(angle - Math.PI / 2) * radius;
                    if (i === 0) {
                        this.ctx.moveTo(px, py);
                    } else {
                        this.ctx.lineTo(px, py);
                    }
                }
                this.ctx.closePath();
                break;
                
            case 'hexagon':
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI * 2) / 6;
                    const px = x + Math.cos(angle) * size / 2;
                    const py = y + Math.sin(angle) * size / 2;
                    if (i === 0) {
                        this.ctx.moveTo(px, py);
                    } else {
                        this.ctx.lineTo(px, py);
                    }
                }
                this.ctx.closePath();
                break;
                
            case 'triangle':
                this.ctx.moveTo(x, y - size / 2);
                this.ctx.lineTo(x + size / 2, y + size / 2);
                this.ctx.lineTo(x - size / 2, y + size / 2);
                this.ctx.closePath();
                break;
        }
        
        if (strokeOnly) {
            this.ctx.stroke();
        } else {
            this.ctx.fill();
        }
    }
    
    /**
     * Update info display
     */
    updateInfo() {
        const bp = this.currentBlueprint;
        
        // Update name
        const nameElement = document.getElementById('preview-name');
        nameElement.textContent = bp.display?.name || bp.name || bp.id || 'Unknown';
        
        // Update stats
        const statsContainer = document.getElementById('preview-stats');
        statsContainer.innerHTML = '';
        
        // Collect relevant stats
        const stats = [];
        
        if (bp.stats) {
            if (bp.stats.hp !== undefined) stats.push({ label: 'HP', value: bp.stats.hp });
            if (bp.stats.damage !== undefined) stats.push({ label: 'Damage', value: bp.stats.damage });
            if (bp.stats.speed !== undefined) stats.push({ label: 'Speed', value: bp.stats.speed });
            if (bp.stats.armor !== undefined) stats.push({ label: 'Armor', value: bp.stats.armor });
            if (bp.stats.xp !== undefined) stats.push({ label: 'XP', value: bp.stats.xp });
        }
        
        if (bp.multipliers) {
            stats.push({ label: 'HP Mult', value: `×${bp.multipliers.hp}` });
            stats.push({ label: 'DMG Mult', value: `×${bp.multipliers.damage}` });
        }
        
        if (bp.physics) {
            if (bp.physics.speed !== undefined) stats.push({ label: 'Proj Speed', value: bp.physics.speed });
            if (bp.physics.lifespan !== undefined) stats.push({ label: 'Lifespan', value: `${bp.physics.lifespan}ms` });
        }
        
        if (bp.damage) {
            if (bp.damage.amount !== undefined) stats.push({ label: 'Damage', value: bp.damage.amount });
            if (bp.damage.type) stats.push({ label: 'Type', value: bp.damage.type });
        }
        
        // Add type and rarity
        stats.unshift({ label: 'Type', value: bp.type });
        if (bp.stats?.rarity) stats.push({ label: 'Rarity', value: bp.stats.rarity });
        
        // Render stats
        for (const stat of stats) {
            const row = document.createElement('div');
            row.className = 'stat-row';
            row.innerHTML = `
                <span class="stat-label">${stat.label}:</span>
                <span class="stat-value">${stat.value}</span>
            `;
            statsContainer.appendChild(row);
        }
    }
    
    /**
     * Render stats table
     */
    renderStats() {
        const table = document.getElementById('stats-table');
        table.innerHTML = '';
        
        if (!this.currentBlueprint) {
            table.innerHTML = '<tr><td>No blueprint loaded</td></tr>';
            return;
        }
        
        // Create header
        const header = document.createElement('tr');
        header.innerHTML = '<th>Property</th><th>Value</th>';
        table.appendChild(header);
        
        // Add all properties recursively
        this.addTableRows(table, this.currentBlueprint, '');
    }
    
    /**
     * Add table rows recursively
     */
    addTableRows(table, obj, prefix) {
        for (const [key, value] of Object.entries(obj)) {
            const row = document.createElement('tr');
            const path = prefix ? `${prefix}.${key}` : key;
            
            if (value === null || value === undefined) {
                row.innerHTML = `<td>${path}</td><td><em>null</em></td>`;
            } else if (Array.isArray(value)) {
                row.innerHTML = `<td>${path}</td><td>[Array: ${value.length} items]</td>`;
            } else if (typeof value === 'object') {
                row.innerHTML = `<td><strong>${path}</strong></td><td>{Object}</td>`;
                table.appendChild(row);
                this.addTableRows(table, value, path);
                continue;
            } else {
                row.innerHTML = `<td>${path}</td><td>${value}</td>`;
            }
            
            table.appendChild(row);
        }
    }
    
    /**
     * Render JSON view
     */
    renderJSON() {
        const display = document.getElementById('json-display');
        
        if (!this.currentBlueprint) {
            display.textContent = '// No blueprint loaded';
            return;
        }
        
        // Format as JSON with syntax highlighting
        const json = JSON.stringify(this.currentBlueprint, null, 2);
        
        // Basic syntax highlighting
        const highlighted = json
            .replace(/("[\w\d_]+"):/g, '<span style="color: #9CDCFE">$1</span>:')
            .replace(/: "([^"]*)"/g, ': <span style="color: #CE9178">"$1"</span>')
            .replace(/: (\d+)/g, ': <span style="color: #B5CEA8">$1</span>')
            .replace(/: (true|false)/g, ': <span style="color: #569CD6">$1</span>')
            .replace(/: (null)/g, ': <span style="color: #569CD6">$1</span>');
        
        display.innerHTML = highlighted;
    }
    
    /**
     * Clear preview
     */
    clearPreview() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        document.getElementById('preview-name').textContent = '-';
        document.getElementById('preview-stats').innerHTML = '<div class="stat-row">No blueprint selected</div>';
        document.getElementById('stats-table').innerHTML = '<tr><td>No blueprint loaded</td></tr>';
        document.getElementById('json-display').textContent = '// No blueprint loaded';
    }
    
    /**
     * Convert number to hex color
     */
    numberToHex(num) {
        if (typeof num === 'string') {
            if (num.startsWith('0x')) {
                return '#' + num.substring(2);
            }
            return num;
        }
        
        const hex = num.toString(16).padStart(6, '0');
        return '#' + hex;
    }
    
    /**
     * Lighten a color
     */
    lightenColor(color, amount = 0.2) {
        // Defensive check
        if (!color && color !== 0) {
            console.warn('[SimplePreview] lightenColor received empty color, using white');
            return '#FFFFFF';
        }
        
        // Handle both number (0xFF0000) and string (#FF0000) formats
        let hex;
        
        try {
            if (typeof color === 'number') {
                // Convert number to hex string
                hex = color.toString(16).padStart(6, '0');
            } else if (typeof color === 'string') {
                // Check if it's already a processed color string starting with #
                if (color.startsWith('#') && color.length === 7) {
                    // Already a valid hex color, just remove #
                    hex = color.substring(1);
                } else if (color.startsWith('0x')) {
                    // Remove 0x prefix
                    hex = color.substring(2);
                } else if (color.length === 6) {
                    // Already a plain hex string
                    hex = color;
                } else {
                    // Remove # or any other characters
                    hex = color.replace(/[^0-9a-fA-F]/g, '');
                }
            } else {
                console.warn('[SimplePreview] lightenColor received invalid color type:', typeof color, color);
                hex = 'FFFFFF';
            }
            
            // Ensure hex is 6 characters
            if (hex.length !== 6) {
                console.warn('[SimplePreview] Invalid hex length:', hex);
                hex = 'FFFFFF';
            }
            
            const r = parseInt(hex.substring(0, 2), 16) || 0;
            const g = parseInt(hex.substring(2, 4), 16) || 0;
            const b = parseInt(hex.substring(4, 6), 16) || 0;
            
            // Lighten
            const newR = Math.min(255, r + (255 - r) * amount);
            const newG = Math.min(255, g + (255 - g) * amount);
            const newB = Math.min(255, b + (255 - b) * amount);
            
            // Convert back to hex
            return '#' + 
                Math.round(newR).toString(16).padStart(2, '0') +
                Math.round(newG).toString(16).padStart(2, '0') +
                Math.round(newB).toString(16).padStart(2, '0');
                
        } catch (error) {
            console.error('[SimplePreview] Error in lightenColor:', error, 'Color was:', color);
            return '#FFFFFF'; // Return white as fallback
        }
    }
    
    /**
     * Get type icon
     */
    getTypeIcon(type) {
        const icons = {
            enemy: 'E',
            boss: 'B',
            elite: '★',
            unique: '♦',
            powerup: '↑',
            projectile: '•',
            loot: '□',
            drop: '•',
            spawn: '~',
            player: 'P',
            system: '⚙'
        };
        
        return icons[type] || '?';
    }
}

export default SimplePreview;