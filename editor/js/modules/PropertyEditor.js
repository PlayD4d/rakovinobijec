/**
 * PropertyEditor.js - Dynamic form generation for blueprint properties
 * Creates appropriate input fields based on property types
 */

import { FieldDefinitions } from './FieldDefinitions.js';
import { AudioBrowser } from './AudioBrowser.js';

export class PropertyEditor {
    constructor(editor) {
        this.editor = editor;
        this.currentBlueprint = null;
        this.formContainer = document.getElementById('property-form');
        this.fieldDefs = FieldDefinitions;
        this.audioBrowser = new AudioBrowser(editor);
        
        // Enhanced audio preview management
        this.activeAudioPreviews = new Map(); // Track multiple audio elements and their buttons
        
        this.init();
    }
    
    init() {
        // Setup button handlers
        document.getElementById('btn-collapse-all').addEventListener('click', () => this.collapseAll());
        document.getElementById('btn-expand-all').addEventListener('click', () => this.expandAll());
        document.getElementById('btn-validate').addEventListener('click', () => this.validate());
        
        // Listen to editor events
        this.editor.on('blueprint:loaded', (data) => {
            this.currentBlueprint = data.blueprint;
            this.render();
        });
        
        this.editor.on('blueprint:created', (data) => {
            this.currentBlueprint = data.blueprint;
            this.render();
        });
    }
    
    /**
     * Render the property form
     */
    render() {
        if (!this.currentBlueprint) {
            this.formContainer.innerHTML = '<div class="form-placeholder">Select a blueprint to edit</div>';
            return;
        }
        
        this.formContainer.innerHTML = '';
        
        // Create form groups for each top-level property
        const groups = this.createPropertyGroups(this.currentBlueprint);
        
        for (const group of groups) {
            this.formContainer.appendChild(group);
        }
    }
    
