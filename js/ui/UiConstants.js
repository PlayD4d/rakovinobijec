/**
 * Extended UI constants for unified UI system
 * Integration with the new UI_THEME system
 */
import { UI_THEME } from './UITheme.js';

// Responsive utilities for components
export const RESPONSIVE = {
    // Adaptive card sizes (PowerUpSystem, etc.)
    getCardSize: (isMobile = false) => ({
        width: isMobile ? 280 : 320,
        height: isMobile ? 320 : 360,  // Smaller height for better fit
        padding: isMobile ? UI_THEME.spacing.s : UI_THEME.spacing.m
    }),
    
    // Adaptive spacing
    getSpacing: (isMobile = false) => ({
        small: isMobile ? UI_THEME.spacing.xs : UI_THEME.spacing.s,
        medium: isMobile ? UI_THEME.spacing.s : UI_THEME.spacing.m,
        large: isMobile ? UI_THEME.spacing.m : UI_THEME.spacing.l
    }),
    
    // Adaptive modal sizes - smaller height to fit on screen
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
    
    // Breakpoints for responsive design
    breakpoints: {
        mobile: 768,
        tablet: 1024,
        desktop: 1440
    },
    
    // Utility for screen size detection
    getScreenType: (width = window.innerWidth) => {
        if (width < RESPONSIVE.breakpoints.mobile) return 'mobile';
        if (width < RESPONSIVE.breakpoints.tablet) return 'tablet';
        return 'desktop';
    }
};

// Keep original functions for backward compatibility
export function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

// getFontScale removed — unused, font sizes come from UITheme


