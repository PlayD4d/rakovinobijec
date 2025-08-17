# 📝 Kódové standardy Rakovinobijec

## Přehled

Tento dokument definuje kódové standardy a konvence pro projekt Rakovinobijec. Dodržování těchto standardů zajišťuje konzistenci, čitelnost a udržovatelnost kódu.

---

## 📏 Limity velikosti

### Soubory
- **Maximum**: 500 LOC (lines of code)
- **Ideální**: 200-300 LOC
- **Výjimky**: Pouze s dokumentovaným důvodem v souboru

```javascript
/**
 * @filesize-exception Schváleno pro generovaný kód
 * Generated sprite data - DO NOT EDIT MANUALLY
 */
```

### Třídy
- **Maximum metod**: 10
- **Maximum properties**: 15
- **Constructor**: Max 50 LOC

### Funkce
- **Maximum parametrů**: 4
- **Maximum LOC**: 50
- **Cyklomatická složitost**: < 10

### Příklad refaktoru při překročení
```javascript
// ❌ ŠPATNĚ - příliš mnoho parametrů
function createEnemy(scene, x, y, type, health, damage, speed, size, color) {
    // ...
}

// ✅ SPRÁVNĚ - použití options objektu
function createEnemy(scene, blueprint, options = {}) {
    const { x = 0, y = 0 } = options;
    // ...
}
```

---

## 📛 Naming Conventions

### Soubory
```
PascalCase.js       - Třídy, komponenty
camelCase.js        - Utility moduly, pure functions
kebab-case.js       - Scripts, config files
SCREAMING_SNAKE.js  - Konstanty (rare)
```

### Proměnné a funkce
```javascript
// Konstanty
const MAX_ENEMIES = 100;
const DEFAULT_SPEED = 50;

// Proměnné
let enemyCount = 0;
let isPlayerAlive = true;

// Funkce
function calculateDamage(base, multiplier) { }
function isInRange(pos1, pos2, range) { }

// Private metody (konvence)
class Enemy {
    _updateInternals() { }  // Underscore prefix
    #privateField = 42;     // Private field (ES2022)
}
```

### Blueprint IDs
```
enemy.viral_swarm       // enemy.[name]
boss.radiation_core     // boss.[name]
powerup.damage_boost    // powerup.[name]
projectile.laser        // projectile.[name]
vfx.explosion.small     // vfx.[category].[variant]
sfx.weapon.laser        // sfx.[category].[sound]
```

---

## 🏗️ Struktura souborů

### Import pořadí
```javascript
// 1. Externí knihovny
import Phaser from 'phaser';

// 2. Core systémy
import { ConfigResolver } from '../core/ConfigResolver.js';
import { BlueprintLoader } from '../core/BlueprintLoader.js';

// 3. Utility funkce
import { calculateDistance, normalizeVector } from '../utils/math.js';

// 4. Lokální moduly
import { EnemyCore } from './core/EnemyCore.js';
import { EnemyBehaviors } from './EnemyBehaviors.js';

// 5. Styly/assets (pokud relevantní)
import './styles.css';
```

### Export patterns
```javascript
// Named exports pro utility funkce
export function calculateDamage(base, mult) { }
export function applyArmor(damage, armor) { }

// Default export pro hlavní třídu
export default class Enemy extends EnemyCore { }

// Re-exports pro barrel files
export { Enemy } from './Enemy.js';
export { Boss } from './Boss.js';
export * from './behaviors/index.js';
```

---

## 💬 Komentáře

### JSDoc pro třídy
```javascript
/**
 * Enemy - Základní nepřátelská entita
 * 
 * @extends EnemyCore
 * @implements {IDisposable}
 * 
 * @example
 * const enemy = new Enemy(scene, blueprint, { x: 100, y: 200 });
 * enemy.behaviors.setState('chase');
 */
export class Enemy extends EnemyCore {
```

### JSDoc pro funkce
```javascript
/**
 * Vypočítá poškození s aplikací modifikátorů
 * 
 * @param {number} baseDamage - Základní poškození
 * @param {Object} modifiers - Modifikátory
 * @param {number} modifiers.multiplier - Násobič poškození
 * @param {number} modifiers.flat - Flat bonus
 * @returns {number} Finální poškození
 * 
 * @example
 * const damage = calculateDamage(10, { multiplier: 1.5, flat: 5 });
 * // Returns: 20 (10 * 1.5 + 5)
 */
function calculateDamage(baseDamage, modifiers = {}) {
```

### Inline komentáře
```javascript
// Použijte pro vysvětlení PROČ, ne CO
const delay = 1000; // Delay kvůli animaci, jinak by se překrývala

// ❌ ŠPATNĚ - zřejmé z kódu
x = x + 1; // Přičti 1 k x

// ✅ SPRÁVNĚ - vysvětluje důvod
x = x + 1; // Kompenzace Phaser pixel-perfect renderingu
```

