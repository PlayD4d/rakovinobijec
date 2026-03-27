
# Dev Guidelines – PR7 Compliance

## Principles
- 100% Data-Driven: All gameplay constants, entities, and systems read from blueprint data.
- Single Source of Truth: ConfigResolver is the only way to resolve gameplay values.
- No Legacy Code: No EnemyManager, no hardcoded constants, no feature flags.
- Modern Systems Only: Always use current framework modules (BlueprintLoader, SpawnDirector, ProjectileSystemV2, ModifierEngine, VFX/SFX Registry).
- No Direct Engine Calls in Gameplay Logic: No direct scene.add.particles or scene.sound.play – always go through registry.

## Core Systems
- **BlueprintLoader**: Loads all data from `/data/blueprints/` (JSON5).
- **SpawnDirector**: Controls enemy waves, bosses, elites – driven by spawn tables.
- **ProjectileSystemV2**: Handles player & enemy projectiles, with pooling.
- **ModifierEngine**: Applies buffs, debuffs, and stat changes.
- **ConfigResolver**: Fetches constants with fallback rules.
- **VFX/SFX Registry**: Handles visual/audio effects.
- **GraphicsFactory**: Centralized graphics object creation with pooling.

## Architectural Patterns

### Capability-based Design
Používáme pro oddělení Phaser API od business logiky:
- **Core třída** poskytuje capability interface (viz `EnemyCore.js`)
- **Behaviors** jsou pure functions bez side-effects
- **Žádné přímé volání** Phaser API v behaviors
- **Komunikace** pouze přes capability methods

Příklad capability interface:
```javascript
// EnemyCore poskytuje capabilities
class EnemyCore {
    getPos() { return { x: this.x, y: this.y }; }
    setVelocity(vx, vy) { this.body.setVelocity(vx, vy); }
    shoot(pattern, opts) { /* delegate to ProjectileSystem */ }
}

// Behavior je pure function
export function chase(cap, cfg, dt) {
    const pos = cap.getPos();  // Použití capability
    cap.setVelocity(vx, vy);   // Žádné přímé Phaser API
    return nextState;           // Vrací další stav
}
```

### Thin Composer Pattern
Hlavní třída je pouze tenký orchestrátor:
- **Minimální vlastní logika** - pouze compose komponenty
- **Deleguje na specializované moduly** - každý má jednu zodpovědnost
- **Čistý public interface** - skrývá interní složitost

Příklad:
```javascript
// Enemy.js - thin composer
class Enemy extends EnemyCore {
    constructor(scene, blueprint, opts) {
        super(scene, blueprint, opts);           // Core funkcionalita
        this.behaviors = new EnemyBehaviors(this); // AI behaviors
    }
    
    update(time, delta) {
        this.behaviors.update(time, delta);      // Delegace
    }
}
```

### DisposableRegistry Pattern
Pro správu životního cyklu zdrojů:
- **Automatický cleanup** timerů a event listenerů
- **Prevence memory leaks**
- **Centralizovaná správa** disposable zdrojů

## Anti-patterns to Avoid

### ❌ Monolitické soubory
- Soubory větší než **500 LOC** jsou red flag
- Rozdělte na logické komponenty
- Použijte Thin Composer pattern

### ❌ Cyklické závislosti
- A importuje B, B importuje A = problém
- Použijte capability interface místo přímých importů
- Dependency injection přes constructor

### ❌ Phaser API v business logice
- Behaviors nesmí volat `scene.add.*`, `this.scene.*`
- Veškerá Phaser interakce pouze v Core třídách
- Business logika musí být framework-agnostic

### ❌ Mutable globální state
- Žádné globální proměnné
- State pouze v příslušných třídách
- Komunikace přes events nebo DI

### ❌ Těsně provázané systémy
- Systémy komunikují pouze přes definované interface
- Žádné přímé reference mezi nesouvisejícími moduly
- Loose coupling, high cohesion

