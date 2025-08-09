export class MobileControlsManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.enabled = false;
    this.activePointerId = null;
    this.side = options.side === 'right' ? 'right' : 'left';
    this.maxRadius = options.maxRadius || 70;
    this.deadzone = options.deadzone || 0.15;
    this.base = null;
    this.knob = null;
    this.vector = { x: 0, y: 0 };
    this.basePos = { x: 0, y: 0 };
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this._createVisuals();
    this._bindInput();
    this._reposition();
    this.show(true);
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this._unbindInput();
    this._destroyVisuals();
    this.vector = { x: 0, y: 0 };
    this.activePointerId = null;
  }

  isEnabled() {
    return this.enabled;
  }

  setSide(side) {
    this.side = side === 'right' ? 'right' : 'left';
    this._reposition();
  }

  getVector() {
    return { ...this.vector };
  }

  show(visible) {
    if (this.base) this.base.setVisible(visible);
    if (this.knob) this.knob.setVisible(visible);
  }

  onResize() {
    this._reposition();
  }

  _createVisuals() {
    const s = this.scene;
    this.base = s.add.graphics();
    this.knob = s.add.graphics();
    this.base.setScrollFactor(0).setDepth(1000);
    this.knob.setScrollFactor(0).setDepth(1001);
    this._draw();
  }

  _destroyVisuals() {
    if (this.base) this.base.destroy();
    if (this.knob) this.knob.destroy();
    this.base = null;
    this.knob = null;
  }

  _draw() {
    if (!this.base || !this.knob) return;
    this.base.clear();
    this.knob.clear();
    // Base circle
    this.base.fillStyle(0x000000, 0.25);
    this.base.fillCircle(0, 0, this.maxRadius + 8);
    this.base.lineStyle(2, 0xffffff, 0.4);
    this.base.strokeCircle(0, 0, this.maxRadius + 8);
    this.base.setAlpha(0.9);
    // Knob
    this.knob.fillStyle(0xffffff, 0.8);
    this.knob.fillCircle(0, 0, 24);
    this.knob.lineStyle(2, 0x000000, 0.4);
    this.knob.strokeCircle(0, 0, 24);
  }

  _bindInput() {
    const input = this.scene.input;
    if (input.pointersTotal < 2) input.addPointer(2);
    this._onDown = (pointer) => {
      if (!this.enabled || this.activePointerId !== null) return;
      if (!this._isInZone(pointer.x, pointer.y)) return;
      this.activePointerId = pointer.id;
      this._updateVector(pointer.x, pointer.y);
      this.show(true);
    };
    this._onMove = (pointer) => {
      if (!this.enabled || this.activePointerId !== pointer.id) return;
      this._updateVector(pointer.x, pointer.y);
    };
    this._onUp = (pointer) => {
      if (this.activePointerId !== pointer.id) return;
      this.activePointerId = null;
      this.vector = { x: 0, y: 0 };
      this._positionKnob(this.basePos.x, this.basePos.y);
    };
    input.on('pointerdown', this._onDown);
    input.on('pointermove', this._onMove);
    input.on('pointerup', this._onUp);
    input.on('pointerupoutside', this._onUp);
  }

  _unbindInput() {
    const input = this.scene.input;
    if (this._onDown) input.off('pointerdown', this._onDown);
    if (this._onMove) input.off('pointermove', this._onMove);
    if (this._onUp) {
      input.off('pointerup', this._onUp);
      input.off('pointerupoutside', this._onUp);
    }
    this._onDown = this._onMove = this._onUp = null;
  }

  _reposition() {
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const margin = 90;
    const x = this.side === 'right' ? (w - margin) : margin;
    const y = h - margin;
    this.basePos = { x, y };
    if (this.base) this.base.setPosition(x, y);
    if (this.knob) this.knob.setPosition(x, y);
  }

  _isInZone(x, y) {
    // static base zone: circle around base
    const dx = x - this.basePos.x;
    const dy = y - this.basePos.y;
    const dist = Math.hypot(dx, dy);
    return dist <= this.maxRadius + 24;
  }

  _positionKnob(x, y) {
    if (this.knob) this.knob.setPosition(x, y);
  }

  _updateVector(px, py) {
    const dx = px - this.basePos.x;
    const dy = py - this.basePos.y;
    let len = Math.hypot(dx, dy);
    const max = this.maxRadius;
    let nx = 0, ny = 0;
    if (len > 0) {
      nx = dx / len;
      ny = dy / len;
    }
    // clamp radius
    const radius = Math.min(len, max);
    const knobX = this.basePos.x + nx * radius;
    const knobY = this.basePos.y + ny * radius;
    this._positionKnob(knobX, knobY);
    // deadzone
    const norm = Math.min(len / max, 1);
    if (norm < this.deadzone) {
      this.vector = { x: 0, y: 0 };
    } else {
      // invert Y to match screen coords -> game coords: up is negative dy
      this.vector = { x: nx, y: ny };
    }
  }
}


