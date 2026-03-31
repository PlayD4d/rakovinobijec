/**
 * BossAbilities - Boss abilities and ability execution system
 *
 * Manages all boss abilities, their cooldowns, and execution logic.
 * Separates ability logic from the core boss class per PR7 principles.
 *
 * Handler implementations are split into:
 *   - abilities/GenericAbilities.js   (10 generic handlers)
 *   - abilities/RadiationCoreAbilities.js (8 boss-specific handlers)
 */
import { DebugLogger } from '../../core/debug/DebugLogger.js';
import { getSession } from '../../core/debug/SessionLog.js';

// Generic ability handlers
import {
    executeBasicAttack,
    executeProjectileBurst,
    executeMinionSpawn,
    executeTeleportStrike,
    executeDashAttack,
    executeAreaDamage,
    executeHealing,
    executeShield,
    executeRageMode,
    executeToxicCloud
} from './abilities/GenericAbilities.js';

// Boss-specific ability handlers
import {
    executeRadiationPulse,
    executeToxicPools,
    executeBeamSweep,
    executeSummonIrradiated,
    executeRadiationStorm,
    executeRapidBeams,
    executeMassiveSummon,
    executeCoreOverload
} from './abilities/RadiationCoreAbilities.js';

export class BossAbilities {
    constructor(bossCore) {
        this.boss = bossCore;
        this.scene = bossCore.scene;

        // Ability configuration from blueprint
        this.abilities = bossCore.abilities || {};
        // Use the same cooldowns Map as BossCore for consistency
        this.abilityCooldowns = bossCore.abilityCooldowns || new Map();
        this.activeAbilities = new Set();

        // Execution state
        this.isExecutingAbility = false;
        this.executionQueue = [];

        // Track delayedCall timers for cleanup on boss death
        this._pendingTimers = [];

        // Ability handlers registry
        this.abilityHandlers = new Map();
        this.registerDefaultAbilities();

        DebugLogger.info('boss', `[BossAbilities] Initialized with abilities:`, Object.keys(this.abilities));
    }

    /**
     * Register default boss abilities
     */
    registerDefaultAbilities() {
        // Generic abilities
        this.abilityHandlers.set('basic_attack', (data, params) => executeBasicAttack(this, data, params));
        this.abilityHandlers.set('projectile_burst', (data, params) => executeProjectileBurst(this, data, params));
        this.abilityHandlers.set('minion_spawn', (data, params) => executeMinionSpawn(this, data, params));
        this.abilityHandlers.set('teleport_strike', (data, params) => executeTeleportStrike(this, data, params));
        this.abilityHandlers.set('dash_attack', (data, params) => executeDashAttack(this, data, params));
        this.abilityHandlers.set('area_damage', (data, params) => executeAreaDamage(this, data, params));
        this.abilityHandlers.set('healing', (data, params) => executeHealing(this, data, params));
        this.abilityHandlers.set('shield', (data, params) => executeShield(this, data, params));
        this.abilityHandlers.set('rage_mode', (data, params) => executeRageMode(this, data, params));
        this.abilityHandlers.set('toxic_cloud', (data, params) => executeToxicCloud(this, data, params));

        // Boss-specific abilities (from logs)
        this.abilityHandlers.set('radiation_pulse', (data, params) => executeRadiationPulse(this, data, params));
        this.abilityHandlers.set('toxic_pools', (data, params) => executeToxicPools(this, data, params));
        this.abilityHandlers.set('beam_sweep', (data, params) => executeBeamSweep(this, data, params));
        this.abilityHandlers.set('summon_irradiated', (data, params) => executeSummonIrradiated(this, data, params));
        this.abilityHandlers.set('radiation_storm', (data, params) => executeRadiationStorm(this, data, params));
        this.abilityHandlers.set('rapid_beams', (data, params) => executeRapidBeams(this, data, params));
        this.abilityHandlers.set('massive_summon', (data, params) => executeMassiveSummon(this, data, params));
        this.abilityHandlers.set('core_overload', (data, params) => executeCoreOverload(this, data, params));

        // Karcinogenni Kral + Onkogen abilities (map to projectile burst variants)
        this.abilityHandlers.set('shoot_fan', (data, params) => executeProjectileBurst(this, data, params));
        this.abilityHandlers.set('shoot_circle', (data, params) => executeProjectileBurst(this, data, params));
        this.abilityHandlers.set('tracking_burst', (data, params) => executeProjectileBurst(this, data, params));

        // Radiation (L6) abilities
        this.abilityHandlers.set('place_zone', (data, params) => executeToxicPools(this, data, params));

        // Onkogen Prime abilities
        this.abilityHandlers.set('shoot_fans', (data, params) => executeProjectileBurst(this, data, params));
        this.abilityHandlers.set('circle_burst', (data, params) => executeProjectileBurst(this, data, params));
        this.abilityHandlers.set('laser_sweep', (data, params) => executeBeamSweep(this, data, params));
        this.abilityHandlers.set('rapid_spawns', (data, params) => executeMassiveSummon(this, data, params));
        this.abilityHandlers.set('enrage_mode', (data, params) => executeRageMode(this, data, params));
        this.abilityHandlers.set('summon_minions', (data, params) => executeMinionSpawn(this, data, params));
    }