## Prohibited
- Hardcoded gameplay constants in code.
- Legacy imports from `/js/data/enemies/`, `/js/data/bosses/`, `/js/data/player/`, `/js/data/powerups/`.
- Any feature flag branches for old systems.
- Direct Phaser API calls for VFX/SFX from gameplay logic.
- Direct `scene.add.graphics()` calls – use GraphicsFactory instead.
- Files larger than 500 LOC without approved exception.
- Circular dependencies between modules.
- Phaser API calls in pure functions/behaviors.

## Content Creation

### Adding / Modifying NPCs (Enemies & Bosses)
1. **Create or update a blueprint** in `/data/blueprints/enemy/` or `/data/blueprints/boss/`.
2. **Blueprint fields**:
   - `id`: Unique identifier, e.g. `"enemy.necrotic_cell"`
   - `stats`: Health, speed, damage, attack rate, XP reward, etc.
   - `graphics`: Sprite key, animation data, scale, tint.
   - `ai`: Behavior type (`chase`, `shoot`, `patrol`) and params.
   - `lootTable`: Reference to a loot table ID.
3. **Spawn logic**:
   - Add the enemy to a spawn table in `/data/blueprints/spawn/`.
   - Example entry: `{ type: "enemy.necrotic_cell", count: 5, delay: 1.5 }`.
4. **Testing**:
   - Use `DEV.spawnEnemy("enemy.necrotic_cell")` in console to spawn instantly.

### Adding / Modifying VFX
1. **Register** your effect in `VFXRegistry`:
   - Assign a unique key, e.g. `"explosion_small"`.
   - Point to a particle config or animation blueprint.
2. **Reference in blueprint**:
   - Add `onDeathVFX: "explosion_small"` or similar in NPC or projectile blueprint.
3. **Test**:
   - Spawn NPC and trigger event that calls the VFX.

### Adding / Modifying SFX
1. **Direct file path approach** (RECOMMENDED):
   - Use direct file paths in blueprints, e.g. `"sound/laser.mp3"`
   - Supports pooling and volume management automatically
   - No registry maintenance required
2. **Blueprint link**:
   - Add `onShootSFX`, `onHitSFX`, or `onDeathSFX` field to blueprint
   - Example: `"hit": "sound/npc_hit.mp3"`
3. **Test**:
   - Trigger the event in-game and check console for missing file warnings.

### Best Practices for Content
- Keep stats balanced – test on multiple difficulty levels.
- Always use unique IDs to avoid collisions.
- Use consistent naming for blueprint IDs (`enemy.`, `boss.`, `drop.`, `projectile.`).
- Test VFX/SFX in isolation before adding to blueprints.
- Avoid massive particle counts – keep FPS in mind.



## 📦 Příklady práce s herním obsahem (NPC, VFX, SFX)

### 1. Přidání nového NPC (nepřítel)
1. **Vytvoř blueprint** v `/data/blueprints/enemies/` – obsahuje `stats`, `mechanics`, `aiPattern`.
2. **Zaregistruj** blueprint do `/data/registries/enemies.json5`.
3. **Otestuj spawn** přes `SpawnDirector` – `DEV.spawnEnemy("enemy.id")`.
4. **Nikdy** nevolat přímo `scene.add.sprite` – vždy použít `EnemyFactory`.

### 2. Přidání nového VFX efektu
1. Přidej definici efektu do `/data/registries/vfx.json5` – např. `{"id": "explosion_small", "texture": "vfx_explosion_small", "duration": 300}`.
2. Asset ulož do `/assets/vfx/`.
3. V gameplay kódu používej `VFXSystem.play("explosion_small", x, y)`.

### 3. Přidání nového SFX zvuku
1. Přidej definici do `/data/registries/sfx.json5` – např. `{"id": "laser_shot", "file": "laser_shot.ogg", "volume": 0.8}`.
2. Asset ulož do `/assets/sfx/`.
3. V gameplay kódu používej `SFXSystem.play("laser_shot")`.

