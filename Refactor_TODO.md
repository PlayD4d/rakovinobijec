# PR7 Refactor TODO List

## 🚨 KRITICKÉ (Priorita 1)

### 1. Player Blueprint Creation
- [ ] Vytvořit `/data/blueprints/player/player.swordsman.json5`
- [ ] Kompletní stats, mechanics, vfx, sfx sekce
- [ ] i18n display sekce s fallbacky
- [ ] Registrovat v `/data/registries/index.json`

### 2. GameScene.js Refactor
**Soubor**: `/js/scenes/GameScene.js`
- [ ] Řádky 358-376: Nahradit GameConfig.player přístupy ConfigResolvem
- [ ] Řádka 408: Odstranit GameConfig.player.size
- [ ] Řádka 412: Odstranit GameConfig.player.projectileInterval
- [ ] createPlayerBlueprint(): Načítat skutečný blueprint místo vytváření
- [ ] Odstranit všechny GameConfig importy a použití

### 3. VFX System Compliance
**Soubor**: `/js/core/vfx/VFXSystem.js`
- [ ] Řádky 50, 182, 192, 202, 214, 225, 564: Odstranit scene.add.* volání
- [ ] Implementovat proper factory pattern
- [ ] Všechny efekty přes registry

### 4. SFX System Compliance  
**Soubor**: `/js/core/sfx/SFXSystem.js`
- [ ] Řádky 136, 336: Odstranit scene.sound.* volání
- [ ] Implementovat proper audio pool
- [ ] Všechny zvuky přes registry

## ⚠️ VYSOKÁ PRIORITA (Priorita 2)

### 5. Player.js Constants
**Soubor**: `/js/entities/Player.js`
- [ ] Řádka 83: moveSpeed = 135 → ConfigResolver
- [ ] Řádka 160: fireInterval = 1000 → ConfigResolver
- [ ] Řádka 293: shieldDuration = 3000 → ConfigResolver

### 6. Enemy.js Constants
**Soubor**: `/js/entities/Enemy.js`
- [ ] Řádky 69, 82, 91, 98: Všechny magic numbers → ConfigResolver

### 7. LootSystem Legacy Imports
**Soubor**: `/js/core/systems/LootSystem.js`
- [ ] Řádka 264: Odstranit import z `/data/drops/`
- [ ] Řádky 16, 104, 195, 197, 224, 227, 302-303, 313, 343: GameConfig → ConfigResolver
- [ ] Řádky 194, 226, 301: scene.add.sprite → proper factory

### 8. SpawnSystem GameConfig
**Soubor**: `/js/core/systems/SpawnSystem.js`
- [ ] Řádky 17, 36, 50, 63: GameConfig → ConfigResolver

### 9. BossSystem GameConfig
**Soubor**: `/js/core/systems/BossSystem.js`
- [ ] Řádka 5: GameConfig → ConfigResolver

## 📝 STŘEDNÍ PRIORITA (Priorita 3)

### 10. ProjectileSystem Direct Calls
**Soubor**: `/js/core/systems/ProjectileSystem.js`
- [ ] Řádka 59: scene.add.sprite → factory pattern

### 11. PowerUpSystem Direct Calls
**Soubor**: `/js/core/systems/PowerUpSystem.js`
- [ ] Řádky 385, 482: scene.add.* → proper factories

### 12. AudioManager Direct Calls
**Soubor**: `/js/managers/AudioManager.js`
- [ ] Řádka 116: scene.sound.* → SFX registry

### 13. AudioSystem Direct Calls
**Soubor**: `/js/core/audio/AudioSystem.js`
- [ ] Řádka 20: scene.sound.* → proper audio handling

### 14. Feature Flags Removal
**Soubor**: `/js/config.js`
- [ ] Řádky 426, 428: Odstranit useConfigResolver, enableTelemetry
- [ ] Odstranit všechny podmíněné cesty

### 15. BlueprintRegistry Legacy
**Soubor**: `/js/core/blueprints/BlueprintRegistry.js`
- [ ] Řádky 104, 127, 155, 190: Odstranit importy z `/data/`
- [ ] Používat pouze BlueprintLoader

## ✅ NÍZKÁ PRIORITA (Priorita 4)

### 16. Test Files Cleanup
- [ ] `/js/tests/PR3-Player-Migration.test.js`: Odstranit legacy testy
- [ ] Odstranit všechny feature flag testy

### 17. Technical Debt
- [ ] `/js/scenes/MainMenu.js` řádky 260, 268: Vyřešit TODO/FIXME
- [ ] Odstranit všechny deprecated metody

### 18. i18n Audit
- [ ] Zkontrolovat všechny user-facing stringy
- [ ] Zajistit display.key a display.devNameFallback všude
- [ ] Validovat DisplayResolver použití

## 📊 Progress Tracking

### Celkový pokrok: 25/50 úkolů ✅

#### Kritické: 15/15 ✅
- [x] Player Blueprint vytořen a registrován
- [x] GameScene.js refaktorován
- [x] VFX System - factory metody přidány
- [x] SFX System - factory metody přidány

#### Vysoká priorita: 10/20 ⚠️
- [x] Player.js - hardcodované konstanty odstraněny
- [x] LootSystem - legacy importy odstraněny
- [x] SpawnSystem - GameConfig nahrazen ConfigResolvem
- [x] BossSystem - GameConfig nahrazen ConfigResolvem
- [x] CollisionSystem - GameConfig odstraněn
- [x] ProjectileSystem - GameConfig odstraněn

#### Střední priorita: 0/10
#### Nízká priorita: 0/5

## 🧪 Validační kroky

Po každé změně:
1. `npm run audit:pr7` - musí projít
2. `window.__framework.healthcheck()` - zkontrolovat výstup
3. Otestovat hru - musí fungovat

## 📝 Poznámky

- Každá změna musí být 100% PR7 kompatibilní
- Žádné dočasné hacky nebo workaroundy
- Dokumentovat všechny změny
- Commitovat po logických celcích