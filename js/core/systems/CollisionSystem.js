// CollisionSystem – centralizace kolizí/overlapů (parita s GameScene.checkCollisions)

// PR7: GameConfig removed - use ConfigResolver only
// import { GameConfig } from '../../config.js';

export class CollisionSystem {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
  }

  update(time, delta) {
    const s = this.scene;
    if (s.isPaused) return;

    // EARLY RETURN - všechny kolize nyní řeší physics.add.overlap v GameScene.setupCollisions()
    // Projektily, loot i enemy kolize jsou registrované jednou při vytvoření scény
    // Ruční iterace odstraněna kvůli výkonu a prevenci duplicitních kolizí
    return;
  }
}