    /**
     * Create property groups
     */
    createPropertyGroups(blueprint) {
        const groups = [];
        const skipFields = ['_temp', '_cache']; // Internal fields to skip
        
        // Group properties by category
        const categories = {
            basic: ['id', 'type', 'name'],
            stats: ['stats'],
            mechanics: ['mechanics'],
            graphics: ['graphics', 'visuals'],
            ai: ['ai'],
            combat: ['damage', 'physics', 'multipliers'],
            display: ['display'],
            vfx: ['vfx'],
            sfx: ['sfx'],
            other: []
        };
        
        // Categorize properties
        const categorized = {};
        for (const key of Object.keys(blueprint)) {
            if (skipFields.includes(key)) continue;
            
            let found = false;
            for (const [category, fields] of Object.entries(categories)) {
                if (fields.includes(key)) {
                    if (!categorized[category]) categorized[category] = {};
                    categorized[category][key] = blueprint[key];
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                if (!categorized.other) categorized.other = {};
                categorized.other[key] = blueprint[key];
            }
        }
        
        // Create groups
        for (const [category, properties] of Object.entries(categorized)) {
            if (Object.keys(properties).length === 0) continue;
            
            const group = this.createGroup(category, properties, '');
            groups.push(group);
        }
        
        return groups;
    }
    
    /**
     * Create a property group
     */
    createGroup(name, properties, path) {
        const group = document.createElement('div');
        group.className = 'property-group';
        
        // Group header
        const header = document.createElement('div');
        header.className = 'property-group-header';
        const toggle = document.createElement('span');
        toggle.className = 'property-group-toggle';
        toggle.textContent = '▼';
        const title = document.createElement('span');
        title.className = 'property-group-title';
        title.textContent = this.formatName(name);
        header.appendChild(toggle);
        header.appendChild(title);
        
        // Toggle collapse/expand
        let expanded = true;
        header.addEventListener('click', () => {
            expanded = !expanded;
            header.querySelector('.property-group-toggle').textContent = expanded ? '▼' : '▶';
            content.style.display = expanded ? 'block' : 'none';
        });
        
        group.appendChild(header);
        
        // Group content
        const content = document.createElement('div');
        content.className = 'property-group-content';
        
        // Create fields for each property
        for (const [key, value] of Object.entries(properties)) {
            const fieldPath = path ? `${path}.${key}` : key;
            const field = this.createField(key, value, fieldPath);
            content.appendChild(field);
        }
        
        group.appendChild(content);
        
        return group;
    }
    
    /**
     * Create a form field
     */
    createField(name, value, path) {
        const field = document.createElement('div');
        field.className = 'property-field';
        
        // Check for special field definitions first
        const fieldDef = this.fieldDefs.getFieldDef(path, this.currentBlueprint?.type);
        
        if (fieldDef) {
            // Use specialized field based on definition
            switch (fieldDef.type) {
                case 'select':
                    field.appendChild(this.createSelectField(name, value, path, fieldDef));
                    break;
                case 'color':
                    field.appendChild(this.createColorField(name, value, path, fieldDef));
                    break;
                case 'range':
                    field.appendChild(this.createRangeField(name, value, path, fieldDef));
                    break;
                case 'modifier-editor':
                    field.appendChild(this.createModifierEditor(name, value, path, fieldDef));
                    break;
                case 'phase-editor':
                    field.appendChild(this.createPhaseEditor(name, value, path, fieldDef));
                    break;
                case 'ability-editor':
                    field.appendChild(this.createAbilityEditor(name, value, path, fieldDef));
                    break;
                case 'reference':
                    field.appendChild(this.createReferenceField(name, value, path, fieldDef));
                    break;
                case 'vfx-selector':
                    field.appendChild(this.createVFXSelector(name, value, path, fieldDef));
                    break;
                case 'sfx-selector':
                    field.appendChild(this.createSFXSelector(name, value, path, fieldDef));
                    break;
                case 'path-selector':
                    field.appendChild(this.createPathSelector(name, value, path, fieldDef));
                    break;
                case 'checkbox':
                    field.appendChild(this.createBooleanField(name, value, path, fieldDef));
                    break;
                case 'number':
                    field.appendChild(this.createNumberField(name, value, path, fieldDef));
                    break;
                case 'audio':
                    field.appendChild(this.createAudioField(name, value, path, fieldDef));
                    break;
                case 'audio_array':
                    field.appendChild(this.createAudioArrayField(name, value, path, fieldDef));
                    break;
                default:
                    // Fall back to default handling
                    field.appendChild(this.createDefaultField(name, value, path));
            }
        } else {
            // No special definition, use default handling
            field.appendChild(this.createDefaultField(name, value, path));
        }
        
        return field;
    }
    
    /**
     * Create default field based on value type
     */
    createDefaultField(name, value, path) {
        if (value === null || value === undefined) {
            return this.createNullField(name, path);
        } else if (Array.isArray(value)) {
            return this.createArrayField(name, value, path);
        } else if (typeof value === 'object') {
            // Top-level sfx/vfx objects are handled by their own category group — don't double-render
            if (this._isAudioObject(value) && !['sfx', 'vfx'].includes(name)) {
                return this.createNestedAudioField(name, value, path);
            }
            return this.createObjectField(name, value, path);
        } else if (typeof value === 'boolean') {
            return this.createBooleanField(name, value, path);
        } else if (typeof value === 'number') {
            return this.createNumberField(name, value, path);
        } else {
            // Check if this is an audio file path before treating as text
            if (this._isAudioField(path, value)) {
                return this.createSFXSelector(name, value, path, { type: 'sfx-selector' });
            }
            return this.createTextField(name, value, path);
        }
    }
    
    /**
     * Create text input field
     */
    createTextField(name, value, path) {
        // Check if value looks like a color (hex format or starts with #/0x)
        const isColorValue = this.isColorValue(value) || 
                           name.toLowerCase().includes('color') || 
                           name.toLowerCase().includes('tint');
        
        // If it's a color, use the color field instead
        if (isColorValue) {
            return this.createColorField(name, value, path, {});
        }
        
        const container = document.createElement('div');
        
        const label = document.createElement('label');
        label.className = 'property-label';
        label.textContent = this.formatName(name);
        container.appendChild(label);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'property-input';
        input.value = value;
        input.dataset.path = path;
        
        input.addEventListener('change', () => {
            this.handleChange(path, input.value);
        });
        
        container.appendChild(input);
        
        return container;
    }
    
    /**
     * Check if a value looks like a color
     */
    isColorValue(value) {
        if (typeof value === 'string') {
            // Check for hex color formats: #RGB, #RRGGBB, 0xRRGGBB
            return /^#([A-Fa-f0-9]{3}){1,2}$/.test(value) || 
                   /^0x[A-Fa-f0-9]{6}$/i.test(value) ||
                   /^rgb\(/.test(value) ||
                   /^rgba\(/.test(value);
        } else if (typeof value === 'number') {
            // Numbers that look like hex colors (e.g., 0xFF5722)
            return value > 0 && value <= 0xFFFFFF;
        }
        return false;
    }
    
    /**
     * Check if an object contains only audio file paths
     */
    _isAudioObject(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
        
        const values = Object.values(obj);
        if (values.length === 0) return false;
        
        // Check if all values are strings that look like audio file paths
        return values.every(val => 
            typeof val === 'string' && 
            (val.match(/\.(mp3|ogg|wav|m4a|flac)$/i) || val.startsWith('sound/') || val.startsWith('sfx.'))
        );
    }
    
    /**
     * Check if a field path or value indicates an audio field
     */
    _isAudioField(path, value) {
        // Check path for audio-related keywords
        const audioPathKeywords = ['sfx', 'music', 'sound', 'audio', 'backgroundMusic'];
        const pathContainsAudio = audioPathKeywords.some(keyword => 
            path.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // Check value for audio file extension
        const valueIsAudio = typeof value === 'string' && 
            (value.match(/\.(mp3|ogg|wav|m4a|flac)$/i) || 
             value.startsWith('sound/') || 
             value.startsWith('sfx.') ||
             value.startsWith('music/'));
        
        return pathContainsAudio || valueIsAudio;
    }
    
    /**
     * Create select dropdown field
     */
    createSelectField(name, value, path, fieldDef) {
        const container = document.createElement('div');
        
        // Label with tooltip
        const labelWrapper = document.createElement('div');
        labelWrapper.style.display = 'flex';
        labelWrapper.style.alignItems = 'center';
        labelWrapper.style.gap = '8px';
        
        const label = document.createElement('label');
        label.className = 'property-label';
        label.textContent = this.formatName(name);
        labelWrapper.appendChild(label);
        
        if (fieldDef.tooltip) {
            const tooltip = document.createElement('span');
            tooltip.className = 'tooltip-icon';
            tooltip.textContent = '?';
            tooltip.title = fieldDef.tooltip;
            tooltip.style.cursor = 'help';
            tooltip.style.background = 'var(--accent-green)';
            tooltip.style.color = 'white';
            tooltip.style.borderRadius = '50%';
            tooltip.style.width = '16px';
            tooltip.style.height = '16px';
            tooltip.style.display = 'inline-flex';
            tooltip.style.alignItems = 'center';
            tooltip.style.justifyContent = 'center';
            tooltip.style.fontSize = '11px';
            labelWrapper.appendChild(tooltip);
        }
        
        container.appendChild(labelWrapper);
        
        // Select input
        const select = document.createElement('select');
        select.className = 'property-input';
        select.dataset.path = path;
        
        // Add options
        const options = fieldDef.options || [];
        options.forEach(option => {
            const optElement = document.createElement('option');
            optElement.value = option;
            optElement.textContent = this.formatOptionName(option);
            if (value === option) {
                optElement.selected = true;
            }
            select.appendChild(optElement);
        });
        
        // If current value is not in options, add it
        if (value && !options.includes(value)) {
            const customOption = document.createElement('option');
            customOption.value = value;
            customOption.textContent = `${value} (custom)`;
            customOption.selected = true;
            select.appendChild(customOption);
        }
        
        select.addEventListener('change', () => {
            this.handleChange(path, select.value);
        });
        
        container.appendChild(select);
        
        return container;
    }
    
    /**
     * Create color picker field
     */
    createColorField(name, value, path, fieldDef) {
        const container = document.createElement('div');
        container.className = 'color-field-wrapper';
        
        // Label with optional tooltip
        const labelWrapper = document.createElement('div');
        labelWrapper.style.display = 'flex';
        labelWrapper.style.alignItems = 'center';
        labelWrapper.style.gap = '8px';
        
        const label = document.createElement('label');
        label.className = 'property-label';
        label.textContent = this.formatName(name);
        labelWrapper.appendChild(label);
        
        if (fieldDef && fieldDef.tooltip) {
            const tooltip = document.createElement('span');
            tooltip.className = 'tooltip-icon';
            tooltip.textContent = '?';
            tooltip.title = fieldDef.tooltip;
            tooltip.style.cursor = 'help';
            tooltip.style.background = 'var(--accent-green)';
            tooltip.style.color = 'white';
            tooltip.style.borderRadius = '50%';
            tooltip.style.width = '16px';
            tooltip.style.height = '16px';
            tooltip.style.display = 'inline-flex';
            tooltip.style.alignItems = 'center';
            tooltip.style.justifyContent = 'center';
            tooltip.style.fontSize = '11px';
            labelWrapper.appendChild(tooltip);
        }
        
        container.appendChild(labelWrapper);
        
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.gap = '8px';
        wrapper.style.alignItems = 'center';
        
        // Text input for hex value
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'property-input color-input';
        // PR7: Display number values as 0x format
        if (typeof value === 'number') {
            input.value = '0x' + value.toString(16).toUpperCase().padStart(6, '0');
        } else if (typeof value === 'string') {
            input.value = value;
        } else {
            input.value = '0xFFFFFF';
        }
        input.dataset.path = path;
        input.style.flex = '1';
        input.style.fontFamily = 'monospace';
        input.placeholder = '#RRGGBB or 0xRRGGBB';
        
        // Color picker button (bigger and more prominent)
        const colorPickerWrapper = document.createElement('div');
        colorPickerWrapper.style.position = 'relative';
        colorPickerWrapper.style.width = '50px';
        colorPickerWrapper.style.height = '34px';
        
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.style.position = 'absolute';
        colorPicker.style.width = '100%';
        colorPicker.style.height = '100%';
        colorPicker.style.opacity = '0';
        colorPicker.style.cursor = 'pointer';
        
        const colorPreview = document.createElement('div');
        colorPreview.className = 'color-preview-button';
        colorPreview.style.width = '100%';
        colorPreview.style.height = '100%';
        colorPreview.style.border = '2px solid var(--border-color)';
        colorPreview.style.borderRadius = '4px';
        colorPreview.style.cursor = 'pointer';
        colorPreview.style.position = 'relative';
        colorPreview.style.overflow = 'hidden';
        colorPreview.title = 'Click to open color picker';
        
        // Add gradient background to show transparency
        colorPreview.style.backgroundImage = `
            linear-gradient(45deg, #ccc 25%, transparent 25%),
            linear-gradient(-45deg, #ccc 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #ccc 75%),
            linear-gradient(-45deg, transparent 75%, #ccc 75%)
        `;
        colorPreview.style.backgroundSize = '8px 8px';
        colorPreview.style.backgroundPosition = '0 0, 0 4px, 4px -4px, -4px 0px';
        
        const colorOverlay = document.createElement('div');
        colorOverlay.style.position = 'absolute';
        colorOverlay.style.top = '0';
        colorOverlay.style.left = '0';
        colorOverlay.style.right = '0';
        colorOverlay.style.bottom = '0';
        colorPreview.appendChild(colorOverlay);
        
        // Helper function to normalize color value for display
        const normalizeColor = (val) => {
            if (!val && val !== 0) return '#FFFFFF';
            
            // PR7: Handle number values
            if (typeof val === 'number') {
                return '#' + val.toString(16).toUpperCase().padStart(6, '0');
            }
            // If it's already in # format
            else if (typeof val === 'string' && val.startsWith('#')) {
                return val.toUpperCase();
            }
            // If it's in 0x format
            else if (typeof val === 'string' && val.toLowerCase().startsWith('0x')) {
                return '#' + val.substring(2).toUpperCase();
            }
            // If it's a string number
            else if (!isNaN(val)) {
                const hex = parseInt(val).toString(16).padStart(6, '0');
                return '#' + hex.toUpperCase();
            }
            // Default
            return '#FFFFFF';
        };
        
        // Convert value to color picker format and update preview
        const updateColorDisplay = () => {
            const normalizedColor = normalizeColor(input.value);
            colorPicker.value = normalizedColor;
            colorOverlay.style.backgroundColor = normalizedColor;
        };
        
        updateColorDisplay();
        
        // Handle text input changes
        input.addEventListener('input', () => {
            updateColorDisplay();
        });
        
        input.addEventListener('change', () => {
            // PR7: Convert color to number format
            let colorValue;
            const inputVal = input.value.trim();
            
            if (inputVal.toLowerCase().startsWith('0x')) {
                colorValue = parseInt(inputVal.substring(2), 16);
            } else if (inputVal.startsWith('#')) {
                colorValue = parseInt(inputVal.substring(1), 16);
            } else {
                // Try to parse as hex number
                colorValue = parseInt(inputVal, 16);
            }
            
            // Only update if we got a valid number
            if (!isNaN(colorValue)) {
                this.handleChange(path, colorValue);
                // Update display to show 0x format
                input.value = '0x' + colorValue.toString(16).toUpperCase().padStart(6, '0');
            }
            updateColorDisplay();
        });
        
        // Handle color picker changes
        colorPicker.addEventListener('input', () => {
            // Keep the format the user prefers
            if (input.value.toLowerCase().startsWith('0x')) {
                input.value = '0x' + colorPicker.value.substring(1).toUpperCase();
            } else {
                input.value = colorPicker.value.toUpperCase();
            }
            colorOverlay.style.backgroundColor = colorPicker.value;
        });
        
        colorPicker.addEventListener('change', () => {
            // PR7: Always save as number, display as 0x format
            const hexValue = parseInt(colorPicker.value.substring(1), 16);
            input.value = '0x' + hexValue.toString(16).toUpperCase().padStart(6, '0');
            this.handleChange(path, hexValue);
        });
        
        // Make preview clickable
        colorPreview.addEventListener('click', () => {
            colorPicker.click();
        });
        
        colorPickerWrapper.appendChild(colorPreview);
        colorPickerWrapper.appendChild(colorPicker);
        
        wrapper.appendChild(input);
        wrapper.appendChild(colorPickerWrapper);
        
        // Add preset colors
        const presets = document.createElement('div');
        presets.className = 'color-presets';
        presets.style.display = 'flex';
        presets.style.gap = '4px';
        presets.style.marginTop = '8px';
        
        const presetColors = [
            '#FF0000', // Red
            '#00FF00', // Green  
            '#0000FF', // Blue
            '#FFFF00', // Yellow
            '#FF00FF', // Magenta
            '#00FFFF', // Cyan
            '#FFA500', // Orange
            '#800080', // Purple
            '#4CAF50', // Material Green
            '#2196F3', // Material Blue
        ];
        
        presetColors.forEach(color => {
            const preset = document.createElement('div');
            preset.style.width = '20px';
            preset.style.height = '20px';
            preset.style.backgroundColor = color;
            preset.style.border = '1px solid var(--border-color)';
            preset.style.borderRadius = '3px';
            preset.style.cursor = 'pointer';
            preset.title = color;
            
            preset.addEventListener('click', () => {
                colorPicker.value = color;
                if (input.value.toLowerCase().startsWith('0x')) {
                    input.value = '0x' + color.substring(1).toUpperCase();
                } else {
                    input.value = color.toUpperCase();
                }
                colorOverlay.style.backgroundColor = color;
                this.handleChange(path, input.value);
            });
            
            presets.appendChild(preset);
        });
        
        container.appendChild(wrapper);
        container.appendChild(presets);
        
        return container;
    }
    
    /**
     * Create range slider field
     */
    createRangeField(name, value, path, fieldDef) {
        const container = document.createElement('div');
        
        const label = document.createElement('label');
        label.className = 'property-label';
        label.textContent = `${this.formatName(name)}: ${value}`;
        if (fieldDef.tooltip) label.title = fieldDef.tooltip;
        container.appendChild(label);
        
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.gap = '8px';
        wrapper.style.alignItems = 'center';
        
        // Range slider
        const range = document.createElement('input');
        range.type = 'range';
        range.className = 'property-input';
        range.min = fieldDef.min || 0;
        range.max = fieldDef.max || 1;
        range.step = fieldDef.step || 0.01;
        range.value = value;
        range.dataset.path = path;
        range.style.flex = '1';
        
        // Number input
        const number = document.createElement('input');
        number.type = 'number';
        number.className = 'property-input';
        number.min = fieldDef.min || 0;
        number.max = fieldDef.max || 1;
        number.step = fieldDef.step || 0.01;
        number.value = value;
        number.style.width = '80px';
        
        range.addEventListener('input', () => {
            number.value = range.value;
            label.textContent = `${this.formatName(name)}: ${range.value}`;
            this.handleChange(path, parseFloat(range.value));
        });
        
        number.addEventListener('change', () => {
            range.value = number.value;
            label.textContent = `${this.formatName(name)}: ${number.value}`;
            this.handleChange(path, parseFloat(number.value));
        });
        
        wrapper.appendChild(range);
        wrapper.appendChild(number);
        container.appendChild(wrapper);
        
        return container;
    }
    
    /**
     * Create modifier editor button
     */
    createModifierEditor(name, value, path, fieldDef) {
        const container = document.createElement('div');
        
        const label = document.createElement('label');
        label.className = 'property-label';
        label.textContent = `${this.formatName(name)} (${Array.isArray(value) ? value.length : 0} modifiers)`;
        if (fieldDef.tooltip) label.title = fieldDef.tooltip;
        container.appendChild(label);
        
        const button = document.createElement('button');
        button.className = 'property-button';
        button.textContent = 'Edit Modifiers';
        button.style.width = '100%';
        button.style.padding = '8px';
        button.style.background = 'var(--accent-green)';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '3px';
        button.style.cursor = 'pointer';
        
        button.addEventListener('click', () => {
            this.openModifierEditor(path, value);
        });
        
        container.appendChild(button);
        
        if (fieldDef.help) {
            const help = document.createElement('div');
            help.className = 'property-help';
            help.textContent = fieldDef.help;
            help.style.fontSize = '11px';
            help.style.color = 'var(--text-secondary)';
            help.style.marginTop = '4px';
            container.appendChild(help);
        }
        
        return container;
    }
    
    /**
     * Create number input field
     */
    createNumberField(name, value, path, fieldDef = {}) {
        const container = document.createElement('div');
        
        // Label with optional tooltip
        const labelWrapper = document.createElement('div');
        labelWrapper.style.display = 'flex';
        labelWrapper.style.alignItems = 'center';
        labelWrapper.style.gap = '8px';
        
        const label = document.createElement('label');
        label.className = 'property-label';
        label.textContent = this.formatName(name);
        labelWrapper.appendChild(label);
        
        if (fieldDef.tooltip) {
            const tooltip = document.createElement('span');
            tooltip.className = 'tooltip-icon';
            tooltip.textContent = '?';
            tooltip.title = fieldDef.tooltip;
            tooltip.style.cursor = 'help';
            tooltip.style.background = 'var(--accent-green)';
            tooltip.style.color = 'white';
            tooltip.style.borderRadius = '50%';
            tooltip.style.width = '16px';
            tooltip.style.height = '16px';
            tooltip.style.display = 'inline-flex';
            tooltip.style.alignItems = 'center';
            tooltip.style.justifyContent = 'center';
            tooltip.style.fontSize = '11px';
            labelWrapper.appendChild(tooltip);
        }
        
        container.appendChild(labelWrapper);
        
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'property-input';
        input.value = value;
        input.dataset.path = path;
        
        // Use fieldDef if available, otherwise use defaults based on name
        if (fieldDef.min !== undefined) input.min = fieldDef.min;
        else if (name.includes('hp') || name.includes('damage')) input.min = 0;
        else if (name.includes('speed')) input.min = 0;
        else if (name.includes('scale') || name.includes('multiplier')) input.min = 0;
        else if (name.includes('chance') || name.includes('threshold')) input.min = 0;
        
        if (fieldDef.max !== undefined) input.max = fieldDef.max;
        else if (name.includes('speed')) input.max = 1000;
        else if (name.includes('scale') || name.includes('multiplier')) input.max = 10;
        else if (name.includes('chance') || name.includes('threshold')) input.max = 1;
        
        if (fieldDef.step !== undefined) input.step = fieldDef.step;
        else if (name.includes('hp') || name.includes('damage')) input.step = 1;
        else if (name.includes('speed')) input.step = 5;
        else if (name.includes('scale') || name.includes('multiplier')) input.step = 0.1;
        else if (name.includes('chance') || name.includes('threshold')) input.step = 0.01;
        else input.step = 'any';
        
        input.addEventListener('change', () => {
            this.handleChange(path, parseFloat(input.value));
        });
        
        container.appendChild(input);
        
        return container;
    }
    
    /**
     * Create boolean field
     */
    createBooleanField(name, value, path) {
        const container = document.createElement('div');
        
        const label = document.createElement('label');
        label.className = 'property-label';
        label.style.display = 'inline-block';
        label.style.marginRight = '10px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = value;
        checkbox.dataset.path = path;
        
        checkbox.addEventListener('change', () => {
            this.handleChange(path, checkbox.checked);
        });
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + this.formatName(name)));
        
        container.appendChild(label);
        
        return container;
    }
    
    /**
     * Create array field
     */
    createArrayField(name, value, path) {
        const container = document.createElement('div');
        
        const label = document.createElement('label');
        label.className = 'property-label';
        label.textContent = `${this.formatName(name)} (${value.length} items)`;
        container.appendChild(label);
        
        const arrayEditor = document.createElement('div');
        arrayEditor.className = 'array-editor';
        
        // Special handling for loot table entries and drops array
        const isLootEntries = path.includes('pools') && path.includes('entries');
        const isDropsArray = path === 'drops';
        
        // Render array items
        value.forEach((item, index) => {
            const itemContainer = document.createElement('div');
            itemContainer.className = 'array-item';
            
            // Add special styling for loot entries and drops
            if (isLootEntries && item.ref) {
                itemContainer.className += ' loot-entry-item';
            } else if (isDropsArray) {
                itemContainer.className += ' drop-item';
            }
            
            const itemContent = document.createElement('div');
            itemContent.className = 'array-item-content';
            
            // Create custom display for different types
            if (isLootEntries && item.ref) {
                const entryDisplay = this.createLootEntryDisplay(item, `${path}[${index}]`);
                itemContent.appendChild(entryDisplay);
            } else if (isDropsArray) {
                const dropDisplay = this.createDropDisplay(item, `${path}[${index}]`);
                itemContent.appendChild(dropDisplay);
            } else {
                const itemPath = `${path}[${index}]`;
                const itemField = this.createField(`[${index}]`, item, itemPath);
                itemContent.appendChild(itemField);
            }
            
            itemContainer.appendChild(itemContent);
            
            // Remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'array-item-remove';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                value.splice(index, 1);
                this.handleChange(path, value);
                this.render();
            });
            
            itemContainer.appendChild(removeBtn);
            arrayEditor.appendChild(itemContainer);
        });
        
        // Add button
        const addBtn = document.createElement('button');
        addBtn.className = 'array-add';
        addBtn.textContent = '+ Add Item';
        addBtn.addEventListener('click', () => {
            // Determine default value based on existing items
            let defaultValue = '';
            
            // Special default for drops array
            if (isDropsArray) {
                defaultValue = {
                    itemId: 'item.xp_small',
                    chance: 0.5,
                    quantity: 1
                };
            } else if (isLootEntries) {
                defaultValue = {
                    ref: 'drop.xp_small',
                    weight: 0.5,
                    qty: { min: 1, max: 1 }
                };
            } else if (value.length > 0) {
                const firstItem = value[0];
                if (typeof firstItem === 'object') {
                    defaultValue = JSON.parse(JSON.stringify(firstItem));
                } else if (typeof firstItem === 'number') {
                    defaultValue = 0;
                } else if (typeof firstItem === 'boolean') {
                    defaultValue = false;
                }
            }
            
            value.push(defaultValue);
            this.handleChange(path, value);
            this.render();
        });
        
        arrayEditor.appendChild(addBtn);
        container.appendChild(arrayEditor);
        
        return container;
    }
    
