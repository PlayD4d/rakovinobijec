/**
 * BossMovement - Advanced boss movement system
 *
 * Manages dash, teleport, and complex movement patterns for bosses.
 * Resolves tween violation by delegating to allowed systems.
 *
 * FIXES: Guard violation from Boss.js:861 (this.scene.tweens.add)
 */
import { DebugLogger } from '../../core/debug/DebugLogger.js';
export class BossMovement {
    constructor(bossCore) {
        this.boss = bossCore;
        this.scene = bossCore.scene;
        
        // Movement state
        this.isExecutingMovement = false;
        this.movementQueue = [];
        this.patterns = {
            circle: this.createCirclePattern.bind(this),
            zigzag: this.createZigzagPattern.bind(this),
            teleportStrike: this.createTeleportStrikePattern.bind(this)
        };
        
        DebugLogger.info('boss', '[BossMovement] Initialized');
    }
    
    /**
     * Execute dash movement - ORIGINAL TWEEN VIOLATION FIX
     *
     * Instead of direct this.scene.tweens.add calls, delegates to VFXSystem
     * or SimpleLootSystem for animation via tweens API.
     */
    executeDash(direction, distance, duration = 800) {
        if (this.isExecutingMovement) return false;
        
        const { x: startX, y: startY } = this.boss.getPos();
        
        // Calculate target position
        const targetX = startX + direction.x * distance;
        const targetY = startY + direction.y * distance;
        
        // Clamp to game world bounds (not viewport)
        const wb = this.scene.physics?.world?.bounds;
        const bw = wb?.width || this.scene.cameras.main.width;
        const bh = wb?.height || this.scene.cameras.main.height;
        const clampedX = Math.max(50, Math.min(targetX, bw - 50));
        const clampedY = Math.max(50, Math.min(targetY, bh - 50));
        
        DebugLogger.info('boss', `[BossMovement] Executing dash: (${startX}, ${startY}) -> (${clampedX}, ${clampedY}`);
        
        // TWEEN VIOLATION FIX - delegate to BossCore capability
        this.boss.dashTo(clampedX, clampedY, duration, () => {
            this.isExecutingMovement = false;
            DebugLogger.info('boss', '[BossMovement] Dash completed');
        });
        
        this.isExecutingMovement = true;
        return true;
    }
    
    /**
     * Teleport strike - combines teleport with an attack
     */
    executeTeleportStrike(target, damage = 30) {
        if (this.isExecutingMovement) return false;

        const { x: playerX, y: playerY } = target.getPos ? target.getPos() : target;

        // Position behind player
        const angle = Math.atan2(this.boss.y - playerY, this.boss.x - playerX);
        const strikeX = playerX + Math.cos(angle) * 80;
        const strikeY = playerY + Math.sin(angle) * 80;

        this.isExecutingMovement = true;
        const schedule = this.boss.abilitiesSystem?._schedule?.bind(this.boss.abilitiesSystem);
        const delay = schedule || ((ms, cb) => this.scene?.time?.delayedCall(ms, cb));

        // Phase 0: Telegraph at destination (200ms warning)
        if (this.scene?.vfxSystem?.playTelegraph) {
            this.scene.vfxSystem.playTelegraph(strikeX, strikeY, {
                radius: 40, color: 0x8844FF, duration: 400, pulses: 2
            });
        }

        // Phase 1: Teleport after brief telegraph (200ms)
        delay(200, () => {
            if (!this.boss?.active || !this.scene) return;
            this.boss.teleportTo(strikeX, strikeY);

            // Phase 2: Strike after arrival (200ms)
            delay(200, () => {
                if (!this.boss?.active || !this.scene) return;
                this.boss.shoot('boss_strike', {
                    damage,
                    direction: { x: playerX - strikeX, y: playerY - strikeY }
                });
                this.isExecutingMovement = false;
            });
        });
        
        return true;
    }
    
    /**
     * Circular movement pattern
     */
    executeCirclePattern(centerX, centerY, radius, duration = 3000) {
        if (this.isExecutingMovement) return false;
        
        const points = this.createCirclePattern(centerX, centerY, radius, 8);
        this.executeMovementPattern(points, duration);
        return true;
    }
    
    /**
     * Zigzag movement pattern
     */
    executeZigzagPattern(startX, startY, endX, endY, segments = 4) {
        if (this.isExecutingMovement) return false;
        
        const points = this.createZigzagPattern(startX, startY, endX, endY, segments);
        this.executeMovementPattern(points, 2000);
        return true;
    }
    
    /**
     * Execute a sequence of movements following a pattern
     */
    executeMovementPattern(points, totalDuration) {
        if (points.length === 0) return;
        
        this.isExecutingMovement = true;
        const segmentDuration = totalDuration / points.length;
        let currentIndex = 0;
        
        const moveToNext = () => {
            if (currentIndex >= points.length) {
                this.isExecutingMovement = false;
                return;
            }
            
            const point = points[currentIndex];
            currentIndex++;
            
            // Delegate to BossCore capability instead of direct tweens
            this.boss.dashTo(point.x, point.y, segmentDuration, moveToNext);
        };
        
        moveToNext();
    }
    
    /**
     * Create a circular pattern of points
     */
    createCirclePattern(centerX, centerY, radius, pointCount) {
        const points = [];
        for (let i = 0; i < pointCount; i++) {
            const angle = (i / pointCount) * Math.PI * 2;
            points.push({
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius
            });
        }
        return points;
    }
    
    /**
     * Create a zigzag pattern of points
     */
    createZigzagPattern(startX, startY, endX, endY, segments) {
        const points = [];
        const deltaX = (endX - startX) / segments;
        const deltaY = (endY - startY) / segments;
        const amplitude = 100; // Zigzag amplitude
        
        for (let i = 1; i <= segments; i++) {
            const baseX = startX + deltaX * i;
            const baseY = startY + deltaY * i;
            
            // Alternating offset for zigzag
            const offset = (i % 2 === 0 ? amplitude : -amplitude);
            const perpAngle = Math.atan2(deltaY, deltaX) + Math.PI / 2;
            
            points.push({
                x: baseX + Math.cos(perpAngle) * offset,
                y: baseY + Math.sin(perpAngle) * offset
            });
        }
        
        return points;
    }
    
    /**
     * Teleport strike pattern - complete ability
     */
    createTeleportStrikePattern(target, strikeCount = 3) {
        const pattern = [];
        const { x: targetX, y: targetY } = target.getPos ? target.getPos() : target;
        
        for (let i = 0; i < strikeCount; i++) {
            const angle = (i / strikeCount) * Math.PI * 2;
            const distance = 120;
            
            pattern.push({
                x: targetX + Math.cos(angle) * distance,
                y: targetY + Math.sin(angle) * distance,
                action: 'teleport_strike'
            });
        }
        
        return pattern;
    }
    
    /**
     * Stop current movement
     */
    stopCurrentMovement() {
        this.isExecutingMovement = false;
        this.movementQueue = [];
        
        // Reset boss movement state
        if (this.boss.isDashing) {
            this.boss.isDashing = false;
            this.boss.moveSpeed = this.boss.originalSpeed;
        }
    }
    
    /**
     * Cleanup on boss removal
     */
    cleanup() {
        this.stopCurrentMovement();
        this.patterns = {};
        this.boss = null;
        this.scene = null;

        DebugLogger.info('boss', '[BossMovement] Cleanup completed');
    }
}