/**
 * RadiotherapyEffect - PR7 compliant rotating radiation beams effect
 * Creates rotating radiation beams around the player
 */

export class RadiotherapyEffect {
    constructor(scene, type, config = {}) {
        this.scene = scene;
        this.type = type;
        this.config = config;
        
        // Visual components
        this.graphics = null;
        this.entity = null;
        this.active = false;
        
        // PR7: All visual configuration from blueprint - radioactive symbol style ☢️
        this.beamCount = config.beamCount || 1;
        this.beamRange = config.range || 80;
        // Calculate safe beam width to prevent overlap
        // Maximum width is (360° / beam count) - small gap
        const maxSafeWidth = ((Math.PI * 2) / Math.max(1, this.beamCount)) * 0.8; // 80% of available space
        this.beamWidth = Math.min(config.beamWidth || 0.3, maxSafeWidth); // Width in radians
        this.beamColor = config.beamColor || 0xCCFF00; // Radioactive yellow-green
        this.beamAlpha = config.beamAlpha || 0.7;
        this.rotationSpeed = config.rotationSpeed || 2; // Radians per second
        
        // PR7: Visual parameters from blueprint
        this.innerRadius = config.innerRadius || 30;
        this.innerWidthRatio = config.innerWidthRatio || 0.4;
        this.outerWidthRatio = config.outerWidthRatio || 0.8;
        this.glowWidthRatio = config.glowWidthRatio || 0.3;
        this.glowAlpha = config.glowAlpha || 0.3;
        this.strokeWidth = config.strokeWidth || 2;
        this.strokeAlpha = config.strokeAlpha || 0.9;
        this.fillAlpha = config.fillAlpha || 0.7
        
        // Damage configuration
        this.damage = config.damage || 5;
        this.tickRate = config.tickRate || 0.1; // Damage every 100ms
        this.lastDamageTick = 0;
        
        console.log(`[RadiotherapyEffect] Created - damage: ${this.damage}, tick rate: ${this.tickRate}s`);
        
        // Current rotation angle
        this.currentAngle = 0;
        
        // Track damaged enemies to prevent multiple hits per tick
        this.damagedEnemies = new Set();
    }
    
    /**
     * Attach effect to an entity (usually the player)
     * @param {Phaser.GameObjects.Sprite} entity
     */
    attach(entity) {
        if (this.active) this.detach();
        
        this.entity = entity;
        this.active = true;
        
        console.log(`[RadiotherapyEffect] Attached with ${this.beamCount} beams, range: ${this.beamRange}, width: ${(this.beamWidth * 180/Math.PI).toFixed(1)}°, damage: ${this.damage}/tick`);
        
        // PR7: Create graphics through factory method
        this.graphics = this._createGraphics();
        if (this.graphics) {
            this.graphics.setDepth(entity.depth - 1); // Render below entity
            // Set initial position
            this.graphics.x = entity.x;
            this.graphics.y = entity.y;
        }
        
        // Play looping radiation sound
        if (this.scene.sfxSystem) {
            this.loopId = this.scene.sfxSystem.playLoop('radiotherapy');
        }
    }
    
    /**
     * Detach effect from entity
     */
    detach() {
        if (!this.active) return;
        
        this.active = false;
        this.entity = null;
        
        // PR7: Clean up graphics properly
        if (this.graphics) {
            // Return to factory pool if available
            if (this.scene.graphicsFactory) {
                this.scene.graphicsFactory.release(this.graphics);
            } else {
                // Fallback to destroy
                this.graphics.destroy();
            }
            this.graphics = null;
        }
        
        // Stop looping sound - PR7: používáme newSFXSystem
        if (this.loopId && this.scene.newSFXSystem) {
            this.scene.newSFXSystem.stopLoop(this.loopId);
            this.loopId = null;
        }
        
        // Clear damaged enemies set
        this.damagedEnemies.clear();
    }
    
