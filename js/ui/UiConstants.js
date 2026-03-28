/**
 * Rozšířené UI konstanty pro unified UI systém
 * Integrace s novým UI_THEME systémem
 */
import { UI_THEME } from './UITheme.js';

// Zachováváme původní UI_DEPTH pro kompatibilitu, ale odkazujeme na UI_THEME
export const UI_DEPTH = UI_THEME.depth;

// Responsive utilities pro komponenty
export const RESPONSIVE = {
    // Adaptivní velikosti karet (PowerUpSystem, atd.)
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


