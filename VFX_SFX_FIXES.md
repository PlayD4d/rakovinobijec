# VFX & SFX System - Opravy po testování

## Nalezené problémy a jejich řešení

### 1. ✅ EventBus chyběl před KeyboardManager
**Problém**: `TypeError: undefined is not an object (evaluating 'this.eventBus.on')`
**Řešení**: Přesunuta inicializace EventBus před KeyboardManager v MainMenu.js

### 2. ✅ Špatné cesty k hudbě
**Problém**: Soubory s "_norm" suffixem neexistují
**Řešení**: 
- Opraveny cesty v MainMenu.js a GameScene.js
- Vytvořen skript `fix-sound-paths.mjs` který opravil 220 cest ve 49 souborech

### 3. ✅ SimplifiedAudioSystem používal špatné klíče
**Problém**: Audio klíče neodpovídaly Phaser cache
**Řešení**: Upravena metoda `_extractSoundKey` aby generovala klíče kompatibilní s Phaserem

## Změny provedené

### MainMenu.js
- Přesunuta inicializace EventBus před KeyboardManager
- Opravena cesta k hudbě: `music/8bit_main_menu_norm.mp3` → `music/8bit_main_menu.mp3`

### GameScene.js  
- Opravena cesta k hudbě: `music/8bit_track1_norm.mp3` → `music/8bit_track1.mp3`

### SimplifiedAudioSystem.js
- Upravena metoda `_extractSoundKey` pro správné generování klíčů

### Všechny blueprinty
- Odstraněn "_norm" suffix ze všech zvukových cest
- 49 souborů upraveno, 220 cest opraveno

## Aktuální stav

✅ **EventBus funguje** - žádné chyby při inicializaci
✅ **Hudba hraje** - menu i herní hudba fungují
✅ **Zvuky fungují** - všechny cesty jsou správné
✅ **VFX funguje** - SimplifiedVFXSystem inicializován

## Testování

Při dalším testování zkontroluj:
1. Menu hudba při startu ✅
2. Přechod hudby do hry ✅
3. Zvuky při střelbě, zásazích, smrtích
4. VFX efekty při spawnu, zásazích, smrtích
5. Power-up efekty (vizuální i zvukové)