    /**
     * Create custom display for loot table entries
     */
    createLootEntryDisplay(entry, path) {
        const container = document.createElement('div');
        container.className = 'loot-entry-display';
        
        // Create a summary header
        const header = document.createElement('div');
        header.className = 'loot-entry-header';
        
        // Extract the drop name from ref (e.g., "drop.xp_small" -> "XP Small")
        const dropName = entry.ref ? entry.ref.replace('drop.', '').replace(/_/g, ' ').toUpperCase() : 'Unknown Drop';
        const weight = entry.weight || 0;
        const minQty = entry.qty?.min || 1;
        const maxQty = entry.qty?.max || 1;
        
        // Create icon based on drop type
        let icon = '📦';
        if (entry.ref?.includes('xp')) icon = '⭐';
        else if (entry.ref?.includes('health') || entry.ref?.includes('heal')) icon = '❤️';
        else if (entry.ref?.includes('energy')) icon = '⚡';
        else if (entry.ref?.includes('research')) icon = '🔬';
        else if (entry.ref?.includes('protein')) icon = '🥩';
        else if (entry.ref?.includes('adrenal')) icon = '💉';
        
        header.innerHTML = `
            <div class="loot-entry-summary">
                <span class="loot-icon">${icon}</span>
                <span class="loot-name">${dropName}</span>
                <span class="loot-weight">${(weight * 100).toFixed(0)}%</span>
                <span class="loot-qty">${minQty === maxQty ? `×${minQty}` : `×${minQty}-${maxQty}`}</span>
            </div>
        `;
        
        container.appendChild(header);
        
        // Create expandable details section
        const details = document.createElement('div');
        details.className = 'loot-entry-details';
        details.style.display = 'none';
        
        // Create fields for each property
        Object.entries(entry).forEach(([key, value]) => {
            const fieldPath = `${path}.${key}`;
            const field = this.createField(key, value, fieldPath);
            details.appendChild(field);
        });
        
        container.appendChild(details);
        
        // Toggle details on header click
        header.addEventListener('click', () => {
            details.style.display = details.style.display === 'none' ? 'block' : 'none';
            header.classList.toggle('expanded');
        });
        
        return container;
    }
    