### 4. Modifikace existujícího obsahu
- **NPC** – úpravy jen v blueprintu, změny se projeví bez zásahu do kódu.
- **VFX/SFX** – úpravy v registru změní parametry pro všechny výskyty ve hře.

⚠️ **PR7 pravidlo** – žádné přímé volání Phaser API (`scene.sound.play`, `scene.add.sprite`, `scene.add.particles`) z gameplay kódu. Vždy použij registry a systémové managery.


---
## Praktické příklady: jak přidat/změnit herní obsah (NPC, VFX, SFX) v duchu PR7

> Vše je **data‑driven**. Gameplay kód **nikdy** nevolá přímo Phaser API (žádné `scene.add.*`, `scene.sound.*`). Využívejte naše managery a Blueprint/Registry systém.

### 1) Přidání nebo úprava NPC (enemy/unique/miniboss)

**Krok 1 – Blueprint**
Vytvořte nový JSON5 blueprint v `data/blueprints/enemy/enemy.my_new_enemy.json5`:
```json5
{
  id: "enemy.my_new_enemy",
  type: "enemy",
  meta: { rarity: "common", displayName: "My New Enemy" },
  visuals: {
    textureKey: "enemy.my_new_enemy",   // volitelné; když chybí, GameScene použije placeholder
    tint: 0x4CAF50, size: { w: 18, h: 18 }
  },
  stats: {
    maxHp: 40, contactDamage: 10,
    moveSpeed: 65, accel: 140
  },
  ai: { behavior: "homing_simple", idleWander: false },
  loot: { lootTableId: "lootTable.level1.common", xp: 6 },
  vfx: { spawn: "vfx.enemy.spawn.default", hit: "vfx.hit.spark.generic", death: "vfx.enemy.death.small" },
  sfx: { spawn: "sfx.enemy.spawn", hit: "sfx.enemy.hit.soft", death: "sfx.enemy.death.small" }
}
```

**Krok 2 – Registrace v registru**
Přidejte položku do `data/registries/index.json` (sekce `enemy`):
```json5
{ id: "enemy.my_new_enemy", path: "blueprints/enemy/enemy.my_new_enemy.json5" }
```

**Krok 3 – SpawnTable**
Otevřete příslušný spawn stůl (např. `data/blueprints/spawn/level1.json5`) a doplňte váhu výskytu:
```json5
waves: [
  { time: 2, entries: [
    { id: "enemy.my_new_enemy", count: { min: 1, max: 2 }, weight: 0.35 }
  ]}
]
```

**Krok 4 – Ověření**
- `npm run audit:data:strict` (schéma + registry).
- Spusťte hru a v konzoli: `__framework.healthcheck()` → `blueprints > 0`, `spawnedFromSpawnTables > 0`.
- Dočasná textura: pokud chybí `visuals.textureKey`, GameScene použije placeholder (zelený čtverec s bílým středem). Vlastní sprite můžete přidat do asset pipeline později.

### 2) Přidání / úprava VFX

**Krok 1 – Registrace v `VFXRegistry`**
V `data/registries/index.json` přidejte novou položku do sekce `vfx` (pokud vaše repo udržuje VFX i v datech), nebo
vytvořte registr v kódu `VFXRegistry.register("vfx.enemy.death.small", { preset: "burst_small", ... })`.

**Krok 2 – Použití v blueprintu**
V blueprintu nepřítele/události odkažte na ID:
```json5
vfx: { spawn: "vfx.enemy.spawn.default", hit: "vfx.hit.spark.generic", death: "vfx.enemy.death.small" }
```
> Engine při `spawn/hit/death` zavolá `vfxSystem.play(id, position, opts)`. Pokud ID neexistuje, nic se nestane (tichý no‑op).

**Krok 3 – Test**
- `__framework.quickCheck()` zobrazí počítadla volání VFX/SFX.
- V logu nesmí být `Effect '...' not found`; pokud ano, buď opravte ID, nebo dočasně použijte existující efekt (`vfx.enemy.death.default`).

