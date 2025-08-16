/**
 * VfxSystem - Vysokovýkonný particle-based VFX systém
 * Založený na Phaser 3 ParticleEmitterManager
 * Zero-GC design, blueprint-driven, poolované emittery
 */
export class VfxSystem {
  constructor(scene) {
    this.scene = scene;
    this.managers = new Map(); // type -> ParticleEmitterManager
    this.emitters = new Map(); // id -> emitter
    this.activeTrails = new Map(); // sprite -> trail emitter
    this.blueprints = new Map(); // effectId -> config
    
    // Position following system for VFX that should track targets
    this.followingEffects = new Map(); // effect -> {target, emitter, duration, startTime}
    
    // Phase 6: Performance caps and safety
    this.maxEmitters = 24; // Safe cap pro concurrent emitters
    this.maxTrails = 10;   // Max trail efektů současně
    this.flashSafetyInterval = 100; // Min ms mezi flash efekty
    this.lastFlashTime = 0;
    this._performanceMode = { maxEmitters: 24, enableTrails: true }; // Default medium
    
    this.initialized = false;
    this.isShuttingDown = false;
    
    // Missing asset tracking for dev mode
    this.missingAssets = new Set();
    this._initMissingAssetTracking();
  }
  
  /**
   * Initialize missing asset tracking for dev mode
   * @private
   */
  _initMissingAssetTracking() {
    if (typeof window !== 'undefined') {
      window.__missingAssets = window.__missingAssets || { sfx: new Set(), vfx: new Set() };
    }
  }
  
  /**
   * Inicializace systému - volat v scene.create()
   */
  initialize() {
    if (this.initialized) return;
    
    // Vytvoření základních textur
    this._createParticleTextures();
    
    // Inicializace particle managerů
    this._initializeManagers();
    
    // Registrace cleanup handlerů
    this.scene.events.once('shutdown', () => this.shutdown());
    this.scene.events.once('destroy', () => this.destroy());
    
    this.initialized = true;
    console.log('[VfxSystem] Initialized with pooled particle emitters');
  }
  
  /**
   * Update method to handle following effects - call this from scene.update()
   * @param {number} time - Current time
   * @param {number} delta - Time delta
   */
  update(time, delta) {
    if (!this.initialized || this.isShuttingDown) return;
    
    // Update position following effects
    for (const [effectId, effectData] of this.followingEffects.entries()) {
      const { target, emitter, duration, startTime } = effectData;
      
      // Check if effect should expire
      if (duration && (time - startTime) > duration) {
        this._stopFollowingEffect(effectId);
        continue;
      }
      
      // Check if target is still valid
      if (!target || !target.active || target.hp <= 0) {
        this._stopFollowingEffect(effectId);
        continue;
      }
      
      // Update emitter position to follow target
      if (emitter && emitter.active) {
        emitter.setPosition(target.x, target.y);
      }
    }
  }
  
