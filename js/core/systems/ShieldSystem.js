// ShieldSystem – správa kapacity štítu, regenerace a vizuálu

export class ShieldSystem {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
  }

  update(time, delta) {
    const p = this.scene.player;
    if (!p) return;
    if (p.shield && p.shield.isRegenerating) {
      p.shield.regenTimer += delta;
      if (p.shield.regenTimer >= p.shield.regenTime) {
        p.shield.currentHP = p.shield.maxHP;
        p.shield.isRegenerating = false;
        p.shield.regenTimer = 0;
        p.createShield();
      } else {
        p.updateShieldVisual();
      }
    }
    // Udržet vizuál na pozici hráče
    if (p.shield?.visual) {
      p.shield.visual.x = p.x;
      p.shield.visual.y = p.y;
    }
  }
}


