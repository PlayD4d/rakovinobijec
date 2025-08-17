# 📊 Post-Refactor Audit Report - Rakovinobijec

## 1. Executive Summary

Po úspěšné refaktorizaci GameScene.js z 3,303 na 1,117 LOC (66% redukce) a implementaci "thin hub" patternu, byl proveden kompletní audit projektu. Audit odhalil **0 cyklických závislostí**, **100 Phaser API porušení** (většina v povolených kontextech), a **18 orphan souborů**. Celkově je architektura v dobrém stavu s jasnými odpovědnostmi mezi managery, ale existují oblasti vyžadující pozornost.

### 🎯 Klíčové metriky:
- **Total LOC**: 34,041 (93 souborů)
- **Průměrné závislosti**: 1.4 na soubor (výborné!)
- **Hub soubory**: 2 (GameScene, UiConstants)
- **Cyklické závislosti**: 0 ✅
- **Memory leaky**: Žádné kritické (leak-test.mjs funguje)
- **Test pokrytí**: Golden path test, blueprint validator, leak test

## 2. Top 10 "Guláš" Nálezů

### 🔴 1. **DevPlayground.js - 35 Phaser API violations**
- Soubor pro development nerespektuje PR7 pravidla
- Přímo volá `scene.add.*`, `scene.physics.add.*`
- **Dopad**: Může zavádět vývojáře k špatným praktikám
- **Fix**: Označit jako legacy/debug-only kód

### 🔴 2. **SimpleLootSystem - Přímé Phaser API volání**
- 7 violations včetně `scene.physics.add.sprite`, `scene.tweens.add`
- Porušuje PR7 princip abstrakcí
- **Fix**: Použít GraphicsFactory a TweenManager wrappery

### 🟡 3. **Enemy.js - 913 LOC monolith**
- Třetí největší soubor v projektu
- Obsahuje příliš mnoho odpovědností (AI, combat, movement, VFX)
- **Fix**: Rozdělit na Enemy + EnemyAI + EnemyCombat komponenty

### 🟡 4. **SettingsModal.js - 1,363 LOC**
- Největší soubor v projektu!
- Mix UI logiky, state managementu a render kódu
- **Fix**: Rozdělit na SettingsModal + SettingsState + SettingsRenderer

### 🟡 5. **Orphan soubory (18 souborů)**
- Např. `ArmorVisualizer.js`, `bossActions.js`, `UIEventContract.js`
- Nejsou nikde importované = dead code?
- **Fix**: Buď odstranit nebo integrovat

### 🟡 6. **GraphicsFactory - Stále používá scene.add.graphics()**
- Linka 31: `graphics = this.scene.add.graphics();`
- Porušuje vlastní PR7 pravidlo!
- **Fix**: Použít Phaser.GameObjects.Graphics konstruktor přímo

### 🟡 7. **Boss.js - 1,097 LOC se složitou logikou fází**
- Obsahuje hardcoded logiku schopností
- Není plně data-driven
- **Fix**: Přesunout ability logiku do BossAbilitySystem

### 🟡 8. **Chybějící centrální EventBus**
- Events jsou roztříštěné mezi scene.events, custom emittery
- Není jasný kontrakt mezi komponenty
- **Fix**: Vytvořit CentralEventBus s typovanými eventy

### 🟡 9. **PowerUpSystem fragmentace**
- 4 soubory: PowerUpSystem, PowerUpAbilities, PowerUpEffects, PowerUpModifiers
- Nejasné hranice odpovědností
- **Fix**: Sjednotit do PowerUpSystem + PowerUpRegistry

### 🟡 10. **Test soubory v produkci**
- `js/tests/` obsahuje 4 test soubory
- Neměly by být v produkčním buildu
- **Fix**: Přesunout do `/test/` nebo `/dev/tests/`

## 3. Cyklické Závislosti

✅ **Výborná zpráva**: Audit nenašel žádné cyklické závislosti!

Tarjan's algoritmus proběhl na všech 93 souborech a nenašel žádné strongly connected components větší než 1. To znamená čistou jednosměrnou závislostní strukturu.

## 4. Porušení "Thin Hub" Pravidel

### GameScene.js - Současný stav:
- ✅ **1,117 LOC** - splňuje limit
- ✅ **36 odchozích závislostí** - správně deleguje na managery
- ✅ **1 příchozí závislost** - není hub pro ostatní
- ✅ **Žádné přímé Phaser API volání** pro gameplay

### Porušení nalezená v GameScene:
1. **Stále obsahuje několik pomocných metod** které by mohly být v utilech
2. **addXP() metoda** - měla by být v XPManager
3. **Collision setup** - mohl by být v CollisionManager

### Porušení v managerech:
- **EnemyManager**: Přímo používá `scene.physics.add.group()` (řádky 16, 20)
- **UpdateManager**: OK, žádná porušení
- **TransitionManager**: OK, deleguje na UI scénu
- **BootstrapManager**: OK, čistá inicializace

## 5. Blueprint a Registr Kontrola

