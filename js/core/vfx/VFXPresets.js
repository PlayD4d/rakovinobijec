import { DebugLogger } from '../debug/DebugLogger.js';

// Import all preset modules
import * as Combat from './presets/VFXPresetsCombat.js';
import * as Boss from './presets/VFXPresetsBoss.js';
import * as PowerUp from './presets/VFXPresetsPowerUp.js';
import * as Utility from './presets/VFXPresetsUtility.js';

/**
 * VFXPresets - Aggregator for all VFX preset modules
 * PR7 Compliant - Thin orchestrator pattern
 * 
 * Delegates to specialized modules for different effect categories.
 * Maintains backward compatibility with existing code.
 */

export class VFXPresets {
    // === COMBAT EFFECTS (delegated to VFXPresetsCombat) ===
    
    static smallHit(color = 0xFFFFFF, quantity = 8) {
        return Combat.smallHit(color, quantity);
    }
    
    static mediumHit(color = 0xFFFFFF, quantity = 12) {
        return Combat.mediumHit(color, quantity);
    }
    
    static largeHit(color = 0xFFFFFF) {
        return Combat.largeHit(color);
    }
    
    static explosion(size = 'medium', color = 0xFF6600) {
        return Combat.explosion(size, color);
    }
    
    static deathBurst(size = 'medium', color = 0xFF2222) {
        return Combat.deathBurst(size, color);
    }
    
    static enemyHit(color = 0xFF4444) {
        return Combat.enemyHit(color);
    }
    
    static enemyShoot(color = 0xFF4444) {
        return Combat.enemyShoot(color);
    }
    
    static muzzleFlash(color = 0xFFFFAA) {
        return Combat.muzzleFlash(color);
    }
    
    // === BOSS EFFECTS (delegated to VFXPresetsBoss) ===
    
    static bossSpawn(color = 0xFF0000) {
        return Boss.bossSpawn(color);
    }
    
    static bossDeath(color = 0xFFFF00) {
        return Boss.bossDeath(color);
    }
    
    static bossPhase(color = 0xFF00FF) {
        return Boss.bossPhase(color);
    }
    
    static bossSpecial(color = 0xFF8800) {
        return Boss.bossSpecial(color);
    }
    
    static bossBeamWarning(color = 0xFF0000) {
        return Boss.bossBeamWarning(color);
    }
    
    static bossOverloadCharge(color = 0xFF00FF) {
        return Boss.bossOverloadCharge(color);
    }
    
    static bossOverloadExplosion(color = 0xFFFF00) {
        return Boss.bossOverloadExplosion(color);
    }
    
    static bossRadiationStorm(color = 0x00FF00) {
        return Boss.bossRadiationStorm(color);
    }
    
    static bossVictory(color = 0xFFD700) {
        return Boss.bossVictory(color);
    }
    
    static radiationPulse(color = 0xCCFF00) {
        return Boss.radiationPulse(color);
    }
    
    // === POWER-UP EFFECTS (delegated to VFXPresetsPowerUp) ===
    
    static shieldHit(color = 0x00FFFF) {
        return PowerUp.shieldHit(color);
    }
    
    static shieldBreak(color = 0x00FFFF) {
        return PowerUp.shieldBreak(color);
    }
    
    static shieldActivate(color = 0x00FFFF) {
        return PowerUp.shieldActivate(color);
    }
    
    static powerupEffect(color = 0xFFFF00) {
        return PowerUp.powerupEffect(color);
    }
    
    static powerupEpic(color = 0xFF00FF) {
        return PowerUp.powerupEpic(color);
    }
    
    static pickup(color = 0x00FF88) {
        return PowerUp.pickup(color);
    }
    
    static levelup(color = 0xFFD700) {
        return PowerUp.levelup(color);
    }
    
    static heal(color = 0x00FF88) {
        return PowerUp.heal(color);
    }
    
    static aura(color = 0x8800FF, frequency = 100) {
        return PowerUp.aura(color, frequency);
    }
    
    // === UTILITY EFFECTS (delegated to VFXPresetsUtility) ===
    
    static trail(color = 0xFFFFFF, frequency = 50) {
        return Utility.trail(color, frequency);
    }
    
    static spawn(color = 0x8844AA, quantity = 12) {
        return Utility.spawn(color, quantity);
    }
    
    static flash(alpha = 0.8, duration = 100) {
        return Utility.flash(alpha, duration);
    }
    
    static genericEffect(color = 0xFFFFFF) {
        return Utility.genericEffect(color);
    }
    
    static specialEffect(color = 0xFFD700) {
        return Utility.specialEffect(color);
    }
    
