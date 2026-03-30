# 📝 Blueprint Editor

Visual editor for Rakovinobijec game blueprints. Edit enemies, bosses, powerups, projectiles, and more with a user-friendly interface.

![Editor Screenshot](screenshot.png)

## 🚀 Quick Start

### 1. Start the Development Server

```bash
cd editor
python3 server.py
```

The server will start on `http://localhost:8080`

### 2. Open the Editor

Open your browser and navigate to:
```
http://localhost:8080/index.html
```

### 3. Start Editing

1. **Browse Blueprints**: Use the left panel to navigate available blueprints
2. **Edit Properties**: Select a blueprint to edit its properties in the middle panel
3. **Preview Changes**: See visual preview and stats in the right panel
4. **Save Changes**: Click the Save button or use Auto-save (enabled by default)

## 🎮 Features

### Core Functionality
- ✅ **Blueprint Browser**: Hierarchical file tree with search and filtering
- ✅ **Property Editor**: Dynamic forms with type-specific inputs
- ✅ **Visual Preview**: Canvas preview with stats display
- ✅ **Test Runner**: Validate and test blueprints
- ✅ **Auto-save**: Automatic saving every 30 seconds
- ✅ **Validation**: Real-time schema validation with error reporting

### Supported Blueprint Types
- 👾 **Enemies**: Basic NPCs with AI behavior
- 🐉 **Bosses**: Multi-phase bosses with special abilities
- ⭐ **Elites**: Enhanced enemies with multipliers
- 💎 **Uniques**: Rare special enemies
- 💊 **Powerups**: Player enhancement items
- 🔸 **Projectiles**: Bullets and missiles
- 📦 **Loot**: Drops and rewards
- 🌊 **Spawn Tables**: Level progression and enemy waves
- ⚙️ **System**: Configuration files

### Advanced Features
- 🔄 **Plugin System**: Extensible architecture
- 📊 **JSON View**: Raw blueprint data inspection  
- 🎨 **Color Preview**: Visual color picker for tints
- 📝 **Context Menu**: Right-click actions (duplicate, copy, etc.)
- ⚡ **Keyboard Shortcuts**: Fast navigation and actions

## 🛠️ Usage Guide

### Blueprint Browser
- **Search**: Filter blueprints by name or ID
- **Filter**: Show only specific blueprint types
- **Context Menu**: Right-click for additional actions
- **Expand/Collapse**: Organize by blueprint type

### Property Editor
- **Dynamic Forms**: Automatically generates appropriate input types
- **Validation**: Real-time error checking and warnings
- **Nested Objects**: Expand/collapse complex structures
- **Array Editing**: Add/remove items from arrays
- **Color Inputs**: Special handling for color/tint properties

### Preview Panel
- **Visual Mode**: Canvas rendering with shape and color
- **Stats Mode**: Tabular view of all properties
- **JSON Mode**: Raw blueprint data with syntax highlighting
- **Type Icons**: Visual indicators for different entity types

### Test Runner
- **Blueprint Validation**: Schema checking before testing
- **Type-specific Tests**: Custom test logic for each blueprint type
- **Error Reporting**: Detailed error messages and warnings
- **Output Log**: Timestamped test results

## 📂 File Structure

```
editor/
├── index.html              # Main editor interface
├── server.py               # Development server
├── README.md               # This file
├── css/
│   └── editor.css          # Main stylesheet
├── js/
│   ├── core/               # Core systems
│   │   ├── EditorCore.js   # Main controller
│   │   ├── DataManager.js  # File I/O operations
│   │   ├── SchemaValidator.js # Blueprint validation
│   │   └── PluginLoader.js # Plugin system
│   └── modules/            # Editor modules
│       ├── BlueprintBrowser.js # File tree navigation
│       ├── PropertyEditor.js   # Dynamic form editor
│       ├── SimplePreview.js    # Visual preview
│       └── TestRunner.js       # Blueprint testing
└── plugins/                # Future plugin directory
```

## ⚙️ Configuration

### Auto-save Settings
Edit `EditorCore.js` to modify auto-save behavior:

```javascript
this.autoSaveEnabled = true;        // Enable/disable auto-save
this.autoSaveInterval = 30000;      // Interval in milliseconds
```

### Schema Validation
Customize validation rules in `SchemaValidator.js`:

```javascript
// Add new validation rules for custom blueprint types
this.schemas.customType = {
    required: ['id', 'type'],
    // ... validation rules
};
```

### Preview Settings
Modify preview canvas size in `SimplePreview.js`:

```javascript
// Canvas dimensions
this.canvas.width = 200;
this.canvas.height = 200;
```

## 🔌 Plugin System

The editor supports plugins for extending functionality:

```javascript
// Example plugin
class MyPlugin extends EditorPlugin {
    constructor() {
        super();
        this.name = 'MyPlugin';
        this.version = '1.0.0';
    }
    
    async init(editor) {
        // Plugin initialization
        editor.on('blueprint:loaded', this.onBlueprintLoaded.bind(this));
    }
    
    onBlueprintLoaded(data) {
        console.log('Blueprint loaded:', data.blueprint.id);
    }
}

// Register plugin
editor.pluginLoader.register(new MyPlugin());
```

## 🐛 Troubleshooting

### Common Issues

**Editor won't load blueprints**
- Ensure the server is running on port 8080
- Check that blueprint files exist in `../data/blueprints/`
- Verify JSON5 syntax is valid

**Saving doesn't work**
- Check server console for error messages
- Ensure file permissions allow writing
- Verify file paths don't contain invalid characters

**Preview not showing**
- Check browser console for JavaScript errors
- Ensure blueprint has valid stats/graphics properties
- Try refreshing the preview manually

**Validation errors**
- Review error messages in the Test Runner
- Check schema requirements in `SchemaValidator.js`
- Verify all required fields are present

### Development Tips

1. **Use Browser Dev Tools**: Open F12 to see console errors
2. **Check Network Tab**: Verify file loading and saving requests
3. **Enable Verbose Logging**: Set debug flags in `EditorCore.js`
4. **Test with Simple Blueprints**: Start with basic enemy blueprints
5. **Backup Important Files**: Always backup before extensive editing

## 🔮 Future Plans

### Phase 2: Boss Support
- [ ] Visual boss phase timeline
- [ ] Ability sequence designer
- [ ] Passive aura configuration

### Phase 3: Quality of Life
- [ ] Undo/redo system
- [ ] Batch editing operations
- [ ] Import/export functionality
- [ ] Advanced search and replace

### Phase 4: Advanced Features
- [ ] Real-time collaboration
- [ ] Version control integration
- [ ] Asset pipeline integration
- [ ] Performance profiling

## 📄 License

Part of the Rakovinobijec project. See main project for license information.

---

**Created with ❤️ for the Rakovinobijec development team**