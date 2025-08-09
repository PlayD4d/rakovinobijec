# Changelog

All notable changes to Rakovinobijec will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-01-09

### Added
- 🌐 **Globální high score systém** - soutěž s hráči po celém světě
- 📦 **Package.json** pro správu verzí a dependencies  
- 📝 **Changelog** pro tracking změn
- 🎯 **Favicon** - lékařský kříž pro lepší branding

### Fixed
- 🐛 **Boss crash fix** - opraveny delayed callback chyby po smrti bossů
- 💊 **Chemoterapie & Radioterapie** - power-upy nyní správně ničí nepřátele
- 🎯 **Damage systém** - opraveno dvojité počítání a nesmrtelní nepřátelé
- 🔢 **Statistiky** - správné počítání zničených buněk

### Technical
- Přidány bezpečnostní kontroly do boss special attacks
- Vylepšené error handling v delayed callbackech
- Optimalizace collision detection pro power-up útoky

## [0.1.0] - 2025-01-08

### Added
- 🎮 **Kompletní herní mechaniky** - top-down arcade shooter
- 👑 **8 bossů** s unikátními českými názvy a special attacks
- 💊 **13 power-upů** inspirovaných léčbou rakoviny
- 🏆 **Lokální high score** systém s TOP 10
- 🎵 **Kompletní audio systém** - hudba a zvukové efekty
- 🎨 **Pixel art estetika** s retro arkádovým stylem
- 📱 **Responzivní design** pro různá rozlišení

### Game Content
- **Nepřátelé**: 5 typů buněk (Mutantní, Tumor, Metastáza, Onkogen, Nekrotická tkáň)
- **Bossové**: Postupná obtížnost od Malignitní Buňky po Finální Nádor
- **Power-upy**: Radioterapie, Chemoterapie, Imunoterapie, Cisplatina, Imunitní štít
- **Mechaniky**: XP systém, level up, shield system, aura damage

### Technical Features  
- Phaser.js 3.70.0 framework
- ES6 modules architektura
- LocalStorage persistence
- Arcade physics system
- Český jazyk a tematika

---

## Legend
- 🎮 Gameplay features
- 🐛 Bug fixes  
- 🌐 Network/API features
- 🎨 Visual improvements
- 🎵 Audio features
- 📱 Mobile/responsive
- 🏆 Scoring/achievements
- 📦 Dependencies/build
- 📝 Documentation