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
        const applied = this.powerUpSystem.appliedPowerUps;

        // Dual-slot limits
        const weaponsFull = this.powerUpSystem.isSlotFull('weapon');
        const passivesFull = this.powerUpSystem.isSlotFull('passive');
        const wCount = this.powerUpSystem.getWeaponCount();
        const pCount = this.powerUpSystem.getPassiveCount();

        DebugLogger.info('powerup', `[PowerUpOptionGenerator] ${allPowerUps.length} powerups, weapons ${wCount}/${this.powerUpSystem.maxWeaponSlots}, passives ${pCount}/${this.powerUpSystem.maxPassiveSlots}`);

        for (const blueprint of allPowerUps) {
            if (!blueprint?.id) continue;
            if (blueprint.id.includes('template') || blueprint.id.includes('.bak')) continue;

            const current = applied.get(blueprint.id);
            const currentLevel = current?.level || 0;
            const maxLevel = blueprint.stats?.maxLevel || 10;

            // Skip maxed
            if (currentLevel >= maxLevel) continue;

            // Slot-aware: check if THIS item's slot type is full (only blocks new items, not upgrades)
            const slot = blueprint.mechanics?.slot || 'weapon';
            const slotFull = slot === 'passive' ? passivesFull : weaponsFull;
            if (slotFull && currentLevel === 0) continue;

            const nextLevel = currentLevel + 1;

            options.push({
                id: blueprint.id,
                name: this._getBlueprintName(blueprint),
                description: this._getBlueprintDescription(blueprint),
                slot: slot,
                level: currentLevel,
                nextLevel: nextLevel,
                maxLevel: maxLevel,
                value: this._calculateValueForLevel(blueprint, nextLevel),
                icon: blueprint.display?.icon,
                color: blueprint.display?.color,
                stats: this._formatPowerUpStats(blueprint, nextLevel),
                rarity: blueprint.display?.rarity || 'common',
                isNew: currentLevel === 0,
            });
        }

        DebugLogger.info('powerup', `[PowerUpOptionGenerator] ${options.length} options (W:${wCount} P:${pCount}${weaponsFull ? ' W-FULL' : ''}${passivesFull ? ' P-FULL' : ''})`);

        return this._selectWeighted(options);
    }

    // === PRIVATE METHODS ===

    _selectWeighted(options) {
        // VS-style: all powerups have EQUAL chance to appear.
        // Rarity affects power/scaling, NOT visibility in level-up selection.
        // With 6-slot limit, player MUST see all options equally to make informed build choices.
        const pool = options.map(option => ({
            option,
            weight: 1 // Equal weight for all
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
            attackIntervalMs: (v) => `-${Math.abs(Math.round(v * 100))}% cooldown`,
            dodgeChance: (v) => `+${Math.round(v * 100)}% uhyb`,
            shieldHP: (v) => `${v} HP stit`,
            xpMagnetRadius: (v) => `+${v}px dosah magnetu`,
            explosionRadius: (v) => `+${v}px radius exploze`,
            explosionDamage: (v) => `+${v} DMG exploze`,
            projectilePiercing: (v) => `prustrel ${v}`,
            projectileCount: (v) => `+${v} projektil${v > 1 ? 'y' : ''}`,
            areaMultiplier: (v) => `+${Math.round(v * 100)}% oblast`,
            durationMultiplier: (v) => `+${Math.round(v * 100)}% trvani`,
            hp: (v) => `+${Math.round(v * 100)}% max HP`,
            critChance: (v) => `+${Math.round(v * 100)}% krit`,
            projectileSpeed: (v) => `+${Math.round(v * 100)}% rychlost strel`,
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
        const a = blueprint.ability;
        if (a) {
            switch (a.type) {
                case 'shield':
                    parts.push(`${(a.baseShieldHP || 50) * level} HP štít`);
                    break;
                case 'radiotherapy': {
                    const beams = a.beamsPerLevel?.[level - 1] || 1;
                    parts.push(`${beams} paprsek${beams > 1 ? 'y' : ''} • ${a.damagePerLevel?.[level - 1] || 5} DMG`);
                    break;
                }
                case 'flamethrower':
                    parts.push(`${a.damagePerLevel?.[level - 1] || 10} DMG • ${a.intervalMsPerLevel?.[level - 1] || 800}ms`);
                    break;
                case 'chemo_aura':
                    parts.push(`explozivní projektily`);
                    break;
                case 'chain_lightning': {
                    const dmg = (a.baseDamage || 15) + (a.damagePerLevel || 10) * level;
                    parts.push(`${dmg} DMG • ${level + 1} zásahů`);
                    break;
                }
                case 'piercing':
                    parts.push(`průstřel ${a.maxPierces?.[level - 1] || level} nepřátel`);
                    break;
                case 'homing_shot':
                    parts.push(`+${a.speedBonusPerLevel?.[level - 1] || 20} rychlost • +${a.rangeBonusPerLevel?.[level - 1] || 50} dosah`);
                    break;
                case 'passive_regen':
                    parts.push(`+${a.hpPerTickPerLevel?.[level - 1] || 1} HP / ${((a.tickMsPerLevel?.[level - 1] || 3000) / 1000).toFixed(1)}s`);
                    break;
                case 'synaptic_pulse':
                    parts.push(`${a.damagePerLevel?.[level - 1] || 8} DMG • ${a.radiusPerLevel?.[level - 1] || 80}px`);
                    break;
                case 'orbital_antibodies':
                    parts.push(`${a.countPerLevel?.[level - 1] || 2}× ${a.damagePerLevel?.[level - 1] || 8} DMG`);
                    break;
                case 'chemo_pool':
                    parts.push(`${a.countPerLevel?.[level - 1] || 1}× ${a.damagePerLevel?.[level - 1] || 5} DMG pool`);
                    break;
                case 'antibody_boomerang':
                    parts.push(`${a.countPerLevel?.[level - 1] || 1}× ${a.damagePerLevel?.[level - 1] || 12} DMG`);
                    break;
                case 'ricochet_cell':
                    parts.push(`${a.countPerLevel?.[level - 1] || 1}× ${a.damagePerLevel?.[level - 1] || 10} DMG • ${a.bouncesPerLevel?.[level - 1] || 3} odrazů`);
                    break;
                case 'immune_aura':
                    parts.push(`${a.damagePerLevel?.[level - 1] || 5} DMG • ${a.radiusPerLevel?.[level - 1] || 60}px`);
                    break;
            }
        }

        return parts.length > 0 ? parts.join(' • ') : `Level ${level}`;
    }
}