    static telegraph(color = 0xFF0000) {
        return Utility.telegraph(color);
    }
    
    static victory(color = 0xFFD700) {
        return Utility.victory(color);
    }
    
    // === HELPER METHODS ===
    
    static merge(preset, custom = {}) {
        return Utility.merge(preset, custom);
    }
    
    /**
     * Get preset by name with optional color override
     * Maintains backward compatibility while delegating to modules
     */
    // Static lookup: name → [methodName, ...fixedArgs] (built once, no per-call allocation)
    static _presetMap = {
        'hit.small': ['smallHit'], 'hit.medium': ['mediumHit'], 'hit.large': ['largeHit'],
        'small': ['smallHit'], 'medium': ['mediumHit'], 'enemy.hit': ['enemyHit'],
        'explosion.small': ['explosion', 'small'], 'explosion.medium': ['explosion', 'medium'],
        'explosion.large': ['explosion', 'large'], 'explosion.toxic': ['explosion', 'medium', 0x00FF00],
        'trail': ['trail'], 'trail.small': ['trail', null, 100], 'trail.toxic': ['trail', 0x00FF00, 50],
        'death.small': ['deathBurst', 'small'], 'death.medium': ['deathBurst', 'medium'], 'death.large': ['deathBurst', 'large'],
        'spawn': ['spawn'], 'pickup': ['pickup'], 'powerup': ['powerupEffect'],
        'powerup.epic': ['powerupEpic'], 'levelup': ['levelup'], 'heal': ['heal'],
        'shield.hit': ['shieldHit'], 'shield.break': ['shieldBreak'], 'shield.activate': ['shieldActivate'],
        'boss.spawn': ['bossSpawn'], 'boss.death': ['bossDeath'], 'boss.phase': ['bossPhase'],
        'boss.special': ['bossSpecial'], 'boss.victory': ['bossVictory'],
        'boss.radiation.pulse': ['radiationPulse'], 'boss.beam.warning': ['bossBeamWarning'],
        'boss.overload.charge': ['bossOverloadCharge'], 'boss.overload.explosion': ['bossOverloadExplosion'],
        'boss.radiation.storm': ['bossRadiationStorm'],
        // Boss ability VFX — mapped to existing preset functions
        'boss.attack.basic': ['enemyShoot'], 'boss.burst.charge': ['bossOverloadCharge', 0xFF4400],
        'boss.spawn.minions': ['bossSpawn', 0xFF00FF], 'boss.area.explosion': ['explosion', 'large'],
        'boss.heal': ['heal'], 'boss.shield.activate': ['shieldActivate'],
        'boss.rage.activate': ['bossSpecial', 0xFF2222],
        'boss.phase.transition': ['bossPhase'], 'boss.aura.radiation': ['aura', 0xCCFF00],
        'boss.aura.healing_disrupt': ['aura', 0xFF0088],
        'boss.dash.impact': ['explosion', 'medium', 0xFFAA00],
        'boss.teleport.out': ['bossSpecial', 0x8844FF], 'boss.teleport.in': ['bossSpawn', 0x8844FF],
        'radiation.warning': ['telegraph', 0xCCFF00],
        'effect': ['genericEffect'], 'special': ['specialEffect'], 'telegraph': ['telegraph'],
        'aura': ['aura'], 'muzzle': ['muzzleFlash'], 'flash': ['flash'], 'victory': ['victory'],
        'enemy.shoot': ['enemyShoot'],
        'powerup.levelup.text': ['powerupEffect', 0xFFFF00], 'lightning.chain.bolt': ['smallHit', 0x4444FF],
        'powerup.epic.timeslow': ['powerupEpic', 0xFF00FF], 'aura.damage': ['aura', 0x00FF00],
        'lightning.strike': ['smallHit', 0x8888FF],
        'shoot': ['enemyShoot'], 'hit': ['enemyHit']
    };

    static getPreset(name, color = null) {
        const entry = this._presetMap[name];
        if (!entry) {
            DebugLogger.warn('vfx', `[VFXPresets] Unknown preset: ${name}`);
            return null;
        }

        // Call the method with fixed args — zero-alloc: index access instead of spread
        const method = entry[0];
        const fn = this[method];
        if (!fn) return null;

        const len = entry.length;
        if (len === 1) {
            return fn.call(this, color);
        } else if (len === 2) {
            const arg1 = entry[1];
            if (typeof arg1 === 'string') return fn.call(this, arg1, color);
            return fn.call(this, arg1 ?? color);
        } else {
            const arg1 = entry[1] !== null ? entry[1] : (color ?? undefined);
            return fn.call(this, arg1, entry[2]);
        }

    }
}

