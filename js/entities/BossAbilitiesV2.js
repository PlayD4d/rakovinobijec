/**
 * BossAbilitiesV2.js - PR7 compliant boss schopnosti
 * Používá VFX systém místo přímých graphics volání
 */

import { BossBeamEffect } from '../core/vfx/effects/BossBeamEffect.js';
import { getSessionLogger } from '../core/logging/SessionLogger.js';

export class BossAbilitiesV2 {
    
    /**
     * Radiation Pulse - expandující vlny radiace
     * PR7: Používáme VFX systém pro vizualizaci
     */
    static executeRadiationPulse(boss, params) {
        if (!boss.scene || !boss.active) return;
        
        const logger = getSessionLogger();
        logger?.logBossAbility(boss, 'radiation_pulse', params);
        
        const damage = params.damage || 8;
        const radius = params.radius || 180;
        const expandSpeed = params.expandSpeed || 150;
        const pulseCount = params.pulseCount || 3;
        const pulseInterval = params.pulsInterval || 800;
        const warningTime = params.warningTime || 1200;
        
        // Visual warning before pulse
        this._createPulseWarning(boss, radius, warningTime);
        
        // Execute pulses - používáme existující VFX efekt
        for (let i = 0; i < pulseCount; i++) {
            boss.scene.time.delayedCall(warningTime + (i * pulseInterval), () => {
                if (!boss.active) return;
                
                logger?.logVFXCall('vfx.boss.radiation.pulse', boss.x, boss.y, { radius, expandSpeed });
                
                // Play pulse VFX through VFX system with fallback
                if (boss.scene.vfxSystem) {
                    try {
                        boss.scene.vfxSystem.play('vfx.boss.radiation.pulse', boss.x, boss.y);
                    } catch (error) {
                        console.warn('[BossAbilitiesV2] Fallback to visual pulse');
                        this._createFallbackPulse(boss, radius, 0x4CAF50);
                    }
                } else {
                    this._createFallbackPulse(boss, radius, 0x4CAF50);
                }
                
                // Damage check - musíme to udělat manuálně protože VFX nemá damage logic
                const player = boss.scene.player;
                if (player && player.active) {
                    const dist = Phaser.Math.Distance.Between(boss.x, boss.y, player.x, player.y);
                    if (dist <= radius) {
                        player.takeDamage(damage, { source: boss, type: 'radiation_pulse' });
                    }
                }
            });
        }
    }
    
    /**
     * Beam Sweep - rotující paprsky
     * PR7: Používáme specializovaný VFX efekt
     */
    static executeBeamSweep(boss, params) {
        if (!boss.scene || !boss.active) return;
        
        const beamCount = params.beamCount || 4;
        const damage = params.damage || 15;
        const sweepSpeed = params.sweepSpeed || 90;
        const beamWidth = params.beamWidth || 12;
        const chargeTime = params.chargeTime || 1500;
        const defaultRange = params.range || 350;
        const range = defaultRange * 0.8; // 20% reduction
        const duration = params.duration || 3000;
        
        // Create beam effect instance if not exists
        if (!boss._beamEffect) {
            boss._beamEffect = new BossBeamEffect(boss.scene);
        }
        
        // Show warning with fallback
        if (boss.scene.vfxSystem) {
            try {
                boss.scene.vfxSystem.play('vfx.boss.beam.warning', boss.x, boss.y, {
                    beamCount,
                    range,
                    duration: chargeTime,
                    follow: boss
                });
            } catch (error) {
                // Fallback to visual warning
                this._createBeamWarning(boss, beamCount, range, chargeTime);
            }
        } else {
            this._createBeamWarning(boss, beamCount, range, chargeTime);
        }
        
        // Start beam sweep after charge
        boss.scene.time.delayedCall(chargeTime, () => {
            if (!boss.active) return;
            
            boss._beamEffect.start({
                boss,
                beamCount,
                beamWidth,
                range,
                duration,
                sweepSpeed,
                damage,
                color: 0x4CAF50
            });
        });
    }
    
