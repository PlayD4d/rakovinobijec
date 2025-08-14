/**
 * Centrální UI Theme systém pro Rakovinobijec
 * Definuje všechny barvy, fonty, rozměry a styly
 * Základ pro konzistentní design napříč celou hrou
 */

export const UI_THEME = {
    // Barevná paleta
    colors: {
        // Primární barvy
        primary: 0x00ffff,      // Cyan - hlavní akcent (UI prvky, buttony)
        secondary: 0xff4444,     // Červená - nebezpečí, health warning
        success: 0x44ff44,       // Zelená - pozitivní akce, health
        warning: 0xffaa00,       // Oranžová - varování, upgrade
        info: 0x4488ff,         // Modrá - informace
        
        // Pozadí
        background: {
            panel: 0x2a2a2a,        // Tmavé panely (hlavní UI pozadí)
            modal: 0x1a1a1a,        // Ještě tmavší modals a dialogy  
            hud: 0x222222,          // HUD pozadí
            card: 0x333333,         // Karty (power-upy, atd.)
            overlay: 0x000000       // Semi-transparent overlay (alpha 0.8)
        },
        
        // Text barvy
        text: {
            primary: 0xffffff,      // Hlavní text (títulky, důležité info)
            secondary: 0xaaaaaa,    // Sekundární text (popisky)
            disabled: 0x666666,     // Zakázaný/neaktivní text
            accent: 0x00ffff,       // Zvýrazněný text (stejný jako primary)
            danger: 0xff4444,       // Varovný text (stejný jako secondary)
            success: 0x44ff44       // Pozitivní text (stejný jako success)
        },
        
        // Rámečky a ohraničení
        borders: {
            default: 0xffffff,     // Standardní rámeček
            active: 0x00ffff,      // Aktivní prvky (hover, focus)
            selected: 0xffaa00,    // Vybrané prvky
            danger: 0xff4444,      // Nebezpečné akce
            success: 0x44ff44,     // Pozitivní akce
            disabled: 0x666666     // Zakázané prvky
        },
        
        // Specifické barvy pro power-upy (z PowerUpManager)
        powerUp: {
            weapon: 0xff4444,      // Zbraňové power-upy (červená)
            upgrade: 0x44ff44,     // Upgrade power-upy (zelená) 
            special: 0x4488ff,     // Speciální power-upy (modrá)
            rare: 0xffaa00         // Vzácné power-upy (oranžová)
        }
    },
    
    // Font systém
    fonts: {
        primary: 'Public Pixel, monospace',
        fallback: 'monospace'
    },
    
    // Velikosti fontů (responzivní)
    fontSizes: {
        tiny: { desktop: 14, mobile: 12 },
        small: { desktop: 16, mobile: 14 },
        normal: { desktop: 18, mobile: 16 },
        large: { desktop: 20, mobile: 18 },
        xlarge: { desktop: 28, mobile: 24 },
        title: { desktop: 36, mobile: 28 }
    },
    
    // Rozestupy a padding
    spacing: {
        xs: 4,    // Extra small
        s: 8,     // Small  
        m: 16,    // Medium
        l: 24,    // Large
        xl: 32,   // Extra large
        xxl: 48   // XX Large
    },
    
    // Border radius pro zaoblení rohů
    borderRadius: {
        none: 0,
        small: 4,
        medium: 8, 
        large: 16,
        pill: 999  // Kompletně zaoblené (pilulka)
    },
    
    // Tloušťky rámečků
    borderWidth: {
        thin: 1,
        normal: 2,
        thick: 3,
        heavy: 4
    },
    
    // Stíny a depth
    shadows: {
        small: '0 2px 4px rgba(0,0,0,0.3)',
        medium: '0 4px 8px rgba(0,0,0,0.4)', 
        large: '0 8px 16px rgba(0,0,0,0.5)'
    },
    
    // Z-index hodnoty (převzato z UiConstants.js)
    depth: {
        background: 0,
        game: 1000,
        hud: 10003,
        overlay: 10000,
        panel: 10001,
        content: 10002,
        modal: 10004,
        tooltip: 10005
    }
};

/**
 * Utility funkce pro práci s UI Theme
 */
export class UIThemeUtils {
    
    /**
     * Získá barvu podle typu power-upu
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
     * Získá responzivní font size
     */
    static getFontSize(size, isMobile = false) {
        const sizeConfig = UI_THEME.fontSizes[size];
        if (!sizeConfig) return UI_THEME.fontSizes.normal[isMobile ? 'mobile' : 'desktop'];
        return sizeConfig[isMobile ? 'mobile' : 'desktop'];
    }
    
    /**
     * Vytvoří font config objekt (kompatibilní s existujícím fontConfig.js)
     */
    static createFontConfig(size, color = 'primary', options = {}) {
        const isMobile = options.isMobile || false;
        const fontSize = this.getFontSize(size, isMobile);
        
        // Bezpečné řešení pro text color
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
        
        // Přidat stroke pokud je požadován
        if (options.stroke) {
            config.stroke = '#000000';
            config.strokeThickness = options.strokeThickness || 2;
        }
        
        return config;
    }
    
    /**
     * Získá hex string z color hodnoty
     */
    static colorToHex(color) {
        if (typeof color === 'string') return color;
        if (typeof color === 'undefined' || color === null) return '#ffffff';
        return `#${color.toString(16).padStart(6, '0')}`;
    }
    
    /**
     * Zkontroluje zda je zařízení mobile (helper)
     */
    static isMobile() {
        return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    }
}

// Přidat colorToHex funkci na UI_THEME objekt pro lepší kompatibilitu
UI_THEME.colorToHex = UIThemeUtils.colorToHex;

export default UI_THEME;