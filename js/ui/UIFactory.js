/**
 * UIFactory - Bridge mezi BaseUI a LiteUI systémy
 * Zajišťuje správné použití UI komponent podle kontextu
 * PR7 compliant - centralizuje vytváření UI objektů
 */
import { BaseUIComponent } from './BaseUIComponent.js';
import { SimpleModal } from './lite/SimpleModal.js';
import { SimpleButton } from './lite/SimpleButton.js';
import { UI_THEME } from './UITheme.js';

export class UIFactory {
    /**
     * Vytvoří modal podle kontextu scény
     * @param {Phaser.Scene} scene - Phaser scéna
     * @param {string} type - Typ modalu (generic/powerup/settings/pause)
     * @param {Object} config - Konfigurace modalu
     * @returns {BaseUIComponent|SimpleModal} Modal instance
     */
    static createModal(scene, type = 'generic', config = {}) {
        // Pro GameUIScene použít LiteUI (pause-safe, jednodušší)
        if (scene.scene.key === 'GameUIScene' || config.useLite === true) {
            return new SimpleModal(scene, {
                width: config.width || 900,
                height: config.height || 600,
                depth: config.depth || UI_THEME.depth.modal,
                ...config
            });
        }
        
        // Pro ostatní scény použít BaseUI (více features, theming)
        return new BaseUIComponent(scene, 0, 0, {
            width: config.width || 900,
            height: config.height || 600,
            theme: type,
            ...config
        });
    }
    
    /**
     * Vytvoří button podle kontextu
     * @param {Phaser.Scene} scene - Phaser scéna
     * @param {number} x - X pozice
     * @param {number} y - Y pozice
     * @param {string} text - Text tlačítka
     * @param {Function} onClick - Callback při kliknutí
     * @param {Object} config - Dodatečná konfigurace
     * @returns {SimpleButton|Object} Button instance
     */
    static createButton(scene, x, y, text, onClick, config = {}) {
        // Pro GameUIScene nebo pokud je požadováno lite
        if (scene.scene.key === 'GameUIScene' || config.useLite === true) {
            return new SimpleButton(scene, x, y, text, onClick, 
                config.width || 220, 
                config.height || 48, 
                config.style || {}
            );
        }
        
        // Pro BaseUI použít createThemedButton metodu
        // Toto vrátí RexUI button, ne SimpleButton
        if (scene.createThemedButton) {
            return scene.createThemedButton(text, x, y, onClick, config);
        }
        
        // Fallback na SimpleButton pokud není k dispozici BaseUI kontext
        return new SimpleButton(scene, x, y, text, onClick, 
            config.width || 220, 
            config.height || 48, 
            config.style || {}
        );
    }
    
    /**
     * Určí, který UI systém použít pro danou scénu
     * @param {Phaser.Scene} scene - Phaser scéna
     * @returns {string} 'lite' nebo 'base'
     */
    static getUISystem(scene) {
        // Seznam scén, které používají LiteUI
        const liteUIScenes = [
            'GameUIScene',
            'PauseScene',
            'GameOverScene'
        ];
        
        if (liteUIScenes.includes(scene.scene.key)) {
            return 'lite';
        }
        
        // Pokud scéna běží paralelně s jinou scénou, použít LiteUI
        if (scene.scene.isActive('GameScene') && scene.scene.key !== 'GameScene') {
            return 'lite';
        }
        
        return 'base';
    }
    
    /**
     * Helper pro vytvoření panelu
     * @param {Phaser.Scene} scene - Phaser scéna
     * @param {Object} config - Konfigurace panelu
     * @returns {Object} Panel object
     */
    static createPanel(scene, config = {}) {
        const defaultConfig = {
            x: config.x || 0,
            y: config.y || 0,
            width: config.width || 400,
            height: config.height || 300,
            color: config.color || UI_THEME.colors.background.panel,
            strokeColor: config.strokeColor || UI_THEME.colors.borders.default,
            strokeWidth: config.strokeWidth || UI_THEME.borderWidth.normal,
            alpha: config.alpha || 0.95
        };
        
        const panel = scene.add.rectangle(
            defaultConfig.x,
            defaultConfig.y,
            defaultConfig.width,
            defaultConfig.height,
            defaultConfig.color,
            defaultConfig.alpha
        );
        
        if (defaultConfig.strokeWidth > 0) {
            panel.setStrokeStyle(defaultConfig.strokeWidth, defaultConfig.strokeColor);
        }
        
        return panel;
    }
    
    /**
     * Helper pro vytvoření textu s theme styling
     * @param {Phaser.Scene} scene - Phaser scéna
     * @param {number} x - X pozice
     * @param {number} y - Y pozice
     * @param {string} text - Text
     * @param {Object} style - Text style
     * @returns {Phaser.GameObjects.Text} Text object
     */
    static createText(scene, x, y, text, style = {}) {
        const defaultStyle = {
            fontFamily: UI_THEME.fonts.primary,
            fontSize: `${UI_THEME.fontSizes.normal.desktop}px`,
            color: `#${UI_THEME.colors.text.primary.toString(16).padStart(6, '0')}`,
            ...style
        };
        
        return scene.add.text(x, y, text, defaultStyle);
    }
    
    /**
     * Cleanup helper pro bezpečné odstranění UI komponent
     * @param {Object} component - UI komponenta k odstranění
     */
    static destroy(component) {
        if (!component) return;
        
        // BaseUIComponent má vlastní cleanup
        if (component instanceof BaseUIComponent) {
            component.cleanup();
            component.destroy();
            return;
        }
        
        // SimpleModal/SimpleButton
        if (component.destroy && typeof component.destroy === 'function') {
            component.destroy();
            return;
        }
        
        // Generic Phaser object
        if (component.destroy) {
            component.destroy();
        }
    }
}

export default UIFactory;