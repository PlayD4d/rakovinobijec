# VFX & Particle Design Guide — Rakovinobijec

## Core Principles

### 1. Readability First
- VFX must **communicate information**, not just look cool
- Player should understand what an effect means within 100ms
- Clear visual hierarchy: gameplay-critical VFX > cosmetic VFX > background ambiance

### 2. Additive vs Alpha Blending
- **Additive (ADD)**: Fire, energy, sparks, explosions, magic — glows bright, overlapping = brighter
- **Alpha**: Smoke, shadows, fog, telegraph warnings — overlapping = darker/opaque
- Phaser: `blendMode: 'ADD'` for glowing effects, default alpha for everything else
- **Performance**: Blend mode changes cause WebGL batch flush — group same-blend effects together

### 3. Color Semantics
| Effect Type | Color | Blend | Example |
|-------------|-------|-------|---------|
| Player attack | White/Cyan | ADD | Projectile trail, hit spark |
| Player heal | Green | ADD | Health pickup, heal effect |
| Enemy damage | Red/Orange | ADD | Hit feedback, death burst |
| Enemy projectile | Red/Pink | ADD | Must contrast with player blue |
| Warning/Telegraph | Red/Yellow | Alpha | Area indicator, charge-up |
| Shield | Cyan/Blue | ADD | Shield hit, regen pulse |
| Chain Lightning | Blue/White | ADD | Bolt line, impact spark |
| Explosion | Orange/Yellow | ADD | Shockwave ring, particles |
| Poison/Toxic | Green | Alpha | Toxic cloud, DoT indicator |

### 4. Particle Design Rules
- **Lifespan**: 200-500ms for impacts, 500-1000ms for explosions, 1000-2000ms for ambient
- **Scale**: Start big → shrink to 0 (death burst), or start small → grow (spawn)
- **Alpha**: Always fade out at end of life — never pop-disappear
- **Quantity**: 5-10 for hits, 15-25 for deaths, 30-40 for explosions
- **Speed**: Fast (150-300) for impacts, slow (50-100) for ambient
- **Max concurrent emitters**: 24 (our limit) — prevents performance degradation

### 5. Telegraph/Warning Design
- Use **filled semi-transparent circles** showing exact damage area
- **Alpha 0.6→0 fade** over warning duration (not pulsing — too visually noisy)
- Color matches the attack type (red for damage, green for toxic, yellow for explosion)
- Max **8 concurrent** telegraphs to prevent overload
- Use **Sprite with generateTexture** (not per-call Graphics) — Phaser best practice
- Cleanup on source death (boss/enemy) via tracked array

## Projectile Design

### Player Projectiles
- **Color**: White/Bright cyan — high contrast against dark background
- **Shape**: Small elongated sprite (3-4px) with slight stretch in movement direction
- **Trail**: Optional particle trail for powered-up versions
- **Hitbox**: Slightly smaller than visual sprite (fair dodging)

### Enemy Projectiles
- **Color**: Red/Pink — MUST contrast with player blue/cyan
- **Shape**: Slightly larger than player projectiles (easier to see and dodge)
- **Speed**: Slower than player projectiles — gives reaction time
- **Warning**: Brief orange flash at shooter position before firing (shoot telegraph)

### Boss Projectiles
- **Color**: Bright red/orange — highly visible
- **Shape**: Larger, more detailed patterns (burst, wave, fan)
- **Telegraph**: Always has charge-up visual before firing

## Explosion VFX Layers (our implementation)
1. **Particle burst** — Phaser `explode()` one-shot, additive blend
2. **Shockwave ring** — Graphics circle, scale tween outward, alpha fade
3. **Center flash** — Brief white circle, rapid fade

## Lightning Bolt VFX (our implementation)
1. **Outer glow** — Wide semi-transparent line with perpendicular jitter
2. **Inner core** — Thin white line with smaller jitter
3. **Impact spark** — Particle burst at target point

## Performance Budget
- Max 24 particle emitters active simultaneously
- Max 8 telegraph sprites active
- Emitter pool: reuse via `killAll()` + `explode()`, cleanup via `complete` event
- Graphics objects: pool via GraphicsFactory, always reset alpha/scale on release
- Avoid per-frame Graphics.clear()+redraw — use transform (rotation/scale) for animation

## Phaser-Specific Best Practices
- `emitter.explode(count)` for one-shot effects — Phaser handles lifecycle
- `emitter.once('complete', callback)` for auto-cleanup
- `generateTexture()` for repeated shapes — create once, use as Sprite many times
- `blendMode: 'ADD'` on particle config, not on emitter (avoids batch breaks)
- `scene.tweens.add()` for fade/scale animation on Graphics/Sprites
- Never create Graphics per-frame — use pool or pre-generated textures

## Sources
- [Game Particle Effects Guide 2025](https://generalistprogrammer.com/tutorials/game-particle-effects-complete-vfx-programming-guide-2025/)
- [Real Time VFX Tips](https://realtimevfx.com/t/small-vfx-tips/923)
- [Juice in Game Design](https://www.bloodmooninteractive.com/articles/juice.html)
- [Phaser ParticleEmitter API](https://docs.phaser.io/api-documentation/class/gameobjects-particles-particleemitter)
- [Phaser Particles Concepts](https://docs.phaser.io/phaser/concepts/gameobjects/particles)
- [Making Better Bullets](https://gravityace.com/devlog/making-better-bullets/)
- [VFX Artistic Principles](https://www.vfxapprentice.com/blog/five-artistic-principles-gaming-vfx)
