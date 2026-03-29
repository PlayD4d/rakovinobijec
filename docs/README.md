# Dokumentace Rakovinobijec

> v0.5.86+ | Phaser 3.90.0

## Hlavni dokumenty

| Dokument | Popis |
|----------|-------|
| [DEV_GUIDELINES.md](./DEV_GUIDELINES.md) | Pravidla vyvoje, systemy, event architektura, DO/DON'T |
| [PHASER_390_REFERENCE.md](./PHASER_390_REFERENCE.md) | Phaser 3.90 API, best practices, gotchas, performance |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Architektonicke vzory (Capability-based, Thin Composer, DisposableRegistry) |
| [CODE_STANDARDS.md](./CODE_STANDARDS.md) | Kodove standardy, naming conventions, limity |
| [lifecycle.md](./lifecycle.md) | Game lifecycle, bootstrap flow, transition management |
| [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | Kompletni pruvodce (blueprinty, content creation, debugging) |
| [Migration_Plan.md](./Migration_Plan.md) | Plan migrace na Godot 4.4 (budouci) |

## Quick Start

```bash
npm run dev              # Spustit dev server
npm run guard:check-all  # Overit architekturu
npm run audit:data       # Validovat blueprinty
npm run smoke:test       # Smoke test
```

## Validace pred commitem
```bash
npm run ci:quick         # Guards + smoke (rychle)
npm run ci:full          # Kompletni CI
```