### 3) Přidání / úprava SFX

**NOVÝ PŘÍSTUP: Direct File Paths (DOPORUČENO)**
- Použijte přímé cesty k souborům místo složitých registry systémů
- Jednoduché, jasné a snadno udržovatelné

**Příklad direct path v blueprintu:**
```json5
sfx: { 
  spawn: "sound/npc_spawn.mp3", 
  hit: "sound/npc_hit.mp3", 
  death: "sound/npc_death.mp3" 
}
```

**Výhody direct paths:**
- Žádná registrace potřeba - jednoduše odkazujte na soubor
- Méně abstrakcí = méně chyb
- Konsistence s loot systémem
- Automatický pooling a volume management

**Krok 3 – Hlasitosti a kanály**
- Vše přes `ConfigResolver` (např. `audio.sfx.volume.master`, `audio.channels.effects`). Žádné hard‑coded hodnoty.

### 4) Loot (minimální funkční cesta)

Než bude lootTable validní, použijte fallback **XP orby** (již implementováno). Jakmile opravíte loot blueprints podle
schématu, stačí v blueprintu nepřítele nastavit `loot.lootTableId` a loot systém se aktivuje automaticky.

**Checklist loot blueprints:**
- Každý `drop.*` má `stats.weight` v intervalu `<0,1>` a `mechanics.effectType`.
- `lootTable.*` má `stats` objekt a používá pouze podporované modifikátory.
- CI `audit:data:strict` nesmí hlásit chyby.

### 5) Graphics Factory - PR7 Compliant Graphics Creation

**Používání GraphicsFactory pro vytváření grafických objektů:**
```javascript
// ŠPATNĚ - přímé volání Phaser API
this.graphics = this.scene.add.graphics();

// SPRÁVNĚ - použití GraphicsFactory
this.graphics = this.scene.graphicsFactory.create();

// Cleanup - vrácení do poolu
this.scene.graphicsFactory.release(this.graphics);
```

**Konfigurace vizuálních parametrů v blueprintu:**
```json5
// Všechny vizuální konstanty musí být v blueprintu
"ability": {
  "innerRadius": 30,
  "innerWidthRatio": 0.4,
  "outerWidthRatio": 0.8,
  "beamColor": 0xCCFF00,
  "strokeWidth": 2
}
```

### 6) VFX System - Správné použití

**Vytváření efektů přes VFXSystem:**
```javascript
// ŠPATNĚ - přímé volání particles
this.scene.add.particles(...);

// SPRÁVNĚ - použití VFXSystem
this.scene.newVFXSystem.play('vfx.explosion.small', x, y);
```

**Registrace vlastních VFX efektů:**
```javascript
// V inicializaci nebo přes VFXRegistry
vfxRegistry.register('vfx.custom.effect', {
  type: 'particles',
  texture: 'spark',
  config: {
    scale: { start: 0.5, end: 0 },
    speed: { min: 100, max: 200 }
  }
});
```

### 7) Rychlé DI testy v runtime

- `window.__framework.healthcheck()` → potvrďte `modernSystemsActive: true`, `spawnedFromLegacy: 0`,
  `spawnedFromSpawnTables > 0`.
- `window.__framework.smokeTest()` → základní simulace včetně detekce legacy volání.

## DO / DON'T Tabulky

### Spawn a Loot
| ✅ DO | ❌ DON'T |
|-------|----------|
| `SimpleLootSystem.createDrop(type, x, y)` | `this.add.sprite(x, y, 'loot')` |
| `enemyManager.spawnEnemy(blueprintId)` | `new Enemy(scene, x, y)` přímo |
| `projectileSystem.createProjectile(cfg)` | `this.physics.add.sprite()` |

### Physics a Collisions
| ✅ DO | ❌ DON'T |
|-------|----------|
| Collisions pouze v `setupCollisions()` | `this.physics.add.overlap()` kdekoli jinde |
| `disposableRegistry.trackListener()` | Event listener bez cleanup |
| `graphicsFactory.create()` | `this.add.graphics()` přímo |

