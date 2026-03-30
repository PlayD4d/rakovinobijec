# 📝 Blueprint Editor - Development Plan

## 🎯 Project Overview
**Goal**: Create a browser-based visual editor for all game blueprints (enemies, bosses, powerups, projectiles, loot, etc.)

**Core Principles**:
- Simple and intuitive UI
- Modular architecture (plugin system)
- PR7 compliant - 100% data-driven
- Live preview and testing
- Focus on essential features first

---

## 📋 Development Phases

### Phase 1: Core MVP (Week 1)
Essential functionality to edit and save blueprints

#### 1.1 Basic Infrastructure
- [ ] Create folder structure (`/editor/`)
- [ ] Setup basic HTML layout
- [ ] Implement module loader system
- [ ] Create plugin architecture base

#### 1.2 Blueprint Browser Module
- [ ] File tree view of all blueprints
- [ ] Filter by type (enemy, boss, powerup, etc.)
- [ ] Search functionality
- [ ] Create new blueprint
- [ ] Delete blueprint (with confirmation)
- [ ] Duplicate blueprint

#### 1.3 Property Editor Module
- [ ] Dynamic form generation from schema
- [ ] Input validation
- [ ] Type-specific inputs (number, text, select, color)
- [ ] Nested object support
- [ ] Array editing (add/remove items)
- [ ] Save/Load functionality

#### 1.4 Simple Preview Module
- [ ] Static visual preview (sprite + stats)
- [ ] Color/tint preview
- [ ] Size visualization
- [ ] Basic stat display

#### 1.5 Test Runner Module
- [ ] Spawn entity in test environment
- [ ] Basic controls (spawn, reset, pause)
- [ ] View console output
- [ ] Error reporting

---

### Phase 2: Boss Support (Week 2)
Specialized tools for boss editing

#### 2.1 Boss Phase Editor
- [ ] Phase list view
- [ ] HP threshold editor
- [ ] Ability assignment per phase
- [ ] Phase preview timeline

#### 2.2 Boss Ability Editor
- [ ] Ability list management
- [ ] Parameter editing for each ability
- [ ] Cooldown visualization
- [ ] Ability type templates

#### 2.3 Passive Aura Editor
- [ ] Aura configuration
- [ ] Visual radius preview
- [ ] Effect parameters

---

### Phase 3: Nice to Have (Week 3+)
Quality of life improvements

#### 3.1 Visual Enhancements
- [ ] Animated sprite preview
- [ ] VFX/SFX preview buttons
- [ ] Drag-and-drop for file organization

#### 3.2 Advanced Features
- [ ] Batch editing multiple blueprints
- [ ] Import/Export functionality
- [ ] Version history (undo/redo)
- [ ] Validation warnings
- [ ] Auto-save with recovery

#### 3.3 Relationship Management
- [ ] Visual relationship graph
- [ ] Dependency checking
- [ ] Reference validation

---

## 🏗️ Architecture

### Module System
```
/editor/
├── index.html              # Main entry point
├── css/
│   ├── editor.css         # Main styles
│   └── modules/           # Module-specific styles
├── js/
│   ├── core/
│   │   ├── EditorCore.js # Main controller
│   │   ├── PluginLoader.js
│   │   ├── DataManager.js # Blueprint I/O
│   │   └── SchemaValidator.js
│   ├── modules/
│   │   ├── BlueprintBrowser.js
│   │   ├── PropertyEditor.js
│   │   ├── SimplePreview.js
│   │   └── TestRunner.js
│   └── plugins/           # Future extensions
├── schemas/               # JSON schemas for validation
└── templates/            # HTML templates
```

### Data Flow
```
Blueprint File -> DataManager -> PropertyEditor -> User Edit
                      ↓              ↓                ↓
                SchemaValidator  Preview Update  Save Changes
```

### Plugin Interface
```javascript
class EditorPlugin {
  constructor(editor) {
    this.editor = editor;
    this.name = 'PluginName';
    this.version = '1.0.0';
  }
  
  init() {
    // Register UI elements
    // Subscribe to events
  }
  
  onBlueprintLoad(blueprint) {}
  onBlueprintSave(blueprint) {}
  onPropertyChange(path, value) {}
}
```

---

## 📝 TODO List

### Immediate Tasks (Today)
1. ✅ Create Editor_Devplan.md
2. ⏳ Create basic folder structure
3. ⏳ Implement HTML layout
4. ⏳ Create EditorCore.js