    /**
     * Create custom display for drops array (new loot system)
     */
    createDropDisplay(drop, path) {
        const container = document.createElement('div');
        container.className = 'drop-display';
        container.style.padding = '8px';
        container.style.background = 'var(--bg-lighter)';
        container.style.borderRadius = '4px';
        container.style.marginBottom = '4px';
        
        // Get item data from FieldDefinitions
        const fieldDefs = FieldDefinitions.instance || new FieldDefinitions();
        const itemData = fieldDefs.itemData || {};
        
        // Find the item details
        let itemDetails = null;
        let itemCategory = null;
        
        for (const [category, items] of Object.entries(itemData)) {
            const found = items.find(item => item.id === drop.itemId);
            if (found) {
                itemDetails = found;
                itemCategory = category;
                break;
            }
        }
        
        // Create header with item preview
        const header = document.createElement('div');
        header.className = 'drop-header';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.gap = '12px';
        header.style.marginBottom = '8px';
        
        // Item icon
        const icon = document.createElement('span');
        icon.className = 'drop-icon';
        icon.style.fontSize = '24px';
        icon.style.width = '30px';
        icon.style.textAlign = 'center';
        icon.textContent = itemDetails?.icon || '📦';
        header.appendChild(icon);
        
        // Item info
        const info = document.createElement('div');
        info.style.flex = '1';
        
        const itemName = document.createElement('div');
        itemName.className = 'drop-name';
        itemName.style.fontWeight = 'bold';
        itemName.style.fontSize = '14px';
        itemName.textContent = itemDetails?.name || drop.itemId || 'Unknown Item';
        info.appendChild(itemName);
        
        const itemId = document.createElement('div');
        itemId.className = 'drop-id';
        itemId.style.fontSize = '11px';
        itemId.style.color = 'var(--text-secondary)';
        itemId.textContent = drop.itemId || 'No ID';
        info.appendChild(itemId);
        
        header.appendChild(info);
        
        // Chance display
        const chanceDisplay = document.createElement('div');
        chanceDisplay.className = 'drop-chance';
        chanceDisplay.style.textAlign = 'right';
        
        const chancePercent = document.createElement('div');
        chancePercent.style.fontSize = '16px';
        chancePercent.style.fontWeight = 'bold';
        chancePercent.style.color = this.getChanceColor(drop.chance || 0);
        chancePercent.textContent = `${((drop.chance || 0) * 100).toFixed(1)}%`;
        chanceDisplay.appendChild(chancePercent);
        
        const chanceLabel = document.createElement('div');
        chanceLabel.style.fontSize = '10px';
        chanceLabel.style.color = 'var(--text-secondary)';
        chanceLabel.textContent = 'Drop Chance';
        chanceDisplay.appendChild(chanceLabel);
        
        header.appendChild(chanceDisplay);
        
        container.appendChild(header);
        
        // Create fields section
        const fields = document.createElement('div');
        fields.className = 'drop-fields';
        fields.style.display = 'grid';
        fields.style.gridTemplateColumns = '1fr 1fr 1fr';
        fields.style.gap = '8px';
        
        // Item ID selector
        const itemIdField = document.createElement('div');
        itemIdField.style.gridColumn = 'span 2';
        
        const itemIdLabel = document.createElement('label');
        itemIdLabel.style.fontSize = '11px';
        itemIdLabel.style.color = 'var(--text-secondary)';
        itemIdLabel.style.display = 'block';
        itemIdLabel.style.marginBottom = '2px';
        itemIdLabel.textContent = 'Item ID';
        itemIdField.appendChild(itemIdLabel);
        
        const itemIdSelect = document.createElement('select');
        itemIdSelect.className = 'property-input';
        itemIdSelect.style.width = '100%';
        itemIdSelect.value = drop.itemId || '';
        
        // Add optgroups for each category
        for (const [category, items] of Object.entries(itemData)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category.charAt(0).toUpperCase() + category.slice(1);
            
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.icon} ${item.name}`;
                if (drop.itemId === item.id) {
                    option.selected = true;
                }
                optgroup.appendChild(option);
            });
            
            itemIdSelect.appendChild(optgroup);
        }
        
        // Add custom option if current value not in list
        if (drop.itemId && !itemDetails) {
            const customOption = document.createElement('option');
            customOption.value = drop.itemId;
            customOption.textContent = `${drop.itemId} (custom)`;
            customOption.selected = true;
            itemIdSelect.appendChild(customOption);
        }
        
        itemIdSelect.addEventListener('change', () => {
            drop.itemId = itemIdSelect.value;
            this.handleChange(path, drop);
            this.render(); // Re-render to update icon and name
        });
        
        itemIdField.appendChild(itemIdSelect);
        fields.appendChild(itemIdField);
        
        // Quantity field
        const qtyField = document.createElement('div');
        
        const qtyLabel = document.createElement('label');
        qtyLabel.style.fontSize = '11px';
        qtyLabel.style.color = 'var(--text-secondary)';
        qtyLabel.style.display = 'block';
        qtyLabel.style.marginBottom = '2px';
        qtyLabel.textContent = 'Quantity';
        qtyField.appendChild(qtyLabel);
        
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.className = 'property-input';
        qtyInput.style.width = '100%';
        qtyInput.min = 1;
        qtyInput.max = 100;
        qtyInput.value = drop.quantity || 1;
        
        qtyInput.addEventListener('change', () => {
            drop.quantity = parseInt(qtyInput.value) || 1;
            this.handleChange(path, drop);
        });
        
        qtyField.appendChild(qtyInput);
        fields.appendChild(qtyField);
        
        // Chance slider
        const chanceField = document.createElement('div');
        chanceField.style.gridColumn = 'span 3';
        
        const chanceFieldLabel = document.createElement('label');
        chanceFieldLabel.style.fontSize = '11px';
        chanceFieldLabel.style.color = 'var(--text-secondary)';
        chanceFieldLabel.style.display = 'block';
        chanceFieldLabel.style.marginBottom = '2px';
        chanceFieldLabel.textContent = `Drop Chance: ${((drop.chance || 0) * 100).toFixed(1)}%`;
        chanceField.appendChild(chanceFieldLabel);
        
        const chanceWrapper = document.createElement('div');
        chanceWrapper.style.display = 'flex';
        chanceWrapper.style.gap = '8px';
        chanceWrapper.style.alignItems = 'center';
        
        const chanceSlider = document.createElement('input');
        chanceSlider.type = 'range';
        chanceSlider.className = 'property-input';
        chanceSlider.style.flex = '1';
        chanceSlider.min = 0;
        chanceSlider.max = 1;
        chanceSlider.step = 0.001;
        chanceSlider.value = drop.chance || 0;
        
        const chanceNumber = document.createElement('input');
        chanceNumber.type = 'number';
        chanceNumber.className = 'property-input';
        chanceNumber.style.width = '80px';
        chanceNumber.min = 0;
        chanceNumber.max = 100;
        chanceNumber.step = 0.1;
        chanceNumber.value = ((drop.chance || 0) * 100).toFixed(1);
        
        chanceSlider.addEventListener('input', () => {
            drop.chance = parseFloat(chanceSlider.value);
            chanceNumber.value = (drop.chance * 100).toFixed(1);
            chanceFieldLabel.textContent = `Drop Chance: ${chanceNumber.value}%`;
            chancePercent.textContent = `${chanceNumber.value}%`;
            chancePercent.style.color = this.getChanceColor(drop.chance);
            this.handleChange(path, drop);
        });
        
        chanceNumber.addEventListener('change', () => {
            drop.chance = parseFloat(chanceNumber.value) / 100;
            chanceSlider.value = drop.chance;
            chanceFieldLabel.textContent = `Drop Chance: ${chanceNumber.value}%`;
            chancePercent.textContent = `${chanceNumber.value}%`;
            chancePercent.style.color = this.getChanceColor(drop.chance);
            this.handleChange(path, drop);
        });
        
        chanceWrapper.appendChild(chanceSlider);
        chanceWrapper.appendChild(chanceNumber);
        
        const percentLabel = document.createElement('span');
        percentLabel.textContent = '%';
        percentLabel.style.marginLeft = '-30px';
        percentLabel.style.color = 'var(--text-secondary)';
        chanceWrapper.appendChild(percentLabel);
        
        chanceField.appendChild(chanceWrapper);
        fields.appendChild(chanceField);
        
        container.appendChild(fields);
        
        return container;
    }
    
    /**
     * Get color based on drop chance
     */
    getChanceColor(chance) {
        if (chance >= 0.5) return '#4CAF50';  // Green for common
        if (chance >= 0.2) return '#2196F3';  // Blue for uncommon
        if (chance >= 0.05) return '#9C27B0'; // Purple for rare
        if (chance >= 0.01) return '#FF9800'; // Orange for epic
        return '#F44336';  // Red for legendary
    }
    
    /**
     * Create object field
     */
    createObjectField(name, value, path) {
        // Create a nested group
        return this.createGroup(name, value, path);
    }
    
    /**
     * Create null field
     */
    createNullField(name, path) {
        const container = document.createElement('div');
        
        const label = document.createElement('label');
        label.className = 'property-label';
        label.textContent = this.formatName(name);
        container.appendChild(label);
        
        const select = document.createElement('select');
        select.className = 'property-input';
        select.dataset.path = path;
        
        select.innerHTML = `
            <option value="null">null</option>
            <option value="string">Set as String</option>
            <option value="number">Set as Number</option>
            <option value="boolean">Set as Boolean</option>
            <option value="object">Set as Object</option>
            <option value="array">Set as Array</option>
        `;
        
        select.addEventListener('change', () => {
            let newValue = null;
            switch (select.value) {
                case 'string': newValue = ''; break;
                case 'number': newValue = 0; break;
                case 'boolean': newValue = false; break;
                case 'object': newValue = {}; break;
                case 'array': newValue = []; break;
            }
            
            this.handleChange(path, newValue);
            if (newValue !== null) {
                this.render();
            }
        });
        
        container.appendChild(select);
        
        return container;
    }
    
    /**
     * Handle property change
     */
    handleChange(path, value) {
        this.editor.onPropertyChange(path, value);
    }
    
    /**
     * Format property name for display
     */
    formatName(name) {
        // Convert camelCase to Title Case
        return name
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/_/g, ' ')
            .replace(/\[(\d+)\]/g, 'Item $1');
    }
    
    /**
     * Format option name for display
     */
    formatOptionName(option) {
        return option
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    /**
     * Open modifier editor dialog
     */
    openModifierEditor(path, modifiers) {
        const modal = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = 'Modifier Editor';
        
        // Create modifier editor UI
        let html = `
            <div class="modifier-editor">
                <p style="margin-bottom: 15px;">Modifiers change entity stats dynamically. Each modifier has a path (what to change), type (how to change it), and value.</p>
                <div id="modifier-list">
        `;
        
        if (!Array.isArray(modifiers)) {
            modifiers = [];
        }
        
        modifiers.forEach((mod, index) => {
            html += `
                <div class="modifier-item" style="border: 1px solid var(--border-color); padding: 10px; margin-bottom: 10px; border-radius: 3px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <strong>Modifier ${index + 1}</strong>
                        <button onclick="window.editor.modules.editor.removeModifier('${path}', ${index})" style="background: var(--error-red); color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer;">Remove</button>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="font-size: 11px; color: var(--text-secondary);">Path</label>
                            <input type="text" class="mod-path" data-index="${index}" value="${mod.path || ''}" placeholder="stats.hp" style="width: 100%; padding: 6px; background: var(--bg-dark); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 3px;">
                        </div>
                        <div>
                            <label style="font-size: 11px; color: var(--text-secondary);">Type</label>
                            <select class="mod-type" data-index="${index}" style="width: 100%; padding: 6px; background: var(--bg-dark); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 3px;">
                                <option value="add" ${mod.type === 'add' ? 'selected' : ''}>Add</option>
                                <option value="mul" ${mod.type === 'mul' ? 'selected' : ''}>Multiply</option>
                                <option value="set" ${mod.type === 'set' ? 'selected' : ''}>Set</option>
                                <option value="enable" ${mod.type === 'enable' ? 'selected' : ''}>Enable</option>
                                <option value="disable" ${mod.type === 'disable' ? 'selected' : ''}>Disable</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 11px; color: var(--text-secondary);">Value</label>
                            <input type="text" class="mod-value" data-index="${index}" value="${mod.value !== undefined ? mod.value : ''}" placeholder="10" style="width: 100%; padding: 6px; background: var(--bg-dark); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 3px;">
                        </div>
                    </div>
                    <div style="margin-top: 10px;">
                        <label style="font-size: 11px; color: var(--text-secondary);">Priority (optional)</label>
                        <input type="number" class="mod-priority" data-index="${index}" value="${mod.priority || 100}" style="width: 100px; padding: 6px; background: var(--bg-dark); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 3px;">
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
                <button id="add-modifier-btn" style="width: 100%; padding: 10px; background: var(--accent-green); color: white; border: none; border-radius: 3px; cursor: pointer; margin-top: 10px;">+ Add Modifier</button>
                
                <div style="margin-top: 20px; padding: 15px; background: var(--bg-dark); border-radius: 3px;">
                    <h4 style="margin-bottom: 10px;">Common Modifier Examples:</h4>
                    <ul style="font-size: 12px; line-height: 1.6;">
                        <li><strong>stats.hp, mul, 2</strong> - Double health</li>
                        <li><strong>stats.damage, add, 10</strong> - Add 10 damage</li>
                        <li><strong>stats.speed, mul, 1.5</strong> - 50% faster movement</li>
                        <li><strong>mechanics.resistances, enable, true</strong> - Enable resistances</li>
                        <li><strong>graphics.scale, set, 2</strong> - Make sprite 2x larger</li>
                    </ul>
                </div>
            </div>
        `;
        
        modalBody.innerHTML = html;
        
        // Add event listener for Add button
        document.getElementById('add-modifier-btn').addEventListener('click', () => {
            modifiers.push({
                path: 'stats.hp',
                type: 'mul',
                value: 1.5,
                priority: 100
            });
            this.openModifierEditor(path, modifiers);
        });
        
        // Setup confirm button to save changes
        const confirmBtn = document.getElementById('modal-confirm');
        confirmBtn.onclick = () => {
            // Collect all modifier values
            const updatedModifiers = [];
            modifiers.forEach((mod, index) => {
                const pathInput = document.querySelector(`.mod-path[data-index="${index}"]`);
                const typeInput = document.querySelector(`.mod-type[data-index="${index}"]`);
                const valueInput = document.querySelector(`.mod-value[data-index="${index}"]`);
                const priorityInput = document.querySelector(`.mod-priority[data-index="${index}"]`);
                
                if (pathInput && typeInput && valueInput) {
                    let value = valueInput.value;
                    // Try to parse as number if possible
                    if (!isNaN(value)) {
                        value = parseFloat(value);
                    } else if (value === 'true') {
                        value = true;
                    } else if (value === 'false') {
                        value = false;
                    }
                    
                    updatedModifiers.push({
                        path: pathInput.value,
                        type: typeInput.value,
                        value: value,
                        priority: parseInt(priorityInput.value) || 100
                    });
                }
            });
            
            this.handleChange(path, updatedModifiers);
            this.editor.closeModal();
            this.render(); // Re-render to show updated count
        };
        
        modal.style.display = 'flex';
    }
    
    /**
     * Remove modifier
     */
    removeModifier(path, index) {
        const modifiers = this.getNestedProperty(this.currentBlueprint, path) || [];
        if (Array.isArray(modifiers)) {
            modifiers.splice(index, 1);
            this.openModifierEditor(path, modifiers);
        }
    }
    
    /**
     * Get nested property value
     */
    getNestedProperty(obj, path) {
        const keys = path.split('.');
        return keys.reduce((o, k) => o?.[k], obj);
    }
    
    /**
     * Create placeholder methods for other specialized editors
     */
    createPhaseEditor(name, value, path, fieldDef) {
        return this.createModifierEditor(name, value, path, { ...fieldDef, help: 'Boss phase editor coming soon!' });
    }
    
    createAbilityEditor(name, value, path, fieldDef) {
        return this.createModifierEditor(name, value, path, { ...fieldDef, help: 'Boss ability editor coming soon!' });
    }
    
    createReferenceField(name, value, path, fieldDef) {
        const def = { ...fieldDef, tooltip: fieldDef.tooltip || 'Reference to another blueprint' };
        return this.createTextField(name, value, path, def);
    }
    
    createVFXSelector(name, value, path, fieldDef) {
        const container = document.createElement('div');
        container.className = 'vfx-selector-container';
        
        // Check if value is already an object (direct config)
        const isDirectConfig = typeof value === 'object' && value !== null;
        
        // Create mode toggle
        const modeToggle = document.createElement('div');
        modeToggle.className = 'vfx-mode-toggle';
        modeToggle.style.marginBottom = '10px';
        
        const modeLabel = document.createElement('label');
        modeLabel.style.marginRight = '10px';
        
        const modeCheckbox = document.createElement('input');
        modeCheckbox.type = 'checkbox';
        modeCheckbox.checked = isDirectConfig;
        modeCheckbox.style.marginRight = '5px';
        
        const modeText = document.createElement('span');
        modeText.textContent = 'Direct VFX Config';
        modeText.style.fontSize = '12px';
        
        modeLabel.appendChild(modeCheckbox);
        modeLabel.appendChild(modeText);
        modeToggle.appendChild(modeLabel);
        
        container.appendChild(modeToggle);
        
        // Content container that switches between modes
        const contentContainer = document.createElement('div');
        contentContainer.className = 'vfx-content';
        
        const updateContent = () => {
            contentContainer.innerHTML = '';
            
            if (modeCheckbox.checked) {
                // Direct config mode - show config editor
                const configEditor = this.createVFXConfigEditor(name, value, path, fieldDef);
                contentContainer.appendChild(configEditor);
            } else {
                // Registry ID mode - show dropdown
                const vfxTypes = this.fieldDefs.getVFXTypes();
                const options = vfxTypes[fieldDef.category] || Object.values(vfxTypes).flat();
                const selector = this.createSelectField(name, 
                    typeof value === 'string' ? value : '', 
                    path, 
                    { ...fieldDef, options }
                );
                contentContainer.appendChild(selector);
            }
        };
        
        modeCheckbox.addEventListener('change', () => {
            // Convert between formats when toggling
            if (modeCheckbox.checked) {
                // Switch to object format with default config
                const defaultConfig = {
                    type: fieldDef.category || 'spark',
                    texture: 'spark',
                    quantity: 10,
                    lifespan: 500,
                    speed: { min: 100, max: 200 },
                    scale: { start: 0.5, end: 0 }
                };
                this.handleChange(path, defaultConfig);
            } else {
                // Switch to string format (registry ID)
                const vfxTypes = this.fieldDefs.getVFXTypes();
                const defaultId = vfxTypes[fieldDef.category]?.[0] || 'vfx.default';
                this.handleChange(path, defaultId);
            }
            updateContent();
        });
        
        updateContent();
        container.appendChild(contentContainer);
        
        return container;
    }
    
    /**
     * Create VFX config editor for direct configuration
     */
    createVFXConfigEditor(name, value, path, fieldDef) {
        const container = document.createElement('div');
        container.className = 'vfx-config-editor';
        container.style.border = '1px solid #444';
        container.style.padding = '10px';
        container.style.borderRadius = '4px';
        container.style.backgroundColor = '#2a2a2a';
        
        // Ensure value is an object
        const config = typeof value === 'object' && value !== null ? value : {
            type: fieldDef.category || 'spark',
            texture: 'spark',
            quantity: 10,
            lifespan: 500
        };
        
        // Common VFX properties
        const fields = [
            { key: 'type', label: 'Effect Type', type: 'select', 
              options: ['spark', 'explosion', 'energy', 'smoke', 'blood', 'hit', 'trail'] },
            { key: 'texture', label: 'Texture', type: 'text', default: 'spark' },
            { key: 'quantity', label: 'Particle Count', type: 'number', min: 1, max: 100, default: 10 },
            { key: 'lifespan', label: 'Lifespan (ms)', type: 'number', min: 100, max: 5000, default: 500 },
            { key: 'tint', label: 'Color (hex)', type: 'color', default: '#FFFFFF' },
            { key: 'alpha', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.1, default: 1 }
        ];
        
        fields.forEach(field => {
            const fieldContainer = document.createElement('div');
            fieldContainer.style.marginBottom = '8px';
            fieldContainer.style.display = 'flex';
            fieldContainer.style.alignItems = 'center';
            
            const label = document.createElement('label');
            label.textContent = field.label + ':';
            label.style.width = '120px';
            label.style.fontSize = '12px';
            fieldContainer.appendChild(label);
            
            let input;
            if (field.type === 'select') {
                input = document.createElement('select');
                input.style.flex = '1';
                field.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    if (config[field.key] === opt) option.selected = true;
                    input.appendChild(option);
                });
            } else if (field.type === 'color') {
                input = document.createElement('input');
                input.type = 'text';
                input.style.flex = '1';
                // Convert hex number to color string
                const currentValue = config[field.key];
                if (typeof currentValue === 'number') {
                    input.value = '#' + currentValue.toString(16).padStart(6, '0').toUpperCase();
                } else {
                    input.value = currentValue || field.default;
                }
            } else {
                input = document.createElement('input');
                input.type = field.type;
                input.style.flex = '1';
                if (field.min !== undefined) input.min = field.min;
                if (field.max !== undefined) input.max = field.max;
                if (field.step !== undefined) input.step = field.step;
                input.value = config[field.key] !== undefined ? config[field.key] : field.default;
            }
            
            input.addEventListener('change', () => {
                let newValue = input.value;
                
                // Convert based on type
                if (field.type === 'number') {
                    newValue = parseFloat(newValue);
                } else if (field.type === 'color' && newValue.startsWith('#')) {
                    // Convert hex string to number for Phaser
                    newValue = parseInt(newValue.substring(1), 16);
                }
                
                // Update config
                config[field.key] = newValue;
                this.handleChange(path, config);
            });
            
            fieldContainer.appendChild(input);
            container.appendChild(fieldContainer);
        });
        
        // Add speed range editor
        const speedContainer = document.createElement('div');
        speedContainer.style.marginTop = '10px';
        speedContainer.style.paddingTop = '10px';
        speedContainer.style.borderTop = '1px solid #555';
        
        const speedLabel = document.createElement('div');
        speedLabel.textContent = 'Speed Range:';
        speedLabel.style.fontSize = '12px';
        speedLabel.style.marginBottom = '5px';
        speedContainer.appendChild(speedLabel);
        
        const speedFields = document.createElement('div');
        speedFields.style.display = 'flex';
        speedFields.style.gap = '10px';
        
        const minSpeed = document.createElement('input');
        minSpeed.type = 'number';
        minSpeed.placeholder = 'Min';
        minSpeed.style.flex = '1';
        minSpeed.value = config.speed?.min || 100;
        
        const maxSpeed = document.createElement('input');
        maxSpeed.type = 'number';
        maxSpeed.placeholder = 'Max';
        maxSpeed.style.flex = '1';
        maxSpeed.value = config.speed?.max || 200;
        
        const updateSpeed = () => {
            config.speed = {
                min: parseFloat(minSpeed.value) || 0,
                max: parseFloat(maxSpeed.value) || 0
            };
            this.handleChange(path, config);
        };
        
        minSpeed.addEventListener('change', updateSpeed);
        maxSpeed.addEventListener('change', updateSpeed);
        
        speedFields.appendChild(minSpeed);
        speedFields.appendChild(maxSpeed);
        speedContainer.appendChild(speedFields);
        container.appendChild(speedContainer);
        
        // Add scale range editor
        const scaleContainer = document.createElement('div');
        scaleContainer.style.marginTop = '10px';
        
        const scaleLabel = document.createElement('div');
        scaleLabel.textContent = 'Scale Range:';
        scaleLabel.style.fontSize = '12px';
        scaleLabel.style.marginBottom = '5px';
        scaleContainer.appendChild(scaleLabel);
        
        const scaleFields = document.createElement('div');
        scaleFields.style.display = 'flex';
        scaleFields.style.gap = '10px';
        
        const startScale = document.createElement('input');
        startScale.type = 'number';
        startScale.step = '0.1';
        startScale.placeholder = 'Start';
        startScale.style.flex = '1';
        startScale.value = config.scale?.start || 0.5;
        
        const endScale = document.createElement('input');
        endScale.type = 'number';
        endScale.step = '0.1';
        endScale.placeholder = 'End';
        endScale.style.flex = '1';
        endScale.value = config.scale?.end || 0;
        
        const updateScale = () => {
            config.scale = {
                start: parseFloat(startScale.value) || 0,
                end: parseFloat(endScale.value) || 0
            };
            this.handleChange(path, config);
        };
        
        startScale.addEventListener('change', updateScale);
        endScale.addEventListener('change', updateScale);
        
        scaleFields.appendChild(startScale);
        scaleFields.appendChild(endScale);
        scaleContainer.appendChild(scaleFields);
        container.appendChild(scaleContainer);
        
        return container;
    }
    
    createSFXSelector(name, value, path, fieldDef) {
        const container = document.createElement('div');
        container.className = 'sfx-selector-container';
        
        // Create input field + browse button combo
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        
        // Text input for current value
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value || '';
        input.placeholder = 'Select or enter SFX key...';
        input.className = 'form-control';
        
        // Browse button
        const browseBtn = document.createElement('button');
        browseBtn.type = 'button';
        browseBtn.className = 'btn-browse-sfx';
        browseBtn.innerHTML = '🎵 Browse';
        browseBtn.title = 'Browse available audio files';
        
        // Play preview button with unique ID for tracking
        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'btn-play-sfx';
        playBtn.innerHTML = '▶️';
        playBtn.title = 'Preview current sound';
        playBtn.disabled = !value;
        
        // Add unique ID for tracking this specific button
        const buttonId = `sfx-btn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        playBtn.dataset.buttonId = buttonId;
        playBtn.dataset.audioPath = value || '';
        
        // Event handlers
        input.addEventListener('input', (e) => {
            const newValue = e.target.value.trim();
            this.editor.onPropertyChange(path, newValue || null);
            playBtn.disabled = !newValue;
            playBtn.dataset.audioPath = newValue;
            
            // Stop playback if path changed while playing
            if (playBtn.classList.contains('playing')) {
                this.stopAudioPreview(buttonId);
            }
        });
        
        browseBtn.addEventListener('click', () => {
            this.audioBrowser.open((selectedPath) => {
                input.value = selectedPath;
                this.editor.onPropertyChange(path, selectedPath);
                playBtn.disabled = false;
                playBtn.dataset.audioPath = selectedPath;
                
                // Stop playback if path changed while playing
                if (playBtn.classList.contains('playing')) {
                    this.stopAudioPreview(buttonId);
                }
            });
        });
        
        playBtn.addEventListener('click', async () => {
            if (!input.value) return;
            
            const isPlaying = playBtn.classList.contains('playing');
            
            if (isPlaying) {
                // Stop playback
                this.stopAudioPreview(buttonId);
            } else {
                // Start playback
                await this.playAudioPreview(input.value, buttonId, playBtn);
            }
        });
        
        inputGroup.appendChild(input);
        inputGroup.appendChild(browseBtn);
        inputGroup.appendChild(playBtn);
        container.appendChild(inputGroup);
        
        // Add tooltip if available
        if (fieldDef.tooltip) {
            container.title = fieldDef.tooltip;
        }
        
        return container;
    }
    
