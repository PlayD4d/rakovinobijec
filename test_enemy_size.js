// Test script for enemy size issue
// Run in browser console after game starts

// Test function to spawn enemies with different sizes
function testEnemySize() {
    console.log('=== Testing Enemy Size ===');
    
    // Spawn micro shooter (should be size 16 now)
    const enemy1 = DEV.spawnEnemy('enemy.micro_shooter');
    console.log('Micro Shooter:', {
        blueprintId: enemy1.blueprintId,
        size: enemy1.size,
        displayWidth: enemy1.displayWidth,
        displayHeight: enemy1.displayHeight,
        scaleX: enemy1.scaleX,
        scaleY: enemy1.scaleY
    });
    
    // Spawn necrotic cell for comparison (size should be 18)
    setTimeout(() => {
        const enemy2 = DEV.spawnEnemy('enemy.necrotic_cell');
        console.log('Necrotic Cell:', {
            blueprintId: enemy2.blueprintId,
            size: enemy2.size,
            displayWidth: enemy2.displayWidth,
            displayHeight: enemy2.displayHeight,
            scaleX: enemy2.scaleX,
            scaleY: enemy2.scaleY
        });
    }, 1000);
    
    // Spawn viral swarm for comparison (size should be 16)
    setTimeout(() => {
        const enemy3 = DEV.spawnEnemy('enemy.viral_swarm');
        console.log('Viral Swarm:', {
            blueprintId: enemy3.blueprintId,
            size: enemy3.size,
            displayWidth: enemy3.displayWidth,
            displayHeight: enemy3.displayHeight,
            scaleX: enemy3.scaleX,
            scaleY: enemy3.scaleY
        });
    }, 2000);
}

// Instructions
console.log('To test enemy sizes, run: testEnemySize()');
console.log('Expected results:');
console.log('- Micro Shooter: size=16, displayWidth=16, displayHeight=16');
console.log('- Necrotic Cell: size=18, displayWidth=18, displayHeight=18');
console.log('- Viral Swarm: size=16, displayWidth=16, displayHeight=16');