/**
 * GraphicsFactory - PR7 compliant graphics creation
 * Centralizes all graphics object creation to avoid direct Phaser API calls
 */

import { DebugLogger } from '../debug/DebugLogger.js';

export class GraphicsFactory {
    constructor(scene) {
        this.scene = scene;
        this.graphicsPool = [];
        this.activeGraphics = new Set();
        this.maxPoolSize = 50;
        
        DebugLogger.info('graphics', '[GraphicsFactory] Initialized with pool size:', this.maxPoolSize);
    }
    
    /**
     * Create or get a graphics object from pool
     * @returns {Phaser.GameObjects.Graphics}
     */
    create() {
        let graphics;
        
        // Try to get from pool first
        if (this.graphicsPool.length > 0) {
            graphics = this.graphicsPool.pop();
            graphics.clear();
            graphics.setVisible(true);
            graphics.setActive(true);
        } else {
            // Create new if pool is empty
            graphics = this.scene.add.graphics();
        }
        
        this.activeGraphics.add(graphics);
        return graphics;
    }
    
    /**
     * Return graphics object to pool
     * @param {Phaser.GameObjects.Graphics} graphics
     */
    release(graphics) {
        if (!graphics || !this.activeGraphics.has(graphics)) return;
        
        graphics.clear();
        graphics.setVisible(false);
        graphics.setActive(false);
        graphics.setDepth(0);
        
        this.activeGraphics.delete(graphics);
        
        // Add to pool if not full
        if (this.graphicsPool.length < this.maxPoolSize) {
            this.graphicsPool.push(graphics);
        } else {
            // Destroy if pool is full
            graphics.destroy();
        }
    }
    
    /**
     * Clean up all graphics
     */
    cleanup() {
        // Clear active graphics
        this.activeGraphics.forEach(graphics => {
            graphics.destroy();
        });
        this.activeGraphics.clear();
        
        // Clear pool
        this.graphicsPool.forEach(graphics => {
            graphics.destroy();
        });
        this.graphicsPool = [];
    }
    
    /** Alias for GameScene shutdown loop compatibility */
    shutdown() { this.cleanup(); }

    /**
     * Get statistics
     */
    getStats() {
        return {
            active: this.activeGraphics.size,
            pooled: this.graphicsPool.length,
            total: this.activeGraphics.size + this.graphicsPool.length
        };
    }
    
    /**
     * Generate player texture (blue square with white cross)
     * Restored from original implementation
     */
    generatePlayerTexture() {
        if (this.scene.textures.exists('player')) return;
        
        const graphics = this.create(); // Use pool!
        const size = 24;
        
        // Blue square
        graphics.fillStyle(0x0080ff, 1);
        graphics.fillRect(0, 0, size, size);
        
        // White cross
        graphics.fillStyle(0xffffff, 1);
        const crossThickness = 4;
        const crossLength = 14;
        graphics.fillRect((size - crossLength) / 2, (size - crossThickness) / 2, crossLength, crossThickness);
        graphics.fillRect((size - crossThickness) / 2, (size - crossLength) / 2, crossThickness, crossLength);
        
        graphics.generateTexture('player', size, size);
        this.release(graphics);
        DebugLogger.info('graphics', '✅ Generated player texture (blue square with white cross)');
    }
    
    /**
     * Generate enemy texture based on blueprint
     * Restored from original implementation
     * @param {string} textureKey - Texture key to generate
     * @param {number} color - Color value (hex)
     * @param {number} size - Size in pixels
     * @param {Object} blueprint - Enemy blueprint for shape determination
     */
    generateEnemyTexture(textureKey, color, size = 20, blueprint = null) {
        if (this.scene.textures.exists(textureKey)) return;
        
        const graphics = this.create(); // Use pool!
        
        // Check entity type from textureKey
        const isUnique = textureKey.includes('unique');
        const isBoss = textureKey.includes('boss');
        const isMiniboss = textureKey.includes('miniboss');
        
        // Determine shape
        let shape = 'circle';
        if (isBoss) {
            shape = 'star';
        } else if (isUnique || isMiniboss) {
            shape = 'diamond';
        }
        
        // Determine border color and width based on type
        let strokeColor = 0x000000;
        let strokeWidth = 2;
        if (isBoss) {
            strokeColor = 0xFFD700; // Gold border for bosses
            strokeWidth = 3;
        } else if (isUnique) {
            strokeColor = 0xFF00FF; // Purple border for unique
            strokeWidth = 3;
        } else if (isMiniboss) {
            strokeColor = 0xFF8800; // Orange border for miniboss
            strokeWidth = 3;
        }
        
        // Draw shape - try to use ShapeRenderer if available in window
        const ShapeRenderer = window.ShapeRenderer || this.scene.ShapeRenderer;
        if (ShapeRenderer?.drawShape) {
            ShapeRenderer.drawShape(graphics, shape, size/2, size/2, size/2 - 2, {
                fillColor: color,
                fillAlpha: 1.0,
                strokeColor: strokeColor,
                strokeWidth: strokeWidth,
                strokeAlpha: 1.0
            });
        } else {
            // Fallback - simple filled circle
            graphics.fillStyle(color, 1);
            graphics.fillCircle(size/2, size/2, size/2);
            if (strokeWidth > 0) {
                graphics.lineStyle(strokeWidth, strokeColor, 1);
                graphics.strokeCircle(size/2, size/2, size/2);
            }
        }
        
        // Add visual indicator based on type
        if (isBoss) {
            // Boss: Large white circle in center
            graphics.fillStyle(0xFFFFFF, 1.0);
            graphics.fillCircle(size/2, size/2, size/4);
        } else if (isUnique) {
            // Unique: Small triangle pattern
            graphics.fillStyle(0xFFFFFF, 1.0);
            graphics.fillTriangle(size/2, size/2 - 4, size/2 - 4, size/2 + 4, size/2 + 4, size/2 + 4);
        } else if (isMiniboss) {
            // Miniboss: Cross pattern
            graphics.fillStyle(0xFFFFFF, 1.0);
            graphics.fillRect(size/2 - 1, size/2 - 6, 2, 12);
            graphics.fillRect(size/2 - 6, size/2 - 1, 12, 2);
        } else {
            // Regular: Simple white dot
            graphics.fillStyle(0xFFFFFF, 1.0);
            graphics.fillCircle(size/2, size/2, 2);
        }
        
        // Generate texture
        graphics.generateTexture(textureKey, size, size);
        this.release(graphics);
        
        const typeStr = isBoss ? 'boss' : isUnique ? 'unique' : isMiniboss ? 'miniboss' : 'regular';
        DebugLogger.info('graphics', `✅ Generated enemy texture: ${textureKey} (${size}px, color: 0x${color.toString(16)}, shape: ${shape}, type: ${typeStr})`);
    }
    
    /**
     * Generate all basic placeholder textures
     * Called during initialization
     */
    generatePlaceholderTextures() {
        // Player texture
        this.generatePlayerTexture();
        
        // Basic enemy placeholder for cases where blueprint has no color
        this.generateEnemyTexture('enemy_placeholder', 0x00ff00, 20);
        
        // Projectile placeholder
        if (!this.scene.textures.exists('projectile_placeholder')) {
            const graphics = this.create();
            graphics.fillStyle(0xffff00, 1);
            graphics.fillCircle(4, 4, 4);
            graphics.generateTexture('projectile_placeholder', 8, 8);
            this.release(graphics);
        }
        
        // Boss placeholder
        this.generateEnemyTexture('boss_placeholder', 0xff0000, 48);
        
        DebugLogger.info('graphics', '[GraphicsFactory] Generated placeholder textures');
    }
}

