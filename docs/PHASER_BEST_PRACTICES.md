# 🎮 Phaser Best Practices pro Rakovinobijec

## Přehled
Tento dokument obsahuje best practices pro práci s Phaser 3 enginem v kontextu Rakovinobijec projektu. Dodržování těchto pravidel zajišťuje výkon, stabilitu a udržovatelnost.

---

## 🎬 Scény - Minimální State

### Základní pravidlo
**Scény jsou pouze thin orchestrators** - veškerá logika je v systémech!

### ✅ SPRÁVNĚ - Thin Scene
```javascript
class GameScene extends Phaser.Scene {
    create() {
        // Pouze inicializace systémů
        this.bootstrapManager = new BootstrapManager(this);
        this.bootstrapManager.bootstrap();
    }
    
    update(time, delta) {
        // Pouze delegace
        this.updateManager?.update(time, delta);
    }
    
    shutdown() {
        // Pouze cleanup
        this.disposableRegistry?.disposeAll();
    }
}
```

### ❌ ŠPATNĚ - Bloated Scene
```javascript
class GameScene extends Phaser.Scene {
    create() {
        // NE! Scéna dělá všechno
        this.player = this.physics.add.sprite(...);
        this.enemies = this.add.group();
        this.setupAnimations();
        this.createUI();
        this.initializeWeapons();
        // ... 500 dalších řádků
    }
}
```

---

## 🎯 Input Isolation

### Modal Overlay Pattern
Když zobrazíte UI overlay, MUSÍTE blokovat input do hry:

```javascript
class GameUIScene extends Phaser.Scene {
    showModal() {
        // 1. Vytvoř overlay container
        const overlay = this.add.container(0, 0);
        
        // 2. Nastav jako interaktivní s full-screen hit area
        const { width, height } = this.cameras.main;
        overlay.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, width, height),
            Phaser.Geom.Rectangle.Contains
        );
        
        // 3. Blokuj propagaci eventů
        overlay.on('pointerdown', (pointer, localX, localY, event) => {
            event.stopPropagation();
        });
        
        // 4. Top-only input mode
        this.input.setTopOnly(true);
        
        // 5. Volitelně - transparentní background
        const bg = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.5);
        overlay.add(bg);
        
        // 6. Přidej modal content
        const modal = this.createModalContent();
        overlay.add(modal);
        
        // 7. Správný depth
        overlay.setDepth(this.DEPTH_LAYERS.UI_OVERLAY);
    }
    
    hideModal() {
        // Restore normal input
        this.input.setTopOnly(false);
        this.scene.resume('GameScene');
    }
}
```

### Cursor Management
```javascript
// Disable hand cursor pro overlay
overlay.setInteractive({ useHandCursor: false });

// Enable pro buttons
button.setInteractive({ useHandCursor: true });
```

---

## 📏 Depth Management

### VŽDY používejte konstanty
```javascript
// GameScene.js
this.DEPTH_LAYERS = {
    BACKGROUND: 0,
    TERRAIN: 50,
    LOOT: 100,
    ENEMIES: 1000,
    PLAYER: 1500,
    PROJECTILES: 2000,
    VFX_LOWER: 2500,
    VFX_UPPER: 3000,
    UI_GAME: 4000,
    UI_OVERLAY: 5000,
    DEBUG: 9999
};
```

### Použití
```javascript
// ✅ SPRÁVNĚ
enemy.setDepth(this.scene.DEPTH_LAYERS.ENEMIES);
vfx.setDepth(this.scene.DEPTH_LAYERS.VFX_UPPER);

// ❌ ŠPATNĚ - magic numbers!
enemy.setDepth(1000);
vfx.setDepth(3000);
```

### Depth pro různé systémy
| System | Depth Range | Poznámka |
|--------|-------------|----------|
| Loot | 100-199 | Pod enemies |
| Enemies | 1000-1499 | Včetně bossů |
| Player | 1500 | Vždy viditelný |
| Projectiles | 2000-2499 | Nad postavami |
| VFX | 2500-3999 | Rozděleno na lower/upper |
| UI | 4000+ | Vždy nahoře |

---

## ⏱️ Tweens a Time Management

### Pause-aware tweens
```javascript
// ✅ SPRÁVNĚ - respektuje pauzu
createTween() {
    return this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        duration: 1000,
        // Automaticky se pauzuje s scénou
    });
}

// ❌ ŠPATNĚ - ignoruje pauzu
createTween() {
    // Manuální animace v update
    this.sprite.alpha -= 0.01;  // Běží i při pauze!
}
```

