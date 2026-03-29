# Visual Design Guide — Rakovinobijec

## Color Palette — Role-Based Enemy Color Coding

### Principles
- **Limited palette** (6 anchor colors) for visual clarity
- **Role → Color** mapping — player reads threat type from color instantly
- **Value (lightness) separates layers**, not just hue
- **Hue shift for depth** — shadows shift toward purple, highlights toward yellow
- **Saturation reserved** for player and important UI, enemies slightly desaturated

### Enemy Color Assignments

| Role | Color | Hex | Enemies |
|------|-------|-----|---------|
| Swarm/Chase | Red-purple | `#CC3366` | viral_swarm, necrotic_cell, viral_swarm_alpha |
| Charge/Dash | Orange | `#DD6600` | metastasis_runner, elite.speed_virus |
| Ranged/Shoot | Blue | `#3366CC` | micro_shooter, elite.artillery, elite.micro_shooter |
| Explode | Yellow-orange | `#DDAA00` | acidic_blob |
| Support/Shield | Green | `#33AA66` | shielding_helper, support_bacteria |
| Tank/Slow | Dark red-brown | `#882233` | fungal_parasite, elite.tank_cell |
| Evasion/Dodge | Light purple | `#9966CC` | aberrant_cell |

### Special Indicators
| Type | Visual | Hex |
|------|--------|-----|
| Elite | Gold stroke border | `#FFD700` |
| Unique | Silver stroke border | `#C0C0C0` |
| Boss | Red + significantly larger sprite | `#FF0000` |

### Visual Layer Separation

```
Layer               Depth    Alpha    Lightness    Purpose
─────────────────────────────────────────────────────────────
Background          0        1.0      0%           Dark space
XP orbs             500      0.5      20%          Quiet background diamonds
Loot (hexagons)     600      0.85     40%          Mid-layer, hexagon shape
Enemy sprites       1000     1.0      60-80%       Main gameplay layer
Player              1500     1.0      100%         Brightest, highest contrast
VFX/Telegraph       3000     0.6→0    variable     Temporary overlays
```

### Loot Design
- **Shape**: Hexagon (distinct from circular/square enemies)
- **Size**: Uniform 20px for all items
- **Symbol**: Letter inside identifies type (✚ HP, M metotrexat, E energy, P protein, R research)
- **XP orbs**: Small diamonds (8-12px), muted colors, alpha 0.5

### Color Theory Sources
- [2D Will Never Die — Picking Colors](https://2dwillneverdie.com/tutorial/picking-the-best-colors-for-your-sprite/)
- [Gamedeveloper.com — Color in Games](https://www.gamedeveloper.com/design/color-in-games-an-in-depth-look-at-one-of-game-design-s-most-useful-tools)
- [Lospec Palette List](https://lospec.com/palette-list)
- [Color Theory for Game Art](https://pavcreations.com/color-theory-for-game-art-design-the-basics/)
