# Data Folder Guide

Tento dokument popisuje strukturu složky `data/`, konvence pojmenování a způsoby práce s herními entitami.

## 📁 Struktura složky data/

```
data/
  blueprints/           # Herní entity blueprinty
    boss/               # Boss entity (koncové nepřátele)
    enemy/              # Běžní nepřátele  
    miniboss/           # Mini-boss entity
    unique/             # Unikátní pojmenovaní nepřátele
    powerup/            # Power-up upgradey
    drop/               # Dropovaná položky (XP, health, apod.)
    projectile/         # Projektily a střely
    lootTable/          # Loot tabulky pro drop systém
    spawn/              # Spawn tabulky pro generování entit
  defaults/             # Výchozí hodnoty pro jednotlivé typy
  mixins/               # Sdílené komponenty a modifikátory
  i18n/                 # Překlady
    cs.json             # Český překlad
    en.json             # Anglický překlad
  registries/           # Registry a indexy
    index.json          # Centrální index všech entit
  schemas/              # JSON Schema pro validaci
    blueprint.schema.json
    lootTable.schema.json
    spawnTable.schema.json
  docs/                 # Dokumentace
```

## 🏷️ Konvence pojmenování

### ID konvence: `type.slug`
- **Formát:** `typ.identifikator` (např. `boss.onkogen`, `enemy.viral_swarm`)
- **Pravidla:**
  - Pouze malá písmena a podtržítka
  - Typ odpovídá složce (`boss`, `enemy`, `unique`, `powerup`, `drop`, `projectile`)
  - Slug je unikátní identifikátor v rámci typu

### Název souboru
- **Formát:** `id_s_podtrzitkama.json5`
- **Příklad:** `boss.onkogen` → `boss_onkogen.json5`
- **Přípona:** Vždy `.json5` (podporuje komentáře)

## 🧬 Blueprint struktura

### Základní struktura
```json5
{
  // Blueprint: boss.example
  "id": "boss.example",
  "type": "boss",
  "baseType": "boss.base",         // Nepovinné - dědění
  "stats": {
    "hp": 500,
    "damage": 25,
    "speed": 0.8,
    "armor": 10,
    "xp": 100
  },
  "display": {
    "key": "boss.example.name",     // i18n klíč
    "descKey": "boss.example.desc", // i18n klíč popisu
    "color": "#FF4444",
    "rarity": "boss",
    "templates": {
      "short": "{{stats.hp}} HP boss",
      "long": "Boss s {{stats.hp}} zdravím a {{stats.armor}} armorem."
    }
  }
}
```

### Dědičnost

#### baseType - základní dědičnost
```json5
{
  "id": "boss.advanced",
  "baseType": "boss.base",  // Zdědí všechny vlastnosti z boss.base
  "stats": {
    "hp": 800  // Přepíše pouze HP, zbytek zůstane z base
  }
}
```

#### mixins - kompozice modulů
```json5
{
  "id": "enemy.shooter",
  "mixins": [
    "ai.ranged",
    "movement.chase", 
    "drop.common"
  ]
}
```

### Reference systém

#### Loot reference
```json5
{
  "id": "boss.example",
  "lootTableRef": "lootTable.boss.tier1"  // Reference na loot tabulku
}
```

#### Projektil reference
```json5
{
  "mechanics": {
    "abilities": {
      "shoot": {
        "projectileRef": "projectile.boss.fireball"
      }
    }
  }
}
```

#### VFX/SFX reference
```json5
{
  "vfx": {
    "spawn": "vfx.boss.spawn.dramatic",
    "death": "vfx.explosion.large"
  },
  "sfx": {
    "spawn": "sfx.boss.roar",
    "hit": "sfx.impact.heavy"
  }
}
```

## ➕ Přidání nové entity

### 1. Vytvoř blueprint
```bash
# Vytvoř nový soubor ve správné složce
touch data/blueprints/enemy/enemy_new_type.json5
```