### Time.paused handling
```javascript
update(time, delta) {
    // Check if paused
    if (this.scene.time.paused) {
        // Skip update nebo použij fallback
        return;
    }
    
    // Normal update
    this.updateSystems(time, delta);
}
```

### ⏰ Timing Best Practices

#### Absolutní čas vs Delta čas
```javascript
// ✅ SPRÁVNĚ - absolutní čas pro cooldowny/intervaly
class Player {
    _handleAutoAttack(time, delta) {
        if (!this._nextAttackAt) {
            this._nextAttackAt = time; // Initialize s current time
        }
        
        if (time >= this._nextAttackAt) {
            this._shootAtTarget(target);
            this._nextAttackAt += this.attackInterval; // Absolute time increment
        }
    }
}

// ✅ SPRÁVNĚ - delta čas pro postupné změny
update(time, delta) {
    // Delta pro frame-independent postupné změny
    this._iFramesMsLeft = Math.max(0, this._iFramesMsLeft - delta);
    
    // Absolutní time pro animace
    this.alpha = Math.sin(time * 0.02) * 0.3 + 0.7;
}

// ❌ ŠPATNĚ - frame-dependent timing
if (time - this.lastAction >= this.interval) {
    // Problém při lag nebo pause/resume
}
```

#### Catch-up Protection
```javascript
// ✅ SPRÁVNĚ - ochrana proti burst při lag
_handleAutoAttack(time, delta) {
    if (time >= this._nextAttackAt) {
        let shotsFired = 0;
        // Limit burst na max 3 shots per frame
        while (time >= this._nextAttackAt && shotsFired < 3) {
            this._shootAtTarget(target);
            this._nextAttackAt += attackInterval;
            shotsFired++;
        }
    }
}
```

#### Pause Awareness
```javascript
// ✅ SPRÁVNĚ - respektování pause stavu
takeDamage(amount, source) {
    // Ignoruj damage během pause (např. level-up selection)
    if (this.scene.isPaused || this.scene.scene.isPaused()) {
        return 0;
    }
    // ... damage logic
}
```

### Tween cleanup
```javascript
class VFXEffect {
    constructor(scene) {
        this.scene = scene;
        this.tweens = [];
    }
    
    play() {
        const tween = this.scene.tweens.add({
            targets: this.sprite,
            scale: 2,
            duration: 500,
            onComplete: () => this.cleanup()
        });
        
        // Track pro cleanup
        this.tweens.push(tween);
    }
    
    cleanup() {
        // DŮLEŽITÉ - vždy cleanup tweens!
        this.tweens.forEach(t => t.stop());
        this.tweens = [];
        this.sprite?.destroy();
    }
}
```

---

## 🔄 Pooling Strategy

### Object Pools
```javascript
class ProjectilePool {
    constructor(scene, size = 50) {
        this.scene = scene;
        this.pool = [];
        this.active = [];
        
        // Pre-create objekty
        for (let i = 0; i < size; i++) {
            const proj = new Projectile(scene);
            proj.setActive(false).setVisible(false);
            this.pool.push(proj);
        }
    }
    
    get() {
        let proj = this.pool.pop();
        
        if (!proj) {
            // Pool empty - vytvoř nový
            console.warn('Pool exhausted, creating new projectile');
            proj = new Projectile(this.scene);
        }
        
        this.active.push(proj);
        return proj.setActive(true).setVisible(true);
    }
    
    release(proj) {
        const index = this.active.indexOf(proj);
        if (index > -1) {
            this.active.splice(index, 1);
        }
        
        // Reset a vrať do poolu
        proj.reset();
        proj.setActive(false).setVisible(false);
        this.pool.push(proj);
    }
    
    releaseAll() {
        while (this.active.length > 0) {
            this.release(this.active[0]);
        }
    }
}
```

### Pool Guidelines
- **Pre-create objekty** v create() fázi
- **Reset při release** - vyčisti všechny properties
- **Monitor pool size** - varování při exhaustion
- **Destroy při shutdown** - vyčisti celý pool

---

## 🔊 Audio Management

### VŽDY přes AudioSystem
```javascript
// ✅ SPRÁVNĚ - přes systém
this.scene.audioSystem.play('sfx.explosion', { volume: 0.5 });

// ❌ ŠPATNĚ - přímé volání
this.scene.sound.play('explosion');
```

