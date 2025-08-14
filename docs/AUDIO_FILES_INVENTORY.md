# Přehled zvukových souborů - Rakovinobijec

## Stav: 8.1.2025

### ✅ EXISTUJÍCÍ SOUBORY (26 souborů)

#### Hudba (music/) - 4 soubory
- ✅ `music/boss.mp3` - Hudba při souboji s bossem
- ✅ `music/level_1.mp3` - Hudba pro level 1
- ✅ `music/level_2.mp3` - Hudba pro level 2  
- ✅ `music/level_3.mp3` - Hudba pro level 3

#### Zvukové efekty (sound/) - 22 souborů
**Hráč:**
- ✅ `sound/player_hit.mp3` - Zásah hráče (používá se i jako 'hit')
- ✅ `sound/player_death.mp3` - Smrt hráče
- ✅ `sound/levelup.mp3` - Zvuk při zvýšení úrovně
- ✅ `sound/heal.mp3` - Zvuk při léčení

**Zbraně a útoky:**
- ✅ `sound/shoot.mp3` - Základní střelba
- ✅ `sound/laser.mp3` - Laserová střelba
- ✅ `sound/lightning.mp3` - Bleskový útok
- ✅ `sound/projectile_hit.mp3` - Zásah projektilu

**Nepřátelé:**
- ✅ `sound/npc_death_1.mp3` - Smrt nepřítele (varianta 1)
- ✅ `sound/npc_death_2.mp3` - Smrt nepřítele (varianta 2)
- ✅ `sound/elite_death.mp3` - Smrt elitního nepřítele

**Boss:**
- ✅ `sound/boss_enter.mp3` - Příchod bosse
- ✅ `sound/boss_hit.mp3` - Zásah bosse
- ✅ `sound/boss_death.mp3` - Smrt bosse

**Pickupy a power-upy:**
- ✅ `sound/pickup.mp3` - Sebrání předmětu
- ✅ `sound/powerup.mp3` - Aktivace vylepšení
- ✅ `sound/metotrexat.mp3` - Speciální power-up Metotrexat

**UI a systém:**
- ✅ `sound/intro.mp3` - Intro zvuk
- ✅ `sound/ready_fight.mp3` - "Ready? Fight!" zvuk
- ✅ `sound/game_over.mp3` - Konec hry
- ✅ `sound/bleep.mp3` - UI kliknutí/navigace
- ✅ `sound/chime.mp3` - Notifikační zvuk

---

### ❌ CHYBĚJÍCÍ SOUBORY (15 souborů)
*Tyto soubory jsou definované v audio_manifest.json5 ale neexistují na disku:*

**Nepřátelé - rozšířené:**
- ❌ `sound/decay.mp3` - Efekt rozkladu/hniloby
- ❌ `sound/npc_spawn.mp3` - Spawn nepřítele
- ❌ `sound/npc_hit.mp3` - Zásah nepřítele (obecný)
- ❌ `sound/npc_death.mp3` - Smrt nepřítele (obecná)

**Exploze:**
- ❌ `sound/explosion_small.mp3` - Malá exploze
- ❌ `sound/explosion_large.mp3` - Velká exploze

**Zbraně - rozšířené:**
- ❌ `sound/laser1.mp3` - Laser varianta 1
- ❌ `sound/laser2.mp3` - Laser varianta 2
- ❌ `sound/machinegun.mp3` - Kulomet

**Boss - rozšířené:**
- ❌ `sound/boss_phase.mp3` - Změna fáze bosse

**Hráč - rozšířené:**
- ❌ `sound/player_spawn.mp3` - Spawn hráče
- ❌ `sound/player_shoot.mp3` - Střelba hráče (alternativa)

**Hit varianty:**
- ❌ `sound/hit_soft.mp3` - Slabý zásah
- ❌ `sound/hit_hard.mp3` - Silný zásah
- ❌ `sound/hit_critical.mp3` - Kritický zásah

---

### 📊 STATISTIKA
- **Celkem definováno:** 42 zvukových souborů
- **Existuje:** 26 souborů (62%)
- **Chybí:** 15 souborů (36%)
- **Duplikáty:** 1 (`player_hit.mp3` používáno jako 'hit' i 'playerHit')

---

### 🔧 DOPORUČENÍ

1. **Prioritní k doplnění** (používané v základní hratelnosti):
   - `sound/npc_hit.mp3` - často používané při zásahu nepřátel
   - `sound/npc_spawn.mp3` - při spawnu každého nepřítele
   - `sound/explosion_small.mp3` - běžné exploze

2. **Sekundární** (rozšiřující zvuky):
   - Hit varianty (soft, hard, critical) - pro lepší feedback
   - Laser varianty - pro různé typy zbraní
   - Boss phase - pro dramatičtější boss souboje

3. **Možné zástupné řešení:**
   - Použít existující zvuky jako zálohu (např. `shoot.mp3` pro `player_shoot.mp3`)
   - Vytvořit varianty existujících zvuků (pitch shift, reverb)

---

### 📝 POUŽITÍ V KÓDU

Zvuky se používají přes **SFXSystem** a **SFXRegistry**:
```javascript
// Přehrání zvuku
this.sfxSystem.play('npc_death_1');

// Přehrání s parametry
this.sfxSystem.play('explosion_small', { 
    volume: 0.5, 
    detune: Math.random() * 200 - 100 
});
```

Všechny cesty jsou relativní k root adresáři hry.