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

### 🔧 [Dev_Guidelines.md](../Dev_Guidelines.md)
Pravidla PR7 compliance a kodingové standardy

### 📝 [Refactor_TODO.md](../Refactor_TODO.md)
Seznam refactoring úkolů a plánovaných změn

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

## 🎯 Quick Start

**1. Začínáte s vývojem?**
→ Čtěte [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)

**2. Přidáváte nový obsah?**
→ Použijte templates v `data/blueprints/templates/`
→ F9 pro hot-reload změn

**3. Testujete změny?**
→ F7 Boss Playground pro bosse
→ F8 SFX Soundboard pro zvuky
→ DEV console commands pro debug

**4. Před commitem:**
```bash
npm run audit:data:strict
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