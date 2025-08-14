// AudioSystem – legacy kompatibilita pro starý kód
// Unified blueprint systém používá SFXSystem

export class AudioSystem {
  /**
   * @param {Phaser.Scene} scene – scéna, ze které hrajeme zvuky
   */
  constructor(scene) {
    this.scene = scene;
    this.lastPlayAtByKey = new Map();
  }

  /**
   * Legacy metoda pro backward compatibility
   */
  playSfx(logicalKey, volume = 0.5, pitchVariation = 0.1, throttleMs = 100) {
    // Fallback na Phaser sound system
    try {
      if (this.scene.sound && this.scene.cache.audio.exists(logicalKey)) {
        this.scene.sound.play(logicalKey, { volume });
      }
    } catch (e) {
      console.warn('[AudioSystem] Failed to play sound:', logicalKey);
    }
  }
}