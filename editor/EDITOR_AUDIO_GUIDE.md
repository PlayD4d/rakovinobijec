# 🎵 Editor Audio System Guide

## Nový zvukový systém (PR7 kompatibilní)

### Co se změnilo:
- **ODSTRANĚN** audio_manifest.json5 - už neexistuje
- **ODSTRANĚN** AudioLoader.js - už neexistuje  
- **NOVÝ** přístup - přímé cesty k souborům v blueprintech

### Jak to funguje:

#### V blueprintech používáme přímé cesty:
```json5
{
  "sfx": {
    "spawn": "sound/npc_spawn.mp3",    // Přímá cesta k souboru
    "hit": "sound/npc_hit.mp3",        // Přímá cesta k souboru
    "death": "sound/npc_death.mp3"     // Přímá cesta k souboru
  }
}
```

#### Pro hudbu v levelech (spawn tables):
```json5
{
  "music": {
    "ambient": "music/level_1.mp3",    // Hudba na pozadí
    "combat": "music/level_1.mp3",     // Bojová hudba
    "boss": "music/boss.mp3"           // Boss hudba
  }
}
```

### Editor podporuje:

1. **AudioScanner** - skenuje dostupné soubory
   - Automaticky najde všechny .mp3 soubory v sound/ a music/
   - Vytvoří seznam pro výběr v editoru

2. **AudioBrowser** - dialog pro výběr zvuků
   - Zobrazí všechny dostupné zvuky
   - Umožní preview (náhled)
   - Vrátí přímou cestu k souboru

3. **PropertyEditor** - editace sfx polí
   - Typ pole: `sfx-selector` nebo `audio-path`
   - Ukládá přímou cestu k souboru
   - Podporuje browse dialog

### Dostupné zvukové soubory:

#### Hudba (music/):
- level_1.mp3
- level_2.mp3
- level_3.mp3
- boss.mp3

#### Zvuky (sound/):
- **Hráč**: player_hit.mp3, player_death.mp3, player_spawn.mp3, player_shoot.mp3
- **Nepřátelé**: npc_spawn.mp3, npc_hit.mp3, npc_death.mp3
- **Boss**: boss_enter.mp3, boss_hit.mp3, boss_death.mp3, boss_phase.mp3
- **Efekty**: explosion_small.mp3, explosion_large.mp3, decay.mp3
- **Zbraně**: laser.mp3, flamethrower.mp3, radiotherapy.mp3, machinegun.mp3
- **UI**: pickup.mp3, powerup.mp3, levelup.mp3, heal.mp3

### Jak přidat nový zvuk:

1. Umístit .mp3 soubor do sound/ nebo music/
2. Přidat ho do AudioScanner.js seznamu
3. Použít přímou cestu v blueprintu

### Příklad použití v editoru:

```javascript
// Při ukládání blueprintu
blueprint.sfx = {
  spawn: "sound/enemy_spawn.mp3",  // Přímá cesta
  hit: "sound/enemy_hit.mp3",      // Přímá cesta
  death: "sound/enemy_death.mp3"   // Přímá cesta
};
```

### PR7 principy:
✅ 100% data-driven - vše v blueprintech
✅ Žádné manifesty - přímé cesty
✅ Jednoduchý systém - bez složitých mapování
✅ Editor friendly - browse dialog pro výběr