/**
 * GameSceneAPI - Phaser API wrapper functions for GameScene
 *
 * Extracted from GameScene to keep it under 500 LOC.
 * All functions take `scene` as first parameter for clean delegation.
 */

/** Pause physics world */
export function pausePhysics(scene) { scene.physics?.world?.pause(); }

/** Resume physics world */
export function resumePhysics(scene) { scene.physics?.world?.resume(); }

/** Pause scene time */
export function pauseTime(scene) { if (scene.time) scene.time.paused = true; }

/** Resume scene time */
export function resumeTime(scene) { if (scene.time) scene.time.paused = false; }

/** Set world bounds */
export function setWorldBounds(scene, x, y, w, h) { scene.physics?.world?.setBounds(x, y, w, h); }

/** Create a UI layer at given depth */
export function createUILayer(scene, depth) {
    const a = scene['add'];
    const l = a.layer();
    l.setDepth(depth);
    scene.uiLayer = l;
    return l;
}

/** Launch a UI scene by key */
export function launchUIScene(scene, key) { scene.scene.launch(key); }

/** Add a time event */
export function addTimeEvent(scene, config) { return scene.time.addEvent(config); }

/** Add a delayed call */
export function addDelayedCall(scene, delay, cb, args, scope) {
    return scene.time.delayedCall(delay, cb, args, scope);
}

/** Get the main camera */
export function getMainCamera(scene) { return scene.cameras.main; }

/** Flash the camera */
export function flashCamera(scene, duration = 500, r = 255, g = 255, b = 0) {
    scene.cameras.main.flash(duration, r, g, b);
}

/** Shake the camera */
export function shakeCamera(scene, duration = 300, intensity = 0.02) {
    scene.cameras.main.shake(duration, intensity);
}

/** Get the scale manager */
export function getScaleManager(scene) { return scene.scale; }

/** Restart the current scene */
export function restartScene(scene) { scene.scene.restart(); }
