/**
 * Rozšířené UI konstanty pro unified UI systém
 * Integrace s novým UI_THEME systémem
 */
import { UI_THEME } from './UITheme.js';

// Zachováváme původní UI_DEPTH pro kompatibilitu, ale odkazujeme na UI_THEME
export const UI_DEPTH = UI_THEME.depth;

// Responsive utilities pro komponenty
export const RESPONSIVE = {
    // Adaptivní velikosti karet (PowerUpManager, atd.)
    getCardSize: (isMobile = false) => ({
        width: isMobile ? 280 : 320,
        height: isMobile ? 320 : 360,  // Menší výška pro lepší fit
        padding: isMobile ? UI_THEME.spacing.s : UI_THEME.spacing.m
    }),
    
    // Adaptivní rozestupy
    getSpacing: (isMobile = false) => ({
        small: isMobile ? UI_THEME.spacing.xs : UI_THEME.spacing.s,
        medium: isMobile ? UI_THEME.spacing.s : UI_THEME.spacing.m,
        large: isMobile ? UI_THEME.spacing.m : UI_THEME.spacing.l
    }),
    
    // Adaptivní velikosti modálů - menší výška aby se vešlo na obrazovku
    getModalSize: (isMobile = false, screenWidth = window.innerWidth, screenHeight = window.innerHeight) => {
        if (isMobile) {
            return {
                width: Math.min(screenWidth - 40, 900),
                height: Math.min(screenHeight - 100, 500),
                maxWidth: screenWidth * 0.9,
                maxHeight: screenHeight * 0.75
            };
        } else {
            return {
                width: Math.min(screenWidth * 0.9, 1100),
                height: Math.min(screenHeight * 0.7, 600),
                maxWidth: 1200,
                maxHeight: 650
            };
        }
    },
    
    // Touch target minimum sizes (iOS/Android guidelines)
    getTouchTargetSize: () => ({
        minWidth: 44,   // iOS minimum
        minHeight: 44,  // iOS minimum
        recommended: 48 // Android recommended
    }),
    
    // Breakpoints pro responsive design
    breakpoints: {
        mobile: 768,
        tablet: 1024,
        desktop: 1440
    },
    
    // Utility pro detekci screen size
    getScreenType: (width = window.innerWidth) => {
        if (width < RESPONSIVE.breakpoints.mobile) return 'mobile';
        if (width < RESPONSIVE.breakpoints.tablet) return 'tablet';
        return 'desktop';
    }
};

// Component factory utilities
export const UI_COMPONENTS = {
    /**
     * Vytvoří standardní RexUI panel s theme styling
     */
    createThemedPanel: (scene, config = {}) => {
        const defaultConfig = {
            width: 400,
            height: 300,
            color: UI_THEME.colors.background.panel,
            strokeColor: UI_THEME.colors.borders.default,
            strokeWidth: UI_THEME.borderWidth.normal,
            radius: UI_THEME.borderRadius.medium,
            ...config
        };
        
        return scene.rexUI.add.roundRectangle(0, 0, 
            defaultConfig.width, 
            defaultConfig.height, 
            defaultConfig.radius, 
            defaultConfig.color
        ).setStrokeStyle(defaultConfig.strokeWidth, defaultConfig.strokeColor);
    },
    
    /**
     * Vytvoří standardní button s theme styling
     */
    createThemedButton: (scene, text, config = {}) => {
        const isMobileDevice = isMobile();
        const size = RESPONSIVE.getTouchTargetSize();
        
        const defaultConfig = {
            width: Math.max(size.recommended * 3, 120),
            height: size.recommended,
            backgroundColor: UI_THEME.colors.primary,
            textColor: UI_THEME.colors.text.primary,
            fontSize: UI_THEME.fontSizes.normal[isMobileDevice ? 'mobile' : 'desktop'],
            ...config
        };
        
        return scene.rexUI.add.label({
            background: scene.rexUI.add.roundRectangle(0, 0, 
                defaultConfig.width, 
                defaultConfig.height, 
                UI_THEME.borderRadius.small, 
                defaultConfig.backgroundColor
            ),
            text: scene.add.text(0, 0, text, {
                fontFamily: UI_THEME.fonts.primary,
                fontSize: `${defaultConfig.fontSize}px`,
                color: UI_THEME.colorToHex(defaultConfig.textColor)
            }),
            space: { left: UI_THEME.spacing.m, right: UI_THEME.spacing.m },
            align: 'center'
        });
    }
};

// Zachováváme původní funkce pro kompatibilitu
export function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

export function getFontScale(camera) {
  const w = camera?.width || window.innerWidth;
  // Integrovaný s novým responsive systémem
  const screenType = RESPONSIVE.getScreenType(w);
  switch(screenType) {
    case 'mobile': return 1.1;
    case 'tablet': return 1.0;
    default: return 1.0;
  }
}


