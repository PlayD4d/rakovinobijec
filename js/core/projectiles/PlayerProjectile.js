// PlayerProjectile - Optimized Arcade Physics projectile
// Follows Phaser 3 best practices: extends Sprite, preUpdate lifecycle, zero-GC

export class PlayerProjectile extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'bullet8');
    
    // DON'T configure physics body in constructor - body is null!
    // Physics body setup happens in fire() after enableBody()
    
    // Properties for lifecycle management
    this._life = 0;
    this.damage = 0;
  }
  
  /**
   * Fire projectile with zero-GC API (scalars only, no object allocations)
   * @param {number} x - Start X position
   * @param {number} y - Start Y position  
   * @param {number} dirX - Direction X (will be normalized)
   * @param {number} dirY - Direction Y (will be normalized)
   * @param {number} speed - Speed in px/s
   * @param {number} range - Range in px
   * @param {number} damage - Damage value
   * @param {number} tint - Color tint (optional, default white)
   */
  fire(x, y, dirX, dirY, speed, range, damage, tint = 0xffffff) {
    // Normalize direction without object allocation
    const len = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / len;
    const ny = dirY / len;
    
    // Spawn with muzzle offset (avoid collision with player)
    const muzzle = 24; // Distance from player center
    const sx = x + nx * muzzle;
    const sy = y + ny * muzzle;
    
    // Safety check - ensure physics body exists
    if (!this.body) {
      this.scene.physics.world.enable(this);
    }
    
    // Enable body and set position/velocity
    this.enableBody(true, sx, sy, true, true);
    
    // NOW configure physics body (after enableBody)
    this.body.setAllowGravity(false);
    this.setCircle(3); // Smaller hitbox for fair collision
    this.setCollideWorldBounds(true);
    this.body.onWorldBounds = true; // Enable world bounds events
    
    this.setVelocity(nx * speed, ny * speed);
    this.setTint(tint);
    
    // Calculate lifespan from range/speed with safety cap
    const calculatedLife = (range / speed) * 1000; // Convert to milliseconds
    this._life = Math.min(calculatedLife, 3000); // Cap at 3 seconds max
    this.damage = damage;
    
    // VFX: Attach particle trail if enabled
    if (this.scene.vfxSystem && this.scene.GameConfig?.vfx?.playerProjectileTrail) {
      this.scene.vfxSystem.attachTrail(this, 'playerProjectile');
    }
  }
  
  /**
   * preUpdate lifecycle - called automatically by Phaser when runChildUpdate: true
   */
  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    
    if (!this.active) return;
    
    // Lifespan countdown using delta (accurate during lag spikes)
    this._life -= delta;
    if (this._life <= 0) {
      this.kill();
    }
  }
  
  /**
   * Centralized cleanup - single point for returning to pool
   * Idempotent - safe to call multiple times
   */
  kill() {
    if (!this.active) return; // Already killed, prevent double processing
    
    // VFX: Detach particle trail with defensive check
    if (this.scene && this.scene.vfxSystem && typeof this.scene.vfxSystem.detachTrail === 'function') {
      this.scene.vfxSystem.detachTrail(this);
    }
    
    if (this.body) {
      this.body.stop();
    }
    this.disableBody(true, true); // hide + inactive + disable
  }
}