# 🎮 Rakovinobijec

**Hra pro Mardu - bojovníka proti rakovině**

Arcade-style top-down shooter hra vytvořená v Phaser.js, kde hráč v roli rytíře Mardy bojuje proti škodlivým buňkám a nádorům.

**Verze:** 0.1.4 | **PR7 Architektura** - 100% data-driven design

## 🎯 O hře

Rakovinobijec je motivační hra vytvořená speciálně pro podporu v boji proti rakovině. Hráč ovládá rytíře Mardu, který se pomocí různých "léčebných" zbraní a upgradů snaží porazit škodlivé buňky reprezentující rakovinu.

### 🎆 Herní mechaniky

- **Top-down shooter** s automatickou střelbou
- **Progresivní obtížnost** s 6 unikátními bossy
- **13 power-upů** inspirovaných skutečnou léčbou rakoviny
- **5 typů nepřátel** s unikátními schopnostmi
- **XP systém** s level-up mechanikou
- **🌐 Globální high score** - soutěž s hráči po celém světě
- **📊 Analytics systém** - pokročilý sběr herních dat pro optimalizaci
- **📱 Mobilní podpora** - virtuální joystick a responzivní UI
- **💥 Speciální efekty** - Metotrexat mass-kill, explozivní projektily

## 🎮 Ovládání

### Desktop
- **WASD** nebo **šipky** - pohyb
- **ESC** - pauza/menu
- **R** - restart (po game over)
- **Myš** - navigace v menu

### Mobil/Tablet
- **Virtuální joystick** - pohyb (levá/pravá strana)
- **Touch** - navigace v menu
- **Fullscreen** - podporováno

## 🔧 Technické informace

### Použité technologie
- **Phaser.js 3.70.0** - herní framework
- **ES6 Modules** - modulární architektura
- **PR7 Architektura** - 100% data-driven design
- **Supabase** - cloud databáze pro high scores a analytics
- **LocalStorage** - backup high score (offline režim)
- **PostgreSQL** - analytics databáze s RLS security
- **CSS3** - responzivní design
- **Web Audio API** - zvukové efekty

### Core systémy (PR7)
- **BlueprintRegistry** - centrální registr všech entit
- **ConfigResolver** - jednotné řešení konfigurace
- **SpawnDirector** - řízení vln nepřátel
- **ProjectileSystemV2** - Zero-GC projektily s poolingem
- **ModifierEngine** - aplikace buffů a debuffů
- **PowerUpSystem** - správa vylepšení hráče

### Požadavky
- Moderní webový prohlížeč s ES6 podporou
- Aktivní JavaScript
- Doporučeno: Chrome, Firefox, Safari, Edge

## 🚀 Instalace a spuštění

### Online verze
Hra bude brzy dostupná online.

### Lokální spuštění

#### Pomocí Node.js (doporučeno)
1. Naklonuj repozitář:
```bash
git clone https://github.com/yourusername/rakovinobijec.git
cd rakovinobijec
```

2. Nainstaluj závislosti:
```bash
npm install
```

3. Spusť lokální server:
```bash
npm start
```

4. Otevři prohlížeč na: `http://localhost:8080`

#### Pomocí Python (alternativa)
```bash
python -m http.server 8000
```
Otevři prohlížeč na: `http://localhost:8000`

## 🛠️ Development

### Struktura projektu
```
rakovinobijec/
├── index.html          # Hlavní HTML soubor
├── css/               # Styly
├── js/                # Herní logika
│   ├── main.js        # Entry point
│   ├── config.js      # GameConfig
│   ├── core/          # PR7 systémy
│   ├── entities/      # Player, Enemy, Boss
│   ├── managers/      # Správci (Audio, Analytics, atd.)
│   └── scenes/        # Phaser scény
├── data/              # Blueprinty a konfigurace
│   ├── blueprints/    # JSON5 definice entit
│   └── config/        # Herní nastavení
├── sprites/           # Grafika
└── sound/            # Zvuky
```

### PR7 Guidelines
Hra používá 100% data-driven architekturu:
- Všechny entity jsou definovány v `/data/blueprints/`
- Žádné hardcodované hodnoty v kódu
- ConfigResolver pro všechny konstanty
- Jednotné API přes core systémy

## 📝 Poznámky

- Hra je vytvořena s láskou pro Mardu
- Všechny názvy power-upů jsou inspirovány skutečnými léky
- Analytics pomáhají vylepšovat herní balance

## 🤝 Credits

- **Vývojář:** Miroslav
- **Pro:** Marda - skutečný bojovník
- **Framework:** Phaser.js komunita

---

*Mardo, jsi nejsilnější! 💪*