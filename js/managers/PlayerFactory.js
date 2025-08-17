/**
 * PlayerFactory - Simplified player blueprint management
 * PR7 compliant - centralized player creation
 */

export class PlayerFactory {
    constructor(scene) {
        this.scene = scene;
        this.blueprintLoader = scene.blueprintLoader;
    }
    
    /**
     * Get player blueprint from loader or use fallback
     */
    getPlayerBlueprint() {
        // PR7: Load player blueprint from BlueprintLoader
        if (this.blueprintLoader) {
            const playerBlueprint = this.blueprintLoader.get('player');
            if (playerBlueprint) {
                console.log('[PlayerFactory] Loaded player blueprint');
                
                // Ensure display section exists
                const textureKey = playerBlueprint.visuals?.textureKey || 'player';
                if (!playerBlueprint.display) {
                    playerBlueprint.display = {
                        texture: textureKey,
                        frame: 0,
                        tint: playerBlueprint.visuals?.tint || 0x4169E1
                    };
                }
                
                return playerBlueprint;
            }
        }
        
        // Emergency fallback - should not happen in production
        console.error('[PlayerFactory] CRITICAL: Player blueprint not found!');
        return this.createFallbackBlueprint();
    }
    
    /**
     * Create emergency fallback blueprint
     */
    createFallbackBlueprint() {
        const CR = window.ConfigResolver;
        return {
            id: 'player_emergency',
            type: 'player',
            display: {
                texture: 'player',
                frame: 0,
                tint: 0x4169E1
            },
            stats: {
                hp: CR?.get('player.stats.hp', { defaultValue: 100 }) || 100,
                speed: CR?.get('player.stats.speed', { defaultValue: 135 }) || 135,
                size: 24
            },
            mechanics: {
                attack: { intervalMs: 1000 },
                projectile: {
                    ref: 'projectile.player_basic',
                    count: 1,
                    spreadDeg: 15,
                    stats: {
                        damage: CR?.get('player.attack.damage', { defaultValue: 10 }) || 10,
                        speed: 300,
                        range: 600
                    }
                },
                crit: { chance: 0.05, multiplier: 2 },
                iFrames: { ms: 1000 }
            },
            vfx: {
                spawn: 'vfx.player.spawn',
                hit: 'vfx.player.hit',
                death: 'vfx.player.death',
                shoot: 'vfx.weapon.muzzle',
                heal: 'vfx.player.heal'
            },
            sfx: {
                spawn: 'sfx.player.spawn',
                hit: 'sfx.player.hit',
                death: 'sfx.player.death',
                shoot: 'sfx.player.shoot',
                heal: 'sfx.player.heal'
            }
        };
    }
}

export default PlayerFactory;