    /**
     * Rapid Beams - rychlé střílení paprsků
     * PR7: Používáme VFX systém pro každý paprsek
     */
    static executeRapidBeams(boss, params) {
        if (!boss.scene || !boss.active) return;
        
        const beamCount = params.beamCount || 8;
        const damage = params.damage || 12;
        const fireRate = params.fireRate || 0.4;
        const duration = params.duration || 4000;
        const defaultRange = params.range || 400;
        const range = defaultRange * 0.8;
        
        let isActive = true;
        const fireInterval = 1000 / fireRate;
        
        const fireEvent = boss.scene.time.addEvent({
            delay: fireInterval,
            callback: () => {
                if (!boss.active || !boss.scene || !isActive) {
                    fireEvent.destroy();
                    return;
                }
                
                // Fire beams through VFX system
                for (let i = 0; i < beamCount; i++) {
                    const angle = (i / beamCount) * Math.PI * 2;
                    
                    if (boss.scene.vfxSystem) {
                        boss.scene.vfxSystem.play('vfx.boss.beam.rapid', boss.x, boss.y, {
                            angle,
                            range,
                            damage,
                            source: boss,
                            duration: 100 // Quick flash
                        });
                    }
                }
            },
            repeat: Math.floor(duration / fireInterval)
        });
        
        boss.scene.time.delayedCall(duration, () => {
            isActive = false;
            if (fireEvent) fireEvent.destroy();
        });
    }
    
    /**
     * Radiation Storm - oblast trvalého poškození
     * PR7: Používáme VFX systém pro storm efekt
     */
    static executeRadiationStorm(boss, params) {
        if (!boss.scene || !boss.active) return;
        
        const damage = params.damage || 4;
        const radius = params.radius || 300;
        const stormDuration = params.stormDuration || 6000;
        const tickInterval = params.tickInterval || 300;
        
        // Play storm VFX through VFX system
        if (boss.scene.vfxSystem) {
            const stormEffect = boss.scene.vfxSystem.play('vfx.boss.radiation.storm', boss.x, boss.y, {
                radius,
                duration: stormDuration,
                follow: boss,
                persistent: true
            });
            
            // Damage tick
            const damageEvent = boss.scene.time.addEvent({
                delay: tickInterval,
                callback: () => {
                    if (!boss.active || !boss.scene) {
                        damageEvent.destroy();
                        if (stormEffect && stormEffect.stop) {
                            stormEffect.stop();
                        }
                        return;
                    }
                    
                    // Check player in storm radius
                    const player = boss.scene.player;
                    if (player && player.active) {
                        const dist = Phaser.Math.Distance.Between(boss.x, boss.y, player.x, player.y);
                        if (dist <= radius) {
                            player.takeDamage(damage, { source: boss, type: 'storm' });
                        }
                    }
                },
                repeat: stormDuration / tickInterval
            });
            
            // Store reference for cleanup
            boss._activeStormEffect = stormEffect;
            boss._activeStormDamage = damageEvent;
        }
    }
    
    /**
     * Core Overload - závěrečný zoufalý útok
     * PR7: Používáme VFX systém pro vizualizaci
     */
    static executeCoreOverload(boss, params) {
        if (!boss.scene || !boss.active) return;
        
        const damage = params.damage || 25;
        const radius = params.radius || 250;
        const chargeTime = params.chargeTime || 4000;
        const explosionCount = params.explosionCount || 5;
        const explosionInterval = params.explosionInterval || 800;
        const selfDamage = params.selfDamage || 50;
        
        // Play charging VFX through VFX system
        if (boss.scene.vfxSystem) {
            boss.scene.vfxSystem.play('vfx.boss.overload.charge', boss.x, boss.y, {
                radius,
                duration: chargeTime,
                follow: boss
            });
        }
        
        // Execute explosions
        boss.scene.time.delayedCall(chargeTime, () => {
            if (!boss.active) return;
            
            for (let i = 0; i < explosionCount; i++) {
                boss.scene.time.delayedCall(i * explosionInterval, () => {
                    if (!boss.active || !boss.scene) return;
                    
                    // Play explosion VFX
                    if (boss.scene.vfxSystem) {
                        boss.scene.vfxSystem.play('vfx.boss.overload.explosion', boss.x, boss.y, {
                            radius,
                            damage,
                            source: boss
                        });
                    }
                    
                    // Check player damage
                    const player = boss.scene.player;
                    if (player && player.active) {
                        const dist = Phaser.Math.Distance.Between(boss.x, boss.y, player.x, player.y);
                        if (dist <= radius) {
                            player.takeDamage(damage, { source: boss, type: 'explosion' });
                        }
                    }
                    
                    // Self damage on last explosion
                    if (i === explosionCount - 1) {
                        boss.takeDamage(selfDamage, { source: 'self', type: 'overload' });
                    }
                });
            }
        });
    }
    