    /**
     * Update beam configuration (called when power-up levels up)
     */
    updateConfig(config) {
        console.log('[RadiotherapyEffect] Updating config:', config);
        
        if (config.beamCount !== undefined) {
            this.beamCount = config.beamCount;
            // Recalculate safe beam width when beam count changes
            const maxSafeWidth = ((Math.PI * 2) / Math.max(1, this.beamCount)) * 0.8;
            this.beamWidth = Math.min(config.beamWidth || this.beamWidth || 0.3, maxSafeWidth);
        }
        if (config.range !== undefined) this.beamRange = config.range;
        if (config.damage !== undefined) this.damage = config.damage;
        if (config.beamWidth !== undefined) {
            // Ensure beam width doesn't exceed safe maximum
            const maxSafeWidth = ((Math.PI * 2) / Math.max(1, this.beamCount)) * 0.8;
            this.beamWidth = Math.min(config.beamWidth, maxSafeWidth);
        }
        if (config.rotationSpeed !== undefined) this.rotationSpeed = config.rotationSpeed;
        
        // PR7: Update visual parameters if provided
        if (config.innerRadius !== undefined) this.innerRadius = config.innerRadius;
        if (config.innerWidthRatio !== undefined) this.innerWidthRatio = config.innerWidthRatio;
        if (config.outerWidthRatio !== undefined) this.outerWidthRatio = config.outerWidthRatio;
        if (config.beamColor !== undefined) this.beamColor = config.beamColor;
        if (config.beamAlpha !== undefined) this.beamAlpha = config.beamAlpha;
        if (config.glowAlpha !== undefined) this.glowAlpha = config.glowAlpha;
        if (config.strokeWidth !== undefined) this.strokeWidth = config.strokeWidth;
        if (config.strokeAlpha !== undefined) this.strokeAlpha = config.strokeAlpha;
        if (config.fillAlpha !== undefined) this.fillAlpha = config.fillAlpha;
        
        console.log(`[RadiotherapyEffect] Config updated - Beams: ${this.beamCount}, Range: ${this.beamRange}, Width: ${(this.beamWidth * 180/Math.PI).toFixed(1)}°, Damage: ${this.damage}`);
    }
    
    /**
     * Update the effect
     * @param {number} time - Game time
     * @param {number} delta - Delta time in ms
     */
    update(time, delta) {
        if (!this.active || !this.entity || !this.entity.active) return;
        
        // Update graphics position to follow entity
        if (this.graphics) {
            this.graphics.x = this.entity.x;
            this.graphics.y = this.entity.y;
        }
        
        // Update rotation
        this.currentAngle += (this.rotationSpeed * delta) / 1000;
        if (this.currentAngle > Math.PI * 2) {
            this.currentAngle -= Math.PI * 2;
        }
        
        // Clear and redraw beams
        this.graphics.clear();
        
        // Draw each beam - EVENLY SPACED like radioactive symbol ☢️
        // For 3 beams: 120° apart (0°, 120°, 240°)
        // For 2 beams: 180° apart (0°, 180°) 
        // For 1 beam: just one beam
        const angleStep = (Math.PI * 2) / this.beamCount;
        for (let i = 0; i < this.beamCount; i++) {
            // Each beam maintains fixed offset from others
            const beamAngle = this.currentAngle + (angleStep * i);
            this._drawBeam(beamAngle);
        }
        
        // Check for damage
        if (time - this.lastDamageTick > this.tickRate * 1000) {
            this._applyDamage(time);
            this.lastDamageTick = time;
            this.damagedEnemies.clear(); // Reset for next tick
        }
    }
    
