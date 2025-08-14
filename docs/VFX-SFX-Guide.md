# VFX/SFX System Guide - Phase 5/6

## Jak přidat nový efekt nebo zvuk

### 1. Přidání VFX efektu

```javascript
// 1. Registruj v VFXRegistry.js
this.register('vfx.my.new.effect', {
  type: 'particles',
  texture: 'spark',
  description: 'Můj nový efekt',
  config: {
    scale: { start: 0.5, end: 0.0 },
    speed: { min: 100, max: 200 },
    lifespan: 300,
    quantity: 10,
    blendMode: 'ADD',
    tint: 0xFF4444
  }
});

// 2. Použij v blueprintu
vfx: {
  hit: 'vfx.my.new.effect'
}

// 3. Přehraj v kódu
this.scene.newVFXSystem.play('vfx.my.new.effect', x, y);
```

### 2. Přidání SFX zvuku

```javascript
// 1. Registruj v SFXRegistry.js
this.register('sfx.my.new.sound', {
  key: 'audio_key_name',
  volume: 0.8,
  detuneRange: [-100, 100],
  description: 'Můj nový zvuk',
  category: 'combat'
});

// 2. Použij v blueprintu
sfx: {
  hit: 'sfx.my.new.sound'
}

// 3. Přehraj v kódu
this.scene.newSFXSystem.play('sfx.my.new.sound');
```

## Blueprint VFX/SFX Best Practices

### Konvence pojmenování
- VFX: `vfx.kategorie.typ.varianta` (např. `vfx.hit.spark`, `vfx.explosion.large`)
- SFX: `sfx.kategorie.typ` (např. `sfx.player.hit`, `sfx.weapon.laser1`)

### Kategorie
**VFX:**
- `hit.*` - zásahy a dopady
- `explosion.*` - exploze
- `spawn.*` - spawn efekty
- `death.*` - death efekty  
- `pickup.*` - pickup efekty
- `flash.*` - flash efekty
- `trail.*` - trail efekty

**SFX:**
- `player.*` - hráč
- `npc.*` - nepřátelé
- `boss.*` - bosové
- `weapon.*` - zbraně
- `pickup.*` - pickupy
- `explosion.*` - exploze

### Blueprint struktura
```javascript
export default {
  id: 'entity.name',
  type: 'enemy|boss|player|powerup|drop|projectile',
  
  vfx: {
    spawn: 'vfx.spawn.enemy',
    hit: 'vfx.hit.spark',
    death: 'vfx.death.burst.red',
    // nebo s parametry:
    special: {
      id: 'vfx.explosion.large',
      scale: 1.5,
      tint: 0xFF00FF
    }
  },
  
  sfx: {
    spawn: 'sfx.npc.spawn',
    hit: 'sfx.npc.hit',
    death: 'sfx.npc.death'
  }
};
```

## Performance Guidelines

### VFX Optimalizace
- **Low mode**: max 50 částic, 5 emitterů, bez trails
- **Medium mode**: max 200 částic, 10 emitterů, s trails
- **High mode**: max 500 částic, 20 emitterů, plné efekty

### SFX Optimalizace  
- **Low mode**: max 5 současných zvuků, bez detailů
- **Medium mode**: max 10 současných zvuků, standardní kvalita
- **High mode**: max 20 současných zvuků, plná kvalita

### Safety Caps
- VFX: automatické zastavení nejstarších emitterů při překročení limitu
- SFX: automatické ukončení nejméně důležitých zvuků (priorita: ui < pickup < combat < boss < player)
- Flash safety: min 100ms mezi flash efekty

## Debug Console API

```javascript
// VFX debug
__phase5Debug.vfx.stats()           // System statistiky
__phase5Debug.vfx.test()            // Test všech efektů
__phase5Debug.vfx.play(id, x, y)    // Přehrát efekt
__phase5Debug.vfx.performance(mode) // Nastavit performance mód

// SFX debug
__phase5Debug.sfx.stats()           // System statistiky  
__phase5Debug.sfx.test()            // Test všech zvuků
__phase5Debug.sfx.profile(name)     // Aplikovat hlasitostní profil
__phase5Debug.sfx.performance(mode) // Nastavit performance mód

// Settings
__phase5Debug.settings.info()       // Zobrazit nastavení
__phase5Debug.settings.reset()      // Reset na výchozí
__phase5Debug.settings.audio(cat, vol) // Nastavit hlasitost
```

## Accessibility Features

### Photo-sensitive Safety
- Automatické omezení flash efektů (min 100ms interval)
- Nastavitelná intenzita camera shake (0.0 - 1.0)
- Reduced motion mode pro accessibility

### Audio
- 6 hlasitostních profilů: silent, quiet, normal, intense, combat, cinematic
- Per-kategorie volume control
- Prioritní řazení zvuků při polyphony limitu

## Troubleshooting

### VFX efekt se nezobrazuje
1. Zkontroluj, zda je efekt registrován v VFXRegistry
2. Ověř, zda existuje textura (nebo fallback texture)
3. Zkontroluj performance limity (caps)

### SFX zvuk se nepřehrává
1. Zkontroluj, zda je zvuk registrován v SFXRegistry  
2. Ověř, zda je audio klíč načten v Phaser cache
3. Zkontroluj voice polyphony limity
4. Ověř cooldown (min 30ms mezi stejnými zvuky)

### Performance problémy
1. Zkontroluj aktivní emittery: `__phase5Debug.vfx.stats()`
2. Zkontroluj aktivní zvuky: `__phase5Debug.sfx.stats()`  
3. Sniž performance mode: `low` místo `medium/high`
4. Aplikuj caps: `vfxSystem.setMaxEmitters(10)`