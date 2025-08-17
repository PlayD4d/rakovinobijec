# 📚 Dokumentace Rakovinobijec

> **Centrální rozcestník pro všechnu dokumentaci projektu**

---

## 🚀 Hlavní průvodce

### 🎯 [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
**Kompletní průvodce pro vývojáře** - Všechno co potřebujete vědět:
- Architektura a PR7 principy
- Praktické návody (přidání enemy, boss, powerup)
- Development tools (F3-F9 klávesové zkratky)
- XP a progression systém
- I18n lokalizace
- Troubleshooting a řešení problémů

---

## 📋 Speciální dokumenty

### 🏛️ [ARCHITECTURE.md](./ARCHITECTURE.md) **NOVÉ!**
**Kompletní architektonický přehled** - Patterns a principy:
- Capability-based Design Pattern
- Thin Composer Pattern  
- Resource Management (DisposableRegistry)
- Guard Rules a jejich implementace
- Migrace legacy kódu

### 📝 [CODE_STANDARDS.md](./CODE_STANDARDS.md) **NOVÉ!**
**Kódové standardy a konvence**:
- Limity velikosti souborů (max 500 LOC)
- Naming conventions
- Import struktura a komentáře
- Best practices a anti-patterns
- Code review checklist

### 🔧 [Dev_Guidelines.md](../Dev_Guidelines.md) **AKTUALIZOVÁNO!**
Pravidla PR7 compliance a architektonické vzory:
- Nové sekce o Capability-based design
- Anti-patterns to avoid
- Guard rules checking

### 📊 [README.md](../README.md)
Hlavní README projektu s přehledem a instalací

---

## 🗂️ Struktura projektu

```
docs/
├── DEVELOPER_GUIDE.md    # 📖 Kompletní průvodce (HLAVNÍ)
└── README.md            # 🗺️ Tento rozcestník

data/
├── blueprints/          # 🎮 Herní data
│   ├── enemy/          # Nepřátelé
│   ├── boss/           # Bossové
│   ├── powerup/        # Power-upy
│   └── templates/      # Šablony pro rychlé vytváření
├── config/             # ⚙️ Systémové konfigurace  
└── i18n/              # 🌍 Lokalizace (cs.json, en.json)

js/
├── core/               # 🏗️ Základní systémy
├── entities/           # 👾 Herní entity
├── scenes/             # 🎬 Herní scény
└── ui/                # 🖼️ Uživatelské rozhraní
```

---

## ⚠️ Důležitá architektonická pravidla

### 🚫 Co NIKDY nedělat
- **Soubory > 500 LOC** - rozdělte na komponenty
- **Phaser API v behaviors** - použijte capability interface
- **Cyklické závislosti** - A→B→A = problém
- **Hardcoded hodnoty** - vše do blueprintů
- **Direct scene manipulation** - použijte systémy

### ✅ Co VŽDY dodržovat
- **Capability-based design** - oddělte Phaser od logiky
- **Thin Composer pattern** - hlavní třída jen orchestruje
- **Pure functions** - behaviors bez side-effects
- **Guard rules** - spusťte `./dev/refactor/check_enemy_guards.sh`
- **DisposableRegistry** - pro timery a eventy

→ Detaily v [ARCHITECTURE.md](./ARCHITECTURE.md) a [CODE_STANDARDS.md](./CODE_STANDARDS.md)

---

## 🎯 Quick Start

**1. Začínáte s vývojem?**
→ Čtěte [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
→ Prostudujte [ARCHITECTURE.md](./ARCHITECTURE.md)

**2. Přidáváte nový obsah?**
→ Použijte templates v `data/blueprints/templates/`
→ Dodržte [CODE_STANDARDS.md](./CODE_STANDARDS.md)
→ F9 pro hot-reload změn

**3. Refaktorujete velký soubor?**
→ Postupujte podle [ARCHITECTURE.md](./ARCHITECTURE.md#refaktoring-velkých-souborů)
→ Použijte capability-based design
→ Ověřte guard rules

**4. Před commitem:**
```bash
# Data validace
npm run audit:data:strict

# Guard rules check
./dev/refactor/check_enemy_guards.sh

# Všechny testy
npm run verify:all
```

---

## 💡 Pro Tips

- **F9** je váš nejlepší přítel pro rychlé iterace
- **VS Code snippets** (`bossBlueprint` + Tab) pro rychlé vytváření
- **Direct file paths** pro SFX (např. `"sound/laser.mp3"`)
- **Console commands** (`DEV.*`, `__framework.*`) pro debugging
- **Templates** vždy použijte místo psaní od nuly

---

## 🆘 Potřebujete pomoc?

1. Zkontrolujte [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - sekce Troubleshooting
2. Použijte `__framework.healthcheck()` v konzoli
3. F6 Missing Assets panel pro chybějící soubory
4. Validujte data: `npm run audit:data:strict`

---

*Vytvořeno pro Rakovinobijec v0.4.0 | Poslední aktualizace: 2024*