// Centralizovaná konfigurace fontů pro celou hru
export const FONT_CONFIG = {
    // Public Pixel font pro celou hru
    family: '"PublicPixel", monospace',
    fallbackFamily: 'monospace',
    defaultColor: '#ffffff',
    strokeColor: '#000000'
};

// Velikosti fontů - upravené pro Public Pixel font
export const FONT_SIZES = {
    tiny: 12,        // Malé info texty (zvětšeno z 10)
    small: 14,       // UI elementy (zvětšeno z 12)
    normal: 18,      // Menu položky (zvětšeno z 16)
    medium: 22,      // Důležité texty (zvětšeno z 20)
    large: 26,       // Nadpisy sekcí (zvětšeno z 24)
    huge: 36,        // Hlavní titulek (zvětšeno z 32)
    massive: 52      // Extra velké titulky (zvětšeno z 48)
};

// Barevná paleta pro texty
export const FONT_COLORS = {
    white: '#ffffff',
    yellow: '#ffff00',
    red: '#ff0000',
    green: '#00ff00',
    cyan: '#00ffff',
    orange: '#ff8800',
    gray: '#cccccc',
    darkGray: '#888888',
    lightGray: '#aaaaaa',
    black: '#000000'
};

// Hlavní funkce pro vytvoření font stylu
export function createFontConfig(size = 'normal', color = 'white', options = {}) {
    const actualSize = typeof size === 'string' ? FONT_SIZES[size] : size;
    const actualColor = typeof color === 'string' ? FONT_COLORS[color] : color;
    
    const config = {
        fontFamily: FONT_CONFIG.family,
        fontSize: `${actualSize}px`,
        fill: actualColor,
        padding: { x: 12, y: 10 },  // Větší padding pro Public Pixel font
        resolution: 1
    };
    
    // Přidat stroke pokud je požadován
    if (options.stroke || options.withStroke) {
        config.stroke = options.strokeColor || FONT_CONFIG.strokeColor;
        config.strokeThickness = options.strokeThickness || Math.max(1, Math.floor(actualSize / 8));
    }
    
    // Přidat další možnosti
    if (options.align) config.align = options.align;
    if (options.wordWrap) config.wordWrap = options.wordWrap;
    if (options.lineSpacing) config.lineSpacing = options.lineSpacing;
    
    return config;
}

// Přednastavené styly pro častá použití
export const PRESET_STYLES = {
    // Hlavní menu
    gameTitle: () => createFontConfig('massive', 'white', { stroke: true, strokeThickness: 4 }),
    menuItem: () => createFontConfig('normal', 'gray'),
    menuItemSelected: () => createFontConfig('normal', 'white'),
    subtitle: () => createFontConfig('small', 'lightGray'),
    
    // UI ve hře
    uiText: () => createFontConfig('small', 'white', { stroke: true }),
    uiValue: () => createFontConfig('small', 'yellow', { stroke: true }),
    
    // Dialogy a menu
    dialogTitle: () => createFontConfig('large', 'white', { stroke: true }),
    dialogText: () => createFontConfig('small', 'gray'),
    buttonText: () => createFontConfig('normal', 'white'),
    
    // Herní stavy
    gameOver: () => createFontConfig('huge', 'red', { stroke: true, strokeThickness: 6 }),
    paused: () => createFontConfig('large', 'yellow', { stroke: true }),
    levelUp: () => createFontConfig('large', 'cyan', { stroke: true }),
    
    // Informační texty
    description: () => createFontConfig('tiny', 'lightGray'),
    controls: () => createFontConfig('tiny', 'darkGray'),
    warning: () => createFontConfig('small', 'orange')
};

// Čekání na načtení fontu
export function waitForFont() {
    return new Promise((resolve) => {
        if (document.fonts && document.fonts.ready) {
            // Explicitly check for PublicPixel font
            const fontFace = new FontFace('PublicPixel', 'url(fonts/PublicPixel.woff2)');
            fontFace.load().then(() => {
                document.fonts.add(fontFace);
                console.log('PublicPixel font loaded and ready');
                resolve();
            }).catch(() => {
                console.log('PublicPixel font fallback');
                setTimeout(resolve, 500);
            });
        } else {
            // Fallback pro starší prohlížeče
            setTimeout(resolve, 500);
        }
    });
}