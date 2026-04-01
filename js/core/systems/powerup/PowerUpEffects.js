/**
 * PowerUpEffects - Handles VFX and SFX for power-ups
 * PR7 Compliant - All effects driven by blueprint configuration
 */

export class PowerUpEffects {
    constructor(scene, powerUpSystem) {
        this.scene = scene;
        this.powerUpSystem = powerUpSystem;
        this.vfxManager = null;
    }
    
    /**
     * Set VFX Manager reference
     */
    setVFXManager(vfxManager) {
        this.vfxManager = vfxManager;
    }
    
    /**
     * Play effects when power-up is applied
     */
    playApplyEffects(blueprint, player) {
        if (!player) return;
        
        // Play VFX
        const vfxId = blueprint.vfx?.apply || blueprint.vfx?.pickup;
        if (vfxId && this.scene.vfxSystem) {
            this.scene.vfxSystem.play(vfxId, player.x, player.y);
        }
        
        // Play SFX
        const sfxId = blueprint.sfx?.apply || blueprint.sfx?.pickup;
        if (sfxId && this.scene.audioSystem) {
            this.scene.audioSystem.play(sfxId);
        }
        
        // Screen flash for epic power-ups
        if (blueprint.display?.rarity === 'legendary' || blueprint.display?.rarity === 'epic') {
            this._playEpicEffect(player);
        }
    }
    
    /**
     * Play effects when shield blocks damage
     */
    playShieldBlockEffect(player) {
        if (!player) return;
        
        // Play VFX
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('vfx.shield.block', player.x, player.y);
        }
        
        // Play SFX
        if (this.scene.audioSystem) {
            this.scene.audioSystem.play('sound/player_hit.mp3');
        }
    }
    
    /**
     * Play effects when shield breaks
     */
    playShieldBreakEffect(player) {
        if (!player) return;
        
        // Play VFX
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('vfx.shield.break', player.x, player.y);
        }
        
        // Play SFX
        if (this.scene.audioSystem) {
            this.scene.audioSystem.play('sound/glass_break.mp3');
        }
    }
    
    /**
     * Play effects when shield regenerates
     */
    playShieldRegenEffect(player) {
        if (!player) return;
        
        // Play VFX
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('vfx.shield.activate', player.x, player.y);
        }
        
        // Play SFX
        if (this.scene.audioSystem) {
            this.scene.audioSystem.play('sound/shield_up.mp3');
        }
    }
    
    /**
     * Play epic power-up effect
     */
    _playEpicEffect(player) {
        // Screen flash via scene interface
        if (this.scene.flashCamera) {
            this.scene.flashCamera(200, 255, 255, 0);
        }
        
        // Particle burst
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('vfx.powerup.epic', player.x, player.y);
        }
        
        // Time slow effect (optional) - PR7: Through VFXSystem
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('vfx.powerup.epic.timeslow', player.x, player.y, {
                duration: 400,
                slowFactor: 0.5
            });
        }
    }
    
    /**
     * Show level up text
     */
    _showLevelText(player, powerUpName, level) {
        // PR7: Delegate text animation to VFXSystem instead of direct tweens
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('vfx.powerup.levelup.text', player.x, player.y, {
                text: `${powerUpName} LVL ${level}`,
                fontSize: '16px',
                fontFamily: 'monospace',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 2
            });
        }
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.scene = null;
        this.powerUpSystem = null;
        this.vfxManager = null;
    }
}