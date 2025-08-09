# 🎮 Rakovinobijec

**Hra pro Mardu - bojovníka proti rakovině**

Arcade-style top-down shooter hra vytvořená v Phaser.js, kde hráč v roli rytíře Mardy bojuje proti škodlivým buňkám a nádorům.

## 🎯 O hře

Rakovinobijec je motivační hra vytvořená speciálně pro podporu v boji proti rakovině. Hráč ovládá rytíře Mardu, který se pomocí různých "léčebných" zbraní a upgradů snaží porazit škodlivé buňky reprezentující rakovinu.

### 🎲 Herní mechaniky

- **Top-down shooter** s automatickou střelbou
- **Progresivní obtížnost** s 8 různými bossy
- **13 power-upů** inspirovaných skutečnou léčbou rakoviny
- **5 typů nepřátel** s unikátními schopnostmi
- **XP systém** s level-up mechanikou
- **🌐 Globální high score** - soutěž s hráči po celém světě
- **📱 Offline fallback** - lokální scores při výpadku připojení

## 🎮 Ovládání

- **WASD** nebo **šipky** - pohyb
- **ESC** - pauza/menu
- **R** - restart (po game over)
- **Myš** - navigace v menu

## 🔧 Technické informace

### Použité technologie
- **Phaser.js 3.70.0** - herní framework
- **ES6 Modules** - modulární architektura
- **LocalStorage** - backup high score (offline režim)
- **Global API** - centralizovaný high score systém
- **CSS3** - responzivní design
- **Web Audio API** - zvukové efekty

### Požadavky
- Moderní webový prohlížeč s ES6 podporou
- Aktivní JavaScript
- Doporučeno: Chrome, Firefox, Safari, Edge

## 🚀 Instalace a spuštění

### Online verze
Hra je dostupná online na: `https://yourusername.github.io/rakovinobijec/`

### Lokální spuštění
```bash
# Klonování repozitáře
git clone https://github.com/yourusername/rakovinobijec.git
cd rakovinobijec

# Spuštění lokálního serveru (potřeba kvůli ES6 modules)
python -m http.server 8000
# nebo
npx serve .

# Otevřít v prohlížeči
open http://localhost:8000
```

## 🎭 Herní obsah

### 👹 Nepřátelé
- **🔴 Mutantní buňka** - Rychlá, základní nepřítel
- **🟠 Tumor** - Pomalý ale odolný
- **🟢 Metastáza** - Agresivní s vysokým poškozením
- **🟣 Onkogen** - Support typ, posiluje ostatní nepřátele
- **🟤 Nekrotická tkáň** - Střílí homing projektily

### 👑 Bossové (každých 5 levelů)
1. **💀 Malignitní Buňka** (Level 5) - Děli se na menší části
2. **🦠 Metastáza** (Level 10) - Šíří "nákazu" po mapě
3. **⚡ Onkogen** (Level 15) - Mutuje okolní nepřátele
4. **👑 Karcinogenní Král** (Level 20) - Kombinované útoky
5. **🧬 Genová Mutace** (Level 25) - DNA helix útoky
6. **☢️ Radiační Záření** (Level 30) - Radioaktivní pole
7. **🔬 Chemorezistence** (Level 35) - Dočasná imunita
8. **💀 Finální Nádor** (Level 40) - Apokalyptický boss

### 💊 Power-upy (léčebné metody)
- **🔥 Radioterapie** - Laserové paprsky
- **⚡ Protonové dělo** - Explozivní projektily
- **⚡ Imunoterapie** - Lightning chain útoky
- **🧪 Cisplatina** - Průrazné střely
- **🛡️ Imunitní štít** - Ochranný štít
- **🧬 Metabolický urychlovač** - Rychlejší pohyb
- **💊 Chemoterapie** - Damage aura
- **📏 Delší dosah** - Zvýšený dosah útoků
- **🧲 XP Magnet** - Větší dosah XP
- **🔄 Rychlá střelba** - Vyšší kadence
- **⚔️ Zvýšené poškození** - Více damage
- **❤️ Více života** - Vyšší HP
- **➕ Více projektilů** - Dodatečné střely

## 📊 Aktuální stav

