/**
 * Test Armor System
 * Verifies how armor reduces damage
 */

window.testArmorSystem = function() {
    console.log('=== ARMOR SYSTEM TEST ===\n');
    
    const scene = window.game.scene.getScene('GameScene');
    if (!scene) {
        console.error('GameScene not active');
        return;
    }
    
    // Test enemies with different armor values
    const testEnemies = [
        { id: 'enemy.micro_shooter', expectedArmor: 0, name: 'Micro Shooter (no armor)' },
        { id: 'enemy.acidic_blob', expectedArmor: 1, name: 'Acidic Blob (armor 1)' },
        { id: 'enemy.micro_shooter_enhanced', expectedArmor: 2, name: 'Enhanced Shooter (armor 2)' },
        { id: 'enemy.shielding_helper', expectedArmor: 3, name: 'Shielding Helper (armor 3)' },
        { id: 'enemy.aberrant_cell', expectedArmor: 5, name: 'Aberrant Cell (armor 5)' }
    ];
    
    const results = [];
    // PR7: Získat base damage z ConfigResolver
    const baseDamage = window.ConfigResolver?.get('mechanics.projectile.stats.damage', { defaultValue: 10 }) || 10;
    
    testEnemies.forEach(test => {
        const blueprint = scene.blueprintLoader?.get(test.id);
        if (!blueprint) {
            console.error(`Blueprint not found: ${test.id}`);
            return;
        }
        
        // Spawn enemy
        const enemy = scene.createEnemyFromBlueprint(test.id, {
            x: 400 + Math.random() * 200,
            y: 300 + Math.random() * 200
        });
        
        if (!enemy) {
            console.error(`Failed to spawn ${test.id}`);
            return;
        }
        
        const initialHP = enemy.hp;
        const armor = enemy.armor;
        
        // Simulate damage
        enemy.takeDamage(baseDamage, null);
        
        const actualDamage = initialHP - enemy.hp;
        const expectedDamage = Math.max(1, baseDamage - armor); // Min 1 damage always
        
        results.push({
            name: test.name,
            armor: armor,
            expectedArmor: test.expectedArmor,
            baseDamage: baseDamage,
            expectedDamage: expectedDamage,
            actualDamage: actualDamage,
            armorWorking: actualDamage === expectedDamage,
            enemy: enemy
        });
    });
    
    // Display results
    console.log('Base damage applied: ' + baseDamage);
    console.log('\n📊 ARMOR TEST RESULTS:\n');
    
    results.forEach(result => {
        const status = result.armorWorking ? '✅' : '❌';
        console.log(`${status} ${result.name}`);
        console.log(`   Armor: ${result.armor} (expected: ${result.expectedArmor})`);
        console.log(`   Damage dealt: ${result.actualDamage} (expected: ${result.expectedDamage})`);
        console.log(`   Damage reduction: ${baseDamage - result.actualDamage}`);
        
        if (!result.armorWorking) {
            console.error(`   ERROR: Armor not working correctly!`);
        }
    });
    
    // Check for visual indicators
    console.log('\n🎨 VISUAL ARMOR INDICATORS:');
    
    const hasVisualIndicator = results.some(r => {
        const enemy = r.enemy;
        // Check for any armor-related visual properties
        const hasArmorGraphics = enemy.armorGraphics !== undefined;
        const hasArmorTint = enemy.armor > 0 && enemy.tint !== undefined;
        const hasArmorIcon = enemy.armorIcon !== undefined;
        
        return hasArmorGraphics || hasArmorIcon;
    });
    
    if (hasVisualIndicator) {
        console.log('✅ Armor has visual representation');
    } else {
        console.log('❌ No visual representation for armor found');
        console.log('   Armor only affects damage calculation');
    }
    
    // Cleanup
    console.log('\nEnemies spawned for testing. Use DEV.killAll() to remove.');
    
    // Summary
    const allWorking = results.every(r => r.armorWorking);
    if (allWorking) {
        console.log('\n✅ ARMOR SYSTEM WORKING CORRECTLY');
        console.log('Armor reduces damage by flat amount (min 1 damage always goes through)');
    } else {
        console.log('\n❌ ARMOR SYSTEM HAS ISSUES');
    }
    
    return results;
};

// How armor works explanation
console.log('=== HOW ARMOR WORKS ===');
console.log('1. Armor is a flat damage reduction (not percentage)');
console.log('2. Formula: finalDamage = max(1, damage - armor)');
console.log('3. Minimum 1 damage always goes through');
console.log('4. Example: 10 damage vs 3 armor = 7 damage taken');
console.log('5. Example: 3 damage vs 5 armor = 1 damage taken (minimum)');
console.log('\nRun testArmorSystem() to test the armor system');