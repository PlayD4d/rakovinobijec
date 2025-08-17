/**
 * SettingsModalView - Pure RexUI rendering for settings modal
 * No logic, only visual presentation
 */

import { UI_THEME, UIThemeUtils } from './UITheme.js';
import { RESPONSIVE } from './UiConstants.js';

export class SettingsModalView {
    constructor(scene) {
        this.scene = scene;
        this.rexUI = scene.rexUI;
        
        // UI elements
        this.modalContainer = null;
        this.modalSizer = null;
        this.overlay = null;
        this.tabButtons = new Map();
        this.contentSizer = null;
        this.currentContent = null;
        
        // Theme
        this.theme = UI_THEME.components.modal;
        this.colors = UI_THEME.colors;
    }
    
    /**
     * Create modal structure
     */
    createModal(width, height) {
        // Create overlay
        this.overlay = this.rexUI.add.cover({
            color: this.colors.background,
            alpha: 0.8
        });
        
        // Create main container
        this.modalContainer = this.rexUI.add.sizer({
            x: this.scene.scale.width / 2,
            y: this.scene.scale.height / 2,
            width: width,
            height: height,
            orientation: 'vertical'
        });
        
        // Create modal background
        const background = this.rexUI.add.roundRectangle(
            0, 0, width, height,
            this.theme.borderRadius,
            this.colors.surface
        );
        
        this.modalContainer.addBackground(background);
        
        // Create modal structure
        this.modalSizer = this.rexUI.add.sizer({
            orientation: 'vertical',
            space: { item: this.theme.padding }
        });
        
        this.modalContainer.add(this.modalSizer, {
            proportion: 1,
            expand: true,
            padding: this.theme.padding
        });
        
        return this.modalContainer;
    }
    
    /**
     * Create header with title and close button
     */
    createHeader(title, onClose) {
        const headerSizer = this.rexUI.add.sizer({
            orientation: 'horizontal'
        });
        
        // Title
        const titleText = this.scene.add.text(0, 0, title, {
            fontSize: '32px',
            fontFamily: UI_THEME.fonts.primary,
            color: '#ffffff'
        });
        
        headerSizer.add(titleText, {
            proportion: 1,
            align: 'center',
            padding: { left: 10 }
        });
        
        // Close button
        const closeButton = this.createCloseButton(onClose);
        headerSizer.add(closeButton, {
            align: 'center',
            padding: { right: 10 }
        });
        
        return headerSizer;
    }
    
    /**
     * Create close button
     */
    createCloseButton(onClick) {
        const button = this.rexUI.add.label({
            width: 40,
            height: 40,
            background: this.rexUI.add.roundRectangle(0, 0, 40, 40, 20, 0x555555),
            text: this.scene.add.text(0, 0, '✕', {
                fontSize: '24px',
                fontFamily: UI_THEME.fonts.primary,
                color: '#ffffff'
            }),
            align: 'center'
        });
        
        button.setInteractive()
            .on('pointerover', () => {
                button.getElement('background').setFillStyle(0x777777);
            })
            .on('pointerout', () => {
                button.getElement('background').setFillStyle(0x555555);
            })
            .on('pointerdown', onClick);
        
        return button;
    }
    
