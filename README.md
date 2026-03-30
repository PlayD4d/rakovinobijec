# Rakovinobijec

**Dedicated to Marda — a cancer fighter — and everyone battling any illness.**

## Play Online

[Play Rakovinobijec](https://playd4d.github.io/rakovinobijec/)

## About

Rakovinobijec ("Cancer Slayer") is a 2D top-down survival shooter inspired by Vampire Survivors. The player controls a white blood cell fighting waves of cancer cells, mutations, and bosses across 7 levels.

### Gameplay

- **Survival** — survive enemy waves and defeat the boss at the end of each level
- **6-slot powerup system** — build from 12 abilities (radiotherapy, shield, immune aura, homing, chain lightning, ...)
- **XP gems** — collect crystals, level up, choose powerups
- **7 bosses** — each with unique phases, telegraphed attacks, and mechanics
- **Progressive difficulty** — enemy scaling, elite/unique spawns

### Controls

- **WASD / Arrows** — Movement
- **Auto-attack** — 4-directional shots + homing if equipped
- **ESC** — Pause

## Quick Start

```bash
git clone https://github.com/playd4d/rakovinobijec.git
npm install
npm run dev
# http://localhost:8000
```

## Tech Stack

- **Engine**: Phaser 3.90.0 (local, no CDN)
- **Architecture**: 100% data-driven (JSON5 blueprints)
- **Telemetry**: Local SQLite via dev-server
- **Zero external runtime dependencies** — works fully offline

## Documentation

- [CLAUDE.md](CLAUDE.md) — Source of truth for AI agents and developers
- [docs/](docs/README.md) — Architecture, code standards, Phaser 3.90 reference

## License

MIT

---

*"There is a fighter in each of us. Sometimes we just need to be reminded how strong we can be."*
