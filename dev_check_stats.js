/**
 * Dev command to check enemy stats
 * Add this to devConsole.js
 */

// Add to DEV object
window.DEV = window.DEV || {};

window.DEV.checkStats = function(enemyId = 'enemy.micro_shooter') {
    const scene = window.game.scene.getScene('GameScene');
    if (!scene) {
        console.error('GameScene not active');
        return;
    }
    
    // Get blueprint
    const blueprint = scene.blueprintLoader?.get(enemyId);
    if (!blueprint) {
        console.error(`Blueprint not found: ${enemyId}`);
        return;
    }
    
    // PR7: Spawn enemy near player using ConfigResolver default values
    const player = scene.player;
    const defaultX = window.ConfigResolver?.get('spawning.defaultPosition.x', { defaultValue: 400 }) || 400;
    const defaultY = window.ConfigResolver?.get('spawning.defaultPosition.y', { defaultValue: 300 }) || 300;
    const x = player ? player.x + 100 : defaultX;
    const y = player ? player.y : defaultY;
    
    const enemy = scene.createEnemyFromBlueprint(enemyId, { x, y });
    
    if (!enemy) {
        console.error(`Failed to spawn ${enemyId}`);
        return;
    }
    
    // Compare stats
    console.log(`\n=== STATS CHECK: ${enemyId} ===`);
    console.log('\n📋 BLUEPRINT STATS:');
    console.log(`  HP: ${blueprint.stats.hp}`);
    console.log(`  Damage: ${blueprint.stats.damage}`);
    console.log(`  Speed: ${blueprint.stats.speed}`);
    console.log(`  Size: ${blueprint.stats.size}`);
    console.log(`  Armor: ${blueprint.stats.armor}`);
    console.log(`  XP: ${blueprint.stats.xp}`);
    
    console.log('\n🎮 ACTUAL ENTITY STATS:');
    console.log(`  HP: ${enemy.hp} / ${enemy.maxHp}`);
    console.log(`  Damage: ${enemy.damage}`);
    console.log(`  Speed: ${enemy.speed}`);
    console.log(`  Size: ${enemy.size}`);
    console.log(`  Armor: ${enemy.armor}`);
    console.log(`  XP: ${enemy.xp}`);
    
    console.log('\n📐 DISPLAY PROPERTIES:');
    console.log(`  Display Width: ${enemy.displayWidth}`);
    console.log(`  Display Height: ${enemy.displayHeight}`);
    console.log(`  Scale X: ${enemy.scaleX}`);
    console.log(`  Scale Y: ${enemy.scaleY}`);
    
    // Check for mismatches
    const mismatches = [];
    if (blueprint.stats.hp !== enemy.hp) mismatches.push('HP');
    if (blueprint.stats.damage !== enemy.damage) mismatches.push('Damage');
    if (blueprint.stats.speed !== enemy.speed) mismatches.push('Speed');
    if (blueprint.stats.size !== enemy.size) mismatches.push('Size');
    if (blueprint.stats.armor !== enemy.armor && blueprint.stats.armor !== undefined) mismatches.push('Armor');
    if (blueprint.stats.xp !== enemy.xp) mismatches.push('XP');
    
    if (mismatches.length > 0) {
        console.error(`\n❌ MISMATCHES FOUND: ${mismatches.join(', ')}`);
        console.error('PR7 VIOLATION: Blueprint is not single source of truth!');
    } else {
        console.log('\n✅ ALL STATS MATCH - PR7 Compliant!');
    }
    
    // Don't destroy - let user see the enemy
    console.log('\nEnemy spawned at position. Use DEV.killAll() to remove.');
    
    return {
        blueprint: blueprint.stats,
        actual: {
            hp: enemy.hp,
            damage: enemy.damage,
            speed: enemy.speed,
            size: enemy.size,
            armor: enemy.armor,
            xp: enemy.xp
        },
        display: {
            width: enemy.displayWidth,
            height: enemy.displayHeight,
            scaleX: enemy.scaleX,
            scaleY: enemy.scaleY
        }
    };
};

console.log('DEV.checkStats() loaded!');
console.log('Usage: DEV.checkStats("enemy.micro_shooter")');