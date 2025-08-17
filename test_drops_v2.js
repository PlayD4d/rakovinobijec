// Test script v2 - Run in browser console to verify drops are working
console.log('=== DROP SYSTEM TEST v2 ===');

// Get the current game scene
const scene = window.currentScene || window.gameScene;
if (!scene) {
    console.error('Game scene not found! Make sure you are in-game.');
} else {
    console.log('✅ Game scene found');
    
    // Test enemy XP values
    const enemies = scene.enemiesGroup?.getChildren() || scene.enemies?.getChildren() || [];
    console.log(`Found ${enemies.length} enemies in scene`);
    
    if (enemies.length > 0) {
        const enemy = enemies[0];
        console.log(`First enemy: ${enemy.blueprintId || 'unknown'}`);
        console.log(`  - XP value: ${enemy.xp}`);
        console.log(`  - Has drops: ${!!enemy._blueprint?.drops}`);
        if (enemy._blueprint?.drops) {
            console.log(`  - Drop count: ${enemy._blueprint.drops.length}`);
            enemy._blueprint.drops.forEach(d => {
                console.log(`    • ${d.itemId} (${(d.chance * 100).toFixed(0)}% chance)`);
            });
        }
    }
    
    // Force kill an enemy to test drops
    if (enemies.length > 0 && enemies[0].active) {
        console.log('\n🎯 Killing first enemy to test drop system...');
        const enemy = enemies[0];
        
        // Store position for checking drops
        const x = enemy.x;
        const y = enemy.y;
        const xp = enemy.xp;
        
        console.log(`Enemy at (${x.toFixed(0)}, ${y.toFixed(0)}) with ${xp} XP`);
        
        // Kill the enemy
        scene.handleEnemyDeath(enemy);
        
        console.log('Enemy killed! Check console for:');
        console.log('  - [GameScene] createXPOrbs called');
        console.log('  - [SimpleLootSystem] createDrop called');
        console.log('  - [SimpleLootSystem] Drop created successfully');
        
        // Check loot group
        setTimeout(() => {
            const drops = scene.lootSystem?.lootGroup?.getChildren() || [];
            console.log(`\n📦 Drops in scene: ${drops.length}`);
            drops.forEach(drop => {
                console.log(`  - ${drop.dropId} at (${drop.x.toFixed(0)}, ${drop.y.toFixed(0)})`);
            });
        }, 100);
    }
}

console.log('\n💡 TIP: Kill more enemies manually to see the drop system in action!');
console.log('=== TEST COMPLETE ===');