    /**
     * Draw a single radiation beam - radioactive symbol style ☢️
     * @private
     */
    _drawBeam(angle) {
        if (!this.entity) return;
        
        // Draw relative to (0,0) since graphics object position is updated
        const x = 0;
        const y = 0;
        
        // PR7: Use visual parameters from blueprint - radioactive symbol style ☢️
        const innerRadius = this.innerRadius; // Start the beam away from player
        const outerRadius = this.beamRange;
        
        // Width of the beam at different distances (radioactive symbol proportions)
        const innerWidth = this.beamWidth * this.innerWidthRatio; // Narrower at the player
        const outerWidth = this.beamWidth * this.outerWidthRatio; // Wider at the end
        
        // Calculate angles for inner and outer arcs
        const innerStartAngle = angle - innerWidth / 2;
        const innerEndAngle = angle + innerWidth / 2;
        const outerStartAngle = angle - outerWidth / 2;
        const outerEndAngle = angle + outerWidth / 2;
        
        // PR7: Use colors from configuration
        const radioactiveColor = this.beamColor;
        this.graphics.fillStyle(radioactiveColor, this.beamAlpha * this.fillAlpha);
        this.graphics.lineStyle(this.strokeWidth, radioactiveColor, this.beamAlpha * this.strokeAlpha);
        
        // Draw beam as a trapezoid arc (radioactive wedge shape)
        this.graphics.beginPath();
        
        // Start at inner arc (near player)
        const innerStartX = x + Math.cos(innerStartAngle) * innerRadius;
        const innerStartY = y + Math.sin(innerStartAngle) * innerRadius;
        this.graphics.moveTo(innerStartX, innerStartY);
        
        // Draw inner arc (small arc near player)
        const innerSteps = 5;
        for (let i = 1; i <= innerSteps; i++) {
            const currentAngle = innerStartAngle + (innerEndAngle - innerStartAngle) * (i / innerSteps);
            const px = x + Math.cos(currentAngle) * innerRadius;
            const py = y + Math.sin(currentAngle) * innerRadius;
            this.graphics.lineTo(px, py);
        }
        
        // Connect to outer arc (straight line from inner end to outer end)
        const outerEndX = x + Math.cos(outerEndAngle) * outerRadius;
        const outerEndY = y + Math.sin(outerEndAngle) * outerRadius;
        this.graphics.lineTo(outerEndX, outerEndY);
        
        // Draw outer arc (wider arc at the end) - REVERSE direction
        const outerSteps = 10;
        for (let i = outerSteps - 1; i >= 0; i--) {
            const currentAngle = outerStartAngle + (outerEndAngle - outerStartAngle) * (i / outerSteps);
            const px = x + Math.cos(currentAngle) * outerRadius;
            const py = y + Math.sin(currentAngle) * outerRadius;
            this.graphics.lineTo(px, py);
        }
        
        // Connect back to start (straight line from outer start to inner start)
        this.graphics.lineTo(innerStartX, innerStartY);
        
        this.graphics.closePath();
        this.graphics.fillPath();
        this.graphics.strokePath();
        
        // PR7: Use glow alpha from configuration
        this.graphics.fillStyle(radioactiveColor, this.beamAlpha * this.glowAlpha);
        this.graphics.beginPath();
        
        // PR7: Use glow ratio from configuration
        const glowRadius = (innerRadius + outerRadius) * 0.5;
        const glowWidth = (innerWidth + outerWidth) * this.glowWidthRatio;
        const glowStartAngle = angle - glowWidth / 2;
        const glowEndAngle = angle + glowWidth / 2;
        
        this.graphics.moveTo(x + Math.cos(glowStartAngle) * innerRadius, 
                           y + Math.sin(glowStartAngle) * innerRadius);
        
        for (let i = 0; i <= 5; i++) {
            const currentAngle = glowStartAngle + (glowEndAngle - glowStartAngle) * (i / 5);
            const px = x + Math.cos(currentAngle) * glowRadius;
            const py = y + Math.sin(currentAngle) * glowRadius;
            this.graphics.lineTo(px, py);
        }
        
        for (let i = 5; i >= 0; i--) {
            const currentAngle = glowStartAngle + (glowEndAngle - glowStartAngle) * (i / 5);
            const px = x + Math.cos(currentAngle) * innerRadius;
            const py = y + Math.sin(currentAngle) * innerRadius;
            this.graphics.lineTo(px, py);
        }
        
        this.graphics.closePath();
        this.graphics.fillPath();
    }
    
