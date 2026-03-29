# Phaser 3.80-3.90 Comprehensive Reference

> Research compiled for Rakovinobijec project (currently on Phaser 3.90.0).
> Phaser 3.90 "Tsugumi" (May 2025) is the final v3 release. All future development targets Phaser v4.

---

## Table of Contents

1. [Version Changes (3.70 to 3.90)](#1-version-changes-370-to-390)
2. [Arcade Physics Best Practices](#2-arcade-physics-best-practices)
3. [Scene Management](#3-scene-management)
4. [Performance Patterns](#4-performance-patterns)
5. [Events System](#5-events-system)
6. [Graphics and Rendering](#6-graphics-and-rendering)
7. [Common Gotchas in 3.80+](#7-common-gotchas-in-380)

---

## 1. Version Changes (3.70 to 3.90)

### 3.80 "Nino" (February 2024) -- Breaking Changes

| Change | Impact | Action Required |
|--------|--------|-----------------|
| `AnimationFrame.duration` is now the COMPLETE frame duration | Was previously combined with `msPerFrame` | Review any code that manually sets frame durations |
| `TweenChainBuilder` defaults `persist` to `false` | Previously defaulted to `true` against docs | Add `persist: true` explicitly if you need chains to survive completion |
| `Layer.removeAll()`, `remove()`, `add()` lost `destroyChild` param | Methods still exist via List inheritance | Use `.destroy()` on children directly |
| `NineSlice` no longer defaults origin to 0.5 | Origin behavior changed | Set origin explicitly if using NineSlice |

### 3.80 New Features

- **WebGL Context Restoration**: Full automatic recovery from context loss (critical for mobile where tabbing out loses context). No code changes needed -- Phaser handles it internally.
- **Base64/Data URI Loader**: LoaderPlugin natively handles base64-encoded files. Use for inline assets.
- **EXPAND Scale Mode**: New `Phaser.Scale.EXPAND` preserves aspect ratio while expanding to fill. Clamped in 3.90 for ultra-wide displays.
- **Scale Snap**: Configure `snap: { width: 8, height: 8 }` in game config for pixel-art games requiring exact scaling multiples.
- **StaticBody.reset()**: Now properly re-applies offset values after reset.
- **Timeline looping**: `Time.Timeline` supports `repeat()` with loop callbacks.

### 3.85 "Itsuki" (September 2024)

- **ParticleEmitter.updateConfig()**: Dynamically update emitter configurations at runtime without recreating. Useful for VFX variations.
- **DynamicTexture.clear(x, y, w, h)**: Clear specific rectangular regions within a DynamicTexture.
- **Orientation constants**: Added `LANDSCAPE_SECONDARY` and `PORTRAIT_SECONDARY` to `Phaser.Scale.Orientation`.

### 3.86 "Aoi" (October 2024)

- Minor stability fixes and rendering corrections.

### 3.88 "Minami" (February 2025) -- Breaking Changes

| Change | Impact | Action Required |
|--------|--------|-----------------|
| `DynamicTexture.forceEven` defaults to `true` | Dimensions are rounded up to nearest even value | Set `forceEven: false` if you need odd-sized textures |

### 3.88 Key Changes

- **Transform.getWorldPoint()**: Returns world coordinates as Vector2, factoring in parent hierarchies. Useful for nested containers.
- **Utils.Array.GetFirst**: Supports reverse searching via `startIndex: -1`.
- **Arcade Body.setGameObject()**: Enhanced to properly convert non-physics objects, disable existing bodies, and handle the `enable` parameter correctly.
- **ArcadeColliderType**: Now includes `Physics.Arcade.StaticBody` in type definition.
- **Tween.isNumberTween**: New property to identify NumberTween instances.
- **TweenChain.onStart**: Now properly dispatches on initialization (was silent before).
- **Persistent tweens fix**: Tweens with `persist: true` + `completeDelay` no longer get destroyed prematurely.
- **Matter.World.update**: No longer hangs/crashes after long dormant tabs (large delta protection).
- **iOS 17.5.1+**: Audio properly resumes after focus loss.
- **Timer events**: Fixed potential hang with repeats and negative delays.

### 3.90 "Tsugumi" (May 2025) -- Final v3 Release

- **EXPAND scale mode**: Clamps canvas size on ultra-wide displays, preventing performance issues.
- **Physics fix**: Immovable circle objects no longer pushed by polygons incorrectly.
- **Collision masks**: Fixed within physics groups.
- **Text rendering**: Fixed Chrome 134/Edge 134 bug with RTL/LTR text switching.
- **Audio**: Fixed loading from Base64 data URIs.

---

## 2. Arcade Physics Best Practices

### 2.1 Body Types

**Dynamic Bodies** (default):
- Affected by velocity, acceleration, drag, gravity, bouncing
- Updated every physics step
- Use for: players, enemies, projectiles, loot

**Static Bodies**:
- Never move, never synchronized with parent automatically
- Significantly cheaper than dynamic bodies
- Use for: walls, platforms, trigger zones
- GOTCHA: After repositioning parent, you MUST call `body.updateFromGameObject()` or `refreshBody()`

```javascript
// Creating a static body
const wall = this.physics.add.staticSprite(x, y, 'wall');

// After moving a static body's parent:
wall.setPosition(newX, newY);
wall.refreshBody(); // REQUIRED or collision box stays at old position
```

### 2.2 Body Configuration

```javascript
// Circle body (better for round entities)
sprite.body.setCircle(radius);
sprite.body.setCircle(radius, offsetX, offsetY); // with offset

// Rectangle body (default)
sprite.body.setSize(width, height);
sprite.body.setSize(width, height, center); // center=true recenters

// Offset the body relative to the sprite
sprite.body.setOffset(x, y);

// Disable/enable body
sprite.body.enable = false; // stops ALL physics processing
sprite.body.enable = true;  // re-enables

// Or via world methods (supports arrays and groups):
this.physics.world.disable(spriteOrGroup);
this.physics.world.enable(spriteOrGroup);
```

### 2.3 physics.add.existing() for Custom Objects

Use when you have a game object that needs physics but was not created via `physics.add.*`:

```javascript
// Add dynamic body to existing game object
this.physics.add.existing(gameObject, false); // false = dynamic

// Add static body to existing game object
this.physics.add.existing(gameObject, true); // true = static

// Works with Zones for invisible trigger areas
const zone = this.add.zone(x, y, width, height);
this.physics.add.existing(zone, true); // static trigger zone
```

### 2.4 Overlap vs Collider

| Feature | `physics.add.collider()` | `physics.add.overlap()` |
|---------|--------------------------|-------------------------|
| Collision detection | Yes | Yes |
| Physical separation | Yes (pushes apart) | No (pass through) |
| Use case | Walls, enemies blocking | Triggers, pickups, damage zones |
| Performance | Slightly heavier (separation calc) | Lighter |
| processCallback | Can cancel collision by returning `false` | Can cancel overlap by returning `false` |

```javascript
// Collider: objects physically separate
this.physics.add.collider(player, walls, onHit, processCheck, this);

// Overlap: objects pass through, callback fires
this.physics.add.overlap(player, coins, collectCoin, null, this);

// processCallback is called FIRST -- return false to skip the main callback
function processCheck(player, enemy) {
    if (player.isInvincible) return false; // skip collision entirely
    return true;
}
```

**Rule of thumb**: If you do not need objects to push each other apart, always use `overlap`. It skips the separation math entirely.

### 2.5 Group Management

```javascript
// Physics group with pooling
this.bullets = this.physics.add.group({
    classType: Bullet,          // custom class extending Phaser.Physics.Arcade.Sprite
    maxSize: 50,                // pool limit (-1 = unlimited)
    runChildUpdate: true,       // calls child.update() each frame
    collideWorldBounds: false,  // applied to all children
    allowGravity: false,        // applied to all children
    createCallback: (bullet) => {
        // Called when a new member is added/created
        bullet.setName('bullet_' + this.bullets.getLength());
    },
    removeCallback: (bullet) => {
        // Called when a member is removed
    }
});
```

**Key Group properties**:
- `maxSize`: Controls pool ceiling. Set to a reasonable number (50-200 for bullets).
- `runChildUpdate`: Set `true` only if children have meaningful `update()` methods. Each child's `preUpdate()` is always called by the scene.
- `active` children: Only active children participate in collision checks.

### 2.6 Performance: Broadphase and Narrowphase

**Broadphase (RTree)**:
- Phaser uses an RTree spatial index by default (`useTree: true` in world config)
- RTree quickly eliminates obviously non-colliding pairs
- Cost: clearing and re-inserting all bodies every frame
- At ~5000+ dynamic bodies, the tree overhead exceeds its search speed gains
- For very large body counts, set `useTree: false` to switch to brute-force

**Narrowphase**:
- Actual AABB or circle intersection tests on pairs identified by broadphase
- Circle vs Circle is cheapest
- Rectangle vs Rectangle (AABB) is fast
- Arcade does NOT support polygon bodies -- only rectangles and circles

**What is expensive**:
1. Number of collider/overlap calls in update (consolidate where possible)
2. Large groups with many inactive members still in the tree
3. Bodies with `moves: true` that never actually move (use static bodies instead)
4. Calling `physics.add.collider()` in update instead of once in create

```javascript
// WRONG: Creating collider every frame
update() {
    this.physics.add.collider(this.player, this.enemies); // memory leak!
}

// CORRECT: Create once in create()
create() {
    this.enemyCollider = this.physics.add.collider(
        this.player, this.enemies, this.onHit, null, this
    );
}

// Disable/enable collider dynamically
this.enemyCollider.active = false; // temporarily disable
this.enemyCollider.active = true;  // re-enable
```

### 2.7 Body Enable/Disable Patterns

```javascript
// Pattern 1: Disable body only (object still renders)
sprite.body.enable = false;

// Pattern 2: Full deactivation for pooling
Phaser.GameObjects.Group.killAndHide(sprite);
// Equivalent to: sprite.setActive(false).setVisible(false)
// Body is excluded from collision checks when parent is inactive

// Pattern 3: Disable via world (supports arrays/groups)
this.physics.world.disable(sprite);    // removes from tree
this.physics.world.enable(sprite);     // re-adds to tree

// Pattern 4: disableBody with hide
sprite.disableBody(true, true); // (disableGameObject, hideGameObject)
sprite.enableBody(true, x, y, true, true); // (reset, x, y, enableGameObject, showGameObject)
```

### 2.8 setDirectControl()

New in recent versions. When tweens or manual code control an object's position (not physics velocity):

```javascript
sprite.body.setDirectControl(true);
// Now physics won't override position set by tweens
// Physics velocity/acceleration are ignored
// Collisions still work
```

---

## 3. Scene Management

### 3.1 Scene Lifecycle States

```
PENDING --> INIT --> START --> LOADING --> CREATING --> RUNNING
                                                        |
                                          +-----+-------+-------+
                                          |     |               |
                                        PAUSED SLEEPING      SHUTDOWN --> DESTROYED
                                          |     |               |
                                          +--RUNNING <----------+
                                              (restart)
```

**State visibility/activity**:

| State | Updates | Renders | Input |
|-------|---------|---------|-------|
| RUNNING | Yes | Yes | Yes |
| PAUSED | No | Yes | Yes (!) |
| SLEEPING | No | No | No |
| SHUTDOWN | No | No | No |

**Critical**: PAUSED scenes still render and still receive input events. This is why `setTopOnly(true)` is essential for modal overlays.

### 3.2 Lifecycle Events

```javascript
// In scene create():
this.events.on('pause', this.onPause, this);
this.events.on('resume', this.onResume, this);
this.events.on('sleep', this.onSleep, this);
this.events.on('wake', this.onWake, this);
this.events.on('shutdown', this.onShutdown, this);
this.events.on('destroy', this.onDestroy, this);

// SHUTDOWN fires when scene.stop() or scene.start('other') is called
// The scene is NOT destroyed -- it can be restarted
// Use for cleanup of scene-specific resources

// DESTROY fires only when scene.remove() is called
// The scene is permanently gone
// Use for final resource cleanup
```

**Cleanup rule**: Always listen to `shutdown` for cleanup. If you only listen to `destroy`, your cleanup never fires on `scene.restart()` or `scene.start('other')`.

### 3.3 scene.start() vs scene.launch() vs scene.run()

| Method | Caller scene | Target scene | Use case |
|--------|-------------|--------------|----------|
| `start('B')` | Shuts down | Starts fresh | Scene progression (menu to game) |
| `launch('B')` | Keeps running | Starts fresh (parallel) | Launching UI overlay scene |
| `run('B')` | Keeps running | Smart: resumes/wakes/starts | Modal scenes, flexible activation |
| `switch('B')` | Sleeps | Starts or wakes | Alternating between scenes |
| `pause()` | Pauses self | -- | Modal overlay shown |
| `sleep()` | Sleeps self | -- | Scene completely hidden |
| `restart()` | Shuts down + starts | Self | Level retry |

**Key behaviors**:
- `start()` triggers SHUTDOWN on caller. All caller's game objects are destroyed.
- `launch()` never resumes or wakes a scene -- it always starts/restarts. Do not use for toggling.
- `run()` is the most flexible: checks state and does the right thing (resume if paused, wake if sleeping, start if new).
- All scene transitions happen at the NEXT Scene Manager update, not immediately. Code after `scene.start()` still executes in the same frame.

### 3.4 Cross-Scene Communication

**Pattern 1: Direct reference (tight coupling)**
```javascript
const uiScene = this.scene.get('GameUIScene');
uiScene.updateScore(100);
```

**Pattern 2: Scene events (moderate coupling)**
```javascript
// Emitter scene
this.events.emit('player-died', { score: 500 });

// Listener scene (needs reference to emitter)
const gameScene = this.scene.get('GameScene');
gameScene.events.on('player-died', this.showGameOver, this);
```

**Pattern 3: Game Registry (decoupled)**
```javascript
// Any scene can write
this.registry.set('score', 1000);

// Any scene can listen for changes
this.registry.events.on('changedata-score', (parent, value) => {
    this.scoreText.setText(value);
});
```

**Pattern 4: Custom EventEmitter (fully decoupled -- recommended for complex games)**
```javascript
// Create once, import everywhere
import Phaser from 'phaser';
const CentralEventBus = new Phaser.Events.EventEmitter();
export default CentralEventBus;

// Scene A
CentralEventBus.emit('ui:victory:show', data);

// Scene B
CentralEventBus.on('ui:victory:show', this.showVictory, this);

// IMPORTANT: Clean up in shutdown!
this.events.on('shutdown', () => {
    CentralEventBus.off('ui:victory:show', this.showVictory, this);
});
```

### 3.5 Scene Restart and Cleanup Gotchas

1. **Variables outside init() persist across restarts**:
```javascript
// BAD: score persists after restart
let score = 0;
class GameScene extends Phaser.Scene {
    create() { /* score is still the old value! */ }
}

// GOOD: reset in init()
class GameScene extends Phaser.Scene {
    init() { this.score = 0; }
}
```

2. **Destroyed object references linger**:
```javascript
// A destroyed sprite's callback may still be registered on an emitter
// Always clean up in shutdown:
this.events.once('shutdown', () => {
    this.enemies.clear(true, true); // remove + destroy all children
    this.myCollider.destroy();
});
```

3. **game.events listeners survive scene restarts**:
```javascript
// If you add a listener to game.events, it persists across scene restarts!
// Always remove in shutdown:
this.events.on('shutdown', () => {
    this.game.events.off('step', this.onStep, this);
});
```

### 3.6 Input Isolation with setTopOnly()

```javascript
// In GameUIScene when showing a modal:
showModal() {
    // 1. Only the topmost interactive object receives input
    this.input.setTopOnly(true);

    // 2. Create a full-screen blocker
    const { width, height } = this.cameras.main;
    const blocker = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.5);
    blocker.setInteractive(); // absorbs all clicks
    blocker.on('pointerdown', (p, lx, ly, event) => {
        event.stopPropagation(); // prevent reaching game scene
    });
    blocker.setDepth(DEPTH_LAYERS.UI_OVERLAY);

    // 3. Pause the game scene
    this.scene.pause('GameScene');
}

hideModal() {
    this.input.setTopOnly(false);
    this.scene.resume('GameScene');
}
```

**Why this works**: Input events process in reverse scene order (top scene first). With `setTopOnly(true)`, once the UI scene's interactive object handles the event, it stops propagating to scenes below.

---

## 4. Performance Patterns

### 4.1 Object Pooling with Groups

```javascript
// === Setup in create() ===
this.bulletPool = this.physics.add.group({
    classType: Bullet,
    maxSize: 100,
    runChildUpdate: true,
    createCallback: (bullet) => {
        bullet.on('deactivate', () => {
            this.bulletPool.killAndHide(bullet);
            bullet.body.enable = false;
        });
    }
});

// === Spawning (get from pool) ===
fire(x, y, vx, vy) {
    const bullet = this.bulletPool.getFirstDead(false);
    // getFirstDead(false) = don't auto-create if pool empty
    // getFirstDead(true)  = auto-create using classType if pool empty

    if (!bullet) return; // pool exhausted

    bullet.enableBody(true, x, y, true, true);
    // enableBody(reset, x, y, enableGameObject, showGameObject)
    bullet.setVelocity(vx, vy);
    bullet.body.enable = true;
}

// === Despawning (return to pool) ===
despawn(bullet) {
    bullet.disableBody(true, true);
    // disableBody(disableGameObject, hideGameObject)
    // Equivalent to killAndHide() + body.enable = false
}

// === Alternative: getMatching for active-only iteration ===
update() {
    const activeBullets = this.bulletPool.getMatching('active', true);
    for (const bullet of activeBullets) {
        if (bullet.y < -50) this.despawn(bullet);
    }
}
```

**Pool sizing guidelines**:
- Bullets/projectiles: 50-200 depending on fire rate
- Enemies: 30-100 depending on spawn rate
- Loot/particles: 50-150
- Set `maxSize` to prevent unbounded growth
- Monitor with `pool.getTotalUsed()` and `pool.getTotalFree()`

### 4.2 Texture Atlas vs Individual Textures

```javascript
// SLOW: Individual textures = 1 draw call per texture switch
this.load.image('enemy1', 'enemy1.png');
this.load.image('enemy2', 'enemy2.png');
this.load.image('bullet', 'bullet.png');

// FAST: Atlas = sprites batched into fewer draw calls
this.load.atlas('gameAtlas', 'sprites.png', 'sprites.json');

// Usage stays the same
this.add.sprite(x, y, 'gameAtlas', 'enemy1');
```

**Why**: WebGL batches sprites using the same texture into a single draw call. Switching textures forces a batch flush. An atlas keeps everything on one texture.

**Tool**: Use TexturePacker, ShoeBox, or free-tex-packer to generate atlases.

### 4.3 Graphics Object Pooling

Graphics objects are expensive to create and destroy. Pool them:

```javascript
class GraphicsFactory {
    constructor(scene) {
        this.scene = scene;
        this.pool = [];
    }

    create() {
        if (this.pool.length > 0) {
            const g = this.pool.pop();
            g.clear(); // clear previous drawings
            g.setVisible(true);
            return g;
        }
        return this.scene.add.graphics();
    }

    release(graphics) {
        graphics.clear();
        graphics.setVisible(false);
        this.pool.push(graphics);
    }
}
```

**generateTexture() pattern**: If a Graphics shape does not change, bake it into a texture once:

```javascript
const g = this.add.graphics();
g.fillStyle(0xff0000);
g.fillCircle(16, 16, 16);
g.generateTexture('redCircle', 32, 32);
g.destroy(); // no longer needed

// Now use as a lightweight sprite
this.add.sprite(x, y, 'redCircle');
```

This converts an expensive Graphics draw call into a cheap sprite render. Do NOT call `generateTexture()` every frame -- it creates a new texture each time.

### 4.4 Tween Management and Cleanup

```javascript
// Creating tweens
const tween = this.tweens.add({
    targets: sprite,
    alpha: 0,
    duration: 1000,
    persist: false,  // DEFAULT in 3.80+: auto-destroyed on complete
    onComplete: () => { /* cleanup */ }
});

// persist: false (default) -- tween is destroyed after completion
// persist: true -- tween survives, can be replayed with tween.play()

// Stopping tweens
tween.stop();    // stops immediately, fires onStop
tween.pause();   // pauses, can resume
tween.resume();  // resumes from pause

// Killing all tweens on a target
this.tweens.killTweensOf(sprite);

// IMPORTANT: Tweens on destroyed objects
// If the target is destroyed, the tween may error or leak
// Always kill tweens before destroying the target:
this.tweens.killTweensOf(sprite);
sprite.destroy();

// Scene tweens auto-pause with scene
// They are cleaned up on scene shutdown
```

**Gotcha**: In 3.80, `TweenChainBuilder` changed `persist` default from `true` to `false`. If your tween chains stopped replaying after upgrading, add `persist: true` explicitly.

### 4.5 Timer Management

```javascript
// === One-shot delay ===
const timer = this.time.delayedCall(2000, callback, [arg1], this);
// Automatically destroyed after firing

// === Repeating timer ===
const repeater = this.time.addEvent({
    delay: 500,
    callback: this.spawnEnemy,
    callbackScope: this,
    repeat: 9,         // fires 10 times total (1 initial + 9 repeats)
    // loop: true,     // OR: loop forever
});

// === Timer control ===
repeater.paused = true;   // pause
repeater.paused = false;  // resume
repeater.remove();        // stop and remove
repeater.destroy();       // full cleanup (normally done by Clock on shutdown)

// === Tracking for cleanup ===
// Timers are managed by the scene's Clock
// They auto-pause when scene pauses
// They are cleaned up when scene shuts down
// BUT: if you store references, null them in shutdown:
this.events.on('shutdown', () => {
    this.spawnTimer?.remove();
    this.spawnTimer = null;
});

// === Checking timer state ===
repeater.getProgress();          // 0-1 for current iteration
repeater.getOverallProgress();   // 0-1 for total timeline
repeater.getRemaining();         // ms remaining in current iteration
repeater.getElapsed();           // ms elapsed in current iteration
```

**delayedCall vs addEvent**:
- `delayedCall`: Shorthand for one-shot timers. Returns a TimerEvent.
- `addEvent`: Full config object. Supports `loop`, `repeat`, `timeScale`, `startAt`, `paused`.
- Both respect scene pause/sleep. Both are cleaned up on scene shutdown.

### 4.6 Camera Effects

```javascript
// Flash (white flash on damage/pickup)
this.cameras.main.flash(200, 255, 255, 255);
// flash(duration, r, g, b, force, callback, context)

// Shake (hit feedback)
this.cameras.main.shake(150, 0.01);
// shake(duration, intensity, force, callback, context)
// intensity is a Vector2-like: 0.01 = subtle, 0.05 = strong

// Fade (scene transitions)
this.cameras.main.fadeOut(500, 0, 0, 0);
this.cameras.main.once('camerafadeoutcomplete', () => {
    this.scene.start('NextScene');
});
this.cameras.main.fadeIn(500);

// PERFORMANCE NOTE:
// Camera effects are viewport-only operations
// They do NOT modify game objects
// They are very cheap -- just a fullscreen color overlay
// Safe to use frequently for game juice
```

### 4.7 General Performance Tips

1. **Minimize collider calls**: Each `physics.add.collider/overlap` pair is checked every frame. Consolidate where possible. Use groups instead of individual objects.

2. **Disable bodies when not needed**: Off-screen or inactive objects should have `body.enable = false`.

3. **Use `getMatching('active', true)` instead of `getChildren()`**: Avoids iterating over inactive pool members.

4. **Canvas renderer option**: For mid-range mobile devices, `type: Phaser.CANVAS` can give 30% FPS improvement over WebGL due to lower memory overhead. Test both.

5. **Bitmap text over standard text**: `this.add.bitmapText()` is significantly faster than `this.add.text()` for frequently updating displays (score, FPS).

6. **Reduce canvas size**: Smaller canvas = fewer pixels to render. Use CSS scaling for display size.

7. **Sprite batching**: Objects sharing the same texture and blend mode are batched. Avoid frequent blend mode switches.

8. **Cull off-screen**: For large worlds, manually set `setVisible(false)` on objects outside camera bounds, or use `camera.setRenderToTexture()` culling.

---

## 5. Events System

### 5.1 EventEmitter3 API

Phaser uses a modified [eventemitter3](https://github.com/primus/eventemitter3). The API:

```javascript
// Add listener
emitter.on('event', callback, context);        // persistent
emitter.once('event', callback, context);      // fires once, auto-removes
emitter.addListener('event', callback, context); // alias for on()

// Remove listener
emitter.off('event', callback, context);       // remove specific
emitter.off('event');                          // remove ALL for this event
emitter.removeAllListeners();                  // nuclear option

// Emit
emitter.emit('event', arg1, arg2, ...);

// Query
emitter.listenerCount('event');
emitter.listeners('event');
```

### 5.2 scene.events vs game.events

| Aspect | `this.events` (scene) | `this.game.events` |
|--------|----------------------|-------------------|
| Scope | Per-scene, destroyed on shutdown | Global, persists for game lifetime |
| Cleanup | Auto-cleaned on scene shutdown | YOU must clean up manually |
| Safety | Safe -- isolated per scene | Risky -- can collide with Phaser internal events |
| Cross-scene | No (local only) | Yes (but not recommended) |
| Recommended | Yes, for scene-internal events | Avoid for custom events |

**Phaser-reserved game.events**: `step`, `prestep`, `poststep`, `prerender`, `postrender`, `pause`, `resume`, `blur`, `focus`, `destroy`. Never use these names for custom events.

### 5.3 Listener Cleanup Patterns

```javascript
// PATTERN 1: Clean up in shutdown (most common)
create() {
    this.events.on('shutdown', this.cleanup, this);
    CentralEventBus.on('player-died', this.onPlayerDied, this);
}

cleanup() {
    CentralEventBus.off('player-died', this.onPlayerDied, this);
}

// PATTERN 2: once() for single-fire events
this.events.once('shutdown', () => {
    // cleanup code
});

// PATTERN 3: Track all listeners for bulk cleanup
create() {
    this.trackedListeners = [];
    this.trackListener(CentralEventBus, 'event1', this.handler1);
    this.trackListener(CentralEventBus, 'event2', this.handler2);
}

trackListener(emitter, event, fn) {
    emitter.on(event, fn, this);
    this.trackedListeners.push({ emitter, event, fn });
}

cleanup() {
    this.trackedListeners.forEach(({ emitter, event, fn }) => {
        emitter.off(event, fn, this);
    });
    this.trackedListeners = [];
}
```

### 5.4 Context Parameter Importance

```javascript
class Enemy {
    constructor(scene) {
        // WRONG: 'this' in callback will be the emitter, not Enemy
        scene.events.on('update', this.onUpdate);

        // CORRECT: pass context so 'this' in callback = this Enemy
        scene.events.on('update', this.onUpdate, this);

        // CORRECT removal requires matching context:
        scene.events.off('update', this.onUpdate, this);
        // off('update', this.onUpdate) WITHOUT context may not match!
    }
}
```

**Rule**: Always pass context as the 3rd argument to `on()`, and always pass the same context to `off()`. Mismatched context = listener not removed = memory leak.

---

## 6. Graphics and Rendering

### 6.1 generateTexture() from Graphics

```javascript
// Create a reusable texture from Graphics
const g = this.add.graphics();
g.fillStyle(0x00ff00, 1);
g.fillCircle(16, 16, 16);
g.lineStyle(2, 0xffffff, 1);
g.strokeCircle(16, 16, 15);

// Bake to texture
g.generateTexture('greenCircle', 32, 32);
g.destroy(); // Graphics object no longer needed

// Use the texture for any number of sprites
for (let i = 0; i < 100; i++) {
    this.add.sprite(x, y, 'greenCircle'); // 1 draw call if batched!
}
```

**Performance**: 100 sprites from a generated texture = potentially 1 draw call. 100 Graphics objects = 100+ draw calls. Always prefer generateTexture for static shapes.

**Warning**: Calling `generateTexture()` repeatedly creates new textures. Each call allocates GPU memory. For dynamic shapes that change, keep the Graphics object and redraw with `clear()` + redraw.

### 6.2 Depth Sorting

```javascript
// Set depth on any game object
sprite.setDepth(100);

// Depth sorting is automatic within a scene
// Higher depth = rendered on top
// Same depth = render order is creation order

// PERFORMANCE: Setting depth queues a sort
// Avoid changing depth every frame if possible
// Sort happens once per frame regardless of how many changes

// Display list operations
this.children.bringToTop(sprite);
this.children.sendToBack(sprite);
this.children.moveUp(sprite);
this.children.moveDown(sprite);
```

**Depth layers pattern** (as used in Rakovinobijec):
```javascript
DEPTH_LAYERS = {
    BACKGROUND: 0,
    LOOT: 100,
    ENEMIES: 1000,
    PLAYER: 1500,
    PROJECTILES: 2000,
    VFX: 3000,
    UI_GAME: 4000,
    UI_OVERLAY: 5000,
};
```

### 6.3 setScrollFactor for UI Elements

```javascript
// Default: scrollFactor = 1 (moves with camera)
// For fixed UI elements:
healthBar.setScrollFactor(0); // stays fixed on screen
scoreText.setScrollFactor(0);

// Partial scroll (parallax):
background.setScrollFactor(0.5); // moves at half camera speed

// Per-axis:
sprite.setScrollFactor(0.5, 1); // half-speed horizontal, normal vertical
```

**Use case**: Any in-game HUD element (health bars, score, minimap) should be `setScrollFactor(0)` to stay fixed on screen regardless of camera position.

### 6.4 Blend Modes

```javascript
// Set blend mode
sprite.setBlendMode(Phaser.BlendModes.ADD);      // additive (glows, fire)
sprite.setBlendMode(Phaser.BlendModes.MULTIPLY);  // darken
sprite.setBlendMode(Phaser.BlendModes.SCREEN);    // lighten

// Available modes (WebGL):
// NORMAL, ADD, MULTIPLY, SCREEN, ERASE, SOURCE_IN, SOURCE_OUT,
// SOURCE_ATOP, DESTINATION_OVER, DESTINATION_IN, DESTINATION_OUT,
// DESTINATION_ATOP, LIGHTER, COPY, XOR

// Canvas mode supports fewer blend modes

// PERFORMANCE WARNING:
// Each blend mode change forces a WebGL batch flush
// Group objects by blend mode to minimize flushes
// Example: render all ADD-mode particles together, then all NORMAL sprites
```

---

## 7. Common Gotchas in 3.80+

### 7.1 Group.getChildren() Returns a Reference, Not a Copy

```javascript
const children = group.getChildren();
// 'children' IS the internal array, not a copy!

// DANGEROUS: Modifying during iteration
for (const child of children) {
    if (child.hp <= 0) {
        child.destroy(); // modifies the array you're iterating!
    }
}

// SAFE: Copy first
const snapshot = [...group.getChildren()];
for (const child of snapshot) {
    if (child.hp <= 0) child.destroy();
}

// SAFE: Use getMatching (returns a new array)
const active = group.getMatching('active', true);
for (const child of active) { /* safe to destroy */ }

// SAFE: Reverse iteration
const children = group.getChildren();
for (let i = children.length - 1; i >= 0; i--) {
    if (children[i].hp <= 0) children[i].destroy();
}
```

### 7.2 TweenChain persist Default Changed

In 3.80, `TweenChainBuilder` changed `persist` from `true` to `false`. If you have tween chains that stopped working after upgrade:

```javascript
// Before 3.80 (implicit persist: true)
this.tweens.chain({ tweens: [...] });

// After 3.80 (must be explicit)
this.tweens.chain({ tweens: [...], persist: true });
```

### 7.3 AnimationFrame Duration Semantic Change

In 3.80, `AnimationFrame.duration` changed meaning:
- **Before**: Additional duration added to `msPerFrame`
- **After**: Complete frame duration (replaces `msPerFrame` for that frame)

If you set custom frame durations, they now represent the TOTAL time, not a delta.

### 7.4 Physics Body Lifecycle Issues

```javascript
// GOTCHA 1: Body exists after destroy()
sprite.destroy();
// sprite.body may still be referenced in collision callbacks this frame
// Always null-check: if (!sprite.active) return;

// GOTCHA 2: enableBody resets velocity
sprite.enableBody(true, x, y, true, true);
// This resets the body! Set velocity AFTER enableBody.
sprite.setVelocity(vx, vy); // must be after enableBody

// GOTCHA 3: Static body not updating
staticSprite.setPosition(newX, newY);
staticSprite.refreshBody(); // MUST call this!

// GOTCHA 4: Overlap still fires after disableBody
// disableBody takes effect next physics step, not immediately
// Add an active check in your callback:
onOverlap(player, pickup) {
    if (!pickup.active) return; // already collected this frame
    pickup.disableBody(true, true);
    this.collectPickup(pickup);
}
```

### 7.5 Scene Shutdown vs Destroy

```javascript
// shutdown: Scene stops but is kept in memory for restart
// destroy: Scene is permanently removed

// Common mistake: cleaning up only in 'destroy'
this.events.on('destroy', cleanup); // WRONG for restartable scenes

// Correct: clean up in 'shutdown' (fires on stop AND on restart)
this.events.on('shutdown', cleanup);
```

### 7.6 iOS Audio Gotchas

- iOS requires user interaction before audio can play. Phaser handles this with an unlock listener, but:
- iOS 17.5.1+: Fixed in Phaser 3.88 -- audio now properly resumes after tab/app switch.
- Always check `this.sound.locked` before assuming audio is available.
- Use `this.sound.once('unlocked', callback)` to handle the unlock event.

### 7.7 Matter.js Tab Dormancy Crash

Fixed in 3.88: `Matter.World.update` could hang and crash the browser if a large delta value accumulated while the tab was dormant. The fix properly passes Runner config values through. No action needed on 3.90.

### 7.8 Chrome 134+ Text Rendering Bug

Fixed in 3.90: Switching between RTL and LTR text objects could cause rendering artifacts. No action needed on 3.90.

### 7.9 DynamicTexture forceEven (3.88+)

`DynamicTexture` and `RenderTexture` now round dimensions to even values by default (`forceEven: true`). This improves rendering quality but may cause 1px size differences. Set `forceEven: false` if you need exact odd dimensions.

---

## Quick Reference Card

### Object Pool Lifecycle
```
create() --> pool.getFirstDead(false) --> enableBody(true, x, y, true, true) --> setVelocity()
                                                                                      |
                                                                                   [active]
                                                                                      |
                                                          disableBody(true, true) <-- [condition met]
                                                                  |
                                                            [back in pool]
```

### Scene Method Decision Tree
```
Need parallel scenes?
  YES --> scene.launch('UI')
  NO  --> Need to come back to current scene?
            YES --> scene.switch('Other') or scene.pause() + scene.run('Modal')
            NO  --> scene.start('Next')
```

### Collision Decision Tree
```
Do objects need to push each other apart?
  YES --> physics.add.collider()
  NO  --> physics.add.overlap()

Need to conditionally skip?
  YES --> Use processCallback (return false to skip)
```

### Event Cleanup Decision Tree
```
Where did you add the listener?
  scene.events --> Auto-cleaned on shutdown (but manual cleanup still recommended)
  game.events  --> YOU MUST clean up in shutdown handler
  Custom bus   --> YOU MUST clean up in shutdown handler
  Game object  --> Cleaned when object is destroyed
```

---

*Compiled March 2026 for Rakovinobijec (Phaser 3.90.0). This is the final Phaser v3 release.*

## Sources

- [Phaser v3.90 Released](https://phaser.io/news/2025/05/phaser-v390-released)
- [Phaser v3.80 Released](https://phaser.io/news/2024/02/phaser-3.80.0-released)
- [Phaser 3.80 Changelog (GitHub)](https://github.com/phaserjs/phaser/blob/master/changelog/3.80/CHANGELOG-v3.80.md)
- [Phaser 3.88 Changelog (GitHub)](https://github.com/phaserjs/phaser/blob/master/changelog/3.88/CHANGELOG-v3.88.md)
- [Phaser 3.85 Changelog (GitHub)](https://github.com/phaserjs/phaser/blob/master/changelog/3.85/CHANGELOG-v3.85.md)
- [Phaser Releases (GitHub)](https://github.com/phaserjs/phaser/releases)
- [How I Optimized My Phaser 3 Action Game in 2025](https://franzeus.medium.com/how-i-optimized-my-phaser-3-action-game-in-2025-5a648753f62b)
- [Arcade Physics Concepts (docs.phaser.io)](https://docs.phaser.io/phaser/concepts/physics/arcade)
- [Arcade Physics Performance Discussion (Phaser Forum)](https://phaser.discourse.group/t/arcade-physics-performance-scalability-and-internals/13010)
- [Scenes Concepts (docs.phaser.io)](https://docs.phaser.io/phaser/concepts/scenes)
- [Scene Events API (docs.phaser.io)](https://docs.phaser.io/api-documentation/event/scenes-events)
- [Cross-Scene Communication (docs.phaser.io)](https://docs.phaser.io/phaser/concepts/scenes/cross-scene-communication)
- [Events Concepts (docs.phaser.io)](https://docs.phaser.io/phaser/concepts/events)
- [EventEmitter API (docs.phaser.io)](https://docs.phaser.io/api-documentation/class/events-eventemitter)
- [Group Concepts (docs.phaser.io)](https://docs.phaser.io/phaser/concepts/gameobjects/group)
- [Group API - Physics.Arcade.Group (docs.phaser.io)](https://docs.phaser.io/api-documentation/class/physics-arcade-group)
- [Time Concepts (docs.phaser.io)](https://docs.phaser.io/phaser/concepts/time)
- [Graphics API (docs.phaser.io)](https://docs.phaser.io/api-documentation/class/gameobjects-graphics)
- [Camera Effects (Rex Notes)](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/camera-effects/)
- [Object Pooling in Phaser 3 (Ourcade)](https://blog.ourcade.co/posts/2020/phaser-3-optimization-object-pool-basic/)
- [Phaser 3 Scenes Summary (Gist by samme)](https://gist.github.com/samme/01a33324a427f626254c1a4da7f9b6a3)
- [Scene Manager Notes (Rex Notes)](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/scenemanager/)
- [Timer Notes (Rex Notes)](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/timer/)
- [Do I Need to Manually Dispose of Event Listeners? (Phaser Forum)](https://phaser.discourse.group/t/do-i-need-to-manually-dispose-of-event-listeners/13429)
- [How to Communicate Between Scenes (Ourcade)](https://blog.ourcade.co/posts/2020/phaser3-how-to-communicate-between-scenes/)
- [Phaser Performance Tips (GitHub Gist)](https://gist.github.com/MarcL/748f29faecc6e3aa679a385bffbdf6fe)
- [Phaser Circle Physics Performance (Phaser Forum)](https://phaser.discourse.group/t/phaser-arcade-physics-circle-performance-questions/6078)
- [Bullet Pools Discussion (Phaser Forum)](https://phaser.discourse.group/t/bullet-pools-phaser-3/7502)
