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

### Commit 1: [TODO]
### Commit 2: [TODO]
### Commit 3: [TODO]
### Commit 4: [TODO]
### Commit 5: [TODO]
### Commit 6: [TODO]
### Commit 7: [TODO]
### Commit 8: [TODO]

## Výsledky
- **Finální LOC:** [TODO]
- **Redukce:** [TODO] LOC (-XX%)
- **Testy:** [TODO]