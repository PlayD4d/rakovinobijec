/**
 * ShapeRenderer - Utility class for rendering geometric shapes
 * PR7 compliant - centralized shape rendering for placeholder textures
 */

export class ShapeRenderer {
    /**
     * Draw a shape on a graphics object
     * @param {Phaser.GameObjects.Graphics} graphics - The graphics object to draw on
     * @param {string} shape - Shape type: 'circle', 'hexagon', 'square', 'triangle', 'star', 'diamond'
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     * @param {number} size - Size/radius of the shape
     * @param {Object} options - Additional options
     * @param {number} options.fillColor - Fill color (default: 0xFFFFFF)
     * @param {number} options.fillAlpha - Fill alpha (default: 1.0)
     * @param {number} options.strokeColor - Stroke color (optional)
     * @param {number} options.strokeWidth - Stroke width (optional)
     * @param {number} options.strokeAlpha - Stroke alpha (default: 1.0)
     */
    static drawShape(graphics, shape, x, y, size, options = {}) {
        const {
            fillColor = 0xFFFFFF,
            fillAlpha = 1.0,
            strokeColor = null,
            strokeWidth = 2,
            strokeAlpha = 1.0
        } = options;

        // Set fill style
        graphics.fillStyle(fillColor, fillAlpha);
        
        // Set stroke style if provided
        if (strokeColor !== null) {
            graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
        }

        // Draw the shape based on type
        switch (shape) {
            case 'circle':
                this.drawCircle(graphics, x, y, size);
                break;
            case 'hexagon':
                this.drawHexagon(graphics, x, y, size);
                break;
            case 'square':
                this.drawSquare(graphics, x, y, size);
                break;
            case 'triangle':
                this.drawTriangle(graphics, x, y, size);
                break;
            case 'star':
                this.drawStar(graphics, x, y, size);
                break;
            case 'diamond':
                this.drawDiamond(graphics, x, y, size);
                break;
            default:
                // Fallback to circle
                console.warn(`[ShapeRenderer] Unknown shape: ${shape}, falling back to circle`);
                this.drawCircle(graphics, x, y, size);
        }
    }

    /**
     * Draw a circle
     */
    static drawCircle(graphics, x, y, radius) {
        graphics.fillCircle(x, y, radius);
        if (graphics._lineWidth > 0) {
            graphics.strokeCircle(x, y, radius);
        }
    }

    /**
     * Draw a hexagon (6-sided polygon)
     */
    static drawHexagon(graphics, x, y, size) {
        graphics.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const px = x + Math.cos(angle) * size;
            const py = y + Math.sin(angle) * size;
            if (i === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.closePath();
        graphics.fill();
        if (graphics._lineWidth > 0) {
            graphics.strokePath();
        }
    }

    /**
     * Draw a square
     */
    static drawSquare(graphics, x, y, size) {
        const halfSize = size;
        graphics.fillRect(x - halfSize, y - halfSize, halfSize * 2, halfSize * 2);
        if (graphics._lineWidth > 0) {
            graphics.strokeRect(x - halfSize, y - halfSize, halfSize * 2, halfSize * 2);
        }
    }

    /**
     * Draw a triangle (equilateral)
     */
    static drawTriangle(graphics, x, y, size) {
        const height = size * Math.sqrt(3) / 2;
        graphics.beginPath();
        graphics.moveTo(x, y - size);  // Top point
        graphics.lineTo(x - height, y + size/2);  // Bottom left
        graphics.lineTo(x + height, y + size/2);  // Bottom right
        graphics.closePath();
        graphics.fill();
        if (graphics._lineWidth > 0) {
            graphics.strokePath();
        }
    }

    /**
     * Draw a 5-pointed star
     */
    static drawStar(graphics, x, y, size) {
        const outerRadius = size;
        const innerRadius = size * 0.4;
        const points = 5;
        
        graphics.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const angle = (Math.PI * i) / points - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            
            if (i === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.closePath();
        graphics.fill();
        if (graphics._lineWidth > 0) {
            graphics.strokePath();
        }
    }

    /**
     * Draw a diamond (rotated square)
     */
    static drawDiamond(graphics, x, y, size) {
        graphics.beginPath();
        graphics.moveTo(x, y - size);  // Top
        graphics.lineTo(x + size, y);  // Right
        graphics.lineTo(x, y + size);  // Bottom
        graphics.lineTo(x - size, y);  // Left
        graphics.closePath();
        graphics.fill();
        if (graphics._lineWidth > 0) {
            graphics.strokePath();
        }
    }

    /**
     * Get shape from blueprint with fallback
     * @param {Object} blueprint - The blueprint object
     * @param {string} defaultShape - Default shape if not specified
     * @returns {string} The shape to use
     */
    static getShapeFromBlueprint(blueprint, defaultShape = 'circle') {
        // Check multiple possible locations
        const shape = blueprint?.graphics?.shape || 
                      blueprint?.visuals?.shape || 
                      blueprint?.display?.shape ||
                      defaultShape;
        
        // Validate shape
        const validShapes = ['circle', 'hexagon', 'square', 'triangle', 'star', 'diamond'];
        if (!validShapes.includes(shape)) {
            console.warn(`[ShapeRenderer] Invalid shape '${shape}' in blueprint, using default '${defaultShape}'`);
            return defaultShape;
        }
        
        return shape;
    }

    /**
     * Helper to determine default shape based on entity type
     * @param {string} entityType - Type of entity (enemy, drop, boss, etc.)
     * @returns {string} Default shape for this entity type
     */
    static getDefaultShapeForType(entityType) {
        const typeDefaults = {
            'enemy': 'circle',
            'boss': 'star',
            'miniboss': 'diamond',
            'unique': 'diamond',
            'drop': 'hexagon',
            'xp': 'hexagon',
            'health': 'square',
            'powerup': 'triangle',
            'projectile': 'circle'
        };
        
        return typeDefaults[entityType] || 'circle';
    }
}

