// Test script for verifying XP and health drops
// Run this in the browser console during gameplay

// Test 1: Check if SimpleLootSystem is initialized
console.log('=== DROP SYSTEM TEST ===');
console.log('SimpleLootSystem exists:', !!window.currentScene?.lootSystem);
console.log('BlueprintLoader exists:', !!window.currentScene?.blueprintLoader);

// Test 2: Check if XP blueprints are loaded
const xpSmall = window.currentScene?.blueprintLoader?.get('item.xp_small');
const xpMedium = window.currentScene?.blueprintLoader?.get('item.xp_medium');
const xpLarge = window.currentScene?.blueprintLoader?.get('item.xp_large');
const healthSmall = window.currentScene?.blueprintLoader?.get('item.health_small');

console.log('XP Small blueprint:', !!xpSmall, xpSmall?.id);
console.log('XP Medium blueprint:', !!xpMedium, xpMedium?.id);
console.log('XP Large blueprint:', !!xpLarge, xpLarge?.id);
console.log('Health Small blueprint:', !!healthSmall, healthSmall?.id);

// Test 3: Manually spawn drops at player position
if (window.currentScene?.lootSystem && window.currentScene?.player) {
    const player = window.currentScene.player;
    
    console.log('Spawning test drops at player position...');
    
    // Spawn XP orbs
    window.currentScene.lootSystem.createDrop(player.x - 50, player.y, 'item.xp_small');
    window.currentScene.lootSystem.createDrop(player.x, player.y, 'item.xp_medium');
    window.currentScene.lootSystem.createDrop(player.x + 50, player.y, 'item.xp_large');
    
    // Spawn health drop
    window.currentScene.lootSystem.createDrop(player.x, player.y - 50, 'item.health_small');
    
    console.log('Test drops spawned! Check if they appear in game.');
} else {
    console.log('Cannot spawn drops - scene or player not ready');
}

// Test 4: Check enemy XP values
const enemies = window.currentScene?.enemiesGroup?.getChildren() || [];
console.log(`Found ${enemies.length} active enemies`);
enemies.slice(0, 3).forEach(enemy => {
    console.log(`Enemy ${enemy.blueprintId}: XP=${enemy.xp}, has drops=${!!enemy._blueprint?.drops}`);
});

console.log('=== TEST COMPLETE ===');
console.log('Kill an enemy to see debug logs for drop creation');