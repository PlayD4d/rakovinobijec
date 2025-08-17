/**
 * SettingsModal - Thin composer that coordinates View and Controller
 * Orchestrates UI rendering and state management
 */
import { BaseUIComponent } from './BaseUIComponent.js';
import { SettingsController } from './SettingsController.js';
import { SettingsModalView } from './SettingsModalView.js';

export class SettingsModal extends BaseUIComponent {
    constructor(scene, onCloseCallback = null) {
        const width = scene?.scale?.width || 800;
        const height = scene?.scale?.height || 600;
        
        super(scene, 0, 0, {
            width: width,
            height: height,
            theme: 'modal',
            responsive: true
        });
        
        this.onCloseCallback = onCloseCallback;
        
        // Initialize controller and view
        this.controller = new SettingsController(scene);
        this.view = new SettingsModalView(scene);
        
        // UI state
        this.modalContainer = null;
        this.isVisible = false;
        
        console.debug('[SettingsModal] Initialized with MVC pattern');
    }
    
    getComponentDepth() {
        return this.view.theme?.depth?.modal || 1000;
    }
    
    /**
     * Show the settings modal
     */
    show() {
        if (this.isVisible) return;
        
        // Create modal structure
        this.modalContainer = this.view.createModal(
            Math.min(900, this.scene.scale.width - 100),
            Math.min(700, this.scene.scale.height - 100)
        );
        
        // Build modal content
        this.buildModal();
        
        // Show with animation
        this.view.show();
        this.isVisible = true;
        
        // Set depth
        this.modalContainer.setDepth(this.getComponentDepth());
        
        // Pause game if in GameScene
        if (this.scene.scene.key === 'GameScene') {
            this.scene.scene.pause();
        }
    }
    
    /**
     * Hide the settings modal
     */
    hide() {
        if (!this.isVisible) return;
        
        // Check for unsaved changes
        if (this.controller.isDirty) {
            this.showUnsavedChangesDialog();
            return;
        }
        
        this.view.hide(() => {
            this.isVisible = false;
            
            // Resume game if in GameScene
            if (this.scene.scene.key === 'GameScene') {
                this.scene.scene.resume();
            }
            
            if (this.onCloseCallback) {
                this.onCloseCallback();
            }
        });
    }
    
