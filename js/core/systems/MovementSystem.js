// MovementSystem – nastavuje velocity hráče podle vstupu a rychlosti

export class MovementSystem {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
  }

  update(time, delta) {
    const s = this.scene;
    const player = s.player;
    if (!player || s.isPaused) return;
    if (!s.coreInputSystem) return;

    const v = s.coreInputSystem.getMoveVector();
    const baseSpeed = ((player.moveSpeed || 100) + (player.speedBonus || 0)) * 100;
    player.sprite.body.setVelocity(v.x * baseSpeed, v.y * baseSpeed);
  }
}