    /**
     * Create nested audio field for objects containing only audio paths
     */
    createNestedAudioField(name, value, path) {
        const container = document.createElement('div');
        container.className = 'nested-audio-container';
        
        // Header for the audio group
        const header = document.createElement('div');
        header.className = 'property-group-header';
        const icon = document.createElement('span');
        icon.className = 'group-icon';
        icon.textContent = '🎵';
        const gName = document.createElement('span');
        gName.className = 'group-name';
        gName.textContent = this.formatName(name);
        const gType = document.createElement('span');
        gType.className = 'group-type';
        gType.textContent = 'Audio Group';
        header.appendChild(icon);
        header.appendChild(gName);
        header.appendChild(gType);
        container.appendChild(header);
        
        // Container for audio fields
        const fieldsContainer = document.createElement('div');
        fieldsContainer.className = 'property-group-content audio-group-content';
        
        // Create SFX selector for each property in the object
        for (const [key, audioValue] of Object.entries(value)) {
            const fieldPath = `${path}.${key}`;
            const audioField = this.createSFXSelector(key, audioValue, fieldPath, { type: 'sfx-selector' });
            audioField.className += ' nested-audio-field';
            fieldsContainer.appendChild(audioField);
        }
        
        container.appendChild(fieldsContainer);
        return container;
    }
    
