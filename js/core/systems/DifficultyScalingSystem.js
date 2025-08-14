// DifficultyScalingSystem – jednotné škálování podle levelu hráče

export class DifficultyScalingSystem {
  /** @param {Phaser.Scene} scene */
  constructor(scene) { this.scene = scene; }

  /**
   * Vrátí multipliery pro hp/damage/speed pro daný level hráče
   */
  getMultipliers(level) {
    const hp = 1 + (level - 1) * 0.1;
    const dmg = 1 + (level - 1) * 0.1;
    const spd = 1 + (level - 1) * 0.0; // rychlost držme stabilní pro férovost
    return { hp, dmg, spd };
  }
}


