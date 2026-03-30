/**
 * EditorCore.js - Main controller for Blueprint Editor
 * Manages module loading, event system, and overall coordination
 */

import { DataManager } from './DataManager.js';
import { PluginLoader } from './PluginLoader.js';
import { SchemaValidator } from './SchemaValidator.js';
import { BlueprintBrowser } from '../modules/BlueprintBrowser.js';
import { PropertyEditor } from '../modules/PropertyEditor.js';
import { SimplePreview } from '../modules/SimplePreview.js';
import { TestRunner } from '../modules/TestRunner.js';
import { SpawnTimeline } from '../modules/SpawnTimeline.js';
import { BossPhaseEditor } from '../modules/BossPhaseEditor.js';
import { BalanceDashboard } from '../modules/BalanceDashboard.js';
import { PowerupGraph } from '../modules/PowerupGraph.js';
import { LootVisualizer } from '../modules/LootVisualizer.js';
import { EntityAutocomplete } from '../modules/EntityAutocomplete.js';

class EditorCore {
    constructor() {
        this.modules = {};
        this.plugins = [];
        this.currentBlueprint = null;
        this.currentFile = null;
        this.isDirty = false;
        this.autoSaveEnabled = true;
        this.autoSaveInterval = 30000; // 30 seconds
        
        // Event emitter pattern
        this.events = {};
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Blueprint Editor initializing...');
        
        try {
            // Initialize core systems
            this.dataManager = new DataManager(this);
            this.pluginLoader = new PluginLoader(this);
            this.schemaValidator = new SchemaValidator(this);
            
            // Initialize modules
            this.modules.browser = new BlueprintBrowser(this);
            this.modules.editor = new PropertyEditor(this);
            this.modules.preview = new SimplePreview(this);
            this.modules.testRunner = new TestRunner(this);
            this.modules.spawnTimeline = new SpawnTimeline(this);
            this.modules.bossPhaseEditor = new BossPhaseEditor(this);
            this.modules.balanceDashboard = new BalanceDashboard(this);
            this.modules.powerupGraph = new PowerupGraph(this);
            this.modules.lootVisualizer = new LootVisualizer(this);
            this.modules.entityAutocomplete = new EntityAutocomplete(this);

            // Setup UI event handlers
            this.setupEventHandlers();
            
            // Load initial data
            await this.loadBlueprintList();
            
            // Start auto-save
            if (this.autoSaveEnabled) {
                this.startAutoSave();
            }
            
            // Update status
            this.updateStatus('Ready');
            console.log('✅ Blueprint Editor initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize editor:', error);
            this.updateStatus('Initialization failed', 'error');
        }
    }
    
