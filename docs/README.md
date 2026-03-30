# Dokumentace Rakovinobijec

> v0.9.x | Phaser 3.90.0 (local lib/)

## Dokumenty

| Dokument | Popis |
|----------|-------|
| [DEV_GUIDELINES.md](./DEV_GUIDELINES.md) | Pravidla vývoje, systémy, event architektura, DO/DON'T |
| [PHASER_390_REFERENCE.md](./PHASER_390_REFERENCE.md) | Phaser 3.90 API, best practices, gotchas, performance |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Architektonické vzory (Capability-based, Thin Composer, DisposableRegistry) |
| [CODE_STANDARDS.md](./CODE_STANDARDS.md) | Kódové standardy, naming conventions, limity |
| [lifecycle.md](./lifecycle.md) | Game lifecycle, bootstrap flow, transition management |
| [VFX_DESIGN.md](./VFX_DESIGN.md) | VFX design pravidla, barvy, telegrafy |
| [VISUAL_DESIGN.md](./VISUAL_DESIGN.md) | Enemy vizuální design, barevná paleta |

Source of truth pro AI agenty: **CLAUDE.md** (root)

## Quick Start

```bash
npm run dev              # Dev server (port 8000)
npm run guard:check-all  # Ověřit architekturu
npm run audit:data       # Validovat blueprinty
npm run smoke:test       # Smoke test
npm run ci:quick         # Guards + smoke (rychlé)
```
