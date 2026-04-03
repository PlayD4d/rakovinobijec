/**
 * ChestHandler - VS-style loot chest logic
 *
 * Chests drop from bosses (gold/5), uniques (silver/3), elites (bronze/2).
 * On pickup, directly applies N random powerup upgrades without selection screen.
 * Fallback: heal if all powerups maxed.
 */

import { DebugLogger } from '../../debug/DebugLogger.js';
import { getSession } from '../../debug/SessionLog.js';

export class ChestHandler {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Open a chest — apply N random powerup upgrades directly (no selection screen).
     * Priority: upgrade existing owned powerups > add new powerup if slots open > heal fallback.
     */
    open(player, blueprint, loot) {
        const upgradeCount = blueprint.effect?.upgradeCount || 3;
        const tier = blueprint.effect?.tier || 'bronze';
        const ps = this.scene.powerUpSystem;

        getSession()?.log('loot', 'chest_opened', { tier, upgradeCount, x: Math.round(loot.x), y: Math.round(loot.y) });

        // Camera flash + shake for juicy feedback
        this.scene.flashCamera?.(200, 255, 255, 200);
        this.scene.shakeCamera?.(150, 0.01);

        const applied = [];
        for (let i = 0; i < upgradeCount; i++) {
            const result = this._rollUpgrade(ps, player);
            applied.push(result);
        }

        // Notify HUD about new/upgraded powerups
        const hud = this.scene.scene?.get('GameUIScene')?.hud;
        if (hud) {
            for (const r of applied) {
                if (r.type === 'upgrade') hud.updatePowerUpIcon?.(r.id, r.level);
                else if (r.type === 'new') hud.addPowerUpIcon?.({ id: r.id, slot: 'weapon' });
            }
        }

        getSession()?.log('loot', 'chest_contents', { tier, applied });
        DebugLogger.info('loot', `[Chest] ${tier} opened: ${applied.map(a => a.id + ':L' + a.level).join(', ')}`);
    }

    /**
     * Roll a single powerup upgrade for a chest.
     * 1. Try upgrading a random owned powerup (not maxed)
     * 2. Try adding a new random powerup (if slots open)
     * 3. Fallback: heal 25 HP
     */
    _rollUpgrade(ps, player) {
        if (!ps?.appliedPowerUps) return this._healFallback(player);

        // Collect upgradeable powerups (owned but not maxed)
        const upgradeable = [];
        for (const [id, data] of ps.appliedPowerUps) {
            const maxLevel = data.blueprint?.stats?.maxLevel || 5;
            if (data.level < maxLevel) upgradeable.push({ id, level: data.level });
        }

        // 70% chance to upgrade existing, 30% to add new (if slots available)
        const tryNew = upgradeable.length === 0 || Math.random() < 0.3;

        if (!tryNew && upgradeable.length > 0) {
            const pick = upgradeable[Math.floor(Math.random() * upgradeable.length)];
            const newLevel = pick.level + 1;
            try {
                if (ps.applyPowerUp(pick.id, newLevel)) {
                    return { id: pick.id, level: newLevel, type: 'upgrade' };
                }
            } catch (_) {}
        }

        // Try adding a new powerup
        const newPu = this._pickNewPowerup(ps);
        if (newPu) {
            try {
                if (ps.applyPowerUp(newPu.id, 1)) {
                    return { id: newPu.id, level: 1, type: 'new' };
                }
            } catch (_) {}
        }

        // Still have upgradeable? Try that instead
        if (upgradeable.length > 0) {
            const pick = upgradeable[Math.floor(Math.random() * upgradeable.length)];
            const newLevel = pick.level + 1;
            try {
                if (ps.applyPowerUp(pick.id, newLevel)) {
                    return { id: pick.id, level: newLevel, type: 'upgrade' };
                }
            } catch (_) {}
        }

        // Everything maxed — heal fallback
        return this._healFallback(player);
    }

    /** Pick a random unowned powerup that fits in an open slot */
    _pickNewPowerup(ps) {
        const allPowerUps = this.scene.blueprintLoader?.getAll('powerup') || [];
        const candidates = [];
        for (const bp of allPowerUps) {
            if (!bp?.id) continue;
            if (bp.id.includes('template') || bp.id.includes('.bak')) continue;
            if (ps.appliedPowerUps.has(bp.id)) continue;
            const slot = bp.mechanics?.slot || 'weapon';
            if (ps.isSlotFull(slot)) continue;
            candidates.push(bp);
        }
        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    /** Fallback when all powerups maxed — heal player */
    _healFallback(player) {
        const heal = 25;
        player?.heal?.(heal);
        return { id: 'heal', level: 0, type: 'heal', amount: heal };
    }
}
