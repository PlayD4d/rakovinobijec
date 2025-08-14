/**
 * AnalyticsSystem - Centralizace analytics přes EventBus
 * 
 * Odchytává gameplay události z EventBus a přeposílá je do AnalyticsManager.
 * Odstraňuje tight coupling mezi herní logikou a analytics.
 */

export class AnalyticsSystem {
    constructor(scene, analyticsManager) {
        this.scene = scene;
        this.analyticsManager = analyticsManager;
        this.eventBus = scene.eventBus;
        
        // Silent initialization - don't warn if components missing
        this.enabled = !!(this.eventBus && this.analyticsManager);
        
        if (this.enabled) {
            this._setupEventListeners();
            console.log('[AnalyticsSystem] Initialized - listening for events');
        } else {
            // Silent mode - analytics will be skipped but no warnings
            console.debug('[AnalyticsSystem] Running in silent mode (analytics disabled)');
        }
    }
    
    _setupEventListeners() {
        // Player události
        this.eventBus.on('player.spawn', (data) => this._handlePlayerSpawn(data));
        this.eventBus.on('player.hit', (data) => this._handlePlayerHit(data)); 
        this.eventBus.on('player.death', (data) => this._handlePlayerDeath(data));
        
        // Enemy události
        this.eventBus.on('npc.spawn', (data) => this._handleEnemySpawn(data));
        this.eventBus.on('npc.hit', (data) => this._handleEnemyHit(data));
        this.eventBus.on('npc.death', (data) => this._handleEnemyDeath(data));
        
        // Weapon/projectile události
        this.eventBus.on('weapon.fire', (data) => this._handleWeaponFire(data));
        this.eventBus.on('projectile.impact', (data) => this._handleProjectileImpact(data));
        
        // Power-up události
        this.eventBus.on('powerup.pickup', (data) => this._handlePowerUpPickup(data));
        this.eventBus.on('powerup.select', (data) => this._handlePowerUpSelect(data));
        
        // Boss události
        this.eventBus.on('boss.spawn', (data) => this._handleBossSpawn(data));
        this.eventBus.on('boss.phase', (data) => this._handleBossPhase(data));
        this.eventBus.on('boss.action', (data) => this._handleBossAction(data));
        this.eventBus.on('boss.defeat', (data) => this._handleBossDefeat(data));
        
        // Drop události
        this.eventBus.on('drop.pickup', (data) => this._handleDropPickup(data));
        this.eventBus.on('drop.metotrexat.pickup', (data) => this._handleSpecialDropPickup(data));
        
        // Game události
        this.eventBus.on('game.levelup', (data) => this._handleLevelUp(data));
        this.eventBus.on('game.over', (data) => this._handleGameOver(data));
    }
    
    // Event handlers - mapují EventBus eventy na AnalyticsManager metody
    
    _handlePlayerSpawn(data) {
        // Player spawn se obvykle netrackuje, ale můžeme logovat pro debug
        console.log('[Analytics] Player spawned');
    }
    
    _handlePlayerHit(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackDamageTaken && data.damage) {
            this.analyticsManager.trackDamageTaken(
                data.damage, 
                data.source || 'unknown', 
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handlePlayerDeath(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackPlayerDeath) {
            this.analyticsManager.trackPlayerDeath(
                data.cause || 'unknown',
                this.scene.gameStats?.level || 1,
                this.scene.gameStats?.time || 0
            );
        }
    }
    
    _handleEnemySpawn(data) {
        if (!this.enabled) return;
        // Enemy spawn tracking - pokud je potřeba
        if (this.analyticsManager.trackEnemySpawn && data.enemyType) {
            this.analyticsManager.trackEnemySpawn(data.enemyType);
        }
    }
    
    _handleEnemyHit(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackDamageDealt && data.damage && data.enemyType) {
            this.analyticsManager.trackDamageDealt(data.damage, data.enemyType);
        }
    }
    
    _handleEnemyDeath(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackEnemyDeath && data.enemyType) {
            this.analyticsManager.trackEnemyDeath(
                data.enemyType,
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handleWeaponFire(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackWeaponFire) {
            this.analyticsManager.trackWeaponFire(
                data.weaponType || 'basic',
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handleProjectileImpact(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackProjectileHit) {
            this.analyticsManager.trackProjectileHit(
                data.projectileType || 'basic',
                data.damage || 0
            );
        }
    }
    
    _handlePowerUpPickup(data) {
        // Už se trackuje jinde - možná duplikát
    }
    
    _handlePowerUpSelect(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackPowerUpSelection && data.powerUpName) {
            this.analyticsManager.trackPowerUpSelection(
                data.powerUpName,
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handleBossSpawn(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackBossEncounter && data.bossName) {
            this.analyticsManager.trackBossEncounter(
                data.bossName,
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handleBossPhase(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.setBossPhase && data.phase) {
            this.analyticsManager.setBossPhase(data.phase);
        }
    }
    
    _handleBossAction(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackBossAction && data.action) {
            this.analyticsManager.trackBossAction(data.action);
        }
    }
    
    _handleBossDefeat(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackBossDefeat && data.bossName) {
            this.analyticsManager.trackBossDefeat(
                data.bossName,
                data.timeToKill || 0,
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handleDropPickup(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackItemPickup) {
            this.analyticsManager.trackItemPickup(
                data.itemType || 'xp',
                data.value || 1
            );
        }
    }
    
    _handleSpecialDropPickup(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackSpecialDrop) {
            this.analyticsManager.trackSpecialDrop(
                'metotrexat',
                this.scene.gameStats?.level || 1
            );
        }
    }
    
    _handleLevelUp(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackLevelUp) {
            this.analyticsManager.trackLevelUp(
                data.newLevel || this.scene.gameStats?.level,
                data.timeToLevel || 0
            );
        }
    }
    
    _handleGameOver(data) {
        if (!this.enabled) return;
        if (this.analyticsManager.trackGameOver) {
            this.analyticsManager.trackGameOver(
                this.scene.gameStats?.level || 1,
                this.scene.gameStats?.time || 0,
                data.cause || 'unknown'
            );
        }
    }
    
    // Cleanup
    destroy() {
        if (this.eventBus) {
            // Remove všechny event listenery
            const events = [
                'player.spawn', 'player.hit', 'player.death',
                'npc.spawn', 'npc.hit', 'npc.death',
                'weapon.fire', 'projectile.impact',
                'powerup.pickup', 'powerup.select',
                'boss.spawn', 'boss.phase', 'boss.action', 'boss.defeat',
                'drop.pickup', 'drop.metotrexat.pickup',
                'game.levelup', 'game.over'
            ];
            
            events.forEach(event => {
                this.eventBus.off(event);
            });
        }
        
        console.log('[AnalyticsSystem] Destroyed');
    }
}