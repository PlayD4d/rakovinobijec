/**
 * BossMovement - Systém pro pokročilé boss pohyby
 * 
 * Spravuje dash, teleport a komplexní pohybové vzory pro bosse.
 * Vyřešuje tween violation delegací na povolené systémy.
 * 
 * ŘEŠÍ: Guard violation z Boss.js:861 (this.scene.tweens.add)
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
     * Spustí dash movement - PŮVODNÍ TWEEN VIOLATION ŘEŠENÍ
     * 
     * Místo přímého this.scene.tweens.add volání deleguje na VFXSystem
     * nebo SimpleLootSystem pro animaci s tweens API.
     */
    executeDash(direction, distance, duration = 800) {
        if (this.isExecutingMovement) return false;
        
        const { x: startX, y: startY } = this.boss.getPos();
        
        // Vypočítej cílovou pozici
        const targetX = startX + direction.x * distance;
        const targetY = startY + direction.y * distance;
        
        // Clamp k hranicím scény
        const bounds = this.scene.getMainCamera?.() || this.scene.cameras.main;
        const clampedX = Math.max(50, Math.min(targetX, bounds.width - 50));
        const clampedY = Math.max(50, Math.min(targetY, bounds.height - 50));
        
        DebugLogger.info('boss', `[BossMovement] Executing dash: (${startX}, ${startY}) -> (${clampedX}, ${clampedY}`);
        
        // ŘEŠENÍ TWEEN VIOLATION - delegace na BossCore capability
        this.boss.dashTo(clampedX, clampedY, duration, () => {
            this.isExecutingMovement = false;
            DebugLogger.info('boss', '[BossMovement] Dash completed');
        });
        
        this.isExecutingMovement = true;
        return true;
    }
    
    /**
     * Teleport strike - kombinuje teleport s útokem
     */
    executeTeleportStrike(target, damage = 30) {
        if (this.isExecutingMovement) return false;
        
        const { x: playerX, y: playerY } = target.getPos ? target.getPos() : target;
        
        // Vypočítej pozici za hráčem
        const angle = Math.atan2(this.boss.y - playerY, this.boss.x - playerX);
        const strikeX = playerX + Math.cos(angle) * 80;
        const strikeY = playerY + Math.sin(angle) * 80;
        
        this.isExecutingMovement = true;
        
        // Phase 1: Teleport za hráče
        this.boss.teleportTo(strikeX, strikeY);
        
        // Phase 2: Útok s krátkým delay — use tracked timer via BossAbilities
        const schedule = this.boss.abilitiesSystem?._schedule?.bind(this.boss.abilitiesSystem);
        const delayFn = schedule || ((ms, cb) => this.scene?.time?.delayedCall(ms, cb));
        delayFn(200, () => {
            if (!this.boss?.active || !this.scene) return;
            this.boss.shoot('boss_strike', {
                damage,
                direction: { x: playerX - strikeX, y: playerY - strikeY }
            });
            this.isExecutingMovement = false;
        });
        
        return true;
    }
    
    /**
     * Kruhovitý pohybový vzor
     */
    executeCirclePattern(centerX, centerY, radius, duration = 3000) {
        if (this.isExecutingMovement) return false;
        
        const points = this.createCirclePattern(centerX, centerY, radius, 8);
        this.executeMovementPattern(points, duration);
        return true;
    }
    
    /**
     * Zigzag pohybový vzor
     */
    executeZigzagPattern(startX, startY, endX, endY, segments = 4) {
        if (this.isExecutingMovement) return false;
        
        const points = this.createZigzagPattern(startX, startY, endX, endY, segments);
        this.executeMovementPattern(points, 2000);
        return true;
    }
    
    /**
     * Spustí sekvenci pohybů podle vzoru
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
            
            // Delegace na BossCore capability místo přímého tweens
            this.boss.dashTo(point.x, point.y, segmentDuration, moveToNext);
        };
        
        moveToNext();
    }
    
    /**
     * Vytvoří kruhovitý vzor bodů
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
     * Vytvoří zigzag vzor bodů
     */
    createZigzagPattern(startX, startY, endX, endY, segments) {
        const points = [];
        const deltaX = (endX - startX) / segments;
        const deltaY = (endY - startY) / segments;
        const amplitude = 100; // Amplituda zigzagu
        
        for (let i = 1; i <= segments; i++) {
            const baseX = startX + deltaX * i;
            const baseY = startY + deltaY * i;
            
            // Alternující offset pro zigzag
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
     * Teleport strike pattern - kompletní schopnost
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
     * Zastaví aktuální pohyb
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
     * Cleanup při odstranění bosse
     */
    cleanup() {
        this.stopCurrentMovement();
        this.patterns = {};
        this.boss = null;
        this.scene = null;
        
        DebugLogger.info('boss', '[BossMovement] Cleanup completed');
    }
}