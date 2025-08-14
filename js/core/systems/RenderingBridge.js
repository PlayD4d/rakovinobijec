// RenderingBridge – jediný dotek na Phaser API z pohledu ECS světa
// Umožní nám držet logiku odděleně a mít jednotné místo pro Graphics/Sprite/Particles

export class RenderingBridge {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    // Skupiny pro snadný management
    this.graphicsGroup = scene.add.group();
    this.spriteGroup = scene.add.group();
  }

  // Vytvoří „graphics“ reprezentaci (dnešní styl) – návrat referencí pro další práci
  createGraphicsEntity(x, y, drawFn) {
    const g = this.scene.add.graphics();
    g.x = x; g.y = y;
    if (typeof drawFn === 'function') {
      drawFn(g);
    }
    this.graphicsGroup.add(g);
    return g;
  }

  // Budoucí sprite/atlas varianta
  createSpriteEntity(x, y, textureKey, frame) {
    const s = this.scene.add.sprite(x, y, textureKey, frame);
    this.spriteGroup.add(s);
    return s;
  }

  // Nastaví depth jednotně (HUD/particles/obsah)
  setDepth(displayObject, depth) {
    if (displayObject && typeof displayObject.setDepth === 'function') {
      displayObject.setDepth(depth);
    }
  }

  // Bezpečné zničení
  destroy(displayObject) {
    if (displayObject && typeof displayObject.destroy === 'function') {
      displayObject.destroy();
    }
  }
}