### Week 1 Milestones
- [ ] Complete Blueprint Browser
- [ ] Complete Property Editor
- [ ] Basic Preview working
- [ ] Save/Load functional

### Week 2 Milestones
- [ ] Boss phase editing
- [ ] Boss ability configuration
- [ ] Test runner operational

---

## 🛠️ Implementation Details

### Blueprint Browser
```javascript
// Core functionality
- loadBlueprintList()      // Scan /data/blueprints/
- filterByType(type)        // Filter tree view
- searchBlueprints(query)   // Search by id/name
- createBlueprint(type)     // Create from template
- deleteBlueprint(id)       // Remove with confirmation
```

### Property Editor
```javascript
// Dynamic form generation
- generateForm(schema)      // Create inputs from schema
- validateInput(value, type) // Type-specific validation
- handleArrayEdit(path)     // Add/remove array items
- handleNestedObject(path)  // Expand/collapse nested
- saveChanges()            // Write to file
```

### Simple Preview
```javascript
// Visual representation
- renderSprite(blueprint)   // Show sprite/placeholder
- applyTint(color)         // Apply color tint
- showStats(stats)         // Display key stats
- updatePreview()          // Refresh on change
```

### Test Runner
```javascript
// In-game testing
- initTestEnvironment()    // Setup Phaser scene
- spawnEntity(blueprint)   // Create in test scene
- resetEnvironment()       // Clear and restart
- captureErrors()         // Log issues
```

---

## 🎨 UI Design

### Layout
```
+----------------------------------+
|  Blueprint Editor                |
+----------+-----------+-----------+
| Browser  | Property  | Preview   |
| [Tree]   | [Form]    | [Visual]  |
|          |           |           |
|          |           | [Stats]   |
|          |           |           |
|          |           | [Test]    |
+----------+-----------+-----------+
| Status Bar: Ready | Auto-save ON |
+----------------------------------+
```

### Color Scheme
- Background: #1e1e1e (dark)
- Panels: #252525
- Borders: #3e3e3e
- Text: #cccccc
- Accent: #4CAF50 (green)
- Error: #f44336 (red)
- Warning: #ff9800 (orange)

---

## 🚀 Getting Started

### Development Setup
```bash
# Navigate to editor directory
cd editor/

# Start local server (Python)
python3 -m http.server 8080

# Or use Node.js
npx http-server -p 8080

# Open in browser
http://localhost:8080/
```

### First Implementation Steps
1. Create HTML skeleton with 3-panel layout
2. Implement EditorCore.js with basic event system
3. Create DataManager for loading blueprint files
4. Implement BlueprintBrowser with file tree
5. Create PropertyEditor with dynamic forms

---

## 📊 Success Metrics

### MVP Complete When:
- ✅ Can browse all blueprints
- ✅ Can edit any property
- ✅ Can save changes
- ✅ Can preview visually
- ✅ Can test spawn

### Phase 2 Complete When:
- ✅ Can edit boss phases
- ✅ Can configure abilities
- ✅ Can test boss battles

### Phase 3 Complete When:
- ✅ Has all QOL features
- ✅ Stable and performant
- ✅ User-friendly

---

## 🔍 Technical Considerations

### File Access
- Use fetch() API to read blueprints
- Server-side endpoint for saving
- Consider using File System Access API

### Performance
- Lazy load blueprints
- Virtual scrolling for large lists
- Debounce property changes
- Cache parsed schemas

### Browser Compatibility
- Target modern browsers (Chrome, Firefox, Edge)
- Use ES6 modules
- No transpilation needed

### Security
- Validate all inputs
- Sanitize file paths
- Prevent path traversal
- CORS configuration for local dev

---

## 📚 Resources

### Documentation
- [Phaser 3 API](https://photonstorm.github.io/phaser3-docs/)
- [JSON5 Spec](https://json5.org/)
- [JSON Schema](https://json-schema.org/)

### Similar Projects
- Tiled Map Editor (reference for UI)
- Unity Inspector (property editing)
- VS Code (file tree, search)

---

## 🎯 Next Steps

1. **Today**: Complete basic infrastructure
2. **Tomorrow**: Blueprint Browser functional
3. **Day 3**: Property Editor working
4. **Day 4**: Preview and Test Runner
5. **Day 5**: Polish and bug fixes
6. **Week 2**: Boss support

---

## 📝 Notes

- Keep it simple - avoid feature creep
- Focus on usability over advanced features
- Test with real blueprints frequently
- Get feedback early and often
- Document as you go

---

*Last Updated: 2025-08-15*