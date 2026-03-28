/**
 * EnemyBehaviors.js - Layered behavior system for enemies
 *
 * Enemies run multiple behavior layers IN PARALLEL:
 *   Layer 0: Movement (chase, patrol, flee, orbit, idle) — always one active
 *   Layer 1: Combat   (shoot | null) — optional, runs alongside movement
 *   Layer 2: Special  (support_heal | null) — optional, enemy-specific ability
 *
 * Each layer has its own behavior function, config, and memory.
 * No Phaser API calls — uses capability interface.
 */

import { idle } from './ai/behaviors/idle.js';
import { DebugLogger } from '../core/debug/DebugLogger.js';
import { chase } from './ai/behaviors/chase.js';
import { shoot } from './ai/behaviors/shoot.js';
import { flee } from './ai/behaviors/flee.js';
import { patrol } from './ai/behaviors/patrol.js';
import { orbit } from './ai/behaviors/orbit.js';

// Behavior registry — all available behaviors
const BEHAVIORS = { idle, chase, shoot, flee, patrol, orbit };

// Default configs per behavior
const DEFAULTS = {
    chase: { speed: 140 },
    shoot: { cooldown: 3000, burstCount: 1, burstDelay: 100, speed: 200 },
    patrol: { speed: 60, radius: 100, changeInterval: 2000 },
    orbit: { speed: 100, orbitRadius: 150, orbitSpeed: 1.5 },
    flee: { speed: 120, safeDistance: 300, panicDistance: 100 },
    idle: {}
};

export class EnemyBehaviors {
    constructor(enemy) {
        this.enemy = enemy;
        const blueprint = enemy.blueprint || {};
        const aiConfig = blueprint.ai || {};
        const mechanics = blueprint.mechanics || {};

        // Determine layers from blueprint
        // New format: ai.layers = { movement: 'chase', combat: 'shoot' }
        // Legacy format: ai.behavior = 'chase' (backwards compatible)
        if (aiConfig.layers) {
            this.layers = { ...aiConfig.layers };
        } else {
            // Backwards compat: derive layers from legacy ai.behavior
            const behavior = aiConfig.behavior || 'chase';
            this.layers = { movement: (behavior === 'shoot') ? 'chase' : behavior };

            // Auto-add combat layer if enemy can shoot
            if (mechanics.canShoot || behavior === 'shoot') {
                this.layers.combat = 'shoot';
            }
        }

        // Per-layer config (merged from blueprint + defaults)
        this.config = {};
        for (const [layer, behaviorName] of Object.entries(this.layers)) {
            if (!behaviorName) continue;
            this.config[layer] = {
                ...DEFAULTS[behaviorName],
                speed: blueprint.stats?.speed || DEFAULTS[behaviorName]?.speed,
                ...aiConfig.params,
                ...(aiConfig.layerConfig?.[layer] || {}),
                // Legacy mechanics for shoot
                cooldown: mechanics.shootInterval || aiConfig.params?.shootInterval || DEFAULTS[behaviorName]?.cooldown,
                damage: mechanics.projectileDamage || enemy.damage,
            };
        }

        // Per-layer memory
        this.mem = {};
        for (const layer of Object.keys(this.layers)) {
            this.mem[layer] = {};
        }
        // Shared memory
        this.mem._shared = {
            prevDist: null,
            stuck: { pos: null, since: 0 }
        };

        // Legacy compat: expose .state for code that reads it
        this.state = this.layers.movement || 'idle';
        this.behaviorType = aiConfig.behavior || 'chase';
        this.isInCombat = true;

        // Pre-create capability object
        this._capability = this._buildCapability();

        // Cache layer entries to avoid Object.entries() per frame per enemy
        this._layerEntries = Object.entries(this.layers);

        DebugLogger.info('enemy', `[EnemyBehaviors] ${blueprint.id}: layers=${JSON.stringify(this.layers)}`);
    }

