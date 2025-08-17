# VFX & SFX System - Druhá sada oprav

## ✅ Vyřešené problémy

### 1. Chybějící VFX presety
**Problém**: Mnoho VFX presetů nebylo definováno, což způsobovalo varování v konzoli
**Řešení**: Přidáno 20+ nových presetů do VFXPresets.js:
- Základní efekty: `effect`, `small`, `medium`, `special`
- Shield efekty: `shield.break`, `shield.activate`
- Power-up efekty: `powerup`, `powerup.epic`
- Boss efekty: `boss.special`, `boss.spawn`, `boss.death`, `boss.phase`
- Speciální efekty: `telegraph`, `trail.small`, `trail.toxic`

### 2. EventBus whitelist varování
**Problém**: Debug a UI eventy nebyly na whitelistu
**Řešení**: Přidány chybějící eventy do EventWhitelist.js:
- UI eventy: `ui.escape`, `menu.escape`
- Debug eventy: `debug.overlay.toggle`, `debug.enemy.spawn`, `debug.boss.spawn`, `debug.vfx.test`, `debug.sfx.soundboard`, `debug.missing-assets.toggle`

### 3. VFX efekt střelby nezůstává na hráči
**Status**: Známé omezení
**Vysvětlení**: Particle emittery v Phaseru jsou vytvořeny na fixní pozici a automaticky nesledují objekty. Pro správné fungování by bylo potřeba:
- Buď připojit emitter jako child objekt k hráči
- Nebo kontinuálně updatovat pozici emitteru v update loopu
- Nebo použít jiný typ efektu (sprite animace místo částic)

Toto je architektonické omezení současného SimplifiedVFXSystem a vyžadovalo by větší refaktoring pro plnou podporu "following" efektů.

## 📊 Souhrn změn

### VFXPresets.js
- Přidáno 20+ nových preset metod
- Rozšířena getPreset() mapa o všechny nové presety
- Přidány aliasy pro zkrácené názvy (`small` → `hit.small`)

### EventWhitelist.js
- Přidáno 8 nových eventů do whitelistu
- UI sekce: +2 eventy
- DEBUG sekce: +6 eventů

## 🎮 Aktuální stav

✅ **VFX presety fungují** - žádná varování o chybějících presetech
✅ **EventBus funguje** - žádná varování o nepovolených eventech
⚠️ **VFX střelby** - funguje, ale nezůstává na hráči při pohybu (známé omezení)

## 💡 Doporučení pro budoucnost

1. **Following VFX**: Pokud je potřeba, aby efekty sledovaly entity, zvážit:
   - Rozšíření SimplifiedVFXSystem o `followEntity` funkci
   - Použití sprite animací místo particle systému pro některé efekty
   - Implementace update mechanismu pro aktivní efekty

2. **Performance**: S tolika novými presety monitorovat výkon, zejména při mnoha současných efektech

3. **Customizace**: Presety nyní pokrývají většinu případů, ale blueprinty mohou stále definovat vlastní inline konfigurace pro unikátní efekty