    createPathSelector(name, value, path, fieldDef) {
        return this.createTextField(name, value, path, fieldDef);
    }
    
    /**
     * Play audio preview with toggle support
     */
    async playAudioPreview(audioPath, buttonId, buttonElement) {
        // Stop all other previews first (only one audio at a time)
        this.stopAllAudioPreviews();
        
        // Resolve actual path
        let actualPath = await this.resolveAudioPath(audioPath);
        if (!actualPath) {
            console.warn(`[PropertyEditor] Failed to resolve audio path: ${audioPath}`);
            return;
        }
        
        try {
            // Construct full path relative to editor
            const fullPath = actualPath.startsWith('../') ? actualPath : `../${actualPath}`;
            const audio = new Audio(fullPath);
            audio.volume = 0.5;
            
            // Handle when audio ends naturally
            audio.addEventListener('ended', () => {
                this.onAudioEnded(buttonId);
            });
            
            // Store reference and update button
            this.activeAudioPreviews.set(buttonId, { 
                audio, 
                button: buttonElement 
            });
            
            // Update button state
            buttonElement.innerHTML = '⏹️';
            buttonElement.classList.add('playing');
            buttonElement.title = 'Stop playback';
            
            // Play the audio
            await audio.play();
            console.log(`[PropertyEditor] Playing audio: ${audioPath} from ${fullPath}`);
            
        } catch (error) {
            console.error(`[PropertyEditor] Failed to play audio '${audioPath}':`, error);
            // Reset button on error
            buttonElement.innerHTML = '▶️';
            buttonElement.classList.remove('playing');
            buttonElement.title = 'Preview current sound';
        }
    }
    