    /**
     * Build modal content
     */
    buildModal() {
        if (!this.modalContainer) return;
        
        const modalSizer = this.modalContainer.getElement('items')[0];
        
        // Header
        const header = this.view.createHeader('Nastavení', () => this.hide());
        modalSizer.add(header, { expand: true });
        
        // Tab navigation
        const tabNav = this.view.createTabNavigation(
            this.controller.tabs,
            this.controller.currentTab,
            (tabKey) => this.switchTab(tabKey)
        );
        modalSizer.add(tabNav, { expand: true });
        
        // Content area
        const contentArea = this.view.createContentArea();
        modalSizer.add(contentArea, { proportion: 1, expand: true });
        
        // Footer
        const footer = this.view.createFooter(\n            () => this.saveSettings(),\n            () => this.hide(),\n            () => this.resetSettings()\n        );\n        modalSizer.add(footer, { expand: true });\n        \n        // Load initial tab content\n        this.loadTabContent();\n        \n        modalSizer.layout();\n    }\n    \n    /**\n     * Switch to different tab\n     */\n    switchTab(tabKey) {\n        if (this.controller.setActiveTab(tabKey)) {\n            this.view.updateTabStates(tabKey);\n            this.loadTabContent();\n        }\n    }\n    \n    /**\n     * Load content for current tab\n     */\n    loadTabContent() {\n        const contentPanel = this.view.contentSizer?.getElement('panel')?.child;\n        if (!contentPanel) return;\n        \n        // Clear existing content\n        contentPanel.clear(true);\n        \n        const settings = this.controller.getCurrentTabSettings();\n        \n        settings.forEach(setting => {\n            let component;\n            \n            switch (setting.type) {\n                case 'checkbox':\n                    component = this.view.createCheckbox(\n                        setting.label,\n                        this.controller.getSetting(setting.key),\n                        (value) => this.controller.setSetting(setting.key, value)\n                    );\n                    break;\n                    \n                case 'slider':\n                    component = this.view.createSlider(\n                        setting.label,\n                        this.controller.getSetting(setting.key),\n                        setting.min,\n                        setting.max,\n                        setting.step,\n                        (value) => this.controller.setSetting(setting.key, value),\n                        setting.formatValue\n                    );\n                    break;\n                    \n                case 'radio':\n                    component = this.view.createRadioGroup(\n                        setting.label,\n                        setting.options,\n                        this.controller.getSetting(setting.key),\n                        (value) => this.controller.setSetting(setting.key, value)\n                    );\n                    break;\n                    \n                case 'info':\n                    if (setting.key === 'keyboardShortcuts') {\n                        component = this.createKeyboardShortcutsInfo();\n                    }\n                    break;\n            }\n            \n            if (component) {\n                contentPanel.add(component, { expand: true });\n            }\n        });\n        \n        // Handle special tabs\n        if (this.controller.currentTab === 'about') {\n            this.loadAboutContent(contentPanel);\n        }\n        \n        contentPanel.layout();\n    }\n    \n    /**\n     * Create keyboard shortcuts info\n     */\n    createKeyboardShortcutsInfo() {\n        const shortcuts = this.controller.getKeyboardShortcuts();\n        \n        const sizer = this.scene.rexUI.add.sizer({\n            orientation: 'vertical',\n            space: { item: 5 }\n        });\n        \n        shortcuts.forEach(shortcut => {\n            const row = this.scene.rexUI.add.sizer({\n                orientation: 'horizontal'\n            });\n            \n            const keyText = this.scene.add.text(0, 0, shortcut.key, {\n                fontSize: '16px',\n                fontFamily: 'monospace',\n                color: '#ffcc00'\n            });\n            \n            const actionText = this.scene.add.text(0, 0, shortcut.action, {\n                fontSize: '16px',\n                color: '#ffffff'\n            });\n            \n            row.add(keyText, { proportion: 1 });\n            row.add(actionText, { proportion: 2 });\n            \n            sizer.add(row, { expand: true });\n        });\n        \n        return sizer;\n    }\n    \n    /**\n     * Load about tab content\n     */\n    loadAboutContent(contentPanel) {\n        const aboutInfo = this.controller.getAboutInfo();\n        \n        Object.entries(aboutInfo).forEach(([key, value]) => {\n            const row = this.scene.rexUI.add.sizer({\n                orientation: 'horizontal'\n            });\n            \n            const label = this.scene.add.text(0, 0, key + ':', {\n                fontSize: '16px',\n                color: '#cccccc'\n            });\n            \n            const valueText = this.scene.add.text(0, 0, value, {\n                fontSize: '16px',\n                color: '#ffffff'\n            });\n            \n            row.add(label, { proportion: 1 });\n            row.add(valueText, { proportion: 2 });\n            \n            contentPanel.add(row, { expand: true });\n        });\n    }\n    \n    /**\n     * Save settings\n     */\n    saveSettings() {\n        this.controller.saveChanges();\n        this.hide();\n    }\n    \n    /**\n     * Reset settings to defaults\n     */\n    resetSettings() {\n        this.controller.resetToDefaults();\n        this.loadTabContent(); // Refresh UI\n    }\n    \n    /**\n     * Show dialog for unsaved changes\n     */\n    showUnsavedChangesDialog() {\n        // Simple confirmation for now\n        const shouldDiscard = confirm('Máte neuložené změny. Chcete je zahodit?');\n        \n        if (shouldDiscard) {\n            this.controller.discardChanges();\n            this.hide();\n        }\n    }\n    \n    /**\n     * Destroy modal\n     */\n    destroy() {\n        if (this.view) {\n            this.view.destroy();\n            this.view = null;\n        }\n        \n        this.controller = null;\n        this.modalContainer = null;\n        this.isVisible = false;\n        \n        super.destroy();\n    }\n}\n\nexport default SettingsModal;