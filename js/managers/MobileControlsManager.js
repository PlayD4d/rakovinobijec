/**
 * MobileControlsManager - Správce mobilního ovládání
 * 
 * PR7 kompatibilní - všechny parametry z ConfigResolver
 * Používá InputSystem a CameraSystem místo přímých Phaser API volání
 * Virtuální joystick pro mobilní zařízení
 */

import { getInputSystem } from '../core/systems/InputSystem.js';
import { getCameraSystem } from '../core/systems/CameraSystem.js';

export class MobileControlsManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.enabled = false;
    this.activePointerId = null;
    
    // Inicializace systémů
    this.inputSystem = getInputSystem(scene);
    this.cameraSystem = getCameraSystem(scene);
    
    // PR7: Získat parametry z ConfigResolver
    const CR = this.scene.configResolver || window.ConfigResolver;
    
    this.side = options.side === 'right' ? 'right' : 'left';
    this.maxRadius = options.maxRadius || CR?.get('mobile.joystick.maxRadius', { defaultValue: 70 }) || 70;
    this.deadzone = options.deadzone || CR?.get('mobile.joystick.deadzone', { defaultValue: 0.15 }) || 0.15;
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
    
    // PR7: Získat depth hodnoty z ConfigResolver
    const CR = this.scene.configResolver || window.ConfigResolver;
    const baseDepth = CR?.get('mobile.joystick.baseDepth', { defaultValue: 1000 }) || 1000;
    const knobDepth = CR?.get('mobile.joystick.knobDepth', { defaultValue: 1001 }) || 1001;
    
    // PR7 compliant: Use GraphicsFactory if available
    if (s.graphicsFactory) {
      this.base = s.graphicsFactory.create();
      this.knob = s.graphicsFactory.create();
    } else {
      // Fallback for scenes without GraphicsFactory
      this.base = s.add.graphics();
      this.knob = s.add.graphics();
    }
    
    this.base.setScrollFactor(0).setDepth(baseDepth);
    this.knob.setScrollFactor(0).setDepth(knobDepth);
    
    // Add to UI layer if available
    if (s.uiLayer && typeof s.uiLayer.add === 'function') {
      s.uiLayer.add(this.base);
      s.uiLayer.add(this.knob);
    }
    
    this._draw();
  }

  _destroyVisuals() {
    // PR7 compliant: Release to GraphicsFactory if available
    if (this.scene.graphicsFactory) {
      if (this.base) this.scene.graphicsFactory.release(this.base);
      if (this.knob) this.scene.graphicsFactory.release(this.knob);
    } else {
      // Fallback destroy
      if (this.base) this.base.destroy();
      if (this.knob) this.knob.destroy();
    }
    this.base = null;
    this.knob = null;
  }

  _draw() {
    if (!this.base || !this.knob) return;
    this.base.clear();
    this.knob.clear();
    
    // PR7: Získat vizuální parametry z ConfigResolver
    const CR = this.scene.configResolver || window.ConfigResolver;
    const baseColor = CR?.get('mobile.joystick.baseColor', { defaultValue: 0x000000 }) || 0x000000;
    const baseAlpha = CR?.get('mobile.joystick.baseAlpha', { defaultValue: 0.25 }) || 0.25;
    const knobSize = CR?.get('mobile.joystick.knobSize', { defaultValue: 24 }) || 24;
    
    // Základní kruh
    this.base.fillStyle(baseColor, baseAlpha);
    this.base.fillCircle(0, 0, this.maxRadius + 8);
    this.base.lineStyle(2, 0xffffff, 0.4);
    this.base.strokeCircle(0, 0, this.maxRadius + 8);
    this.base.setAlpha(0.9);
    
    // Ovládací knoflík
    this.knob.fillStyle(0xffffff, 0.8);
    this.knob.fillCircle(0, 0, knobSize);
    this.knob.lineStyle(2, 0x000000, 0.4);
    this.knob.strokeCircle(0, 0, knobSize);
  }

  _bindInput() {
    // Připojení vstupních událostí přes InputSystem
    if (this.inputSystem.getPointersTotal() < 2) {
      this.inputSystem.addPointers(2 - this.inputSystem.getPointersTotal());
    }
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
    this.inputSystem.on('pointerdown', this._onDown, this);
    this.inputSystem.on('pointermove', this._onMove, this);
    this.inputSystem.on('pointerup', this._onUp, this);
    this.inputSystem.on('pointerupoutside', this._onUp, this);
  }

  _unbindInput() {
    // Odpojení vstupních událostí přes InputSystem
    if (this._onDown) this.inputSystem.off('pointerdown', this._onDown, this);
    if (this._onMove) this.inputSystem.off('pointermove', this._onMove, this);
    if (this._onUp) {
      this.inputSystem.off('pointerup', this._onUp, this);
      this.inputSystem.off('pointerupoutside', this._onUp, this);
    }
    this._onDown = this._onMove = this._onUp = null;
  }

  _reposition() {
    const w = this.cameraSystem.getWidth();
    const h = this.cameraSystem.getHeight();
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