    /**
     * Main update — runs ALL active layers in parallel
     */
    update(time, delta) {
        if (!this.enemy.active || this.enemy.hp <= 0) return;

        const dt = delta / 1000;
        const cap = this.createCapability();
        cap.now = time;

        // Run each active layer (use cached entries — avoid Object.entries per frame)
        for (const [layer, behaviorName] of this._layerEntries) {
            if (!behaviorName) continue;
            const fn = BEHAVIORS[behaviorName];
            if (!fn) continue;

            const cfg = this.config[layer] || {};
            const mem = this.mem[layer] || {};

            // setState for this layer only (supports optional stickyMs hysteresis)
            const setLayer = (newBehavior, opts) => {
                if (newBehavior && BEHAVIORS[newBehavior]) {
                    // stickyMs prevents rapid state oscillation
                    if (opts?.stickyMs) {
                        const now = this.enemy.scene?.time?.now || 0;
                        const stickKey = `_stickyUntil_${layer}`;
                        if (this.mem._shared[stickKey] && now < this.mem._shared[stickKey]) {
                            return; // Still in sticky period, ignore transition
                        }
                        this.mem._shared[stickKey] = now + opts.stickyMs;
                    }
                    this.layers[layer] = newBehavior;
                    this._layerEntries = Object.entries(this.layers); // Rebuild cache
                    if (layer === 'movement') this.state = newBehavior;
                }
            };

            try {
                fn(cap, cfg, dt, mem, setLayer);
            } catch (error) {
                DebugLogger.error('enemy', `[EnemyBehaviors] Error in ${layer}/${behaviorName}:`, error);
            }
        }

        // Stuck detection for movement layer
        if (this.layers.movement === 'chase') {
            this._detectStuck(delta);
        }
    }

    _detectStuck(delta) {
        if (!this.enemy.body) return;
        const vel = this.enemy.body.velocity;
        const speed = vel.x * vel.x + vel.y * vel.y; // squared
        const now = this.enemy.scene?.time?.now || 0;
        if (!now) return; // Scene time unavailable — skip stuck detection

        if (speed < 25) { // ~5px/s squared
            if (!this.mem._shared.stuck.since) {
                this.mem._shared.stuck.since = now;
            } else if (now - this.mem._shared.stuck.since > 2000) {
                const angle = Math.random() * Math.PI * 2;
                this.enemy.setVelocity(Math.cos(angle) * 100, Math.sin(angle) * 100);
                this.mem._shared.stuck.since = now;
            }
        } else {
            this.mem._shared.stuck.since = 0;
        }
    }

    // ==================== Capability ====================

    _buildCapability() {
        const enemy = this.enemy;
        return {
            getPos: () => enemy.getPos(),
            setVelocity: (vx, vy) => enemy.setVelocity(vx, vy),
            faceTo: (x, y) => enemy.faceTo(x, y),
            shoot: (pattern, opts) => enemy.shoot(pattern, opts),
            inRangeOfPlayer: (range) => enemy.inRangeOfPlayer(range),
            playSfx: (id, opts) => enemy.playSfx(id, opts),
            spawnVfx: (id, at, opts) => enemy.spawnVfx(id, at, opts),
            schedule: (fn, ms) => enemy.schedule(fn, ms),
            getState: () => this.state,
            scene: enemy.scene,
            damage: enemy.damage,
            speed: enemy.speed,
            spawnX: enemy.spawnX,
            spawnY: enemy.spawnY,
            now: 0
        };
    }

    createCapability() {
        const cap = this._capability;
        cap.damage = this.enemy.damage;
        cap.speed = this.enemy.speed;
        cap.scene = this.enemy.scene;
        return cap;
    }

    // ==================== Legacy compat ====================

    setBehavior(behavior) {
        if (BEHAVIORS[behavior]) {
            this.layers.movement = behavior;
            this.state = behavior;
        }
    }

    resetTimersAfterPause() {
        // Reset stuck detection
        this.mem._shared.stuck.since = 0;
    }

    destroy() {
        this.enemy = null;
    }
}

export default EnemyBehaviors;
