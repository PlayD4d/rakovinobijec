/**
 * BossBeamEffect.js - VFX efekt pro boss paprsky
 * PR7 compliant - používá VFX systém místo přímých graphics volání
 */

export class BossBeamEffect {
    constructor(scene) {
        this.scene = scene;
        this.graphics = null;
        this.active = false;
        this.updateEvent = null;
    }
    
    /**
     * Spustí efekt rotujících paprsků
     * @param {Object} config - Konfigurace efektu
     */
    start(config) {
        if (this.active) this.stop();
        
        const {
            boss,
            beamCount = 4,
            beamWidth = 12,
            range = 350,
            duration = 3000,
            sweepSpeed = 90,
            damage = 15,
            color = 0x4CAF50
        } = config;
        
        if (!boss || !boss.active || !boss.scene) return;
        
        // Vytvoř graphics přes factory
        this.graphics = boss.scene.graphicsFactory?.create();
        if (!this.graphics) return;
        
        this.graphics.setDepth(150);
        this.active = true;
        
        let currentRotation = 0;
        const sweepRadians = (sweepSpeed * Math.PI) / 180;
        
        // Update loop
        this.updateEvent = boss.scene.time.addEvent({
            delay: 50,
            callback: () => {
                if (!boss.active || !boss.scene || !this.active) {
                    this.stop();
                    return;
                }
                
                // Clear and redraw
                this.graphics.clear();
                this.graphics.fillStyle(color, 0.6);
                this.graphics.lineStyle(3, color, 0.9);
                
                // Update rotation
                currentRotation += sweepRadians * 0.05;
                
                // Draw beams at boss position
                for (let i = 0; i < beamCount; i++) {
                    const baseAngle = (i / beamCount) * Math.PI * 2;
                    const angle = baseAngle + currentRotation;
                    
                    const beamRadians = (beamWidth * Math.PI) / 180;
                    const startAngle = angle - beamRadians / 2;
                    const endAngle = angle + beamRadians / 2;
                    
                    // Draw beam wedge
                    this.graphics.beginPath();
                    this.graphics.moveTo(boss.x, boss.y);
                    this.graphics.arc(boss.x, boss.y, range, startAngle, endAngle);
                    this.graphics.lineTo(boss.x, boss.y);
                    this.graphics.closePath();
                    this.graphics.fillPath();
                    this.graphics.strokePath();
                    
                    // Check collision with player
                    this._checkPlayerCollision(boss, angle, beamRadians, range, damage);
                }
            },
            repeat: duration / 50
        });
        
        // Auto cleanup after duration
        boss.scene.time.delayedCall(duration, () => {
            this.stop();
        });
    }
    
    /**
     * Zastaví efekt
     */
    stop() {
        this.active = false;
        
        if (this.updateEvent) {
            this.updateEvent.destroy();
            this.updateEvent = null;
        }
        
        if (this.graphics && this.graphics.active) {
            if (this.scene?.graphicsFactory) {
                this.scene.graphicsFactory.release(this.graphics);
            } else {
                this.graphics.destroy();
            }
            this.graphics = null;
        }
    }
    
    /**
     * Kontrola kolize s hráčem
     * @private
     */
    _checkPlayerCollision(boss, beamAngle, beamWidth, range, damage) {
        const player = boss.scene.player;
        if (!player || !player.active) return;
        
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > range) return;
        
        let playerAngle = Math.atan2(dy, dx);
        if (playerAngle < 0) playerAngle += Math.PI * 2;
        
        let beamAngleNorm = beamAngle % (Math.PI * 2);
        if (beamAngleNorm < 0) beamAngleNorm += Math.PI * 2;
        
        const angleDiff = Math.abs(playerAngle - beamAngleNorm);
        const minDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
        
        if (minDiff <= beamWidth / 2) {
            const now = Date.now();
            if (!player._lastBeamDamage || now - player._lastBeamDamage > 500) {
                player.takeDamage(damage, { source: boss, type: 'beam' });
                player._lastBeamDamage = now;
            }
        }
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.stop();
        this.scene = null;
    }
}

export default BossBeamEffect;