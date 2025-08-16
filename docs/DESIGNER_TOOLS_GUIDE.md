# 🎮 Designer Tools & Development Guide

> **Kompletní průvodce všemi nástroji pro vývoj a testování obsahu**

---

## 🚀 Quick Start

### 1. Spuštění vývojového prostředí
```bash
npm run dev
```
Otevřít: http://localhost:8000

### 2. Dev Mode indikátor
V konzoli uvidíte:
```
🔧 DEV MODE ENABLED
[F3] Debug Overlay | [F6] Missing Assets | [F7] Boss Playground | [F8] SFX Soundboard | [F9] Soft Refresh
```

---

## ⌨️ Klávesové zkratky (Dev Tools)

| Klávesa | Nástroj | Popis |
|---------|---------|-------|
| **F3** | Debug Overlay | Real-time statistiky (FPS, enemies, projektily) |
| **F4** | Smoke Test | Automatický test všech systémů |
| **F5** | Browser Refresh | Plný reload stránky |
| **F6** | Missing Assets | Seznam chybějících VFX/SFX |
| **F7** | Boss Playground | Testovací aréna pro bosse |
| **F8** | SFX Soundboard | Přehrávač všech zvuků |
| **F9** | Soft Refresh | Hot-reload dat bez reloadu |
| **ESC** | Pause Menu | Pauza hry |

---

## 🛠️ Development Tools

### 📊 F3 - Debug Overlay
**Real-time statistiky a performance monitoring**

**Zobrazuje:**
- FPS a performance metriky
- Počet nepřátel a projektilů
- Aktivní systémy (VFX, SFX, Spawn, Loot)
- Memory usage
- Missing assets souhrn

**Použití:**
- Stiskněte **F3** pro zapnutí/vypnutí
- Automaticky se ukládá stav do localStorage

---

### 🔍 F6 - Missing Assets Panel
**Tracking chybějících souborů**

**Funkce:**
- Seznam všech chybějících SFX/VFX
- Červené zvýraznění neexistujících assetů
- Console commands pro export

**Console příkazy:**
```javascript
DEV.dumpMissing()      // Vypsat všechny chybějící
DEV.copyMissing("all") // Zkopírovat do schránky
DEV.clearMissing()     // Vymazat tracking
```

---

### 🎯 F7 - Boss Playground
**Izolovaná testovací aréna pro bosse**

**Funkce:**
- Dropdown všech boss blueprintů
- Nastavení fáze (1-10)
- Control buttons:
  - **SPAWN** - vytvoří bosse
  - **KILL** - zabije bosse
  - **PHASE+** - další fáze
  - **RESTART** - reset arény
  - **AUTO-CYCLE** - automatické spouštění schopností

**Klávesy v aréně:**
- **1-9** - rychlý spawn bosse podle indexu
- **K** - zabít bosse
- **N** - další fáze
- **R** - restart
- **SPACE** - toggle auto-cycle
- **ESC** - návrat do hry

**Testovací hráč:**
- 1000 HP
- Přesouvatelný myší (drag & drop)
- Zelená barva pro rozlišení

---

### 🔊 F8 - SFX Soundboard
**Testování všech zvukových efektů**

**Funkce:**
- **Live search** - filtrování při psaní
- **Barevné kódování:**
  - Bílá = zvuk existuje
  - Červená = chybí audio soubor
- **Info panel** - detaily o zvuku
- **Přehrávání** - klik na ▶ nebo Enter

**Zobrazuje:**
- ID zvuku
- Cesta k souboru
- Hlasitost a kategorie
- Detune range
- Loop status

---

### 🔄 F9 - Soft Refresh
**Hot-reload JSON5 dat bez reloadu stránky**

**Co se refreshuje:**
- Všechny blueprinty (enemy, boss, powerup, drop)
- Spawn tabulky
- Loot tabulky
- VFX/SFX registry

**Diff report:**
```
✨ Added (2) - nové položky
📝 Modified (5) - změněné položky
🗑️ Removed (0) - odstraněné položky
```

**Workflow:**
1. Upravit JSON5 soubor
2. Uložit
3. Stisknout F9
4. Změny se okamžitě projeví

---

## 💻 Console Commands (F3 otevře konzoli)

### Spawn příkazy
```javascript
// Spawn enemy
DEV.spawnEnemy("enemy.necrotic_cell")
DEV.spawnEnemy("enemy.metastasis_runner", x, y)

// Spawn boss
DEV.spawnBoss("boss.karcinogenic_king")

// Spawn powerup/drop
DEV.spawnDrop("drop.xp_small")
DEV.spawnDrop("powerup.damage_boost")

// Spawn wave
DEV.spawnWave(10) // 10 nepřátel
```

### Test příkazy
```javascript
// Test loot table (100x)
DEV.testLootTable("lootTable.boss.tier1", 100)

// Give player XP
DEV.giveXP(1000)

// Set player health
DEV.setHealth(100)
DEV.setMaxHealth(200)

// God mode
DEV.godMode() // Toggle nesmrtelnost

// Kill all enemies
DEV.killAll()

// Clear screen
DEV.clearEnemies()
DEV.clearProjectiles()
```

### Info příkazy
```javascript
// System info
__framework.healthcheck()     // Stav všech systémů
__framework.scenario.info()   // Info o aktuální vlně
__framework.getCounters()     // Statistiky

// Quick check
__framework.quickCheck()       // Rychlá kontrola systémů

// Smoke test
__framework.smokeTest()        // Kompletní test
```

