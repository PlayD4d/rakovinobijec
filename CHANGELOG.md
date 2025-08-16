# Changelog

Všechny významné změny v projektu Rakovinobijec jsou dokumentovány v tomto souboru.

Formát založen na [Keep a Changelog](https://keepachangelog.com/cs/1.0.0/)

## [0.4.1] - 2025-08-16

### Přidáno
- XP Magnet power-up do registry (chyběl ve výběru při level-upu)
- Centralizovaná konfigurace hudby pro různé scény v main_config.json5
- Podpora pro přímé cesty k audio souborům v blueprintech (PR7 kompatibilita)

### Změněno
- Všechny konfigurační hodnoty přesunuty z kódu do main_config.json5
- ConfigResolver nyní obsahuje pouze minimální kritické fallbacky
- Blueprint schema aktualizováno pro PR7 audio systém
- Data audit script aktualizován pro novou strukturu složek
- README.md kompletně přepsán s věnováním a lepší strukturou

### Opraveno
- VFX sekce v editoru již nezobrazuje audio ovládací prvky
- Validátory nyní správně akceptují přímé cesty k audio souborům
- Smoke testy aktualizovány pro novou strukturu konfigurace

### Odstraněno
- Hardcoded fallback hodnoty z ConfigResolver (140+ hodnot)
- Legacy Enemy a Boss definitions z main_config.json5
- Zastaralá audio migrační dokumentace

## [0.4.0] - 2025-08-15

### Přidáno
- Kompletní PR7 architektura - 100% data-driven design
- BlueprintLoader pro načítání všech entit z JSON5
- SpawnDirector pro řízení vln nepřátel
- ConfigResolver pro centralizovanou konfiguraci
- Enhanced data audit script s validací schémat

### Změněno
- Všechny entity převedeny na blueprint systém
- Audio systém refaktorován na přímé cesty k souborům
- Power-up systém kompletně přepsán (PowerUpSystemV2)

## [0.3.1] - 2025-08-13

### 🐛 Bug Fixes & Database Improvements

Opravy kritických chyb v loot systému, analytice a databázové struktuře.

#### Fixed
- **Loot System**: Opraveno volání správné metody `getDropsForEnemy` místo neexistující `tryDropFor`
- **XP Drops**: XP se nyní správně čte z blueprintů (`enemy.xp`, `enemy.data.xp`, `enemy.stats.xp`)
- **PowerUpSystem**: Přidána podpora pro chybějící `piercing_arrows` effect type
- **AnalyticsSystem**: Upraveno pro silent mode když chybí AnalyticsManager
- **HOTFIX V3 Removal**: Odstraněny všechny fallback mechanismy, vše nyní čte z blueprintů

#### Added  
- **Database Schema**: Kompletní schéma s `duration_seconds` jako GENERATED column
- **High Scores Table**: Přidána tabulka `high_scores` z původního `supabase_setup.sql`
- **Loot Drop Methods**: Nové metody `spawnLootDrop`, `spawnHealthPickup`, `spawnMetotrexatPickup`
- **Foreign Keys**: Všechny tabulky mají správné foreign key constraints s ON DELETE CASCADE

#### Database
- Vytvořen `schema_complete.sql` s kompletní databázovou strukturou
- Přidány všechny chybějící sloupce a aliasy pro kompatibilitu
- GENERATED column `duration_seconds` automaticky počítá délku hry
- Správné indexy s `IF NOT EXISTS` pro všechny tabulky

## [0.3.0] - 2025-08-12

### 🏗️ PR7 Architecture Compliance & System Refactoring

Kompletní refaktoring pro dosažení 100% PR7 (Pure Data-Driven) kompatibility.

#### Added
- **BlueprintLoader**: Centralizovaný systém načítání všech dat z /data/blueprints/
- **Registry Index System**: Automatické generování indexu všech blueprintů
- **Wrapper Systems**: InputSystem a CameraSystem pro abstrakci Phaser API
- **ConfigResolver.initialize()**: Asynchronní načítání externích konfigurací
- **AudioLoader**: Manifest systém pro zvukové soubory (JSON5)
- **Smoke Test Framework**: Automatické testování herních mechanik

#### Changed
- **AudioManager**: Přechod z přímých Phaser API volání na SFXSystem
- **LootSystemBootstrap**: Načítání z BlueprintLoader místo vlastních blueprintů
- **Spawn Table Format**: Jednotný formát `spawnTable.XXX` pro všechny spawn tabulky
- **Blueprint IDs**: Konzistentní pojmenování všech entit (enemy., boss., drop., atd.)
- **ConfigResolver**: Přesun na statickou třídu s hierarchickým fallbackem
- **Main.js**: Opraveno pořadí inicializace (ConfigResolver před Phaser)

#### Fixed
- AudioManager ReferenceError (duplicitní deklarace const CR)
- ConfigResolver timing v AudioLoader
- Drop blueprint validace (přidána povinná sekce stats)
- LootTable validace (přidána povinná sekce stats)
- SpawnDirector kompatibilita s novým formátem spawn tabulek
- Registry index duplicity

#### Technical Debt Resolved
- ✅ Odstraněna všechna přímá Phaser API volání
- ✅ 100% data-driven konfigurace
- ✅ Jednotný formát blueprintů
- ✅ Centralizované načítání dat
- ✅ Kompletní PR7 compliance

## [0.2.0] - 2025-08-12

### 🎯 Major Balance & Data Consolidation Release

This release represents a comprehensive game balance overhaul, data system consolidation, and preparation for 30-minute gameplay sessions.

#### Added

##### ⚖️ Balance System
- **TTK (Time-to-Kill) Optimization**: Perfect tuning for 30-minute sessions
  - Level 1: 2500ms target TTK ✅
  - Level 2: 2000ms target TTK ✅ 
  - Level 3: 1500ms target TTK ✅
- **Balance Smoke Test**: Automated validation script (`scripts/balance-smoke.mjs`)
- **Balance Playbook**: Comprehensive 30-minute gameplay balance framework
- **Wave Pacing Analysis**: Optimized enemy spawn intervals and intensity curves

##### 🎲 Pity System
- **Anti-Frustration Mechanics**: Guarantees drops after dry spells
  - XP drought protection (max 8 kills without XP)
  - Health emergency system (guaranteed health at <50% HP)
  - Power-up stagnation prevention (guaranteed after 80-120 kills)
  - Elite spawn guarantee (max 3 minutes without elite)
  - Unique encounter insurance (3-5 minute guarantees)
  - Special drop guarantee (Metotrexat after 200 kills)

##### 🔄 NG+ (New Game Plus) System
- **Infinite Replayability**: 5+ tier progression system
  - Tier 0: Base game (1.0× multipliers)
  - Tier 1: Veteran (+25% challenge, +10% rewards)
  - Tier 2: Expert (+60% challenge, +25% rewards)  
  - Tier 3: Master (+100% challenge, +50% rewards)
  - Tier 4+: Infinite scaling with smart caps
- **Advanced Features**: Dual/triple boss encounters, elite variants, chaos waves
- **ConfigResolver Integration**: Hierarchical difficulty scaling

##### 📊 Data Consolidation
- **JSON5 Blueprint System**: All entities now use unified blueprint schema
- **Schema Validation**: JSON Schema Draft 07 with comprehensive validation
- **Data Audit System**: 100% validation guarantee with exit codes
- **Registry Generation**: Automated entity indexing and validation

##### 🌍 Internationalization
- **Complete I18n System**: Full Czech/English translations (72 keys)
- **TODO Workflow**: Placeholder system for missing translations
- **Medical Terminology**: Contextually appropriate cancer treatment themes

##### 🛠️ Infrastructure
- **CI/CD Pipeline**: Automated data validation on PRs
- **Pre-commit Hooks**: Quality assurance before commits
- **Enhanced Audit Script**: Comprehensive reporting with markdown output

#### Fixed

##### 🔧 Orphaned References
- **enemy.viral_swarm**: Created missing base enemy blueprint (12 HP, 4 DMG)
- **enemy.necrotic_cell**: Created missing base enemy blueprint (45 HP, 8 DMG)
- **Reference Validation**: Achieved 0 orphaned references in audit

##### 📝 Translation Completeness
- **104 TODO Translations**: Replaced with proper Czech/English text
- **Medical Accuracy**: Improved terminology consistency
- **Coverage**: Achieved 100% translation coverage

#### Changed

##### 📁 File Structure Reorganization
```
data/
├── blueprints/           # JSON5 entity definitions
│   ├── boss/            # Boss enemies
│   ├── enemy/           # Base enemies  
│   ├── unique/          # Named unique enemies
│   ├── powerup/         # Player upgrades
│   ├── drop/            # Collectible items
│   ├── projectile/      # Weapons & bullets
│   ├── lootTable/       # Drop probability tables
│   ├── spawn/           # Level spawn configurations
│   └── system/          # Game systems (pity, NG+)
├── schemas/             # JSON validation schemas
├── registries/          # Auto-generated entity indexes
└── i18n/               # Translation files
```

##### 📚 New Documentation
- **Balance Playbook**: Complete 30-minute gameplay balance guide
- **Entity Catalog**: Updated implementation status and features
- **Data Folder Guide**: Blueprint structure and naming conventions  
- **I18n Conventions**: Translation workflow and best practices

#### Technical

##### 🎮 Gameplay Optimization
- **Spawn Rate Tuning**: Smooth difficulty progression curves
- **Loot Distribution**: Balanced reward pacing for engagement
- **TTK Consistency**: Eliminated frustrating difficulty spikes
- **Validation Pipeline**: JSON Schema with automated CI/CD checks

##### 🔒 Data Integrity
- **Schema Enforcement**: Prevents invalid blueprint data
- **Type Safety**: JSON5 with strict validation rules
- **Audit Trail**: Comprehensive validation reporting

## [0.1.3] - 2025-01-10

### Added
- 📊 Performance snapshots: 1× za minutu + souhrn na konci session (fps, memory, supabase, API latence)
- 👑 Boss analytics: `player_hp_start`, `damage_taken_from_boss`, `special_attacks_used`, `death_phase`

### Changed
- ⚖️ Boss balance: zvýšené HP prvních bossů; Onkogen doplněn o salvu; Karcinogenní král zjemněn
- 🧲 XP Magnet: izotropní přitahování orbů (odstraněn vertikální float tween)
- 🏆 High score: centralizovaný submit, fix duplicit, async check TOP10
- 📝 Popisky power‑upů sladěny se skutečnou funkcí (štít, aura, exploze, blesk)

### Fixed
- 🎯 `game_sessions`: doplněny `death_cause`/pozice; sanitizace `player_name`
- 📊 `enemy_stats`: `spawn_count`, `damage_dealt_to_player`, `damage_taken_from_player`, `player_deaths_caused`, korektní `killed_count`
- 💀 `death_events`: `player_hp_before`, kompletní `active_power_ups`, spolehlivé `was_boss_fight`
- 👑 `death_events.killer_type`: boss kontakty i střely ve formátu `boss:<jméno>`

## [0.1.2] - 2025-01-09

### Added
- 📊 **Kompletní analytics systém** - pokročilý sběr herních dat
- 🗄️ **Supabase backend integrace** - skutečná cloudová databáze
- 📈 **7 analytických tabulek** - sessions, enemy_stats, powerup_events, death_events, boss_encounters, performance_metrics, daily_stats
- 🔬 **AnalyticsManager** - automatický tracking všech herních událostí
- 📋 **TODO.md** - plány a nápady pro budoucí verze
- 🔒 **.gitignore** - správná organizace projektu
- 📊 **Výkonnostní metriky** - FPS tracking a optimalizace
- 🧪 **Analytics test page** - nástroj pro testování sběru dat

### Changed
- 🎨 **High score vizuální vylepšení** - TOP 3 odděleno mezerou, zlatá/stříbrná/bronzová barvy
- ⚖️ **Elite mob balance** - damage multiplier snížen z 2.0 na 1.4
- 🔄 **Zjednodušení kódu** - odstraněny mock funkce, čistší architektura
- 📊 **Rozšířené game stats** - tracking damage dealt/taken, XP, pickups

### Fixed
- 🌐 **Globální high scores** - nyní se správně ukládají do Supabase
- 🎨 **Barvy TOP 3** - opravena logika zobrazení zlaté/stříbrné/bronzové
- 📊 **SQL kompatibilita** - 'time' změněno na 'play_time', opraveny index syntaxy
- 🔧 **Analytics timestamp** - opravena chyba s timestamp sloupcem

### Technical
- Row Level Security (RLS) policies pro databázovou bezpečnost
- Batch upload systém pro optimální výkon
- Foreign key constraints a indexy pro rychlé dotazy
- GDPR-compliant data collection
- Fallback na LocalStorage pro offline režim

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