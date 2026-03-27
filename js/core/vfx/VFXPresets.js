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
    static getPreset(name, color = null) {
        const presets = {
            // Basic hit effects (Combat)
            'hit.small': () => this.smallHit(color),
            'hit.medium': () => this.mediumHit(color),
            'hit.large': () => this.largeHit(color),
            'small': () => this.smallHit(color), // Alias
            'medium': () => this.mediumHit(color), // Alias
            'enemy.hit': () => this.enemyHit(color),
            
            // Explosion effects (Combat)
            'explosion.small': () => this.explosion('small', color),
            'explosion.medium': () => this.explosion('medium', color),
            'explosion.large': () => this.explosion('large', color),
            'explosion.toxic': () => this.explosion('medium', 0x00FF00),
            
            // Trail effects (Utility)
            'trail': () => this.trail(color),
            'trail.small': () => this.trail(color || 0xFFFFFF, 100),
            'trail.toxic': () => this.trail(0x00FF00, 50),
            
            // Death effects (Combat)
            'death.small': () => this.deathBurst('small', color),
            'death.medium': () => this.deathBurst('medium', color),
            'death.large': () => this.deathBurst('large', color),
            
            // Special effects (PowerUp & Utility)
            'spawn': () => this.spawn(color),
            'pickup': () => this.pickup(color),
            'powerup': () => this.powerupEffect(color),
            'powerup.epic': () => this.powerupEpic(color),
            'levelup': () => this.levelup(color),
            'heal': () => this.heal(color),
            
            // Shield effects (PowerUp)
            'shield.hit': () => this.shieldHit(color),
            'shield.break': () => this.shieldBreak(color),
            'shield.activate': () => this.shieldActivate(color),
            
            // Boss effects (Boss)
            'boss.spawn': () => this.bossSpawn(color),
            'boss.death': () => this.bossDeath(color),
            'boss.phase': () => this.bossPhase(color),
            'boss.special': () => this.bossSpecial(color),
            'boss.victory': () => this.bossVictory(color),
            'boss.radiation.pulse': () => this.radiationPulse(color),
            'boss.beam.warning': () => this.bossBeamWarning(color),
            'boss.overload.charge': () => this.bossOverloadCharge(color),
            'boss.overload.explosion': () => this.bossOverloadExplosion(color),
            'boss.radiation.storm': () => this.bossRadiationStorm(color),
            
            // Generic effects (Utility)
            'effect': () => this.genericEffect(color),
            'special': () => this.specialEffect(color),
            'telegraph': () => this.telegraph(color),
            'aura': () => this.aura(color),
            'muzzle': () => this.muzzleFlash(color),
            'flash': () => this.flash(),
            'victory': () => this.victory(color),
            'enemy.shoot': () => this.enemyShoot(color),
            
            // PowerUp refactor compatibility
            'powerup.levelup.text': () => this.powerupEffect(0xFFFF00),
            'lightning.chain.bolt': () => this.smallHit(0x4444FF),
            'powerup.epic.timeslow': () => this.powerupEpic(0xFF00FF),
            'aura.damage': () => this.aura(0x00FF00),
            
            // Lightning effects
            'lightning.strike': () => this.smallHit(0x8888FF),
            
            // Fallback mappings
            'shoot': () => this.enemyShoot(color),
            'hit': () => this.enemyHit(color)
        };
        
        const presetFn = presets[name];
        if (!presetFn) {
            DebugLogger.warn('vfx', `[VFXPresets] Unknown preset: ${name}`);
            return null;
        }
        
        return presetFn();
    }
}

export default VFXPresets;