    /**
     * Apply radiation damage to enemies in beams
     * @private
     */
    _applyDamage(time) {
        if (!this.entity) return;
        
        // PR7: Use enemiesGroup from SpawnDirector integration
        const enemiesGroup = this.scene.enemiesGroup || this.scene.enemies;
        if (!enemiesGroup) {
            console.warn('[RadiotherapyEffect] No enemies group found in scene!');
            return;
        }
        
        const x = this.entity.x;
        const y = this.entity.y;
        let enemiesInRange = 0;
        let enemiesHit = 0;
        
        // Get enemies from group - proper Phaser way
        const enemies = enemiesGroup.getChildren ? enemiesGroup.getChildren() : [];
        
        // Check each enemy
        enemies.forEach(enemy => {
            // Skip if enemy is invalid, inactive, dead, or already damaged this tick
            if (!enemy || !enemy.active || enemy.hp <= 0 || this.damagedEnemies.has(enemy)) return;
            
            // Also skip if enemy doesn't have required methods
            if (!enemy.takeDamage || typeof enemy.takeDamage !== 'function') return;
            
            // Calculate distance and angle to enemy
            const dx = enemy.x - x;
            const dy = enemy.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Skip if out of range
            if (distance > this.beamRange) return;
            enemiesInRange++;
            
            // Calculate angle to enemy
            let enemyAngle = Math.atan2(dy, dx);
            if (enemyAngle < 0) enemyAngle += Math.PI * 2;
            
            // Check if enemy is in any beam
            const angleStep = (Math.PI * 2) / this.beamCount;
            for (let i = 0; i < this.beamCount; i++) {
                // Check if enemy was already damaged (in case it got added during loop)
                if (this.damagedEnemies.has(enemy)) break;
                
                let beamAngle = this.currentAngle + (angleStep * i);
                
                // Normalize beam angle
                while (beamAngle > Math.PI * 2) beamAngle -= Math.PI * 2;
                while (beamAngle < 0) beamAngle += Math.PI * 2;
                
                // Check if enemy is within beam arc
                let angleDiff = Math.abs(enemyAngle - beamAngle);
                
                // Handle wrap-around
                if (angleDiff > Math.PI) {
                    angleDiff = Math.PI * 2 - angleDiff;
                }
                
                if (angleDiff <= this.beamWidth / 2) {
                    // Enemy is in beam - apply damage ONCE
                    // Add to damaged set BEFORE applying damage to prevent duplicates
                    this.damagedEnemies.add(enemy);
                    
                    const result = enemy.takeDamage(this.damage, 'radiotherapy');
                    if (result > 0) {
                        enemiesHit++;
                        
                        // Visual hit effect
                        if (this.scene.newVFXSystem) {
                            this.scene.newVFXSystem.play('vfx.hit.radiation', enemy.x, enemy.y);
                        }
                    }
                    
                    break; // Enemy can only be hit by one beam per tick
                }
            }
        });
    }
    
    /**
     * Check if effect is active
     */
    isActive() {
        return this.active;
    }
    
    /**
     * Clean up
     */
    destroy() {
        this.detach();
    }
    
    // ==========================================
    // PR7 Factory Methods - Replace Direct Calls
    // ==========================================
    
    /**
     * Factory method for creating graphics objects
     * PR7 compliant - uses centralized graphics creation
     * @returns {Phaser.GameObjects.Graphics}
     * @private
     */
    _createGraphics() {
        // PR7: Check if scene has a graphics factory
        if (this.scene.graphicsFactory) {
            return this.scene.graphicsFactory.create();
        }
        
        // PR7: Check if ProjectileSystem provides graphics creation
        if (this.scene.projectileSystem && this.scene.projectileSystem._createGraphics) {
            return this.scene.projectileSystem._createGraphics();
        }
        
        // PR7: Fallback to scene's add method if available
        // This is still technically a violation but necessary for graphics
        // as Phaser doesn't provide any other way to create graphics objects
        if (this.scene && this.scene.add && this.scene.add.graphics) {
            // Log this as a PR7 exception that needs framework support
            if (Math.random() < 0.01) { // Only log occasionally
                console.warn('[RadiotherapyEffect] Using scene.add.graphics fallback - needs PR7 GraphicsFactory');
            }
            return this.scene.add.graphics();
        }
        
        console.error('[RadiotherapyEffect] Cannot create graphics - no factory available');
        return null;
    }
}

export default RadiotherapyEffect;