# Rakovinobijec - Audit Summary

## Statistiky

- **Celkem souborů:** 84
- **Celkem LOC:** 33359
- **Průměr LOC:** 397

## Architektonická mapa

### util (13 souborů, 2844 LOC)
Hlavní soubory: config.js, AudioAssets.js, EventWhitelist.js

### other (25 souborů, 8807 LOC)
Hlavní soubory: FrameworkDebugAPI.js, TelemetryLogger.js, BlueprintLoader.js

### config (1 souborů, 114 LOC)
Hlavní soubory: GameConstants.js

### system (5 souborů, 2336 LOC)
Hlavní soubory: SimplifiedAudioSystem.js, ProjectileSystem.js, SimpleLootSystem.js

### ui-component (27 souborů, 11776 LOC)
Hlavní soubory: DisplayResolver.js, KeyboardManager.js, devConsole.js

### factory (1 souborů, 89 LOC)
Hlavní soubory: GraphicsFactory.js

### entity (1 souborů, 434 LOC)
Hlavní soubory: BossAbilitiesV2.js

### manager (4 souborů, 1595 LOC)
Hlavní soubory: AnalyticsManager.js, GlobalHighScoreManager.js, HighScoreManager.js

### scene (4 souborů, 4761 LOC)
Hlavní soubory: DevPlayground.js, GameScene.js, GameUIScene.js

### test (3 souborů, 603 LOC)
Hlavní soubory: ConfigResolver.test.js, boss_pr7_smoketest.js, enemy_pr7_smoketest.js

## "One Source of Truth" porušení

1. **GameScene (3303 LOC)** - obsahuje duplicitní logiku:
   - Ruční spawn XP/health (má být v SimpleLootSystem)
   - Generování textur (má být v systémech)
   - Přímé tweens pro efekty (má být ve VFX systému)
   - Rozprostřené kolize (mají být centralizované)
2. **Duplicitní VFX/SFX systémy** - SimplifiedVFXSystem vs VFXRegistry vs přímé volání
3. **Rozptýlená UI logika** - části v GameScene, části v GameUIScene, části v modalech

## Top 5 rizik

1. **js/ui/SettingsModal.js** (Score: 5452)
   - 1363 LOC, fan-in: 0, fan-out: 4
   - Riziko: OK

2. **js/scenes/GameScene.js** (Score: 3303)
   - 3303 LOC, fan-in: 1, fan-out: 0
   - Riziko: velmi velký soubor, příliš mnoho logiky v scéně

3. **js/ui/BaseUIComponent.js** (Score: 2982)
   - 426 LOC, fan-in: 5, fan-out: 2
   - Riziko: OK

4. **js/ui/PowerUpSelectionModal.js** (Score: 2514)
   - 838 LOC, fan-in: 0, fan-out: 3
   - Riziko: OK

5. **js/entities/Boss.js** (Score: 2194)
   - 1097 LOC, fan-in: 0, fan-out: 2
   - Riziko: OK

## Priority refaktoringu

### Fáze 1: Vyčištění GameScene
1. **Extrakce kolizí** - vytvořit setupCollisions() funkci
2. **Odstranění spawn logiky** - vše přes SimpleLootSystem
3. **Smazání generování textur** - textury generují systémy z blueprintů
4. **Centralizace depth vrstev** - konzistentní DEPTH_LAYERS
5. **Odstranění duplicitních tweens** - VFX přes SimplifiedVFXSystem

### Fáze 2: Konsolidace systémů
- Sloučit VFX systémy do jednoho
- Sjednotit audio systémy
- Centralizovat UI management

### Fáze 3: Modularizace
- Rozdělit velké soubory (>1000 LOC)
- Vytvořit jasné rozhraní mezi vrstvami
- Implementovat event-driven komunikaci

## Definition of Done (Fáze 1)

- ✅ GameScene ≤ 1200 LOC
- ✅ Žádné přímé generování projektilů/loot/VFX v GameScene
- ✅ Kolize registrované na jednom místě (setupCollisions)
- ✅ Všechny spawn přes SimpleLootSystem
- ✅ Konzistentní depth management
- ✅ Testy projdou beze změny chování