    /**
     * Cleanup all active effects
     * Voláno při smrti bosse
     */
    static cleanup(boss) {
        // Clean up beam effect
        if (boss._beamEffect) {
            boss._beamEffect.destroy();
            boss._beamEffect = null;
        }
        
        // Clean up storm effect
        if (boss._activeStormEffect && boss._activeStormEffect.stop) {
            boss._activeStormEffect.stop();
            boss._activeStormEffect = null;
        }
        
        if (boss._activeStormDamage) {
            boss._activeStormDamage.destroy();
            boss._activeStormDamage = null;
        }
        
        // Clean up warning graphics
        if (boss._warningGraphics) {
            boss._warningGraphics.destroy();
            boss._warningGraphics = null;
        }
    }
    
    // === VISUAL WARNING HELPERS ===
    
    /**
     * Create pulse warning circle
     * @private
     */
    static _createPulseWarning(boss, radius, duration) {
        if (!boss.scene || !boss.scene.graphicsFactory) return;
        
        const graphics = boss.scene.graphicsFactory.create();
        graphics.setDepth(100);
        
        // Animate warning circle
        let alpha = 0;
        const warningEvent = boss.scene.time.addEvent({
            delay: 50,
            callback: () => {
                if (!boss.active || !graphics.active) {
                    warningEvent.destroy();
                    graphics.destroy();
                    return;
                }
                
                alpha = Math.min(alpha + 0.05, 0.5);
                graphics.clear();
                graphics.lineStyle(3, 0xFF9800, alpha);
                graphics.strokeCircle(boss.x, boss.y, radius);
                
                // Pulse effect
                const pulse = Math.sin(Date.now() * 0.005) * 10;
                graphics.lineStyle(2, 0xFFFF00, alpha * 0.5);
                graphics.strokeCircle(boss.x, boss.y, radius + pulse);
            },
            repeat: duration / 50
        });
        
        // Clean up after duration
        boss.scene.time.delayedCall(duration, () => {
            if (graphics.active) graphics.destroy();
        });
        
        boss._warningGraphics = graphics;
    }
    
    /**
     * Create fallback pulse effect
     * @private
     */
    static _createFallbackPulse(boss, radius, color) {
        if (!boss.scene || !boss.scene.graphicsFactory) return;
        
        const graphics = boss.scene.graphicsFactory.create();
        graphics.setDepth(120);
        
        // Expanding circle
        let currentRadius = 0;
        const expandEvent = boss.scene.time.addEvent({
            delay: 20,
            callback: () => {
                currentRadius += radius / 25;
                if (currentRadius >= radius) {
                    expandEvent.destroy();
                    graphics.destroy();
                    return;
                }
                
                const alpha = 1 - (currentRadius / radius);
                graphics.clear();
                graphics.lineStyle(4, color, alpha);
                graphics.strokeCircle(boss.x, boss.y, currentRadius);
            },
            repeat: 25
        });
    }
    
    /**
     * Create beam warning lines
     * @private
     */
    static _createBeamWarning(boss, beamCount, range, duration) {
        if (!boss.scene || !boss.scene.graphicsFactory) return;
        
        const graphics = boss.scene.graphicsFactory.create();
        graphics.setDepth(100);
        
        let alpha = 0;
        let rotation = 0;
        
        const warningEvent = boss.scene.time.addEvent({
            delay: 50,
            callback: () => {
                if (!boss.active || !graphics.active) {
                    warningEvent.destroy();
                    graphics.destroy();
                    return;
                }
                
                alpha = Math.min(alpha + 0.02, 0.4);
                rotation += 0.01;
                
                graphics.clear();
                graphics.lineStyle(2, 0xFF9800, alpha);
                
                // Draw beam warning lines
                for (let i = 0; i < beamCount; i++) {
                    const angle = (i / beamCount) * Math.PI * 2 + rotation;
                    const x2 = boss.x + Math.cos(angle) * range;
                    const y2 = boss.y + Math.sin(angle) * range;
                    
                    graphics.beginPath();
                    graphics.moveTo(boss.x, boss.y);
                    graphics.lineTo(x2, y2);
                    graphics.strokePath();
                }
                
                // Add pulsing circle at center
                const pulse = Math.sin(Date.now() * 0.005) * 5;
                graphics.lineStyle(3, 0xFFFF00, alpha);
                graphics.strokeCircle(boss.x, boss.y, 30 + pulse);
            },
            repeat: duration / 50
        });
        
        // Clean up after duration
        boss.scene.time.delayedCall(duration, () => {
            if (graphics.active) graphics.destroy();
        });
    }
}

export default BossAbilitiesV2;