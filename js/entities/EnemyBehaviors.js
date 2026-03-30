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
import { getSession } from '../core/debug/SessionLog.js';
import { chase } from './ai/behaviors/chase.js';
import { shoot } from './ai/behaviors/shoot.js';
import { flee } from './ai/behaviors/flee.js';
import { patrol } from './ai/behaviors/patrol.js';
import { orbit } from './ai/behaviors/orbit.js';
import { charge } from './ai/behaviors/charge.js';
import { explode } from './ai/behaviors/explode.js';
import { shield_ally } from './ai/behaviors/shield_ally.js';
import { swarm } from './ai/behaviors/swarm.js';
import { evasion } from './ai/behaviors/evasion.js';

// Behavior registry — all available behaviors
const BEHAVIORS = { idle, chase, shoot, flee, patrol, orbit, charge, explode, shield_ally, swarm, evasion };

// Default configs per behavior
const DEFAULTS = {
    chase: { speed: 140 },
    shoot: { cooldown: 3000, burstCount: 1, burstDelay: 100, speed: 200 },
    patrol: { speed: 60, radius: 100, changeInterval: 2000 },
    orbit: { speed: 100, orbitRadius: 150, orbitSpeed: 1.5 },
    flee: { speed: 120, safeDistance: 300, panicDistance: 100 },
    idle: {},
    charge: { speed: 80, dashSpeed: 350, dashDuration: 400, recoverDuration: 1200, windupDuration: 500, triggerRange: 200 },
    explode: { speed: 100, detonateRange: 30, fuseTime: 6000, warningTime: 1500 },
    shield_ally: { speed: 70, orbitRadius: 50, orbitSpeed: 2.0, buffInterval: 3000, buffRange: 80 },
    swarm: { speed: 90, separationDist: 25, cohesionWeight: 0.15, flankAngle: 0.4 },
    evasion: { speed: 85, dodgeInterval: 800, dodgeDuration: 250, dodgeSpeedMul: 2.5 }
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
                ...aiConfig.params,
                ...(aiConfig.layerConfig?.[layer] || {}),
                // Legacy mechanics for shoot
                cooldown: mechanics.shootInterval || aiConfig.params?.shootInterval || DEFAULTS[behaviorName]?.cooldown,
                damage: mechanics.projectileDamage || enemy.damage,
            };
            // Movement layers use enemy movement speed; combat layers keep projectile speed from defaults
            if (layer === 'movement') {
                this.config[layer].speed = blueprint.stats?.speed || DEFAULTS[behaviorName]?.speed;
            }
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

        // Cache layer entries and pre-build setLayer callbacks (avoid closures per frame)
        this._rebuildLayerCache();

        DebugLogger.info('enemy', `[EnemyBehaviors] ${blueprint.id}: layers=${JSON.stringify(this.layers)}`);
    }

    /**
     * Rebuild cached layer entries and pre-built setLayer callbacks (called on init and layer change)
     */
    _rebuildLayerCache() {
        this._layerEntries = Object.entries(this.layers);
        this._setLayerFns = {};
        for (const [layer] of this._layerEntries) {
            this._setLayerFns[layer] = (newBehavior, opts) => {
                if (newBehavior && BEHAVIORS[newBehavior]) {
                    if (opts?.stickyMs) {
                        const now = this.enemy.scene?.time?.now || 0;
                        const stickKey = `_stickyUntil_${layer}`;
                        if (this.mem._shared[stickKey] && now < this.mem._shared[stickKey]) return;
                        this.mem._shared[stickKey] = now + opts.stickyMs;
                    }
                    const oldBehavior = this.layers[layer];
                    this.layers[layer] = newBehavior;
                    this._rebuildLayerCache();
                    if (layer === 'movement') this.state = newBehavior;
                    if (Math.random() < 0.1) getSession()?.log('ai', 'behavior_change', { enemyId: this.enemy.blueprintId, layer, oldBehavior, newBehavior });
                }
            };
        }
    }

    /**
     * Main update — runs ALL active layers in parallel
     */
    update(time, delta) {
        if (!this.enemy || !this._layerEntries) return; // destroyed guard
        if (!this.enemy.active || this.enemy.hp <= 0) return;

        const dt = delta / 1000;
        const cap = this._getCapability();
        cap.now = time;

        // Run each active layer — index loop avoids iterator allocation
        for (let i = 0; i < this._layerEntries.length; i++) {
            const entry = this._layerEntries[i];
            const layer = entry[0], behaviorName = entry[1];
            if (!behaviorName) continue;
            const fn = BEHAVIORS[behaviorName];
            if (!fn) continue;

            try {
                fn(cap, this.config[layer] || {}, dt, this.mem[layer] || {}, this._setLayerFns[layer]);
            } catch (error) {
                DebugLogger.error('enemy', `[EnemyBehaviors] Error in ${layer}/${behaviorName}:`, error);
            }
        }

        // Stuck detection for velocity-based movement layers
        const ml = this.layers.movement;
        if (ml === 'chase' || ml === 'swarm' || ml === 'evasion' || ml === 'charge') {
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
            playTelegraph: (x, y, opts) => enemy.scene?.vfxSystem?.playTelegraph?.(x, y, opts),
            playExplosion: (x, y, opts) => enemy.scene?.vfxSystem?.playExplosionEffect?.(x, y, opts),
            die: () => enemy.die('self_destruct'),
            getHpRatio: () => enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1,
            setTint: (color) => enemy.setTint?.(color),
            schedule: (fn, ms) => enemy.schedule(fn, ms),
            getState: () => this.state,
            // Focused accessors (no raw scene reference — architecture rule)
            getPlayer: () => enemy.scene?.player,
            getEnemiesNearby: (x, y, range) => {
                const group = enemy.scene?.enemiesGroup;
                if (!group) return [];
                const rangeSq = range * range;
                const result = [];
                const children = group.getChildren();
                for (let i = 0; i < children.length; i++) {
                    const e = children[i];
                    if (!e.active) continue;
                    const dx = e.x - x, dy = e.y - y;
                    if (dx * dx + dy * dy < rangeSq) result.push(e);
                }
                return result;
            },
            damage: enemy.damage,
            speed: enemy.speed,
            spawnX: enemy.spawnX,
            spawnY: enemy.spawnY,
            now: enemy.scene?.time?.now || 0
        };
    }

    /** Refresh and return the pre-built capability — zero allocation per frame */
    _getCapability() {
        const cap = this._capability;
        cap.damage = this.enemy.damage;
        cap.speed = this.enemy.speed;
        return cap;
    }

    // ==================== Legacy compat ====================

    setBehavior(behavior) {
        if (BEHAVIORS[behavior]) {
            this.layers.movement = behavior;
            this.state = behavior;
            this._rebuildLayerCache(); // Rebuild cached entries so update() uses new behavior
        }
    }

    resetTimersAfterPause() {
        // Reset stuck detection
        this.mem._shared.stuck.since = 0;
    }

    destroy() {
        this.enemy = null;
        this._capability = null; // Release closures holding enemy reference
        this._setLayerFns = null;
        this._layerEntries = null;
    }
}

