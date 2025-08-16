# 🎮 Rakovinobijec

**Věnováno Mardovi - bojovníkovi s rakovinou a všem, kdo bojují s jakoukoliv nemocí.** 💪

## 🌟 Hrát online

**➡️ [Hrát Rakovinobijec online](https://playd4d.github.io/rakovinobijec/)**

## 📖 O hře

Rakovinobijec je arkádová 2D top-down střílečka, kde hráč v roli bílé krvinky bojuje proti rakovinným buňkám a dalším patogenům. Hra symbolicky zobrazuje boj imunitního systému s nemocí.

### Herní principy

- **Survival gameplay** - Přežijte co nejdéle proti vlnám nepřátel
- **Progresivní obtížnost** - Nepřátelé postupně sílí
- **Power-up systém** - Sbírejte vylepšení a posilujte své schopnosti  
- **Boss souboje** - Čelte mocným mutovaným buňkám
- **XP a levelování** - Získávejte zkušenosti a odemykejte nové schopnosti
- **Globální žebříček** - Soutěžte s hráči z celého světa

### Ovládání

- **WASD / Šipky** - Pohyb
- **Myš** - Míření a střelba (automatická)
- **ESC** - Pauza
- **Mobilní zařízení** - Virtuální joystick

## 🚀 Rychlý start

```bash
# Naklonovat repozitář
git clone https://github.com/playd4d/rakovinobijec.git

# Nainstalovat závislosti
npm install

# Spustit vývojový server
npm run dev

# Otevřít v prohlížeči
http://localhost:8000
```

## 🛠️ Pro vývojáře

### Dokumentace

- [Developer Guide](docs/DEVELOPER_GUIDE.md) - Kompletní průvodce vývojem
- [Dev Guidelines](DEV_GUIDELINES.md) - PR7 pravidla a best practices
- [Changelog](CHANGELOG.md) - Historie verzí

### Hlavní příkazy

```bash
npm run dev              # Vývojový server s hot-reload
npm run audit:data       # Kontrola validity blueprintů
npm run rebuild:index    # Přestavba registry indexu
npm run smoke:test       # Spuštění smoke testů
npm run verify:all       # Kompletní verifikace
```

### Technologie

- **Engine**: Phaser 3
- **Architektura**: PR7 (100% data-driven)
- **Blueprinty**: JSON5 formát
- **Audio**: Web Audio API
- **Analytics**: Supabase
## 📊 Aktuální verze

**v0.4.1** (2025-08-16)
- Centralizace konfigurace do main_config.json5
- Oprava chybějících power-upů (XP Magnet)
- Aktualizace validátorů pro PR7 kompatibilitu
- Vylepšení editoru blueprintů

[Kompletní historie verzí](CHANGELOG.md)

## 🤝 Přispívání

Příspěvky jsou vítány! Prosím přečtěte si [Dev Guidelines](DEV_GUIDELINES.md) před vytvořením pull requestu.

## 📝 Licence

MIT

## 💝 Poděkování

Speciální poděkování všem, kdo bojují s nemocí a nevzdávají se. Tato hra je symbolickou podporou vašeho boje.

---

*"V každém z nás je bojovník. Někdy jen potřebujeme připomenout, jak silní dokážeme být."*