### TODO komentáře
```javascript
// TODO: Refaktorovat po implementaci nového ProjectileSystem
// FIXME: Memory leak při rychlém spawnu/despawnu
// HACK: Workaround pro Phaser 3.60 bug, odstranit v 3.61
// NOTE: Tento pattern je záměrný, nerefaktorovat
```

---

## 🎯 Best Practices

### Early returns
```javascript
// ❌ ŠPATNĚ - hluboké nesting
function process(enemy) {
    if (enemy) {
        if (enemy.active) {
            if (enemy.hp > 0) {
                // ... logika
            }
        }
    }
}

// ✅ SPRÁVNĚ - early returns
function process(enemy) {
    if (!enemy) return;
    if (!enemy.active) return;
    if (enemy.hp <= 0) return;
    
    // ... logika
}
```

### Destrukturování
```javascript
// ✅ Použití destrukturování
const { x, y, width, height } = sprite.getBounds();
const { damage = 10, speed = 100 } = options;

// S default hodnotami
function spawn({ x = 0, y = 0, type = 'basic' } = {}) {
    // ...
}
```

### Async/Await
```javascript
// ❌ ŠPATNĚ - callback hell
loadAsset('enemy.png', (texture) => {
    createSprite(texture, (sprite) => {
        addToScene(sprite, () => {
            console.log('Done');
        });
    });
});

// ✅ SPRÁVNĚ - async/await
async function loadAndCreate() {
    const texture = await loadAsset('enemy.png');
    const sprite = await createSprite(texture);
    await addToScene(sprite);
    console.log('Done');
}
```

### Immutability
```javascript
// ❌ ŠPATNĚ - mutace
function addEnemy(enemies, enemy) {
    enemies.push(enemy);  // Mutuje původní array
    return enemies;
}

// ✅ SPRÁVNĚ - immutable
function addEnemy(enemies, enemy) {
    return [...enemies, enemy];  // Nový array
}

// Pro objekty
const updated = { ...original, hp: 50 };  // Shallow copy
const deep = structuredClone(original);   // Deep copy
```

---

## 🚫 Zakázané praktiky

### Globální proměnné
```javascript
// ❌ NIKDY
window.gameState = { };
global.player = new Player();

// ✅ Použijte DI nebo singleton pattern
class GameState {
    static instance = null;
    static getInstance() {
        if (!this.instance) {
            this.instance = new GameState();
        }
        return this.instance;
    }
}
```

### Eval a Function constructor
```javascript
// ❌ NIKDY - security risk
eval('console.log("hello")');
new Function('console.log("hello")')();

// ✅ Použijte normální funkce
function logHello() {
    console.log("hello");
}
```

### Modifikace prototypu
```javascript
// ❌ NIKDY - může rozbít jiné knihovny
Array.prototype.myMethod = function() { };
String.prototype.capitalize = function() { };

// ✅ Použijte utility funkce
export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
```

---

## ✅ Code Review Checklist

Před merge review:

### Struktura
- [ ] Soubory < 500 LOC
- [ ] Třídy < 10 metod
- [ ] Funkce < 50 LOC
- [ ] Správné naming conventions

### Kvalita
- [ ] Žádné hardcoded hodnoty
- [ ] Žádné console.log v produkčním kódu
- [ ] JSDoc pro public API
- [ ] Žádné TODO/FIXME bez issue čísla

### Architektura
- [ ] Žádné cyklické závislosti
- [ ] Capability pattern dodržen
- [ ] Pure functions kde možné
- [ ] Guard rules passing

### Testy
- [ ] Unit testy pro nové funkce
- [ ] Integration test pro nové systémy
- [ ] Memory leak test pro Enemy/Boss
- [ ] Performance profiling pro kritické cesty

---

## 📊 Metriky a nástroje

### ESLint konfigurace
```json
{
    "rules": {
        "max-lines": ["error", 500],
        "max-lines-per-function": ["error", 50],
        "max-params": ["error", 4],
        "max-depth": ["error", 3],
        "complexity": ["error", 10],
        "no-eval": "error",
        "no-implied-eval": "error",
        "no-new-func": "error"
    }
}
```

### Užitečné nástroje
```bash
# Complexity analysis
npx complexity-report-html js

# Find duplicates
npx jscpd js --min-lines 5

# Dependency analysis
npx madge js --circular --image deps.svg

# Size analysis
npx size-limit

# Performance
npx lighthouse http://localhost:8080
```

---

## 🔄 Verzování

### Semantic Versioning
```
MAJOR.MINOR.PATCH
1.2.3

MAJOR - Breaking changes
MINOR - New features, backwards compatible
PATCH - Bug fixes
```

### Commit messages
```
feat: přidání nového enemy typu
fix: oprava memory leaku v EnemyCore
refactor: rozdělení Enemy.js na komponenty
docs: aktualizace CODE_STANDARDS.md
test: unit testy pro behaviors
perf: optimalizace spawn rutiny
```

---

*Dokument vytvořen pro Rakovinobijec v0.4.0 | Poslední aktualizace: 2024*