### Analytics
```javascript
// Telemetry
__framework.getTelemetry()    // Telemetry data

// Missing assets
DEV.dumpMissing()             // Vypsat chybějící
DEV.copyMissing("sfx")        // Kopírovat SFX
DEV.copyMissing("vfx")        // Kopírovat VFX
```

---

## 📁 Blueprint Templates & Snippets

### VS Code Snippets
Napsáním zkratky a stisknutím **Tab** vygenerujete šablonu:

| Snippet | Trigger | Popis |
|---------|---------|-------|
| Boss | `bossBlueprint` | Kompletní boss s fázemi |
| PowerUp | `powerupBlueprint` | PowerUp s progression |
| Enemy | `enemyBlueprint` | Základní nepřítel |
| SFX | `sfxEntry` | Zvukový efekt |
| VFX | `vfxEntry` | Vizuální efekt |
| Ability | `ability` | Schopnost |
| Phase | `bossPhase` | Boss fáze |
| Loot | `lootTable` | Loot tabulka |

### Šablony
Připravené šablony v `/data/blueprints/templates/`:
- `boss.json5` - Kompletní boss se všemi možnostmi
- `powerup.json5` - PowerUp s level progression
- `README.md` - Návod pro blueprinty

---

## 🎨 Workflow pro Design

### 1. Přidání nového nepřítele
```bash
# 1. Vytvořit blueprint
cp data/blueprints/templates/enemy.json5 data/blueprints/enemy/enemy.novy.json5

# 2. Upravit hodnoty (HP, damage, rychlost)
# 3. F9 pro hot-reload
# 4. DEV.spawnEnemy("enemy.novy") pro test
```

### 2. Úprava bosse
```bash
# 1. Otevřít boss blueprint
# 2. Změnit fáze, schopnosti, stats
# 3. F9 pro reload
# 4. F7 → Boss Playground pro test
```

### 3. Test zvuků
```bash
# 1. F8 otevře Soundboard
# 2. Napsat část názvu (např. "boss")
# 3. Kliknout ▶ pro přehrání
# 4. Červené = chybí soubor
```

### 4. Balance testing
```javascript
// Spawn specific wave
DEV.spawnWave(20)

// Test drop rates
DEV.testLootTable("lootTable.rare", 1000)

// Speed up game
game.time.timeScale = 2.0  // 2x rychlost

// Slow motion
game.time.timeScale = 0.5  // 0.5x rychlost
```

---

## 📊 Data Validation

### Před commitem vždy spustit:
```bash
# Validace všech blueprintů
npm run audit:data:strict

# Report chyb
npm run audit:report

# Smoke test
npm run smoke:test

# Kompletní verifikace
npm run verify:all
```

---

## 🐛 Troubleshooting

### "Blueprint not found"
```javascript
// Zkontrolovat v konzoli
__framework.healthcheck()
// Podívat se na "blueprintRefs"
```

### "Missing texture/audio"
```javascript
// F6 pro Missing Assets panel
// nebo v konzoli:
DEV.dumpMissing()
```

### "Enemy se nespawnuje"
```javascript
// Test přímý spawn
DEV.spawnEnemy("enemy.id", 400, 300)

// Check blueprint
__framework.systems.spawn
```

### "Boss nefunguje správně"
```javascript
// F7 → Boss Playground
// Izolovaný test bez rušení
```

---

## 🎮 Pro Tips

### 1. **Rychlé iterace**
- Používejte **F9 Soft Refresh** místo F5
- Neztrácíte game state
- Okamžité vidění změn

### 2. **Blueprint snippets**
- VS Code: napište `bossBlueprint` → Tab
- Vygeneruje kompletní strukturu
- Tab skáče mezi placeholdery

### 3. **Console je váš přítel**
- F3 otevře konzoli
- `DEV.` napovídá všechny příkazy
- `__framework.` pro systémové info

### 4. **Test v izolaci**
- F7 Boss Playground pro bosse
- F8 Soundboard pro zvuky
- Žádné rušení z běžící hry

### 5. **Verzování**
- Commitujte funkční blueprinty
- Používejte `npm run audit:data:strict` před commitem
- Pište smysluplné commit messages

---

## 📞 Další dokumentace

- [`Dev_Guidelines.md`](../Dev_Guidelines.md) - PR7 pravidla
- [`DataFolderGuide.md`](./DataFolderGuide.md) - Struktura dat
- [`Blueprint Templates README`](../data/blueprints/templates/README.md) - Návod pro blueprinty
- [`VFX-SFX-Guide.md`](./VFX-SFX-Guide.md) - Efekty a zvuky
- [`BalancePlaybook.md`](./BalancePlaybook.md) - Balance guide

---

## 🚨 Důležité poznámky

1. **Dev nástroje fungují pouze v DEV módu** (`npm run dev`)
2. **Některé změny vyžadují reload** (nové textury, audio soubory)
3. **Console příkazy jsou case-sensitive**
4. **Blueprinty musí mít unikátní ID**
5. **Vždy validujte data před commitem**

---

## 📝 Changelog nástrojů

- **F3** - Debug Overlay s performance metrikami
- **F6** - Missing Assets tracking
- **F7** - Boss Playground pro testování
- **F8** - SFX Soundboard
- **F9** - Soft Refresh hot-reload
- **Console API** - DEV.* a __framework.* příkazy
- **VS Code Snippets** - Rychlé generování blueprintů
- **Templates** - Připravené šablony

---

*Vytvořeno pro Rakovinobijec v0.3.1 | Poslední aktualizace: 2024*