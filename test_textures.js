// Test script to verify item textures are working
console.log('=== ITEM TEXTURE TEST ===');

const scene = window.currentScene || window.gameScene;
if (!scene) {
    console.error('Game scene not found!');
} else {
    // Check if textures exist
    const textures = [
        'item_xp_small',
        'item_xp_medium', 
        'item_xp_large',
        'item_health_small',
        'item_heal_orb',
        'item_protein_cache',
        'item_energy_cell',
        'item_metotrexat',
        'item_research_point'
    ];
    
    console.log('Checking textures:');
    textures.forEach(tex => {
        const exists = scene.textures.exists(tex);
        console.log(`  ${exists ? '✅' : '❌'} ${tex}`);
    });
    
    // Test spawn drops with textures
    if (scene.lootSystem && scene.player) {
        console.log('\nSpawning test drops with proper textures:');
        const x = scene.player.x;
        const y = scene.player.y;
        
        // Spawn different items
        scene.lootSystem.createDrop(x - 60, y, 'item.xp_small');
        scene.lootSystem.createDrop(x - 30, y, 'item.xp_medium');
        scene.lootSystem.createDrop(x, y, 'item.xp_large');
        scene.lootSystem.createDrop(x + 30, y, 'item.health_small');
        scene.lootSystem.createDrop(x + 60, y, 'item.metotrexat');
        
        console.log('✅ Drops spawned! They should have proper textures now.');
    }
}

console.log('\n💡 Kill enemies to see properly textured drops!');
console.log('=== TEST COMPLETE ===');