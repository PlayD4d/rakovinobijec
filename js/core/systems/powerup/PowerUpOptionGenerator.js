/**
 * PowerUpOptionGenerator - Generates power-up options for level-up selection
 * Extracted from PowerUpSystem for <500 LOC compliance
 *
 * Handles: weighted selection logic, blueprint name/description resolution, stats formatting
 */

import { DebugLogger } from '../../debug/DebugLogger.js';

export class PowerUpOptionGenerator {
    constructor(scene, powerUpSystem) {
        this.scene = scene;
        this.powerUpSystem = powerUpSystem;
    }

    /**
     * Generate power-up options for level-up selection
     * @returns {Array} Selected power-up options
     */
    generatePowerUpOptions() {
        const allPowerUps = this.scene.blueprintLoader.getAll('powerup') || [];
        const options = [];

        DebugLogger.info('powerup', `[PowerUpOptionGenerator] Found ${allPowerUps.length} total powerup blueprints`);

        for (const blueprint of allPowerUps) {
            if (!blueprint?.id) {
                DebugLogger.warn('powerup', '[PowerUpOptionGenerator] Skipping blueprint without ID:', blueprint);
                continue;
            }

            // Skip templates and backup files
            if (blueprint.id.includes('template') || blueprint.id.includes('.bak')) {
                DebugLogger.debug('powerup', `[PowerUpOptionGenerator] Skipping template/backup: ${blueprint.id}`);
                continue;
            }

            const current = this.powerUpSystem.appliedPowerUps.get(blueprint.id);
            const currentLevel = current?.level || 0;
            const maxLevel = blueprint.stats?.maxLevel || 10;

            if (currentLevel >= maxLevel) {
                DebugLogger.debug('powerup', `[PowerUpOptionGenerator] Skipping maxed powerup: ${blueprint.id} (${currentLevel}/${maxLevel})`);
                continue;
            }

            const nextLevel = currentLevel + 1;
            const nextValue = this._calculateValueForLevel(blueprint, nextLevel);

            DebugLogger.debug('powerup', `[PowerUpOptionGenerator] Adding option: ${blueprint.id} (level ${currentLevel} -> ${nextLevel})`);

            options.push({
                id: blueprint.id,
                name: this._getBlueprintName(blueprint),
                description: this._getBlueprintDescription(blueprint),
                type: blueprint.category || 'passive',
                level: currentLevel,
                nextLevel: nextLevel,
                maxLevel: maxLevel,
                value: nextValue,
                icon: blueprint.display?.icon,
                color: blueprint.display?.color,
                stats: this._formatPowerUpStats(blueprint, nextLevel),
                rarity: blueprint.display?.rarity || 'common'
            });
        }

        DebugLogger.info('powerup', `[PowerUpOptionGenerator] Generated ${options.length} valid powerup options`);

        return this._selectWeighted(options);
    }

    // === PRIVATE METHODS ===

    _selectWeighted(options) {
        // Flattened weights — all powerups have roughly equal chance to appear
        // Rarity affects power, not visibility. Player should see the full arsenal.
        const rarityWeights = {
            'common': 2,
            'rare': 2,
            'epic': 1.5,
            'legendary': 1
        };

        const pool = options.map(option => ({
            option,
            weight: rarityWeights[option.rarity] || 1
        }));

        const selected = [];

        while (selected.length < 3 && pool.length > 0) {
            let totalWeight = 0;
            for (let i = 0; i < pool.length; i++) {
                totalWeight += pool[i].weight;
            }

            const r = Math.random() * totalWeight;

            let cumulative = 0;
            let winnerIndex = pool.length - 1;
            for (let i = 0; i < pool.length; i++) {
                cumulative += pool[i].weight;
                if (r < cumulative) {
                    winnerIndex = i;
                    break;
                }
            }

            selected.push(pool[winnerIndex].option);
            pool.splice(winnerIndex, 1);
        }

        DebugLogger.info('powerup', `[PowerUpOptionGenerator] Selected ${selected.length} powerups for display:`, selected.map(p => `${p.id} (L${p.nextLevel})`));

        return selected;
    }

    _getBlueprintName(blueprint) {
        if (this.scene.displayResolver) {
            const name = this.scene.displayResolver.getName(blueprint);
            if (name && name !== blueprint.id) return name;
        }
        return blueprint.display?.devNameFallback || blueprint.id.replace('powerup.', '').replace(/_/g, ' ');
    }

