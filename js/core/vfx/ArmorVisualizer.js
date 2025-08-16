/**
 * ArmorVisualizer - PR7 compliant visual representation of armor
 * Creates visual indicators for armored enemies
 */

export class ArmorVisualizer {
    constructor(scene) {
        this.scene = scene;
        this.armorIndicators = new Map();
        
        // PR7: Get visual config from ConfigResolver
        const CR = scene.configResolver || window.ConfigResolver;
        this.config = {
            showArmorBar: CR?.get('visual.armor.showBar', { defaultValue: false }) || false,
            showArmorTint: CR?.get('visual.armor.showTint', { defaultValue: true }) || true,
            showArmorIcon: CR?.get('visual.armor.showIcon', { defaultValue: false }) || false,
            armorTintColor: CR?.get('visual.armor.tintColor', { defaultValue: 0x808080 }) || 0x808080,
            armorTintStrength: CR?.get('visual.armor.tintStrength', { defaultValue: 0.3 }) || 0.3
        };
    }
    
    /**
     * Apply armor visual to enemy
     */
    applyArmorVisual(enemy) {
        if (!enemy || !enemy.armor || enemy.armor <= 0) return;
        
        // Apply metallic tint based on armor value
        if (this.config.showArmorTint) {
            this.applyArmorTint(enemy);
        }
        
        // Add armor bar (if enabled)
        if (this.config.showArmorBar) {
            this.createArmorBar(enemy);
        }
        
        // Add armor icon (if enabled)
        if (this.config.showArmorIcon) {
            this.createArmorIcon(enemy);
        }
    }
    
    /**
     * Apply metallic tint effect based on armor value
     */
    applyArmorTint(enemy) {
        const armorLevel = Math.min(enemy.armor, 10); // Cap at 10
        const tintStrength = armorLevel / 10; // 0 to 1
        
        // Mix original tint with metallic gray
        const originalTint = enemy.tint || 0xFFFFFF;
        const metallicTint = this.config.armorTintColor;
        
        // Simple tint mixing (could be improved)
        const r1 = (originalTint >> 16) & 0xFF;
        const g1 = (originalTint >> 8) & 0xFF;
        const b1 = originalTint & 0xFF;
        
        const r2 = (metallicTint >> 16) & 0xFF;
        const g2 = (metallicTint >> 8) & 0xFF;
        const b2 = metallicTint & 0xFF;
        
        const mixRatio = this.config.armorTintStrength * tintStrength;
        const r = Math.round(r1 * (1 - mixRatio) + r2 * mixRatio);
        const g = Math.round(g1 * (1 - mixRatio) + g2 * mixRatio);
        const b = Math.round(b1 * (1 - mixRatio) + b2 * mixRatio);
        
        const mixedTint = (r << 16) | (g << 8) | b;
        enemy.setTint(mixedTint);
        
        // Store original tint for restoration
        enemy._originalTint = originalTint;
        enemy._hasArmorTint = true;
    }
    
    /**
     * Create armor bar indicator
     */
    createArmorBar(enemy) {
        if (!this.scene.graphicsFactory) return;
        
        const graphics = this.scene.graphicsFactory.create();
        const barWidth = enemy.displayWidth * 0.8;
        const barHeight = 3;
        const barY = -enemy.displayHeight * 0.7;
        
        // Background
        graphics.fillStyle(0x000000, 0.5);
        graphics.fillRect(-barWidth/2, barY, barWidth, barHeight);
        
        // Armor bar (gray/metallic)
        const armorRatio = Math.min(enemy.armor / 10, 1); // Max 10 armor
        graphics.fillStyle(0x808080, 0.8);
        graphics.fillRect(-barWidth/2, barY, barWidth * armorRatio, barHeight);
        
        // Border
        graphics.lineStyle(1, 0xFFFFFF, 0.3);
        graphics.strokeRect(-barWidth/2, barY, barWidth, barHeight);
        
        this.armorIndicators.set(enemy, graphics);
        
        // Update position in enemy's update loop
        if (!enemy._originalUpdate) {
            enemy._originalUpdate = enemy.update;
            enemy.update = function(time, delta) {
                if (enemy._originalUpdate) {
                    enemy._originalUpdate.call(this, time, delta);
                }
                if (graphics && graphics.active) {
                    graphics.x = this.x;
                    graphics.y = this.y;
                }
            };
        }
    }
    
    /**
     * Create armor shield icon
     */
    createArmorIcon(enemy) {
        if (!this.scene.graphicsFactory) return;
        
        const graphics = this.scene.graphicsFactory.create();
        const iconSize = 8;
        const iconX = enemy.displayWidth * 0.5;
        const iconY = -enemy.displayHeight * 0.5;
        
        // Draw simple shield shape
        graphics.fillStyle(0x808080, 0.7);
        graphics.beginPath();
        graphics.moveTo(iconX - iconSize/2, iconY - iconSize/2);
        graphics.lineTo(iconX + iconSize/2, iconY - iconSize/2);
        graphics.lineTo(iconX + iconSize/2, iconY);
        graphics.lineTo(iconX, iconY + iconSize/2);
        graphics.lineTo(iconX - iconSize/2, iconY);
        graphics.closePath();
        graphics.fill();
        
        // Armor value text
        if (enemy.armor > 1) {
            // Would need text object for this
            // For now just use different shield sizes
            graphics.scale = 0.8 + (enemy.armor * 0.1);
        }
        
        // Store reference
        enemy._armorIcon = graphics;
    }
    
    /**
     * Remove armor visual from enemy
     */
    removeArmorVisual(enemy) {
        // Remove armor bar
        const graphics = this.armorIndicators.get(enemy);
        if (graphics) {
            this.scene.graphicsFactory?.release(graphics);
            this.armorIndicators.delete(enemy);
        }
        
        // Restore original tint
        if (enemy._hasArmorTint && enemy._originalTint !== undefined) {
            enemy.setTint(enemy._originalTint);
            enemy._hasArmorTint = false;
        }
        
        // Remove armor icon
        if (enemy._armorIcon) {
            this.scene.graphicsFactory?.release(enemy._armorIcon);
            enemy._armorIcon = null;
        }
    }
    
    /**
     * Update armor visual when armor changes
     */
    updateArmorVisual(enemy) {
        if (enemy.armor <= 0) {
            this.removeArmorVisual(enemy);
        } else {
            // Update tint
            if (this.config.showArmorTint) {
                this.applyArmorTint(enemy);
            }
            
            // Update bar
            const graphics = this.armorIndicators.get(enemy);
            if (graphics && this.config.showArmorBar) {
                // Redraw bar with new armor value
                graphics.clear();
                const barWidth = enemy.displayWidth * 0.8;
                const barHeight = 3;
                const barY = -enemy.displayHeight * 0.7;
                
                graphics.fillStyle(0x000000, 0.5);
                graphics.fillRect(-barWidth/2, barY, barWidth, barHeight);
                
                const armorRatio = Math.min(enemy.armor / 10, 1);
                graphics.fillStyle(0x808080, 0.8);
                graphics.fillRect(-barWidth/2, barY, barWidth * armorRatio, barHeight);
                
                graphics.lineStyle(1, 0xFFFFFF, 0.3);
                graphics.strokeRect(-barWidth/2, barY, barWidth, barHeight);
            }
        }
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.armorIndicators.forEach((graphics, enemy) => {
            this.removeArmorVisual(enemy);
        });
        this.armorIndicators.clear();
    }
}

export default ArmorVisualizer;