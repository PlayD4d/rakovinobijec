/**
 * Central UI Theme system for Rakovinobijec
 * Defines all colors, fonts, dimensions and styles
 * Foundation for consistent design across the entire game
 */

export const UI_THEME = {
    // Color palette
    colors: {
        // Primary colors
        primary: 0x00ffff,      // Cyan - main accent (UI elements, buttons)
        secondary: 0xff4444,     // Red - danger, health warning
        success: 0x44ff44,       // Green - positive action, health
        warning: 0xffaa00,       // Orange - warning, upgrade
        info: 0x4488ff,         // Blue - information

        // Backgrounds
        background: {
            panel: 0x2a2a2a,        // Dark panels (main UI background)
            modal: 0x1a1a1a,        // Even darker modals and dialogs
            hud: 0x222222,          // HUD background
            card: 0x333333,         // Cards (power-ups, etc.)
            overlay: 0x000000       // Semi-transparent overlay (alpha 0.8)
        },

        // Text colors
        text: {
            primary: 0xffffff,      // Main text (titles, important info)
            secondary: 0xaaaaaa,    // Secondary text (descriptions)
            disabled: 0x666666,     // Disabled/inactive text
            accent: 0x00ffff,       // Highlighted text (same as primary)
            danger: 0xff4444,       // Warning text (same as secondary)
            success: 0x44ff44       // Positive text (same as success)
        },

        // Borders and outlines
        borders: {
            default: 0xffffff,     // Standard border
            active: 0x00ffff,      // Active elements (hover, focus)
            selected: 0xffaa00,    // Selected elements
            danger: 0xff4444,      // Dangerous actions
            success: 0x44ff44,     // Positive actions
            disabled: 0x666666     // Disabled elements
        },

        // Power-up specific colors (from PowerUpSystem)
        powerUp: {
            weapon: 0xff4444,      // Weapon power-ups (red)
            upgrade: 0x44ff44,     // Upgrade power-ups (green)
            special: 0x4488ff,     // Special power-ups (blue)
            rare: 0xffaa00         // Rare power-ups (orange)
        }
    },
    
    // Font system
    fonts: {
        primary: 'Public Pixel, monospace',
        fallback: 'monospace'
    },
    
    // Font sizes (responsive)
    fontSizes: {
        tiny: { desktop: 14, mobile: 12 },
        small: { desktop: 16, mobile: 14 },
        normal: { desktop: 18, mobile: 16 },
        large: { desktop: 20, mobile: 18 },
        xlarge: { desktop: 28, mobile: 24 },
        title: { desktop: 36, mobile: 28 }
    },
    
    // Spacing and padding
    spacing: {
        xs: 4,    // Extra small
        s: 8,     // Small  
        m: 16,    // Medium
        l: 24,    // Large
        xl: 32,   // Extra large
        xxl: 48   // XX Large
    },
    
    // Border radius for rounded corners
    borderRadius: {
        none: 0,
        small: 4,
        medium: 8, 
        large: 16,
        pill: 999  // Fully rounded (pill shape)
    },
    
    // Border widths
    borderWidth: {
        thin: 1,
        normal: 2,
        thick: 3,
        heavy: 4
    },
    
    // Depth layering (Phaser setDepth values)
    depth: {
        background: 0,
        game: 1000,
        hud: 10003,
        panel: 10001,
        content: 10002,
        overlay: 250000,    // Modal overlay (below modal content)
        modal: 250100,      // Modals (above everything except tooltip)
        tooltip: 260000     // Tooltips (above modals)
    }
};

/**
 * Utility functions for working with UI Theme
 */
export class UIThemeUtils {
    
    /**
     * Get color by power-up type
     */
    static getPowerUpColor(type) {
        const colorMap = {
            'weapon': UI_THEME.colors.powerUp.weapon,
            'upgrade': UI_THEME.colors.powerUp.upgrade,
            'special': UI_THEME.colors.powerUp.special,
            'rare': UI_THEME.colors.powerUp.rare
        };
        return colorMap[type] || UI_THEME.colors.primary;
    }
    
    /**
     * Get responsive font size
     */
    static getFontSize(size, isMobile = false) {
        const sizeConfig = UI_THEME.fontSizes[size];
        if (!sizeConfig) return UI_THEME.fontSizes.normal[isMobile ? 'mobile' : 'desktop'];
        return sizeConfig[isMobile ? 'mobile' : 'desktop'];
    }
    
    /**
     * Create font config object (compatible with existing fontConfig.js)
     */
    static createFontConfig(size, color = 'primary', options = {}) {
        const isMobile = options.isMobile || false;
        const fontSize = this.getFontSize(size, isMobile);
        
        // Safe resolution of text color
        let textColor;
        if (typeof color === 'string') {
            textColor = UI_THEME.colors.text[color] || UI_THEME.colors.text.primary;
        } else {
            textColor = color || UI_THEME.colors.text.primary;
        }
        
        const config = {
            fontFamily: UI_THEME.fonts.primary,
            fontSize: `${fontSize}px`,
            color: `#${textColor.toString(16).padStart(6, '0')}`
        };
        
        // Add stroke if requested
        if (options.stroke) {
            config.stroke = '#000000';
            config.strokeThickness = options.strokeThickness || 2;
        }
        
        return config;
    }
    
    /**
     * Get hex string from color value
     */
    static colorToHex(color) {
        if (typeof color === 'string') return color;
        if (typeof color === 'undefined' || color === null) return '#ffffff';
        return `#${color.toString(16).padStart(6, '0')}`;
    }
    
    /**
     * Check if device is mobile (helper)
     */
    static isMobile() {
        return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    }
}

// Add colorToHex function to UI_THEME object for better compatibility
UI_THEME.colorToHex = UIThemeUtils.colorToHex;