    /**
     * Update method - processes ability queue and cooldowns
     */
    update(time, delta) {
        // Process execution queue
        if (!this.isExecutingAbility && this.executionQueue.length > 0) {
            const nextAbility = this.executionQueue.shift();
            this.executeAbilityInternal(nextAbility.id, nextAbility.params);
        }

        // Update cooldowns - cleanup expired ones
        for (const [abilityId, cooldownEnd] of this.abilityCooldowns.entries()) {
            if (time >= cooldownEnd) {
                this.abilityCooldowns.delete(abilityId);
            }
        }
    }

    /**
     * Attempt to execute an ability
     */
    executeAbility(abilityId, params = {}) {
        if (!this.abilities[abilityId]) {
            DebugLogger.warn('boss', `[BossAbilities] Unknown ability: ${abilityId}`);
            return false;
        }

        if (!this.boss.isAbilityReady(abilityId)) {
            DebugLogger.info('boss', `[BossAbilities] Ability ${abilityId} on cooldown`);
            return false;
        }

        // Add to queue if currently executing (max 3 to prevent unbounded growth)
        if (this.isExecutingAbility) {
            if (this.executionQueue.length >= 3) return false;
            this.executionQueue.push({ id: abilityId, params });
            return true;
        }

        return this.executeAbilityInternal(abilityId, params);
    }

    /**
     * Internal ability execution
     */
    executeAbilityInternal(abilityId, params) {
        const abilityData = this.abilities[abilityId];
        const handler = this.abilityHandlers.get(abilityId);

        if (!handler) {
            DebugLogger.warn('boss', `[BossAbilities] No handler for ability: ${abilityId} — applying default cooldown`);
            // Set cooldown even for unknown abilities to prevent infinite retry
            this.boss?.setAbilityCooldown?.(abilityId, 5000);
            return false;
        }

        DebugLogger.info('boss', `[BossAbilities] Executing ability: ${abilityId}`);
        getSession()?.log('boss', 'ability_used', { bossId: this.boss?.blueprintId, abilityId, cooldown: abilityData.cooldown || 3000 });

        // Map projectileRef → projectileId so handlers can read a single field name
        if (abilityData.projectileRef && !abilityData.projectileId) {
            abilityData.projectileId = abilityData.projectileRef;
        }

        this.isExecutingAbility = true;
        this.activeAbilities.add(abilityId);

        // Set cooldown — blueprint uses either 'cooldown' or 'interval'
        const cooldown = abilityData.cooldown || abilityData.interval || 3000;
        this.boss.setAbilityCooldown(abilityId, cooldown);

        // Execute ability
        try {
            const result = handler(abilityData, params);

            // Handle async abilities
            if (result && typeof result.then === 'function') {
                result.finally(() => {
                    this.onAbilityCompleted(abilityId);
                });
            } else {
                // Sync ability - complete immediately
                this._schedule(100, () => {
                    this.onAbilityCompleted(abilityId);
                });
            }

            return true;
        } catch (error) {
            DebugLogger.error('boss', `[BossAbilities] Error executing ${abilityId}:`, error);
            this.onAbilityCompleted(abilityId);
            return false;
        }
    }

    /**
     * Callback after ability completion
     */
    onAbilityCompleted(abilityId) {
        this.isExecutingAbility = false;
        this.activeAbilities.delete(abilityId);
        DebugLogger.info('boss', `[BossAbilities] Ability ${abilityId} completed`);
    }

    /**
     * Register a custom ability handler
     */
    registerAbility(abilityId, handler) {
        this.abilityHandlers.set(abilityId, handler);
        DebugLogger.info('boss', `[BossAbilities] Registered custom ability: ${abilityId}`);
    }

    /**
     * Get the list of active abilities
     */
    getActiveAbilities() {
        return Array.from(this.activeAbilities);
    }

    /**
     * Stop all active abilities
     */
    stopAllAbilities() {
        this.isExecutingAbility = false;
        this.executionQueue = [];
        this.activeAbilities.clear();

        DebugLogger.info('boss', '[BossAbilities] All abilities stopped');
    }

    /**
     * Schedule a delayedCall with automatic tracking for cleanup
     */
    _schedule(delay, callback) {
        if (!this.scene?.time) return null;
        const timer = this.scene.time.delayedCall(delay, () => {
            // Remove from pending list
            const idx = this._pendingTimers.indexOf(timer);
            if (idx !== -1) this._pendingTimers.splice(idx, 1);
            // Only execute if boss is still alive
            if (this.boss?.active && this.scene) {
                callback();
            }
        });
        this._pendingTimers.push(timer);
        return timer;
    }

    /**
     * Cleanup on boss removal
     */
    cleanup() {
        // Cancel all pending timers
        if (this._pendingTimers) {
            for (const timer of this._pendingTimers) {
                if (timer && timer.destroy) timer.destroy();
            }
            this._pendingTimers = [];
        }

        this.stopAllAbilities();
        this.abilityHandlers.clear();
        this.abilityCooldowns.clear();
        this.boss = null;
        this.scene = null;

        DebugLogger.info('boss', '[BossAbilities] Cleanup completed');
    }
}