    setupEventHandlers() {
        // Header buttons
        document.getElementById('btn-new').addEventListener('click', () => this.createNewBlueprint());
        document.getElementById('btn-save').addEventListener('click', () => this.saveBlueprint());
        document.getElementById('btn-reload').addEventListener('click', () => this.reloadBlueprint());
        document.getElementById('btn-test').addEventListener('click', () => this.testBlueprint());
        
        // Preview mode selector
        document.getElementById('preview-mode').addEventListener('change', (e) => {
            this.emit('preview:mode-change', e.target.value);
        });
        
        // Modal close
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
            if (this._modalResolve) {
                this._modalResolve(false);
                this._modalResolve = null;
            }
        });
        document.getElementById('modal-cancel').addEventListener('click', () => {
            this.closeModal();
            if (this._modalResolve) {
                this._modalResolve(false);
                this._modalResolve = null;
            }
        });
        
        // Window beforeunload - warn about unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.isDirty) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
    }
    
    // Event System
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }
    
    off(event, callback) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        }
    }
    
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => callback(data));
        }
    }
    
    // Blueprint Management
    async loadBlueprintList() {
        try {
            const blueprints = await this.dataManager.loadBlueprintList();
            this.emit('blueprints:loaded', blueprints);
            
            // Update footer stats
            document.getElementById('blueprint-count').textContent = `${blueprints.length} blueprints`;
            
        } catch (error) {
            console.error('Failed to load blueprint list:', error);
            this.showError('Failed to load blueprints');
        }
    }
    
    async loadBlueprint(filePath) {
        try {
            this.updateStatus('Loading...', 'loading');
            
            const blueprint = await this.dataManager.loadBlueprint(filePath);
            this.currentBlueprint = blueprint;
            this.currentFile = filePath;
            this.isDirty = false;
            
            // Validate
            const validation = this.schemaValidator.validate(blueprint);
            if (!validation.valid) {
                this.showWarnings(validation.errors);
            }
            
            // Emit event for modules
            this.emit('blueprint:loaded', { blueprint, filePath });
            
            // Update UI
            document.getElementById('current-file').textContent = filePath;
            this.updateStatus('Ready');
            
        } catch (error) {
            console.error('Failed to load blueprint:', error);
            this.showError(`Failed to load ${filePath}`);
        }
    }
    
    async saveBlueprint() {
        if (!this.currentBlueprint || !this.currentFile) {
            this.showError('No blueprint loaded');
            return;
        }
        
        try {
            this.updateStatus('Saving...', 'loading');
            
            // Validate before saving
            const validation = this.schemaValidator.validate(this.currentBlueprint);
            if (!validation.valid) {
                const proceed = await this.confirm('Blueprint has validation errors. Save anyway?');
                if (!proceed) return;
            }
            
            await this.dataManager.saveBlueprint(this.currentFile, this.currentBlueprint);
            this.isDirty = false;
            
            // Update UI
            const now = new Date().toLocaleTimeString();
            document.getElementById('last-saved').textContent = `Saved at ${now}`;
            this.updateStatus('Saved successfully', 'success');
            
            // Emit event
            this.emit('blueprint:saved', { blueprint: this.currentBlueprint, filePath: this.currentFile });
            
        } catch (error) {
            console.error('Failed to save blueprint:', error);
            this.showError('Failed to save blueprint');
        }
    }
    
    async reloadBlueprint() {
        if (!this.currentFile) return;
        
        if (this.isDirty) {
            const proceed = await this.confirm('Discard unsaved changes?');
            if (!proceed) return;
        }
        
        await this.loadBlueprint(this.currentFile);
    }
    
    async createNewBlueprint() {
        const type = await this.prompt('Blueprint type:', 'Select type', [
            'enemy', 'boss', 'elite', 'unique',
            'powerup', 'projectile', 'loot', 'spawn'
        ]);
        
        if (!type) return;
        
        const id = await this.prompt('Blueprint ID:', 'Enter unique ID (e.g., enemy.my_enemy)');
        if (!id) return;
        
        const blueprint = this.dataManager.createBlueprintTemplate(type, id);
        
        // Create file path
        const filePath = `data/blueprints/${type}/${id.replace('.', '_')}.json5`;
        
        this.currentBlueprint = blueprint;
        this.currentFile = filePath;
        this.isDirty = true;
        
        this.emit('blueprint:created', { blueprint, filePath });
        this.updateStatus('New blueprint created');
    }
    
    testBlueprint() {
        if (!this.currentBlueprint) {
            this.showError('No blueprint loaded');
            return;
        }
        
        this.emit('test:run', this.currentBlueprint);
    }
    
    // Property Changes
    onPropertyChange(path, value) {
        if (!this.currentBlueprint) return;
        
        // Update blueprint using path
        this.setNestedProperty(this.currentBlueprint, path, value);
        this.isDirty = true;
        
        // Emit change event
        this.emit('blueprint:changed', { path, value, blueprint: this.currentBlueprint });
        
        // Update status
        if (!this.autoSaveEnabled) {
            this.updateStatus('Modified (unsaved)');
        }
    }
    
    // Alias for backward compatibility
    updateProperty(path, value) {
        return this.onPropertyChange(path, value);
    }
    
    setNestedProperty(obj, path, value) {
        const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            const key = isNaN(parts[i]) ? parts[i] : parseInt(parts[i]);
            if (current[key] === undefined) {
                const nextKey = parts[i + 1];
                current[key] = (nextKey !== undefined && !isNaN(nextKey)) ? [] : {};
            }
            current = current[key];
        }
        const lastKey = isNaN(parts[parts.length - 1]) ? parts[parts.length - 1] : parseInt(parts[parts.length - 1]);
        current[lastKey] = value;
    }
    
    // Auto-save
    startAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            if (this.isDirty && this.currentBlueprint) {
                this.saveBlueprint();
            }
        }, this.autoSaveInterval);
    }
    
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }
    
    // UI Helpers
    updateStatus(message, type = 'normal') {
        const statusText = document.getElementById('status-text');
        statusText.textContent = message;
        statusText.className = type;
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusText.className = 'normal';
                statusText.textContent = 'Ready';
            }, 3000);
        }
    }
    
    showError(message) {
        console.error(message);
        this.updateStatus(message, 'error');
        // Could also show modal
    }
    
    showWarnings(warnings) {
        const count = warnings.length;
        document.getElementById('warning-count').textContent = `${count} warnings`;
        console.warn('Validation warnings:', warnings);
    }
    
    async confirm(message) {
        return new Promise(resolve => {
            this._modalResolve = resolve;
            this.showModal('Confirm', message, (result) => {
                this._modalResolve = null;
                resolve(result);
            });
        });
    }
    
    async prompt(message, title = 'Input', options = null) {
        return new Promise(resolve => {
            // For now, use browser prompt
            // TODO: Implement custom modal prompt
            if (options) {
                // Show select dialog
                const selected = prompt(`${message}\n\nOptions: ${options.join(', ')}`);
                resolve(selected);
            } else {
                const value = prompt(message);
                resolve(value);
            }
        });
    }
    
    showModal(title, content, callback) {
        const modal = document.getElementById('modal-overlay');
        document.getElementById('modal-title').textContent = title;
        const body = document.getElementById('modal-body');
        body.textContent = '';
        if (content instanceof Node) body.appendChild(content);
        else body.textContent = content;
        
        modal.style.display = 'flex';
        
        const confirmBtn = document.getElementById('modal-confirm');
        confirmBtn.onclick = () => {
            this.closeModal();
            if (callback) callback(true);
        };
    }
    
    closeModal() {
        document.getElementById('modal-overlay').style.display = 'none';
    }
}

// Initialize editor when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new EditorCore();
});

export { EditorCore };