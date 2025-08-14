// VfxRouter – propojení EventBusu a VFXSystemu
// Účel: nízká vazba – herní kód emituje události, router spouští efekt podle klíče

export class VfxRouter {
  /**
   * @param {import('../events/EventBus.js').EventBus} eventBus
   * @param {import('./../vfx/VFXSystem.js').VFXSystem} vfxSystem
   */
  constructor(eventBus, vfxSystem) {
    this.eventBus = eventBus;
    this.vfxSystem = vfxSystem;
    this.unsubscribers = [];

    this.defaultMap = new Map([
      ['player.hit', 'vfx.hit.spark'],
      ['npc.hit', 'vfx.hit.spark'],
      ['npc.death', 'vfx.death.burst.red'],
      ['boss.hit', 'vfx.hit.spark'],
      ['boss.death', 'vfx.death.burst.boss'],
      ['projectile.impact', 'vfx.hit.spark'],
      ['drop.metotrexat.pickup', 'vfx.flash.strong'],
    ]);

    this._subscribe();
  }

  _subscribe() {
    const listen = (evt) => this.eventBus.on(evt, (payload) => this._handle(evt, payload));
    [
      // Only high-level events, not hot-path combat events
      'drop.metotrexat.pickup',
      'powerup.apply',
      'run.completed',
      'scene.paused',
      'scene.resumed'
    ].forEach((evt) => this.unsubscribers.push(listen(evt)));
  }

  _handle(eventName, payload = {}) {
    const key = payload.vfx || this.defaultMap.get(eventName);
    if (!key) return;
    const { x = 0, y = 0, scale, tint } = payload;
    this.vfxSystem.play(key, x, y, { scale, tint });
  }

  destroy() {
    this.unsubscribers.forEach((off) => { try { off(); } catch (_) {} });
    this.unsubscribers = [];
  }
}
