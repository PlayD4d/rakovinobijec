import { DebugLogger } from '../../core/debug/DebugLogger.js';
import { getSession } from '../../core/debug/SessionLog.js';

/**
 * PlayerCombat - Damage, healing, death, iFrames
 * Extracted from Player.js for Thin Composer pattern (PR7)
 */
export class PlayerCombat {
    constructor(player) {
        this.player = player;
    }

    takeDamage(amount, source) {
        const player = this.player;
        const time = player.scene.time?.now || 0;

        if (!player.scene) {
            DebugLogger.error('general', `[Player] takeDamage called but player has no scene!`);
            return 0;
        }
        if (!player.active) return 0;

        // Don't take damage during pause
        if (player.scene.isPaused || player.scene.scene.isPaused()) return 0;

        if (player._iFramesMsLeft > 0) return 0;

        // Dodge check
        const dodgeChance = player._stats().dodgeChance || 0;
        if (dodgeChance > 0 && Math.random() < dodgeChance) {
            player._playVfx(player.vfx.hit, player.x, player.y);
            return 0;
        }

        // Process through shield (PowerUpSystem)
        if (player.scene.powerUpSystem?.processDamage) {
            amount = player.scene.powerUpSystem.processDamage(player, amount, time);
            if (amount <= 0) {
                player._iFramesMsLeft = 150;
                return 0;
            }
        }

        const dmg = Math.max(0, amount | 0);
        if (dmg <= 0) return 0;

        player.hp = Math.max(0, player.hp - dmg);
        getSession()?.damage(source?.blueprintId || 'enemy', 'player', dmg, 'hit');

        player._iFramesMsLeft = player._stats().iFramesMs;
        player._playVfx(player.vfx.hit, player.x, player.y);
        player._playSfx(player.sfx.hit);
        player.scene.frameworkDebug?.onPlayerHit?.(player, dmg, source);

        // Update HUD
        const hud = player.scene.scene?.get('GameUIScene')?.hud;
        if (hud?.setPlayerHealth) hud.setPlayerHealth(player.hp, player.maxHp);

        if (player.hp <= 0) {
            this.die(source);
        }
        return dmg;
    }

    canTakeDamage() {
        return this.player.active && this.player._iFramesMsLeft <= 0;
    }

    heal(amount) {
        const player = this.player;
        const a = Math.max(0, amount | 0);
        if (a <= 0) return 0;

        const before = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + a);

        if (player.hp > before) {
            player._playVfx(player.vfx.heal, player.x, player.y);
            player._playSfx(player.sfx.heal);
            player.scene.frameworkDebug?.onPlayerHeal?.(player, player.hp - before);

            const hud = player.scene.scene?.get('GameUIScene')?.hud;
            if (hud?.setPlayerHealth) hud.setPlayerHealth(player.hp, player.maxHp);
        }
        return player.hp - before;
    }

    die(source) {
        const player = this.player;
        if (!player.active) return;

        // Prevent death if player has HP
        if (player.hp > 0) return;

        // Don't die during pause
        if (player.scene.isPaused || player.scene.scene.isPaused()) {
            player.hp = 1;
            return;
        }

        player._playVfx(player.vfx.death, player.x, player.y);
        player._playSfx(player.sfx.death);
        player.scene.events.emit('player:die', { player, source });
        player.scene.frameworkDebug?.onPlayerDeath?.(player, source);

        // Analytics
        if (player.scene.analyticsManager) {
            const gameStats = player.scene.gameStats || {};
            player.scene.analyticsManager.trackPlayerDeath(source, { x: player.x, y: player.y }, gameStats, {
                playerHP: player.hp,
                playerMaxHP: player.maxHp,
                activePowerUps: player.scene.powerUpSystem?.getActivePowerUps?.() || [],
                enemiesOnScreen: player.scene.enemiesGroup?.countActive?.(true) || 0,
                projectilesOnScreen: player.scene.projectileSystem?.getActiveCount?.() || 0,
                wasBossFight: player.scene.bossActive || false
            });
        }

        // Deactivate
        player.setActive(false);
        player.setVisible(false);
        if (player.body) player.body.setEnable(false);
    }
}

export default PlayerCombat;
