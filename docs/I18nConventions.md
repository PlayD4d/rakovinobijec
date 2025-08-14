# I18n Conventions Guide

Tento dokument popisuje konvence pro překlady a internacionalizaci ve hře.

## 📋 Namespace struktura

### Hierarchie klíčů
```json
{
  "boss": {
    "entity_id": {
      "name": "Název",
      "desc": "Popis"
    }
  },
  "enemy": { /* ... */ },
  "powerup": { /* ... */ },
  "drop": { /* ... */ },
  "projectile": { /* ... */ },
  "ui": {
    "common": {
      "health": "Zdraví",
      "damage": "Poškození"
    }
  },
  "sr": {  // Screen reader accessibility
    "boss": {
      "entity_id": "Detailní popis pro čtečky obrazovky"
    }
  }
}
```

### Namespace pravidla

#### Herní entity
- `boss.{id}.name` - název bosse
- `boss.{id}.desc` - popis bosse  
- `enemy.{id}.name` - název nepřítele
- `enemy.{id}.desc` - popis nepřítele
- `unique.{id}.name` - název unikátního nepřítele
- `unique.{id}.desc` - popis unikátního nepřítele
- `powerup.{id}.name` - název power-upu
- `powerup.{id}.desc` - popis power-upu
- `drop.{id}.name` - název drop položky
- `drop.{id}.desc` - popis drop položky
- `projectile.{id}.name` - název projektilu
- `projectile.{id}.desc` - popis projektilu

#### UI elementy
- `ui.common.*` - často používané termíny
- `ui.menu.*` - menu texty
- `ui.game.*` - in-game UI texty
- `ui.settings.*` - nastavení

#### Screen reader (sr)
- `sr.boss.{id}` - detailní popis pro accessibility
- `sr.powerup.{id}` - detailní popis power-upu
- `sr.ui.*` - accessibility popis UI elementů

## 🌍 Jazykové verze

### Podporované jazyky
- **cs** - Čeština (primární jazyk)
- **en** - Angličtina (sekundární jazyk)

### Příklady překladů

#### Česká verze (cs.json)
```json
{
  "boss": {
    "onkogen": {
      "name": "Onkogenní mutace",
      "desc": "Mutagenní boss měnící DNA"
    },
    "metastaza": {
      "name": "Metastáza", 
      "desc": "Nebezpečný boss schopný šířit rakovinu"
    }
  },
  "enemy": {
    "basic_cell": {
      "name": "Základní buňka",
      "desc": "Nejjednodušší typ rakovinné buňky"
    }
  },
  "powerup": {
    "damage_boost": {
      "name": "Zvýšené poškození",
      "desc": "Zvyšuje poškození všech útoků"
    }
  },
  "ui": {
    "common": {
      "health": "Zdraví",
      "damage": "Poškození",
      "armor": "Pancíř"
    }
  }
}
```

#### Anglická verze (en.json)
```json
{
  "boss": {
    "onkogen": {
      "name": "Oncogenic Mutation",
      "desc": "Mutagenic boss altering DNA"
    },
    "metastaza": {
      "name": "Metastasis",
      "desc": "Dangerous boss capable of spreading cancer"
    }
  },
  "enemy": {
    "basic_cell": {
      "name": "Basic Cell", 
      "desc": "The simplest type of cancer cell"
    }
  },
  "powerup": {
    "damage_boost": {
      "name": "Increased Damage",
      "desc": "Increases damage of all attacks"
    }
  },
  "ui": {
    "common": {
      "health": "Health",
      "damage": "Damage", 
      "armor": "Armor"
    }
  }
}
```

## 📝 Display Templates

### Template syntax
Blueprinty mohou používat templaty s placeholdery:

```json5
{
  "display": {
    "templates": {
      "short": "{{stats.hp}} HP • {{stats.armor}} armor",
      "long": "Boss s {{stats.hp}} zdravím a {{stats.armor}} armorem. Způsobuje {{stats.damage}} poškození."
    }
  }
}
```

### Podporované formátovače

#### Základní hodnoty
- `{{stats.hp}}` - zobrazí hodnotu HP
- `{{stats.damage}}` - zobrazí hodnotu damage
- `{{mechanics.abilities.length}}` - počet abilities

#### Formátovače
- `{{value|percent}}` - zobrazí jako procenta (0.25 → "25%")
- `{{value|currency}}` - zobrazí jako menu (1000 → "1,000")
- `{{stats.hp|HP}}` - přidá jednotku ("150 HP")
- `{{stats.damage|damage}}` - přidá jednotku ("25 damage")

