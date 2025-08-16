# 📘 Blueprint Templates & Quick Start Guide

## 🚀 Quick Start: Adding New Content

### ➕ How to Add a New Boss (3 Steps)

1. **Copy the template**
   ```bash
   cp data/blueprints/templates/boss.json5 data/blueprints/boss/boss.your_boss_name.json5
   ```

2. **Edit the blueprint**
   - Change `id` to unique identifier (e.g., `"boss.toxic_overlord"`)
   - Modify `stats`, `phases`, and `abilities`
   - Update `vfx` and `sfx` references

3. **Register & Test**
   - Add entry to `data/registries/index.json`:
     ```json5
     { id: "boss.your_boss_name", path: "blueprints/boss/boss.your_boss_name.json5" }
     ```
   - Test in-game: Press **F7** → Boss Playground → Select your boss → Spawn

### ⚡ How to Add a New PowerUp (3 Steps)

1. **Copy the template**
   ```bash
   cp data/blueprints/templates/powerup.json5 data/blueprints/powerup/powerup.your_powerup.json5
   ```

2. **Edit the blueprint**
   - Change `id` to unique identifier (e.g., `"powerup.lightning_strike"`)
   - Define `modifiers` and `mechanics`
   - Set up `levels` progression

3. **Add to loot tables**
   - Include in relevant loot tables (`data/blueprints/loot/`)
   - Test drop rate with console: `DEV.spawnDrop("powerup.your_powerup")`

### 🎮 How to Add a New Enemy (3 Steps)

1. **Create blueprint**
   ```bash
   touch data/blueprints/enemy/enemy.your_enemy.json5
   ```
   Use VS Code snippet: Type `enemyBlueprint` → Tab

2. **Configure enemy**
   - Set `stats` (HP, speed, damage)
   - Choose `ai.behavior` (homing, patrol, aggressive)
   - Link to `lootTableId`

3. **Add to spawn tables**
   - Edit spawn table in `data/blueprints/spawn/`
   - Add weight and spawn conditions
   - Test: `DEV.spawnEnemy("enemy.your_enemy")`

---

## 🛠️ VS Code Snippets

### Installation
Snippets are automatically available in `.json5` files within the project.

### Available Snippets

| Trigger | Description | Usage |
|---------|-------------|-------|
| `bossBlueprint` | Complete boss template | Type → Tab → Fill placeholders |
| `powerupBlueprint` | Complete powerup template | Type → Tab → Fill placeholders |
| `enemyBlueprint` | Complete enemy template | Type → Tab → Fill placeholders |
| `sfxEntry` | Sound effect entry | For registry entries |
| `vfxEntry` | Visual effect entry | For registry entries |
| `ability` | Ability definition | For boss/enemy abilities |
| `bossPhase` | Boss phase config | Add phases to bosses |
| `lootTable` | Loot table template | Create drop tables |
| `statusEffect` | Status effect definition | Burn, poison, freeze, etc. |

### How to Use Snippets

1. Open any `.json5` file
2. Type the snippet trigger (e.g., `bossBlueprint`)
3. Press **Tab**
4. Use **Tab** to jump between placeholders
5. Choose from dropdown options with arrow keys

---

## 📁 File Structure

```
data/blueprints/
├── templates/          # Templates (DO NOT MODIFY)
│   ├── boss.json5     # Boss template with all options
│   ├── powerup.json5  # PowerUp template with progression
│   └── README.md      # This file
├── boss/              # Boss blueprints
├── enemy/             # Enemy blueprints  
├── powerup/           # PowerUp blueprints
├── drop/              # Collectible drops
├── loot/              # Loot tables
└── spawn/             # Spawn configurations
```

---

## 🔗 Important Links

- **[Dev Guidelines](../../../Dev_Guidelines.md)** - PR7 compliance rules
- **[Blueprint Schema](../../schemas/blueprint.schema.json)** - Validation schema
- **[Data Folder Guide](../../../docs/DataFolderGuide.md)** - Complete data structure docs

---

## 🧪 Testing Tools

### In-Game Debug Commands (F3 Console)

```javascript
// Spawn specific boss
DEV.spawnBoss("boss.your_boss_name")

// Spawn enemy at position
DEV.spawnEnemy("enemy.your_enemy", x, y)

// Drop powerup
DEV.spawnDrop("powerup.your_powerup")

// Test loot table
DEV.testLootTable("lootTable.your_table", 100)
```

### Debug Panels

- **F3** - Debug Overlay (stats, performance)
- **F6** - Missing Assets (track missing VFX/SFX)
- **F7** - Boss Playground (test bosses)
- **F8** - SFX Soundboard (test sounds)

---

## ✅ Validation

Before committing, always run:

```bash
# Validate all blueprints
npm run audit:data:strict

# Check for missing assets
npm run verify:all
```

---

## 💡 Pro Tips

1. **Use Templates**: Always start from templates, don't create from scratch
2. **Test Early**: Use F7 Boss Playground immediately after creating
3. **Check Console**: Missing VFX/SFX will show warnings
4. **Version Control**: Commit working blueprints before major changes
5. **Incremental Testing**: Test each phase/ability separately

---

## 🐛 Common Issues

### "Blueprint not found"
- Check `id` matches filename
- Verify registration in `index.json`
- Run `npm run rebuild:index`

### "Missing texture/audio"
- Check F6 panel for missing assets
- Verify file paths in blueprint
- Audio files go in `/sound/`
- Sprites go in `/sprites/`

### "Boss not spawning"
- Open F7 Boss Playground
- Check console for errors
- Verify blueprint passes validation
- Ensure all referenced abilities exist

---

## 📞 Need Help?

1. Check existing blueprints for examples
2. Use VS Code snippets for correct structure
3. Run validation to catch errors early
4. Test in isolated Boss Playground (F7)

Happy blueprint creation! 🎮