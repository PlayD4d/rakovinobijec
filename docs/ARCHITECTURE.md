# 🏛️ Architektura Rakovinobijec

## Přehled

Rakovinobijec používá moderní architektonické vzory pro zajištění škálovatelnosti, údržby a testovatelnosti kódu. Tento dokument popisuje klíčové architektonické principy a vzory používané v projektu.

---

## 📐 Architektonické principy

### 1. Separation of Concerns (SoC)
Každý modul má jednu jasně definovanou zodpovědnost:
- **EnemyCore** - Phaser integrace a fyzika
- **EnemyBehaviors** - AI state machine
- **behaviors/*.js** - jednotlivé AI strategie
- **ProjectileSystem** - správa projektilů
- **VFXSystem** - vizuální efekty

### 2. Dependency Injection (DI)
Závislosti jsou předávány přes konstruktor, ne globálně:
```javascript
class Enemy {
    constructor(scene, blueprint, opts) {
        // scene obsahuje všechny systémy
        this.projectileSystem = scene.projectileSystem;
        this.vfxSystem = scene.vfxSystem;
    }
}
```

### 3. Data-Driven Design
Veškeré herní hodnoty jsou v blueprintech:
- Žádné hardcoded konstanty v kódu
- Blueprints jako Single Source of Truth
- ConfigResolver pro runtime hodnoty

### 4. Framework Abstraction
Business logika je oddělena od Phaser API:
- Core třídy zapouzdřují Phaser
- Behaviors jsou framework-agnostic
- Capability interface pro komunikaci

---

## 🎯 Capability-based Design Pattern

### Problém
Tradiční OOP přístup vede k:
- Těsně provázaným systémům
- Cyklickým závislostem
- Obtížné testování
- Monolitickým třídám

### Řešení
Capability-based design odděluje concerns:

```javascript
// 1. CAPABILITY PROVIDER (Core)
class EnemyCore extends Phaser.Physics.Arcade.Sprite {
    // Poskytuje capabilities
    getPos() { return { x: this.x, y: this.y }; }
    setVelocity(vx, vy) { this.body.setVelocity(vx, vy); }
    shoot(pattern, opts) { this.projectileSystem.create(...); }
    
    // Žádná business logika!
}

// 2. CAPABILITY CONSUMER (Behavior)
export function chase(cap, cfg, dt) {
    // Používá pouze capabilities
    const pos = cap.getPos();
    const target = findTarget(pos);
    
    if (target) {
        const velocity = calculateVelocity(pos, target);
        cap.setVelocity(velocity.x, velocity.y);
    }
    
    return nextState;
}

// 3. ORCHESTRATOR (Router)
class EnemyBehaviors {
    constructor(enemy) {
        this.capability = this.createCapability(enemy);
    }
    
    createCapability(enemy) {
        return {
            getPos: () => enemy.getPos(),
            setVelocity: (vx, vy) => enemy.setVelocity(vx, vy),
            shoot: (p, o) => enemy.shoot(p, o)
        };
    }
    
    update(time, delta) {
        const behavior = BEHAVIORS[this.state];
        const nextState = behavior(this.capability, this.config, delta);
        if (nextState) this.transitionTo(nextState);
    }
}
```

### Výhody
✅ **Žádné cyklické závislosti** - behaviors neimportují Enemy
✅ **Testovatelnost** - behaviors lze testovat s mock capabilities
✅ **Rozšiřitelnost** - nové behaviors bez změny core
✅ **Čistý kód** - jasné rozdělení zodpovědností

---

## 🎭 Thin Composer Pattern

### Problém
Hlavní třídy se stávají "blob" objekty:
- Stovky řádků kódu
- Mixing různých concerns
- Obtížná navigace a údržba

### Řešení
Thin Composer deleguje na specializované komponenty:

```javascript
// PŘED - Monolitická třída (900+ LOC)
class Enemy {
    constructor() { /* 100 řádků inicializace */ }
    update() { /* 50 řádků AI logiky */ }
    takeDamage() { /* 30 řádků damage pipeline */ }
    shootProjectile() { /* 40 řádků projektil logiky */ }
    handleCollision() { /* 25 řádků */ }
    playAnimation() { /* 20 řádků */ }
    updateHealthBar() { /* 15 řádků */ }
    // ... dalších 20 metod
}

// PO - Thin Composer (< 100 LOC)
class Enemy extends EnemyCore {
    constructor(scene, blueprint, opts) {
        super(scene, blueprint, opts);           // Core funkcionalita
        this.behaviors = new EnemyBehaviors(this); // AI behaviors
        this.combat = new EnemyCombat(this);       // Combat pipeline
        this.visuals = new EnemyVisuals(this);     // Animations, health bar
    }
    
    update(time, delta) {
        this.behaviors.update(time, delta);
        this.combat.update(time, delta);
        this.visuals.update(time, delta);
    }
    
    takeDamage(amount) {
        this.combat.takeDamage(amount);
    }
}
```

### Struktura souborů
```
entities/
├── Enemy.js              (< 100 LOC) - Thin composer
├── core/
│   └── EnemyCore.js      (< 400 LOC) - Phaser integrace
├── ai/
│   ├── EnemyBehaviors.js (< 300 LOC) - State machine
│   └── behaviors/
│       ├── idle.js       (< 50 LOC)  - Pure function
│       ├── chase.js      (< 80 LOC)  - Pure function
│       └── shoot.js      (< 60 LOC)  - Pure function
├── combat/
│   └── EnemyCombat.js    (< 200 LOC) - Damage pipeline
└── visuals/
    └── EnemyVisuals.js   (< 150 LOC) - Animations