#### Podmínky
```json5
{
  "templates": {
    "desc": "{{#if mechanics.isElite}}ELITE • {{/if}}{{stats.hp}} HP boss"
  }
}
```

### Template pravidla
1. **Používej jen existující fieldy** - placeholder musí odpovídat skutečné property
2. **Konzistence formátování** - stejné jednotky ve všech templates
3. **Krátká forma** - template.short max 50 znaků
4. **Dlouhá forma** - template.long max 200 znaků

## 📋 Checklist pro nové překlady

### Pro každou novou entitu:

#### Povinné klíče
- [ ] `{type}.{id}.name` - název entity
- [ ] `{type}.{id}.desc` - popis entity

#### Nepovinné klíče  
- [ ] `sr.{type}.{id}` - accessibility popis
- [ ] Custom klíče podle potřeby

#### Validace
- [ ] Všechny klíče existují v cs.json i en.json
- [ ] Žádné TODO placeholdery v produkci
- [ ] Templates používají validní placeholdery
- [ ] Audit prochází: `npm run audit:data`

### Příklad workflow

1. **Vytvoř blueprint s i18n klíči:**
```json5
{
  "display": {
    "key": "boss.new_boss.name",
    "descKey": "boss.new_boss.desc"
  }
}
```

2. **Spusť i18n fix pro vytvoření TODO placeholderů:**
```bash
npm run fix:i18n
```

3. **Nahraď TODO texty skutečnými překlady:**
```json
// cs.json
{
  "boss": {
    "new_boss": {
      "name": "TODO – doplnit překlad" → "Nový Boss",
      "desc": "TODO – doplnit překlad" → "Popis nového bosse"
    }
  }
}

// en.json  
{
  "boss": {
    "new_boss": {
      "name": "TODO – add translation" → "New Boss",
      "desc": "TODO – add translation" → "Description of new boss"
    }
  }
}
```

4. **Ověř audit:**
```bash
npm run audit:data  # Ověří že nejsou missing klíče
npm run audit:data:strict  # Ověří že nejsou TODO texty
```

## 🔧 Nástroje a skripty

### Audit i18n
```bash
# Zkontrolovat chybějící překlady
npm run audit:data

# Strict režim - TODO překlady = chyba
npm run audit:data:strict

# Zobrazit detailní i18n report
npm run audit:report
```

### Opravit chybějící klíče
```bash
# Automaticky přidat TODO placeholdery pro chybějící klíče
npm run fix:i18n
```

### Reporty
```bash
# Vygenerovat markdown reporty
npm run audit:report

# Zobrazit i18n report
cat build/i18n_report.md
```

## 🎯 Best practices

### Psaní překladů

#### Čeština
- **Konzistentní terminologie** - stejné termíny pro stejné koncepty
- **Herní kontext** - překlady přizpůsobené hernímu prostředí
- **Krátké a výstižné** - zejména pro názvy entities
- **Medicínské termíny** - zachovat správnou terminologii kde je vhodná

#### Angličtina  
- **Jasnost před literárností** - srozumitelnost prioritou
- **Jednotné názvosloví** - consistency napříč celou hrou
- **Accessibility friendly** - texty čitelné pro screen readery

### Template design
- **Modularity** - krátký template pro quick display, dlouhý pro details
- **Placeholder validation** - pouze existující fieldy
- **Fallback values** - vždy mít výchozí hodnoty
- **Performance** - minimální počet complex formatters

### Lokalizace workflow
1. Vývoj v českém jazyce (primární)
2. Anglické překlady průběžně (sekundární)  
3. Validation před každým commitem
4. TODO cleanup před production release

## 🛠️ Řešení problémů

### "Missing translation for key XYZ"
```bash
# Automaticky přidat TODO placeholder
npm run fix:i18n

# Nebo ručně přidat do příslušného JSON souboru
```

### "Invalid placeholder in template"
Template používá neexistující field:
```json5
// ŠPATNĚ:
"short": "{{nonexistent.field}} HP"

// SPRÁVNĚ: 
"short": "{{stats.hp}} HP"
```

### "TODO translations found in strict mode"
V strict módu nejsou povolené TODO texty:
```bash
# Najít všechny TODO překlady
grep -r "TODO" data/i18n/

# Nahradit skutečnými překlady před production
```

### "Duplicate i18n keys"
Stejný klíč existuje na více místech:
```bash
# Zkontrolovat duplicity
npm run audit:data
# Opravit removing duplicates nebo rename keys
```