    /**
     * Create tab navigation
     */
    createTabNavigation(tabs, activeTab, onTabClick) {
        const tabSizer = this.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: 10 }
        });
        
        tabs.forEach(tab => {
            const button = this.createTabButton(tab, tab.key === activeTab);
            
            button.setInteractive()
                .on('pointerdown', () => onTabClick(tab.key))
                .on('pointerover', () => this.highlightTab(button, true))
                .on('pointerout', () => this.highlightTab(button, false));
            
            this.tabButtons.set(tab.key, button);
            tabSizer.add(button, { proportion: 1, expand: true });
        });
        
        return tabSizer;
    }
    
    /**
     * Create individual tab button
     */
    createTabButton(tab, isActive) {
        const bgColor = isActive ? this.colors.primary : this.colors.surface;
        const textColor = isActive ? '#ffffff' : '#cccccc';
        
        const button = this.rexUI.add.label({
            height: 50,
            background: this.rexUI.add.roundRectangle(0, 0, 0, 50, 10, bgColor),
            text: this.scene.add.text(0, 0, `${tab.icon} ${tab.label}`, {
                fontSize: '18px',
                fontFamily: UI_THEME.fonts.primary,
                color: textColor
            }),
            align: 'center',
            space: { left: 15, right: 15 }
        });
        
        return button;
    }
    
    /**
     * Update tab button states
     */
    updateTabStates(activeTab) {
        this.tabButtons.forEach((button, key) => {
            const isActive = key === activeTab;
            const bgColor = isActive ? this.colors.primary : this.colors.surface;
            const textColor = isActive ? '#ffffff' : '#cccccc';
            
            button.getElement('background').setFillStyle(bgColor);
            button.getElement('text').setColor(textColor);
        });
    }
    
    /**
     * Highlight tab on hover
     */
    highlightTab(button, isHovered) {
        if (isHovered) {
            button.getElement('background').setAlpha(0.8);
        } else {
            button.getElement('background').setAlpha(1);
        }
    }
    
    /**
     * Create content area
     */
    createContentArea() {
        this.contentSizer = this.rexUI.add.scrollablePanel({
            width: this.modalContainer.width - 40,
            height: 400,
            scrollMode: 'vertical',
            background: this.rexUI.add.roundRectangle(0, 0, 0, 0, 10, 0x333333),
            panel: {
                child: this.rexUI.add.sizer({
                    orientation: 'vertical',
                    space: { item: 20 }
                })
            },
            slider: {
                track: this.rexUI.add.roundRectangle(0, 0, 20, 10, 10, 0x555555),
                thumb: this.rexUI.add.roundRectangle(0, 0, 20, 30, 10, this.colors.primary)
            },
            space: {
                left: 20,
                right: 20,
                top: 20,
                bottom: 20,
                panel: 10
            }
        });
        
        return this.contentSizer;
    }
    
    /**
     * Create checkbox setting
     */
    createCheckbox(label, value, onChange) {
        const checkbox = this.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: 15 }
        });
        
        // Checkbox box
        const box = this.rexUI.add.roundRectangle(0, 0, 30, 30, 5, 0x555555);
        const check = this.scene.add.text(0, 0, value ? '✓' : '', {
            fontSize: '24px',
            fontFamily: UI_THEME.fonts.primary,
            color: this.colors.success
        });
        
        const checkboxButton = this.rexUI.add.overlap(box, check);
        
        // Label
        const labelText = this.scene.add.text(0, 0, label, {
            fontSize: '18px',
            fontFamily: UI_THEME.fonts.primary,
            color: '#ffffff'
        });
        
        checkbox.add(checkboxButton, { align: 'center' });
        checkbox.add(labelText, { proportion: 1, align: 'center' });
        
        // Interaction
        checkboxButton.setInteractive()
            .on('pointerdown', () => {
                const newValue = !value;
                check.setText(newValue ? '✓' : '');
                onChange(newValue);
            });
        
        return checkbox;
    }
    
    /**
     * Create slider setting
     */
    createSlider(label, value, min, max, step, onChange, formatValue) {
        const slider = this.rexUI.add.sizer({
            orientation: 'vertical',
            space: { item: 10 }
        });
        
        // Label with value
        const labelSizer = this.rexUI.add.sizer({
            orientation: 'horizontal'
        });
        
        const labelText = this.scene.add.text(0, 0, label, {
            fontSize: '18px',
            fontFamily: UI_THEME.fonts.primary,
            color: '#ffffff'
        });
        
        const valueText = this.scene.add.text(0, 0, formatValue ? formatValue(value) : value, {
            fontSize: '18px',
            fontFamily: UI_THEME.fonts.primary,
            color: this.colors.primary
        });
        
        labelSizer.add(labelText, { proportion: 1 });
        labelSizer.add(valueText);
        
        // Slider control
        const sliderControl = this.rexUI.add.slider({
            width: 300,
            height: 30,
            orientation: 'horizontal',
            value: (value - min) / (max - min),
            track: this.rexUI.add.roundRectangle(0, 0, 0, 0, 15, 0x555555),
            indicator: this.rexUI.add.roundRectangle(0, 0, 0, 0, 15, this.colors.primary),
            thumb: this.rexUI.add.roundRectangle(0, 0, 30, 30, 15, 0xffffff),
            input: 'drag'
        });
        
        sliderControl.on('valuechange', (newValue) => {
            const actualValue = min + (newValue * (max - min));
            const steppedValue = Math.round(actualValue / step) * step;
            valueText.setText(formatValue ? formatValue(steppedValue) : steppedValue);
            onChange(steppedValue);
        });
        
        slider.add(labelSizer, { expand: true });
        slider.add(sliderControl, { expand: true });
        
        return slider;
    }
    
    /**
     * Create radio button group
     */
    createRadioGroup(label, options, value, onChange) {
        const group = this.rexUI.add.sizer({
            orientation: 'vertical',
            space: { item: 10 }
        });
        
        // Label
        const labelText = this.scene.add.text(0, 0, label, {
            fontSize: '18px',
            fontFamily: UI_THEME.fonts.primary,
            color: '#ffffff'
        });
        
        group.add(labelText, { align: 'left' });
        
        // Options
        const optionsSizer = this.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: 20 }
        });
        
        options.forEach(option => {
            const optionButton = this.createRadioButton(option, value === option, () => {
                onChange(option);
                this.updateRadioGroup(optionsSizer, option);
            });
            
            optionsSizer.add(optionButton);
        });
        
        group.add(optionsSizer, { align: 'left', padding: { left: 20 } });
        
        return group;
    }
    
    /**
     * Create individual radio button
     */
    createRadioButton(label, isSelected, onClick) {
        const button = this.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: 10 }
        });
        
        // Radio circle
        const outer = this.rexUI.add.circle(0, 0, 12, 0x555555);
        const inner = this.rexUI.add.circle(0, 0, 6, isSelected ? this.colors.primary : 0x333333);
        const radio = this.rexUI.add.overlap(outer, inner);
        
        // Label
        const labelText = this.scene.add.text(0, 0, label, {
            fontSize: '16px',
            fontFamily: UI_THEME.fonts.primary,
            color: '#ffffff'
        });
        
        button.add(radio, { align: 'center' });
        button.add(labelText, { align: 'center' });
        
        button.setInteractive()
            .on('pointerdown', onClick);
        
        return button;
    }
    
    /**
     * Update radio group selection
     */
    updateRadioGroup(group, selectedValue) {
        // Implementation would update visual state of radio buttons
        // This is simplified for brevity
    }
    
    /**
     * Create footer with action buttons
     */
    createFooter(onSave, onCancel, onReset) {
        const footer = this.rexUI.add.sizer({
            orientation: 'horizontal',
            space: { item: 20 }
        });
        
        // Reset button (left side)
        const resetButton = this.createButton('Výchozí', onReset, 'secondary');
        footer.add(resetButton, { align: 'center' });
        
        // Spacer
        footer.addSpace(1);
        
        // Cancel button
        const cancelButton = this.createButton('Zrušit', onCancel, 'secondary');
        footer.add(cancelButton, { align: 'center' });
        
        // Save button
        const saveButton = this.createButton('Uložit', onSave, 'primary');
        footer.add(saveButton, { align: 'center' });
        
        return footer;
    }
    
    /**
     * Create button
     */
    createButton(text, onClick, type = 'primary') {
        const bgColor = type === 'primary' ? this.colors.primary : this.colors.secondary;
        
        const button = this.rexUI.add.label({
            width: 120,
            height: 40,
            background: this.rexUI.add.roundRectangle(0, 0, 120, 40, 20, bgColor),
            text: this.scene.add.text(0, 0, text, {
                fontSize: '18px',
                fontFamily: UI_THEME.fonts.primary,
                color: '#ffffff'
            }),
            align: 'center'
        });
        
        button.setInteractive()
            .on('pointerover', () => {
                button.getElement('background').setAlpha(0.8);
            })
            .on('pointerout', () => {
                button.getElement('background').setAlpha(1);
            })
            .on('pointerdown', onClick);
        
        return button;
    }
    
    /**
     * Show modal with animation
     */
    show() {
        if (!this.modalContainer) return;
        
        this.modalContainer.setScale(0.8, 0.8);
        this.modalContainer.setAlpha(0);
        
        this.scene.tweens.add({
            targets: this.modalContainer,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
        
        if (this.overlay) {
            this.overlay.setAlpha(0);
            this.scene.tweens.add({
                targets: this.overlay,
                alpha: 0.8,
                duration: 300
            });
        }
    }
    
    /**
     * Hide modal with animation
     */
    hide(onComplete) {
        if (!this.modalContainer) return;
        
        this.scene.tweens.add({
            targets: this.modalContainer,
            scaleX: 0.8,
            scaleY: 0.8,
            alpha: 0,
            duration: 200,
            ease: 'Back.easeIn',
            onComplete: () => {
                this.destroy();
                if (onComplete) onComplete();
            }
        });
        
        if (this.overlay) {
            this.scene.tweens.add({
                targets: this.overlay,
                alpha: 0,
                duration: 200
            });
        }
    }
    
    /**
     * Destroy all UI elements
     */
    destroy() {
        if (this.modalContainer) {
            this.modalContainer.destroy();
            this.modalContainer = null;
        }
        
        if (this.overlay) {
            this.overlay.destroy();
            this.overlay = null;
        }
        
        this.tabButtons.clear();
        this.contentSizer = null;
        this.currentContent = null;
    }
}