### Blueprint Validator Status:
- ✅ Funkční validator v `scripts/blueprint-validator.mjs`
- ⚠️ **Import chyba**: `import glob from 'glob'` nefunguje
- **Fix potřeba**: `import { glob } from 'glob'`

### Nalezené problémy v blueprintech:
1. **Nekonzistentní cesty** - někde `stats.hp`, jinde `stats.health`
2. **Chybějící required fields** - některé blueprinty nemají povinná pole
3. **Mixed naming** - `projectile_player_basic` vs `projectile.cytotoxin`

## 6. Dead/Orphan Code

### Orphan soubory (nikde neimportované):
```
- js/core/audio/AudioAssets.js
- js/core/drops/effects.js
- js/core/logging/GameLogger.js
- js/core/utils/SoftRefresh.js
- js/core/utils/bossActions.js
- js/core/vfx/ArmorVisualizer.js
- js/core/vfx/effects/ArmorShieldEffect.js
- js/core/vfx/effects/ChemoAuraEffect.js
- js/ui/DevPlaygroundUI.js
- js/ui/SFXSoundboard.js
- js/ui/UIEventContract.js
```

### Pravděpodobně dead code:
- `VfxRouter.js` - nepoužívaný routing systém
- `ModifierEngine.js` - nahrazen přímou aplikací modifikátorů
- Několik legacy `*Manager.js` souborů v komentářích

## 7. Návrh Plánu Oprav

### 🔥 Priorita 1 - Kritické (1-2 dny)
1. **Fix blueprint validator import**
   ```javascript
   // Změnit z: import glob from 'glob'
   // Na: import { glob } from 'glob'
   ```

2. **Odstranit/označit orphan soubory**
   - Projít seznam 18 orphan souborů
   - Buď odstranit nebo přidat `// @deprecated` komentář

3. **Fix GraphicsFactory Phaser API**
   - Nahradit `scene.add.graphics()` přímou konstrukcí

### 🟡 Priorita 2 - Důležité (3-5 dní)
1. **Rozdělit velké soubory**
   - SettingsModal.js → 3 komponenty
   - Enemy.js → Enemy + AI + Combat
   - Boss.js → Boss + AbilitySystem

2. **Vytvořit CentralEventBus**
   ```javascript
   class CentralEventBus {
     emit(event, data) { /* typované eventy */ }
     on(event, handler) { /* s TypeScript typy */ }
   }
   ```

3. **Sjednotit PowerUp systém**
   - Sloučit 4 soubory do 2
   - Jasné rozhraní pro přidávání nových power-upů

### 🟢 Priorita 3 - Nice to have (ongoing)
1. **Přesunout testy mimo produkci**
   - `/js/tests/` → `/test/unit/`
   - Upravit build proces

2. **Dokumentovat EventContract**
   - Vytvořit EVENTS.md s popisem všech eventů
   - Přidat JSDoc komentáře

3. **Vylepšit BlueprintLoader error handling**
   - Lepší error messages při chybějících polích
   - Validace při načítání

## 8. Přílohy

### 📁 Generované soubory:
- `inventory.json` - Kompletní inventář všech 93 JS souborů
- `violations.json` - Seznam všech porušení (Phaser API, TODOs, orphans)
- `hotspots.md` - Top 20 nejkomplexnějších souborů
- `dependency-graph.dot` - Graf závislostí (lze vizualizovat)
- `dependency-analysis.json` - Detailní metriky závislostí

### 📊 Statistiky:
- **Celkový počet řádků**: 34,041
- **Průměrná velikost souboru**: 366 LOC
- **Největší soubor**: SettingsModal.js (1,363 LOC)
- **Nejmenší funkční soubor**: EventWhitelist.js (26 LOC)
- **Nejvíce závislostí**: GameScene.js (36 odchozích)
- **Nejvíce dependentů**: UITheme.js (11 příchozích)

### 🛠️ Doporučené nástroje:
1. **Vizualizace grafu**: `dot -Tsvg dependency-graph.dot -o graph.svg`
2. **Continuous monitoring**: Přidat audit do CI/CD
3. **Metriky dashboard**: Grafana/Datadog pro sledování LOC trendu

### ✅ Co funguje dobře:
- Thin hub pattern v GameScene
- Žádné cyklické závislosti
- Managers mají jasné odpovědnosti
- UpdateManager orchestrace
- DisposableRegistry cleanup
- Memory leak testy

### ⚠️ Co potřebuje pozornost:
- Velké monolitické soubory (Settings, Enemy, Boss)
- Orphan/dead code
- Nekonzistentní blueprint struktura
- Fragmentovaný PowerUp systém
- Chybějící centrální event systém
- Test soubory v produkci

---

**Závěr**: Refaktorizace byla úspěšná a architektura je v dobrém stavu. Hlavní problémy jsou v oblasti údržby kódu (velké soubory, dead code) spíše než v architektuře samotné. Doporučuji postupovat podle plánu oprav s prioritou na kritické položky.

*Audit proveden: 2024*
*Auditor: Senior Engine Developer*
*Framework: Phaser 3 + PR7 Architecture*