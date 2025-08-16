/**
 * GraphicsFactory - PR7 compliant graphics creation
 * Centralizes all graphics object creation to avoid direct Phaser API calls
 */

export class GraphicsFactory {
    constructor(scene) {
        this.scene = scene;
        this.graphicsPool = [];
        this.activeGraphics = new Set();
        this.maxPoolSize = 50;
        
        console.log('[GraphicsFactory] Initialized with pool size:', this.maxPoolSize);
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
}

export default GraphicsFactory;