# 🎮 Plán migrace Rakovinobijec z Phaser 3 na Godot 4.4

## 📋 Obsah
1. [Přehled projektu](#přehled-projektu)
2. [Technický postup migrace](#technický-postup-migrace)
3. [Fáze migrace](#fáze-migrace)
4. [Mapování API](#mapování-phaser--godot)
5. [Architektonické principy](#architektonické-principy)
6. [Časový harmonogram](#časový-harmonogram)
7. [Technické výzvy](#technické-výzvy)

---

## 🎯 Přehled projektu

### Současný stav (Phaser 3)
Rakovinobijec je 2D top-down survival hra s moderní architekturou:
- **100% data-driven** přes JSON5 blueprinty
- **Capability-based design** - oddělení engine API od business logiky
- **Thin Composer pattern** - minimální hlavní třídy (< 100 LOC)
- **PR7 compliance** - žádné hardcoded hodnoty, vše v datech
- **Pure functions** pro AI behaviors
- **DisposableRegistry** pro memory management

### Cíl migrace
Převést kompletní hru z webové technologie (HTML5/JavaScript/Phaser 3) na nativní multiplatformní engine (Godot 4.4) při **zachování všech architektonických principů a dat**.

### Proč Godot?
- **Nativní výkon** - až 10x rychlejší než web
- **Multiplatformní** - PC, mobily, konzole z jednoho kódu
- **GDScript** - podobný JavaScriptu, snadná migrace
- **Open source** - žádné licenční poplatky
- **Built-in nástroje** - editor, profiler, debugger

---

## 🔧 Technický postup migrace

### 1. Struktura složek

```bash
/Users/miroslav/Desktop/
├── Rakovinobijec/           # ⚠️ PŮVODNÍ PROJEKT - NEMĚNIT!
│   ├── js/                  # JavaScript kód (reference)
│   ├── data/                # Blueprinty JSON5
│   ├── assets/              # Grafika, zvuky
│   └── docs/                # Dokumentace
│
└── RakovinobiecGodot/       # 🆕 NOVÝ GODOT PROJEKT
    ├── project.godot        # Godot project file
    ├── Migration_Plan.md    # Tento dokument
    │
    ├── data/                # Zkopírované blueprinty
    │   ├── blueprints/      # JSON5 soubory (1:1 kopie)
    │   ├── config/          # Konfigurace
    │   └── i18n/            # Lokalizace
    │
    ├── reference/           # Kopie JS pro referenci
    │   └── js/              # Původní JavaScript kód
    │
    ├── scenes/              # Godot scény (.tscn)
    │   ├── main.tscn        # Hlavní scéna
    │   ├── game.tscn        # Herní scéna
    │   ├── ui/              # UI scény
    │   └── entities/        # Entity prefabs
    │
    ├── scripts/             # GDScript soubory
    │   ├── core/            # Core systémy
    │   │   ├── ConfigResolver.gd
    │   │   ├── BlueprintLoader.gd
    │   │   ├── DisposableRegistry.gd
    │   │   └── EventBus.gd
    │   │
    │   ├── entities/        # Entity třídy
    │   │   ├── Player.gd
    │   │   ├── Enemy.gd
    │   │   ├── Boss.gd
    │   │   ├── core/        # Capability providers
    │   │   └── ai/          # AI behaviors (pure functions)
    │   │
    │   ├── managers/        # Managers (orchestrators)
    │   │   ├── UpdateManager.gd
    │   │   ├── TransitionManager.gd
    │   │   ├── BootstrapManager.gd
    │   │   └── EnemyManager.gd
    │   │
    │   ├── systems/         # Game systems
    │   │   ├── ProjectileSystem.gd
    │   │   ├── VFXSystem.gd
    │   │   ├── AudioSystem.gd
    │   │   ├── LootSystem.gd
    │   │   ├── PowerUpSystem.gd
    │   │   └── SpawnDirector.gd
    │   │
    │   └── ui/              # UI komponenty
    │       ├── HUD.gd
    │       ├── PauseMenu.gd
    │       └── PowerUpSelection.gd
    │
    └── assets/              # Godot resources
        ├── sprites/         # Konvertované textury
        ├── sounds/          # OGG Vorbis zvuky
        ├── music/           # Hudba
        ├── vfx/             # Particle efekty
        └── fonts/           # Fonty
```

### 2. Inicializace projektu

```bash
# 1. Vytvořit Godot projekt
# V Godot editoru: Project -> New Project -> RakovinobiecGodot

# 2. Zkopírovat data a reference
cd /Users/miroslav/Desktop
cp -r Rakovinobijec/data RakovinobiecGodot/data
cp -r Rakovinobijec/js RakovinobiecGodot/reference/js
cp -r Rakovinobijec/docs RakovinobiecGodot/reference/docs

# 3. Zkopírovat assets
cp -r Rakovinobijec/sprites RakovinobiecGodot/assets/sprites
cp -r Rakovinobijec/sound RakovinobiecGodot/assets/sounds
cp -r Rakovinobijec/music RakovinobiecGodot/assets/music
```

### 3. Projektové nastavení Godot

```gdscript
# project.godot nastavení
[application]
config/name="Rakovinobijec"
config/version="0.5.0-godot"
run/main_scene="res://scenes/main.tscn"
config/features=PackedStringArray("4.4")

[display]
window/size/viewport_width=1024
window/size/viewport_height=768
window/stretch/mode="canvas_items"
window/stretch/aspect="keep"

[rendering]
textures/canvas_textures/default_texture_filter=0  # Nearest (pixel perfect)
renderer/rendering_method="forward_plus"

[physics]
2d/default_gravity=0.0
2d/default_gravity_vector=Vector2(0, 0)

[autoload]
ConfigResolver="*res://scripts/core/ConfigResolver.gd"
BlueprintLoader="*res://scripts/core/BlueprintLoader.gd"
EventBus="*res://scripts/core/EventBus.gd"
DisposableRegistry="*res://scripts/core/DisposableRegistry.gd"
```

---

## 📊 Fáze migrace

### FÁZE 1: Core Systems (7-10 dní)

#### 1.1 ConfigResolver (Singleton)
```gdscript
# scripts/core/ConfigResolver.gd
extends Node

var _config_cache: Dictionary = {}
var _blueprints: Dictionary = {}

func _ready() -> void:
    _load_config_files()
    print("[ConfigResolver] Initialized with external configurations")

func get(path: String, options: Dictionary = {}) -> Variant:
    # Port z JS ConfigResolver.get()
    # Podporuje dot notation: "enemy.spawn.delay"
    var blueprint = options.get("blueprint", null)
    if blueprint:
        return _get_from_blueprint(blueprint, path)
    return _get_from_config(path, options.get("default_value", null))
```

#### 1.2 BlueprintLoader
```gdscript
# scripts/core/BlueprintLoader.gd
extends Node

signal blueprints_loaded

var _blueprints: Dictionary = {}
var _registry: Dictionary = {}

func _ready() -> void:
    _scan_blueprint_directory()
    _load_all_blueprints()
    blueprints_loaded.emit()

func get_blueprint(id: String) -> Dictionary:
    return _blueprints.get(id, {})

func _load_json5(path: String) -> Dictionary:
    # Implementace JSON5 parseru
    # Nebo použít plugin pro JSON5 support
    pass
```

#### 1.3 DisposableRegistry
```gdscript
# scripts/core/DisposableRegistry.gd
extends RefCounted

class DisposableTracker:
    var timers: Array[Timer] = []
    var signals: Array[Dictionary] = []
    var nodes: Array[Node] = []
    
    func dispose_all() -> void:
        for timer in timers:
            if is_instance_valid(timer):
                timer.queue_free()
        for sig_info in signals:
            if sig_info.object.has_signal(sig_info.signal_name):
                sig_info.object.disconnect(sig_info.signal_name, sig_info.callable)
        for node in nodes:
            if is_instance_valid(node):
                node.queue_free()

var _disposables: Dictionary = {}

func create(owner: Object) -> DisposableTracker:
    var tracker = DisposableTracker.new()
    _disposables[owner.get_instance_id()] = tracker
    return tracker

func dispose(owner: Object) -> void:
    var id = owner.get_instance_id()
    if _disposables.has(id):
        _disposables[id].dispose_all()
        _disposables.erase(id)
```

#### 1.4 EventBus (Signals)
```gdscript
# scripts/core/EventBus.gd
extends Node

# Definovat všechny signály
signal enemy_spawned(enemy_data: Dictionary)
signal enemy_died(enemy_data: Dictionary)
signal player_damaged(amount: int)
signal player_leveled_up(level: int)
signal powerup_selected(powerup_id: String)
signal game_paused
signal game_resumed
signal victory
signal game_over(stats: Dictionary)

func emit_event(event_name: String, data: Variant = null) -> void:
    if has_signal(event_name):
        emit_signal(event_name, data)
```

### FÁZE 2: Entity System (10-14 dní)

#### 2.1 Capability-based Design Pattern

```gdscript
# scripts/entities/core/EntityCapabilities.gd
class_name EntityCapabilities
extends Resource

# Capability interface - abstrakce Godot API
var _owner: Node2D

func _init(owner: Node2D) -> void:
    _owner = owner

func get_pos() -> Vector2:
    return _owner.global_position

func set_velocity(velocity: Vector2) -> void:
    if _owner.has_method("set_velocity"):
        _owner.set_velocity(velocity)

func shoot(pattern: String, opts: Dictionary = {}) -> void:
    if _owner.has_method("_shoot"):
        _owner._shoot(pattern, opts)

func play_sfx(sound_id: String) -> void:
    AudioSystem.play(sound_id, _owner.global_position)

func spawn_vfx(vfx_id: String, offset: Vector2 = Vector2.ZERO) -> void:
    VFXSystem.play(vfx_id, _owner.global_position + offset)
```

#### 2.2 Player Implementation

```gdscript
# scripts/entities/Player.gd
extends CharacterBody2D

@export var blueprint_id: String = "player"

var blueprint: Dictionary
var capabilities: EntityCapabilities
var base_stats: Dictionary
var hp: float
var max_hp: float

@onready var sprite: Sprite2D = $Sprite2D
@onready var collision: CollisionShape2D = $CollisionShape2D

func _ready() -> void:
    # Načíst blueprint
    blueprint = BlueprintLoader.get_blueprint(blueprint_id)
    capabilities = EntityCapabilities.new(self)
    
    # Inicializovat stats z blueprintu
    _init_from_blueprint()
    
    # Registrovat do DisposableRegistry
    var disposables = DisposableRegistry.create(self)

func _init_from_blueprint() -> void:
    base_stats = {
        "hp": ConfigResolver.get("stats.hp", {"blueprint": blueprint}),
        "move_speed": ConfigResolver.get("stats.speed", {"blueprint": blueprint}),
        "attack_interval_ms": ConfigResolver.get("mechanics.attack.intervalMs", {"blueprint": blueprint}),
        # ... další stats
    }
    
    max_hp = base_stats.hp
    hp = max_hp

func _physics_process(delta: float) -> void:
    _handle_input()
    _handle_movement(delta)
    _handle_attack(delta)
    move_and_slide()

func take_damage(amount: float, source: Node2D = null) -> void:
    # Port damage systému
    pass
```

#### 2.3 Enemy System (Thin Composer)

```gdscript
# scripts/entities/Enemy.gd
extends CharacterBody2D

@export var blueprint_id: String

var blueprint: Dictionary
var behaviors: EnemyBehaviors
var core: EnemyCore

func _ready() -> void:
    # Thin composer pattern
    core = EnemyCore.new(self, blueprint)
    behaviors = EnemyBehaviors.new(self)
    
    add_child(core)
    add_child(behaviors)

func _physics_process(delta: float) -> void:
    if behaviors:
        behaviors.update(delta)
```

```gdscript
# scripts/entities/core/EnemyCore.gd
class_name EnemyCore
extends Node

# Poskytuje capabilities pro AI behaviors
var owner_enemy: CharacterBody2D
var hp: float
var max_hp: float

func get_pos() -> Vector2:
    return owner_enemy.global_position

func set_velocity(vel: Vector2) -> void:
    owner_enemy.velocity = vel

func shoot(pattern: String, opts: Dictionary = {}) -> void:
    ProjectileSystem.create_enemy_projectile({
        "position": get_pos(),
        "pattern": pattern,
        "options": opts
    })
```

#### 2.4 AI Behaviors (Pure Functions)

```gdscript
# scripts/entities/ai/behaviors/Chase.gd
class_name ChaseBehavior

# Pure function - žádné side effects, žádné Godot API
static func execute(cap: EntityCapabilities, cfg: Dictionary, delta: float) -> String:
    var pos = cap.get_pos()
    var target_pos = cfg.get("target_pos", Vector2.ZERO)
    
    if pos.distance_to(target_pos) < 50:
        return "attack"  # Přechod na attack state
    
    var direction = (target_pos - pos).normalized()
    var speed = cfg.get("speed", 100)
    cap.set_velocity(direction * speed)
    
    return ""  # Zůstat v chase state
```

### FÁZE 3: Game Systems (10-14 dní)

#### 3.1 ProjectileSystem

```gdscript
# scripts/systems/ProjectileSystem.gd
extends Node2D

var projectile_scene = preload("res://scenes/entities/Projectile.tscn")
var projectile_pool: Array[Node2D] = []
var active_projectiles: Array[Node2D] = []

const POOL_SIZE = 100

func _ready() -> void:
    _initialize_pool()

func _initialize_pool() -> void:
    for i in POOL_SIZE:
        var proj = projectile_scene.instantiate()
        proj.set_physics_process(false)
        proj.visible = false
        add_child(proj)
        projectile_pool.append(proj)

func create_projectile(config: Dictionary) -> Node2D:
    var proj = _get_from_pool()
    if proj:
        proj.initialize(config)
        proj.global_position = config.position
        proj.visible = true
        proj.set_physics_process(true)
        active_projectiles.append(proj)
    return proj

func _get_from_pool() -> Node2D:
    if projectile_pool.is_empty():
        print_debug("ProjectileSystem: Pool exhausted!")
        return null
    return projectile_pool.pop_back()

func release_projectile(proj: Node2D) -> void:
    active_projectiles.erase(proj)
    proj.reset()
    proj.visible = false
    proj.set_physics_process(false)
    projectile_pool.append(proj)
```

#### 3.2 VFXSystem

```gdscript
# scripts/systems/VFXSystem.gd
extends Node2D

var vfx_presets: Dictionary = {}
var particle_pool: Dictionary = {}

func _ready() -> void:
    _load_vfx_presets()
    _initialize_pools()

func play(vfx_id: String, position: Vector2, options: Dictionary = {}) -> void:
    if not vfx_presets.has(vfx_id):
        print_debug("VFX not found: " + vfx_id)
        return
    
    var preset = vfx_presets[vfx_id]
    match preset.type:
        "particles":
            _play_particles(preset, position, options)
        "sprite_animation":
            _play_sprite_animation(preset, position, options)

func _play_particles(preset: Dictionary, pos: Vector2, opts: Dictionary) -> void:
    var emitter = _get_particle_emitter(preset.texture)
    emitter.position = pos
    emitter.emitting = true
    emitter.amount = preset.get("amount", 10)
    emitter.lifetime = preset.get("lifetime", 1.0)
    # Configure další parametry
```

#### 3.3 AudioSystem

```gdscript
# scripts/systems/AudioSystem.gd
extends Node

var sfx_pool: Dictionary = {}
var music_player: AudioStreamPlayer

const MAX_SFX_INSTANCES = 10

func _ready() -> void:
    music_player = AudioStreamPlayer.new()
    add_child(music_player)
    _initialize_sfx_pools()

func play_sfx(sound_path: String, position: Vector2 = Vector2.ZERO) -> void:
    var player = _get_sfx_player(sound_path)
    if player:
        if position != Vector2.ZERO:
            player.global_position = position
        player.play()

func _get_sfx_player(path: String) -> AudioStreamPlayer2D:
    if not sfx_pool.has(path):
        _create_sfx_pool(path)
    
    var pool = sfx_pool[path]
    for player in pool:
        if not player.playing:
            return player
    
    print_debug("SFX pool exhausted for: " + path)
    return null
```

### FÁZE 4: Managers (7-10 dní)

#### 4.1 UpdateManager

```gdscript
# scripts/managers/UpdateManager.gd
extends Node

var player: Node2D
var enemy_manager: Node
var spawn_director: Node
var projectile_system: Node
var loot_system: Node
var vfx_system: Node

func _ready() -> void:
    set_physics_process(true)
    set_process(true)

func _physics_process(delta: float) -> void:
    # Phase 1: Input & Player
    if player:
        player._handle_input()
        player._update_movement(delta)
    
    # Phase 2: AI & Enemies
    if spawn_director:
        spawn_director.update(delta)
    if enemy_manager:
        enemy_manager.update_enemies(delta)
    
    # Phase 3: Systems
    if projectile_system:
        projectile_system.update(delta)

func _process(delta: float) -> void:
    # Phase 4: Visual updates
    if vfx_system:
        vfx_system.update(delta)
    if loot_system:
        loot_system.update_animations(delta)
```

#### 4.2 TransitionManager

```gdscript
# scripts/managers/TransitionManager.gd
extends Node

enum GameState { MENU, PLAYING, PAUSED, VICTORY, GAME_OVER }

var current_state: GameState = GameState.MENU
var transition_history: Array[Dictionary] = []

func show_victory(stats: Dictionary) -> void:
    if current_state == GameState.VICTORY:
        return  # Re-entrancy guard
    
    current_state = GameState.VICTORY
    _log_transition("victory_start", stats)
    
    get_tree().paused = true
    EventBus.victory.emit(stats)

func game_over(stats: Dictionary) -> void:
    if current_state == GameState.GAME_OVER:
        return
    
    current_state = GameState.GAME_OVER
    _log_transition("game_over_start", stats)
    
    get_tree().paused = true
    EventBus.game_over.emit(stats)
```

### FÁZE 5: UI System (10-14 dní)

#### 5.1 Struktura UI v Godot

```
Main (Node2D)
├── GameWorld (Node2D)
│   ├── Player
│   ├── Enemies
│   └── Projectiles
│
└── UILayer (CanvasLayer)
    ├── HUD (Control)
    │   ├── HealthBar
    │   ├── XPBar
    │   └── Score
    │
    ├── PauseMenu (Control)
    │   └── [Initially hidden]
    │
    └── Modals (Control)
        ├── PowerUpSelection
        ├── GameOverScreen
        └── VictoryScreen
```

#### 5.2 HUD Implementation

```gdscript
# scripts/ui/HUD.gd
extends Control

@onready var health_bar: ProgressBar = $HealthBar
@onready var xp_bar: ProgressBar = $XPBar
@onready var score_label: Label = $ScoreLabel
@onready var level_label: Label = $LevelLabel

var player: Node2D

func _ready() -> void:
    EventBus.player_damaged.connect(_on_player_damaged)
    EventBus.player_leveled_up.connect(_on_level_up)

func update_health(current: float, max: float) -> void:
    health_bar.max_value = max
    health_bar.value = current

func update_xp(current: float, needed: float) -> void:
    xp_bar.max_value = needed
    xp_bar.value = current
    
    # XP bar fill animation
    var tween = create_tween()
    tween.tween_property(xp_bar, "value", current, 0.3)
```

#### 5.3 Input Isolation

```gdscript
# scripts/ui/ModalBase.gd
extends Control

func show_modal() -> void:
    visible = true
    # Block input to game
    mouse_filter = Control.MOUSE_FILTER_STOP
    
    # Pause game
    get_tree().paused = true
    process_mode = Node.PROCESS_MODE_WHEN_PAUSED

func hide_modal() -> void:
    visible = false
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    get_tree().paused = false
```

---

## 🔄 Mapování Phaser → Godot

### Core Concepts

| Phaser 3 | Godot 4.4 | Poznámky |
|----------|-----------|----------|
| `Phaser.Scene` | `Node2D` nebo `Node` | Godot scény jsou stromy nodů |
| `Phaser.Game` | `SceneTree` | Globální herní kontext |
| `this` (v Scene) | `self` | Reference na aktuální objekt |
| `scene.add.existing()` | `add_child()` | Přidání do stromu |
| `destroy()` | `queue_free()` | Bezpečné smazání |

### Physics

| Phaser 3 | Godot 4.4 | Poznámky |
|----------|-----------|----------|
| `Phaser.Physics.Arcade.Sprite` | `CharacterBody2D` | Pro pohyblivé entity |
| `Phaser.Physics.Arcade.StaticGroup` | `StaticBody2D` | Pro statické objekty |
| `this.physics.add.collider()` | `Area2D` signals | `body_entered`, `area_entered` |
| `body.setVelocity()` | `velocity = Vector2()` | Nastavení rychlosti |
| `body.setCircle()` | `CollisionShape2D` s `CircleShape2D` | Kolizní tvar |

### Graphics

| Phaser 3 | Godot 4.4 | Poznámky |
|----------|-----------|----------|
| `Phaser.GameObjects.Sprite` | `Sprite2D` | 2D sprite |
| `this.add.graphics()` | `draw()` override nebo `Line2D` | Custom kreslení |
| `setTint()` | `modulate` property | Barvení spritu |
| `setDepth()` | `z_index` property | Pořadí vykreslování |
| `setOrigin()` | `offset` property | Pivot point |
| `setScale()` | `scale` property | Škálování |

### Animation & Tweens

| Phaser 3 | Godot 4.4 | Poznámky |
|----------|-----------|----------|
| `this.tweens.add()` | `create_tween()` | Tween animace |
| `this.anims.create()` | `AnimationPlayer` | Sprite animace |
| `this.time.delayedCall()` | `Timer` node | Časovače |
| `this.time.addEvent()` | `Timer` s `timeout` signal | Opakované události |

### Input

| Phaser 3 | Godot 4.4 | Poznámky |
|----------|-----------|----------|
| `this.input.keyboard` | `_input(event)` | Keyboard input |
| `cursors.left.isDown` | `Input.is_action_pressed()` | Stav klávesy |
| `this.input.on('pointerdown')` | `_gui_input()` nebo `_input_event()` | Mouse/touch |
| `setInteractive()` | `mouse_filter` property | Interaktivita |

### Audio

| Phaser 3 | Godot 4.4 | Poznámky |
|----------|-----------|----------|
| `this.sound.play()` | `AudioStreamPlayer2D.play()` | 2D pozicovaný zvuk |
| `this.sound.add()` | `AudioStreamPlayer` | Globální zvuk |
| Volume config | `volume_db` property | Hlasitost v decibelech |

### Events

| Phaser 3 | Godot 4.4 | Poznámky |
|----------|-----------|----------|
| `EventEmitter` | Signals | Godot signály |
| `on()` / `once()` | `connect()` / `connect(..., CONNECT_ONE_SHOT)` | Připojení |
| `emit()` | `emit_signal()` | Vyslání signálu |
| `off()` | `disconnect()` | Odpojení |

### Data Management

| Phaser 3 | Godot 4.4 | Poznámky |
|----------|-----------|----------|
| JSON loading | `FileAccess` + `JSON` | Načítání JSON |
| Registry pattern | Autoload singletons | Globální registry |
| Scene data | Node export variables | `@export` proměnné |

---

## 🏛️ Architektonické principy

### 1. Zachování PR7 Compliance

#### ✅ 100% Data-Driven
```gdscript
# SPRÁVNĚ - hodnoty z blueprintů
var damage = ConfigResolver.get("stats.damage", {"blueprint": blueprint})

# ŠPATNĚ - hardcoded hodnota
var damage = 10  # ❌ NIKDY!
```

#### ✅ Capability-based Design
```gdscript
# Capability provider (Core)
class_name EnemyCore
extends Node

func get_pos() -> Vector2:
    return owner.global_position

func set_velocity(vel: Vector2) -> void:
    owner.velocity = vel

# Pure function behavior
static func chase_behavior(cap: EntityCapabilities, cfg: Dictionary, dt: float) -> String:
    # Žádné Godot API přímo!
    var pos = cap.get_pos()  # Přes capability
    cap.set_velocity(direction * speed)  # Přes capability
    return next_state
```

#### ✅ Thin Composer Pattern
```gdscript
# Enemy.gd - Thin composer (< 100 řádků)
extends CharacterBody2D

var core: EnemyCore
var behaviors: EnemyBehaviors
var combat: EnemyCombat

func _ready():
    core = EnemyCore.new(self)
    behaviors = EnemyBehaviors.new(self)
    combat = EnemyCombat.new(self)

func _physics_process(delta):
    behaviors.update(delta)  # Delegace
    combat.update(delta)      # Delegace
```

### 2. Guard Rules v Godot

#### Implementace guard checks
```gdscript
# tools/check_guards.gd
@tool
extends EditorScript

func _run():
    var errors = []
    
    # Check 1: Max file size (500 lines)
    var files = _get_all_gd_files()
    for file in files:
        var lines = FileAccess.open(file, FileAccess.READ).get_as_text().split("\n")
        if lines.size() > 500:
            errors.append(file + " exceeds 500 lines!")
    
    # Check 2: No Godot API in behaviors
    var behavior_files = _get_behavior_files()
    for file in behavior_files:
        var content = FileAccess.open(file, FileAccess.READ).get_as_text()
        if "Node" in content or "CharacterBody2D" in content:
            errors.append(file + " contains Godot API!")
    
    if errors.is_empty():
        print("✅ All guard rules pass")
    else:
        print("❌ Guard violations found:")
        for error in errors:
            print("  - " + error)
```

### 3. Memory Management

#### DisposableRegistry pattern
```gdscript
# Automatická správa zdrojů
var disposables = DisposableRegistry.create(self)

# Timer s automatickým cleanup
var timer = Timer.new()
timer.wait_time = 1.0
timer.timeout.connect(_on_timer)
add_child(timer)
disposables.track_timer(timer)

# Při cleanup
func _exit_tree():
    DisposableRegistry.dispose(self)  # Vše automaticky vyčištěno
```

---

## ⏰ Časový harmonogram

### Celková doba: 50-70 dní (2-3 měsíce)

| Fáze | Doba | Popis |
|------|------|-------|
| **Fáze 1: Core Systems** | 7-10 dní | ConfigResolver, BlueprintLoader, EventBus, DisposableRegistry |
| **Fáze 2: Entity System** | 10-14 dní | Player, Enemy, Boss, AI behaviors |
| **Fáze 3: Game Systems** | 10-14 dní | Projectile, VFX, Audio, Loot, PowerUp, Spawn |
| **Fáze 4: Managers** | 7-10 dní | Update, Transition, Bootstrap, Enemy managers |
| **Fáze 5: UI System** | 10-14 dní | HUD, menus, modaly, input isolation |
| **Fáze 6: Migrace dat** | 3-5 dní | Blueprints, assets, i18n |
| **Fáze 7: Testing** | 7-10 dní | Unit testy, integration, performance |
| **Fáze 8: Polish** | 5-7 dní | Optimalizace, bug fixing, polish |

### Milestones

- **Den 14**: První hratelná verze (Player pohyb + střelba)
- **Den 30**: Základní gameplay loop (Enemies + combat)
- **Den 45**: Feature-complete (Všechny systémy)
- **Den 60**: Beta verze (Testování + polish)
- **Den 70**: Release kandidát

### Týdenní plán

#### Týden 1-2: Základy
- Projekt setup
- Core systems (ConfigResolver, BlueprintLoader)
- Player implementace
- Základní pohyb a input

#### Týden 3-4: Combat
- Enemy system
- AI behaviors
- ProjectileSystem
- Základní combat

#### Týden 5-6: Systémy
- VFX a Audio
- Loot system
- PowerUp system
- SpawnDirector

#### Týden 7-8: UI a Managers
- HUD implementace
- Menu systém
- Managers
- Scene transitions

#### Týden 9-10: Boss a PowerUps
- Boss system
- Boss abilities
- PowerUp selection
- Level progression

#### Týden 11-12: Testing a Polish
- Bug fixing
- Performance optimalizace
- Testování
- Finální úpravy

---

## 🔧 Technické výzvy

### 1. JSON5 Support v Godot

#### Problém
Godot nativně nepodporuje JSON5 (komentáře, trailing commas)

#### Řešení
```gdscript
# Vlastní JSON5 parser
class JSON5Parser:
    static func parse(text: String) -> Dictionary:
        # 1. Odstranit komentáře
        text = _remove_comments(text)
        # 2. Opravit trailing commas
        text = _fix_trailing_commas(text)
        # 3. Konvertovat na standard JSON
        text = _convert_to_json(text)
        # 4. Parse pomocí Godot JSON
        return JSON.parse_string(text)
```

### 2. Capability Pattern v GDScript

#### Problém
GDScript nemá interfaces jako TypeScript

#### Řešení
```gdscript
# Použít Resource jako "interface"
class_name ICapabilities
extends Resource

func get_pos() -> Vector2:
    assert(false, "Must override")
    return Vector2.ZERO

# Implementace
class_name EntityCapabilities
extends ICapabilities

var _owner: Node2D

func get_pos() -> Vector2:
    return _owner.global_position
```

### 3. Pure Functions pro AI

#### Problém
GDScript preferuje OOP, ne funkcionální programování

#### Řešení
```gdscript
# Statické třídy pro behaviors
class_name Behaviors

# Pure functions jako static methods
static func chase(cap: ICapabilities, cfg: Dictionary, dt: float) -> String:
    # Žádný přístup k self nebo this
    # Pouze parametry a return value
    pass

static func flee(cap: ICapabilities, cfg: Dictionary, dt: float) -> String:
    pass
```

### 4. Object Pooling

#### Problém
Godot nemá built-in object pooling

#### Řešení
```gdscript
class ObjectPool:
    var _scene: PackedScene
    var _pool: Array = []
    var _active: Array = []
    
    func get_instance():
        if _pool.is_empty():
            return _scene.instantiate()
        return _pool.pop_back()
    
    func release(obj):
        _active.erase(obj)
        obj.reset()
        obj.visible = false
        _pool.append(obj)
```

### 5. Performance Optimalizace

#### Oblast | Technika |
|---------|----------|
| **Rendering** | Use VisibilityNotifier2D pro culling |
| **Physics** | Disable collision když není potřeba |
| **Particles** | Použít GPUParticles2D místo CPUParticles2D |
| **Pooling** | Pre-instantiate objekty při startu |
| **Blueprints** | Cache parsed JSON data |
| **Signals** | Použít one-shot connections kde možné |

---

## ✅ Kritéria úspěchu

### Funkční požadavky
- ✅ Všechny blueprinty fungují identicky jako v Phaser
- ✅ Zachován gameplay a game feel
- ✅ Všechny power-upy a abilities fungují
- ✅ UI/UX zůstává stejné

### Technické požadavky
- ✅ Capability-based architektura zachována
- ✅ Guard rules passing (max 500 LOC per file)
- ✅ Žádné hardcoded hodnoty v kódu
- ✅ 100% data-driven z blueprintů
- ✅ Pure functions pro AI behaviors

### Performance požadavky
- ✅ 60 FPS na průměrném PC
- ✅ Memory leaks < 1MB/hodinu
- ✅ Startup time < 3 sekundy
- ✅ Blueprint load time < 500ms

### Kvalita kódu
- ✅ GDScript style guide dodržen
- ✅ Dokumentace pro public API
- ✅ Unit testy pro core systems
- ✅ Integration testy pro gameplay

---

## 📚 Příkazy pro práci

### Setup nového projektu
```bash
# 1. Vytvořit projekt v Godot
# 2. Zkopírovat strukturu
cd /Users/miroslav/Desktop
mkdir -p RakovinobiecGodot/{data,reference,scripts,scenes,assets}
cp -r Rakovinobijec/data/* RakovinobiecGodot/data/
cp -r Rakovinobijec/js RakovinobiecGodot/reference/
```

### Workflow migrace souboru
```bash
# 1. Přečíst původní JS
cat reference/js/entities/Player.js

# 2. Vytvořit GDScript ekvivalent
edit scripts/entities/Player.gd

# 3. Test v Godot editoru
# 4. Commit změn
```

### Testing
```bash
# Unit testy (GUT framework)
godot --headless -s addons/gut/gut_cmdln.gd

# Integration testy
godot --headless -s scripts/tests/integration_test.gd

# Performance profiling
godot --profile
```

---

## 🎯 Další kroky

1. **Vytvořit Godot projekt** v editoru
2. **Zkopírovat data** podle návodu výše
3. **Začít s ConfigResolver.gd** - základ všeho
4. **Implementovat BlueprintLoader.gd** - načítání dat
5. **Vytvořit první entitu** - Player.gd
6. **Testovat průběžně** každou komponentu

---

*Dokument vytvořen: 2025*
*Verze: 1.0*
*Autor: Claude (Anthropic)*