    /**
     * Stop specific audio preview
     */
    stopAudioPreview(buttonId) {
        const preview = this.activeAudioPreviews.get(buttonId);
        if (preview) {
            // Stop and reset audio
            preview.audio.pause();
            preview.audio.currentTime = 0;
            
            // Reset button state
            preview.button.innerHTML = '▶️';
            preview.button.classList.remove('playing');
            preview.button.title = 'Preview current sound';
            
            // Remove from active previews
            this.activeAudioPreviews.delete(buttonId);
            console.log(`[PropertyEditor] Stopped audio preview: ${buttonId}`);
        }
    }
    
    /**
     * Stop all active audio previews
     */
    stopAllAudioPreviews() {
        for (const [buttonId] of this.activeAudioPreviews) {
            this.stopAudioPreview(buttonId);
        }
    }
    
    /**
     * Handle when audio ends naturally
     */
    onAudioEnded(buttonId) {
        const preview = this.activeAudioPreviews.get(buttonId);
        if (preview) {
            // Reset button state
            preview.button.innerHTML = '▶️';
            preview.button.classList.remove('playing');
            preview.button.title = 'Preview current sound';
            
            // Remove from active previews
            this.activeAudioPreviews.delete(buttonId);
            console.log(`[PropertyEditor] Audio ended naturally: ${buttonId}`);
        }
    }
    