```

---

## 🔁 Pure Functions vs Stateful Objects

### Pure Functions (Behaviors)
```javascript
// ✅ SPRÁVNĚ - Pure function
export function chase(cap, cfg, dt) {
    const pos = cap.getPos();
    const target = findTarget(pos);
    const velocity = calculate(pos, target);
    cap.setVelocity(velocity.x, velocity.y);
    return velocity.distance < 100 ? 'attack' : null;
}

// ❌ ŠPATNĚ - Side effects
export function chase(cap, cfg, dt) {
    this.lastPosition = cap.getPos();  // Mění external state
    scene.player.hp -= 10;              // Direct manipulation
    localStorage.setItem('pos', pos);   // I/O operace
}
```

### Stateful Objects (Core Classes)
```javascript
// Core třídy MOHOU mít state
class EnemyCore {
    constructor() {
        this.hp = 100;           // ✅ OK - instance state
        this.position = {x, y};  // ✅ OK - tracked state
        this.timers = [];        // ✅ OK - resource management
    }
}
```

---

## 🗑️ Resource Management

### DisposableRegistry Pattern
Automatická správa zdrojů:

```javascript
class DisposableRegistry {
    constructor() {
        this.disposables = new Map();
    }
    
    create(owner) {
        const tracker = {
            timers: [],
            events: [],
            tweens: [],
            
            trackTimer(timer) {
                this.timers.push(timer);
            },
            
            disposeAll() {
                this.timers.forEach(t => t.destroy());
                this.events.forEach(e => e.off());
                this.tweens.forEach(t => t.stop());
            }
        };
        
        this.disposables.set(owner, tracker);
        return tracker;
    }
    
    dispose(owner) {
        const tracker = this.disposables.get(owner);
        if (tracker) {
            tracker.disposeAll();
            this.disposables.delete(owner);
        }
    }
}
```

### Použití
```javascript
class EnemyCore {
    constructor(scene) {
        this.disposables = scene.disposableRegistry.create(this);
    }
    
    schedule(fn, ms) {
        const timer = this.scene.time.delayedCall(ms, fn);
        this.disposables.trackTimer(timer);  // Automatický cleanup
        return timer;
    }
    
    cleanup() {
        this.disposables.disposeAll();  // Vše vyčištěno
    }
}
```

---

## 🛡️ Guard Rules

### Co jsou Guard Rules?
Architektonická pravidla vynucená automaticky:

1. **No Phaser API in Behaviors**
   ```bash
   grep -r "Phaser\." js/entities/ai/behaviors/  # Musí vrátit 0
   ```

2. **No Circular Dependencies**
   ```bash
   grep -r "import.*Enemy" js/entities/ai/behaviors/  # Musí vrátit 0
   ```

3. **Pure Functions Only**
   ```bash
   grep -r "^class " js/entities/ai/behaviors/  # Musí vrátit 0
   ```

4. **File Size Limits**
   ```bash
   find js -name "*.js" -exec wc -l {} \; | awk '$1 > 500'  # Varování
   ```

### Automatická kontrola
```bash
#!/bin/bash
# check_guards.sh

echo "Checking guard rules..."

# Check 1: No Phaser API in behaviors
if grep -r "Phaser\." js/entities/ai/behaviors/ | grep -v "//"; then
    echo "❌ Found Phaser API in behaviors"
    exit 1
fi

# Check 2: No circular deps
if grep -r "from.*Enemy" js/entities/ai/behaviors/; then
    echo "❌ Found circular dependencies"
    exit 1
fi

echo "✅ All guard rules pass"
```

---

## 📊 Architektonické metriky

### Cílové hodnoty
- **Max file size**: 500 LOC
- **Max class methods**: 10
- **Max function params**: 4
- **Max nesting depth**: 3
- **Cyclomatic complexity**: < 10

### Měření
```bash
# File sizes
find js -name "*.js" -exec wc -l {} \; | sort -rn | head -20

# Complexity (requires jscpd or similar)
npx jscpd js --min-lines 5 --min-tokens 50

# Dependencies
npx madge js --circular
```

---

## 🔄 Migrace legacy kódu

### Postup migrace
1. **Identifikace** - najděte monolitické soubory
2. **Analýza** - rozdělte na komponenty
3. **Capability design** - vytvořte interface
4. **Extrakce** - vytvořte specializované moduly
5. **Composer** - vytvořte thin orchestrator
6. **Guard check** - ověřte pravidla
7. **Test** - unit a integrační testy

### Příklad: Enemy refactor
```
PŘED:
Enemy.js (912 LOC) → monolitický blob

PO:
Enemy.js (93 LOC) → thin composer
├── EnemyCore.js (354 LOC) → Phaser integrace
├── EnemyBehaviors.js (245 LOC) → State machine
└── behaviors/*.js (30-80 LOC each) → Pure functions
```

---

## 📚 Další zdroje

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) - Robert C. Martin
- [Capability-based Security](https://en.wikipedia.org/wiki/Capability-based_security) - Wikipedia
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID) - Wikipedia
- [Composition over Inheritance](https://en.wikipedia.org/wiki/Composition_over_inheritance) - Wikipedia

---

*Dokument vytvořen pro Rakovinobijec v0.4.0 | Poslední aktualizace: 2024*