### 2. Definuj blueprint
```json5
{
  // Blueprint: enemy.new_type
  "id": "enemy.new_type",
  "type": "enemy",
  "stats": {
    "hp": 50,
    "damage": 8,
    "speed": 100,
    "size": 15,
    "xp": 5
  },
  "display": {
    "key": "enemy.new_type.name",
    "descKey": "enemy.new_type.desc",
    "color": "#44AA44",
    "rarity": "common"
  }
}
```

### 3. Přidej i18n překlady
Do `data/i18n/cs.json`:
```json
{
  "enemy": {
    "new_type": {
      "name": "Nový typ",
      "desc": "Popis nového typu nepřítele"
    }
  }
}
```

### 4. Vytvoř loot tabulku (pokud potřeba)
```json5
// data/blueprints/lootTable/lootTable_enemy_common.json5
{
  "id": "lootTable.enemy.common",
  "type": "lootTable",
  "pools": [
    {
      "chance": 0.8,
      "items": [
        { "dropRef": "drop.xp_small", "weight": 10 },
        { "dropRef": "drop.health", "weight": 2 }
      ]
    }
  ]
}
```

### 5. Přidej do spawn tabulky
```json5
// data/blueprints/spawn/spawn_level1.json5
{
  "entities": [
    {
      "entityRef": "enemy.new_type",
      "weight": 15,
      "minWave": 1,
      "maxWave": 10
    }
  ]
}
```

## 🔍 Validace a audit

### Spuštění auditu
```bash
# Základní audit
npm run audit:data

# Strict režim (TODO překlady = chyba) 
npm run audit:data:strict

# Generovat markdown reporty
npm run audit:report

# Opravit chybějící i18n klíče
npm run fix:i18n
```

### Interpretace výsledků

#### Exit kódy
- `0` - Vše v pořádku
- `1` - Pouze varování (orphaned references, TODO překlady)
- `2` - Chyby (schema violations, missing files, duplicates)

#### Běžné chyby
- **MISSING_ID:** Blueprint nemá ID
- **TYPE_MISMATCH:** Typ neodpovídá složce
- **SCHEMA_VIOLATION:** Blueprint neprošel JSON schema validací
- **DUPLICATE_ID:** Stejné ID existuje vícekrát
- **FILENAME_MISMATCH:** Název souboru neodpovídá ID

#### Běžná varování
- **ORPHANED_REFERENCE:** Reference na neexistující entitu
- **MISSING_TRANSLATION:** Chybí i18n překlad
- **TODO_TRANSLATION:** Překlad je označený jako TODO

## 🚀 Automatizace

### Pre-commit hook
Při každém commitu se automaticky spouští `npm run audit:data` a commit se zastaví při chybách.

### CI Pipeline
GitHub Actions spouští strict audit při pull requestech a nahrává reporty jako artifakty.

## 📋 Checklist pro novou entitu

- [ ] Blueprint vytvořen ve správné složce
- [ ] ID následuje konvenci `type.slug`  
- [ ] Název souboru = `id_with_underscores.json5`
- [ ] Všechny povinné fields vyplněny
- [ ] I18n klíče přidané do cs.json a en.json
- [ ] Loot tabulka vytvořena (pokud potřeba)
- [ ] Přidáno do spawn tabulky
- [ ] Audit prochází bez chyb: `npm run audit:data`
- [ ] Reference jsou validní (žádné orphaned refs)

## 🛠️ Řešení problémů

### "Cannot find reference XYZ"
Entita nebo resource neexistuje. Zkontroluj:
1. Existuje soubor s tímto ID?
2. Je ID správně napsané?
3. Je entity v registru?

### "Schema violation"
Blueprint neodpovídá expected structure:
1. Zkontroluj povinné fieldy (id, type, display)
2. Ověř datové typy (čísla vs stringy)
3. Zkontroluj enum hodnoty (rarity, type)

### "Filename mismatch"
Název souboru neodpovídá ID:
```bash
# ID: boss.example -> soubor: boss_example.json5
mv boss.example.json5 boss_example.json5
```

### "Missing translation"
Chybí i18n klíč:
```bash
# Automaticky doplnit TODO placeholdery
npm run fix:i18n
```