  /**
   * Vytvoří základní textury pro částice (jednorázově)
   * @private
   */
  _createParticleTextures() {
    // PR7: Use factory pattern instead of direct scene.add
    const graphics = this._createGraphics();
    
    // Základní dot textura (2x2 px)
    if (!this.scene.textures.exists('vfx_dot')) {
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(1, 1, 1);
      graphics.generateTexture('vfx_dot', 2, 2);
    }
    
    // Spark textura (4x4 px s glow)
    if (!this.scene.textures.exists('vfx_spark')) {
      graphics.clear();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(2, 2, 1);
      graphics.fillStyle(0xffffff, 0.3);
      graphics.fillCircle(2, 2, 2);
      graphics.generateTexture('vfx_spark', 4, 4);
    }
    
    // Smoke textura (8x8 px)
    if (!this.scene.textures.exists('vfx_smoke')) {
      graphics.clear();
      graphics.fillStyle(0x888888, 0.4);
      graphics.fillCircle(4, 4, 4);
      graphics.generateTexture('vfx_smoke', 8, 8);
    }
    
    // Star textura pro energy efekty
    if (!this.scene.textures.exists('vfx_star')) {
      graphics.clear();
      graphics.fillStyle(0xffffff, 1);
      graphics.beginPath();
      const cx = 4, cy = 4, spikes = 5, outerRadius = 4, innerRadius = 2;
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / spikes;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) graphics.moveTo(x, y);
        else graphics.lineTo(x, y);
      }
      graphics.closePath();
      graphics.fillPath();
      graphics.generateTexture('vfx_star', 8, 8);
    }
    
    // Explosion particle textura (6x6 px s gradient)
    if (!this.scene.textures.exists('explosion_particle')) {
      graphics.clear();
      graphics.fillStyle(0xff4400, 1);     // Orange core
      graphics.fillCircle(3, 3, 2);
      graphics.fillStyle(0xff6600, 0.8);   // Orange-red middle
      graphics.fillCircle(3, 3, 2.5);
      graphics.fillStyle(0xff8800, 0.4);   // Yellow outer
      graphics.fillCircle(3, 3, 3);
      graphics.generateTexture('explosion_particle', 6, 6);
    }

    // Blood particle textura (4x4 px červená)
    if (!this.scene.textures.exists('blood_particle')) {
      graphics.clear();
      graphics.fillStyle(0x880000, 1);     // Dark red
      graphics.fillCircle(2, 2, 2);
      graphics.generateTexture('blood_particle', 4, 4);
    }

    // XP particle textura (3x3 px modrá)
    if (!this.scene.textures.exists('xp_particle')) {
      graphics.clear();
      graphics.fillStyle(0x0066ff, 1);     // Blue
      graphics.fillCircle(1.5, 1.5, 1.5);
      graphics.generateTexture('xp_particle', 3, 3);
    }

    // White circle textura (4x4 px)
    if (!this.scene.textures.exists('white_circle')) {
      graphics.clear();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(2, 2, 2);
      graphics.generateTexture('white_circle', 4, 4);
    }

    // White square textura (4x4 px)
    if (!this.scene.textures.exists('white_square')) {
      graphics.clear();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(0, 0, 4, 4);
      graphics.generateTexture('white_square', 4, 4);
    }

    // Store fallback map for runtime use
    this.textureFallbacks = {
      'metal_spark': 'vfx_spark',
      'trail_particle': 'vfx_dot',
      'fire_particle': 'explosion_particle',
      'organic_particle': 'blood_particle',
      'boss_particle': 'vfx_star',
      'spawn_particle': 'vfx_dot',
      'boss_spawn_particle': 'vfx_star',
      'power_particle': 'vfx_star',
      'muzzle_particle': 'vfx_spark',
      'energy_particle': 'vfx_star',
      'spark': 'vfx_spark'
    };
    
    graphics.destroy();
  }

  /**
   * Získá texturu s fallback podporou
   * @private
   */
  _getTextureKey(textureKey) {
    if (this.scene.textures.exists(textureKey)) {
      return textureKey;
    }
    
    const fallback = this.textureFallbacks?.[textureKey];
    if (fallback && this.scene.textures.exists(fallback)) {
      return fallback;
    }
    
    // Ultimate fallback
    return 'vfx_dot';
  }
  
  /**
   * Inicializuje particle emittery pro Phaser 3.60+
   * @private
   */
  _initializeManagers() {
    // Hit sparks emitter
    // PR7: Use factory pattern for particle creation
    const hitEmitter = this._createParticleEmitter(0, 0, 'vfx_spark', {
      speed: { min: 100, max: 250 },
      scale: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      lifespan: 200,
      emitting: false
    });
    this.emitters.set('hitSpark', hitEmitter);
    
    // Explosion emitter
    const explosionEmitter = this._createParticleEmitter(0, 0, 'explosion_particle', {
      speed: { min: 200, max: 400 },
      scale: { start: 2, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      lifespan: 400,
      emitting: false
    });
    this.emitters.set('explosion', explosionEmitter);
    
    // Blood/damage emitter
    const bloodEmitter = this._createParticleEmitter(0, 0, 'vfx_dot', {
      speed: { min: 80, max: 180 },
      scale: { start: 1, end: 0.5 },
      gravityY: 300,
      lifespan: 400,
      emitting: false
    });
    this.emitters.set('blood', bloodEmitter);
    
    // Trail emittery se vytváří dynamicky
    
    // Energy/pickup emitter
    const energyEmitter = this._createParticleEmitter(0, 0, 'vfx_star', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.8, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      lifespan: 600,
      angle: { min: 0, max: 360 },
      emitting: false
    });
    this.emitters.set('energy', energyEmitter);
    
    // Smoke emitter
    const smokeEmitter = this._createParticleEmitter(0, 0, 'vfx_smoke', {
      speed: { min: 20, max: 60 },
      scale: { start: 1, end: 2 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 800,
      emitting: false
    });
    this.emitters.set('smoke', smokeEmitter);
  }
  
  /**
   * Registruje blueprint pro efekt
   * @param {string} id 
   * @param {object} config 
   */
  registerBlueprint(id, config) {
    this.blueprints.set(id, config);
  }
  
  /**
   * Získá blueprint config nebo default
   * @private
   */
  _getBlueprint(id, type) {
    // Nejdřív zkusit specifický blueprint
    if (this.blueprints.has(id)) {
      return this.blueprints.get(id);
    }
    
    // Fallback na default konfigurace
    const defaults = {
      hitSpark: {
        quantity: 8,
        speed: { min: 100, max: 250 },
        scale: { start: 1, end: 0 },
        lifespan: 200,
        tint: 0xffee88,
        angle: { min: 0, max: 360 }
      },
      explosion: {
        quantity: 24,
        speed: { min: 200, max: 400 },
        scale: { start: 2, end: 0 },
        lifespan: 400,
        tint: 0xffaa00,
        angle: { min: 0, max: 360 },
        cameraShake: { duration: 150, intensity: 0.01 },
        cameraFlash: { duration: 100, r: 255, g: 200, b: 0 }
      },
      blood: {
        quantity: 10,
        speed: { min: 80, max: 180 },
        scale: { start: 1, end: 0.5 },
        lifespan: 400,
        tint: 0xcc0000,
        gravityY: 300,
        angle: { min: -45, max: 45 }
      },
      energy: {
        quantity: 12,
        speed: { min: 50, max: 150 },
        scale: { start: 0.8, end: 0 },
        lifespan: 600,
        tint: 0x00ff00,
        angle: { min: 0, max: 360 }
      },
      trail: {
        frequency: 20,
        quantity: 1,
        speed: { min: 10, max: 30 },
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.7, end: 0 },
        lifespan: 150,
        tint: 0x4488ff
      },
      smoke: {
        quantity: 6,
        speed: { min: 20, max: 60 },
        scale: { start: 1, end: 2 },
        alpha: { start: 0.6, end: 0 },
        lifespan: 800,
        tint: 0x666666,
        angle: { min: -30, max: 30 }
      }
    };
    
    return defaults[type] || defaults.hitSpark;
  }
  
  /**
   * Aplikuje blueprint config na emitter (zero-GC)
   * @private
   */
  _applyConfig(emitter, config) {
    // Aplikujeme pouze pokud hodnoty existují
    if (config.speed) emitter.setSpeed(config.speed);
    if (config.scale) emitter.setScale(config.scale);
    if (config.lifespan) emitter.setLifespan(config.lifespan);
    if (config.alpha) emitter.setAlpha(config.alpha);
    if (config.tint) emitter.setTint(config.tint);
    if (config.angle) emitter.setAngle(config.angle);
    if (config.gravityY !== undefined) emitter.setGravityY(config.gravityY);
    if (config.gravityX !== undefined) emitter.setGravityX(config.gravityX);
    if (config.frequency !== undefined) emitter.frequency = config.frequency;
    if (config.blendMode !== undefined) emitter.blendMode = config.blendMode;
  }
  
  // === PUBLIC API ===
  
  /**
   * Přehraje hit spark efekt
   * @param {number} x 
   * @param {number} y 
   * @param {string} blueprintId 
   */
  playHitSpark(x, y, blueprintId = 'default') {
    // Check if shutting down
    if (this.isShuttingDown || !this.scene) return;
    
    // Phase 6: Enforce caps before playing
    this._enforceEmitterCap();
    
    const emitter = this.emitters.get('hitSpark');
    if (!emitter) return;
    
    const config = this._getBlueprint(blueprintId, 'hitSpark');
    
    // Set position and explode particles
    emitter.setPosition(x, y);
    emitter.explode(config.quantity || 8);
    
    // Optional camera shake
    if (config.cameraShake) {
      this.scene.cameras.main.shake(
        config.cameraShake.duration || 50,
        config.cameraShake.intensity || 0.002
      );
    }
  }
  
  /**
   * Přehraje explozi
   * @param {number} x 
   * @param {number} y 
   * @param {string} blueprintId 
   */
  playExplosion(x, y, blueprintId = 'default') {
    const emitter = this.emitters.get('explosion');
    if (!emitter) return;
    
    const config = this._getBlueprint(blueprintId, 'explosion');
    
    // Set position and explode
    emitter.setPosition(x, y);
    emitter.explode(config.quantity || 24);
    
    // Camera effects
    if (config.cameraShake) {
      this.scene.cameras.main.shake(
        config.cameraShake.duration || 150,
        config.cameraShake.intensity || 0.01
      );
    }
    
    if (config.cameraFlash) {
      const f = config.cameraFlash;
      this.scene.cameras.main.flash(
        f.duration || 100,
        f.r || 255,
        f.g || 200,
        f.b || 0,
        f.force || false
      );
    }
    
    // Optional light (if Lights2D enabled)
    if (config.light && this.scene.lights?.active) {
      const light = this.scene.lights.addLight(
        x, y,
        config.light.radius || 200,
        config.light.color || 0xffaa00,
        config.light.intensity || 2
      );
      
      // Fade out
      this.scene.time.delayedCall(config.light.duration || 200, () => {
        this.scene.lights.removeLight(light);
      });
    }
  }
  
  /**
   * Přehraje blood splatter
   * @param {number} x 
   * @param {number} y 
   * @param {number} angle - směr odkud přišel zásah
   * @param {string} blueprintId 
   */
  playBloodSplatter(x, y, angle = 0, blueprintId = 'default') {
    const emitter = this.emitters.get('blood');
    if (!emitter) return;
    
    const config = this._getBlueprint(blueprintId, 'blood');
    
    // Nastavit směr podle úhlu zásahu
    const spreadAngle = 45;
    config.angle = {
      min: (angle * 180/Math.PI) - spreadAngle,
      max: (angle * 180/Math.PI) + spreadAngle
    };
    
    emitter.setPosition(x, y);
    emitter.explode(config.quantity || 10);
  }
  
  /**
   * Přehraje energy burst (pickup efekt)
   * @param {number} x 
   * @param {number} y 
   * @param {string} blueprintId 
   */
  playEnergyBurst(x, y, blueprintId = 'default') {
    const emitter = this.emitters.get('energy');
    if (!emitter) return;
    
    const config = this._getBlueprint(blueprintId, 'energy');
    
    emitter.setPosition(x, y);
    emitter.explode(config.quantity || 12);
    
    // Optional flash
    if (config.cameraFlash) {
      const f = config.cameraFlash;
      this.scene.cameras.main.flash(
        f.duration || 200,
        f.r || 100,
        f.g || 255,
        f.b || 100
      );
    }
  }
  
  /**
   * Přehraje smoke efekt
   * @param {number} x 
   * @param {number} y 
   * @param {string} blueprintId 
   */
  playSmoke(x, y, blueprintId = 'default') {
    const emitter = this.emitters.get('smoke');
    if (!emitter) return;
    
    const config = this._getBlueprint(blueprintId, 'smoke');
    
    emitter.setPosition(x, y);
    emitter.explode(config.quantity || 6);
  }
  
  /**
   * Připojí trail k projektilu
   * @param {Phaser.GameObjects.Sprite} projectile 
   * @param {string} blueprintId 
   */
  attachTrail(projectile, blueprintId = 'default') {
    if (!projectile || this.activeTrails.has(projectile)) return;
    
    const manager = this.managers.get('trail');
    if (!manager) return;
    
    const config = this._getBlueprint(blueprintId, 'trail');
    
    // Vytvořit emitter pro tento projektil
    const trail = manager.createEmitter({
      x: projectile.x,
      y: projectile.y,
      speed: config.speed || { min: 10, max: 30 },
      scale: config.scale || { start: 0.6, end: 0 },
      alpha: config.alpha || { start: 0.7, end: 0 },
      lifespan: config.lifespan || 150,
      frequency: config.frequency || 20,
      quantity: config.quantity || 1,
      tint: config.tint || 0x4488ff,
      blendMode: config.blendMode || Phaser.BlendModes.ADD,
      on: true
    });
    
    // Follow projektil
    trail.startFollow(projectile);
    this.activeTrails.set(projectile, trail);
  }
  
  /**
   * Odpojí trail od projektilu
   * @param {Phaser.GameObjects.Sprite} projectile 
   */
  detachTrail(projectile) {
    const trail = this.activeTrails.get(projectile);
    if (!trail) return;
    
    trail.stopFollow();
    trail.stop();
    
    // Cleanup po doběhnutí částic
    this.scene.time.delayedCall(500, () => {
      if (trail.manager) {
        trail.manager.removeEmitter(trail);
      }
    });
    
    this.activeTrails.delete(projectile);
  }
  
  /**
   * Player hurt flash
   */
  playPlayerHurt() {
    // Camera flash (červený)
    this.scene.cameras.main.flash(100, 255, 50, 50);
    
    // Player white tint
    const player = this.scene.player;
    if (player?.sprite) {
      player.sprite.setTintFill(0xffffff);
      this.scene.time.delayedCall(100, () => {
        player.sprite?.clearTint();
      });
    }
  }
  
  /**
   * Boss telegraph warning
   * @param {number} x 
   * @param {number} y 
   * @param {number} angle 
   * @param {number} range 
   * @param {number} duration 
   * @param {number} color 
   */
  playTelegraph(x, y, angle, range, duration = 1000, color = 0xff0000) {
    // PR7: Use factory pattern
    const graphics = this._createGraphics();
    
    // Cone shape
    const spread = Math.PI / 8;
    graphics.fillStyle(color, 0.2);
    graphics.beginPath();
    graphics.moveTo(x, y);
    
    for (let a = -spread; a <= spread; a += spread/4) {
      const px = x + Math.cos(angle + a) * range;
      const py = y + Math.sin(angle + a) * range;
      graphics.lineTo(px, py);
    }
    
    graphics.closePath();
    graphics.fillPath();
    
    // Pulse animation
    this.scene.tweens.add({
      targets: graphics,
      alpha: { from: 0.2, to: 0.5 },
      duration: 200,
      yoyo: true,
      repeat: Math.floor(duration / 400),
      onComplete: () => graphics.destroy()
    });
  }
  
  /**
   * Unified play method for blueprint integration
   * Automatically routes to correct play method based on VFX registry
   * @param {string} vfxId - ID from VFX registry
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {object} overrides - Optional parameter overrides (can include followTarget)
   */
  play(vfxIdOrConfig, x, y, overrides = {}) {
    // Check if system is shutting down
    if (!this.scene || this.isShuttingDown) return;
    
    // PHASE 2: Smart detection - Registry ID vs Direct VFX Config
    const isDirectConfig = this._isDirectVFXConfig(vfxIdOrConfig);
    
    if (isDirectConfig) {
      return this._playDirectVFXConfig(vfxIdOrConfig, x, y, overrides);
    } else {
      return this._playFromRegistry(vfxIdOrConfig, x, y, overrides);
    }
  }
  
  /**
   * Detect if input is direct VFX config or registry ID
   * @private
   */
  _isDirectVFXConfig(input) {
    // If it's an object, it's likely a direct config
    if (typeof input === 'object' && input !== null) {
      return true;
    }
    
    // If it's a string starting with 'vfx.', it's a registry ID
    if (typeof input === 'string' && input.startsWith('vfx.')) {
      return false;
    }
    
    return false; // Default to registry lookup
  }
  
  /**
   * Play VFX from direct config object
   * @private
   */
  _playDirectVFXConfig(config, x, y, overrides = {}) {
    if (!config || typeof config !== 'object') {
      console.warn('[VFXSystem] Invalid direct VFX config:', config);
      return;
    }
    
    // Merge config with overrides
    const finalConfig = { ...config, ...overrides };
    
    // Route based on config type or fallback to effect detection
    const effectType = finalConfig.type || this._detectEffectType(finalConfig);
    
    switch (effectType) {
      case 'hit':
      case 'spark':
        this.playHitSpark(x, y, finalConfig);
        break;
      case 'explosion':
        this.playExplosion(x, y, finalConfig);
        break;
      case 'energy':
      case 'pickup':
        this.playEnergyBurst(x, y, finalConfig);
        break;
      case 'blood':
        this.playBloodSplatter(x, y, 0, finalConfig);
        break;
      case 'smoke':
        this.playSmoke(x, y, finalConfig);
        break;
      default:
        // Generic particle effect
        this.playHitSpark(x, y, finalConfig);
        break;
    }
  }
  
  /**
   * Play VFX from registry (legacy support)
   * @private
   */
  _playFromRegistry(vfxId, x, y, overrides = {}) {
    // Try to play effect immediately with fallback handling
    try {
      // Check if this is a boss phase effect that should follow the target
      const shouldFollow = vfxId.includes('phase') && overrides.followTarget;
      
      if (shouldFollow) {
        return this._playFollowingEffect(vfxId, x, y, overrides);
      }
      
      // Route to appropriate method based on VFX type/category
      switch (true) {
        case vfxId.includes('hit'):
          return this.playHitSpark(x, y, vfxId);
        case vfxId.includes('explosion'):
          return this.playExplosion(x, y, vfxId);
        case vfxId.includes('pickup') || vfxId.includes('energy'):
          return this.playEnergyBurst(x, y, vfxId);
        case vfxId.includes('blood'):
          return this.playBloodSplatter(x, y, 0, vfxId);
        case vfxId.includes('smoke'):
          return this.playSmoke(x, y, vfxId);
        case vfxId.includes('phase'):
          // Boss phase effects - create burst effect at position
          return this.playExplosion(x, y, 'boss_phase');
        default:
          // Generic spark effect as fallback
          return this.playHitSpark(x, y, 'default');
      }
    } catch (e) {
      console.debug(`[VFXSystem] Failed to play VFX '${vfxId}':`, e.message);
      // Final fallback - simple spark at position
      try {
        return this.playHitSpark(x, y, 'default');
      } catch (fallbackError) {
        // Silent fail - don't break gameplay
        console.debug(`[VFXSystem] VFX fallback also failed:`, fallbackError.message);
      }
    }
  }
  
  /**
   * Auto-detect effect type from config
   * @private
   */
  _detectEffectType(config) {
    // Try to guess from config properties
    if (config.lifespan && config.lifespan < 200) return 'hit';
    if (config.quantity && config.quantity > 15) return 'explosion';
    if (config.texture === 'energy' || config.color === 'blue') return 'energy';
    if (config.texture === 'blood' || config.color === 'red') return 'blood';
    if (config.alpha && config.alpha < 0.7) return 'smoke';
    
    return 'spark'; // Default fallback
  }
  
  /**
   * Play a following effect that tracks a target
   * @private
   */
  _playFollowingEffect(vfxId, x, y, overrides = {}) {
    const { followTarget, duration = 5000 } = overrides;
    
    if (!followTarget) {
      // No target to follow, play normal effect
      return this.playExplosion(x, y, vfxId);
    }
    
    try {
      // Create a continuous emitter that follows the target
      const emitter = this._createParticleEmitter(x, y, 'vfx_star', {
        speed: { min: 50, max: 100 },
        scale: { start: 1.5, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        lifespan: 500,
        frequency: 100,
        quantity: 2,
        tint: 0x4CAF50, // Green for radiation
        emitting: true
      });
      
      // Store following effect data
      const effectId = `${vfxId}_${Date.now()}`;
      this.followingEffects.set(effectId, {
        target: followTarget,
        emitter: emitter,
        duration: duration,
        startTime: this.scene.time.now
      });
      
      console.log(`[VFXSystem] Started following effect ${vfxId} on target`);
      return emitter;
    } catch (error) {
      console.warn(`[VFXSystem] Failed to create following effect:`, error);
      // Fallback to normal effect
      return this.playExplosion(x, y, 'boss_phase');
    }
  }
  
  /**
   * Stop a following effect
   * @private
   */
  _stopFollowingEffect(effectId) {
    const effectData = this.followingEffects.get(effectId);
    if (!effectData) return;
    
    const { emitter } = effectData;
    if (emitter && emitter.active) {
      emitter.stop();
      // Clean up after particles finish
      this.scene.time.delayedCall(1000, () => {
        if (emitter.manager) {
          emitter.manager.destroy();
        }
      });
    }
    
    this.followingEffects.delete(effectId);
    console.log(`[VFXSystem] Stopped following effect ${effectId}`);
  }

  /**
   * Debug nástroje pro Phase 5
   */
  getDebugStats() {
    return {
      activeEmitters: this.emitters.size,
      activeTrails: this.activeTrails.size,
      particleManagers: this.managers.size,
      registeredBlueprints: this.blueprints.size,
      initialized: this.initialized
    };
  }

  /**
   * Logování aktivních efektů
   */
  logActiveEffects() {
    const stats = this.getDebugStats();
    console.log('[VFXSystem Debug]', stats);
    
    console.log('Active trails:', Array.from(this.activeTrails.keys()).map(proj => proj.constructor.name));
    console.log('Particle managers:', Array.from(this.managers.keys()));
    console.log('Registered blueprints:', Array.from(this.blueprints.keys()));
  }

  /**
   * Phase 6: Safety caps a limits
   */
  setMaxEmitters(count) {
    this.maxEmitters = Math.max(1, Math.min(50, count));
    console.log(`[VFXSystem] Max emitters set to: ${this.maxEmitters}`);
    
    // Pokud překračujeme limit, zastavit nejstarší
    this._enforceEmitterCap();
  }

  setMaxTrails(count) {
    this.maxTrails = Math.max(0, Math.min(20, count));
    console.log(`[VFXSystem] Max trails set to: ${this.maxTrails}`);
    
    // Pokud překračujeme limit, odpojit nejstarší trails
    this._enforceTrailCap();
  }

  _enforceEmitterCap() {
    const activeCount = this._getActiveEmitterCount();
    if (activeCount > this.maxEmitters) {
      const toStop = activeCount - this.maxEmitters;
      console.warn(`[VFXSystem] Emitter cap exceeded (${activeCount}/${this.maxEmitters}), stopping ${toStop} oldest`);
      
      // Stop nejstarší emittery (simplified approach)
      let stopped = 0;
      for (const emitter of this.emitters.values()) {
        if (emitter.on && stopped < toStop) {
          emitter.stop();
          stopped++;
        }
      }
    }
  }

  _enforceTrailCap() {
    if (this.activeTrails.size > this.maxTrails) {
      const toRemove = this.activeTrails.size - this.maxTrails;
      console.warn(`[VFXSystem] Trail cap exceeded (${this.activeTrails.size}/${this.maxTrails}), removing ${toRemove} oldest`);
      
      // Odpojit nejstarší trails
      let removed = 0;
      for (const [projectile, trail] of this.activeTrails) {
        if (removed < toRemove) {
          this.detachTrail(projectile);
          removed++;
        } else {
          break;
        }
      }
    }
  }

  _getActiveEmitterCount() {
    let active = 0;
    for (const emitter of this.emitters.values()) {
      if (emitter.on || emitter.active) active++;
    }
    return active;
  }

  /**
   * Flash safety guard - prevence photo-sensitive issues
   */
  _canDoFlash() {
    const now = this.scene.time.now;
    if (now - this.lastFlashTime < this.flashSafetyInterval) {
      return false;
    }
    this.lastFlashTime = now;
    return true;
  }

  /**
   * Phase 5: Performance nastavení pro VFX
   */
  setPerformanceMode(mode) {
    const modes = {
      low: {
        maxParticles: 50,
        maxEmitters: 5,
        enableTrails: false,
        particleScale: 0.5,
        lifespanMultiplier: 0.7,
        description: 'Minimální VFX pro slabá zařízení'
      },
      medium: {
        maxParticles: 200,
        maxEmitters: 10,
        enableTrails: true,
        particleScale: 0.8,
        lifespanMultiplier: 0.85,
        description: 'Standardní kvalita VFX'
      },
      high: {
        maxParticles: 500,
        maxEmitters: 20,
        enableTrails: true,
        particleScale: 1.0,
        lifespanMultiplier: 1.0,
        description: 'Plná kvalita VFX'
      }
    };
    
    const config = modes[mode];
    if (!config) {
      console.warn(`[VFXSystem] Unknown performance mode: ${mode}`);
      return;
    }
    
    this._performanceMode = config;
    console.log(`[VFXSystem] Applied performance mode: ${mode} - ${config.description}`);
    
    // Aplikovat nastavení na existující emittery
    for (const emitter of this.emitters.values()) {
      if (emitter.setQuantity) {
        const currentQuantity = emitter.quantity || 10;
        const newQuantity = Math.min(currentQuantity, config.maxParticles / this.emitters.size);
        emitter.setQuantity(newQuantity);
      }
      if (emitter.setScale && config.particleScale !== 1.0) {
        const currentScale = emitter.scaleX || { start: 1, end: 0 };
        if (typeof currentScale === 'object') {
          emitter.setScale({
            start: currentScale.start * config.particleScale,
            end: currentScale.end * config.particleScale
          });
        }
      }
    }
  }

  /**
   * Test všech registrovaných efektů
   */
  testAllEffects(x = 400, y = 300) {
    import('./VFXRegistry.js').then(({ vfxRegistry }) => {
      const effects = vfxRegistry.listAll();
      console.log(`[VFXSystem] Testing ${effects.length} effects...`);
      
      effects.forEach((effect, index) => {
        this.scene.time.delayedCall(index * 300, () => {
          console.log(`[VFXSystem] Testing: ${effect.id}`);
          this.play(effect.id, x, y);
        });
      });
    });
  }

  /**
   * Cleanup při shutdown scény
   */
  shutdown() {
    this.isShuttingDown = true;
    
    // Stop all following effects
    for (const effectId of this.followingEffects.keys()) {
      this._stopFollowingEffect(effectId);
    }
    this.followingEffects.clear();
    
    // Detach všechny trails
    for (const projectile of this.activeTrails.keys()) {
      this.detachTrail(projectile);
    }
    
    // Stop všechny emittery
    for (const emitter of this.emitters.values()) {
      emitter.stop();
    }
    
    console.log('[VfxSystem] Shutdown');
  }
  
  /**
   * Úplná destrukce systému
   */
  destroy() {
    this.shutdown();
    
    // Destroy managery
    for (const manager of this.managers.values()) {
      manager.destroy();
    }
    
    this.managers.clear();
    this.emitters.clear();
    this.blueprints.clear();
    this.initialized = false;
    
    console.log('[VfxSystem] Destroyed');
  }
  
  // ==========================================
  // Soft Fallback Methods
  // ==========================================
  
  /**
   * Track missing VFX asset and update dev mode tracking
   * @private
   */
  _trackMissingAsset(vfxId, textureKey = null) {
    const assetInfo = textureKey ? `${vfxId} (${textureKey})` : vfxId;
    
    // Add to local tracking
    this.missingAssets.add(assetInfo);
    
    // Add to global tracking for dev overlay
    if (typeof window !== 'undefined' && window.__missingAssets) {
      window.__missingAssets.vfx.add(assetInfo);
    }
    
    // Log warning in dev mode
    const isDevMode = window.DEV_MODE === true || (this.scene.game && this.scene.game.config.physics.arcade?.debug);
    if (isDevMode) {
      console.warn(`[VFXSystem] Missing asset: ${assetInfo}`);
    }
  }
  
  /**
   * Play a soft fallback effect when asset is missing
   * @private
   */
  _playFallback(x, y, vfxId, reason) {
    // Only play fallback in dev mode
    const isDevMode = window.DEV_MODE === true || (this.scene.game && this.scene.game.config.physics.arcade?.debug);
    if (!isDevMode) {
      return;
    }
    
    try {
      // Create a simple puff effect using available textures
      const fallbackTexture = this.scene.textures.exists('vfx_dot') ? 'vfx_dot' : 
                             this.scene.textures.exists('white_circle') ? 'white_circle' : null;
      
      if (fallbackTexture) {
        const puff = this._createParticleEmitter(x, y, fallbackTexture, {
          speed: { min: 20, max: 60 },
          scale: { start: 0.3, end: 0 },
          lifespan: 200,
          quantity: 3,
          tint: reason === 'missing_registry' ? 0xFF0000 : 0xFFFF00,
          emitting: false
        });
        
        puff.explode(3);
        
        // Clean up after effect
        this.scene.time.delayedCall(300, () => {
          if (puff && puff.manager) {
            puff.manager.destroy();
          }
        });
      }
    } catch (error) {
      // Silent fail - we don't want fallback to crash the game
      console.error('[VFXSystem] Fallback failed:', error);
    }
  }
  
  /**
   * Wrapper for VFX play methods with fallback support
   * @private
   */
  _playWithFallback(methodName, x, y, vfxId, originalMethod, ...args) {
    try {
      // Check if VFX exists in registry
      if (vfxId && !this.blueprints.has(vfxId)) {
        this._trackMissingAsset(vfxId);
        this._playFallback(x, y, vfxId, 'missing_registry');
      }
      
      // Try to execute original method
      return originalMethod.call(this, x, y, ...args);
    } catch (error) {
      // Track error and play fallback
      this._trackMissingAsset(vfxId || methodName, error.message);
      this._playFallback(x, y, vfxId || methodName, 'execution_error');
      
      const isDevMode = window.DEV_MODE === true || (this.scene.game && this.scene.game.config.physics.arcade?.debug);
      if (isDevMode) {
        console.error(`[VFXSystem] Error in ${methodName}:`, error);
      }
    }
  }
  
  // ==========================================
  // PR7 Factory Methods - Replace Direct Calls
  // ==========================================
  
  /**
   * Factory method for creating graphics objects
   * PR7 compliant - uses GraphicsFactory
   * @returns {Phaser.GameObjects.Graphics}
   * @private
   */
  _createGraphics() {
    // PR7: Use GraphicsFactory if available
    if (this.scene.graphicsFactory) {
      return this.scene.graphicsFactory.create();
    }
    
    // Fallback warning
    console.warn('[VFXSystem] GraphicsFactory not available, falling back to direct creation');
    if (!this.scene || !this.scene.add) {
      throw new Error('[VFXSystem] Scene not available for graphics creation');
    }
    return this.scene.add.graphics();
  }
  
  /**
   * Factory method for creating particle emitters
   * @param {number} x - X position
   * @param {number} y - Y position  
   * @param {string} texture - Texture key
   * @param {Object} config - Emitter configuration
   * @returns {Phaser.GameObjects.Particles.ParticleEmitter}
   * @private
   */
  _createParticleEmitter(x, y, texture, config) {
    // PR7: Centralized particle creation with pooling potential
    if (!this.scene || !this.scene.add) {
      throw new Error('[VFXSystem] Scene not available for particle creation');
    }
    
    // Could implement pooling here in the future
    return this.scene.add.particles(x, y, texture, config);
  }
}

export default VfxSystem;