    /**
     * Resolve audio path (handle legacy IDs)
     */
    async resolveAudioPath(audioPath) {
        // PR7: Direct path system - audioPath is already the full path
        // Check if it's a direct file path or legacy registry ID
        let actualPath = audioPath;
        
        // If it starts with 'sfx.' it might be a legacy registry ID
        if (audioPath.startsWith('sfx.')) {
            // Try to get from FieldDefinitions for backward compatibility
            if (!FieldDefinitions.instance) {
                FieldDefinitions.instance = new FieldDefinitions();
            }
            
            const fieldDefs = FieldDefinitions.instance;
            
            try {
                await fieldDefs.waitForInitialization();
                if (fieldDefs.audioData) {
                    const resolvedPath = fieldDefs.audioData.sfx[audioPath] || fieldDefs.audioData.sfxExtended[audioPath];
                    if (resolvedPath) {
                        actualPath = resolvedPath;
                    } else {
                        console.warn(`[PropertyEditor] Legacy SFX '${audioPath}' not found in manifest`);
                        return null;
                    }
                }
            } catch (error) {
                console.warn('[PropertyEditor] Failed to resolve legacy audio ID:', error);
                return null;
            }
        }
        
        return actualPath;
    }
    
    /**
     * Legacy method for backward compatibility
     */
    async previewSFX(audioPath) {
        // For backward compatibility, create a temporary button
        const tempButton = document.createElement('button');
        tempButton.innerHTML = '▶️';
        const tempId = `temp-${Date.now()}`;
        await this.playAudioPreview(audioPath, tempId, tempButton);
    }
    
    /**
     * Cleanup when destroying component
     */
    destroy() {
        // Stop all audio previews
        this.stopAllAudioPreviews();
        
        // Legacy cleanup
        if (this.currentPreviewAudio) {
            this.currentPreviewAudio.pause();
            this.currentPreviewAudio = null;
        }
        if (this.audioBrowser) {
            this.audioBrowser.destroy();
        }
    }
    
    /**
     * Parse color value
     */
    parseColor(value) {
        if (typeof value === 'string') {
            // Handle hex format (0xRRGGBB or #RRGGBB)
            if (value.startsWith('0x')) {
                const hex = value.substring(2);
                return '#' + hex;
            } else if (value.startsWith('#')) {
                return value;
            }
        } else if (typeof value === 'number') {
            // PR7: Convert number to hex color for display
            const hex = value.toString(16).padStart(6, '0');
            return '#' + hex;
        }
        
        return null;
    }
    
    /**
     * Collapse all groups
     */
    collapseAll() {
        const groups = this.formContainer.querySelectorAll('.property-group-content');
        const toggles = this.formContainer.querySelectorAll('.property-group-toggle');
        
        groups.forEach(group => group.style.display = 'none');
        toggles.forEach(toggle => toggle.textContent = '▶');
    }
    
    /**
     * Create audio field for single audio file selection
     */
    createAudioField(name, value, path, fieldDef) {
        const container = document.createElement('div');
        container.className = 'field-audio';
        
        // Label
        const label = document.createElement('label');
        label.textContent = this.formatName(name);
        container.appendChild(label);
        
        // Input with datalist
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value || '';
        input.placeholder = fieldDef.placeholder || 'Select audio file...';
        input.list = `audio-list-${path.replace(/\./g, '-')}`;
        
        // Create datalist with audio options
        const datalist = document.createElement('datalist');
        datalist.id = input.list;
        
        // Get audio files based on category
        if (this.fieldDefs.audioData) {
            const category = fieldDef.category || 'all';
            let audioFiles = [];
            
            if (category === 'music') {
                audioFiles = Object.keys(this.fieldDefs.audioData.music || {});
                // Also add direct paths for music files
                audioFiles.push(
                    'music/8bit_main_menu.mp3',
                    'music/8bit_track1.mp3',
                    'music/8bit_track2.mp3',
                    'music/8bit_track3.mp3',
                    'music/8bit_track4.mp3',
                    'music/8bit_boss1.mp3',
                    'music/8bit_boss2.mp3'
                );
            } else if (category === 'sfx') {
                audioFiles = Object.keys(this.fieldDefs.audioData.sfx || {});
            } else {
                // All audio files
                audioFiles = [
                    ...Object.keys(this.fieldDefs.audioData.sfx || {}),
                    ...Object.keys(this.fieldDefs.audioData.music || {})
                ];
            }
            
            audioFiles.forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                datalist.appendChild(option);
            });
        }
        
        container.appendChild(datalist);
        container.appendChild(input);
        
        // Play button
        const playBtn = document.createElement('button');
        playBtn.className = 'btn-small btn-preview';
        playBtn.innerHTML = '▶️';
        playBtn.title = 'Preview audio';
        playBtn.onclick = () => {
            if (input.value) {
                this.playAudioPreview(input.value, `${path}-play`, playBtn);
            }
        };
        container.appendChild(playBtn);
        
        // Handle changes
        input.addEventListener('change', () => {
            this.handleChange(path, input.value);
        });
        
        return container;
    }
    
    /**
     * Create audio array field for multiple audio files
     */
    createAudioArrayField(name, value, path, fieldDef) {
        const container = document.createElement('div');
        container.className = 'field-audio-array';
        
        // Label
        const label = document.createElement('label');
        label.textContent = this.formatName(name);
        container.appendChild(label);
        
        // Array container
        const arrayContainer = document.createElement('div');
        arrayContainer.className = 'audio-array-items';
        
        // Ensure value is an array
        const items = Array.isArray(value) ? value : [];
        
        // Render existing items
        const renderItems = () => {
            arrayContainer.innerHTML = '';
            
            items.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'audio-array-item';
                
                // Input
                const input = document.createElement('input');
                input.type = 'text';
                input.value = item;
                input.placeholder = fieldDef.placeholder || 'Audio file path...';
                input.list = `audio-list-${path}-${index}`;
                
                // Create datalist
                const datalist = document.createElement('datalist');
                datalist.id = input.list;
                
                // Add music files to datalist
                const musicFiles = [
                    'music/8bit_main_menu.mp3',
                    'music/8bit_track1.mp3',
                    'music/8bit_track2.mp3',
                    'music/8bit_track3.mp3',
                    'music/8bit_track4.mp3',
                    'music/8bit_boss1.mp3',
                    'music/8bit_boss2.mp3',
                    'music/synthwave_track1.mp3',
                    'music/synthwave_track2.mp3',
                    'music/synthwave_track3.mp3',
                    'music/synthwave_track4.mp3',
                    'music/synthwave_boss1.mp3'
                ];
                
                musicFiles.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file;
                    datalist.appendChild(option);
                });
                
                itemDiv.appendChild(datalist);
                itemDiv.appendChild(input);
                
                // Play button
                const playBtn = document.createElement('button');
                playBtn.className = 'btn-small btn-preview';
                playBtn.innerHTML = '▶️';
                playBtn.title = 'Preview';
                playBtn.onclick = () => {
                    if (input.value) {
                        this.playAudioPreview(input.value, `${path}-${index}`, playBtn);
                    }
                };
                itemDiv.appendChild(playBtn);
                
                // Remove button
                const removeBtn = document.createElement('button');
                removeBtn.className = 'btn-small btn-danger';
                removeBtn.innerHTML = '✕';
                removeBtn.title = 'Remove';
                removeBtn.onclick = () => {
                    items.splice(index, 1);
                    this.handleChange(path, items);
                    renderItems();
                };
                itemDiv.appendChild(removeBtn);
                
                // Handle changes
                input.addEventListener('change', () => {
                    items[index] = input.value;
                    this.handleChange(path, items);
                });
                
                arrayContainer.appendChild(itemDiv);
            });
            
            // Add button
            const addBtn = document.createElement('button');
            addBtn.className = 'btn-small btn-primary';
            addBtn.innerHTML = '➕ Add Track';
            addBtn.onclick = () => {
                items.push('');
                this.handleChange(path, items);
                renderItems();
            };
            arrayContainer.appendChild(addBtn);
        };
        
        renderItems();
        container.appendChild(arrayContainer);
        
        return container;
    }
    
    /**
     * Expand all groups
     */
    expandAll() {
        const groups = this.formContainer.querySelectorAll('.property-group-content');
        const toggles = this.formContainer.querySelectorAll('.property-group-toggle');
        
        groups.forEach(group => group.style.display = 'block');
        toggles.forEach(toggle => toggle.textContent = '▼');
    }
    
    /**
     * Validate current blueprint
     */
    validate() {
        if (!this.currentBlueprint) return;
        
        const validation = this.editor.schemaValidator.validate(this.currentBlueprint);
        
        if (validation.valid) {
            if (validation.warnings.length > 0) {
                this.editor.updateStatus(`Valid with ${validation.warnings.length} warnings`, 'warning');
                console.warn('Validation warnings:', validation.warnings);
            } else {
                this.editor.updateStatus('Blueprint is valid', 'success');
            }
        } else {
            this.editor.updateStatus(`${validation.errors.length} validation errors`, 'error');
            console.error('Validation errors:', validation.errors);
            
            // Show errors in modal
            const errorList = validation.errors.map(e => `• ${e}`).join('<br>');
            this.editor.showModal('Validation Errors', errorList);
        }
    }
}

export default PropertyEditor;