### ✅ Implementováno
- [x] Kompletní herní mechaniky
- [x] 8 bossů s unikátními útoky
- [x] 13 power-upů s progresí
- [x] 5 typů nepřátel + elite variace
- [x] XP systém a level-up
- [x] 🌐 Globální high score systém (TOP 10 worldwide)
- [x] Pause menu s nastavením
- [x] Audio systém (hudba + SFX)
- [x] Responzivní design
- [x] Game over screen
- [x] Český jazyk a tematika

### 🌐 Globální High Score Systém

**Features:**
- **🏆 Worldwide leaderboard** - soutěž s hráči z celého světa
- **📡 Smart fallback** - automatické přepínání offline/online
- **⚡ Rychlé načítání** - 1-minutový cache systém
- **🔒 Bezpečnost** - data validation & sanitization
- **📱 Dual storage** - lokální backup + globální synchronizace

**Online režim:** `🌐 GLOBÁLNÍ HIGH SCORES`
- Zobrazuje TOP 10 ze všech hráčů
- Real-time submission scores
- Connection status indikátory

**Offline režim:** `📱 LOKÁLNÍ HIGH SCORES`  
- Automatický fallback při výpadku
- Lokální storage backup
- Synchronizace při obnovení připojení

### 🔨 Plánované vylepšení
- [ ] Touch ovládání pro mobily
- [ ] Tutorial pro nové hráče  
- [ ] Dodatečné particle efekty
- [ ] Achievements systém
- [ ] Firebase/Supabase API integrace
- [ ] Player profiles & statistics

## 🎨 Design a téma

Hra využívá **pixel art** estetiku s **retro arkádovým** stylem. Všechny prvky hry jsou tematicky zaměřené na boj proti rakovině:

- **Nepřátelé** = škodlivé buňky a nádory
- **Power-upy** = skutečné léčebné metody
- **Bossové** = pokročilé formy onemocnění
- **Hráč** = bojovník/pacient v léčbě

## 📁 Struktura projektu

```
rakovinobijec/
├── index.html              # Hlavní HTML soubor
├── css/
│   └── style.css           # Styly a responzivní design
├── js/
│   ├── main.js             # Hlavní inicializace hry
│   ├── config.js           # Herní konfigurace
│   ├── fontConfig.js       # Font management
│   ├── scenes/
│   │   ├── MainMenu.js     # Hlavní menu
│   │   └── GameScene.js    # Herní scéna
│   ├── entities/
│   │   ├── Player.js       # Hráč
│   │   ├── Enemy.js        # Nepřátelé
│   │   └── Boss.js         # Bossové
│   └── managers/
│       ├── AudioManager.js # Audio systém
│       ├── EnemyManager.js # Spawn nepřátel
│       ├── PowerUpManager.js # Power-up systém
│       ├── UIManager.js    # Uživatelské rozhraní
│       ├── HighScoreManager.js # Lokální high score
│       └── GlobalHighScoreManager.js # Globální high score
├── package.json            # NPM konfigurace a versioning
├── CHANGELOG.md            # Historie změn
├── fonts/                  # Public Pixel font
├── music/                  # Hudební soubory
└── sound/                  # Zvukové efekty
```

## 🤝 Přispívání

Projekt je open source! Contributions jsou vítány:

1. Fork repozitář
2. Vytvoř feature branch (`git checkout -b feature/new-feature`)
3. Commit změny (`git commit -am 'Add new feature'`)
4. Push do branch (`git push origin feature/new-feature`)
5. Vytvoř Pull Request

## 📄 Licence

MIT License - viz [LICENSE](LICENSE) soubor.

## 👨‍💻 Autoři

- **PlayD4d** - Návrh a vývoj
- **Claude (Anthropic)** - Code assistance a implementace

## 💌 Kontakt

- Email: playd4d.me@gmail.com
- GitHub: [@PlayD4d](https://github.com/PlayD4d)

---

*Tato hra byla vytvořena s láskou a nadějí pro všechny bojovníky proti rakovině. Bojuj dál, Mardo! 💪*

## 🎯 Live Demo

[**▶️ HRÁT ONLINE**](https://playd4d.github.io/rakovinobijec/)

---

*Verze: 0.1.1 | Poslední aktualizace: Srpen 2025*