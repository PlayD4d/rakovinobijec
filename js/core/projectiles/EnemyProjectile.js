// EnemyProjectile - Mirror of PlayerProjectile for enemy bullets
// Same optimizations: extends Sprite, preUpdate lifecycle, zero-GC

import { GameConstants } from '../GameConstants.js';

export class EnemyProjectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'bullet8'); // Same texture for now, can be different
    
    // DON'T configure physics body in constructor - body is null!
    // Physics body setup happens in fire() after enableBody()
    
    // Properties for lifecycle management
    this._life = 0;
    this.damage = 0;
    this.tracking = false; // For homing projectiles
    this.sourceType = null; // e.g., 'boss:Karcinogenní Král'
    
    // Blueprint-driven homing properties - set once in fire()
    this._blueprint = null;    // Homing blueprint (from GameConstants.HOMING)
    this._aimError = 0;        // Persistent aim error (rad)
    this._turnRate = 0;        // Turn rate from blueprint (rad/s)
    this._baseSpeed = 0;       // Original speed before homing modifications
    this._homingSpeed = 0;     // Speed during homing
    this._delayMs = 0;         // Straight flight delay before homing
    this._lifeMaxMs = 0;       // Max lifespan from blueprint
    this._homingOn = false;    // Whether homing is active
    this._sinceFire = 0;       // Time since firing (ms)
  }
  
  /**
   * Fire enemy projectile with zero-GC API (scalars only)
   * @param {number} x - Start X position
   * @param {number} y - Start Y position  
   * @param {number} dirX - Direction X (will be normalized)
   * @param {number} dirY - Direction Y (will be normalized)
   * @param {number} speed - Speed in px/s
   * @param {number} range - Range in px (for lifespan calculation)
   * @param {number} damage - Damage value
   * @param {boolean|string} tracking - Enable homing (true = DEFAULT blueprint, string = specific blueprint name)
   * @param {string} sourceType - Source identifier (e.g., 'boss:metastaza')
   * @param {number} tint - Color tint (default red)
   */
  fire(x, y, dirX, dirY, speed, range, damage, tracking = false, sourceType = null, tint = 0xff0000) {
    // Normalize direction without object allocation
    const len = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / len;
    const ny = dirY / len;
    
    // Resolve blueprint for homing behavior
    this._blueprint = null;
    if (tracking) {
      const blueprintName = typeof tracking === 'string' ? tracking : 'DEFAULT';
      this._blueprint = GameConstants.HOMING[blueprintName.toUpperCase()];
      
      if (!this._blueprint) {
        console.warn(`[EnemyProjectile] Unknown homing blueprint: ${blueprintName}, using DEFAULT`);
        this._blueprint = GameConstants.HOMING.DEFAULT;
      }
    }
    
    // Safety check - ensure physics body exists
    if (!this.body) {
      this.scene.physics.world.enable(this);
    }
    
    // Calculate muzzle offset (enemies can have custom offset)
    const muzzleOffset = this._blueprint?.muzzleOffset ?? 0; // Usually 0 for enemies
    const spawnX = x + nx * muzzleOffset;
    const spawnY = y + ny * muzzleOffset;
    
    // Enable body and set position
    this.enableBody(true, spawnX, spawnY, true, true);
    
    // Configure physics body
    this.body.setAllowGravity(false);
    this.setCircle(2); // Smaller than player bullets
    this.setCollideWorldBounds(true);
    this.body.onWorldBounds = true; // Enable world bounds events
    
    // Basic properties
    this.damage = damage;
    this.tracking = !!tracking;
    this.sourceType = sourceType;
    this.setTint(tint);
    
    // Set initial direction and speed
    this.rotation = Math.atan2(ny, nx);
    this._baseSpeed = speed;
    
    if (this._blueprint) {
      // Blueprint-driven homing configuration
      this._aimError = (Math.random() - 0.5) * this._blueprint.aimErrorMax;
      this._turnRate = this._blueprint.turnRate;
      this._delayMs = this._blueprint.delayMs;
      this._homingSpeed = speed * this._blueprint.speedFactor;
      this._lifeMaxMs = this._blueprint.lifeMaxMs;
      this._homingOn = this._delayMs <= 0; // Start homing immediately if no delay
      this._sinceFire = 0;
      
      // Calculate lifespan with blueprint cap
      const calculatedLife = (range / speed) * 1000;
      this._life = Math.min(calculatedLife, this._lifeMaxMs);
      
      // Start with normal speed, will switch during homing
      this.setVelocity(nx * speed, ny * speed);
    } else {
      // Non-homing projectile
      const calculatedLife = (range / speed) * 1000;
      this._life = Math.min(calculatedLife, 3000); // Default cap
      this.setVelocity(nx * speed, ny * speed);
    }
  }
  
  /**
   * preUpdate lifecycle - called automatically by Phaser when runChildUpdate: true
   */
  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    
    if (!this.active) return;
    
    // Update time tracking
    if (this._blueprint) {
      this._sinceFire += delta;
    }
    
    // Lifespan countdown using delta (accurate during lag spikes)
    this._life -= delta;
    if (this._life <= 0) {
      this.kill();
      return;
    }
    
    // Handle homing behavior with blueprint parameters
    if (this._blueprint) {
      this._updateFairHoming(delta);
    }
  }
  
  /**
   * Fair homing behavior - blueprint-driven, smooth, avoidable
   */
  _updateFairHoming(delta) {
    // Check homing delay
    if (!this._homingOn && this._sinceFire >= this._delayMs) {
      this._homingOn = true;
    }
    
    // Only apply homing if active and turn rate > 0
    if (!this._homingOn || this._turnRate <= 0) return;
    
    const target = this.scene.player;
    if (!target || !target.active) return;
    
    // Calculate desired angle (plain Math — no Phaser.Math dependency)
    const desiredAngle = Math.atan2(target.y - this.y, target.x - this.x) + this._aimError;

    // Smooth rotation with limited turn rate
    const deltaSeconds = delta / 1000;
    const maxTurn = this._turnRate * deltaSeconds;
    // RotateTo: step current rotation toward desired by maxTurn
    let diff = desiredAngle - this.rotation;
    // Wrap to [-PI, PI]
    diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    const newRotation = Math.abs(diff) <= maxTurn ? desiredAngle : this.rotation + Math.sign(diff) * maxTurn;

    // Calculate speed with optional slowdown on sharp turns
    let currentSpeed = this._homingSpeed;
    const slowOnTurn = this._blueprint.slowOnTurn;

    if (slowOnTurn?.enabled) {
      const angleDiff = Math.abs(diff);
      const angleDiffDeg = angleDiff * (180 / Math.PI);

      if (angleDiffDeg >= slowOnTurn.angleThresholdDeg) {
        currentSpeed = this._baseSpeed * this._blueprint.speedFactor * slowOnTurn.factor;
      }
    }

    // Apply new rotation and velocity (velocityFromRotation equivalent)
    this.rotation = newRotation;
    this.body.velocity.x = Math.cos(newRotation) * currentSpeed;
    this.body.velocity.y = Math.sin(newRotation) * currentSpeed;
  }
  
  /**
   * Centralized cleanup - single point for returning to pool
   * Idempotent - safe to call multiple times
   */
  kill() {
    if (!this.active) return; // Already killed, prevent double processing
    
    if (this.body) {
      this.body.stop();
    }
    this.disableBody(true, true); // hide + inactive + disable
  }
}