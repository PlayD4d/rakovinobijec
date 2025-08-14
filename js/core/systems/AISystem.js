// AISystem – kostra pro chování běžných NPC (seek_player, kite, wander)
// Fáze 3: zatím nepřipojeno; použijeme při převodu Enemy na ECS entitu

export class AISystem {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
  }

  // Vypočítá vektor směru k hráči
  _dirToPlayer(x, y) {
    const px = this.scene.player?.x || x;
    const py = this.scene.player?.y || y;
    const dx = px - x;
    const dy = py - y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  // Jednoduché chování – jít k hráči
  seek(entity, speed) {
    const d = this._dirToPlayer(entity.x, entity.y);
    const vx = d.x * speed * 100;
    const vy = d.y * speed * 100;
    entity.body?.setVelocity(vx, vy);
  }

  // „Kite“ – držet odstup
  kite(entity, speed, desired = 140) {
    const px = this.scene.player?.x || entity.x;
    const py = this.scene.player?.y || entity.y;
    const dx = px - entity.x;
    const dy = py - entity.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / dist, y: dy / dist };
    // Plynulé přibližování/vzdalování bez náhlého zastavení
    let scale = 0;
    const inner = desired * 0.9;
    const outer = desired * 1.2;
    if (dist < inner) {
      scale = -Phaser.Math.Clamp((inner - dist) / inner, 0.2, 1);
    } else if (dist > outer) {
      scale = Phaser.Math.Clamp((dist - outer) / outer, 0.2, 1);
    } else {
      // kruhové kroužení v pásmu
      const t = (this.scene.time.now || 0) * 0.001 + (entity.id || 0);
      const side = Math.sin(t) * 0.4;
      const tangent = { x: -dir.y, y: dir.x };
      const vx = (dir.x * 0.2 + tangent.x * side) * speed * 100;
      const vy = (dir.y * 0.2 + tangent.y * side) * speed * 100;
      entity.body?.setVelocity(vx, vy);
      return;
    }
    const vx = dir.x * scale * speed * 100;
    const vy = dir.y * scale * speed * 100;
    entity.body?.setVelocity(vx, vy);
  }

  // „Wander“ – náhodné bloudění s mírným šumem
  wander(entity, speed, time) {
    const t = (time || 0) * 0.001;
    const angle = Math.sin(t + entity.id * 0.37) * Math.PI; // deterministický šum
    const vx = Math.cos(angle) * speed * 100;
    const vy = Math.sin(angle) * speed * 100;
    entity.body?.setVelocity(vx, vy);
  }
}