### VFX a SFX
| ✅ DO | ❌ DON'T |
|-------|----------|
| `vfxSystem.play('vfx.explosion', x, y)` | `this.add.particles()` přímo |
| `audioSystem.play('sfx.hit')` | `this.sound.play()` přímo |
| Registry ID nebo direct path | Hardcoded cesty v kódu |

### UI a Input
| ✅ DO | ❌ DON'T |
|-------|----------|
| UI pouze v GameUIScene | UI elementy v GameScene |
| Event-based komunikace | Přímé reference mezi scénami |
| `setTopOnly(true)` pro modaly | Modal bez input isolation |

### Data a Konfigurace
| ✅ DO | ❌ DON'T |
|-------|----------|
| `ConfigResolver.get('enemy.spawn.delay')` | `const DELAY = 1000` |
| Vše v blueprintech | Hardcoded hodnoty |
| `DEPTH_LAYERS.ENEMIES` | Magic number `1000` |

## Mini FAQ

### Q: Overlay je pod projektily?
**A:** Použij správný depth layer:
```javascript
overlay.setDepth(this.DEPTH_LAYERS.UI_OVERLAY); // 5000+
```

### Q: UI input prochází do hry?
**A:** Nastav input isolation:
```javascript
this.input.setTopOnly(true);
overlay.setInteractive({ useHandCursor: false });
```

### Q: Chybí VFX/SFX efekt?
**A:** Zkontroluj registry ID:
```javascript
// Check if registered
console.log(vfxRegistry.has('vfx.explosion'));
// Use placeholder if missing
vfxRegistry.register('vfx.explosion', { preset: 'default' });
```

### Q: Enemy se nespawnuje?
**A:** Ověř blueprint a spawn table:
```javascript
// Test direct spawn
DEV.spawnEnemy("enemy.viral_swarm");
// Check if in spawn table
console.log(spawnDirector.currentTable);
```

### Q: Memory leak po restartu?
**A:** Check disposables:
```javascript
disposableRegistry.getStats(); // Should be empty
enemyManager.getActiveCount(); // Should be 0
```

### 8) Guard Rules Check

Pro ověření architektonických pravidel používejte guard scripty:

**Check Enemy behaviors:**
```bash
./dev/refactor/check_enemy_guards.sh
```

Ověřuje:
- ✅ Žádné Phaser API v behaviors
- ✅ Žádné přímé scene manipulace
- ✅ Žádné cyklické závislosti
- ✅ Pure functions only
- ✅ Všechny capability methods implementovány

**Manuální kontrola:**
```bash
# Phaser API v behaviors
grep -r "Phaser\." js/entities/ai/behaviors/

# Scene manipulace
grep -r "scene\.\(add\|physics\|sound\)" js/entities/ai/behaviors/

# Cyklické závislosti
grep -r "import.*Enemy" js/entities/ai/behaviors/
```

---
**Nejčastější chyby & řešení**
- *NPC neviditelné:* chybí `setVisible(true)/setActive(true)` nebo `textureKey`. Dočasně nechte placeholder texturu.
- *VFX/SFX warningy:* špatné ID v blueprintu → použijte existující ID nebo přidejte alias do registru.
- *Loot nepadá:* lootTable neprojde validací → dočasně se použije XP fallback. Opravte schéma `drop.*` a `lootTable.*`.
- *Spawn mimo scénu:* zkontrolujte clamping ve `SpawnDirector.getSpawnPosition()` a rozměry kamery (`scene.cameras.main`).
- *Graphics objekty:* Nikdy nepoužívejte `scene.add.graphics()` přímo. Vždy použijte `scene.graphicsFactory.create()`.
- *Hardcoded vizuální konstanty:* Všechny vizuální parametry (barvy, velikosti, poměry) musí být v blueprintech.
