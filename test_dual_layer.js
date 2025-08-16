/**
 * Test script for dual-layer rendering system
 * Run this in browser console to verify UI is never covered by game objects
 */

// Test function to verify dual-layer system
window.testDualLayer = function() {
    const scene = window.game?.scene?.getScene('GameScene');
    if (!scene) {
        console.error('❌ GameScene not found');
        return;
    }
    
    console.log('🔍 Testing Dual-Layer Rendering System...');
    console.log('=====================================');
    
    // 1. Check depth configuration
    console.log('\n1️⃣ Depth configuration:');
    console.log('   DEPTH_LAYERS:', scene.DEPTH_LAYERS ? '✅ Present' : '❌ Missing');
    if (scene.DEPTH_LAYERS) {
        console.log('   - Background:', scene.DEPTH_LAYERS.BACKGROUND);
        console.log('   - Enemies:', scene.DEPTH_LAYERS.ENEMIES);
        console.log('   - Player:', scene.DEPTH_LAYERS.PLAYER);
        console.log('   - Projectiles:', scene.DEPTH_LAYERS.PROJECTILES);
        console.log('   - UI Base:', scene.DEPTH_LAYERS.UI_BASE);
        console.log('   - UI Modal:', scene.DEPTH_LAYERS.UI_MODAL);
    }
    console.log('   UILayer:', scene.uiLayer ? '✅ Present' : '❌ Missing');
    
    // 2. Check player and enemy depth
    console.log('\n2️⃣ Entity depth configuration:');
    if (scene.player) {
        console.log('   Player depth:', scene.player.depth);
    }
    if (scene.enemies && scene.enemies.getChildren().length > 0) {
        const enemy = scene.enemies.getChildren()[0];
        console.log('   Enemy depth:', enemy.depth);
    }
    
    // 3. Check UI depth configuration
    console.log('\n3️⃣ UI depth configuration:');
    if (scene.unifiedHUD) {
        console.log('   HUD depth:', scene.unifiedHUD.depth);
    }
    if (scene.pauseMenu) {
        console.log('   PauseMenu depth:', scene.pauseMenu.depth);
    }
    
    // 4. Check UI objects in UI layer
    console.log('\n4️⃣ UILayer contents:');
    if (scene.uiLayer) {
        const uiChildren = scene.uiLayer.list || [];
        console.log('   Total UI elements:', uiChildren.length);
        
        let huds = 0, modals = 0, debugs = 0, texts = 0, others = 0;
        uiChildren.forEach(obj => {
            if (obj.constructor.name === 'UnifiedHUD') huds++;
            else if (obj.constructor.name.includes('Modal')) modals++;
            else if (obj.constructor.name === 'DebugOverlay') debugs++;
            else if (obj.type === 'Text') texts++;
            else others++;
        });
        
        console.log('   - HUD components:', huds);
        console.log('   - Modals:', modals);
        console.log('   - Debug overlays:', debugs);
        console.log('   - Text elements:', texts);
        console.log('   - Other:', others);
    }
    
    // 5. Spawn test projectiles to verify they don't cover UI
    console.log('\n5️⃣ Spawning test projectiles...');
    if (scene.projectileSystem) {
        const centerX = scene.scale.width / 2;
        const centerY = scene.scale.height / 2;
        
        // Fire projectiles in all directions
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            const dirX = Math.cos(angle);
            const dirY = Math.sin(angle);
            scene.projectileSystem.firePlayer(centerX, centerY, dirX, dirY, 0.5, 1, 1, 0x00FFFF);
        }
        console.log('   ✅ Spawned 8 test projectiles');
        console.log('   ⚠️ Check visually: Projectiles should NOT cover UI elements!');
    }
    
    // 6. Test pause menu visibility
    console.log('\n6️⃣ Testing pause menu...');
    if (scene.pauseMenu) {
        scene.pauseMenu.show();
        setTimeout(() => {
            console.log('   ⚠️ Check visually: Pause menu should be ABOVE all game objects!');
            console.log('   Press ESC to close pause menu');
        }, 100);
    }
    
    console.log('\n=====================================');
    console.log('✅ Dual-layer test complete!');
    console.log('Visual verification required:');
    console.log('1. UI elements (HUD, scores) should always be visible');
    console.log('2. Projectiles should pass UNDER UI elements');
    console.log('3. Pause menu should be ABOVE everything');
    
    return {
        depthLayers: scene.DEPTH_LAYERS,
        uiLayer: scene.uiLayer,
        player: scene.player,
        enemies: scene.enemies
    };
};

// Auto-run test
console.log('🎮 Dual-layer test ready! Run: testDualLayer()');