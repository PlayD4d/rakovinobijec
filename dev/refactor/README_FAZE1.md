# Fáze 1: GameScene jako tenký hub

## Výchozí stav
- **GameScene.js LOC:** 3303
- **Datum zahájení:** 2025-08-17
- **Cíl:** ≤ 1200 LOC

## Definition of Done
- [ ] GameScene.js ≤ 1200 LOC
- [ ] Žádné přímé generování projektilů/loot/VFX v GameScene
- [ ] Kolize registrované na jednom místě (setupCollisions)
- [ ] Všechny spawny přes SimpleLootSystem
- [ ] Konzistentní depth management (DEPTH_LAYERS)
- [ ] UI modaly jen přes GameUIScene
- [ ] Grep guardy čisté

## Kroky refaktorizace

### 0. Příprava ✅
- Vytvořen tento dokument
- Přidány grep guardy

### 1. Extrakce kolizí
- [ ] Vytvořit js/handlers/setupCollisions.js
- [ ] Přesunout všechny physics.add.overlap/collide
- [ ] Pojmenované callbacky

### 2. UI supremacy
- [ ] GameUIScene.bringToTop() při modalu
- [ ] input.setTopOnly(true)
- [ ] Overlay setInteractive() s capture
- [ ] Správná pauza (time.pause vs scene.pause)

### 3. Spawny → SimpleLootSystem
Mapování:
- `spawnHealthPickup(x,y)` → `simpleLootSystem.createDrop(x, y, 'item.health_small')`
- `spawnMetotrexatPickup(x,y)` → `simpleLootSystem.createDrop(x, y, 'item.metotrexat')`
- `dropSimpleXP(x,y,amt)` → `simpleLootSystem.createDrop(x, y, 'item.xp_orb', { amount: amt })`

### 4. Odstranit generování textur
- [ ] Smazat všech 12 generateTexture() volání
- [ ] Smazat add.circle(), add.rectangle()

### 5. Centralizace depth
```javascript
DEPTH_LAYERS = {
  WORLD: 1000,
  LOOT: 2000,
  PROJECTILES: 3000,
  HUD: 9000,
  UI_MODAL: 10000
}
```

### 6. Přesun tweens
- [ ] Loot tweens → SimpleLootSystem
- [ ] VFX tweens → VFXSystem
- [ ] UI tweens zůstávají v UI scéně

### 7. Zákaz Phaser API
- [ ] this.add.*
- [ ] this.physics.add.*
- [ ] this.tweens.add
- [ ] this.cameras.*
- [ ] this.time.delayedCall

### 8. Validace
- [ ] LOC ≤ 1200
- [ ] Smoke testy projdou
- [ ] Grep guardy čisté

## Grep guardy

```bash
# Spustit všechny najednou:
./dev/refactor/check_guards.sh
```

## Smoke testy
1. **Level-up 3×** - modal funguje, input neprosakuje
2. **Pause** - overlay pokryje vše
3. **XP magnet** - orby se přisávají
4. **Boss útoky** - projektily přes systém, UI nahoře

## Změny

### Commit 0: Příprava
- Vytvořen tento dokument
- Přidán guard skript

### Commit 1: Extrakce kolizí
- setupCollisions.js vytvořen
- LOC: 3302 → 3121 (-181 řádků)

### Commit 2: UI supremacy
- bringToTop() a setTopOnly() v GameUIScene
- LOC: 3121 (beze změny)

### Commit 3: Spawny přes SimpleLootSystem
- Odstraněny spawn metody
- LOC: 3121 → 2839 (-282 řádků)

### Commit 4: Odstranění texture generation
- Texture generation přesunuto do SimpleLootSystem
- Odstraněny 4 metody: generatePlayerTexture, generateEnemyTexture, generateEnemyPlaceholderTextures, generateItemTextures
- LOC: 2839 → 2514 (-325 řádků)

### Commit 5: Centralizace depth layers
- Přidány LOOT, BOSSES, EFFECTS do DEPTH_LAYERS
- Nahrazeny všechny numerické setDepth() konstantami
- LOC: 2514 → 2517 (+3 řádky pro lepší strukturu)

### Commit 6: Step 6 - Přesun tweens do systémů
- Přidány animatePickup() a animateAttraction() do SimpleLootSystem
- Odstraněn nefunkční metotrexat spawn kód (34 řádků)
- LOC: 2517 → 2467 (-50)

### Commit 7: Step 8A - UpdateManager
- Vytvořen UpdateManager pro centralizovanou orchestraci update()
- Update metoda zkrácena z ~110 řádků na 7 řádků
- Registrace tasků přesunuta do UpdateManager
- LOC: 2467 → 2376 (-91)

### Commit 8: Step 8C - TransitionManager
- Vytvořen TransitionManager pro game flow control
- Přesunuty metody: gameOver, transitionToNextLevel, showVictory, clearAllEnemies
- Odstraněny UI metody: showLevelTransition, hideLevelTransition
- Re-entrancy guards pro všechny přechody
- Event-based komunikace s UI scénou
- LOC: 2376 → 2121 (-255)

### Commit 9: Step 8E - BootstrapManager
- Vytvořen BootstrapManager pro inicializaci
- create() zkráceno z 229 na 14 řádků
- Odstraněny duplicitní metody (addXP)
- Odstraněna deprecated metoda handlePlayerLootCollision_OLD (82 řádků)
- Systematická inicializace ve fázích
- LOC: 2121 → 1791 (-330)

### Commit 10: Step 8D + SystemsInitializer
- Vytvořen SystemsInitializer pro inicializaci systémů
- initializeDataDrivenSystems() zkráceno ze 186 na 14 řádků
- Odstraněny debug metody (handleDebugEnemySpawn, handleDebugBossSpawn, handleDebugSFXSoundboard, handleDebugVFXTest)
- Odstraněna setupKeyboardEvents() metoda (22 řádků)
- LOC: 1791 → 1545 (-246)

### Commit 11: Finální optimalizace - DisposableRegistry, EnemyManager, PlayerFactory
- Vytvořen DisposableRegistry pro unified resource cleanup
- shutdown() zkráceno ze 152 na 35 řádků
- Vytvořen EnemyManager - createEnemyFromBlueprint delegováno (118 → 11 řádků)
- Vytvořen PlayerFactory - createPlayerBlueprint delegováno (88 → 7 řádků)
- Odstraněna getColorFromBlueprint metoda (28 řádků)
- showCriticalError delegováno na UI scénu (35 → 10 řádků)
- LOC: 1545 → 1116 (-429)

## Výsledky
- **Finální LOC:** 1116
- **Redukce:** 2187 LOC (-66.2%)
- **Cíl splněn:** ✅ (1116 < 1200)
- **Guardy:** ✅ Všechny prošly
- **Testy:** Čeká na smoke test