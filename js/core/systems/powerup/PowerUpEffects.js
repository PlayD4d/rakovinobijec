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
     * Play effects when power-up levels up
     */
    playLevelUpEffects(blueprint, player, newLevel) {
        if (!player) return;
        
        // Play VFX
        const vfxId = blueprint.vfx?.levelUp;
        if (vfxId && this.scene.vfxSystem) {
            this.scene.vfxSystem.play(vfxId, player.x, player.y);
        }
        
        // Play SFX
        const sfxId = blueprint.sfx?.levelUp;
        if (sfxId && this.scene.audioSystem) {
            this.scene.audioSystem.play(sfxId);
        }
        
        // Show level text
        this._showLevelText(player, blueprint.display?.devNameFallback || blueprint.id, newLevel);
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
     * Attach continuous effect to player
     */
    attachContinuousEffect(player, effectType, config) {
        if (!this.vfxManager) return;
        
        this.vfxManager.attachEffect(player, effectType, config);
    }
    
    /**
     * Detach continuous effect from player
     */
    detachContinuousEffect(player, effectType) {
        if (!this.vfxManager) return;
        
        this.vfxManager.detachEffect(player, effectType);
    }
    
    /**
     * Play epic power-up effect
     */
    _playEpicEffect(player) {
        // Screen flash
        if (this.scene.cameras?.main) {
            this.scene.cameras.main.flash(200, 255, 255, 0, 0.5);
        }
        
        // Particle burst
        if (this.scene.vfxSystem) {
            this.scene.vfxSystem.play('vfx.powerup.epic', player.x, player.y);
        }
        
        // Time slow effect (optional)
        if (this.scene.time) {
            this.scene.time.delayedCall(100, () => {
                this.scene.physics.world.timeScale = 0.5;
                this.scene.time.delayedCall(300, () => {
                    this.scene.physics.world.timeScale = 1.0;
                });
            });
        }
    }
    
    /**
     * Show level up text
     */
    _showLevelText(player, powerUpName, level) {
        if (!this.scene.add) return;
        
        const text = this.scene.add.text(
            player.x,
            player.y - 50,
            `${powerUpName} LVL ${level}`,
            {
                fontSize: '16px',
                fontFamily: 'monospace',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 2
            }
        );
        
        text.setOrigin(0.5);
        text.setDepth(1000);
        
        // Animate text
        this.scene.tweens.add({
            targets: text,
            y: player.y - 100,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
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