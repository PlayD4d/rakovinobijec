# PR7 Refactor Guidelines

## 🎯 Cíl
Dosáhnout 100% PR7 compliance podle Dev_Guidelines.md

## 🚫 Co je zakázáno

### 1. Přímý přístup k GameConfig
```javascript
// ❌ ŠPATNĚ
const damage = GameConfig.player.projectileDamage;

// ✅ SPRÁVNĚ
const CR = window.ConfigResolver;
const damage = CR.get('player.projectile.damage', { defaultValue: 10 });
```

### 2. Hardcodované konstanty
```javascript
// ❌ ŠPATNĚ
this.moveSpeed = 135;
this.fireInterval = 1000;

// ✅ SPRÁVNĚ
const CR = this.scene.configResolver;
this.moveSpeed = CR.get('player.movement.baseSpeed', { blueprint });
this.fireInterval = CR.get('player.attack.intervalMs', { blueprint });
```

### 3. Přímé Phaser API volání
```javascript
// ❌ ŠPATNĚ
this.scene.add.particles(...);
this.scene.sound.play('explosion');

// ✅ SPRÁVNĚ
this.scene.newVFXSystem.play('vfx.explosion', x, y);
this.scene.newSFXSystem.play('sfx.explosion');
```

### 4. Legacy importy
```javascript
// ❌ ŠPATNĚ
import enemyData from '../../data/enemies/zombie.js';

// ✅ SPRÁVNĚ
const blueprint = this.scene.blueprintLoader.get('enemy.zombie');
```

### 5. Feature flagy
```javascript
// ❌ ŠPATNĚ
if (GameConfig.features.useConfigResolver) { ... }

// ✅ SPRÁVNĚ
// Žádné podmíněné cesty - PR7 je jediný způsob
```

## ✅ Správné PR7 patterny

### Blueprint struktura
```json5
{
  id: "entity.type.name",
  type: "entity_type",
  stats: {
    // Všechny herní hodnoty
  },
  mechanics: {
    // Herní mechaniky
  },
  visuals: {
    // Vizuální nastavení
  },
  vfx: {
    // VFX reference
  },
  sfx: {
    // SFX reference
  },
  display: {
    // i18n klíče
    key: "entity.type.name.name",
    descKey: "entity.type.name.desc",
    devNameFallback: "Fallback název",
    devDescFallback: "Fallback popis"
  }
}
```

### ConfigResolver použití
```javascript
// Inicializace
const CR = this.scene.configResolver || window.ConfigResolver;

// Čtení hodnot
const value = CR.get('path.to.value', { 
  blueprint,           // Předat blueprint kontext
  defaultValue: 10     // Fallback pouze pro kritické hodnoty
});

// Validace
if (!CR) {
  throw new Error('[System] ConfigResolver required for PR7');
}
```

### VFX/SFX Registry
```javascript
// Registrace
VFXRegistry.register('vfx.custom.effect', {
  type: 'particles',
  config: { /* particle config */ }
});

// Použití
this.scene.newVFXSystem.play('vfx.custom.effect', x, y);
```

## 📋 Refactor kroky

### 1. Blueprint First
- Vytvořit všechny chybějící blueprinty
- Zajistit kompletní data v blueprintech
- Přidat i18n fallbacky

### 2. ConfigResolver Everywhere
- Nahradit VŠECHNY GameConfig přístupy
- Použít správné cesty podle konfigurace
- Validovat ConfigResolver dostupnost

### 3. Registry Pattern
- VFX/SFX pouze přes registry
- Žádné přímé scene.add/sound volání
- Registrovat všechny efekty

### 4. Clean Code
- Odstranit všechny TODO/FIXME
- Odstranit zakomentovaný kód
- Odstranit feature flagy

### 5. Validation
- Přidat PR7 validaci do každého systému
- Fail-fast při chybějících závislostech
- Jasné error zprávy

## 🧪 Testování

### Runtime testy
```javascript
// Zdravotní kontrola
window.__framework.healthcheck()
// Očekáváme:
// - modernSystemsActive: true
// - spawnedFromLegacy: 0
// - configResolverActive: true

// Smoke test
window.__framework.smokeTest()
// Nesmí obsahovat legacy varování
```

### Audit script
```bash
npm run audit:pr7
# Musí projít bez chyb
```

## 📝 Checklist pro každý soubor

- [ ] Žádné GameConfig přístupy
- [ ] Žádné hardcodované konstanty
- [ ] Žádné přímé Phaser API volání
- [ ] Žádné legacy importy
- [ ] Žádné feature flagy
- [ ] Má PR7 validaci
- [ ] Používá ConfigResolver
- [ ] i18n podpora (kde relevantní)
- [ ] Dokumentovaný podle PR7 standardů