### Audio Pool
```javascript
class AudioSystem {
    constructor(scene) {
        this.scene = scene;
        this.pools = new Map();
    }
    
    play(key, options = {}) {
        // Get or create pool
        if (!this.pools.has(key)) {
            this.pools.set(key, []);
        }
        
        const pool = this.pools.get(key);
        let sound = pool.find(s => !s.isPlaying);
        
        if (!sound) {
            // Create new sound
            sound = this.scene.sound.add(key);
            pool.push(sound);
        }
        
        // Apply options
        sound.volume = options.volume ?? 1.0;
        sound.play();
        
        return sound;
    }
}
```

---

## ✨ VFX Management

### VŽDY přes VFXSystem
```javascript
// ✅ SPRÁVNĚ - přes registry
this.scene.vfxSystem.play('vfx.explosion.large', x, y);

// ❌ ŠPATNĚ - přímé particles
this.scene.add.particles(x, y, 'spark', { ... });
```

### Particle Emitter Cleanup
```javascript
class VFXSystem {
    playExplosion(x, y) {
        const emitter = this.scene.add.particles(x, y, 'spark', {
            speed: { min: 100, max: 200 },
            scale: { start: 1, end: 0 },
            lifespan: 1000
        });
        
        // DŮLEŽITÉ - auto cleanup!
        this.scene.time.delayedCall(1000, () => {
            emitter.destroy();
        });
        
        // Track pro manual cleanup
        this.activeEmitters.push(emitter);
        
        return emitter;
    }
    
    cleanup() {
        // Cleanup všech active emitters
        this.activeEmitters.forEach(e => e.destroy());
        this.activeEmitters = [];
    }
}
```

---

## 🎯 Physics Best Practices

### Collision Groups
```javascript
// Definuj collision categories
this.COLLISION_CATEGORIES = {
    PLAYER: 0x0001,
    ENEMY: 0x0002,
    PROJECTILE_PLAYER: 0x0004,
    PROJECTILE_ENEMY: 0x0008,
    LOOT: 0x0010,
    WALL: 0x0020
};

// Setup collisions
this.physics.add.collider(
    this.playerProjectiles,
    this.enemies,
    this.handleProjectileHit,
    null,
    this
);
```

### Physics Body Optimization
```javascript
// Pro statické objekty
wall.body.setImmovable(true);
wall.body.moves = false;

// Pro rychle se pohybující objekty
projectile.body.useDamping = false;

// Optimize bounds checking
enemy.body.setCollideWorldBounds(false); // Pokud není potřeba
```

---

## 🐛 Common Pitfalls

### 1. Overlay pod projektily
**Problém**: UI overlay je pod projektily
**Řešení**: Správné DEPTH_LAYERS.UI_OVERLAY

### 2. UI input bleed
**Problém**: Kliknutí prochází do hry
**Řešení**: `setTopOnly(true)` + blocking container

### 3. Tweens běží při pauze
**Problém**: Animace pokračují při paused scene
**Řešení**: Použijte scene tweens, ne global

### 4. Memory leaky v particles
**Problém**: Particle emitters nejsou destroyed
**Řešení**: Vždy cleanup v DisposableRegistry

### 5. Audio překrývání
**Problém**: Stejný zvuk hraje 100x
**Řešení**: Audio pooling + cooldowns

---

## 📊 Performance Tips

### Sprite Batching
```javascript
// Použij stejnou texturu pro batching
enemies.forEach(e => e.setTexture('enemy_atlas'));
```

### Reduce Draw Calls
```javascript
// Použij sprite atlasy
this.load.atlas('enemies', 'enemies.png', 'enemies.json');
```

### Cull Invisible Objects
```javascript
update() {
    const camera = this.cameras.main;
    this.enemies.forEach(enemy => {
        const inView = camera.worldView.contains(enemy.x, enemy.y);
        enemy.setVisible(inView);
    });
}
```

### Optimize Physics
```javascript
// Disable co není potřeba
enemy.body.setEnable(false);  // Když mimo obrazovku

// Použij simple bodies
enemy.setCircle(16);  // Místo complex polygon
```

---

## 🔧 Debug Helpers

### Visual Debugging
```javascript
// Show physics bodies
this.physics.world.createDebugGraphic();

// Show depths
this.input.enableDebug(sprite);

// FPS meter
this.add.text(10, 10, '', { color: '#00ff00' })
    .setScrollFactor(0)
    .setDepth(9999)
    .setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
```

### Performance Profiling
```javascript
// Measure update time
const start = performance.now();
this.updateSystems();
const elapsed = performance.now() - start;
if (elapsed > 16) {  // Více než 1 frame
    console.warn(`Slow update: ${elapsed}ms`);
}
```

---

*Dokument vytvořen pro Rakovinobijec v0.4.0 | Poslední aktualizace: 2024*