    _getBlueprintDescription(blueprint) {
        if (this.scene.displayResolver) {
            const desc = this.scene.displayResolver.getDescription(blueprint);
            if (desc) return desc;
        }
        return blueprint.display?.devDescFallback || '';
    }

    _extractValueFromBlueprint(blueprint) {
        const mods = blueprint.mechanics?.modifiersPerLevel;
        if (mods && mods.length > 0) {
            const firstMod = mods[0];
            if (firstMod.value !== undefined) {
                return firstMod.value;
            }
        }

        if (blueprint.ability) {
            const ability = blueprint.ability;
            if (ability.damagePerLevel) return ability.damagePerLevel[0];
            if (ability.rangePerLevel) return ability.rangePerLevel[0];
            if (ability.baseDamage) return ability.baseDamage;
        }

        return 0;
    }

    _calculateValueForLevel(blueprint, level) {
        const mods = blueprint.mechanics?.modifiersPerLevel;
        if (mods && mods.length > 0) {
            const firstMod = mods[0];
            if (firstMod.type === 'base') {
                return firstMod.value * level;
            } else if (firstMod.type === 'set') {
                return firstMod.value;
            } else {
                return firstMod.value * level;
            }
        }

        if (blueprint.ability) {
            const ability = blueprint.ability;
            if (ability.baseShieldHP) return ability.baseShieldHP * level;
            if (ability.damagePerLevel) return ability.damagePerLevel[level - 1] || ability.damagePerLevel[0];
            if (ability.rangePerLevel) return ability.rangePerLevel[level - 1] || ability.rangePerLevel[0];
            if (ability.baseDamage) return ability.baseDamage + (level - 1) * 5;
        }

        return 0;
    }

    _formatPowerUpStats(blueprint, level = 1) {
        const parts = [];
        const mods = blueprint.mechanics?.modifiersPerLevel || [];

        const statLabels = {
            projectileDamage: (v) => `+${v} DMG`,
            moveSpeed: (v) => `+${Math.round(v * 100)}% rychlost`,
            attackIntervalMs: (v) => `-${Math.abs(Math.round(v * 100))}% interval útoku`,
            dodgeChance: (v) => `+${Math.round(v * 100)}% úhyb`,
            shieldHP: (v) => `${v} HP štít`,
            xpMagnetRadius: (v) => `+${v}px dosah magnetu`,
            explosionRadius: (v) => `+${v}px radius exploze`,
            explosionDamage: (v) => `+${v} DMG exploze`,
            projectilePiercing: (v) => `průstřel ${v}`,
            projectileCount: (v) => `+${v} projektil${v > 1 ? 'y' : ''}`,
        };

        for (const mod of mods) {
            const value = (mod.type === 'base' || mod.type === 'set')
                ? mod.value
                : mod.value * level;
            const formatter = statLabels[mod.path];
            if (formatter) {
                parts.push(formatter(value));
            }
        }

        // Ability-based descriptions
        const ability = blueprint.ability;
        if (ability?.type === 'shield') {
            parts.push(`${(ability.baseShieldHP || 50) * level} HP štít`);
        } else if (ability?.type === 'radiotherapy') {
            const beams = ability.beamsPerLevel?.[level - 1] || 1;
            const dmg = ability.damagePerLevel?.[level - 1] || 5;
            parts.push(`${beams} paprsek${beams > 1 ? 'y' : ''} • ${dmg} DMG`);
        } else if (ability?.type === 'flamethrower') {
            const range = ability.rangePerLevel?.[level - 1] || 80;
            const dmg = ability.damagePerLevel?.[level - 1] || 3;
            parts.push(`dosah ${range}px • ${dmg} DMG`);
        } else if (ability?.type === 'chemo_aura') {
            parts.push(`${ability.chemoCloudDamage || 4} DMG/s oblak`);
        } else if (ability?.type === 'chain_lightning') {
            const dmg = (ability.baseDamage || 15) + (ability.damagePerLevel || 10) * (level - 1);
            parts.push(`${dmg} DMG • ${level} přeskok${level > 1 ? 'y' : ''}`);
        } else if (ability?.type === 'piercing') {
            const pierces = ability.maxPierces?.[level - 1] || level;
            parts.push(`průstřel ${pierces} nepřátel`);
        }

        return parts.length > 0 ? parts.join(' • ') : `Level ${level}`;
    }
}

